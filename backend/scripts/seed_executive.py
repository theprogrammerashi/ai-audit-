import sys
import os
import random
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app.database import get_connection

def replace_reviewer_names():
    conn = get_connection()
    
    try:
        reviewers = conn.execute("SELECT DISTINCT reviewer_name FROM historical_pa WHERE reviewer_name LIKE 'Reviewer_%'").fetchall()
    except Exception as e:
        print(f"Error fetching reviewers: {e}")
        return
        
    if not reviewers:
        print("No 'Reviewer_XX' names found. Maybe already updated?")
        return
        
    qa_leads = [
        "Dr. Priya Sharma", "Dr. James Mitchell", "Dr. Lisa Chen", "Dr. Robert Davis"
    ]
    
    nurses = [
        "Sarah Collins", "Michael Torres", "Emily Johnson", "David Chen", "Amanda Foster",
        "Jennifer Walsh", "Christopher Lee", "Rebecca Martinez", "Kevin Thompson", "Patricia Anderson",
        "Brandon Wilson", "Stephanie Brown", "Andrew Taylor", "Michelle Garcia", "Daniel White",
        "Jessica Harris", "Matthew Jackson", "Ashley Thomas", "Ryan Moore", "Nicole Martin"
    ]
    
    random.seed(42) # For consistent mapping
    
    print(f"Mapping {len(reviewers)} reviewers to real names and types...")
    
    conn.execute("BEGIN TRANSACTION")
    for row in reviewers:
        old_name = row[0]
        # Randomly decide if this reviewer should map to a QA Lead (15% chance) or Nurse (85% chance)
        is_qa_lead = random.random() < 0.15
        
        if is_qa_lead:
            new_name = random.choice(qa_leads)
            new_type = "Physician Reviewer"
        else:
            new_name = random.choice(nurses)
            new_type = "RN"
            
        conn.execute("UPDATE historical_pa SET reviewer_name = ?, reviewer_type = ? WHERE reviewer_name = ?", [new_name, new_type, old_name])
    
    conn.execute("COMMIT")
    print("Reviewer names and types updated successfully.")

def run_all_seeders():
    print("=== Executive Dashboard Seeder ===")
    
    print("\n1. Loading Historical PA data...")
    import load_historical_pa
    load_historical_pa.load_historical_pa()
    
    print("\n2. Updating Reviewer Names...")
    replace_reviewer_names()
    
    print("\n3. Loading Appeals Intake...")
    import load_appeals_intake
    conn = get_connection()
    docx_path = os.path.join(os.path.dirname(__file__), "..", "..", "Audit_POC Data", "Appeals_Intake.docx")
    if not os.path.exists(docx_path):
        docx_path = r"D:\AI Nurse QA & Audit\Audit_POC Data\Appeals_Intake.docx"
    if os.path.exists(docx_path):
        cases = load_appeals_intake.parse_docx(docx_path)
        load_appeals_intake.load_appeals(conn, cases)
        print("Appeals loaded.")
    else:
        print(f"Could not find {docx_path}")
        
    print("\n4. Populating Reviewer Stats...")
    import populate_reviewer_stats
    populate_reviewer_stats.generate_stats_for_nurses()
    
    print("\n5. Assigning Appeals...")
    import assign_appeals
    assign_appeals.assign_appeals_to_nurses()
    
    print("\n6. Seeding Realistic Appeal Intake Cases...")
    import seed_appeal_intake
    seed_appeal_intake.seed_appeal_intake()
    
    print("\n=== Executive Seeding Complete ===")

if __name__ == "__main__":
    run_all_seeders()
