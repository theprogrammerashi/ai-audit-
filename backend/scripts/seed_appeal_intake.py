"""
Seed Appeal Intake Cases — Realistic healthcare appeal data
Assigns cases equally to all 20 nurses.
"""
import sys, os, random, uuid
from datetime import datetime, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app.database import get_connection

# Realistic appeal scenarios with clinical detail
APPEAL_CASES = [
    {
        "member_id": "MBR-2026-4401",
        "appellant_type": "Provider",
        "appeal_level": "Level 1 - Internal",
        "denial_reason_category": "Medical Necessity",
        "clinical_rationale_provided": "Patient presented with acute decompensated heart failure (NYHA Class III), BNP 1,840 pg/mL, requiring IV diuretic therapy and hemodynamic monitoring. Outpatient management was attempted for 72 hours without improvement. Inpatient admission is medically necessary for continued IV Lasix titration and cardiology consultation.",
        "requested_service": "Inpatient Admission - Heart Failure",
        "diagnosis_category": "Cardiovascular",
        "financial_amount_disputed": 18500.00,
        "key_evidence_cited": "BNP trending upward (840→1840), LVEF 25%, failed outpatient oral diuretics, cardiology note recommending admission",
        "policy_referenced": "UM-CHF-001"
    },
    {
        "member_id": "MBR-2026-4402",
        "appellant_type": "Member",
        "appeal_level": "Level 1 - Internal",
        "denial_reason_category": "Level of Care",
        "clinical_rationale_provided": "Patient with acute COPD exacerbation requiring continuous nebulizer treatments and supplemental oxygen. O2 saturation 86% on room air despite ER treatment. Patient has history of 3 prior exacerbations requiring ICU admission. Observation status is inappropriate given clinical severity.",
        "requested_service": "Inpatient Admission - COPD Exacerbation",
        "diagnosis_category": "Respiratory",
        "financial_amount_disputed": 12800.00,
        "key_evidence_cited": "O2 sat 86%, ABG showing respiratory acidosis pH 7.28, prior ICU admissions, failed outpatient bronchodilators",
        "policy_referenced": "UM-COPD-001"
    },
    {
        "member_id": "MBR-2026-4403",
        "appellant_type": "Provider",
        "appeal_level": "Level 2 - External",
        "denial_reason_category": "Experimental Treatment",
        "clinical_rationale_provided": "Patient with metastatic non-small cell lung cancer, EGFR mutation positive. Requesting osimertinib (Tagrisso) as second-line therapy after progression on erlotinib. FDA-approved indication with strong Phase III trial data (FLAURA trial). Not experimental.",
        "requested_service": "Osimertinib 80mg Daily",
        "diagnosis_category": "Oncology",
        "financial_amount_disputed": 42000.00,
        "key_evidence_cited": "FLAURA trial data, NCCN Guidelines Category 1 recommendation, EGFR T790M mutation confirmed by molecular testing",
        "policy_referenced": "UM-ONC-003"
    },
    {
        "member_id": "MBR-2026-4404",
        "appellant_type": "Authorized Representative",
        "appeal_level": "Level 1 - Internal",
        "denial_reason_category": "Medical Necessity",
        "clinical_rationale_provided": "78-year-old patient with bilateral pneumonia and sepsis, Lactate 4.2, MAP 58 requiring vasopressor support. ICU-level care medically necessary for hemodynamic monitoring and IV antibiotic therapy. Patient meets SIRS criteria and qSOFA score of 3.",
        "requested_service": "ICU Admission - Sepsis",
        "diagnosis_category": "Infectious Disease",
        "financial_amount_disputed": 35000.00,
        "key_evidence_cited": "Blood cultures positive for S. pneumoniae, Lactate 4.2, qSOFA 3/3, procalcitonin 12.5",
        "policy_referenced": "UM-SEP-001"
    },
    {
        "member_id": "MBR-2026-4405",
        "appellant_type": "Provider",
        "appeal_level": "Expedited",
        "denial_reason_category": "Prior Authorization Not Obtained",
        "clinical_rationale_provided": "Emergency appendectomy performed for acute perforated appendicitis. Patient presented to ED with acute abdomen, CT confirmed perforation with peritoneal contamination. Emergent surgery required within 2 hours. Prior authorization was not feasible in an emergency situation per CMS guidelines.",
        "requested_service": "Emergency Appendectomy",
        "diagnosis_category": "Surgical",
        "financial_amount_disputed": 28000.00,
        "key_evidence_cited": "CT abdomen showing perforation, WBC 22,000, surgical note documenting emergent nature, CMS emergency exception",
        "policy_referenced": "UM-SURG-002"
    },
    {
        "member_id": "MBR-2026-4406",
        "appellant_type": "Member",
        "appeal_level": "Level 1 - Internal",
        "denial_reason_category": "Not Covered Under Plan",
        "clinical_rationale_provided": "Patient with severe treatment-resistant depression (3 failed medication trials). Requesting transcranial magnetic stimulation (TMS) therapy. TMS is FDA-cleared and recommended by APA guidelines for treatment-resistant depression. Plan exclusion may violate mental health parity laws.",
        "requested_service": "TMS Therapy - 36 Sessions",
        "diagnosis_category": "Behavioral Health",
        "financial_amount_disputed": 15000.00,
        "key_evidence_cited": "PHQ-9 score 24 (severe), 3 failed SSRI/SNRI trials documented, psychiatrist recommendation, APA Guidelines",
        "policy_referenced": "UM-BH-002"
    },
    {
        "member_id": "MBR-2026-4407",
        "appellant_type": "Provider",
        "appeal_level": "Level 1 - Internal",
        "denial_reason_category": "Medical Necessity",
        "clinical_rationale_provided": "Patient with acute ST-elevation MI requiring emergent cardiac catheterization and PCI. Troponin I trending 0.04→2.8→8.4. EKG showing ST elevation in leads II, III, aVF. Door-to-balloon time was 42 minutes. Continued inpatient monitoring post-PCI medically necessary.",
        "requested_service": "Cardiac Catheterization + PCI + 3-Day Inpatient Stay",
        "diagnosis_category": "Cardiovascular",
        "financial_amount_disputed": 45000.00,
        "key_evidence_cited": "Serial troponins, EKG changes, catheterization report showing LAD 95% stenosis, successful stent placement",
        "policy_referenced": "UM-CARD-001"
    },
    {
        "member_id": "MBR-2026-4408",
        "appellant_type": "Provider",
        "appeal_level": "Level 2 - External",
        "denial_reason_category": "Level of Care",
        "clinical_rationale_provided": "Patient with diabetic ketoacidosis (DKA), glucose 480, pH 7.12, bicarbonate 8. Requires continuous insulin drip, frequent lab monitoring, and electrolyte replacement. ICU admission appropriate per ADA DKA management guidelines. Observation status inadequate.",
        "requested_service": "ICU Admission - DKA Management",
        "diagnosis_category": "Endocrine",
        "financial_amount_disputed": 22000.00,
        "key_evidence_cited": "ABG pH 7.12, glucose 480, anion gap 28, ADA guidelines for DKA requiring ICU monitoring",
        "policy_referenced": "UM-ENDO-001"
    },
    {
        "member_id": "MBR-2026-4409",
        "appellant_type": "Member",
        "appeal_level": "Level 1 - Internal",
        "denial_reason_category": "Medical Necessity",
        "clinical_rationale_provided": "65-year-old with severe bilateral knee osteoarthritis. BMI 28, failed 6 months physical therapy, 3 cortisone injection series, and NSAID therapy. Functional limitation with inability to walk more than 100 feet. Total knee replacement is the standard of care per AAOS guidelines.",
        "requested_service": "Total Knee Arthroplasty - Right",
        "diagnosis_category": "Musculoskeletal",
        "financial_amount_disputed": 32000.00,
        "key_evidence_cited": "X-ray showing bone-on-bone changes, failed conservative therapy documented over 6 months, AAOS appropriateness criteria met",
        "policy_referenced": "UM-ORTHO-001"
    },
    {
        "member_id": "MBR-2026-4410",
        "appellant_type": "Provider",
        "appeal_level": "Expedited",
        "denial_reason_category": "Medical Necessity",
        "clinical_rationale_provided": "Pediatric patient with acute lymphoblastic leukemia requiring immediate induction chemotherapy. WBC 95,000, blast count 88%. Tumor lysis syndrome protocol initiated. Delay in treatment initiation poses imminent risk of tumor lysis crisis and death.",
        "requested_service": "Inpatient Chemotherapy Induction - ALL",
        "diagnosis_category": "Oncology",
        "financial_amount_disputed": 58000.00,
        "key_evidence_cited": "Peripheral smear showing 88% blasts, flow cytometry confirming B-ALL, NCCN pediatric ALL guidelines",
        "policy_referenced": "UM-ONC-001"
    },
    {
        "member_id": "MBR-2026-4411",
        "appellant_type": "Provider",
        "appeal_level": "Level 1 - Internal",
        "denial_reason_category": "Level of Care",
        "clinical_rationale_provided": "Patient with acute pancreatitis, Ranson score 5, CT severity index 8. Requires NPO status, IV fluid resuscitation, pain management with IV narcotics, and close monitoring for organ failure. Observation status inappropriate for severe pancreatitis.",
        "requested_service": "Inpatient Admission - Acute Pancreatitis",
        "diagnosis_category": "Gastrointestinal",
        "financial_amount_disputed": 16000.00,
        "key_evidence_cited": "Lipase 2,400, Ranson criteria 5/11, CT severity index 8, Atlanta classification: severe",
        "policy_referenced": "UM-GI-001"
    },
    {
        "member_id": "MBR-2026-4412",
        "appellant_type": "Authorized Representative",
        "appeal_level": "Level 1 - Internal",
        "denial_reason_category": "Medical Necessity",
        "clinical_rationale_provided": "Patient with acute ischemic stroke, NIHSS score 14. tPA administered within window. Requires 24-hour neuro ICU monitoring for potential hemorrhagic conversion and blood pressure management per AHA/ASA guidelines.",
        "requested_service": "Neuro ICU Admission - Acute Stroke",
        "diagnosis_category": "Neurological",
        "financial_amount_disputed": 38000.00,
        "key_evidence_cited": "CT head, CTA showing MCA occlusion, NIHSS 14, tPA administered at 3.5 hours, AHA stroke guidelines",
        "policy_referenced": "UM-NEURO-001"
    },
    {
        "member_id": "MBR-2026-4413",
        "appellant_type": "Provider",
        "appeal_level": "Level 1 - Internal",
        "denial_reason_category": "Medical Necessity",
        "clinical_rationale_provided": "Patient with acute exacerbation of systemic lupus erythematosus with nephritis. Creatinine rising 1.2→3.4 over 48 hours. Renal biopsy confirms Class IV lupus nephritis. Requires IV cyclophosphamide and high-dose steroids with inpatient monitoring.",
        "requested_service": "Inpatient Admission - Lupus Nephritis",
        "diagnosis_category": "Autoimmune",
        "financial_amount_disputed": 24000.00,
        "key_evidence_cited": "Renal biopsy showing Class IV LN, rising creatinine, proteinuria 4.2g/24hr, rheumatology consultation",
        "policy_referenced": "UM-RHEUM-001"
    },
    {
        "member_id": "MBR-2026-4414",
        "appellant_type": "Member",
        "appeal_level": "Level 2 - External",
        "denial_reason_category": "Not Covered Under Plan",
        "clinical_rationale_provided": "Patient with morbid obesity BMI 48, Type 2 diabetes, sleep apnea, and hypertension. Failed 2 years of medically supervised weight loss. Requesting bariatric surgery (Roux-en-Y). Surgery is medically necessary per NIH consensus statement and ASMBS guidelines.",
        "requested_service": "Roux-en-Y Gastric Bypass",
        "diagnosis_category": "Surgical",
        "financial_amount_disputed": 35000.00,
        "key_evidence_cited": "BMI 48, 2 years supervised weight loss documentation, comorbidity documentation, ASMBS guidelines met",
        "policy_referenced": "UM-SURG-005"
    },
    {
        "member_id": "MBR-2026-4415",
        "appellant_type": "Provider",
        "appeal_level": "Level 1 - Internal",
        "denial_reason_category": "Prior Authorization Not Obtained",
        "clinical_rationale_provided": "Emergency cesarean section performed for fetal distress with Category III fetal heart tracing. Emergent delivery required within 15 minutes. Prior authorization cannot be obtained in obstetric emergencies per ACOG guidelines and CMS emergency exception rules.",
        "requested_service": "Emergency Cesarean Section",
        "diagnosis_category": "Obstetric",
        "financial_amount_disputed": 22000.00,
        "key_evidence_cited": "Category III FHR tracing, ACOG emergency guidelines, operative note documenting emergent nature",
        "policy_referenced": "UM-OB-001"
    },
    {
        "member_id": "MBR-2026-4416",
        "appellant_type": "Provider",
        "appeal_level": "Level 1 - Internal",
        "denial_reason_category": "Medical Necessity",
        "clinical_rationale_provided": "Patient with severe community-acquired pneumonia, CURB-65 score 4. Requiring high-flow nasal cannula oxygen at 40L/min, IV antibiotics, and close respiratory monitoring. Patient at high risk for intubation and mechanical ventilation.",
        "requested_service": "Inpatient Admission - Severe Pneumonia",
        "diagnosis_category": "Respiratory",
        "financial_amount_disputed": 14500.00,
        "key_evidence_cited": "Chest X-ray multilobar infiltrates, CURB-65 score 4, procalcitonin 8.2, requiring high-flow O2",
        "policy_referenced": "UM-PULM-001"
    },
    {
        "member_id": "MBR-2026-4417",
        "appellant_type": "Member",
        "appeal_level": "Level 1 - Internal",
        "denial_reason_category": "Medical Necessity",
        "clinical_rationale_provided": "Patient with acute GI bleeding, hemoglobin 6.8, requiring emergent endoscopy and blood transfusion. Hemodynamically unstable with tachycardia HR 118 and hypotension BP 88/52. Requires ICU-level monitoring.",
        "requested_service": "ICU Admission - GI Hemorrhage",
        "diagnosis_category": "Gastrointestinal",
        "financial_amount_disputed": 28000.00,
        "key_evidence_cited": "Hemoglobin 6.8, hemodynamic instability, endoscopy showing active bleeding, 4 units pRBC transfused",
        "policy_referenced": "UM-GI-002"
    },
    {
        "member_id": "MBR-2026-4418",
        "appellant_type": "Provider",
        "appeal_level": "Expedited",
        "denial_reason_category": "Experimental Treatment",
        "clinical_rationale_provided": "Patient with refractory multiple myeloma, requesting CAR-T cell therapy (idecabtagene vicleucel). Patient has failed 4 prior lines of therapy. FDA-approved for relapsed/refractory MM after 4+ prior therapies. This is NOT experimental.",
        "requested_service": "CAR-T Cell Therapy - Multiple Myeloma",
        "diagnosis_category": "Oncology",
        "financial_amount_disputed": 95000.00,
        "key_evidence_cited": "FDA approval for idecabtagene vicleucel, NCCN Category 1 recommendation, documentation of 4 failed prior therapies",
        "policy_referenced": "UM-ONC-005"
    },
    {
        "member_id": "MBR-2026-4419",
        "appellant_type": "Provider",
        "appeal_level": "Level 1 - Internal",
        "denial_reason_category": "Level of Care",
        "clinical_rationale_provided": "Patient with acute kidney injury requiring emergent hemodialysis. BUN 98, Creatinine 8.4, Potassium 6.8 with EKG changes. Life-threatening hyperkalemia requiring urgent dialysis access and ICU monitoring.",
        "requested_service": "ICU Admission + Emergent Hemodialysis",
        "diagnosis_category": "Renal",
        "financial_amount_disputed": 32000.00,
        "key_evidence_cited": "Creatinine 8.4, K+ 6.8 with peaked T-waves on EKG, nephrology emergent consult, AKI Stage 3",
        "policy_referenced": "UM-NEPH-001"
    },
    {
        "member_id": "MBR-2026-4420",
        "appellant_type": "Member",
        "appeal_level": "Level 1 - Internal",
        "denial_reason_category": "Medical Necessity",
        "clinical_rationale_provided": "Patient with acute asthma exacerbation, peak flow 35% predicted, not responding to initial ER bronchodilator therapy. Requires continuous albuterol nebulization and IV magnesium sulfate. History of prior intubation for asthma.",
        "requested_service": "Inpatient Admission - Status Asthmaticus",
        "diagnosis_category": "Respiratory",
        "financial_amount_disputed": 11000.00,
        "key_evidence_cited": "Peak flow 35%, failed initial bronchodilator therapy, prior intubation history, pulmonology consult",
        "policy_referenced": "UM-PULM-002"
    },
]

