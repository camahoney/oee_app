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
    Setting,
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

def calculate_report_metrics_logic(report_id: int, session: Session):
    """Core logic to calculate metrics for a report. Can be called by API or Background Task."""
    report = session.get(ProductionReport, report_id)
    if not report:
        print(f"Report {report_id} not found during calculation.")
        return 0, 0, []

    # Cascade delete existing metrics to ensure clean slate (Retroactive Fix)
    from sqlmodel import delete
    try:
        session.exec(delete(Oeemetric).where(Oeemetric.report_id == report_id))
        session.flush()
    except Exception as e:
        print(f"Error clearing metrics for report {report_id}: {e}")

    # Fetch all entries for this report
    entries = session.exec(select(ReportEntry).where(ReportEntry.report_id == report_id)).all()
    if not entries:
        return 0, 0, []

    skipped_count = 0
    metrics_to_save = []
    missing_rates_info = set()
    
    # Aggregation Phase
    try:
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
        print(f"Aggregation Error: {str(e)}")
        return 0, 0, []
        
    # Calculation Phase
    # Fetch Settings for Logic
    perf_threshold_setting = session.get(Setting, "performance_threshold")
    perf_threshold_pct = float(perf_threshold_setting.value) if perf_threshold_setting else 25.0
    perf_threshold = perf_threshold_pct / 100.0
    
    # OEE > 100 Warning Flag
    oee_warning_setting = session.get(Setting, "show_oee_over_100_warning")
    show_oee_warning = (oee_warning_setting.value.lower() == 'true') if oee_warning_setting else True

    for key, data in aggregated.items():
        # Find applicable rate
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
            
        # Self-Healing
        if data["total_count"] == 0 and data["good_count"] > 0:
             data["total_count"] = data["good_count"] + data["reject_count"]
        
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
        
        if show_oee_warning and oee_vals["oee"] > 1.0:
            if "warning" not in diagnostics:
                 diagnostics["warning"] = "OEE > 100%: Check Standard Rate"

        ideal_cycle = rate.ideal_cycle_time_seconds or 0
        if not ideal_cycle and rate.ideal_units_per_hour:
             ideal_cycle = 3600.0 / rate.ideal_units_per_hour
        
        run_sec = data["run_time_min"] * 60
        perf_raw = (ideal_cycle * data["total_count"]) / run_sec if run_sec > 0 else 0
        
        target_count = int(run_sec / ideal_cycle) if ideal_cycle > 0 else 0
        diagnostics["target_count"] = target_count
        
        high_limit = 1.0 + perf_threshold
        low_limit = max(0.0, 1.0 - perf_threshold)
        
        if perf_raw > high_limit:
             diagnostics["insight"] = f"High Output (>{int(high_limit*100)}%): Verify Std vs Speed"
        elif perf_raw < low_limit:
             diagnostics["insight"] = f"Low Output (<{int(low_limit*100)}%): Verify Std vs Speed"
        
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

    try:
        session.bulk_save_objects(metrics_to_save)
        session.commit()
    except Exception as e:
        print(f"Database Save Error: {str(e)}")
        
    return len(metrics_to_save), skipped_count, sorted(list(missing_rates_info))


