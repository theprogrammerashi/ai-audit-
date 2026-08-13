"""
CareAudit AI - Full Database Seeder (30 Cases)
Seeds 6 users, 5 policies, 30 realistic cases, 30 policy matches,
20 nurse decisions, 20 audit results, 20 appeal records,
training modules, and reviewer stats.
"""
import sys
import os
import uuid
import json
import random
from datetime import datetime, timedelta

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.database import init_database, get_connection
from app.core.security import get_password_hash


# ═══════════════════════════════════════════════════════════════════════════════
# USERS
# ═══════════════════════════════════════════════════════════════════════════════

USERS = [
    {
        "id": "usr-admin-001", "email": "admin@careaudit.ai",
        "password": "CareAudit@2025", "full_name": "Admin User",
        "role": "ADMIN", "npi": None, "qa_lead_id": None,
    },
    # QA Leads
    {
        "id": "EXL-Q001", "email": "priya.sharma@careaudit.ai",
        "password": "CareAudit@2025", "full_name": "Dr. Priya Sharma",
        "role": "QA_LEAD", "npi": "Q001", "qa_lead_id": None,
    },
    {
        "id": "EXL-Q002", "email": "james.mitchell@careaudit.ai",
        "password": "CareAudit@2025", "full_name": "Dr. James Mitchell",
        "role": "QA_LEAD", "npi": "Q002", "qa_lead_id": None,
    },
    {
        "id": "EXL-Q003", "email": "lisa.chen@careaudit.ai",
        "password": "CareAudit@2025", "full_name": "Dr. Lisa Chen",
        "role": "QA_LEAD", "npi": "Q003", "qa_lead_id": None,
    },
    {
        "id": "EXL-Q004", "email": "robert.davis@careaudit.ai",
        "password": "CareAudit@2025", "full_name": "Dr. Robert Davis",
        "role": "QA_LEAD", "npi": "Q004", "qa_lead_id": None,
    },
    # Nurses under Dr. Priya Sharma
    {
        "id": "EXL-N001", "email": "sarah.collins@careaudit.ai",
        "password": "CareAudit@2025", "full_name": "Sarah Collins",
        "role": "NURSE", "npi": "N001", "qa_lead_id": "EXL-Q001",
    },
    {
        "id": "EXL-N002", "email": "michael.torres@careaudit.ai",
        "password": "CareAudit@2025", "full_name": "Michael Torres",
        "role": "NURSE", "npi": "N002", "qa_lead_id": "EXL-Q001",
    },
    {
        "id": "EXL-N003", "email": "emily.johnson@careaudit.ai",
        "password": "CareAudit@2025", "full_name": "Emily Johnson",
        "role": "NURSE", "npi": "N003", "qa_lead_id": "EXL-Q001",
    },
    {
        "id": "EXL-N004", "email": "david.chen@careaudit.ai",
        "password": "CareAudit@2025", "full_name": "David Chen",
        "role": "NURSE", "npi": "N004", "qa_lead_id": "EXL-Q001",
    },
    {
        "id": "EXL-N005", "email": "amanda.foster@careaudit.ai",
        "password": "CareAudit@2025", "full_name": "Amanda Foster",
        "role": "NURSE", "npi": "N005", "qa_lead_id": "EXL-Q001",
    },
    # Nurses under Dr. James Mitchell
    {
        "id": "EXL-N006", "email": "jennifer.walsh@careaudit.ai",
        "password": "CareAudit@2025", "full_name": "Jennifer Walsh",
        "role": "NURSE", "npi": "N006", "qa_lead_id": "EXL-Q002",
    },
    {
        "id": "EXL-N007", "email": "christopher.lee@careaudit.ai",
        "password": "CareAudit@2025", "full_name": "Christopher Lee",
        "role": "NURSE", "npi": "N007", "qa_lead_id": "EXL-Q002",
    },
    {
        "id": "EXL-N008", "email": "rebecca.martinez@careaudit.ai",
        "password": "CareAudit@2025", "full_name": "Rebecca Martinez",
        "role": "NURSE", "npi": "N008", "qa_lead_id": "EXL-Q002",
    },
    {
        "id": "EXL-N009", "email": "kevin.thompson@careaudit.ai",
        "password": "CareAudit@2025", "full_name": "Kevin Thompson",
        "role": "NURSE", "npi": "N009", "qa_lead_id": "EXL-Q002",
    },
    {
        "id": "EXL-N010", "email": "patricia.anderson@careaudit.ai",
        "password": "CareAudit@2025", "full_name": "Patricia Anderson",
        "role": "NURSE", "npi": "N010", "qa_lead_id": "EXL-Q002",
    },
    # Nurses under Dr. Lisa Chen
    {
        "id": "EXL-N011", "email": "brandon.wilson@careaudit.ai",
        "password": "CareAudit@2025", "full_name": "Brandon Wilson",
        "role": "NURSE", "npi": "N011", "qa_lead_id": "EXL-Q003",
    },
    {
        "id": "EXL-N012", "email": "stephanie.brown@careaudit.ai",
        "password": "CareAudit@2025", "full_name": "Stephanie Brown",
        "role": "NURSE", "npi": "N012", "qa_lead_id": "EXL-Q003",
    },
    {
        "id": "EXL-N013", "email": "andrew.taylor@careaudit.ai",
        "password": "CareAudit@2025", "full_name": "Andrew Taylor",
        "role": "NURSE", "npi": "N013", "qa_lead_id": "EXL-Q003",
    },
    {
        "id": "EXL-N014", "email": "michelle.garcia@careaudit.ai",
        "password": "CareAudit@2025", "full_name": "Michelle Garcia",
        "role": "NURSE", "npi": "N014", "qa_lead_id": "EXL-Q003",
    },
    {
        "id": "EXL-N015", "email": "daniel.white@careaudit.ai",
        "password": "CareAudit@2025", "full_name": "Daniel White",
        "role": "NURSE", "npi": "N015", "qa_lead_id": "EXL-Q003",
    },
    # Nurses under Dr. Robert Davis
    {
        "id": "EXL-N016", "email": "jessica.harris@careaudit.ai",
        "password": "CareAudit@2025", "full_name": "Jessica Harris",
        "role": "NURSE", "npi": "N016", "qa_lead_id": "EXL-Q004",
    },
    {
        "id": "EXL-N017", "email": "matthew.jackson@careaudit.ai",
        "password": "CareAudit@2025", "full_name": "Matthew Jackson",
        "role": "NURSE", "npi": "N017", "qa_lead_id": "EXL-Q004",
    },
    {
        "id": "EXL-N018", "email": "ashley.thomas@careaudit.ai",
        "password": "CareAudit@2025", "full_name": "Ashley Thomas",
        "role": "NURSE", "npi": "N018", "qa_lead_id": "EXL-Q004",
    },
    {
        "id": "EXL-N019", "email": "ryan.moore@careaudit.ai",
        "password": "CareAudit@2025", "full_name": "Ryan Moore",
        "role": "NURSE", "npi": "N019", "qa_lead_id": "EXL-Q004",
    },
    {
        "id": "EXL-N020", "email": "nicole.martin@careaudit.ai",
        "password": "CareAudit@2025", "full_name": "Nicole Martin",
        "role": "NURSE", "npi": "N020", "qa_lead_id": "EXL-Q004",
    },
]

POLICIES = [
    {"id": "pol-001", "policy_code": "UM-CHF-001", "policy_name": "Acute Congestive Heart Failure Inpatient Admission Guidelines", "description": "Clinical criteria for determining inpatient admission eligibility for acute CHF exacerbation cases."},
    {"id": "pol-002", "policy_code": "UM-COPD-001", "policy_name": "Acute COPD Exacerbation Inpatient Admission Guidelines", "description": "Clinical criteria for determining inpatient admission for acute COPD exacerbation cases."},
    {"id": "pol-003", "policy_code": "UM-SEPSIS-001", "policy_name": "Sepsis and Severe Infection Inpatient Admission Guidelines", "description": "Clinical criteria for determining inpatient admission for sepsis and severe infection cases."},
    {"id": "pol-004", "policy_code": "UM-OBS-IP-001", "policy_name": "Observation Status vs Inpatient Admission Determination Guidelines", "description": "Guidelines for determining appropriate patient status classification between observation and inpatient."},
    {"id": "pol-005", "policy_code": "UM-GEN-001", "policy_name": "General Medical Necessity Determination Policy", "description": "General policy for medical necessity determination across all diagnosis categories."},
]


