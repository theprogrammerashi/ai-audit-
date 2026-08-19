"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { FolderOpen, Plus, Search, ChevronRight, Clock, Loader2, AlertTriangle, FileText, Eye } from "lucide-react";
import api from "@/lib/api";
import CustomDropdown from "@/components/shared/CustomDropdown";

const statusColors: Record<string, string> = {
  PENDING_REVIEW: "badge-warning", IN_REVIEW: "badge-info", DECIDED: "badge-primary",
  AUDITED: "badge-success", COMPLETED: "badge-success"
};

const getGreeting = () => {
  const hr = new Date().getHours();
  if (hr < 12) return "Good morning";
  if (hr < 17) return "Good afternoon";
  return "Good evening";
};

const getGreetingEmoji = () => {
  const hr = new Date().getHours();
  if (hr < 12) return "☀️";
  if (hr < 17) return "☕";
  return "🌙";
};

const getCaseUrgency = (c: any) => {
  const riskSignals = c.structured_case?.risk_signals || [];
  const signalsCount = Array.isArray(riskSignals) ? riskSignals.length : 0;
  if (signalsCount >= 3) return "URGENT";
  const dxCode = c.primary_diagnosis_code || "";
  const dxDisplay = c.primary_diagnosis_display || "";
  if (dxCode.startsWith("A41") || dxDisplay.includes("Sepsis")) {
    return "URGENT";
  }
  if (signalsCount > 0) return "HIGH";
  if (dxCode.startsWith("I50") || dxDisplay.includes("Heart Failure")) {
    return "HIGH";
  }
  return "STANDARD";
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

  const welcomeStats = useMemo(() => {
    const now = new Date().getTime();
    let urgentCount = 0;
    let overdueCount = 0;
    
    const isQa = user?.role === "QA_LEAD" || user?.role === "ADMIN" || user?.role === "EXECUTIVE";
    const pendingStatuses = isQa ? ["DECIDED"] : ["PENDING_REVIEW", "IN_REVIEW"];
    
    if (activeTab === "prior_auths") {
      cases.forEach(c => {
        if (pendingStatuses.includes(c.status)) {
          const urgency = getCaseUrgency(c);
          if (urgency === "URGENT") {
            urgentCount++;
          }
          let submittedStr = c.submitted_at;
          if (submittedStr) {
            if (!submittedStr.endsWith('Z') && !submittedStr.includes('+')) {
              submittedStr = submittedStr.replace(' ', 'T') + 'Z';
            }
            const ageMs = now - new Date(submittedStr).getTime();
            const ageHours = ageMs / (1000 * 60 * 60);
            if (ageHours > 24) {
              overdueCount++;
            }
          }
        }
      });
      return {
        urgent: urgentCount,
        overdue: overdueCount,
        total: cases.filter(c => pendingStatuses.includes(c.status)).length
      };
    } else {
      appeals.forEach(a => {
        if (!a.appeal_outcome) {
          if (a.appeal_level && a.appeal_level.includes("Level 2")) {
            urgentCount++;
          }
          let submittedStr = a.created_at || a.appeal_received_date;
          if (submittedStr) {
            if (!submittedStr.endsWith('Z') && !submittedStr.includes('+')) {
              submittedStr = submittedStr.replace(' ', 'T') + 'Z';
            }
            const ageMs = now - new Date(submittedStr).getTime();
            const ageHours = ageMs / (1000 * 60 * 60);
            if (ageHours > 24) {
              overdueCount++;
            }
          }
        }
      });
      return {
        urgent: urgentCount,
        overdue: overdueCount,
        total: appeals.filter(a => !a.appeal_outcome).length
      };
    }
  }, [cases, appeals, activeTab, user]);

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
        {user?.role !== "QA_LEAD" && (
          <button className="btn btn-primary" onClick={() => router.push("/cases/new")}>
            <Plus size={16} /> New Case
          </button>
        )}
      </div>

      {/* Dynamic Welcome Banner (Option A - Glassmorphic Card) */}
      <div style={{
        background: "linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(244, 63, 94, 0.08) 100%)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-lg)",
        padding: "24px 32px",
        marginBottom: "28px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        boxShadow: "var(--shadow-sm)",
        backdropFilter: "blur(8px)",
        position: "relative",
        overflow: "hidden"
      }}>
        {/* Decorative backdrop blobs */}
        <div style={{
          position: "absolute",
          width: "150px",
          height: "150px",
          borderRadius: "50%",
          background: "var(--primary)",
          filter: "blur(60px)",
          opacity: 0.15,
          top: "-50px",
          left: "-50px",
          pointerEvents: "none"
        }} />
        <div style={{
          position: "absolute",
          width: "150px",
          height: "150px",
          borderRadius: "50%",
          background: "var(--warning)",
          filter: "blur(60px)",
          opacity: 0.15,
          bottom: "-50px",
          right: "-50px",
          pointerEvents: "none"
        }} />

        <div style={{ zIndex: 1 }}>
          <h2 style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "6px" }}>
            {getGreeting()}, {user?.full_name || "Sarah Collins"}! {getGreetingEmoji()}
          </h2>
          <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", margin: 0 }}>
            Here is your review queue summary for today.
          </p>
        </div>

        <div style={{ display: "flex", gap: "16px", zIndex: 1 }}>
          {/* Overdue stat */}
          <div style={{
            background: "rgba(239, 68, 68, 0.06)",
            border: "1px solid rgba(239, 68, 68, 0.15)",
            borderRadius: "var(--radius-md)",
            padding: "12px 20px",
            minWidth: "150px",
            display: "flex",
            flexDirection: "column",
            gap: "2px"
          }}>
            <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--danger)", display: "flex", alignItems: "center", gap: "8px" }}>
              {welcomeStats.overdue}
              <AlertTriangle size={18} style={{ color: "var(--danger)" }} />
            </div>
            <div style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--text-secondary)" }}>Overdue (&gt;24h)</div>
          </div>

          {/* Urgent stat */}
          <div style={{
            background: "rgba(245, 158, 11, 0.06)",
            border: "1px solid rgba(245, 158, 11, 0.15)",
            borderRadius: "var(--radius-md)",
            padding: "12px 20px",
            minWidth: "150px",
            display: "flex",
            flexDirection: "column",
            gap: "2px"
          }}>
            <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--warning)", display: "flex", alignItems: "center", gap: "8px" }}>
              {welcomeStats.urgent}
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--warning)", display: "inline-block" }} />
            </div>
            <div style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--text-secondary)" }}>Urgent Priority</div>
          </div>

          {/* Pending stat */}
          <div style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-md)",
            padding: "12px 20px",
            minWidth: "150px",
            display: "flex",
            flexDirection: "column",
            gap: "2px"
          }}>
            <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
              {welcomeStats.total}
              <FileText size={18} style={{ color: "var(--text-tertiary)" }} />
            </div>
            <div style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--text-secondary)" }}>Pending Cases</div>
          </div>
        </div>
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
                let submittedStr = c.submitted_at;
                if (submittedStr && !submittedStr.endsWith('Z') && !submittedStr.includes('+')) {
                  submittedStr = submittedStr.replace(' ', 'T') + 'Z';
                }
                const d = new Date(submittedStr);
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
                    {a.appeal_outcome ? (
                      <span className={`badge ${a.appeal_outcome.includes("Overturn") ? "badge-warning" : "badge-success"}`}>
                        {a.appeal_outcome}
                      </span>
                    ) : (
                      <span className="badge badge-warning">Pending Review</span>
                    )}
                  </td>
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
