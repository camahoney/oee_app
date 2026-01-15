from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlmodel import Session, select
from typing import List
import pandas as pd
import io
from datetime import datetime

from ..db import RateEntry, RateAudit, get_session

router = APIRouter()

# Helper to create audit record
def log_audit(session: Session, rate_id: int, user_id: int, field: str, old: str, new: str):
    audit = RateAudit(
        rate_entry_id=rate_id,
        changed_by=user_id,
        changed_at=datetime.utcnow(),
        field_name=field,
        old_value=old,
        new_value=new,
    )
    session.add(audit)

# CRUD endpoints
@router.get("/", response_model=List[RateEntry])
def list_rates(skip: int = 0, limit: int = 100, session: Session = Depends(get_session)):
    rates = session.exec(select(RateEntry).offset(skip).limit(limit)).all()
    return rates

@router.get("/{rate_id}", response_model=RateEntry)
def get_rate(rate_id: int, session: Session = Depends(get_session)):
    rate = session.get(RateEntry, rate_id)
    if not rate:
        raise HTTPException(status_code=404, detail="Rate not found")
    return rate

@router.post("/", response_model=RateEntry, status_code=status.HTTP_201_CREATED)
def create_rate(rate: RateEntry, session: Session = Depends(get_session)):
    session.add(rate)
    session.commit()
    session.refresh(rate)
    return rate

@router.put("/{rate_id}", response_model=RateEntry)
def update_rate(rate_id: int, updated: RateEntry, session: Session = Depends(get_session)):
    db_rate = session.get(RateEntry, rate_id)
    if not db_rate:
        raise HTTPException(status_code=404, detail="Rate not found")
    # Simple field-by-field update with audit logging
    user_id = 0  # placeholder; replace with actual user from auth
    for field in RateEntry.__fields__:
        if field == "id":
            continue
        new_val = getattr(updated, field)
        old_val = getattr(db_rate, field)
        if new_val != old_val:
            log_audit(session, rate_id, user_id, field, str(old_val), str(new_val))
            setattr(db_rate, field, new_val)
    session.add(db_rate)
    session.commit()
    session.refresh(db_rate)
    return db_rate

@router.delete("/{rate_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_rate(rate_id: int, session: Session = Depends(get_session)):
    rate = session.get(RateEntry, rate_id)
    if not rate:
        raise HTTPException(status_code=404, detail="Rate not found")
    session.delete(rate)
    session.commit()
    return

# Upload CSV/XLSX with validation and preview
@router.post("/upload", status_code=status.HTTP_202_ACCEPTED)
def upload_rates(file: UploadFile = File(...), session: Session = Depends(get_session)):
    if file.content_type not in ["text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel"]:
        raise HTTPException(status_code=400, detail="Unsupported file type")
    contents = file.file.read()
    if file.filename.endswith('.csv'):
        df = pd.read_csv(io.BytesIO(contents))
    else:
        df = pd.read_excel(io.BytesIO(contents))
    required_cols = {"operator", "machine", "part_number", "job", "ideal_units_per_hour", "start_date"}
    missing = required_cols - set(df.columns.str.lower())
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing required columns: {', '.join(missing)}")
    # Return preview (first 5 rows) to frontend for confirmation
    preview = df.head().to_dict(orient="records")
    return {"preview": preview, "message": "File parsed successfully. Confirm to apply."}
