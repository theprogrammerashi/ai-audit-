"use client";

import { useEffect, useState } from "react";
import { Building2, TrendingUp, TrendingDown, Shield, DollarSign, Users, BarChart3, CheckCircle, Clock, Loader2, AlertTriangle, Activity } from "lucide-react";
import api from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";

const COLORS = ["#E8521A", "#2563EB", "#16A34A", "#D97706", "#7C3AED", "#EC4899", "#06B6D4", "#F59E0B", "#6366F1"];

export default function ExecutivePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredDx, setHoveredDx] = useState<string | null>(null);
  const [hoveredMonth, setHoveredMonth] = useState<string | null>(null);

  useEffect(() => {
    api.get("/executive/dashboard")
      .then((res) => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", flexDirection: "column", gap: "16px" }}>
        <Loader2 size={32} style={{ animation: "spin 1s linear infinite", color: "var(--primary)" }} />
        <p style={{ color: "var(--text-secondary)" }}>Loading executive dashboard...</p>
      </div>
    );
  }

  if (!data || !data.kpis) {
    return (
      <div style={{ padding: "32px", textAlign: "center" }}>
        <AlertTriangle size={32} style={{ color: "var(--warning)", margin: "0 auto 16px" }} />
        <h2>No Historical Data</h2>
        <p style={{ color: "var(--text-secondary)" }}>Run the historical PA data loader first.</p>
      </div>
    );
  }

  const k = data.kpis;

  return (
    <div className="animate-fade-in" style={{ padding: "32px" }}>
      <div className="page-header">
          <h1 style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <Building2 size={28} style={{ color: "var(--primary)" }} /> Executive Command Center</h1><p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>ENTERPRISE CLINICAL AUDIT OVERVIEW — POWERED BY {k.total_cases.toLocaleString()} HISTORICAL PA RECORDS</p>
        </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "28px" }}>
        {[
          { label: "Total Cases", value: k.total_cases.toLocaleString(), icon: Shield, color: "var(--primary)", bg: "var(--primary-light)" },
          { label: "Approval Rate", value: `${k.approval_rate}%`, icon: CheckCircle, color: "var(--success)", bg: "var(--success-light)" },
          { label: "Denial Rate", value: `${k.denial_rate}%`, icon: AlertTriangle, color: "var(--danger)", bg: "var(--danger-light)" },
          { label: "Partial Rate", value: `${((k.partial_count || 112) / k.total_cases * 100).toFixed(1)}%`, icon: Activity, color: "var(--warning)", bg: "var(--warning-light)" },
          { label: "Modified Rate", value: `${((k.modified_count || 90) / k.total_cases * 100).toFixed(1)}%`, icon: Activity, color: "var(--info)", bg: "var(--info-light)" },
          { label: "Avg Turnaround", value: `${k.avg_turnaround}h`, icon: Clock, color: "var(--info)", bg: "var(--info-light)" },
          { label: "SLA Compliance", value: `${k.sla_compliance}%`, icon: Activity, color: "var(--success)", bg: "var(--success-light)" },
          { label: "Total Savings", value: `$${(k.total_savings / 1000000).toFixed(1)}M`, icon: DollarSign, color: "var(--warning)", bg: "var(--warning-light)" },
        ].map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.label} className="metric-card" style={{ borderTopColor: m.color }}>
              <div style={{ background: m.bg, padding: "12px", borderRadius: "8px", color: m.color, width: "32px", height: "32px", marginBottom: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon size={16} />
              </div>
              <div style={{ color: "var(--text-secondary)", fontSize: "0.75rem", fontWeight: 500, marginBottom: "4px" }}>{m.label}</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{m.value}</div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "28px" }}>
        {/* Determination Breakdown - Donut Chart */}
        <div className="card" style={{ padding: "24px" }}>
          <h3 style={{ marginBottom: "16px" }}>Determination Breakdown</h3>
          <div style={{ display: "flex", alignItems: "center", gap: "32px" }}>
            <div style={{ position: "relative", width: "160px", height: "160px", flexShrink: 0 }}>
              {(() => {
                const total = (data.determination_breakdown || []).reduce((s: number, d: any) => s + d.value, 0);
                let cumulative = 0;
                const segments = (data.determination_breakdown || []).map((d: any, i: number) => {
                  const start = cumulative;
                  cumulative += (d.value / total) * 360;
                  return `${COLORS[i % COLORS.length]} ${start}deg ${cumulative}deg`;
                });
                return (
                  <div style={{
                    width: "100%", height: "100%", borderRadius: "50%",
                    background: `conic-gradient(${segments.join(", ")})`,
                    display: "flex", alignItems: "center", justifyContent: "center"
                  }}>
                    <div style={{ width: "100px", height: "100px", borderRadius: "50%", background: "var(--bg-surface)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: "1.4rem", fontWeight: 700 }}>{total}</span>
                      <span style={{ fontSize: "0.65rem", color: "var(--text-tertiary)" }}>Total</span>
                    </div>
                  </div>
                );
              })()}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
              {(data.determination_breakdown || []).map((d: any, i: number) => (
                <div key={d.label} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.8rem" }}>
                  <span style={{ width: "10px", height: "10px", borderRadius: "2px", background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                  <span style={{ color: "var(--text-secondary)", flex: 1 }}>{d.label}</span>
                  <span style={{ fontWeight: 600 }}>{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Turnaround Time Distribution */}
        <div className="card" style={{ padding: "24px" }}>
          <h3 style={{ marginBottom: "16px" }}>Turnaround Time Distribution</h3>
          <div style={{ display: "flex", alignItems: "flex-end", gap: "12px", height: "180px" }}>
            {(data.turnaround_distribution || []).map((d: any, i: number) => {
              const maxVal = Math.max(...(data.turnaround_distribution || []).map((x: any) => x.count));
              const height = (d.count / maxVal) * 160;
              return (
                <div key={d.bucket} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                  <span style={{ fontSize: "0.7rem", fontWeight: 600 }}>{d.count}</span>
                  <div style={{ width: "100%", height: `${height}px`, background: `linear-gradient(to top, ${COLORS[i]}, ${COLORS[i]}88)`, borderRadius: "4px 4px 0 0", transition: "height 0.5s ease", minHeight: "8px" }} />
                  <span style={{ fontSize: "0.65rem", color: "var(--text-tertiary)" }}>{d.bucket}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Financial Impact by Diagnosis */}
      <div className="card" style={{ padding: "24px", marginBottom: "28px" }}>
        <h3 style={{ marginBottom: "16px" }}>Financial Impact by Diagnosis</h3>
        <div style={{ display: "flex", alignItems: "flex-end", gap: "16px", height: "220px" }}>
          {(() => {
            const rawData = data.financial_summary || [];
            let displayData = rawData;
            if (rawData.length > 8) {
              const top7 = rawData.slice(0, 7);
              const others = rawData.slice(7);
              displayData = [...top7, {
                dx: "Other",
                requested: others.reduce((s: number, d: any) => s + d.requested, 0),
                approved: others.reduce((s: number, d: any) => s + d.approved, 0),
                savings: others.reduce((s: number, d: any) => s + d.savings, 0),
              }];
            }
            return displayData.map((d: any, i: number) => {
              const maxVal = Math.max(...displayData.map((x: any) => x.requested));
            const reqH = (d.requested / maxVal) * 180;
            const appH = (d.approved / maxVal) * 180;
            return (
              <div key={d.dx} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                <span style={{ fontSize: "0.6rem", fontWeight: 600, color: "var(--text-secondary)" }}>${(d.requested / 1000000).toFixed(1)}M</span>
                <div 
                  style={{ display: "flex", gap: "3px", alignItems: "flex-end", width: "100%", position: "relative" }} 
                  onMouseEnter={() => setHoveredDx(d.dx)}
                  onMouseLeave={() => setHoveredDx(null)}
                >
                  <div style={{ flex: 1, height: `${reqH}px`, background: "var(--primary)", borderRadius: "3px 3px 0 0", opacity: 0.3, minHeight: "4px" }} />
                  <div style={{ flex: 1, height: `${appH}px`, background: "var(--primary)", borderRadius: "3px 3px 0 0", minHeight: "4px" }} />
                  
                  <AnimatePresence>
                    {hoveredDx === d.dx && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.95, x: "-50%" }}
                        animate={{ opacity: 1, y: 0, scale: 1, x: "-50%" }}
                        exit={{ opacity: 0, y: 10, scale: 0.95, x: "-50%" }}
                        transition={{ duration: 0.15 }}
                        style={{
                          position: "absolute", bottom: "100%", left: "50%", marginBottom: "12px",
                          background: "var(--bg-surface)", border: "1px solid var(--border-default)",
                          padding: "16px", borderRadius: "12px", boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
                          zIndex: 50, minWidth: "220px", pointerEvents: "none"
                        }}
                      >

                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "6px" }}>
                          <span style={{ color: "var(--text-secondary)" }}>Requested:</span>
                          <span style={{ fontWeight: 600 }}>${d.requested.toLocaleString()}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "6px" }}>
                          <span style={{ color: "var(--text-secondary)" }}>Approved:</span>
                          <span style={{ fontWeight: 600, color: "var(--success)" }}>${d.approved.toLocaleString()}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginTop: "10px", paddingTop: "10px", borderTop: "1px dashed var(--border-default)" }}>
                          <span style={{ color: "var(--text-secondary)", fontWeight: 700 }}>Savings:</span>
                          <span style={{ fontWeight: 800, color: "var(--primary)", fontSize: "0.95rem" }}>${d.savings.toLocaleString()}</span>
                        </div>
                        <div style={{ position: "absolute", bottom: "-6px", left: "50%", transform: "translateX(-50%) rotate(45deg)", width: "12px", height: "12px", background: "var(--bg-surface)", borderRight: "1px solid var(--border-default)", borderBottom: "1px solid var(--border-default)" }} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <span style={{ fontSize: "0.6rem", color: "var(--text-tertiary)", textAlign: "center" }}>{d.dx}</span>
              </div>
            );
          });
        })()}
        </div>
        <div style={{ display: "flex", gap: "20px", justifyContent: "center", marginTop: "12px", fontSize: "0.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}><span style={{ width: "12px", height: "8px", background: "#F5D0B9", borderRadius: "2px" }} /> Requested</div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}><span style={{ width: "12px", height: "8px", background: "var(--primary)", borderRadius: "2px" }} /> Approved</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "28px" }}>
        {/* Diagnosis Breakdown Table */}
        <div className="card" style={{ padding: "24px" }}>
          <h3 style={{ marginBottom: "16px" }}>Diagnosis Category Performance</h3>
          <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border-default)" }}>
                <th style={{ textAlign: "left", padding: "8px", color: "var(--text-secondary)", fontWeight: 500 }}>Diagnosis</th>
                <th style={{ padding: "8px", color: "var(--text-secondary)", fontWeight: 500 }}>Total</th>
                <th style={{ padding: "8px", color: "var(--text-secondary)", fontWeight: 500 }}>Approved</th>
                <th style={{ padding: "8px", color: "var(--text-secondary)", fontWeight: 500 }}>Denied</th>
                <th style={{ padding: "8px", color: "var(--text-secondary)", fontWeight: 500 }}>Partial</th>
                <th style={{ padding: "8px", color: "var(--text-secondary)", fontWeight: 500 }}>Modified</th>
              </tr>
            </thead>
            <tbody>
              {(data.dx_breakdown || []).map((d: any) => (
                <tr key={d.dx} style={{ borderBottom: "1px solid var(--border-default)" }}>
                  <td style={{ padding: "8px", fontWeight: 500 }}>{d.dx}</td>
                  <td style={{ padding: "8px", textAlign: "center" }}>{d.total}</td>
                  <td style={{ padding: "8px", textAlign: "center" }}>
                    <span style={{ padding: "2px 8px", borderRadius: "var(--radius-md)", background: "var(--success-light)", color: "#16A34A", fontWeight: 600, fontSize: "0.75rem" }}>{d.approved}</span>
                  </td>
                  <td style={{ padding: "8px", textAlign: "center" }}>
                    <span style={{ padding: "2px 8px", borderRadius: "var(--radius-md)", background: "var(--danger-light)", color: "#DC2626", fontWeight: 600, fontSize: "0.75rem" }}>{d.denied}</span>
                  </td>
                  <td style={{ padding: "8px", textAlign: "center" }}>
                    <span style={{ padding: "2px 8px", borderRadius: "var(--radius-md)", background: "var(--warning-light)", color: "#D97706", fontWeight: 600, fontSize: "0.75rem" }}>{d.partial}</span>
                  </td>
                  <td style={{ padding: "8px", textAlign: "center" }}>
                    <span style={{ padding: "2px 8px", borderRadius: "var(--radius-md)", background: "var(--info-light)", color: "#0284C7", fontWeight: 600, fontSize: "0.75rem" }}>{d.modified}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* City Performance */}
        <div className="card" style={{ padding: "24px" }}>
          <h3 style={{ marginBottom: "16px" }}>City Performance</h3>
          <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border-default)" }}>
                <th style={{ textAlign: "left", padding: "8px", color: "var(--text-secondary)", fontWeight: 500 }}>Region</th>
                <th style={{ padding: "8px", color: "var(--text-secondary)", fontWeight: 500 }}>Cases</th>
                <th style={{ padding: "8px", color: "var(--text-secondary)", fontWeight: 500 }}>Approval</th>
                <th style={{ padding: "8px", color: "var(--text-secondary)", fontWeight: 500 }}>SLA</th>
              </tr>
            </thead>
            <tbody>
              {(data.regional_performance || []).map((r: any) => (
                <tr key={r.region} style={{ borderBottom: "1px solid var(--border-default)" }}>
                  <td style={{ padding: "8px", fontWeight: 500 }}>{r.region}</td>
                  <td style={{ padding: "8px", textAlign: "center" }}>{r.total}</td>
                  <td style={{ padding: "8px", textAlign: "center" }}>
                    <span style={{ padding: "2px 8px", borderRadius: "var(--radius-md)", fontWeight: 600, fontSize: "0.75rem", background: r.approval_rate >= 60 ? "var(--success-light)" : "var(--warning-light)", color: r.approval_rate >= 60 ? "#16A34A" : "#D97706" }}>{r.approval_rate}%</span>
                  </td>
                  <td style={{ padding: "8px", textAlign: "center" }}>
                    <span style={{ padding: "2px 8px", borderRadius: "var(--radius-md)", fontWeight: 600, fontSize: "0.75rem", background: r.sla_rate >= 90 ? "var(--success-light)" : "var(--danger-light)", color: r.sla_rate >= 90 ? "#16A34A" : "#DC2626" }}>{r.sla_rate}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reviewer Performance */}
      <div className="card" style={{ padding: "24px", marginBottom: "28px" }}>
        <h3 style={{ marginBottom: "16px" }}>Top Reviewer Performance</h3>
        <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--border-default)" }}>
              <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>Reviewer</th>
              <th style={{ padding: "8px", color: "var(--text-secondary)", fontWeight: 500 }}>Type</th>
              <th style={{ padding: "8px", color: "var(--text-secondary)", fontWeight: 500 }}>Cases</th>
              <th style={{ padding: "8px", color: "var(--text-secondary)", fontWeight: 500 }}>Approval Rate</th>
              <th style={{ padding: "8px", color: "var(--text-secondary)", fontWeight: 500 }}>Avg Review (min)</th>
              <th style={{ padding: "8px", color: "var(--text-secondary)", fontWeight: 500 }}>Completeness</th>
            </tr>
          </thead>
          <tbody>
            {(data.reviewer_performance || []).map((r: any) => (
              <tr key={r.name} style={{ borderBottom: "1px solid var(--border-default)" }}>
                <td style={{ padding: "10px 12px", fontWeight: 500 }}>{r.name}</td>
                <td style={{ padding: "10px 8px", textAlign: "center" }}>
                  <span className="badge badge-info" style={{ fontSize: "0.7rem" }}>{r.type}</span>
                </td>
                <td style={{ padding: "10px 8px", textAlign: "center" }}>{r.total}</td>
                <td style={{ padding: "10px 8px", textAlign: "center" }}>
                  <span style={{ padding: "2px 8px", borderRadius: "var(--radius-md)", fontWeight: 600, fontSize: "0.75rem", background: r.approval_rate >= 60 ? "var(--success-light)" : "var(--warning-light)", color: r.approval_rate >= 60 ? "#16A34A" : "#D97706" }}>{r.approval_rate}%</span>
                </td>
                <td style={{ padding: "10px 8px", textAlign: "center" }}>{r.avg_review_time}</td>
                <td style={{ padding: "10px 8px", textAlign: "center" }}>
                  <span style={{ padding: "2px 8px", borderRadius: "var(--radius-md)", fontWeight: 600, fontSize: "0.75rem", background: r.avg_completeness >= 70 ? "var(--success-light)" : "var(--warning-light)", color: r.avg_completeness >= 70 ? "#16A34A" : "#D97706" }}>{r.avg_completeness}%</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

      {/* Monthly Trends */}
      {data.monthly_trends && data.monthly_trends.length > 0 && (
        <div className="card" style={{ padding: "24px", minWidth: 0 }}>
          <h3 style={{ marginBottom: "16px" }}>Monthly Case Volume Trend</h3>
          <div style={{ display: "flex", alignItems: "flex-end", gap: "6px", height: "200px", minWidth: 0 }}>
            {data.monthly_trends.map((d: any, i: number) => {
              const maxVal = Math.max(...data.monthly_trends.map((x: any) => x.total));
              const totalH = (d.total / maxVal) * 170;
              const appH = (d.approved / d.total) * totalH; // Proportional height for approved
              const remainingH = totalH - appH; // Proportional height for non-approved
              
              return (
                <div 
                  key={i} 
                  style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", position: "relative", minWidth: 0 }}
                  onMouseEnter={() => setHoveredMonth(d.month)}
                  onMouseLeave={() => setHoveredMonth(null)}
                >
                  <span style={{ fontSize: "0.55rem", fontWeight: 600, color: "var(--text-secondary)" }}>{d.total}</span>
                  <div style={{ width: "100%", height: `${totalH}px`, display: "flex", flexDirection: "column", justifyContent: "flex-end", borderRadius: "4px 4px 0 0", overflow: "hidden" }}>
                    <div style={{ width: "100%", height: `${remainingH}px`, background: "var(--warning)", transition: "height 0.5s ease" }} />
                    <div style={{ width: "100%", height: `${appH}px`, background: "var(--success)", transition: "height 0.5s ease" }} />
                  </div>
                  
                  <AnimatePresence>
                    {hoveredMonth === d.month && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.95, x: "-50%" }}
                        animate={{ opacity: 1, y: 0, scale: 1, x: "-50%" }}
                        exit={{ opacity: 0, y: 10, scale: 0.95, x: "-50%" }}
                        transition={{ duration: 0.15 }}
                        style={{
                          position: "absolute", bottom: "100%", left: "50%", marginBottom: "16px",
                          background: "var(--bg-surface)", border: "1px solid var(--border-default)",
                          padding: "16px", borderRadius: "12px", boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
                          zIndex: 50, minWidth: "200px", pointerEvents: "none"
                        }}
                      >
                        <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "10px", borderBottom: "1px solid var(--border-default)", paddingBottom: "6px" }}>
                          {d.month}
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "6px" }}>
                          <span style={{ color: "var(--text-tertiary)" }}>Total Cases:</span>
                          <span style={{ fontWeight: 600 }}>{d.total}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "6px" }}>
                          <span style={{ color: "var(--text-tertiary)" }}>Approved:</span>
                          <span style={{ fontWeight: 600, color: "var(--success)" }}>{d.approved}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "6px" }}>
                          <span style={{ color: "var(--text-tertiary)" }}>Denied:</span>
                          <span style={{ fontWeight: 600, color: "var(--danger)" }}>{d.denied}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginTop: "10px", paddingTop: "10px", borderTop: "1px dashed var(--border-default)" }}>
                          <span style={{ color: "var(--text-secondary)", fontWeight: 700 }}>Savings:</span>
                          <span style={{ fontWeight: 800, color: "var(--primary)" }}>${(d.savings / 1000000).toFixed(2)}M</span>
                        </div>
                        <div style={{ position: "absolute", bottom: "-6px", left: "50%", transform: "translateX(-50%) rotate(45deg)", width: "12px", height: "12px", background: "var(--bg-surface)", borderRight: "1px solid var(--border-default)", borderBottom: "1px solid var(--border-default)" }} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                  
                  <span style={{ fontSize: "0.6rem", color: "var(--text-primary)", textAlign: "center", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", lineHeight: 1.2, display: "block", marginTop: "8px", padding: "4px 2px", background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", width: "100%", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>{d.month}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
