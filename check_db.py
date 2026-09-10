import sqlite3
import os

db_path = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "studyai.db"
)

print("DATABASE:", db_path)

conn = sqlite3.connect(db_path)

tables = [
    "users",
    "topics",
    "quizzes",
    "study_days"
]

for table in tables:

    print("\nTABLE:", table)

    columns = conn.execute(
        f"PRAGMA table_info({table})"
    ).fetchall()

    if not columns:
        print("TABLE DOES NOT EXIST")
    else:
        for column in columns:
            print(column[1])

conn.close()

print("\nDATABASE CHECK COMPLETE")