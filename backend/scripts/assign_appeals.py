import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))
from app.database import get_connection

def assign_appeals_to_nurses():
    conn = get_connection()
    
    # Get all nurse IDs
    nurses = conn.execute("SELECT id FROM users WHERE role = 'NURSE'").fetchall()
    nurse_ids = [n[0] for n in nurses]
    
    if not nurse_ids:
        print("No nurses found.")
        return
        
    # Get all appeal IDs
    appeals = conn.execute("SELECT id FROM appeal_intake_cases").fetchall()
    
    if not appeals:
        print("No appeals found.")
        return
        
    # Assign each appeal to a random nurse (or just a subset)
    import random
    assigned = 0
    
    for (appeal_id,) in appeals:
        # Give it a 30% chance to be assigned to a nurse for review
        if random.random() < 0.3:
            nurse_id = random.choice(nurse_ids)
            conn.execute("UPDATE appeal_intake_cases SET reviewer_assigned = ? WHERE id = ?", [nurse_id, appeal_id])
            assigned += 1
            
    print(f"Assigned {assigned} appeals to nurses for review.")

if __name__ == "__main__":
    assign_appeals_to_nurses()