# ═══════════════════════════════════════════════════════════════════════════════
# 30 REALISTIC CASES
# ═══════════════════════════════════════════════════════════════════════════════

def build_cases():
    """Build 30 realistic clinical cases."""
    now = datetime.utcnow()
    cases = []

    # ── CHF Cases (10) ────────────────────────────────────────────────────────
    chf_patients = [
        ("Robert Mitchell", "45872136", "1958-03-22", 68, 84, 2865, 1.8, 5.1, 0.04, 30, "168/94", 110, 26, 98.6),
        ("Margaret Sullivan", "92315874", "1955-11-03", 70, 87, 3200, 2.1, 5.3, 0.06, 25, "152/90", 98, 24, 98.4),
        ("William Harris", "31458726", "1952-06-15", 73, 86, 1850, 1.6, 4.8, 0.03, 35, "158/88", 104, 22, 98.8),
        ("Dorothy Jenkins", "67823145", "1948-09-28", 77, 82, 4100, 2.4, 5.5, 0.08, 20, "174/96", 118, 28, 99.0),
        ("Richard Adams", "54219873", "1960-12-05", 65, 89, 1200, 1.4, 4.6, 0.02, 40, "148/86", 96, 22, 98.6),
        ("Patricia Cooper", "89321547", "1956-04-18", 69, 88, 2100, 1.9, 5.0, 0.05, 32, "160/92", 108, 24, 98.4),
        ("Thomas Baker", "72614583", "1950-07-22", 75, 83, 3600, 2.3, 5.4, 0.07, 22, "170/94", 114, 26, 98.2),
        ("Helen Martinez", "43827615", "1963-01-10", 63, 91, 680, 1.3, 4.4, 0.02, 45, "142/84", 88, 20, 98.6),
        ("James O'Brien", "95136248", "1957-08-30", 68, 85, 2400, 2.0, 5.2, 0.04, 28, "164/90", 106, 25, 98.8),
        ("Barbara Wilson", "28473916", "1954-03-12", 72, 90, 920, 1.5, 4.7, 0.03, 42, "146/82", 92, 21, 98.4),
    ]

    for i, (name, mrn, dob, age, o2, bnp, creat, k, trop, ef, bp, hr, rr, temp) in enumerate(chf_patients):
        case_id = f"case-{str(i+1).zfill(3)}"
        case_num = f"CASE-2026-{str(i+1).zfill(3)}"
        severity = "severe" if bnp > 2000 else "moderate" if bnp > 1000 else "mild"
        ef_desc = "severely reduced" if ef < 30 else "reduced" if ef < 40 else "mildly reduced"

        structured = {
            "case_id": case_num,
            "patient": {"mrn": mrn, "dob": dob, "age": age, "name": name},
            "diagnosis": {"primary": "I50.23", "display": "Acute on Chronic Systolic Heart Failure", "secondary": ["I11.0", "E11.9"]},
            "vitals": {"temp": temp, "bp": bp, "hr": hr, "rr": rr, "o2_sat": o2},
            "labs": {"bnp": bnp, "creatinine": creat, "potassium": k, "troponin": trop, "ef": ef},
            "clinical_summary": (
                f"**CHIEF COMPLAINT:** Worsening shortness of breath and edema.\n\n"
                f"**History of Present Illness (HPI):** {age}-year-old {'male' if i % 2 == 0 else 'female'} presenting with acute decompensated heart failure. "
                f"Patient reports progressive documentation over the last 48 hours. {'Severe dyspnea at rest' if o2 < 88 else 'Moderate dyspnea on exertion'}, "
                f"associated with orthopnea and paroxysmal nocturnal dyspnea.\n\n"
                f"**OBJECTIVE DATA:**\n"
                f"- **Vitals:** O2 sat {o2}% on room air, RR 24, BP 145/90.\n"
                f"- **Exam:** Bilateral crackles in lung bases, {'3+' if bnp > 2000 else '2+'} pitting lower extremity edema.\n"
                f"- **Labs/Imaging:** BNP {'critically ' if bnp > 2000 else 'significantly '}elevated at {bnp:,} pg/mL. Echo shows EF {ef}%. CXR reveals pulmonary vascular congestion.\n\n"
                f"**ASSESSMENT & PLAN:** Acute on chronic heart failure exacerbation. "
                f"{'Requires urgent inpatient admission for continuous IV Lasix and respiratory support.' if bnp > 1500 else 'Observation status for oral diuresis and close monitoring.'}"
            ),
            "timeline": [
                {"day": "Day 1", "event": "Emergency Room Arrival", "details": f"{'Severe' if o2 < 88 else 'Moderate'} dyspnea, O2 sat {o2}%, bilateral crackles"},
                {"day": "Day 1", "event": "Labs & Imaging", "details": f"BNP {bnp:,}, CXR {'bilateral pleural effusions' if bnp > 1500 else 'mild congestion'}, Echo EF {ef}%"},
                {"day": "Day 1", "event": "Treatment Initiated", "details": f"{'IV Lasix 80mg' if bnp > 1500 else 'Oral Lasix 40mg'}, O2 via NC, continuous monitoring"},
                {"day": "Day 2", "event": "Ongoing Treatment", "details": "Diuretics continued, fluid restriction, daily weights"},
            ],
            "risk_signals": [s for s in [
                "severe_hypoxemia" if o2 < 88 else None,
                "elevated_bnp" if bnp > 500 else None,
                "reduced_ef" if ef < 40 else None,
                "failed_oral_diuretics" if bnp > 1500 else None,
                "hyperkalemia" if k > 5.0 else None,
            ] if s],
            "documents": ["ed_note.pdf", "echo_report.pdf", "lab_report.pdf"],
            "processing_confidence": round(random.uniform(0.91, 0.98), 2),
        }

        # Workflow: PENDING_REVIEW (nurse hasn't worked yet)
        #           DECIDED (nurse decided, pending QA review)
        #           AUDITED (QA lead verified/approved)
        if i < 5:
            status = "PENDING_REVIEW"
        elif i < 8:
            status = "DECIDED"   # nurse decided, waiting for QA review
        else:
            status = "AUDITED"   # QA lead already verified
        # Assign to specific nurses under Priya Sharma (EXL-Q001)
        nurse_rotation = ["EXL-N001", "EXL-N002", "EXL-N003", "EXL-N004", "EXL-N005"]
        submitted_by = nurse_rotation[i % len(nurse_rotation)]
        submitted_at = now - timedelta(hours=random.randint(1, 72))

        cases.append({
            "id": case_id, "case_number": case_num, "patient_mrn": mrn,
            "patient_name": name, "patient_dob": dob, "patient_age": age,
            "primary_diagnosis_code": "I50.23",
            "primary_diagnosis_display": "Acute on Chronic Systolic Heart Failure",
            "secondary_diagnoses": "I11.0,E11.9",
            "structured_case": json.dumps(structured),
            "status": status, "submitted_by": submitted_by,
            "submitted_at": submitted_at.isoformat(),
        })

    # ── COPD Cases (8) ────────────────────────────────────────────────────────
    copd_patients = [
        ("James Carter", "78214569", "1962-08-12", 63, 85, 14.2, 7.32, 58, 1.2, "142/88", 105, 30, 101.2),
        ("Nancy Rodriguez", "61538274", "1959-05-20", 66, 87, 12.8, 7.34, 52, 0.8, "138/82", 98, 26, 100.8),
        ("Charles Taylor", "83724156", "1955-11-08", 70, 83, 16.4, 7.28, 65, 2.1, "150/90", 112, 32, 101.6),
        ("Sandra Green", "47295813", "1964-02-14", 62, 89, 11.0, 7.38, 46, 0.4, "134/80", 92, 24, 100.2),
        ("Kenneth White", "58371624", "1957-09-25", 68, 86, 13.5, 7.30, 55, 1.5, "144/86", 100, 28, 101.0),
        ("Linda Scott", "39481572", "1961-04-03", 64, 84, 15.8, 7.29, 62, 1.8, "148/88", 108, 30, 101.4),
        ("Donald Young", "72583419", "1953-12-17", 72, 88, 10.5, 7.36, 48, 0.6, "136/82", 94, 24, 100.4),
        ("Carol King", "64827391", "1966-07-22", 59, 90, 9.8, 7.40, 42, 0.3, "132/78", 86, 22, 99.8),
    ]

    for i, (name, mrn, dob, age, o2, wbc, ph, pco2, procal, bp, hr, rr, temp) in enumerate(copd_patients):
        idx = 10 + i + 1
        case_id = f"case-{str(idx).zfill(3)}"
        case_num = f"CASE-2026-{str(idx).zfill(3)}"

        structured = {
            "case_id": case_num,
            "patient": {"mrn": mrn, "dob": dob, "age": age, "name": name},
            "diagnosis": {"primary": "J44.1", "display": "Acute COPD Exacerbation with Acute Exacerbation", "secondary": ["J96.01", "J18.9"]},
            "vitals": {"temp": temp, "bp": bp, "hr": hr, "rr": rr, "o2_sat": o2},
            "labs": {"wbc": wbc, "ph": ph, "pco2": pco2, "procalcitonin": procal},
            "clinical_summary": (
                f"**CHIEF COMPLAINT:** Severe respiratory distress and productive cough.\n\n"
                f"**History of Present Illness (HPI):** {age}-year-old {'male' if i % 2 == 0 else 'female'} with {'severe' if ph < 7.32 else 'moderate'} COPD (GOLD Stage {'III' if ph < 7.32 else 'II'}) presenting with acute exacerbation. "
                f"Patient reports 4 days of worsening symptoms. {'Failed outpatient prednisone and azithromycin course' if pco2 > 50 else 'Worsening symptoms despite bronchodilators'}.\n\n"
                f"**OBJECTIVE DATA:**\n"
                f"- **Vitals:** {'Hypoxic' if o2 < 88 else 'Borderline hypoxic'} (O2 sat {o2}%), {'tachypneic' if rr > 24 else 'mildly elevated RR'} (RR {rr}).\n"
                f"- **Exam:** Diffuse expiratory wheezing, accessory muscle use, diminished breath sounds bilaterally.\n"
                f"- **Labs:** ABG shows {'respiratory acidosis' if ph < 7.35 else 'near-normal pH'} with pH {ph} and pCO2 {pco2}.\n\n"
                f"**ASSESSMENT & PLAN:** Acute COPD exacerbation with impending respiratory failure. "
                f"{'IV methylprednisolone, continuous nebulizer treatments, and BiPAP initiated.' if ph < 7.35 else 'Oral steroids and scheduled nebulizers started. Monitor on floor.'}"
            ),
            "timeline": [
                {"day": "Day 1", "event": "Emergency Room Arrival", "details": f"{'Severe' if o2 < 86 else 'Moderate'} dyspnea, O2 sat {o2}%"},
                {"day": "Day 1", "event": "Labs & ABG", "details": f"pH {ph}, pCO2 {pco2}, WBC {wbc}"},
                {"day": "Day 1", "event": "Treatment", "details": f"{'IV methylprednisolone' if ph < 7.35 else 'Oral prednisone'}, continuous nebulizers"},
                {"day": "Day 2", "event": "Monitoring", "details": "Repeat ABG, respiratory therapy Q4H"},
            ],
            "risk_signals": [s for s in [
                "hypercapnic_respiratory_failure" if pco2 > 55 else None,
                "failed_outpatient_treatment" if pco2 > 50 else None,
                "respiratory_acidosis" if ph < 7.35 else None,
                "leukocytosis" if wbc > 12 else None,
            ] if s],
            "documents": ["ed_note.pdf", "abg_report.pdf", "cxr_report.pdf"],
            "processing_confidence": round(random.uniform(0.90, 0.97), 2),
        }

        if i < 3:
            status = "PENDING_REVIEW"
        elif i < 6:
            status = "DECIDED"   # nurse decided, waiting for QA review
        else:
            status = "AUDITED"   # QA lead already verified
        # Assign to specific nurses under Priya Sharma (EXL-Q001)
        nurse_rotation_copd = ["EXL-N004", "EXL-N001", "EXL-N003", "EXL-N005", "EXL-N002"]
        submitted_by = nurse_rotation_copd[i % len(nurse_rotation_copd)]
        submitted_at = now - timedelta(hours=random.randint(1, 72))

        cases.append({
            "id": case_id, "case_number": case_num, "patient_mrn": mrn,
            "patient_name": name, "patient_dob": dob, "patient_age": age,
            "primary_diagnosis_code": "J44.1",
            "primary_diagnosis_display": "Acute COPD Exacerbation",
            "secondary_diagnoses": "J96.01,J18.9",
            "structured_case": json.dumps(structured),
            "status": status, "submitted_by": submitted_by,
            "submitted_at": submitted_at.isoformat(),
        })

    # ── Sepsis Cases (7) ──────────────────────────────────────────────────────
    sepsis_patients = [
        ("Daniel Thompson", "58472196", "1961-07-15", 64, 94, 18.9, 4.2, 8.6, 1.7, "86/52", 122, 28, 102.8),
        ("Angela Davis", "71293845", "1958-03-28", 67, 92, 22.4, 5.8, 12.3, 2.1, "82/48", 130, 32, 103.4),
        ("Steven Clark", "45816239", "1965-10-05", 60, 96, 15.2, 2.8, 4.5, 1.5, "94/60", 108, 24, 101.8),
        ("Michelle Lewis", "83619427", "1969-06-18", 56, 93, 20.1, 3.6, 7.8, 1.9, "88/54", 118, 28, 102.4),
        ("Gregory Hall", "26548713", "1954-12-30", 71, 91, 24.6, 6.1, 15.2, 2.5, "78/44", 134, 34, 104.0),
        ("Laura Allen", "59371824", "1967-08-14", 58, 95, 13.8, 2.2, 3.2, 1.3, "96/62", 102, 22, 101.2),
        ("Frank Robinson", "47829315", "1960-01-22", 66, 93, 17.5, 3.8, 6.4, 1.8, "90/56", 116, 26, 102.2),
    ]

    for i, (name, mrn, dob, age, o2, wbc, lact, procal, creat, bp, hr, rr, temp) in enumerate(sepsis_patients):
        idx = 18 + i + 1
        case_id = f"case-{str(idx).zfill(3)}"
        case_num = f"CASE-2026-{str(idx).zfill(3)}"

        structured = {
            "case_id": case_num,
            "patient": {"mrn": mrn, "dob": dob, "age": age, "name": name},
            "diagnosis": {"primary": "A41.9", "display": "Sepsis, Unspecified Organism", "secondary": ["I95.9", "G93.41"]},
            "vitals": {"temp": temp, "bp": bp, "hr": hr, "rr": rr, "o2_sat": o2},
            "labs": {"wbc": wbc, "lactate": lact, "procalcitonin": procal, "creatinine": creat},
            "clinical_summary": (
                f"**CHIEF COMPLAINT:** Fever, confusion, and generalized weakness.\n\n"
                f"**History of Present Illness (HPI):** {age}-year-old {'male' if i % 2 == 0 else 'female'} presenting with {'severe sepsis' if lact >= 4.0 else 'suspected sepsis'} secondary to {'UTI' if i % 3 == 0 else 'pneumonia' if i % 3 == 1 else 'abdominal source'}. "
                f"Patient's family notes declining mental status / Altered Mental Status (AMS) over 24 hours.\n\n"
                f"**OBJECTIVE DATA:**\n"
                f"- **Vitals:** {'Persistent hypotension' if int(bp.split('/')[0]) < 90 else 'Borderline hypotension'} (BP {bp}) {'despite 2L IV fluid resuscitation' if lact > 3 else 'responsive to initial fluids'}, Temp {temp}°F, HR {hr} bpm, RR {rr}/min, Oxygen Saturation {o2}%.\n"
                f"- **Exam:** {'Altered Mental Status (AMS) — confused to time and situation, lethargic.' if lact > 4 else 'Alert and oriented, but toxic appearing.'}\n"
                f"- **Labs:** Elevated lactate ({lact} mmol/L), procalcitonin {procal} ng/mL, WBC {wbc} K/uL, creatinine {creat} mg/dL.\n\n"
                f"**ASSESSMENT & PLAN:** Sepsis protocol initiated. Broad-spectrum intravenous (IV) antibiotics started. "
                f"{'Patient meets criteria for ICU admission for vasopressor support.' if lact > 4.0 else 'Admit for continued IV antibiotics and fluid resuscitation.'}"
            ),
            "timeline": [
                {"day": "Day 1", "event": "Emergency Room Arrival", "details": f"Fever {temp}°F, {'hypotension' if int(bp.split('/')[0]) < 90 else 'low-normal BP'}, {'AMS' if lact > 4 else 'alert'}"},
                {"day": "Day 1", "event": "Sepsis Workup", "details": f"Blood cultures x2, Lactate {lact}, PCT {procal}"},
                {"day": "Day 1", "event": "Resuscitation", "details": f"{'2L NS bolus, persistent hypotension' if lact > 3 else '1L NS bolus, responsive'}, IV antibiotics started"},
                {"day": "Day 2", "event": "ICU Monitoring", "details": "Serial lactate trending, vasopressors considered" if lact > 4 else "Floor monitoring, repeat labs"},
            ],
            "risk_signals": [s for s in [
                "persistent_hypotension" if int(bp.split('/')[0]) < 90 else None,
                "elevated_lactate" if lact >= 2.0 else None,
                "altered_mental_status" if lact > 4.0 else None,
                "sepsis_criteria_met" if lact >= 2.0 and wbc > 12 else None,
                "severe_leukocytosis" if wbc > 20 else None,
            ] if s],
            "documents": ["ed_note.pdf", "lab_report.pdf", "pa_request.pdf"],
            "processing_confidence": round(random.uniform(0.90, 0.97), 2),
        }

        if i < 2:
            status = "PENDING_REVIEW"
        elif i < 5:
            status = "DECIDED"   # nurse decided, waiting for QA review
        else:
            status = "AUDITED"   # QA lead already verified
        submitted_by = ["EXL-N007", "EXL-N017", "EXL-N017", "EXL-N020"][i % 4]
        submitted_at = now - timedelta(hours=random.randint(1, 72))

        cases.append({
            "id": case_id, "case_number": case_num, "patient_mrn": mrn,
            "patient_name": name, "patient_dob": dob, "patient_age": age,
            "primary_diagnosis_code": "A41.9",
            "primary_diagnosis_display": "Sepsis, Unspecified Organism",
            "secondary_diagnoses": "I95.9,G93.41",
            "structured_case": json.dumps(structured),
            "status": status, "submitted_by": submitted_by,
            "submitted_at": submitted_at.isoformat(),
        })

    # ── Obs/IP Boundary Cases (5) ─────────────────────────────────────────────
    obs_patients = [
        ("Thomas Anderson", "37291845", "1968-04-11", 57, 92, 420, 1.2, 4.3, 0.01, 48, "140/82", 88, 20, 98.8, "chest_pain"),
        ("Susan Phillips", "51837246", "1971-09-23", 54, 94, 310, 1.0, 4.1, 0.01, 52, "136/78", 82, 18, 98.4, "syncope"),
        ("Edward Campbell", "63924175", "1963-11-07", 62, 93, 580, 1.3, 4.5, 0.02, 44, "144/84", 90, 20, 98.6, "atrial_fib"),
        ("Jennifer Parker", "84521367", "1966-02-19", 59, 95, 250, 0.9, 4.0, 0.01, 55, "130/76", 78, 18, 98.2, "chest_pain"),
        ("George Evans", "29638471", "1959-06-30", 66, 91, 750, 1.4, 4.6, 0.03, 40, "148/86", 94, 22, 98.8, "heart_failure_borderline"),
    ]

    for i, (name, mrn, dob, age, o2, bnp, creat, k, trop, ef, bp, hr, rr, temp, presentation) in enumerate(obs_patients):
        idx = 25 + i + 1
        case_id = f"case-{str(idx).zfill(3)}"
        case_num = f"CASE-2026-{str(idx).zfill(3)}"

        if presentation == "chest_pain":
            dx_code, dx_display = "R07.9", "Chest Pain, Unspecified"
            secondary = "I25.10,I10"
        elif presentation == "syncope":
            dx_code, dx_display = "R55", "Syncope and Collapse"
            secondary = "I49.9,R42"
        elif presentation == "atrial_fib":
            dx_code, dx_display = "I48.91", "Unspecified Atrial Fibrillation"
            secondary = "I50.9,I10"
        else:
            dx_code, dx_display = "I50.9", "Heart Failure, Unspecified"
            secondary = "I10,E78.5"

        structured = {
            "case_id": case_num,
            "patient": {"mrn": mrn, "dob": dob, "age": age, "name": name},
            "diagnosis": {"primary": dx_code, "display": dx_display, "secondary": secondary.split(",")},
            "vitals": {"temp": temp, "bp": bp, "hr": hr, "rr": rr, "o2_sat": o2},
            "labs": {"bnp": bnp, "creatinine": creat, "potassium": k, "troponin": trop, "ef": ef},
            "clinical_summary": f"{age}-year-old {'male' if i % 2 == 0 else 'female'} presenting with {dx_display.lower()}. Vitals {'borderline' if o2 < 93 else 'within normal limits'}. BNP {bnp} ({'mildly elevated' if bnp > 300 else 'normal range'}). EF {ef}% ({'preserved' if ef >= 50 else 'mildly reduced'}). This case represents a clinical grey zone between observation and inpatient status. {'Trending labs and serial troponins recommended.' if presentation == 'chest_pain' else 'Close monitoring recommended.'}",
            "timeline": [
                {"day": "Day 1", "event": "Emergency Room Arrival", "details": f"{dx_display}, O2 sat {o2}%, vitals stable"},
                {"day": "Day 1", "event": "Workup", "details": f"BNP {bnp}, troponin {trop}, EF {ef}% on echo"},
                {"day": "Day 1", "event": "Initial Management", "details": "Monitoring, serial labs ordered"},
            ],
            "risk_signals": [s for s in [
                "borderline_vitals" if o2 < 93 else None,
                "elevated_bnp" if bnp > 500 else None,
                "mildly_reduced_ef" if ef < 50 else None,
                "observation_candidate" if bnp < 500 else None,
            ] if s],
            "documents": ["ed_note.pdf", "echo_report.pdf", "lab_report.pdf"],
            "processing_confidence": round(random.uniform(0.78, 0.90), 2),
        }

        status = "DECIDED" if i < 3 else "AUDITED"  # first 3 pending QA, last 2 verified
        submitted_by = ["EXL-N009", "EXL-N003", "EXL-N001", "EXL-N014"][i % 4]
        submitted_at = now - timedelta(hours=random.randint(1, 72))

        cases.append({
            "id": case_id, "case_number": case_num, "patient_mrn": mrn,
            "patient_name": name, "patient_dob": dob, "patient_age": age,
            "primary_diagnosis_code": dx_code,
            "primary_diagnosis_display": dx_display,
            "secondary_diagnoses": secondary,
            "structured_case": json.dumps(structured),
            "status": status, "submitted_by": submitted_by,
            "submitted_at": submitted_at.isoformat(),
        })

    return cases


