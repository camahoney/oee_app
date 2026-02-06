from sqlmodel import Session, create_engine, text
from sqlalchemy import inspect
from app.database import engine

def migrate():
    print("Starting manual migration...")
    insp = inspect(engine)
    if insp.has_table("user"):
        cols = [c["name"] for c in insp.get_columns("user")]
        print(f"Current columns: {cols}")
        if "is_pro" not in cols:
            print("Adding 'is_pro' column...")
            with Session(engine) as session:
                try:
                    session.exec(text("ALTER TABLE user ADD COLUMN is_pro BOOLEAN DEFAULT 0"))
                    session.commit()
                    print("Migration successful.")
                except Exception as e:
                    print(f"Migration failed: {e}")
        else:
            print("'is_pro' column already exists.")
    else:
        print("User table not found!")

if __name__ == "__main__":
    migrate()
