import os
import pandas as pd
from sqlalchemy import create_engine, inspect

# The DB connection string provided by the user
db_url = "postgresql://postgres.htkkukrjjjoxlpxxhvgn:%24Fragile1988%5E@aws-1-us-east-1.pooler.supabase.com:6543/postgres"

export_dir = 'supabase_recovery_exports'
os.makedirs(export_dir, exist_ok=True)

print("Connecting to Supabase Database...")
try:
    engine = create_engine(db_url)
    inspector = inspect(engine)
    
    tables = inspector.get_table_names()
    print(f"Found {len(tables)} tables: {tables}\n")
    
    print("Exporting data...")
    for table in tables:
        try:
            df = pd.read_sql_table(table, engine)
            csv_path = os.path.join(export_dir, f"{table}_export.csv")
            df.to_csv(csv_path, index=False)
            print(f"Exported {table}: {len(df)} rows")
        except Exception as e:
            print(f"Failed to export {table}: {str(e)}")
            
    # Generate Schema Dump
    print("\nGenerating Schema definitions...")
    with open(os.path.join(export_dir, 'schema_metadata.txt'), 'w') as f:
        for table in tables:
            f.write(f"--- TABLE: {table} ---\n")
            columns = inspector.get_columns(table)
            for col in columns:
                f.write(f"{col['name']} ({col['type']})\n")
            f.write("\n")
            
    print("\nSupabase data extraction complete.")

except Exception as e:
    print(f"Critical Error connecting to Supabase: {str(e)}")
