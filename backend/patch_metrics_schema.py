import sqlite3
import os

def patch():
    db_file = 'oee_app.db'
    if not os.path.exists(db_file):
        print(f"Error: {db_file} not found")
        return

    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()
    try:
        print("Adding 'job' column to oeemetric table...")
        cursor.execute("ALTER TABLE oeemetric ADD COLUMN job VARCHAR")
        conn.commit()
        print("Success! Column added.")
    except Exception as e:
        print(f"Error patching schema: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    patch()
