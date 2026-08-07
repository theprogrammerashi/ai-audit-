"use client";

import { useEffect, useState, Fragment } from "react";
import { AlertTriangle, DollarSign, TrendingUp, Loader2, FileText, Activity, Clock, Scale, CheckCircle, XCircle, X, Users, BarChart3, Shield, ArrowRight, ChevronDown, ChevronUp, Info, Target } from "lucide-react";
import MetricCard from "@/components/shared/MetricCard";
import CustomDropdown from "@/components/shared/CustomDropdown";
import api from "@/lib/api";
import { useRouter } from "next/navigation";

const riskBadge: Record<string, string> = { HIGH: "badge-danger", CRITICAL: "badge-danger", MEDIUM: "badge-warning", LOW: "badge-success" };
const outcomeBadge: Record<string, { cls: string; label: string }> = {
  "Overturned - Full": { cls: "badge-danger", label: "Overturned" },
  "Overturned - Partial": { cls: "badge-warning", label: "Partial Overturn" },
  "Upheld": { cls: "badge-success", label: "Upheld" },
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
          { id: "analytics", label: "Analytics & Outcomes", icon: BarChart3 },
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

      {/* ═══ Tab 1: Appeal Tracker ═══ */}
      {activeTab === "tracker" && (
        <div>
          {/* Summary Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "28px" }}>
            <MetricCard label="Open Appeals" value={openAppeals.toString()} accentColor="var(--warning)" icon={<Clock size={13} />} />
            <MetricCard label="Resolved (Total)" value={resolvedAppeals.toString()} accentColor="var(--success)" icon={<CheckCircle size={13} />} />
            <MetricCard label="Overturn Rate" value={`${overturnRate}%`} accentColor={overturnRate > 40 ? "var(--danger)" : "var(--info)"} icon={<TrendingUp size={13} />} />
            <MetricCard label="Avg Resolution" value={`${Math.round(avgResolutionDays)} days`} accentColor="var(--primary)" icon={<Clock size={13} />} />
          </div>

          {/* Appeal Intake Table */}
          <div className="card" style={{ padding: "0", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-default)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: "1rem", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                <FileText size={18} style={{ color: "var(--primary)" }} /> Appeal Cases
              </h3>
              <div style={{ display: "flex", gap: "8px" }}>
                <span className="badge badge-warning">{openAppeals} Pending</span>
                <span className="badge badge-success">{upheldCount} Upheld</span>
                <span className="badge badge-danger">{overturnedCount} Overturned</span>
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

            <div className="data-table-container" style={{ margin: 0, border: "none", borderRadius: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Appeal ID</th>
                    <th>Member</th>
                    <th>Diagnosis Category</th>
                    <th>Requested Service</th>
                    <th>Level</th>
                    <th>Denial Reason</th>
                    <th>Disputed Amt</th>
                    <th>Status</th>
                    <th>Resolution</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIntake.length === 0 ? (
                    <tr><td colSpan={9} style={{ padding: "32px", textAlign: "center", color: "var(--text-secondary)" }}>No appeal cases found matching filters.</td></tr>
                  ) : (
                    filteredIntake.map((c: any) => {
                      const outcome = outcomeBadge[c.appeal_outcome] || null;
                      return (
                        <tr key={c.id} style={{ cursor: "pointer" }} onClick={() => router.push(`/workspace/appeal/${c.id}`)}>
                          <td style={{ fontWeight: 600, color: "var(--primary)" }}>{c.id}</td>
                          <td>{c.member_id || "N/A"}</td>
                          <td>{c.diagnosis_category}</td>
                          <td style={{ maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.requested_service}</td>
                          <td>
                            <span className={`badge ${c.appeal_level?.includes("Expedited") ? "badge-danger" : c.appeal_level?.includes("Level 2") ? "badge-warning" : "badge-info"}`}>
                              {c.appeal_level?.replace(" - Internal", "").replace(" - External", "") || "L1"}
                            </span>
                          </td>
                          <td style={{ fontSize: "0.82rem" }}>{c.denial_reason_category}</td>
                          <td style={{ fontWeight: 600 }}>${(c.financial_amount_disputed || 0).toLocaleString()}</td>
                          <td>
                            {c.appeal_outcome ? (
                              <span className={`badge ${outcome?.cls || "badge-info"}`}>{outcome?.label || c.appeal_outcome}</span>
                            ) : (
                              <span className="badge badge-warning">Pending Review</span>
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
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "28px" }}>
            <MetricCard label="Total Financial Exposure" value={`$${dashboardData.total_exposure.toLocaleString()}`} accentColor="var(--danger)" icon={<DollarSign size={13} />} />
            <MetricCard label="Cases with Appeal Risk" value={cases.length.toString()} accentColor="var(--warning)" icon={<AlertTriangle size={13} />} />
            <MetricCard label="Avg Overturn Probability" value={`${Math.round(dashboardData.avg_overturn_probability * 100)}%`} accentColor="var(--info)" icon={<TrendingUp size={13} />} />
          </div>

          {/* Risk Table with Expandable Detail */}
          <div className="card" style={{ padding: "0", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-default)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: "1rem", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                <Shield size={18} style={{ color: "var(--danger)" }} />
                {userRole === "NURSE" ? "Your Cases — Appeal Risk Assessment" : "Team Cases — Appeal Risk Assessment"}
              </h3>
              <span style={{ fontSize: "0.8rem", color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: "4px" }}>
                <Info size={14} /> Click any row for detailed risk analysis
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

            <div className="data-table-container" style={{ margin: 0, border: "none", borderRadius: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    {["Case #", "Patient", "Diagnosis", "Decision", "Overturn Probability", "Financial Exposure", "Risk Level", "Reviewer", ""].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredCases.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: "32px", textAlign: "center", color: "var(--text-secondary)" }}>
                        <Info size={24} style={{ color: "var(--primary)", marginBottom: "8px" }} />
                        <div>No cases found matching filters.</div>
                      </td>
                    </tr>
                  ) : (
                    filteredCases.map((c: any) => {
                      const isExpanded = expandedRow === c.case_number;
                      const prob = Math.round(c.overturn_probability * 100);
                      const probColor = prob > 60 ? "var(--danger)" : prob > 30 ? "var(--warning)" : "var(--success)";
                      const riskFactors: string[] = c.top_risk_factors || [];
                      const recommendation = c.appeal_recommendation || "";

                      return (
                        <Fragment key={c.case_number}>
                          <tr 
                            onClick={() => setExpandedRow(isExpanded ? null : c.case_number)}
                            style={{ cursor: "pointer", transition: "background 0.15s" }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "rgba(232,82,26,0.03)"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = ""; }}
                          >
                            <td style={{ fontWeight: 600 }}>{c.case_number}</td>
                            <td>{c.patient_name || "N/A"}</td>
                            <td>{c.diagnosis}</td>
                            <td><span className={c.decision === "DENIED" ? "badge badge-danger" : "badge badge-success"}>{c.decision}</span></td>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <div style={{ width: "60px", height: "6px", background: "var(--border-default)", borderRadius: "3px" }}>
                                  <div style={{ height: "100%", width: `${prob}%`, background: probColor, borderRadius: "3px", transition: "width 0.5s" }} />
                                </div>
                                <span style={{ fontWeight: 600, color: probColor }}>{prob}%</span>
                              </div>
                            </td>
                            <td style={{ fontWeight: 600 }}>${c.financial_exposure.toLocaleString()}</td>
                            <td><span className={`badge ${riskBadge[c.risk_category] || "badge-info"}`}>{c.risk_category}</span></td>
                            <td style={{ color: "var(--text-secondary)" }}>{c.reviewer_name}</td>
                            <td>
                              {isExpanded ? <ChevronUp size={16} style={{ color: "var(--primary)" }} /> : <ChevronDown size={16} style={{ color: "var(--text-tertiary)" }} />}
                            </td>
                          </tr>
                          {/* Expanded Detail Row */}
                          {isExpanded && (
                            <tr key={`${c.case_number}-detail`}>
                              <td colSpan={9} style={{ padding: 0, border: "none" }}>
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

      {/* ═══ Tab 3: Analytics & Outcomes ═══ */}
      {activeTab === "analytics" && (
        <div>
          {/* Financial Impact */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "28px" }}>
            <MetricCard label="Total Disputed" value={`$${(analyticsData.financial_summary.total_disputed || 0).toLocaleString()}`} accentColor="var(--danger)" icon={<DollarSign size={13} />} />
            <MetricCard label="Total Recovered" value={`$${(analyticsData.financial_summary.total_recovered || 0).toLocaleString()}`} accentColor="var(--success)" icon={<DollarSign size={13} />} />
            <MetricCard label="Net Savings" value={`$${((analyticsData.financial_summary.total_disputed || 0) - (analyticsData.financial_summary.total_recovered || 0)).toLocaleString()}`} accentColor="var(--primary)" icon={<TrendingUp size={13} />} />
            <MetricCard label="Appeal Volume" value={intake.length.toString()} accentColor="var(--info)" icon={<FileText size={13} />} />
          </div>

          {/* Outcome Distribution Chart */}
          <div className="card" style={{ marginBottom: "24px" }}>
            <h3 style={{ marginBottom: "20px", fontSize: "1rem", display: "flex", alignItems: "center", gap: "8px" }}>
              <BarChart3 size={18} style={{ color: "var(--primary)" }} /> Appeal Outcome Distribution
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "center" }}>
              {/* Visual bar chart */}
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {[
                  { label: "Overturned", count: outcomeDist.overturned || 0, color: "var(--danger)", bg: "rgba(239,68,68,0.08)" },
                  { label: "Upheld", count: outcomeDist.upheld || 0, color: "var(--success)", bg: "rgba(22,163,74,0.08)" },
                  { label: "Pending", count: outcomeDist.pending || 0, color: "var(--warning)", bg: "rgba(245,158,11,0.08)" },
                ].map((item) => {
                  const pct = totalOutcome > 0 ? Math.round((item.count / totalOutcome) * 100) : 0;
                  return (
                    <div key={item.label}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <div style={{ width: "12px", height: "12px", borderRadius: "3px", background: item.color }} />
                          <span style={{ fontWeight: 500, fontSize: "0.9rem" }}>{item.label}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontWeight: 700, fontSize: "1.1rem", color: item.color }}>{item.count}</span>
                          <span style={{ fontSize: "0.78rem", color: "var(--text-tertiary)" }}>({pct}%)</span>
                        </div>
                      </div>
                      <div style={{ width: "100%", height: "28px", background: item.bg, borderRadius: "var(--radius-sm)", overflow: "hidden", position: "relative" }}>
                        <div style={{
                          height: "100%", width: `${pct}%`, background: item.color,
                          borderRadius: "var(--radius-sm)", transition: "width 0.8s ease-out",
                          minWidth: item.count > 0 ? "4px" : "0",
                          display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: "8px"
                        }}>
                          {pct > 15 && <span style={{ color: "white", fontSize: "0.72rem", fontWeight: 600 }}>{pct}%</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Donut-style summary */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
                <div style={{
                  width: "160px", height: "160px", borderRadius: "50%", position: "relative",
                  background: totalOutcome > 0
                    ? `conic-gradient(
                        var(--danger) 0deg ${(outcomeDist.overturned || 0) / totalOutcome * 360}deg,
                        var(--success) ${(outcomeDist.overturned || 0) / totalOutcome * 360}deg ${((outcomeDist.overturned || 0) + (outcomeDist.upheld || 0)) / totalOutcome * 360}deg,
                        var(--warning) ${((outcomeDist.overturned || 0) + (outcomeDist.upheld || 0)) / totalOutcome * 360}deg 360deg
                      )`
                    : "var(--border-default)",
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  <div style={{
                    width: "110px", height: "110px", borderRadius: "50%", background: "var(--bg-surface)",
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center"
                  }}>
                    <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)" }}>{totalOutcome}</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-tertiary)" }}>Total Appeals</div>
                  </div>
                </div>
                <div style={{ textAlign: "center", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                  {overturnRate > 0 ? `${overturnRate}% overturn rate` : "No resolved appeals yet"}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "24px" }}>
            {/* Overturn Rate by Denial Reason */}
            <div className="card">
              <h3 style={{ marginBottom: "16px", fontSize: "1rem", display: "flex", alignItems: "center", gap: "8px" }}>
                <BarChart3 size={18} style={{ color: "var(--primary)" }} /> Overturn Rate by Denial Reason
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {Object.entries(analyticsData.overturn_rate_by_denial_reason || {}).length === 0 ? (
                  <div style={{ padding: "24px", textAlign: "center", color: "var(--text-tertiary)", fontSize: "0.85rem" }}>No denial data available yet.</div>
                ) : (
                  Object.entries(analyticsData.overturn_rate_by_denial_reason || {}).map(([reason, rate]: [string, any]) => (
                    <div key={reason}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "6px" }}>
                        <span style={{ fontWeight: 500 }}>{reason}</span>
                        <span style={{ fontWeight: 600, color: rate > 0.5 ? "var(--danger)" : rate > 0.3 ? "var(--warning)" : "var(--success)" }}>{Math.round(rate * 100)}%</span>
                      </div>
                      <div style={{ width: "100%", height: "8px", background: "var(--bg-secondary)", borderRadius: "4px" }}>
                        <div style={{ width: `${rate * 100}%`, height: "100%", background: rate > 0.5 ? "var(--danger)" : rate > 0.3 ? "var(--warning)" : "var(--success)", borderRadius: "4px", transition: "width 0.5s" }} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Overturn Rate by Diagnosis */}
            <div className="card">
              <h3 style={{ marginBottom: "16px", fontSize: "1rem", display: "flex", alignItems: "center", gap: "8px" }}>
                <Activity size={18} style={{ color: "var(--primary)" }} /> Overturn Rate by Diagnosis
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {Object.entries(analyticsData.overturn_rate_by_diagnosis || {}).length === 0 ? (
                  <div style={{ padding: "24px", textAlign: "center", color: "var(--text-tertiary)", fontSize: "0.85rem" }}>No diagnosis data available yet.</div>
                ) : (
                  Object.entries(analyticsData.overturn_rate_by_diagnosis || {}).map(([dx, rate]: [string, any]) => (
                    <div key={dx}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "6px" }}>
                        <span style={{ fontWeight: 500 }}>{dx}</span>
                        <span style={{ fontWeight: 600, color: rate > 0.5 ? "var(--danger)" : rate > 0.3 ? "var(--warning)" : "var(--success)" }}>{Math.round(rate * 100)}%</span>
                      </div>
                      <div style={{ width: "100%", height: "8px", background: "var(--bg-secondary)", borderRadius: "4px" }}>
                        <div style={{ width: `${rate * 100}%`, height: "100%", background: "var(--primary)", borderRadius: "4px", transition: "width 0.5s" }} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Turnaround Time & Top Reasons */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
            <div className="card">
              <h3 style={{ marginBottom: "16px", fontSize: "1rem", display: "flex", alignItems: "center", gap: "8px" }}>
                <Clock size={18} style={{ color: "var(--warning)" }} /> Avg Turnaround by Appeal Level
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {Object.entries(analyticsData.avg_turnaround_time_by_level || {}).length === 0 ? (
                  <div style={{ padding: "24px", textAlign: "center", color: "var(--text-tertiary)", fontSize: "0.85rem" }}>No turnaround data yet.</div>
                ) : (
                  Object.entries(analyticsData.avg_turnaround_time_by_level || {}).map(([level, days]: [string, any]) => {
                    const maxDays = level.includes("Expedited") ? 3 : level.includes("Level 2") || level.includes("2nd") ? 60 : 30;
                    const isOverdue = days > maxDays;
                    const pctUsed = Math.min((days / maxDays) * 100, 100);
                    return (
                      <div key={level} style={{
                        padding: "12px 14px", borderRadius: "var(--radius-sm)",
                        background: isOverdue ? "rgba(239,68,68,0.06)" : "rgba(22,163,74,0.04)",
                        border: `1px solid ${isOverdue ? "rgba(239,68,68,0.15)" : "rgba(22,163,74,0.1)"}`
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                          <span style={{ fontSize: "0.88rem", fontWeight: 500 }}>{level}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontWeight: 600, color: isOverdue ? "var(--danger)" : "var(--success)" }}>{Math.round(days)} days</span>
                            <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>/ {maxDays}d limit</span>
                          </div>
                        </div>
                        <div style={{ width: "100%", height: "4px", background: "var(--border-default)", borderRadius: "2px" }}>
                          <div style={{ height: "100%", width: `${pctUsed}%`, background: isOverdue ? "var(--danger)" : "var(--success)", borderRadius: "2px", transition: "width 0.5s" }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Dynamic Top Reasons for Overturn (from DB, not hardcoded) */}
            <div className="card">
              <h3 style={{ marginBottom: "16px", fontSize: "1rem", display: "flex", alignItems: "center", gap: "8px" }}>
                <AlertTriangle size={18} style={{ color: "var(--danger)" }} /> Top Reasons for Overturn
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {(analyticsData.top_reasons_for_overturn || []).length === 0 ? (
                  <div style={{ padding: "24px", textAlign: "center", color: "var(--text-tertiary)", fontSize: "0.85rem" }}>
                    <CheckCircle size={20} style={{ marginBottom: "8px", color: "var(--success)" }} />
                    <div>No overturned cases — no overturn reasons to display.</div>
                  </div>
                ) : (
                  (analyticsData.top_reasons_for_overturn || []).map((reason: string, i: number) => (
                    <div key={i} style={{
                      display: "flex", gap: "10px", fontSize: "0.88rem", color: "var(--text-secondary)",
                      padding: "10px 14px", borderRadius: "var(--radius-sm)",
                      background: "var(--bg-secondary)", border: "1px solid var(--border-default)"
                    }}>
                      <span style={{ 
                        color: "white", fontWeight: 600, flexShrink: 0,
                        width: "22px", height: "22px", borderRadius: "50%",
                        background: "var(--danger)", display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "0.72rem"
                      }}>{i + 1}</span>
                      <span>{reason}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
