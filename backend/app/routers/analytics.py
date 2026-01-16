from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, func
from typing import List, Dict, Any, Optional
from datetime import datetime

from ..db import Oeemetric
from ..database import get_session

router = APIRouter(prefix="/analytics", tags=["analytics"])

@router.get("/compare", response_model=List[Dict[str, Any]])
def compare_metrics(
    group_by: str = Query(..., regex="^(shift|part|machine|operator)$"), 
    limit: int = 20,
    session: Session = Depends(get_session)
):
    """
    Compare OEE metrics grouped by a specific dimension (e.g., Shift, Part).
    Returns average OEE, Availability, Performance, Quality for each group.
    """
    # Dynamic grouping using SQLModel/SQLAlchemy
    # Note: SQLite might have limitations with complex aggregations, doing simple grouping here.
    
    # Map input string to column
    if group_by == "shift":
        col = Oeemetric.shift
    elif group_by == "part":
        col = Oeemetric.part_number
    elif group_by == "machine":
        col = Oeemetric.machine
    else:
        col = Oeemetric.operator

    # Select Group, Avg(OEE), Avg(Avail), Avg(Perf), Avg(Qual), Sum(Good), Sum(Reject)
    # We load all and aggregate in python if SQLModel grouping is tricky, 
    # but let's try direct SQL first for efficiency. Or simpler: Fetch all and aggregate in Pandas-style python list.
    # Given dataset size is small-ish, Python aggregation is safe and flexible.
    
    met_list = session.exec(select(Oeemetric)).all()
    try:
        grouped_data = {}
        for m in met_list:
            # Safe attribute access
            metric_val = getattr(m, group_by == "part" and "part_number" or group_by)
            key = metric_val if metric_val else "Unknown"
            
            if key not in grouped_data:
                grouped_data[key] = {
                    "name": key,
                    "oee_sum": 0.0,
                    "avail_sum": 0.0,
                    "perf_sum": 0.0,
                    "qual_sum": 0.0,
                    "count": 0
                }
            
            grouped_data[key]["oee_sum"] += (m.oee or 0)
            grouped_data[key]["avail_sum"] += (m.availability or 0)
            grouped_data[key]["perf_sum"] += (m.performance or 0)
            grouped_data[key]["qual_sum"] += (m.quality or 0)
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
                "sample_size": count
            })
            
        return sorted(results, key=lambda x: x["oee"], reverse=True)[:limit]
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Analytics Error: {str(e)}")


@router.get("/quality", response_model=List[Dict[str, Any]])
def quality_analysis(limit: int = 10, session: Session = Depends(get_session)):
    """
    Analyze Quality/Rejects by Part Number.
    Returns Total Good, Total Rejects, Reject Rate %.
    """
    metrics = session.exec(select(Oeemetric)).all()
    
    part_stats = {}
    
    for m in metrics:
        part = m.part_number or "Unknown"
        
        # Parse diagnostics for raw counts (since Oeemetric only has percentages usually)
        # But wait, we added detailed stats to diagnostics_json in previous steps.
        # And usually Oeemetric objects don't have raw counts columns directly unless we added them?
        # Actually we didn't add columns to Oeemetric, just the JSON.
        # So we must parse the JSON.
        
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
        
    # Sort by Total Rejects (descending) to show "Problem Parts"
    return sorted(results, key=lambda x: x["total_rejects"], reverse=True)[:limit]
