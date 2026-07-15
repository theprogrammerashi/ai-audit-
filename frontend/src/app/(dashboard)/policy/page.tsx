"use client";

import { FileText, Search, ExternalLink, X, ChevronRight } from "lucide-react";
import { useState } from "react";

const POLICIES = [
  {
    code: "UM-CHF-001", name: "Acute Congestive Heart Failure Inpatient Admission Guidelines",
    description: "Clinical criteria for inpatient admission for acute CHF exacerbation cases.",
    sections: 8, lastUpdated: "2025-01-15",
    fullSections: [
      { id: "1", title: "Purpose and Scope", content: "This policy establishes standardized criteria for determining the medical necessity of inpatient admission for patients presenting with acute congestive heart failure (CHF) exacerbation. It applies to all utilization management reviews for CHF-related admissions across all payer types." },
      { id: "2", title: "Definitions", content: "Acute CHF Exacerbation: A sudden worsening of CHF symptoms requiring urgent medical intervention beyond what can be provided in an outpatient or observation setting.\nDecompensated Heart Failure: A state where the heart cannot maintain adequate blood flow, leading to fluid overload and organ hypoperfusion.\nNew York Heart Association (NYHA) Class IV: Symptoms at rest, inability to carry out any physical activity without discomfort." },
      { id: "3", title: "Applicable Population", content: "Adult patients (age >= 18) presenting with signs and symptoms consistent with acute CHF exacerbation, including but not limited to: dyspnea at rest or with minimal exertion, peripheral edema, pulmonary congestion, and elevated cardiac biomarkers." },
      { id: "4", title: "Clinical Indicators for Review", content: "The following clinical indicators should prompt a comprehensive medical necessity review:\n- New onset heart failure with hemodynamic instability\n- Known CHF with worsening symptoms despite current therapy\n- Fluid overload refractory to oral diuretics\n- Respiratory distress requiring supplemental oxygen\n- Acute coronary syndrome with concurrent CHF\n- Cardiogenic shock or near-shock state" },
      { id: "5A", title: "Criterion: Oxygen Saturation", content: "Inpatient admission is supported when oxygen saturation is below 90% on room air, or the patient requires supplemental oxygen to maintain SpO2 above 90%. Document the specific SpO2 reading and the oxygen delivery method and flow rate." },
      { id: "5B", title: "Criterion: Elevated BNP", content: "Inpatient admission is supported when BNP is greater than 500 pg/mL (or NT-proBNP > 900 pg/mL). Critical elevation is defined as BNP > 2000 pg/mL. Document the specific BNP value and reference range used." },
      { id: "5C", title: "Criterion: Reduced Ejection Fraction", content: "Inpatient admission is supported when echocardiography demonstrates a reduced ejection fraction (< 40%) with evidence of acute decompensation. Document the EF percentage and the date of the echocardiogram." },
      { id: "5D", title: "Criterion: IV Diuretic Requirement", content: "Inpatient admission is supported when the patient requires IV diuretics due to inadequate response to oral diuretic therapy. Document the oral regimen that was attempted and the clinical rationale for transitioning to IV therapy." },
    ],
  },
  {
    code: "UM-COPD-001", name: "Acute COPD Exacerbation Inpatient Admission Guidelines",
    description: "Clinical criteria for inpatient admission for acute COPD exacerbation cases.",
    sections: 7, lastUpdated: "2025-01-15",
    fullSections: [
      { id: "1", title: "Purpose and Scope", content: "This policy establishes standardized criteria for determining the medical necessity of inpatient admission for patients presenting with acute exacerbation of chronic obstructive pulmonary disease (COPD)." },
      { id: "2", title: "Definitions", content: "Acute COPD Exacerbation: An acute worsening of respiratory symptoms (dyspnea, cough, sputum production) beyond normal day-to-day variation, requiring a change in medication.\nGOLD Classification: Global Initiative for Chronic Obstructive Lung Disease staging system (Stages I-IV)." },
      { id: "3", title: "Applicable Population", content: "Adult patients with known COPD (GOLD Stage II or higher) presenting with acute exacerbation symptoms. Also applies to new-onset COPD diagnosed during the acute presentation." },
      { id: "4A", title: "Criterion: Hypoxemia", content: "Inpatient admission is supported when O2 saturation is below 88% on room air, or the patient requires supplemental oxygen above baseline. Document the specific SpO2 reading." },
      { id: "4B", title: "Criterion: Failed Outpatient Treatment", content: "Inpatient admission is supported when the patient has failed a course of outpatient treatment (oral steroids, antibiotics, or bronchodilators) within the preceding 72 hours." },
      { id: "4C", title: "Criterion: Respiratory Acidosis", content: "Inpatient admission is supported when ABG demonstrates respiratory acidosis (pH < 7.35, pCO2 > 45 mmHg). Document the ABG values and timing." },
      { id: "4D", title: "Criterion: IV Corticosteroid Requirement", content: "Inpatient admission is supported when the patient requires IV corticosteroids due to severity of exacerbation or inability to tolerate oral medications." },
    ],
  },
  {
    code: "UM-SEPSIS-001", name: "Sepsis and Severe Infection Inpatient Admission Guidelines",
    description: "Clinical criteria for inpatient admission for sepsis and severe infection cases.",
    sections: 9, lastUpdated: "2025-01-15",
    fullSections: [
      { id: "1", title: "Purpose and Scope", content: "This policy establishes standardized criteria for determining the medical necessity of inpatient admission for patients presenting with sepsis or severe infection." },
      { id: "2", title: "Definitions", content: "Sepsis: Life-threatening organ dysfunction caused by a dysregulated host response to infection. Meets qSOFA >= 2 or SOFA >= 2 criteria.\nSeptic Shock: Sepsis with persistent hypotension requiring vasopressors to maintain MAP >= 65 mmHg and serum lactate > 2 mmol/L despite adequate fluid resuscitation." },
      { id: "3", title: "Applicable Population", content: "Adult patients presenting with suspected or confirmed infection with signs of systemic inflammatory response or organ dysfunction." },
      { id: "6A", title: "Criterion: Suspected/Confirmed Infection", content: "The presence of a suspected or confirmed source of infection. Document the suspected source (UTI, pneumonia, cellulitis, etc.) and any microbiological data." },
      { id: "6B", title: "Criterion: Elevated Lactate", content: "Inpatient admission is supported when serum lactate is >= 2.0 mmol/L. Lactate >= 4.0 mmol/L indicates severe sepsis requiring aggressive management. Document serial lactate measurements." },
      { id: "6C", title: "Criterion: Persistent Hypotension", content: "Inpatient admission is supported when MAP < 65 mmHg or SBP < 90 mmHg despite adequate fluid resuscitation (>= 30 mL/kg crystalloid)." },
      { id: "6D", title: "Criterion: Altered Mental Status", content: "Inpatient admission is supported when the patient demonstrates acute alteration in mental status (confusion, disorientation, obtundation) attributed to the infectious process." },
      { id: "6E", title: "Criterion: IV Antibiotic Requirement", content: "Inpatient admission is supported when the patient requires IV antibiotic therapy that cannot be safely administered in an outpatient setting. Document the specific regimen and rationale." },
      { id: "7", title: "Sepsis Bundle Compliance", content: "All sepsis cases should adhere to the CMS SEP-1 bundle: Blood cultures before antibiotics, broad-spectrum antibiotics within 1 hour, lactate measurement, and 30 mL/kg crystalloid for hypotension or lactate >= 4." },
    ],
  },
  {
    code: "UM-OBS-IP-001", name: "Observation Status vs Inpatient Admission Determination Guidelines",
    description: "Guidelines for patient status classification between observation and inpatient.",
    sections: 5, lastUpdated: "2025-01-15",
    fullSections: [
      { id: "1", title: "Purpose and Scope", content: "This policy provides guidance for determining the appropriate patient status classification (observation vs. inpatient) based on the expected duration and complexity of care required." },
      { id: "2", title: "Observation Status Criteria", content: "Observation status is appropriate when: Expected duration of stay < 24 hours; Patient condition is expected to improve or be resolved; Patient does not meet inpatient admission criteria." },
      { id: "3", title: "Inpatient Admission Criteria", content: "Inpatient admission is appropriate when: Expected duration of stay >= 2 midnights; Condition requires ongoing hospital-level care; Patient meets severity-of-illness and intensity-of-service criteria." },
      { id: "4", title: "Two-Midnight Rule", content: "Per CMS guidelines, if the treating physician expects the patient to require hospital care spanning at least two midnights, inpatient admission is generally appropriate." },
      { id: "5", title: "Key Differentiators for CHF", content: "Duration of IV diuretic need (> 24h suggests inpatient), O2 requirement persistence, BNP trajectory, and response to initial treatment." },
    ],
  },
  {
    code: "UM-GEN-001", name: "General Medical Necessity Determination Policy",
    description: "General policy for medical necessity determination across all diagnosis categories.",
    sections: 5, lastUpdated: "2025-01-15",
    fullSections: [
      { id: "1", title: "Purpose and Scope", content: "This policy establishes the general framework for medical necessity determinations across all diagnosis categories when condition-specific policies are not available." },
      { id: "2", title: "Medical Necessity Criteria", content: "A service is medically necessary when it is: Consistent with the patient's diagnosis or condition; Not primarily for convenience; Recognized as the standard of care; Not experimental or investigational." },
      { id: "3", title: "Severity of Illness", content: "The patient must demonstrate a severity of illness that warrants the requested level of care. Documentation must include specific clinical indicators." },
      { id: "4", title: "Intensity of Service", content: "The intensity of services required must be consistent with what can only be provided at the requested level of care." },
      { id: "5", title: "Documentation Requirements", content: "All medical necessity determinations must be supported by documented clinical evidence including: presenting symptoms, physical examination findings, diagnostic results, treatment plan, and expected course of care." },
    ],
  },
  // ── NEW POLICIES ──
  {
    code: "UM-DM-001", name: "Diabetes Mellitus Management & Admission Guidelines",
    description: "Clinical criteria for inpatient admission and management of diabetic emergencies.",
    sections: 8, lastUpdated: "2025-06-01",
    fullSections: [
      { id: "1", title: "Purpose and Scope", content: "This policy establishes criteria for inpatient admission and management of patients presenting with diabetic emergencies including DKA, HHS, and severe hypoglycemia." },
      { id: "2", title: "Diabetic Ketoacidosis (DKA)", content: "Inpatient admission is required when:\n- Blood glucose > 250 mg/dL with ketonemia or ketonuria\n- Arterial pH < 7.30 or serum bicarbonate < 18 mEq/L\n- Anion gap > 12 mEq/L\nDocument serial glucose, pH, bicarbonate, and anion gap values." },
      { id: "3", title: "Hyperosmolar Hyperglycemic State (HHS)", content: "Inpatient (often ICU) admission required when:\n- Blood glucose > 600 mg/dL\n- Serum osmolality > 320 mOsm/kg\n- Altered mental status or neurological deficits\n- Severe dehydration" },
      { id: "4", title: "Severe Hypoglycemia", content: "Inpatient admission is supported when:\n- Glucose < 54 mg/dL with altered consciousness or seizure\n- Recurrent hypoglycemia despite treatment adjustments\n- Hypoglycemia in the setting of renal or hepatic failure" },
      { id: "5", title: "Insulin Management", content: "IV insulin drip is an inpatient-level intervention. Transition to subcutaneous insulin should be documented with overlap period. Document insulin protocol used and blood glucose monitoring frequency." },
      { id: "6", title: "Comorbid Conditions", content: "Diabetes complicated by acute kidney injury (creatinine > 2x baseline), acute coronary syndrome, infected diabetic wounds, or osteomyelitis may require extended inpatient management." },
      { id: "7", title: "Discharge Criteria", content: "Patient may be discharged when: glucose consistently 140-180 mg/dL, anion gap normalized, patient tolerating oral intake, subcutaneous insulin regimen established, and endocrine follow-up arranged within 7 days." },
      { id: "8", title: "Documentation Requirements", content: "Document: precipitating factor for admission, serial metabolic panels, insulin protocol and dosing, patient/family diabetes education provided, and discharge medication reconciliation." },
    ],
  },
  {
    code: "UM-STROKE-001", name: "Acute Stroke and TIA Admission Guidelines",
    description: "Clinical criteria for inpatient admission for acute ischemic stroke, hemorrhagic stroke, and TIA.",
    sections: 8, lastUpdated: "2025-06-01",
    fullSections: [
      { id: "1", title: "Purpose and Scope", content: "This policy establishes criteria for admission and management of acute cerebrovascular events including ischemic stroke, hemorrhagic stroke, and transient ischemic attack (TIA)." },
      { id: "2", title: "Acute Ischemic Stroke", content: "Inpatient admission is required for all confirmed acute ischemic strokes. Document:\n- NIHSS score on arrival\n- Time of symptom onset (last known well)\n- CT/CTA findings\n- tPA eligibility and administration if applicable\n- Thrombectomy candidacy assessment" },
      { id: "3", title: "Hemorrhagic Stroke", content: "ICU-level admission is required for:\n- Any intracerebral hemorrhage (ICH)\n- Subarachnoid hemorrhage (SAH)\nDocument: GCS score, hemorrhage volume, location, and neurosurgical consultation." },
      { id: "4", title: "TIA Management", content: "Observation or short-stay admission is appropriate for TIA patients with:\n- ABCD2 score >= 4 (high risk)\n- Multiple events within 7 days\n- Known intracranial stenosis\n- Incomplete workup (awaiting MRI/MRA or echocardiogram)" },
      { id: "5", title: "Stroke Unit Requirements", content: "Patients should be admitted to a certified stroke unit when available. Continuous cardiac monitoring for minimum 24 hours. Dysphagia screening before any oral intake." },
      { id: "6", title: "tPA and Thrombectomy", content: "IV tPA within 4.5 hours of symptom onset. Mechanical thrombectomy considered for large vessel occlusion within 24 hours. Post-procedure ICU monitoring for minimum 24 hours." },
      { id: "7", title: "Secondary Prevention", content: "Prior to discharge: antiplatelet therapy initiated, statin therapy, blood pressure management plan, anticoagulation if atrial fibrillation detected, and smoking cessation counseling." },
      { id: "8", title: "Rehabilitation Assessment", content: "PT/OT/Speech evaluation within 24 hours. Document functional status using modified Rankin Scale. Determine need for inpatient rehabilitation vs. SNF vs. home health." },
    ],
  },
  {
    code: "UM-CANCER-001", name: "Oncology Treatment Authorization Guidelines",
    description: "Prior authorization criteria for chemotherapy, radiation, immunotherapy, and cancer surgeries.",
    sections: 7, lastUpdated: "2025-06-01",
    fullSections: [
      { id: "1", title: "Purpose and Scope", content: "This policy governs prior authorization requirements for oncology treatments including systemic therapy (chemotherapy, immunotherapy, targeted therapy), radiation therapy, and surgical oncology procedures." },
      { id: "2", title: "NCCN Guidelines Alignment", content: "All treatment authorizations must align with current NCCN Clinical Practice Guidelines for the specific cancer type and stage. Off-guideline treatments require peer-to-peer review with an oncology specialist." },
      { id: "3", title: "Chemotherapy Authorization", content: "Required documentation:\n- Pathology report with tumor type and grade\n- Staging workup (CT, PET, MRI as appropriate)\n- ECOG performance status (must be 0-2 for most regimens)\n- Prior treatment history\n- Proposed regimen with NCCN category of evidence" },
      { id: "4", title: "Immunotherapy Criteria", content: "Checkpoint inhibitors (PD-1/PD-L1, CTLA-4) require:\n- Biomarker testing results (PD-L1 TPS, MSI status, TMB)\n- Documentation of FDA-approved indication\n- Baseline organ function within acceptable parameters\n- No active autoimmune conditions (relative contraindication)" },
      { id: "5", title: "Radiation Therapy", content: "Authorization requires:\n- Radiation oncology consultation note\n- Treatment planning (IMRT, SBRT, proton therapy with justification)\n- Fractionation schedule\n- Prior radiation history (cumulative dose considerations)" },
      { id: "6", title: "Surgical Oncology", content: "Complex cancer surgeries require:\n- Multidisciplinary tumor board recommendation\n- Pre-operative staging confirmation\n- Surgical plan including margin goals\n- Discussion of neoadjuvant therapy consideration" },
      { id: "7", title: "Experimental Treatments", content: "Investigational treatments are not covered unless:\n- Patient is enrolled in an approved clinical trial\n- Compassionate use/expanded access authorization from FDA\n- Peer-reviewed evidence supports efficacy for the specific indication" },
    ],
  },
  {
    code: "UM-CKD-001", name: "Chronic Kidney Disease Management Guidelines",
    description: "Clinical criteria for CKD staging, dialysis authorization, and transplant evaluation.",
    sections: 7, lastUpdated: "2025-06-01",
    fullSections: [
      { id: "1", title: "Purpose and Scope", content: "This policy covers medical necessity criteria for CKD management, dialysis initiation and continuation, and renal transplant evaluation. Applies to CKD Stages 3-5 and ESRD." },
      { id: "2", title: "CKD Staging and Monitoring", content: "Stage 3a: eGFR 45-59 mL/min — quarterly monitoring\nStage 3b: eGFR 30-44 mL/min — nephrology referral required\nStage 4: eGFR 15-29 mL/min — dialysis access planning\nStage 5: eGFR <15 mL/min — dialysis initiation evaluation" },
      { id: "3", title: "Inpatient Admission Criteria", content: "Admission supported for:\n- Acute kidney injury superimposed on CKD (creatinine > 2x baseline)\n- Severe electrolyte derangements (K+ > 6.5, Na+ < 120)\n- Fluid overload refractory to outpatient diuretics\n- Uremic encephalopathy or pericarditis\n- Emergency dialysis requirement" },
      { id: "4", title: "Dialysis Authorization", content: "Hemodialysis initiation requires:\n- eGFR < 15 mL/min with uremic symptoms, OR\n- Refractory fluid overload, OR\n- Severe electrolyte abnormalities unresponsive to medical management\nDocument vascular access type and dialysis prescription." },
      { id: "5", title: "Peritoneal Dialysis", content: "PD authorization requires:\n- Patient/caregiver training documentation\n- Home assessment for PD capability\n- Catheter placement surgical clearance\n- Monthly adequacy testing (Kt/V target >= 1.7)" },
      { id: "6", title: "Transplant Evaluation", content: "Referral for transplant evaluation when:\n- eGFR < 20 mL/min and declining\n- Expected to need dialysis within 12 months\n- No absolute contraindications (active malignancy, active infection, severe cardiac disease)" },
      { id: "7", title: "Medication Management", content: "Document medication adjustments for renal dosing:\n- ACE-I/ARB monitoring (creatinine and potassium within 1-2 weeks of initiation)\n- Phosphate binder compliance\n- ESA therapy with hemoglobin targets (10-11.5 g/dL)\n- Avoid nephrotoxins (NSAIDs, contrast without protection)" },
    ],
  },
  {
    code: "UM-PNEU-001", name: "Pneumonia Inpatient Admission Guidelines",
    description: "Clinical criteria for pneumonia admission using CURB-65 and PSI scoring.",
    sections: 7, lastUpdated: "2025-06-01",
    fullSections: [
      { id: "1", title: "Purpose and Scope", content: "This policy establishes criteria for inpatient admission of patients with community-acquired pneumonia (CAP), hospital-acquired pneumonia (HAP), and aspiration pneumonia." },
      { id: "2", title: "CURB-65 Score", content: "Confusion, Urea > 7 mmol/L, Respiratory rate >= 30, Blood pressure (SBP < 90 or DBP <= 60), Age >= 65\n\nScore 0-1: Outpatient treatment\nScore 2: Short-stay/observation\nScore 3-5: Inpatient admission (Score 4-5: consider ICU)" },
      { id: "3", title: "Pneumonia Severity Index (PSI)", content: "Risk Class I-II: Outpatient treatment\nRisk Class III: Observation\nRisk Class IV-V: Inpatient admission\nCalculation includes: age, nursing home residence, coexisting conditions, physical exam findings, and lab/imaging results." },
      { id: "4", title: "ICU Admission Criteria", content: "Major criteria (any one):\n- Invasive mechanical ventilation required\n- Septic shock requiring vasopressors\n\nMinor criteria (three or more):\n- RR >= 30, PaO2/FiO2 <= 250, multilobar infiltrates, confusion, BUN >= 20, WBC < 4000, platelets < 100,000, hypothermia, hypotension requiring aggressive fluids" },
      { id: "5", title: "Antibiotic Selection", content: "CAP inpatient: Respiratory fluoroquinolone OR beta-lactam + macrolide\nCAP ICU: Beta-lactam + macrolide or fluoroquinolone + consider anti-MRSA/Pseudomonal coverage\nHAP/VAP: Anti-pseudomonal beta-lactam + anti-MRSA agent\nDocument empiric vs. directed therapy and de-escalation plan." },
      { id: "6", title: "Response Assessment", content: "Evaluate clinical response at 48-72 hours:\n- Defervescence (temperature < 37.8°C for 24h)\n- Improving respiratory status (declining O2 requirement)\n- Downtrending WBC and procalcitonin\nFailure to improve warrants: repeat imaging, broader cultures, ID consultation." },
      { id: "7", title: "Discharge Criteria", content: "Patient may be discharged when clinically stable for 24 hours:\n- Temperature < 37.8°C\n- Heart rate < 100\n- RR < 24\n- SBP >= 90\n- O2 sat >= 90% on room air (or baseline)\n- Tolerating oral intake and oral antibiotics\n- Follow-up chest X-ray at 6 weeks arranged" },
    ],
  },
  {
    code: "UM-APPEAL-001", name: "Appeal Process and Documentation Requirements",
    description: "Standard operating procedures for managing clinical appeals and peer-to-peer reviews.",
    sections: 6, lastUpdated: "2025-06-01",
    fullSections: [
      { id: "1", title: "Purpose and Scope", content: "This policy defines the appeal process for adverse determinations including denial of service, reduction of service, and termination of service. Applies to all levels of appeal (first-level, second-level, and external review)." },
      { id: "2", title: "First-Level Appeal", content: "Must be filed within 60 days of adverse determination.\nRequired documentation:\n- Copy of original denial letter\n- Updated clinical information supporting medical necessity\n- Attending physician statement\n- Any additional diagnostic results\nReview by a physician not involved in original determination." },
      { id: "3", title: "Second-Level Appeal", content: "Available if first-level appeal is upheld.\nMust be filed within 60 days of first-level decision.\nReview by a board-certified physician in the relevant specialty.\nMay include peer-to-peer discussion between treating physician and reviewing physician." },
      { id: "4", title: "External Review", content: "Available after exhausting internal appeals.\nReferred to an Independent Review Organization (IRO).\nIRO decision is binding on the health plan.\nTimeline: Standard — 45 days; Expedited — 72 hours for urgent cases." },
      { id: "5", title: "Expedited Appeal", content: "Available when standard timeframe could seriously jeopardize the patient's life, health, or ability to regain maximum function.\nDecision within 72 hours.\nOral request acceptable; written follow-up within 24 hours.\nConcurrent provision of services during review for inpatients." },
      { id: "6", title: "Documentation Standards", content: "All appeal decisions must document:\n- Clinical rationale with specific policy citations\n- Evidence reviewed (clinical notes, lab results, imaging)\n- Qualification of reviewing physician\n- Notification to member and provider within required timeframe\n- Right to further appeal and external review" },
    ],
  },
];

