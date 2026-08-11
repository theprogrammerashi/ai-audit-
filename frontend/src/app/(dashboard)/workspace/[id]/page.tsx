"use client";

import { useState, useEffect, Fragment } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  LayoutDashboard, CheckCircle, XCircle, AlertTriangle,
  Shield, Clock, Bot, ArrowLeft, Send, Loader2, FileText, Check, AlertCircle, FileSearch, Edit3,
  Brain, Sparkles, ChevronRight, ChevronLeft, Activity, Stethoscope, ClipboardCheck, Info
} from "lucide-react";
import api from "@/lib/api";

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
    meaning: "Oxygen saturation (O2 Sat) is critically low (typically < 90% on room air), indicating poor blood oxygenation.",
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
    meaning: "An abnormally high white blood cell (WBC) count (> 12.0 or < 4.0), indicating a systemic response to infection or inflammation.",
    significance: "Supports the diagnosis of acute infectious processes (like pneumonia or cellulitis) requiring diagnostic cultures and IV antibiotic therapies."
  },
  persistent_hypotension: {
    title: "Risk Signal: Persistent Hypotension",
    meaning: "Low blood pressure (systolic < 90 mmHg) that does not respond to initial intravenous fluid boluses.",
    significance: "Indicates hypovolemic, cardiogenic, or septic shock. Requires ICU admission, continuous arterial line monitoring, and vasopressor infusions."
  },
  elevated_lactate: {
    title: "Risk Signal: Elevated Lactate",
    meaning: "Serum lactate level is elevated (>= 2.0 mmol/L), demonstrating cellular hypoperfusion and anaerobic metabolism.",
    significance: "Key sepsis indicator. Urgently mandates immediate fluid resuscitation, broad-spectrum IV antibiotics, and serial lactate clearance checks."
  },
  tachycardia: {
    title: "Risk Signal: Tachycardia",
    meaning: "Resting heart rate consistently above 100 beats per minute.",
    significance: "A hallmark of Systemic Inflammatory Response Syndrome (SIRS) in sepsis. Used as a core vital sign criterion to justify acute level of care."
  },
  tachypnea: {
    title: "Risk Signal: Tachypnea",
    meaning: "Rapid respiratory rate (often > 24 breaths per minute).",
    significance: "Another core SIRS criterion, suggesting metabolic compensation or acute respiratory compromise."
  },
  altered_mental_status: {
    title: "Risk Signal: Altered Mental Status",
    meaning: "Acute changes in consciousness, cognition, or arousal (e.g., confusion, lethargy, encephalopathy).",
    significance: "A critical indicator of end-organ dysfunction (brain) in severe sepsis, heavily supporting inpatient admission."
  },
  elevated_creatinine: {
    title: "Risk Signal: Elevated Creatinine",
    meaning: "A sudden rise in serum creatinine (> 1.5 mg/dL) indicating acute kidney injury (AKI).",
    significance: "Demonstrates acute organ dysfunction caused by hypoperfusion/shock. A major criterion for severe sepsis inpatient necessity."
  },
  fever: {
    title: "Risk Signal: Fever",
    meaning: "Elevated core body temperature (> 100.4°F or 38°C).",
    significance: "A primary indicator of active systemic infection and one of the four main SIRS criteria."
  },
  hypotension: {
    title: "Risk Signal: Hypotension",
    meaning: "Low blood pressure (systolic < 90 mmHg), indicating poor systemic perfusion.",
    significance: "A strong marker of clinical instability that can quickly progress to shock if unmanaged."
  },
  hypoxemia: {
    title: "Risk Signal: Hypoxemia",
    meaning: "Oxygen saturation (O2 Sat) is below normal (< 90%), indicating inadequate blood oxygenation.",
    significance: "Supports inpatient admission as the patient requires continuous pulse oximetry monitoring and supplemental oxygen therapy."
  },
  elevated_troponin: {
    title: "Risk Signal: Elevated Troponin",
    meaning: "Troponin levels are elevated (> 0.04 ng/mL), indicating myocardial injury or acute coronary syndrome.",
    significance: "A critical cardiac biomarker. Elevated troponin mandates urgent cardiac evaluation, serial monitoring, and typically justifies inpatient admission for acute coronary workup."
  },
  ventilator_dependent: {
    title: "Risk Signal: Ventilator Dependent",
    meaning: "The patient requires mechanical ventilation or intubation for respiratory support.",
    significance: "An absolute indicator of critical illness requiring ICU-level care. Fully justifies inpatient admission."
  }
};

const ABNORMAL_EXPLANATIONS: Record<string, { title: string; range: string; meaning: string; significance: string }> = {
  // Vitals
  temp: {
    title: "Abnormal Vital: Temperature (Fever)",
    range: "97.0°F - 100.4°F",
    meaning: "Elevated core body temperature (> 100.4°F or 38°C).",
    significance: "Indicates active systemic inflammatory response (SIRS) or infection."
  },
  bp: {
    title: "Abnormal Vital: Blood Pressure (Hypotension)",
    range: "90/60 - 120/80 mmHg",
    meaning: "Low blood pressure (systolic < 90 mmHg).",
    significance: "Indicates reduced tissue perfusion and potential hemodynamic instability or shock."
  },
  hr: {
    title: "Abnormal Vital: Heart Rate (Tachycardia)",
    range: "60 - 100 bpm",
    meaning: "Elevated heart rate (> 100 beats per minute).",
    significance: "Reflects physiological stress, compensatory mechanism for fever, hypovolemia, or hypoperfusion."
  },
  rr: {
    title: "Abnormal Vital: Respiratory Rate (Tachypnea)",
    range: "12 - 20 breaths/min",
    meaning: "Elevated respiratory rate (> 24 breaths per minute).",
    significance: "Indicates respiratory distress, hypoxemia, or metabolic acidosis compensation."
  },
  o2_sat: {
    title: "Abnormal Vital: Oxygen Saturation (Hypoxemia)",
    range: "95% - 100%",
    meaning: "Low arterial blood oxygen saturation (< 90%).",
    significance: "Reflects impaired gas exchange in lungs, requiring immediate oxygen supplementation."
  },
  
  // Labs
  wbc: {
    title: "Abnormal Lab: WBC (Leukocytosis)",
    range: "4.0 - 11.0 K/uL",
    meaning: "Elevated White Blood Cell count (> 12.0 K/uL).",
    significance: "Strong marker of active infection, systemic inflammation, or leukemoid reaction."
  },
  lactate: {
    title: "Abnormal Lab: Lactate (Hyperlactatemia)",
    range: "< 2.0 mmol/L",
    meaning: "Elevated blood lactate levels (>= 2.0 mmol/L).",
    significance: "Indicates anaerobic metabolism due to systemic hypoperfusion, tissue hypoxia, or sepsis."
  },
  creatinine: {
    title: "Abnormal Lab: Creatinine",
    range: "0.6 - 1.2 mg/dL",
    meaning: "Elevated serum creatinine level (> 1.5 mg/dL).",
    significance: "Indicates acute kidney injury (AKI) or renal dysfunction due to hypoperfusion or nephrotoxicity."
  },
  bnp: {
    title: "Abnormal Lab: BNP",
    range: "< 100 pg/mL",
    meaning: "Elevated Brain Natriuretic Peptide (> 500 pg/mL).",
    significance: "Indicates myocardial wall stretch, typical of acute decompensated heart failure."
  },
  troponin: {
    title: "Abnormal Lab: Troponin",
    range: "< 0.04 ng/mL",
    meaning: "Elevated troponin level (> 0.04 ng/mL).",
    significance: "Specific marker of myocardial injury, suggesting acute coronary syndrome or cardiac strain."
  },
  potassium: {
    title: "Abnormal Lab: Potassium (Hyperkalemia)",
    range: "3.5 - 5.0 mEq/L",
    meaning: "Elevated serum potassium level (> 5.5 mEq/L).",
    significance: "Can cause severe cardiac conduction abnormalities or arrhythmias."
  },
  ef: {
    title: "Abnormal Lab: Ejection Fraction (Reduced EF)",
    range: "55% - 70%",
    meaning: "Reduced left ventricular ejection fraction (< 40%).",
    significance: "Indicates systolic heart failure with high risk for clinical instability."
  }
};

