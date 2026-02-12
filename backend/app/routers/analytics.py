from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, func
from typing import List, Dict, Any, Optional
from datetime import datetime, date

from ..db import Oeemetric
from ..database import get_session

router = APIRouter(tags=["analytics"])

@router.get("/compare", response_model=List[Dict[str, Any]])
def compare_metrics(
    group_by: str = Query(..., pattern="^(shift|part|machine|operator)$"), 
    limit: int = 100,
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
    
    # Pre-fetch Rates to calculate Parts Lost
    # Optimization: Fetch all active rates
    from ..db import RateEntry
    all_rates = session.exec(select(RateEntry).where(RateEntry.active == True)).all()
    rate_map = {} # (part, machine) -> cycle_time
    part_rate_map = {} # part -> cycle_time (fallback)
    
    for r in all_rates:
        key = (r.part_number, r.machine)
        ct = r.ideal_cycle_time_seconds
        if not ct and r.ideal_units_per_hour:
            ct = 3600.0 / r.ideal_units_per_hour
        
        rate_map[key] = ct
        # Populate fallback (last one wins, or maybe average? last one is fine for now)
        if ct:
            part_rate_map[r.part_number] = ct

    machine_stats = {}
    
    for m in metrics:
        machine = m.machine or "Unknown"
        part = m.part_number
        
        downtime = 0
        event_count = 0
        details = []

        if m.diagnostics_json:
            try:
                import json
                diag = json.loads(m.diagnostics_json)
                downtime = diag.get("downtime_min", 0)
                
                # Count distinct events if available
                events = diag.get("downtime_events", [])
                if events:
                    event_count = len(events)
                    for e in events:
                        # Append partial event details
                        details.append({
                            "date": m.date,
                            "shift": m.shift,
                            "reason": e.get("reason", "Unknown"),
                            "minutes": e.get("minutes", 0),
                            "part_number": part
                        })
                elif downtime > 0:
                    event_count = 1 # Fallback
                    details.append({
                        "date": m.date,
                        "shift": m.shift,
                        "reason": "Uncategorized Downtime",
                        "minutes": downtime,
                        "part_number": part
                    })
            except:
                pass
        
        # Calculate Parts Lost for this run
        parts_lost = 0
        if downtime > 0:
            # Try exact match first
            cycle_time = rate_map.get((part, machine))
            # Fallback to generic part rate if specific machine rate not found
            if not cycle_time:
                cycle_time = part_rate_map.get(part)
            
            if cycle_time and cycle_time > 0:
                parts_lost = (downtime * 60) / cycle_time

        if machine not in machine_stats:
            machine_stats[machine] = {"downtime": 0, "events": 0, "parts_lost": 0, "details": []}
            
        machine_stats[machine]["downtime"] += downtime
        machine_stats[machine]["events"] += event_count
        machine_stats[machine]["parts_lost"] += parts_lost
        machine_stats[machine]["details"].extend(details)
        
    results = []
    for machine, stats in machine_stats.items():
        avg_len = stats["downtime"] / stats["events"] if stats["events"] > 0 else 0
        
        # Determine Pattern
        pattern = "N/A"
        if stats["events"] > 0:
            if avg_len < 10:
                pattern = "Micro-stop driven"
            elif avg_len <= 45:
                pattern = "Mixed"
            else:
                pattern = "Breakdown driven"
        
        # Sort details by date desc
        sorted_details = sorted(stats["details"], key=lambda x: x["date"] or date.min, reverse=True)

        results.append({
            "machine": machine,
            "total_downtime": round(stats["downtime"], 1),
            "event_count": stats["events"],
            "avg_event_min": round(avg_len, 1),
            "pattern": pattern,
            "parts_lost": int(stats["parts_lost"]),
            "details": sorted_details
        })
        
    return sorted(results, key=lambda x: x["total_downtime"], reverse=True)[:limit]
        
@router.get("/history", response_model=List[Dict[str, Any]])
def get_operator_history(
    operator: Optional[str] = None,
    part_number: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    limit: int = 100,
    session: Session = Depends(get_session)
):
    """
    Get raw OEE history entries for detailed analysis.
    Useful for 'Operator History' view.
    """
    stmt = select(Oeemetric).order_by(Oeemetric.date.desc())
    
    if operator:
        stmt = stmt.where(Oeemetric.operator == operator)
    if part_number:
        stmt = stmt.where(Oeemetric.part_number == part_number)
    if start_date:
        stmt = stmt.where(Oeemetric.date >= start_date)
    if end_date:
        stmt = stmt.where(Oeemetric.date <= end_date)
        
    metrics = session.exec(stmt.limit(limit)).all()
    
    results = []
    for m in metrics:
        results.append({
            "id": m.id,
            "date": m.date,
            "operator": m.operator,
            "machine": m.machine,
            "part_number": m.part_number,
            "shift": m.shift,
            "oee": m.oee,
            "availability": m.availability,
            "performance": m.performance,
            "quality": m.quality
        })
    return results

@router.get("/part-performance", response_model=Dict[str, Any])
def get_part_performance(
    part_number: str,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    session: Session = Depends(get_session)
):
    """
    Compare operators for a specific part.
    Returns:
    - box_plot: global average oee for this part
    - operators: list of {name, average_oee, sample_size}
    """
    # 1. Get all metrics for this part in range
    stmt = select(Oeemetric).where(Oeemetric.part_number == part_number)
    if start_date:
        stmt = stmt.where(Oeemetric.date >= start_date)
    if end_date:
        stmt = stmt.where(Oeemetric.date <= end_date)
        
    metrics = session.exec(stmt).all()
    
    if not metrics:
        return {"global_average": 0, "operators": []}
        
    # 2. Calculate Global Average
    global_sum = sum(m.oee or 0 for m in metrics)
    global_count = len(metrics)
    global_avg = global_sum / global_count if global_count > 0 else 0
    
    # 3. Group by Operator
    op_stats = {}
    for m in metrics:
        op = m.operator or "Unknown"
        if op not in op_stats:
            op_stats[op] = {"sum": 0.0, "count": 0}
        op_stats[op]["sum"] += (m.oee or 0)
        op_stats[op]["count"] += 1
        
    # 4. Format Results
    operator_results = []
    for op, stats in op_stats.items():
        operator_results.append({
            "operator": op,
            "average_oee": round(stats["sum"] / stats["count"], 4),
            "sample_size": stats["count"]
        })
        
    # Sort best to worst
    operator_results.sort(key=lambda x: x["average_oee"], reverse=True)
    
    return {
        "part_number": part_number,
        "global_average_oee": round(global_avg, 4),
        "total_runs": global_count,
        "operators": operator_results
    }


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

@router.get("/operator-breakdown", response_model=Dict[str, Any])
def get_operator_breakdown(
    operator: str,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    session: Session = Depends(get_session)
):
    query = select(Oeemetric).where(Oeemetric.operator == operator)
    if start_date:
        query = query.where(Oeemetric.date >= start_date)
    if end_date:
        query = query.where(Oeemetric.date <= end_date)
    
    metrics = session.exec(query).all()
    
    if not metrics:
        return {"shift_performance": [], "part_performance": []}

    # Shift Analysis
    shifts = {}
    for m in metrics:
        s = m.shift or "Unknown"
        if s not in shifts: shifts[s] = []
        shifts[s].append(m.oee or 0)
    
    shift_data = []
    for s, vals in shifts.items():
        shift_data.append({"name": s, "oee": sum(vals)/len(vals)})
    
    # Part Analysis
    parts = {}
    for m in metrics:
        p = m.part_number
        if p not in parts: parts[p] = []
        parts[p].append(m.oee or 0)
        
    part_data = []
    for p, vals in parts.items():
        part_data.append({"name": p, "oee": sum(vals)/len(vals), "samples": len(vals)})
    
    # Sort parts by OEE desc
    part_data.sort(key=lambda x: x["oee"], reverse=True)
    
    return {
        "shift_performance": shift_data,
        "part_performance": part_data[:10] # Top 10 parts
    }
