"use client";

import { useState, useEffect, useRef } from "react";
import { GraduationCap, Clock, CheckCircle, BookOpen, X, ChevronRight, Award, Play, Timer, RotateCcw, AlertTriangle, Loader2 } from "lucide-react";
import api from "@/lib/api";
import CustomDropdown from "@/components/shared/CustomDropdown";

interface QuizQuestion {
  q: string;
  options: string[];
  correct: number;
}

interface TrainingModule {
  id: string;
  topic: string;
  reviewer: string;
  status: string;
  duration: number;
  trigger: string;
  sections: { type: string; content?: string; case_id?: string; lesson?: string; questions?: QuizQuestion[] }[];
}

const INITIAL_MODULES: TrainingModule[] = [];

const statusConfig: Record<string, { color: string; icon: any; badge: string }> = {
  ASSIGNED: { color: "var(--warning)", icon: Clock, badge: "badge-warning" },
  IN_PROGRESS: { color: "var(--info)", icon: BookOpen, badge: "badge-info" },
  COMPLETED: { color: "var(--success)", icon: CheckCircle, badge: "badge-success" },
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

type Phase = "list" | "content" | "quiz" | "results";

export default function TrainingPage() {
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [selectedModule, setSelectedModule] = useState<TrainingModule | null>(null);
  const [phase, setPhase] = useState<Phase>("list");
  const [userRole, setUserRole] = useState<string>("NURSE");
  const [loading, setLoading] = useState(true);
  const [filterNurse, setFilterNurse] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Fetch modules
  useEffect(() => {
    const fetchModules = async () => {
      try {
        setLoading(true);
        const meRes = await api.get("/auth/me");
        const role = meRes.data.role;
        setUserRole(role);

        if (role === "QA_LEAD" || role === "ADMIN" || role === "EXECUTIVE") {
          const res = await api.get("/training/team-modules");
          setModules(res.data);
        } else {
          const res = await api.get(`/training/${meRes.data.id}/modules`);
          setModules(res.data.modules);
        }
      } catch (err) {
        console.error("Failed to fetch training modules", err);
        setModules(INITIAL_MODULES); // Fallback to hardcoded if API fails
      } finally {
        setLoading(false);
      }
    };
    fetchModules();
  }, []);

  // Timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Quiz state
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);

  // Results
  const [results, setResults] = useState<{ score: number; total: number; correct: number; passed: boolean; timeTaken: number } | null>(null);

  const startTimer = () => {
    setElapsedSeconds(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  useEffect(() => { return () => stopTimer(); }, []);

  const handleStartModule = (mod: TrainingModule) => {
    if (mod.status === "ASSIGNED") {
      setModules((prev) => prev.map((m) => m.id === mod.id ? { ...m, status: "IN_PROGRESS" } : m));
      mod = { ...mod, status: "IN_PROGRESS" };
    }
    setSelectedModule(mod);
    setPhase("content");
    startTimer();
  };

  const handleProceedToQuiz = () => {
    if (!selectedModule) return;
    const allQuestions: QuizQuestion[] = [];
    for (const s of selectedModule.sections) {
      if (s.type === "QUIZ" && s.questions) {
        allQuestions.push(...s.questions);
      }
    }
    setQuizQuestions(allQuestions);
    setCurrentQ(0);
    setSelectedAnswers(new Array(allQuestions.length).fill(-1));
    setPhase("quiz");
  };

  const handleSelectAnswer = (optionIndex: number) => {
    setSelectedAnswers((prev) => {
      const copy = [...prev];
      copy[currentQ] = optionIndex;
      return copy;
    });
  };

  const handleSubmitAssessment = () => {
    stopTimer();
    let correct = 0;
    for (let i = 0; i < quizQuestions.length; i++) {
      if (selectedAnswers[i] === quizQuestions[i].correct) correct++;
    }
    const score = Math.round((correct / Math.max(quizQuestions.length, 1)) * 100);
    const passed = score >= 80;

    if (passed && selectedModule) {
      setModules((prev) => prev.map((m) => m.id === selectedModule.id ? { ...m, status: "COMPLETED" } : m));
    }

    setResults({ score, total: quizQuestions.length, correct, passed, timeTaken: elapsedSeconds });
    setPhase("results");
  };

  const handleBack = () => {
    stopTimer();
    setSelectedModule(null);
    setPhase("list");
    setResults(null);
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", flexDirection: "column", gap: "16px" }}>
        <Loader2 size={32} style={{ animation: "spin 1s linear infinite", color: "var(--primary)" }} />
        <p style={{ color: "var(--text-secondary)" }}>Loading training modules...</p>
      </div>
    );
  }

  // ── LIST VIEW ──
  if (phase === "list") {
    let filteredModules = modules;
    if (filterNurse !== "ALL") {
      filteredModules = filteredModules.filter(m => m.reviewer === filterNurse || (m as any).reviewer_name === filterNurse);
    }
    if (statusFilter !== "ALL") {
      filteredModules = filteredModules.filter(m => m.status === statusFilter);
    }

    const uniqueNurses = Array.from(new Set(modules.map(m => m.reviewer || (m as any).reviewer_name).filter(Boolean)));

    return (
      <div className="animate-fade-in" style={{ padding: "32px" }}>
        <div className="page-header">
          <h1><GraduationCap size={28} style={{ color: "var(--primary)" }} /> {userRole === "QA_LEAD" ? "Team Training Overview" : "Training Hub"}</h1>
          <p>
            {userRole === "QA_LEAD" ? "Track training assignments across your nurse team." : "AI-generated personalized learning modules with timed assessments"}
          </p>
        </div>

        {(userRole === "QA_LEAD" || userRole === "ADMIN") && (
          <div style={{ display: "flex", gap: "16px", marginBottom: "24px", alignItems: "center" }}>
            <span style={{ fontSize: "0.9rem", fontWeight: 500 }}>Filter by:</span>
            <CustomDropdown
              value={filterNurse}
              onChange={setFilterNurse}
              options={[
                { value: "ALL", label: "All Nurses" },
                ...uniqueNurses.map((name: any) => ({ value: name, label: name }))
              ]}
              width="200px"
            />
            
            <CustomDropdown
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "ALL", label: "All Statuses" },
                { value: "COMPLETED", label: "Completed" },
                { value: "IN_PROGRESS", label: "In Progress" },
                { value: "ASSIGNED", label: "Assigned" }
              ]}
              width="180px"
            />
            
            {(filterNurse !== "ALL" || statusFilter !== "ALL") && (
              <button 
                className="btn btn-secondary" 
                onClick={() => { setFilterNurse("ALL"); setStatusFilter("ALL"); }}
              >
                Clear Filters
              </button>
            )}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "28px" }}>
          {[
            { label: "Total Modules", value: filteredModules.length, color: "var(--primary)" },
            { label: "Completed", value: filteredModules.filter((m) => m.status === "COMPLETED").length, color: "var(--success)" },
            { label: "Pending", value: filteredModules.filter((m) => m.status !== "COMPLETED").length, color: "var(--warning)" },
          ].map((m) => (
            <div key={m.label} className="card" style={{ textAlign: "center", borderLeft: `3px solid ${m.color}`, padding: "20px" }}>
              <div className="label" style={{ marginBottom: "6px" }}>{m.label}</div>
              <div style={{ fontSize: "2rem", fontWeight: 700 }}>{m.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {filteredModules.map((m) => {
            const config = statusConfig[m.status] || statusConfig["ASSIGNED"];
            const Icon = config.icon;
            return (
              <div key={m.id} className="card" style={{ padding: "20px", borderLeft: `3px solid ${config.color}`, cursor: "pointer", transition: "all 0.15s" }}
                onClick={() => handleStartModule(m)}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.boxShadow = "var(--shadow-md)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderLeftColor = config.color; e.currentTarget.style.boxShadow = "none"; }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                      <Icon size={16} style={{ color: config.color }} />
                      <span style={{ fontWeight: 600 }}>{m.topic}</span>
                      <span className={`badge ${config.badge}`}>{m.status.replace("_", " ")}</span>
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "4px" }}>Assigned to: <strong>{(m as any).reviewer_name || m.reviewer}</strong></div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-tertiary)" }}>Trigger: {m.trigger}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "var(--text-tertiary)", fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                      <Clock size={14} /> {m.duration} min
                    </div>
                    <ChevronRight size={18} style={{ color: "var(--text-tertiary)" }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (!selectedModule) return null;

  // ── CONTENT VIEW ──
  if (phase === "content") {
    const contentSections = selectedModule.sections.filter((s) => s.type !== "QUIZ");
    const hasQuiz = selectedModule.sections.some((s) => s.type === "QUIZ");
    return (
      <div style={{ padding: "32px", maxWidth: "800px", margin: "0 auto" }}>
        {/* Header with Timer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
          <div>
            <button onClick={handleBack} className="btn btn-secondary" style={{ padding: "6px 10px", marginBottom: "12px" }}>← Back</button>
            <h2 style={{ fontSize: "1.1rem", marginBottom: "4px" }}>{selectedModule.topic}</h2>
            <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Assigned to: {selectedModule.reviewer}</p>
          </div>
          <div style={{ padding: "12px 20px", background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-default)", textAlign: "center" }}>
            <Timer size={16} style={{ color: "var(--primary)", marginBottom: "4px" }} />
            <div style={{ fontSize: "1.4rem", fontWeight: 700, fontFamily: "monospace", color: "var(--primary)" }}>{formatTime(elapsedSeconds)}</div>
            <div style={{ fontSize: "0.65rem", color: "var(--text-tertiary)" }}>ELAPSED</div>
          </div>
        </div>

        {/* Content Sections */}
        {contentSections.map((section, i) => (
          <div key={i} style={{ marginBottom: "20px" }}>
            {section.type === "POLICY_REVIEW" && (
              <div style={{ padding: "16px", background: "var(--primary-light)", borderRadius: "var(--radius-md)", borderLeft: "3px solid var(--primary)" }}>
                <div className="label" style={{ marginBottom: "8px", color: "var(--primary)" }}>📋 Policy Review</div>
                <p style={{ fontSize: "0.85rem", lineHeight: 1.7, color: "var(--text-secondary)", whiteSpace: "pre-line" }}>{section.content}</p>
              </div>
            )}
            {section.type === "CASE_STUDY" && (
              <div style={{ padding: "16px", background: "var(--bg-body)", borderRadius: "var(--radius-md)", borderLeft: "3px solid var(--info)" }}>
                <div className="label" style={{ marginBottom: "8px", color: "var(--info)" }}>🔬 Case Study — {section.case_id}</div>
                <p style={{ fontSize: "0.85rem", lineHeight: 1.7, color: "var(--text-secondary)", whiteSpace: "pre-line" }}>{section.lesson}</p>
              </div>
            )}
          </div>
        ))}

        {/* Proceed to Quiz */}
        {hasQuiz && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "24px" }}>
            <button className="btn btn-primary" onClick={handleProceedToQuiz} style={{ gap: "6px", padding: "12px 28px" }}>
              <Play size={16} /> Start Assessment
            </button>
          </div>
        )}
        {!hasQuiz && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "24px" }}>
            <button className="btn btn-success" onClick={() => { stopTimer(); setResults({ score: 100, total: 0, correct: 0, passed: true, timeTaken: elapsedSeconds }); setPhase("results"); }} style={{ gap: "6px" }}>
              <CheckCircle size={16} /> Complete Module
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── QUIZ VIEW ──
  if (phase === "quiz" && quizQuestions.length > 0) {
    const q = quizQuestions[currentQ];
    const answered = selectedAnswers[currentQ] !== -1;
    const allAnswered = selectedAnswers.every((a) => a !== -1);
    const isLast = currentQ === quizQuestions.length - 1;

    return (
      <div style={{ padding: "32px", maxWidth: "700px", margin: "0 auto" }}>
        {/* Header with Timer and Progress */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-tertiary)", marginBottom: "4px" }}>Assessment</div>
            <h2 style={{ fontSize: "1rem" }}>{selectedModule.topic}</h2>
          </div>
          <div style={{ padding: "10px 16px", background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-default)", textAlign: "center" }}>
            <div style={{ fontSize: "1.2rem", fontWeight: 700, fontFamily: "monospace", color: "var(--primary)" }}>{formatTime(elapsedSeconds)}</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div style={{ marginBottom: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>
            <span>Question {currentQ + 1} of {quizQuestions.length}</span>
            <span>{selectedAnswers.filter((a) => a !== -1).length} answered</span>
          </div>
          <div style={{ height: "6px", background: "var(--border-default)", borderRadius: "3px", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${((currentQ + 1) / quizQuestions.length) * 100}%`, background: "var(--primary)", borderRadius: "3px", transition: "width 0.3s ease" }} />
          </div>
        </div>

        {/* Question Card */}
        <div className="card" style={{ padding: "24px", marginBottom: "24px" }}>
          <p style={{ fontSize: "0.95rem", fontWeight: 500, marginBottom: "20px", lineHeight: 1.6 }}>{q.q}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {q.options.map((opt, oi) => {
              const isSelected = selectedAnswers[currentQ] === oi;
              return (
                <button
                  key={oi}
                  onClick={() => handleSelectAnswer(oi)}
                  style={{
                    padding: "12px 16px", borderRadius: "var(--radius-md)",
                    border: `2px solid ${isSelected ? "var(--primary)" : "var(--border-default)"}`,
                    background: isSelected ? "var(--primary-light)" : "var(--bg-surface)",
                    cursor: "pointer", textAlign: "left", fontSize: "0.85rem",
                    color: "var(--text-primary)", transition: "all 0.15s",
                    display: "flex", alignItems: "center", gap: "12px",
                  }}
                >
                  <span style={{
                    width: "24px", height: "24px", borderRadius: "50%", flexShrink: 0,
                    border: `2px solid ${isSelected ? "var(--primary)" : "var(--border-default)"}`,
                    background: isSelected ? "var(--primary)" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "white", fontSize: "0.7rem", fontWeight: 700
                  }}>
                    {isSelected ? "✓" : String.fromCharCode(65 + oi)}
                  </span>
                  {opt}
                </button>
              );
            })}
          </div>
        </div>

        {/* Navigation */}
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <button className="btn btn-secondary" onClick={() => setCurrentQ(Math.max(0, currentQ - 1))} disabled={currentQ === 0}>← Previous</button>
          <div style={{ display: "flex", gap: "12px" }}>
            {!isLast && (
              <button className="btn btn-primary" onClick={() => setCurrentQ(currentQ + 1)} disabled={!answered}>Next →</button>
            )}
            {isLast && (
              <button className="btn btn-success" onClick={handleSubmitAssessment} disabled={!allAnswered} style={{ gap: "6px" }}>
                <Award size={16} /> Submit Assessment
              </button>
            )}
          </div>
        </div>

        {/* Question Dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "24px" }}>
          {quizQuestions.map((_, i) => (
            <button key={i} onClick={() => setCurrentQ(i)} style={{
              width: "28px", height: "28px", borderRadius: "50%", border: "none", cursor: "pointer",
              fontSize: "0.7rem", fontWeight: 600,
              background: i === currentQ ? "var(--primary)" : selectedAnswers[i] !== -1 ? "var(--success)" : "var(--border-default)",
              color: i === currentQ || selectedAnswers[i] !== -1 ? "white" : "var(--text-tertiary)",
            }}>
              {i + 1}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── RESULTS VIEW ──
  if (phase === "results" && results) {
    const scoreColor = results.passed ? "var(--success)" : "var(--danger)";
    return (
      <div style={{ padding: "32px", maxWidth: "600px", margin: "0 auto" }}>
        <div className="card" style={{ padding: "40px", textAlign: "center" }}>
          {/* Score Ring */}
          <div style={{ position: "relative", width: "160px", height: "160px", margin: "0 auto 24px", borderRadius: "50%", background: `conic-gradient(${scoreColor} ${results.score * 3.6}deg, var(--border-default) 0)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: "130px", height: "130px", borderRadius: "50%", background: "var(--bg-surface)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: "2.5rem", fontWeight: 700, color: scoreColor }}>{results.score}%</span>
              <span style={{ fontSize: "0.7rem", color: "var(--text-tertiary)" }}>Score</span>
            </div>
          </div>

          {/* Pass/Fail Badge */}
          <div style={{ marginBottom: "24px" }}>
            <span className={`badge ${results.passed ? "badge-success" : "badge-danger"}`} style={{ fontSize: "1rem", padding: "8px 24px" }}>
              {results.passed ? "✓ PASSED" : "✗ FAILED"}
            </span>
          </div>

          {/* Stats Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginBottom: "28px" }}>
            <div style={{ padding: "16px", background: "var(--bg-body)", borderRadius: "var(--radius-md)" }}>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--primary)" }}>{results.correct}/{results.total}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>Correct Answers</div>
            </div>
            <div style={{ padding: "16px", background: "var(--bg-body)", borderRadius: "var(--radius-md)" }}>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--info)" }}>{formatTime(results.timeTaken)}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>Time Taken</div>
            </div>
            <div style={{ padding: "16px", background: "var(--bg-body)", borderRadius: "var(--radius-md)" }}>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, color: results.passed ? "var(--success)" : "var(--warning)" }}>{results.passed ? "Yes" : "No"}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>Passing (≥80%)</div>
            </div>
          </div>

          {/* Per-question breakdown */}
          {quizQuestions.length > 0 && (
            <div style={{ textAlign: "left", marginBottom: "24px" }}>
              <div className="label" style={{ marginBottom: "12px" }}>Question Breakdown</div>
              {quizQuestions.map((q, i) => {
                const isCorrect = selectedAnswers[i] === q.correct;
                return (
                  <div key={i} style={{ padding: "10px 14px", marginBottom: "8px", borderRadius: "var(--radius-md)", border: `1px solid ${isCorrect ? "var(--success)" : "var(--danger)"}`, background: isCorrect ? "var(--success-light)" : "rgba(239,68,68,0.06)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>Q{i + 1}: {isCorrect ? "✓ Correct" : "✗ Incorrect"}</span>
                    </div>
                    <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "4px" }}>{q.q}</p>
                    {!isCorrect && (
                      <p style={{ fontSize: "0.75rem", color: "var(--success)", fontWeight: 500 }}>
                        Correct answer: {q.options[q.correct]}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", justifyContent: "center", gap: "12px" }}>
            {!results.passed && (
              <button className="btn btn-warning" onClick={() => { setPhase("content"); startTimer(); }} style={{ gap: "6px" }}>
                <RotateCcw size={16} /> Retake Training
              </button>
            )}
            <button className="btn btn-primary" onClick={handleBack} style={{ gap: "6px" }}>
              <GraduationCap size={16} /> Back to Training Hub
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