# ═══════════════════════════════════════════════════════════════════════════════
# POLICY MATCHES (30 — one per case)
# ═══════════════════════════════════════════════════════════════════════════════

def build_policy_matches(cases):
    """Build policy matches for all 30 cases."""
    matches = []

    for c in cases:
        case_id = c["id"]
        dx_code = c["primary_diagnosis_code"]
        structured = json.loads(c["structured_case"])
        vitals = structured.get("vitals", {})
        labs = structured.get("labs", {})

        if dx_code == "I50.23":  # CHF
            o2 = vitals.get("o2_sat", 95)
            bnp = labs.get("bnp", 0)
            ef = labs.get("ef", 50)
            criteria = [
                {"criterion": "Oxygen Saturation Below 90%", "section": "5A", "status": "MET" if o2 < 90 else "NOT_MET", "evidence": f"O2 sat {o2}% on room air", "confidence": 0.97 if o2 < 90 else 0.95},
                {"criterion": "Elevated BNP (>500 pg/mL)", "section": "5B", "status": "MET" if bnp > 500 else "NOT_MET", "evidence": f"BNP {bnp:,} pg/mL", "confidence": 0.99 if bnp > 500 else 0.90},
                {"criterion": "Reduced Ejection Fraction with Acute Decompensation", "section": "5C", "status": "MET" if ef < 40 else "NOT_MET", "evidence": f"EF {ef}% on echo", "confidence": 0.97 if ef < 40 else 0.85},
                {"criterion": "IV Diuretic Requirement", "section": "5D", "status": "MET" if bnp > 1500 else "INSUFFICIENT_EVIDENCE", "evidence": f"{'IV Lasix initiated' if bnp > 1500 else 'Oral diuretics — IV transition not documented'}", "confidence": 0.96 if bnp > 1500 else 0.65},
            ]
            met_count = sum(1 for c2 in criteria if c2["status"] == "MET")
            unmet = [c2 for c2 in criteria if c2["status"] != "MET"]
            met = [c2 for c2 in criteria if c2["status"] == "MET"]
            rec = "INPATIENT_ADMISSION_SUPPORTED" if met_count >= 3 else "OBSERVATION_RECOMMENDED"
            conf = round(0.85 + met_count * 0.03, 2)
            matches.append({
                "id": f"pm-{case_id.split('-')[1]}", "case_id": case_id,
                "applicable_policy": "UM-CHF-001", "policy_name": POLICIES[0]["policy_name"],
                "matched_criteria": json.dumps(met), "unmet_criteria": json.dumps(unmet),
                "recommendation": rec, "overall_confidence": min(conf, 0.98),
            })

        elif dx_code == "J44.1":  # COPD
            o2 = vitals.get("o2_sat", 95)
            ph = labs.get("ph", 7.40)
            pco2 = labs.get("pco2", 40)
            criteria = [
                {"criterion": "Hypoxemia (O2 Sat <88%)", "section": "4A", "status": "MET" if o2 < 88 else "NOT_MET", "evidence": f"O2 sat {o2}% on room air", "confidence": 0.98 if o2 < 88 else 0.90},
                {"criterion": "Failed Outpatient Treatment", "section": "4B", "status": "MET" if pco2 > 50 else "NOT_MET", "evidence": f"{'Failed outpatient prednisone/azithromycin' if pco2 > 50 else 'No documented outpatient failure'}", "confidence": 0.97 if pco2 > 50 else 0.70},
                {"criterion": "Respiratory Acidosis", "section": "4C", "status": "MET" if ph < 7.35 else "NOT_MET", "evidence": f"ABG: pH {ph}, pCO2 {pco2} mmHg", "confidence": 0.99 if ph < 7.35 else 0.85},
                {"criterion": "IV Corticosteroid Requirement", "section": "4D", "status": "MET" if ph < 7.35 else "NOT_MET", "evidence": f"{'IV methylprednisolone initiated' if ph < 7.35 else 'Oral steroids adequate'}", "confidence": 0.96 if ph < 7.35 else 0.80},
            ]
            met_count = sum(1 for c2 in criteria if c2["status"] == "MET")
            unmet = [c2 for c2 in criteria if c2["status"] != "MET"]
            met = [c2 for c2 in criteria if c2["status"] == "MET"]
            rec = "INPATIENT_ADMISSION_SUPPORTED" if met_count >= 3 else "OBSERVATION_RECOMMENDED"
            conf = round(0.82 + met_count * 0.04, 2)
            matches.append({
                "id": f"pm-{case_id.split('-')[1]}", "case_id": case_id,
                "applicable_policy": "UM-COPD-001", "policy_name": POLICIES[1]["policy_name"],
                "matched_criteria": json.dumps(met), "unmet_criteria": json.dumps(unmet),
                "recommendation": rec, "overall_confidence": min(conf, 0.98),
            })

        elif dx_code == "A41.9":  # Sepsis
            lact = labs.get("lactate", 0)
            wbc = labs.get("wbc", 10)
            bp_sys = int(vitals.get("bp", "120/80").split("/")[0])
            
            # Determine source of infection from clinical summary if possible
            inf_source = ""
            summary_lower = (structured.get("clinical_summary") or "").lower()
            if "uti" in summary_lower or "urinary" in summary_lower:
                inf_source = " (secondary to UTI)"
            elif "pneumonia" in summary_lower:
                inf_source = " (secondary to Pneumonia)"
            elif "abdominal" in summary_lower:
                inf_source = " (secondary to Abdominal source)"
            elif "cellulitis" in summary_lower or "skin" in summary_lower:
                inf_source = " (secondary to Cellulitis/Skin)"

            # Check for abnormal vitals/labs supporting infection (SIRS criteria)
            temp = float(vitals.get("temp", 98.6))
            hr = float(vitals.get("hr", 70))
            rr = float(vitals.get("rr", 16))
            procal = float(labs.get("procalcitonin", 0))
            
            signs = []
            if temp > 100.4:
                signs.append(f"fever ({temp}°F)")
            if wbc > 12.0 or wbc < 4.0:
                signs.append(f"leukocytosis (WBC {wbc} K/uL)")
            if procal > 0.15:
                signs.append(f"elevated procalcitonin ({procal} ng/mL)")
            if hr > 100:
                signs.append(f"tachycardia ({hr} bpm)")
            if rr > 24:
                signs.append(f"tachypnea ({rr} breaths/min)")
                
            supporting_text = ""
            if signs:
                supporting_text = " supported by " + " and ".join(signs[:2])

            criteria = [
                {"criterion": "Suspected Infection", "section": "6A", "status": "MET", "evidence": f"Infection suspected{inf_source}{supporting_text} based on diagnosis of Sepsis", "confidence": 0.96},
                {"criterion": "Elevated Lactate", "section": "6B", "status": "MET" if lact >= 2.0 else "NOT_MET", "evidence": f"Lactate {lact} mmol/L", "confidence": 0.99 if lact >= 2.0 else 0.80},
                {"criterion": "Persistent Hypotension", "section": "6C", "status": "MET" if bp_sys < 90 else "NOT_MET", "evidence": f"BP {vitals.get('bp')}", "confidence": 0.97 if bp_sys < 90 else 0.75},
                {"criterion": "Altered Mental Status", "section": "6D", "status": "MET" if lact > 4.0 else "NOT_MET", "evidence": f"{'Confused to time and situation' if lact > 4.0 else 'Alert and oriented'}", "confidence": 0.95 if lact > 4.0 else 0.80},
                {"criterion": "IV Antibiotic Requirement", "section": "6E", "status": "MET", "evidence": "Broad-spectrum IV antibiotics initiated", "confidence": 0.98},
            ]
            met_count = sum(1 for c2 in criteria if c2["status"] == "MET")
            unmet = [c2 for c2 in criteria if c2["status"] != "MET"]
            met = [c2 for c2 in criteria if c2["status"] == "MET"]
            rec = "INPATIENT_ADMISSION_SUPPORTED" if met_count >= 3 else "OBSERVATION_RECOMMENDED"
            conf = round(0.80 + met_count * 0.035, 2)
            matches.append({
                "id": f"pm-{case_id.split('-')[1]}", "case_id": case_id,
                "applicable_policy": "UM-SEPSIS-001", "policy_name": POLICIES[2]["policy_name"],
                "matched_criteria": json.dumps(met), "unmet_criteria": json.dumps(unmet),
                "recommendation": rec, "overall_confidence": min(conf, 0.98),
            })

        else:  # Obs/IP
            bnp = labs.get("bnp", 100)
            ef = labs.get("ef", 55)
            o2 = vitals.get("o2_sat", 95)
            criteria = [
                {"criterion": "Expected Stay >24 Hours", "section": "7A", "status": "MET" if bnp > 500 else "NOT_MET", "evidence": f"{'Clinical trajectory suggests >24h stay' if bnp > 500 else 'Likely <24h observation adequate'}", "confidence": 0.80 if bnp > 500 else 0.75},
                {"criterion": "IV Medication Requirement", "section": "7B", "status": "MET" if bnp > 600 else "NOT_MET", "evidence": f"{'IV diuretics needed' if bnp > 600 else 'Oral medications sufficient'}", "confidence": 0.82 if bnp > 600 else 0.70},
                {"criterion": "Active Monitoring Required", "section": "7C", "status": "MET" if o2 < 93 else "NOT_MET", "evidence": f"O2 sat {o2}% — {'continuous monitoring needed' if o2 < 93 else 'stable for observation'}", "confidence": 0.85 if o2 < 93 else 0.75},
                {"criterion": "Failed Observation Protocol", "section": "7D", "status": "NOT_MET", "evidence": "No prior observation documented", "confidence": 0.60},
            ]
            met_count = sum(1 for c2 in criteria if c2["status"] == "MET")
            unmet = [c2 for c2 in criteria if c2["status"] != "MET"]
            met = [c2 for c2 in criteria if c2["status"] == "MET"]
            rec = "INPATIENT_ADMISSION_SUPPORTED" if met_count >= 3 else "OBSERVATION_RECOMMENDED"
            conf = round(0.70 + met_count * 0.05, 2)
            matches.append({
                "id": f"pm-{case_id.split('-')[1]}", "case_id": case_id,
                "applicable_policy": "UM-OBS-IP-001", "policy_name": POLICIES[3]["policy_name"],
                "matched_criteria": json.dumps(met), "unmet_criteria": json.dumps(unmet),
                "recommendation": rec, "overall_confidence": min(conf, 0.95),
            })

    return matches


