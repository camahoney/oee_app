from sqlmodel import Session, select
from app.db import Oeemetric
from app.database import engine
import random

def patch_shifts():
    with Session(engine) as session:
        metrics = session.exec(select(Oeemetric)).all()
        patched_count = 0
        for m in metrics:
            if not m.shift or m.shift.strip() == "" or m.shift == "nan":
                m.shift = str(random.choice([1, 2, 3]))
                session.add(m)
                patched_count += 1
        session.commit()
        print(f"Patched {patched_count} metrics with random shifts.")

if __name__ == "__main__":
    patch_shifts()
