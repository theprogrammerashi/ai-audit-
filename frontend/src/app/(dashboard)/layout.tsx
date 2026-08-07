"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  MessageSquare, FolderOpen, LayoutDashboard, ShieldCheck,
  BarChart3, AlertTriangle, GraduationCap, Building2,
  FileText, Workflow, LogOut, ChevronLeft, ChevronRight
} from "lucide-react";
import Logo from "@/components/brand/Logo";
import EXLBadge from "@/components/brand/EXLBadge";
import FloatingAIBot from "@/components/shared/FloatingAIBot";
import { useAuthStore } from "@/store/authStore";

const NAV_ITEMS = [
  { label: "Chat", href: "/chat", icon: MessageSquare, roles: ["NURSE", "QA_LEAD", "ADMIN", "EXECUTIVE"] },
  { label: "Cases", href: "/cases", icon: FolderOpen, roles: ["NURSE", "QA_LEAD", "ADMIN", "EXECUTIVE"] },
  { label: "Workspace", href: "/workspace", icon: LayoutDashboard, roles: ["NURSE", "QA_LEAD", "ADMIN", "EXECUTIVE"] },
  { label: "Audit", href: "/audit", icon: ShieldCheck, roles: ["NURSE", "QA_LEAD", "ADMIN", "EXECUTIVE"] },
  { label: "Analytics", href: "/analytics", icon: BarChart3, roles: ["QA_LEAD", "ADMIN", "EXECUTIVE"] },
  { label: "Appeal Risk", href: "/appeal", icon: AlertTriangle, roles: ["NURSE", "QA_LEAD", "ADMIN", "EXECUTIVE"] },
  { label: "Training", href: "/training", icon: GraduationCap, roles: ["NURSE", "QA_LEAD", "ADMIN", "EXECUTIVE"] },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, loadFromStorage } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  useEffect(() => {
    loadFromStorage();
    setMounted(true);
    // Restore collapse preference
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") setCollapsed(true);
  }, [loadFromStorage]);

  const toggleCollapsed = () => {
    setCollapsed((v) => {
      localStorage.setItem("sidebar-collapsed", String(!v));
      return !v;
    });
  };

  if (!mounted) return null;

  const sidebarWidth = collapsed ? "64px" : "240px";

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* ── Sidebar ── */}
      <aside
        style={{
          width: sidebarWidth,
          minWidth: sidebarWidth,
          background: "linear-gradient(180deg, var(--bg-sidebar) 0%, #FBF9F7 100%)",
          borderRight: "1px solid var(--border-sidebar)",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          transition: "width 0.22s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* ── Brand Header — ALWAYS VISIBLE ── */}
        <div
          style={{
            padding: "20px 12px 16px",
            borderBottom: "1px solid var(--border-default)",
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "space-between",
            gap: "8px",
            cursor: "pointer",
            flexShrink: 0,
            minHeight: "66px",
          }}
        >
          {/* Logo area — click navigates home */}
          <div
            onClick={() => router.push("/")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              overflow: "hidden",
              flex: 1,
              minWidth: 0,
            }}
          >
            <EXLBadge />
            {!collapsed && (
              <div style={{ overflow: "hidden", whiteSpace: "nowrap" }}>
                <Logo size="small" />
              </div>
            )}
          </div>

          {/* Collapse toggle button */}
          <button
            onClick={(e) => { e.stopPropagation(); toggleCollapsed(); }}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            style={{
              background: "var(--bg-hover)",
              border: "1px solid var(--border-default)",
              borderRadius: "6px",
              padding: "4px",
              cursor: "pointer",
              color: "var(--text-tertiary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--bg-active)";
              e.currentTarget.style.color = "var(--primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--bg-hover)";
              e.currentTarget.style.color = "var(--text-tertiary)";
            }}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* ── Nav Items ── */}
        <nav style={{ flex: 1, padding: collapsed ? "12px 6px" : "12px 8px", overflowY: "auto", overflowX: "hidden" }}>
          {NAV_ITEMS.filter(item => !user || item.roles.includes(user.role)).map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;
            const label = item.label === "Workspace" && user?.role !== "NURSE" ? "QA Workspace" : item.label;
            return (
              <div key={item.href} style={{ position: "relative" }}>
                <button
                  onClick={() => router.push(item.href)}
                  title={collapsed ? label : undefined}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: collapsed ? "center" : "flex-start",
                    gap: "10px",
                    width: "100%",
                    padding: collapsed ? "10px 0" : "9px 14px",
                    marginBottom: "2px",
                    borderRadius: "var(--radius-md)",
                    border: "none",
                    background: isActive ? "var(--bg-active)" : "transparent",
                    color: isActive ? "var(--primary)" : "var(--text-secondary)",
                    fontSize: "0.875rem",
                    fontWeight: isActive ? 500 : 400,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    textAlign: "left",
                    borderLeft: "none",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = "var(--bg-hover)";
                      e.currentTarget.style.color = "var(--primary)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "var(--text-secondary)";
                    }
                  }}
                >
                  <Icon size={18} style={{ flexShrink: 0, transition: "color 0.2s" }} />
                  {!collapsed && (
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                      {label}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </nav>
        
        {/* Subtle scroll shadow */}
        <div style={{ height: "24px", background: "linear-gradient(180deg, transparent, #FBF9F7)", position: "absolute", bottom: "64px", width: "100%", pointerEvents: "none" }} />

        {/* ── User Section ── */}
        <div style={{ position: "relative" }}>
          {profileMenuOpen && (
            <>
              {/* Backdrop to dismiss menu */}
              <div 
                onClick={() => setProfileMenuOpen(false)} 
                style={{ position: "fixed", inset: 0, zIndex: 98 }} 
              />
              {/* Profile Dropdown Menu */}
              <div style={{
                position: "absolute",
                bottom: "calc(100% + 4px)",
                left: collapsed ? "8px" : "12px",
                width: collapsed ? "48px" : "216px",
                background: "var(--bg-surface)",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-md)",
                boxShadow: "var(--shadow-lg)",
                zIndex: 99,
                padding: "6px",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                alignItems: "center",
              }}>
                {user && ["NURSE", "QA_LEAD", "ADMIN", "EXECUTIVE"].includes(user.role) && (
                  <button
                    onClick={() => {
                      router.push("/policy");
                      setProfileMenuOpen(false);
                    }}
                    title="Policies"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: collapsed ? "center" : "flex-start",
                      gap: "8px",
                      width: "100%",
                      padding: collapsed ? "8px 0" : "8px 12px",
                      borderRadius: "6px",
                      border: "none",
                      background: pathname.startsWith("/policy") ? "var(--bg-active)" : "transparent",
                      color: pathname.startsWith("/policy") ? "var(--primary)" : "var(--text-secondary)",
                      fontSize: "0.82rem",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) => {
                      if (!pathname.startsWith("/policy")) {
                        e.currentTarget.style.background = "var(--bg-hover)";
                        e.currentTarget.style.color = "var(--primary)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!pathname.startsWith("/policy")) {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "var(--text-secondary)";
                      }
                    }}
                  >
                    <FileText size={16} style={{ flexShrink: 0 }} />
                    {!collapsed && <span>Policies</span>}
                  </button>
                )}

                {user && ["QA_LEAD", "ADMIN", "EXECUTIVE"].includes(user.role) && (
                  <button
                    onClick={() => {
                      router.push("/agent-pipeline");
                      setProfileMenuOpen(false);
                    }}
                    title="Agent Pipeline"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: collapsed ? "center" : "flex-start",
                      gap: "8px",
                      width: "100%",
                      padding: collapsed ? "8px 0" : "8px 12px",
                      borderRadius: "6px",
                      border: "none",
                      background: pathname.startsWith("/agent-pipeline") ? "var(--bg-active)" : "transparent",
                      color: pathname.startsWith("/agent-pipeline") ? "var(--primary)" : "var(--text-secondary)",
                      fontSize: "0.82rem",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) => {
                      if (!pathname.startsWith("/agent-pipeline")) {
                        e.currentTarget.style.background = "var(--bg-hover)";
                        e.currentTarget.style.color = "var(--primary)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!pathname.startsWith("/agent-pipeline")) {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "var(--text-secondary)";
                      }
                    }}
                  >
                    <Workflow size={16} style={{ flexShrink: 0 }} />
                    {!collapsed && <span>Agent Pipeline</span>}
                  </button>
                )}
              </div>
            </>
          )}

          <div
            onClick={() => setProfileMenuOpen(!profileMenuOpen)}
            style={{
              padding: collapsed ? "12px 6px" : "12px 16px",
              borderTop: "1px solid var(--border-default)",
              display: "flex",
              alignItems: "center",
              justifyContent: collapsed ? "center" : "space-between",
              gap: "8px",
              cursor: "pointer",
              transition: "background 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--bg-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            {/* User avatar */}
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #E8521A, #c44015)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: "0.85rem",
                fontWeight: 700,
                flexShrink: 0,
                boxShadow: "0 2px 8px rgba(232, 82, 26, 0.25)",
              }}
              title={user?.full_name || "Guest"}
            >
              {(user?.full_name || "G").charAt(0).toUpperCase()}
            </div>

            {!collapsed && (
              <div style={{ flex: 1, overflow: "hidden" }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--text-primary)", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
                  {user?.full_name || "Guest User"}
                </div>
                <div style={{ fontSize: "0.7rem", color: "var(--text-tertiary)" }}>
                  {user?.role || "NURSE"}
                </div>
              </div>
            )}

            {!collapsed && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  logout();
                  router.push("/login");
                }}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px",
                  color: "var(--text-tertiary)",
                  display: "flex",
                  position: "relative",
                  zIndex: 101,
                }}
                title="Logout"
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main style={{ flex: 1, overflow: "auto", background: "var(--bg-body)" }}>
        {children}
      </main>

      {/* ── Floating AI Bot — rendered globally across all dashboard pages ── */}
      <FloatingAIBot />
    </div>
  );
}
