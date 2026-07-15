"use client";

import { useEffect, useState } from "react";
import { BarChart3, TrendingUp, TrendingDown, AlertTriangle, ArrowRight, X, Activity, CheckCircle, ShieldAlert, Users, Percent, BookOpen } from "lucide-react";
import UserAvatar from "@/components/shared/UserAvatar";
import api from "@/lib/api";
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

export default function AnalyticsPage() {
  const [reviewers, setReviewers] = useState<any[]>([]);
  const [teamStats, setTeamStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedReviewer, setSelectedReviewer] = useState<string | null>(null);
  const [reviewerDetail, setReviewerDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    fetchTeamStats();
  }, []);

  const fetchTeamStats = async () => {
    try {
      setLoading(true);
      const res = await api.get("/analytics/team");
      setReviewers(res.data.reviewers || []);
      setTeamStats({
        team_avg_qa_score: res.data.team_avg_qa_score,
        team_avg_approval_rate: res.data.team_avg_approval_rate,
        total_cases: res.data.total_cases
      });
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

  return (
    <div className="animate-fade-in" style={{ padding: "32px", display: "flex", gap: "24px", height: "100%" }}>
      {/* Main List */}
      <div style={{ flex: selectedReviewer ? "1" : "1", transition: "all 0.3s ease", display: "flex", flexDirection: "column" }}>
        <div className="page-header">
          <h1 style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <BarChart3 size={28} style={{ color: "var(--primary)" }} /> Reviewer Analytics</h1><p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Individual and team performance intelligence</p>
        </div>

        {/* Team KPI Header */}
        {teamStats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "28px" }}>
            <div className="metric-card" style={{ borderTopColor: "var(--primary)" }}>
              <div style={{ background: "var(--primary-light)", padding: "12px", borderRadius: "10px", color: "var(--primary)", width: "40px", height: "40px", marginBottom: "12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Activity size={20} />
              </div>
              <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem", fontWeight: 500, marginBottom: "4px" }}>Team Avg QA Score</div>
              <div style={{ fontSize: "1.75rem", fontWeight: 700 }}>{teamStats.team_avg_qa_score}%</div>
            </div>
            
            <div className="metric-card" style={{ borderTopColor: "var(--success)" }}>
              <div style={{ background: "var(--success-light)", padding: "12px", borderRadius: "10px", color: "var(--success)", width: "40px", height: "40px", marginBottom: "12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Percent size={20} />
              </div>
              <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem", fontWeight: 500, marginBottom: "4px" }}>Team Avg Approval Rate</div>
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

        {/* Nurses List */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", overflowY: "auto", paddingRight: "4px" }}>
          {reviewers.map((r) => {
            const trendColor = r.trend === "IMPROVING" ? COLORS.success : r.trend === "DECLINING" ? COLORS.danger : COLORS.info;
            const scoreColor = (r.qa_score_30d || 0) >= 90 ? COLORS.success : (r.qa_score_30d || 0) >= 80 ? COLORS.warning : COLORS.danger;
            const trendData = generateMockTrendData(r.qa_score_30d || 85);

            return (
              <div 
                key={r.reviewer_id} 
                className="card" 
                style={{ 
                  padding: "20px 24px", 
                  cursor: "pointer",
                  border: selectedReviewer === r.reviewer_id ? `2px solid var(--primary)` : "1px solid var(--border-default)",
                  boxShadow: selectedReviewer === r.reviewer_id ? "0 4px 12px rgba(0,0,0,0.05)" : "none",
                  transition: "all 0.2s ease"
                }}
                onClick={() => handleReviewerClick(r.reviewer_id)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <UserAvatar name={r.name} size={48} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "1.1rem" }}>{r.name}</div>
                      <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
                        <span className={`badge`} style={{ background: `${trendColor}15`, color: trendColor, border: `1px solid ${trendColor}30` }}>
                          {r.trend === "IMPROVING" ? <TrendingUp size={12} /> : r.trend === "DECLINING" ? <TrendingDown size={12} /> : <Activity size={12} />} 
                          {r.trend}
                        </span>
                        {r.peer_percentile && <span className="badge badge-primary">P{r.peer_percentile}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Sparkline Chart */}
                  <div style={{ width: "120px", height: "40px", margin: "0 24px" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendData}>
                        <YAxis domain={['dataMin - 5', 'dataMax + 5']} hide />
                        <Line type="monotone" dataKey="score" stroke={scoreColor} strokeWidth={2} dot={false} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div style={{ textAlign: "right", display: "flex", alignItems: "center", gap: "20px" }}>
                    <div>
                      <div style={{ fontSize: "2.2rem", fontWeight: 700, color: scoreColor, lineHeight: 1 }}>{r.qa_score_30d || 0}%</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginTop: "4px", fontWeight: 500, letterSpacing: "0.5px", textTransform: "uppercase" }}>QA Score</div>
                    </div>
                    <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "var(--bg-hover)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <ArrowRight size={18} style={{ color: "var(--text-secondary)" }} />
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px", background: "var(--bg-body)", padding: "16px", borderRadius: "var(--radius-md)" }}>
                  {[
                    { label: "Approval Rate", value: `${Math.round((r.approval_rate || 0) * 100)}%` },
                    { label: "Overturn Rate", value: `${Math.round((r.overturn_rate || 0) * 100)}%` },
                    { label: "Doc Score", value: `${(r.documentation_score || 0).toFixed(2)}%` },
                    { label: "Compliance", value: `${(r.policy_compliance || 0).toFixed(2)}%` },
                    { label: "Volume (30d)", value: r.case_volume_30d?.toString() || "0" },
                  ].map((m) => (
                    <div key={m.label} style={{ textAlign: "center", position: "relative" }}>
                      <div className="label" style={{ marginBottom: "6px" }}>{m.label}</div>
                      <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--text-primary)" }}>{m.value}</div>
                      {/* Divider */}
                      {m.label !== "Volume (30d)" && (
                        <div style={{ position: "absolute", right: "-6px", top: "10%", height: "80%", width: "1px", background: "var(--border-default)" }} />
                      )}
                    </div>
                  ))}
                </div>

                {r.top_gaps && r.top_gaps.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginTop: "16px", padding: "0 4px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--warning)", fontSize: "0.85rem", fontWeight: 600 }}>
                      <AlertTriangle size={16} /> Gaps:
                    </div>
                    {r.top_gaps.map((g: string) => (
                      <span key={g} style={{ fontSize: "0.75rem", background: "rgba(245, 158, 11, 0.1)", color: "var(--warning)", padding: "4px 10px", borderRadius: "100px", fontWeight: 500, border: "1px solid rgba(245, 158, 11, 0.2)" }}>
                        {g.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

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
                        <span style={{ fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "6px", fontWeight: 500, color: c.risk_level === 'CRITICAL' ? 'var(--danger)' : c.risk_level === 'HIGH' ? 'var(--warning)' : 'var(--text-tertiary)' }}>
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
    </div>
  );
}
