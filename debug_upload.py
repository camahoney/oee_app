import pandas as pd
import io
import datetime
from datetime import datetime
import json

# Mocking the file reading part
file_path = r"C:\Users\cmaho\Desktop\Antigravity Test Folder\oee_app\Carmi_Production_Report_V5 (1).xlsx"

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
                        
                        # Append to dictionary list (we'll stringify later if needed, or keep as list until DF)
                        current_entry["downtime_events"].append({"reason": reason, "minutes": dt_minutes})
                        
            except Exception as e:
                # Not a critical failure, just skip sub-row
                print(f"Error parsing sub-row {i}: {e}")
                pass

    # Post-process: Convert list to JSON string for DB compatibility
    for row in clean_rows:
        if row["downtime_events"]:
            try:
                row["downtime_events"] = json.dumps(row["downtime_events"])
            except Exception as e:
                print(f"JSON Dump Error: {e}")
        else:
                row["downtime_events"] = None

    return pd.DataFrame(clean_rows)

print("Reading file...")
try:
    df = pd.read_excel(file_path, header=None)
    print("File read successfully.")
    print(f"Shape: {df.shape}")
    
    print("Processing...")
    result_df = process_raw_report(df)
    print("Processing complete.")
    print(result_df.head())
    print(result_df.info())

except Exception as e:
    print(f"CRITICAL ERROR: {e}")
    import traceback
    traceback.print_exc()
