"use client";

import { useEffect, useState } from "react";
import { api, post, errorMessage } from "@/services/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, Eye, EyeOff, Sparkles, BookOpen, Brain, FileText } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    let active = true;
    api('/auth/me').then(() => { if (active) router.replace('/dashboard'); })
      .catch(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [router]);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ email: "", password: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api("/auth/login", post(form));
      router.push("/dashboard");
    } catch (error) { setError(errorMessage(error)); }
    finally { setLoading(false); }
  };

  if (checking) return <main className="workspace"><p role="status">Abriendo la aplicación…</p></main>;
  return (
    <div style={{ minHeight: "100vh", display: "flex", background: "var(--color-bg)" }}>
      {/* Left panel */}
      <div style={{
        width: "45%",
        background: "linear-gradient(135deg, #14213D 0%, #1a2d54 60%, #243b6e 100%)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: "60px 48px",
        position: "relative",
        overflow: "hidden",
      }} className="no-print auth-decor" aria-hidden>
        {/* Decorative circles */}
        <div style={{ position: "absolute", top: -80, right: -80, width: 300, height: 300, borderRadius: "50%", background: "rgba(67,97,238,0.12)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -60, left: -60, width: 250, height: 250, borderRadius: "50%", background: "rgba(108,99,255,0.10)", pointerEvents: "none" }} />

        <div style={{ position: "relative", zIndex: 1, textAlign: "center", maxWidth: 400 }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 48 }}>
            <div style={{
              width: 52, height: 52,
              background: "linear-gradient(135deg, #4361EE, #6C63FF)",
              borderRadius: 14,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 8px 24px rgba(67,97,238,0.35)",
            }}>
              <Brain size={28} color="white" />
            </div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", letterSpacing: "-0.3px" }}>Asistente IA</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", fontWeight: 500 }}>para Docentes</div>
            </div>
          </div>

          <h1 style={{ fontSize: 32, fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: 16 }}>
            Tu copiloto<br />
            <span style={{ background: "linear-gradient(90deg, #6C63FF, #4361EE)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>inteligente</span> para<br />
            preparar clases
          </h1>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 15, lineHeight: 1.6, marginBottom: 48 }}>
            Sube tus documentos, selecciona tus fuentes y deja que la IA prepare clases, exámenes, rúbricas y presentaciones por ti.
          </p>

          {/* Features */}
          {[
            { icon: FileText, text: "Sube PDF, Word, PowerPoint e imágenes" },
            { icon: Brain, text: "IA analiza tus documentos y genera material" },
            { icon: BookOpen, text: "Exporta a Word, PDF y PowerPoint" },
          ].map(({ icon: Icon, text }, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, textAlign: "left" }}>
              <div style={{ width: 36, height: 36, background: "rgba(67,97,238,0.2)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={16} color="#6C63FF" />
              </div>
              <span style={{ color: "rgba(255,255,255,0.75)", fontSize: 14 }}>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="auth-form-panel" style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "60px 48px" }}>
        <div style={{ width: "100%", maxWidth: 420 }} className="animate-fadeIn">
          <div style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: 28, fontWeight: 700, color: "var(--color-text)", marginBottom: 8 }}>Iniciar sesión</h2>
            <p style={{ color: "var(--color-text-secondary)", fontSize: 14 }}>
              ¿No tienes cuenta?{" "}
              <Link href="/register" style={{ color: "var(--color-primary)", fontWeight: 600, textDecoration: "none" }}>
                Regístrate gratis
              </Link>
            </p>
          </div>

          {error && <p className="error-box" role="alert">{error}</p>}
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Email */}
            <div>
              <label htmlFor="email" style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--color-text)", marginBottom: 8 }}>
                Correo electrónico
              </label>
              <div style={{ position: "relative" }}>
                <Mail size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)" }} />
                <input
                  id="email"
                  type="email"
                  required
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="tu@correo.com"
                  style={{
                    width: "100%", paddingLeft: 44, paddingRight: 16, paddingTop: 12, paddingBottom: 12,
                    border: "1.5px solid var(--color-border)", borderRadius: "var(--radius-md)",
                    fontSize: 14, color: "var(--color-text)", background: "var(--color-surface)",
                    outline: "none", transition: "border-color 0.2s",
                    fontFamily: "inherit",
                  }}
                  onFocus={e => (e.target.style.borderColor = "var(--color-primary)")}
                  onBlur={e => (e.target.style.borderColor = "var(--color-border)")}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--color-text)", marginBottom: 8 }}>
                Contraseña
              </label>
              <div style={{ position: "relative" }}>
                <Lock size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)" }} />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  maxLength={128}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••"
                  style={{
                    width: "100%", paddingLeft: 44, paddingRight: 48, paddingTop: 12, paddingBottom: 12,
                    border: "1.5px solid var(--color-border)", borderRadius: "var(--radius-md)",
                    fontSize: 14, color: "var(--color-text)", background: "var(--color-surface)",
                    outline: "none", transition: "border-color 0.2s",
                    fontFamily: "inherit",
                  }}
                  onFocus={e => (e.target.style.borderColor = "var(--color-primary)")}
                  onBlur={e => (e.target.style.borderColor = "var(--color-border)")}
                />
                <button type="button" aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} onClick={() => setShowPassword(!showPassword)} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", padding: 0 }}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <Link href="/register" style={{ fontSize: 13, color: "var(--color-primary)", textDecoration: "none", fontWeight: 500 }}>
                Crear una cuenta
              </Link>
            </div>

            <button
              id="btn-login"
              type="submit"
              disabled={loading}
              style={{
                width: "100%", padding: "13px 0",
                background: loading ? "#9CA3AF" : "linear-gradient(135deg, var(--color-primary), var(--color-accent))",
                color: "#fff", border: "none", borderRadius: "var(--radius-md)",
                fontSize: 15, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
                fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                transition: "all 0.2s",
                boxShadow: loading ? "none" : "0 4px 14px rgba(67,97,238,0.35)",
              }}
            >
              {loading ? (
                <>
                  <div style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin-slow 0.7s linear infinite" }} />
                  Ingresando...
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Ingresar a la plataforma
                </>
              )}
            </button>
          <p style={{textAlign:'center',marginTop:16}}><Link href="/recuperar">¿Olvidaste tu contraseña?</Link></p></form>

          {/* Account information */}
          <div style={{ marginTop: 24, padding: "12px 16px", background: "rgba(67,97,238,0.06)", borderRadius: "var(--radius-md)", border: "1px solid rgba(67,97,238,0.15)", fontSize: 13, color: "var(--color-text-secondary)", textAlign: "center" }}>
            Utiliza tu cuenta docente o regístrate para comenzar.
          </div>
        </div>
      </div>
    </div>
  );
}
