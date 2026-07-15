"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, Eye, EyeOff } from "lucide-react";
import Logo from "@/components/brand/Logo";
import EXLBadge from "@/components/brand/EXLBadge";
import { useAuthStore } from "@/store/authStore";

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading } = useAuthStore();
  const [email, setEmail] = useState("sarah.collins@careaudit.ai");
  const [password, setPassword] = useState("nurse123");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
      router.push("/chat");
    } catch {
      setError("Invalid email or password. Make sure the backend is running.");
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-body)" }}>
      <div style={{ width: "100%", maxWidth: "420px", padding: "24px" }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <EXLBadge />
          <div style={{ marginTop: "16px" }}><Logo size="large" /></div>
          <p style={{ color: "var(--text-secondary)", marginTop: "8px", fontSize: "0.9rem" }}>Clinical Audit Intelligence</p>
        </div>

        <div className="card" style={{ padding: "32px" }}>
          <h2 style={{ marginBottom: "24px", textAlign: "center", fontSize: "1.2rem" }}>Sign In</h2>

          {error && (
            <div style={{ padding: "10px 14px", background: "var(--danger-light)", borderRadius: "var(--radius-md)", color: "var(--danger)", fontSize: "0.8rem", marginBottom: "16px" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: "16px" }}>
              <label className="label" style={{ display: "block", marginBottom: "6px" }}>Email</label>
              <div style={{ position: "relative" }}>
                <Mail size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }} />
                <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ paddingLeft: "38px" }} required />
              </div>
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label className="label" style={{ display: "block", marginBottom: "6px" }}>Password</label>
              <div style={{ position: "relative" }}>
                <Lock size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }} />
                <input className="input" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} style={{ paddingLeft: "38px", paddingRight: "38px" }} required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)" }}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: "100%", padding: "12px" }} disabled={isLoading}>
              {isLoading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div style={{ marginTop: "20px", fontSize: "0.75rem", color: "var(--text-tertiary)", textAlign: "center" }}>
            <p style={{ marginBottom: "4px" }}>Please sign in with your corporate credentials.</p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", marginTop: "16px", color: "var(--text-tertiary)", fontSize: "0.75rem" }}>
          <Lock size={12} /> Your data is secure and never stored outside your organisation
        </div>
      </div>
    </div>
  );
}
