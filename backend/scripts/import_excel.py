import os
import sys
import uuid
import json
import pandas as pd
import duckdb
from datetime import datetime

# Add backend dir to PYTHONPATH to allow absolute imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import get_connection
from app.agents.case_assignment_agent import assign_single_case

EXCEL_PATH = r"D:\AI Nurse QA & Audit\Audit_POC Data\Healthcare_Patient_Journey_Enhanced_100_With_Vitals.xlsx"

def main():
    print(f"Reading Excel from: {EXCEL_PATH}")
    df = pd.read_excel(EXCEL_PATH)
    
    try:
        conn = get_connection()
    except Exception as e:
        print(f"FAILED TO CONNECT TO DB: {e}")
        print("Please ensure the Uvicorn server is STOPPED before running this script.")
        return

    print(f"Connected to DB. Found {len(df)} rows.")
    
    # Map for structured_case JSON
    structured_keys = [
        "Clinical Notes", "Lab Result Summary", "Prior Auth Notes", 
        "Discharge Summary", "Claim Data Summary", "Nurse Review Notes", "Vitals Summary",
        "Claim Status", "Appeal ID", "Appeal Notes"
    ]
    
    cases_inserted = 0
    assigned_count = 0
    
    for idx, row in df.iterrows():
        case_id = str(uuid.uuid4())
        # We generate a unique case number. Or use a sequence.
        count = conn.execute("SELECT COUNT(*) FROM cases").fetchone()[0]
        case_number = f"CASE-EXC-{datetime.now().year}-{str(count + 1).zfill(4)}"
        
        patient_mrn = str(row.get("Patient ID", f"UNK-{idx}"))
        patient_name = str(row.get("Patient Name", "Unknown Patient"))
        primary_diagnosis = str(row.get("Diagnosis", "Unknown"))
        
        # Build structured JSON
        structured_case = {}
        for key in structured_keys:
            val = row.get(key)
            if pd.notna(val):
                structured_case[key] = str(val)
                
        # Insert case
        conn.execute("""
            INSERT INTO cases (id, case_number, patient_mrn, patient_name, patient_dob, patient_age,
                              primary_diagnosis_code, primary_diagnosis_display, secondary_diagnoses,
                              document_type, structured_case, status, submitted_at, submitted_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_REVIEW', CURRENT_TIMESTAMP, NULL)
        """, [
            case_id, case_number, patient_mrn, patient_name, "1970-01-01", 50,
            "A00", primary_diagnosis, None, "EXCEL_IMPORT",
            json.dumps(structured_case)
        ])
        cases_inserted += 1
        
        assigned_nurse = assign_single_case(case_id, conn)
        if assigned_nurse:
            # We don't need to do the UPDATE manually because assign_single_case ALREADY does the UPDATE!
            assigned_count += 1
            
    print(f"Successfully inserted {cases_inserted} cases.")
    print(f"Successfully assigned {assigned_count} cases to nurses.")
    
    # Let's show current nurse distribution
    dist = conn.execute("""
        SELECT u.full_name, COUNT(c.id) 
        FROM users u 
        LEFT JOIN cases c ON c.submitted_by = u.id 
        WHERE u.role = 'NURSE' 
        GROUP BY u.full_name 
        ORDER BY COUNT(c.id) DESC
    """).fetchall()
    
    print("\nCurrent Nurse Workload:")
    for name, cnt in dist:
        print(f"  {name}: {cnt} cases")

if __name__ == "__main__":
    main()
