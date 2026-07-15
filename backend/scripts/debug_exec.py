import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))
from app.database import get_connection

conn = get_connection()

print("--- Turnaround Distribution ---")
ta_rows = conn.execute("""
    SELECT CASE WHEN turnaround_hours <= 2 THEN '0-2h' WHEN turnaround_hours <= 4 THEN '2-4h'
                WHEN turnaround_hours <= 6 THEN '4-6h' WHEN turnaround_hours <= 8 THEN '6-8h' ELSE '8h+' END as bucket, COUNT(*) as count
    FROM historical_pa GROUP BY bucket ORDER BY MIN(turnaround_hours)
""").fetchall()
print(ta_rows)

print("--- Reviewers ---")
revs = conn.execute("SELECT DISTINCT reviewer_name FROM historical_pa WHERE reviewer_name LIKE 'Reviewer_%'").fetchall()
print(f"Found {len(revs)} reviewers to fix: {revs[:5]}")

print("--- Diagnosis Breakdown ---")
dx_rows = conn.execute("""
    SELECT diagnosis_category, COUNT(*) as total,
            SUM(CASE WHEN determination = 'Approved' THEN 1 ELSE 0 END) as approved,
            SUM(CASE WHEN determination = 'Denied' THEN 1 ELSE 0 END) as denied,
            SUM(CASE WHEN determination = 'Partial Approval' THEN 1 ELSE 0 END) as partial,
            SUM(CASE WHEN determination = 'Modified Approval' THEN 1 ELSE 0 END) as modified
    FROM historical_pa GROUP BY diagnosis_category LIMIT 3
""").fetchall()
print(dx_rows)
