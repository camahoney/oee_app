from sqlmodel import Session, select, create_engine, text
from app.db import ReportEntry, ProductionReport
from app.database import engine
import datetime

def test_db_write():
    print("Testing DB Connection and Schema...")
    try:
        with Session(engine) as session:
            # 1. Check if column exists via SQL
            print("Checking column existence specifically...")
            try:
                session.exec(text("SELECT downtime_events FROM reportentry LIMIT 1"))
                print("Column 'downtime_events' exists in 'reportentry'.")
            except Exception as e:
                print(f"CRITICAL: Column 'downtime_events' MISSING. Error: {e}")
                return

            # 2. Try to insert a dummy report and entry
            print("Attempting to insert test record...")
            rep = ProductionReport(filename="debug_test.xlsx", uploaded_by=1, uploaded_at=datetime.datetime.utcnow())
            session.add(rep)
            session.commit()
            session.refresh(rep)
            print(f"Created Test Report ID: {rep.id}")

            entry = ReportEntry(
                report_id=rep.id,
                date=datetime.date.today(),
                operator="Debug Bot",
                machine="Test Station",
                shift="1",
                downtime_events='[{"reason": "Test", "minutes": 5}]',
                downtime_min=5.0
            )
            session.add(entry)
            session.commit()
            print("Successfully inserted ReportEntry with downtime_events.")
            
            # Clean up
            session.delete(entry)
            session.delete(rep)
            session.commit()
            print("Cleanup successful.")

    except Exception as e:
        print(f"DB Write Failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_db_write()
