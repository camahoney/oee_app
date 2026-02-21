import sqlite3
import os

db_path = "oee_app.db"
# Check if file exists
db_path = "backend/oee_app.db"
# Check if file exists
if not os.path.exists(db_path):
    if os.path.exists("oee_app.db"):
        db_path = "oee_app.db"


print(f"Checking DB: {db_path}")
conn = sqlite3.connect(db_path)
cursor = conn.cursor()
try:
    cursor.execute("PRAGMA table_info(rateentry)")
    columns = cursor.fetchall()
    print("cid | name | type | notnull | dflt_value | pk")
    for col in columns:
        print(col)
except Exception as e:
    print(e)
conn.close()
