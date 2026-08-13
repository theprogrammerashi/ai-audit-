"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ShieldCheck, ArrowLeft, XCircle, Lightbulb, Loader2, AlertTriangle,
  CheckCircle, Edit3, Save, Eye, EyeOff, Target, FileText,
  Scale, Clock, Users, ChevronDown, ChevronUp, Shield, BadgeCheck, X
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
  { key: "clinical_accuracy", label: "Clinical Accuracy", weight: 0.40, icon: Target, desc: "Alignment of decision with clinical evidence" },
  { key: "documentation_completeness", label: "Documentation", weight: 0.20, icon: FileText, desc: "Completeness and quality of rationale" },
  { key: "policy_compliance", label: "Policy Compliance", weight: 0.20, icon: Scale, desc: "Adherence to applicable policy criteria" },
  { key: "consistency_score", label: "Consistency", weight: 0.10, icon: Users, desc: "Alignment with peer decision patterns" },
  { key: "timeliness_score", label: "Timeliness", weight: 0.10, icon: Clock, desc: "Review completed within SLA timeframe" },
];

const getSavedRemarkForDimension = (notes: string | null, dimLabel: string) => {
  if (!notes) return null;
  const lines = notes.split("\n");
  for (const line of lines) {
    if (line.includes(dimLabel)) {
      const parts = line.split("| Remark: ");
      if (parts[1]) {
        let remark = parts[1].trim();
        if (remark.startsWith('"') && remark.endsWith('"')) {
          remark = remark.slice(1, -1);
        }
        return remark;
      }
    }
  }
  return null;
};

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
  const [originalScores, setOriginalScores] = useState<Record<string, number>>({});
  const [editRemarks, setEditRemarks] = useState<Record<string, string>>({});
  const [editNotes, setEditNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Finalize (Verify & Complete)
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [verifyNotes, setVerifyNotes] = useState("");
  const [isVerifyingAndCompleting, setIsVerifyingAndCompleting] = useState(false);

  const canOverride = user?.role === "QA_LEAD" || user?.role === "ADMIN" || user?.role === "EXECUTIVE";

  // Auto-calculate weighted total
  const computeTotal = (scores: Record<string, number>) => {
    const raw = DIMENSION_CONFIG.reduce((sum, dim) => sum + (scores[dim.key] || 0) * dim.weight, 0);
    return Number(raw.toFixed(2));
  };

  const editTotal = computeTotal(editScores);

  const startEditing = () => {
    const scores: Record<string, number> = {};
    DIMENSION_CONFIG.forEach(dim => {
      scores[dim.key] = d?.[dim.key] ?? 80;
    });
    setEditScores(scores);
    setOriginalScores(scores);
    setEditRemarks({});
    setEditNotes("");
    setIsEditing(true);
  };

  const handleSaveElementScores = async () => {
    const changedDims = DIMENSION_CONFIG.filter(
      dim => (editScores[dim.key] ?? 80) !== (originalScores[dim.key] ?? 80)
    );
    if (changedDims.length === 0) {
      alert("No scores were modified. Adjust at least one score or cancel.");
      return;
    }

    // Validate that each changed dimension has a remark
    for (const dim of changedDims) {
      const remark = editRemarks[dim.key] || "";
      if (remark.trim().length < 5) {
        alert(`Please provide an adjustment remark for ${dim.label} (min 5 chars).`);
        return;
      }
    }

    // Concatenate into a human-readable list of remarks
    const combinedNotes = changedDims.map(dim => {
      const orig = originalScores[dim.key];
      const updated = editScores[dim.key];
      const remark = editRemarks[dim.key].trim();
      return `• ${dim.label}: ${orig}% → ${updated}% | Remark: "${remark}"`;
    }).join("\n");

    setIsSaving(true);
    try {
      await api.post(`/audit/${caseId}/element-score-override`, {
        ...editScores,
        notes: combinedNotes,
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

  const handleVerifyAndComplete = async () => {
    if (verifyNotes.trim().length < 5) {
      alert("Please provide a QA remark (min 5 characters) for the nurse.");
      return;
    }
    setIsVerifyingAndCompleting(true);
    try {
      // 1. Verify (publishes scores & saves verification remarks)
      await api.post(`/audit/${caseId}/verify`, {
        notes: verifyNotes
      });
      // 2. Complete (closes case)
      await api.post(`/audit/${caseId}/complete`);
      
      setActionSuccess("QA Audit verified, published, and marked as complete.");
      setIsVerifyModalOpen(false);
      fetchAudit();
    } catch (err) {
      console.error("Failed to verify and complete audit:", err);
      alert("Failed to finalize QA audit.");
    } finally {
      setIsVerifyingAndCompleting(false);
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

  const rawScore = d.effective_score || d.qa_score;
  const effectiveScore = typeof rawScore === "number" ? Number(rawScore.toFixed(2)) : rawScore;
  const scoreColor = effectiveScore >= 80 ? "var(--success)" : "var(--danger)";
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
                Case: <strong>{d.case_number || d.case_id}</strong> {d.patient_name && <span>({d.patient_name})</span>}
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
            {(() => {
              const scoreStr = typeof effectiveScore === "number" ? effectiveScore.toString() : String(effectiveScore || "0");
              const scoreParts = scoreStr.split(".");
              const integerPart = scoreParts[0];
              const decimalPart = scoreParts[1] ? `.${scoreParts[1]}` : "";
              return (
                <span style={{ fontSize: "2.5rem", fontWeight: 700, color: scoreColor, lineHeight: 1, display: "inline-flex", alignItems: "baseline" }}>
                  {integerPart}
                  {decimalPart && (
                    <span style={{ fontSize: "1.4rem", fontWeight: 600, color: scoreColor, marginLeft: "1px" }}>
                      {decimalPart}
                    </span>
                  )}
                </span>
              );
            })()}
            <span style={{ fontSize: "0.7rem", color: "var(--text-tertiary)", marginTop: "4px", textTransform: "uppercase", letterSpacing: "1px" }}>QA Score</span>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: "10px", flexWrap: "wrap" }}>
          <span className={`badge ${effectiveScore >= 80 ? "badge-success" : "badge-danger"}`}
            style={{ fontSize: "0.85rem", padding: "6px 18px" }}>
            {effectiveScore >= 80 ? "PASS" : "FAIL"}
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
              <strong style={{ color: "var(--warning)", fontSize: "0.85rem" }}>QA Lead Adjustment Remarks</strong>
            </div>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", margin: 0 }}>
              Original AI Score: <strong>{d.original_ai_score}</strong> → Adjusted Score: <strong>{d.qa_override_score}</strong>
            </p>
            {d.qa_override_notes && (
              <p style={{ fontSize: "0.8rem", color: "var(--text-tertiary)", marginTop: "4px", fontStyle: "italic", whiteSpace: "pre-line" }}>
                {d.qa_override_notes}
              </p>
            )}
          </div>
        )}

        {d.qa_verification_notes && (
          <div style={{
            marginTop: "20px", padding: "14px 20px",
            background: "linear-gradient(135deg, rgba(22,163,74,0.06), rgba(22,163,74,0.02))",
            borderRadius: "var(--radius-md)", border: "1px solid rgba(22,163,74,0.2)", textAlign: "left"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
              <BadgeCheck size={14} style={{ color: "var(--success)" }} />
              <strong style={{ color: "var(--success)", fontSize: "0.85rem" }}>QA Verification Remarks</strong>
            </div>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", margin: 0, fontStyle: "italic" }}>
              "{d.qa_verification_notes}"
            </p>
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
                color: editTotal >= 80 ? "var(--success)" : "var(--danger)"
              }}>{editTotal}%</span>
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          {DIMENSION_CONFIG.map((dim) => {
            const Icon = dim.icon;
            const currentVal = isEditing ? (editScores[dim.key] ?? 80) : (d[dim.key] ?? 0);
            const valColor = currentVal >= 80 ? "var(--success)" : "var(--danger)";
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
                    background: valColor,
                    transition: "width 0.5s ease"
                  }} />
                </div>

                {/* Description on hover */}
                <p style={{ fontSize: "0.72rem", color: "var(--text-tertiary)", marginTop: "8px", lineHeight: 1.3, margin: "8px 0 0" }}>
                  {dim.desc}
                </p>

                {isEditing && (editScores[dim.key] ?? 80) !== (originalScores[dim.key] ?? 80) && (
                  <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "6px" }} onClick={e => e.stopPropagation()}>
                    <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--primary)", display: "flex", alignItems: "center", gap: "4px" }}>
                      <Edit3 size={10} /> Adjustment Remark <span style={{ color: "var(--danger)" }}>*</span>
                    </label>
                    <textarea
                      className="input-field"
                      rows={2}
                      value={editRemarks[dim.key] ?? ""}
                      onChange={(e) => setEditRemarks(prev => ({
                        ...prev,
                        [dim.key]: e.target.value
                      }))}
                      placeholder={`Explain the score change for ${dim.label}...`}
                      style={{ fontSize: "0.78rem", width: "100%", resize: "none", padding: "6px 8px", background: "var(--bg-body)", border: "1px solid var(--border-default)" }}
                    />
                  </div>
                )}

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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
              <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)", fontWeight: 500 }}>
                💡 Provide an adjustment remark inside each modified dimension card.
              </span>
              <div style={{ display: "flex", gap: "12px" }}>
                <button className="btn btn-secondary" onClick={() => setIsEditing(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSaveElementScores} disabled={isSaving}
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  {isSaving ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={14} />}
                  {isSaving ? "Saving..." : "Save Adjustments"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Dimension Detail Modal ──────────────────────────── */}
      {selectedDim && !isEditing && (() => {
        const dimConfig = DIMENSION_CONFIG.find(d => d.key === selectedDim);
        return (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.5)", zIndex: 9999,
            display: "flex", alignItems: "center", justifyContent: "center",
            backdropFilter: "blur(2px)"
          }} onClick={() => setSelectedDim(null)}>
            <div style={{
              background: "var(--bg-surface)", borderRadius: "var(--radius-lg)",
              width: "90%", maxWidth: "600px", display: "flex", flexDirection: "column",
              boxShadow: "var(--shadow-xl)", overflow: "hidden"
            }} onClick={(e) => e.stopPropagation()}>
              <div style={{
                padding: "16px 20px", borderBottom: "1px solid var(--border-default)",
                display: "flex", justifyContent: "space-between", alignItems: "center"
              }}>
                <span style={{ fontWeight: 600, fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "8px", color: "var(--primary)" }}>
                  <Lightbulb size={18} /> {dimConfig?.label} — Detailed Analysis
                </span>
                <button onClick={() => setSelectedDim(null)} style={{
                  background: "none", border: "none", cursor: "pointer", padding: "4px",
                  color: "var(--text-tertiary)", borderRadius: "var(--radius-sm)"
                }}>
                  <X size={20} />
                </button>
              </div>
              <div style={{ padding: "24px", overflowY: "auto", maxHeight: "70vh", fontSize: "0.88rem", lineHeight: 1.6, color: "var(--text-secondary)" }}>
                {(() => {
                  const score = d[selectedDim] ?? 0;
                  const label = dimConfig?.label || "";
                  const weightPct = Math.round((dimConfig?.weight || 0) * 100);
                  const valColor = score >= 80 ? "var(--success)" : "var(--danger)";

                  // Filter findings for this dimension
                  const dimFindings = (d.findings || []).filter((f: any) => {
                    const type = f.type || "";
                    const desc = (f.description || "").toLowerCase();
                    if (selectedDim === "clinical_accuracy") {
                      return type === "POLICY_MISMATCH" || type === "CLINICAL_MISS";
                    }
                    if (selectedDim === "documentation_completeness") {
                      return type === "DOCUMENTATION_GAP" && !desc.includes("policy code");
                    }
                    if (selectedDim === "policy_compliance") {
                      return type === "DOCUMENTATION_GAP" && desc.includes("policy code");
                    }
                    if (selectedDim === "consistency_score") {
                      return type === "CONSISTENCY_FLAG";
                    }
                    if (selectedDim === "timeliness_score") {
                      return type === "SLA_BREACH";
                    }
                    return false;
                  });

                  let aiRationale = "";
                  let remark = "";

                  if (selectedDim === "clinical_accuracy") {
                    if (score >= 90) {
                      aiRationale = `The clinical accuracy score of ${score}% indicates that the reviewer's decision fully aligns with the medical necessity criteria and clinical evidence extracted by the AI engine. All core clinical indicators were properly interpreted.`;
                      remark = "Excellent clinical alignment. No adjustments or corrections are required for this case. Maintain this standard of clinical decision-making.";
                    } else if (score >= 70) {
                      aiRationale = `The clinical accuracy score of ${score}% reflects minor discrepancies in matching clinical criteria. While the overall decision aligns, some secondary clinical guidelines were not fully met or documented in detail.`;
                      remark = "Ensure all minor clinical criteria are verified. While the core decision is supported, double-checking secondary criteria will prevent prospective denial risks.";
                    } else {
                      const policyMismatch = dimFindings.find((f: any) => f.type === "POLICY_MISMATCH");
                      const recRecommended = policyMismatch?.description?.includes("recommended DENIED") ? "DENIED" : "APPROVED";
                      const reviewerDecision = policyMismatch?.description?.includes("Reviewer DENIED") ? "DENIED" : "APPROVED";
                      aiRationale = `The clinical accuracy score of ${score}% is low because of a critical policy mismatch: the AI recommended ${recRecommended} based on the policy criteria, but the reviewer chose ${reviewerDecision}. Only a low portion of the required admission guidelines were fulfilled.`;
                      remark = "CRITICAL ACTION REQUIRED: Re-examine the clinical evidence against the policy criteria. A mismatch of this severity indicates a high likelihood of wrongful determination, which could lead to audit failure or immediate provider appeals.";
                    }
                  } else if (selectedDim === "documentation_completeness") {
                    if (score >= 90) {
                      aiRationale = `The documentation score of ${score}% indicates a highly detailed, structured rationale. The clinical narrative exceeds length requirements, references all key lab/vital parameters, and cites relevant guidelines clearly.`;
                      remark = "Superb clinical documentation. The thorough description and specific clinical facts make this audit-proof. Continue using this structure.";
                    } else if (score >= 70) {
                      const gaps = dimFindings.map((f: any) => f.description).join("; ");
                      aiRationale = `The documentation score of ${score}% shows that while the rationale is sufficient to understand the decision, some details are missing. ${gaps ? "Specifically: " + gaps : "There is a minor lack of detail in lab references or rationale length."}`;
                      remark = "Consider adding specific lab/vital values (e.g., BNP, O2 sat, lactate) to the rationale to strengthen the documentation completeness.";
                    } else {
                      aiRationale = `The documentation score of ${score}% is critically low. The clinical rationale is either extremely brief (under 15 words) or completely lacks key medical parameters and evidence justifying the decision.`;
                      remark = "IMMEDIATE RE-WRITE REQUIRED: Expand the clinical rationale to at least 30 words. You must explicitly reference patient vitals, lab values, and clinical history that justify your decision.";
                    }
                  } else if (selectedDim === "policy_compliance") {
                    if (score >= 90) {
                      aiRationale = `The policy compliance score of ${score}% confirms that the clinical rationale directly cites the correct medical policy and references applicable criteria sections.`;
                      remark = "Full compliance achieved. Citations are accurate and appropriately matched to the patient's condition. Keep referencing policy codes on all cases.";
                    } else if (score >= 70) {
                      aiRationale = `The policy compliance score of ${score}% indicates that the policy guidelines were followed, but the specific policy code or section was not clearly cited in the rationale text.`;
                      remark = "Make sure to explicitly write the policy ID and code name in the rationale. This ensures that the final letter clearly points to the audited guidelines.";
                    } else {
                      aiRationale = `The policy compliance score of ${score}% is low because there is no reference to the applicable policy code or guidelines in the rationale, representing a significant compliance risk.`;
                      remark = "ACTION REQUIRED: Locate and cite the appropriate policy code (e.g., UM-GEN-001 or equivalent) within the clinical narrative. Audit standards require explicit citation of policy guidelines.";
                    }
                  } else if (selectedDim === "consistency_score") {
                    if (score >= 90) {
                      aiRationale = `The consistency score of ${score}% shows this case's outcome aligns perfectly with historical patterns and decisions made by peer reviewers for similar diagnoses.`;
                      remark = "Great consistency. This decision follows established institutional guidelines and consensus, reducing the risk of clinical variance.";
                    } else if (score >= 70) {
                      aiRationale = `The consistency score of ${score}% indicates a slight deviation from typical peer patterns, which might be justified by unique clinical parameters in this patient's presentation.`;
                      remark = "No immediate action required, but review the case details during team syncs to ensure we maintain unified decision-making.";
                    } else {
                      aiRationale = `The consistency score of ${score}% is low. This decision is highly anomalous compared to peer data and historical determinations for similar diagnoses, presenting an appeal risk.`;
                      remark = "RECOMMENDATION: Request a peer calibration review. Discuss this case with the QA Lead or senior clinical staff to resolve the reasoning mismatch.";
                    }
                  } else if (selectedDim === "timeliness_score") {
                    if (score >= 90) {
                      aiRationale = `The timeliness score of ${score}% confirms the review was completed well within the 24-hour SLA window, demonstrating excellent efficiency.`;
                      remark = "Excellent turnaround time. Quick case processing helps maintain operational metrics and meets clinical timelines.";
                    } else if (score >= 70) {
                      aiRationale = `The timeliness score of ${score}% indicates that the review exceeded the 24-hour warning threshold or 48-hour SLA, which can delay patient care decisions.`;
                      remark = "Identify and document any operational bottlenecks or clinical delays that caused the turnaround time to slip beyond 24/48 hours.";
                    } else {
                      aiRationale = `The timeliness score of ${score}% indicates a severe SLA breach (turnaround time exceeded 72 hours). This is a critical operational failure.`;
                      remark = "URGENT: Review the process bottleneck immediately. Investigate why this case was delayed, and put corrective actions in place.";
                    }
                  }

                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                      {/* Dimension Header Summary Card */}
                      <div style={{
                        padding: "16px 20px",
                        background: "linear-gradient(135deg, var(--bg-surface), rgba(0,0,0,0.02))",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-default)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px"
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>{label}</span>
                            <span style={{ display: "block", fontSize: "0.75rem", color: "var(--text-tertiary)", marginTop: "2px" }}>
                              Weight contribution: {weightPct}% of overall QA score
                            </span>
                          </div>
                          <span style={{ fontSize: "1.8rem", fontWeight: 800, color: valColor }}>{score}%</span>
                        </div>
                        
                        {/* Progress Bar inside Popup */}
                        <div style={{ height: "8px", background: "var(--border-default)", borderRadius: "4px", overflow: "hidden" }}>
                          <div style={{
                            height: "100%", width: `${score}%`, borderRadius: "4px",
                            background: valColor,
                            transition: "width 0.5s ease"
                          }} />
                        </div>
                      </div>

                      {/* AI Rationale Card */}
                      <div style={{
                        padding: "16px",
                        background: "linear-gradient(135deg, rgba(232,82,26,0.05), rgba(232,82,26,0.01))",
                        borderRadius: "var(--radius-md)",
                        borderLeft: "4px solid var(--primary)",
                        borderTop: "1px solid var(--border-default)",
                        borderRight: "1px solid var(--border-default)",
                        borderBottom: "1px solid var(--border-default)"
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                          <Lightbulb size={16} style={{ color: "var(--primary)" }} />
                          <strong style={{ color: "var(--primary)", fontSize: "0.85rem" }}>AI Score Rationale</strong>
                        </div>
                        <p style={{ margin: 0, fontSize: "0.85rem", lineHeight: 1.5, color: "var(--text-secondary)" }}>
                          {aiRationale}
                        </p>
                      </div>

                      {/* Auditor Saved Custom Remark Card (Only shown if a custom remark exists for this dimension) */}
                      {(() => {
                        const savedRemark = getSavedRemarkForDimension(d.qa_override_notes, label);
                        if (!savedRemark) return null;
                        return (
                          <div style={{
                            padding: "16px",
                            background: "linear-gradient(135deg, rgba(217,119,6,0.05), rgba(217,119,6,0.01))",
                            borderRadius: "var(--radius-md)",
                            borderLeft: "4px solid var(--warning)",
                            borderTop: "1px solid var(--border-default)",
                            borderRight: "1px solid var(--border-default)",
                            borderBottom: "1px solid var(--border-default)"
                          }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                              <Edit3 size={16} style={{ color: "var(--warning)" }} />
                              <strong style={{ color: "var(--warning)", fontSize: "0.85rem" }}>
                                QA Lead Adjustment Remark
                              </strong>
                            </div>
                            <p style={{ margin: 0, fontSize: "0.85rem", lineHeight: 1.5, color: "var(--text-secondary)" }}>
                              {savedRemark}
                            </p>
                          </div>
                        );
                      })()}

                      {/* Findings Section */}
                      {dimFindings.length > 0 && (
                        <div style={{
                          background: "rgba(239, 68, 68, 0.04)",
                          padding: "14px", borderRadius: "var(--radius-md)", border: "1px solid rgba(239, 68, 68, 0.15)"
                        }}>
                          <strong style={{ color: "var(--danger)", fontSize: "0.82rem", display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                            <AlertTriangle size={14} /> Audit Gaps & Findings ({dimFindings.length})
                          </strong>
                          <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "0.82rem", color: "var(--text-secondary)", listStyleType: "disc" }}>
                            {dimFindings.map((f: any, i: number) => (
                              <li key={i} style={{ marginBottom: "6px" }}>
                                {f.description}
                                {f.recommendation && (
                                  <div style={{ color: "var(--primary)", marginTop: "2px", fontStyle: "italic" }}>
                                    💡 Recommendation: {f.recommendation}
                                  </div>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Missing Evidence Section */}
                      {selectedDim === "documentation_completeness" && d.missing_evidence && d.missing_evidence.length > 0 && (
                        <div style={{
                          background: "linear-gradient(135deg, rgba(220,38,38,0.06), rgba(220,38,38,0.02))",
                          padding: "14px", borderRadius: "var(--radius-md)", border: "1px solid rgba(220,38,38,0.15)"
                        }}>
                          <strong style={{ color: "var(--danger)", fontSize: "0.82rem", display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                            <XCircle size={14} /> Missing Clinical Evidence
                          </strong>
                          <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "0.82rem", color: "var(--text-secondary)", listStyleType: "disc" }}>
                            {d.missing_evidence.map((e: string, i: number) => <li key={i} style={{ marginBottom: "4px" }}>{e}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        );
      })()}



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
          <button className="btn btn-primary" onClick={() => setIsVerifyModalOpen(true)}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <BadgeCheck size={14} /> Verify & Publish Scores
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

      {/* ── Verify & Publish Modal ───────────────────────────────────── */}
      {isVerifyModalOpen && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.5)", zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center",
          backdropFilter: "blur(2px)"
        }}>
          <div className="card" style={{ padding: "24px", width: "90%", maxWidth: "500px" }}>
            <h3 style={{ marginTop: 0, marginBottom: "16px", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
              <BadgeCheck size={20} style={{ color: "var(--primary)" }} /> Finalize QA Audit
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "16px" }}>
              Verifying will publish the final scores to the nurse and officially close this case from the QA pipeline. Please provide any final remarks for the nurse below.
            </p>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "8px", color: "var(--text-primary)" }}>
              QA Remarks <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <textarea
              className="input-field"
              rows={4}
              value={verifyNotes}
              onChange={e => setVerifyNotes(e.target.value)}
              placeholder="Great job on this complex case, but remember to cite the specific policy guideline..."
              style={{ width: "100%", resize: "vertical" }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "24px" }}>
              <button className="btn btn-secondary" onClick={() => setIsVerifyModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleVerifyAndComplete} disabled={isVerifyingAndCompleting}
                style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                {isVerifyingAndCompleting ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <BadgeCheck size={14} />}
                {isVerifyingAndCompleting ? "Publishing..." : "Publish & Complete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
