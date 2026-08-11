"use client";

import { useState, useRef, useEffect, Fragment } from "react";
import { useRouter } from "next/navigation";
import {
  Upload, FileText, User, Calendar, Stethoscope,
  ArrowLeft, CheckCircle, Loader2, Plus, X, ClipboardList,
  AlertTriangle, Sparkles, Activity, Brain, Scan, Image as ImageIcon
} from "lucide-react";
import api from "@/lib/api";

interface ConfidenceIndicatorProps {
  confidence: number;
}
function ConfidenceIndicator({ confidence }: ConfidenceIndicatorProps) {
  const pct = Math.round(confidence * 100);
  const color = confidence >= 0.85 ? "var(--success)" : confidence >= 0.70 ? "var(--warning)" : "var(--danger)";
  return (
    <span style={{ fontSize: "0.7rem", color, fontWeight: 600, background: `${color}10`, padding: "2px 6px", borderRadius: "100px", marginLeft: "6px" }}>
      {pct}% Confidence
    </span>
  );
}

const ABNORMAL_EXPLANATIONS: Record<string, { title: string; range: string; meaning: string; significance: string }> = {
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

interface ICD10Suggestion {
  code: string;
  display: string;
  confidence: number;
  reasoning?: string;
  source?: string;
}

interface ICD10ChipsProps {
  suggestions: ICD10Suggestion[];
  onSelect: (code: string, display: string) => void;
  currentCode: string;
}
function ICD10Chips({ suggestions, onSelect, currentCode }: ICD10ChipsProps) {
  if (!suggestions || suggestions.length === 0) return null;
  return (
    <div style={{ marginTop: "10px" }}>
      <div style={{
        fontSize: "0.72rem", color: "var(--text-tertiary)", marginBottom: "6px",
        display: "flex", alignItems: "center", gap: "6px"
      }}>
        <Brain size={11} style={{ color: "var(--primary)" }} />
        AI Suggestions (click to apply):
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
        {suggestions.map((s) => {
          const isSelected = currentCode === s.code;
          const confColor = s.confidence >= 0.8 ? "var(--success)" : s.confidence >= 0.6 ? "var(--warning)" : "var(--text-tertiary)";
          return (
            <button
              key={s.code}
              onClick={() => onSelect(s.code, s.display)}
              title={s.reasoning || s.display}
              style={{
                padding: "5px 10px",
                borderRadius: "20px",
                fontSize: "0.75rem",
                fontWeight: 500,
                border: `1.5px solid ${isSelected ? "var(--primary)" : "var(--border-default)"}`,
                background: isSelected ? "var(--primary-light)" : "var(--bg-body)",
                color: isSelected ? "var(--primary)" : "var(--text-primary)",
                cursor: "pointer",
                transition: "all 0.15s",
                display: "flex", alignItems: "center", gap: "6px",
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = "var(--primary)";
                  e.currentTarget.style.background = "var(--primary-light)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = "var(--border-default)";
                  e.currentTarget.style.background = "var(--bg-body)";
                }
              }}
            >
              <span style={{
                fontFamily: "monospace", fontWeight: 700,
                color: isSelected ? "var(--primary)" : "var(--primary)",
                fontSize: "0.78rem",
              }}>{s.code}</span>
              <span style={{ color: isSelected ? "var(--primary)" : "var(--text-secondary)", maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {s.display}
              </span>
              <span style={{ color: confColor, fontSize: "0.68rem", fontWeight: 600, flexShrink: 0 }}>
                {Math.round(s.confidence * 100)}%
              </span>
              {s.source && (
                <span style={{
                  fontSize: "0.6rem", background: "var(--bg-hover)",
                  padding: "1px 4px", borderRadius: "4px",
                  color: "var(--text-tertiary)", flexShrink: 0
                }}>
                  {s.source.includes("BioBERT") || s.source.includes("Groq+") ? "AI" : s.source === "Groq LLM" ? "LLM" : "NLP"}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const DOC_TYPES = [
  { value: "PRIOR_AUTH", label: "Prior Authorization" },
  { value: "APPEAL_DOCUMENT", label: "Appeal Document" },
];

type AutoFillField = "patient_name" | "mrn" | "dob" | "age" | "gender" | "primary_diagnosis_code" | "primary_diagnosis_display" | "secondary_diagnoses" | "clinical_notes";

export default function NewCasePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; size: string; type: string; ocr?: boolean }[]>([]);
  const [confidences, setConfidences] = useState<Record<string, number>>({});
  const [autoFilled, setAutoFilled] = useState(false);
  const [autoFilledFields, setAutoFilledFields] = useState<Set<AutoFillField>>(new Set());
  const [icd10Suggestions, setIcd10Suggestions] = useState<ICD10Suggestion[]>([]);

  const [form, setForm] = useState({
    patient_name: "",
    mrn: "",
    dob: "",
    age: "",
    gender: "",
    primary_diagnosis_code: "",
    primary_diagnosis_display: "",
    secondary_diagnoses: "",
    clinical_notes: "",
    document_type: "PRIOR_AUTH",
    priority: "STANDARD",
  });

  const [extractedVitals, setExtractedVitals] = useState<any>(null);
  const [extractedLabs, setExtractedLabs] = useState<any>(null);
  const [extractedTimeline, setExtractedTimeline] = useState<any[]>([]);
  const [riskSignals, setRiskSignals] = useState<string[]>([]);
  const [abnormalExplanation, setAbnormalExplanation] = useState<any | null>(null);

  const triggerAutofillAnimation = (fields: AutoFillField[]) => {
    const fieldSet = new Set(fields) as Set<AutoFillField>;
    setAutoFilledFields(fieldSet);
    setTimeout(() => setAutoFilledFields(new Set()), 2200);
  };

  const getFieldStyle = (field: AutoFillField): React.CSSProperties => {
    if (autoFilledFields.has(field)) {
      return {
        animation: "autofillPulse 2s ease forwards",
        borderColor: "var(--success)",
      };
    }
    return {};
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsParsing(true);
    setParseError(null);
    setAutoFilled(false);

    let newForm = {
      patient_name: "",
      mrn: "",
      dob: "",
      age: "",
      gender: "",
      document_type: "CLINICAL_NOTE",
      primary_diagnosis_code: "",
      primary_diagnosis_display: "",
      secondary_diagnoses: "",
      clinical_notes: "",
      priority: "STANDARD",
    };
    let newConfidences: Record<string, number> = {};
    let mergedVitals: any = {};
    let mergedLabs: any = {};
    let mergedTimeline: any[] = [];
    let mergedRiskSignals = new Set<string>();
    let mergedSuggestions: ICD10Suggestion[] = [];
    let newUploadedFiles: any[] = [];
    const filledFields: AutoFillField[] = [];

    for (const file of files) {
      const sizeStr = file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${(file.size / 1024).toFixed(0)} KB`;

      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await api.post("/cases/parse-document", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        const data = res.data;

        if (data.patient_name && (!newForm.patient_name || (data.patient_name_confidence > (newConfidences.patient_name || 0)))) {
          newForm.patient_name = data.patient_name;
          newConfidences.patient_name = data.patient_name_confidence;
          filledFields.push("patient_name");
        }
        if (data.mrn && (!newForm.mrn || (data.mrn_confidence > (newConfidences.mrn || 0)))) {
          newForm.mrn = data.mrn;
          newConfidences.mrn = data.mrn_confidence;
          filledFields.push("mrn");
        }
        if (data.dob && (!newForm.dob || (data.dob_confidence > (newConfidences.dob || 0)))) {
          newForm.dob = data.dob;
          newConfidences.dob = data.dob_confidence;
          filledFields.push("dob");
        }
        if (data.age && (!newForm.age || (data.age_confidence > (newConfidences.age || 0)))) {
          newForm.age = String(data.age);
          newConfidences.age = data.age_confidence;
          filledFields.push("age");
        }
        if (data.gender && !newForm.gender) {
          newForm.gender = data.gender;
          filledFields.push("gender");
        }
        if (data.primary_diagnosis && (!newForm.primary_diagnosis_code || (data.primary_diagnosis.confidence > (newConfidences.diagnosis || 0)))) {
          newForm.primary_diagnosis_code = data.primary_diagnosis.icd10_code || "";
          newForm.primary_diagnosis_display = data.primary_diagnosis.display_name || "";
          newConfidences.diagnosis = data.primary_diagnosis.confidence;
          filledFields.push("primary_diagnosis_code");
          filledFields.push("primary_diagnosis_display");
        }
        if (data.secondary_diagnoses && data.secondary_diagnoses.length > 0) {
          const codes = data.secondary_diagnoses.map((d: any) => d.icd10_code).filter(Boolean);
          const existing = newForm.secondary_diagnoses ? newForm.secondary_diagnoses.split(", ") : [];
          newForm.secondary_diagnoses = Array.from(new Set([...existing, ...codes])).join(", ");
          if (codes.length > 0) filledFields.push("secondary_diagnoses");
        }
        if (data.clinical_summary) {
          newForm.clinical_notes = newForm.clinical_notes
            ? `${newForm.clinical_notes}\n\n[From ${file.name}]:\n${data.clinical_summary}`
            : data.clinical_summary;
          newConfidences.clinical_notes = Math.max(newConfidences.clinical_notes || 0, data.clinical_summary_confidence || 0);
          filledFields.push("clinical_notes");
        }
        if (data.detected_document_type) {
          newForm.document_type = data.detected_document_type;
          newConfidences.document_type = data.parse_confidence;
        }

        if (data.vitals) mergedVitals = { ...mergedVitals, ...data.vitals };
        if (data.labs) mergedLabs = { ...mergedLabs, ...data.labs };
        if (data.timeline) mergedTimeline = [...mergedTimeline, ...data.timeline];
        if (data.risk_signals) data.risk_signals.forEach((s: string) => mergedRiskSignals.add(s));

        if (data.icd10_suggestions && data.icd10_suggestions.length > 0) {
          const existingCodes = new Set(mergedSuggestions.map((s) => s.code));
          for (const s of data.icd10_suggestions) {
            if (!existingCodes.has(s.code)) {
              mergedSuggestions.push(s);
              existingCodes.add(s.code);
            }
          }
          mergedSuggestions.sort((a, b) => b.confidence - a.confidence);
        }

        newUploadedFiles.push({
          name: file.name,
          size: sizeStr,
          type: data.detected_document_type || "UNKNOWN",
          ocr: data.ocr_used || false,
        });

      } catch (err) {
        console.error(`Failed to parse document ${file.name}:`, err);
        setParseError(`Failed to parse some documents. You can fill in the missing details manually.`);
        newUploadedFiles.push({ name: file.name, size: sizeStr, type: "FAILED" });
      }
    }

    if (mergedRiskSignals.size >= 3) {
      newForm.priority = "URGENT";
    } else if (mergedRiskSignals.size > 0) {
      newForm.priority = "HIGH";
    }
    setForm(newForm);
    setConfidences(newConfidences);
    setExtractedVitals(Object.keys(mergedVitals).length > 0 ? mergedVitals : null);
    setExtractedLabs(Object.keys(mergedLabs).length > 0 ? mergedLabs : null);
    setExtractedTimeline(mergedTimeline);
    setRiskSignals(Array.from(mergedRiskSignals));
    setIcd10Suggestions(mergedSuggestions.slice(0, 5));
    setAutoFilled(true);
    setUploadedFiles(newUploadedFiles);
    setIsParsing(false);
    if (fileInputRef.current) fileInputRef.current.value = "";

    if (filledFields.length > 0) triggerAutofillAnimation(filledFields);
  };

  const removeFile = (name: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.name !== name));
  };

  const handleSubmit = async () => {
    if (!form.patient_name || !form.mrn || !form.primary_diagnosis_code) return;
    setIsSubmitting(true);

    try {
      await api.post("/cases", {
        patient_name: form.patient_name,
        patient_mrn: form.mrn,
        patient_dob: form.dob,
        patient_age: form.age ? parseInt(form.age) : null,
        primary_diagnosis_code: form.primary_diagnosis_code,
        primary_diagnosis_display: form.primary_diagnosis_display || form.primary_diagnosis_code,
        secondary_diagnoses: form.secondary_diagnoses,
        clinical_notes: form.clinical_notes,
        document_type: form.document_type,
        structured_case: {
          clinical_summary: form.clinical_notes,
          vitals: extractedVitals,
          labs: extractedLabs,
          timeline: extractedTimeline,
          risk_signals: riskSignals,
        },
      });
      setSubmitted(true);
      setTimeout(() => router.push("/workspace"), 2000);
    } catch (err) {
      console.error("Failed to submit case:", err);
      alert("Failed to submit case");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: "16px" }}>
        <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "var(--success-light)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CheckCircle size={32} style={{ color: "var(--success)" }} />
        </div>
        <h2>Case Submitted Successfully</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
          AI pipeline is now processing the clinical documents. Redirecting to cases...
        </p>
        <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--primary)", animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`, opacity: 0.4 }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes autofillPulse {
          0%   { background-color: rgba(34,197,94,0.18); border-color: var(--success); box-shadow: 0 0 0 3px rgba(34,197,94,0.15); }
          60%  { background-color: rgba(34,197,94,0.10); border-color: var(--success); }
          100% { background-color: transparent; border-color: var(--border-default); box-shadow: none; }
        }
      `}</style>

      <div style={{ padding: "32px", maxWidth: "900px", margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
          <button onClick={() => router.push("/cases")} className="btn btn-secondary" style={{ padding: "6px 10px" }}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <ClipboardList size={28} style={{ color: "var(--primary)" }} /> New Case Submission
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginTop: "4px" }}>
              Upload clinical documents for AI-powered auto-extraction, OCR, and ICD-10 suggestions
            </p>
          </div>
        </div>

        <div style={{ borderTop: "1px solid var(--border-default)", marginTop: "16px", paddingTop: "28px" }}>
          <div className="card" style={{ marginBottom: "20px", borderLeft: "3px solid var(--primary)" }}>
            <h3 style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.95rem", marginBottom: "6px" }}>
              <Sparkles size={18} style={{ color: "var(--primary)" }} /> Smart Document Upload
            </h3>
            <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "16px" }}>
              Upload a clinical document or scanned image — AI will auto-fill all fields, extract ICD-10 codes, and suggest diagnoses
            </p>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.doc,.csv,.txt,.png,.jpg,.jpeg,.tiff,.tif,.bmp"
              onChange={handleFileUpload}
              style={{ display: "none" }}
            />

            {isParsing ? (
              <div style={{
                border: "2px solid var(--primary)", borderRadius: "var(--radius-lg)", padding: "40px 24px",
                textAlign: "center", background: "var(--primary-light)",
              }}>
                <Loader2 size={32} style={{ color: "var(--primary)", animation: "spin 1s linear infinite", marginBottom: "12px" }} />
                <p style={{ fontWeight: 500, fontSize: "0.9rem", marginBottom: "4px" }}>Parsing document with AI...</p>
                <p style={{ fontSize: "0.8rem", color: "var(--text-tertiary)" }}>
                  Extracting patient data, diagnoses, vitals, labs — OCR active for scanned pages
                </p>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: "2px dashed var(--border-default)", borderRadius: "var(--radius-lg)",
                  padding: "40px 24px", textAlign: "center", cursor: "pointer",
                  transition: "all 0.2s ease", background: "var(--bg-body)",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.background = "var(--primary-light)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-default)"; e.currentTarget.style.background = "var(--bg-body)"; }}
              >
                <Upload size={32} style={{ color: "var(--text-tertiary)", marginBottom: "12px" }} />
                <p style={{ fontWeight: 500, fontSize: "0.9rem", marginBottom: "4px" }}>Click to upload a clinical document or image</p>
                <div style={{ display: "flex", justifyContent: "center", gap: "8px", flexWrap: "wrap", marginTop: "8px" }}>
                  {["PDF", "DOCX", "CSV", "TXT"].map((f) => (
                    <span key={f} style={{ fontSize: "0.72rem", padding: "2px 8px", borderRadius: "10px", background: "var(--bg-hover)", color: "var(--text-tertiary)" }}>
                      {f}
                    </span>
                  ))}
                  <span style={{ fontSize: "0.72rem", padding: "2px 8px", borderRadius: "10px", background: "rgba(232,82,26,0.08)", color: "var(--primary)", fontWeight: 500 }}>
                    PNG / JPG — OCR
                  </span>
                  <span style={{ fontSize: "0.72rem", padding: "2px 8px", borderRadius: "10px", background: "rgba(232,82,26,0.08)", color: "var(--primary)", fontWeight: 500 }}>
                    Scanned PDF — OCR
                  </span>
                </div>
              </div>
            )}

            {parseError && (
              <div style={{ marginTop: "12px", padding: "10px 14px", background: "rgba(239,68,68,0.06)", borderRadius: "var(--radius-md)", border: "1px solid var(--danger)", display: "flex", alignItems: "center", gap: "8px", color: "var(--danger)", fontSize: "0.85rem" }}>
                <AlertTriangle size={16} /> {parseError}
              </div>
            )}

            {autoFilled && (
              <div style={{ marginTop: "12px", padding: "10px 14px", background: "var(--success-light)", borderRadius: "var(--radius-md)", border: "1px solid var(--success)", display: "flex", alignItems: "center", gap: "8px", color: "var(--success)", fontSize: "0.85rem" }}>
                <CheckCircle size={16} /> Document parsed successfully! Form fields auto-filled with a highlight animation. Review and edit as needed.
              </div>
            )}

            {uploadedFiles.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px" }}>
                {uploadedFiles.map((f) => (
                  <div key={f.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "var(--bg-body)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      {f.type === "image" || f.name.match(/\.(png|jpg|jpeg|tiff|bmp)$/i) ? (
                        <ImageIcon size={16} style={{ color: "var(--primary)" }} />
                      ) : (
                        <FileText size={16} style={{ color: "var(--primary)" }} />
                      )}
                      <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>{f.name}</span>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>{f.size}</span>
                      <span className="badge badge-info" style={{ fontSize: "0.7rem", marginLeft: "8px" }}>{f.type}</span>
                      {f.ocr && (
                        <span style={{ fontSize: "0.65rem", display: "flex", alignItems: "center", gap: "3px", background: "rgba(232,82,26,0.1)", color: "var(--primary)", padding: "2px 6px", borderRadius: "8px", fontWeight: 600 }}>
                          <Scan size={10} /> OCR
                        </span>
                      )}
                    </div>
                    <button onClick={() => removeFile(f.name)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", padding: "2px" }}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card" style={{ marginBottom: "20px" }}>
            <h3 style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.95rem", marginBottom: "12px" }}>
              <FileText size={18} style={{ color: "var(--primary)" }} /> Document Type
              {confidences.document_type && <ConfidenceIndicator confidence={confidences.document_type} />}
            </h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {DOC_TYPES.map((dt) => (
                <button
                  key={dt.value}
                  onClick={() => setForm({ ...form, document_type: dt.value })}
                  className={`btn ${form.document_type === dt.value ? "btn-primary" : "btn-secondary"}`}
                  style={{ fontSize: "0.8rem" }}
                >
                  {dt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="card" style={{ marginBottom: "20px" }}>
            <h3 style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.95rem", marginBottom: "20px" }}>
              <User size={18} style={{ color: "var(--primary)" }} /> Patient Demographics
              {autoFilled && (
                <span style={{ fontSize: "0.7rem", color: "var(--success)", marginLeft: "6px", display: "flex", alignItems: "center", gap: "4px" }}>
                  <Sparkles size={11} /> Auto-filled
                </span>
              )}
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label className="label" style={{ marginBottom: "6px", display: "block" }}>
                  Patient Name * {confidences.patient_name ? <ConfidenceIndicator confidence={confidences.patient_name} /> : null}
                </label>
                <input
                  className="input"
                  placeholder="e.g., Robert Mitchell"
                  value={form.patient_name}
                  onChange={(e) => setForm({ ...form, patient_name: e.target.value })}
                  style={getFieldStyle("patient_name")}
                />
              </div>
              <div>
                <label className="label" style={{ marginBottom: "6px", display: "block" }}>
                  MRN * {confidences.mrn ? <ConfidenceIndicator confidence={confidences.mrn} /> : null}
                </label>
                <input
                  className="input"
                  placeholder="e.g., 45872136"
                  value={form.mrn}
                  onChange={(e) => setForm({ ...form, mrn: e.target.value })}
                  style={getFieldStyle("mrn")}
                />
              </div>
              <div>
                <label className="label" style={{ marginBottom: "6px", display: "block" }}>
                  Date of Birth {confidences.dob ? <ConfidenceIndicator confidence={confidences.dob} /> : null}
                </label>
                <input
                  className="input"
                  placeholder="e.g., 1952-06-15"
                  value={form.dob}
                  onChange={(e) => setForm({ ...form, dob: e.target.value })}
                  style={getFieldStyle("dob")}
                />
              </div>
              <div>
                <label className="label" style={{ marginBottom: "6px", display: "block" }}>
                  Age {confidences.age ? <ConfidenceIndicator confidence={confidences.age} /> : null}
                </label>
                <input
                  className="input"
                  type="number"
                  placeholder="e.g., 68"
                  value={form.age}
                  onChange={(e) => setForm({ ...form, age: e.target.value })}
                  style={getFieldStyle("age")}
                />
              </div>
              <div>
                <label className="label" style={{ marginBottom: "6px", display: "block" }}>Gender</label>
                <select
                  className="input"
                  value={form.gender}
                  onChange={(e) => setForm({ ...form, gender: e.target.value })}
                  style={{ ...getFieldStyle("gender"), cursor: "pointer" }}
                >
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: "20px" }}>
            <h3 style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.95rem", marginBottom: "20px" }}>
              <Stethoscope size={18} style={{ color: "var(--primary)" }} /> Diagnosis Information
              {confidences.diagnosis ? <ConfidenceIndicator confidence={confidences.diagnosis} /> : null}
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label className="label" style={{ marginBottom: "6px", display: "block" }}>Primary ICD-10 Code *</label>
                <input
                  className="input"
                  placeholder="e.g., I50.23"
                  value={form.primary_diagnosis_code}
                  onChange={(e) => setForm({ ...form, primary_diagnosis_code: e.target.value })}
                  style={{ fontFamily: "monospace", ...getFieldStyle("primary_diagnosis_code") }}
                />
              </div>
              <div>
                <label className="label" style={{ marginBottom: "6px", display: "block" }}>Diagnosis Display Name</label>
                <input
                  className="input"
                  placeholder="e.g., Acute on Chronic Systolic Heart Failure"
                  value={form.primary_diagnosis_display}
                  onChange={(e) => setForm({ ...form, primary_diagnosis_display: e.target.value })}
                  style={getFieldStyle("primary_diagnosis_display")}
                />
              </div>
            </div>



            <div style={{ marginTop: "16px" }}>
              <label className="label" style={{ marginBottom: "6px", display: "block" }}>Secondary Diagnoses (comma-separated ICD-10)</label>
              <input
                className="input"
                placeholder="e.g., I11.0, E11.9"
                value={form.secondary_diagnoses}
                onChange={(e) => setForm({ ...form, secondary_diagnoses: e.target.value })}
                style={{ fontFamily: "monospace", ...getFieldStyle("secondary_diagnoses") }}
              />
            </div>
          </div>

          {(extractedVitals || extractedLabs) && (
            <div className="card" style={{ marginBottom: "20px", borderLeft: "3px solid var(--info)" }}>
              <h3 style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.95rem", marginBottom: "16px" }}>
                <Activity size={18} style={{ color: "var(--info)" }} /> Extracted Clinical Data
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                {extractedVitals && (
                  <div>
                    <div className="label" style={{ marginBottom: "8px" }}>Vitals</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                      {Object.entries(extractedVitals).filter(([_, v]) => v !== null).map(([key, val]) => {
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
                          <div key={key} 
                            onClick={handleBoxClick}
                            style={{ 
                              padding: "8px 12px", 
                              background: isAbnormal ? "rgba(239, 68, 68, 0.04)" : "var(--bg-body)", 
                              border: isAbnormal ? "1px solid rgba(239, 68, 68, 0.15)" : "1px solid var(--border-default)",
                              borderRadius: "var(--radius-md)", 
                              fontSize: "0.85rem",
                              cursor: isAbnormal ? "pointer" : "default",
                              transition: "transform 0.2s"
                            }}
                            onMouseEnter={(e) => {
                              if (!isAbnormal) return;
                              e.currentTarget.style.transform = "translateY(-2px) scale(1.02)";
                            }}
                            onMouseLeave={(e) => {
                              if (!isAbnormal) return;
                              e.currentTarget.style.transform = "none";
                            }}
                          >
                            <span style={{ color: isAbnormal ? "var(--danger)" : "var(--text-tertiary)", textTransform: "uppercase", fontSize: "0.7rem", display: "flex", alignItems: "center", gap: "4px" }}>
                              {isAbnormal && <AlertTriangle size={10} style={{ color: "var(--danger)" }} />}
                              {key.replace("_", " ")}
                            </span>
                            <div style={{ fontWeight: 600, color: isAbnormal ? "var(--danger)" : "var(--text-primary)" }}>{String(val)}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {extractedLabs && (
                  <div>
                    <div className="label" style={{ marginBottom: "8px" }}>Lab Results</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                      {Object.entries(extractedLabs).filter(([_, v]) => v !== null).map(([key, val]) => {
                        const lowerKey = key.toLowerCase();
                        const isLabAbnormal = (lowerKey === "bnp" && Number(val) > 500) || (lowerKey === "wbc" && (Number(val) > 12 || Number(val) < 4)) || (lowerKey === "lactate" && Number(val) >= 2.0) || (lowerKey === "creatinine" && Number(val) > 1.5) || (lowerKey === "troponin" && Number(val) > 0.04) || (lowerKey === "potassium" && Number(val) > 5.5) || (lowerKey === "ef" && Number(val) < 40);
                        
                        const handleLabClick = () => {
                          if (!isLabAbnormal) return;
                          const labName = (lowerKey === "bnp" || lowerKey === "ef" || lowerKey === "wbc") 
                            ? lowerKey.toUpperCase() 
                            : key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
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
                          <div key={key} 
                            onClick={handleLabClick}
                            style={{ 
                              padding: "8px 12px", 
                              background: isLabAbnormal ? "rgba(239, 68, 68, 0.04)" : "var(--bg-body)", 
                              border: isLabAbnormal ? "1px solid rgba(239, 68, 68, 0.15)" : "1px solid var(--border-default)",
                              borderRadius: "var(--radius-md)", 
                              fontSize: "0.85rem",
                              cursor: isLabAbnormal ? "pointer" : "default",
                              transition: "transform 0.2s"
                            }}
                            onMouseEnter={(e) => {
                              if (!isLabAbnormal) return;
                              e.currentTarget.style.transform = "translateY(-2px) scale(1.02)";
                            }}
                            onMouseLeave={(e) => {
                              if (!isLabAbnormal) return;
                              e.currentTarget.style.transform = "none";
                            }}
                          >
                            <span style={{ color: isLabAbnormal ? "var(--danger)" : "var(--text-tertiary)", textTransform: "uppercase", fontSize: "0.7rem", display: "flex", alignItems: "center", gap: "4px" }}>
                              {isLabAbnormal && <AlertTriangle size={10} style={{ color: "var(--danger)" }} />}
                              {key}
                            </span>
                            <div style={{ fontWeight: 600, color: isLabAbnormal ? "var(--danger)" : "var(--text-primary)" }}>{String(val)}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="card" style={{ marginBottom: "20px" }}>
            <h3 style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.95rem", marginBottom: "20px" }}>
              <FileText size={18} style={{ color: "var(--primary)" }} /> Clinical Summary
              {confidences.clinical_notes ? <ConfidenceIndicator confidence={confidences.clinical_notes} /> : null}
            </h3>

            <div style={{ 
              fontSize: "0.85rem", lineHeight: 1.7, color: "var(--text-secondary)",
              padding: "14px 16px", background: "rgba(15,14,12,0.02)", borderRadius: "var(--radius-md)",
              borderLeft: "3px solid var(--primary)", minHeight: "80px"
            }}>
              {form.clinical_notes ? (
                form.clinical_notes.split(/\r?\n|\\n/g).map((line: string, i: number, arr: any[]) => (
                  <Fragment key={i}>
                    {line.split(/(\*\*.*?\*\*)/g).map((part, j) => 
                      part.startsWith('**') && part.endsWith('**') 
                        ? <strong key={j} style={{ color: "var(--text-primary)" }}>{part.slice(2, -2)}</strong> 
                        : part
                    )}
                    {i < arr.length - 1 && <br />}
                  </Fragment>
                ))
              ) : (
                <span style={{ fontStyle: "italic", color: "var(--text-tertiary)" }}>No clinical summary generated.</span>
              )}
            </div>
          </div>

          <div className="card" style={{ marginBottom: "28px" }}>
            <h3 style={{ fontSize: "0.95rem", marginBottom: "12px" }}>Review Priority</h3>
            <div style={{ display: "flex", gap: "10px" }}>
              {["STANDARD", "HIGH", "URGENT"].map((p) => (
                <button
                  key={p}
                  onClick={() => setForm({ ...form, priority: p })}
                  className={`btn ${form.priority === p ? (p === "URGENT" ? "btn-danger" : p === "HIGH" ? "btn-warning" : "btn-primary") : "btn-secondary"}`}
                  style={{ fontSize: "0.8rem" }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
            <button className="btn btn-secondary" onClick={() => router.push("/cases")}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={isSubmitting || !form.patient_name || !form.mrn || !form.primary_diagnosis_code}
              style={{ gap: "8px", minWidth: "180px" }}
            >
              {isSubmitting ? (
                <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Processing...</>
              ) : (
                <><Plus size={16} /> Submit for Review</>
              )}
            </button>
          </div>
        </div>

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
                  <X size={20} />
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
                  <h4 style={{ color: "var(--text-primary)", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px", margin: "0 0 6px" }}>Clinical Meaning</h4>
                  <p style={{ margin: 0 }}>{abnormalExplanation.meaning}</p>
                </div>
                <div>
                  <h4 style={{ color: "var(--text-primary)", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px", margin: "0 0 6px" }}>Clinical Significance</h4>
                  <p style={{ margin: 0 }}>{abnormalExplanation.significance}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
