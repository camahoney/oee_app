import sys
import os
import json
from datetime import date
from sqlmodel import SQLModel, Session, create_engine
from app.routers.weekly import get_weekly_summary
from app.db import Oeemetric, ProductionReport

# Setup in-memory DB
engine = create_engine("sqlite:///:memory:")
SQLModel.metadata.create_all(engine)

def test_weighted_calculation():
    print("Testing Weighted Average Logic...")
    
    with Session(engine) as session:
        # Create Dummy Report
        report = ProductionReport(filename="test.csv", upload_date=date(2023, 1, 1))
        session.add(report)
        session.commit()
        session.refresh(report)
        
        # Case 1: High OEE, Low Volume
        m1 = Oeemetric(
            report_id=report.id,
            date=date(2023, 1, 1),
            shift="Day",
            operator="Op1",
            oee=1.0, # 100%
            diagnostics_json=json.dumps({"good_count": 1, "reject_count": 0, "run_time_min": 10})
        )
        
        # Case 2: Low OEE, High Volume
        m2 = Oeemetric(
            report_id=report.id,
            date=date(2023, 1, 2),
            shift="Day",
            operator="Op1",
            oee=0.5, # 50%
            diagnostics_json=json.dumps({"good_count": 1000, "reject_count": 0, "run_time_min": 500})
        )
        
        session.add(m1)
        session.add(m2)
        session.commit()
        
        # Run Calculation
        result = get_weekly_summary(
            start_date=date(2023, 1, 1),
            end_date=date(2023, 1, 7),
            shift="All",
            session=session
        )
        
        # Verify
        w_oee = result["overall"]["weighted_oee"]
        s_oee = result["overall"]["simple_oee"]
        
        print(f"Weighted OEE: {w_oee*100:.2f}%")
        print(f"Simple OEE:   {s_oee*100:.2f}%")
        
        # Expected: 
        # Weighted = (1*1 + 0.5*1000) / 1001 = 501/1001 ≈ 0.5005 (50.05%)
        # Simple = (1 + 0.5) / 2 = 0.75 (75.00%)
        
        assert abs(w_oee - 0.5005) < 0.001, f"Weighted OEE mismatch! Got {w_oee}"
        assert abs(s_oee - 0.75) < 0.001, f"Simple OEE mismatch! Got {s_oee}"
        
        print("✅ SUCCESS: Weighted calculation is correct!")

if __name__ == "__main__":
    test_weighted_calculation()
