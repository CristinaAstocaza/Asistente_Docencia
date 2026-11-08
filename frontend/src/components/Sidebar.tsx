"use client";

import { useTeacher } from "@/components/AuthProvider";
import { api, post, errorMessage } from "@/services/api";
import { notify } from "@/components/feedback";
import Link from "next/link";
import PraxisLogo from "@/components/PraxisLogo";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, FolderOpen, MessageSquare, BookOpen,
  ClipboardList, FileCheck2, Award, Presentation,
  History, LogOut, User, UserCircle, GraduationCap, CalendarDays
} from "lucide-react";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", section: "principal" },
  { href: "/perfil", icon: UserCircle, label: "Mi perfil", section: "principal" },
  { href: "/fuentes", icon: FolderOpen, label: "Mis fuentes", section: "ia" },
  { href: "/chat", icon: MessageSquare, label: "Chat IA", section: "ia" },
  { href: "/clases", icon: GraduationCap, label: "Preparar mi clase", section: "ia" },
  { href: "/sesiones", icon: CalendarDays, label: "Sesiones de aprendizaje", section: "contenido" },
  { href: "/guias", icon: BookOpen, label: "Guías didácticas", section: "contenido" },
  { href: "/silabos", icon: ClipboardList, label: "Sílabos", section: "contenido" },
  { href: "/presentaciones", icon: Presentation, label: "Presentaciones", section: "contenido" },
  { href: "/evaluaciones", icon: FileCheck2, label: "Exámenes", section: "evaluaciones" },
  { href: "/rubricas", icon: Award, label: "Rúbricas", section: "evaluaciones" },
  { href: "/historial", icon: History, label: "Historial", section: "herramientas" },
];

const sections: Record<string, string> = {
  principal: "Inicio",
  ia: "Asistente",
  contenido: "Planificación y materiales",
  evaluaciones: "Evaluaciones",
  herramientas: "Recursos",
};

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useTeacher();

  const grouped = navItems.reduce((acc, item) => {
    if (!acc[item.section]) acc[item.section] = [];
    acc[item.section].push(item);
    return acc;
  }, {} as Record<string, typeof navItems>);

  async function logout() {
    try {
      await api("/auth/logout", post({}));
      router.replace("/login");
      router.refresh();
    } catch (error) {
      notify(errorMessage(error), "error");
    }
  }

  return (
    <aside className="app-sidebar"
      style={{
        width: "var(--sidebar-width)",
        height: "100vh",
        background: "linear-gradient(180deg, #14213D 0%, #1a2d54 100%)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        flexShrink: 0,
        position: "sticky",
        top: 0,
        zIndex: 40,
        boxShadow: "4px 0 20px rgba(0,0,0,0.15)",
      }}
    >
      {/* Logo */}
      <div style={{ padding: "20px 16px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid rgba(255,255,255,0.08)", minHeight: 72 }}>
        <PraxisLogo size={40} />
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: "12px 8px", overflowY: "auto", overflowX: "hidden" }}>
        {Object.entries(grouped).map(([section, items]) => (
          <div key={section} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", padding: "8px 10px 4px" }}>
              {sections[section]}
            </div>
            {items.map(({ href, icon: Icon, label }) => {
              const isActive = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 10px",
                    borderRadius: 10,
                    marginBottom: 2,
                    textDecoration: "none",
                    background: isActive ? "linear-gradient(135deg, rgba(67,97,238,0.25), rgba(108,99,255,0.15))" : "transparent",
                    border: isActive ? "1px solid rgba(67,97,238,0.3)" : "1px solid transparent",
                    color: isActive ? "#fff" : "rgba(255,255,255,0.55)",
                    transition: "all 0.15s",
                    position: "relative",
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = "rgba(255,255,255,0.07)";
                      e.currentTarget.style.color = "rgba(255,255,255,0.85)";
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "rgba(255,255,255,0.55)";
                    }
                  }}
                >
                  {isActive && <div style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: 3, height: 20, background: "#4361EE", borderRadius: "0 3px 3px 0" }} />}
                  <Icon size={16} style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, whiteSpace: "nowrap" }}>{label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div style={{ padding: "12px 8px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <Link
          href="/perfil"
          title="Ver mi perfil"
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 10, marginBottom: 2, textDecoration: "none", color: "inherit", transition: "background 0.15s" }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
        >
          <div style={{ width: 28, height: 28, background: "linear-gradient(135deg, #4361EE, #6C63FF)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <User size={13} color="white" />
          </div>
          <div style={{ overflow: "hidden", minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.name}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.email}</div>
          </div>
        </Link>
        <button
          id="btn-logout"
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 10, background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.12)"; e.currentTarget.style.color = "#FCA5A5"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "rgba(255,255,255,0.4)"; }}
          onClick={logout}
        >
          <LogOut size={15} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 13 }}>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}
