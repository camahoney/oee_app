import pandas as pd
import io
from datetime import datetime
import json

# EXACT content from user's production.csv
CSV_CONTENT = """Part #s,Operator,Shift,Position,SO#s,Pay Code,Good Pieces,Scrap,Lab,Uptime,Downtime
18-59922-000,"3424  Foster,Kyle",3,ASY01,SO# 658800 / 658800,550 / 900,4,6,1,1.46,0.58
18-59922-000,"3424  Foster,Kyle",3,ASY01,SO# 658800 / 658800,550 / 900,94,0,0,0.15,0
18-59922-000,"3206  Kuhn,David",3,ASY01,SO# 658800 / 658800,550 / 900,164,4,0,2.21,0
68622598AA,"3421  Pasaporte,Carl",3,ASY03,SO# 617400 / 617400,550 / 900,146,0,1,3.05,0
68622598AA,"3206  Kuhn,David",3,ASY04,SO# 617400 / 617400,550 / 900,300,0,1,3.05,0
60374000,"3414  Boaz,Ricky",3,ASY05,SO# 654590 / 654590,550 / 900,57,0,1,1.27,0
15030648,"3414  Boaz,Ricky",3,ASY06,SO# 676210 / 676210,550 / 900,22,0,0,2.04,0
A62-1061-700,"3429  Keller,Charles",3,ASY08,SO# 610350 / 610350,550 / 900,550,1,1,7.3,0
A85-2144-002,"3370  Huff,Izaiah",3,ASY31,SO# 610031 / 610031,550 / 900,80,0,1,4.44,0
TO108-007,"3369  Quituga,Ray",3,CMP13,SO# 677640 / 677640,500 / 900,13,0,1,3.48,0
TLB-13371-55,"3423  Rash,Sarah",3,INJ12,SO# 671410 / 671410,500 / 900,1,0,0,0.11,1.19
TLB-13371-55,"3423  Rash,Sarah",3,INJ12,SO# 671410 / 671410,500 / 900,166,0,2,2.11,0.32
15000896,"3410  Hilger,Dalton",3,INJ18,SO# 641780 / 641780,500 / 900,692,10,2,6.13,1.06
01-33963-000,"3387  Williams,Amanda",3,INJ23,SO# 672650 / 672650,500 / 900,223,0,1,6.54,0.29
8525967,"3179  Chapman,Matt",3,INJ25,SO# 656800 / 656800,500 / 900,537,14,1,6.43,0.42
01-33964-000,"3325  Bowles,Zach",3,INJ26,SO# 672640 / 672640,500 / 900,283,4,1,6.37,0.27
25728545,"3414  Boaz,Ricky",3,INJ28,SO# 655630 / 655630,500 / 900,220,17,1,2.52,0.56
25728543,"3421  Pasaporte,Carl",3,INJ30,SO# 655670 / 655670,500 / 900,248,16,1,2.54,0.59
CP5100-060,"3370  Huff,Izaiah",3,INJ31,SO# 51730 / 51730,500 / 900,90,6,0,5.41,1.41
SS-CP5172-060,"3431  Miller,Damion",3,INJ32,SO# 54045 / 54045,500 / 900,125,0,0,6.46,0.3
05-16401,"3425  McDowell,Kayden",3,INJ37,SO# 678990 / 678990,500 / 900,620,1,3,7.01,0.24
11459-2,"3378  Hosman,Dalton",3,INJ38,SO# 559560 / 559560,500 / 900,174,0,1,6.01,1.12
13248,"3335  Highwood,Kaneon",3,INJ39,SO# 642380 / 642380,500 / 900,150,36,1,4.2,3.02
SS-CK6117-060,"3424  Foster,Kyle",3,INJ40,SO# 52025 / 52025,500 / 900,36,0,0,1.07,1.08"""

def run_debug():
    print("Beginning Debug Simulation...")
    try:
        # Simulate BytesIO load
        df = pd.read_csv(io.StringIO(CSV_CONTENT), encoding='utf-8')
        print("CSV Read Success. Columns found:", df.columns.tolist())
        
        # MAPPING LOGIC (Copied from reports.py)
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
            
            "scrap": "reject_count",
            "reject": "reject_count",
            "rejectcount": "reject_count",
            "rejects": "reject_count",
            
            "uptime": "run_time_min",
            "runtime": "run_time_min",
            "run time": "run_time_min",
            "run_time_min": "run_time_min",
            
            "downtime": "downtime_min",
            "downtime_min": "downtime_min",
            
            "date": "date",
            "shift": "shift"
        }
        
        renamed = {}
        for col in df.columns:
            norm = str(col).strip().lower()
            if norm in col_map:
                renamed[col] = col_map[norm]
        
        print(f"Renaming Map: {renamed}")
        df.rename(columns=renamed, inplace=True)
        print("Columns after rename:", df.columns.tolist())
        
        # Logic 1: Date
        if "date" not in df.columns:
            print("Date missing, defaulting to today.")
            df["date"] = datetime.today().date()
        
        # Logic 2: Counts
        if "good_count" not in df.columns: df["good_count"] = 0
        if "reject_count" not in df.columns: df["reject_count"] = 0
        df["good_count"] = df["good_count"].fillna(0)
        df["reject_count"] = df["reject_count"].fillna(0)
        
        if "total_count" not in df.columns:
            df["total_count"] = df["good_count"] + df["reject_count"]
            
        # Logic 3: Times
        if "run_time_min" not in df.columns: df["run_time_min"] = 0.0
        if "downtime_min" not in df.columns: df["downtime_min"] = 0.0
        
        df["run_time_min"] = df["run_time_min"].fillna(0.0)
        df["downtime_min"] = df["downtime_min"].fillna(0.0)
        
        mean_run = df["run_time_min"].mean()
        print(f"Mean Run Time: {mean_run}")
        
        if not df.empty and mean_run < 12:
            print("Detected Hours! converting...")
            df["run_time_min"] = df["run_time_min"] * 60
            df["downtime_min"] = df["downtime_min"] * 60
            
        if "planned_production_time_min" not in df.columns:
            df["planned_production_time_min"] = df["run_time_min"] + df["downtime_min"]
            
        # Validation
        required_db_cols = {"part_number", "run_time_min", "good_count"}
        missing = required_db_cols - set(df.columns)
        if missing:
             print(f"CRITICAL ERROR: Missing columns: {missing}")
             return
             
        print("Validation Passed. Simulating Row Insertion...")
        entries = []
        for i, row in df.iterrows():
            try:
                # Type safe access
                entry = {
                    "date": row['date'],
                    "operator": str(row.get('operator', 'Unknown')),
                    "machine": str(row.get('machine', 'Unknown')),
                    "part_number": str(row.get('part_number', 'Unknown')),
                    "job": str(row.get('job', '')),
                    "run_time_min": float(row.get('run_time_min', 0)),
                    "good_count": int(row.get('good_count', 0))
                }
                # print(f"Row {i} parsed OK: {entry['part_number']}")
            except Exception as e:
                print(f"Row {i} FAILED: {e}")
                
        print("DEBUG SUCCESS! Logic seems valid.")
        
    except Exception as emain:
        print(f"Top Level Error: {emain}")

if __name__ == "__main__":
    run_debug()
