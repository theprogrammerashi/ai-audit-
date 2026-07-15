"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, User, Stethoscope, Activity, FileText, AlertTriangle, Clock, Shield, Loader2, X, Eye
} from "lucide-react";
import api from "@/lib/api";

export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params.id as string;

  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);

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
  const riskColor = riskLevel === "CRITICAL" ? "var(--danger)" : riskLevel === "HIGH" ? "var(--warning)" : riskLevel === "MEDIUM" ? "var(--info)" : riskLevel === "LOW" ? "var(--success)" : "var(--border-default)";

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
              <div style={{ fontWeight: 600 }}>{diagnosis.display}</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-tertiary)" }}>ICD-10: {diagnosis.primary}</div>
              {diagnosis.secondary && diagnosis.secondary.length > 0 && (
                <div style={{ marginTop: "8px" }}>
                  <div className="label" style={{ marginBottom: "4px" }}>Secondary</div>
                  <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                    {diagnosis.secondary.map((s: string) => (
                      <span key={s} className="badge badge-info" style={{ fontSize: "0.7rem" }}>{s}</span>
                    ))}
                  </div>
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
                return (
                  <div key={key} style={{ display: "flex", justifyContent: "space-between", padding: "6px 8px", borderBottom: "1px solid var(--border-default)" }}>
                    <span style={{ fontSize: "0.8rem", textTransform: "capitalize" }}>{key.replace("_", " ")}</span>
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
            <p style={{ fontSize: "0.85rem", lineHeight: 1.7, color: "var(--text-secondary)" }}>{summary}</p>
            {riskSignals.length > 0 && (
              <div style={{ borderTop: "1px solid var(--border-default)", marginTop: "14px", paddingTop: "14px" }}>
                <div className="label" style={{ marginBottom: "8px" }}>Risk Signals</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                  {riskSignals.map((s: string) => (
                    <span key={s} className="badge badge-danger" style={{ fontSize: "0.7rem", display: "flex", alignItems: "center", gap: "4px" }}>
                      <AlertTriangle size={10} /> {s.replace(/_/g, " ")}
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
                    <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: "4px", color: "var(--text-primary)" }}>{t.event}</div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>{t.details}</div>
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