# ═══════════════════════════════════════════════════════════════════════════════
# NURSE DECISIONS (20 — for non-pending cases)
# ═══════════════════════════════════════════════════════════════════════════════

def build_decisions(cases):
    """Build 20 nurse decisions for decided/audited cases."""
    decisions = []
    reviewers = ["EXL-N002", "EXL-N014", "EXL-N019", "EXL-N005"]

    non_pending = [c for c in cases if c["status"] != "PENDING_REVIEW"]

    # Decision distribution: 12 APPROVED, 8 DENIED
    decision_types = (
        ["APPROVED"] * 12 + ["DENIED"] * 8
    )
    random.seed(42)  # reproducible
    random.shuffle(decision_types)

    rationale_templates = {
        "APPROVED": {
            "I50.23": "Patient meets inpatient criteria per UM-CHF-001: O2 sat {o2}% requiring supplemental oxygen, BNP {bnp} severely elevated, EF {ef}% with acute decompensation. IV diuretics required.",
            "J44.1": "Patient meets inpatient criteria per UM-COPD-001: hypoxemic with O2 sat {o2}%, respiratory acidosis pH {ph}/pCO2 {pco2}, requiring IV steroids.",
            "A41.9": "Patient meets sepsis criteria per UM-SEPSIS-001: confirmed infection source, lactate {lactate}, IV antibiotics required. Clinical presentation supports inpatient.",
            "default": "Clinical presentation supports inpatient admission. Patient meets medical necessity criteria based on available evidence.",
        },
        "DENIED": {
            "I50.23": "Patient vitals appear stable. BNP elevated but trending, recommend outpatient follow-up with oral medications.",
            "J44.1": "Borderline presentation. Recommend observation status with reassessment in 24 hours.",
            "A41.9": "Lactate mildly elevated but trending down. Observation status may be appropriate.",
            "default": "Clinical evidence does not meet full inpatient criteria. Observation recommended.",
        },
    }

    for i, c in enumerate(non_pending):
        if i >= 20:
            break
        decision_type = decision_types[i % len(decision_types)]
        reviewer_id = c.get("submitted_by", "EXL-N009")
        structured = json.loads(c["structured_case"])
        vitals = structured.get("vitals", {})
        labs = structured.get("labs", {})
        dx_code = c["primary_diagnosis_code"]

        template_dict = rationale_templates[decision_type]
        template = template_dict.get(dx_code, template_dict.get("default"))
        rationale = template.format(
            o2=vitals.get("o2_sat", "N/A"),
            bnp=labs.get("bnp", "N/A"),
            ef=labs.get("ef", "N/A"),
            ph=labs.get("ph", "N/A"),
            pco2=labs.get("pco2", "N/A"),
            lactate=labs.get("lactate", "N/A"),
        )
        if dx_code == "I50.23":
            policy_cited = "UM-CHF-001"
            criteria_ack = "5A,5B,5C,5D" if decision_type == "APPROVED" else ""
        elif dx_code == "J44.1":
            policy_cited = "UM-COPD-001"
            criteria_ack = "4A,4B,4C,4D" if decision_type == "APPROVED" else ""
        elif dx_code == "A41.9":
            policy_cited = "UM-SEPSIS-001"
            criteria_ack = "6A,6B,6C,6D,6E" if decision_type == "APPROVED" else ""
        else:
            policy_cited = "UM-OBS-IP-001"
            criteria_ack = ""

        dec_id = f"dec-{str(i+1).zfill(3)}"
        decisions.append({
            "id": dec_id,
            "case_id": c["id"],
            "reviewer_id": reviewer_id,
            "decision": decision_type,
            "rationale": rationale,
            "policy_cited": policy_cited,
            "criteria_acknowledged": criteria_ack,
        })

    return decisions


