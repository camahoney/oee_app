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
    performance_raw = (ideal_cycle * total_count) / run_sec if run_sec > 0 else 0
    
    # Cap Performance at 1.1 (110%) to account for minor speedups but filter bad data
    performance = min(performance_raw, 1.1)

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
    
    # Aggregate entries by (Date, Operator, Machine, Part, Shift, Job)
    try:
        # Aggregation Phase
        aggregated = {}
        for entry in entries:
            key = (entry.date, entry.operator, entry.machine, entry.part_number, entry.shift, entry.job)
            if key not in aggregated:
                aggregated[key] = {
                    "date": entry.date,
                    "operator": entry.operator,
                    "machine": entry.machine,
                    "part_number": entry.part_number,
                    "shift": entry.shift,
                    "job": entry.job,
                    "planned_production_time_min": 0.0,
                    "run_time_min": 0.0,
                    "downtime_min": 0.0,
                    "total_count": 0,
                    "good_count": 0,
                    "reject_count": 0,
                }
            agg = aggregated[key]
            agg["planned_production_time_min"] += (entry.planned_production_time_min or 0)
            agg["run_time_min"] += (entry.run_time_min or 0)
            agg["downtime_min"] += (entry.downtime_min or 0)
            agg["total_count"] += (entry.total_count or 0)
            agg["good_count"] += (entry.good_count or 0)
            agg["reject_count"] += (entry.reject_count or 0)
            
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Aggregation Error: {str(e)}")
        
    # Calculation Phase
    try:
        for key, data in aggregated.items():

        # Find applicable rate
        # Strategy: Fetch all active rates for this Part Number, then find the best fit.
        stmt = select(RateEntry).where(
            (RateEntry.part_number == data["part_number"]),
            (RateEntry.active == True),
        )
        candidates = session.exec(stmt).all()
        
        rate = None
        if not candidates:
            pass
        elif len(candidates) == 1:
            rate = candidates[0]
        else:
            # Multiple rates logic
            report_machine_norm = (data["machine"] or "").strip().lower()
            
            # 1. Exact Match
            for c in candidates:
                if (c.machine or "").strip().lower() == report_machine_norm:
                    rate = c
                    break
            # 2. Type Match
            if not rate:
                is_assy = "asy" in report_machine_norm or "assembly" in report_machine_norm
                for c in candidates:
                    c_machine_norm = (c.machine or "").strip().lower()
                    c_is_assy = "asy" in c_machine_norm or "assembly" in c_machine_norm
                    if is_assy == c_is_assy:
                        rate = c
                        break
            # 3. Fallback
            if not rate:
                rate = candidates[0]
        
        missing_rate_warning = None
        if not rate:
            rate = RateEntry(ideal_units_per_hour=0, ideal_cycle_time_seconds=0)
            identifier = f"{data['part_number']} (Machine: {data['machine']})"
            missing_rate_warning = f"No Rate found for {identifier}"
            missing_rates_info.add(identifier)
            skipped_count += 1
        
        # Create a temporary pseudo-entry object for computation
        # (This avoids changing the compute_oee signature)
        pseudo_entry = ReportEntry(
            planned_production_time_min=data["planned_production_time_min"],
            run_time_min=data["run_time_min"],
            downtime_min=data["downtime_min"],
            total_count=data["total_count"],
            good_count=data["good_count"],
            reject_count=data["reject_count"]
        )
            
        oee_vals = compute_oee(rate, pseudo_entry)
        
        diagnostics = {}
        if missing_rate_warning:
            diagnostics["warning"] = missing_rate_warning
        else:
            diagnostics["matched_rate_machine"] = rate.machine
            
        # Manager Insights Logic (Re-calculate raw performance here as we don't have it from compute_oee return)
        ideal_cycle = rate.ideal_cycle_time_seconds or 0
        if not ideal_cycle and rate.ideal_units_per_hour:
             ideal_cycle = 3600.0 / rate.ideal_units_per_hour
        
        run_sec = data["run_time_min"] * 60
        perf_raw = (ideal_cycle * data["total_count"]) / run_sec if run_sec > 0 else 0
        
        # Calculate Target Count based on actual Run Time (net of downtime)
        target_count = int(run_sec / ideal_cycle) if ideal_cycle > 0 else 0
        diagnostics["target_count"] = target_count
        
        if perf_raw > 1.2:
             diagnostics["insight"] = "High Output: Verify Standard Rate vs. Operator Speed"
        elif perf_raw < 0.5:
             diagnostics["insight"] = "Low Output: Verify Standard Rate vs. Operator Speed"
        
        # Add detailed stats to diagnostics for dashboard display
        diagnostics["run_time_min"] = data["run_time_min"]
        diagnostics["downtime_min"] = data["downtime_min"]
        diagnostics["good_count"] = data["good_count"]
        diagnostics["reject_count"] = data["reject_count"]
            
        import json
        metric = Oeemetric(
            report_id=report_id,
            operator=data["operator"],
            machine=data["machine"],
            part_number=data["part_number"],
            job=data["job"],
            shift=data["shift"],
            date=data["date"],
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
def get_dashboard_stats(report_id: int = None, session: Session = Depends(get_session)):
    """Aggregate metrics for the dashboard. Optional: filter by report_id."""
    stmt = select(Oeemetric)
    if report_id:
        stmt = stmt.where(Oeemetric.report_id == report_id)
        
    metrics = session.exec(stmt).all()
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
    recent = []
    for m in sorted(metrics, key=lambda x: x.date or date.min, reverse=True)[:500]:
        diag = {}
        if m.diagnostics_json:
            try:
                import json
                diag = json.loads(m.diagnostics_json)
            except:
                pass
                
        recent.append({
            "id": m.id,
            "operator": m.operator,
            "machine": m.machine,
            "part_number": m.part_number,
            "date": m.date,
            "oee": m.oee,
            "insight": diag.get("insight"),
            "run_time_min": diag.get("run_time_min"),
            "downtime_min": diag.get("downtime_min"),
            "good_count": diag.get("good_count"),
            "good_count": diag.get("good_count"),
            "reject_count": diag.get("reject_count"),
            "target_count": diag.get("target_count")
        })

    return {
        "oee": round(avg_oee * 100, 1),
        "availability": round(avg_avail * 100, 1),
        "performance": round(avg_perf * 100, 1),
        "quality": round(avg_qual * 100, 1),
        "recent_activity": recent
    }
