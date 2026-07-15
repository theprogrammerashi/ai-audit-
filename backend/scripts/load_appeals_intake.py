"""
CareAudit AI - Appeals Intake Loader
Parses Appeals_Intake.docx and populates the appeal_intake_cases table in DuckDB.
"""
import sys
import os
import uuid
import json
from datetime import datetime, timedelta
import random

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.database import init_database, get_connection
try:
    import docx
except ImportError:
    print("python-docx not installed. Run 'pip install python-docx'")
    sys.exit(1)

def parse_docx(file_path):
    doc = docx.Document(file_path)
    cases = []
    current_case = {}
    current_section = None
    section_text = []

    for para in doc.paragraphs:
        text = para.text.strip()
        if not text:
            continue
            
        if text.startswith("APPEAL CASE #"):
            if current_case:
                if current_section and section_text:
                    current_case[current_section] = "\n".join(section_text)
                cases.append(current_case)
            current_case = {"case_index": text}
            current_section = None
            section_text = []
            continue
            
        if text.isupper() and len(text) > 5 and not ":" in text:
            if current_section and section_text:
                current_case[current_section] = "\n".join(section_text)
            current_section = text
            section_text = []
            continue
            
        if ":" in text and current_section in ("MEMBER INFORMATION", "APPEAL INFORMATION", "PRIMARY DIAGNOSIS"):
            parts = text.split(":", 1)
            if len(parts) == 2:
                key = parts[0].strip()
                val = parts[1].strip()
                current_case[key] = val
        else:
            if current_section:
                section_text.append(text)

    if current_case:
        if current_section and section_text:
            current_case[current_section] = "\n".join(section_text)
        cases.append(current_case)

    return cases

def load_appeals(db, cases):
    random.seed(42)
    reviewers = ["usr-admin-001", "usr-exec-001"] # Medical Directors / Appeals staff
    
    # Check if table exists
    try:
        db.execute("SELECT 1 FROM appeal_intake_cases LIMIT 1")
    except:
        print("Table appeal_intake_cases does not exist. Ensure database.py is updated.")
        return

    # Clear existing
    db.execute("DELETE FROM appeal_intake_cases")

    for idx, case_data in enumerate(cases):
        appeal_id = f"app-in-{str(idx+1).zfill(3)}"
        # Mapped fields
        member_id = case_data.get("Member ID", f"M{random.randint(100000, 999999)}")
        appellant_type = case_data.get("Appeal Type", "Provider Appeal")
        
        orig_date_str = case_data.get("Original Determination Date", "03/01/2026")
        appeal_date_str = case_data.get("Appeal Submission Date", "03/15/2026")
        
        try:
            orig_date = datetime.strptime(orig_date_str, "%m/%d/%Y").strftime("%Y-%m-%d")
        except:
            orig_date = "2026-03-01"
            
        try:
            recv_date = datetime.strptime(appeal_date_str, "%m/%d/%Y").strftime("%Y-%m-%d")
        except:
            recv_date = "2026-03-15"

        appeal_level = "1st Level Provider" if "provider" in appellant_type.lower() else "1st Level Member"
        
        dx_code = case_data.get("ICD-10", "I50.9")
        if dx_code.startswith("I"): dx_cat = "Cardiovascular"
        elif dx_code.startswith("J"): dx_cat = "Respiratory"
        elif dx_code.startswith("A"): dx_cat = "Infectious Disease"
        elif dx_code.startswith("M"): dx_cat = "Musculoskeletal"
        else: dx_cat = "Other Medical"
        
        req_service = case_data.get("Service Requested", "Inpatient Hospital Admission")
        
        # Determine outcome based on some simple logic (if it has new evidence, more likely to overturn)
        has_new_evidence = "ADDITIONAL CLINICAL DOCUMENTATION" in "".join(case_data.keys())
        outcome_rand = random.random()
        if has_new_evidence:
            outcome = "Overturned" if outcome_rand < 0.7 else ("Partially Overturned" if outcome_rand < 0.85 else "Upheld")
        else:
            outcome = "Upheld" if outcome_rand < 0.6 else "Overturned"
            
        # Financial
        fin_amount = round(random.uniform(5000, 25000), 2)
        
        # Denied reason
        denial_reasons = ["Not Medically Necessary", "Experimental/Investigational", "Out of Network", "No Authorization"]
        denial_reason = "Not Medically Necessary"
        
        # Turnaround
        turnaround = random.randint(5, 28)
        try:
            res_date = (datetime.strptime(recv_date, "%Y-%m-%d") + timedelta(days=turnaround)).strftime("%Y-%m-%d")
        except:
            res_date = "2026-04-05"
            
        # Clinical rationale
        rationale = case_data.get("APPEAL LETTER SUMMARY", case_data.get("ORIGINAL CLINICAL CASE SUMMARY", "Appeal reviewed. Clinical findings noted."))
        evidence = case_data.get("ADDITIONAL CLINICAL DOCUMENTATION SUBMITTED WITH APPEAL", "Records reviewed.")

        db.execute("""
            INSERT INTO appeal_intake_cases (
                id, case_id, member_id, appellant_type, original_denial_date, appeal_received_date,
                appeal_level, denial_reason_category, clinical_rationale_provided, requested_service,
                diagnosis_category, financial_amount_disputed, reviewer_assigned, appeal_outcome,
                resolution_date, turnaround_days, key_evidence_cited, policy_referenced
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, [
            appeal_id, f"CASE-APP-{str(idx+1).zfill(3)}", member_id, appellant_type, orig_date, recv_date,
            appeal_level, denial_reason, rationale, req_service,
            dx_cat, fin_amount, random.choice(reviewers), outcome,
            res_date, turnaround, evidence, "UM-GEN-001"
        ])

    print(f"Loaded {len(cases)} appeal intake cases.")

if __name__ == "__main__":
    docx_path = r"d:\AI Nurse QA & Audit\Audit_POC Data\Appeals_Intake.docx"
    if not os.path.exists(docx_path):
        print(f"File not found: {docx_path}")
        sys.exit(1)
        
    db = get_connection()
    cases = parse_docx(docx_path)
    load_appeals(db, cases)
