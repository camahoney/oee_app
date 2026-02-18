import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from fastapi.testclient import TestClient


from sqlmodel import Session, select
from app.main import app
from app.database import get_session, engine
from app.db import RunMode, RateEntry, ReportEntry

client = TestClient(app)

def test_list_run_modes():
    response = client.get("/rates/run-modes")
    if response.status_code != 200:
        print(f"FAILED: Status {response.status_code}")
        print(f"Body: {response.text}")
    assert response.status_code == 200

    data = response.json()
    assert len(data) >= 4
    names = [rm['name'] for rm in data]
    assert "STANDARD" in names
    assert "COMBO_1OP_2PRESS" in names

def test_create_rate_with_run_mode():
    # 1. Create a Rate with a specific Run Mode
    payload = {
        "job": "TEST-RM-001",
        "part_number": "RM-PART-123",
        "machine": "PRESS-01",
        "active": True,
        "entry_mode": "seconds",
        "ideal_cycle_time_seconds": 10.5,
        "ideal_units_per_hour": 342.86, # 3600 / 10.5
        "cavity_count": 4,
        "run_mode_id": 2, # COMBO_1OP_2PRESS
        "start_date": "2023-01-01",
        "notes": "Test Run Mode Rate"
    }


    try:
        response = client.post("/rates/", json=payload)
        if response.status_code != 201:
            print(f"FAILED create_rate: {response.status_code}")
            print(f"Response: {response.text}")
        assert response.status_code == 201
        rate = response.json()
    except Exception as e:
        print(f"CRASHED create_rate: {e}")
        import traceback
        with open("exception.txt", "w") as f:
            f.write(str(e))
            f.write("\n")
            traceback.print_exc(file=f)
        raise



    assert rate["run_mode_id"] == 2
    assert rate["part_number"] == "RM-PART-123"

def test_rate_fallback_logic():
    # Setup: 
    # Rate A: Standard (ID 1) -> 20s
    # Rate B: Combo (ID 2) -> 30s
    
    # We need to manually insert these to be sure, or use endpoints.
    # Let's use endpoints.
    
    # 1. Standard Rate
    client.post("/rates/", json={
        "job": "FALLBACK-TEST",
        "part_number": "FALLBACK-PART",
        "machine": "PRESS-FB",
        "active": True,
        "entry_mode": "seconds",
        "ideal_cycle_time_seconds": 20.0,
        "ideal_units_per_hour": 180.0,
        "cavity_count": 1,
        "run_mode_id": 1,
        "start_date": "2023-01-01"
    })
    
    # 2. Combo Rate
    client.post("/rates/", json={
        "job": "FALLBACK-TEST",
        "part_number": "FALLBACK-PART",
        "machine": "PRESS-FB",
        "active": True,
        "entry_mode": "seconds",
        "ideal_cycle_time_seconds": 30.0,
        "ideal_units_per_hour": 120.0,
        "cavity_count": 1,
        "run_mode_id": 2,
        "start_date": "2023-01-01"
    })


    
    # 3. Create a Report Entry with run_mode_id = 2
    # We need to mock the full report creation flow or import the logic directly.
    # Importing logic is easier for unit testing the logic function.
    
    # 3. Verify Logic with match_rate_candidate
    from app.routers.metrics import match_rate_candidate
    from datetime import datetime
    
    # Let's verify data existence via API first.
    rates = client.get("/rates/").json()
    my_rates = [r for r in rates if r['part_number'] == 'FALLBACK-PART']
    assert len(my_rates) >= 2
    
    candidates = []
    for r in my_rates:
        # Pydantic model requires correct types. API returns strings for dates.
        # We need to parse it if we manually create the model.
        if isinstance(r.get('start_date'), str):
             r['start_date'] = datetime.strptime(r['start_date'], "%Y-%m-%d").date()
        
        # Also clean up IDs or other fields if strictly required, but for this test optional fields are fine.
        candidates.append(RateEntry(**r))
        
    print(f"Testing with {len(candidates)} candidates")
    
    # A. Target Mode 2 (Combo), Correct Machine
    match = match_rate_candidate(candidates, target_mode=2, target_machine_norm="press-fb")
    assert match is not None
    assert match.run_mode_id == 2
    
    # B. Target Mode 1 (Standard), Correct Machine
    match = match_rate_candidate(candidates, target_mode=1, target_machine_norm="press-fb")
    assert match is not None
    assert match.run_mode_id == 1
    
    # C. Target Mode 3 (Unknown), Correct Machine
    match = match_rate_candidate(candidates, target_mode=3, target_machine_norm="press-fb")
    assert match is None
    
    # D. Target Mode 2, Wrong Machine (Non-Strict) -> Should fuzzy match
    match = match_rate_candidate(candidates, target_mode=2, target_machine_norm="wrong-machine")
    assert match is not None
    assert match.run_mode_id == 2

    # E. Target Mode 2, Wrong Machine (Strict) -> Should NOT match
    match = match_rate_candidate(candidates, target_mode=2, target_machine_norm="wrong-machine", strict_machine=True)
    assert match is None



if __name__ == "__main__":
    try:
        print("Starting test_list_run_modes...")
        test_list_run_modes()
        print("test_list_run_modes PASSED")
        
        print("Starting test_create_rate_with_run_mode...")
        test_create_rate_with_run_mode()
        print("test_create_rate_with_run_mode PASSED")
        
        print("Starting test_rate_fallback_logic...")
        test_rate_fallback_logic()
        print("test_rate_fallback_logic PASSED")
        
        print("ALL TESTS PASSED")
    except AssertionError as e:
        import traceback
        traceback.print_exc()
        print(f"TEST FAILED: {e}")
        exit(1)
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"ERROR: {e}")
        exit(1)


