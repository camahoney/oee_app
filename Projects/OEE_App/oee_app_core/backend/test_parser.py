
import pandas as pd
import json
import six

# Mocking the process_raw_report logic to test extraction
def test_parser_logic():
    # Create a mock dataframe mimicking the structure
    # We need enough columns to hit the indices (25 for downtime, etc)
    # 0,1,2,3(WS),4(Part),...15(Op),16(Date),17(Shift),18(Mach),19(Job),20,21(Good),22(Rej),23,24(Run),25(Down),26(Reason)
    
    # Header Row (to establish offset if needed, though logic looks for "Workstation" value)
    
    # Row 1: Main Entry
    # Col 3 = "Workstation"
    # Col 4 = "PartA"
    # Col 18 = "Press1"
    # Col 25 = "30" (Total Downtime)
    row1 = [""] * 30
    row1[3] = "Workstation"
    row1[4] = "PartA"
    row1[15] = "Op1"
    row1[18] = "Press1"
    row1[25] = "30" # 30 mins
    
    # Row 2: Sub Entry 1 (Jam, 10 min)
    # Col 25 = "10"
    # Col 18 or 26 = "Jam" (Let's put it in 26 to test that fallback, or 18)
    row2 = [""] * 30
    row2[25] = "10" 
    row2[26] = "Jam" 
    
    # Row 3: Sub Entry 2 (Break, 20 min)
    row3 = [""] * 30
    row3[25] = "20"
    row3[19] = "Break" # Test checking Col 19
    
    # Row 4: New Main Entry
    row4 = [""] * 30
    row4[3] = "Workstation"
    row4[4] = "PartB"
    row4[18] = "Press2"
    
    data = [row1, row2, row3, row4]
    df = pd.DataFrame(data)
    
    clean_rows = []
    current_entry = None
    current_offset = 0
    
    print("Starting Parser Test...")
    
    for i, row in df.iterrows():
        vals = [str(x) for x in row.values]
        
        is_main_entry = False
        if len(vals) > 5 and "Workstation" in vals[:10]:
            try:
                ws_idx = vals.index("Workstation")
                is_main_entry = True
            except ValueError:
                pass
        
        if is_main_entry:
            # Simplified parsing logic from Reports.py
            offset = ws_idx - 3
            current_offset = offset
            
            new_entry = {
                "part": vals[4+offset],
                "machine": vals[18+offset],
                "downtime_min": float(vals[25+offset]) * 60 if vals[25+offset] else 0,
                "downtime_events": []
            }
            clean_rows.append(new_entry)
            current_entry = new_entry
            print(f"Found Main Entry: {new_entry['machine']}")
            
        elif current_entry is not None:
            # Sub row logic
            try:
                dt_idx = 25 + current_offset
                if len(vals) > dt_idx:
                    raw_dt = vals[dt_idx]
                    try:
                        dt_minutes = float(raw_dt) * 60
                    except:
                        dt_minutes = 0
                    
                    if dt_minutes > 0:
                        reason = "Unknown"
                        candidates = [18 + current_offset, 19 + current_offset, 26 + current_offset]
                        for c_idx in candidates:
                            if len(vals) > c_idx:
                                val = str(vals[c_idx]).strip()
                                if val and val != "nan" and not val.replace('.','',1).isdigit():
                                    reason = val
                                    break
                        
                        current_entry["downtime_events"].append({"reason": reason, "minutes": dt_minutes})
                        print(f"  -> Found Event: {reason} ({dt_minutes} min)")
            except Exception as e:
                print(e)
                
    # Validation
    print("\nResults:")
    for row in clean_rows:
        print(f"Machine: {row['machine']}, Events: {json.dumps(row['downtime_events'])}")

if __name__ == "__main__":
    test_parser_logic()
