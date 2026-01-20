from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlmodel import Session, select
from typing import List
import pandas as pd
import io
from datetime import datetime

from ..db import RateEntry, RateAudit
from ..database import get_session

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
    rates = session.exec(select(RateEntry).order_by(RateEntry.id.desc()).offset(skip).limit(limit)).all()
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
    # Column mapping for user's specific format
    # user_col: db_col
    col_map = {
        "PartNumber": "part_number",
        "Workstation": "machine",
        "StandardRatePPH": "ideal_units_per_hour",
        "IdealCycleTimeSeconds": "ideal_cycle_time_seconds"
    }
    df.rename(columns=col_map, inplace=True)
    
    # Normalize defaults
    if "operator" not in df.columns:
        df["operator"] = "Any"
    if "start_date" not in df.columns:
        df["start_date"] = datetime.today().date()
    if "active" not in df.columns:
        df["active"] = True
    
    # Required columns check (after mapping)
    required_cols = {"operator", "machine", "part_number"}
    missing = required_cols - set(df.columns.str.lower())
    # Note: we are lenient with job/ideal_units if we can derive them or they are optional
    if "part_number" not in df.columns: # Critical one
        raise HTTPException(status_code=400, detail=f"Missing required column: Part Number")

    # Save to DB
    count = 0
    for _, row in df.iterrows():
        # Basic validation
        if pd.isna(row.get('part_number')): continue
        
        rate = RateEntry(
            operator=str(row.get('operator', 'Any')),
            machine=str(row.get('machine', 'Unknown')),
            part_number=str(row['part_number']),
            job=str(row.get('job', '')),
            ideal_units_per_hour=float(row.get('ideal_units_per_hour')) if pd.notna(row.get('ideal_units_per_hour')) else None,
            ideal_cycle_time_seconds=float(row.get('ideal_cycle_time_seconds')) if pd.notna(row.get('ideal_cycle_time_seconds')) else None,
            start_date=pd.to_datetime(row.get('start_date')).date(),
            active=bool(row.get('active', True)),
            notes="Bulk Upload"
        )
        session.add(rate)
        count += 1
    
    session.commit()
    return {"message": f"Successfully uploaded {count} rates."}
