"use client";

import { useState } from "react";
import { X, ShieldAlert, Loader2, Send } from "lucide-react";
import api from "@/lib/api";

interface OverrideModalProps {
  isOpen: boolean;
  caseId: string;
  finding: { description: string; severity: string; index: number } | null;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export default function OverrideModal({ isOpen, caseId, finding, onClose, onSuccess }: OverrideModalProps) {
  const [rationale, setRationale] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !finding) return null;

  const handleSubmit = async () => {
    if (!rationale.trim()) return;
    setIsSubmitting(true);
    try {
      await api.post(`/audit/${caseId}/override`, {
        finding_index: finding.index,
        original_finding: finding.description,
        rationale,
      });
      onSuccess("Override request submitted for review.");
      setRationale("");
      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to submit override");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
      background: "rgba(0, 0, 0, 0.5)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center",
      backdropFilter: "blur(2px)"
    }}>
      <div className="card" style={{ width: "100%", maxWidth: "500px", background: "var(--bg-body)", padding: "24px", position: "relative" }}>
        <button onClick={onClose} style={{ position: "absolute", top: "16px", right: "16px", background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)" }}>
          <X size={20} />
        </button>

        <h3 style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
          <ShieldAlert size={20} style={{ color: "var(--warning)" }} /> Override Finding
        </h3>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: "16px" }}>
          Provide your rationale for overriding this audit finding. This will be reviewed by a supervisor.
        </p>

        <div style={{ padding: "12px", background: "var(--bg-body)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", marginBottom: "16px", borderLeft: "3px solid var(--warning)" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "4px" }}>Original Finding ({finding.severity})</div>
          <p style={{ fontSize: "0.85rem" }}>{finding.description}</p>
        </div>

        <div style={{ marginBottom: "24px" }}>
          <label className="label" style={{ display: "block", marginBottom: "6px" }}>Override Rationale (Required)</label>
          <textarea
            className="input"
            rows={4}
            placeholder="E.g., Lab values were documented in the ED note addendum which was not available during the initial audit..."
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            style={{ width: "100%", resize: "none" }}
            autoFocus
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>Cancel</button>
          <button
            className="btn btn-warning"
            onClick={handleSubmit}
            disabled={!rationale.trim() || isSubmitting}
            style={{ gap: "6px" }}
          >
            {isSubmitting ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Submitting...</> : <><Send size={16} /> Submit Override</>}
          </button>
        </div>
      </div>
    </div>
  );
}
