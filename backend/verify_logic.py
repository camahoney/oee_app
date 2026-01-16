import pandas as pd
from datetime import datetime

file_path = 'C:/Users/cmaho/Desktop/Antigravity Test Folder/oee_app/Macro with Raw Data/1-05-2025 Day shift production.xlsx'

def process_raw_report(raw_df: pd.DataFrame) -> pd.DataFrame:
    clean_rows = []
    print(f"Processing Raw DF with shape: {raw_df.shape}")
    
    for i, row in raw_df.iterrows():
        # Check for signature: Col 3 == "Workstation"
        vals = [str(x) for x in row.values]
        
        # Use loose checking since column shifting happens
        if len(vals) > 10 and "Workstation" in vals[:10]:
            try:
                if len(vals) < 23: continue
                
                clean_rows.append({
                    "part_number": vals[4],
                    "operator": vals[15],
                    "machine": vals[18],
                    "shift": vals[17].replace('.0', '') if '.0' in vals[17] else vals[17],
                    "good_count": float(vals[21]) if vals[21] != 'nan' else 0,
                    "reject_count": float(vals[22]) if vals[22] != 'nan' else 0,
                    "date": vals[16] if len(vals) > 16 else datetime.today().date(),
                    "run_time_min": float(vals[24]) * 60 if len(vals) > 24 and vals[24] != 'nan' else 0,
                    "downtime_min": 0
                })
            except Exception as e:
                print(f"Skipping malformed row {i}: {e}")
                continue
    return pd.DataFrame(clean_rows)

try:
    df = pd.read_excel(file_path, header=None)
    clean_df = process_raw_report(df)
    
    print("-" * 50)
    print(f"Extracted {len(clean_df)} rows.")
    if not clean_df.empty:
        print("Sample Data:")
        print(clean_df.head().to_string())
    else:
        print("NO DATA EXTRACTED!")

except Exception as e:
    print(f"Failed: {e}")