# ═══════════════════════════════════════════════════════════════════════════════
# AUDIT RESULTS (20 — one per decision)
# ═══════════════════════════════════════════════════════════════════════════════

def build_audit_results(decisions, cases):
    """Build 20 QA audit results."""
    results = []
    case_map = {c["id"]: c for c in cases}

    for i, dec in enumerate(decisions):
        c = case_map.get(dec["case_id"])
        if not c:
            continue

        structured = json.loads(c["structured_case"])
        vitals = structured.get("vitals", {})
        labs = structured.get("labs", {})

        # Compute realistic scores based on decision quality
        if dec["decision"] == "APPROVED":
            clinical_accuracy = random.randint(85, 98)
            doc_completeness = random.randint(75, 96)
            policy_compliance = random.randint(82, 98)
            consistency = random.randint(78, 96)
            findings = []
            if doc_completeness < 85:
                findings.append({"type": "DOCUMENTATION_GAP", "severity": "LOW", "description": "Rationale could include more specific lab values", "recommendation": "Consider citing exact values for all referenced criteria"})
        elif dec["decision"] == "DENIED":
            # Check if denial contradicts evidence
            dx_code = c["primary_diagnosis_code"]
            o2 = vitals.get("o2_sat", 95)
            bnp = labs.get("bnp", 0)
            lact = labs.get("lactate", 0)
            bp_val = vitals.get("bp", "120/80")
            bp_sys = 120
            if bp_val and "/" in bp_val:
                try:
                    bp_sys = int(bp_val.split("/")[0])
                except:
                    pass
            
            is_wrongful_chf = (o2 < 90 and bnp > 2000)
            is_wrongful_sepsis = (dx_code == "A41.9" and lact >= 2.0 and bp_sys < 90)

            if is_wrongful_chf or is_wrongful_sepsis:  # wrongful denial
                clinical_accuracy = random.randint(28, 42)
                doc_completeness = random.randint(25, 40)
                policy_compliance = random.randint(30, 45)
                consistency = random.randint(55, 70)
                findings = [
                    {"type": "POLICY_MISMATCH", "severity": "CRITICAL", "description": f"Reviewer denied but Sepsis criteria met with Lactate {lact} and BP {bp_val}", "recommendation": "Decision contradicts clinical evidence. Review policy criteria."},
                    {"type": "CLINICAL_MISS", "severity": "CRITICAL", "description": "Critical values not addressed in rationale", "recommendation": "Rationale must reference specific vitals and labs."},
                    {"type": "DOCUMENTATION_GAP", "severity": "HIGH", "description": "Insufficient clinical justification for denial", "recommendation": "Include specific criteria references in rationale."},
                ]
            else:
                clinical_accuracy = random.randint(65, 82)
                doc_completeness = random.randint(55, 75)
                policy_compliance = random.randint(60, 80)
                consistency = random.randint(60, 78)
                findings = [
                    {"type": "DOCUMENTATION_GAP", "severity": "MEDIUM", "description": "Denial rationale lacks specific clinical values", "recommendation": "Reference specific lab values and thresholds in denial rationale."},
                ]

        qa_score = int(
            clinical_accuracy * 0.35 +
            doc_completeness * 0.30 +
            policy_compliance * 0.20 +
            consistency * 0.15
        )

        if qa_score >= 90:
            risk_level, audit_result = "LOW", "PASS"
        elif qa_score >= 80:
            risk_level, audit_result = "MEDIUM", "PASS"
        elif qa_score >= 60:
            risk_level, audit_result = "HIGH", "FAIL"
        else:
            risk_level, audit_result = "CRITICAL", "FAIL"

        # Missing evidence
        missing = []
        if labs.get("bnp") and "bnp" not in dec["rationale"].lower():
            missing.append(f"BNP {labs['bnp']} not referenced")
        if vitals.get("o2_sat") and "o2" not in dec["rationale"].lower() and "sat" not in dec["rationale"].lower():
            missing.append(f"O2 sat {vitals['o2_sat']}% not referenced")

        # Set qa_verified based on whether the case is AUDITED
        is_audited = c.get("status") == "AUDITED"

        results.append({
            "id": f"aud-{str(i+1).zfill(3)}",
            "case_id": dec["case_id"],
            "decision_id": dec["id"],
            "qa_score": qa_score,
            "risk_level": risk_level,
            "audit_result": audit_result,
            "clinical_accuracy": clinical_accuracy,
            "documentation_completeness": doc_completeness,
            "policy_compliance": policy_compliance,
            "consistency_score": consistency,
            "timeliness_score": random.randint(70, 100),
            "qa_ai_explanation": f"The QA score of {qa_score} reflects {'excellent' if qa_score >= 90 else 'adequate' if qa_score >= 80 else 'poor'} clinical decision making. The reviewer {'accurately' if clinical_accuracy >= 80 else 'inaccurately'} assessed the patient's condition. Documentation was {'thorough' if doc_completeness >= 80 else 'lacking specific details'}. Policy alignment was {'strong' if policy_compliance >= 80 else 'weak'}.",
            "findings": json.dumps(findings),
            "policy_alignment": "ALIGNED" if dec["decision"] == "APPROVED" else "MISALIGNED",
            "missing_evidence": json.dumps(missing),
            "qa_verified": is_audited,
            "qa_verified_by": "EXL-Q001" if is_audited else None,
        })

    return results


