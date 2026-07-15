"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  LayoutDashboard, CheckCircle, XCircle, AlertTriangle,
  Shield, Clock, Bot, ArrowLeft, Send, Loader2, FileText, Check, AlertCircle, FileSearch, Edit3,
  Brain, Sparkles, ChevronRight, Activity, Stethoscope, ClipboardCheck
} from "lucide-react";
import api from "@/lib/api";


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


  // New Rationale State
  const [rationale, setRationale] = useState("");

  useEffect(() => {
    const fetchCaseData = async () => {
      try {
        // Fetch user role first
        const meRes = await api.get("/auth/me");
        const role = meRes.data.role;
        setUserRole(role);

        // QA Leads / Admins should not see nurse workspace — redirect to audit
        if (role === "QA_LEAD" || role === "ADMIN" || role === "EXECUTIVE") {
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
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "300px 1fr", overflow: "hidden", background: "var(--bg-body)" }}>
        
        {/* LEFT PANEL: Demographics / Auth */}
        <div style={{ borderRight: "1px solid var(--border-default)", overflowY: "auto", padding: "20px", background: "var(--bg-surface)" }}>
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

        {/* CENTER WORKSPACE: Cards */}
        <div style={{ overflowY: "auto", padding: "32px", display: "flex", flexDirection: "column", gap: "24px", maxWidth: "900px", margin: "0 auto", width: "100%", height: "100%" }}>
          
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
              <p style={{ 
                fontSize: "0.92rem", lineHeight: 1.7, color: "var(--text-secondary)", margin: 0,
                padding: "14px 16px", background: "rgba(15,14,12,0.02)", borderRadius: "var(--radius-md)",
                borderLeft: "3px solid rgba(139,92,246,0.4)"
              }}>
                {d.clinical_summary || "No clinical summary available for this case."}
              </p>

              {/* Key Risk Signals */}
              {d.risk_signals && d.risk_signals.length > 0 && (
                <div style={{ marginTop: "20px" }}>
                  <div style={{ 
                    fontSize: "0.78rem", fontWeight: 600, textTransform: "uppercase", 
                    letterSpacing: "0.06em", color: "var(--danger)", marginBottom: "10px",
                    display: "flex", alignItems: "center", gap: "6px"
                  }}>
                    <AlertTriangle size={13} />
                    Key Risk Signals
                  </div>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {d.risk_signals.map((s: string) => (
                      <span key={s} style={{ 
                        display: "inline-flex", alignItems: "center", gap: "5px",
                        padding: "5px 12px", borderRadius: "var(--radius-full)",
                        background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                        color: "var(--danger)", fontSize: "0.78rem", fontWeight: 500
                      }}>
                        <AlertTriangle size={11} /> {s.replace(/_/g, " ")}
                      </span>
                    ))}
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

          {/* ═══ Card 4: AI Deep Analysis & Recommendation ═══ */}
          <div className="card" style={{ padding: "0", overflow: "hidden" }}>
            {/* Header */}
            <div style={{ 
              padding: "16px 20px", 
              borderBottom: "1px solid var(--border-default)",
              background: "linear-gradient(135deg, rgba(232,82,26,0.07) 0%, rgba(232,82,26,0.02) 100%)",
              display: "flex", alignItems: "center", gap: "10px"
            }}>
              <div style={{
                width: "32px", height: "32px", borderRadius: "var(--radius-md)",
                background: "linear-gradient(135deg, rgba(232,82,26,0.18), rgba(232,82,26,0.08))",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                <Sparkles size={17} style={{ color: "var(--primary)" }} />
              </div>
              <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>AI Analysis & Recommendation</h3>
            </div>

            <div style={{ padding: "20px" }}>
              {deepAnalysis ? (
                <>
                  {/* Recommendation banner */}
                  {deepAnalysis.recommendation && (
                    <div style={{ 
                      padding: "14px 18px", borderRadius: "var(--radius-md)", marginBottom: "20px",
                      background: deepAnalysis.recommendation === "APPROVE" ? "rgba(22,163,74,0.08)" : "rgba(239,68,68,0.08)",
                      border: `1px solid ${deepAnalysis.recommendation === "APPROVE" ? "rgba(22,163,74,0.2)" : "rgba(239,68,68,0.2)"}`,
                      textAlign: "center"
                    }}>
                      <div style={{ 
                        fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em",
                        color: deepAnalysis.recommendation === "APPROVE" ? "var(--success)" : "var(--danger)",
                        marginBottom: "4px"
                      }}>
                        AI Recommendation
                      </div>
                      <div style={{ 
                        fontSize: "1.1rem", fontWeight: 700,
                        color: deepAnalysis.recommendation === "APPROVE" ? "var(--success)" : "var(--danger)"
                      }}>
                        {deepAnalysis.recommendation === "APPROVE" ? "APPROVE" : "DENY"}
                      </div>
                    </div>
                  )}

                  {/* Clinical Analysis */}
                  {deepAnalysis.clinical_analysis && (
                    <div style={{ marginBottom: "20px" }}>
                      <div style={{ 
                        fontSize: "0.78rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em",
                        color: "var(--text-secondary)", marginBottom: "10px"
                      }}>
                        Clinical Analysis
                      </div>
                      <div style={{ 
                        fontSize: "0.88rem", lineHeight: 1.7, color: "var(--text-secondary)",
                        padding: "14px 16px", background: "rgba(15,14,12,0.02)", 
                        borderRadius: "var(--radius-md)", borderLeft: "3px solid var(--primary)"
                      }}>
                        {deepAnalysis.clinical_analysis.split('\n').map((para: string, i: number) => (
                          para.trim() ? <p key={i} style={{ margin: i > 0 ? "10px 0 0" : "0" }}>{para}</p> : null
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Nurse Action Items */}
                  <div style={{ 
                    padding: "16px", borderRadius: "var(--radius-md)",
                    background: "rgba(59,130,246,0.04)", border: "1px solid rgba(59,130,246,0.12)",
                    marginBottom: "20px"
                  }}>
                    <div style={{ 
                      fontSize: "0.82rem", fontWeight: 600, color: "#3B82F6", marginBottom: "12px",
                      display: "flex", alignItems: "center", gap: "6px"
                    }}>
                      <Stethoscope size={14} style={{ color: "#3B82F6" }} /> Nurse Action Items
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {(deepAnalysis.nurse_actions || []).map((action: string, i: number) => (
                        <div key={i} style={{ display: "flex", gap: "8px", fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                          <span style={{ color: "#3B82F6", flexShrink: 0, marginTop: "1px" }}>•</span>
                          <span>{action}</span>
                        </div>
                      ))}
                      {(!deepAnalysis.nurse_actions || deepAnalysis.nurse_actions.length === 0) && (
                        <div style={{ fontSize: "0.82rem", color: "var(--text-tertiary)", fontStyle: "italic" }}>No specific actions identified</div>
                      )}
                    </div>
                  </div>

                  {/* Risk Summary */}
                  {(deepAnalysis.risk_if_approved || deepAnalysis.risk_if_denied) && (
                    <div style={{ 
                      padding: "16px", borderRadius: "var(--radius-md)",
                      background: "rgba(15,14,12,0.03)", border: "1px solid var(--border-default)"
                    }}>
                      <div style={{ 
                        fontSize: "0.78rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em",
                        color: "var(--text-secondary)", marginBottom: "12px"
                      }}>
                        Risk Assessment
                      </div>
                      {deepAnalysis.risk_if_approved && (
                        <div style={{ display: "flex", gap: "10px", marginBottom: deepAnalysis.risk_if_denied ? "10px" : "0" }}>
                          <span style={{ 
                            padding: "3px 8px", borderRadius: "var(--radius-sm)", flexShrink: 0,
                            background: "rgba(22,163,74,0.1)", color: "var(--success)",
                            fontSize: "0.72rem", fontWeight: 600, height: "fit-content", marginTop: "1px"
                          }}>IF APPROVED</span>
                          <span style={{ fontSize: "0.84rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                            {deepAnalysis.risk_if_approved}
                          </span>
                        </div>
                      )}
                      {deepAnalysis.risk_if_denied && (
                        <div style={{ display: "flex", gap: "10px" }}>
                          <span style={{ 
                            padding: "3px 8px", borderRadius: "var(--radius-sm)", flexShrink: 0,
                            background: "rgba(239,68,68,0.1)", color: "var(--danger)",
                            fontSize: "0.72rem", fontWeight: 600, height: "fit-content", marginTop: "1px"
                          }}>IF DENIED</span>
                          <span style={{ fontSize: "0.84rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                            {deepAnalysis.risk_if_denied}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                /* Fallback when no deep analysis */
                <div style={{ 
                  padding: "20px", borderRadius: "var(--radius-md)",
                  background: "rgba(15,14,12,0.02)", border: "1px dashed var(--border-default)",
                  textAlign: "center"
                }}>
                  <Bot size={28} style={{ color: "var(--text-tertiary)", marginBottom: "10px" }} />
                  <div style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "8px" }}>
                    AI Copilot Observation
                  </div>
                  <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.7, margin: 0 }}>
                    {data.ai_copilot_observation || "No AI analysis is available for this case. Please review the clinical summary and policy match above to make your determination."}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ═══ Card 5: AI Recommendation & Decision (Nurse only, undecided cases) ═══ */}
          {userRole === "NURSE" && c.status !== "DECIDED" && c.status !== "AUDITED" && (
          <div className="card" style={{ padding: "20px", border: "2px solid var(--border-default)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "1rem" }}>Decision</h3>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem", fontWeight: 600, color: "var(--success)" }}>
                AI Confidence: {Math.round((p.overall_confidence || 0) * 100)}%
              </div>
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


    </div>
  );
}
