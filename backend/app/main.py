from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select
from .database import create_db_and_tables, engine
from .db import RateEntry, User
from .seeds import get_seed_rates, get_seed_users

from .routers import rates, reports, metrics, auth, settings, analytics, weekly

app = FastAPI(title="OEE Analytics API", version="0.1.0")

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

    # Schema Migration Check for "User" (is_pro)
    try:
        insp = inspect(engine)
        if insp.has_table("user"):
            cols = [c["name"] for c in insp.get_columns("user")]
            if "is_pro" not in cols:
                print("Migrating User: Adding 'is_pro'...")
                with Session(engine) as session:
                    session.exec(text("ALTER TABLE \"user\" ADD COLUMN is_pro BOOLEAN DEFAULT 0"))
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

    create_db_and_tables()

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

@app.post("/debug-upload")
async def debug_upload(file: UploadFile = File(...)):
    """Debug endpoint: tries the full upload pipeline and returns the exact error."""
    import traceback
    from fastapi import UploadFile, File
    try:
        contents = file.file.read()
        info = {
            "filename": file.filename,
            "content_type": file.content_type,
            "size_bytes": len(contents),
            "first_100_chars": contents[:100].decode("utf-8", errors="replace"),
        }
        
        # Try parsing
        import pandas as pd
        import io
        if file.filename and file.filename.lower().endswith('.csv'):
            try:
                df = pd.read_csv(io.BytesIO(contents), encoding='utf-8-sig')
            except UnicodeDecodeError:
                df = pd.read_csv(io.BytesIO(contents), encoding='cp1252')
        else:
            df = pd.read_excel(io.BytesIO(contents))
        
        info["columns"] = df.columns.tolist()
        info["shape"] = list(df.shape)
        info["dtypes"] = {col: str(dtype) for col, dtype in df.dtypes.items()}
        info["head"] = df.head(3).to_dict(orient="records")
        info["status"] = "PARSE_OK"
        
        return info
    except Exception as e:
        return {
            "status": "ERROR",
            "error_type": type(e).__name__,
            "error_message": str(e),
            "traceback": traceback.format_exc()
        }
