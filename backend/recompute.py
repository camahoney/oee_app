from sqlmodel import Session, select
from app.database import engine
from app.db import ProductionReport
from app.routers.metrics import calculate_metrics

def recompute():
    with Session(engine) as session:
        # Get latest report
        report = session.exec(select(ProductionReport).order_by(ProductionReport.uploaded_at.desc())).first()
        if not report:
            print("No reports found.")
            return

        print(f"Re-calculating metrics for Report ID: {report.id}...")
        try:
            result = calculate_metrics(report.id, session)
            print("Success!", result)
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    recompute()
