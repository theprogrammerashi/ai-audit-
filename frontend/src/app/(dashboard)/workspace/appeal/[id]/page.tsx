"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  LayoutDashboard, CheckCircle, XCircle, ArrowUpCircle, AlertTriangle,
  Shield, Clock, ArrowLeft, Loader2, FileText, Check, AlertCircle, FileSearch, Edit3,
  FolderOpen, X
} from "lucide-react";
import api from "@/lib/api";

const renderMarkdown = (text: string) => {
  if (!text) return "";
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br />")
    .replace(/^- /gm, "&#8226; ");
};

export default function WorkspaceAppealPage() {
  const params = useParams();
  const router = useRouter();
  const appealId = params.id as string;
  
  const [data, setData] = useState<any>(null);
  const [caseData, setCaseData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [rationale, setRationale] = useState("");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    const fetchAppealData = async () => {
      try {
        const res = await api.get(`/appeal/intake-cases/${appealId}`);
        setData(res.data);
        
        // Fetch original case details
        if (res.data.case_id) {
          try {
            const caseRes = await api.get(`/cases/${res.data.case_id}`);
            setCaseData(caseRes.data);
          } catch (caseErr) {
            console.error("Failed to fetch case details:", caseErr);
          }
        }
      } catch (err) {
        console.error("Failed to fetch appeal data:", err);
        setError("Failed to load appeal data");
      } finally {
        setLoading(false);
      }
    };
    if (appealId) {
      fetchAppealData();
    }
  }, [appealId]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", flexDirection: "column", gap: "16px" }}>
        <Loader2 size={32} style={{ animation: "spin 1s linear infinite", color: "var(--primary)" }} />
        <p style={{ color: "var(--text-secondary)" }}>Loading appeal context...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: "32px", textAlign: "center" }}>
        <h2>{error || "Appeal Not Found"}</h2>
        <button className="btn btn-primary" style={{ marginTop: "16px" }} onClick={() => router.push("/workspace")}>
          <ArrowLeft size={16} /> Back to Queue
        </button>
      </div>
    );
  }

  const handleSubmitDecision = async (decision: string) => {
    if (!rationale || rationale.trim().length === 0) {
      alert("Please provide a rationale before submitting.");
      return;
    }
    setIsSubmitting(true);
    
    try {
      await api.post(`/appeal/intake-cases/${appealId}/decision`, {
        decision: decision,
        rationale: rationale
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
        <h2>Appeal Decision Submitted</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
          The appeal outcome has been recorded. Returning to queue...
        </p>
      </div>
    );
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "12px 24px", borderBottom: "1px solid var(--border-default)", background: "var(--bg-surface)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button onClick={() => router.push("/workspace")} className="btn btn-secondary" style={{ padding: "6px 10px" }}>
            <ArrowLeft size={16} />
          </button>
          <FileText size={22} style={{ color: "var(--warning)" }} />
          <div>
            <div style={{ fontWeight: 600, display: "flex", gap: "8px", alignItems: "center" }}>
              {data.id}
              <span className="badge badge-warning" style={{ fontSize: "0.7rem", display: "flex", alignItems: "center", gap: "4px" }}>
                <FileText size={10} /> APPEAL REVIEW
              </span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--text-tertiary)", fontSize: "0.8rem" }}>
          <Clock size={14} /> Received: {new Date(data.appeal_received_date || Date.now()).toLocaleDateString()}
        </div>
      </div>

      {/* Layout */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "300px 1fr", overflow: "hidden", background: "var(--bg-body)" }}>
        
        {/* LEFT PANEL */}
        <div style={{ borderRight: "1px solid var(--border-default)", overflowY: "auto", padding: "20px", background: "var(--bg-surface)" }}>
          <h4 style={{ marginBottom: "16px", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)" }}>Appeal Info</h4>
          {[
            ["Patient Name", data.patient_name],
            ["Member ID", data.member_id], 
            ["Associated Case", (
              <button 
                onClick={() => setIsDrawerOpen(true)}
                style={{ background: "none", border: "none", color: "var(--primary)", padding: 0, textDecoration: "underline", cursor: "pointer", fontWeight: 600, fontSize: "0.9rem", textAlign: "left", display: "inline-block" }}
              >
                {data.case_number || data.case_id}
              </button>
            )],
            ["Type", data.appellant_type], 
            ["Level", data.appeal_level], 
            ["Diagnosis", data.primary_diagnosis_display || data.diagnosis_category]
          ].map(([label, val]) => (
            <div key={label} style={{ marginBottom: "12px" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "2px" }}>{label}</div>
              <div style={{ fontSize: "0.9rem", fontWeight: 500, color: "var(--text-primary)" }}>{val || "N/A"}</div>
            </div>
          ))}

          <div style={{ borderTop: "1px solid var(--border-default)", margin: "20px 0" }} />

          <h4 style={{ marginBottom: "16px", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)" }}>Denial Details</h4>
          <div style={{ marginBottom: "12px" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "2px" }}>Original Denial Reason</div>
            <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-primary)" }}>{data.denial_reason_category}</div>
          </div>
        </div>

        {/* CENTER WORKSPACE */}
        <div style={{ overflowY: "auto", padding: "32px", display: "flex", flexDirection: "column", gap: "24px", maxWidth: "900px", margin: "0 auto", width: "100%" }}>
          
          <div className="card" style={{ padding: "20px" }}>
            <h3 style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px", fontSize: "1rem" }}>
              <FileSearch size={18} style={{ color: "var(--primary)" }} /> Appeal Clinical Rationale
            </h3>
            <div 
              style={{ fontSize: "0.95rem", lineHeight: 1.6, color: "var(--text-secondary)", whiteSpace: "pre-wrap" }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(data.clinical_rationale_provided || "No clinical rationale provided.") }}
            />
          </div>

          <div className="card" style={{ padding: "20px" }}>
            <h3 style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px", fontSize: "1rem" }}>
              <Shield size={18} style={{ color: "var(--primary)" }} /> New Evidence & Policy
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div style={{ background: "rgba(15,14,12,0.02)", padding: "16px", borderRadius: "8px", border: "1px solid var(--border-default)" }}>
                <h4 style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "12px", textTransform: "uppercase" }}>Evidence Cited</h4>
                <div style={{ fontSize: "0.85rem" }}>{data.key_evidence_cited || "None"}</div>
              </div>
              <div style={{ background: "rgba(15,14,12,0.02)", padding: "16px", borderRadius: "8px", border: "1px solid var(--border-default)" }}>
                <h4 style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "12px", textTransform: "uppercase" }}>Policy Referenced</h4>
                <div style={{ fontSize: "0.85rem" }}>{data.policy_referenced || "None"}</div>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: "20px" }}>
            <h3 style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px", fontSize: "1rem" }}>
              <Edit3 size={18} style={{ color: "var(--primary)" }} /> Final Review Rationale
            </h3>
            <textarea
              className="input-field"
              style={{ minHeight: "120px", fontSize: "0.9rem", lineHeight: 1.6 }}
              placeholder="Enter your final clinical rationale for the appeal outcome..."
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
            />
          </div>

          <div className="card" style={{ padding: "20px", border: "2px solid var(--border-default)" }}>
            <h3 style={{ fontSize: "1rem", marginBottom: "20px" }}>Appeal Decision</h3>
            <div style={{ display: "flex", gap: "16px" }}>
              <button
                className="btn btn-warning"
                style={{ flex: 1, padding: "16px", fontSize: "1rem", gap: "8px", background: "var(--warning)", color: "white" }}
                onClick={() => handleSubmitDecision("Overturned")}
                disabled={isSubmitting}
              >
                <CheckCircle size={20} /> Overturn Denial
              </button>
              <button
                className="btn btn-danger"
                style={{ flex: 1, padding: "16px", fontSize: "1rem", gap: "8px" }}
                onClick={() => handleSubmitDecision("Upheld")}
                disabled={isSubmitting}
              >
                <XCircle size={20} /> Uphold Denial
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Style block for keyframes */}
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>

      {/* Drawer Backdrop */}
      {isDrawerOpen && (
        <div 
          onClick={() => setIsDrawerOpen(false)}
          style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", justifyContent: "flex-end" }}
        >
          {/* Drawer Content */}
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{ width: "500px", height: "100%", background: "var(--bg-surface)", borderLeft: "1px solid var(--border-default)", display: "flex", flexDirection: "column", animation: "slideIn 0.25s ease-out", overflow: "hidden" }}
          >
            {/* Header */}
            <div style={{ padding: "20px", borderBottom: "1px solid var(--border-default)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px" }}><FolderOpen size={20} color="var(--primary)" /> Case {caseData?.case?.case_number || data.case_number}</h3>
              <button onClick={() => setIsDrawerOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", color: "var(--text-secondary)" }}><X size={20} /></button>
            </div>
            {/* Body */}
            <div style={{ padding: "20px", flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Clinical Summary */}
              <div className="card" style={{ padding: "16px" }}>
                <h4 style={{ margin: "0 0 8px 0", fontSize: "0.85rem", textTransform: "uppercase", color: "var(--text-secondary)" }}>Clinical Summary</h4>
                <p style={{ fontSize: "0.88rem", lineHeight: 1.5, color: "var(--text-primary)", whiteSpace: "pre-wrap", margin: 0 }}>
                  {caseData?.case?.structured_case?.clinical_summary || "No summary available."}
                </p>
              </div>
              
              {/* Vitals & Labs */}
              {caseData?.case?.structured_case && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div className="card" style={{ padding: "12px" }}>
                    <h4 style={{ margin: "0 0 8px 0", fontSize: "0.80rem", textTransform: "uppercase", color: "var(--text-secondary)" }}>Vitals</h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.82rem" }}>
                      <div>Temp: {caseData.case.structured_case.vitals?.temp}°F</div>
                      <div>BP: {caseData.case.structured_case.vitals?.bp}</div>
                      <div>HR: {caseData.case.structured_case.vitals?.hr} bpm</div>
                      <div>RR: {caseData.case.structured_case.vitals?.rr} /min</div>
                      <div>O2 Sat: {caseData.case.structured_case.vitals?.o2_sat}%</div>
                    </div>
                  </div>
                  <div className="card" style={{ padding: "12px" }}>
                    <h4 style={{ margin: "0 0 8px 0", fontSize: "0.80rem", textTransform: "uppercase", color: "var(--text-secondary)" }}>Labs</h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.82rem" }}>
                      {Object.entries(caseData.case.structured_case.labs || {}).map(([k, v]) => (
                        <div key={k}>{k.toUpperCase()}: {String(v)}</div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Original Decision */}
              <div className="card" style={{ padding: "16px", borderLeft: "4px solid var(--danger)" }}>
                <h4 style={{ margin: "0 0 8px 0", fontSize: "0.85rem", textTransform: "uppercase", color: "var(--danger)" }}>Original Denial Decision</h4>
                <div style={{ fontSize: "0.88rem", marginBottom: "8px" }}>
                  Status: <span className="badge badge-danger">DENIED</span>
                </div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "4px", fontWeight: 600 }}>Reviewer Rationale:</div>
                <p style={{ fontSize: "0.85rem", lineHeight: 1.5, color: "var(--text-primary)", whiteSpace: "pre-wrap", background: "var(--bg-hover)", padding: "10px", borderRadius: "4px", margin: 0 }}>
                  {caseData?.decision?.rationale || "No rationale recorded."}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
