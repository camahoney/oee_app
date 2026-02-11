from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status, BackgroundTasks
from sqlmodel import Session, select
from typing import List
import pandas as pd
import io
from datetime import datetime

from ..db import RateEntry, RateAudit, ReportEntry
from ..database import get_session, engine
# Import calculation logic (deferred import or direct if safe)
# Since metrics imports from .db and .database, and rates does too, we can try direct import.
# Note: routers/metrics.py is a sibling.
from .metrics import calculate_report_metrics_logic

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

def recalculate_affected_reports(part_number: str, session: Session):
    """Finds all reports containing the part number and recalculates their metrics."""
    # Find unique report IDs that have this part number
    stmt = select(ReportEntry.report_id).where(ReportEntry.part_number == part_number).distinct()
    report_ids = session.exec(stmt).all()
    
    print(f"Retroactive Recalc: Triggered for Part {part_number}. Found {len(report_ids)} affected reports.")
    
    for rid in report_ids:
        try:
            calculate_report_metrics_logic(rid, session)
        except Exception as e:
            print(f"Failed to recalculate report {rid}: {e}")

def run_recalc_background(part_number: str):
    """Background task wrapper to ensure a dedicated session."""
    with Session(engine) as session:
        try:
            recalculate_affected_reports(part_number, session)
        except Exception as e:
            print(f"Background Recalc Error for Part {part_number}: {e}")

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
def create_rate(rate: RateEntry, background_tasks: BackgroundTasks, session: Session = Depends(get_session)):
    session.add(rate)
    session.commit()
    session.refresh(rate)
    
    # Retroactive Calculation (Async)
    if rate.part_number:
        background_tasks.add_task(run_recalc_background, rate.part_number)

    return rate

@router.put("/{rate_id}", response_model=RateEntry)
def update_rate(rate_id: int, updated: RateEntry, background_tasks: BackgroundTasks, session: Session = Depends(get_session)):
    db_rate = session.get(RateEntry, rate_id)
    if not db_rate:
        raise HTTPException(status_code=404, detail="Rate not found")
    
    old_part = db_rate.part_number
    
    
    # Simple field-by-field update with audit logging
    user_id = 1  # Fix: Use ID 1 (Admin) instead of 0 to avoid FK violation
    try:
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
    except Exception as e:
        session.rollback()
        print(f"Update Rate Error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update rate: {str(e)}")
        
    session.refresh(db_rate)
    
    # Trigger Recalc if relevant fields changed (Async)
    impacted_parts = set()
    if old_part: impacted_parts.add(old_part)
    if db_rate.part_number: impacted_parts.add(db_rate.part_number)
    
    for p in impacted_parts:
         background_tasks.add_task(run_recalc_background, p)

    return db_rate

@router.delete("/{rate_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_rate(rate_id: int, background_tasks: BackgroundTasks, session: Session = Depends(get_session)):
    rate = session.get(RateEntry, rate_id)
    if not rate:
        raise HTTPException(status_code=404, detail="Rate not found")
    
    part_number = rate.part_number
    session.delete(rate)
    session.commit()
    
    # Recalc (Async)
    if part_number:
        background_tasks.add_task(run_recalc_background, part_number)
        
    return

# Upload CSV/XLSX with validation and preview
@router.post("/upload", status_code=status.HTTP_202_ACCEPTED)
def upload_rates(file: UploadFile = File(...), background_tasks: BackgroundTasks = None, session: Session = Depends(get_session)):
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
        "StandardRatePPH": "ideal_units_per_hour",
        "IdealCycleTimeSeconds": "ideal_cycle_time_seconds",
        "Cavities": "cavity_count",
        "EntryMode": "entry_mode",
        "MachineCycleTime": "machine_cycle_time"
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
    affected_parts = set()
    
    for _, row in df.iterrows():
        # Basic validation
        if pd.isna(row.get('part_number')): continue
        
        part_num = str(row['part_number'])
        affected_parts.add(part_num)
        
        rate = RateEntry(
            operator=str(row.get('operator', 'Any')),
            machine=str(row.get('machine', 'Unknown')),
            part_number=part_num,
            job=str(row.get('job', '')),
            ideal_units_per_hour=float(row.get('ideal_units_per_hour')) if pd.notna(row.get('ideal_units_per_hour')) else None,
            ideal_cycle_time_seconds=float(row.get('ideal_cycle_time_seconds')) if pd.notna(row.get('ideal_cycle_time_seconds')) else None,
            start_date=pd.to_datetime(row.get('start_date')).date(),
            active=bool(row.get('active', True)),

            cavity_count=int(row.get('cavity_count', 1)),
            entry_mode=str(row.get('entry_mode', 'seconds')),
            machine_cycle_time=float(row.get('machine_cycle_time')) if pd.notna(row.get('machine_cycle_time')) else None,
            notes="Bulk Upload"
        )
        session.add(rate)
        count += 1
    
    session.commit()
    
    # Bulk Recalc (Async)
    print(f"Bulk Upload: Triggering background recalc for {len(affected_parts)} parts...")
    if background_tasks:
        for p in affected_parts:
             background_tasks.add_task(run_recalc_background, p)
    else:
        # Fallback if bg tasks not available (shouldn't happen with correct dependency)
        for p in affected_parts:
             run_recalc_background(p)
         
    return {"message": f"Successfully uploaded {count} rates. Metrics usually updated within seconds."}
