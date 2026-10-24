"use client";

import { useTeacher } from "@/components/AuthProvider";
import { api, post, errorMessage } from "@/services/api";
import { notify } from "@/components/feedback";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, FolderOpen, MessageSquare, BookOpen,
  ClipboardList, FileCheck2, Award, Presentation,
  Download, Puzzle, History, Settings, LogOut, Brain, ChevronLeft,
  ChevronRight, User
} from "lucide-react";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", section: "principal" },
  { href: "/fuentes", icon: FolderOpen, label: "Mis fuentes", section: "ia" },
  { href: "/chat", icon: MessageSquare, label: "Chat IA", section: "ia" },
  { href: "/clases", icon: BookOpen, label: "Preparar mi clase", section: "ia" },
  { href: "/planificacion", icon: ClipboardList, label: "Planificación académica", section: "contenido" },
  { href: "/sesiones", icon: BookOpen, label: "Sesiones de aprendizaje", section: "contenido" },
  { href: "/guias", icon: BookOpen, label: "Guías didácticas", section: "contenido" },
  { href: "/silabos", icon: ClipboardList, label: "Sílabos", section: "contenido" },
  { href: "/preguntas", icon: FileCheck2, label: "Banco de preguntas", section: "evaluaciones" },
  { href: "/evaluaciones", icon: FileCheck2, label: "Exámenes", section: "evaluaciones" },
  { href: "/rubricas", icon: Award, label: "Rúbricas", section: "evaluaciones" },
  { href: "/presentaciones", icon: Presentation, label: "Presentaciones", section: "contenido" },
  { href: "/exportar", icon: Download, label: "Exportar", section: "herramientas" },
  { href: "/plantillas", icon: ClipboardList, label: "Plantillas y lineamientos", section: "herramientas" },
  { href: "/integraciones", icon: Puzzle, label: "Integraciones", section: "herramientas" },
  { href: "/historial", icon: History, label: "Historial", section: "herramientas" },
];

const sections: Record<string, string> = {
  principal: "Inicio",
  ia: "Asistente IA",
  contenido: "Planificación y materiales",
  evaluaciones: "Evaluaciones",
  herramientas: "Configuración y recursos",
};

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}

export default function Sidebar({ collapsed, setCollapsed }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useTeacher();

  const grouped = navItems.reduce((acc, item) => {
    if (!acc[item.section]) acc[item.section] = [];
    acc[item.section].push(item);
    return acc;
  }, {} as Record<string, typeof navItems>);

  return (
    <aside className="app-sidebar"
      style={{
        width: collapsed ? "var(--sidebar-collapsed)" : "var(--sidebar-width)",
        minHeight: "100vh",
        background: "linear-gradient(180deg, #14213D 0%, #1a2d54 100%)",
        display: "flex",
        flexDirection: "column",
        transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
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
        <div style={{ width: 40, height: 40, background: "linear-gradient(135deg, #4361EE, #6C63FF)", borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 4px 12px rgba(67,97,238,0.35)" }}>
          <Brain size={20} color="white" />
        </div>
        {!collapsed && (
          <div style={{ overflow: "hidden" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", whiteSpace: "nowrap" }}>Asistente IA</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", fontWeight: 400 }}>para Docentes</div>
          </div>
        )}
        <button
          id="sidebar-toggle"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
          style={{ marginLeft: "auto", background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 8, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "rgba(255,255,255,0.6)", flexShrink: 0, transition: "background 0.2s" }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.15)")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: "12px 8px", overflowY: "auto", overflowX: "hidden" }}>
        {Object.entries(grouped).map(([section, items]) => (
          <div key={section} style={{ marginBottom: 8 }}>
            {!collapsed && (
              <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", padding: "8px 10px 4px" }}>
                {sections[section]}
              </div>
            )}
            {collapsed && <div style={{ height: 4 }} />}
            {items.map(({ href, icon: Icon, label }) => {
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  title={collapsed ? label : undefined}
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
                    justifyContent: collapsed ? "center" : "flex-start",
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
                  {!collapsed && <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, whiteSpace: "nowrap" }}>{label}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div style={{ padding: "12px 8px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <Link href="/configuracion" title={collapsed ? "Configuración" : undefined} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 10, marginBottom: 2, textDecoration: "none", color: "rgba(255,255,255,0.55)", transition: "all 0.15s", justifyContent: collapsed ? "center" : "flex-start" }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.color = "rgba(255,255,255,0.85)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.55)"; }}>
          <Settings size={16} style={{ flexShrink: 0 }} />
          {!collapsed && <span style={{ fontSize: 13 }}>Configuración</span>}
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 10, justifyContent: collapsed ? "center" : "flex-start", marginBottom: 2 }}>
          <div style={{ width: 28, height: 28, background: "linear-gradient(135deg, #4361EE, #6C63FF)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <User size={13} color="white" />
          </div>
          {!collapsed && (
            <div style={{ overflow: "hidden" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.name}</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{user?.email}</div>
            </div>
          )}
        </div>
        {!user?.temporaryAccess && <button
          id="btn-logout"
          title={collapsed ? "Cerrar sesión" : undefined}
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 10, background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontFamily: "inherit", justifyContent: collapsed ? "center" : "flex-start", transition: "all 0.15s" }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.12)"; e.currentTarget.style.color = "#FCA5A5"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "rgba(255,255,255,0.4)"; }}
          onClick={async () => { try { await api("/auth/logout", post({})); router.replace("/login"); router.refresh(); } catch(error) { notify(errorMessage(error), "error"); } }}
        >
          <LogOut size={15} style={{ flexShrink: 0 }} />
          {!collapsed && <span style={{ fontSize: 13 }}>Cerrar sesión</span>}
        </button>}
      </div>
    </aside>
  );
}
