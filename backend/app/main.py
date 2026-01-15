from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import create_db_and_tables

from .routers import rates, reports, metrics, auth, settings

app = FastAPI(title="OEE Analytics API", version="0.1.0")

@app.on_event("startup")
def on_startup():
    create_db_and_tables()

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

@app.get("/health")
async def health_check():
    return {"status": "ok"}