# Outcomes for the original 20 cases — mostly resolved history for analytics
HISTORICAL_OUTCOMES = [
    "Overturned - Full", "Upheld", "Overturned - Partial", "Overturned - Full",
    "Upheld", "Upheld", "Overturned - Full", "Upheld", "Upheld",
    "Overturned - Full", "Upheld", "Overturned - Partial", "Upheld",
    "Upheld", "Overturned - Full", "Upheld", "Upheld", "Overturned - Full",
    "Upheld", "Overturned - Partial",
]

# ── 60 NEW PENDING APPEAL CASES ──────────────────────────────────────────────
# These are assigned 3 per nurse (20 nurses × 3 = 60).
# All have appeal_outcome = NULL (pending) so they appear in nurse workspace.
PENDING_APPEAL_TEMPLATES = [
    # ── Cardiovascular (8) ──────────────────────────────────────────────────
    {
        "appellant_type": "Provider", "appeal_level": "Level 1 - Internal",
        "denial_reason_category": "Medical Necessity", "diagnosis_category": "Cardiovascular",
        "requested_service": "Inpatient Admission - Unstable Angina",
        "clinical_rationale_provided": "Patient with crescendo angina, troponin trending 0.02→0.14, dynamic ST changes on telemetry. High-risk ACS requiring continuous cardiac monitoring and heparin drip. Stress testing is contraindicated in the acute phase.",
        "financial_amount_disputed": 19500.00,
        "key_evidence_cited": "Serial troponins trending upward, dynamic ST changes on telemetry, TIMI risk score 5/7, cardiology consultation recommending admission",
        "policy_referenced": "UM-CARD-001",
    },
    {
        "appellant_type": "Member", "appeal_level": "Level 1 - Internal",
        "denial_reason_category": "Level of Care", "diagnosis_category": "Cardiovascular",
        "requested_service": "ICU Admission - Hypertensive Emergency",
        "clinical_rationale_provided": "Patient presenting with BP 220/130, acute headache, blurred vision, and papilledema. CT head negative for hemorrhage. Requires IV nicardipine drip with continuous arterial line monitoring. End-organ damage assessment ongoing with rising creatinine.",
        "financial_amount_disputed": 21000.00,
        "key_evidence_cited": "BP 220/130, papilledema on fundoscopy, creatinine rising 1.1→2.3, CT head, cardiology and nephrology consultation notes",
        "policy_referenced": "UM-CARD-002",
    },
    {
        "appellant_type": "Provider", "appeal_level": "Level 2 - External",
        "denial_reason_category": "Medical Necessity", "diagnosis_category": "Cardiovascular",
        "requested_service": "Cardiac Ablation - Atrial Flutter",
        "clinical_rationale_provided": "Patient with symptomatic typical atrial flutter refractory to rate control with metoprolol and diltiazem. Two cardioversions with recurrence within 48 hours. Catheter ablation is guideline-recommended first-line therapy per AHA/ACC/HRS 2023 guidelines.",
        "financial_amount_disputed": 34000.00,
        "key_evidence_cited": "Failed rate control documentation, 2 cardioversion reports, Holter showing persistent flutter, AHA/ACC/HRS 2023 AF/Flutter guidelines",
        "policy_referenced": "UM-CARD-003",
    },
    {
        "appellant_type": "Provider", "appeal_level": "Level 1 - Internal",
        "denial_reason_category": "Medical Necessity", "diagnosis_category": "Cardiovascular",
        "requested_service": "Inpatient Admission - Acute Pericarditis",
        "clinical_rationale_provided": "Patient with acute pericarditis, diffuse ST elevation, elevated troponin 1.2 suggesting myopericarditis. Large pericardial effusion on echo with early tamponade physiology. Requires IV colchicine, serial echocardiograms, and possible pericardiocentesis.",
        "financial_amount_disputed": 16800.00,
        "key_evidence_cited": "ECG with diffuse ST elevation, troponin 1.2, echo showing large pericardial effusion with respiratory variation, cardiology consultation",
        "policy_referenced": "UM-CARD-001",
    },
    {
        "appellant_type": "Member", "appeal_level": "Expedited",
        "denial_reason_category": "Medical Necessity", "diagnosis_category": "Cardiovascular",
        "requested_service": "Inpatient Admission - DVT with PE",
        "clinical_rationale_provided": "Patient with acute submassive pulmonary embolism, RV strain on CT angiography, troponin elevated at 0.8, and BNP 1200. Hemodynamically borderline with heart rate 115 and O2 sat 89%. Requires IV heparin drip with consideration for catheter-directed thrombolysis.",
        "financial_amount_disputed": 27500.00,
        "key_evidence_cited": "CT angiography showing bilateral PE with RV strain, troponin 0.8, BNP 1200, sPESI score 3",
        "policy_referenced": "UM-CARD-004",
    },
    {
        "appellant_type": "Provider", "appeal_level": "Level 1 - Internal",
        "denial_reason_category": "Level of Care", "diagnosis_category": "Cardiovascular",
        "requested_service": "Inpatient Admission - New-Onset Atrial Fibrillation",
        "clinical_rationale_provided": "Patient with new-onset rapid atrial fibrillation HR 145 not responding to IV diltiazem in the ED. Underlying thyrotoxicosis discovered. Requires rate control optimization, anticoagulation initiation, and endocrine workup.",
        "financial_amount_disputed": 13500.00,
        "key_evidence_cited": "EKG showing AF with RVR, failed IV diltiazem, TSH <0.01, free T4 5.8, endocrinology and cardiology consultations",
        "policy_referenced": "UM-CARD-001",
    },
    {
        "appellant_type": "Authorized Representative", "appeal_level": "Level 1 - Internal",
        "denial_reason_category": "Medical Necessity", "diagnosis_category": "Cardiovascular",
        "requested_service": "Cardiac MRI - Myocarditis Evaluation",
        "clinical_rationale_provided": "29-year-old with chest pain, troponin 4.2, normal coronary angiography. Suspected myocarditis post-viral illness. Cardiac MRI with late gadolinium enhancement needed for definitive diagnosis and to guide treatment. No alternative diagnostic modality available.",
        "financial_amount_disputed": 8500.00,
        "key_evidence_cited": "Normal coronary angiography, troponin 4.2, recent viral illness, echocardiogram showing wall motion abnormalities, cardiology recommendation",
        "policy_referenced": "UM-CARD-005",
    },
    {
        "appellant_type": "Provider", "appeal_level": "Level 1 - Internal",
        "denial_reason_category": "Prior Authorization Not Obtained", "diagnosis_category": "Cardiovascular",
        "requested_service": "Emergency Aortic Repair - Type A Dissection",
        "clinical_rationale_provided": "Emergent ascending aortic repair for acute Type A aortic dissection. Patient presented with tearing chest pain, CT angiography confirming dissection flap extending to aortic root. Mortality rate without emergent surgery exceeds 1-2% per hour. PA not feasible in cardiac emergency.",
        "financial_amount_disputed": 85000.00,
        "key_evidence_cited": "CT angiography showing Type A dissection, cardiac surgery operative report, CMS emergency exception, AHA/ACC emergency surgery guidelines",
        "policy_referenced": "UM-CARD-006",
    },
    # ── Respiratory (7) ─────────────────────────────────────────────────────
    {
        "appellant_type": "Provider", "appeal_level": "Level 1 - Internal",
        "denial_reason_category": "Medical Necessity", "diagnosis_category": "Respiratory",
        "requested_service": "Inpatient Admission - Pneumothorax",
        "clinical_rationale_provided": "Patient with spontaneous pneumothorax, 40% lung collapse on CXR. Chest tube placed in ED. Requires inpatient monitoring for air leak resolution, serial CXR, and potential VATS if air leak persists beyond 5 days.",
        "financial_amount_disputed": 15200.00,
        "key_evidence_cited": "CXR showing 40% pneumothorax, chest tube placement note, pulmonology consultation recommending admission for air leak monitoring",
        "policy_referenced": "UM-PULM-003",
    },
    {
        "appellant_type": "Member", "appeal_level": "Level 1 - Internal",
        "denial_reason_category": "Level of Care", "diagnosis_category": "Respiratory",
        "requested_service": "Inpatient Admission - Severe Asthma Exacerbation",
        "clinical_rationale_provided": "Patient with life-threatening asthma, peak flow 28% predicted, pCO2 rising from 38→52 indicating impending respiratory failure. History of 2 prior intubations. Requires continuous nebulization, IV magnesium, and possible intubation.",
        "financial_amount_disputed": 12500.00,
        "key_evidence_cited": "Peak flow 28%, rising pCO2 52, history of intubation, continuous nebulizer order, pulmonology emergent consult",
        "policy_referenced": "UM-PULM-002",
    },
    {
        "appellant_type": "Provider", "appeal_level": "Level 2 - External",
        "denial_reason_category": "Medical Necessity", "diagnosis_category": "Respiratory",
        "requested_service": "Home Ventilator - Neuromuscular Disease",
        "clinical_rationale_provided": "Patient with ALS, declining FVC now 35% predicted. Nocturnal hypercapnia documented on sleep study (pCO2 58). Home non-invasive ventilation (BiPAP) is life-sustaining and recommended per AAN ALS practice parameter.",
        "financial_amount_disputed": 18000.00,
        "key_evidence_cited": "Pulmonary function tests showing FVC 35%, sleep study with nocturnal hypercapnia, AAN ALS practice parameter, pulmonology and neurology letters of support",
        "policy_referenced": "UM-PULM-004",
    },
    {
        "appellant_type": "Provider", "appeal_level": "Level 1 - Internal",
        "denial_reason_category": "Medical Necessity", "diagnosis_category": "Respiratory",
        "requested_service": "Inpatient Admission - Hemoptysis Workup",
        "clinical_rationale_provided": "Patient with massive hemoptysis (>600mL in 24h), hemodynamically unstable. CT chest showing right upper lobe mass with active hemorrhage. Requires IR bronchial artery embolization and possible surgical resection. Life-threatening condition.",
        "financial_amount_disputed": 42000.00,
        "key_evidence_cited": "CT chest with active hemorrhage, quantified hemoptysis >600mL, interventional radiology consult, pulmonology and thoracic surgery consultations",
        "policy_referenced": "UM-PULM-001",
    },
    {
        "appellant_type": "Member", "appeal_level": "Level 1 - Internal",
        "denial_reason_category": "Level of Care", "diagnosis_category": "Respiratory",
        "requested_service": "Inpatient Admission - COPD with Respiratory Failure",
        "clinical_rationale_provided": "Patient with acute-on-chronic respiratory failure, on BiPAP in ED, pH 7.26, pCO2 72. Not a candidate for observation as requires continuous BiPAP, IV steroids, and frequent ABG monitoring. Failed prior outpatient exacerbation management.",
        "financial_amount_disputed": 14800.00,
        "key_evidence_cited": "ABG pH 7.26, pCO2 72, on BiPAP, 3 prior admissions in last 6 months, failed outpatient prednisone course, pulmonology consultation",
        "policy_referenced": "UM-COPD-001",
    },
    {
        "appellant_type": "Provider", "appeal_level": "Expedited",
        "denial_reason_category": "Medical Necessity", "diagnosis_category": "Respiratory",
        "requested_service": "Inpatient Admission - Pleural Effusion Drainage",
        "clinical_rationale_provided": "Patient with malignant pleural effusion causing severe dyspnea at rest. O2 sat 84% on 4L NC. Requires thoracentesis with PleurX catheter placement. CT shows complete left lung collapse from effusion.",
        "financial_amount_disputed": 16500.00,
        "key_evidence_cited": "CT chest showing complete left lung collapse, O2 sat 84%, thoracentesis cytology pending, pulmonology and oncology consultations",
        "policy_referenced": "UM-PULM-001",
    },
    {
        "appellant_type": "Provider", "appeal_level": "Level 1 - Internal",
        "denial_reason_category": "Medical Necessity", "diagnosis_category": "Respiratory",
        "requested_service": "Inpatient Admission - Aspiration Pneumonia",
        "clinical_rationale_provided": "82-year-old with aspiration pneumonia and dysphagia. WBC 18,000, bilateral lower lobe infiltrates on CXR. Failed swallow evaluation. Requires IV antibiotics, NPO status with NG tube feeding, and speech pathology reassessment.",
        "financial_amount_disputed": 13200.00,
        "key_evidence_cited": "CXR bilateral infiltrates, WBC 18000, failed bedside swallow evaluation, speech pathology recommendation for modified barium swallow",
        "policy_referenced": "UM-PULM-001",
    },
    # ── Oncology (6) ────────────────────────────────────────────────────────
    {
        "appellant_type": "Provider", "appeal_level": "Level 2 - External",
        "denial_reason_category": "Experimental Treatment", "diagnosis_category": "Oncology",
        "requested_service": "Pembrolizumab + Chemotherapy - Triple Negative Breast Cancer",
        "clinical_rationale_provided": "Patient with PD-L1 positive (CPS 12) metastatic triple-negative breast cancer. Requesting pembrolizumab in combination with nab-paclitaxel as first-line therapy per KEYNOTE-355 trial results. FDA-approved indication since November 2020.",
        "financial_amount_disputed": 52000.00,
        "key_evidence_cited": "PD-L1 CPS 12, KEYNOTE-355 Phase III trial, FDA approval November 2020, NCCN Category 1 recommendation, pathology report confirming TNBC",
        "policy_referenced": "UM-ONC-004",
    },
    {
        "appellant_type": "Member", "appeal_level": "Level 1 - Internal",
        "denial_reason_category": "Medical Necessity", "diagnosis_category": "Oncology",
        "requested_service": "PET/CT Restaging - Lymphoma",
        "clinical_rationale_provided": "Patient with diffuse large B-cell lymphoma completing 4 cycles of R-CHOP. PET/CT restaging is standard of care per NCCN guidelines to assess treatment response and determine need for radiation consolidation. Without restaging, treatment decisions cannot be made.",
        "financial_amount_disputed": 6800.00,
        "key_evidence_cited": "NCCN DLBCL guidelines requiring interim PET/CT, completed 4 cycles R-CHOP, oncology treatment plan, Lugano response criteria",
        "policy_referenced": "UM-ONC-002",
    },
    {
        "appellant_type": "Provider", "appeal_level": "Expedited",
        "denial_reason_category": "Medical Necessity", "diagnosis_category": "Oncology",
        "requested_service": "Stereotactic Radiosurgery - Brain Metastases",
        "clinical_rationale_provided": "Patient with 3 brain metastases from NSCLC, largest 2.5cm with surrounding edema. Symptomatic with headache and right-sided weakness. SRS is preferred over WBRT for limited brain metastases per ASTRO guidelines. Delay risks herniation.",
        "financial_amount_disputed": 38000.00,
        "key_evidence_cited": "Brain MRI showing 3 metastases, NSCLC primary confirmed, ASTRO guidelines for SRS, neurosurgery and radiation oncology consultations",
        "policy_referenced": "UM-ONC-003",
    },
    {
        "appellant_type": "Provider", "appeal_level": "Level 1 - Internal",
        "denial_reason_category": "Medical Necessity", "diagnosis_category": "Oncology",
        "requested_service": "Inpatient Admission - Febrile Neutropenia",
        "clinical_rationale_provided": "Patient day 10 post-chemotherapy with ANC 120, temperature 39.2°C. Blood cultures drawn, requiring IV broad-spectrum antibiotics per IDSA febrile neutropenia guidelines. MASCC score 15 (high risk). Outpatient management contraindicated.",
        "financial_amount_disputed": 18500.00,
        "key_evidence_cited": "ANC 120, temperature 39.2°C, MASCC score 15, IDSA febrile neutropenia guidelines, oncology treatment records",
        "policy_referenced": "UM-ONC-001",
    },
    {
        "appellant_type": "Authorized Representative", "appeal_level": "Level 1 - Internal",
        "denial_reason_category": "Not Covered Under Plan", "diagnosis_category": "Oncology",
        "requested_service": "Proton Beam Therapy - Pediatric Brain Tumor",
        "clinical_rationale_provided": "8-year-old with medulloblastoma requiring craniospinal irradiation. Proton therapy significantly reduces radiation exposure to developing organs including heart, lungs, and gonads compared to photon therapy. Standard of care for pediatric CNS tumors per ASTRO/ASCO.",
        "financial_amount_disputed": 72000.00,
        "key_evidence_cited": "Dosimetric comparison showing proton vs photon organ sparing, ASTRO/ASCO pediatric proton therapy guidelines, pediatric neuro-oncology recommendation",
        "policy_referenced": "UM-ONC-006",
    },
    {
        "appellant_type": "Provider", "appeal_level": "Level 1 - Internal",
        "denial_reason_category": "Medical Necessity", "diagnosis_category": "Oncology",
        "requested_service": "Genetic Testing - Hereditary Cancer Panel",
        "clinical_rationale_provided": "42-year-old with triple-negative breast cancer diagnosed before age 45. NCCN guidelines recommend genetic testing for all patients with TNBC regardless of age. Results will guide surgical planning (bilateral mastectomy vs lumpectomy) and family screening.",
        "financial_amount_disputed": 4200.00,
        "key_evidence_cited": "NCCN Genetic/Familial High-Risk Assessment guidelines, TNBC diagnosis at age 42, surgical planning dependency, genetic counselor recommendation",
        "policy_referenced": "UM-ONC-007",
    },
    # ── Neurological (5) ────────────────────────────────────────────────────
    {
        "appellant_type": "Provider", "appeal_level": "Level 1 - Internal",
        "denial_reason_category": "Medical Necessity", "diagnosis_category": "Neurological",
        "requested_service": "Inpatient Admission - Status Epilepticus",
        "clinical_rationale_provided": "Patient with refractory status epilepticus requiring continuous EEG monitoring and IV midazolam drip. Failed lorazepam, fosphenytoin, and levetiracetam loading. ICU-level care necessary for airway protection and seizure control.",
        "financial_amount_disputed": 32000.00,
        "key_evidence_cited": "Continuous EEG showing ongoing seizure activity, failed 3 antiepileptic drugs, intubation for airway protection, neurology and critical care consultations",
        "policy_referenced": "UM-NEURO-002",
    },
    {
        "appellant_type": "Member", "appeal_level": "Level 1 - Internal",
        "denial_reason_category": "Level of Care", "diagnosis_category": "Neurological",
        "requested_service": "Inpatient Rehabilitation - Stroke Recovery",
        "clinical_rationale_provided": "Patient 5 days post-MCA stroke with residual right hemiparesis and aphasia. Requires intensive inpatient rehabilitation (minimum 3 hours therapy daily) to maximize neurological recovery. Outpatient therapy insufficient for current functional level.",
        "financial_amount_disputed": 28000.00,
        "key_evidence_cited": "FIM score 42 (severe), NIHSS 10, speech pathology and PT/OT evaluations recommending IRF, CMS 60% rule qualification",
        "policy_referenced": "UM-NEURO-003",
    },
    {
        "appellant_type": "Provider", "appeal_level": "Expedited",
        "denial_reason_category": "Medical Necessity", "diagnosis_category": "Neurological",
        "requested_service": "MRI Brain with Contrast - MS Exacerbation",
        "clinical_rationale_provided": "Patient with known MS presenting with new-onset left-sided weakness and visual changes concerning for acute exacerbation. MRI needed to confirm new demyelinating lesions and guide IV methylprednisolone treatment. Delay risks permanent neurological deficit.",
        "financial_amount_disputed": 5500.00,
        "key_evidence_cited": "New neurological deficits, known MS diagnosis, prior MRIs for comparison, neurology urgent referral, McDonald criteria assessment",
        "policy_referenced": "UM-NEURO-001",
    },
    {
        "appellant_type": "Provider", "appeal_level": "Level 1 - Internal",
        "denial_reason_category": "Medical Necessity", "diagnosis_category": "Neurological",
        "requested_service": "Inpatient Admission - Guillain-Barré Syndrome",
        "clinical_rationale_provided": "Patient with progressive ascending weakness over 72 hours, areflexia on exam. NCS/EMG confirming acute inflammatory demyelinating polyneuropathy. Requires IVIG infusion, pulmonary function monitoring (FVC declining), and ICU standby for potential intubation.",
        "financial_amount_disputed": 42000.00,
        "key_evidence_cited": "NCS/EMG confirming AIDP, FVC declining 2.8L→1.9L, CSF with albuminocytological dissociation, neurology consultation",
        "policy_referenced": "UM-NEURO-004",
    },
    {
        "appellant_type": "Member", "appeal_level": "Level 2 - External",
        "denial_reason_category": "Experimental Treatment", "diagnosis_category": "Neurological",
        "requested_service": "Deep Brain Stimulation - Parkinson's Disease",
        "clinical_rationale_provided": "Patient with Parkinson's disease, 12 years since diagnosis. Motor fluctuations and dyskinesias despite optimal levodopa dosing. DBS is FDA-approved and guideline-recommended for motor complications refractory to medication optimization.",
        "financial_amount_disputed": 65000.00,
        "key_evidence_cited": "Movement disorder specialist evaluation, documented motor fluctuations, optimal medication trial documentation, AAN DBS guideline recommendation, neuropsych clearance",
        "policy_referenced": "UM-NEURO-005",
    },
    # ── Surgical / Trauma (5) ───────────────────────────────────────────────
    {
        "appellant_type": "Provider", "appeal_level": "Level 1 - Internal",
        "denial_reason_category": "Medical Necessity", "diagnosis_category": "Surgical",
        "requested_service": "Inpatient Admission - Open Fracture Fixation",
        "clinical_rationale_provided": "Patient with Gustilo Type IIIA open tibia fracture from motor vehicle accident. Requires emergent OR for wound debridement, fracture fixation, and IV antibiotics. Post-op monitoring for compartment syndrome mandatory per ACS Trauma guidelines.",
        "financial_amount_disputed": 45000.00,
        "key_evidence_cited": "X-ray/CT showing comminuted tibia fracture, wound photos documenting open fracture, trauma surgery operative plan, ACS trauma guidelines",
        "policy_referenced": "UM-SURG-001",
    },
    {
        "appellant_type": "Provider", "appeal_level": "Level 1 - Internal",
        "denial_reason_category": "Prior Authorization Not Obtained", "diagnosis_category": "Surgical",
        "requested_service": "Emergency Cholecystectomy",
        "clinical_rationale_provided": "Patient with acute gangrenous cholecystitis, WBC 24,000, ultrasound showing gallbladder wall thickening >6mm with pericholecystic fluid. Patient became septic requiring emergent cholecystectomy within 4 hours. Prior auth not feasible in surgical emergency.",
        "financial_amount_disputed": 22000.00,
        "key_evidence_cited": "Ultrasound findings, WBC 24000, Murphy sign positive, surgical pathology confirming gangrenous changes, CMS emergency exception",
        "policy_referenced": "UM-SURG-002",
    },
    {
        "appellant_type": "Member", "appeal_level": "Level 1 - Internal",
        "denial_reason_category": "Medical Necessity", "diagnosis_category": "Surgical",
        "requested_service": "Rotator Cuff Repair - Complete Tear",
        "clinical_rationale_provided": "Patient with complete supraspinatus and infraspinatus tears confirmed on MRI. Failed 12 weeks of physical therapy, 2 cortisone injections. Active lifestyle with inability to perform overhead activities. Surgical repair is standard of care for complete tears in active patients.",
        "financial_amount_disputed": 18000.00,
        "key_evidence_cited": "MRI showing complete rotator cuff tears, 12 weeks PT documentation, 2 injection records, orthopedic surgeon recommendation, AAOS appropriateness criteria",
        "policy_referenced": "UM-ORTHO-002",
    },
    {
        "appellant_type": "Provider", "appeal_level": "Expedited",
        "denial_reason_category": "Medical Necessity", "diagnosis_category": "Surgical",
        "requested_service": "Inpatient Admission - Bowel Obstruction",
        "clinical_rationale_provided": "Patient with complete small bowel obstruction on CT abdomen, dilated loops >4cm with transition point. NPO with NG tube decompression. History of multiple prior abdominal surgeries. Failure to resolve in 48 hours will require surgical exploration.",
        "financial_amount_disputed": 25000.00,
        "key_evidence_cited": "CT abdomen showing complete SBO, NG tube output >1L, surgical history of 3 prior laparotomies, surgery consultation",
        "policy_referenced": "UM-SURG-003",
    },
    {
        "appellant_type": "Authorized Representative", "appeal_level": "Level 1 - Internal",
        "denial_reason_category": "Level of Care", "diagnosis_category": "Surgical",
        "requested_service": "Inpatient Admission - Post-Spinal Fusion Monitoring",
        "clinical_rationale_provided": "Patient post L3-L5 posterior spinal fusion with instrumentation. Complex surgery lasting 6 hours with significant blood loss (1200mL). Requires IV PCA pain management, neurovascular checks, physical therapy mobilization, and wound monitoring. Observation inappropriate for major spinal surgery.",
        "financial_amount_disputed": 55000.00,
        "key_evidence_cited": "Operative report documenting complex fusion, estimated blood loss 1200mL, anesthesia records, neurosurgery post-op orders",
        "policy_referenced": "UM-SURG-004",
    },
    # ── Endocrine / Renal / GI / Other (9) ──────────────────────────────────
    {
        "appellant_type": "Provider", "appeal_level": "Level 1 - Internal",
        "denial_reason_category": "Medical Necessity", "diagnosis_category": "Endocrine",
        "requested_service": "Inpatient Admission - Thyroid Storm",
        "clinical_rationale_provided": "Patient with thyroid storm (Burch-Wartofsky score 55), HR 148, temperature 40.1°C, altered mental status. Requires IV propranolol, PTU, hydrocortisone, and continuous cardiac monitoring. Life-threatening endocrine emergency.",
        "financial_amount_disputed": 19000.00,
        "key_evidence_cited": "Burch-Wartofsky score 55, TSH <0.01, free T4 8.2, tachycardia HR 148, altered mental status, endocrinology and critical care consultations",
        "policy_referenced": "UM-ENDO-002",
    },
    {
        "appellant_type": "Member", "appeal_level": "Level 1 - Internal",
        "denial_reason_category": "Level of Care", "diagnosis_category": "Endocrine",
        "requested_service": "Inpatient Admission - Severe Hypoglycemia",
        "clinical_rationale_provided": "Elderly patient with recurrent severe hypoglycemia (glucose 28 mg/dL) on sulfonylurea. Required D50 push x3 and glucagon. Sustained observation needed as sulfonylurea-induced hypoglycemia can recur for 24-72 hours. Risk of seizure and permanent brain injury.",
        "financial_amount_disputed": 8500.00,
        "key_evidence_cited": "Blood glucose 28, D50 x3 and glucagon administration records, sulfonylurea medication history, ADA hypoglycemia management guidelines",
        "policy_referenced": "UM-ENDO-001",
    },
    {
        "appellant_type": "Provider", "appeal_level": "Level 1 - Internal",
        "denial_reason_category": "Medical Necessity", "diagnosis_category": "Renal",
        "requested_service": "Inpatient Admission - Acute Kidney Injury",
        "clinical_rationale_provided": "Patient with AKI Stage 3 (creatinine 1.2→5.8 in 48 hours), oliguria <200mL/12hr. Suspected ATN from contrast nephropathy. Requires IV fluid resuscitation monitoring, nephrology management, and possible emergent dialysis if potassium rises further.",
        "financial_amount_disputed": 22000.00,
        "key_evidence_cited": "Creatinine trending 1.2→5.8, urine output <200mL/12hr, FENa 3.2% (intrinsic renal), nephrology consultation, renal ultrasound",
        "policy_referenced": "UM-NEPH-001",
    },
    {
        "appellant_type": "Provider", "appeal_level": "Level 2 - External",
        "denial_reason_category": "Medical Necessity", "diagnosis_category": "Renal",
        "requested_service": "Living Donor Kidney Transplant Evaluation",
        "clinical_rationale_provided": "Patient with ESRD on hemodialysis 3x/week for 2 years. ABO-compatible living donor identified. Transplant evaluation including cardiac clearance, cancer screening, and immunological crossmatch required per UNOS guidelines. Transplant reduces mortality vs continued dialysis.",
        "financial_amount_disputed": 15000.00,
        "key_evidence_cited": "2 years dialysis records, ABO compatibility confirmed, UNOS transplant evaluation guidelines, nephrology and transplant surgery referrals",
        "policy_referenced": "UM-NEPH-002",
    },
    {
        "appellant_type": "Member", "appeal_level": "Level 1 - Internal",
        "denial_reason_category": "Medical Necessity", "diagnosis_category": "Gastrointestinal",
        "requested_service": "Inpatient Admission - Acute Diverticulitis",
        "clinical_rationale_provided": "Patient with complicated diverticulitis, CT showing 4cm abscess with microperforation. Requires IV antibiotics, IR-guided percutaneous drainage, and surgical consultation. Failed outpatient oral antibiotics with worsening symptoms over 5 days.",
        "financial_amount_disputed": 18500.00,
        "key_evidence_cited": "CT abdomen showing 4cm abscess, Hinchey Stage II, failed oral antibiotics, WBC 19000, surgery consultation, IR drainage planned",
        "policy_referenced": "UM-GI-003",
    },
    {
        "appellant_type": "Provider", "appeal_level": "Expedited",
        "denial_reason_category": "Medical Necessity", "diagnosis_category": "Gastrointestinal",
        "requested_service": "Inpatient Admission - Acute Liver Failure",
        "clinical_rationale_provided": "Patient with acute liver failure, INR 4.2, bilirubin 18, hepatic encephalopathy grade II. Requires ICU monitoring, N-acetylcysteine protocol, and urgent transplant evaluation. King's College criteria met for poor prognosis without transplant.",
        "financial_amount_disputed": 65000.00,
        "key_evidence_cited": "INR 4.2, bilirubin 18, hepatic encephalopathy grade II, King's College criteria, hepatology and transplant surgery consultations",
        "policy_referenced": "UM-GI-004",
    },
    {
        "appellant_type": "Provider", "appeal_level": "Level 1 - Internal",
        "denial_reason_category": "Medical Necessity", "diagnosis_category": "Infectious Disease",
        "requested_service": "Inpatient Admission - Endocarditis",
        "clinical_rationale_provided": "Patient with infective endocarditis confirmed by modified Duke criteria (2 major + 1 minor). Blood cultures positive for Streptococcus viridans, vegetation 1.5cm on mitral valve by TEE. Requires 4-6 weeks IV antibiotics via PICC line with weekly blood cultures.",
        "financial_amount_disputed": 48000.00,
        "key_evidence_cited": "Modified Duke criteria met, TEE showing 1.5cm vegetation, blood cultures positive, infectious disease consultation, cardiothoracic surgery standby",
        "policy_referenced": "UM-ID-001",
    },
    {
        "appellant_type": "Member", "appeal_level": "Level 1 - Internal",
        "denial_reason_category": "Not Covered Under Plan", "diagnosis_category": "Behavioral Health",
        "requested_service": "Inpatient Substance Abuse Treatment - 30 Day",
        "clinical_rationale_provided": "Patient with severe opioid use disorder, 3 prior outpatient treatment failures, recent overdose requiring naloxone reversal. ASAM criteria Level 3.7 placement indicated. Inpatient treatment is medically necessary per mental health parity requirements.",
        "financial_amount_disputed": 25000.00,
        "key_evidence_cited": "ASAM assessment Level 3.7, 3 failed outpatient programs documented, recent naloxone reversal, mental health parity act, psychiatrist recommendation",
        "policy_referenced": "UM-BH-003",
    },
    {
        "appellant_type": "Provider", "appeal_level": "Level 1 - Internal",
        "denial_reason_category": "Medical Necessity", "diagnosis_category": "Musculoskeletal",
        "requested_service": "Inpatient Admission - Cauda Equina Syndrome",
        "clinical_rationale_provided": "Patient with acute cauda equina syndrome presenting with bilateral leg weakness, saddle anesthesia, and urinary retention. MRI showing large L4-L5 disc herniation compressing cauda equina. Requires emergent surgical decompression within 24-48 hours to prevent permanent paralysis.",
        "financial_amount_disputed": 55000.00,
        "key_evidence_cited": "MRI showing large disc herniation, urinary retention with post-void residual 450mL, neurological exam documenting saddle anesthesia, neurosurgery emergent consultation",
        "policy_referenced": "UM-ORTHO-003",
    },
]