export const formatRiskSignal = (s: string) => s.replace(/_/g, " ").replace(/\bbnp\b/ig, "BNP").replace(/\bef\b/ig, "EF");

export default function WorkspaceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params.id as string;
  
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>("NURSE");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [selectedRiskSignal, setSelectedRiskSignal] = useState<string | null>(null);
  const [abnormalExplanation, setAbnormalExplanation] = useState<any | null>(null);


  // New Rationale State
  const [rationale, setRationale] = useState("");
  const [showAnalysisPopup, setShowAnalysisPopup] = useState(false);
  const [activeRiskTab, setActiveRiskTab] = useState<"APPROVED" | "DENIED">("APPROVED");
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);

  useEffect(() => {
    const fetchCaseData = async () => {
      try {
        // Fetch user role first
        const meRes = await api.get("/auth/me");
        const role = meRes.data.role;
        setUserRole(role);

        // Admins and Executives should not see nurse workspace — redirect to audit
        if (role === "ADMIN" || role === "EXECUTIVE") {
          router.replace(`/audit/${caseId}`);
          return;
        }

        const res = await api.get(`/workspace/${caseId}`);
        setData(res.data);
        // Pre-fill rationale with AI deep analysis draft or copilot observation
        const deepDraft = res.data?.ai_deep_analysis?.rationale_draft;
        if (deepDraft) {
          setRationale(deepDraft);
        } else if (res.data?.ai_copilot_observation) {
          setRationale(`AI Draft Rationale: ${res.data.ai_copilot_observation}\n\nClinical Justification: `);
        }
      } catch (err) {
        console.error("Failed to fetch case data:", err);
        setError("Failed to load case data");
      } finally {
        setLoading(false);
      }
    };
    if (caseId) {
      fetchCaseData();
    }
  }, [caseId]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", flexDirection: "column", gap: "16px" }}>
        <Loader2 size={32} style={{ animation: "spin 1s linear infinite", color: "var(--primary)" }} />
        <p style={{ color: "var(--text-secondary)" }}>Loading clinical context...</p>
      </div>
    );
  }

  if (error || !data || !data.case) {
    return (
      <div style={{ padding: "32px", textAlign: "center" }}>
        <h2>{error || "Case Not Found"}</h2>
        <button className="btn btn-primary" style={{ marginTop: "16px" }} onClick={() => router.push("/workspace")}>
          <ArrowLeft size={16} /> Back to Queue
        </button>
      </div>
    );
  }

  let d = data.case.structured_case;
  if (typeof d === 'string') {
    try { d = JSON.parse(d); } catch { d = {}; }
  }
  d = d || {};
  
  // Ensure risk_signals is always an array
  if (d.risk_signals && typeof d.risk_signals === 'string') {
    try { d.risk_signals = JSON.parse(d.risk_signals); } catch { d.risk_signals = d.risk_signals.split(/[,\s]+/).filter(Boolean); }
  }
  if (!Array.isArray(d.risk_signals)) d.risk_signals = [];
  // Ensure timeline is always an array
  if (d.timeline && typeof d.timeline === 'string') {
    try { d.timeline = JSON.parse(d.timeline); } catch { d.timeline = []; }
  }
  if (!Array.isArray(d.timeline)) d.timeline = [];

  const c = data.case;
  const p = data.policy_match || { matched_criteria: [], unmet_criteria: [], applicable_policy: "Unknown", policy_name: "", overall_confidence: 0 };
  const allCriteria = [...(p.matched_criteria || []), ...(p.unmet_criteria || [])];
  const metCount = (p.matched_criteria || []).length;
  const unmetCount = (p.unmet_criteria || []).length;
  const totalCount = metCount + unmetCount;
  const deepAnalysis = data.ai_deep_analysis;

  // --- Calculate missing/undocumented vitals & labs (if genuine) ---
  const expectedVitals = {
    temp: "Temperature",
    bp: "Blood Pressure",
    hr: "Heart Rate",
    rr: "Respiratory Rate",
    o2_sat: "Oxygen Saturation"
  };
  const missingVitals: string[] = [];
  const vitalsObj = d.vitals || {};
  Object.entries(expectedVitals).forEach(([key, name]) => {
    if (vitalsObj[key] === undefined || vitalsObj[key] === null || vitalsObj[key] === "") {
      missingVitals.push(name);
    }
  });

  const missingLabs: string[] = [];
  const labsObj = d.labs || {};
  const policyCode = (p.applicable_policy || "").toUpperCase();
  
  if (policyCode.includes("SEPSIS")) {
    const sepsisLabs = { wbc: "WBC", lactate: "Lactate", creatinine: "Creatinine" };
    Object.entries(sepsisLabs).forEach(([key, name]) => {
      if (labsObj[key] === undefined || labsObj[key] === null || labsObj[key] === "") {
        missingLabs.push(name);
      }
    });
  } else if (policyCode.includes("CHF") || policyCode.includes("HEART")) {
    const chfLabs = { bnp: "BNP", troponin: "Troponin", creatinine: "Creatinine", potassium: "Potassium", ef: "Ejection Fraction (EF)" };
    Object.entries(chfLabs).forEach(([key, name]) => {
      if (labsObj[key] === undefined || labsObj[key] === null || labsObj[key] === "") {
        missingLabs.push(name);
      }
    });
  } else if (policyCode.includes("COPD")) {
    const copdLabs = { wbc: "WBC", pco2: "pCO2" };
    Object.entries(copdLabs).forEach(([key, name]) => {
      if (labsObj[key] === undefined || labsObj[key] === null || labsObj[key] === "") {
        missingLabs.push(name);
      }
    });
  }

  const handleSubmitDecision = async (decision: string) => {
    if (!rationale || rationale.length < 20) {
      alert("Please provide a detailed rationale (at least 20 characters) before submitting.");
      return;
    }
    setIsSubmitting(true);
    
    try {
      await api.post(`/workspace/${caseId}/decision`, {
        decision: decision,
        rationale: rationale,
        policy_cited: p.applicable_policy,
        criteria_acknowledged: allCriteria.map((c: any) => c.section)
      });
      setSubmitted(true);
      setTimeout(() => router.push("/workspace"), 2000);
    } catch (err) {
      console.error("Failed to submit decision:", err);
      alert("Failed to submit decision");
      setIsSubmitting(false);
    }
  };



  if (submitted) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "16px" }}>
        <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "var(--success-light)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CheckCircle size={32} style={{ color: "var(--success)" }} />
        </div>
        <h2>Decision Submitted</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
          Case has been processed. AI audit pipeline is now scoring your decision...
        </p>
      </div>
    );
  }
  
  const urgency = c.primary_diagnosis_code?.startsWith("A41") || c.primary_diagnosis_display?.includes("Sepsis") ? "URGENT" : 
                  c.primary_diagnosis_code?.startsWith("I50") || c.primary_diagnosis_display?.includes("Heart Failure") ? "HIGH" : "STANDARD";

  // Determine policy recommendation label — only APPROVE or DENY
  const rawRec = deepAnalysis?.recommendation || p.recommendation || "";
  const policyRecommendation = 
    rawRec === "APPROVE" || rawRec === "SUPPORTED" || rawRec === "INPATIENT_ADMISSION_SUPPORTED" || metCount >= totalCount * 0.7
      ? "APPROVE" 
      : "DENY";
  const recColor = policyRecommendation === "APPROVE" ? "var(--success)" : "var(--danger)";
  const recBg = policyRecommendation === "APPROVE" ? "rgba(22,163,74,0.08)" : "rgba(239,68,68,0.08)";

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "12px 24px", borderBottom: "1px solid var(--border-default)", background: "var(--bg-surface)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button onClick={() => router.push("/workspace")} className="btn btn-secondary" style={{ padding: "6px 10px" }}>
            <ArrowLeft size={16} />
          </button>
          <LayoutDashboard size={22} style={{ color: "var(--primary)" }} />
          <div>
            <div style={{ fontWeight: 600, display: "flex", gap: "8px", alignItems: "center" }}>
              {c.case_number}
              {urgency !== "STANDARD" && (
                <span className={`badge ${urgency === "URGENT" ? "badge-danger" : "badge-warning"}`} style={{ fontSize: "0.7rem", display: "flex", alignItems: "center", gap: "4px" }}>
                  <AlertTriangle size={10} /> {urgency} PRIORITY
                </span>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--text-tertiary)", fontSize: "0.8rem" }}>
          <Clock size={14} /> Submitted: {new Date(c.submitted_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
        </div>
      </div>

      {/* 2-Panel Layout */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", background: "var(--bg-body)", position: "relative" }}>
        
        {/* LEFT PANEL: Demographics / Auth */}
        <div style={{ 
          width: isLeftPanelOpen ? "300px" : "0px",
          borderRight: isLeftPanelOpen ? "1px solid var(--border-default)" : "none", 
          overflowY: "auto", overflowX: "hidden", 
          background: "var(--bg-surface)",
          transition: "width 0.3s ease",
          flexShrink: 0,
          position: "relative"
        }}>
          <div style={{ padding: "20px", width: "300px" }}>
            <h4 style={{ marginBottom: "16px", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)" }}>Demographics</h4>
            {[["Patient Name", c.patient_name], ["Date of Birth", c.patient_dob], ["Age", `${c.patient_age} yrs`], ["MRN", c.patient_mrn]].map(([label, val]) => (
              <div key={label} style={{ marginBottom: "12px" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "2px" }}>{label}</div>
                <div style={{ fontSize: "0.9rem", fontWeight: 500, color: "var(--text-primary)" }}>{val || "N/A"}</div>
              </div>
            ))}

            <div style={{ borderTop: "1px solid var(--border-default)", margin: "20px 0" }} />

            <h4 style={{ marginBottom: "16px", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)" }}>Diagnosis & Service</h4>
            <div style={{ marginBottom: "12px" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "2px" }}>Primary Diagnosis</div>
              <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-primary)" }}>{c.primary_diagnosis_display}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "2px" }}>ICD-10: {c.primary_diagnosis_code}</div>
            </div>
            <div style={{ marginBottom: "12px" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "2px" }}>Requested Service</div>
              <div style={{ fontSize: "0.9rem", fontWeight: 500, color: "var(--text-primary)" }}>{c.procedure_code ? `Procedure: ${c.procedure_code}` : "Inpatient Admission"}</div>
            </div>

            <div style={{ borderTop: "1px solid var(--border-default)", margin: "20px 0" }} />

            <h4 style={{ marginBottom: "16px", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)" }}>Auth History</h4>
            <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", padding: "12px", background: "rgba(15,14,12,0.03)", borderRadius: "8px" }}>
              <p style={{ marginBottom: "8px" }}><strong>04/12/2025:</strong> Inpatient Stay (APPROVED)</p>
              <p><strong>01/05/2025:</strong> Outpatient MRI (DENIED)</p>
            </div>
          </div>
        </div>

        {/* Toggle Button */}
        <button
          onClick={() => setIsLeftPanelOpen(!isLeftPanelOpen)}
          style={{
            position: "absolute",
            left: isLeftPanelOpen ? "288px" : "0px",
            top: "20px",
            zIndex: 10,
            background: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            borderLeft: isLeftPanelOpen ? "none" : "1px solid var(--border-default)",
            borderRadius: "0 6px 6px 0",
            width: "24px",
            height: "48px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "left 0.3s ease",
            boxShadow: "3px 0 8px rgba(0,0,0,0.05)",
            color: "var(--text-tertiary)",
            padding: 0
          }}
          title={isLeftPanelOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          {isLeftPanelOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>

        {/* CENTER WORKSPACE: Cards */}
        <div style={{ overflowY: "auto", padding: "32px", display: "flex", flexDirection: "column", gap: "24px", maxWidth: "900px", margin: "0 auto", width: "100%", height: "100%", flex: 1 }}>
          
          {/* ═══ Card 1: Clinical Summary (Enhanced) ═══ */}
          <div className="card" style={{ padding: "0", overflow: "hidden" }}>
            {/* Header */}
            <div style={{ 
              padding: "16px 20px", 
              borderBottom: "1px solid var(--border-default)",
              background: "linear-gradient(135deg, rgba(139,92,246,0.06) 0%, rgba(139,92,246,0.02) 100%)",
              display: "flex", alignItems: "center", gap: "10px"
            }}>
              <div style={{
                width: "32px", height: "32px", borderRadius: "var(--radius-md)",
                background: "linear-gradient(135deg, rgba(139,92,246,0.15), rgba(139,92,246,0.08))",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                <Brain size={17} style={{ color: "#8B5CF6" }} />
              </div>
              <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Clinical Summary</h3>
            </div>

            <div style={{ padding: "20px" }}>
              {/* Summary text */}
              <div style={{ 
                fontSize: "0.92rem", lineHeight: 1.7, color: "var(--text-secondary)", margin: 0,
                padding: "14px 16px", background: "rgba(15,14,12,0.02)", borderRadius: "var(--radius-md)",
                borderLeft: "3px solid rgba(139,92,246,0.4)"
              }}>
                {d.clinical_summary ? (
                  d.clinical_summary.split(/\r?\n|\\n/g).map((line: string, i: number) => (
                    <Fragment key={i}>
                      {line.split(/(\*\*.*?\*\*)/g).map((part, j) => 
                        part.startsWith('**') && part.endsWith('**') 
                          ? <strong key={j} style={{ color: "var(--text-primary)" }}>{part.slice(2, -2)}</strong> 
                          : part
                      )}
                      {i < d.clinical_summary.split(/\r?\n|\\n/g).length - 1 && <br />}
                    </Fragment>
                  ))
                ) : (
                  "No clinical summary available for this case."
                )}
              </div>

              {/* Documentation Gap warning if vitals or labs are missing */}
              {(missingVitals.length > 0 || missingLabs.length > 0) && (
                <div style={{ 
                  marginTop: "16px", 
                  padding: "12px 16px", 
                  background: "rgba(245,158,11,0.06)", 
                  border: "1px solid rgba(245,158,11,0.25)", 
                  borderRadius: "var(--radius-md)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--warning)", fontWeight: 600, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    <AlertTriangle size={14} style={{ color: "var(--warning)" }} />
                    Incomplete Documentation Detected
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    {missingVitals.length > 0 && (
                      <div>
                        <strong>Missing Vitals:</strong> {missingVitals.join(", ")}
                      </div>
                    )}
                    {missingLabs.length > 0 && (
                      <div style={{ marginTop: missingVitals.length > 0 ? "4px" : "0" }}>
                        <strong>Missing Labs:</strong> {missingLabs.join(", ")}
                      </div>
                    )}
                  </div>
                </div>
              )}



              {/* Timeline */}
              {d.timeline && d.timeline.length > 0 && (
                <div style={{ marginTop: "20px" }}>
                  <div style={{ 
                    fontSize: "0.78rem", fontWeight: 600, textTransform: "uppercase", 
                    letterSpacing: "0.06em", color: "var(--text-secondary)", marginBottom: "12px",
                    display: "flex", alignItems: "center", gap: "6px"
                  }}>
                    <Activity size={13} />
                    Clinical Timeline
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
                    {d.timeline.map((event: any, idx: number) => {
                      const eventName = typeof event === "string" ? event : (event.event || event.name || event.title || "");
                      const eventDetails = typeof event === "string" ? "" : (event.details || event.description || event.note || "");
                      return (
                        <div key={idx} style={{ 
                          display: "flex", gap: "12px", padding: "8px 0",
                          borderBottom: idx < d.timeline.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none"
                        }}>
                          <div style={{ 
                            width: "6px", height: "6px", borderRadius: "50%", 
                            background: "var(--primary)", flexShrink: 0, marginTop: "7px"
                          }} />
                          <div>
                            <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)" }}>{eventName}</div>
                            {eventDetails && (
                              <div style={{ fontSize: "0.8rem", color: "var(--text-tertiary)", marginTop: "2px" }}>{eventDetails}</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ═══ Card 1.5: Vitals & Labs ═══ */}
          <div className="card" style={{ padding: "0", overflow: "hidden" }}>
            <div style={{ 
              padding: "16px 20px", 
              borderBottom: "1px solid var(--border-default)",
              background: "linear-gradient(135deg, rgba(239,68,68,0.06) 0%, rgba(239,68,68,0.02) 100%)",
              display: "flex", alignItems: "center", gap: "10px"
            }}>
              <div style={{
                width: "32px", height: "32px", borderRadius: "var(--radius-md)",
                background: "linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.08))",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                <Activity size={17} style={{ color: "#EF4444" }} />
              </div>
              <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Vitals & Labs</h3>
            </div>

            <div style={{ padding: "20px" }}>
              <div className="label" style={{ marginBottom: "12px", fontSize: "0.78rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)" }}>Vital Signs</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "24px" }}>
                 {d.vitals && Object.keys(d.vitals).length > 0 ? Object.entries(d.vitals).map(([key, val]) => {
                  if (val === null) return null;
                  const isAbnormal = (key === "o2_sat" && Number(val) < 90) || (key === "hr" && Number(val) > 100) || (key === "rr" && Number(val) > 24) || (key === "temp" && Number(val) > 100.4) || (key === "bp" && typeof val === "string" && Number(val.split('/')[0]) < 90);
                  
                  const handleBoxClick = () => {
                    if (!isAbnormal) return;
                    const info = ABNORMAL_EXPLANATIONS[key] || {
                      title: `Abnormal Vital: ${key.replace("_", " ").toUpperCase()}`,
                      range: "Standard reference range",
                      meaning: "This value is flagged as abnormal.",
                      significance: "Clinical review is required to evaluate this vital sign."
                    };
                    setAbnormalExplanation({
                      ...info,
                      key,
                      val: `${String(val)}${key === "temp" ? "°F" : key === "o2_sat" ? "%" : ""}`
                    });
                  };

                  return (
                    <div 
                      key={key} 
                      onClick={handleBoxClick}
                      onMouseEnter={(e) => {
                        if (!isAbnormal) return;
                        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px) scale(1.03)";
                        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 6px 16px rgba(239,68,68,0.15)";
                        (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(239,68,68,0.45)";
                      }}
                      onMouseLeave={(e) => {
                        if (!isAbnormal) return;
                        (e.currentTarget as HTMLDivElement).style.transform = "none";
                        (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                        (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(239,68,68,0.25)";
                      }}
                      style={{ 
                        textAlign: "center", 
                        padding: "12px 8px", 
                        background: isAbnormal ? "rgba(239,68,68,0.06)" : "rgba(15,14,12,0.02)", 
                        borderRadius: "var(--radius-md)", 
                        border: isAbnormal ? "1px solid rgba(239,68,68,0.25)" : "1px solid var(--border-default)",
                        cursor: isAbnormal ? "pointer" : "default",
                        transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)"
                      }}
                    >
                      <div className="label" style={{ marginBottom: "6px" }}>{key.replace("_", " ").toUpperCase()}</div>
                      <div style={{ fontWeight: 600, fontSize: "1.05rem", color: isAbnormal ? "var(--danger)" : "var(--text-primary)", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                        {isAbnormal && <AlertTriangle size={14} style={{ color: "var(--danger)", flexShrink: 0 }} />}
                        {String(val)}{key === "temp" ? "°F" : key === "o2_sat" ? "%" : ""}
                      </div>
                    </div>
                  );
                }) : <div style={{ color: "var(--text-tertiary)", fontSize: "0.85rem", fontStyle: "italic" }}>No vitals recorded.</div>}
              </div>
              
              <div className="label" style={{ marginBottom: "12px", fontSize: "0.78rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)" }}>Lab Results</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                {d.labs && Object.keys(d.labs).length > 0 ? Object.entries(d.labs).map(([key, val]) => {
                  if (val === null) return null;
                  const lowerKey = key.toLowerCase();
                  const labName = (lowerKey === "bnp" || lowerKey === "ef" || lowerKey === "wbc") 
                    ? lowerKey.toUpperCase() 
                    : key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
                  const isLabAbnormal = (lowerKey === "bnp" && Number(val) > 500) || (lowerKey === "wbc" && (Number(val) > 12 || Number(val) < 4)) || (lowerKey === "lactate" && Number(val) >= 2.0) || (lowerKey === "creatinine" && Number(val) > 1.5) || (lowerKey === "troponin" && Number(val) > 0.04) || (lowerKey === "potassium" && Number(val) > 5.5) || (lowerKey === "ef" && Number(val) < 40);
                  
                  const handleLabClick = () => {
                    if (!isLabAbnormal) return;
                    const info = ABNORMAL_EXPLANATIONS[lowerKey] || {
                      title: `Abnormal Lab: ${labName}`,
                      range: "Standard reference range",
                      meaning: "This value is flagged as abnormal.",
                      significance: "Clinical review is required to evaluate this lab value."
                    };
                    setAbnormalExplanation({
                      ...info,
                      key: lowerKey,
                      val: String(val)
                    });
                  };

                  return (
                    <div 
                      key={key} 
                      onClick={handleLabClick}
                      onMouseEnter={(e) => {
                        if (!isLabAbnormal) return;
                        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px) scale(1.02)";
                        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 12px rgba(239,68,68,0.12)";
                        (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(239,68,68,0.38)";
                      }}
                      onMouseLeave={(e) => {
                        if (!isLabAbnormal) return;
                        (e.currentTarget as HTMLDivElement).style.transform = "none";
                        (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                        (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(239,68,68,0.18)";
                      }}
                      style={{ 
                        display: "flex", 
                        justifyContent: "space-between", 
                        padding: "10px 14px", 
                        borderBottom: "1px solid var(--border-default)", 
                        background: isLabAbnormal ? "rgba(239,68,68,0.04)" : "rgba(15,14,12,0.01)", 
                        borderRadius: "var(--radius-sm)", 
                        border: isLabAbnormal ? "1px solid rgba(239,68,68,0.18)" : "none", 
                        alignItems: "center",
                        cursor: isLabAbnormal ? "pointer" : "default",
                        transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)"
                      }}
                    >
                      <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{labName}</span>
                      <span style={{ fontWeight: 600, fontSize: "0.9rem", color: isLabAbnormal ? "var(--danger)" : "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
                        {isLabAbnormal && <AlertTriangle size={13} style={{ color: "var(--danger)", flexShrink: 0 }} />}
                        {String(val)}
                      </span>
                    </div>
                  );
                }) : <div style={{ color: "var(--text-tertiary)", fontSize: "0.85rem", fontStyle: "italic", gridColumn: "span 2" }}>No lab results recorded.</div>}
              </div>
            </div>
          </div>

          {/* ═══ Card 2: Policy Match (Rewritten) ═══ */}
          <div className="card" style={{ padding: "0", overflow: "hidden" }}>
            {/* Header */}
            <div style={{ 
              padding: "16px 20px", 
              borderBottom: "1px solid var(--border-default)",
              background: "linear-gradient(135deg, rgba(59,130,246,0.06) 0%, rgba(59,130,246,0.02) 100%)",
              display: "flex", justifyContent: "space-between", alignItems: "center"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{
                  width: "32px", height: "32px", borderRadius: "var(--radius-md)",
                  background: "linear-gradient(135deg, rgba(59,130,246,0.15), rgba(59,130,246,0.08))",
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  <Shield size={17} style={{ color: "#3B82F6" }} />
                </div>
                <div>
                  <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Policy Match</h3>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginTop: "2px" }}>{p.policy_name}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ 
                  padding: "4px 10px", borderRadius: "var(--radius-full)",
                  background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)",
                  color: "#3B82F6", fontSize: "0.75rem", fontWeight: 600
                }}>
                  {p.applicable_policy}
                </span>
                <span style={{ 
                  fontSize: "0.82rem", fontWeight: 700, color: "var(--primary)"
                }}>
                  {Math.round((p.overall_confidence || 0) * 100)}%
                </span>
              </div>
            </div>

            <div style={{ padding: "20px" }}>
              {/* Recommendation Banner */}
              <div style={{ 
                padding: "14px 18px", borderRadius: "var(--radius-md)", marginBottom: "20px",
                background: recBg, border: `1px solid ${recColor}22`,
                display: "flex", alignItems: "center", gap: "10px"
              }}>
                <div style={{ 
                  width: "28px", height: "28px", borderRadius: "50%",
                  background: `${recColor}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
                }}>
                  {policyRecommendation === "APPROVE" ? (
                    <CheckCircle size={15} style={{ color: recColor }} />
                  ) : (
                    <XCircle size={15} style={{ color: recColor }} />
                  )}
                </div>
                <div>
                  <div style={{ fontSize: "0.78rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: recColor, marginBottom: "2px" }}>
                    AI Recommends: {policyRecommendation === "APPROVE" ? "Approve This Case" : "Deny This Case"}
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    {deepAnalysis?.policy_explanation || 
                      (policyRecommendation === "APPROVE" 
                        ? `Based on ${metCount} of ${totalCount} criteria met, this case meets the threshold for medical necessity under ${p.applicable_policy}.`
                        : `Based on ${metCount} of ${totalCount} criteria met, this case does not meet the required criteria for admission under ${p.applicable_policy}.`)}
                  </div>
                </div>
              </div>

              {/* ✅ Criteria Met */}
              {(p.matched_criteria || []).length > 0 && (
                <div style={{ marginBottom: "20px" }}>
                  <div style={{ 
                    fontSize: "0.8rem", fontWeight: 600, color: "var(--success)", marginBottom: "10px",
                    display: "flex", alignItems: "center", gap: "6px"
                  }}>
                    ✅ Criteria Met ({(p.matched_criteria || []).length})
                    <div 
                      onClick={() => setShowAnalysisPopup(true)}
                      style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", position: "relative" }}
                    >
                      <Info size={15} style={{ color: "var(--primary)" }} />
                    </div>
                  </div>
                  <div style={{ 
                    display: "flex", flexDirection: "column", gap: "8px",
                    borderLeft: "3px solid var(--success)", paddingLeft: "16px"
                  }}>
                    {(p.matched_criteria || []).map((cr: any) => (
                      <div key={cr.section} style={{ 
                        padding: "12px 14px", borderRadius: "var(--radius-md)",
                        background: "rgba(22,163,74,0.04)", border: "1px solid rgba(22,163,74,0.12)"
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <Check size={14} style={{ color: "var(--success)", flexShrink: 0 }} />
                            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)" }}>{cr.criterion}</span>
                          </div>
                          <span style={{ fontSize: "0.72rem", color: "var(--text-tertiary)", fontWeight: 500, whiteSpace: "nowrap" }}>Sec. {cr.section}</span>
                        </div>
                        <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: "6px", paddingLeft: "22px" }}>
                          {cr.explanation || `This criterion is satisfied — ${cr.evidence || "clinical evidence supports this finding."}`}
                        </div>
                        {cr.evidence && (
                          <div style={{ fontSize: "0.78rem", color: "var(--text-tertiary)", fontStyle: "italic", paddingLeft: "22px" }}>
                            Evidence: {cr.evidence}
                          </div>
                        )}
                        {cr.confidence !== undefined && (
                          <div style={{ paddingLeft: "22px", marginTop: "8px" }}>
                            <div style={{ 
                              width: "100%", maxWidth: "160px", height: "4px", borderRadius: "2px",
                              background: "rgba(22,163,74,0.12)"
                            }}>
                              <div style={{ 
                                width: `${Math.round((cr.confidence || 0) * 100)}%`, height: "100%",
                                borderRadius: "2px", background: "var(--success)",
                                transition: "width 0.5s ease"
                              }} />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ❌ Criteria Not Met */}
              {(p.unmet_criteria || []).length > 0 && (
                <div style={{ marginBottom: "20px" }}>
                  <div style={{ 
                    fontSize: "0.8rem", fontWeight: 600, color: "var(--danger)", marginBottom: "10px",
                    display: "flex", alignItems: "center", gap: "6px"
                  }}>
                    ❌ Criteria Not Met ({(p.unmet_criteria || []).length})
                  </div>
                  <div style={{ 
                    display: "flex", flexDirection: "column", gap: "8px",
                    borderLeft: "3px solid var(--danger)", paddingLeft: "16px"
                  }}>
                    {(p.unmet_criteria || []).map((cr: any) => (
                      <div key={cr.section} style={{ 
                        padding: "12px 14px", borderRadius: "var(--radius-md)",
                        background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.12)"
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <AlertCircle size={14} style={{ color: "var(--danger)", flexShrink: 0 }} />
                            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)" }}>{cr.criterion}</span>
                          </div>
                          <span style={{ fontSize: "0.72rem", color: "var(--text-tertiary)", fontWeight: 500, whiteSpace: "nowrap" }}>Sec. {cr.section}</span>
                        </div>
                        <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: "6px", paddingLeft: "22px" }}>
                          {cr.explanation || `This criterion is not met — ${cr.evidence || "insufficient evidence or documentation missing."}`}
                        </div>
                        {cr.evidence && (
                          <div style={{ fontSize: "0.78rem", color: "var(--text-tertiary)", fontStyle: "italic", paddingLeft: "22px" }}>
                            Evidence: {cr.evidence}
                          </div>
                        )}
                        {cr.confidence !== undefined && (
                          <div style={{ paddingLeft: "22px", marginTop: "8px" }}>
                            <div style={{ 
                              width: "100%", maxWidth: "160px", height: "4px", borderRadius: "2px",
                              background: "rgba(239,68,68,0.12)"
                            }}>
                              <div style={{ 
                                width: `${Math.round((cr.confidence || 0) * 100)}%`, height: "100%",
                                borderRadius: "2px", background: "var(--danger)",
                                transition: "width 0.5s ease"
                              }} />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Summary Line */}
              <div style={{ 
                padding: "12px 16px", borderRadius: "var(--radius-md)",
                background: "rgba(15,14,12,0.03)", border: "1px solid var(--border-default)",
                display: "flex", justifyContent: "space-between", alignItems: "center"
              }}>
                <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                  <strong style={{ color: "var(--text-primary)" }}>{metCount} of {totalCount}</strong> criteria met
                </span>
                <span style={{ 
                  fontSize: "0.8rem", fontWeight: 600, color: recColor,
                  display: "flex", alignItems: "center", gap: "4px"
                }}>
                  <ChevronRight size={14} />
                  AI Recommends: {policyRecommendation === "APPROVE" ? "Approve" : "Deny"}
                </span>
              </div>
            </div>
          </div>

          {/* ═══ Card 3: Rationale Builder (Nurse only) ═══ */}
          {userRole === "NURSE" && c.status !== "DECIDED" && c.status !== "AUDITED" && (
          <div className="card" style={{ padding: "0", overflow: "hidden" }}>
            {/* Header */}
            <div style={{ 
              padding: "16px 20px", 
              borderBottom: "1px solid var(--border-default)",
              background: "linear-gradient(135deg, rgba(245,158,11,0.06) 0%, rgba(245,158,11,0.02) 100%)",
              display: "flex", justifyContent: "space-between", alignItems: "center"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{
                  width: "32px", height: "32px", borderRadius: "var(--radius-md)",
                  background: "linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.08))",
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  <Edit3 size={17} style={{ color: "#F59E0B" }} />
                </div>
                <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Rationale Builder</h3>
              </div>
              <span style={{ 
                display: "inline-flex", alignItems: "center", gap: "5px",
                padding: "4px 12px", borderRadius: "var(--radius-full)",
                background: "linear-gradient(135deg, rgba(139,92,246,0.12), rgba(139,92,246,0.06))",
                border: "1px solid rgba(139,92,246,0.2)",
                color: "#8B5CF6", fontSize: "0.72rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em"
              }}>
                <Sparkles size={11} /> AI Draft
              </span>
            </div>

            <div style={{ padding: "20px" }}>
              <textarea
                style={{ 
                  width: "100%", minHeight: "170px", fontSize: "0.9rem", lineHeight: 1.7, resize: "vertical",
                  padding: "16px 18px", borderRadius: "var(--radius-md)",
                  border: "1.5px solid var(--border-default)", background: "var(--bg-body)",
                  color: "var(--text-primary)", fontFamily: "inherit", outline: "none",
                  transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                  boxSizing: "border-box"
                }}
                onFocus={(e) => { 
                  e.target.style.borderColor = "var(--primary)";
                  e.target.style.boxShadow = "0 0 0 3px rgba(232,82,26,0.08)";
                }}
                onBlur={(e) => { 
                  e.target.style.borderColor = "var(--border-default)";
                  e.target.style.boxShadow = "none";
                }}
                placeholder="Enter your clinical rationale here..."
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
              />
              <div style={{ 
                display: "flex", alignItems: "center", gap: "6px",
                marginTop: "10px", fontSize: "0.78rem", color: "var(--text-tertiary)"
              }}>
                <Bot size={13} />
                Edit the AI-generated rationale above before submitting your decision
              </div>
            </div>
          </div>
          )}

          {/* Already decided banner for nurses viewing a completed case */}
          {userRole === "NURSE" && (c.status === "DECIDED" || c.status === "AUDITED") && (
            <div className="card" style={{ padding: "20px", border: "2px solid var(--success)", background: "rgba(22,163,74,0.04)", textAlign: "center" }}>
              <CheckCircle size={32} style={{ color: "var(--success)", margin: "0 auto 12px" }} />
              <h3 style={{ fontSize: "1.05rem", marginBottom: "8px" }}>Decision Already Submitted</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem" }}>This case has been decided and is now in the QA audit pipeline.</p>
            </div>
          )}



          {/* ═══ Card 4: Risk Assessment ═══ */}
          {userRole === "NURSE" && c.status !== "DECIDED" && c.status !== "AUDITED" && deepAnalysis && (deepAnalysis.risk_if_approved || deepAnalysis.risk_if_denied) && (
            <div className="card" style={{ padding: "0", overflow: "hidden", marginBottom: "24px" }}>
              <div style={{ padding: "20px" }}>
                <div style={{ 
                  fontSize: "0.78rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em",
                  color: "var(--text-secondary)", marginBottom: "12px",
                  display: "flex", justifyContent: "space-between", alignItems: "center"
                }}>
                  Risk Assessment
                  
                  {/* Tabs */}
                  <div style={{ display: "flex", gap: "8px" }}>
                    {deepAnalysis.risk_if_approved && (
                      <button 
                        onClick={() => setActiveRiskTab("APPROVED")}
                        style={{ 
                          padding: "4px 10px", borderRadius: "var(--radius-sm)", border: "none",
                          background: activeRiskTab === "APPROVED" ? "rgba(22,163,74,0.15)" : "rgba(15,14,12,0.05)", 
                          color: activeRiskTab === "APPROVED" ? "var(--success)" : "var(--text-tertiary)",
                          fontSize: "0.72rem", fontWeight: 600, cursor: "pointer",
                          transition: "all 0.2s ease"
                        }}
                      >
                        IF APPROVED
                      </button>
                    )}
                    {deepAnalysis.risk_if_denied && (
                      <button 
                        onClick={() => setActiveRiskTab("DENIED")}
                        style={{ 
                          padding: "4px 10px", borderRadius: "var(--radius-sm)", border: "none",
                          background: activeRiskTab === "DENIED" ? "rgba(239,68,68,0.15)" : "rgba(15,14,12,0.05)", 
                          color: activeRiskTab === "DENIED" ? "var(--danger)" : "var(--text-tertiary)",
                          fontSize: "0.72rem", fontWeight: 600, cursor: "pointer",
                          transition: "all 0.2s ease"
                        }}
                      >
                        IF DENIED
                      </button>
                    )}
                  </div>
                </div>

                {/* Tab Content */}
                <div style={{
                  padding: "16px",
                  background: "var(--bg-body)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-default)",
                  marginTop: "8px"
                }}>
                  {activeRiskTab === "APPROVED" && deepAnalysis.risk_if_approved && (
                    <div style={{ fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                      {deepAnalysis.risk_if_approved}
                    </div>
                  )}
                  {activeRiskTab === "DENIED" && deepAnalysis.risk_if_denied && (
                    <div style={{ fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                      {deepAnalysis.risk_if_denied}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ═══ Card 5: AI Recommendation & Decision (Nurse only, undecided cases) ═══ */}
          {userRole === "NURSE" && c.status !== "DECIDED" && c.status !== "AUDITED" && (
          <div className="card" style={{ padding: "20px", border: "2px solid var(--border-default)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "1rem" }}>Decision</h3>
            </div>

            {/* AI Recommendation Banner */}
            {deepAnalysis && (
              <div style={{
                padding: "16px 20px", borderRadius: "var(--radius-md)", marginBottom: "20px",
                background: deepAnalysis.recommendation === "APPROVE" ? "rgba(22,163,74,0.08)" : "rgba(239,68,68,0.08)",
                border: `1px solid ${deepAnalysis.recommendation === "APPROVE" ? "rgba(22,163,74,0.2)" : "rgba(239,68,68,0.2)"}`,
                display: "flex", flexDirection: "column", gap: "8px"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  {deepAnalysis.recommendation === "APPROVE" ? (
                    <CheckCircle size={22} style={{ color: "var(--success)" }} />
                  ) : (
                    <XCircle size={22} style={{ color: "var(--danger)" }} />
                  )}
                  <span style={{ fontSize: "1.05rem", fontWeight: 700, color: deepAnalysis.recommendation === "APPROVE" ? "var(--success)" : "var(--danger)" }}>
                    AI Recommends: {deepAnalysis.recommendation === "APPROVE" ? "Approve This Case" : "Deny This Case"}
                  </span>
                </div>
                <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", margin: 0, lineHeight: 1.6 }}>
                  {deepAnalysis.recommendation === "APPROVE"
                    ? `The patient meets ${metCount} of ${totalCount} required criteria under policy ${p.applicable_policy}. Clinical evidence supports the requested level of care. Recommend approval.`
                    : `The patient meets only ${metCount} of ${totalCount} required criteria under policy ${p.applicable_policy}. Insufficient clinical evidence to support the requested level of care. Recommend denial with appropriate member notification.`
                  }
                </p>
              </div>
            )}
            
            <div style={{ display: "flex", gap: "16px" }}>
              <button
                className="btn btn-success"
                style={{ flex: 1, padding: "16px", fontSize: "1rem", gap: "8px" }}
                onClick={() => handleSubmitDecision("APPROVED")}
                disabled={isSubmitting}
              >
                <CheckCircle size={20} /> Approve Case
              </button>
              <button
                className="btn btn-danger"
                style={{ flex: 1, padding: "16px", fontSize: "1rem", gap: "8px" }}
                onClick={() => handleSubmitDecision("DENIED")}
                disabled={isSubmitting}
              >
                <XCircle size={20} /> Deny Case
              </button>
            </div>
          </div>
          )}

        </div>
      </div>

      {/* Full Screen Modal Popup for Clinical Analysis */}
      {showAnalysisPopup && (
        <div style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 9999
        }} onClick={() => setShowAnalysisPopup(false)}>
          <div 
            style={{
              background: "var(--bg-body)",
              padding: "24px",
              borderRadius: "var(--radius-lg)",
              maxWidth: "600px",
              width: "90%",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
              maxHeight: "80vh",
              overflowY: "auto"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 style={{ margin: 0, fontSize: "1.25rem", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
                <Sparkles size={18} style={{ color: "var(--primary)" }} />
                AI Clinical Analysis
              </h2>
              <button 
                onClick={() => setShowAnalysisPopup(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)" }}
              >
                <XCircle size={24} />
              </button>
            </div>
            
            <div style={{ fontSize: "0.95rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
              {(deepAnalysis?.clinical_analysis || data.ai_copilot_observation || "No AI Analysis available").split('\n').map((para: string, i: number) => (
                para.trim() ? <p key={i} style={{ margin: i > 0 ? "12px 0 0" : "0" }}>{para}</p> : null
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Risk Signal Explanation Modal */}
      {selectedRiskSignal && (() => {
        const key = selectedRiskSignal.toLowerCase().replace(/ /g, "_");
        const explanation = RISK_SIGNAL_EXPLANATIONS[key] || {
          title: `Risk Signal: ${formatRiskSignal(selectedRiskSignal)}`,
          meaning: `This case was flagged with the clinical risk signal: "${formatRiskSignal(selectedRiskSignal)}".`,
          significance: "This signal highlights clinical severity, prompting utilization review to evaluate inpatient admission necessity under standard guidelines."
        };
        const getPatientValue = (k: string) => {
          if (!d) return null;
          if (k === "hypotension" || k === "persistent_hypotension") return d.vitals?.bp;
          if (k === "tachycardia") return d.vitals?.hr;
          if (k === "tachypnea") return d.vitals?.rr;
          if (k === "fever") return d.vitals?.temp;
          if (k === "severe_hypoxemia") return d.vitals?.o2_sat;
          if (k === "elevated_creatinine") return d.labs?.creatinine;
          if (k === "elevated_lactate") return d.labs?.lactate;
          if (k === "leukocytosis") return d.labs?.wbc;
          if (k === "elevated_bnp") return d.labs?.bnp;
          if (k === "reduced_ef" || k === "mildly_reduced_ef") return d.labs?.ef;
          if (k === "hyperkalemia") return d.labs?.potassium;
          return null;
        };
        const patientValue = getPatientValue(key);

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
                  <XCircle size={20} />
                </button>
              </div>
              <div style={{ padding: "24px", fontSize: "0.9rem", lineHeight: 1.6, color: "var(--text-secondary)" }}>
                {patientValue !== undefined && patientValue !== null && (
                  <div style={{ 
                    marginBottom: "16px", padding: "12px", background: "rgba(239,68,68,0.06)", 
                    borderRadius: "var(--radius-md)", borderLeft: "3px solid var(--danger)" 
                  }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--danger)", marginBottom: "4px" }}>Current Patient Value</div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--text-primary)" }}>{String(patientValue)}</div>
                  </div>
                )}
                <div style={{ marginBottom: "16px" }}>
                  <h4 style={{ color: "var(--text-primary)", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>Clinical Meaning</h4>
                  <p style={{ margin: 0 }}>{explanation.meaning}</p>
                </div>
                <div>
                  <h4 style={{ color: "var(--text-primary)", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>Impact on Policy Review</h4>
                  <p style={{ margin: 0 }}>{explanation.significance}</p>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Abnormal Value Explanation Modal */}
      {abnormalExplanation && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.5)", zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center",
          backdropFilter: "blur(2px)"
        }} onClick={() => setAbnormalExplanation(null)}>
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
                <AlertTriangle size={18} style={{ color: "var(--danger)" }} /> {abnormalExplanation.title}
              </span>
              <button onClick={() => setAbnormalExplanation(null)} style={{
                background: "none", border: "none", cursor: "pointer", padding: "4px",
                color: "var(--text-tertiary)", borderRadius: "var(--radius-sm)"
              }}>
                <XCircle size={20} />
              </button>
            </div>
            <div style={{ padding: "24px", fontSize: "0.9rem", lineHeight: 1.6, color: "var(--text-secondary)" }}>
              <div style={{ 
                marginBottom: "16px", padding: "12px", background: "rgba(239,68,68,0.06)", 
                borderRadius: "var(--radius-md)", borderLeft: "3px solid var(--danger)" 
              }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <div style={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-tertiary)", marginBottom: "2px" }}>Patient Value</div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--danger)" }}>{abnormalExplanation.val}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-tertiary)", marginBottom: "2px" }}>Reference Range</div>
                    <div style={{ fontSize: "1rem", fontWeight: 500, color: "var(--text-primary)" }}>{abnormalExplanation.range}</div>
                  </div>
                </div>
              </div>
              <div style={{ marginBottom: "16px" }}>
                <h4 style={{ color: "var(--text-primary)", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>Clinical Meaning</h4>
                <p style={{ margin: 0 }}>{abnormalExplanation.meaning}</p>
              </div>
              <div>
                <h4 style={{ color: "var(--text-primary)", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>Clinical Significance</h4>
                <p style={{ margin: 0 }}>{abnormalExplanation.significance}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
