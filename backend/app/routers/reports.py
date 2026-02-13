from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status, Form, BackgroundTasks
from fastapi.responses import JSONResponse, StreamingResponse
from sqlmodel import Session, select
from typing import List, Dict, Any, Optional
import pandas as pd
import io
from datetime import datetime, date
from pydantic import BaseModel


from ..db import ProductionReport, ReportEntry, Oeemetric
from ..database import get_session

router = APIRouter()

# Schema for updating a report entry
class ReportEntryUpdate(BaseModel):
    operator: Optional[str] = None
    machine: Optional[str] = None
    part_number: Optional[str] = None
    job: Optional[str] = None
    shift: Optional[str] = None
    good_count: Optional[int] = None
    reject_count: Optional[int] = None
    run_time_min: Optional[float] = None
    downtime_min: Optional[float] = None

class ReportUpdate(BaseModel):
    filename: Optional[str] = None

# Helper to parse dates safely
def parse_date(value) -> date:
    try:
        if isinstance(value, (datetime, date)):
            return value if isinstance(value, date) else value.date()
        # Use pandas for robust parsing (handles "2026-01-05 00:00:00", etc)
        return pd.to_datetime(value).date()
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {value}")

@router.post("/upload", status_code=status.HTTP_202_ACCEPTED)
def upload_report(file: UploadFile = File(...), session: Session = Depends(get_session)):
    
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
        "good pcs": "good_count",
        "good_pcs": "good_count",
        
        "scrap": "reject_count",
        "reject": "reject_count",
        "rejectcount": "reject_count",
        "rejects": "reject_count",
        "scrap pcs": "reject_count",
        
        "uptime": "run_time_min",
        "runtime": "run_time_min",
        "run time": "run_time_min",
        "run_time_min": "run_time_min",
        
        "downtime": "downtime_min",
        "downtime_min": "downtime_min",
        
        "date": "date",
        "shift": "shift"
    }

    # Helper to process "Carmi Mold Division" raw exports (Legacy Offset Logic)
    def process_raw_report(raw_df: pd.DataFrame) -> pd.DataFrame:
        clean_rows = []
        # Find offsets relative to row structure.
        # Analysis of "01-05-2025" file shows:
        # Col 3=Workstation. Offset = WS_Index - 3.
        # Col 18=Machine, Col 4=Part, Col 15=Operator.
        # Col 21=Good, Col 22=Reject.
        # Col 24=Run Time, Col 25=Downtime.
        
        current_entry = None
        current_offset = 0
        
        for i, row in raw_df.iterrows():
            vals = [str(x) for x in row.values]
            
            # 1. Check for NEW ENTRY signature (Contains "Workstation")
            is_main_entry = False
            if len(vals) > 5 and "Workstation" in vals[:10]:
                try:
                    ws_idx = vals.index("Workstation")
                    is_main_entry = True
                except ValueError:
                    pass
            
            if is_main_entry:
                try:
                    if len(vals) < 26: continue
                    
                    offset = ws_idx - 3
                    current_offset = offset # Store for sub-rows
                    
                    raw_shift = str(vals[17 + offset])
                    shift_val = raw_shift.replace('.0', '').strip()
                    if shift_val.lower() == 'nan' or not shift_val:
                        shift_val = "Unknown"
                        
                    def safe_float(v):
                        try: return float(v)
                        except: return 0.0

                    new_entry = {
                        "part_number": vals[4 + offset],
                        "operator": vals[15 + offset],
                        "machine": vals[18 + offset],
                        "job": str(vals[19 + offset]).replace('nan', '') if len(vals) > 19 + offset else '',
                        "shift": shift_val,
                        "good_count": safe_float(vals[21 + offset]) if vals[21 + offset] != 'nan' else 0,
                        "reject_count": safe_float(vals[22 + offset]) if vals[22 + offset] != 'nan' else 0,
                        "date": vals[16 + offset] if len(vals) > 16 + offset else datetime.today().date(), 
                        "run_time_min": safe_float(vals[24 + offset]) * 60 if len(vals) > 24 + offset and vals[24 + offset] != 'nan' else 0,
                        "downtime_min": safe_float(vals[25 + offset]) * 60 if len(vals) > 25 + offset and vals[25 + offset] != 'nan' else 0,
                        "downtime_events": [] # Initialize list
                    }

                    # Capture reason from MAIN row if present (often finding 'Breakdown' or comments here)
                    if new_entry["downtime_min"] > 0:
                        row_text_candidates = []
                        # Scan columns for text, skipping known fields
                        # Known: 4(Part), 15(Op), 16(Date), 17(Shift), 18(Machine), 19(Job), 21(Good), 22(Reject), 24(Run), 25(Down)
                        skip_cols = [4, 15, 16, 17, 18, 19, 21, 22, 24, 25]
                        
                        for idx in range(10 + offset, 30 + offset):
                            if (idx - offset) in skip_cols:
                                continue
                            if len(vals) > idx:
                                val = str(vals[idx]).strip()
                                if val and val.lower() != 'nan' and not val.replace('.', '', 1).isdigit():
                                    row_text_candidates.append(val)
                        
                        if row_text_candidates:
                            # Heuristic: First candidate is likely the reason
                            # (Sometimes machine name leaks in if offset is slightly off, but we skip col 18)
                            r_reason = row_text_candidates[0]
                            # Start with Clean Reasons
                            new_entry["downtime_events"].append({"reason": r_reason, "minutes": new_entry["downtime_min"]})

                    clean_rows.append(new_entry)
                    current_entry = new_entry
                    
                except Exception as e:
                    print(f"Skipping malformed row {i}: {e}")
                    current_entry = None # Reset if failed
                    continue
            
            # 2. Check for SUB-ROW (Downtime Event)
            elif current_entry is not None:
                # Logic: If it's not a main entry, but has time in the Downtime Column, it's an event.
                try:
                    # Use stored offset
                    dt_idx = 25 + current_offset
                    if len(vals) > dt_idx:
                        raw_dt = vals[dt_idx]
                        try:
                            dt_minutes = float(raw_dt) * 60
                        except:
                            dt_minutes = 0
                            
                        if dt_minutes > 0:
                            # It has downtime time. Find the reason.
                            # Heuristic: Check columns 18 (Machine), 19 (Job), or 26 (Comments?)
                            # We'll take the first non-numeric looking string in typical columns
                            reason = "Unknown Reason"
                            
                            # Candidate indices for Reason string relative to offset
                            candidates = [18 + current_offset, 19 + current_offset, 26 + current_offset]
                            # Expand search: scan standard 'text-heavy' columns in the row (e.g. 10-30)
                            # excluding known numeric columns like 21, 22, 24, 25
                            text_candidates = []
                            for idx in range(10 + current_offset, 30 + current_offset):
                                if idx in [21+current_offset, 22+current_offset, 24+current_offset, 25+current_offset]:
                                    continue
                                if len(vals) > idx:
                                    val = str(vals[idx]).strip()
                                    if val and val.lower() != 'nan' and not val.replace('.', '', 1).isdigit():
                                         # valid text
                                         text_candidates.append(val)
                            
                            if text_candidates:
                                # Prioritize likely reasons (longest string? or first found?)
                                # Often the reason is the *only* text in the row besides machine name
                                reason = text_candidates[0]
                                # Filter out if it matches machine name
                                machine_name = current_entry.get("machine", "")
                                if reason == machine_name and len(text_candidates) > 1:
                                     reason = text_candidates[1]

                            # Heuristic: Check columns 18 (Machine), 19 (Job), or 26 (Comments?)
                            # We'll take the first non-numeric looking string in typical columns
                            
                            import json
                            # Append to dictionary list (we'll stringify later if needed, or keep as list until DF)
                            current_entry["downtime_events"].append({"reason": reason, "minutes": dt_minutes})
                            
                except Exception as e:
                    # Not a critical failure, just skip sub-row
                    pass

        # Post-process: Convert list to JSON string for DB compatibility
        for row in clean_rows:
            import json
            if row["downtime_events"]:
                row["downtime_events"] = json.dumps(row["downtime_events"])
            else:
                 row["downtime_events"] = None

        return pd.DataFrame(clean_rows)
    
    # Check if Raw File
    first_col_name = str(df.columns[0]) if not df.empty else ""
    first_cell_val = str(df.iloc[0,0]) if not df.empty else ""
    
    if "Carmi Mold" in first_col_name or "Barcode" in first_col_name or "Carmi Mold" in first_cell_val:
        print("Detected Raw Report Format. Re-reading with header=None...")
        file.file.seek(0)
        contents = file.file.read()
        if file.filename.endswith('.csv'):
             raw_df = pd.read_csv(io.BytesIO(contents), header=None, encoding='utf-8-sig')
        else:
             raw_df = pd.read_excel(io.BytesIO(contents), header=None)     
        df = process_raw_report(raw_df)
    
    # Normalize checks to lowercase
    renamed = {}
    for col in df.columns:
        norm = str(col).strip().lower()
        if norm in col_map:
            renamed[col] = col_map[norm]
    df.rename(columns=renamed, inplace=True)
    
    # Fallback: If part_number missing, try Raw Parse one last time (simple, no multi-sheet loop)
    if "part_number" not in df.columns:
        print("Standard parse failed (Part Number missing). Retrying with simple Raw Parser...")
        file.file.seek(0)
        contents = file.file.read()
        if file.filename.endswith('.csv'):
             raw_df = pd.read_csv(io.BytesIO(contents), header=None, encoding='utf-8-sig')
        else:
             raw_df = pd.read_excel(io.BytesIO(contents), header=None)
        
        parsed_df = process_raw_report(raw_df)
        if not parsed_df.empty:
            df = parsed_df
        # If still empty, the error below will catch it with 'Columns Missing'
    
    try:
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
        
        if "total_count" not in df.columns or (pd.to_numeric(df.get("total_count", []), errors='coerce').fillna(0).sum() == 0):
            df["total_count"] = df["good_count"] + df["reject_count"]
        
        # 3. Times: Ensure run/down exist, handle HOURS detection
        if "run_time_min" not in df.columns: df["run_time_min"] = 0.0
        if "downtime_min" not in df.columns: df["downtime_min"] = 0.0
        
        df["run_time_min"] = pd.to_numeric(df["run_time_min"], errors='coerce').fillna(0.0)
        df["downtime_min"] = pd.to_numeric(df["downtime_min"], errors='coerce').fillna(0.0)

        # Unit Conversion Heuristic
        # If the average run time is < 12 (hours), likely it is hours. 480 min = 8 hours.
        # BUT if we already converted in process_raw_report (x 60), we should skip this?
        # A simple check: if we just processed raw, we know units.
        pass # Logic below handles generic heuristic. If raw gave minutes, mean will be > 12. If raw gave hours, mean < 12.
        
        if not df.empty and df["run_time_min"].mean() < 12:
             df["run_time_min"] = df["run_time_min"] * 60
             df["downtime_min"] = df["downtime_min"] * 60

        if "planned_production_time_min" not in df.columns:
            df["planned_production_time_min"] = df["run_time_min"] + df["downtime_min"]
            
        # Validation
        required_db_cols = {"part_number", "run_time_min", "good_count"}
        missing = required_db_cols - set(df.columns)
        if missing:
             found_cols = df.columns.tolist()
             # Simple snippet
             snippet = "No Data Scanned"
             if not df.empty:
                 snippet = df.head(3).to_dict(orient="records")
             
             raise HTTPException(status_code=400, detail=f"Columns Missing. Found: {found_cols}. Missing: {missing}. Data Preview: {snippet}")

        # Store the report metadata
        # HARDCODED FIX: uploaded_by=1 (Admin) to satisfy NOT NULL constraint
        report = ProductionReport(filename=file.filename, uploaded_at=datetime.utcnow(), uploaded_by=1)
        session.add(report)
        session.commit()
        session.refresh(report)
        
        # Insert each row as ReportEntry
        entries = []
        
        def safe_int(val, default=0):
            """Convert to int safely, handling NaN, None, float, str."""
            if val is None:
                return default
            try:
                if isinstance(val, float) and (pd.isna(val) or val != val):
                    return default
                return int(float(val))
            except (ValueError, TypeError):
                return default
        
        def safe_float(val, default=0.0):
            """Convert to float safely, handling NaN, None, str."""
            if val is None:
                return default
            try:
                result = float(val)
                if pd.isna(result) or result != result:
                    return default
                return result
            except (ValueError, TypeError):
                return default
        
        def safe_downtime_events(val):
            """Handle downtime_events: could be list, dict, JSON string, NaN, or None."""
            if val is None:
                return None
            if isinstance(val, (list, dict)):
                import json
                return json.dumps(val)
            if isinstance(val, str) and val.strip():
                return val
            # Check for NaN (scalar only)
            try:
                if pd.isna(val):
                    return None
            except (ValueError, TypeError):
                # pd.isna fails on non-scalar — if it's truthy, stringify it
                if val:
                    import json
                    return json.dumps(val) if not isinstance(val, str) else val
            return None
        
        def safe_str(val, default=''):
            """Convert to str safely, turning NaN/None into default."""
            if val is None:
                return default
            try:
                if isinstance(val, float) and pd.isna(val):
                    return default
            except (ValueError, TypeError):
                pass
            s = str(val).strip()
            if s.lower() == 'nan':
                return default
            return s
        
        for _, row in df.iterrows():
            try:
                 entry = ReportEntry(
                    report_id=report.id,
                    date=parse_date(row['date']),
                    operator=safe_str(row.get('operator'), 'Unknown'),
                    machine=safe_str(row.get('machine'), 'Unknown'),
                    part_number=safe_str(row.get('part_number'), 'Unknown'),
                    job=safe_str(row.get('job'), ''),
                    planned_production_time_min=safe_float(row.get('planned_production_time_min')),
                    run_time_min=safe_float(row.get('run_time_min')),
                    downtime_min=safe_float(row.get('downtime_min')),
                    total_count=safe_int(row.get('total_count')),
                    good_count=safe_int(row.get('good_count')),
                    reject_count=safe_int(row.get('reject_count')),
                    shift=safe_str(row.get('shift'), ''),
                    raw_row_json=row.to_json(),
                    downtime_events=safe_downtime_events(row.get('downtime_events'))
                )
                 entries.append(entry)
            except Exception as e:
                import traceback
                traceback.print_exc()
                # Stop immediately and report the error so fixing is enforced
                raise HTTPException(status_code=500, detail=f"Failed to process row {row.to_dict()}: {str(e)}")
                
        session.bulk_save_objects(entries)
        session.commit()
        # Return a simple preview of first few rows (DEPRECATED for frontend display, but kept for legacy compat)
        # Frontend should now use GET /reports/{id}/entries
        preview = df.head().to_dict(orient="records")
        return {"report_id": report.id, "preview": preview, "message": "Report uploaded. Review entries before calculation."}
        
    except HTTPException as he:
        raise he
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Server Error: {str(e)}")

    return report

