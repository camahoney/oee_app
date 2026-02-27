from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select
from .database import create_db_and_tables, engine
from .db import RateEntry, User, RunMode, AuditLog
from .seeds import get_seed_rates, get_seed_users

from .routers import rates, reports, metrics, auth, settings, analytics, weekly

import os
app = FastAPI(title="OEE Analytics API", version="1.1.5")
SECRET_KEY = os.environ.get("SECRET_KEY", "supersecretkey-dev-only")

@app.on_event("startup")
def on_startup():
    # Schema Migration Check for "job" column
    from sqlalchemy import inspect, text
    try:
        insp = inspect(engine)
        if insp.has_table("reportentry"):
            cols = [c["name"] for c in insp.get_columns("reportentry")]
            if "job" not in cols:
                print("DETECTED OLD SCHEMA (Missing 'job'). Dropping tables to rebuild...")
                with Session(engine) as session:
                    # Drop in dependency order (metrics -> entries -> reports) usually,
                    # but sqlite foreign keys might be off or cascading.
                    # Safest to just hammer them.
                    session.exec(text("DROP TABLE IF EXISTS oeemetric"))
                    session.exec(text("DROP TABLE IF EXISTS reportentry"))
                    session.exec(text("DROP TABLE IF EXISTS productionreport"))
                    session.commit()
                print("Tables dropped. Re-creating...")
    except Exception as e:
        print(f"Migration check failed: {e}")

    # Schema Migration Check for "RateEntry" (Cavity Count / Entry Mode)
    try:
        print("STARTUP: Checking Schema for Cavity Columns...")
        insp = inspect(engine)
        if insp.has_table("rateentry"):
            cols = [c["name"] for c in insp.get_columns("rateentry")]
            with Session(engine) as session:
                if "cavity_count" not in cols:
                    print("Migrating RateEntry: Adding 'cavity_count'...")
                    session.exec(text("ALTER TABLE rateentry ADD COLUMN cavity_count INTEGER DEFAULT 1"))
                    session.commit()
                if "entry_mode" not in cols:
                    print("Migrating RateEntry: Adding 'entry_mode'...")
                    session.exec(text("ALTER TABLE rateentry ADD COLUMN entry_mode VARCHAR DEFAULT 'seconds'"))
                    session.commit()
                if "machine_cycle_time" not in cols:
                    print("Migrating RateEntry: Adding 'machine_cycle_time'...")
                    session.exec(text("ALTER TABLE rateentry ADD COLUMN machine_cycle_time FLOAT"))
                    session.commit()
    except Exception as e:
        print(f"RateEntry Migration check failed: {e}")

    # Schema Migration Check for "User" (is_pro, role, shift_scope)
    try:
        insp = inspect(engine)
        if insp.has_table("user"):
            cols = [c["name"] for c in insp.get_columns("user")]
            with Session(engine) as session:
                if "is_pro" not in cols:
                    print("Migrating User: Adding 'is_pro'...")
                    session.exec(text("ALTER TABLE \"user\" ADD COLUMN is_pro BOOLEAN DEFAULT 0"))
                    session.commit()
                if "role" not in cols:
                    print("Migrating User: Adding 'role'...")
                    session.exec(text("ALTER TABLE \"user\" ADD COLUMN role VARCHAR DEFAULT 'viewer'"))
                    session.commit()
                if "shift_scope" not in cols:
                    print("Migrating User: Adding 'shift_scope'...")
                    session.exec(text("ALTER TABLE \"user\" ADD COLUMN shift_scope VARCHAR"))
                    session.commit()
    except Exception as e:
        print(f"User Migration check failed: {e}")

    # Schema Migration Check for "ReportEntry" (downtime_events)
    try:
        insp = inspect(engine)
        if insp.has_table("reportentry"):
            cols = [c["name"] for c in insp.get_columns("reportentry")]
            if "downtime_events" not in cols:
                print("Migrating ReportEntry: Adding 'downtime_events'...")
                with Session(engine) as session:
                    # SQLite TEXT fits JSON string
                    session.exec(text("ALTER TABLE reportentry ADD COLUMN downtime_events TEXT"))
                    session.commit()
    except Exception as e:
        print(f"ReportEntry Migration check failed: {e}")

    # Schema Migration Check for "OeeMetric" (diagnostics_json)
    try:
        insp = inspect(engine)
        if insp.has_table("oeemetric"):
            cols = [c["name"] for c in insp.get_columns("oeemetric")]
            if "diagnostics_json" not in cols:
                print("Migrating OeeMetric: Adding 'diagnostics_json'...")
                with Session(engine) as session:
                    session.exec(text("ALTER TABLE oeemetric ADD COLUMN diagnostics_json TEXT"))
                    session.commit()
    except Exception as e:
        print(f"OeeMetric Migration check failed: {e}")

    # Schema Migration Check for "RunMode" (Table and Columns)
    try:
        insp = inspect(engine)
        
        # 0. Ensure Tables Exist (SQLModel's create_all handles dialects provided)
        # This will create 'runmode' table if missing.
        create_db_and_tables()

        # 1. Ensure Data Exists (Idempotent Seed)
        with Session(engine) as session:
            # Check for STANDARD mode by Name first
            std_mode = session.exec(select(RunMode).where(RunMode.name == "STANDARD")).first()
            if not std_mode:
                 # Insert Standard Mode. We want it to be likely ID 1 if possible, but mainly it must exist.
                 # If we are the first insert into a new table, it will be 1 (or close).
                 # If we really needed ID 1, we could try force it: session.add(RunMode(id=1, ...))
                 # But postgres SERIAL logic might not like explicit ID insert unless properly handled.
                 # Let's trust standard insert order for an empty table.
                 print("Seeding RunMode: STANDARD")
                 session.add(RunMode(name="STANDARD", description="Standard Operation", active=True))
                 
            # Check other modes
            modes = [
                {"name": "COMBO_1OP_2PRESS", "description": "1 Operator running 2 Presses"},
                {"name": "COMBO_1OP_3PRESS", "description": "1 Operator running 3 Presses"},
                {"name": "TEAM_2OP_4MOLDS", "description": "2 Operators running 4 Molds"},
            ]
            for m in modes:
                if not session.exec(select(RunMode).where(RunMode.name == m["name"])).first():
                    session.add(RunMode(**m))
            session.commit()
            
            # Re-fetch Standard Mode to get its ID for the Default Value
            std_mode = session.exec(select(RunMode).where(RunMode.name == "STANDARD")).first()
            std_id = std_mode.id if std_mode else 1 # Fallback to 1 if something weird happened

        # 2. Add run_mode_id to RateEntry
        if insp.has_table("rateentry"):
            cols = [c["name"] for c in insp.get_columns("rateentry")]
            if "run_mode_id" not in cols:
                print("Migrating RateEntry: Adding 'run_mode_id'...")
                with Session(engine) as session:
                    # Use std_id for default
                    session.exec(text(f"ALTER TABLE rateentry ADD COLUMN run_mode_id INTEGER DEFAULT {std_id} REFERENCES runmode(id)"))
                    session.commit()

        # 3. Add run_mode_id to ReportEntry
        if insp.has_table("reportentry"):
            cols = [c["name"] for c in insp.get_columns("reportentry")]
            if "run_mode_id" not in cols:
                print("Migrating ReportEntry: Adding 'run_mode_id'...")
                with Session(engine) as session:
                    session.exec(text(f"ALTER TABLE reportentry ADD COLUMN run_mode_id INTEGER DEFAULT {std_id} REFERENCES runmode(id)"))
                    session.commit()



    except Exception as e:
        print(f"RunMode Migration check failed: {e}")


    # Seed data if empty
    with Session(engine) as session:
        if not session.exec(select(User)).first():
            print("Seeding database with default users...")
            users = get_seed_users()
            for u in users:
                session.add(u)
            session.commit()
            print(f"User seeding complete.")
    
        if not session.exec(select(RateEntry)).first():
            print("Seeding database with default rates...")
            rates = get_seed_rates()
            for r in rates:
                session.add(r)
            session.commit()
            print(f"Seeding complete: Added {len(rates)} rates.")

