from sqlmodel import Session, select, create_engine, text
from app.db import ProductionReport, ReportEntry, RateEntry
from app.database import engine

def check_db():
    print(f"Checking DB: {engine.url}")
    try:
        with Session(engine) as session:
            # Check Tables
            try:
                # Use SQLModel inspection or just select
                reports = session.exec(select(ProductionReport).order_by(ProductionReport.uploaded_at.desc())).all()
                print(f"Total Reports: {len(reports)}")
                
                if reports:
                    latest = reports[0]
                    print(f"Latest Report: ID={latest.id} File={latest.filename} Time={latest.uploaded_at}")
                    
                    entries = session.exec(select(ReportEntry).where(ReportEntry.report_id == latest.id)).all()
                    print(f"Entries for Latest: {len(entries)}")
                    
                    if entries:
                        print(f"Sample Entry: {entries[0]}")
                    else:
                        print("!!! LATEST REPORT HAS NO ENTRIES !!!")
                        print("This suggests Save logic in reports.py failed silently.")
                else:
                    print("No reports found.")
                    
            except Exception as e:
                print(f"Error querying data: {e}")
                # Check table existence via brute force
                try:
                    session.exec(text("SELECT * FROM productionreport limit 1"))
                    print("Table productionreport EXISTS.")
                except Exception as e2:
                    print(f"Table productionreport DOES NOT EXIST? {e2}")

    except Exception as e:
        print(f"Connection Error: {e}")

if __name__ == "__main__":
    check_db()