# ═══════════════════════════════════════════════════════════════════════════════
# APPEAL RECORDS (20 — one per decision)
# ═══════════════════════════════════════════════════════════════════════════════

def build_appeals(decisions, cases):
    """Build 20 appeal risk records."""
    appeals = []
    case_map = {c["id"]: c for c in cases}

    DIAGNOSIS_EXPOSURE = {
        "I50.23": 16000, "J44.1": 9500, "A41.9": 22000,
        "R07.9": 7000, "R55": 6500, "I48.91": 8000, "I50.9": 12000,
    }

    for i, dec in enumerate(decisions):
        c = case_map.get(dec["case_id"])
        if not c:
            continue

        structured = json.loads(c["structured_case"])
        vitals = structured.get("vitals", {})
        labs = structured.get("labs", {})
        dx_code = c["primary_diagnosis_code"]

        risk_factors = []
        score = 0.0

        if dec["decision"] == "DENIED":
            score += 0.35
            # Check clinical evidence strength
            o2 = vitals.get("o2_sat", 95)
            if o2 and float(o2) < 90:
                score += 0.15
                risk_factors.append(f"O2 saturation {o2}% meets inpatient criterion")
            bnp = labs.get("bnp", 0)
            if bnp and float(bnp) > 2000:
                score += 0.15
                risk_factors.append(f"BNP {bnp:,} pg/mL is critically elevated")
            elif bnp and float(bnp) > 500:
                score += 0.08
                risk_factors.append(f"BNP {bnp} pg/mL exceeds threshold")
            lact = labs.get("lactate", 0)
            if lact and float(lact) >= 4.0:
                score += 0.15
                risk_factors.append(f"Lactate {lact} mmol/L indicates severe sepsis")
        else:
            score += 0.02

        if dec["decision"] == "APPROVED":
            score = min(score, 0.15)
            risk_factors = []

        overturn_prob = min(max(round(score, 2), 0.01), 0.97)

        if overturn_prob >= 0.65:
            risk_cat = "CRITICAL"
        elif overturn_prob >= 0.45:
            risk_cat = "HIGH"
        elif overturn_prob >= 0.25:
            risk_cat = "MEDIUM"
        else:
            risk_cat = "LOW"

        base_exposure = DIAGNOSIS_EXPOSURE.get(dx_code, 8000)
        financial = round(base_exposure * (1 + overturn_prob * 0.5), 2)

        if risk_cat == "CRITICAL":
            rec = "URGENT: Request Medical Director peer review before finalizing."
        elif risk_cat == "HIGH":
            rec = "Recommend peer review before finalizing denial."
        elif risk_cat == "MEDIUM":
            rec = "Ensure documentation is complete. Moderate appeal risk."
        else:
            rec = "Low appeal risk. Ensure documentation is complete."

        appeals.append({
            "id": f"app-{str(i+1).zfill(3)}",
            "case_id": dec["case_id"],
            "decision_id": dec["id"],
            "overturn_probability": overturn_prob,
            "risk_category": risk_cat,
            "financial_exposure_estimate": financial,
            "top_risk_factors": json.dumps(risk_factors[:5]),
            "recommendation": rec,
            "model_confidence": round(random.uniform(0.82, 0.95), 2),
        })

    return appeals


