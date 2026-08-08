import os
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib import colors

def create_clinical_note_pdf(filename, patient_name, mrn, dob, date, doc_type, content_lines):
    c = canvas.Canvas(filename, pagesize=letter)
    width, height = letter
    
    # Header
    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, height - 50, "Excellence Health System")
    
    c.setFont("Helvetica-Oblique", 12)
    c.drawString(50, height - 70, f"Document Type: {doc_type}")
    
    # Patient Info Box
    c.setStrokeColor(colors.black)
    c.rect(50, height - 130, width - 100, 45)
    
    c.setFont("Helvetica-Bold", 10)
    c.drawString(60, height - 100, f"Patient Name: {patient_name}")
    c.drawString(60, height - 115, f"MRN: {mrn}")
    
    c.drawString(300, height - 100, f"DOB: {dob}")
    c.drawString(300, height - 115, f"Date of Service: {date}")
    
    # Content
    c.setFont("Helvetica", 10)
    y_position = height - 160
    
    for line in content_lines:
        c.drawString(50, y_position, line)
        y_position -= 15
        if y_position < 50:
            c.showPage()
            c.setFont("Helvetica", 10)
            y_position = height - 50
            
    c.save()
    print(f"Generated: {filename}")

def main():
    output_dir = os.path.join(os.path.dirname(__file__), "..", "..", "sample_documents")
    os.makedirs(output_dir, exist_ok=True)
    
    # PDF 1: CHF Case
    chf_lines = [
        "CHIEF COMPLAINT: Shortness of breath, worsening over 3 days.",
        "",
        "HISTORY OF PRESENT ILLNESS:",
        "71-year-old male with a history of HFrEF (baseline EF 25%) presenting to the ED",
        "with worsening dyspnea at rest, orthopnea, and lower extremity edema.",
        "Patient reports skipping his Lasix doses for the past week.",
        "",
        "PHYSICAL EXAM:",
        "Vitals: BP 168/94, HR 110, RR 26, O2 Sat 88% on room air.",
        "Resp: Bilateral crackles heard halfway up lung bases.",
        "CV: Tachycardic, regular rhythm, JVD present.",
        "Extremities: 3+ pitting edema bilaterally to the knees.",
        "",
        "LABORATORY & IMAGING:",
        "BNP: 2,400 pg/mL (elevated)",
        "Creatinine: 1.8 mg/dL",
        "Troponin: 0.04 ng/mL",
        "CXR: Bilateral pleural effusions and pulmonary vascular congestion.",
        "",
        "ASSESSMENT & PLAN:",
        "Acute on chronic systolic heart failure exacerbation. Severe fluid overload.",
        "Hypoxic requiring supplemental oxygen.",
        "- Start IV Lasix 80mg.",
        "- Admit to inpatient telemetry.",
        "- Strict I&O, fluid restriction."
    ]
    create_clinical_note_pdf(
        os.path.join(output_dir, "Case1_CHF_ED_Note.pdf"), 
        "John Doe", "94817263", "1952-11-04", "2026-08-08", "ED Provider Note", chf_lines
    )
    
    # PDF 2: COPD Case
    copd_lines = [
        "CHIEF COMPLAINT: Increased cough and difficulty breathing.",
        "",
        "HISTORY OF PRESENT ILLNESS:",
        "68-year-old female with severe COPD (GOLD Stage III) presenting with an acute",
        "exacerbation. She reports a productive cough with yellow sputum for 4 days.",
        "She failed outpatient azithromycin and prednisone started 2 days ago.",
        "",
        "PHYSICAL EXAM:",
        "Vitals: BP 142/88, HR 105, RR 30, O2 Sat 85% on room air.",
        "Resp: Diffuse expiratory wheezes, diminished breath sounds bilaterally.",
        "Accessory muscle use observed.",
        "",
        "LABORATORY & IMAGING:",
        "ABG: pH 7.32, pCO2 58 mmHg, pO2 55 mmHg (Respiratory Acidosis)",
        "WBC: 14.2 K/uL",
        "CXR: Hyperinflation, no focal consolidation.",
        "",
        "ASSESSMENT & PLAN:",
        "Acute exacerbation of COPD with acute hypercapnic respiratory failure.",
        "- Continuous nebulizer treatments.",
        "- Start IV Methylprednisolone.",
        "- BiPAP if respiratory status worsens.",
        "- Admit to intermediate care / step-down unit."
    ]
    create_clinical_note_pdf(
        os.path.join(output_dir, "Case2_COPD_ED_Note.pdf"), 
        "Jane Smith", "18273645", "1958-03-22", "2026-08-08", "ED Provider Note", copd_lines
    )
    
    # PDF 3: Observation Case
    obs_lines = [
        "CHIEF COMPLAINT: Chest pain.",
        "",
        "HISTORY OF PRESENT ILLNESS:",
        "55-year-old female presenting with atypical, sharp chest pain that started 2 hours ago.",
        "No radiation, no shortness of breath, no diaphoresis. Pain is reproducible on palpation.",
        "",
        "PHYSICAL EXAM:",
        "Vitals: BP 130/80, HR 80, RR 18, O2 Sat 98% on room air.",
        "Resp: Clear to auscultation bilaterally.",
        "CV: Regular rate and rhythm, normal S1/S2, no murmurs.",
        "Chest wall: Tender to palpation over the left costochondral junction.",
        "",
        "LABORATORY & IMAGING:",
        "Troponin: < 0.01 ng/mL (Normal)",
        "EKG: Normal sinus rhythm, no acute ST-T wave changes.",
        "BNP: 150 pg/mL (Normal)",
        "",
        "ASSESSMENT & PLAN:",
        "Atypical chest pain, likely musculoskeletal (costochondritis).",
        "Low suspicion for acute coronary syndrome, but due to patient anxiety and age,",
        "will place in observation status for serial cardiac enzymes.",
        "- Repeat Troponin and EKG in 4 hours.",
        "- Place in Observation Status."
    ]
    create_clinical_note_pdf(
        os.path.join(output_dir, "Case3_OBS_ED_Note.pdf"), 
        "Alice Williams", "28374910", "1968-04-15", "2026-08-08", "ED Provider Note", obs_lines
    )

if __name__ == "__main__":
    main()
