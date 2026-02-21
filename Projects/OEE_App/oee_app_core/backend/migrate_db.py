from sqlmodel import Session, create_engine, text
from sqlalchemy import inspect
from app.database import engine

def add_column(table_name, col_name, col_type):
    insp = inspect(engine)
    if insp.has_table(table_name):
        cols = [c["name"] for c in insp.get_columns(table_name)]
        print(f"Checking {table_name}: Found {cols}")
        if col_name not in cols:
            print(f"Adding '{col_name}' to '{table_name}'...")
            with Session(engine) as session:
                try:
                    session.exec(text(f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_type}"))
                    session.commit()
                    print(f"Added {col_name} successfully.")
                except Exception as e:
                    print(f"Failed to add {col_name}: {e}")
        else:
            print(f"'{col_name}' already exists in '{table_name}'.")
    else:
        print(f"Table '{table_name}' not found!")

def migrate():
    print("Starting manual migration...")
    # existing check for user.is_pro
    add_column("user", "is_pro", "BOOLEAN DEFAULT 0")
    
    # New columns for v1.x features
    add_column("reportentry", "downtime_events", "TEXT")
    add_column("oeemetric", "diagnostics_json", "TEXT")
    add_column("rateentry", "cavity_count", "INTEGER DEFAULT 1")
    add_column("rateentry", "entry_mode", "TEXT DEFAULT 'seconds'")
    add_column("rateentry", "machine_cycle_time", "FLOAT")

if __name__ == "__main__":
    migrate()
