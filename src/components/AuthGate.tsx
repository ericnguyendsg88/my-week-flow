import { useState } from "react";
import { supabase } from "@/lib/supabase";

interface Props {
  onAuth: (userId: string) => void;
}

export function AuthGate({ onAuth }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"login" | "signup">("login");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const fn = mode === "login"
      ? supabase.auth.signInWithPassword({ email, password })
      : supabase.auth.signUp({ email, password });

    const { data, error } = await fn;
    setLoading(false);

    if (error) { setError(error.message); return; }
    if (data.user) onAuth(data.user.id);
  }

  return (
    <div style={{
      minHeight: "100vh", background: "#F4F1ED",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "#FAFAF8", borderRadius: 24,
        padding: "40px 40px 36px",
        width: 360,
        boxShadow: "0 24px 72px -8px rgba(0,0,0,0.14), 0 4px 20px -4px rgba(0,0,0,0.08)",
        border: "1px solid rgba(0,0,0,0.06)",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "#3C3489",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 18, fontFamily: "Georgia, serif" }}>H</span>
          </div>
          <span style={{ fontSize: 20, fontWeight: 700, color: "#26231F" }}>Horizon</span>
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111", marginBottom: 4 }}>
          {mode === "login" ? "Welcome back" : "Create account"}
        </h2>
        <p style={{ fontSize: 13, color: "#999", marginBottom: 24, fontWeight: 400 }}>
          {mode === "login" ? "Sign in to your Horizon workspace" : "Set up your Horizon workspace"}
        </p>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#AAA", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 5 }}>
              Email
            </label>
            <input
              type="text"
              autoFocus
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              style={{
                width: "100%", boxSizing: "border-box",
                background: "#F5F3F0", border: "1.5px solid rgba(123,115,214,0.22)",
                borderRadius: 10, padding: "10px 12px",
                fontSize: 14, color: "#111", outline: "none",
              }}
              onFocus={e => (e.currentTarget.style.borderColor = "#7B73D6")}
              onBlur={e => (e.currentTarget.style.borderColor = "rgba(123,115,214,0.22)")}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#AAA", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 5 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                width: "100%", boxSizing: "border-box",
                background: "#F5F3F0", border: "1.5px solid rgba(123,115,214,0.22)",
                borderRadius: 10, padding: "10px 12px",
                fontSize: 14, color: "#111", outline: "none",
              }}
              onFocus={e => (e.currentTarget.style.borderColor = "#7B73D6")}
              onBlur={e => (e.currentTarget.style.borderColor = "rgba(123,115,214,0.22)")}
            />
          </div>

          {error && (
            <div style={{
              background: "#FEF0EE", border: "1px solid #FACEC9",
              borderRadius: 10, padding: "9px 12px",
              fontSize: 12, color: "#C0392B", fontWeight: 500,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 4,
              background: loading ? "#9B91E0" : "#3C3489",
              color: "#fff", border: "none", borderRadius: 12,
              padding: "12px 0", fontSize: 14, fontWeight: 700,
              cursor: loading ? "default" : "pointer",
              transition: "background 0.15s",
            }}
          >
            {loading ? "…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: "center" }}>
          <button
            onClick={() => { setMode(m => m === "login" ? "signup" : "login"); setError(null); }}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#9B91E0", fontWeight: 500 }}
          >
            {mode === "login" ? "No account? Create one →" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
