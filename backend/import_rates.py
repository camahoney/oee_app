import pandas as pd
from sqlmodel import Session, select, SQLModel
from datetime import date
from app.db import RateEntry
from app.database import engine, create_db_and_tables

def import_rates(file_path):
    print(f"Reading {file_path}...")
    df = pd.read_csv(file_path)
    
    # Clean column names
    df.columns = df.columns.str.strip()
    
    # Create DB if needed
    print(f"Registered tables: {SQLModel.metadata.tables.keys()}")
    try:
        create_db_and_tables()
        print("Tables created successfully.")
    except Exception as e:
        print(f"Error creating tables: {e}")
        return
    
    with Session(engine) as session:
        count = 0
        for _, row in df.iterrows():
            part_number = str(row.get('PartNumber', '')).strip()
            machine = str(row.get('Workstation', '')).strip()
            # StandardRatePPH might be ideal units per hour
            try:
                ideal_units = float(row.get('StandardRatePPH', 0))
            except:
                ideal_units = 0
                
            try:
                ideal_cycle = float(row.get('IdealCycleTimeSeconds', 0))
            except:
                ideal_cycle = 0

            # Upsert logic? For now, just insert if generic keys don't exist
            # But simpler to just add them as active rates
            rate = RateEntry(
                operator="Any", # Default since file doesn't have operator
                machine=machine,
                part_number=part_number,
                ideal_units_per_hour=ideal_units,
                ideal_cycle_time_seconds=ideal_cycle if ideal_cycle > 0 else None,
                start_date=date.today(),
                active=True,
                notes="Imported from cleaned_ProdOEE_Rates.csv"
            )
            session.add(rate)
            count += 1
        
        session.commit()
        print(f"Successfully imported {count} rate entries.")

if __name__ == "__main__":
    import_rates(r"C:\Users\cmaho\Desktop\oeemakesomethinghappen\cleaned_ProdOEE_Rates.csv")
