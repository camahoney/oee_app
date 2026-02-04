from sqlmodel import Session, select, func
from app.db import Oeemetric
from app.database import engine
import json

def debug_analytics_data():
    print("--- Debugging Analytics Data ---")
    with Session(engine) as session:
        # 1. Total Count
        count = session.exec(select(func.count(Oeemetric.id))).one()
        print(f"Total OEE Metrics Rows: {count}")
        
        if count == 0:
            print("FAILURE: No data in Oeemetric table.")
            return

        # 2. Check Shifts
        shifts = session.exec(select(Oeemetric.shift).distinct()).all()
        print(f"Distinct Shifts Found: {shifts}")
        if not shifts or all(s is None or s == "" for s in shifts):
            print("WARNING: Shifts are empty or None!")

        # 3. Check Parts
        parts = session.exec(select(Oeemetric.part_number).distinct()).all()
        print(f"Distinct Parts Found: {len(parts)} (First 5: {parts[:5]})")
        
        # 4. Check JSON for Quality
        sample = session.exec(select(Oeemetric).limit(1)).first()
        if sample:
            print(f"Sample JSON: {sample.diagnostics_json}")
            try:
                data = json.loads(sample.diagnostics_json)
                print(f"Parsed 'good_count': {data.get('good_count')}")
            except Exception as e:
                print(f"JSON Parse Error: {e}")

if __name__ == "__main__":
    debug_analytics_data()
