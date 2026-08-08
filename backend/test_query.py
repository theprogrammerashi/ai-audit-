import sqlite3
c = sqlite3.connect('../data/careaudit.db')
r = c.execute("SELECT structured_case FROM cases WHERE case_number='CASE-EXC-2026-0128'").fetchone()
print(r[0] if r else 'NA')
