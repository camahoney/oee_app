import logging
from sqlmodel import Session, select, create_engine, text
from app.db import RunMode, RateEntry, ReportEntry
from app.database import sqlite_file_name, database_url


# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def migrate():
    engine = create_engine(database_url)

    
    with Session(engine) as session:
        # 1. Create RunMode Table
        logger.info("Checking/Creating RunMode table...")
        try:
            # Check if table exists
            session.exec(text("SELECT 1 FROM runmode LIMIT 1"))
            logger.info("RunMode table exists.")
        except Exception:
            logger.info("RunMode table missing. Creating...")
            # Create table manually or relying on SQLModel metadata if we were using it for full init
            # Since we are migrating an existing DB, we use raw SQL for safety and precision
            session.exec(text("""
                CREATE TABLE IF NOT EXISTS runmode (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name VARCHAR NOT NULL UNIQUE,
                    description VARCHAR,
                    active BOOLEAN DEFAULT 1
                )
            """))
            session.commit()

        # 2. Seed Run Modes
        modes = [
            {"name": "STANDARD", "description": "Standard Operation"},
            {"name": "COMBO_1OP_2PRESS", "description": "1 Operator running 2 Presses"},
            {"name": "COMBO_1OP_3PRESS", "description": "1 Operator running 3 Presses"},
            {"name": "TEAM_2OP_4MOLDS", "description": "2 Operators running 4 Molds"},
        ]
        
        for m in modes:
            existing = session.exec(select(RunMode).where(RunMode.name == m["name"])).first()
            if not existing:
                logger.info(f"Seeding RunMode: {m['name']}")
                session.add(RunMode(**m))
        session.commit()

        # 3. Add Columns to RateEntry
        logger.info("Checking RateEntry schema...")
        try:
            session.exec(text("SELECT run_mode_id FROM rateentry LIMIT 1"))
        except Exception:
            logger.info("Adding run_mode_id to RateEntry...")
            session.exec(text("ALTER TABLE rateentry ADD COLUMN run_mode_id INTEGER DEFAULT 1 REFERENCES runmode(id)"))
            session.commit()

        # 4. Add Columns to ReportEntry
        logger.info("Checking ReportEntry schema...")
        try:
            session.exec(text("SELECT run_mode_id FROM reportentry LIMIT 1"))
        except Exception:
            logger.info("Adding run_mode_id to ReportEntry...")
            session.exec(text("ALTER TABLE reportentry ADD COLUMN run_mode_id INTEGER DEFAULT 1 REFERENCES runmode(id)"))
            session.commit()
            
        logger.info("Migration Complete.")

if __name__ == "__main__":
    migrate()
