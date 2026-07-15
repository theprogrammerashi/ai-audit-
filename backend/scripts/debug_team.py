import json
from app.database import get_connection

def debug_db():
    conn = get_connection()
    priya = conn.execute("SELECT id FROM users WHERE email='priya.sharma@careaudit.ai'").fetchone()
    if not priya:
        print("Priya not found!")
        return
    priya_id = priya[0]
    print(f"Priya ID: {priya_id}")
    
    nurses = conn.execute("SELECT id, full_name FROM users WHERE role='NURSE' AND qa_lead_id=?", [priya_id]).fetchall()
    print(f"Assigned Nurses: {nurses}")
    
    nurse_ids = [n[0] for n in nurses]
    if not nurse_ids:
        print("No nurses assigned!")
        return
        
    placeholders = ','.join(['?']*len(nurse_ids))
    stats = conn.execute(f"SELECT rs.*, u.full_name AS name FROM reviewer_stats rs JOIN users u ON rs.reviewer_id = u.id WHERE rs.reviewer_id IN ({placeholders}) AND rs.period='30d'", nurse_ids).fetchall()
    
    print(f"Stats found: {len(stats)}")
    for s in stats:
        print(s)

if __name__ == "__main__":
    debug_db()