# ═══════════════════════════════════════════════════════════════════════════════
# REVIEWER STATS & TRAINING MODULES
# ═══════════════════════════════════════════════════════════════════════════════

REVIEWER_STATS = [
    ("rs-001", "EXL-N006", "30d", 94.2, 0.68, 0.32, 0.04, 91.0, 97.0, 92.0, 124, 87,
     json.dumps(["Minor documentation gaps in rationale specificity"]), "IMPROVING"),
    ("rs-002", "EXL-N013", "30d", 78.3, 0.58, 0.42, 0.18, 72.0, 74.0, 68.0, 98, 32,
     json.dumps(["Observation vs Inpatient boundary cases", "CHF criteria application", "Documentation completeness"]), "DECLINING"),
    ("rs-003", "EXL-N017", "30d", 85.4, 0.71, 0.29, 0.09, 74.0, 88.0, 82.0, 115, 65,
     json.dumps(["Rationale writing quality", "Lab value citations in rationale"]), "STABLE"),
    ("rs-004", "EXL-N008", "30d", 82.1, 0.89, 0.11, 0.12, 80.0, 85.0, 68.0, 132, 45,
     json.dumps(["Over-approving pattern vs team average", "Consistency with peer decisions"]), "STABLE"),
]

TRAINING_MODULES = [
    ("tm-001", "EXL-N001", "TRAIN-RN002-001",
     "Observation vs Inpatient — Borderline CHF Cases",
     "3 of last 5 CHF cases had policy compliance score < 80", 4,
     json.dumps([
         {"type": "POLICY_REVIEW", "content": "UM-OBS-IP-001 Section 5: Key differentiators include duration of IV diuretic need (>24h → inpatient), O2 requirement persistence, and BNP trajectory."},
         {"type": "CASE_STUDY", "case_id": "ANON-CHF-042", "lesson": "O2 sat 89% with rapid improvement after single IV Lasix dose → observation appropriate."},
         {"type": "QUIZ", "questions": [
             {"q": "A CHF patient has O2 sat 88%, BNP 1200, responds to single IV Lasix. Appropriate status?", "options": ["Inpatient", "Observation", "Outpatient"], "correct": 1},
         ]}
     ]),
     "ASSIGNED"),
    ("tm-002", "EXL-N011", "TRAIN-RN002-002",
     "Clinical Documentation Best Practices for Denial Rationale",
     "Documentation completeness score consistently below 75%", 3,
     json.dumps([
         {"type": "POLICY_REVIEW", "content": "All denial rationales must include: (1) specific clinical values, (2) policy section, (3) why criteria not met, (4) alternative level of care."},
         {"type": "CASE_STUDY", "case_id": "ANON-DOC-007", "lesson": "Poor: 'Vitals stable.' Better: 'O2 sat 93% (above 90% per UM-CHF-001 5A), BNP 450 (below 500 per 5B), EF 45% (preserved). Observation recommended.'"},
     ]),
     "ASSIGNED"),
    ("tm-003", "EXL-N010", "TRAIN-RN003-001",
     "Sepsis Bundle Compliance and Documentation",
     "Documentation of sepsis criteria needs improvement", 3,
     json.dumps([
         {"type": "POLICY_REVIEW", "content": "UM-SEPSIS-001 requires documentation of all bundle elements: lactate, blood cultures, antibiotics timing, fluid resuscitation response."},
         {"type": "CASE_STUDY", "case_id": "ANON-SEP-015", "lesson": "Document lactate clearance trajectory and antibiotic timing to strengthen rationale."},
     ]),
     "ASSIGNED"),
    ("tm-004", "EXL-N003", "TRAIN-RN004-001",
     "Avoiding Over-Approval Patterns in COPD Cases",
     "Approval rate 89% exceeds team average of 72%", 3,
     json.dumps([
         {"type": "POLICY_REVIEW", "content": "UM-COPD-001: Not all COPD exacerbations require inpatient. Key differentiators: pH <7.35, failed outpatient Rx, accessory muscle use."},
         {"type": "CASE_STUDY", "case_id": "ANON-COPD-023", "lesson": "Mild exacerbation with pH 7.38, O2 sat 92% → observation appropriate, not inpatient."},
     ]),
     "ASSIGNED"),
    ("tm-005", "EXL-N011", "TRAIN-RN001-001",
     "Advanced CHF Criteria Application",
     "Continuous improvement — refining borderline case handling", 2,
     json.dumps([
         {"type": "POLICY_REVIEW", "content": "UM-CHF-001 borderline cases: BNP 400-600, EF 40-45%, O2 sat 89-91% require careful evaluation of trajectory."},
     ]),
     "ASSIGNED"),
    ("tm-006", "EXL-N019", "TRAIN-RN001-002",
     "COPD Exacerbation Severity Assessment",
     "Ensure correct severity classification for COPD presentations", 3,
     json.dumps([
         {"type": "POLICY_REVIEW", "content": "Differentiate GOLD stages and acute exacerbation severity using ABG, accessory muscle use, and response to initial treatment."},
     ]),
     "ASSIGNED"),
    ("tm-007", "EXL-N018", "TRAIN-RN003-002",
     "Lab Value Citation Standards",
     "Rationale often missing specific lab value references", 2,
     json.dumps([
         {"type": "POLICY_REVIEW", "content": "Every rationale should cite the exact lab value, the normal range, and the policy threshold. Example: 'Lactate 4.2 (normal <2.0, UM-SEPSIS-001 6B threshold ≥2.0)'."},
     ]),
     "ASSIGNED"),
    ("tm-008", "EXL-N005", "TRAIN-RN004-002",
     "Observation Status Criteria Deep Dive",
     "Improve understanding of Obs vs IP determination", 3,
     json.dumps([
         {"type": "POLICY_REVIEW", "content": "UM-OBS-IP-001: Observation = <24h expected stay, oral meds sufficient, no ICU-level monitoring. Inpatient = >24h stay, IV meds, continuous monitoring."},
     ]),
     "ASSIGNED"),
]


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN SEEDER
# ===============================================================================

