"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ShieldCheck, ArrowLeft, XCircle, Lightbulb, Loader2, AlertTriangle,
  CheckCircle, Edit3, Save, Eye, EyeOff, Target, FileText,
  Scale, Clock, Users, ChevronDown, ChevronUp, Shield, BadgeCheck
} from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import PeerReviewModal from "@/components/shared/PeerReviewModal";

const severityColors: Record<string, string> = {
  CRITICAL: "badge-danger", HIGH: "badge-warning", MEDIUM: "badge-info", LOW: "badge-success"
};
const severityIcons: Record<string, any> = {
  CRITICAL: AlertTriangle, HIGH: AlertTriangle, MEDIUM: Target, LOW: CheckCircle
};

const DIMENSION_CONFIG = [
  { key: "clinical_accuracy", label: "Clinical Accuracy", weight: 0.30, icon: Target, desc: "Alignment of decision with clinical evidence" },
  { key: "documentation_completeness", label: "Documentation", weight: 0.25, icon: FileText, desc: "Completeness and quality of rationale" },
  { key: "policy_compliance", label: "Policy Compliance", weight: 0.25, icon: Scale, desc: "Adherence to applicable policy criteria" },
  { key: "consistency_score", label: "Consistency", weight: 0.10, icon: Users, desc: "Alignment with peer decision patterns" },
  { key: "timeliness_score", label: "Timeliness", weight: 0.10, icon: Clock, desc: "Review completed within SLA timeframe" },
];

