import sys
import os
import uuid
import json
import random
from datetime import datetime, timedelta

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.database import get_connection
from scripts.seed_full import build_policy_matches

def generate_append_cases(num_cases=5):
    now = datetime.utcnow()
    cases = []
    
    first_names = ["John", "Jane", "Alice", "Bob", "Charlie", "Diana", "Eve", "Frank"]
    last_names = ["Smith", "Doe", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller"]
    
    for i in range(num_cases):
        name = f"{random.choice(first_names)} {random.choice(last_names)}"
        mrn = str(random.randint(10000000, 99999999))
        dob = f"{random.randint(1940, 1980)}-{random.randint(1, 12):02d}-{random.randint(1, 28):02d}"
        age = random.randint(45, 85)
        
        case_id = f"case-append-{uuid.uuid4().hex[:8]}"
        case_num = f"CASE-APP-{random.randint(1000, 9999)}"
        
        # We will make them all PENDING_REVIEW and randomly assign them to one of Priya Sharma's nurses
        nurse_rotation = ["EXL-N001", "EXL-N002", "EXL-N003", "EXL-N004", "EXL-N005"]
        submitted_by = random.choice(nurse_rotation)
        submitted_at = now - timedelta(hours=random.randint(1, 24))
        
        # Pick a random diagnosis type
        dx_type = random.choice(["CHF", "COPD", "Sepsis", "Obs"])
        
        if dx_type == "CHF":
            bnp = random.randint(800, 3000)
            ef = random.randint(20, 45)
            o2 = random.randint(85, 95)
            dx_code = "I50.23"
            dx_display = "Acute on Chronic Systolic Heart Failure"
            secondary = "I11.0,E11.9"
            structured = {
                "case_id": case_num,
                "patient": {"mrn": mrn, "dob": dob, "age": age, "name": name},
                "diagnosis": {"primary": dx_code, "display": dx_display, "secondary": secondary.split(",")},
                "vitals": {"temp": 98.6, "bp": "150/90", "hr": 100, "rr": 24, "o2_sat": o2},
                "labs": {"bnp": bnp, "creatinine": 1.8, "potassium": 4.5, "troponin": 0.04, "ef": ef},
                "clinical_summary": f"{age}-year-old presenting with acute decompensated heart failure. Patient reports worsening shortness of breath and orthopnea over the past 3 days. Baseline EF {ef}%. Vitals on admission showed hypoxia (O2 {o2}%). Labs notable for BNP {bnp}. Given acute symptoms and elevated biomarkers, patient requires inpatient management for aggressive diuresis with IV Lasix.",
                "timeline": [
                    {"day": "Day 1", "event": "ER Presentation", "details": f"Dyspnea, orthopnea, O2 sat {o2}%"},
                    {"day": "Day 1", "event": "Labs & Imaging", "details": f"BNP {bnp}, CXR showed pulmonary edema"},
                    {"day": "Day 1", "event": "Treatment Initiated", "details": "IV Lasix 40mg, O2 supplementation"},
                    {"day": "Day 2", "event": "Status", "details": "Continued diuresis, slight improvement in breathing"}
                ],
                "documents": ["ed_note.pdf"]
            }
        elif dx_type == "COPD":
            o2 = random.randint(82, 92)
            ph = round(random.uniform(7.25, 7.38), 2)
            dx_code = "J44.1"
            dx_display = "Acute COPD Exacerbation"
            secondary = "J96.01,J18.9"
            structured = {
                "case_id": case_num,
                "patient": {"mrn": mrn, "dob": dob, "age": age, "name": name},
                "diagnosis": {"primary": dx_code, "display": dx_display, "secondary": secondary.split(",")},
                "vitals": {"temp": 99.1, "bp": "140/85", "hr": 95, "rr": 26, "o2_sat": o2},
                "labs": {"wbc": 12.5, "ph": ph, "pco2": 55, "procalcitonin": 0.5},
                "clinical_summary": f"{age}-year-old presenting with acute exacerbation of COPD. Patient reports increased cough and purulent sputum production for 4 days, failing outpatient therapy. ABG shows respiratory acidosis with pH {ph}. Due to acute respiratory failure, patient requires inpatient admission for continuous nebulizers, IV steroids, and close monitoring.",
                "timeline": [
                    {"day": "Day 1", "event": "ER Presentation", "details": f"Severe wheezing, O2 sat {o2}%, accessory muscle use"},
                    {"day": "Day 1", "event": "Diagnostics", "details": f"ABG pH {ph}, pCO2 55. CXR shows hyperinflation"},
                    {"day": "Day 1", "event": "Treatment", "details": "Continuous Albuterol/Atrovent nebs, IV Solu-Medrol"}
                ],
                "documents": ["ed_note.pdf"]
            }
        elif dx_type == "Sepsis":
            lactate = round(random.uniform(1.5, 5.0), 1)
            dx_code = "A41.9"
            dx_display = "Sepsis, Unspecified Organism"
            secondary = "I95.9,G93.41"
            structured = {
                "case_id": case_num,
                "patient": {"mrn": mrn, "dob": dob, "age": age, "name": name},
                "diagnosis": {"primary": dx_code, "display": dx_display, "secondary": secondary.split(",")},
                "vitals": {"temp": 102.1, "bp": "90/55", "hr": 115, "rr": 28, "o2_sat": 94},
                "labs": {"wbc": 18.5, "lactate": lactate, "procalcitonin": 2.5, "creatinine": 1.5},
                "clinical_summary": f"{age}-year-old presenting with severe sepsis, likely secondary to pneumonia or UTI. Initial vitals showed hypotension (BP 90/55), tachycardia, and fever of 102.1. Lactic acid elevated at {lactate}. Sepsis protocol initiated in ER with broad-spectrum antibiotics and 30cc/kg fluid bolus. Patient requires admission for continued sepsis management.",
                "timeline": [
                    {"day": "Day 1", "event": "ER Triage", "details": "Hypotensive, febrile, tachycardic"},
                    {"day": "Day 1", "event": "Sepsis Protocol", "details": f"Blood cultures drawn, Lactate {lactate}, IV fluids started"},
                    {"day": "Day 1", "event": "Treatment", "details": "Broad spectrum IV antibiotics (Vancomycin + Zosyn)"}
                ],
                "documents": ["ed_note.pdf"]
            }
        else:
            dx_code = "R07.9"
            dx_display = "Chest Pain, Unspecified"
            secondary = "I25.10,I10"
            structured = {
                "case_id": case_num,
                "patient": {"mrn": mrn, "dob": dob, "age": age, "name": name},
                "diagnosis": {"primary": dx_code, "display": dx_display, "secondary": secondary.split(",")},
                "vitals": {"temp": 98.6, "bp": "130/80", "hr": 80, "rr": 18, "o2_sat": 98},
                "labs": {"bnp": 200, "creatinine": 1.0, "potassium": 4.0, "troponin": 0.01, "ef": 55},
                "clinical_summary": f"{age}-year-old presenting with atypical chest pain. Pain is non-radiating and reproducible on palpation. Initial EKG showed normal sinus rhythm with no acute ischemic changes. First troponin is normal. Patient is being placed in observation status to rule out acute coronary syndrome with serial cardiac enzymes.",
                "timeline": [
                    {"day": "Day 1", "event": "ER Triage", "details": "Reported sharp chest pain x2 hours"},
                    {"day": "Day 1", "event": "Diagnostics", "details": "EKG NSR. Initial troponin <0.01"},
                    {"day": "Day 1", "event": "Decision", "details": "Placed in observation for serial troponins in 4 hours"}
                ],
                "documents": ["ed_note.pdf"]
            }
            
        cases.append({
            "id": case_id, "case_number": case_num, "patient_mrn": mrn,
            "patient_name": name, "patient_dob": dob, "patient_age": age,
            "primary_diagnosis_code": dx_code,
            "primary_diagnosis_display": dx_display,
            "secondary_diagnoses": secondary,
            "structured_case": json.dumps(structured),
            "status": "PENDING_REVIEW", 
            "submitted_by": submitted_by,
            "submitted_at": submitted_at.isoformat(),
        })
        
    return cases

def seed_cases_append(conn, cases):
    for c in cases:
        conn.execute("""
            INSERT INTO cases (id, case_number, patient_mrn, patient_name, patient_dob, patient_age,
                               primary_diagnosis_code, primary_diagnosis_display, secondary_diagnoses,
                               structured_case, status, submitted_by, submitted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, [c["id"], c["case_number"], c["patient_mrn"], c["patient_name"], c["patient_dob"],
              c["patient_age"], c["primary_diagnosis_code"], c["primary_diagnosis_display"],
              c["secondary_diagnoses"], c["structured_case"], c["status"],
              c["submitted_by"], c["submitted_at"]])
    print(f"  [OK] Appended {len(cases)} new cases")

def seed_policy_matches_append(conn, matches):
    for m in matches:
        conn.execute("""
            INSERT INTO policy_matches (id, case_id, applicable_policy, policy_name, matched_criteria,
                                        unmet_criteria, recommendation, overall_confidence)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, [m["id"], m["case_id"], m["applicable_policy"], m["policy_name"], m["matched_criteria"],
              m["unmet_criteria"], m["recommendation"], m["overall_confidence"]])
    print(f"  [OK] Appended {len(matches)} policy matches")

def main():
    print("[APPEND] CareAudit AI -- Appending New Random Cases")
    print("=" * 60)
    
    conn = get_connection()
    
    # Generate 5 new cases by default
    cases = generate_append_cases(5)
    seed_cases_append(conn, cases)
    
    matches = build_policy_matches(cases)
    for m in matches:
        m["id"] = f"pm-app-{uuid.uuid4().hex[:8]}"
    seed_policy_matches_append(conn, matches)
    
    conn.close()
    print("\n[DONE] Appended new cases successfully!")

if __name__ == "__main__":
    main()
