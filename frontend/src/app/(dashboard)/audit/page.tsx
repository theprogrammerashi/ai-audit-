"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, ChevronRight, Clock, AlertTriangle, Loader2, Search, Filter, X, FolderOpen, FileText, BadgeCheck, EyeOff } from "lucide-react";
import api from "@/lib/api";
import CustomDropdown from "@/components/shared/CustomDropdown";

type FilterState = {
  search: string;
  nurse: string;
  risk: string;
  result: string;
  decision: string;
  sort: string;
};

export default function AuditPage() {
  const router = useRouter();
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [caseTypeTab, setCaseTypeTab] = useState<"prior_auth" | "appeal">("prior_auth");
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    nurse: "",
    risk: "",
    result: "",
    decision: "",
    sort: "newest",
  });

  useEffect(() => {
    const fetchQueue = async () => {
      try {
        const res = await api.get("/audit/queue");
        setCases(res.data);
      } catch (err) {
        console.error("Failed to fetch audit queue:", err);
        setError("Failed to load QA audit queue");
      } finally {
        setLoading(false);
      }
    };
    fetchQueue();
  }, []);

  // Derived unique nurse names for dropdown
  const nurses = useMemo(() => {
    const names = new Set(cases.map((c) => c.reviewer_name).filter(Boolean));
    return Array.from(names).sort();
  }, [cases]);

  // Filtered + sorted list
  const filtered = useMemo(() => {
    let list = [...cases].filter(c => (c.case_type || 'prior_auth') === caseTypeTab);

    // Search
    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter((c) =>
        c.case_number?.toLowerCase().includes(q) ||
        c.patient_name?.toLowerCase().includes(q) ||
        c.diagnosis?.toLowerCase().includes(q) ||
        c.reviewer_name?.toLowerCase().includes(q)
      );
    }

    // Nurse filter
    if (filters.nurse) {
      list = list.filter((c) => c.reviewer_name === filters.nurse);
    }

    // Risk filter
    if (filters.risk) {
      list = list.filter((c) => c.risk_level === filters.risk);
    }

    // Pass/Fail filter
    if (filters.result) {
      if (filters.result === "PASS") {
        list = list.filter((c) => c.qa_score >= 80);
      } else {
        list = list.filter((c) => c.qa_score < 80);
      }
    }

    // Decision filter
    if (filters.decision) {
      list = list.filter((c) => c.decision === filters.decision);
    }

    // Sort
    if (filters.sort === "newest") {
      list.sort((a, b) => new Date(b.audited_at).getTime() - new Date(a.audited_at).getTime());
    } else if (filters.sort === "oldest") {
      list.sort((a, b) => new Date(a.audited_at).getTime() - new Date(b.audited_at).getTime());
    } else if (filters.sort === "qa_high") {
      list.sort((a, b) => b.qa_score - a.qa_score);
    } else if (filters.sort === "qa_low") {
      list.sort((a, b) => a.qa_score - b.qa_score);
    } else if (filters.sort === "risk_high") {
      const riskOrder: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
      list.sort((a, b) => (riskOrder[b.risk_level] || 0) - (riskOrder[a.risk_level] || 0));
    }

    return list;
  }, [cases, filters, caseTypeTab]);

  const activeFilterCount = [filters.nurse, filters.risk, filters.result, filters.decision].filter(Boolean).length;

  const clearFilters = () => {
    setFilters({ search: "", nurse: "", risk: "", result: "", decision: "", sort: "newest" });
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", flexDirection: "column", gap: "16px" }}>
        <Loader2 size={32} style={{ animation: "spin 1s linear infinite", color: "var(--primary)" }} />
        <p style={{ color: "var(--text-secondary)" }}>Loading QA audit reports...</p>
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

  const tabCases = cases.filter(c => (c.case_type || 'prior_auth') === caseTypeTab);
  const passCount = tabCases.filter((c) => c.qa_score >= 80).length;
  const failCount = tabCases.filter((c) => c.qa_score < 80).length;
  const avgScore = tabCases.length ? Math.round(tabCases.reduce((s, c) => s + c.qa_score, 0) / tabCases.length) : 0;
  const criticalCount = tabCases.filter((c) => c.risk_level === "CRITICAL" || c.risk_level === "HIGH").length;
  const priorAuthCount = cases.filter(c => (c.case_type || 'prior_auth') === 'prior_auth').length;
  const appealCount = cases.filter(c => c.case_type === 'appeal').length;

  return (
    <div className="animate-fade-in" style={{ padding: "32px" }}>
      <div className="page-header">
        <h1>
          <ShieldCheck size={28} style={{ color: "var(--primary)" }} /> QA Audit Reports
        </h1>
        <p>
          AI-generated quality assurance audit results for all reviewed cases
        </p>
      </div>

      {/* Prior Auth / Appeals Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '1px solid var(--border-default)', paddingBottom: '2px' }}>
        {[
          { key: 'prior_auth' as const, label: 'Prior Auth Audits', icon: FolderOpen, count: priorAuthCount },
          { key: 'appeal' as const, label: 'Appeals Audits', icon: FileText, count: appealCount },
        ].map(tab => (
          <button key={tab.key} onClick={() => setCaseTypeTab(tab.key)}
            style={{
              padding: '12px 24px', border: 'none', background: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: '0.88rem',
              color: caseTypeTab === tab.key ? 'var(--primary)' : 'var(--text-tertiary)',
              borderBottom: caseTypeTab === tab.key ? '2px solid var(--primary)' : '2px solid transparent',
              transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px'
            }}>
            <tab.icon size={16} />
            {tab.label}
            <span style={{
              fontSize: '0.72rem', padding: '2px 8px', borderRadius: '10px',
              background: caseTypeTab === tab.key ? 'rgba(232,82,26,0.1)' : 'var(--bg-hover)',
              color: caseTypeTab === tab.key ? 'var(--primary)' : 'var(--text-tertiary)',
            }}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "16px", marginBottom: "28px" }}>
        {[
          { label: "Total Audited", value: cases.length, color: "var(--primary)", icon: ShieldCheck, bg: "var(--primary-light)" },
          { label: "Passed (≥80%)", value: passCount, color: "var(--success)", icon: ShieldCheck, bg: "var(--success-light)" },
          { label: "Failed (<80%)", value: failCount, color: "var(--danger)", icon: AlertTriangle, bg: "var(--danger-light)" },
          { label: "Avg QA Score", value: `${avgScore}%`, color: "var(--warning)", icon: ShieldCheck, bg: "var(--warning-light)" },
          { label: "High/Critical Risk", value: criticalCount, color: "var(--danger)", icon: AlertTriangle, bg: "var(--danger-light)" },
        ].map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.label} className="metric-card card-accent" style={{ borderTopColor: m.color }}>
              <div className="metric-icon-wrapper" style={{ background: m.bg, color: m.color, width: "40px", height: "40px", borderRadius: "10px", marginBottom: "12px" }}>
                <Icon size={20} />
              </div>
              <div className="metric-label" style={{ fontSize: "0.75rem" }}>{m.label}</div>
              <div className="metric-value" style={{ fontSize: "1.75rem" }}>{m.value}</div>
            </div>
          );
        })}
      </div>

      {/* Search + Filter Bar */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "16px", alignItems: "center" }}>
        <div style={{
          flex: 1, display: "flex", alignItems: "center", gap: "8px",
          background: "var(--bg-surface)", border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-md)", padding: "8px 12px",
        }}>
          <Search size={16} style={{ color: "var(--text-tertiary)" }} />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
            placeholder="Search by case number, patient, diagnosis, or nurse..."
            style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: "0.85rem", color: "var(--text-primary)" }}
          />
          {filters.search && (
            <button onClick={() => setFilters((p) => ({ ...p, search: "" }))} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", display: "flex" }}>
              <X size={14} />
            </button>
          )}
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className="btn btn-secondary"
          style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px", position: "relative" }}
        >
          <Filter size={14} /> Filters
          {activeFilterCount > 0 && (
            <span style={{
              position: "absolute", top: "-6px", right: "-6px",
              background: "var(--primary)", color: "white", borderRadius: "50%",
              width: "18px", height: "18px", fontSize: "0.7rem", fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>{activeFilterCount}</span>
          )}
        </button>

        <CustomDropdown
          value={filters.sort}
          onChange={(val) => setFilters((p) => ({ ...p, sort: val }))}
          options={[
            { value: "newest", label: "Newest First" },
            { value: "oldest", label: "Oldest First" },
            { value: "qa_high", label: "QA Score: High → Low" },
            { value: "qa_low", label: "QA Score: Low → High" },
            { value: "risk_high", label: "Risk: High → Low" }
          ]}
          width="160px"
        />
      </div>
      {/* Advanced Filter Panel */}
      {showFilters && (
        <div className="card" style={{ padding: "16px 20px", marginBottom: "16px", display: "flex", gap: "16px", alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: "150px" }}>
            <label className="label" style={{ display: "block", marginBottom: "4px" }}>Nurse / Reviewer</label>
            <CustomDropdown
              value={filters.nurse}
              onChange={(val) => setFilters((p) => ({ ...p, nurse: val }))}
              options={[
                { value: "", label: "All Nurses" },
                ...nurses.map((n) => ({ value: n, label: n }))
              ]}
              width="100%"
            />
          </div>

          <div style={{ flex: 1, minWidth: "120px" }}>
            <label className="label" style={{ display: "block", marginBottom: "4px" }}>Risk Level</label>
            <CustomDropdown
              value={filters.risk}
              onChange={(val) => setFilters((p) => ({ ...p, risk: val }))}
              options={[
                { value: "", label: "All Risk Levels" },
                { value: "LOW", label: "Low" },
                { value: "MEDIUM", label: "Medium" },
                { value: "HIGH", label: "High" },
                { value: "CRITICAL", label: "Critical" }
              ]}
              width="100%"
            />
          </div>

          <div style={{ flex: 1, minWidth: "120px" }}>
            <label className="label" style={{ display: "block", marginBottom: "4px" }}>QA Result</label>
            <CustomDropdown
              value={filters.result}
              onChange={(val) => setFilters((p) => ({ ...p, result: val }))}
              options={[
                { value: "", label: "All Results" },
                { value: "PASS", label: "Pass (≥80%)" },
                { value: "FAIL", label: "Fail (<80%)" }
              ]}
              width="100%"
            />
          </div>

          <div style={{ flex: 1, minWidth: "120px" }}>
            <label className="label" style={{ display: "block", marginBottom: "4px" }}>Decision</label>
            <CustomDropdown
              value={filters.decision}
              onChange={(val) => setFilters((p) => ({ ...p, decision: val }))}
              options={[
                { value: "", label: "All Decisions" },
                { value: "APPROVED", label: "Approved" },
                { value: "DENIED", label: "Denied" }
              ]}
              width="100%"
            />
          </div>

          <button onClick={clearFilters} className="btn btn-secondary" style={{ padding: "8px 14px", fontSize: "0.85rem" }}>
            <X size={14} /> Clear
          </button>
        </div>
      )}

      {/* Results count */}
      <div style={{ marginBottom: "12px", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
        Showing <strong>{filtered.length}</strong> of {cases.length} audit reports
        {activeFilterCount > 0 && <span> ({activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""} active)</span>}
      </div>

      {/* Case List */}
      {/* Case List */}
      <div className="data-table-container animate-slide-up">
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 24px" }}>
            <Search size={48} style={{ color: "var(--text-tertiary)", margin: "0 auto 16px" }} />
            <h3>No audit reports match your filters</h3>
            <p style={{ color: "var(--text-secondary)", marginTop: "8px" }}>Try adjusting your search or filters.</p>
            <button onClick={clearFilters} className="btn btn-primary" style={{ marginTop: "16px" }}>Clear All Filters</button>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Case ID</th>
                <th>Patient</th>
                <th>Diagnosis</th>
                <th>Reviewer</th>
                <th style={{ textAlign: "center" }}>Decision</th>
                <th style={{ textAlign: "center" }}>Risk</th>
                <th style={{ textAlign: "center" }}>QA Score</th>
                <th style={{ textAlign: "center" }}>Date</th>
                <th style={{ textAlign: "center" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const auditResult = c.qa_score >= 80 ? "PASS" : "FAIL";
                const d = new Date(c.audited_at);
                const dateStr = d.toLocaleDateString();

                return (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.case_number}</td>
                    <td>{c.patient_name}</td>
                    <td>{c.diagnosis}</td>
                    <td>{c.reviewer_name}</td>
                    <td style={{ textAlign: "center" }}>
                      <span className={`badge ${c.decision === "APPROVED" ? "badge-success" : c.decision === "DENIED" ? "badge-danger" : "badge-warning"}`}>{c.decision}</span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span className={`badge ${c.risk_level === "CRITICAL" || c.risk_level === "HIGH" ? "badge-danger" : c.risk_level === "MEDIUM" ? "badge-warning" : "badge-success"}`}>{c.risk_level}</span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "1.05rem", fontWeight: 600, color: c.qa_score >= 90 ? "var(--success)" : c.qa_score >= 75 ? "var(--warning)" : "var(--danger)" }}>
                        {c.qa_score}%
                      </div>
                      <div style={{ marginTop: "4px" }}>
                        <span className={`badge ${auditResult === "PASS" ? "badge-success" : "badge-danger"}`} style={{ padding: "2px 6px", fontSize: "0.65rem" }}>{auditResult}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: "center", color: "var(--text-secondary)" }}>{dateStr}</td>
                    <td style={{ textAlign: "center" }}>
                      <button className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: "0.75rem", margin: "0 auto" }} onClick={() => router.push(`/audit/${c.case_id}`)}>
                        <ShieldCheck size={14} /> View Audit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