export default function AuditDetailPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params.id as string;
  const { user } = useAuthStore();

  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isPeerReviewOpen, setIsPeerReviewOpen] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [selectedDim, setSelectedDim] = useState<string | null>(null);

  // Element-level editing
  const [isEditing, setIsEditing] = useState(false);
  const [editScores, setEditScores] = useState<Record<string, number>>({});
  const [editNotes, setEditNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const canOverride = user?.role === "QA_LEAD" || user?.role === "ADMIN" || user?.role === "EXECUTIVE";

  // Auto-calculate weighted total
  const computeTotal = (scores: Record<string, number>) => {
    return Math.round(
      DIMENSION_CONFIG.reduce((sum, dim) => sum + (scores[dim.key] || 0) * dim.weight, 0)
    );
  };

  const editTotal = computeTotal(editScores);

  const startEditing = () => {
    const scores: Record<string, number> = {};
    DIMENSION_CONFIG.forEach(dim => {
      scores[dim.key] = d?.[dim.key] ?? 80;
    });
    setEditScores(scores);
    setEditNotes("");
    setIsEditing(true);
  };

  const handleSaveElementScores = async () => {
    if (editNotes.trim().length < 10) {
      alert("Please provide notes explaining your score adjustments (min 10 chars).");
      return;
    }
    setIsSaving(true);
    try {
      await api.post(`/audit/${caseId}/element-score-override`, {
        ...editScores,
        notes: editNotes,
      });
      setIsEditing(false);
      setActionSuccess("Element-level scores updated and verified successfully.");
      fetchAudit();
    } catch (err) {
      console.error("Failed to save element scores:", err);
      alert("Failed to save scores. Ensure you have QA Lead permissions.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      await api.post(`/audit/${caseId}/verify`);
      setActionSuccess("QA audit verified — scores are now visible to the nurse.");
      fetchAudit();
    } catch (err) {
      console.error("Failed to verify:", err);
      alert("Failed to verify audit.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleMarkComplete = async () => {
    try {
      await api.post(`/audit/${caseId}/complete`);
      setActionSuccess("QA Audit marked as complete.");
      fetchAudit();
    } catch (err) {
      console.error("Failed to complete audit:", err);
      alert("Failed to complete QA audit.");
    }
  };

  const fetchAudit = async () => {
    try {
      const res = await api.get(`/audit/${caseId}`);
      setD(res.data);
    } catch (err) {
      console.error("Failed to fetch audit data:", err);
      setError("Failed to load audit report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (caseId) fetchAudit();
  }, [caseId]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", flexDirection: "column", gap: "16px" }}>
        <Loader2 size={32} style={{ animation: "spin 1s linear infinite", color: "var(--primary)" }} />
        <p style={{ color: "var(--text-secondary)" }}>Loading QA audit report...</p>
      </div>
    );
  }

  if (error || !d) {
    return (
      <div style={{ padding: "32px", textAlign: "center", color: "var(--danger)" }}>
        <AlertTriangle size={32} style={{ margin: "0 auto 16px" }} />
        <h2>{error || "Audit Report Not Found"}</h2>
        <button className="btn btn-secondary" style={{ marginTop: "16px" }} onClick={() => router.push("/audit")}>
          <ArrowLeft size={16} /> Back to Audits
        </button>
      </div>
    );
  }

  const effectiveScore = d.effective_score || d.qa_score;
  const scoreColor = effectiveScore >= 90 ? "var(--success)" : effectiveScore >= 75 ? "var(--warning)" : "var(--danger)";
  const isVerified = d.qa_verified === true;

  return (
    <div className="animate-fade-in" style={{ padding: "32px", maxWidth: "1100px" }}>
      {/* ── Header ────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <button onClick={() => router.push("/audit")} className="btn btn-secondary" style={{ padding: "8px 12px" }}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="page-header" style={{ display: "flex", alignItems: "center", gap: "10px", margin: 0 }}>
              <ShieldCheck size={28} /> QA Audit Report
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "6px" }}>
              <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                Case ID: <strong>{d.case_id}</strong>
              </span>
              <span className={`badge ${effectiveScore >= 80 ? "badge-success" : "badge-danger"}`}>
                {effectiveScore >= 80 ? "PASS" : "FAIL"}
              </span>
              {isVerified ? (
                <span className="badge badge-success" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <BadgeCheck size={12} /> QA Verified
                </span>
              ) : (
                <span className="badge badge-warning" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <EyeOff size={12} /> Pending Verification
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Success Banner ────────────────────────────────────── */}
      {actionSuccess && (
        <div style={{
          marginBottom: "20px", padding: "14px 20px",
          background: "linear-gradient(135deg, rgba(22,163,74,0.08), rgba(22,163,74,0.03))",
          borderRadius: "var(--radius-md)", border: "1px solid rgba(22,163,74,0.25)",
          display: "flex", alignItems: "center", gap: "10px", color: "var(--success)"
        }}>
          <CheckCircle size={18} />
          <span style={{ fontWeight: 500, fontSize: "0.9rem" }}>{actionSuccess}</span>
          <button style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)" }}
            onClick={() => setActionSuccess(null)}><XCircle size={16} /></button>
        </div>
      )}

      {/* ── QA Score Gauge ────────────────────────────────────── */}
      <div className="card" style={{
        padding: "32px", marginBottom: "24px", textAlign: "center", position: "relative",
        background: "linear-gradient(180deg, var(--bg-surface), rgba(232,82,26,0.02))"
      }}>
        {canOverride && !isEditing && (
          <button className="btn btn-secondary" style={{ position: "absolute", top: 16, right: 16, display: "flex", alignItems: "center", gap: "6px" }}
            onClick={startEditing}>
            <Edit3 size={14} /> Edit Scores
          </button>
        )}

        <div style={{
          position: "relative", width: "160px", height: "160px", margin: "0 auto 20px", borderRadius: "50%",
          background: `conic-gradient(${scoreColor} ${effectiveScore * 3.6}deg, var(--border-default) 0)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 0 30px ${scoreColor}22`
        }}>
          <div style={{
            width: "126px", height: "126px", borderRadius: "50%", background: "var(--bg-surface)",
            display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column"
          }}>
            <span style={{ fontSize: "2.5rem", fontWeight: 700, color: scoreColor, lineHeight: 1 }}>{effectiveScore}</span>
            <span style={{ fontSize: "0.7rem", color: "var(--text-tertiary)", marginTop: "4px", textTransform: "uppercase", letterSpacing: "1px" }}>QA Score</span>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: "10px", flexWrap: "wrap" }}>
          <span className={`badge ${d.risk_level === "CRITICAL" ? "badge-danger" : d.risk_level === "HIGH" ? "badge-warning" : d.risk_level === "MEDIUM" ? "badge-info" : "badge-success"}`}
            style={{ fontSize: "0.85rem", padding: "6px 18px" }}>
            <Shield size={12} style={{ marginRight: "4px" }} /> {d.risk_level} Risk
          </span>
          <span className={`badge ${d.audit_result === "PASS" ? "badge-success" : "badge-danger"}`}
            style={{ fontSize: "0.85rem", padding: "6px 18px" }}>
            {d.audit_result}
          </span>
        </div>

        {d.original_ai_score != null && d.qa_override_score != null && d.original_ai_score !== d.qa_override_score && (
          <div style={{
            marginTop: "20px", padding: "14px 20px",
            background: "linear-gradient(135deg, rgba(217,119,6,0.06), rgba(217,119,6,0.02))",
            borderRadius: "var(--radius-md)", border: "1px solid rgba(217,119,6,0.2)", textAlign: "left"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
              <Edit3 size={14} style={{ color: "var(--warning)" }} />
              <strong style={{ color: "var(--warning)", fontSize: "0.85rem" }}>QA Lead Override</strong>
            </div>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", margin: 0 }}>
              Original AI Score: <strong>{d.original_ai_score}</strong> → Adjusted Score: <strong>{d.qa_override_score}</strong>
            </p>
            {d.qa_override_notes && (
              <p style={{ fontSize: "0.8rem", color: "var(--text-tertiary)", marginTop: "4px", fontStyle: "italic" }}>
                {d.qa_override_notes}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── AI Explanation ─────────────────────────────────────── */}
      {d.qa_ai_explanation && (
        <div className="card" style={{
          padding: "20px", marginBottom: "24px", borderLeft: "4px solid var(--primary)",
          background: "linear-gradient(135deg, rgba(232,82,26,0.04), rgba(232,82,26,0.01))"
        }}>
          <h3 style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", color: "var(--primary)", fontSize: "0.95rem" }}>
            <Lightbulb size={18} /> AI Score Rationale
          </h3>
          <p style={{ fontSize: "0.9rem", lineHeight: 1.7, color: "var(--text-secondary)", margin: 0 }}>
            {d.qa_ai_explanation}
          </p>
        </div>
      )}

      {/* ── Dimension Scores (View or Edit) ────────────────────── */}
      <div style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <h3 style={{ margin: 0, fontSize: "1rem", display: "flex", alignItems: "center", gap: "8px" }}>
            <Target size={18} style={{ color: "var(--primary)" }} /> Dimension Scores
          </h3>
          {isEditing && (
            <div style={{
              display: "flex", alignItems: "center", gap: "12px", padding: "8px 16px",
              background: "linear-gradient(135deg, rgba(232,82,26,0.08), rgba(232,82,26,0.03))",
              borderRadius: "var(--radius-md)", border: "1px solid rgba(232,82,26,0.2)"
            }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Auto-calculated Total:</span>
              <span style={{
                fontSize: "1.4rem", fontWeight: 700,
                color: editTotal >= 90 ? "var(--success)" : editTotal >= 75 ? "var(--warning)" : "var(--danger)"
              }}>{editTotal}%</span>
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          {DIMENSION_CONFIG.map((dim) => {
            const Icon = dim.icon;
            const currentVal = isEditing ? (editScores[dim.key] ?? 80) : (d[dim.key] ?? 0);
            const valColor = currentVal >= 90 ? "var(--success)" : currentVal >= 75 ? "var(--warning)" : "var(--danger)";
            const isSelected = selectedDim === dim.key;

            return (
              <div key={dim.key} className="card" style={{
                padding: "18px", cursor: isEditing ? "default" : "pointer",
                border: isSelected && !isEditing ? "2px solid var(--primary)" : "1px solid var(--border-default)",
                transition: "all 0.2s ease",
              }}
                onClick={() => !isEditing && setSelectedDim(isSelected ? null : dim.key)}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{
                      width: "32px", height: "32px", borderRadius: "8px",
                      background: `${valColor}15`, display: "flex", alignItems: "center", justifyContent: "center"
                    }}>
                      <Icon size={16} style={{ color: valColor }} />
                    </div>
                    <div>
                      <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)" }}>{dim.label}</span>
                      <span style={{ display: "block", fontSize: "0.7rem", color: "var(--text-tertiary)" }}>
                        Weight: {Math.round(dim.weight * 100)}%
                      </span>
                    </div>
                  </div>

                  {isEditing ? (
                    <input
                      type="number" min="0" max="100"
                      value={editScores[dim.key] ?? 80}
                      onChange={(e) => setEditScores(prev => ({
                        ...prev,
                        [dim.key]: Math.min(100, Math.max(0, parseInt(e.target.value) || 0))
                      }))}
                      style={{
                        width: "68px", padding: "6px 10px", borderRadius: "var(--radius-sm)",
                        border: "2px solid var(--primary)", fontSize: "1.1rem", fontWeight: 700,
                        textAlign: "center", color: valColor, background: "var(--bg-surface)"
                      }}
                    />
                  ) : (
                    <span style={{ fontSize: "1.3rem", fontWeight: 700, color: valColor }}>{currentVal}%</span>
                  )}
                </div>

                {/* Progress Bar */}
                <div style={{ height: "6px", background: "var(--border-default)", borderRadius: "3px", overflow: "hidden" }}>
                  <div style={{
                    height: "100%", width: `${currentVal}%`, borderRadius: "3px",
                    background: `linear-gradient(90deg, ${valColor}, ${valColor}cc)`,
                    transition: "width 0.5s ease"
                  }} />
                </div>

                {/* Description on hover */}
                <p style={{ fontSize: "0.72rem", color: "var(--text-tertiary)", marginTop: "8px", lineHeight: 1.3, margin: "8px 0 0" }}>
                  {dim.desc}
                </p>

                {!isEditing && !isSelected && (
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "4px" }}>
                    <ChevronDown size={12} style={{ color: "var(--text-tertiary)" }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Editing: Notes + Save */}
        {isEditing && (
          <div className="card" style={{ padding: "20px", marginTop: "16px", border: "2px solid var(--primary)", background: "rgba(232,82,26,0.02)" }}>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "8px", color: "var(--text-primary)" }}>
              Override Notes <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <textarea
              className="input-field"
              rows={3}
              value={editNotes}
              onChange={e => setEditNotes(e.target.value)}
              placeholder="Explain the reason for your score adjustments (min 10 characters)..."
              style={{ width: "100%", resize: "vertical" }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "16px" }}>
              <button className="btn btn-secondary" onClick={() => setIsEditing(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveElementScores} disabled={isSaving}
                style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                {isSaving ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={14} />}
                {isSaving ? "Saving..." : "Save & Verify"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Dimension Detail (Expand) ──────────────────────────── */}
      {selectedDim && !isEditing && (() => {
        const dimConfig = DIMENSION_CONFIG.find(d => d.key === selectedDim);
        return (
          <div className="card" style={{
            padding: "20px", marginBottom: "24px", borderLeft: "4px solid var(--primary)",
            background: "linear-gradient(135deg, var(--bg-surface), rgba(232,82,26,0.02))"
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <h3 style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--primary)", fontSize: "0.95rem", margin: 0 }}>
                <Lightbulb size={18} /> {dimConfig?.label} — Detailed Analysis
              </h3>
              <button onClick={() => setSelectedDim(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)" }}>
                <ChevronUp size={16} />
              </button>
            </div>
            <p style={{ fontSize: "0.9rem", lineHeight: 1.7, color: "var(--text-secondary)", marginBottom: "16px" }}>
              {selectedDim === "timeliness_score"
                ? (d.timeliness_explanation || "The review was completed within the expected SLA timeframe. Timeliness is measured from case assignment to final decision submission.")
                : `Analysis for ${dimConfig?.label} based on the submitted rationale, clinical evidence, and policy criteria. Score: ${d[selectedDim] ?? 'N/A'}%. Weight contribution: ${Math.round((dimConfig?.weight || 0) * 100)}% of total.`}
            </p>
            {d.missing_evidence && d.missing_evidence.length > 0 && (
              <div style={{
                background: "linear-gradient(135deg, rgba(220,38,38,0.06), rgba(220,38,38,0.02))",
                padding: "14px", borderRadius: "var(--radius-md)", border: "1px solid rgba(220,38,38,0.15)"
              }}>
                <strong style={{ color: "var(--danger)", fontSize: "0.82rem", display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                  <XCircle size={14} /> Missing Evidence
                </strong>
                <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                  {d.missing_evidence.map((e: string, i: number) => <li key={i} style={{ marginBottom: "4px" }}>{e}</li>)}
                </ul>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Audit Findings ─────────────────────────────────────── */}
      {d.findings && d.findings.length > 0 && (
        <div style={{ marginBottom: "24px" }}>
          <h3 style={{ marginBottom: "14px", fontSize: "1rem", display: "flex", alignItems: "center", gap: "8px" }}>
            <AlertTriangle size={18} style={{ color: "var(--warning)" }} /> Audit Findings
            <span className="badge badge-info" style={{ marginLeft: "4px" }}>{d.findings.length}</span>
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {d.findings.map((f: any, i: number) => {
              const SevIcon = severityIcons[f.severity] || Target;
              const borderColor = f.severity === "CRITICAL" ? "var(--danger)" : f.severity === "HIGH" ? "var(--warning)" : "var(--info)";
              return (
                <div key={i} className="card" style={{
                  padding: "18px", borderLeft: `4px solid ${borderColor}`,
                  transition: "all 0.2s ease"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                    <SevIcon size={16} style={{ color: borderColor }} />
                    <span className={`badge ${severityColors[f.severity] || "badge-info"}`}>{f.severity}</span>
                    <span style={{ fontSize: "0.78rem", color: "var(--text-tertiary)", background: "var(--bg-hover)", padding: "2px 10px", borderRadius: "var(--radius-sm)" }}>
                      {f.type?.replace(/_/g, " ") || "Finding"}
                    </span>
                  </div>
                  <p style={{ fontSize: "0.88rem", marginBottom: "8px", color: "var(--text-primary)", lineHeight: 1.5 }}>{f.description}</p>
                  {f.recommendation && (
                    <p style={{
                      fontSize: "0.82rem", color: "var(--primary)", fontWeight: 500,
                      display: "flex", alignItems: "flex-start", gap: "6px",
                      padding: "10px 14px", borderRadius: "var(--radius-sm)",
                      background: "rgba(232,82,26,0.04)", margin: 0
                    }}>
                      <Lightbulb size={14} style={{ marginTop: "2px", flexShrink: 0 }} /> {f.recommendation}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Missing Evidence ────────────────────────────────────── */}
      {d.missing_evidence && d.missing_evidence.length > 0 && !selectedDim && (
        <div style={{ marginBottom: "24px" }}>
          <h3 style={{ marginBottom: "14px", fontSize: "1rem", display: "flex", alignItems: "center", gap: "8px" }}>
            <XCircle size={18} style={{ color: "var(--danger)" }} /> Missing Evidence
          </h3>
          <div className="card" style={{ padding: "18px" }}>
            {d.missing_evidence.map((e: string, i: number) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: "10px", padding: "10px 0",
                borderBottom: i < d.missing_evidence.length - 1 ? "1px solid var(--border-default)" : "none"
              }}>
                <div style={{
                  width: "24px", height: "24px", borderRadius: "6px", flexShrink: 0,
                  background: "rgba(220,38,38,0.08)", display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  <XCircle size={12} style={{ color: "var(--danger)" }} />
                </div>
                <span style={{ fontSize: "0.88rem", color: "var(--text-secondary)" }}>{e}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Action Buttons ─────────────────────────────────────── */}
      <div style={{
        display: "flex", gap: "12px", marginTop: "32px", padding: "20px",
        background: "var(--bg-surface)", borderRadius: "var(--radius-md)",
        border: "1px solid var(--border-default)", flexWrap: "wrap"
      }}>
        <button className="btn btn-secondary" onClick={() => setIsPeerReviewOpen(true)}
          style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Users size={14} /> Request Peer Review
        </button>
        {canOverride && !isVerified && (
          <button className="btn btn-primary" onClick={handleVerify} disabled={isVerifying}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {isVerifying ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Eye size={14} />}
            {isVerifying ? "Verifying..." : "Verify & Publish Scores"}
          </button>
        )}
        {canOverride && d.case_status === "DECIDED" && (
          <button className="btn btn-secondary" onClick={handleMarkComplete}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <CheckCircle size={14} /> Mark QA Complete
          </button>
        )}
        {isVerified && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "auto", color: "var(--success)", fontSize: "0.85rem", fontWeight: 500 }}>
            <BadgeCheck size={16} /> Scores published to nurse dashboard
          </div>
        )}
      </div>

      {/* ── Peer Review Modal ───────────────────────────────────── */}
      <PeerReviewModal
        isOpen={isPeerReviewOpen}
        caseId={caseId}
        onClose={() => setIsPeerReviewOpen(false)}
        onSuccess={(msg) => setActionSuccess(msg)}
      />
    </div>
  );
}
