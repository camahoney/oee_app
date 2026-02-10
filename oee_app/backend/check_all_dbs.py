import sqlite3
import os

def check_db(filename):
    if not os.path.exists(filename):
        print(f"--- {filename} NOT FOUND ---")
        return

    print(f"--- Checking {filename} ---")
    try:
        conn = sqlite3.connect(filename)
        cursor = conn.cursor()
        
        # Check Tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [t[0] for t in cursor.fetchall()]
        print(f"Tables: {tables}")
        
        if 'productionreport' in tables:
            cursor.execute("SELECT count(*) FROM productionreport")
            print(f"ProductionReports: {cursor.fetchone()[0]}")
            
        if 'oeemetric' in tables:
            cursor.execute("SELECT count(*) FROM oeemetric")
            print(f"OEE Metrics: {cursor.fetchone()[0]}")

        conn.close()
    except Exception as e:
        print(f"Error reading {filename}: {e}")

if __name__ == "__main__":
    check_db('oee_app.db')
    check_db('oee_database.db')
    check_db('oee_app_v5.db')
