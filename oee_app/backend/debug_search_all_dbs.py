import glob
from sqlmodel import Session, select, create_engine
from app.db import RateEntry

def check_db(db_path, part_num):
    print(f"\nScanning Database: {db_path}")
    try:
        sqlite_url = f"sqlite:///{db_path}"
        engine = create_engine(sqlite_url)
        with Session(engine) as session:
            # Need to ensure table exists to confirm validity
            from sqlalchemy import inspect
            insp = inspect(engine)
            if not insp.has_table("rateentry"):
                print("  [SKIP] Table 'rateentry' not found.")
                return

            statement = select(RateEntry).where(RateEntry.part_number == part_num)
            results = session.exec(statement).all()
            
            if results:
                print(f"  [MATCH] Found {len(results)} entries.")
                for r in results:
                    print(f"    - ID: {r.id}, Machine: {r.machine}, Active: {r.active}, Ideal Cycle: {r.ideal_cycle_time_seconds}")
            else:
                print("  [INFO] Part not found in this DB.")
    except Exception as e:
        print(f"  [ERROR] Could not read DB: {e}")

if __name__ == "__main__":
    databases = glob.glob("*.db")
    target_part = "12987-72"
    print(f"Searching for '{target_part}' in {len(databases)} database files...")
    
    for db in databases:
        check_db(db, target_part)
