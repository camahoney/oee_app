import sqlite3
import pandas as pd
import os

db_path = 'backend/oee_app.db'
export_dir = 'recovery_exports'

os.makedirs(export_dir, exist_ok=True)

conn = sqlite3.connect(db_path)
tables = [row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")]

print("Exporting data...")
for table in tables:
    try:
        df = pd.read_sql_query(f"SELECT * FROM {table}", conn)
        csv_path = os.path.join(export_dir, f"{table}_export.csv")
        df.to_csv(csv_path, index=False)
        print(f"Exported {table}: {len(df)} rows")
    except Exception as e:
        print(f"Failed to export {table}: {str(e)}")

print("\nGenerating Schema Dump...")
try:
    with open(os.path.join(export_dir, 'schema_dump.sql'), 'w') as f:
        for line in conn.iterdump():
            if line.startswith('CREATE TABLE') or line.startswith('CREATE INDEX'):
                f.write(line + '\n')
    print("Schema dumped successfully.")
except Exception as e:
    print(f"Schema dump failed: {str(e)}")
    
conn.close()