# CORS (allow all for demo; tighten in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global exception handler — ensures we ALWAYS see the real error
# (Without this, unhandled exceptions return bare "Internal Server Error" without CORS headers)
from fastapi.responses import JSONResponse
from starlette.requests import Request
import traceback as tb_module

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    error_traceback = tb_module.format_exc()
    print(f"UNHANDLED EXCEPTION on {request.method} {request.url}:")
    print(error_traceback)
    return JSONResponse(
        status_code=500,
        content={
            "detail": f"Server Error: {type(exc).__name__}: {str(exc)}"
        }
    )

# Include routers
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(rates.router, prefix="/rates", tags=["rates"])
app.include_router(reports.router, prefix="/reports", tags=["reports"])
app.include_router(metrics.router, prefix="/metrics", tags=["metrics"])
app.include_router(settings.router, prefix="/settings", tags=["settings"])
app.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
app.include_router(weekly.router, prefix="/weekly", tags=["weekly"])

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.get("/")
async def root():
    return {"message": "OEE Analytics API is running. Go to /docs for Swagger UI."}

@app.get("/debug-db")
async def debug_db():
    from sqlalchemy import inspect
    insp = inspect(engine)
    tables = insp.get_table_names()
    report_cols = [c["name"] for c in insp.get_columns("reportentry")] if "reportentry" in tables else []
    metric_cols = [c["name"] for c in insp.get_columns("oeemetric")] if "oeemetric" in tables else []
    rate_cols = [c["name"] for c in insp.get_columns("rateentry")] if "rateentry" in tables else []
    
    return {
        "tables": tables,
        "reportentry_columns": report_cols,
        "oeemetric_columns": metric_cols,
        "rateentry_columns": rate_cols,
        "missing_downtime": "downtime_events" not in report_cols,
        "missing_diagnostics": "diagnostics_json" not in metric_cols
    }

