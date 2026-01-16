import pandas as pd
import sys

# Set encoding explicitly just in case, though usually auto-detected for Excel
file_path = 'C:/Users/cmaho/Desktop/Antigravity Test Folder/oee_app/Macro with Raw Data/1-05-2025 Day shift production.xlsx'

try:
    df = pd.read_excel(file_path, header=None)
    
    print(f"Total Rows: {len(df)}")
    print("-" * 50)
    
    # Find all rows with "Workstation" in Col 3 (index 3)
    # Note: Pandas/Excel might shift columns if there are merged cells.
    # We'll check the row values loosely.
    
    match_count = 0
    for i, row in df.iterrows():
        # Check if "Workstation" is present in the first 10 columns
        row_start = [str(x) for x in row.values[:10]]
        if "Workstation" in row_start:
            match_count += 1
            print(f"MATCH ROW {i}")
            # Identify exact index of 'Workstation'
            try:
                ws_idx = list(row.values).index("Workstation")
                print(f"  'Workstation' at Col {ws_idx}")
                # Print candidate values relative to offsets we guessed
                # Machine ~ +15 (18-3)? No, let's just print values at specific indices
                val_machine = row.values[18] if len(row.values) > 18 else "N/A"
                val_part = row.values[4] if len(row.values) > 4 else "N/A"
                val_op = row.values[15] if len(row.values) > 15 else "N/A"
                val_good = row.values[21] if len(row.values) > 21 else "N/A"
                val_scrap = row.values[22] if len(row.values) > 22 else "N/A"
                val_shift = row.values[17] if len(row.values) > 17 else "N/A"
                
                print(f"  Extracted: Machine={val_machine}, Part={val_part}, Op={val_op}, Good={val_good}, Scrap={val_scrap}, Shift={val_shift}")
            except ValueError:
                pass
                
    print(f"Total Matches Found: {match_count}")
        
except Exception as e:
    print(f"Error: {e}")
