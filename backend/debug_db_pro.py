from sqlmodel import Session, select, create_engine, text
from app.db import User
from app.database import engine

def verify_db():
    print("Connecting to DB...")
    with Session(engine) as session:
        # 1. Check Schema (SQLite specific pragma)
        try:
            print("Checking schema for table 'user'...")
            columns = session.exec(text("PRAGMA table_info(user)")).all()
            col_names = [c[1] for c in columns]
            print(f"Columns: {col_names}")
            if "is_pro" not in col_names:
                print("FAIL: 'is_pro' column missing!")
                return
            else:
                print("PASS: 'is_pro' column exists.")
        except Exception as e:
            print(f"Schema check error: {e}")

        # 2. Check Data
        print("Checking User Data...")
        users = session.exec(select(User)).all()
        for u in users:
            print(f"User: {u.email}, Role: {u.role}, Pro: {u.is_pro}")
            
        # 3. Test Update
        admin = session.exec(select(User).where(User.role == "admin")).first()
        if admin:
            print(f"Testing update on {admin.email}...")
            original_status = admin.is_pro
            new_status = not original_status
            
            admin.is_pro = new_status
            session.add(admin)
            session.commit()
            session.refresh(admin)
            
            print(f"Updated {admin.email} is_pro to {admin.is_pro}")
            
            # Verify persistence
            session.expunge(admin)
            refetched = session.exec(select(User).where(User.id == admin.id)).first()
            if refetched.is_pro == new_status:
                 print("PASS: Data update persisted.")
                 # Revert
                 refetched.is_pro = original_status
                 session.add(refetched)
                 session.commit()
                 print("Reverted change.")
            else:
                 print("FAIL: Data update did NOT persist.")

if __name__ == "__main__":
    verify_db()
