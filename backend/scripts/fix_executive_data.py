import random
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))
from app.database import get_connection

def fix_executive_data():
    conn = get_connection()
    
    print("Fixing turnaround times (under 7 hours)...")
    # Generate random numbers directly via python to update duckdb easily
    # But since there are 1000 rows, it's easiest to do an UPDATE with RANDOM()
    conn.execute("""
        UPDATE historical_pa 
        SET turnaround_hours = ROUND(1.0 + (RANDOM() * 6.0), 1)
    """)
    
    print("Fixing reviewer names...")
    names = [
        "Sarah Collins", "Michael Torres", "Emily Johnson", "David Chen", 
        "Amanda Foster", "James Wilson", "Robert Taylor", "Maria Garcia", 
        "William Smith", "Jessica Brown", "Thomas Anderson", "Laura Martinez",
        "Christopher Lee", "Daniel Robinson", "Patricia Clark", "Matthew Lewis",
        "Elizabeth Walker", "Anthony Hall", "Jennifer Young", "Kevin Allen"
    ]
    
    for i, name in enumerate(names, 1):
        reviewer_id = f"Reviewer_{i}"
        conn.execute("UPDATE historical_pa SET reviewer_name = ? WHERE reviewer_name = ?", [name, reviewer_id])
        
    print("Data fixes applied successfully!")

if __name__ == "__main__":
    fix_executive_data()