export default function PolicyPage() {
  const [search, setSearch] = useState("");
  const [selectedPolicy, setSelectedPolicy] = useState<typeof POLICIES[0] | null>(null);

  const filtered = POLICIES.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="animate-fade-in" style={{ padding: "32px" }}>
      <div className="page-header">
        <h1><FileText size={28} style={{ color: "var(--primary)" }} /> Policy Library</h1>
        <p>
          Clinical policy guidelines and criteria reference — {POLICIES.length} policies
        </p>
      </div>

      <div style={{ marginBottom: "20px", position: "relative", maxWidth: "400px" }}>
        <Search size={16} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }} />
        <input className="input" placeholder="Search policies..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: "40px" }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: "16px" }}>
        {filtered.map((p) => (
          <div key={p.code} className="card" style={{ cursor: "pointer", borderLeft: "3px solid var(--primary)" }}
            onClick={() => setSelectedPolicy(p)}
            onMouseEnter={(e) => e.currentTarget.style.boxShadow = "var(--shadow-lg)"}
            onMouseLeave={(e) => e.currentTarget.style.boxShadow = "none"}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
              <span className="badge badge-primary" style={{ fontSize: "0.75rem" }}>{p.code}</span>
              <ExternalLink size={14} style={{ color: "var(--text-tertiary)" }} />
            </div>
            <h4 style={{ fontSize: "0.95rem", marginBottom: "6px" }}>{p.name}</h4>
            <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "12px" }}>{p.description}</p>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
              <span>{p.fullSections.length} sections</span>
              <span>Updated: {p.lastUpdated}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Policy Detail Modal */}
      {selectedPolicy && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center",
            animation: "fadeIn 0.2s ease",
          }}
          onClick={() => setSelectedPolicy(null)}
        >
          <div
            style={{
              background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", width: "720px", maxHeight: "80vh",
              overflow: "hidden", boxShadow: "var(--shadow-lg)", display: "flex", flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "24px 28px 16px", borderBottom: "1px solid var(--border-default)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <span className="badge badge-primary" style={{ marginBottom: "8px", display: "inline-block" }}>{selectedPolicy.code}</span>
                <h2 style={{ fontSize: "1.1rem", marginBottom: "4px" }}>{selectedPolicy.name}</h2>
                <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{selectedPolicy.description}</p>
              </div>
              <button onClick={() => setSelectedPolicy(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", color: "var(--text-tertiary)" }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px" }}>
              <div style={{ display: "flex", gap: "12px", marginBottom: "20px", fontSize: "0.8rem", color: "var(--text-tertiary)" }}>
                <span>{selectedPolicy.fullSections.length} sections</span>
                <span>Last updated: {selectedPolicy.lastUpdated}</span>
              </div>

              {selectedPolicy.fullSections.map((section, i) => (
                <div key={section.id} style={{ marginBottom: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                    <div style={{
                      width: "24px", height: "24px", borderRadius: "50%", background: "var(--primary-light)",
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem",
                      fontWeight: 600, color: "var(--primary)", flexShrink: 0,
                    }}>
                      {section.id}
                    </div>
                    <h4 style={{ fontSize: "0.9rem" }}>{section.title}</h4>
                  </div>
                  <div style={{ paddingLeft: "32px", fontSize: "0.85rem", lineHeight: 1.7, color: "var(--text-secondary)", whiteSpace: "pre-line" }}>
                    {section.content}
                  </div>
                  {i < selectedPolicy.fullSections.length - 1 && (
                    <div style={{ borderBottom: "1px solid var(--border-default)", margin: "16px 0 0 32px" }} />
                  )}
                </div>
              ))}
            </div>

            <div style={{ padding: "16px 28px", borderTop: "1px solid var(--border-default)", display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <button className="btn btn-secondary" onClick={() => setSelectedPolicy(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
