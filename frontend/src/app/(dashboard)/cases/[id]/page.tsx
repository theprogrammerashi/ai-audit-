"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, User, Stethoscope, Activity, FileText, AlertTriangle, Clock, Shield, Loader2, X, Eye, Info
} from "lucide-react";
import api from "@/lib/api";

const formatRiskSignal = (s: string): string => {
  if (!s) return "";
  return s
    .replace(/_/g, " ")
    .split(" ")
    .map(w => {
      const lower = w.toLowerCase();
      if (lower === "bnp" || lower === "ef" || lower === "wbc") {
        return lower.toUpperCase();
      }
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
};

const capitalizeMedicalTerms = (text: string): string => {
  if (!text) return "";
  return text
    .replace(/\bbnp\b/gi, "BNP")
    .replace(/\bef\b/gi, "EF");
};

const mapEventName = (event: string) => {
  if (!event) return "";
  const norm = event.toLowerCase().trim();
  if (norm === "er presentation") return "First Emergency Room Assessment";
  if (norm === "sepsis workup" || norm === "workup") return "Testing & Diagnostics";
  if (norm === "resuscitation") return "Stabilizing Care";
  return event;
};

const DIAGNOSIS_INSIGHTS: Record<string, {
  title: string;
  medicalContext: string;
  unspecifiedMeaning: string;
  auditImpact: string;
  classificationsHeader?: string;
  classifications?: string[];
}> = {
  afib: {
    title: "Diagnosis Insights: Unspecified AFib",
    medicalContext: "In a medical context, Atrial Fibrillation (AFib) is an irregular and often very rapid heart rhythm that can lead to blood clots, stroke, or heart failure.",
    unspecifiedMeaning: "This means the clinical documentation confirms the patient has AFib, but does not provide enough details to categorize it into a specific subtype (such as Paroxysmal, Persistent, or Permanent).",
    auditImpact: "Insurance companies frequently audit or deny 'Unspecified' cases. They require highly specific diagnosis codes to justify inpatient admission or costly therapies. An 'Unspecified' code often triggers a request for additional clinical charts.",
    classificationsHeader: "Standard AFib Classifications:",
    classifications: [
      "Paroxysmal: Comes and goes; episodes terminate spontaneously within 7 days.",
      "Persistent: Continuous AFib lasting longer than 7 days.",
      "Long-standing Persistent: Continuous AFib for over 12 months.",
      "Permanent (Chronic): Joint decision to accept the rhythm and manage symptoms rather than restore normal rhythm."
    ]
  },
  chest_pain: {
    title: "Diagnosis Insights: Unspecified Chest Pain",
    medicalContext: "In a medical context, Chest Pain is a critical symptom representing chest discomfort that can arise from cardiac (ischemic/heart-related) or non-cardiac (acid reflux, muscle strain, anxiety) origins.",
    unspecifiedMeaning: "This means the clinical documentation confirms the patient is experiencing chest pain, but the exact underlying cause (etiology) has not been definitively determined or documented in the primary diagnosis.",
    auditImpact: "Insurance companies frequently deny inpatient admission for 'Unspecified Chest Pain' (ICD-10 R07.9) under guidelines like InterQual. They expect patients with low-risk chest pain to be evaluated in outpatient observation. Inpatient placement is only approved if there is active evidence of acute coronary syndrome (ACS) or high-risk cardiac markers.",
    classificationsHeader: "Clinical Indicators of Cardiac Chest Pain:",
    classifications: [
      "Ischemic: Cardiac origin due to lack of blood flow (angina, myocardial infarction).",
      "Non-Ischemic: Atypical or muscular (gastroesophageal, pleural, anxiety-related).",
      "Atypical Chest Pain: Pain that doesn't fit standard angina criteria but requires caution."
    ]
  },
  general: {
    title: "Diagnosis Insights: Unspecified Codes",
    medicalContext: "In medical coding, diagnosis codes are divided into specific and unspecified categories. Unspecified codes are used when a diagnosis is made but lacks the clinical detail to assign a more specific code.",
    unspecifiedMeaning: "This means the documentation confirms the overarching condition, but lacks the subtype, site, or etiology details necessary for specific ICD-10 coding.",
    auditImpact: "Unspecified codes are a major target for clinical documentation improvement (CDI) audits. Insurance companies require specific coding to establish medical necessity, and unspecified codes often lead to claim denials or pre-authorization delays."
  }
};

const RISK_SIGNAL_EXPLANATIONS: Record<string, {
  title: string;
  meaning: string;
  significance: string;
}> = {
  observation_candidate: {
    title: "Risk Signal: Observation Candidate",
    meaning: "The patient's vital signs and core cardiac lab values are stable or in the normal range. Full inpatient severity thresholds are not met.",
    significance: "An inpatient stay is highly likely to be audited and denied by insurance reviewers. Placing the patient in Observation status for 24-48 hours is appropriate to monitor progress without financial denial risk."
  },
  elevated_bnp: {
    title: "Risk Signal: Elevated BNP",
    meaning: "Brain Natriuretic Peptide (BNP) levels are elevated, signaling high myocardial wall stress, typical of decompensated heart failure.",
    significance: "Crucial objective evidence to justify full Inpatient necessity. High BNP suggests severe fluid overload requiring continuous intravenous (IV) diuresis and intensive nursing care."
  },
  reduced_ef: {
    title: "Risk Signal: Reduced Ejection Fraction (EF)",
    meaning: "Ejection fraction is below 40%, indicating severe systolic dysfunction of the left ventricle.",
    significance: "Indicates serious heart failure severity. Supports acute care necessity as it presents high risk for lethal ventricular arrhythmias and sudden cardiac decompensation."
  },
  mildly_reduced_ef: {
    title: "Risk Signal: Mildly Reduced Ejection Fraction (EF)",
    meaning: "The heart's ejection fraction is between 40% and 50%, reflecting early or moderate impairment of cardiac output.",
    significance: "Presents a clinical grey zone. It requires close charting of associated clinical symptoms (like dyspnea, edema) to establish whether observation or full inpatient status is warranted."
  },
  severe_hypoxemia: {
    title: "Risk Signal: Severe Hypoxemia",
    meaning: "Oxygen saturation (O2 Sat) is critically low (typically < 88% on room air), indicating poor blood oxygenation.",
    significance: "A high-severity trigger that immediately supports inpatient admission. Requires continuous monitoring, high-flow supplemental oxygen, and frequent arterial blood gas evaluation."
  },
  failed_oral_diuretics: {
    title: "Risk Signal: Failed Oral Diuretics",
    meaning: "The patient did not respond to outpatient oral loop diuretics, presenting with refractory peripheral or pulmonary edema.",
    significance: "Justifies acute inpatient admission. Outpatient management has failed, requiring transition to aggressive intravenous (IV) diuretic infusions and daily electrolyte/fluid tracking."
  },
  hyperkalemia: {
    title: "Risk Signal: Hyperkalemia",
    meaning: "Blood potassium level is critically elevated (> 5.0 mEq/L), presenting a direct risk of cardiac arrest or arrhythmias.",
    significance: "A critical clinical condition requiring immediate treatment (e.g., insulin/dextrose, Kayexalate, or calcium gluconate) and continuous EKG tracking in an inpatient setting."
  },
  hypercapnic_respiratory_failure: {
    title: "Risk Signal: Hypercapnic Respiratory Failure",
    meaning: "Hypoventilation causing dangerously high carbon dioxide levels (pCO2 > 55 mmHg) and systemic acid buildup.",
    significance: "A severe condition requiring positive pressure ventilation (BiPAP/CPAP) or intubation. Strongly justifies inpatient/ICU placement."
  },
  failed_outpatient_treatment: {
    title: "Risk Signal: Failed Outpatient Treatment",
    meaning: "The patient's acute exacerbation (e.g. COPD flare-up) worsened despite taking standard outpatient prescriptions.",
    significance: "Indicates failure of standard medical regimens, demonstrating the clinical need for admission and transition to continuous IV therapies."
  },
  respiratory_acidosis: {
    title: "Risk Signal: Respiratory Acidosis",
    meaning: "Abnormally acidic blood pH (<7.35) caused by retention of carbon dioxide due to hypoventilation.",
    significance: "Signals severe respiratory distress. Requires active mechanical or non-invasive breathing support, fully justifying acute care admission."
  },
  leukocytosis: {
    title: "Risk Signal: Leukocytosis",
    meaning: "An abnormally high white blood cell (WBC) count, indicating a systemic response to infection or inflammation.",
    significance: "Supports the diagnosis of acute infectious processes (like pneumonia or cellulitis) requiring diagnostic cultures and IV antibiotic therapies."
  },
  persistent_hypotension: {
    title: "Risk Signal: Persistent Hypotension",
    meaning: "Low blood pressure (systolic <90 mmHg) that does not respond to initial intravenous fluid boluses.",
    significance: "Indicates hypovolemic, cardiogenic, or septic shock. Requires ICU admission, continuous arterial line monitoring, and vasopressor infusions."
  },
  elevated_lactate: {
    title: "Risk Signal: Elevated Lactate",
    meaning: "Serum lactate level is elevated (>= 2.0 mmol/L), demonstrating cellular hypoperfusion and anaerobic metabolism.",
    significance: "Key sepsis indicator. Urgently mandates immediate fluid resuscitation, broad-spectrum IV antibiotics, and serial lactate clearance checks."
  },
  altered_mental_status: {
    title: "Risk Signal: Altered Mental Status (AMS)",
    meaning: "Confusion, lethargy, or acute encephalopathy resulting from infection, metabolic imbalance, or hypoperfusion.",
    significance: "Represents severe systemic organ dysfunction. Strongly justifies acute admission to prevent neurological complications and aspiration."
  },
  sepsis_criteria_met: {
    title: "Risk Signal: Sepsis Criteria Met",
    meaning: "The patient exhibits systemic inflammation coupled with a documented or highly suspected acute infection.",
    significance: "A medical emergency requiring immediate compliance with the SEP-1 bundle (IV fluids, early antibiotics, blood cultures, lactate monitoring)."
  },
  severe_leukocytosis: {
    title: "Risk Signal: Severe Leukocytosis",
    meaning: "White blood cell count is critically high (>20,000/mcL), pointing to an aggressive systemic infection.",
    significance: "Points to high clinical severity, reinforcing the need for inpatient admission to ensure prompt diagnostic coverage and IV antibiotics."
  },
  borderline_vitals: {
    title: "Risk Signal: Borderline Vitals",
    meaning: "Vital signs are on the threshold of instability (e.g., borderline hypoxia or tachycardia).",
    significance: "Represents a high risk for quick deterioration. Supports placing the patient under short-term observation to monitor safety."
  }
};

const TIMELINE_EXPLANATIONS: Record<string, {
  title: string;
  meaning: string;
  significance: string;
}> = {
  "er presentation": {
    title: "Timeline Phase: First Emergency Room Assessment",
    meaning: "The initial point of entry where the patient presents to the Emergency Room. It captures vital signs, chief complaints, and acute symptoms.",
    significance: "Establishes the patient's baseline severity of illness at the moment of arrival, which is the starting point for proving medical necessity."
  },
  "labs & imaging": {
    title: "Timeline Phase: Labs & Imaging",
    meaning: "The immediate diagnostic tests (like chest X-rays, ECGs, blood tests, or Echo) ordered to identify the underlying cause of the symptoms.",
    significance: "Provides objective diagnostic indicators. These test results serve as the hard evidence reviewed by auditors to confirm the severity of the condition."
  },
  "treatment initiated": {
    title: "Timeline Phase: Treatment Initiated",
    meaning: "The active medical therapies, oxygen therapy, or intravenous medications started immediately upon determining the preliminary diagnosis.",
    significance: "Demonstrates the 'intensity of service'—proving that the patient's condition required active, complex medical care rather than simple observations."
  },
  "ongoing treatment": {
    title: "Timeline Phase: Ongoing Treatment",
    meaning: "The continued management, adjustment of medications, fluid balance monitoring, and serial monitoring over the course of the hospital stay.",
    significance: "Shows the necessity of continued hospitalization, proving that the patient was not stable enough for immediate outpatient discharge."
  },
  "labs & abg": {
    title: "Timeline Phase: Labs & ABG (Arterial Blood Gas)",
    meaning: "Diagnostic evaluation focusing on blood oxygenation, carbon dioxide levels, and pH balance (specifically using Arterial Blood Gas tests).",
    significance: "ABG values are the gold standard to prove respiratory failure, acidosis, or hypercapnia, which are critical criteria for admitting COPD or respiratory distress patients."
  },
  "treatment": {
    title: "Timeline Phase: Active Treatment",
    meaning: "The medical interventions (e.g. continuous nebulizers, intravenous corticosteroids, or antibiotics) administered to stabilize the patient.",
    significance: "Provides the record of specialized therapies that require acute hospital monitoring and cannot be safely administered at home."
  },
  "monitoring": {
    title: "Timeline Phase: Monitoring & RT",
    meaning: "Frequent check-ins, respiratory therapy (RT) cycles, and vital checks to evaluate the patient's response to therapy.",
    significance: "Indicates the patient requires frequent clinical observation and care adjustments (e.g. every 2-4 hours), supporting the need for hospital stay."
  },
  "sepsis workup": {
    title: "Timeline Phase: Testing & Diagnostics",
    meaning: "A targeted bundle of diagnostic tests (blood cultures, lactate levels, procalcitonin) ordered when sepsis is clinically suspected.",
    significance: "Necessary to fulfill the CMS sepsis core measures (SEP-1). Documenting a timely workup is essential to defend against billing audits and denials."
  },
  "resuscitation": {
    title: "Timeline Phase: Stabilizing Care",
    meaning: "Aggressive early interventions (like rapid intravenous fluid boluses and broad-spectrum antibiotics) to restore blood pressure and tissue perfusion.",
    significance: "Indicates critical illness (severe sepsis/septic shock). Immediate, intensive treatment supports the necessity of inpatient or ICU admission."
  },
  "icu monitoring": {
    title: "Timeline Phase: ICU Monitoring",
    meaning: "Highly intensive, continuous cardiorespiratory monitoring, arterial line tracking, and potential vasopressor support in the Intensive Care Unit.",
    significance: "The highest level of care. Telemetry and frequent vital checks are vital to justify ICU status and high-acuity reimbursement."
  },
  "floor monitoring": {
    title: "Timeline Phase: Floor Monitoring",
    meaning: "Regular care and monitoring on a standard medical-surgical floor (telemetry or standard observation checks).",
    significance: "Represents standard inpatient monitoring. Used to evaluate if the patient is stabilizing and ready for safe discharge planning."
  },
  "workup": {
    title: "Timeline Phase: Testing & Diagnostics",
    meaning: "The collection of diagnostic tests, blood panels, electrocardiograms, or echocardiograms ordered to evaluate the patient's presentation.",
    significance: "Documents the objective clinical evidence required to support the diagnosis and establish the justification for admission."
  },
  "initial management": {
    title: "Timeline Phase: Initial Management",
    meaning: "The immediate interventions, monitoring orders, and therapy plans initiated to address the patient's acute symptoms.",
    significance: "Outlines the initial plan of care, documenting the active medical supervision required to stabilize the patient."
  }
};

export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params.id as string;

  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);
  const [showDiagnosisInfo, setShowDiagnosisInfo] = useState(false);
  const [selectedRiskSignal, setSelectedRiskSignal] = useState<string | null>(null);
  const [selectedTimelinePhase, setSelectedTimelinePhase] = useState<string | null>(null);

  useEffect(() => {
    const fetchCase = async () => {
      try {
        const res = await api.get(`/cases/${caseId}`);
        setD(res.data);
      } catch (err) {
        console.error("Failed to fetch case data:", err);
        setError("Failed to load case data");
      } finally {
        setLoading(false);
      }
    };
    if (caseId) fetchCase();
  }, [caseId]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", flexDirection: "column", gap: "16px" }}>
        <Loader2 size={32} style={{ animation: "spin 1s linear infinite", color: "var(--primary)" }} />
        <p style={{ color: "var(--text-secondary)" }}>Loading case data...</p>
      </div>
    );
  }

  if (error || !d || !d.case) {
    return (
      <div style={{ padding: "32px", textAlign: "center", color: "var(--danger)" }}>
        <AlertTriangle size={32} style={{ margin: "0 auto 16px" }} />
        <h2>{error || "Case Not Found"}</h2>
        <p style={{ color: "var(--text-secondary)", marginTop: "8px" }}>The requested case does not exist.</p>
        <button className="btn btn-secondary" style={{ marginTop: "16px" }} onClick={() => router.push("/cases")}>
          <ArrowLeft size={16} /> Back to Cases
        </button>
      </div>
    );
  }

  const { case: c, policy_match: pm, decision: dec, audit_result: aud, appeal_risk: app } = d;
  const structured = c.structured_case || {};
  const patient = structured.patient || { name: c.patient_name, mrn: c.patient_mrn, dob: c.patient_dob, age: c.patient_age };
  const diagnosis = structured.diagnosis || { display: c.primary_diagnosis_display, primary: c.primary_diagnosis_code, secondary: c.secondary_diagnoses ? c.secondary_diagnoses.split(",") : [] };
  const vitals = structured.vitals || {};
  const labs = structured.labs || {};
  const summary = structured.clinical_summary || "No clinical summary available.";
  const riskSignals = structured.risk_signals || [];
  const timeline = structured.timeline || [];
  
  // Only show uploaded documents (from documents table), not seeded placeholder names
  const uploadedDocuments: any[] = d.documents || [];

  const riskLevel = aud ? aud.risk_level : "PENDING";
  const qaScore = aud ? aud.qa_score : 0;
  const decisionStr = dec ? dec.decision : "PENDING";
  const decisionColor = decisionStr === "APPROVED" ? "var(--success)" : decisionStr === "DENIED" ? "var(--danger)" : "var(--warning)";
  const riskColor = (riskLevel === "CRITICAL" || riskLevel === "HIGH") ? "var(--danger)" : riskLevel === "MEDIUM" ? "var(--info)" : riskLevel === "LOW" ? "var(--success)" : "var(--warning)";

  return (
    <div style={{ padding: "32px", maxWidth: "100%" }}>
      {/* Document Preview Modal */}
      {previewDoc && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.6)", zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center"
        }} onClick={() => setPreviewDoc(null)}>
          <div style={{
            background: "var(--bg-surface)", borderRadius: "var(--radius-lg)",
            width: "80%", maxWidth: "900px", maxHeight: "80vh",
            display: "flex", flexDirection: "column", overflow: "hidden",
            boxShadow: "var(--shadow-xl)"
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{
              padding: "16px 20px", borderBottom: "1px solid var(--border-default)",
              display: "flex", justifyContent: "space-between", alignItems: "center"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <FileText size={18} style={{ color: "var(--primary)" }} />
                <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>{previewDoc.filename}</span>
              </div>
              <button onClick={() => setPreviewDoc(null)} style={{
                background: "none", border: "none", cursor: "pointer", padding: "4px",
                color: "var(--text-tertiary)", borderRadius: "var(--radius-sm)"
              }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: "24px" }}>
              {previewDoc.content_text ? (
                <pre style={{
                  fontSize: "0.85rem", lineHeight: 1.7, color: "var(--text-secondary)",
                  whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "inherit", margin: 0
                }}>
                  {previewDoc.content_text}
                </pre>
              ) : (
                <div style={{ textAlign: "center", padding: "48px", color: "var(--text-tertiary)" }}>
                  <FileText size={48} style={{ marginBottom: "16px", opacity: 0.4 }} />
                  <p style={{ fontSize: "0.95rem", fontWeight: 500 }}>Document preview not available</p>
                  <p style={{ fontSize: "0.82rem", marginTop: "8px" }}>This file type does not support inline preview.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Diagnosis Insights Modal */}
      {(() => {
        const getInsightKey = () => {
          const code = (diagnosis.primary || "").toUpperCase();
          const display = (diagnosis.display || "").toLowerCase();
          
          if (code.includes("I48") || display.includes("atrial fibrillation") || display.includes("afib")) {
            return "afib";
          }
          if (code.includes("R07") || display.includes("chest pain")) {
            return "chest_pain";
          }
          return "general";
        };
        
        const insightKey = getInsightKey();
        const currentInsight = DIAGNOSIS_INSIGHTS[insightKey] || DIAGNOSIS_INSIGHTS.general;

        return showDiagnosisInfo && (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.5)", zIndex: 9999,
            display: "flex", alignItems: "center", justifyContent: "center",
            backdropFilter: "blur(2px)"
          }} onClick={() => setShowDiagnosisInfo(false)}>
            <div style={{
              background: "var(--bg-surface)", borderRadius: "var(--radius-lg)",
              width: "90%", maxWidth: "600px", display: "flex", flexDirection: "column",
              boxShadow: "var(--shadow-xl)", overflow: "hidden"
            }} onClick={(e) => e.stopPropagation()}>
              <div style={{
                padding: "16px 20px", borderBottom: "1px solid var(--border-default)",
                display: "flex", justifyContent: "space-between", alignItems: "center"
              }}>
                <span style={{ fontWeight: 600, fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Info size={18} style={{ color: "var(--primary)" }} /> {currentInsight.title}
                </span>
                <button onClick={() => setShowDiagnosisInfo(false)} style={{
                  background: "none", border: "none", cursor: "pointer", padding: "4px",
                  color: "var(--text-tertiary)", borderRadius: "var(--radius-sm)"
                }}>
                  <X size={20} />
                </button>
              </div>
              <div style={{ padding: "24px", overflowY: "auto", maxHeight: "70vh", fontSize: "0.88rem", lineHeight: 1.6, color: "var(--text-secondary)" }}>
                <p style={{ marginBottom: "16px" }}>{currentInsight.medicalContext}</p>
                
                <h4 style={{ color: "var(--text-primary)", fontSize: "0.9rem", fontWeight: 600, marginBottom: "8px" }}>What does "Unspecified" mean?</h4>
                <p style={{ margin: 0 }}>{currentInsight.unspecifiedMeaning}</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Risk Signal Explanation Modal */}
      {selectedRiskSignal && (() => {
        const key = selectedRiskSignal.toLowerCase().replace(/ /g, "_");
        const explanation = RISK_SIGNAL_EXPLANATIONS[key] || {
          title: `Risk Signal: ${formatRiskSignal(selectedRiskSignal)}`,
          meaning: `This case was flagged with the clinical risk signal: "${formatRiskSignal(selectedRiskSignal)}".`,
          significance: "This signal highlights clinical severity, prompting utilization review to evaluate inpatient admission necessity under standard guidelines."
        };
        return (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.5)", zIndex: 9999,
            display: "flex", alignItems: "center", justifyContent: "center",
            backdropFilter: "blur(2px)"
          }} onClick={() => setSelectedRiskSignal(null)}>
            <div style={{
              background: "var(--bg-surface)", borderRadius: "var(--radius-lg)",
              width: "90%", maxWidth: "500px", display: "flex", flexDirection: "column",
              boxShadow: "var(--shadow-xl)", overflow: "hidden"
            }} onClick={(e) => e.stopPropagation()}>
              <div style={{
                padding: "16px 20px", borderBottom: "1px solid var(--border-default)",
                display: "flex", justifyContent: "space-between", alignItems: "center"
              }}>
                <span style={{ fontWeight: 600, fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "8px" }}>
                  <AlertTriangle size={18} style={{ color: "var(--danger)" }} /> {explanation.title.replace(/^Risk Signal:\s*/i, "")}
                </span>
                <button onClick={() => setSelectedRiskSignal(null)} style={{
                  background: "none", border: "none", cursor: "pointer", padding: "4px",
                  color: "var(--text-tertiary)", borderRadius: "var(--radius-sm)"
                }}>
                  <X size={20} />
                </button>
              </div>
              <div style={{ padding: "20px 24px 24px", fontSize: "0.88rem", lineHeight: 1.6, color: "var(--text-secondary)" }}>
                <h4 style={{ color: "var(--text-primary)", fontSize: "0.9rem", fontWeight: 600, marginBottom: "6px" }}>Clinical Meaning:</h4>
                <p style={{ margin: 0 }}>{explanation.meaning}</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Timeline Phase Explanation Modal */}
      {selectedTimelinePhase && (() => {
        const key = selectedTimelinePhase.toLowerCase().trim();
        const explanation = TIMELINE_EXPLANATIONS[key] || {
          title: `Timeline Phase: ${selectedTimelinePhase}`,
          meaning: `This represents the "${selectedTimelinePhase}" phase of the patient's clinical path.`,
          significance: "Auditors review the events in this phase to track the timeliness of diagnostic tests and active treatments, establishing inpatient care necessity."
        };
        return (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.5)", zIndex: 9999,
            display: "flex", alignItems: "center", justifyContent: "center",
            backdropFilter: "blur(2px)"
          }} onClick={() => setSelectedTimelinePhase(null)}>
            <div style={{
              background: "var(--bg-surface)", borderRadius: "var(--radius-lg)",
              width: "90%", maxWidth: "500px", display: "flex", flexDirection: "column",
              boxShadow: "var(--shadow-xl)", overflow: "hidden"
            }} onClick={(e) => e.stopPropagation()}>
              <div style={{
                padding: "16px 20px", borderBottom: "1px solid var(--border-default)",
                display: "flex", justifyContent: "space-between", alignItems: "center"
              }}>
                <span style={{ fontWeight: 600, fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Clock size={18} style={{ color: "var(--primary)" }} /> {explanation.title}
                </span>
                <button onClick={() => setSelectedTimelinePhase(null)} style={{
                  background: "none", border: "none", cursor: "pointer", padding: "4px",
                  color: "var(--text-tertiary)", borderRadius: "var(--radius-sm)"
                }}>
                  <X size={20} />
                </button>
              </div>
              <div style={{ padding: "20px 24px 24px", fontSize: "0.88rem", lineHeight: 1.6, color: "var(--text-secondary)" }}>
                <h4 style={{ color: "var(--text-primary)", fontSize: "0.9rem", fontWeight: 600, marginBottom: "6px" }}>Clinical Meaning:</h4>
                <p style={{ margin: 0 }}>{explanation.meaning}</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
        <button onClick={() => router.push("/cases")} className="btn btn-secondary" style={{ padding: "6px 10px" }}>
          <ArrowLeft size={16} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
            <h1 style={{ fontSize: "1.4rem" }}>{c.case_number}</h1>
            <span className={`badge`} style={{ backgroundColor: riskColor, color: "white" }}>{riskLevel} RISK</span>
            <span className={`badge ${decisionColor === "var(--success)" ? "badge-success" : decisionColor === "var(--danger)" ? "badge-danger" : "badge-warning"}`}>{decisionStr}</span>
            <span className="badge badge-info">{c.status.replace("_", " ")}</span>
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>{patient.name || "Unknown Patient"} — {diagnosis.display}</p>
        </div>
      </div>

      <div style={{ borderTop: "1px solid var(--border-default)", marginTop: "16px", paddingTop: "24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          {/* Patient Demographics */}
          <div className="card">
            <h3 style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.9rem", marginBottom: "16px" }}>
              <User size={16} style={{ color: "var(--primary)" }} /> Patient Information
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              {[["Name", patient.name || "N/A"], ["MRN", patient.mrn || "N/A"], ["DOB", patient.dob || "N/A"], ["Age", patient.age ? `${patient.age} years` : "N/A"]].map(([l, v]) => (
                <div key={l}>
                  <div className="label" style={{ marginBottom: "2px" }}>{l}</div>
                  <div style={{ fontSize: "0.9rem", fontWeight: 500 }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ borderTop: "1px solid var(--border-default)", marginTop: "14px", paddingTop: "14px" }}>
              <div className="label" style={{ marginBottom: "4px" }}>Primary Diagnosis</div>
              <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
                {diagnosis.display}
                <button 
                  onClick={() => setShowDiagnosisInfo(true)}
                  style={{
                    background: "none", border: "none", padding: "2px", cursor: "pointer", 
                    color: "var(--primary)", display: "inline-flex", alignItems: "center",
                    borderRadius: "4px"
                  }}
                  title="View diagnosis details explanation"
                >
                  <Info size={14} />
                </button>
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-tertiary)" }}>ICD-10: {diagnosis.primary}</div>
              {diagnosis.secondary && diagnosis.secondary.length > 0 && (
                <div style={{ marginTop: "14px" }}>
                  <div className="label" style={{ marginBottom: "4px" }}>Secondary Diagnosis</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-tertiary)" }}>ICD-10: {diagnosis.secondary.join(", ")}</div>
                </div>
              )}
            </div>
          </div>

          {/* Vitals & Labs */}
          <div className="card">
            <h3 style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.9rem", marginBottom: "16px" }}>
              <Activity size={16} style={{ color: "var(--primary)" }} /> Vitals & Labs
            </h3>
            <div className="label" style={{ marginBottom: "8px" }}>Vital Signs</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "16px" }}>
              {Object.keys(vitals).length > 0 ? Object.entries(vitals).map(([key, val]) => {
                if (val === null) return null;
                const isAbnormal = (key === "o2_sat" && Number(val) < 90) || (key === "hr" && Number(val) > 100) || (key === "rr" && Number(val) > 24) || (key === "temp" && Number(val) > 100.4);
                return (
                  <div key={key} style={{ textAlign: "center", padding: "8px", background: isAbnormal ? "rgba(239,68,68,0.06)" : "var(--bg-body)", borderRadius: "var(--radius-md)" }}>
                    <div className="label">{key.replace("_", " ")}</div>
                    <div style={{ fontWeight: 600, color: isAbnormal ? "var(--danger)" : "var(--text-primary)" }}>{String(val)}{key === "temp" ? "°F" : key === "o2_sat" ? "%" : ""}</div>
                  </div>
                );
              }) : <div style={{ color: "var(--text-tertiary)", fontSize: "0.85rem", fontStyle: "italic" }}>No vitals recorded.</div>}
            </div>
            <div className="label" style={{ marginBottom: "8px" }}>Lab Results</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
              {Object.keys(labs).length > 0 ? Object.entries(labs).map(([key, val]) => {
                if (val === null) return null;
                const lowerKey = key.toLowerCase();
                const labName = (lowerKey === "bnp" || lowerKey === "ef" || lowerKey === "wbc") 
                  ? lowerKey.toUpperCase() 
                  : key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
                return (
                  <div key={key} style={{ display: "flex", justifyContent: "space-between", padding: "6px 8px", borderBottom: "1px solid var(--border-default)" }}>
                    <span style={{ fontSize: "0.8rem" }}>{labName}</span>
                    <span style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--danger)" }}>{String(val)}</span>
                  </div>
                );
              }) : <div style={{ color: "var(--text-tertiary)", fontSize: "0.85rem", fontStyle: "italic", gridColumn: "span 2" }}>No lab results recorded.</div>}
            </div>
          </div>

          {/* Clinical Summary */}
          <div className="card">
            <h3 style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.9rem", marginBottom: "12px" }}>
              <Stethoscope size={16} style={{ color: "var(--primary)" }} /> Clinical Summary
            </h3>
            <p style={{ fontSize: "0.85rem", lineHeight: 1.7, color: "var(--text-secondary)" }}>{capitalizeMedicalTerms(summary)}</p>
            {riskSignals.length > 0 && (
              <div style={{ borderTop: "1px solid var(--border-default)", marginTop: "14px", paddingTop: "14px" }}>
                <div className="label" style={{ marginBottom: "8px" }}>Warning Signs</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {riskSignals.map((s: string) => (
                    <span key={s} className="badge badge-danger" style={{ fontSize: "0.7rem", display: "inline-flex", alignItems: "center", gap: "4px", padding: "4px 8px" }}>
                      <AlertTriangle size={10} /> 
                      {formatRiskSignal(s)}
                      <button 
                        onClick={() => setSelectedRiskSignal(s)}
                        style={{
                          background: "none", border: "none", padding: "0", cursor: "pointer", 
                          color: "inherit", display: "inline-flex", alignItems: "center",
                          opacity: 0.85
                        }}
                        title={`Explain ${formatRiskSignal(s)} risk signal`}
                      >
                        <Info size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="card">
            <h3 style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.9rem", marginBottom: "16px" }}>
              <Clock size={16} style={{ color: "var(--primary)" }} /> Clinical Timeline
            </h3>
            {timeline.length > 0 ? (
              <ul style={{ paddingLeft: "20px", margin: 0, listStyleType: "disc", color: "var(--primary)" }}>
                {timeline.map((t: any, i: number) => (
                  <li key={i} style={{ marginBottom: "12px" }}>
                    <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: "4px", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
                      {mapEventName(t.event)}
                      <button 
                        onClick={() => setSelectedTimelinePhase(t.event)}
                        style={{
                          background: "none", border: "none", padding: "2px", cursor: "pointer", 
                          color: "var(--primary)", display: "inline-flex", alignItems: "center",
                          borderRadius: "4px"
                        }}
                        title={`Explain ${t.event} timeline phase`}
                      >
                        <Info size={12} />
                      </button>
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>{capitalizeMedicalTerms(t.details)}</div>
                  </li>
                ))}
              </ul>
            ) : <p style={{ color: "var(--text-tertiary)", fontSize: "0.85rem", fontStyle: "italic" }}>No timeline events recorded.</p>}
          </div>
        </div>

        {/* Attached Documents — Only show when real uploaded documents exist */}
        {uploadedDocuments.length > 0 && (
          <div style={{ marginTop: "20px" }}>
            <div className="card">
              <h3 style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.9rem", marginBottom: "12px" }}>
                <FileText size={16} style={{ color: "var(--primary)" }} /> Attached Documents ({uploadedDocuments.length})
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {uploadedDocuments.map((doc: any) => (
                  <div
                    key={doc.id || doc.filename}
                    onClick={() => setPreviewDoc(doc)}
                    style={{
                      display: "flex", alignItems: "center", gap: "10px",
                      padding: "10px 14px", background: "var(--bg-body)",
                      borderRadius: "var(--radius-md)", cursor: "pointer",
                      border: "1px solid var(--border-default)",
                      transition: "all 0.15s ease"
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--primary)"; (e.currentTarget as HTMLDivElement).style.background = "rgba(232,82,26,0.03)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-default)"; (e.currentTarget as HTMLDivElement).style.background = "var(--bg-body)"; }}
                  >
                    <FileText size={16} style={{ color: "var(--primary)", flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "0.88rem", fontWeight: 500 }}>{doc.filename}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
                        {doc.file_type || "Document"} • Uploaded {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : ""}
                      </div>
                    </div>
                    <Eye size={16} style={{ color: "var(--text-tertiary)" }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: "12px", marginTop: "24px", justifyContent: "flex-end" }}>
          {aud && <button className="btn btn-secondary" onClick={() => router.push(`/audit/${caseId}`)}>View Audit Report</button>}
          {app && <button className="btn btn-secondary" onClick={() => router.push(`/appeal`)}>View Appeal Risk</button>}
          <button className="btn btn-primary" onClick={() => router.push(`/workspace/${caseId}`)}>Open in Workspace</button>
        </div>
      </div>
    </div>
  );
}
