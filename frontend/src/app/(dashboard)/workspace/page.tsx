"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutDashboard, Clock, ChevronRight, AlertTriangle, Loader2, CheckCircle, History, Users, FileText, FolderOpen, ShieldCheck, XCircle, Eye } from "lucide-react";
import api from "@/lib/api";

const priorityStyles: Record<string, { bg: string; color: string; badge: string }> = {
  STANDARD: { bg: "var(--bg-body)", color: "var(--text-secondary)", badge: "badge-info" },
  HIGH: { bg: "rgba(245,158,11,0.06)", color: "var(--warning)", badge: "badge-warning" },
  URGENT: { bg: "rgba(239,68,68,0.06)", color: "var(--danger)", badge: "badge-danger" },
};

export default function WorkspacePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"queue" | "history" | "peer_reviews" | "qa_reports">("queue");
  const [caseTypeTab, setCaseTypeTab] = useState<'prior_auth' | 'appeals'>('prior_auth');
  const [cases, setCases] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [peerReviews, setPeerReviews] = useState<any[]>([]);
  const [qaReports, setQaReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>("NURSE");
  const [qaOverview, setQaOverview] = useState<any>(null);
  const [filterNurse, setFilterNurse] = useState<string>("ALL");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const meRes = await api.get("/auth/me");
        const role = meRes.data.role;
        setUserRole(role);

        if (role === "QA_LEAD" || role === "ADMIN" || role === "EXECUTIVE") {
          if (activeTab === "peer_reviews") {
            const res = await api.get("/audit/peer-reviews/assigned");
            setPeerReviews(res.data);
          } else {
            const res = await api.get("/workspace/qa-overview");
            setQaOverview(res.data);
            setCases(res.data.cases);
          }
        } else {
          if (activeTab === "queue") {
            const res = await api.get("/workspace/queue");
            setCases(res.data);
          } else if (activeTab === "qa_reports") {
            const res = await api.get("/workspace/qa-reports");
            setQaReports(res.data);
          } else {
            const res = await api.get("/workspace/history");
            setHistory(res.data);
          }
        }
      } catch (err) {
        console.error("Failed to fetch data:", err);
        setError(`Failed to load workspace ${activeTab}`);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [activeTab]);

  return (
    <div className="animate-fade-in" style={{ padding: "32px" }}>
      <div className="page-header" style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1>
            <LayoutDashboard size={28} style={{ color: "var(--primary)" }} /> {userRole === "QA_LEAD" ? "QA Lead Workspace" : "Nurse Workspace"}
          </h1>
          <p>
            Manage your clinical review queue and past decisions
          </p>
        </div>
        
        {userRole !== "NURSE" && qaOverview && (
          <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
            <span style={{ fontSize: "0.9rem", fontWeight: 500 }}>Filter by:</span>
            <select 
              value={filterNurse} 
              onChange={e => setFilterNurse(e.target.value)}
              className="input-field" 
              style={{ width: "200px" }}
            >
              <option value="ALL">All Nurses</option>
              {qaOverview.nurses.map((n: any) => (
                <option key={n.id} value={n.id}>{n.name}</option>
              ))}
            </select>
            {filterNurse !== "ALL" && (
              <button className="btn btn-secondary" onClick={() => setFilterNurse("ALL")}>Clear Filters</button>
            )}
          </div>
        )}
      </div>

      {/* Tabs Container */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-default)', paddingBottom: '8px' }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button onClick={() => setCaseTypeTab('prior_auth')}
            style={{ padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', color: caseTypeTab === 'prior_auth' ? 'var(--primary)' : 'var(--text-tertiary)', borderBottom: caseTypeTab === 'prior_auth' ? '2px solid var(--primary)' : '2px solid transparent', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '-10px' }}>
            <FolderOpen size={16} /> Prior Auth
          </button>
          <button onClick={() => setCaseTypeTab('appeals')}
            style={{ padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', color: caseTypeTab === 'appeals' ? 'var(--primary)' : 'var(--text-tertiary)', borderBottom: caseTypeTab === 'appeals' ? '2px solid var(--primary)' : '2px solid transparent', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '-10px' }}>
            <FileText size={16} /> Appeals
          </button>
        </div>

        {/* Workspace / Peer Review Toggle */}
        {userRole === "NURSE" ? (
          <div style={{ display: "flex", background: "var(--bg-surface)", padding: "4px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)" }}>
            <button 
              onClick={() => setActiveTab("queue")}
              style={{ 
                padding: "8px 16px", borderRadius: "var(--radius-sm)", border: "none", cursor: "pointer", fontSize: "0.85rem", fontWeight: 500,
                background: activeTab === "queue" ? "var(--primary)" : "transparent",
                color: activeTab === "queue" ? "white" : "var(--text-secondary)",
                display: "flex", alignItems: "center", gap: "6px"
              }}
            >
              <Clock size={16} /> Pending Queue
            </button>
            <button 
              onClick={() => setActiveTab("history")}
              style={{ 
                padding: "8px 16px", borderRadius: "var(--radius-sm)", border: "none", cursor: "pointer", fontSize: "0.85rem", fontWeight: 500,
                background: activeTab === "history" ? "var(--primary)" : "transparent",
                color: activeTab === "history" ? "white" : "var(--text-secondary)",
                display: "flex", alignItems: "center", gap: "6px"
              }}
            >
              <History size={16} /> Recently Decided
            </button>
            <button 
              onClick={() => setActiveTab("qa_reports")}
              style={{ 
                padding: "8px 16px", borderRadius: "var(--radius-sm)", border: "none", cursor: "pointer", fontSize: "0.85rem", fontWeight: 500,
                background: activeTab === "qa_reports" ? "var(--primary)" : "transparent",
                color: activeTab === "qa_reports" ? "white" : "var(--text-secondary)",
                display: "flex", alignItems: "center", gap: "6px"
              }}
            >
              <ShieldCheck size={16} /> QA Reports
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", background: "var(--bg-surface)", padding: "4px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)" }}>
            <button 
              onClick={() => setActiveTab("queue")}
              style={{ 
                padding: "8px 16px", borderRadius: "var(--radius-sm)", border: "none", cursor: "pointer", fontSize: "0.85rem", fontWeight: 500,
                background: activeTab === "queue" ? "var(--primary)" : "transparent",
                color: activeTab === "queue" ? "white" : "var(--text-secondary)",
                display: "flex", alignItems: "center", gap: "6px"
              }}
            >
              <LayoutDashboard size={16} /> My Workspace
            </button>
            <button 
              onClick={() => setActiveTab("peer_reviews")}
              style={{ 
                padding: "8px 16px", borderRadius: "var(--radius-sm)", border: "none", cursor: "pointer", fontSize: "0.85rem", fontWeight: 500,
                background: activeTab === "peer_reviews" ? "var(--primary)" : "transparent",
                color: activeTab === "peer_reviews" ? "white" : "var(--text-secondary)",
                display: "flex", alignItems: "center", gap: "6px"
              }}
            >
              <Users size={16} /> Peer Reviews
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "400px", flexDirection: "column", gap: "16px" }}>
          <Loader2 size={32} style={{ animation: "spin 1s linear infinite", color: "var(--primary)" }} />
          <p style={{ color: "var(--text-secondary)" }}>Loading {activeTab}...</p>
        </div>
      ) : error ? (
        <div style={{ padding: "32px", textAlign: "center", color: "var(--danger)" }}>
          <AlertTriangle size={32} style={{ margin: "0 auto 16px" }} />
          <h2>{error}</h2>
          <button className="btn btn-secondary" style={{ marginTop: "16px" }} onClick={() => window.location.reload()}>Retry</button>
        </div>
      ) : (
        <>
          {activeTab === "queue" && (
            <>
              {/* QA Overview Summary */}
              {userRole !== "NURSE" && qaOverview && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "28px" }}>
                  <div className="metric-card card-accent" style={{ borderTopColor: "var(--warning)" }}>
                    <div className="metric-icon-wrapper" style={{ background: "var(--warning-light)", color: "var(--warning)" }}>
                      <Clock size={24} />
                    </div>
                    <div className="metric-label">Pending QA Reviews</div>
                    <div className="metric-value">{qaOverview.cases.length}</div>
                  </div>
                  <div className="metric-card card-accent">
                    <div className="metric-icon-wrapper">
                      <Users size={24} />
                    </div>
                    <div className="metric-label">Active Nurses</div>
                    <div className="metric-value">{qaOverview.nurses.length}</div>
                  </div>
                  <div className="metric-card card-accent" style={{ borderTopColor: "var(--info)" }}>
                    <div className="metric-icon-wrapper" style={{ background: "var(--info-light)", color: "var(--info)" }}>
                      <AlertTriangle size={24} />
                    </div>
                    <div className="metric-label">Avg Team Turnaround</div>
                    <div className="metric-value">
                      {qaOverview.nurses.length ? `${Math.round(qaOverview.nurses.reduce((acc: number, n: any) => acc + n.avg_turnaround_hours, 0) / qaOverview.nurses.length)}h` : "0h"}
                    </div>
                  </div>
                </div>
              )}
              
              {userRole === "NURSE" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "28px" }}>
                  {[
                    { label: "Pending Review", value: cases.filter(c => caseTypeTab === 'prior_auth' ? !c.is_appeal : !!c.is_appeal).length, color: "var(--warning)", icon: Clock, bg: "var(--warning-light)" },
                    { label: "Urgent Priority", value: cases.filter((c) => c.urgency === "URGENT" && (caseTypeTab === 'prior_auth' ? !c.is_appeal : !!c.is_appeal)).length, color: "var(--danger)", icon: AlertTriangle, bg: "var(--danger-light)" },
                    { label: "Avg. Queue Time", value: cases.filter(c => caseTypeTab === 'prior_auth' ? !c.is_appeal : !!c.is_appeal).length ? "2h 50m" : "0h 0m", color: "var(--primary)", icon: Clock, bg: "var(--primary-light)" },
                  ].map((m) => {
                    const Icon = m.icon;
                    return (
                      <div key={m.label} className="metric-card card-accent" style={{ borderTopColor: m.color }}>
                        <div className="metric-icon-wrapper" style={{ background: m.bg, color: m.color }}>
                          <Icon size={24} />
                        </div>
                        <div className="metric-label">{m.label}</div>
                        <div className="metric-value">{m.value}</div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Nurses Table for QA_LEAD */}
              {userRole !== "NURSE" && qaOverview && filterNurse === "ALL" && (
                <div className="data-table-container animate-slide-up" style={{ marginBottom: "24px" }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Nurse</th>
                        <th>Pending QA Reviews</th>
                        <th>Avg Turnaround</th>
                        <th style={{ textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {qaOverview.nurses.map((n: any) => (
                        <tr key={n.id}>
                          <td style={{ fontWeight: 600 }}>{n.name}</td>
                          <td><span className="badge badge-warning">{n.pending_cases}</span></td>
                          <td>{n.avg_turnaround_hours}h</td>
                          <td style={{ textAlign: "right" }}>
                            <button className="btn btn-secondary" style={{ padding: "4px 8px" }} onClick={() => setFilterNurse(n.id)}>View Queue</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <h3 style={{ marginBottom: "16px" }}>{userRole !== "NURSE" ? "Pending QA Reviews" : "Your Queue"}</h3>
              {/* Cases Queue */}
              {cases.filter(c => (filterNurse === "ALL" || c.assigned_nurse_id === filterNurse) && (caseTypeTab === 'prior_auth' ? !c.is_appeal : !!c.is_appeal)).length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
                  <CheckCircle size={48} style={{ color: "var(--success)", margin: "0 auto 16px" }} />
                  <h3>{caseTypeTab === 'appeals' ? 'No appeal cases in queue' : 'All caught up!'}</h3>
                  <p style={{ color: "var(--text-secondary)", marginTop: "8px" }}>{caseTypeTab === 'appeals' ? 'There are no appeal cases pending in this queue.' : 'There are no cases pending in this queue.'}</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {cases.filter(c => (filterNurse === "ALL" || c.assigned_nurse_id === filterNurse) && (caseTypeTab === 'prior_auth' ? !c.is_appeal : !!c.is_appeal)).map((c) => {
                    const ps = priorityStyles[c.urgency] || priorityStyles["STANDARD"];
                    
                    const submittedAt = new Date(c.submitted_at);
                    const now = new Date();
                    const diffHrs = Math.floor((now.getTime() - submittedAt.getTime()) / (1000 * 60 * 60));
                    const diffMins = Math.floor(((now.getTime() - submittedAt.getTime()) % (1000 * 60 * 60)) / (1000 * 60));

                    return (
                      <div
                        key={c.id}
                        className="card"
                        onClick={() => {
                          if (userRole !== "NURSE") {
                            router.push(`/audit/${c.id}`);
                          } else {
                            router.push(c.is_appeal ? `/workspace/appeal/${c.id}` : `/workspace/${c.id}`);
                          }
                        }}
                        style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", transition: "all 0.15s", background: ps.bg }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.boxShadow = "var(--shadow-md)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-default)"; e.currentTarget.style.boxShadow = "none"; }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                          <div style={{ width: "4px", height: "48px", borderRadius: "2px", background: ps.color }} />
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                              <span style={{ fontWeight: 600, fontSize: "0.95rem", color: ps.color }}>{c.case_number}</span>
                              <span className={`badge ${ps.badge}`}>{c.urgency} Priority</span>
                              {c.is_appeal && <span className="badge badge-warning" style={{ display: "flex", alignItems: "center", gap: "4px" }}><FileText size={12} /> Appeal</span>}
                              {userRole !== "NURSE" && <span className="badge badge-info">{c.assigned_to}</span>}
                            </div>
                            <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                              {c.patient_name} — {c.primary_diagnosis_display}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "var(--text-tertiary)", fontSize: "0.8rem" }}>
                            <Clock size={12} /> {diffHrs}h {diffMins}m
                          </div>
                          <ChevronRight size={18} style={{ color: "var(--text-tertiary)" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {activeTab === "peer_reviews" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <h3 style={{ marginBottom: "16px" }}>Pending Peer Reviews</h3>
              {peerReviews.length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
                  <CheckCircle size={48} style={{ color: "var(--success)", margin: "0 auto 16px" }} />
                  <h3>All caught up!</h3>
                  <p style={{ color: "var(--text-secondary)", marginTop: "8px" }}>There are no peer reviews pending for you.</p>
                </div>
              ) : (
                peerReviews.map((pr) => {
                  const createdAt = new Date(pr.created_at);
                  return (
                    <div
                      key={pr.id}
                      className="card"
                      onClick={() => router.push(`/audit/${pr.case_id}`)}
                      style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", transition: "all 0.15s" }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.boxShadow = "var(--shadow-md)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-default)"; e.currentTarget.style.boxShadow = "none"; }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                        <div style={{ width: "4px", height: "48px", borderRadius: "2px", background: "var(--info)" }} />
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                            <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>{pr.case_number}</span>
                            <span className="badge badge-warning">PEER REVIEW</span>
                            <span className="badge badge-info">Requested by: {pr.requested_by_name}</span>
                          </div>
                          <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                            {pr.patient_name} — {pr.primary_diagnosis_display}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                        <div style={{ color: "var(--text-tertiary)", fontSize: "0.8rem", maxWidth: "200px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          "{pr.message}"
                        </div>
                        <ChevronRight size={18} style={{ color: "var(--text-tertiary)" }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === "history" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {history.length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
                  <History size={48} style={{ color: "var(--text-tertiary)", margin: "0 auto 16px" }} />
                  <h3>No History</h3>
                  <p style={{ color: "var(--text-secondary)", marginTop: "8px" }}>You have not decided any cases recently.</p>
                </div>
              ) : (
                history.map((h) => {
                  const decisionColor = h.decision === "APPROVED" ? "var(--success)" : h.decision === "DENIED" ? "var(--danger)" : "var(--warning)";
                  return (
                    <div key={h.id} className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                          <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>{h.case_number}</span>
                          <span className="badge" style={{ backgroundColor: decisionColor, color: "white" }}>{h.decision}</span>
                          {h.is_appeal && <span className="badge badge-warning" style={{ display: "flex", alignItems: "center", gap: "4px" }}><FileText size={12} /> Appeal</span>}
                        </div>
                        <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                          {h.patient_name} — {h.primary_diagnosis_display}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: "0.8rem", color: "var(--text-tertiary)", marginBottom: "2px" }}>QA Score</div>
                          {h.qa_verified === false || !h.qa_verified ? (
                            <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>Pending QA Review</span>
                          ) : (
                            <div style={{ fontWeight: 600, color: h.qa_score >= 90 ? "var(--success)" : h.qa_score >= 75 ? "var(--warning)" : "var(--danger)" }}>
                              {h.qa_score ? `${h.qa_score}%` : "Pending"}
                            </div>
                          )}
                        </div>
                        <button className="btn btn-secondary" onClick={() => router.push(`/cases/${h.id}`)} style={{ padding: "6px 12px", fontSize: "0.8rem" }}>
                          View Case
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* QA Reports Tab */}
          {activeTab === "qa_reports" && (
            <div>
              {/* Summary Metrics */}
              {(() => {
                const approved = qaReports.filter(r => r.score_status === 'QA_APPROVED');
                const pending = qaReports.filter(r => r.score_status === 'PENDING_QA_REVIEW');
                const avgScore = approved.length > 0 ? Math.round(approved.reduce((sum: number, r: any) => sum + (r.effective_score || 0), 0) / approved.length) : 0;
                const passCount = approved.filter(r => (r.effective_score || 0) >= 80).length;
                return (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "28px" }}>
                      {[
                        { label: "Total Audited", value: qaReports.length, color: "var(--primary)", icon: ShieldCheck, bg: "var(--primary-light)" },
                        { label: "QA Approved", value: approved.length, color: "var(--success)", icon: CheckCircle, bg: "var(--success-light)" },
                        { label: "Pending QA Review", value: pending.length, color: "var(--warning)", icon: Clock, bg: "var(--warning-light)" },
                        { label: "Avg QA Score", value: approved.length > 0 ? `${avgScore}%` : "N/A", color: avgScore >= 80 ? "var(--success)" : "var(--warning)", icon: AlertTriangle, bg: avgScore >= 80 ? "var(--success-light)" : "var(--warning-light)" },
                      ].map((m) => {
                        const Icon = m.icon;
                        return (
                          <div key={m.label} className="metric-card card-accent" style={{ borderTopColor: m.color }}>
                            <div className="metric-icon-wrapper" style={{ background: m.bg, color: m.color }}>
                              <Icon size={24} />
                            </div>
                            <div className="metric-label">{m.label}</div>
                            <div className="metric-value">{m.value}</div>
                          </div>
                        );
                      })}
                    </div>

                    {/* QA Approved Reports */}
                    {approved.length > 0 && (
                      <div style={{ marginBottom: "24px" }}>
                        <h3 style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px", fontSize: "1rem" }}>
                          <CheckCircle size={18} style={{ color: "var(--success)" }} /> QA Approved Audit Results
                        </h3>
                        <div className="data-table-container">
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>Case #</th>
                                <th>Patient</th>
                                <th>Diagnosis</th>
                                <th>Decision</th>
                                <th>QA Score</th>
                                <th>Result</th>
                                <th>Risk Level</th>
                                <th>Key Findings</th>
                                <th></th>
                              </tr>
                            </thead>
                            <tbody>
                              {approved.map((r: any) => {
                                const score = r.effective_score || 0;
                                const passed = score >= 80;
                                const scoreColor = score >= 90 ? "var(--success)" : score >= 75 ? "var(--warning)" : "var(--danger)";
                                const findings: any[] = r.findings || [];
                                const topFinding = findings.length > 0 ? (findings[0].description || findings[0]) : "No issues found";
                                return (
                                  <tr key={r.case_id}>
                                    <td style={{ fontWeight: 600 }}>{r.case_number}</td>
                                    <td>{r.patient_name || "N/A"}</td>
                                    <td style={{ maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.diagnosis}</td>
                                    <td>
                                      <span className={`badge ${r.decision === 'APPROVED' ? 'badge-success' : 'badge-danger'}`}>{r.decision}</span>
                                    </td>
                                    <td>
                                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                        <div style={{ width: "40px", height: "6px", background: "var(--border-default)", borderRadius: "3px" }}>
                                          <div style={{ height: "100%", width: `${score}%`, background: scoreColor, borderRadius: "3px" }} />
                                        </div>
                                        <span style={{ fontWeight: 700, color: scoreColor }}>{score}%</span>
                                      </div>
                                    </td>
                                    <td>
                                      <span className={`badge ${passed ? 'badge-success' : 'badge-danger'}`} style={{ display: "flex", alignItems: "center", gap: "4px", width: "fit-content" }}>
                                        {passed ? <CheckCircle size={12} /> : <XCircle size={12} />}
                                        {passed ? "PASS" : "FAIL"}
                                      </span>
                                    </td>
                                    <td>
                                      <span className={`badge ${r.risk_level === 'HIGH' || r.risk_level === 'CRITICAL' ? 'badge-danger' : r.risk_level === 'MEDIUM' ? 'badge-warning' : 'badge-success'}`}>
                                        {r.risk_level || "N/A"}
                                      </span>
                                    </td>
                                    <td style={{ fontSize: "0.82rem", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-secondary)" }}>
                                      {typeof topFinding === 'string' ? topFinding : JSON.stringify(topFinding)}
                                    </td>
                                    <td>
                                      <button className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: "0.78rem" }} onClick={() => router.push(`/audit/${r.case_id}`)}>
                                        <Eye size={14} /> View
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Pending QA Review */}
                    {pending.length > 0 && (
                      <div>
                        <h3 style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px", fontSize: "1rem" }}>
                          <Clock size={18} style={{ color: "var(--warning)" }} /> Pending QA Review
                        </h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {pending.map((r: any) => (
                            <div key={r.case_id} className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                                <div style={{ width: "4px", height: "44px", borderRadius: "2px", background: "var(--warning)" }} />
                                <div>
                                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                                    <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>{r.case_number}</span>
                                    <span className={`badge ${r.decision === 'APPROVED' ? 'badge-success' : 'badge-danger'}`}>{r.decision}</span>
                                    <span className="badge badge-warning" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                      <Clock size={10} /> Awaiting QA Review
                                    </span>
                                  </div>
                                  <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                                    {r.patient_name} — {r.diagnosis}
                                  </div>
                                </div>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: "0.78rem", color: "var(--text-tertiary)" }}>QA Score</div>
                                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                  <ShieldCheck size={14} style={{ color: "var(--warning)" }} />
                                  <span style={{ fontSize: "0.85rem", color: "var(--warning)", fontWeight: 500 }}>Pending</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {qaReports.length === 0 && (
                      <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
                        <ShieldCheck size={48} style={{ color: "var(--text-tertiary)", margin: "0 auto 16px" }} />
                        <h3>No Audit Reports</h3>
                        <p style={{ color: "var(--text-secondary)", marginTop: "8px" }}>Your cases have not been audited yet. QA scores will appear here once your QA Lead reviews your decisions.</p>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </>
      )}
    </div>
  );
}
