from sqlmodel import Session, select, create_engine
from datetime import date
import json
import sys
import os

# Add parent directory to path to import app modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.db import Oeemetric
from app.database import engine

def check_metrics():
    with Session(engine) as session:
        # Get today's metrics
        today = date.today()
        statement = select(Oeemetric).where(Oeemetric.date == today)
        results = session.exec(statement).all()
        
        print(f"Found {len(results)} metrics for today ({today}):")
        for m in results:
            print(f"\nMachine: {m.machine}")
            print(f"Downtime (min): {m.downtime_min}")
            if m.diagnostics_json:
                try:
                    diag = json.loads(m.diagnostics_json)
                    events = diag.get("downtime_events", [])
                    print(f"Events: {json.dumps(events, indent=2)}")
                except json.JSONDecodeError:
                    print(f"Invalid JSON: {m.diagnostics_json}")
            else:
                print("No diagnostics JSON")

if __name__ == "__main__":
    check_metrics()
