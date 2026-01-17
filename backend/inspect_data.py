from sqlmodel import Session, select
from app.db import ReportEntry, ProductionReport
from app.database import engine

def inspect():
    with Session(engine) as session:
        # Get latest report
        report = session.exec(select(ProductionReport).order_by(ProductionReport.uploaded_at.desc())).first()
        if not report:
            print("No reports found.")
            return

        print(f"Inspecting Report ID: {report.id} ({report.filename})")
        
        entries = session.exec(select(ReportEntry).where(ReportEntry.report_id == report.id).limit(5)).all()
        for e in entries:
            print(f"ID: {e.id} | Part: {e.part_number} | Good: {e.good_count} | Reject: {e.reject_count} | Total: {e.total_count} | Run: {e.run_time_min}")

if __name__ == "__main__":
    inspect()
