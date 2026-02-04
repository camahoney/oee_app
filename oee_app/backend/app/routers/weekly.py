from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select, func
from typing import List, Dict, Any, Optional
from datetime import date, timedelta
from ..db import Oeemetric
from ..database import get_session

router = APIRouter(tags=["weekly"])

@router.get("/summary", response_model=Dict[str, Any])
def get_weekly_summary(
    start_date: date,
    end_date: date,
    shift: Optional[str] = None,
    session: Session = Depends(get_session)
):
    """
    Calculate Weighted Weekly OEE vs Simple Average OEE.
    Do NOT average the averages. Aggregate sums first.
    
    Formula:
    Weighted OEE = Sum(Metric * Weight) / Sum(Weight)
    Where Weight = Total Parts Produced (or Run Time)
    """
    
    # 1. Fetch Metrics
    stmt = select(Oeemetric).where(Oeemetric.date >= start_date).where(Oeemetric.date <= end_date)
    if shift and shift.lower() != "all":
        stmt = stmt.where(Oeemetric.shift == shift)
        
    metrics = session.exec(stmt).all()
    
    if not metrics:
        return {
            "overall": {
                "weighted_oee": 0, "simple_oee": 0,
                "total_parts": 0, "total_run_time": 0,
                "count": 0
            },
            "operators": [],
            "daily_trend": []
        }
        
    # 2. Aggregation Containers
    # Overall
    total_parts = 0
    total_run_time = 0.0
    weighted_oee_numerator = 0.0
    
    sum_simple_oee = 0.0
    count = 0
    
    # Per Operator
    op_stats = {} # { "Name": { parts, weighted_num, simple_sum, count, run_time } }
    
    # Daily Trend (for Chart)
    daily_stats = {} # { "YYYY-MM-DD": { parts, weighted_num, simple_sum, count } }

    # 3. Iterate & Calculate
    import json
    
    for m in metrics:
        # Extract Weight (Total Parts)
        # We need to parse diagnostics JSON to get 'total_count' or derived it.
        # Ideally, Oeemetric table should have had 'total_count', but we can try to get it from diagnostics 
        # OR reverse calc from performance if needed: Performance = (Ideal * Total) / RunTime -> Total = (Perf * RunTime) / Ideal
        # But let's check if 'diagnostics_json' has it first.
        
        weight = 0
        run_time = 0.0
        
        try:
            if m.diagnostics_json:
                data = json.loads(m.diagnostics_json)
                # target_count is often there, but we want actual total
                # "good_count" + "reject_count" is safest if available
                if "good_count" in data and "reject_count" in data:
                    weight = data["good_count"] + data["reject_count"]
                if "run_time_min" in data:
                    run_time = float(data["run_time_min"])
        except:
            pass
            
        # Fallback if 0 (prevent divide by zero later, though here it just means no weight)
        if weight == 0:
            # Try approximate from performance? No, unsafe. 
            # If no weight, this entry contributes 0 to weighted average.
            pass

        oee = m.oee or 0.0
        
        # Update Overall
        total_parts += weight
        total_run_time += run_time
        weighted_oee_numerator += (oee * weight)
        sum_simple_oee += oee
        count += 1
        
        # Update Operator
        op_name = m.operator or "Unknown"
        if op_name not in op_stats:
            op_stats[op_name] = {"parts": 0, "weighted_num": 0.0, "simple_sum": 0.0, "count": 0, "run_time": 0.0}
        
        op_stats[op_name]["parts"] += weight
        op_stats[op_name]["run_time"] += run_time
        op_stats[op_name]["weighted_num"] += (oee * weight)
        op_stats[op_name]["simple_sum"] += oee
        op_stats[op_name]["count"] += 1
        
        # Update Daily Trend
        d_str = m.date.strftime("%Y-%m-%d")
        if d_str not in daily_stats:
            daily_stats[d_str] = {"parts": 0, "weighted_num": 0.0, "simple_sum": 0.0, "count": 0}
            
        daily_stats[d_str]["parts"] += weight
        daily_stats[d_str]["weighted_num"] += (oee * weight)
        daily_stats[d_str]["simple_sum"] += oee
        daily_stats[d_str]["count"] += 1

    # 4. Final Calculations
    overall_weighted = (weighted_oee_numerator / total_parts) if total_parts > 0 else 0.0
    overall_simple = (sum_simple_oee / count) if count > 0 else 0.0
    
    # Operators List
    operators_final = []
    for name, s in op_stats.items():
        w_oee = (s["weighted_num"] / s["parts"]) if s["parts"] > 0 else 0.0
        s_oee = (s["simple_sum"] / s["count"]) if s["count"] > 0 else 0.0
        contribution = (s["parts"] / total_parts * 100) if total_parts > 0 else 0.0
        
        operators_final.append({
            "operator": name,
            "weighted_oee": round(w_oee, 4),
            "simple_oee": round(s_oee, 4),
            "total_parts": s["parts"],
            "total_run_time": round(s["run_time"], 1),
            "contribution_pct": round(contribution, 1),
            "shift_count": s["count"]
        })
    
    # Sort by contribution
    operators_final.sort(key=lambda x: x["total_parts"], reverse=True)
    
    # Daily Trend List
    trend_final = []
    # Fill in dates? Maybe just return what we have (gaps are fine for line chart)
    # Let's sort keys
    for d in sorted(daily_stats.keys()):
        s = daily_stats[d]
        w_oee = (s["weighted_num"] / s["parts"]) if s["parts"] > 0 else 0.0
        s_oee = (s["simple_sum"] / s["count"]) if s["count"] > 0 else 0.0
        trend_final.append({
            "date": d,
            "weighted_oee": round(w_oee, 4),
            "simple_oee": round(s_oee, 4),
            "total_parts": s["parts"]
        })

    return {
        "overall": {
            "weighted_oee": round(overall_weighted, 4),
            "simple_oee": round(overall_simple, 4),
            "total_parts": total_parts,
            "total_run_time": round(total_run_time, 1),
            "count": count
        },
        "operators": operators_final,
        "daily_trend": trend_final
    }
