from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlmodel import Session, select
from typing import List, Dict, Any
import pandas as pd
import io
from datetime import datetime, date

from ..db import ProductionReport, ReportEntry, Oeemetric, get_session

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
    # Validate file type
    if file.content_type not in ["text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel"]:
        raise HTTPException(status_code=400, detail="Unsupported file type")
    contents = file.file.read()
    if file.filename.endswith('.csv'):
        df = pd.read_csv(io.BytesIO(contents))
    else:
        df = pd.read_excel(io.BytesIO(contents))
    # Expected columns (case‑insensitive)
    required = {"date", "operator", "machine", "part_number", "job", "planned_production_time_min", "run_time_min", "downtime_min", "total_count", "good_count", "reject_count"}
    missing = required - set(map(str.lower, df.columns))
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing required columns: {', '.join(missing)}")
    # Store the report metadata
    report = ProductionReport(filename=file.filename, uploaded_at=datetime.utcnow())
    session.add(report)
    session.commit()
    session.refresh(report)
    # Insert each row as ReportEntry
    entries = []
    for _, row in df.iterrows():
        entry = ReportEntry(
            report_id=report.id,
            date=parse_date(row.get('date') or row.get('Date')),
            operator=row.get('operator') or row.get('Operator'),
            machine=row.get('machine') or row.get('Machine'),
            part_number=row.get('part_number') or row.get('PartNumber') or row.get('Part_Number'),
            job=row.get('job') or row.get('Job'),
            planned_production_time_min=row.get('planned_production_time_min') or row.get('PlannedProductionTime') or row.get('Planned_Production_Time'),
            run_time_min=row.get('run_time_min') or row.get('RunTime') or row.get('Run_Time'),
            downtime_min=row.get('downtime_min') or row.get('Downtime'),
            total_count=row.get('total_count') or row.get('TotalCount'),
            good_count=row.get('good_count') or row.get('GoodCount'),
            reject_count=row.get('reject_count') or row.get('RejectCount') or row.get('ScrapCount'),
            shift=row.get('shift') or row.get('Shift'),
            raw_row_json=row.to_json(),
        )
        entries.append(entry)
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