def seed_appeal_intake():
    conn = get_connection()
    
    # Get all nurse IDs
    nurses = conn.execute("SELECT id FROM users WHERE role = 'NURSE' ORDER BY id").fetchall()
    if not nurses:
        print("No nurses found. Run seed_full.py first.")
        return
    
    nurse_ids = [n[0] for n in nurses]
    print(f"Found {len(nurse_ids)} nurses for appeal assignment.")
    
    # Clear existing appeal intake data
    conn.execute("DELETE FROM appeal_intake_cases")
    
    random.seed(42)
    base_date = datetime(2026, 5, 1)
    
    cases_inserted = 0
    pending_count = 0
    conn.execute("BEGIN TRANSACTION")
    
    # ── PART 1: Historical Resolved Cases (original 20) ──────────────────────
    for i, case_data in enumerate(APPEAL_CASES):
        appeal_id = f"app-seed-{i+1:03d}"
        case_id = f"appeal-case-{i+1:03d}"
        
        # Round-robin across all nurses
        assigned_nurse = nurse_ids[i % len(nurse_ids)]
        original_nurse = nurse_ids[(i + 5) % len(nurse_ids)]
        
        denial_date = base_date + timedelta(days=random.randint(0, 30))
        received_date = denial_date + timedelta(days=random.randint(1, 7))
        
        outcome = HISTORICAL_OUTCOMES[i % len(HISTORICAL_OUTCOMES)]
        turnaround_days = random.randint(5, 35)
        resolution_date = received_date + timedelta(days=turnaround_days)
        
        conn.execute("""
            INSERT INTO appeal_intake_cases (
                id, case_id, member_id, appellant_type, original_denial_date,
                appeal_received_date, appeal_level, denial_reason_category,
                clinical_rationale_provided, requested_service, diagnosis_category,
                financial_amount_disputed, reviewer_assigned, appeal_outcome,
                resolution_date, turnaround_days, key_evidence_cited,
                policy_referenced, original_nurse_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, [
            appeal_id, case_id, case_data["member_id"], case_data["appellant_type"],
            denial_date.strftime("%Y-%m-%d"), received_date.strftime("%Y-%m-%d"),
            case_data["appeal_level"], case_data["denial_reason_category"],
            case_data["clinical_rationale_provided"], case_data["requested_service"],
            case_data["diagnosis_category"], case_data["financial_amount_disputed"],
            assigned_nurse, outcome,
            resolution_date.strftime("%Y-%m-%d"),
            turnaround_days, case_data["key_evidence_cited"],
            case_data["policy_referenced"], original_nurse
        ])
        cases_inserted += 1

    # ── PART 2: Pending Cases — 3 per nurse ──────────────────────────────────
    # These are the demo-ready cases that appear in every nurse's workspace
    num_per_nurse = 3
    template_count = len(PENDING_APPEAL_TEMPLATES)
    recent_base = datetime(2026, 6, 15)  # More recent dates

    for nurse_idx, nurse_id in enumerate(nurse_ids):
        for j in range(num_per_nurse):
            seq = nurse_idx * num_per_nurse + j
            template = PENDING_APPEAL_TEMPLATES[seq % template_count]
            
            appeal_id = f"app-pending-{seq+1:03d}"
            case_id = f"appeal-pending-{seq+1:03d}"
            member_id = f"MBR-2026-{5001 + seq}"
            
            # Ensure original_nurse is never the same as reviewer
            original_nurse = nurse_ids[(nurse_idx + 3 + j) % len(nurse_ids)]
            if original_nurse == nurse_id:
                original_nurse = nurse_ids[(nurse_idx + 7 + j) % len(nurse_ids)]
            
            denial_date = recent_base + timedelta(days=random.randint(0, 7))
            received_date = denial_date + timedelta(days=random.randint(1, 3))
            
            conn.execute("""
                INSERT INTO appeal_intake_cases (
                    id, case_id, member_id, appellant_type, original_denial_date,
                    appeal_received_date, appeal_level, denial_reason_category,
                    clinical_rationale_provided, requested_service, diagnosis_category,
                    financial_amount_disputed, reviewer_assigned, appeal_outcome,
                    resolution_date, turnaround_days, key_evidence_cited,
                    policy_referenced, original_nurse_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, [
                appeal_id, case_id, member_id, template["appellant_type"],
                denial_date.strftime("%Y-%m-%d"), received_date.strftime("%Y-%m-%d"),
                template["appeal_level"], template["denial_reason_category"],
                template["clinical_rationale_provided"], template["requested_service"],
                template["diagnosis_category"], template["financial_amount_disputed"],
                nurse_id, None,  # appeal_outcome = NULL → pending
                None, None,     # no resolution date or turnaround
                template["key_evidence_cited"],
                template["policy_referenced"], original_nurse
            ])
            cases_inserted += 1
            pending_count += 1
    
    conn.execute("COMMIT")
    print(f"[OK] Seeded {cases_inserted} realistic appeal intake cases.")
    print(f"     Historical (resolved): {len(APPEAL_CASES)} cases")
    print(f"     Pending (demo-ready):  {pending_count} cases ({num_per_nurse} per nurse)")

if __name__ == "__main__":
    seed_appeal_intake()

