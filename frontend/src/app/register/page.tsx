"use client";

import { useState } from "react";
import { api, post, errorMessage } from "@/services/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, Eye, EyeOff, User, Building2, Brain, Sparkles } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", institution: "", email: "", password: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api("/auth/register", post(form));
      router.push("/dashboard");
    } catch (error) { setError(errorMessage(error)); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-bg)", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 480 }} className="animate-fadeIn">
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
            <div style={{ width: 44, height: 44, background: "linear-gradient(135deg, #4361EE, #6C63FF)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 20px rgba(67,97,238,0.3)" }}>
              <Brain size={22} color="white" />
            </div>
            <span style={{ fontSize: 18, fontWeight: 700, color: "var(--color-primary-dark)" }}>Asistente IA para Docentes</span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--color-text)", marginBottom: 8 }}>Crea tu cuenta gratuita</h1>
          <p style={{ color: "var(--color-text-secondary)", fontSize: 14 }}>
            ¿Ya tienes cuenta?{" "}
            <Link href="/login" style={{ color: "var(--color-primary)", fontWeight: 600, textDecoration: "none" }}>Inicia sesión</Link>
          </p>
        </div>

        <div className="card" style={{ padding: 32 }}>
          {error && <p className="error-box" role="alert">{error}</p>}
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {[
              { id: "name", label: "Nombre completo", type: "text", placeholder: "Prof. Ana García", icon: User, field: "name" as const },
              { id: "institution", label: "Institución educativa", type: "text", placeholder: "Universidad Nacional...", icon: Building2, field: "institution" as const },
              { id: "email", label: "Correo electrónico", type: "email", placeholder: "tu@correo.com", icon: Mail, field: "email" as const },
            ].map(({ id, label, type, placeholder, icon: Icon, field }) => (
              <div key={id}>
                <label htmlFor={id} style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--color-text)", marginBottom: 6 }}>{label}</label>
                <div style={{ position: "relative" }}>
                  <Icon size={15} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)" }} />
                  <input
                    id={id}
                    type={type}
                    required={field!=='institution'}
                    value={form[field]}
                    onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                    placeholder={placeholder}
                    style={{ width: "100%", paddingLeft: 40, paddingRight: 14, paddingTop: 11, paddingBottom: 11, border: "1.5px solid var(--color-border)", borderRadius: "var(--radius-md)", fontSize: 14, color: "var(--color-text)", background: "var(--color-surface)", outline: "none", fontFamily: "inherit" }}
                    onFocus={e => (e.target.style.borderColor = "var(--color-primary)")}
                    onBlur={e => (e.target.style.borderColor = "var(--color-border)")}
                  />
                </div>
              </div>
            ))}

            {/* Password */}
            <div>
              <label htmlFor="reg-password" style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--color-text)", marginBottom: 6 }}>Contraseña</label>
              <div style={{ position: "relative" }}>
                <Lock size={15} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)" }} />
                <input
                  id="reg-password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  maxLength={128}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Mínimo 8 caracteres"
                  style={{ width: "100%", paddingLeft: 40, paddingRight: 46, paddingTop: 11, paddingBottom: 11, border: "1.5px solid var(--color-border)", borderRadius: "var(--radius-md)", fontSize: 14, color: "var(--color-text)", background: "var(--color-surface)", outline: "none", fontFamily: "inherit" }}
                  onFocus={e => (e.target.style.borderColor = "var(--color-primary)")}
                  onBlur={e => (e.target.style.borderColor = "var(--color-border)")}
                />
                <button type="button" aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} onClick={() => setShowPassword(!showPassword)} style={{ position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)" }}>
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              id="btn-register"
              type="submit"
              disabled={loading}
              style={{ width: "100%", padding: "13px 0", background: loading ? "#9CA3AF" : "linear-gradient(135deg, var(--color-primary), var(--color-accent))", color: "#fff", border: "none", borderRadius: "var(--radius-md)", fontSize: 15, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 14px rgba(67,97,238,0.3)", marginTop: 4 }}
            >
              {loading ? (
                <><div style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin-slow 0.7s linear infinite" }} />Creando cuenta...</>
              ) : (
                <><Sparkles size={16} />Crear mi cuenta gratis</>
              )}
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: "var(--color-text-muted)" }}>
          Tus fuentes y materiales estarán asociados únicamente a tu cuenta docente.
        </p>
      </div>
    </div>
  );
}
