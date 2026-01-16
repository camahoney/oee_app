from sqlmodel import SQLModel, create_engine, Session
from pathlib import Path

DATABASE_URL = "sqlite:///./oee_app_v4.db"

engine = create_engine(DATABASE_URL, echo=False)

def create_db_and_tables():
    """Create database tables based on SQLModel models."""
    SQLModel.metadata.create_all(engine)

def get_session() -> Session:
    """Provide a new database session."""
    with Session(engine) as session:
        yield session
