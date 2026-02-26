from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from typing import List, Optional
from pydantic import BaseModel
import json

from ..db import Setting, User
from ..database import get_session
from .auth import get_current_user

router = APIRouter()

@router.get("/", response_model=List[Setting])
def list_settings(session: Session = Depends(get_session)):
    settings = session.exec(select(Setting)).all()
    return settings

@router.get("/{key}", response_model=Setting)
def get_setting(key: str, session: Session = Depends(get_session)):
    setting = session.get(Setting, key)
    if not setting:
        raise HTTPException(status_code=404, detail="Setting not found")
    return setting

class SettingUpdate(BaseModel):
    value: str
    description: Optional[str] = None

@router.put("/{key}", response_model=Setting)
def update_setting(key: str, setting_data: SettingUpdate, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    # RBAC logic
    if key == "production_board_state":
        # Supervisors can save the board state (we rely on frontend UI to disable other shifts for them right now)
        if current_user.role not in ["admin", "manager", "supervisor"]:
            raise HTTPException(status_code=403, detail="Not authorized to update board state")
    else:
        # All other settings require admin or manager
        if current_user.role not in ["admin", "manager"]:
            raise HTTPException(status_code=403, detail="Not authorized to modify settings")

    setting = session.get(Setting, key)
    if not setting:
        # create if not exists
        setting = Setting(key=key, value=setting_data.value, description=setting_data.description)
        session.add(setting)
    else:
        setting.value = setting_data.value
        if setting_data.description is not None:
            setting.description = setting_data.description
    session.commit()
    session.refresh(setting)
    return setting
