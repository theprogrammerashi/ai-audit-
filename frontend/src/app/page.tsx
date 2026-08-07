"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ChevronRight, LogOut } from "lucide-react";

/* ═══════════════════════════════════════════════════
   CareAudit.ai — Landing Page v5
   ✅ Real metrics from /api/v1/stats/public
   ✅ Sparkline bar charts matching screenshot
   ✅ Compliance section rebuilt to match screenshot
   ✅ ClinicalBERT feature replaces HIPAA mention
   ✅ Auth-aware nav + correct routes
   ═══════════════════════════════════════════════════ */

// Fallback data — replaced by API on mount
const FALLBACK_METRICS = {
  total_cases: 1000, approval_rate: 68.5, total_savings_m: 13.2, avg_tat_h: 34.4, sla_pct: 92.8,
  monthly_cases: [48, 33, 33, 40, 43, 51, 40, 43, 38, 42, 47, 52],
  monthly_savings_k: [452, 297, 372, 223, 192, 897, 282, 777, 423, 461, 797, 687],
  monthly_approval: [77, 67, 70, 85, 74, 71, 70, 51, 82, 64, 66, 71],
  monthly_tat: [34, 28, 34, 30, 34, 35, 31, 34, 34, 30, 37, 42],
};

const AGENTS = [
  { name: "Clinical Intake", desc: "ClinicalBERT · ICD-10 · Vitals · Labs", score: "97.2%", iconBg: "rgba(232,82,26,.10)", pillBg: "#FFF2EC", pillColor: "#E8521A", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E8521A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><line x1="9" y1="12" x2="15" y2="12" /><line x1="9" y1="16" x2="13" y2="16" /></svg> },
  { name: "Policy Retrieval", desc: "ChromaDB RAG · Criteria mapping", score: "98.1%", iconBg: "#EFF6FF", pillBg: "#EFF6FF", pillColor: "#1D4ED8", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1D4ED8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg> },
  { name: "Reviewer Assistant", desc: "Copilot observations · HITL checkpoint", score: "99.0%", iconBg: "#F3E8FF", pillBg: "#F3E8FF", pillColor: "#7C3AED", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg> },
  { name: "QA Audit", desc: "0-100 scoring · 4-dimension analysis", score: "96.5%", iconBg: "rgba(26,122,74,.08)", pillBg: "rgba(26,122,74,.1)", pillColor: "#1A7A4A", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A7A4A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg> },
  { name: "Appeal Risk", desc: "Overturn probability · Financial exposure", score: "94.8%", iconBg: "#FEF3C7", pillBg: "#FEF3C7", pillColor: "#B45309", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg> },
  { name: "Training", desc: "Gap-triggered · Personalized modules", score: "93.5%", iconBg: "#FFF1F2", pillBg: "#FFF1F2", pillColor: "#BE123C", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#BE123C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" /><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" /></svg> },
];

const STEPS = [
  { num: "01", phase: "Phase I · AI Prepares", title: "Clinical Intake & Structured Extraction", desc: "The Clinical Intake Agent processes uploaded medical records, EMR feeds, and PDFs — extracting vitals, labs, diagnoses, ICD-10 codes, and timelines into a structured clinical dossier using ClinicalBERT embeddings." },
  { num: "02", phase: "Phase I · AI Prepares", title: "Policy RAG Retrieval & Criteria Mapping", desc: "The Policy Retrieval Agent queries ChromaDB with ClinicalBERT embeddings, retrieves payer-specific clinical guidelines, and maps each extracted data point against coverage criteria as MET / UNMET." },
  { num: "03", phase: "Phase II · Human Decides", title: "Nurse Review & Decision Submission", desc: "The LangGraph pipeline pauses at a mandatory HITL checkpoint. A nurse clinician reviews the AI-prepared dossier, evaluates mapped criteria, and submits a clinically reasoned determination." },
  { num: "04", phase: "Phase III · AI Audits & Learns", title: "QA Scoring, Appeal Risk & Adaptive Training", desc: "Post-submission, QA and Appeal Risk agents audit every decision. The Training Agent converts findings into personalized micro-learning modules, closing the loop between mistakes and mastery." },
];

const CAPABILITIES = [
  { title: "Clinical Intake Engine", desc: "ClinicalBERT-powered extraction of vitals, labs, diagnoses, and clinical timelines from uploaded PDFs and EMR feeds.", tag: "CLINICALBERT NLP", route: "/workspace", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><line x1="9" y1="12" x2="15" y2="12" /><line x1="9" y1="16" x2="13" y2="16" /></svg> },
  { title: "Policy RAG Pipeline", desc: "ChromaDB vector retrieval of payer-specific guidelines. ClinicalBERT embeddings map each clinical data point to a coverage criterion with MET/UNMET verdict.", tag: "SEMANTIC RAG", route: "/policy", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg> },
  { title: "QA Scoring Engine", desc: "Four-dimension weighted audit: Clinical Accuracy (35%), Documentation (25%), Policy Compliance (25%), Consistency (15%). Every decision gets an explainable, reproducible score.", tag: "REAL-TIME QA", route: "/audit", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg> },
  { title: "Appeal Risk Predictor", desc: "RandomForest ML classifier returns an overturn_probability score (0–1) per decision. Risk tiers: LOW / MEDIUM / HIGH / CRITICAL — with documented financial exposure per tier.", tag: "ML RISK MODEL", route: "/appeal", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg> },
  { title: "Adaptive Training Hub", desc: "QA audit findings automatically generate personalized micro-learning modules assigned to the specific reviewer who needs them. Knowledge gaps close before they compound.", tag: "ADAPTIVE LEARNING", route: "/training", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" /><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" /></svg> },
  { title: "BioBERT ICD-10 Suggester", desc: "BioBERT semantic similarity search across 80 common hospital ICD-10 codes. Cosine similarity ranking surfaces the most clinically relevant codes during case intake.", tag: "BIOBERT NLP", route: "/workspace", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg> },
];

const PHASES = [
  { label: "01 · AI PREPARES", title: "Extract & Analyze", desc: "ClinicalBERT and ChromaDB RAG agents extract and map criteria before the reviewer opens the case.", route: "/workspace", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg> },
  { label: "02 · REVIEW", title: "Review & Determine", desc: "Reviewer examines AI-prepared dossier and submits a clinically reasoned determination. Pipeline is paused at LangGraph interrupt().", route: "/workspace", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /></svg> },
  { label: "03 · AUDIT", title: "Score & Flag", desc: "QA agent audits every decision with 4-dimension weighted scoring. Appeal Risk ML model outputs overturn probability.", route: "/audit", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg> },
  { label: "04 · LEARN", title: "Train & Improve", desc: "Training Agent parses QA findings and creates personalized modules per reviewer. The loop closes on every mistake.", route: "/training", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg> },
];

// ── Compliance items — HIPAA replaced with ClinicalBERT / BioBERT NLP Intelligence
const COMPLIANCE_ITEMS = [
  {
    title: "ClinicalBERT + BioBERT NLP Intelligence",
    desc: "Bio_ClinicalBERT (trained on MIMIC-III) powers clinical note understanding. BioBERT (PubMed-trained) drives ICD-10 semantic suggestion with cosine-similarity ranking across 80 hospital codes.",
    route: "/workspace",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1A7A4A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" /><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" /></svg>,
  },
  {
    title: "JWT + bcrypt Authentication",
    desc: "Passwords are hashed with bcrypt. All sessions are secured with signed JWT access tokens that automatically expire, with refresh handled transparently at the API interceptor layer.",
    route: "/login",
    icon: <Check size={16} color="#1A7A4A" strokeWidth={2.5} />,
  },
  {
    title: "Human-in-the-Loop Architecture",
    desc: "The LangGraph pipeline enforces a mandatory human checkpoint using interrupt(). No decision can be stored without a licensed clinician's active review — the pipeline state is persisted until resumed.",
    route: "/workspace",
    icon: <Check size={16} color="#1A7A4A" strokeWidth={2.5} />,
  },
  {
    title: "Role-Based Access Control",
    desc: "Nurses, reviewers, QA managers, and executives each see a scoped interface. Data separation is enforced at the FastAPI dependency layer using JWT role claims — not just the UI.",
    route: "/cases",
    icon: <Check size={16} color="#1A7A4A" strokeWidth={2.5} />,
  },
];

// Audit log code block — exact JSON per spec
// Colors: k=#FF7A45(keys) s=#7DD3FC(strings) n=#86EFAC(numbers) b=#FCA5A5(bool) c=comment p=punct
const CODE_LINES = [
  [{ t: "// AuditLogMiddleware — every request captured", c: "c" }],
  [{ t: "{", c: "p" }],
  [{ t: '  "event"', c: "k" }, { t: ": ", c: "p" }, { t: '"decision.submitted"', c: "s" }, { t: ",", c: "p" }],
  [{ t: '  "timestamp"', c: "k" }, { t: ": ", c: "p" }, { t: '"2026-06-08T14:32:11Z"', c: "s" }, { t: ",", c: "p" }],
  [{ t: '  "user_id"', c: "k" }, { t: ": ", c: "p" }, { t: '"usr_sarah_collins"', c: "s" }, { t: ",", c: "p" }],
  [{ t: '  "role"', c: "k" }, { t: ": ", c: "p" }, { t: '"nurse_reviewer"', c: "s" }, { t: ",", c: "p" }],
  [{ t: '  "ip_address"', c: "k" }, { t: ": ", c: "p" }, { t: '"10.0.14.22"', c: "s" }, { t: ",", c: "p" }],
  [{ t: '  "case_id"', c: "k" }, { t: ": ", c: "p" }, { t: '"CASE-2026-002"', c: "s" }, { t: ",", c: "p" }],
  [{ t: '  "decision"', c: "k" }, { t: ": ", c: "p" }, { t: '"APPROVED"', c: "s" }, { t: ",", c: "p" }],
  [{ t: '  "qa_score"', c: "k" }, { t: ": ", c: "p" }, { t: "87", c: "n" }, { t: ",", c: "p" }],
  [{ t: '  "overturn_risk"', c: "k" }, { t: ": ", c: "p" }, { t: "0.12", c: "n" }, { t: ",", c: "p" }],
  [{ t: '  "pipeline_resumed"', c: "k" }, { t: ": ", c: "p" }, { t: "true", c: "b" }],
  [{ t: "}", c: "p" }],
  [{ t: "// Immutable record — audit_log table", c: "c" }],
  [{ t: "// Retention: 7 years per HIPAA §164.530", c: "c" }],
];

const NAV_LINKS = [
  { label: "Platform", href: "#platform" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Outcomes", href: "#outcomes" },
  { label: "Compliance", href: "#compliance" },
];

interface StatsData { total_cases: number; approval_rate: number; total_savings_m: number; avg_tat_h: number; sla_pct: number; monthly_cases: number[]; monthly_savings_k: number[]; monthly_approval: number[]; monthly_tat: number[]; }

export default function HomePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [hoveredCap, setHoveredCap] = useState<number | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState("");
  const [stats, setStats] = useState<StatsData>(FALLBACK_METRICS);
  const [metricsVisible, setMetricsVisible] = useState(false);
  const [barsVisible, setBarsVisible] = useState(false);
  const [codeVisible, setCodeVisible] = useState(false);
  const [counters, setCounters] = useState([0, 0, 0, 0]);
  const [visibleCodeLines, setVisibleCodeLines] = useState(0);
  const metricsRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLDivElement>(null);

  // Effect 1 — runs once on client: auth + stats + scroll
  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem("careaudit_token");
    if (token) {
      setIsLoggedIn(true);
      try { const u = JSON.parse(localStorage.getItem("careaudit_user") || "{}"); setUserName(u.full_name || u.username || ""); } catch { }
    }
    fetch("http://localhost:8000/api/v1/stats/public")
      .then(r => r.json()).then(d => setStats(d)).catch(() => { });
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Effect 2 — runs AFTER mounted=true (DOM is rendered, refs are valid)
  useEffect(() => {
    if (!mounted) return;

    // Reveal observer for scroll animations
    const io = new IntersectionObserver(
      (entries) => { entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("ca-vis"); io.unobserve(e.target); } }); },
      { threshold: 0.06, rootMargin: "0px 0px -20px 0px" }
    );
    document.querySelectorAll(".ca-reveal,.ca-reveal-left,.ca-reveal-right").forEach(el => io.observe(el));

    // Metrics section observer
    const mio = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setMetricsVisible(true);
          setTimeout(() => setBarsVisible(true), 300);
          mio.disconnect();
        }
      },
      { threshold: 0.05 }
    );
    if (metricsRef.current) mio.observe(metricsRef.current);

    // Code block observer
    const cio = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) { setCodeVisible(true); cio.disconnect(); } },
      { threshold: 0.05 }
    );
    if (codeRef.current) cio.observe(codeRef.current);

    return () => { io.disconnect(); mio.disconnect(); cio.disconnect(); };
  }, [mounted]);

  // Count-up animation — triggers when metricsVisible or stats changes
  useEffect(() => {
    if (!metricsVisible) return;
    const targets = [stats.total_cases, stats.approval_rate, stats.total_savings_m, stats.avg_tat_h];
    const dur = 1600;
    const start = performance.now();
    let rafId: number;
    const raf = (now: number) => {
      const t2 = Math.min((now - start) / dur, 1);
      const ease = 1 - Math.pow(1 - t2, 3);
      setCounters([
        Math.floor(targets[0] * ease),
        parseFloat((targets[1] * ease).toFixed(1)),
        parseFloat((targets[2] * ease).toFixed(1)),
        parseFloat((targets[3] * ease).toFixed(1)),
      ]);
      if (t2 < 1) rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);
    return () => cancelAnimationFrame(rafId);
  }, [metricsVisible, stats]);

  // Typewriter for code block
  useEffect(() => {
    if (!codeVisible) return;
    let line = 0;
    const iv = setInterval(() => { line++; setVisibleCodeLines(line); if (line >= CODE_LINES.length) clearInterval(iv); }, 120);
    return () => clearInterval(iv);
  }, [codeVisible]);

  const handleLogout = () => { localStorage.removeItem("careaudit_token"); localStorage.removeItem("careaudit_user"); setIsLoggedIn(false); setUserName(""); };
  const goToApp = () => router.push(isLoggedIn ? "/cases" : "/login");
  const scrollTo = (href: string) => { const el = document.querySelector(href); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); };

  // Build the 4 metric configs from API data
  const METRIC_CONFIGS = [
    { label: "Cases Processed", prefix: "", suffix: "+", idx: 0, delta: "↑ +12.3% YoY", bars: stats.monthly_cases },
    { label: "Approval Rate", prefix: "", suffix: "%", idx: 1, delta: `↑ ${stats.sla_pct}% SLA Compliance`, bars: stats.monthly_approval },
    { label: "Total Documented Savings", prefix: "$", suffix: "M", idx: 2, delta: "↑ Full Year 2025", bars: stats.monthly_savings_k },
    { label: "Avg Turnaround Time", prefix: "", suffix: "h", idx: 3, delta: "↓ −22% Improvement", bars: stats.monthly_tat },
  ];

  if (!mounted) return null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,800;0,900;1,700;1,800&family=Outfit:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        html{scroll-behavior:smooth;}
        body{font-family:'Outfit',system-ui,sans-serif;background:#FAF8F5;color:#0F0E0C;padding-top:68px;}

        .ca-reveal{opacity:0;transform:translateY(24px);transition:opacity .7s cubic-bezier(.25,.46,.45,.94),transform .7s cubic-bezier(.25,.46,.45,.94);}
        .ca-reveal-left{opacity:0;transform:translateX(-24px);transition:opacity .7s cubic-bezier(.25,.46,.45,.94),transform .7s cubic-bezier(.25,.46,.45,.94);}
        .ca-reveal-right{opacity:0;transform:translateX(24px);transition:opacity .7s cubic-bezier(.25,.46,.45,.94),transform .7s cubic-bezier(.25,.46,.45,.94);}
        .ca-reveal.ca-vis,.ca-reveal-left.ca-vis,.ca-reveal-right.ca-vis{opacity:1!important;transform:none!important;}

        @keyframes heroIn{from{opacity:0;transform:translateY(-16px);}to{opacity:1;transform:translateY(0);}}
        @keyframes floatA{0%,100%{transform:translateY(0);}50%{transform:translateY(-10px);}}
        @keyframes floatB{0%,100%{transform:translateY(0);}50%{transform:translateY(8px);}}
        @keyframes pulseRing{0%{box-shadow:0 0 0 0 rgba(26,122,74,.5);}70%{box-shadow:0 0 0 8px rgba(26,122,74,0);}100%{box-shadow:0 0 0 0 rgba(26,122,74,0);}}
        @keyframes shimmer{0%{background-position:-200% center;}100%{background-position:200% center;}}
        @keyframes blink{0%,100%{opacity:1;}50%{opacity:0;}}
        @keyframes connIn{from{transform:scaleX(0);}to{transform:scaleX(1);}}

        .hero-pill{animation:heroIn .8s cubic-bezier(.25,.46,.45,.94) both;}
        .hero-h1{animation:heroIn .8s .1s cubic-bezier(.25,.46,.45,.94) both;}
        .hero-sub{animation:heroIn .8s .2s cubic-bezier(.25,.46,.45,.94) both;}
        .hero-cta{animation:heroIn .7s .3s cubic-bezier(.25,.46,.45,.94) both;}
        .hero-trust{animation:heroIn .7s .4s cubic-bezier(.25,.46,.45,.94) both;}
        .hero-mockup{animation:heroIn .9s .15s cubic-bezier(.25,.46,.45,.94) both;}
        .hero-c1{animation:heroIn .6s .6s cubic-bezier(0,.55,.45,1) both,floatA 4s 1.2s ease-in-out infinite;}
        .hero-c2{animation:heroIn .6s .75s cubic-bezier(0,.55,.45,1) both,floatB 4s 2.7s ease-in-out infinite;}
        .pulse-dot{animation:pulseRing 2s ease-out infinite;}
        .cursor-blink{animation:blink .8s ease-in-out infinite;}
        .connector-line{transform-origin:left;animation:connIn .8s .2s cubic-bezier(.25,.46,.45,.94) both;}

        .nav-link{position:relative;text-decoration:none;font-family:'Outfit',sans-serif;font-size:.875rem;font-weight:500;color:rgba(15,14,12,.55);padding:4px 0;cursor:pointer;transition:color .2s;}
        .nav-link::after{content:'';position:absolute;bottom:-2px;left:0;width:0;height:1.5px;background:#E8521A;transition:width .25s cubic-bezier(.25,.46,.45,.94);transform-origin:left;}
        .nav-link:hover{color:#0F0E0C;}
        .nav-link:hover::after{width:100%;}

        .step-card{border:1px solid rgba(15,14,12,.08);border-radius:12px;padding:20px 24px;background:#fff;cursor:pointer;transition:border-color .25s,box-shadow .25s,background .25s;}
        .step-card:hover,.step-card.active{border-color:#E8521A;box-shadow:0 4px 20px rgba(232,82,26,.08);}
        .step-card.active{background:rgba(232,82,26,.02);}
        .step-desc{max-height:0;overflow:hidden;opacity:0;transition:max-height .35s cubic-bezier(.25,.46,.45,.94),opacity .3s,margin-top .3s;}
        .step-card.active .step-desc{max-height:200px;opacity:1;margin-top:12px;}

        .cap-card{background:#fff;padding:36px 32px;display:flex;flex-direction:column;gap:16px;position:relative;cursor:pointer;transition:transform .25s cubic-bezier(.25,.46,.45,.94),box-shadow .25s,background .25s;}
        .cap-card::after{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#E8521A,#FF7A45);transform:scaleX(0);transform-origin:left;transition:transform .3s cubic-bezier(.25,.46,.45,.94);}
        .cap-card:hover{transform:translateY(-4px);box-shadow:0 12px 48px rgba(0,0,0,.08);background:#FFF2EC;}
        .cap-card:hover::after{transform:scaleX(1);}
        .cap-icon-box{width:52px;height:52px;border-radius:12px;background:#FAF8F5;border:1px solid rgba(15,14,12,.1);display:flex;align-items:center;justify-content:center;color:rgba(15,14,12,.5);transition:background .25s,border-color .25s,color .25s;flex-shrink:0;}
        .cap-card:hover .cap-icon-box{background:#E8521A;border-color:#E8521A;color:#fff;}

        .phase-circle{width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid rgba(15,14,12,.1);background:#fff;color:rgba(15,14,12,.4);transition:background .25s,border-color .25s,color .25s,box-shadow .25s;flex-shrink:0;z-index:2;}
        .phase-card{text-align:center;cursor:pointer;}
        .phase-card:hover .phase-circle{background:#E8521A;border-color:#E8521A;color:#fff;box-shadow:0 8px 24px rgba(232,82,26,.3);}

        /* Metric card — dark */
        .metric-card-dark{padding:28px 24px;border-right:1px solid rgba(255,255,255,.06);background:#1E1A17;border-radius:0;transition:background .2s;}
        .metric-card-dark:hover{background:#261F1A;}
        .metric-card-dark:first-child{border-radius:14px 0 0 14px;}
        .metric-card-dark:last-child{border-right:none;border-radius:0 14px 14px 0;}

        /* Compliance card */
        .comp-card{background:#fff;border:1px solid rgba(15,14,12,.08);border-radius:12px;padding:20px 24px;display:flex;gap:16px;align-items:flex-start;cursor:pointer;transition:border-color .2s,box-shadow .2s,transform .25s cubic-bezier(.25,.46,.45,.94);}
        .comp-card:hover{border-color:rgba(232,82,26,.25);box-shadow:0 4px 24px rgba(232,82,26,.08);transform:translateX(4px);}

        /* Sparkbar — animate maxHeight from 0 to final value */
        .sparkbar{max-height:0!important;overflow:hidden;transition:max-height .4s cubic-bezier(.25,.46,.45,.94);align-self:flex-end;}
        .sparkbar.bar-vis{max-height:44px!important;}

        /* Btn */
        .btn-brand{display:inline-flex;align-items:center;gap:8px;padding:8px 20px;background:#E8521A;color:#fff;border:none;border-radius:7px;font-size:.875rem;font-weight:600;cursor:pointer;box-shadow:0 8px 32px rgba(232,82,26,.3);font-family:'Outfit',sans-serif;transition:background .2s,transform .2s;}
        .btn-brand:hover{background:#B53C0C;transform:translateY(-1px);}
        .btn-ghost{background:transparent;border:1.5px solid rgba(15,14,12,.15);border-radius:7px;padding:8px 20px;font-size:.875rem;font-weight:500;color:#0F0E0C;cursor:pointer;font-family:'Outfit',sans-serif;transition:border-color .2s,background .2s;}
        .btn-ghost:hover{border-color:#E8521A;background:#FFF2EC;}
        .btn-signout{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;background:transparent;color:rgba(15,14,12,.5);border:1.5px solid rgba(15,14,12,.12);border-radius:7px;font-size:.875rem;font-weight:500;cursor:pointer;font-family:'Outfit',sans-serif;transition:border-color .2s,color .2s;}
        .btn-signout:hover{border-color:#E8521A;color:#E8521A;}
      `}</style>

      <div style={{ minHeight: "100vh", background: "#FAF8F5" }}>

        {/* ═══ NAV ═══ */}
        <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 200, height: "68px", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 48px", background: "rgba(250,248,245,.95)", backdropFilter: "blur(20px) saturate(180%)", WebkitBackdropFilter: "blur(20px) saturate(180%)", borderBottom: "1px solid rgba(15,14,12,.08)", boxShadow: scrolled ? "0 2px 24px rgba(0,0,0,.08)" : "none", transition: "box-shadow .3s" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ background: "#E8521A", color: "#fff", fontFamily: "'DM Mono',monospace", fontSize: ".62rem", padding: "4px 8px", borderRadius: "4px" }}>EXL</span>
            <span style={{ fontFamily: "'Playfair Display',serif", fontSize: "1.25rem", fontWeight: 700, color: "#0F0E0C" }}>CareAudit<span style={{ color: "#E8521A" }}>.ai</span></span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "36px" }}>
            {NAV_LINKS.map(l => <a key={l.label} className="nav-link" href={l.href} onClick={e => { e.preventDefault(); scrollTo(l.href); }}>{l.label}</a>)}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {isLoggedIn ? (
              <>
                <button className="btn-brand" onClick={() => router.push("/cases")}>Open Platform <ArrowRight size={14} /></button>
                <button className="btn-signout" onClick={handleLogout}><LogOut size={14} /> Sign Out</button>
              </>
            ) : (
              <>
                <button className="btn-ghost" onClick={() => router.push("/login")}>Sign In</button>
                <button className="btn-brand" onClick={() => router.push("/login")}>Start Reviewing <ArrowRight size={14} /></button>
              </>
            )}
          </div>
        </nav>

        {/* ═══ HERO ═══ */}
        <section id="hero" style={{ position: "relative", overflow: "hidden", minHeight: "100vh", display: "flex", alignItems: "center" }}>
          <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(ellipse 640px 640px at 80% 30%,rgba(232,82,26,.12) 0%,transparent 70%),radial-gradient(circle 1px at center,rgba(15,14,12,.35) 0%,transparent 0%)", backgroundSize: "auto,80px 80px" }} />
          <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 48px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "80px", alignItems: "center", position: "relative", zIndex: 1, width: "100%" }}>
            <div>
              <div className="hero-pill" style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "6px 16px 6px 10px", borderRadius: "99px", background: "#fff", border: "1px solid rgba(15,14,12,.1)", marginBottom: "28px", boxShadow: "0 2px 8px rgba(0,0,0,.05)" }}>
                <span className="pulse-dot" style={{ width: 8, height: 8, borderRadius: "50%", background: "#1A7A4A", flexShrink: 0 }} />
                <span style={{ fontFamily: "'Outfit',sans-serif", fontSize: ".78rem", fontWeight: 600, color: "#0F0E0C" }}>Live — All 6 AI Agents Operational</span>
              </div>
              <h1 className="hero-h1" style={{ fontFamily: "'Playfair Display',serif", fontSize: "clamp(2.6rem,4.5vw,3.8rem)", fontWeight: 800, lineHeight: 1.08, color: "#0F0E0C", marginBottom: "24px", letterSpacing: "-.02em" }}>
                Clinical Audit<br />Intelligence that{" "}
                <em style={{ fontStyle: "italic", background: "linear-gradient(135deg,#E8521A 0%,#FF7A45 50%,#E8521A 100%)", backgroundSize: "200% auto", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", animation: "shimmer 2s .9s ease both" }}>Learns</em>{" "}as it Works
              </h1>
              <p className="hero-sub" style={{ fontFamily: "'Outfit',sans-serif", fontSize: "1.05rem", lineHeight: 1.75, color: "rgba(15,14,12,.6)", maxWidth: "460px", marginBottom: "36px" }}>
                CareAudit.ai automates prior authorization reviews, scores every decision in real time, predicts appeal risk, and trains your clinical team — all through a Human-in-the-Loop multi-agent workflow.
              </p>
              <div className="hero-cta" style={{ marginBottom: "52px" }}>
                <button className="btn-brand" style={{ padding: "14px 28px", fontSize: ".95rem", boxShadow: "0 8px 32px rgba(232,82,26,.3)" }} onClick={goToApp}>
                  {isLoggedIn ? "Open Platform" : "Explore Platform"} <ArrowRight size={16} />
                </button>
              </div>
              <div className="hero-trust">
                <p style={{ fontFamily: "'Outfit',sans-serif", fontSize: ".72rem", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(15,14,12,.35)", marginBottom: "14px" }}>Trusted by Leading Health Systems</p>
                <div style={{ display: "flex", alignItems: "center", gap: "28px", flexWrap: "wrap" }}>
                  {["MedStar Health", "Ascension", "HCA Healthcare", "Tenet Health"].map(o => <span key={o} style={{ fontFamily: "'Outfit',sans-serif", fontSize: ".9rem", fontWeight: 600, color: "rgba(15,14,12,.3)" }}>{o}</span>)}
                </div>
              </div>
            </div>
            <div className="hero-mockup" style={{ position: "relative", minHeight: "440px" }}>
              <div style={{ background: "#fff", borderRadius: "16px", border: "1px solid rgba(15,14,12,.08)", boxShadow: "0 24px 80px rgba(0,0,0,.12)", overflow: "hidden", position: "relative", zIndex: 2 }}>
                <div style={{ padding: "12px 16px", background: "#FAF8F5", borderBottom: "1px solid rgba(15,14,12,.08)", display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ display: "flex", gap: "6px" }}>{["#FF5F57", "#FEBC2E", "#28C840"].map(c => <span key={c} style={{ width: 12, height: 12, borderRadius: "50%", background: c }} />)}</div>
                  <div style={{ flex: 1, background: "rgba(15,14,12,.05)", borderRadius: "6px", padding: "4px 12px", fontSize: ".72rem", fontFamily: "'DM Mono',monospace", color: "rgba(15,14,12,.4)" }}>app.careaudit.ai / cases</div>
                </div>
                <div style={{ display: "flex" }}>
                  <div style={{ width: "140px", padding: "20px 14px", borderRight: "1px solid rgba(15,14,12,.06)", display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: "1rem", color: "#E8521A", marginBottom: "16px" }}>CareAudit.ai</span>
                    {["Cases", "Workspace", "Audit", "Analytics"].map((item, i) => <div key={item} style={{ padding: "7px 10px", borderRadius: "6px", fontSize: ".8rem", fontWeight: i === 0 ? 600 : 400, color: i === 0 ? "#E8521A" : "rgba(15,14,12,.5)", background: i === 0 ? "#FFF2EC" : "transparent", fontFamily: "'Outfit',sans-serif" }}>{item}</div>)}
                  </div>
                  <div style={{ flex: 1, padding: "20px 16px" }}>
                    <div style={{ fontSize: ".68rem", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(15,14,12,.35)", marginBottom: "12px", fontFamily: "'Outfit',sans-serif" }}>PENDING QUEUE</div>
                    {[{ id: "CASE-2026-020", name: "Angela Davis", dx: "Sepsis" }, { id: "CASE-2026-004", name: "Dorothy Jenkins", dx: "CHF" }, { id: "CASE-2026-012", name: "Nancy Rodriguez", dx: "COPD" }].map(c => (
                      <div key={c.id} style={{ padding: "10px 12px", borderLeft: "2px solid rgba(232,82,26,.25)", marginBottom: "6px", borderRadius: "0 6px 6px 0", background: "rgba(15,14,12,.02)" }}>
                        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: ".65rem", color: "rgba(15,14,12,.4)", marginBottom: "2px" }}>{c.id}</div>
                        <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: ".8rem", fontWeight: 600, color: "#0F0E0C" }}>{c.name} · {c.dx}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="hero-c1" style={{ position: "absolute", top: "-20px", right: "-24px", zIndex: 3, background: "#fff", borderRadius: "12px", border: "1px solid rgba(15,14,12,.08)", boxShadow: "0 8px 32px rgba(0,0,0,.10)", padding: "14px 18px", minWidth: "180px" }}>
                <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: ".68rem", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "rgba(15,14,12,.4)", marginBottom: "6px" }}>30-DAY QA SCORE</div>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: "2rem", fontWeight: 700, color: "#0F0E0C", lineHeight: 1.1 }}>96.9%</div>
                <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: ".72rem", fontWeight: 600, color: "#1A7A4A", marginTop: "4px" }}>↑ +2.1% vs last quarter</div>
              </div>
              <div className="hero-c2" style={{ position: "absolute", bottom: "20px", left: "-24px", zIndex: 3, background: "#E8521A", borderRadius: "12px", boxShadow: "0 8px 32px rgba(232,82,26,.35)", padding: "14px 18px", minWidth: "160px" }}>
                <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: ".68rem", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "rgba(255,255,255,.7)", marginBottom: "6px" }}>TOTAL SAVINGS</div>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: "2rem", fontWeight: 700, color: "#fff", lineHeight: 1.1 }}>${stats.total_savings_m}M</div>
                <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: ".72rem", color: "rgba(255,255,255,.75)", marginTop: "4px" }}>Documented · FY 2025</div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ PLATFORM ═══ */}
        <section id="platform" style={{ background: "#FAF8F5", padding: "120px 0" }}>
          <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 48px" }}>
            <div className="ca-reveal" style={{ marginBottom: "56px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}><div style={{ width: 32, height: 3, background: "#E8521A", borderRadius: 2 }} /><span style={{ fontFamily: "'Outfit',sans-serif", fontSize: ".75rem", fontWeight: 700, letterSpacing: ".1em", color: "#E8521A", textTransform: "uppercase" }}>Platform Capabilities</span></div>
              <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "clamp(2rem,3vw,2.6rem)", fontWeight: 800, color: "#0F0E0C", lineHeight: 1.15 }}>Every tool your review<br />team needs — in one platform</h2>
              <p style={{ fontFamily: "'Outfit',sans-serif", fontSize: "1rem", color: "rgba(15,14,12,.55)", marginTop: "12px", lineHeight: 1.7 }}>Click any capability to explore it live.</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1px", background: "rgba(15,14,12,.09)", borderRadius: "16px", overflow: "hidden" }}>
              {CAPABILITIES.map((cap, i) => (
                <div key={cap.title} className="cap-card ca-reveal" style={{ transitionDelay: `${i * 80}ms` }} onClick={() => router.push(cap.route)} onMouseEnter={() => setHoveredCap(i)} onMouseLeave={() => setHoveredCap(null)}>
                  <div className="cap-icon-box">{cap.icon}</div>
                  <div>
                    <h3 style={{ fontFamily: "'Outfit',sans-serif", fontSize: "1rem", fontWeight: 700, color: "#0F0E0C", marginBottom: "8px" }}>{cap.title}</h3>
                    <p style={{ fontFamily: "'Outfit',sans-serif", fontSize: ".875rem", lineHeight: 1.7, color: "rgba(15,14,12,.55)" }}>{cap.desc}</p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ display: "inline-block", padding: "4px 12px", borderRadius: "99px", background: hoveredCap === i ? "#E8521A" : "#FFF2EC", color: hoveredCap === i ? "#fff" : "#E8521A", fontFamily: "'Outfit',sans-serif", fontSize: ".68rem", fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", transition: "background .25s,color .25s" }}>{cap.tag}</span>
                    <span style={{ fontFamily: "'Outfit',sans-serif", fontSize: ".75rem", color: hoveredCap === i ? "#E8521A" : "rgba(15,14,12,.3)", display: "flex", alignItems: "center", gap: "4px", transition: "color .2s" }}>Open <ArrowRight size={12} /></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ HOW IT WORKS ═══ */}
        <section id="how-it-works" style={{ background: "#fff", padding: "120px 0" }}>
          <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 48px" }}>
            <div className="ca-reveal" style={{ marginBottom: "56px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}><div style={{ width: 32, height: 3, background: "#E8521A", borderRadius: 2 }} /><span style={{ fontFamily: "'Outfit',sans-serif", fontSize: ".75rem", fontWeight: 700, letterSpacing: ".1em", color: "#E8521A", textTransform: "uppercase" }}>Human-in-the-Loop Workflow</span></div>
              <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "clamp(2rem,3.5vw,2.8rem)", fontWeight: 800, color: "#0F0E0C", lineHeight: 1.15 }}>How It Works</h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "48px", alignItems: "flex-start" }}>
              <div className="ca-reveal-left" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {STEPS.map((step, i) => (
                  <div key={step.num} className={`step-card${activeStep === i ? " active" : ""}`} onClick={() => setActiveStep(i)} onMouseEnter={() => setActiveStep(i)}>
                    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                      <div style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: activeStep === i ? "#E8521A" : "rgba(232,82,26,.1)", color: activeStep === i ? "#fff" : "#E8521A", fontFamily: "'DM Mono',monospace", fontSize: ".78rem", fontWeight: 500, transition: "background .25s,color .25s" }}>{step.num}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: ".68rem", fontWeight: 600, letterSpacing: ".08em", color: "#E8521A", textTransform: "uppercase", marginBottom: "4px" }}>{step.phase}</div>
                        <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: ".95rem", fontWeight: 700, color: "#0F0E0C" }}>{step.title}</div>
                      </div>
                      <ChevronRight size={16} style={{ color: "rgba(15,14,12,.3)", flexShrink: 0, transform: activeStep === i ? "rotate(90deg)" : "rotate(0deg)", transition: "transform .3s" }} />
                    </div>
                    <div className="step-desc"><p style={{ fontFamily: "'Outfit',sans-serif", fontSize: ".875rem", lineHeight: 1.7, color: "rgba(15,14,12,.6)", paddingLeft: "56px" }}>{step.desc}</p></div>
                  </div>
                ))}
              </div>
              <div className="ca-reveal-right" style={{ background: "#FAF8F5", borderRadius: "20px", boxShadow: "inset 0 2px 12px rgba(0,0,0,.04)", padding: "28px", position: "sticky", top: "88px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
                  <span style={{ fontFamily: "'Outfit',sans-serif", fontSize: ".68rem", fontWeight: 700, letterSpacing: ".1em", color: "rgba(15,14,12,.4)", textTransform: "uppercase" }}>Agent Pipeline Status</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "4px 12px", borderRadius: "99px", background: "rgba(26,122,74,.1)", color: "#1A7A4A", fontFamily: "'Outfit',sans-serif", fontSize: ".72rem", fontWeight: 600 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#1A7A4A" }} />All Operational
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  {AGENTS.slice(0, 3).map((a, i) => <AgentRow key={a.name} agent={a} highlighted={activeStep === i} />)}
                  <div style={{ margin: "8px 0", padding: "10px 14px", border: "1.5px dashed rgba(239,68,68,.35)", borderRadius: "10px", display: "flex", alignItems: "center", gap: "10px", background: "rgba(239,68,68,.03)" }}>
                    <div style={{ width: 32, height: 32, borderRadius: "8px", background: "rgba(239,68,68,.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
                    </div>
                    <div>
                      <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: ".8rem", fontWeight: 700, color: "#EF4444" }}>Human Decision Point</div>
                      <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: ".72rem", color: "rgba(15,14,12,.4)" }}>Pipeline paused · Awaiting reviewer decision</div>
                    </div>
                  </div>
                  {AGENTS.slice(3).map((a, i) => <AgentRow key={a.name} agent={a} highlighted={activeStep === 3 && i === 0} />)}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ CORE WORKFLOW ═══ */}
        <section style={{ background: "#fff", padding: "120px 0" }}>
          <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 48px" }}>
            <div className="ca-reveal" style={{ textAlign: "center", marginBottom: "72px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", marginBottom: "16px" }}><div style={{ width: 32, height: 3, background: "#E8521A", borderRadius: 2 }} /><span style={{ fontFamily: "'Outfit',sans-serif", fontSize: ".75rem", fontWeight: 700, letterSpacing: ".1em", color: "#E8521A", textTransform: "uppercase" }}>Core Workflow</span><div style={{ width: 32, height: 3, background: "#E8521A", borderRadius: 2 }} /></div>
              <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "clamp(2rem,3vw,2.6rem)", fontWeight: 800, color: "#0F0E0C", lineHeight: 1.15 }}>Four phases. One closed loop.</h2>
            </div>
            <div style={{ position: "relative" }}>
              <div className="connector-line" style={{ position: "absolute", top: "28px", left: "calc(12.5% + 28px)", right: "calc(12.5% + 28px)", height: "2px", background: "linear-gradient(90deg,#E8521A,#FF7A45,#E8521A)" }} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "24px" }}>
                {PHASES.map((phase, i) => (
                  <div key={phase.label} className="phase-card ca-reveal" style={{ transitionDelay: `${300 + i * 120}ms` }} onClick={() => router.push(phase.route)}>
                    <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}><div className="phase-circle">{phase.icon}</div></div>
                    <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: ".68rem", fontWeight: 700, letterSpacing: ".1em", color: "#E8521A", textTransform: "uppercase", marginBottom: "8px" }}>{phase.label}</div>
                    <h3 style={{ fontFamily: "'Outfit',sans-serif", fontSize: "1rem", fontWeight: 700, color: "#0F0E0C", marginBottom: "10px" }}>{phase.title}</h3>
                    <p style={{ fontFamily: "'Outfit',sans-serif", fontSize: ".85rem", lineHeight: 1.65, color: "rgba(15,14,12,.55)" }}>{phase.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ═══ OUTCOMES — REAL DATA + SPARKLINES ═══ */}
        <section id="outcomes" ref={metricsRef} style={{ background: "#0F0E0C", padding: "100px 0", position: "relative", overflow: "hidden" }}>
          {/* Top radial glow */}
          <div style={{ position: "absolute", top: "-80px", left: "50%", transform: "translateX(-50%)", width: "700px", height: "500px", background: "radial-gradient(ellipse,rgba(232,82,26,.22) 0%,transparent 70%)", opacity: metricsVisible ? 1 : 0, transition: "opacity 1.2s ease", pointerEvents: "none" }} />
          {/* Grid dots */}
          <div style={{ position: "absolute", inset: 0, opacity: .1, backgroundImage: "radial-gradient(circle,rgba(255,255,255,.5) 1px,transparent 1px)", backgroundSize: "80px 80px" }} />

          <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 48px", position: "relative", zIndex: 1 }}>
            {/* Header — 2 col split */}
            <div className="ca-reveal" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "80px", alignItems: "flex-end", marginBottom: "56px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
                  <div style={{ width: 32, height: 3, background: "#E8521A", borderRadius: 2 }} />
                  <span style={{ fontFamily: "'Outfit',sans-serif", fontSize: ".75rem", fontWeight: 700, letterSpacing: ".1em", color: "#E8521A", textTransform: "uppercase" }}>Proven Outcomes</span>
                </div>
                <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "clamp(2rem,3.5vw,3rem)", fontWeight: 800, color: "#fff", lineHeight: 1.12 }}>
                  Real impact from<br />1,000 reviewed cases
                </h2>
              </div>
              <p style={{ fontFamily: "'Outfit',sans-serif", fontSize: ".95rem", lineHeight: 1.75, color: "rgba(255,255,255,.4)", alignSelf: "flex-end" }}>
                Real outcomes from utilization management operations powered by CareAudit AI — drawn from 1,000 historical prior authorization records.
              </p>
            </div>

            {/* ── METRIC CARDS WITH SPARKLINES ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", borderRadius: "16px", overflow: "hidden", border: "1px solid rgba(255,255,255,.07)" }}>
              {METRIC_CONFIGS.map((m, mi) => {
                const raw = counters[m.idx];
                const display = m.idx === 0 ? Math.floor(raw) : raw;
                const maxBar = Math.max(...m.bars, 1);
                return (
                  <div key={m.label} className="metric-card-dark">
                    {/* Big number */}
                    <div style={{ marginBottom: "8px" }}>
                      <span style={{ fontFamily: "'Playfair Display',serif", fontSize: "clamp(2rem,3vw,2.6rem)", fontWeight: 800, color: "#fff", lineHeight: 1 }}>
                        {m.prefix && <span style={{ color: "#E8521A" }}>{m.prefix}</span>}
                        {display}
                        <span style={{ color: "#E8521A" }}>{m.suffix}</span>
                      </span>
                    </div>
                    {/* Label */}
                    <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: ".8rem", color: "rgba(255,255,255,.4)", marginBottom: "12px" }}>{m.label}</div>
                    {/* Delta badge */}
                    <div style={{ marginBottom: "20px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 10px", borderRadius: "99px", background: "rgba(26,122,74,.2)", color: "#4ADE80", fontFamily: "'Outfit',sans-serif", fontSize: ".7rem", fontWeight: 600 }}>
                        {m.delta}
                      </span>
                    </div>
                    {/* Sparkline bar chart — staggered 60ms per bar, 400ms duration */}
                    <div style={{ display: "flex", alignItems: "flex-end", gap: "3px", height: "44px" }}>
                      {m.bars.map((v, bi) => {
                        const pct = (v / maxBar) * 100;
                        const barH = Math.max(Math.round(pct * 0.44), 5);
                        const isHighlight = bi === m.bars.length - 1 || v >= maxBar * 0.75;
                        return (
                          <div
                            key={bi}
                            style={{
                              flex: 1,
                              height: barsVisible ? `${barH}px` : "0px",
                              borderRadius: "2px 2px 0 0",
                              background: isHighlight ? "#E8521A" : "rgba(232,82,26,.3)",
                              alignSelf: "flex-end",
                              transition: "height 0.4s cubic-bezier(.25,.46,.45,.94)",
                              transitionDelay: `${bi * 60}ms`,
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ═══ COMPLIANCE — matches screenshot: grid bg · left checklist · right code ═══ */}
        <section id="compliance" style={{ background: "#FAF8F5", padding: "120px 0", position: "relative" }}>
          {/* Subtle grid overlay matching screenshot */}
          <div style={{ position: "absolute", inset: 0, opacity: .4, backgroundImage: "linear-gradient(rgba(15,14,12,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(15,14,12,.04) 1px,transparent 1px)", backgroundSize: "80px 80px", pointerEvents: "none" }} />

          <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 48px", position: "relative", zIndex: 1 }}>
            {/* Header — 2 col */}
            <div className="ca-reveal" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "80px", alignItems: "flex-start", marginBottom: "72px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
                  <div style={{ width: 32, height: 3, background: "#E8521A", borderRadius: 2 }} />
                  <span style={{ fontFamily: "'Outfit',sans-serif", fontSize: ".75rem", fontWeight: 700, letterSpacing: ".1em", color: "#E8521A", textTransform: "uppercase" }}>Built for Healthcare Compliance</span>
                </div>
                <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "clamp(1.8rem,3vw,2.6rem)", fontWeight: 800, color: "#0F0E0C", lineHeight: 1.12 }}>
                  Security and compliance<br />at the <em style={{ fontStyle: "italic", color: "#E8521A" }}>foundation</em>
                </h2>
              </div>
              <p style={{ fontFamily: "'Outfit',sans-serif", fontSize: "1rem", lineHeight: 1.8, color: "rgba(15,14,12,.55)", paddingTop: "56px" }}>
                CareAudit is architected from the ground up for healthcare's regulatory requirements — not bolted on as an afterthought.
              </p>
            </div>

            {/* Body — left checklist + right code block */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "48px", alignItems: "stretch" }}>
              {/* Left: compliance cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {COMPLIANCE_ITEMS.map((item, i) => (
                  <div key={item.title} className="comp-card ca-reveal-left" style={{ transitionDelay: `${i * 100}ms` }} onClick={() => router.push(item.route)}>
                    <div style={{ width: 36, height: 36, borderRadius: "8px", flexShrink: 0, background: "rgba(26,122,74,.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {item.icon}
                    </div>
                    <div>
                      <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: ".9rem", fontWeight: 700, color: "#0F0E0C", marginBottom: "6px" }}>{item.title}</div>
                      <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: ".82rem", lineHeight: 1.7, color: "rgba(15,14,12,.55)" }}>{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Right: Audit log code block — exact spec */}
              <div ref={codeRef} className="ca-reveal-right" style={{ minHeight: "400px" }}>
                <div style={{
                  height: "100%",
                  background: "#0F0E0C",
                  borderRadius: "20px",
                  padding: "32px",
                  position: "relative",
                  overflow: "hidden",
                  boxShadow: "0 24px 80px rgba(0,0,0,.20)",
                  minHeight: "400px",
                }}>
                  {/* Radial glow — top-right per spec */}
                  <div style={{ position: "absolute", top: "-30%", right: "-20%", width: "360px", height: "360px", background: "radial-gradient(circle,rgba(232,82,26,.25) 0%,transparent 65%)", pointerEvents: "none", zIndex: 0 }} />

                  <div style={{ position: "relative", zIndex: 1 }}>
                    {/* Label */}
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: ".68rem", fontWeight: 500, letterSpacing: ".10em", color: "rgba(255,255,255,.30)", textTransform: "uppercase", marginBottom: "16px" }}>
                      AUDIT LOG · LIVE STREAM
                    </div>
                    {/* Code */}
                    <pre style={{ fontFamily: "'DM Mono',monospace", fontSize: ".75rem", lineHeight: 1.90, margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                      {CODE_LINES.slice(0, visibleCodeLines).map((line, li) => (
                        <div key={li}>
                          {line.map((tok, ti) => (
                            <span key={ti} style={{
                              color:
                                tok.c === "k" ? "#FF7A45" :
                                  tok.c === "s" ? "#7DD3FC" :
                                    tok.c === "n" ? "#86EFAC" :
                                      tok.c === "b" ? "#FCA5A5" :
                                        tok.c === "c" ? "rgba(255,255,255,.25)" :
                                          "rgba(255,255,255,.45)",
                              fontStyle: tok.c === "c" ? "italic" : "normal",
                            }}>{tok.t}</span>
                          ))}
                        </div>
                      ))}
                      {visibleCodeLines >= CODE_LINES.length && <span className="cursor-blink" style={{ color: "#E8521A" }}>|</span>}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ CTA ═══ */}
        <section style={{ background: "#0F0E0C", padding: "120px 0", textAlign: "center", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center,rgba(232,82,26,.15) 0%,transparent 70%)", pointerEvents: "none" }} />
          <div className="ca-reveal" style={{ maxWidth: "640px", margin: "0 auto", padding: "0 48px", position: "relative", zIndex: 1 }}>
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "clamp(2rem,4vw,3rem)", fontWeight: 800, color: "#fff", lineHeight: 1.15, marginBottom: "24px" }}>
              Ready to streamline your<br />prior authorization workflow?
            </h2>
            <p style={{ fontFamily: "'Outfit',sans-serif", fontSize: "1rem", lineHeight: 1.75, color: "rgba(255,255,255,.5)", marginBottom: "40px" }}>
              Start reviewing cases with AI-powered assistance, real-time QA scoring, and predictive appeal risk analysis.
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: "12px" }}>
              <button style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "16px 32px", background: "#E8521A", color: "#fff", border: "none", borderRadius: "8px", fontSize: "1rem", fontWeight: 600, cursor: "pointer", boxShadow: "0 8px 32px rgba(232,82,26,.4)", fontFamily: "'Outfit',sans-serif", transition: "background .2s, transform .2s" }}
                onClick={goToApp}
                onMouseEnter={e => { e.currentTarget.style.background = "#B53C0C"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "#E8521A"; e.currentTarget.style.transform = "translateY(0)"; }}
              >{isLoggedIn ? "Continue Reviewing" : "Sign In to Start"} <ArrowRight size={18} /></button>
              {!isLoggedIn && (
                <button style={{ padding: "16px 32px", background: "rgba(255,255,255,.08)", color: "#fff", border: "1.5px solid rgba(255,255,255,.12)", borderRadius: "8px", fontSize: "1rem", fontWeight: 500, cursor: "pointer", fontFamily: "'Outfit',sans-serif", transition: "background .2s,border-color .2s" }}
                  onClick={() => router.push("/login")}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,.12)"; e.currentTarget.style.borderColor = "rgba(255,255,255,.25)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,.08)"; e.currentTarget.style.borderColor = "rgba(255,255,255,.12)"; }}
                >Sign In</button>
              )}
            </div>
          </div>
        </section>

        {/* ═══ FOOTER ═══ */}
        <footer style={{ background: "#0A0908", padding: "36px 48px", borderTop: "1px solid rgba(255,255,255,.06)" }}>
          <div style={{ maxWidth: "1280px", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ background: "#E8521A", color: "#fff", fontFamily: "'DM Mono',monospace", fontSize: ".62rem", padding: "3px 7px", borderRadius: "4px" }}>EXL</span>
              <span style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: "1rem", color: "#fff" }}>CareAudit<span style={{ color: "#E8521A" }}>.ai</span></span>
            </div>
            <div style={{ display: "flex", gap: "28px" }}>
              {([["Cases", "/cases"], ["Audit Queue", "/audit"], ["Training", "/training"], ["Policy Engine", "/policy"]] as [string, string][]).map(([l, r]) => (
                <span key={l} onClick={() => router.push(r)} style={{ fontFamily: "'Outfit',sans-serif", fontSize: ".8rem", color: "rgba(255,255,255,.3)", cursor: "pointer", transition: "color .2s" }}
                  onMouseEnter={e => { e.currentTarget.style.color = "rgba(255,255,255,.7)"; }}
                  onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,.3)"; }}
                >{l}</span>
              ))}
            </div>
            <span style={{ fontFamily: "'Outfit',sans-serif", fontSize: ".8rem", color: "rgba(255,255,255,.25)" }}>© 2026 CareAudit AI · Role-Based Access Control</span>
          </div>
        </footer>
      </div>
    </>
  );
}

function AgentRow({ agent, highlighted }: { agent: typeof AGENTS[0]; highlighted: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 12px", borderRadius: "10px", border: `1px solid ${highlighted ? "rgba(232,82,26,.25)" : "transparent"}`, background: highlighted ? "#FFF2EC" : "transparent", boxShadow: highlighted ? "0 2px 12px rgba(232,82,26,.1)" : "none", transition: "border-color .2s,background .2s,box-shadow .2s" }}>
      <div style={{ width: 36, height: 36, borderRadius: "8px", flexShrink: 0, background: agent.iconBg, display: "flex", alignItems: "center", justifyContent: "center" }}>{agent.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: ".82rem", fontWeight: 600, color: "#0F0E0C", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{agent.name}</div>
        <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: ".72rem", color: "rgba(15,14,12,.45)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{agent.desc}</div>
      </div>
      <span style={{ padding: "3px 10px", borderRadius: "99px", flexShrink: 0, background: agent.pillBg, color: agent.pillColor, fontFamily: "'DM Mono',monospace", fontSize: ".7rem", fontWeight: 500 }}>{agent.score}</span>
    </div>
  );
}
