from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from typing import List, Dict, Any
from datetime import datetime

from ..db import (
    RateEntry,
    ReportEntry,
    Oeemetric,
    ProductionReport,
    RateEntry,
    ReportEntry,
    Oeemetric,
    ProductionReport,
)
from ..database import get_session

router = APIRouter()

def compute_oee(
    rate: RateEntry,
    entry: ReportEntry,
) -> Dict[str, Any]:
    """Calculate OEE metrics for a single report entry.
    All time values are converted to seconds for consistency.
    """
    # Convert minutes to seconds
    planned_sec = (entry.planned_production_time_min or 0) * 60
    run_sec = (entry.run_time_min or 0) * 60
    downtime_sec = (entry.downtime_min or 0) * 60

    # Availability (run time / planned production time)
    availability = run_sec / planned_sec if planned_sec > 0 else 0

    # Ideal cycle time per unit (seconds per unit)
    ideal_cycle = rate.ideal_cycle_time_seconds
    if not ideal_cycle:
        # fallback: compute from units per hour
        if rate.ideal_units_per_hour:
            ideal_cycle = 3600.0 / rate.ideal_units_per_hour
        else:
            ideal_cycle = 0

    total_count = entry.total_count or 0
    good_count = entry.good_count or 0
    # Performance (ideal_cycle * total_count) / run_time
    performance = (ideal_cycle * total_count) / run_sec if run_sec > 0 else 0
    # Quality (good / total)
    quality = good_count / total_count if total_count > 0 else 0
    oee = availability * performance * quality
    return {
        "availability": round(availability, 4),
        "performance": round(performance, 4),
        "quality": round(quality, 4),
        "oee": round(oee, 4),
    }

@router.post("/{report_id}/calculate", status_code=status.HTTP_201_CREATED)
def calculate_metrics(report_id: int, session: Session = Depends(get_session)):
    """Calculate OEE metrics for all entries of a given production report.
    Creates Oeemetric records in the database.
    """
    report = session.get(ProductionReport, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    # Fetch all entries for this report
    entries = session.exec(select(ReportEntry).where(ReportEntry.report_id == report_id)).all()
    if not entries:
        raise HTTPException(status_code=400, detail="No entries found for this report")
    skipped_count = 0
    metrics_to_save = []
    missing_rates_info = set()
    
    for entry in entries:
        # Find applicable rate
        # Strict match by Part Number only (Machine/Press allocation varies)
        stmt = select(RateEntry).where(
            (RateEntry.part_number == entry.part_number),
            (RateEntry.active == True),
        )
        rate = session.exec(stmt).first()
        
        missing_rate_warning = None
        if not rate:
            # Create a dummy rate to allow calculation (result will range 0)
            rate = RateEntry(ideal_units_per_hour=0, ideal_cycle_time_seconds=0)
            # Log the specific combination missing
            identifier = f"{entry.part_number} (Machine: {entry.machine})"
            missing_rate_warning = f"No Rate found for {identifier}"
            missing_rates_info.add(identifier)
            skipped_count += 1
            
        oee_vals = compute_oee(rate, entry)
        
        diagnostics = {}
        if missing_rate_warning:
            diagnostics["warning"] = missing_rate_warning
            
        import json
        metric = Oeemetric(
            report_id=report_id,
            operator=entry.operator,
            machine=entry.machine,
            part_number=entry.part_number,
            job=entry.job,
            shift=entry.shift,
            date=entry.date,
            availability=oee_vals["availability"],
            performance=oee_vals["performance"],
            quality=oee_vals["quality"],
            oee=oee_vals["oee"],
            confidence="low" if missing_rate_warning else "high",
            diagnostics_json=json.dumps(diagnostics),
        )
        metrics_to_save.append(metric)
        
    session.bulk_save_objects(metrics_to_save)
    session.commit()
    
    msg = f"Metrics calculated for {len(metrics_to_save)} rows."
    if skipped_count > 0:
        msg += f" Warning: {skipped_count} rows used missing rate data."
        
    return {
        "calculated": len(metrics_to_save), 
        "message": msg,
        "missing_rates": sorted(list(missing_rates_info))
    }

@router.get("/report/{report_id}", response_model=List[Oeemetric])
def get_metrics(report_id: int, session: Session = Depends(get_session)):
    metrics = session.exec(select(Oeemetric).where(Oeemetric.report_id == report_id)).all()
    return metrics

@router.get("/stats", response_model=Dict[str, Any])
def get_dashboard_stats(session: Session = Depends(get_session)):
    """Aggregate metrics for the dashboard."""
    metrics = session.exec(select(Oeemetric)).all()
    if not metrics:
        return {
            "oee": 0,
            "availability": 0,
            "performance": 0,
            "quality": 0,
            "recent_activity": []
        }
    
    # Calculate averages
    count = len(metrics)
    avg_oee = sum(m.oee or 0 for m in metrics) / count
    avg_avail = sum(m.availability or 0 for m in metrics) / count
    avg_perf = sum(m.performance or 0 for m in metrics) / count
    avg_qual = sum(m.quality or 0 for m in metrics) / count

    # Get recent reports for activity feed
    # This assumes ReportEntry or ProductionReport has dates, but Oeemetric has report_id
    # Simpler: just return recent OEE metrics
    recent = [
        {
            "id": m.id,
            "operator": m.operator,
            "machine": m.machine,
            "date": m.date,
            "oee": m.oee
        }
        for m in sorted(metrics, key=lambda x: x.date or date.min, reverse=True)[:500]
    ]

    return {
        "oee": round(avg_oee * 100, 1),
        "availability": round(avg_avail * 100, 1),
        "performance": round(avg_perf * 100, 1),
        "quality": round(avg_qual * 100, 1),
        "recent_activity": recent
    }