def clear_database(conn):
    """Clear all existing data."""
    tables = [
        "training_assessments", "training_modules", "reviewer_stats", "peer_reviews",
        "audit_overrides", "appeals", "appeal_intake_cases", "audit_results",
        "nurse_decisions", "policy_matches", "documents", "messages",
        "conversations", "audit_log", "cases", "historical_pa", "policies"
    ]
    for table in tables:
        try:
            conn.execute(f"DELETE FROM {table}")
        except Exception:
            pass

    try:
        conn.execute("DELETE FROM users WHERE role = 'NURSE'")
        conn.execute("DELETE FROM users WHERE role = 'QA_LEAD'")
        conn.execute("DELETE FROM users")
    except Exception:
        pass
    print("  [DEL] Cleared all existing data")


def seed_users(conn):
    for u in USERS:
        conn.execute("""
            INSERT INTO users (id, email, hashed_password, full_name, role, npi, qa_lead_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, [u["id"], u["email"], get_password_hash(u["password"]),
              u["full_name"], u["role"], u["npi"], u.get("qa_lead_id")])
    print(f"  [OK] Seeded {len(USERS)} users")


def seed_policies(conn):
    for p in POLICIES:
        conn.execute("""
            INSERT INTO policies (id, policy_code, policy_name, description)
            VALUES (?, ?, ?, ?)
        """, [p["id"], p["policy_code"], p["policy_name"], p["description"]])
    print(f"  [OK] Seeded {len(POLICIES)} policies")


def seed_cases(conn, cases):
    for c in cases:
        conn.execute("""
            INSERT INTO cases (id, case_number, patient_mrn, patient_name, patient_dob, patient_age,
                               primary_diagnosis_code, primary_diagnosis_display, secondary_diagnoses,
                               structured_case, status, submitted_by, submitted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, [
            c["id"], c["case_number"], c["patient_mrn"], c["patient_name"],
            c["patient_dob"], c["patient_age"], c["primary_diagnosis_code"],
            c["primary_diagnosis_display"], c["secondary_diagnoses"],
            c["structured_case"], c["status"], c["submitted_by"], c["submitted_at"],
        ])
    print(f"  [OK] Seeded {len(cases)} cases")


def seed_policy_matches(conn, matches):
    for m in matches:
        conn.execute("""
            INSERT INTO policy_matches (id, case_id, applicable_policy, policy_name,
                                        matched_criteria, unmet_criteria, recommendation, overall_confidence)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, [m["id"], m["case_id"], m["applicable_policy"], m["policy_name"],
              m["matched_criteria"], m["unmet_criteria"], m["recommendation"], m["overall_confidence"]])
    print(f"  [OK] Seeded {len(matches)} policy matches")


def seed_decisions(conn, decisions):
    for d in decisions:
        conn.execute("""
            INSERT INTO nurse_decisions (id, case_id, reviewer_id, decision, rationale, policy_cited, criteria_acknowledged)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, [d["id"], d["case_id"], d["reviewer_id"], d["decision"],
              d["rationale"], d["policy_cited"], d["criteria_acknowledged"]])
    print(f"  [OK] Seeded {len(decisions)} nurse decisions")


def seed_audit_results(conn, results):
    for r in results:
        conn.execute("""
            INSERT INTO audit_results (id, case_id, decision_id, qa_score, risk_level, audit_result,
                                       clinical_accuracy, documentation_completeness, policy_compliance,
                                       consistency_score, timeliness_score, qa_ai_explanation, findings,
                                       policy_alignment, missing_evidence, qa_verified, qa_verified_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, [r["id"], r["case_id"], r["decision_id"], r["qa_score"], r["risk_level"],
              r["audit_result"], r["clinical_accuracy"], r["documentation_completeness"],
              r["policy_compliance"], r["consistency_score"], r.get("timeliness_score"), r.get("qa_ai_explanation"), r["findings"],
              r["policy_alignment"], r["missing_evidence"], r.get("qa_verified", False), r.get("qa_verified_by")])
    print(f"  [OK] Seeded {len(results)} audit results")


def seed_appeals(conn, appeals):
    for a in appeals:
        conn.execute("""
            INSERT INTO appeals (id, case_id, decision_id, overturn_probability, risk_category,
                                 financial_exposure_estimate, top_risk_factors, recommendation, model_confidence)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, [a["id"], a["case_id"], a["decision_id"], a["overturn_probability"],
              a["risk_category"], a["financial_exposure_estimate"], a["top_risk_factors"],
              a["recommendation"], a["model_confidence"]])
    print(f"  [OK] Seeded {len(appeals)} appeal records")


def seed_reviewer_stats(conn):
    for s in REVIEWER_STATS:
        conn.execute("""
            INSERT INTO reviewer_stats (id, reviewer_id, period, qa_score_avg, approval_rate, denial_rate,
                                        overturn_rate, documentation_score, policy_compliance, consistency_score,
                                        case_volume, peer_percentile, top_gaps, trend)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, list(s))
    print(f"  [OK] Seeded {len(REVIEWER_STATS)} reviewer stats")


def seed_training_modules(conn):
    for t in TRAINING_MODULES:
        conn.execute("""
            INSERT INTO training_modules (id, reviewer_id, module_id, topic, trigger_reason,
                                          estimated_duration_minutes, sections, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, list(t))
    print(f"  [OK] Seeded {len(TRAINING_MODULES)} training modules")


def main():
    print("[SEED] CareAudit AI -- Full Database Seeder (30 Cases)")
    print("=" * 60)

    print("\n[INIT] Initializing database schema...")
    init_database()

    conn = get_connection()

    print("\n[DEL] Clearing existing data...")
    clear_database(conn)

    print("\n[INSERT] Seeding data...")
    seed_users(conn)
    seed_policies(conn)

    cases = build_cases()
    seed_cases(conn, cases)

    matches = build_policy_matches(cases)
    seed_policy_matches(conn, matches)

    decisions = build_decisions(cases)
    seed_decisions(conn, decisions)

    audit_results = build_audit_results(decisions, cases)
    seed_audit_results(conn, audit_results)

    appeals = build_appeals(decisions, cases)
    seed_appeals(conn, appeals)

    seed_reviewer_stats(conn)
    seed_training_modules(conn)

    print("\n[EXECUTIVE] Running Executive Seeder to populate historical data...")
    import seed_executive
    seed_executive.run_all_seeders()

    # Summary
    print("\n" + "=" * 60)
    print("[SUMMARY] Database Contents:")
    for table in ["users", "policies", "cases", "policy_matches", "nurse_decisions", "audit_results", "appeals", "reviewer_stats", "training_modules"]:
        count = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        print(f"   {table}: {count} records")

    pending = conn.execute("SELECT COUNT(*) FROM cases WHERE status = 'PENDING_REVIEW'").fetchone()[0]
    audited = conn.execute("SELECT COUNT(*) FROM cases WHERE status = 'AUDITED'").fetchone()[0]
    decided = conn.execute("SELECT COUNT(*) FROM cases WHERE status = 'DECIDED'").fetchone()[0]
    print(f"\n   Case Status Breakdown:")
    print(f"     PENDING_REVIEW: {pending}")
    print(f"     AUDITED: {audited}")
    print(f"     DECIDED: {decided}")

    conn.close()
    print("\n[DONE] Database seeded successfully!")


if __name__ == "__main__":
    main()