@router.post("/{report_id}/calculate", status_code=status.HTTP_201_CREATED)
def calculate_metrics(report_id: int, session: Session = Depends(get_session)):
    """Calculate OEE metrics for all entries of a given production report.
    Creates Oeemetric records in the database.
    """
    report = session.get(ProductionReport, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
        
    count, skipped, missing = calculate_report_metrics_logic(report_id, session)
    
    msg = f"Metrics calculated for {count} rows."
    if skipped > 0:
        msg += f" Warning: {skipped} rows used missing rate data."
        
    return {
        "calculated": count, 
        "message": msg,
        "missing_rates": missing
    }

@router.get("/report/{report_id}", response_model=List[Oeemetric])
def get_metrics(report_id: int, session: Session = Depends(get_session)):
    metrics = session.exec(select(Oeemetric).where(Oeemetric.report_id == report_id)).all()
    return metrics

@router.get("/stats", response_model=Dict[str, Any])
def get_dashboard_stats(report_id: int = None, session: Session = Depends(get_session)):
    """Aggregate metrics for the dashboard. Default: Latest Report. Includes Sparklines & Insights."""
    stmt = select(Oeemetric)
    
    current_report_date = None
    target_report_id = report_id
    
    if target_report_id:
        stmt = stmt.where(Oeemetric.report_id == target_report_id)
        report = session.get(ProductionReport, target_report_id)
        if report and report.uploaded_at:
             current_report_date = report.uploaded_at.strftime("%Y-%m-%d")
    else:
        # Default to Latest Report
        latest_report = session.exec(select(ProductionReport).order_by(ProductionReport.uploaded_at.desc()).limit(1)).first()
        if latest_report:
            target_report_id = latest_report.id
            stmt = stmt.where(Oeemetric.report_id == target_report_id)
            if latest_report.uploaded_at:
                 current_report_date = latest_report.uploaded_at.strftime("%Y-%m-%d")
        else:
            return {
                "oee": 0, "availability": 0, "performance": 0, "quality": 0,
                "recent_activity": [], "db_row_count": 0, "sparkline_data": {}, "insights": []
            }

    metrics = session.exec(stmt).all()
    
    # --- 1. Current Stats ---
    count = len(metrics)
    avg_oee = 0
    avg_avail = 0
    avg_perf = 0
    avg_qual = 0
    
    if count > 0:
        avg_oee = sum(m.oee or 0 for m in metrics) / count
        avg_avail = sum(m.availability or 0 for m in metrics) / count
        avg_perf = sum(m.performance or 0 for m in metrics) / count
        avg_qual = sum(m.quality or 0 for m in metrics) / count

    # --- 2. Sparklines (Trend) ---
    # Fetch last 7 reports (including current) to build trend
    # We aggregate by Report ID / Date
    sparkline_data = {"oee": [], "availability": [], "performance": [], "quality": [], "labels": []}
    
    history_reports = session.exec(select(ProductionReport).order_by(ProductionReport.uploaded_at.desc()).limit(7)).all()
    # Reverse to show chronological order (Oldest -> Newest)
    history_reports.reverse()
    
    for rep in history_reports:
        # Get avg for this report
        # OPTIMIZATION: In a real app, we should cache this or use a GROUP BY query. 
        # For now, we do a quick fetch.
        rep_metrics = session.exec(select(Oeemetric.oee, Oeemetric.availability, Oeemetric.performance, Oeemetric.quality).where(Oeemetric.report_id == rep.id)).all()
        if rep_metrics:
            rep_count = len(rep_metrics)
            sparkline_data["oee"].append(sum(m[0] or 0 for m in rep_metrics) / rep_count)
            sparkline_data["availability"].append(sum(m[1] or 0 for m in rep_metrics) / rep_count)
            sparkline_data["performance"].append(sum(m[2] or 0 for m in rep_metrics) / rep_count)
            sparkline_data["quality"].append(sum(m[3] or 0 for m in rep_metrics) / rep_count)
            sparkline_data["labels"].append(rep.uploaded_at.strftime("%m/%d") if rep.uploaded_at else "N/A")
    
    # --- 3. Insights (Key Takeaways) ---
    insights = []
    
    
    # Insight: OEE Target
    # Fetch target from settings, default 0.85
    oee_target_setting = session.get(Setting, "oee_target")
    oee_target = float(oee_target_setting.value) if oee_target_setting else 85.0
    
    # Fetch other targets for Dashboard Gauges
    avail_target_setting = session.get(Setting, "availability_target")
    avail_target = float(avail_target_setting.value) if avail_target_setting else 90.0
    
    perf_target_setting = session.get(Setting, "performance_target")
    perf_target = float(perf_target_setting.value) if perf_target_setting else 95.0
    
    qual_target_setting = session.get(Setting, "quality_target")
    qual_target = float(qual_target_setting.value) if qual_target_setting else 99.0

    # Ensure OEE target is treated as percentage (0-100) or decimal (0-1) consistently
    # Based on existing insights logic: `((oee_target - avg_oee)*100)` implies oee_target is decimal (0.85) if avg_oee is decimal.
    # However, Setting default in Settings.tsx is 85 (integer).
    # Let's standardize: Settings stores INTEGER (0-100).
    # avg_oee is DECIMAL (0.0 - 1.0).
    
    # Adjust OEE Target for comparison if stored as integer
    oee_target_decimal = oee_target / 100.0 if oee_target > 1.0 else oee_target
    
    if avg_oee < oee_target_decimal:
        insights.append(f"OEE is {((oee_target_decimal - avg_oee)*100):.1f}% below target ({int(oee_target_decimal*100)}%).")
    else:
        insights.append("OEE is on track above target.")
        
    # Insight: Main Loss Driver
    losses = {
        "Availability": (1.0 - avg_avail),
        "Performance": (1.0 - avg_perf),
        "Quality": (1.0 - avg_qual)
    }
    main_driver = max(losses, key=losses.get)
    if losses[main_driver] > 0.05: # Only if loss is significant
        insights.append(f"{main_driver} is the primary loss factor ({int(losses[main_driver]*100)}% loss).")

    # --- 4. Recent Activity ---
    recent = []
    # Limit logic: If looking at a specific report, show ALL. If recent activity (global), limit to 500.
    limit = None if target_report_id else 500
    
    sorted_metrics = sorted(metrics, key=lambda x: x.date or date.min, reverse=True)
    if limit:
        sorted_metrics = sorted_metrics[:limit]

    # --- Pre-fetch Global Averages for Rate Check ---
    # We need average performance per (part, machine) to compare against
    # This is a bit expensive, so we'll do a single aggregate query for relevant parts
    relevant_parts = list(set(m.part_number for m in sorted_metrics))
    
    # Calculate global average performance per part/machine
    # We use a trick: group by part_number and machine
    from sqlalchemy import func
    global_stats_stmt = (
        select(Oeemetric.part_number, Oeemetric.machine, func.avg(Oeemetric.performance))
        .where(Oeemetric.part_number.in_(relevant_parts))
        .group_by(Oeemetric.part_number, Oeemetric.machine)
    )
    global_stats_results = session.exec(global_stats_stmt).all()
    
    # Map (part, machine) -> avg_performance
    global_perf_map = {f"{r[0]}|{r[1]}": (r[2] or 0) for r in global_stats_results}

    # Fetch Threshold Settings
    t_perf_low = float(session.get(Setting, "threshold_performance_low").value) if session.get(Setting, "threshold_performance_low") else 0.80
    t_perf_high = float(session.get(Setting, "threshold_performance_high").value) if session.get(Setting, "threshold_performance_high") else 1.10
    t_downtime = float(session.get(Setting, "threshold_downtime_min").value) if session.get(Setting, "threshold_downtime_min") else 20.0
    t_scrap = float(session.get(Setting, "threshold_scrap_rate").value) if session.get(Setting, "threshold_scrap_rate") else 0.05
    t_short_run = float(session.get(Setting, "threshold_short_run_min").value) if session.get(Setting, "threshold_short_run_min") else 60.0

    for m in sorted_metrics:
        diag = {}
        if m.diagnostics_json:
            try:
                import json
                diag = json.loads(m.diagnostics_json)
            except:
                pass
        
        # --- Generate Smart Insights ---
        analysis = []
        
        # 1. Low Performance
        perf = m.performance or 0
        if perf < t_perf_low:
            analysis.append({
                "type": "low_perf",
                "icon": "📉",
                "message": "Performance below target. Check if cycle time is accurate, look for small stops/jams, and ensure training."
            })
            
        # 2. High Performance
        if perf >= t_perf_high:
            analysis.append({
                "type": "high_perf",
                "icon": "🚀",
                "message": "Performance above 100%. Verify rate isn't set too low and counts are recorded correctly."
            })
            
        # 3. High Downtime
        dt = diag.get("downtime_min", 0)
        if dt > t_downtime:
             analysis.append({
                "type": "high_downtime",
                "icon": "🕑",
                "message": f"Downtime ({dt}m) exceeds threshold. Document breakdown reasons and schedule maintenance."
            })

        # 4. High Scrap
        good = diag.get("good_count", 0)
        reject = diag.get("reject_count", 0)
        total = good + reject
        scrap_rate = reject / total if total > 0 else 0
        if scrap_rate >= t_scrap:
             analysis.append({
                "type": "high_scrap",
                "icon": "❌",
                "message": f"High Rejects ({int(scrap_rate*100)}%). Identify defect patterns and perform root-cause analysis."
            })
            
        # 5. Short Run
        run_time = diag.get("run_time_min", 0)
        if run_time < t_short_run:
             analysis.append({
                "type": "short_run",
                "icon": "🧭",
                "message": "Short run (< 1hr). OEE may be misleading; consider grouping orders or factoring setup separately."
            })

        # 6. Global Rate Check
        # Compare this run's performance against the global average for this Part/Machine
        key = f"{m.part_number}|{m.machine}"
        global_avg = global_perf_map.get(key, 0)
        
        # Only trigger if we have enough data (not just this one run)
        # Ideally we'd check count, but for now we assume global_avg exists
        if global_avg > 0:
            # If Global Avg is LOW (<80%) -> Rate might be too high
            if global_avg < t_perf_low:
                 # Check if this icon isn't already added
                 if not any(a['type'] == 'rate_too_high' for a in analysis):
                    analysis.append({
                        "type": "rate_too_high",
                        "icon": "⏱️",
                        "message": "Global rate may be too high. This part/press consistently underperforms across shifts."
                    })
            
            # If Global Avg is HIGH (>100%) -> Rate might be too low
            if global_avg > 1.05: # Use 105% as buffer
                 if not any(a['type'] == 'rate_too_low' for a in analysis):
                    analysis.append({
                        "type": "rate_too_low",
                        "icon": "🔍",
                        "message": "Operators consistently exceed 100%. Rate may be too low; verify ideal cycle time."
                    })

        recent.append({
            "id": m.id,
            "operator": m.operator,
            "machine": m.machine,
            "part_number": m.part_number,
            "date": m.date,
            "oee": m.oee,
            "performance": m.performance,
            "quality": m.quality,
            "availability": m.availability,
            "insight": diag.get("insight"),
            "run_time_min": diag.get("run_time_min"),
            "downtime_min": diag.get("downtime_min"),
            "good_count": diag.get("good_count"),
            "reject_count": diag.get("reject_count"),
            "target_count": diag.get("target_count"),
            "shift": m.shift, # Added shift
            "analysis": analysis # New field
        })

    return {
        "oee": round(avg_oee * 100, 1),
        "availability": round(avg_avail * 100, 1),
        "performance": round(avg_perf * 100, 1),
        "quality": round(avg_qual * 100, 1),
        "recent_activity": recent,
        "db_row_count": count,
        "report_date": current_report_date,
        "sparkline_data": sparkline_data,
        "insights": insights,
        "targets": {
            "oee": oee_target,
            "availability": avail_target,
            "performance": perf_target,
            "quality": qual_target
        }
    }
