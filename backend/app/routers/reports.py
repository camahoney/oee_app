from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlmodel import Session, select
from typing import List, Dict, Any
import pandas as pd
import io
from datetime import datetime, date

from ..db import ProductionReport, ReportEntry, Oeemetric
from ..database import get_session

router = APIRouter()

# Helper to parse dates safely
def parse_date(value) -> date:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    try:
        return datetime.strptime(str(value), "%Y-%m-%d").date()
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {value}")

@router.post("/upload", status_code=status.HTTP_202_ACCEPTED)
def upload_report(file: UploadFile = File(...), session: Session = Depends(get_session)):
    # Relaxed validation - rely on extension
    # if file.content_type not in ... (removed to allow diverse browser MIME types)
    
    contents = file.file.read()
    if file.filename.lower().endswith('.csv'):
        try:
            # utf-8-sig handles BOM if present, and plain utf-8 if not
            df = pd.read_csv(io.BytesIO(contents), encoding='utf-8-sig')
        except UnicodeDecodeError:
            df = pd.read_csv(io.BytesIO(contents), encoding='cp1252')
    else:
        df = pd.read_excel(io.BytesIO(contents))
    # Rename columns using a map for flexibility
    # keys = lower case user columns, values = db columns
    # Note: User has "Part #s", "Position", "SO#s", "Pay Code", "Good Pieces", "Scrap", "Lab", "Uptime", "Downtime"
    col_map = {
        "part #s": "part_number",
        "part #": "part_number",
        "partnumber": "part_number",
        "part_number": "part_number",
        
        "operator": "operator",
        
        "position": "machine",
        "machine": "machine",
        "workstation": "machine",
        
        "so#s": "job",
        "so#": "job",
        "job": "job",
        
        "good pieces": "good_count",
        "good": "good_count",
        "goodcount": "good_count",
        
        "scrap": "reject_count",
        "reject": "reject_count",
        "rejectcount": "reject_count",
        "rejects": "reject_count",
        
        "uptime": "run_time_min",
        "runtime": "run_time_min",
        "run time": "run_time_min",
        "run_time_min": "run_time_min",
        
        "downtime": "downtime_min",
        "downtime_min": "downtime_min",
        
        "date": "date",
        "shift": "shift"
    }
    
    # Normalize checks to lowercase
    renamed = {}
    for col in df.columns:
        norm = str(col).strip().lower()
        if norm in col_map:
            renamed[col] = col_map[norm]
    df.rename(columns=renamed, inplace=True)
    
    # Defaults and Calculations
    # 1. Date: If missing, default to today
    if "date" not in df.columns:
        # Check if it looks like a filename date? For now, default to today
        df["date"] = datetime.today().date()
    
    # 2. Counts: Ensure good/reject/total exist
    if "good_count" not in df.columns: df["good_count"] = 0
    if "reject_count" not in df.columns: df["reject_count"] = 0
    df["good_count"] = df["good_count"].fillna(0)
    df["reject_count"] = df["reject_count"].fillna(0)
    
    if "total_count" not in df.columns:
        df["total_count"] = df["good_count"] + df["reject_count"]
    
    # 3. Times: Ensure run/down exist, handle HOURS detection
    # If explicit, trust it. If user uploaded hours (likely < 24 for a single shift row), convert to min.
    # Heuristic: If max(run_time) < 24, assume Hours and multiply by 60? 
    # Or just assume "Uptime" column usually implies Hours in this context. 
    # Let's strictly check the source column name from map? Hard to trace back after rename.
    # Simple Heuristic: If the run_time is small (< 12) it's almost certainly hours.
    
    if "run_time_min" not in df.columns: df["run_time_min"] = 0.0
    if "downtime_min" not in df.columns: df["downtime_min"] = 0.0
    
    df["run_time_min"] = df["run_time_min"].fillna(0.0)
    df["downtime_min"] = df["downtime_min"].fillna(0.0)

    # Unit Conversion Heuristic
    # If the average run time is < 12 (hours), likely it is hours. 480 min = 8 hours.
    if not df.empty and df["run_time_min"].mean() < 12:
         df["run_time_min"] = df["run_time_min"] * 60
         df["downtime_min"] = df["downtime_min"] * 60

    if "planned_production_time_min" not in df.columns:
        df["planned_production_time_min"] = df["run_time_min"] + df["downtime_min"]
        
    # Validation
    required_db_cols = {"part_number", "run_time_min", "good_count"}
    missing = required_db_cols - set(df.columns)
    if missing:
         raise HTTPException(status_code=400, detail=f"Could not map columns. Missing: {', '.join(missing)}")

    # Store the report metadata
    report = ProductionReport(filename=file.filename, uploaded_at=datetime.utcnow())
    session.add(report)
    session.commit()
    session.refresh(report)
    
    # Insert each row as ReportEntry
    entries = []
    for _, row in df.iterrows():
        try:
             entry = ReportEntry(
                report_id=report.id,
                date=parse_date(row['date']),
                operator=str(row.get('operator', 'Unknown')),
                machine=str(row.get('machine', 'Unknown')),
                part_number=str(row.get('part_number', 'Unknown')),
                job=str(row.get('job', '')),
                planned_production_time_min=float(row.get('planned_production_time_min', 0)),
                run_time_min=float(row.get('run_time_min', 0)),
                downtime_min=float(row.get('downtime_min', 0)),
                total_count=int(row.get('total_count', 0)),
                good_count=int(row.get('good_count', 0)),
                reject_count=int(row.get('reject_count', 0)),
                shift=str(row.get('shift', '')),
                raw_row_json=row.to_json(),
            )
             entries.append(entry)
        except Exception as e:
            # Skip bad rows or log? For now skip
            continue
            
    session.bulk_save_objects(entries)
    session.commit()
    # Return a simple preview of first few rows
    preview = df.head().to_dict(orient="records")
    return {"report_id": report.id, "preview": preview, "message": "Report uploaded and stored. Metrics will be calculated on demand."}

@router.get("/{report_id}", response_model=ProductionReport)
def get_report(report_id: int, session: Session = Depends(get_session)):
    report = session.get(ProductionReport, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report
