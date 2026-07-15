import random
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))
from app.database import get_connection

def fix_all_reviewers():
    conn = get_connection()
    
    print("Fixing all reviewer names...")
    # Fetch all distinct reviewers starting with 'Reviewer_'
    revs = conn.execute("SELECT DISTINCT reviewer_name FROM historical_pa WHERE reviewer_name LIKE 'Reviewer_%'").fetchall()
    
    names = [
        "Sarah Collins", "Michael Torres", "Emily Johnson", "David Chen", 
        "Amanda Foster", "James Wilson", "Robert Taylor", "Maria Garcia", 
        "William Smith", "Jessica Brown", "Thomas Anderson", "Laura Martinez",
        "Christopher Lee", "Daniel Robinson", "Patricia Clark", "Matthew Lewis",
        "Elizabeth Walker", "Anthony Hall", "Jennifer Young", "Kevin Allen",
        "Brian Scott", "Megan Green", "Jason Adams", "Lauren Baker",
        "Justin Gonzalez", "Rachel Nelson", "Ryan Carter", "Stephanie Mitchell",
        "Eric Perez", "Michelle Roberts", "Nicholas Turner", "Samantha Phillips",
        "Benjamin Campbell", "Ashley Parker", "Tyler Evans", "Brittany Edwards",
        "Brandon Collins", "Kayla Stewart", "Samuel Sanchez", "Allison Morris"
    ]
    
    for r in revs:
        old_name = r[0]
        # Assign a random name that hasn't been used, or just pop
        new_name = names.pop(0) if names else f"Nurse {random.randint(100, 999)}"
        conn.execute("UPDATE historical_pa SET reviewer_name = ? WHERE reviewer_name = ?", [new_name, old_name])
        
    print(f"Fixed {len(revs)} reviewers successfully!")

if __name__ == "__main__":
    fix_all_reviewers()
