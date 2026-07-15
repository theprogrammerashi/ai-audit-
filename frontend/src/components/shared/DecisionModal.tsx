import { useState, useEffect } from "react";
import { X, Send, Loader2, CheckCircle, XCircle } from "lucide-react";

interface DecisionModalProps {
  isOpen: boolean;
  decision: "APPROVED" | "DENIED" | null;
  onClose: () => void;
  onSubmit: (decision: string, rationale: string) => Promise<void>;
  isSubmitting: boolean;
}

export default function DecisionModal({ isOpen, decision, onClose, onSubmit, isSubmitting }: DecisionModalProps) {
  const [rationale, setRationale] = useState("");

  useEffect(() => {
    if (isOpen) {
      setRationale("");
    }
  }, [isOpen]);

  if (!isOpen || !decision) return null;

  const handleSubmit = async () => {
    if (!rationale.trim()) return;
    await onSubmit(decision, rationale);
  };

  const isApprove = decision === "APPROVED";

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
      background: "rgba(0, 0, 0, 0.5)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center",
      backdropFilter: "blur(2px)"
    }}>
      <div className="card" style={{ width: "100%", maxWidth: "500px", background: "var(--bg-body)", padding: "24px", position: "relative" }}>
        <button
          onClick={onClose}
          style={{ position: "absolute", top: "16px", right: "16px", background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)" }}
        >
          <X size={20} />
        </button>

        <h3 style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
          {isApprove ? <CheckCircle size={20} style={{ color: "var(--success)" }} /> : <XCircle size={20} style={{ color: "var(--danger)" }} />} 
          Confirm {isApprove ? "Approval" : "Denial"}
        </h3>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: "20px" }}>
          Please provide your clinical rationale for this decision. This will be recorded and audited by the AI.
        </p>

        <div style={{ marginBottom: "24px" }}>
          <label className="label" style={{ display: "block", marginBottom: "6px" }}>Clinical Rationale (Required)</label>
          <textarea
            className="input"
            rows={4}
            placeholder={isApprove ? "E.g., Patient meets criteria for admission based on..." : "E.g., Patient does not meet criteria due to..."}
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            style={{ width: "100%", resize: "none", outline: "none", borderColor: isApprove ? "var(--success)" : "var(--danger)" }}
            autoFocus
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>Cancel</button>
          <button
            className={`btn ${isApprove ? "btn-success" : "btn-danger"}`}
            onClick={handleSubmit}
            disabled={!rationale.trim() || isSubmitting}
            style={{ gap: "6px", padding: "10px 24px" }}
          >
            {isSubmitting ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Submitting...</> : <><Send size={16} /> Submit {isApprove ? "Approval" : "Denial"}</>}
          </button>
        </div>
      </div>
    </div>
  );
}
