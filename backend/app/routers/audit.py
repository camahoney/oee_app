from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select, desc
from typing import Optional

from ..db import AuditLog
from ..database import get_session
from .auth import require_role

router = APIRouter()


@router.get("/log")
def get_audit_log(
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
    action: Optional[str] = None,
    user_email: Optional[str] = None,
    current_user=Depends(require_role("admin", "manager")),
    session: Session = Depends(get_session)
):
    """Paginated audit log (admin/manager only)."""
    query = select(AuditLog).order_by(desc(AuditLog.timestamp))
    if action:
        query = query.where(AuditLog.action == action)
    if user_email:
        query = query.where(AuditLog.user_email == user_email)
    query = query.offset(offset).limit(limit)
    entries = session.exec(query).all()
    return entries
