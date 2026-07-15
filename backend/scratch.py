import duckdb
db = duckdb.connect('../data/careaudit.duckdb', read_only=True)
res = db.execute("SELECT * FROM cases WHERE id='case-018'").fetchone()
print(res)
nd = db.execute("SELECT * FROM nurse_decisions WHERE case_id='case-018'").fetchone()
print("ND:", nd)
ar = db.execute("SELECT * FROM audit_results WHERE case_id='case-018'").fetchone()
print("AR:", ar)
