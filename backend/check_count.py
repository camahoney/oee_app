import sqlite3
import os

def check():
    db_file = 'oee_app.db'
    if not os.path.exists(db_file):
        print(f"Error: {db_file} not found")
        return

    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()
    cursor.execute("SELECT count(*) FROM productionreport")
    count = cursor.fetchone()[0]
    print(f"Rows in productionreport: {count}")
    
    cursor.execute("SELECT id, filename FROM productionreport ORDER BY uploaded_at DESC LIMIT 1")
    last = cursor.fetchone()
    print(f"Latest Report: {last}")
    conn.close()

if __name__ == "__main__":
    check()
