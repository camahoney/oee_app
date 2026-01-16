from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select
from .database import create_db_and_tables, engine
from .db import RateEntry
from .seeds import get_seed_rates

from .routers import rates, reports, metrics, auth, settings, analytics

app = FastAPI(title="OEE Analytics API", version="0.1.0")

@app.on_event("startup")
def on_startup():
    create_db_and_tables()
    # Seed data if empty
    with Session(engine) as session:
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

@app.get("/health")
async def health_check():
    return {"status": "ok"}