@router.get("/{report_id}/entries", response_model=List[ReportEntry])
def get_report_entries(report_id: int, session: Session = Depends(get_session)):
    """Fetch all entries for a report to allow editing/review."""
    entries = session.exec(select(ReportEntry).where(ReportEntry.report_id == report_id)).all()
    return entries

@router.put("/entries/{entry_id}", response_model=ReportEntry)
def update_report_entry(entry_id: int, update_data: ReportEntryUpdate, session: Session = Depends(get_session)):
    """Update a specific report entry."""
    entry = session.get(ReportEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
        
    # Update fields if provided
    update_dict = update_data.dict(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(entry, key, value)
        
    # Re-calculate basics if counts changed
    if "good_count" in update_dict or "reject_count" in update_dict:
        entry.total_count = (entry.good_count or 0) + (entry.reject_count or 0)
        
    # Re-calculate planned time if run/down changed
    if "run_time_min" in update_dict or "downtime_min" in update_dict:
        entry.planned_production_time_min = (entry.run_time_min or 0) + (entry.downtime_min or 0)
        
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry

@router.post("/{report_id}/entries", response_model=ReportEntry)
def create_report_entry(report_id: int, entry_data: ReportEntryUpdate, session: Session = Depends(get_session)):
    """Create a new manual entry for a report."""
    report = session.get(ProductionReport, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
        
    # Create with defaults
    entry = ReportEntry(
        report_id=report_id,
        date=datetime.today().date(), # Default to new entry today, or frontend should send it
        operator=entry_data.operator or "New Operator",
        machine=entry_data.machine or "New Machine",
        part_number=entry_data.part_number or "Part-001",
        job=entry_data.job or "",
        shift=entry_data.shift or "1",
        good_count=entry_data.good_count or 0,
        reject_count=entry_data.reject_count or 0,
        run_time_min=entry_data.run_time_min or 0.0,
        downtime_min=entry_data.downtime_min or 0.0,
        planned_production_time_min=0.0,
        total_count=0
    )
    
    # Recalculate totals
    entry.total_count = entry.good_count + entry.reject_count
    entry.planned_production_time_min = entry.run_time_min + entry.downtime_min
    
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry

@router.delete("/entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_report_entry(entry_id: int, session: Session = Depends(get_session)):
    """Delete a single report entry."""
    entry = session.get(ReportEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
        
    session.delete(entry)
    session.commit()
    return None

@router.get("/", response_model=List[ProductionReport])
def list_reports(session: Session = Depends(get_session)):
    """List all available production reports."""
    reports = session.exec(select(ProductionReport).order_by(ProductionReport.uploaded_at.desc())).all()
    return reports

@router.put("/{report_id}", response_model=ProductionReport)
def update_report(report_id: int, report_update: ReportUpdate, session: Session = Depends(get_session)):
    """Update report metadata (e.g. filename)."""
    report = session.get(ProductionReport, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
        
    if report_update.filename is not None:
        report.filename = report_update.filename
        
    session.add(report)
    session.commit()
    session.refresh(report)
    return report

@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_report(report_id: int, session: Session = Depends(get_session)):
    """Delete a report and all associated entries and metrics."""
    report = session.get(ProductionReport, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
        
    # Cascade delete is handled by database usually, but explicit here for safety if not set up
    session.exec(select(Oeemetric).where(Oeemetric.report_id == report_id)).all()

    try:
        from sqlmodel import delete
        session.exec(delete(Oeemetric).where(Oeemetric.report_id == report_id))
        session.exec(delete(ReportEntry).where(ReportEntry.report_id == report_id))
        session.delete(report)
        session.commit()
    except Exception as e:
         raise HTTPException(status_code=500, detail=f"Failed to delete: {str(e)}")
    
    return None

@router.get("/{report_id}/export")
def export_report(
    report_id: int,
    format: str = "csv",
    session: Session = Depends(get_session)
):
    """
    Export report data and metrics to CSV or XLSX.
    """
    # 1. Fetch Report Entries + Metrics
    results = session.exec(
        select(ReportEntry, Oeemetric)
        .outerjoin(Oeemetric, (Oeemetric.report_id == ReportEntry.report_id) & 
                              (Oeemetric.part_number == ReportEntry.part_number) & 
                              (Oeemetric.machine == ReportEntry.machine) &
                              (Oeemetric.shift == ReportEntry.shift))
        .where(ReportEntry.report_id == report_id)
    ).all()
    
    if not results:
        raise HTTPException(status_code=404, detail="Report not found or empty")

    # 2. Flatten Data for Export
    data_rows = []
    for entry, metric in results:
        row = entry.dict()
        if metric:
            row.update({
                "oee": metric.oee,
                "availability": metric.availability,
                "performance": metric.performance,
                "quality": metric.quality,
                "target_count": metric.target_count,
                 # "diagnostics": metric.diagnostics_json # Optional: exclude or parse
            })
        data_rows.append(row)

    df = pd.DataFrame(data_rows)
    
    # 3. Export
    stream = io.BytesIO()
    filename = f"report_{report_id}_export.{format}"
    media_type = ""

    if format == "csv":
        df.to_csv(stream, index=False)
        media_type = "text/csv"
    elif format == "xlsx":
        df.to_excel(stream, index=False, engine='openpyxl')
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    else:
        raise HTTPException(status_code=400, detail="Invalid format. Use 'csv' or 'xlsx'")
        
    stream.seek(0)
    
    return StreamingResponse(
        stream, 
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
