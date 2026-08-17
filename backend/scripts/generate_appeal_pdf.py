"""
Generate test Appeal Request PDFs for CareAudit AI.
Uses the same reportlab approach as generate_pdfs.py, with content structured
as appeal / reconsideration documents so the document parser detects them as
APPEAL_DOCUMENT type.
"""
import os
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib import colors


def create_appeal_pdf(filename, patient_name, mrn, dob, member_id,
                      appeal_date, denial_date, appeal_level, content_lines):
    """Create a formal appeal request PDF with header, patient/appeal info, and body."""
    c = canvas.Canvas(filename, pagesize=letter)
    width, height = letter

    # ── Header ──
    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, height - 50, "Excellence Health System")

    c.setFont("Helvetica-Oblique", 12)
    c.drawString(50, height - 70, "Appeal Request — Reconsideration of Adverse Determination")

    # ── Patient / Appeal Info Box ──
    box_top = height - 85
    c.setStrokeColor(colors.black)
    c.rect(50, box_top - 65, width - 100, 60)

    c.setFont("Helvetica-Bold", 10)
    c.drawString(60, box_top - 15, f"Patient Name: {patient_name}")
    c.drawString(60, box_top - 30, f"MRN: {mrn}")
    c.drawString(60, box_top - 45, f"Member ID: {member_id}")

    c.drawString(300, box_top - 15, f"DOB: {dob}")
    c.drawString(300, box_top - 30, f"Original Denial Date: {denial_date}")
    c.drawString(300, box_top - 45, f"Appeal Filed Date: {appeal_date}")

    # Appeal level tag
    c.setFont("Helvetica-Bold", 10)
    c.drawString(60, box_top - 60 - 15, f"Appeal Level: {appeal_level}")

    # ── Body Content ──
    c.setFont("Helvetica", 10)
    y = box_top - 60 - 40

    for line in content_lines:
        if line.startswith("SECTION:"):
            c.setFont("Helvetica-Bold", 11)
            line = line.replace("SECTION:", "").strip()
        elif line.startswith("- "):
            c.setFont("Helvetica", 10)
        else:
            c.setFont("Helvetica", 10)

        c.drawString(50, y, line)
        y -= 15
        if y < 50:
            c.showPage()
            c.setFont("Helvetica", 10)
            y = height - 50

    c.save()
    print(f"Generated: {filename}")


