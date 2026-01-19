from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, func
from typing import List, Dict, Any, Optional
from datetime import datetime, date

from ..db import Oeemetric
from ..database import get_session

router = APIRouter(tags=["analytics"])

@router.get("/compare", response_model=List[Dict[str, Any]])
def compare_metrics(
    group_by: str = Query(..., regex="^(shift|part|machine|operator)$"), 
    limit: int = 20,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    session: Session = Depends(get_session)
):
    """
    Compare OEE metrics grouped by a specific dimension (e.g., Shift, Part).
    Returns average OEE, Availability, Performance, Quality for each group.
    """
    
    stmt = select(Oeemetric)
    if start_date:
        stmt = stmt.where(Oeemetric.date >= start_date)
    if end_date:
        stmt = stmt.where(Oeemetric.date <= end_date)
        
    met_list = session.exec(stmt).all()
    
    # ... aggregation logic ...
    try:
        grouped_data = {}
        for m in met_list:
            # Safe attribute access
            col_name = "part_number" if group_by == "part" else group_by
            metric_val = getattr(m, col_name)
            key = metric_val if metric_val else "Unknown"
            
            if key not in grouped_data:
                grouped_data[key] = {
                    "name": key,
                    "oee_sum": 0.0,
                    "avail_sum": 0.0,
                    "perf_sum": 0.0,
                    "qual_sum": 0.0,
                    "produced_sum": 0,
                    "good_sum": 0,
                    "count": 0
                }
            
            # Parse Volume from Diagnostics
            run_produced = 0
            run_good = 0
            if m.diagnostics_json:
                try:
                    import json
                    diag = json.loads(m.diagnostics_json)
                    run_good = int(diag.get("good_count", 0))
                    run_reject = int(diag.get("reject_count", 0))
                    run_produced = run_good + run_reject
                except:
                    pass

            grouped_data[key]["oee_sum"] += (m.oee or 0)
            grouped_data[key]["avail_sum"] += (m.availability or 0)
            grouped_data[key]["perf_sum"] += (m.performance or 0)
            grouped_data[key]["qual_sum"] += (m.quality or 0)
            grouped_data[key]["produced_sum"] += run_produced
            grouped_data[key]["good_sum"] += run_good
            grouped_data[key]["count"] += 1
            
        results = []
        
        for key, data in grouped_data.items():
            count = data["count"]
            results.append({
                "name": key,
                "oee": round(data["oee_sum"] / count, 4),
                "availability": round(data["avail_sum"] / count, 4),
                "performance": round(data["perf_sum"] / count, 4),
                "quality": round(data["qual_sum"] / count, 4),
                "total_produced": data["produced_sum"],
                "total_good": data["good_sum"],
                "sample_size": count
            })
            
        return sorted(results, key=lambda x: x["oee"], reverse=True)[:limit]
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Analytics Error: {str(e)}")


@router.get("/quality", response_model=List[Dict[str, Any]])
def quality_analysis(
    limit: int = 10, 
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    session: Session = Depends(get_session)
):
    """
    Analyze Quality/Rejects by Part Number.
    Returns Total Good, Total Rejects, Reject Rate %.
    """
    stmt = select(Oeemetric)
    if start_date:
        stmt = stmt.where(Oeemetric.date >= start_date)
    if end_date:
        stmt = stmt.where(Oeemetric.date <= end_date)
        
    metrics = session.exec(stmt).all()
    
    part_stats = {}
    
    for m in metrics:
        part = m.part_number or "Unknown"
        
        run_good = 0
        run_reject = 0
        
        if m.diagnostics_json:
            try:
                import json
                diag = json.loads(m.diagnostics_json)
                run_good = diag.get("good_count", 0)
                run_reject = diag.get("reject_count", 0)
            except:
                pass
                
        if part not in part_stats:
            part_stats[part] = {"good": 0, "reject": 0}
            
        part_stats[part]["good"] += run_good
        part_stats[part]["reject"] += run_reject
        
    results = []
         
    for part, stats in part_stats.items():
        total = stats["good"] + stats["reject"]
        reject_rate = (stats["reject"] / total) if total > 0 else 0
        
        results.append({
            "part_number": part,
            "total_produced": total,
            "total_rejects": stats["reject"],
            "reject_rate": round(reject_rate * 100, 2)
        })
        
    return sorted(results, key=lambda x: x["total_rejects"], reverse=True)[:limit]


@router.get("/downtime", response_model=List[Dict[str, Any]])
def downtime_analysis(
    limit: int = 10,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    session: Session = Depends(get_session)
):
    """
    Analyze Downtime by Machine.
    Returns Total Downtime Minutes.
    """
    stmt = select(Oeemetric)
    if start_date:
        stmt = stmt.where(Oeemetric.date >= start_date)
    if end_date:
        stmt = stmt.where(Oeemetric.date <= end_date)
        
    metrics = session.exec(stmt).all()
    
    machine_stats = {}
    
    for m in metrics:
        machine = m.machine or "Unknown"
        
        downtime = 0
        
        if m.diagnostics_json:
            try:
                import json
                diag = json.loads(m.diagnostics_json)
                downtime = diag.get("downtime_min", 0)
            except:
                pass
                
        if machine not in machine_stats:
            machine_stats[machine] = {"downtime": 0, "count": 0}
            
        machine_stats[machine]["downtime"] += downtime
        machine_stats[machine]["count"] += 1
        
    results = []
    for machine, stats in machine_stats.items():
        results.append({
            "machine": machine,
            "total_downtime": round(stats["downtime"], 1),
            "event_count": stats["count"]
        })
        
    return sorted(results, key=lambda x: x["total_downtime"], reverse=True)[:limit]
        
@router.get("/debug", response_model=Dict[str, Any])
def debug_analytics(session: Session = Depends(get_session)):
    """Debug Quality Logic trace."""
    metrics = session.exec(select(Oeemetric).limit(50)).all()
    
    details = []
    
    for m in metrics:
        diag = {}
        if m.diagnostics_json:
            try:
                import json
                diag = json.loads(m.diagnostics_json)
            except:
                pass
        
        details.append({
            "id": m.id,
            "part": m.part_number,
            "machine": m.machine,
            "oee": m.oee,
            "availability": m.availability,
            "performance": m.performance,
            "quality": m.quality,
            "run_time_min": diag.get("run_time_min"),
            "downtime_min": diag.get("downtime_min"),
            "good": diag.get("good_count"),
            "reject": diag.get("reject_count")
        })
        
    return {"count": len(metrics), "details": details}
