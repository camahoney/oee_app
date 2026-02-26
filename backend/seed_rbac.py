import os
from sqlmodel import Session, select
from app.database import engine
from app.db import User
from app.routers.auth import get_password_hash

def seed_users():
    from app.main import on_startup
    on_startup()
    with Session(engine) as session:
        # clear existing
        users = session.exec(select(User)).all()
        for u in users:
            session.delete(u)
        session.commit()
        
        from app.routers.auth import verify_password
        default_pw = "Vibra2026!"
        hashed_pw = get_password_hash(default_pw)
        assert verify_password(default_pw, hashed_pw), "Hash verification failed!"
        
        rbac_users = [
            User(email="admin@oee.local", hashed_password=hashed_pw, role="admin", shift_scope=None, is_pro=True),
            User(email="manager@oee.local", hashed_password=hashed_pw, role="manager", shift_scope=None, is_pro=True),
            User(email="1st_shift@oee.local", hashed_password=hashed_pw, role="supervisor", shift_scope="1st Shift"),
            User(email="2nd_shift@oee.local", hashed_password=hashed_pw, role="supervisor", shift_scope="2nd Shift"),
            User(email="3rd_shift@oee.local", hashed_password=hashed_pw, role="supervisor", shift_scope="3rd Shift"),
            User(email="viewer@oee.local", hashed_password=hashed_pw, role="viewer", shift_scope=None),
        ]
        for u in rbac_users:
            session.add(u)
        session.commit()
        print("RBAC Database Seeding Completed")

if __name__ == "__main__":
    seed_users()