@app.get("/fix-db")
async def fix_db():
    from sqlalchemy import text
    logs = []

    def run_migration(name, sql):
        try:
            # Open a NEW session for each command to isolate transactions
            with Session(engine) as session:
                session.exec(text(sql))
                session.commit()
            return f"SUCCESS: {name}"
        except Exception as e:
            err_str = str(e).lower()
            if "already exists" in err_str or "duplicate column" in err_str:
                return f"SKIPPED: {name} (Already exists)"
            return f"FAILED: {name} - {str(e)}"

    # 1. ReportEntry
    logs.append(run_migration("Add downtime_events to reportentry", "ALTER TABLE reportentry ADD COLUMN downtime_events TEXT"))

    # 2. OeeMetric
    logs.append(run_migration("Add diagnostics_json to oeemetric", "ALTER TABLE oeemetric ADD COLUMN diagnostics_json TEXT"))

    # 3. RateEntry
    logs.append(run_migration("Add cavity_count to rateentry", "ALTER TABLE rateentry ADD COLUMN cavity_count INTEGER DEFAULT 1"))
    logs.append(run_migration("Add entry_mode to rateentry", "ALTER TABLE rateentry ADD COLUMN entry_mode VARCHAR DEFAULT 'seconds'"))
    logs.append(run_migration("Add machine_cycle_time to rateentry", "ALTER TABLE rateentry ADD COLUMN machine_cycle_time FLOAT"))

    return {"status": "completed", "logs": logs}
    
@app.post("/seed-remote")
async def seed_remote(secret: str):
    if secret != SECRET_KEY:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Forbidden")
        
    from sqlmodel import Session, select
    from .db import User, RateEntry
    from .seeds import get_seed_users, get_seed_rates
    
    logs = []
    with Session(engine) as session:
        # Check users
        if not session.exec(select(User)).first():
            users = get_seed_users()
            for u in users:
                session.add(u)
            logs.append(f"Seeded {len(users)} users.")
        else:
            logs.append("Users already exist.")
            
        # Check rates
        if not session.exec(select(RateEntry)).first():
            rates = get_seed_rates()
            for r in rates:
                session.add(r)
            logs.append(f"Seeded {len(rates)} rates.")
        else:
            logs.append("Rates already exist.")
            
        session.commit()
    return {"status": "success", "logs": logs}

@app.post("/force-hash")
async def force_hash(secret: str, email: str, new_password: str):
    if secret != SECRET_KEY:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Forbidden")
        
    from sqlmodel import Session, select
    from .db import User
    from .routers.auth import get_password_hash
    
    with Session(engine) as session:
        user = session.exec(select(User).where(User.email == email)).first()
        if not user:
            return {"status": "error", "detail": "User not found"}
            
        user.hashed_password = get_password_hash(new_password)
        session.add(user)
        session.commit()
    return {"status": "success", "message": f"Password re-hashed for {email}"}

@app.post("/reset-db")
async def reset_db(secret: str):
    if secret != SECRET_KEY:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Forbidden")
        
    from sqlmodel import SQLModel, Session
    from .database import engine
    from .seeds import get_seed_users, get_seed_rates
    
    # Drop and recreate all tables
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    
    logs = ["Tables dropped and recreated."]
    
    with Session(engine) as session:
        try:
            users = get_seed_users()
            for u in users:
                session.add(u)
            session.commit()
            logs.append(f"Seeded {len(users)} users.")
        except Exception as e:
            session.rollback()
            logs.append(f"Error seeding users: {e}")
            
    return {"status": "success", "logs": logs}

@app.get("/recalculate-all")
async def recalculate_all_missing():
    """Find all reports without metrics and calculate them."""
    from sqlalchemy import func
    from .routers.metrics import calculate_report_metrics_logic
    from .db import ProductionReport, Oeemetric
    
    logs = []
    with Session(engine) as session:
        # Find report IDs that have entries but no metrics
        all_report_ids = [r.id for r in session.exec(select(ProductionReport).order_by(ProductionReport.id)).all()]
        
        reports_with_metrics = set()
        metric_report_ids = session.exec(
            select(Oeemetric.report_id).group_by(Oeemetric.report_id)
        ).all()
        for rid in metric_report_ids:
            reports_with_metrics.add(rid)
        
        missing = [rid for rid in all_report_ids if rid not in reports_with_metrics]
        
        for rid in missing:
            try:
                count, skipped, missing_rates = calculate_report_metrics_logic(rid, session)
                logs.append(f"Report {rid}: Calculated {count} metrics ({skipped} missing rates)")
            except Exception as e:
                logs.append(f"Report {rid}: FAILED - {str(e)}")
    
    return {"status": "completed", "reports_fixed": len(missing), "logs": logs}

@app.get("/debug-versions")
async def debug_versions():
    """Show installed package versions for debugging."""
    import importlib.metadata
    packages = ["fastapi", "starlette", "python-multipart", "uvicorn", "pandas", "sqlmodel", "pydantic"]
    versions = {}
    for pkg in packages:
        try:
            versions[pkg] = importlib.metadata.version(pkg)
        except Exception:
            versions[pkg] = "NOT FOUND"
    
    import sys
    versions["python"] = sys.version
    return versions

