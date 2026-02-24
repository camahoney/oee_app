from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from typing import List, Optional
from pydantic import BaseModel
import json

from ..db import Setting, User
from ..database import get_session
from .auth import get_optional_user, get_current_user, require_role, log_action

router = APIRouter()

@router.get("/", response_model=List[Setting])
def list_settings(session: Session = Depends(get_session)):
    """List all settings — public read."""
    settings = session.exec(select(Setting)).all()
    return settings

@router.get("/{key}", response_model=Setting)
def get_setting(key: str, session: Session = Depends(get_session)):
    """Get a single setting — public read."""
    setting = session.get(Setting, key)
    if not setting:
        raise HTTPException(status_code=404, detail="Setting not found")
    return setting

class SettingUpdate(BaseModel):
    value: str
    description: Optional[str] = None

@router.put("/{key}", response_model=Setting)
def update_setting(key: str, setting_data: SettingUpdate, user: Optional[User] = Depends(get_optional_user), session: Session = Depends(get_session)):
    """Update a setting.
    - production_board_state: supervisors can update (with shift-scope enforcement)
    - all other settings: admin/manager only
    """
    # Determine permissions based on key
    if key == "production_board_state":
        # Supervisors can update production board state, but only for their shift
        if user and user.role == "viewer":
            raise HTTPException(status_code=403, detail="Viewer accounts are read-only")

        # If supervisor, enforce shift-scope on the board state
        if user and user.role == "supervisor" and user.shift_scope:
            _enforce_shift_scope_on_board(key, setting_data.value, user, session)
    else:
        # All other settings require admin or manager
        if not user or user.role not in ("admin", "manager"):
            raise HTTPException(status_code=403, detail="Only admin/manager can modify settings")

    setting = session.get(Setting, key)
    old_value = setting.value if setting else None

    if not setting:
        setting = Setting(key=key, value=setting_data.value, description=setting_data.description)
        session.add(setting)
    else:
        setting.value = setting_data.value
        if setting_data.description is not None:
            setting.description = setting_data.description

    session.commit()
    session.refresh(setting)

    # Audit log for board state changes
    if key == "production_board_state" and user:
        log_action(session, user, "board_state_update", shift=user.shift_scope, details=f"key={key}")

    return setting


def _enforce_shift_scope_on_board(key: str, new_value: str, user: User, session: Session):
    """Compare old vs new board state and reject if supervisor modified other shifts' operators."""
    old_setting = session.get(Setting, key)
    if not old_setting:
        return  # First save, allow

    try:
        old_state = json.loads(old_setting.value)
        new_state = json.loads(new_value)
    except (json.JSONDecodeError, TypeError):
        return  # Can't parse, allow but it'll likely fail elsewhere

    old_cats = {c.get('id'): c for c in old_state.get('categories', [])}
    new_cats = {c.get('id'): c for c in new_state.get('categories', [])}

    user_shift = user.shift_scope

    # Check that supervisor hasn't modified other shifts' operators
    for cat_id, new_cat in new_cats.items():
        old_cat = old_cats.get(cat_id)
        if not old_cat:
            continue

        old_machines = {m.get('id'): m for m in old_cat.get('machines', [])}
        for new_mac in new_cat.get('machines', []):
            mac_id = new_mac.get('id')
            old_mac = old_machines.get(mac_id)
            if not old_mac:
                continue

            old_shift_ops = old_mac.get('shiftOperators', {})
            new_shift_ops = new_mac.get('shiftOperators', {})

            # Check each shift key — supervisor can only change their own
            for shift_key in set(list(old_shift_ops.keys()) + list(new_shift_ops.keys())):
                if shift_key == user_shift:
                    continue  # Allowed
                if old_shift_ops.get(shift_key) != new_shift_ops.get(shift_key):
                    raise HTTPException(
                        status_code=403,
                        detail=f"You cannot modify operators for '{shift_key}'. You only have access to '{user_shift}'."
                    )

    # Also block category add/remove/rename for supervisors
    if set(old_cats.keys()) != set(new_cats.keys()):
        raise HTTPException(status_code=403, detail="Supervisors cannot add or remove categories")

    for cat_id in old_cats:
        if cat_id in new_cats:
            old_machine_ids = {m.get('id') for m in old_cats[cat_id].get('machines', [])}
            new_machine_ids = {m.get('id') for m in new_cats[cat_id].get('machines', [])}
            if old_machine_ids != new_machine_ids:
                raise HTTPException(status_code=403, detail="Supervisors cannot add or remove machines")
