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
    fetch("http://127.0.0.1:8000/api/v1/stats/public")
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
        body{font-family:'Outfit',system-ui,sans-serif;background:#FAF8F5;color:#0F0E0C;}

        /* CSS Variables for new design */
        :root {
          --teal-dark: #0A1C1A;
          --teal-mid: #1A3C38;
          --teal-light: #E0F2F1;
          --orange: #E8521A;
          --orange-light: #FF7A45;
        }

        .ca-reveal{opacity:0;transform:translateY(24px);transition:opacity .7s cubic-bezier(.25,.46,.45,.94),transform .7s cubic-bezier(.25,.46,.45,.94);}
        .ca-reveal-left{opacity:0;transform:translateX(-24px);transition:opacity .7s cubic-bezier(.25,.46,.45,.94),transform .7s cubic-bezier(.25,.46,.45,.94);}
        .ca-reveal-right{opacity:0;transform:translateX(24px);transition:opacity .7s cubic-bezier(.25,.46,.45,.94),transform .7s cubic-bezier(.25,.46,.45,.94);}
        .ca-reveal.ca-vis,.ca-reveal-left.ca-vis,.ca-reveal-right.ca-vis{opacity:1!important;transform:none!important;}

        @keyframes heroIn{from{opacity:0;transform:translateY(-16px);}to{opacity:1;transform:translateY(0);}}
        @keyframes shimmer{0%{background-position:-200% center;}100%{background-position:200% center;}}
        @keyframes pulseRing{0%{box-shadow:0 0 0 0 rgba(26,122,74,.5);}70%{box-shadow:0 0 0 8px rgba(26,122,74,0);}100%{box-shadow:0 0 0 0 rgba(26,122,74,0);}}
        
        .hero-pill{animation:heroIn .8s cubic-bezier(.25,.46,.45,.94) both;}
        .hero-h1{animation:heroIn .8s .1s cubic-bezier(.25,.46,.45,.94) both;}
        .hero-sub{animation:heroIn .8s .2s cubic-bezier(.25,.46,.45,.94) both;}
        .hero-cta{animation:heroIn .7s .3s cubic-bezier(.25,.46,.45,.94) both;}
        .hero-mockup{animation:heroIn .9s .15s cubic-bezier(.25,.46,.45,.94) both;}
        
        .pulse-dot{animation:pulseRing 2s ease-out infinite;}

        .nav-link{position:relative;text-decoration:none;font-family:'Outfit',sans-serif;font-size:.875rem;font-weight:500;color:rgba(15,14,12,.55);padding:4px 0;cursor:pointer;transition:color .2s;}
        .nav-link::after{content:'';position:absolute;bottom:-2px;left:0;width:0;height:1.5px;background:#E8521A;transition:width .25s cubic-bezier(.25,.46,.45,.94);transform-origin:left;}
        .nav-link:hover{color:#0F0E0C;}
        .nav-link:hover::after{width:100%;}

        .btn-brand{display:inline-flex;align-items:center;gap:8px;padding:10px 24px;background:#E8521A;color:#fff;border:none;border-radius:24px;font-size:.9rem;font-weight:600;cursor:pointer;box-shadow:0 8px 24px rgba(232,82,26,.3);font-family:'Outfit',sans-serif;transition:background .2s,transform .2s;}
        .btn-brand:hover{background:#C94415;transform:translateY(-1px);}
        .btn-ghost{background:transparent;border:none;padding:10px 20px;font-size:.9rem;font-weight:500;color:#0F0E0C;cursor:pointer;font-family:'Outfit',sans-serif;transition:color .2s;}
        .btn-ghost:hover{color:#E8521A;}

        /* Glassmorphism Cards */
        .glass-card {
          background: rgba(255, 255, 255, 0.4);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.6);
          border-radius: 16px;
          padding: 32px;
          transition: transform 0.3s, box-shadow 0.3s;
          cursor: pointer;
        }
        .glass-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.08);
          background: rgba(255, 255, 255, 0.6);
        }
        .glass-icon {
          width: 48px; height: 48px;
          border-radius: 12px;
          background: rgba(26, 122, 74, 0.1);
          color: #1A7A4A;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 20px;
        }

        /* Dark Mode Metrics */
        .dark-section {
          background: #111414; /* Deep dark teal/charcoal */
          color: #fff;
        }
        .metric-card-dark{
          padding:32px 24px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          transition:background .2s, transform .2s;
        }
        .metric-card-dark:hover{background: rgba(255,255,255,0.06); transform: translateY(-4px);}

        /* Step Card */
        .step-card {
          padding: 20px; border-radius: 12px; transition: all 0.3s; cursor: pointer;
          border-left: 3px solid transparent;
        }
        .step-card.active { background: rgba(232,82,26,0.05); border-left: 3px solid #E8521A; }
        
        /* Compliance Card */
        .comp-card-dark {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          padding: 20px; display: flex; gap: 16px; align-items: flex-start;
          transition: all 0.25s;
        }
        .comp-card-dark:hover { border-color: rgba(26,122,74,0.4); background: rgba(26,122,74,0.05); }

        .sparkbar{max-height:0!important;overflow:hidden;transition:max-height .4s cubic-bezier(.25,.46,.45,.94);align-self:flex-end;}
        .sparkbar.bar-vis{max-height:44px!important;}
      `}</style>

      <div style={{ minHeight: "100vh", background: "#FAF8F5" }}>
        
        {/* ═══ NAV ═══ */}
        <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 200, height: "80px", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 48px", background: scrolled ? "rgba(250,248,245,.9)" : "transparent", backdropFilter: scrolled ? "blur(12px)" : "none", borderBottom: scrolled ? "1px solid rgba(15,14,12,.05)" : "none", transition: "all .3s" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ background: "#E8521A", color: "#fff", fontFamily: "'DM Mono',monospace", fontSize: ".65rem", padding: "6px 10px", borderRadius: "6px" }}>EXL</span>
            <span style={{ fontFamily: "'Playfair Display',serif", fontSize: "1.4rem", fontWeight: 800, color: "#0F0E0C" }}>CareAudit<span style={{ color: "#E8521A" }}>.ai</span></span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "40px" }}>
            {NAV_LINKS.map(l => <a key={l.label} className="nav-link" href={l.href} onClick={e => { e.preventDefault(); scrollTo(l.href); }}>{l.label}</a>)}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {isLoggedIn ? (
              <>
                <button className="btn-brand" onClick={() => router.push("/cases")}>Open Platform <ArrowRight size={14} /></button>
                <button className="btn-ghost" onClick={handleLogout}><LogOut size={16} /> Sign Out</button>
              </>
            ) : (
              <>
                <button className="btn-ghost" onClick={() => router.push("/login")}>Login</button>
                <button className="btn-brand" onClick={() => router.push("/login")}>Get Started <ArrowRight size={14} /></button>
              </>
            )}
          </div>
        </nav>

        {/* ═══ HERO ═══ */}
        <section id="hero" style={{ position: "relative", paddingTop: "140px", paddingBottom: "100px", minHeight: "100vh", display: "flex", alignItems: "center", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(ellipse at 80% 20%, rgba(26,122,74,0.15) 0%, transparent 50%), radial-gradient(ellipse at 20% 80%, rgba(232,82,26,0.15) 0%, transparent 50%)", backgroundSize: "cover" }} />
          <div style={{ position: "absolute", inset: 0, opacity: 0.4, backgroundImage: "radial-gradient(circle,rgba(15,14,12,.1) 1px,transparent 1px)", backgroundSize: "40px 40px" }} />
          
          <div style={{ maxWidth: "1320px", margin: "0 auto", padding: "0 48px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "60px", alignItems: "center", position: "relative", zIndex: 1, width: "100%" }}>
            <div>

              <h1 className="hero-h1" style={{ fontFamily: "'Playfair Display',serif", fontSize: "clamp(3rem, 5vw, 4.5rem)", fontWeight: 800, lineHeight: 1.05, color: "#0A1C1A", marginBottom: "24px", letterSpacing: "-.02em" }}>
                Clinical Audit<br />Intelligence that<br />
                <em style={{ fontStyle: "italic", background: "linear-gradient(135deg,#E8521A 0%,#FF7A45 50%,#E8521A 100%)", backgroundSize: "200% auto", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", animation: "shimmer 2s .9s ease both" }}>Accelerates</em>{" "}Turnarounds
              </h1>
              <p className="hero-sub" style={{ fontFamily: "'Outfit',sans-serif", fontSize: "1.1rem", lineHeight: 1.7, color: "rgba(10,28,26,.7)", maxWidth: "480px", marginBottom: "40px" }}>
                CareAudit.ai automates prior authorization reviews, scores every decision in real time, predicts appeal risk, and scales your quality assurance — all through a Human-in-the-Loop workflow.
              </p>
              <div className="hero-cta">
                <button className="btn-brand" style={{ padding: "16px 32px", fontSize: "1rem" }} onClick={goToApp}>
                  {isLoggedIn ? "Open Platform" : "Get Started"} <ArrowRight size={18} />
                </button>
              </div>
            </div>
            
            {/* HERO MOCKUP — Glassmorphism */}
            <div className="hero-mockup" style={{ position: "relative" }}>
              {/* Ambient blobs behind glass */}
              <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "200px", height: "200px", borderRadius: "50%", background: "radial-gradient(circle, rgba(26,122,74,0.35) 0%, transparent 70%)", filter: "blur(30px)", pointerEvents: "none", zIndex: 0 }} />
              <div style={{ position: "absolute", bottom: "-40px", left: "-20px", width: "160px", height: "160px", borderRadius: "50%", background: "radial-gradient(circle, rgba(232,82,26,0.25) 0%, transparent 70%)", filter: "blur(24px)", pointerEvents: "none", zIndex: 0 }} />

              {/* Glass outer shell */}
              <div style={{ background: "rgba(255,255,255,0.18)", backdropFilter: "blur(32px) saturate(180%)", WebkitBackdropFilter: "blur(32px) saturate(180%)", borderRadius: "28px", border: "1.5px solid rgba(255,255,255,0.55)", boxShadow: "0 8px 40px rgba(0,0,0,.1), inset 0 1px 0 rgba(255,255,255,0.7)", overflow: "hidden", position: "relative", zIndex: 2, padding: "10px" }}>

                {/* Title bar — frosted glass */}
                <div style={{ background: "rgba(250,248,245,0.6)", backdropFilter: "blur(12px)", borderRadius: "18px 18px 0 0", padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.4)", display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ display: "flex", gap: "8px" }}>{["#FF5F57", "#FEBC2E", "#28C840"].map(c => <span key={c} style={{ width: 12, height: 12, borderRadius: "50%", background: c, boxShadow: `0 0 6px ${c}88` }} />)}</div>
                  <div style={{ flex: 1, background: "rgba(255,255,255,0.5)", backdropFilter: "blur(8px)", borderRadius: "8px", padding: "6px 16px", fontSize: ".75rem", fontFamily: "'DM Mono',monospace", color: "rgba(15,14,12,.55)", border: "1px solid rgba(255,255,255,0.6)" }}>app.careaudit.ai / cases</div>
                </div>

                {/* Content area — glass */}
                <div style={{ background: "rgba(255,255,255,0.25)", backdropFilter: "blur(16px)", borderRadius: "0 0 18px 18px", padding: "24px", display: "grid", gap: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontFamily: "'Playfair Display',serif", fontSize: "1.3rem", fontWeight: 700, color: "#0A1C1A" }}>Policy Criteria Tracker</span>
                    <span style={{ fontSize: "0.78rem", color: "#1A7A4A", background: "rgba(26,122,74,0.12)", backdropFilter: "blur(8px)", padding: "5px 14px", borderRadius: "12px", fontWeight: 600, border: "1px solid rgba(26,122,74,0.2)" }}>All Criteria Met</span>
                  </div>
                  {[{ id: "CASE-2026-020", name: "David Chan", status: "Approved", color: "#1A7A4A" }, { id: "CASE-2026-004", name: "Sarah Jenkins", status: "Denied", color: "#EF4444" }].map(c => (
                    <div key={c.id} style={{ padding: "16px 20px", borderRadius: "14px", background: "rgba(255,255,255,0.45)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.65)", boxShadow: "0 2px 12px rgba(0,0,0,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: "1rem", fontWeight: 700, color: "#0A1C1A" }}>{c.name}</div>
                        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: ".72rem", color: "rgba(15,14,12,.45)", marginTop: "4px" }}>{c.id}</div>
                      </div>
                      <div style={{ background: c.color + "18", color: c.color, padding: "6px 18px", borderRadius: "20px", fontSize: "0.85rem", fontWeight: 700, border: `1px solid ${c.color}30`, backdropFilter: "blur(8px)" }}>
                        {c.status}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ CAPABILITIES ═══ */}
        <section id="platform" style={{ padding: "120px 0", position: "relative" }}>
          <div style={{ maxWidth: "1320px", margin: "0 auto", padding: "0 48px" }}>
            <div className="ca-reveal" style={{ marginBottom: "64px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                <span style={{ fontFamily: "'Outfit',sans-serif", fontSize: ".8rem", fontWeight: 700, letterSpacing: ".1em", color: "#E8521A", textTransform: "uppercase" }}>Platform Capabilities</span>
              </div>
              <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "clamp(2rem,3vw,3rem)", fontWeight: 800, color: "#0A1C1A", lineHeight: 1.15 }}>Every tool your review<br />team needs — in one platform</h2>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px" }}>
              {CAPABILITIES.map((cap, i) => (
                <div key={cap.title} className="glass-card ca-reveal" style={{ transitionDelay: `${i * 100}ms` }} onClick={() => router.push(cap.route)}>
                  <div className="glass-icon">{cap.icon}</div>
                  <h3 style={{ fontFamily: "'Outfit',sans-serif", fontSize: "1.1rem", fontWeight: 700, color: "#0A1C1A", marginBottom: "12px" }}>{cap.title}</h3>
                  <p style={{ fontFamily: "'Outfit',sans-serif", fontSize: ".9rem", lineHeight: 1.6, color: "rgba(10,28,26,.6)", marginBottom: "20px", minHeight: "70px" }}>{cap.desc}</p>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#E8521A", letterSpacing: "0.05em" }}>{cap.tag}</span>
                    <ArrowRight size={16} color="rgba(10,28,26,.4)" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ HOW IT WORKS ═══ */}
        <section id="how-it-works" style={{ padding: "120px 0" }}>
          <div style={{ maxWidth: "1320px", margin: "0 auto", padding: "0 48px" }}>
            <div className="ca-reveal" style={{ marginBottom: "64px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                <span style={{ fontFamily: "'Outfit',sans-serif", fontSize: ".8rem", fontWeight: 700, letterSpacing: ".1em", color: "#E8521A", textTransform: "uppercase" }}>Human-in-the-Loop Workflow</span>
              </div>
              <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "clamp(2rem,3.5vw,3rem)", fontWeight: 800, color: "#0A1C1A", lineHeight: 1.15 }}>How It Works</h2>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "400px 1fr", gap: "80px", alignItems: "center" }}>
              <div className="ca-reveal-left" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {STEPS.map((step, i) => (
                  <div key={step.num} className={`step-card ${activeStep === i ? 'active' : ''}`} onClick={() => setActiveStep(i)}>
                    <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: activeStep === i ? "#E8521A" : "rgba(232,82,26,0.1)", color: activeStep === i ? "#fff" : "#E8521A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem", fontWeight: 700, flexShrink: 0 }}>
                        {i + 1}
                      </div>
                      <div>
                        <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#E8521A", letterSpacing: "0.05em", marginBottom: "4px" }}>{step.phase.toUpperCase()}</div>
                        <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#0A1C1A", marginBottom: "8px" }}>{step.title}</div>
                        {activeStep === i && (
                          <div style={{ fontSize: "0.9rem", color: "rgba(10,28,26,.6)", lineHeight: 1.6 }}>{step.desc}</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="ca-reveal-right" style={{ background: "rgba(255,255,255,0.5)", backdropFilter: "blur(20px)", borderRadius: "24px", border: "1px solid rgba(255,255,255,0.8)", padding: "40px", boxShadow: "0 20px 60px rgba(0,0,0,0.05)" }}>
                <div style={{ background: "#fff", borderRadius: "16px", padding: "24px", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
                  <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "rgba(10,28,26,.4)", letterSpacing: "0.1em", marginBottom: "24px" }}>AI PIPELINE STATUS</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {AGENTS.slice(0, 3).map((a, i) => (
                      <div key={a.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", borderRadius: "12px", background: activeStep === i ? "rgba(26,122,74,0.05)" : "#FAF8F5", border: `1px solid ${activeStep === i ? 'rgba(26,122,74,0.2)' : 'transparent'}` }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div style={{ width: 40, height: 40, borderRadius: "10px", background: a.iconBg, color: a.pillColor, display: "flex", alignItems: "center", justifyContent: "center" }}>{a.icon}</div>
                          <div>
                            <div style={{ fontWeight: 600, color: "#0A1C1A", fontSize: "0.95rem" }}>{a.name}</div>
                            <div style={{ fontSize: "0.75rem", color: "rgba(10,28,26,.5)" }}>{a.desc}</div>
                          </div>
                        </div>
                        <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#1A7A4A" }}>Operational</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ OUTCOMES / METRICS (DARK) ═══ */}
        <section id="outcomes" ref={metricsRef} className="dark-section" style={{ padding: "120px 0", position: "relative" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, rgba(232,82,26,0.5), transparent)" }} />
          <div style={{ position: "absolute", inset: 0, opacity: 0.1, backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
          
          <div style={{ maxWidth: "1320px", margin: "0 auto", padding: "0 48px", position: "relative", zIndex: 1 }}>
            <div className="ca-reveal" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "64px" }}>
              <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "clamp(2rem,3.5vw,3rem)", fontWeight: 800, color: "#fff", lineHeight: 1.15, maxWidth: "500px" }}>
                Real impact from 1,000 reviewed cases
              </h2>
              <p style={{ fontFamily: "'Outfit',sans-serif", fontSize: "1rem", color: "rgba(255,255,255,0.6)", maxWidth: "400px", textAlign: "right" }}>
                Proven results from across our network. CareAudit drastically reduces turnaround times while protecting your bottom line.
              </p>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "24px" }}>
              {METRIC_CONFIGS.map((m, i) => (
                <div key={m.label} className="metric-card-dark ca-reveal" style={{ transitionDelay: `${i * 100}ms` }}>
                  <div style={{ fontFamily: "'Playfair Display',serif", fontSize: "3rem", fontWeight: 700, color: "#fff", marginBottom: "8px", display: "flex", alignItems: "center", gap: "4px" }}>
                    {m.prefix}<span style={{ background: "linear-gradient(135deg, #fff, #aaa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{counters[m.idx]}</span><span style={{ color: "#E8521A" }}>{m.suffix}</span>
                  </div>
                  <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: "0.9rem", fontWeight: 600, color: "rgba(255,255,255,0.8)", marginBottom: "8px" }}>{m.label}</div>
                  <div style={{ fontSize: "0.75rem", color: "#22C55E", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ padding: "2px 8px", background: "rgba(34,197,94,0.1)", borderRadius: "10px" }}>{m.delta}</span>
                  </div>
                  {/* Miniature Sparkline */}
                  <div style={{ height: "40px", marginTop: "24px", display: "flex", alignItems: "flex-end", gap: "4px" }}>
                     {m.bars.map((val, bIdx) => {
                       const max = Math.max(...m.bars);
                       const pct = (val / max) * 100;
                       return (
                         <div key={bIdx} className={`sparkbar ${barsVisible ? "bar-vis" : ""}`} style={{ flex: 1, background: "linear-gradient(to top, rgba(232,82,26,0.8), rgba(232,82,26,0.2))", borderRadius: "2px", height: `${pct}%` }} />
                       );
                     })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ COMPLIANCE (DARK) ═══ */}
        <section id="compliance" className="dark-section" style={{ padding: "120px 0 160px 0" }}>
          <div style={{ maxWidth: "1320px", margin: "0 auto", padding: "0 48px" }}>
            <div className="ca-reveal" style={{ marginBottom: "64px" }}>
              <span style={{ fontFamily: "'Outfit',sans-serif", fontSize: ".8rem", fontWeight: 700, letterSpacing: ".1em", color: "#E8521A", textTransform: "uppercase", display: "block", marginBottom: "16px" }}>Enterprise Grade</span>
              <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "clamp(2rem,3vw,3rem)", fontWeight: 800, color: "#fff", lineHeight: 1.15 }}>
                Security and compliance<br />at the <em style={{ fontStyle: "italic", color: "#E8521A" }}>foundation</em>
              </h2>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "80px", alignItems: "center" }}>
              <div className="ca-reveal-left" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {COMPLIANCE_ITEMS.map((item, i) => (
                  <div key={item.title} className="comp-card-dark">
                    <div style={{ width: 32, height: 32, borderRadius: "8px", background: "rgba(26,122,74,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {item.icon}
                    </div>
                    <div>
                      <h4 style={{ fontSize: "1.05rem", fontWeight: 600, color: "#fff", marginBottom: "8px" }}>{item.title}</h4>
                      <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="ca-reveal-right" ref={codeRef} style={{ background: "#000", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", padding: "32px", position: "relative" }}>
                <div style={{ position: "absolute", top: "16px", left: "16px", display: "flex", gap: "8px" }}>
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#333" }} />
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#333" }} />
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#333" }} />
                </div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "0.85rem", lineHeight: 1.6, marginTop: "24px", minHeight: "300px" }}>
                  {CODE_LINES.map((line, i) => (
                    <div key={i} style={{ opacity: i < visibleCodeLines ? 1 : 0, transition: "opacity 0.1s" }}>
                      {line.map((token, j) => {
                        let color = "#A3A3A3";
                        if (token.c === "k") color = "#FF7A45";
                        else if (token.c === "s") color = "#7DD3FC";
                        else if (token.c === "n") color = "#86EFAC";
                        else if (token.c === "b") color = "#FCA5A5";
                        else if (token.c === "c") color = "#4ADE80";
                        return <span key={j} style={{ color }}>{token.t}</span>;
                      })}
                    </div>
                  ))}
                  {codeVisible && visibleCodeLines < CODE_LINES.length && <span className="cursor-blink" style={{ display: "inline-block", width: "8px", height: "16px", background: "#fff", marginLeft: "4px", verticalAlign: "middle" }} />}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ FOOTER CTA ═══ */}
        <section style={{ background: "radial-gradient(ellipse at bottom, #1A3C38 0%, #0A1C1A 100%)", padding: "100px 0", textAlign: "center" }}>
          <div style={{ maxWidth: "800px", margin: "0 auto", padding: "0 48px" }} className="ca-reveal">
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "clamp(2.5rem,4vw,3.5rem)", fontWeight: 800, color: "#fff", lineHeight: 1.15, marginBottom: "32px" }}>
              Ready to streamline your prior authorization workflow?
            </h2>
            <p style={{ fontFamily: "'Outfit',sans-serif", fontSize: "1.1rem", color: "rgba(255,255,255,0.7)", marginBottom: "40px" }}>
              Join the innovative healthcare organizations using CareAudit.ai to scale quality assurance.
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: "16px" }}>
              <button className="btn-brand" style={{ padding: "16px 36px", fontSize: "1.05rem" }} onClick={goToApp}>
                Get Started <ArrowRight size={18} />
              </button>
              <button className="btn-ghost" style={{ color: "#fff", border: "1px solid rgba(255,255,255,0.3)" }} onClick={() => router.push("/login")}>
                Login
              </button>
            </div>
          </div>
        </section>
        
        <footer style={{ background: "#050F0E", padding: "32px 48px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ background: "#E8521A", color: "#fff", fontFamily: "'DM Mono',monospace", fontSize: ".55rem", padding: "4px 6px", borderRadius: "4px" }}>EXL</span>
            <span style={{ fontFamily: "'Playfair Display',serif", fontSize: "1rem", fontWeight: 700, color: "#fff" }}>CareAudit.ai</span>
          </div>
          <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: "0.8rem", color: "rgba(255,255,255,0.5)", display: "flex", gap: "24px" }}>
            <span>© 2026 EXL Health. All rights reserved.</span>
            <a href="#" style={{ color: "inherit", textDecoration: "none" }}>Privacy</a>
            <a href="#" style={{ color: "inherit", textDecoration: "none" }}>Terms</a>
          </div>
        </footer>

      </div>
    </>
  );
}
