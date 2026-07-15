"use client";

import { useState, useEffect } from "react";
import { X, Send, Loader2, Users } from "lucide-react";
import api from "@/lib/api";

interface PeerReviewModalProps {
  isOpen: boolean;
  caseId: string;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export default function PeerReviewModal({ isOpen, caseId, onClose, onSuccess }: PeerReviewModalProps) {
  const [nurses, setNurses] = useState<any[]>([]);
  const [selectedNurse, setSelectedNurse] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedNurse("");
      setMessage("");
      // Fetch nurses
      api.get("/audit/nurses/list")
        .then((res) => setNurses(res.data))
        .catch(console.error);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!selectedNurse) return;
    setIsSubmitting(true);
    try {
      await api.post(`/audit/${caseId}/peer-review`, {
        assigned_to: selectedNurse,
        message,
      });
      onSuccess("Peer review request sent successfully.");
      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to request peer review");
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
          <Users size={20} style={{ color: "var(--info)" }} /> Request Peer Review
        </h3>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: "20px" }}>
          Select a QA reviewer to perform an independent peer review of this audit.
        </p>

        <div style={{ marginBottom: "16px" }}>
          <label className="label" style={{ display: "block", marginBottom: "6px" }}>Select Reviewer</label>
          <select
            className="input"
            value={selectedNurse}
            onChange={(e) => setSelectedNurse(e.target.value)}
            style={{ width: "100%" }}
          >
            <option value="">-- Select a QA Lead --</option>
            {nurses.map((n) => (
              <option key={n.id} value={n.id}>{n.full_name}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: "24px" }}>
          <label className="label" style={{ display: "block", marginBottom: "6px" }}>Message (Optional)</label>
          <textarea
            className="input"
            rows={3}
            placeholder="E.g., Please review the documentation completeness finding — I believe the lab values were included in the addendum."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            style={{ width: "100%", resize: "none" }}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={!selectedNurse || isSubmitting}
            style={{ gap: "6px" }}
          >
            {isSubmitting ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Sending...</> : <><Send size={16} /> Send for Review</>}
          </button>
        </div>
      </div>
    </div>
  );
}
