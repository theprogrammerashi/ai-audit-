"use client";

import { useState, useEffect } from "react";
import { Workflow, X, ChevronRight, Loader2, Clock, Zap, Target, BookOpen, Shield, AlertTriangle, GraduationCap } from "lucide-react";
import api from "@/lib/api";

const AGENT_ICONS: Record<string, any> = {
  intake: Zap,
  policy: Target,
  copilot: BookOpen,
  qa: Shield,
  appeal: AlertTriangle,
  training: GraduationCap,
};

const AGENT_COLORS: Record<string, string> = {
  intake: "#E8521A",
  policy: "#2563EB",
  copilot: "#7C3AED",
  qa: "#16A34A",
  appeal: "#D97706",
  training: "#EC4899",
};

export default function AgentPipelinePage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [recentCases, setRecentCases] = useState<any[]>([]);
  const [loadingCases, setLoadingCases] = useState(false);

  useEffect(() => {
    api.get("/agent-pipeline/agents")
      .then((res) => setAgents(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSelectAgent = async (agent: any) => {
    setSelectedAgent(agent);
    setLoadingCases(true);
    try {
      const res = await api.get(`/agent-pipeline/agents/${agent.id}/recent-cases`);
      setRecentCases(res.data);
    } catch (err) {
      console.error(err);
      setRecentCases([]);
    } finally {
      setLoadingCases(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", flexDirection: "column", gap: "16px" }}>
        <Loader2 size={32} style={{ animation: "spin 1s linear infinite", color: "var(--primary)" }} />
        <p style={{ color: "var(--text-secondary)" }}>Loading agent pipeline...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ padding: "32px" }}>
      <div className="page-header">
          <h1 style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <Workflow size={28} style={{ color: "var(--primary)" }} /> Agent Pipeline</h1><p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Real-time multi-agent processing architecture</p>
        </div>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "32px" }}>
        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--success)", animation: "pulse 2s ease-in-out infinite" }} />
        <span style={{ fontSize: "0.8rem", color: "var(--success)", fontWeight: 500 }}>All {agents.length} agents operational</span>
      </div>

      {/* ── PIPELINE GRAPH ── */}
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", gap: "0", marginBottom: "40px", overflowX: "auto", padding: "20px 0" }}>
        {agents.map((agent, i) => {
          const color = AGENT_COLORS[agent.id] || "var(--primary)";
          const Icon = AGENT_ICONS[agent.id] || Workflow;
          const isSelected = selectedAgent?.id === agent.id;
          return (
            <div key={agent.id} style={{ display: "flex", alignItems: "center" }}>
              {/* Agent Node */}
              <div
                onClick={() => handleSelectAgent(agent)}
                style={{
                  width: "130px", cursor: "pointer",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: "8px",
                  transition: "all 0.3s ease",
                  transform: isSelected ? "scale(1.08)" : "scale(1)",
                  animation: `fadeIn 0.5s ease ${i * 0.1}s both`,
                }}
              >
                {/* Node Circle */}
                <div style={{
                  width: "72px", height: "72px", borderRadius: "50%",
                  background: `linear-gradient(135deg, ${color}18, ${color}30)`,
                  border: `3px solid ${isSelected ? color : color + "60"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  position: "relative", transition: "all 0.3s ease",
                  boxShadow: isSelected ? `0 0 20px ${color}40, 0 0 40px ${color}20` : "none",
                }}>
                  <Icon size={28} style={{ color }} />
                  {/* Pulse ring */}
                  <div style={{
                    position: "absolute", inset: "-6px", borderRadius: "50%",
                    border: `2px solid ${color}40`,
                    animation: "pulse 3s ease-in-out infinite",
                  }} />
                </div>

                {/* Agent Label */}
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "0.78rem", fontWeight: 600, color: isSelected ? color : "var(--text-primary)" }}>{agent.name}</div>
                  <div style={{ fontSize: "0.65rem", color: "var(--text-tertiary)" }}>{agent.avg_processing_time}</div>
                </div>

                {/* Success rate mini-badge */}
                <div style={{
                  padding: "2px 8px", borderRadius: "10px", fontSize: "0.65rem", fontWeight: 600,
                  background: `${color}15`, color: color, border: `1px solid ${color}30`,
                }}>
                  {agent.success_rate}%
                </div>
              </div>

              {/* Connector Arrow */}
              {i < agents.length - 1 && (
                <div style={{ display: "flex", alignItems: "center", width: "50px", position: "relative" }}>
                  <svg width="50" height="20" viewBox="0 0 50 20">
                    <defs>
                      <linearGradient id={`grad-${i}`} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" style={{ stopColor: AGENT_COLORS[agents[i].id] || "#ccc", stopOpacity: 0.8 }} />
                        <stop offset="100%" style={{ stopColor: AGENT_COLORS[agents[i + 1].id] || "#ccc", stopOpacity: 0.8 }} />
                      </linearGradient>
                    </defs>
                    <line x1="0" y1="10" x2="40" y2="10" stroke={`url(#grad-${i})`} strokeWidth="2" strokeDasharray="6,3">
                      <animate attributeName="stroke-dashoffset" from="18" to="0" dur="1.5s" repeatCount="indefinite" />
                    </line>
                    <polygon points="38,5 48,10 38,15" fill={AGENT_COLORS[agents[i + 1].id] || "#ccc"} opacity="0.7" />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── AGENT DETAIL PANEL ── */}
      {selectedAgent && (
        <div className="card animate-fade-in" style={{ padding: "0", overflow: "hidden", borderTop: `3px solid ${AGENT_COLORS[selectedAgent.id]}` }}>
          {/* Panel Header */}
          <div style={{ padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid var(--border-default)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{
                width: "48px", height: "48px", borderRadius: "12px",
                background: `linear-gradient(135deg, ${AGENT_COLORS[selectedAgent.id]}20, ${AGENT_COLORS[selectedAgent.id]}40)`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {(() => { const Icon = AGENT_ICONS[selectedAgent.id] || Workflow; return <Icon size={24} style={{ color: AGENT_COLORS[selectedAgent.id] }} />; })()}
              </div>
              <div>
                <h3 style={{ fontSize: "1.1rem", marginBottom: "4px" }}>Agent: {selectedAgent.name}</h3>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--success)" }} />
                  <span style={{ fontSize: "0.8rem", color: "var(--success)" }}>Active</span>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-tertiary)" }}>|</span>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-tertiary)" }}>Avg: {selectedAgent.avg_processing_time}</span>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-tertiary)" }}>|</span>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-tertiary)" }}>Success: {selectedAgent.success_rate}%</span>
                </div>
              </div>
            </div>
            <button onClick={() => setSelectedAgent(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)" }}>
              <X size={20} />
            </button>
          </div>

          <div style={{ padding: "20px 24px" }}>
            {/* Description */}
            <p style={{ fontSize: "0.85rem", lineHeight: 1.7, color: "var(--text-secondary)", marginBottom: "20px" }}>{selectedAgent.description}</p>

            {/* Capabilities */}
            <div style={{ marginBottom: "20px" }}>
              <div className="label" style={{ marginBottom: "8px" }}>Capabilities</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {(selectedAgent.capabilities || []).map((c: string) => (
                  <span key={c} style={{
                    padding: "4px 10px", borderRadius: "var(--radius-md)", fontSize: "0.75rem",
                    background: `${AGENT_COLORS[selectedAgent.id]}12`,
                    color: AGENT_COLORS[selectedAgent.id],
                    border: `1px solid ${AGENT_COLORS[selectedAgent.id]}25`,
                    fontWeight: 500,
                  }}>{c}</span>
                ))}
              </div>
            </div>

            {/* Live Stats */}
            {selectedAgent.stats && Object.keys(selectedAgent.stats).length > 0 && (
              <div style={{ marginBottom: "20px" }}>
                <div className="label" style={{ marginBottom: "8px" }}>Live Stats</div>
                <div style={{ display: "flex", gap: "12px" }}>
                  {Object.entries(selectedAgent.stats).map(([key, val]) => (
                    <div key={key} style={{ padding: "12px 16px", background: "var(--bg-body)", borderRadius: "var(--radius-md)", flex: 1, textAlign: "center" }}>
                      <div style={{ fontSize: "1.3rem", fontWeight: 700, color: AGENT_COLORS[selectedAgent.id] }}>{String(val)}</div>
                      <div style={{ fontSize: "0.7rem", color: "var(--text-tertiary)", textTransform: "capitalize" }}>{key.replace(/_/g, " ")}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Cases Table */}
            <div>
              <div className="label" style={{ marginBottom: "8px" }}>Recent 5 Cases Processed</div>
              {loadingCases ? (
                <div style={{ textAlign: "center", padding: "24px" }}>
                  <Loader2 size={20} style={{ animation: "spin 1s linear infinite", color: "var(--primary)" }} />
                </div>
              ) : recentCases.length > 0 ? (
                <table className="data-table">
                    <thead>
                      <tr>
                        {Object.keys(recentCases[0]).filter(k => k !== "id").slice(0, 5).map((key) => (
                          <th key={key} style={{ textTransform: "capitalize" }}>
                            {key.replace(/_/g, " ")}
                          </th>
                        ))}
                      </tr>
                    </thead>
                  <tbody>
                    {recentCases.map((c: any, i: number) => {
                      const keys = Object.keys(c).filter(k => k !== "id").slice(0, 5);
                      return (
                        <tr key={i}>
                          {keys.map((key) => (
                            <td key={key}>
                              {typeof c[key] === "number"
                                ? (key.includes("probability") || key.includes("confidence")
                                  ? `${(c[key] * 100).toFixed(0)}%`
                                  : key.includes("cost") || key.includes("exposure")
                                    ? `$${c[key].toLocaleString()}`
                                    : c[key])
                                : (c[key]?.toString()?.substring(0, 40) || "—")}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                  </table>
              ) : (
                <p style={{ color: "var(--text-tertiary)", fontSize: "0.85rem", padding: "12px" }}>No recent cases found for this agent.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
