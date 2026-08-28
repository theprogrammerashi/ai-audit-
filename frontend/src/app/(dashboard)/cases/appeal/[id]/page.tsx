"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FileText, ArrowLeft, Loader2, AlertTriangle, ShieldCheck, FileCheck, CheckCircle, XCircle } from "lucide-react";
import api from "@/lib/api";

export default function AppealView360() {
  const { id } = useParams();
  const router = useRouter();
  const [appeal, setAppeal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAppeal = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/appeal/intake-cases/${id}`);
        setAppeal(res.data);
      } catch (err) {
        console.error("Failed to fetch appeal:", err);
        setError("Failed to load appeal details");
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchAppeal();
  }, [id]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", flexDirection: "column", gap: "16px" }}>
        <Loader2 size={32} style={{ animation: "spin 1s linear infinite", color: "var(--primary)" }} />
        <p style={{ color: "var(--text-secondary)" }}>Loading appeal details...</p>
      </div>
    );
  }

  if (error || !appeal) {
    return (
      <div style={{ padding: "32px", textAlign: "center", color: "var(--danger)" }}>
        <AlertTriangle size={32} style={{ margin: "0 auto 16px" }} />
        <h2>{error || "Appeal not found"}</h2>
        <button className="btn btn-secondary" style={{ marginTop: "16px" }} onClick={() => router.push("/cases")}>Back to Cases</button>
      </div>
    );
  }

  return (
    <div style={{ padding: "32px", maxWidth: "1200px", margin: "0 auto" }}>
      <button 
        className="btn" 
        style={{ background: "transparent", color: "var(--text-secondary)", padding: 0, marginBottom: "24px", display: "flex", alignItems: "center", gap: "8px" }}
        onClick={() => router.push("/cases")}
      >
        <ArrowLeft size={16} /> Back to Cases
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
            <FileText size={28} /> Appeal 360 View: {appeal.id}
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
            Patient: {appeal.member_id} • Type: {appeal.appellant_type} • Level: {appeal.appeal_level}
          </p>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          {appeal.appeal_outcome ? (
            <span className={`badge ${appeal.appeal_outcome.includes("Overturn") ? "badge-warning" : "badge-success"}`} style={{ fontSize: "0.9rem", padding: "8px 16px" }}>
              Current Outcome: {appeal.appeal_outcome}
            </span>
          ) : (
            <span className="badge badge-warning" style={{ fontSize: "0.9rem", padding: "8px 16px" }}>
              Status: Pending Review
            </span>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "24px" }}>
        <div className="card" style={{ padding: "24px" }}>
          <h3 style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            <ShieldCheck size={18} color="var(--primary)" /> Case Overview
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "0.9rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-default)", paddingBottom: "8px" }}>
              <span style={{ color: "var(--text-secondary)" }}>Associated Case Number:</span>
              <span style={{ fontWeight: 500 }}>{appeal.case_number || appeal.case_id}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-default)", paddingBottom: "8px" }}>
              <span style={{ color: "var(--text-secondary)" }}>Diagnosis Category:</span>
              <span style={{ fontWeight: 500 }}>{appeal.diagnosis_category}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-default)", paddingBottom: "8px" }}>
              <span style={{ color: "var(--text-secondary)" }}>Requested Service:</span>
              <span style={{ fontWeight: 500 }}>{appeal.requested_service}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-default)", paddingBottom: "8px" }}>
              <span style={{ color: "var(--text-secondary)" }}>Original Denial Reason:</span>
              <span style={{ fontWeight: 500 }}>{appeal.denial_reason_category}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "8px" }}>
              <span style={{ color: "var(--text-secondary)" }}>Turnaround Days:</span>
              <span style={{ fontWeight: 500 }}>{appeal.turnaround_days} days</span>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: "24px" }}>
          <h3 style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            <FileCheck size={18} color="var(--primary)" /> Clinical Details
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", fontSize: "0.9rem" }}>
            <div>
              <div style={{ color: "var(--text-secondary)", marginBottom: "4px" }}>Clinical Rationale Provided:</div>
              <div style={{ background: "var(--bg-hover)", padding: "12px", borderRadius: "var(--radius-md)", lineHeight: "1.5" }}>
                {appeal.clinical_rationale_provided || "No clinical rationale provided."}
              </div>
            </div>
            <div>
              <div style={{ color: "var(--text-secondary)", marginBottom: "4px" }}>Key Evidence Cited:</div>
              <div style={{ background: "var(--bg-hover)", padding: "12px", borderRadius: "var(--radius-md)", lineHeight: "1.5" }}>
                {appeal.key_evidence_cited || "No evidence cited."}
              </div>
            </div>
            <div>
              <div style={{ color: "var(--text-secondary)", marginBottom: "4px" }}>Policy Referenced:</div>
              <div style={{ background: "var(--bg-hover)", padding: "12px", borderRadius: "var(--radius-md)", lineHeight: "1.5" }}>
                {appeal.policy_referenced || "None"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