def main():
    output_dir = os.path.join(os.path.dirname(__file__), "..", "..", "sample_documents")
    os.makedirs(output_dir, exist_ok=True)

    # ─────────────────────────────────────────────────────────────────────────
    # Appeal PDF 1 — CHF Denial Appeal (Level 1)
    # ─────────────────────────────────────────────────────────────────────────
    chf_appeal = [
        "SECTION: REASON FOR APPEAL",
        "This is a formal appeal to overturn the adverse determination (denial) issued on",
        "2026-07-28 for inpatient admission for Acute on Chronic Systolic Heart Failure (I50.23).",
        "The denial letter stated that the patient did not meet medical necessity criteria.",
        "",
        "SECTION: CLINICAL RATIONALE FOR RECONSIDERATION",
        "The denial failed to account for the following clinical evidence:",
        "- BNP: 3,200 pg/mL — critically elevated, consistent with severe decompensated HF",
        "- O2 Sat: 87% on room air — moderate hypoxemia requiring supplemental oxygen",
        "- Bilateral 3+ pitting edema to the knees with JVD present",
        "- Chest X-Ray showing bilateral pleural effusions and pulmonary vascular congestion",
        "- Patient required IV Furosemide 80mg bolus followed by continuous drip",
        "- EF documented at 20% on bedside echocardiogram (baseline 25%)",
        "",
        "SECTION: POLICY REFERENCE",
        "Per policy UM-CHF-001 (Acute Congestive Heart Failure Admission), the patient meets",
        "the following criteria for inpatient admission:",
        "- Criterion 1: O2 saturation below 90% — MET (87%)",
        "- Criterion 2: BNP > 500 pg/mL — MET (3,200 pg/mL)",
        "- Criterion 3: IV diuretic requirement — MET (IV Lasix drip initiated)",
        "- Criterion 4: Acute worsening from baseline — MET (EF declined from 25% to 20%)",
        "",
        "SECTION: REQUESTED SERVICE",
        "Inpatient admission to telemetry unit for acute decompensated heart failure",
        "management including IV diuresis, hemodynamic monitoring, and cardiology consultation.",
        "",
        "SECTION: KEY EVIDENCE CITED",
        "- ED Provider Note dated 2026-07-28",
        "- Echocardiogram Report dated 2026-07-28",
        "- Chest X-Ray Report dated 2026-07-28",
        "- Laboratory Results (BNP, Creatinine, Troponin)",
        "",
        "SECTION: FINANCIAL INFORMATION",
        "Estimated cost of requested service: $18,500.00",
        "Diagnosis Category: Cardiology — Heart Failure",
        "",
        "SECTION: APPELLANT INFORMATION",
        "Appellant Type: Provider",
        "Attending Physician: Dr. Priya Sharma, MD, FACC",
        "Contact: priya.sharma@excellencehealth.org  |  Phone: (555) 234-5678",
        "",
        "SECTION: CONCLUSION",
        "Based on the clinical evidence above, we respectfully request that the denial be",
        "overturned and the inpatient admission be authorized. The patient clearly met all",
        "applicable criteria under policy UM-CHF-001 at the time of the original review.",
        "Failure to authorize admission poses a significant clinical risk to this patient.",
    ]
    create_appeal_pdf(
        os.path.join(output_dir, "Appeal1_CHF_Denial_Appeal.pdf"),
        "Margaret Sullivan", "92315874", "1955-11-03", "MBR-00412",
        "2026-08-04", "2026-07-28", "Level 1 — Internal Appeal",
        chf_appeal
    )

    # ─────────────────────────────────────────────────────────────────────────
    # Appeal PDF 2 — COPD Denial Appeal (Level 2 — External)
    # ─────────────────────────────────────────────────────────────────────────
    copd_appeal = [
        "SECTION: REASON FOR APPEAL",
        "This is a Level 2 external appeal for reconsideration of the adverse determination",
        "issued on 2026-07-15 denying inpatient admission for Acute COPD Exacerbation (J44.1)",
        "with Acute Hypercapnic Respiratory Failure (J96.01).",
        "The Level 1 internal appeal was denied on 2026-07-25.",
        "",
        "SECTION: CLINICAL RATIONALE FOR RECONSIDERATION",
        "The prior reviews did not adequately consider the severity of this presentation:",
        "- ABG: pH 7.28, pCO2 62 mmHg — severe respiratory acidosis",
        "- O2 Sat: 82% on room air, improving to 90% only on 6L nasal cannula",
        "- WBC: 16.8 K/uL — leukocytosis suggesting superimposed infection",
        "- Patient failed outpatient therapy (Azithromycin + Prednisone) for 3 days",
        "- Required BiPAP within 2 hours of ED arrival",
        "- History of 3 prior COPD exacerbation admissions in the past 12 months",
        "",
        "SECTION: POLICY REFERENCE",
        "Per policy UM-COPD-001 (Acute COPD Exacerbation Admission):",
        "- Criterion: Hypoxemia requiring > 4L supplemental O2 — MET (6L NC required)",
        "- Criterion: Acute respiratory acidosis (pH < 7.35) — MET (pH 7.28)",
        "- Criterion: Failed outpatient therapy — MET (3-day course failed)",
        "- Criterion: Need for non-invasive ventilation — MET (BiPAP initiated)",
        "",
        "SECTION: REQUESTED SERVICE",
        "Inpatient admission to intermediate care / step-down unit for management of acute",
        "COPD exacerbation with respiratory failure, including IV steroids, continuous",
        "nebulizer treatments, BiPAP support, and infectious disease workup.",
        "",
        "SECTION: KEY EVIDENCE CITED",
        "- ED Provider Note dated 2026-07-15",
        "- ABG Results dated 2026-07-15",
        "- Chest X-Ray dated 2026-07-15 showing hyperinflation",
        "- Prior admission records (3 admissions in trailing 12 months)",
        "- Outpatient prescription records showing failed therapy",
        "",
        "SECTION: FINANCIAL INFORMATION",
        "Estimated cost of requested service: $14,200.00",
        "Diagnosis Category: Pulmonology — COPD",
        "",
        "SECTION: APPELLANT INFORMATION",
        "Appellant Type: Provider",
        "Attending Physician: Dr. James Mitchell, MD, Pulmonology",
        "Contact: james.mitchell@excellencehealth.org  |  Phone: (555) 345-6789",
        "",
        "SECTION: GRIEVANCE STATEMENT",
        "The patient's family has expressed a formal grievance regarding the original denial.",
        "The family states the denial resulted in a 48-hour delay in treatment during which",
        "the patient's condition deteriorated, requiring eventual ICU-level care.",
        "",
        "SECTION: CONCLUSION",
        "We request that the independent external reviewer overturn the denial. All clinical",
        "criteria under UM-COPD-001 are clearly met. The delay caused by this denial directly",
        "contributed to escalation of care and increased total cost of treatment.",
    ]
    create_appeal_pdf(
        os.path.join(output_dir, "Appeal2_COPD_External_Appeal.pdf"),
        "James Carter", "78214569", "1962-08-12", "MBR-00587",
        "2026-07-30", "2026-07-15", "Level 2 — External Independent Review",
        copd_appeal
    )

    # ─────────────────────────────────────────────────────────────────────────
    # Appeal PDF 3 — Observation Status Dispute / Grievance
    # ─────────────────────────────────────────────────────────────────────────
    obs_appeal = [
        "SECTION: REASON FOR APPEAL",
        "This appeal requests reconsideration of the determination to classify the patient",
        "under Observation Status rather than Inpatient Admission for evaluation of acute",
        "chest pain with concern for unstable angina.",
        "",
        "SECTION: CLINICAL RATIONALE FOR RECONSIDERATION",
        "While initial cardiac biomarkers were negative, the clinical presentation warranted",
        "inpatient-level monitoring:",
        "- Patient is a 62-year-old male with prior MI (2024), HTN, HLD, and active smoking",
        "- Presented with substernal chest pain radiating to left arm, with diaphoresis",
        "- Initial EKG showed ST depression in leads V4-V6 (new compared to prior)",
        "- Troponin I: 0.03 ng/mL at presentation (borderline — repeat was 0.08 at 4 hrs)",
        "- Patient required IV Nitroglycerin drip for refractory pain",
        "- Cardiology recommended emergent stress test and possible cardiac catheterization",
        "",
        "SECTION: POLICY REFERENCE",
        "Per policy UM-OBS-IP-001 (Observation Status vs Inpatient Admission):",
        "- Criterion: Need for IV medications > 24 hours — MET (IV Nitro drip x 36 hrs)",
        "- Criterion: Serial monitoring with expected stay > 48 hours — MET (72-hr stay)",
        "- Criterion: Invasive procedure anticipated — MET (cardiac catheterization performed)",
        "- Criterion: Clinical instability — MET (dynamic EKG changes, rising troponin)",
        "",
        "SECTION: REQUESTED SERVICE",
        "Reclassification from Observation Status to Inpatient Admission retroactively,",
        "effective from the date of ED presentation (2026-08-01).",
        "",
        "SECTION: KEY EVIDENCE CITED",
        "- ED Provider Note dated 2026-08-01",
        "- Serial EKG Reports (2026-08-01, 2026-08-02)",
        "- Serial Troponin Results (0.03 -> 0.08 -> 0.15 ng/mL)",
        "- Cardiac Catheterization Report dated 2026-08-03",
        "- Cardiology Consultation Note dated 2026-08-01",
        "",
        "SECTION: FINANCIAL INFORMATION",
        "Estimated cost of requested service: $32,400.00",
        "Observation status cost-share to patient: $8,600.00",
        "Inpatient admission would reduce patient responsibility to: $1,200.00",
        "Financial exposure / disputed amount: $7,400.00",
        "Diagnosis Category: Cardiology — Acute Coronary Syndrome",
        "",
        "SECTION: APPELLANT INFORMATION",
        "Appellant Type: Patient / Member Representative",
        "Patient Representative: Maria Gonzalez (daughter, authorized representative)",
        "Contact: maria.gonzalez@email.com  |  Phone: (555) 456-7890",
        "",
        "SECTION: GRIEVANCE STATEMENT",
        "The patient's family files this grievance citing financial hardship caused by the",
        "observation status classification. The patient underwent cardiac catheterization and",
        "a 72-hour hospital stay. Classification as observation status resulted in",
        "significantly higher out-of-pocket costs that would not have applied under inpatient.",
        "",
        "SECTION: CONCLUSION",
        "We respectfully request retroactive reclassification to inpatient status. The",
        "clinical course — including rising troponin, dynamic EKG changes, IV drip requirement,",
        "and emergent catheterization — clearly met inpatient admission criteria under",
        "UM-OBS-IP-001 from the time of initial presentation.",
    ]
    create_appeal_pdf(
        os.path.join(output_dir, "Appeal3_OBS_Status_Grievance.pdf"),
        "Carlos Mendez", "63928417", "1964-05-22", "MBR-00733",
        "2026-08-10", "2026-08-01", "Level 1 — Internal Appeal + Grievance",
        obs_appeal
    )

    print("\n[OK] All appeal PDFs generated successfully!")


if __name__ == "__main__":
    main()
