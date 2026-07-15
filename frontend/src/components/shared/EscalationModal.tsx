import { useState } from "react";
import { AlertTriangle, X, Send, Loader2 } from "lucide-react";

interface EscalationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (mdName: string, urgency: string, message: string) => Promise<void>;
  isSubmitting: boolean;
}

export default function EscalationModal({ isOpen, onClose, onSubmit, isSubmitting }: EscalationModalProps) {
  const [mdName, setMdName] = useState("Dr. Sarah Jenkins (Cardiology)");
  const [urgency, setUrgency] = useState("URGENT");
  const [message, setMessage] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!message.trim()) return;
    await onSubmit(mdName, urgency, message);
  };

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
          <AlertTriangle size={20} style={{ color: "var(--warning)" }} /> Escalate to Medical Director
        </h3>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: "20px" }}>
          Send this case to a Medical Director for secondary review. This will pause the nurse decision SLA.
        </p>

        <div style={{ marginBottom: "16px" }}>
          <label className="label" style={{ display: "block", marginBottom: "6px" }}>Select Medical Director</label>
          <select className="input" value={mdName} onChange={(e) => setMdName(e.target.value)} style={{ width: "100%" }}>
            <option value="Dr. Sarah Jenkins (Cardiology)">Dr. Sarah Jenkins (Cardiology)</option>
            <option value="Dr. Michael Chang (Pulmonology)">Dr. Michael Chang (Pulmonology)</option>
            <option value="Dr. Emily Roberts (Internal Med)">Dr. Emily Roberts (Internal Med)</option>
          </select>
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label className="label" style={{ display: "block", marginBottom: "6px" }}>Urgency Level</label>
          <select className="input" value={urgency} onChange={(e) => setUrgency(e.target.value)} style={{ width: "100%" }}>
            <option value="STANDARD">Standard (48 hours)</option>
            <option value="HIGH">High (24 hours)</option>
            <option value="URGENT">Urgent (4 hours)</option>
          </select>
        </div>

        <div style={{ marginBottom: "24px" }}>
          <label className="label" style={{ display: "block", marginBottom: "6px" }}>Message / Clinical Question</label>
          <textarea
            className="input"
            rows={4}
            placeholder="E.g., Patient has borderline EF and high BNP, but vitals are stable. Requesting MD review for admission necessity."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            style={{ width: "100%", resize: "none" }}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>Cancel</button>
          <button
            className="btn btn-warning"
            onClick={handleSubmit}
            disabled={!message.trim() || isSubmitting}
            style={{ gap: "6px", padding: "10px 24px" }}
          >
            {isSubmitting ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Escalating...</> : <><Send size={16} /> Escalate Case</>}
          </button>
        </div>
      </div>
    </div>
  );
}
