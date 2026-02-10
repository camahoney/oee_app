import os
from pathlib import Path
from sqlmodel import SQLModel, create_engine, Session

# Robust Path Handling: Ensure DB file is always in `backend/` folder
# independant of where the command is run from.
BASE_DIR = Path(__file__).resolve().parent.parent
sqlite_file_name = BASE_DIR / "oee_app.db"

# Check for DATABASE_URL env var (assigned by Render/Cloud)
# Fallback to local SQLite with Absolute Path
database_url = os.getenv("DATABASE_URL", f"sqlite:///{sqlite_file_name}")

# Fix for Render/Heroku using "postgres://" instead of "postgresql://"
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

connect_args = {}
if database_url.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(database_url, echo=False, connect_args=connect_args)

def create_db_and_tables():
    """Create database tables based on SQLModel models."""
    SQLModel.metadata.create_all(engine)

def get_session() -> Session:
    """Provide a new database session."""
    with Session(engine) as session:
        yield session
