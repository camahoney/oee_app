import sqlite3
import os

def check():
    db_file = 'oee_app.db'
    if not os.path.exists(db_file):
        print(f"Error: {db_file} not found")
        return

    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(productionreport)")
    columns = cursor.fetchall()
    print(f"Columns in productionreport ({db_file}):")
    for col in columns:
        print(col)
    conn.close()

if __name__ == "__main__":
    check()
