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
    try:
        if isinstance(value, (datetime, date)):
            return value if isinstance(value, date) else value.date()
        # Use pandas for robust parsing (handles "2026-01-05 00:00:00", etc)
        return pd.to_datetime(value).date()
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {value}")

@router.post("/upload", status_code=status.HTTP_202_ACCEPTED)
def upload_report(file: UploadFile = File(...), session: Session = Depends(get_session)):
    # Relaxed validation - rely on extension
    # if file.content_type not in ... (removed to allow diverse browser MIME types)
    
    contents = file.file.read()
    raw_data_debug = "No raw content read"
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
        "good pcs": "good_count",
        
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

    # Helper to process "Carmi Mold Division" raw exports
    def process_raw_report(raw_df: pd.DataFrame) -> pd.DataFrame:
        clean_rows = []
        header_map = {}
        header_found = False
        
        # Keywords to identify the header row
        # User screenshot has: Part #s, Operator, Shift, Position, Uptime, Downtime
        target_headers = {
            "part": ["part #", "part_number", "part", "part number", "part #s"],
            "operator": ["operator", "oper"],
            "machine": ["workstation", "machine", "position", "mach"],
            "shift": ["shift"],
            "good": ["good", "good pieces", "good count", "good_count"],
            "reject": ["scrap", "reject", "rejects", "reject count", "bad"],
            "run_time": ["uptime", "run time", "runtime", "run_time_min", "total runtime"],
            "downtime": ["downtime", "down time", "downtime_min"],
            "date": ["date", "prod date"]
        }
        
        for i, row in raw_df.iterrows():
            vals = [str(x).strip() for x in row.values]
            
            # 1. Attempt to detect header
            if not header_found:
                # Count matches against our targets
                lower_vals = [v.lower() for v in vals]
                matches = 0
                temp_map = {}
                
                for key, candidates in target_headers.items():
                    for cand in candidates:
                        try:
                            # partial match check? or exact?
                            # Use exact or "starts with" for safety
                            # Let's try to find the index of a matching column
                            for idx, cell_val in enumerate(lower_vals):
                                if cand in cell_val: # "Part #s" contains "part #"
                                    temp_map[key] = idx
                                    matches += 1
                                    break
                            if key in temp_map: break
                        except: continue
                
                # If we found enough critical columns (Part, Machine, Good), assume this is header
                if matches >= 2 and "part" in temp_map:
                    header_map = temp_map
                    header_found = True
                    print(f"Header detected at row {i}: {header_map}")
                continue
            
            # 2. Process Data Rows (only after header is found)
            # Ensure row has data
            if len(vals) < 5 or vals[0] == 'nan': continue
            
            try:
                # Helper to safe extraction
                def get_val(key, default=None):
                    if key in header_map and header_map[key] < len(vals):
                        val = vals[header_map[key]]
                        return val if val.lower() != 'nan' else default
                    return default

                part_val = get_val("part", "Unknown")
                # Skip totals/summary rows if any
                if "total" in str(part_val).lower(): continue
                
                shift_val = str(get_val("shift", "Unknown")).replace('.0', '').strip()
                if not shift_val or shift_val.lower() == 'nan': shift_val = "Unknown"
                
                # Extract numeric values
                def parse_float(v):
                    try: return float(v)
                    except: return 0.0

                clean_rows.append({
                    "part_number": part_val,
                    "operator": get_val("operator", "Unknown"),
                    "machine": get_val("machine", "Unknown"),
                    "shift": shift_val,
                    "good_count": parse_float(get_val("good")),
                    "reject_count": parse_float(get_val("reject")),
                    "date": get_val("date", datetime.today().date()),
                    # Note: Don't auto-convert * 60 here. Let the generic heuristic handle it later 
                    # unless we are sure. But "Uptime" in user sheet is 4.32 (hours).
                    # We will output as-is and let the logic below detect < 12 and multiply by 60.
                    "run_time_min": parse_float(get_val("run_time")), 
                    "downtime_min": parse_float(get_val("downtime"))
                })

            except Exception as e:
                # print(f"Skipping row {i}: {e}")
                continue
                
        if not header_found and clean_rows == []:
             # DEBUG: Return a DF with a special column that triggers an informative error
             # Or just print to logs. The caller handles the empty DF.
             # Let's create a single-row DF with "DEBUG_INFO" to pass the snippet back.
             print("DEBUG: No header found. Snippet of raw data:")
             for r in raw_df.head(5).values:
                 print(r)
                 
        return pd.DataFrame(clean_rows)
    
    # Check if Raw File
    # Signatures might be in the first column name OR the first cell
    first_col_name = str(df.columns[0]) if not df.empty else ""
    first_cell_val = str(df.iloc[0,0]) if not df.empty else ""
    
    if "Carmi Mold" in first_col_name or "Barcode" in first_col_name or "Carmi Mold" in first_cell_val:
        print("Detected Raw Report Format. Re-reading with header=None and Pre-processing...")
        # Re-read to ensure we get all rows without header interference
        file.file.seek(0)
        contents = file.file.read()
        if file.filename.endswith('.csv'):
             raw_df = pd.read_csv(io.BytesIO(contents), header=None, encoding='utf-8-sig') # Fallback handling needed?
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
    
    # FALLBACK STRATEGY: 
    # If "part_number" is missing relative to standard read, implied that headers weren't found at Row 0.
    # Trigger the Dynamic Raw Parser to hunt for headers.
    if "part_number" not in df.columns:
        print("Standard parse failed (Part Number missing). Retrying with Dynamic Raw Parser...")
        file.file.seek(0)
        contents = file.file.read()
        if file.filename.endswith('.csv'):
             raw_df = pd.read_csv(io.BytesIO(contents), header=None, encoding='utf-8-sig')
             raw_data_debug = str(raw_df.head(5).values.tolist())
             df = process_raw_report(raw_df)
        else:
             # Try first sheet first
             raw_df = pd.read_excel(io.BytesIO(contents), header=None)
             raw_data_debug = str(raw_df.head(5).values.tolist())
             df = process_raw_report(raw_df)
             
             # If first sheet yielded no results, try ALL sheets
             if df.empty:
                 print("First sheet empty/invalid. Scanning all sheets...")
                 all_sheets = pd.read_excel(io.BytesIO(contents), sheet_name=None, header=None)
                 raw_data_debug += f" All Sheets: {list(all_sheets.keys())}. "
                 
                 for sheet_name, sheet_df in all_sheets.items():
                     print(f"Scanning sheet: {sheet_name}")
                     raw_data_debug += f" [Scanning {sheet_name}]: " + str(sheet_df.head(3).values.tolist())
                     candidate_df = process_raw_report(sheet_df)
                     if not candidate_df.empty:
                         print(f"Found valid data in sheet: {sheet_name}")
                         df = candidate_df
                         break
    
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
        
        if "total_count" not in df.columns:
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
             # Create debug snippet of what WAS found (up to 3 rows) to help user debug
             snippet = "No Data Scanned"
             if not df.empty:
                 snippet = df.head(3).to_dict(orient="records")
             
             raise HTTPException(status_code=400, detail=f"Columns Missing. Found: {found_cols}. Missing: {missing}. Data Preview: {snippet}. Raw Dump: {raw_data_debug}")

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
                import traceback
                traceback.print_exc()
                # Stop immediately and report the error so fixing is enforced
                raise HTTPException(status_code=500, detail=f"Failed to process row {row}: {str(e)}")
                
        session.bulk_save_objects(entries)
        session.commit()
        # Return a simple preview of first few rows
        preview = df.head().to_dict(orient="records")
        return {"report_id": report.id, "preview": preview, "message": "Report uploaded and stored."}
        
    except HTTPException as he:
        raise he
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Server Error: {str(e)}")

    return report

@router.get("/", response_model=List[ProductionReport])
def list_reports(session: Session = Depends(get_session)):
    """List all available production reports."""
    reports = session.exec(select(ProductionReport).order_by(ProductionReport.uploaded_at.desc())).all()
    return reports

@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_report(report_id: int, session: Session = Depends(get_session)):
    """Delete a report and all associated entries and metrics."""
    report = session.get(ProductionReport, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
        
    # Cascade delete is handled by database usually, but explicit here for safety if not set up
    # Delete metrics
    session.exec(select(Oeemetric).where(Oeemetric.report_id == report_id)).all()
    # Actually, bulk delete via statement is better
    # But SQLModel doesn't support bulk delete easily on some versions without session.exec
    
    # Simple approach: delete report object, let FK cascade if enabled or manual delete
    # Manually deleting robustly:
    try:
        from sqlmodel import delete
        session.exec(delete(Oeemetric).where(Oeemetric.report_id == report_id))
        session.exec(delete(ReportEntry).where(ReportEntry.report_id == report_id))
        session.delete(report)
        session.commit()
    except Exception as e:
         raise HTTPException(status_code=500, detail=f"Failed to delete: {str(e)}")
    
    return None
