export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  CHAT: "/chat",
  CASES: "/cases",
  CASES_NEW: "/cases/new",
  WORKSPACE: "/workspace",
  AUDIT: "/audit",
  ANALYTICS: "/analytics",
  APPEAL: "/appeal",
  TRAINING: "/training",
  EXECUTIVE: "/executive",
  POLICY: "/policy",
  AGENT_PIPELINE: "/agent-pipeline",
} as const;

export const NAV_ITEMS = [
  { label: "Chat", href: ROUTES.CHAT, icon: "MessageSquare" },
  { label: "Cases", href: ROUTES.CASES, icon: "FolderOpen" },
  { label: "Workspace", href: ROUTES.WORKSPACE, icon: "LayoutDashboard" },
  { label: "Audit", href: ROUTES.AUDIT, icon: "ShieldCheck" },
  { label: "Analytics", href: ROUTES.ANALYTICS, icon: "BarChart3" },
  { label: "Appeal Risk", href: ROUTES.APPEAL, icon: "AlertTriangle" },
  { label: "Training", href: ROUTES.TRAINING, icon: "GraduationCap" },
  { label: "Executive", href: ROUTES.EXECUTIVE, icon: "Building2" },
  { label: "Policies", href: ROUTES.POLICY, icon: "FileText" },
  { label: "Agent Pipeline", href: ROUTES.AGENT_PIPELINE, icon: "Workflow" },
] as const;
