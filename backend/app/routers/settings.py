from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from typing import List, Optional

from ..db import Setting
from ..database import get_session

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

@router.put("/{key}", response_model=Setting)
def update_setting(key: str, value: str, description: Optional[str] = None, session: Session = Depends(get_session)):
    setting = session.get(Setting, key)
    if not setting:
        # create if not exists
        setting = Setting(key=key, value=value, description=description)
        session.add(setting)
    else:
        setting.value = value
        if description is not None:
            setting.description = description
    session.commit()
    session.refresh(setting)
    return setting
