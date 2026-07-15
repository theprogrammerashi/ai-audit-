"""
CareAudit AI - Seed Database Script
Seeds demo users (Admin, QA Leads, Nurses), cases distributed equally, policy matches, audit results, appeal data, and reviewer stats.
"""
import sys
import os
import json
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.database import init_database, get_connection
from app.core.security import get_password_hash


def seed_users(conn):
    """Seed demo users based on the new EXL hierarchy."""
    password_hash = get_password_hash("CareAudit@2025")

    users = [
        {
            "id": "admin-001",
            "email": "admin@careaudit.ai",
            "hashed_password": password_hash,
            "full_name": "System Admin",
            "role": "ADMIN",
            "npi": None,
            "qa_lead_id": None
        }
    ]

    # QA Leads
    qa_leads_data = [
        ("EXL-Q001", "Dr. Priya Sharma", "priya.sharma@careaudit.ai"),
        ("EXL-Q002", "Dr. James Mitchell", "james.mitchell@careaudit.ai"),
        ("EXL-Q003", "Dr. Lisa Chen", "lisa.chen@careaudit.ai"),
        ("EXL-Q004", "Dr. Robert Davis", "robert.davis@careaudit.ai"),
    ]

    for q_id, q_name, q_email in qa_leads_data:
        users.append({
            "id": q_id,
            "email": q_email,
            "hashed_password": password_hash,
            "full_name": q_name,
            "role": "QA_LEAD",
            "npi": None,
            "qa_lead_id": None
        })

    # Nurses
    nurses_data = [
        # Dr. Priya Sharma's team
        ("EXL-Q001", "EXL-N001", "Sarah Collins", "sarah.collins@careaudit.ai"),
        ("EXL-Q001", "EXL-N002", "Michael Torres", "michael.torres@careaudit.ai"),
        ("EXL-Q001", "EXL-N003", "Emily Johnson", "emily.johnson@careaudit.ai"),
        ("EXL-Q001", "EXL-N004", "David Chen", "david.chen@careaudit.ai"),
        ("EXL-Q001", "EXL-N005", "Amanda Foster", "amanda.foster@careaudit.ai"),
        
        # Dr. James Mitchell's team
        ("EXL-Q002", "EXL-N006", "Jennifer Walsh", "jennifer.walsh@careaudit.ai"),
        ("EXL-Q002", "EXL-N007", "Christopher Lee", "christopher.lee@careaudit.ai"),
        ("EXL-Q002", "EXL-N008", "Rebecca Martinez", "rebecca.martinez@careaudit.ai"),
        ("EXL-Q002", "EXL-N009", "Kevin Thompson", "kevin.thompson@careaudit.ai"),
        ("EXL-Q002", "EXL-N010", "Patricia Anderson", "patricia.anderson@careaudit.ai"),

        # Dr. Lisa Chen's team
        ("EXL-Q003", "EXL-N011", "Brandon Wilson", "brandon.wilson@careaudit.ai"),
        ("EXL-Q003", "EXL-N012", "Stephanie Brown", "stephanie.brown@careaudit.ai"),
        ("EXL-Q003", "EXL-N013", "Andrew Taylor", "andrew.taylor@careaudit.ai"),
        ("EXL-Q003", "EXL-N014", "Michelle Garcia", "michelle.garcia@careaudit.ai"),
        ("EXL-Q003", "EXL-N015", "Daniel White", "daniel.white@careaudit.ai"),

        # Dr. Robert Davis's team
        ("EXL-Q004", "EXL-N016", "Jessica Harris", "jessica.harris@careaudit.ai"),
        ("EXL-Q004", "EXL-N017", "Matthew Jackson", "matthew.jackson@careaudit.ai"),
        ("EXL-Q004", "EXL-N018", "Ashley Thomas", "ashley.thomas@careaudit.ai"),
        ("EXL-Q004", "EXL-N019", "Ryan Moore", "ryan.moore@careaudit.ai"),
        ("EXL-Q004", "EXL-N020", "Nicole Martin", "nicole.martin@careaudit.ai"),
    ]

    for q_id, n_id, n_name, n_email in nurses_data:
        users.append({
            "id": n_id,
            "email": n_email,
            "hashed_password": password_hash,
            "full_name": n_name,
            "role": "NURSE",
            "npi": None,
            "qa_lead_id": q_id
        })

    for user in users:
        try:
            conn.execute("""
                INSERT INTO users (id, email, hashed_password, full_name, role, npi, qa_lead_id)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, [user["id"], user["email"], user["hashed_password"],
                  user["full_name"], user["role"], user["npi"], user["qa_lead_id"]])
        except Exception as e:
            if "Duplicate" in str(e) or "UNIQUE" in str(e) or "unique" in str(e):
                print(f"  ⏭ User {user['email']} already exists, skipping")
            else:
                raise
    print(f"  ✅ Seeded {len(users)} users")


def seed_policies(conn):
    """Seed policy metadata."""
    policies = [
        {"id": "pol-001", "code": "UM-CHF-001", "name": "Acute Congestive Heart Failure Admission", "desc": "Criteria for CHF exacerbation."},
        {"id": "pol-002", "code": "UM-COPD-001", "name": "Acute COPD Exacerbation Admission", "desc": "Criteria for COPD exacerbation."},
        {"id": "pol-003", "code": "UM-SEPSIS-001", "name": "Sepsis and Severe Infection Admission", "desc": "Criteria for sepsis cases."},
        {"id": "pol-004", "code": "UM-OBS-IP-001", "name": "Observation Status vs Inpatient Admission", "desc": "Observation criteria."},
        {"id": "pol-005", "code": "UM-GEN-001", "name": "General Medical Necessity Determination Policy", "desc": "General policy."}
    ]

    for pol in policies:
        try:
            conn.execute("INSERT INTO policies (id, policy_code, policy_name, description) VALUES (?, ?, ?, ?)", 
                         [pol["id"], pol["code"], pol["name"], pol["desc"]])
        except Exception:
            pass
    print(f"  ✅ Seeded {len(policies)} policies")


def get_base_templates():
    """Return the 4 base templates for cases, policy matches, decisions, audits, and appeals."""
    return [
        {
            "case": {
                "structured": {
                    "patient": {"mrn": "45872136", "dob": "1958-03-22", "age": 68, "name": "Robert Mitchell"},
                    "diagnosis": {"primary": "I50.23", "display": "Acute on Chronic Systolic Heart Failure", "secondary": ["I11.0"]},
                    "vitals": {"temp": 98.6, "bp": "168/94", "hr": 110, "rr": 26, "o2_sat": 84},
                    "labs": {"bnp": 2865, "creatinine": 1.8},
                    "clinical_summary": "68-year-old male with acute decompensated heart failure.",
                    "risk_signals": ["severe_hypoxemia", "elevated_bnp"],
                    "documents": ["ed_note.pdf", "echo_report.pdf"],
                    "processing_confidence": 0.96
                },
                "primary_diag": "I50.23", "display_diag": "Acute on Chronic Systolic HF", "sec_diag": "I11.0",
                "status": "AUDITED"
            },
            "policy": {
                "applicable_policy": "UM-CHF-001", "policy_name": "Acute Congestive Heart Failure Admission",
                "matched": [{"criterion": "O2 Sat Below 90%", "status": "MET", "confidence": 0.98}],
                "unmet": [], "rec": "INPATIENT_ADMISSION_SUPPORTED", "conf": 0.97
            },
            "decision": {
                "decision": "APPROVED", "rationale": "Meets UM-CHF-001 criteria.", "cited": "UM-CHF-001", "ack": "5A"
            },
            "audit": {
                "qa_score": 94, "risk_level": "LOW", "audit_result": "PASS",
                "clin_acc": 96, "doc_comp": 91, "pol_comp": 97, "cons_score": 92,
                "findings": [{"type": "DOCUMENTATION_GAP", "severity": "LOW", "description": "Minor doc gap", "recommendation": "Cite EF explicitly"}],
                "alignment": "ALIGNED", "missing": []
            },
            "appeal": {
                "prob": 0.05, "risk_cat": "LOW", "exposure": 0, "factors": [], "rec": "Approval is supported.", "conf": 0.92
            }
        },
        {
            "case": {
                "structured": {
                    "patient": {"mrn": "78214569", "dob": "1962-08-12", "age": 63, "name": "James Carter"},
                    "diagnosis": {"primary": "J44.1", "display": "Acute COPD Exacerbation", "secondary": ["J96.01"]},
                    "vitals": {"temp": 101.2, "bp": "142/88", "hr": 105, "rr": 30, "o2_sat": 85},
                    "labs": {"wbc": 14.2, "ph": 7.32},
                    "clinical_summary": "63-year-old male with severe COPD exacerbation.",
                    "risk_signals": ["hypercapnic_respiratory_failure"],
                    "documents": ["ed_note.pdf", "abg_report.pdf"],
                    "processing_confidence": 0.93
                },
                "primary_diag": "J44.1", "display_diag": "Acute COPD Exacerbation", "sec_diag": "J96.01",
                "status": "AUDITED"
            },
            "policy": {
                "applicable_policy": "UM-COPD-001", "policy_name": "Acute COPD Exacerbation Admission",
                "matched": [{"criterion": "Hypoxemia", "status": "MET", "confidence": 0.98}],
                "unmet": [], "rec": "INPATIENT_ADMISSION_SUPPORTED", "conf": 0.97
            },
            "decision": {
                "decision": "APPROVED", "rationale": "Meets UM-COPD-001 criteria.", "cited": "UM-COPD-001", "ack": "4A"
            },
            "audit": {
                "qa_score": 96, "risk_level": "LOW", "audit_result": "PASS",
                "clin_acc": 98, "doc_comp": 94, "pol_comp": 97, "cons_score": 95,
                "findings": [], "alignment": "ALIGNED", "missing": []
            },
            "appeal": {
                "prob": 0.03, "risk_cat": "LOW", "exposure": 0, "factors": [], "rec": "Approval is well-supported.", "conf": 0.95
            }
        },
        {
            "case": {
                "structured": {
                    "patient": {"mrn": "58472196", "dob": "1961-07-15", "age": 64, "name": "Daniel Thompson"},
                    "diagnosis": {"primary": "A41.9", "display": "Sepsis", "secondary": ["I95.9"]},
                    "vitals": {"temp": 102.8, "bp": "86/52", "hr": 122, "rr": 28, "o2_sat": 94},
                    "labs": {"wbc": 18.9, "lactate": 4.2},
                    "clinical_summary": "64-year-old male with suspected sepsis.",
                    "risk_signals": ["persistent_hypotension", "elevated_lactate"],
                    "documents": ["ed_note.pdf"],
                    "processing_confidence": 0.94
                },
                "primary_diag": "A41.9", "display_diag": "Sepsis", "sec_diag": "I95.9",
                "status": "AUDITED"
            },
            "policy": {
                "applicable_policy": "UM-SEPSIS-001", "policy_name": "Sepsis Admission",
                "matched": [{"criterion": "Elevated Lactate", "status": "MET", "confidence": 0.99}],
                "unmet": [], "rec": "INPATIENT_ADMISSION_SUPPORTED", "conf": 0.97
            },
            "decision": {
                "decision": "APPROVED", "rationale": "Meets UM-SEPSIS-001 criteria.", "cited": "UM-SEPSIS-001", "ack": "6B"
            },
            "audit": {
                "qa_score": 88, "risk_level": "LOW", "audit_result": "PASS",
                "clin_acc": 94, "doc_comp": 82, "pol_comp": 91, "cons_score": 85,
                "findings": [{"type": "DOCUMENTATION_GAP", "severity": "MEDIUM", "description": "Did not reference lactate", "recommendation": "Cite lactate 4.2"}],
                "alignment": "ALIGNED", "missing": []
            },
            "appeal": {
                "prob": 0.08, "risk_cat": "LOW", "exposure": 2800, "factors": [], "rec": "Documentation could be strengthened.", "conf": 0.89
            }
        },
        {
            "case": {
                "structured": {
                    "patient": {"mrn": "92315874", "dob": "1955-11-03", "age": 70, "name": "Margaret Sullivan"},
                    "diagnosis": {"primary": "I50.23", "display": "Acute HF", "secondary": ["I10"]},
                    "vitals": {"temp": 98.4, "bp": "152/90", "hr": 98, "rr": 24, "o2_sat": 87},
                    "labs": {"bnp": 3200},
                    "clinical_summary": "70-year-old female with acute CHF. INCORRECTLY DENIED.",
                    "risk_signals": ["severe_hypoxemia", "critically_elevated_bnp"],
                    "documents": ["ed_note.pdf", "echo_report.pdf"],
                    "processing_confidence": 0.95
                },
                "primary_diag": "I50.23", "display_diag": "Acute HF", "sec_diag": "I10",
                "status": "AUDITED"
            },
            "policy": {
                "applicable_policy": "UM-CHF-001", "policy_name": "Acute Congestive Heart Failure Admission",
                "matched": [{"criterion": "Elevated BNP", "status": "MET", "confidence": 0.99}],
                "unmet": [{"criterion": "IV Diuretic Requirement", "status": "INSUFFICIENT_EVIDENCE", "confidence": 0.65}],
                "rec": "INPATIENT_ADMISSION_SUPPORTED", "conf": 0.92
            },
            "decision": {
                "decision": "DENIED", "rationale": "Vitals appear stable.", "cited": "UM-CHF-001", "ack": ""
            },
            "audit": {
                "qa_score": 42, "risk_level": "CRITICAL", "audit_result": "FAIL",
                "clin_acc": 35, "doc_comp": 28, "pol_comp": 38, "cons_score": 67,
                "findings": [{"type": "POLICY_MISMATCH", "severity": "CRITICAL", "description": "Reviewer denied case citing stable vitals.", "recommendation": "Decision contradicts evidence."}],
                "alignment": "MISALIGNED", "missing": ["BNP 3200 not addressed"]
            },
            "appeal": {
                "prob": 0.78, "risk_cat": "HIGH", "exposure": 18500, "factors": ["Lab results not cited"], "rec": "Escalate to MD.", "conf": 0.91
            }
        }
    ]

def seed_cases_and_related(conn):
    """Distribute 20 cases (4 templates * 5) equally to 20 nurses."""
    templates = get_base_templates()
    nurse_ids = [f"EXL-N{str(i).zfill(3)}" for i in range(1, 21)]

    for idx, nurse_id in enumerate(nurse_ids):
        t = templates[idx % 4]
        
        # Unique IDs
        case_id = f"case-{str(idx+1).zfill(3)}"
        case_num = f"CASE-2026-{str(idx+1).zfill(3)}"
        match_id = f"pm-{str(idx+1).zfill(3)}"
        dec_id = f"dec-{str(idx+1).zfill(3)}"
        aud_id = f"aud-{str(idx+1).zfill(3)}"
        app_id = f"app-{str(idx+1).zfill(3)}"

        # Modify structured case slightly to make it somewhat unique
        structured = dict(t["case"]["structured"])
        structured["case_id"] = case_num
        
        # 1. Cases
        try:
            conn.execute("""
                INSERT INTO cases (id, case_number, patient_mrn, patient_name, patient_dob, patient_age,
                                   primary_diagnosis_code, primary_diagnosis_display, secondary_diagnoses,
                                   structured_case, status, submitted_by, assigned_nurse_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, [
                case_id, case_num, structured["patient"]["mrn"], structured["patient"]["name"], 
                structured["patient"]["dob"], structured["patient"]["age"], t["case"]["primary_diag"], 
                t["case"]["display_diag"], t["case"]["sec_diag"], json.dumps(structured), 
                t["case"]["status"], nurse_id, nurse_id
            ])
        except Exception:
            pass

        # 2. Policy Matches
        try:
            conn.execute("""
                INSERT INTO policy_matches (id, case_id, applicable_policy, policy_name, matched_criteria, unmet_criteria, recommendation, overall_confidence)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, [
                match_id, case_id, t["policy"]["applicable_policy"], t["policy"]["policy_name"],
                json.dumps(t["policy"]["matched"]), json.dumps(t["policy"]["unmet"]),
                t["policy"]["rec"], t["policy"]["conf"]
            ])
        except Exception:
            pass

        # 3. Nurse Decisions
        try:
            conn.execute("""
                INSERT INTO nurse_decisions (id, case_id, reviewer_id, decision, rationale, policy_cited, criteria_acknowledged)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, [
                dec_id, case_id, nurse_id, t["decision"]["decision"], t["decision"]["rationale"],
                t["decision"]["cited"], t["decision"]["ack"]
            ])
        except Exception:
            pass

        # 4. Audit Results
        try:
            conn.execute("""
                INSERT INTO audit_results (id, case_id, decision_id, qa_score, risk_level, audit_result,
                                          clinical_accuracy, documentation_completeness, policy_compliance,
                                          consistency_score, findings, policy_alignment, missing_evidence)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, [
                aud_id, case_id, dec_id, t["audit"]["qa_score"], t["audit"]["risk_level"], t["audit"]["audit_result"],
                t["audit"]["clin_acc"], t["audit"]["doc_comp"], t["audit"]["pol_comp"], t["audit"]["cons_score"],
                json.dumps(t["audit"]["findings"]), t["audit"]["alignment"], json.dumps(t["audit"]["missing"])
            ])
        except Exception:
            pass

        # 5. Appeals
        try:
            conn.execute("""
                INSERT INTO appeals (id, case_id, decision_id, overturn_probability, risk_category,
                                   financial_exposure_estimate, top_risk_factors, recommendation,
                                   model_confidence)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, [
                app_id, case_id, dec_id, t["appeal"]["prob"], t["appeal"]["risk_cat"],
                t["appeal"]["exposure"], json.dumps(t["appeal"]["factors"]), t["appeal"]["rec"], t["appeal"]["conf"]
            ])
        except Exception:
            pass

    print("  ✅ Seeded 20 cases and related records equally to 20 nurses")


def seed_reviewer_stats_and_training(conn):
    """Seed reviewer stats and training modules for all 20 nurses."""
    nurse_ids = [f"EXL-N{str(i).zfill(3)}" for i in range(1, 21)]

    for idx, nurse_id in enumerate(nurse_ids):
        stat_id = f"rs-{str(idx+1).zfill(3)}"
        # Randomize stats slightly based on index
        base_score = 70 + (idx % 25)
        trend = "STABLE" if base_score > 85 else ("IMPROVING" if base_score > 75 else "DECLINING")
        
        try:
            conn.execute("""
                INSERT INTO reviewer_stats (id, reviewer_id, period, qa_score_avg, approval_rate, denial_rate,
                                           overturn_rate, documentation_score, policy_compliance, consistency_score,
                                           case_volume, peer_percentile, top_gaps, trend)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, [
                stat_id, nurse_id, "30d", base_score, 0.70, 0.30, 0.10, base_score - 2, base_score + 2, base_score,
                100 + idx, base_score, json.dumps(["Documentation completeness"]), trend
            ])
        except Exception:
            pass
            
        # Assign a training module if score is below 80
        if base_score < 80:
            try:
                conn.execute("""
                    INSERT INTO training_modules (id, reviewer_id, module_id, topic, trigger_reason,
                                                 estimated_duration_minutes, sections, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, [
                    f"tm-{str(idx+1).zfill(3)}", nurse_id, f"TRAIN-00{idx}", "Clinical Documentation Best Practices",
                    "Documentation score below 80", 15, json.dumps([]), "ASSIGNED"
                ])
            except Exception:
                pass

    print("  ✅ Seeded reviewer stats and training modules")


def main():
    print("🌱 Seeding CareAudit AI database with new hierarchy...")
    init_database()
    conn = get_connection()

    seed_users(conn)
    seed_policies(conn)
    seed_cases_and_related(conn)
    seed_reviewer_stats_and_training(conn)

    conn.close()
    print("\n✅ Database seeded successfully!")


if __name__ == "__main__":
    main()
