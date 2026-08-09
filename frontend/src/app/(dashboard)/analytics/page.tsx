"use client";

import { useEffect, useState } from "react";
import { BarChart3, TrendingUp, TrendingDown, AlertTriangle, ArrowRight, X, Activity, CheckCircle, ShieldAlert, Users, Percent, BookOpen, ArrowUp, ArrowDown, Search, FileText, Clock } from "lucide-react";
import UserAvatar from "@/components/shared/UserAvatar";
import MetricCard from "@/components/shared/MetricCard";
import api from "@/lib/api";
import CustomDropdown from "@/components/shared/CustomDropdown";
import { LineChart, Line, ResponsiveContainer, YAxis, PieChart, Pie, Cell, Tooltip, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from "recharts";

const COLORS = {
  success: "var(--success, #10b981)",
  warning: "var(--warning, #f59e0b)",
  danger: "var(--danger, #ef4444)",
  primary: "var(--primary, #3b82f6)",
  info: "var(--info, #0ea5e9)",
};

const generateMockTrendData = (baseScore: number) => {
  return Array.from({ length: 7 }).map((_, i) => ({
    day: i,
    score: Math.max(60, Math.min(100, baseScore + (Math.random() * 10 - 5)))
  }));
};

const SORT_METRICS = [
  { value: "qa_score_30d", label: "QA Score" },
  { value: "approval_rate", label: "Approval Rate" },
  { value: "overturn_rate", label: "Overturn Rate" },
  { value: "documentation_score", label: "Documentation Score" },
  { value: "policy_compliance", label: "Compliance" },
  { value: "case_volume_30d", label: "Volume" },
];

export default function AnalyticsPage() {
  const [reviewers, setReviewers] = useState<any[]>([]);
  const [teamStats, setTeamStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedReviewer, setSelectedReviewer] = useState<string | null>(null);
  const [reviewerDetail, setReviewerDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [sortMetric, setSortMetric] = useState("qa_score_30d");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("nurse-analytics");
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [intakeData, setIntakeData] = useState<any[]>([]);

  useEffect(() => {
    fetchTeamStats();
  }, []);

  const fetchTeamStats = async () => {
    try {
      setLoading(true);
      const [res, analyticsRes, intakeRes] = await Promise.all([
        api.get("/analytics/team"),
        api.get("/appeal/analytics"),
        api.get("/appeal/intake-cases")
      ]);
      setReviewers(res.data.reviewers || []);
      setTeamStats({
        team_avg_qa_score: res.data.team_avg_qa_score,
        team_avg_approval_rate: res.data.team_avg_approval_rate,
        total_cases: res.data.total_cases
      });
      setAnalyticsData(analyticsRes.data);
      setIntakeData(intakeRes.data);
    } catch (err) {
      console.error("Failed to fetch team analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleReviewerClick = async (id: string) => {
    setSelectedReviewer(id);
    setDetailLoading(true);
    try {
      const res = await api.get(`/analytics/reviewer/${id}/detail`);
      setReviewerDetail(res.data);
    } catch (err) {
      console.error("Failed to fetch reviewer detail:", err);
    } finally {
      setDetailLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "32px", display: "flex", justifyContent: "center", alignItems: "center", height: "100%", flexDirection: "column", gap: "16px" }}>
        <div style={{ width: "40px", height: "40px", border: "3px solid var(--border-default)", borderTopColor: "var(--primary)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        <p style={{ color: "var(--text-secondary)" }}>Loading intelligence data...</p>
      </div>
    );
  }

  // Handle Empty State
  if (reviewers.length === 0) {
    return (
      <div style={{ padding: "32px", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
        <div style={{ background: "var(--bg-surface)", padding: "48px", borderRadius: "var(--radius-xl)", border: "1px solid var(--border-default)", maxWidth: "500px", width: "100%" }}>
          <BarChart3 size={64} style={{ color: "var(--text-tertiary)", margin: "0 auto 24px" }} />
          <h2 style={{ fontSize: "1.5rem", marginBottom: "8px" }}>No Analytics Data Available</h2>
          <p style={{ color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: "24px" }}>
            There is currently no reviewer statistics available for your team. This usually happens when your team has not processed any cases in the past 30 days, or you have no nurses assigned to you.
          </p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>Refresh Dashboard</button>
        </div>
      </div>
    );
  }

  // Compute intake stats for Outcomes tab
  const intake = intakeData || [];
  const openAppeals = intake.filter((c: any) => !c.appeal_outcome).length;
  const resolvedAppeals = intake.filter((c: any) => c.appeal_outcome).length;
  const overturnedCount = intake.filter((c: any) => c.appeal_outcome && c.appeal_outcome.includes("Overturned")).length;
  const upheldCount = intake.filter((c: any) => c.appeal_outcome === "Upheld").length;
  const overturnRate = resolvedAppeals > 0 ? Math.round((overturnedCount / resolvedAppeals) * 100) : 0;
  const avgResolutionDays = intake.filter((c: any) => c.turnaround_days).reduce((sum: number, c: any) => sum + (c.turnaround_days || 0), 0) / (resolvedAppeals || 1);

  // Outcome distribution from analytics
  const outcomeDist = analyticsData?.outcome_distribution || {};
  const totalOutcome = (outcomeDist.overturned || 0) + (outcomeDist.upheld || 0) + (outcomeDist.pending || 0);

  return (
    <div className="animate-fade-in" style={{ padding: "32px", display: "flex", gap: "24px", height: "100%" }}>
      {/* Main List */}
      <div style={{ flex: selectedReviewer ? "1" : "1", transition: "all 0.3s ease", display: "flex", flexDirection: "column" }}>
        <div className="page-header" style={{ marginBottom: "24px" }}>
          <h1 style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <BarChart3 size={28} style={{ color: "var(--primary)" }} /> Analytics</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Individual and team performance intelligence</p>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: "flex", gap: "4px", borderBottom: "1px solid var(--border-default)", marginBottom: "32px", paddingBottom: "0" }}>
          {[
            { id: "nurse-analytics", label: "Nurse Analytics", icon: Users },
            { id: "analytics-outcomes", label: "Analytics & Outcomes", icon: BarChart3 },
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

        {activeTab === "nurse-analytics" && (
          <>

        {/* Team KPI Header */}
        {teamStats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "28px" }}>
            <div className="metric-card" style={{ borderTopColor: "var(--primary)" }}>
              <div style={{ background: "var(--primary-light)", padding: "12px", borderRadius: "10px", color: "var(--primary)", width: "40px", height: "40px", marginBottom: "12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Activity size={20} />
              </div>
              <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem", fontWeight: 500, marginBottom: "4px" }}>Avg QA Score</div>
              <div style={{ fontSize: "1.75rem", fontWeight: 700 }}>{teamStats.team_avg_qa_score}%</div>
            </div>

            <div className="metric-card" style={{ borderTopColor: "var(--success)" }}>
              <div style={{ background: "var(--success-light)", padding: "12px", borderRadius: "10px", color: "var(--success)", width: "40px", height: "40px", marginBottom: "12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Percent size={20} />
              </div>
              <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem", fontWeight: 500, marginBottom: "4px" }}>Avg Approval Rate</div>
              <div style={{ fontSize: "1.75rem", fontWeight: 700 }}>{Math.round(teamStats.team_avg_approval_rate * 100)}%</div>
            </div>

            <div className="metric-card" style={{ borderTopColor: "var(--warning)" }}>
              <div style={{ background: "var(--warning-light)", padding: "12px", borderRadius: "10px", color: "var(--warning)", width: "40px", height: "40px", marginBottom: "12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <BookOpen size={20} />
              </div>
              <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem", fontWeight: 500, marginBottom: "4px" }}>Total Volume (30d)</div>
              <div style={{ fontSize: "1.75rem", fontWeight: 700 }}>{teamStats.total_cases}</div>
            </div>
          </div>
        )}

        {/* Filter Bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
          <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px", color: "var(--text-secondary)" }}>
            <Users size={16} /> Reviewer Standings
          </h2>

          <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
            {/* Search Input */}
            <div style={{ position: "relative", width: "200px" }}>
              <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search nurse name..."
                className="input"
                style={{ paddingLeft: "30px", paddingRight: searchQuery ? "28px" : "10px", fontSize: "0.82rem", width: "100%", height: "34px" }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  style={{
                    position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)",
                    display: "flex", alignItems: "center", justifyContent: "center", padding: "2px",
                    borderRadius: "50%"
                  }}
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Sort Dropdown */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <label style={{ fontSize: "0.8rem", color: "var(--text-tertiary)", fontWeight: 500 }}>Sort:</label>
              <CustomDropdown
                value={sortMetric}
                onChange={setSortMetric}
                options={SORT_METRICS}
                width="160px"
              />

              <div style={{ display: "flex", background: "var(--bg-body)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", overflow: "hidden", height: "34px" }}>
                <button
                  onClick={() => setSortOrder("asc")}
                  style={{
                    background: sortOrder === "asc" ? "var(--primary)" : "none",
                    color: sortOrder === "asc" ? "white" : "var(--text-secondary)",
                    border: "none",
                    padding: "0 10px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.2s"
                  }}
                  title="Sort Ascending"
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  onClick={() => setSortOrder("desc")}
                  style={{
                    background: sortOrder === "desc" ? "var(--primary)" : "none",
                    color: sortOrder === "desc" ? "white" : "var(--text-secondary)",
                    border: "none",
                    padding: "0 10px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.2s"
                  }}
                  title="Sort Descending"
                >
                  <ArrowDown size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Nurses Grid List */}
        {(() => {
          const filteredReviewers = reviewers.filter((r) =>
            (r.name || "").toLowerCase().includes(searchQuery.toLowerCase())
          );

          const sortedReviewers = [...filteredReviewers].sort((a, b) => {
            const valA = a[sortMetric] ?? 0;
            const valB = b[sortMetric] ?? 0;

            if (valA === valB) return 0;
            return sortOrder === "asc"
              ? (valA > valB ? 1 : -1)
              : (valA < valB ? 1 : -1);
          });

          return (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px", overflowY: "auto", paddingRight: "4px" }}>
              {sortedReviewers.map((r) => {
                const trendColor = r.trend === "IMPROVING" ? COLORS.success : r.trend === "DECLINING" ? COLORS.danger : COLORS.info;
                const scoreColor = (r.qa_score_30d || 0) >= 90 ? COLORS.success : (r.qa_score_30d || 0) >= 80 ? COLORS.warning : COLORS.danger;
                const hasGaps = r.top_gaps && r.top_gaps.length > 0;

                return (
                  <div

                    key={r.reviewer_id}
                    className="card"
                    style={{
                      padding: "24px 20px",
                      cursor: "pointer",
                      border: selectedReviewer === r.reviewer_id ? `2px solid var(--primary)` : "1px solid var(--border-default)",
                      boxShadow: selectedReviewer === r.reviewer_id ? "var(--shadow-lg)" : "var(--shadow-sm)",
                      transition: "all 0.2s ease",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      textAlign: "center",
                      position: "relative"
                    }}
                    onClick={() => handleReviewerClick(r.reviewer_id)}
                  >
                    {/* Yellow Exclamation Mark for gaps */}
                    {hasGaps && (
                      <div
                        style={{ position: "absolute", top: "14px", right: "14px", cursor: "help" }}
                        title={`Identified Gaps: ${r.top_gaps.map((g: string) => g.replace(/_/g, ' ')).join(", ")}`}
                      >
                        <AlertTriangle size={20} style={{ color: "var(--warning)" }} />
                      </div>
                    )}

                    {/* Profile Circle */}
                    <div style={{ marginBottom: "14px" }}>
                      <UserAvatar name={r.name} size={64} />
                    </div>

                    {/* Name */}
                    <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--text-primary)", marginBottom: "4px" }}>{r.name}</div>
                    {/* NPI */}
                    <div style={{ fontSize: "0.78rem", color: "var(--text-tertiary)", fontWeight: 500, marginBottom: "14px" }}>
                      NPI: <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{r.reviewer_id.split('-')[1] || r.reviewer_id}</span>
                    </div>

                    {/* QA Score Display */}
                    <div style={{ marginBottom: "16px", padding: "10px 16px", background: "var(--bg-body)", borderRadius: "var(--radius-md)", width: "100%" }}>
                      <div style={{ fontSize: "1.85rem", fontWeight: 800, color: scoreColor, lineHeight: 1 }}>{r.qa_score_30d || 0}%</div>
                      <div style={{ fontSize: "0.7rem", color: "var(--text-tertiary)", marginTop: "4px", fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase" }}>QA Score</div>
                    </div>

                    {/* Trend Badge */}
                    <span className={`badge`} style={{ background: `${trendColor}15`, color: trendColor, border: `1px solid ${trendColor}30`, fontSize: "0.72rem", padding: "4px 10px" }}>
                      {r.trend === "IMPROVING" ? <TrendingUp size={11} /> : r.trend === "DECLINING" ? <TrendingDown size={11} /> : <Activity size={11} />}
                      <span style={{ marginLeft: "4px", fontWeight: 600 }}>{r.trend}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })()}
        </>
      )}

      {/* Drill-down Modal */}
      {selectedReviewer && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", justifyContent: "center", alignItems: "center", backdropFilter: "blur(4px)" }} onClick={() => setSelectedReviewer(null)}>
          <div style={{ width: "900px", maxHeight: "90vh", background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-xl)", padding: "32px", overflowY: "auto", display: "flex", flexDirection: "column", boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", paddingBottom: "16px", borderBottom: "1px solid var(--border-default)" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Intelligence Deep Dive</h2>
              <button onClick={() => setSelectedReviewer(null)} style={{ padding: "8px", background: "var(--bg-hover)", border: "none", borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={18} style={{ color: "var(--text-secondary)" }} />
              </button>
            </div>

            {detailLoading || !reviewerDetail ? (
              <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column", gap: "16px" }}>
                <div style={{ width: "32px", height: "32px", border: "3px solid var(--border-default)", borderTopColor: "var(--primary)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                <p style={{ color: "var(--text-tertiary)" }}>Analyzing reviewer data...</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>

                {/* Profile Header */}
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <UserAvatar name={reviewerDetail.reviewer.full_name} size={64} />
                  <div>
                    <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "4px" }}>{reviewerDetail.reviewer.full_name}</h3>
                    <div style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>{reviewerDetail.reviewer.email}</div>
                    <div style={{ color: "var(--text-tertiary)", fontSize: "0.8rem", marginTop: "4px" }}>NPI: {reviewerDetail.reviewer.employee_id}</div>
                  </div>
                </div>

                {/* AI Summary */}
                <div style={{ background: "linear-gradient(to right, rgba(59, 130, 246, 0.05), rgba(59, 130, 246, 0.1))", padding: "20px", borderRadius: "var(--radius-lg)", border: "1px solid rgba(59, 130, 246, 0.2)" }}>
                  <h3 style={{ fontSize: "0.95rem", color: "var(--primary)", display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px", fontWeight: 600 }}>
                    <Activity size={18} /> Copilot Performance Analysis
                  </h3>
                  <p style={{ fontSize: "0.9rem", lineHeight: 1.6, color: "var(--text-primary)" }}>
                    {reviewerDetail.ai_summary}
                  </p>
                </div>

                {/* Peer Benchmarking Radar Chart */}
                <div>
                  <h3 style={{ fontSize: "1.05rem", fontWeight: 600, marginBottom: "16px", color: "var(--text-primary)" }}>Peer Benchmarking</h3>

                  <div style={{ background: "var(--bg-body)", padding: "16px", borderRadius: "var(--radius-lg)" }}>
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <RadarChart width={460} height={280} cx="50%" cy="50%" outerRadius="75%" data={[
                        { subject: 'Clinical Accuracy', A: reviewerDetail.stats.qa_score_30d || 75, B: teamStats?.team_avg_qa_score || 85, fullMark: 100 },
                        { subject: 'Documentation', A: reviewerDetail.stats.documentation_score || 75, B: 88, fullMark: 100 },
                        { subject: 'Compliance', A: reviewerDetail.stats.policy_compliance || 75, B: 92, fullMark: 100 },
                        { subject: 'Consistency', A: reviewerDetail.stats.consistency_score || 75, B: 85, fullMark: 100 },
                      ]}>
                        <PolarGrid stroke="var(--border-default)" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                        <Radar name={reviewerDetail.reviewer.full_name} dataKey="A" stroke="#E8521A" fill="#E8521A" fillOpacity={0.35} strokeWidth={2} />
                        <Radar name="Team Average" dataKey="B" stroke="#6B7280" fill="transparent" strokeDasharray="4 4" strokeWidth={1.5} />
                        <Tooltip
                          formatter={(value: any, name: any) => [`${Number(value).toFixed(1)}%`, name]}
                          contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '8px', fontSize: '0.85rem' }}
                        />
                      </RadarChart>
                    </div>
                    <div style={{ display: "flex", justifyContent: "center", gap: "24px", marginTop: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                        <div style={{ width: "12px", height: "12px", background: "#E8521A", borderRadius: "2px", opacity: 0.5 }}></div>
                        {reviewerDetail.reviewer.full_name}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                        <div style={{ width: "12px", height: "2px", background: "#6B7280", borderTop: "2px dashed #6B7280" }}></div>
                        Team Average
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actionable Coaching Plan */}
                <div>
                  <h3 style={{ fontSize: "1.05rem", fontWeight: 600, marginBottom: "16px", color: "var(--text-primary)" }}>Actionable Coaching Plan</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {(reviewerDetail.stats.top_gaps || []).slice(0, 3).map((gap: any, i: number) => {
                      const gapArea = typeof gap === 'string' ? gap.replace(/_/g, ' ') : (gap.area || gap.name || 'General');
                      const gapRec = typeof gap === 'string'
                        ? `Assign interactive module on ${gap.replace(/_/g, ' ').toLowerCase()} criteria. Monitor next 10 decisions for improvement.`
                        : (gap.recommendation || gap.coaching || `Focus on improving ${gapArea.toLowerCase()} performance.`);
                      const gapScore = typeof gap === 'object' ? gap.score : null;
                      return (
                        <div key={i} style={{ display: "flex", gap: "14px", background: "var(--bg-body)", padding: "18px", borderRadius: "var(--radius-md)", borderLeft: `3px solid ${i === 0 ? 'var(--danger)' : i === 1 ? 'var(--warning)' : 'var(--info)'}` }}>
                          <div style={{ width: "28px", height: "28px", borderRadius: "50%", flexShrink: 0, background: i === 0 ? 'rgba(220,38,38,0.1)' : i === 1 ? 'rgba(217,119,6,0.1)' : 'rgba(37,99,235,0.1)', color: i === 0 ? 'var(--danger)' : i === 1 ? 'var(--warning)' : 'var(--info)', display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem", fontWeight: 700 }}>
                            {i + 1}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                              <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{gapArea}</span>
                              {gapScore != null && (
                                <span style={{ fontSize: "0.75rem", color: gapScore >= 85 ? "var(--success)" : gapScore >= 70 ? "var(--warning)" : "var(--danger)", fontWeight: 600 }}>
                                  {Number(gapScore).toFixed(1)}%
                                </span>
                              )}
                            </div>
                            <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem", lineHeight: 1.6 }}>
                              {gapRec}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {(!reviewerDetail.stats.top_gaps || reviewerDetail.stats.top_gaps.length === 0) && (
                      <div style={{ padding: "20px", background: "rgba(22,163,74,0.05)", borderRadius: "var(--radius-md)", border: "1px solid rgba(22,163,74,0.15)", textAlign: "center", color: "var(--success)", fontSize: "0.9rem" }}>
                        <CheckCircle size={18} style={{ marginBottom: "6px" }} />
                        <p style={{ margin: "4px 0 0" }}>All performance dimensions meet benchmarks. No coaching gaps identified.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Recent Cases */}
                <div>
                  <h3 style={{ fontSize: "1.05rem", fontWeight: 600, marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    Recent Decisions
                    <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", fontWeight: 500, background: "var(--bg-body)", padding: "4px 8px", borderRadius: "100px" }}>Last 10 cases</span>
                  </h3>

                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {reviewerDetail.recent_cases.map((c: any) => (
                      <div key={c.case_number} style={{ padding: "16px", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", background: "var(--bg-body)", transition: "all 0.2s" }} className="hover-lift">
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", alignItems: "center" }}>
                          <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--primary)" }}>{c.case_number}</span>
                          <span className={`badge ${c.decision === 'APPROVED' ? 'badge-success' : c.decision === 'DENIED' ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: "0.7rem", padding: "4px 8px" }}>
                            {c.decision}
                          </span>
                        </div>

                        <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "12px", lineHeight: 1.4 }}>
                          <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{c.patient_name}</span> • {c.primary_diagnosis_display || c.diagnosis}
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "12px", borderTop: "1px dashed var(--border-default)" }}>
                          <span style={{ fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "6px", fontWeight: 500 }}>
                            <CheckCircle size={14} style={{ color: c.qa_score >= 80 ? "var(--success)" : "var(--danger)" }} />
                            QA Score: <span style={{ color: c.qa_score >= 80 ? "var(--success)" : "var(--danger)" }}>{c.qa_score}%</span>
                          </span>
                          <span style={{ fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "6px", fontWeight: 500, color: (c.risk_level === 'CRITICAL' || c.risk_level === 'HIGH') ? 'var(--danger)' : 'var(--text-tertiary)' }}>
                            <ShieldAlert size={14} />
                            Risk: {c.risk_level}
                          </span>
                        </div>
                      </div>
                    ))}
                    {reviewerDetail.recent_cases.length === 0 && (
                      <div style={{ padding: "32px", textAlign: "center", background: "var(--bg-body)", borderRadius: "var(--radius-md)", color: "var(--text-tertiary)", fontSize: "0.9rem" }}>
                        No recent cases found for this reviewer.
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      )}

        {activeTab === "analytics-outcomes" && analyticsData && (
          <div>
            {/* Financial Impact */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "28px" }}>
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
    </div>
  );
}
