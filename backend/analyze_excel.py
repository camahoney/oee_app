import pandas as pd
import sys

# Load the file
file_path = r"C:\Users\cmaho\Desktop\Antigravity Test Folder\oee_app\Macro with Raw Data\01-05-2025 3rd shift production.xlsx"
print(f"Reading {file_path}...")

try:
    df = pd.read_excel(file_path, header=None)
    
    # search for "Workstation"
    for i, row in df.iterrows():
        vals = [str(v) for v in row.values]
        if "Workstation" in vals:
            print(f"Header Row found at index {i}")
            # print with indices
            for idx, col_val in enumerate(row.values):
                print(f"Col {idx}: {col_val}")
                
            # Print the NEXT row (data)
            next_row = df.iloc[i+1]
            print(f"\nData Row (Index {i+1}):")
            for idx, col_val in enumerate(next_row.values):
                print(f"Col {idx}: {col_val}")
            
            # Print the row after that just in case
            next_row2 = df.iloc[i+2]
            print(f"\nData Row (Index {i+2}):")
            for idx, col_val in enumerate(next_row2.values):
                print(f"Col {idx}: {col_val}")
                
            break
            
except Exception as e:
    print(e)
