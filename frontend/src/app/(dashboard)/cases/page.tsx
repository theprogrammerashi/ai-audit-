"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderOpen, Plus, Search, ChevronRight, Clock, Loader2, AlertTriangle, FileText, Eye } from "lucide-react";
import api from "@/lib/api";
import CustomDropdown from "@/components/shared/CustomDropdown";

const statusColors: Record<string, string> = {
  PENDING_REVIEW: "badge-warning", IN_REVIEW: "badge-info", DECIDED: "badge-primary",
  AUDITED: "badge-success", COMPLETED: "badge-success"
};

export default function CasesPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [cases, setCases] = useState<any[]>([]);
  const [appeals, setAppeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("prior_auths");
  const [user, setUser] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [nurseFilter, setNurseFilter] = useState("ALL");

  useEffect(() => {
    const fetchCases = async () => {
      try {
        const [casesRes, appealsRes, userRes] = await Promise.all([
          api.get("/cases"),
          api.get("/appeal/intake-cases"),
          api.get("/auth/me").catch(() => ({ data: { role: "NURSE" } }))
        ]);
        setCases(casesRes.data.cases || []);
        setAppeals(appealsRes.data || []);
        setUser(userRes.data);
      } catch (err) {
        console.error("Failed to fetch cases:", err);
        setError("Failed to load cases");
      } finally {
        setLoading(false);
      }
    };
    fetchCases();
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", flexDirection: "column", gap: "16px" }}>
        <Loader2 size={32} style={{ animation: "spin 1s linear infinite", color: "var(--primary)" }} />
        <p style={{ color: "var(--text-secondary)" }}>Loading cases...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "32px", textAlign: "center", color: "var(--danger)" }}>
        <AlertTriangle size={32} style={{ margin: "0 auto 16px" }} />
        <h2>{error}</h2>
        <button className="btn btn-secondary" style={{ marginTop: "16px" }} onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  let filtered = cases;
  if (statusFilter !== "ALL") {
    filtered = filtered.filter(c => c.status === statusFilter);
  }
  if (nurseFilter !== "ALL") {
    filtered = filtered.filter(c => c.assigned_to === nurseFilter || c.submitted_by === nurseFilter);
  }
  filtered = filtered.filter(
    (c) => (c.patient_name || "").toLowerCase().includes(search.toLowerCase()) || (c.case_number || "").toLowerCase().includes(search.toLowerCase())
  );

  // Get unique nurses for filter dropdown
  const uniqueNurses = Array.from(new Set(cases.map(c => c.assigned_to || c.submitted_by).filter(Boolean)));

  return (
    <div className="animate-fade-in" style={{ padding: "32px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "24px" }}>
        <div className="page-header">
          <h1 style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}><FolderOpen size={28} style={{ color: "var(--primary)" }} /> Cases</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Manage clinical cases and review submissions</p>
        </div>
        <button className="btn btn-primary" onClick={() => router.push("/cases/new")}>
          <Plus size={16} /> New Case
        </button>
      </div>

      <div style={{ display: "flex", gap: "16px", borderBottom: "1px solid var(--border-default)", marginBottom: "24px" }}>
        <button 
          onClick={() => setActiveTab("prior_auths")}
          style={{ 
            background: "none", border: "none", borderBottom: activeTab === "prior_auths" ? "2px solid var(--primary)" : "2px solid transparent",
            padding: "10px 16px", fontWeight: activeTab === "prior_auths" ? 600 : 500, color: activeTab === "prior_auths" ? "var(--primary)" : "var(--text-secondary)",
            cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", transition: "all 0.2s"
          }}
        >
          <FolderOpen size={16} /> Prior Auths
        </button>
        <button 
          onClick={() => setActiveTab("appeals")}
          style={{ 
            background: "none", border: "none", borderBottom: activeTab === "appeals" ? "2px solid var(--primary)" : "2px solid transparent",
            padding: "10px 16px", fontWeight: activeTab === "appeals" ? 600 : 500, color: activeTab === "appeals" ? "var(--primary)" : "var(--text-secondary)",
            cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", transition: "all 0.2s"
          }}
        >
          <FileText size={16} /> Appeals Intake
        </button>
      </div>

      <div style={{ display: "flex", gap: "16px", marginBottom: "20px", alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", width: "300px" }}>
          <Search size={16} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }} />
          <input className="input" placeholder={`Search ${activeTab === "prior_auths" ? "cases" : "appeals"}...`} value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: "40px", width: "100%" }} />
        </div>
        
        {activeTab === "prior_auths" && (
          <>
            <CustomDropdown
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "ALL", label: "All Statuses" },
                { value: "PENDING_REVIEW", label: "Pending Review" },
                { value: "IN_REVIEW", label: "In Review" },
                { value: "DECIDED", label: "Decided" },
                { value: "AUDITED", label: "Audited" }
              ]}
              width="200px"
            />
            
            {user?.role !== "NURSE" && (
              <CustomDropdown
                value={nurseFilter}
                onChange={setNurseFilter}
                options={[
                  { value: "ALL", label: "All Nurses" },
                  ...uniqueNurses.map((n: any) => ({ value: n, label: n }))
                ]}
                width="200px"
              />
            )}
          </>
        )}
      </div>

      {activeTab === "prior_auths" ? (
        <div className="data-table-container animate-slide-up">
        <table className="data-table">
            <thead>
              <tr>
                <th>Case ID</th>
                <th>Patient</th>
                <th>Diagnosis</th>
                <th>Status</th>
                <th>Date</th>
                {user?.role !== "NURSE" && <th>Nurse</th>}
                <th style={{ textAlign: "center" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const d = new Date(c.submitted_at);
                const dateStr = d.toLocaleDateString();
                const isNew = (new Date().getTime() - d.getTime()) < 5 * 60 * 1000; // Less than 5 mins
                return (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>
                      {c.case_number}
                      {isNew && <span className="badge badge-success" style={{ marginLeft: "8px", fontSize: "0.65rem", padding: "2px 6px" }}>NEW</span>}
                    </td>
                    <td>{c.patient_name || "Unknown Patient"}</td>
                    <td>{c.primary_diagnosis_display}</td>
                    <td>
                      <span className={`badge ${statusColors[c.status] || "badge-info"}`}>{c.status.replace("_", " ")}</span>
                    </td>
                    <td>{dateStr}</td>
                    {user?.role !== "NURSE" && <td>{c.assigned_to || c.submitted_by}</td>}
                    <td style={{ textAlign: "center" }}>
                      <button className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: "0.75rem", margin: "0 auto" }} onClick={() => router.push(`/cases/${c.id}`)}>
                        <Eye size={14} /> View Details
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="data-table-container animate-slide-up">
          <table className="data-table">
            <thead>
              <tr>
                <th>Appeal ID</th>
                <th>Member ID</th>
                <th>Type</th>
                <th>Diagnosis</th>
                <th>Outcome</th>
                <th style={{ textAlign: "right" }}>Disputed</th>
                <th style={{ textAlign: "center" }}>Turnaround</th>
                <th style={{ textAlign: "center" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {appeals.filter(a => (a.case_id || "").toLowerCase().includes(search.toLowerCase()) || (a.member_id || "").toLowerCase().includes(search.toLowerCase())).map((a) => (
                <tr key={a.id}>
                  <td style={{ fontWeight: 600 }}>{a.case_id}</td>
                  <td>{a.member_id}</td>
                  <td>{a.appellant_type}</td>
                  <td>{a.diagnosis_category}</td>
                  <td>
                    <span className={`badge ${a.appeal_outcome?.includes("Overturn") ? "badge-warning" : "badge-success"}`}>
                      {a.appeal_outcome}
                    </span>
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>${(a.financial_amount_disputed || 0).toLocaleString()}</td>
                  <td style={{ textAlign: "center" }}>{a.turnaround_days} days</td>
                  <td style={{ textAlign: "center" }}>
                    <button className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: "0.75rem", margin: "0 auto" }} onClick={() => router.push(`/cases/appeal/${a.id}`)}>
                      <Eye size={14} /> View 360
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
