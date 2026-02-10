from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime, date
from typing import Optional, List

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)
    hashed_password: str
    role: str = Field(default="analyst")  # admin or analyst
    is_pro: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class RateEntry(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    operator: Optional[str] = Field(default=None, index=True)
    machine: Optional[str] = Field(default=None, index=True)
    part_number: Optional[str] = Field(default=None, index=True)
    job: Optional[str] = Field(default=None, index=True)
    ideal_units_per_hour: Optional[float] = None
    ideal_cycle_time_seconds: Optional[float] = None
    start_date: date
    end_date: Optional[date] = None
    active: bool = Field(default=True)
    notes: Optional[str] = None
    
    # New Fields for Entry Logic
    cavity_count: int = Field(default=1) 
    entry_mode: str = Field(default="seconds") # seconds, parts_shift, heats_shift
    machine_cycle_time: Optional[float] = None # Stores raw machine cycle in seconds

    created_by: Optional[int] = Field(default=None, foreign_key="user.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_by: Optional[int] = Field(default=None, foreign_key="user.id")
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Compute ideal_cycle_time_seconds if not provided
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if self.ideal_cycle_time_seconds is None and self.ideal_units_per_hour:
            self.ideal_cycle_time_seconds = 3600.0 / self.ideal_units_per_hour

class RateAudit(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    rate_entry_id: int = Field(foreign_key="rateentry.id")
    changed_by: int = Field(foreign_key="user.id")
    changed_at: datetime = Field(default_factory=datetime.utcnow)
    field_name: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None

class ProductionReport(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    filename: str
    uploaded_by: Optional[int] = Field(default=None, foreign_key="user.id")
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)

class ReportEntry(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    report_id: int = Field(foreign_key="productionreport.id")
    date: date
    operator: Optional[str] = None
    machine: Optional[str] = None
    part_number: Optional[str] = None
    job: Optional[str] = None
    planned_production_time_min: Optional[float] = None
    run_time_min: Optional[float] = None
    downtime_min: Optional[float] = None
    total_count: Optional[int] = None
    good_count: Optional[int] = None
    reject_count: Optional[int] = None
    shift: Optional[str] = None
    raw_row_json: Optional[str] = None

class Oeemetric(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    report_id: int = Field(foreign_key="productionreport.id")
    operator: Optional[str] = None
    machine: Optional[str] = None
    part_number: Optional[str] = None
    job: Optional[str] = None
    shift: Optional[str] = None
    date: date
    availability: Optional[float] = None
    performance: Optional[float] = None
    quality: Optional[float] = None
    oee: Optional[float] = None
    confidence: Optional[str] = None
    diagnostics_json: Optional[str] = None

class Setting(SQLModel, table=True):
    key: str = Field(primary_key=True)
    value: str
    description: Optional[str] = None
