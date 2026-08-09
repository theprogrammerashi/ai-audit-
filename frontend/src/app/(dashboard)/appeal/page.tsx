"use client";

import { useEffect, useState, Fragment } from "react";
import { AlertTriangle, DollarSign, TrendingUp, Loader2, FileText, Activity, Clock, Scale, CheckCircle, XCircle, X, Users, BarChart3, Shield, ArrowRight, ChevronDown, ChevronUp, Info, Target } from "lucide-react";
import MetricCard from "@/components/shared/MetricCard";
import CustomDropdown from "@/components/shared/CustomDropdown";
import api from "@/lib/api";
import { useRouter } from "next/navigation";

const riskBadge: Record<string, string> = { HIGH: "badge-danger", CRITICAL: "badge-danger", MEDIUM: "badge-warning", LOW: "badge-success" };
const outcomeBadge: Record<string, { cls: string; label: string }> = {
  "Overturned - Full": { cls: "c-badge-danger", label: "Overturned" },
  "Overturned - Partial": { cls: "c-badge-warning", label: "Partial Overturn" },
  "Upheld": { cls: "c-badge-success", label: "Upheld" },
};

export default function AppealPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("tracker");
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [intakeData, setIntakeData] = useState<any[]>([]);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>("NURSE");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Tracker filters
  const [trackerSearch, setTrackerSearch] = useState("");
  const [trackerLevelFilter, setTrackerLevelFilter] = useState("all");
  const [trackerStatusFilter, setTrackerStatusFilter] = useState("all");

  // Risk filters
  const [riskSearch, setRiskSearch] = useState("");
  const [riskLevelFilter, setRiskLevelFilter] = useState("all");
  const [riskDecisionFilter, setRiskDecisionFilter] = useState("all");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [dashRes, intakeRes, analyticsRes, meRes] = await Promise.all([
          api.get("/appeal/dashboard"),
          api.get("/appeal/intake-cases"),
          api.get("/appeal/analytics"),
          api.get("/auth/me"),
        ]);
        setDashboardData(dashRes.data);
        setIntakeData(intakeRes.data);
        setAnalyticsData(analyticsRes.data);
        setUserRole(meRes.data.role || "NURSE");
      } catch (err) {
        console.error("Failed to fetch appeal data:", err);
        setError("Failed to load appeal data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", flexDirection: "column", gap: "16px" }}>
        <Loader2 size={32} style={{ animation: "spin 1s linear infinite", color: "var(--primary)" }} />
        <p style={{ color: "var(--text-secondary)" }}>Loading appeal management data...</p>
      </div>
    );
  }

  if (error || !dashboardData || !analyticsData) {
    return (
      <div style={{ padding: "32px", textAlign: "center", color: "var(--danger)" }}>
        <AlertTriangle size={32} style={{ margin: "0 auto 16px" }} />
        <h2>{error || "Failed to load dashboard"}</h2>
        <button className="btn btn-secondary" style={{ marginTop: "16px" }} onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  const cases = dashboardData.high_risk_cases || [];
  const intake = intakeData || [];
  
  // Compute intake stats
  const openAppeals = intake.filter((c: any) => !c.appeal_outcome).length;
  const resolvedAppeals = intake.filter((c: any) => c.appeal_outcome).length;
  const overturnedCount = intake.filter((c: any) => c.appeal_outcome && c.appeal_outcome.includes("Overturned")).length;
  const upheldCount = intake.filter((c: any) => c.appeal_outcome === "Upheld").length;
  const overturnRate = resolvedAppeals > 0 ? Math.round((overturnedCount / resolvedAppeals) * 100) : 0;
  const avgResolutionDays = intake.filter((c: any) => c.turnaround_days).reduce((sum: number, c: any) => sum + (c.turnaround_days || 0), 0) / (resolvedAppeals || 1);

  // Outcome distribution from analytics
  const outcomeDist = analyticsData.outcome_distribution || {};
  const totalOutcome = (outcomeDist.overturned || 0) + (outcomeDist.upheld || 0) + (outcomeDist.pending || 0);

  // Filtered lists for rendering
  const filteredIntake = intake.filter((c: any) => {
    const query = trackerSearch.toLowerCase().trim();
    const matchesSearch = !query || 
      (c.id && c.id.toLowerCase().includes(query)) ||
      (c.member_id && c.member_id.toLowerCase().includes(query)) ||
      (c.diagnosis_category && c.diagnosis_category.toLowerCase().includes(query)) ||
      (c.requested_service && c.requested_service.toLowerCase().includes(query));
      
    const matchesLevel = trackerLevelFilter === "all" ||
      (c.appeal_level && c.appeal_level.toLowerCase().includes(trackerLevelFilter.toLowerCase()));
      
    let matchesStatus = true;
    if (trackerStatusFilter !== "all") {
      if (trackerStatusFilter === "pending") {
        matchesStatus = !c.appeal_outcome;
      } else if (trackerStatusFilter === "upheld") {
        matchesStatus = c.appeal_outcome === "Upheld";
      } else if (trackerStatusFilter === "overturned") {
        matchesStatus = !!(c.appeal_outcome && c.appeal_outcome.includes("Overturned"));
      }
    }
    
    return matchesSearch && matchesLevel && matchesStatus;
  });

  const filteredCases = cases.filter((c: any) => {
    const query = riskSearch.toLowerCase().trim();
    const matchesSearch = !query ||
      (c.case_number && c.case_number.toLowerCase().includes(query)) ||
      (c.patient_name && c.patient_name.toLowerCase().includes(query)) ||
      (c.diagnosis && c.diagnosis.toLowerCase().includes(query)) ||
      (c.reviewer_name && c.reviewer_name.toLowerCase().includes(query));
      
    const matchesLevel = riskLevelFilter === "all" ||
      c.risk_category === riskLevelFilter;
      
    const matchesDecision = riskDecisionFilter === "all" ||
      c.decision === riskDecisionFilter;
      
    return matchesSearch && matchesLevel && matchesDecision;
  });

  return (
    <div className="animate-fade-in" style={{ padding: "32px" }}>
      <div className="page-header" style={{ marginBottom: "24px" }}>
        <h1 style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
          <Scale size={28} style={{ color: "var(--primary)" }} />
          {userRole === "NURSE" ? "My Appeal Risk" : "Appeal Management"}
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
          {userRole === "NURSE"
            ? "Track appeal risk for your denied cases and review assigned appeals"
            : "Monitor appeal risk, track outcomes, and manage the appeal lifecycle"
          }
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", borderBottom: "1px solid var(--border-default)", marginBottom: "24px", paddingBottom: "0" }}>
        {[
          { id: "tracker", label: "Appeal Tracker", icon: FileText },
          { id: "risk", label: "Risk Dashboard", icon: AlertTriangle },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "10px 20px", border: "none", background: "none", cursor: "pointer",
              fontWeight: 600, fontSize: "0.85rem",
              color: activeTab === tab.id ? "var(--primary)" : "var(--text-tertiary)",
              borderBottom: activeTab === tab.id ? "2px solid var(--primary)" : "2px solid transparent",
              transition: "all 0.2s", display: "flex", alignItems: "center", gap: "6px",
              marginBottom: "-1px"
            }}
          >
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .tabular-risk-dashboard {
          --tab-border: #E2E8F0;
          --tab-bg-alt: #F8FAFC;
          --tab-text: #334155;
          --tab-text-dark: #0F172A;
        }
        .tabular-metrics-ribbon {
          display: flex;
          align-items: center;
          background: #fff;
          border: 1px solid var(--tab-border);
          border-radius: 6px;
          padding: 10px 16px;
          margin-bottom: 16px;
          gap: 12px;
          font-family: monospace;
          font-size: 0.85rem;
          color: var(--tab-text);
        }
        .tabular-metric-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          border-radius: 6px;
          border: 1px solid var(--tab-border);
          background: var(--tab-bg-alt);
        }
        .tabular-metric-val {
          font-weight: 700;
          color: var(--tab-text-dark);
          font-size: 1rem;
        }
        .tabular-table-container {
          background: #fff;
          border: 1px solid var(--tab-border);
          border-radius: 6px;
          overflow: hidden;
        }
        .tabular-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.82rem;
        }
        .tabular-table th {
          background: var(--tab-bg-alt);
          color: var(--tab-text);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 10px 12px !important;
          border-bottom: 2px solid var(--tab-border) !important;
          border-right: 1px solid var(--tab-border);
          text-align: left;
        }
        .tabular-table th:last-child { border-right: none; }
        .tabular-table td {
          padding: 8px 12px !important;
          border-bottom: 1px solid var(--tab-border) !important;
          border-right: 1px solid var(--tab-border);
          color: var(--tab-text-dark);
        }
        .tabular-table td:last-child { border-right: none; }
        .tabular-table tbody tr:nth-child(even) { background: var(--tab-bg-alt); }
        .tabular-table tbody tr:hover { background: #F1F5F9 !important; }
        .compact-badge {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 0.7rem;
          font-weight: 700;
          border: 1px solid currentColor;
        }
        .c-badge-danger { color: #DC2626; background: #FEF2F2; }
        .c-badge-warning { color: #D97706; background: #FFFBEB; }
        .c-badge-success { color: #059669; background: #ECFDF5; }
        .c-badge-info { color: #2563EB; background: #EFF6FF; }
        .compact-bar-wrap {
          width: 50px; height: 6px; background: #E2E8F0; border-radius: 2px; overflow: hidden;
        }
        .compact-bar-fill {
          height: 100%; border-radius: 2px;
        }
      `}} />

      {/* ═══ Tab 1: Appeal Tracker ═══ */}
      {activeTab === "tracker" && (
        <div className="tabular-risk-dashboard">
          {/* Summary Cards */}
          <div className="tabular-metrics-ribbon">
            <div className="tabular-metric-item" style={{ background: "rgba(245,158,11,0.08)", borderColor: "rgba(245,158,11,0.3)" }}>
              <span style={{ color: "#F59E0B" }}><Clock size={14} /></span>
              <span style={{ color: "#F59E0B" }}>OPEN APPEALS:</span>
              <span className="tabular-metric-val">{openAppeals}</span>
            </div>
            <div className="tabular-metric-item" style={{ background: "rgba(16,185,129,0.08)", borderColor: "rgba(16,185,129,0.3)" }}>
              <span style={{ color: "#10B981" }}><CheckCircle size={14} /></span>
              <span style={{ color: "#10B981" }}>RESOLVED:</span>
              <span className="tabular-metric-val">{resolvedAppeals}</span>
            </div>
            <div className="tabular-metric-item" style={{ background: overturnRate > 40 ? "rgba(220,38,38,0.08)" : "rgba(37,99,235,0.08)", borderColor: overturnRate > 40 ? "rgba(220,38,38,0.3)" : "rgba(37,99,235,0.3)" }}>
              <span style={{ color: overturnRate > 40 ? "#DC2626" : "#2563EB" }}><TrendingUp size={14} /></span>
              <span style={{ color: overturnRate > 40 ? "#DC2626" : "#2563EB" }}>OVERTURN RATE:</span>
              <span className="tabular-metric-val">{overturnRate}%</span>
            </div>
            <div className="tabular-metric-item" style={{ background: "rgba(232,82,26,0.08)", borderColor: "rgba(232,82,26,0.3)" }}>
              <span style={{ color: "#E8521A" }}><Clock size={14} /></span>
              <span style={{ color: "#E8521A" }}>AVG RESOLUTION:</span>
              <span className="tabular-metric-val">{Math.round(avgResolutionDays)} days</span>
            </div>
          </div>

          {/* Appeal Intake Table */}
          <div className="tabular-table-container">
            <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--tab-border)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff" }}>
              <h3 style={{ fontSize: "0.95rem", margin: 0, display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, color: "var(--tab-text-dark)" }}>
                <FileText size={16} style={{ color: "#E8521A" }} /> APPEAL CASES
              </h3>
              <div style={{ display: "flex", gap: "8px" }}>
                <span className="compact-badge c-badge-warning">{openAppeals} Pending</span>
                <span className="compact-badge c-badge-success">{upheldCount} Upheld</span>
                <span className="compact-badge c-badge-danger">{overturnedCount} Overturned</span>
              </div>
            </div>
            {/* Search & Filter Controls */}
            <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border-default)", display: "flex", gap: "12px", background: "var(--bg-hover)", alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: "200px", position: "relative" }}>
                <input
                  type="text"
                  placeholder="Search by ID, Member, Diagnosis, or Service..."
                  value={trackerSearch}
                  onChange={(e) => setTrackerSearch(e.target.value)}
                  className="input"
                  style={{ paddingLeft: "36px", paddingRight: "32px" }}
                />
                <svg style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                {trackerSearch && (
                  <button
                    onClick={() => setTrackerSearch("")}
                    style={{
                      position: "absolute",
                      right: "10px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "4px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--text-tertiary)",
                      borderRadius: "50%",
                      transition: "background 0.2s"
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <CustomDropdown
                value={trackerLevelFilter}
                onChange={setTrackerLevelFilter}
                options={[
                  { value: "all", label: "All Levels" },
                  { value: "Level 1", label: "Level 1" },
                  { value: "Level 2", label: "Level 2" },
                  { value: "Expedited", label: "Expedited" }
                ]}
              />
              <CustomDropdown
                value={trackerStatusFilter}
                onChange={setTrackerStatusFilter}
                options={[
                  { value: "all", label: "All Statuses" },
                  { value: "pending", label: "Pending Review" },
                  { value: "upheld", label: "Upheld" },
                  { value: "overturned", label: "Overturned" }
                ]}
              />
            </div>

            <div style={{ margin: 0, border: "none", borderRadius: 0, overflowX: "auto" }}>
              <table className="tabular-table">
                <thead>
                  <tr>
                    <th>Appeal ID</th>
                    <th>Member</th>
                    <th>Diagnosis Category</th>
                    <th>Requested Service</th>
                    <th>Level</th>
                    <th>Denial Reason</th>
                    <th>Status</th>
                    <th>Resolution</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIntake.length === 0 ? (
                    <tr><td colSpan={8} style={{ padding: "32px", textAlign: "center", color: "var(--text-secondary)" }}>No appeal cases found matching filters.</td></tr>
                  ) : (
                    filteredIntake.map((c: any, index: number) => {
                      const outcome = outcomeBadge[c.appeal_outcome];
                      return (
                        <tr key={`${c.id}-${index}`} style={{ cursor: "pointer" }} onClick={() => router.push(`/workspace/appeal/${c.id}`)}>
                          <td style={{ fontWeight: 600, fontFamily: "monospace", fontSize: "0.85rem", color: "var(--tab-text-dark)" }}>{c.id}</td>
                          <td style={{ fontWeight: 600 }}>{c.member_id || "N/A"}</td>
                          <td>{c.diagnosis_category}</td>
                          <td style={{ maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.requested_service}</td>
                          <td>
                            <span className={`compact-badge c-badge-${c.appeal_level?.includes("Expedited") ? "danger" : c.appeal_level?.includes("Level 2") ? "warning" : "info"}`}>
                              {c.appeal_level?.replace(" - Internal", "").replace(" - External", "") || "L1"}
                            </span>
                          </td>
                          <td style={{ fontSize: "0.82rem" }}>{c.denial_reason_category}</td>
                          <td>
                            {c.appeal_outcome ? (
                              <span className={`compact-badge ${outcome?.cls || "c-badge-info"}`}>{outcome?.label || c.appeal_outcome}</span>
                            ) : (
                              <span className="compact-badge c-badge-warning">Pending Review</span>
                            )}
                          </td>
                          <td style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                            {c.turnaround_days ? `${c.turnaround_days} days` : "—"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Tab 2: Risk Dashboard ═══ */}
      {activeTab === "risk" && (
        <div className="tabular-risk-dashboard">
          <div className="tabular-metrics-ribbon">
            <div className="tabular-metric-item" style={{ background: "rgba(245,158,11,0.08)", borderColor: "rgba(245,158,11,0.3)" }}>
              <span style={{ color: "#F59E0B" }}><AlertTriangle size={14} /></span>
              <span style={{ color: "#F59E0B" }}>CASES W/ RISK:</span>
              <span className="tabular-metric-val">{cases.length}</span>
            </div>
            <div className="tabular-metric-item" style={{ background: "rgba(232,82,26,0.08)", borderColor: "rgba(232,82,26,0.3)" }}>
              <span style={{ color: "#E8521A" }}><TrendingUp size={14} /></span>
              <span style={{ color: "#E8521A" }}>AVG PROBABILITY:</span>
              <span className="tabular-metric-val">{Math.round(dashboardData.avg_overturn_probability * 100)}%</span>
            </div>
          </div>

          {/* Risk Table with Expandable Detail */}
          <div className="tabular-table-container">
            <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--tab-border)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff" }}>
              <h3 style={{ fontSize: "0.95rem", margin: 0, display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, color: "var(--tab-text-dark)" }}>
                <Shield size={16} style={{ color: "#E8521A" }} />
                {userRole === "NURSE" ? "YOUR CASES" : "TEAM CASES"} (APPEAL RISK)
              </h3>
              <span style={{ fontSize: "0.8rem", color: "var(--tab-text)", display: "flex", alignItems: "center", gap: "4px" }}>
                <Info size={14} /> Click row for details
              </span>
            </div>
            {/* Search & Filter Controls */}
            <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border-default)", display: "flex", gap: "12px", background: "var(--bg-hover)", alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: "200px", position: "relative" }}>
                <input
                  type="text"
                  placeholder="Search by Case #, Patient, Diagnosis, or Reviewer..."
                  value={riskSearch}
                  onChange={(e) => setRiskSearch(e.target.value)}
                  className="input"
                  style={{ paddingLeft: "36px", paddingRight: "32px" }}
                />
                <svg style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                {riskSearch && (
                  <button
                    onClick={() => setRiskSearch("")}
                    style={{
                      position: "absolute",
                      right: "10px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "4px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--text-tertiary)",
                      borderRadius: "50%",
                      transition: "background 0.2s"
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <CustomDropdown
                value={riskLevelFilter}
                onChange={setRiskLevelFilter}
                options={[
                  { value: "all", label: "All Risk Levels" },
                  { value: "CRITICAL", label: "Critical" },
                  { value: "HIGH", label: "High" },
                  { value: "MEDIUM", label: "Medium" },
                  { value: "LOW", label: "Low" }
                ]}
              />
              <CustomDropdown
                value={riskDecisionFilter}
                onChange={setRiskDecisionFilter}
                options={[
                  { value: "all", label: "All Decisions" },
                  { value: "DENIED", label: "Denied" },
                  { value: "APPROVED", label: "Approved" }
                ]}
              />
            </div>

            <div style={{ margin: 0, border: "none", borderRadius: 0, overflowX: "auto" }}>
              <table className="tabular-table">
                <thead>
                  <tr>
                    {["Case #", "Patient", "Diagnosis", "Decision", "Overturn Prob", "Risk Level", "Reviewer", ""].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredCases.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: "32px", textAlign: "center", color: "var(--text-secondary)" }}>
                        <Info size={24} style={{ color: "var(--primary)", marginBottom: "8px" }} />
                        <div>No cases found matching filters.</div>
                      </td>
                    </tr>
                  ) : (
                    filteredCases.map((c: any, index: number) => {
                      const isExpanded = expandedRow === c.case_number;
                      const prob = Math.round(c.overturn_probability * 100);
                      const probColor = prob > 60 ? "var(--danger)" : prob > 30 ? "var(--warning)" : "var(--success)";
                      const riskFactors: string[] = c.top_risk_factors || [];
                      const recommendation = c.appeal_recommendation || "";

                      return (
                        <Fragment key={`${c.case_number}-${index}`}>
                          <tr 
                            style={{ cursor: "pointer" }}
                            onClick={() => setExpandedRow(isExpanded ? null : c.case_number)}
                          >
                            <td style={{ fontWeight: 600, fontFamily: "monospace", fontSize: "0.85rem" }}>{c.case_number}</td>
                            <td style={{ fontWeight: 600 }}>{c.patient_name || "N/A"}</td>
                            <td>{c.diagnosis}</td>
                            <td><span className={c.decision === "DENIED" ? "compact-badge c-badge-danger" : "compact-badge c-badge-success"}>{c.decision}</span></td>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <div className="compact-bar-wrap">
                                  <div className="compact-bar-fill" style={{ width: `${prob}%`, background: probColor }} />
                                </div>
                                <span style={{ fontWeight: 700, fontFamily: "monospace", color: probColor }}>{prob}%</span>
                              </div>
                            </td>
                            <td><span className={`compact-badge c-badge-${c.risk_category === "LOW" ? "success" : c.risk_category === "MEDIUM" ? "warning" : "danger"}`}>{c.risk_category}</span></td>

                            <td style={{ color: "var(--text-secondary)" }}>{c.reviewer_name}</td>
                            <td>
                              {isExpanded ? <ChevronUp size={16} style={{ color: "var(--primary)" }} /> : <ChevronDown size={16} style={{ color: "var(--text-tertiary)" }} />}
                            </td>
                          </tr>
                          {/* Expanded Detail Row */}
                          {isExpanded && (
                            <tr key={`${c.case_number}-detail`}>
                              <td colSpan={8} style={{ padding: 0, border: "none" }}>
                                <div style={{
                                  background: "var(--bg-body)", padding: "20px 24px",
                                  borderTop: `2px solid ${probColor}`,
                                  animation: "fadeIn 0.2s ease-out"
                                }}>
                                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                                    {/* Left: Why this probability */}
                                    <div>
                                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                                        <Target size={16} style={{ color: probColor }} />
                                        <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                                          Why {prob}% Overturn Probability?
                                        </span>
                                      </div>
                                      
                                      {riskFactors.length > 0 ? (
                                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                          {riskFactors.map((factor: string, i: number) => (
                                            <div key={i} style={{
                                              display: "flex", gap: "10px", padding: "10px 14px",
                                              background: "var(--bg-surface)", borderRadius: "var(--radius-sm)",
                                              border: "1px solid var(--border-default)", fontSize: "0.85rem",
                                              lineHeight: 1.5, color: "var(--text-secondary)"
                                            }}>
                                              <AlertTriangle size={14} style={{ color: probColor, flexShrink: 0, marginTop: "2px" }} />
                                              <span>{factor}</span>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <div style={{ padding: "16px", background: "rgba(22,163,74,0.05)", borderRadius: "var(--radius-sm)", border: "1px solid rgba(22,163,74,0.15)", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                                          <CheckCircle size={14} style={{ color: "var(--success)", marginRight: "8px" }} />
                                          Low risk — no specific risk factors identified for this case.
                                        </div>
                                      )}
                                    </div>

                                    {/* Right: Recommendation + Summary */}
                                    <div>
                                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                                        <Shield size={16} style={{ color: "var(--primary)" }} />
                                        <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                                          AI Recommendation
                                        </span>
                                      </div>
                                      
                                      <div style={{
                                        padding: "14px 18px", borderRadius: "var(--radius-md)",
                                        background: prob > 45 ? "rgba(239,68,68,0.06)" : prob > 25 ? "rgba(245,158,11,0.06)" : "rgba(22,163,74,0.06)",
                                        border: `1px solid ${prob > 45 ? "rgba(239,68,68,0.15)" : prob > 25 ? "rgba(245,158,11,0.15)" : "rgba(22,163,74,0.15)"}`,
                                        fontSize: "0.88rem", lineHeight: 1.6, color: "var(--text-secondary)",
                                        marginBottom: "14px"
                                      }}>
                                        {recommendation || "Ensure complete documentation for audit trail."}
                                      </div>

                                      {/* Appeal likelihood summary */}
                                      <div style={{
                                        padding: "12px 16px", borderRadius: "var(--radius-sm)",
                                        background: "var(--bg-surface)", border: "1px solid var(--border-default)"
                                      }}>
                                        <div style={{ fontSize: "0.78rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", marginBottom: "8px" }}>
                                          Appeal Likelihood
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                          <div style={{ flex: 1, height: "8px", background: "var(--border-default)", borderRadius: "4px", overflow: "hidden" }}>
                                            <div style={{
                                              height: "100%", width: `${prob}%`, borderRadius: "4px",
                                              background: `linear-gradient(90deg, var(--success), ${prob > 60 ? "var(--danger)" : "var(--warning)"})`,
                                              transition: "width 0.5s"
                                            }} />
                                          </div>
                                          <span style={{ fontWeight: 700, fontSize: "1.1rem", color: probColor }}>{prob}%</span>
                                        </div>
                                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px", fontSize: "0.72rem", color: "var(--text-tertiary)" }}>
                                          <span>Likely Upheld</span>
                                          <span>Likely Overturned</span>
                                        </div>
                                      </div>

                                      {/* Model confidence */}
                                      {c.model_confidence && (
                                        <div style={{ marginTop: "10px", fontSize: "0.78rem", color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: "6px" }}>
                                          <Info size={12} />
                                          Model confidence: {Math.round(c.model_confidence * 100)}%
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
