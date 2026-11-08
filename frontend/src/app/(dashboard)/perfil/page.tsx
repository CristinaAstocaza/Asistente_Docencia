"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, post, errorMessage } from "@/services/api";
import { useTeacher } from "@/components/AuthProvider";
import { notify } from "@/components/feedback";
import {
  User, Shield, Plus, Trash2, Mail, Lock, Eye, EyeOff, Building2, CheckCircle2,
  KeyRound, Users, Search, AlertTriangle, LogOut, FileText, FolderOpen, X, Ban, CircleCheck, ShieldOff,
} from "lucide-react";
import "./profile.css";

interface UserRow {
  id: string; name: string; email: string; institution: string; is_admin: boolean;
  created_at: string; materials: number; sources: number; last_login: string | null;
  disabled?: boolean; protected?: boolean;
}
type Tab = "cuenta" | "seguridad" | "usuarios";

const initials = (name = "") => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join("") || "?";
const date = (value: string | null) => value ? new Date(value).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" }) : "—";

function PasswordInput({ id, label, value, onChange, autoComplete, hint }: { id: string; label: string; value: string; onChange: (v: string) => void; autoComplete: string; hint?: string }) {
  const [show, setShow] = useState(false);
  return <label className="field profile-field" htmlFor={id}>
    <span>{label}</span>
    <div className="profile-input">
      <Lock size={15} aria-hidden />
      <input id={id} type={show ? "text" : "password"} required minLength={autoComplete === "current-password" ? 1 : 8} maxLength={128} autoComplete={autoComplete} value={value} onChange={e => onChange(e.target.value)} />
      <button type="button" className="profile-eye" onClick={() => setShow(!show)} aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}>{show ? <EyeOff size={15} /> : <Eye size={15} />}</button>
    </div>
    {hint && <small className="muted">{hint}</small>}
  </label>;
}

function strength(password: string) {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return [{ label: "Muy débil", level: 0 }, { label: "Débil", level: 1 }, { label: "Aceptable", level: 2 }, { label: "Buena", level: 3 }, { label: "Fuerte", level: 4 }, { label: "Muy fuerte", level: 4 }][score];
}

function SecurityPanel() {
  const router = useRouter();
  const [current, setCurrent] = useState(""), [next, setNext] = useState(""), [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [done, setDone] = useState("");
  const meter = strength(next);
  async function submit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault(); setError(""); setDone("");
    if (next !== confirm) { setError("La confirmación no coincide con la nueva contraseña."); return; }
    setBusy(true);
    try {
      const r = await api<{ message: string }>("/auth/change-password", post({ currentPassword: current, newPassword: next }));
      setDone(r.message); setCurrent(""); setNext(""); setConfirm(""); notify("Contraseña actualizada.");
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }
  async function logout() {
    try { await api("/auth/logout", post({})); router.replace("/login"); router.refresh(); } catch (err) { notify(errorMessage(err), "error"); }
  }
  return <div className="profile-grid">
    <section className="card profile-card">
      <h3><KeyRound size={18} /> Cambiar contraseña</h3>
      <p className="muted">Usa al menos 8 caracteres. Al cambiarla, se cerrará la sesión en tus otros dispositivos.</p>
      {error && <p className="error-box" role="alert">{error}</p>}
      {done && <p className="profile-success" role="status"><CheckCircle2 size={16} />{done}</p>}
      <form onSubmit={submit}>
        <PasswordInput id="pw-current" label="Contraseña actual" value={current} onChange={setCurrent} autoComplete="current-password" />
        <PasswordInput id="pw-new" label="Nueva contraseña" value={next} onChange={setNext} autoComplete="new-password" />
        {next && <div className="profile-meter" data-level={meter.level}><span /><span /><span /><span /><small>{meter.label}</small></div>}
        <PasswordInput id="pw-confirm" label="Repite la nueva contraseña" value={confirm} onChange={setConfirm} autoComplete="new-password" hint={confirm && confirm !== next ? "Las contraseñas no coinciden." : undefined} />
        <button className="btn primary" disabled={busy || !current || next.length < 8 || next !== confirm}>{busy ? "Guardando…" : "Actualizar contraseña"}</button>
      </form>
    </section>
    <section className="card profile-card">
      <h3><Shield size={18} /> Acceso y recuperación</h3>
      <ul className="profile-tips">
        <li>Si olvidas tu contraseña, comunícate con el administrador de la plataforma.</li>
        <li>No compartas tu contraseña. El administrador puede crear cuentas individuales para cada docente.</li>
        <li>Cierra sesión al usar una computadora compartida.</li>
      </ul>
      <button className="btn" onClick={logout}><LogOut size={15} /> Cerrar sesión en este dispositivo</button>
    </section>
  </div>;
}

function DeleteDialog({ user, busy, onCancel, onConfirm }: { user: UserRow; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  const [typed, setTyped] = useState("");
  const matches = typed.trim().toLowerCase() === user.email.toLowerCase();
  useEffect(() => { const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onCancel(); }; window.addEventListener("keydown", esc); return () => window.removeEventListener("keydown", esc); }, [busy, onCancel]);
  return <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget && !busy) onCancel(); }}>
    <section className="modal card profile-delete" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-desc">
      <header><span className="profile-delete-icon"><AlertTriangle size={22} /></span><h2 id="delete-title">¿Eliminar esta cuenta?</h2><button className="btn icon" aria-label="Cancelar" onClick={onCancel} disabled={busy}><X size={18} /></button></header>
      <div className="profile-delete-user"><span className="profile-avatar small">{initials(user.name)}</span><div><strong>{user.name}</strong><small>{user.email}</small></div></div>
      <div id="delete-desc" className="profile-delete-warning">
        <p><strong>Esta acción es permanente y no se puede deshacer.</strong> Se eliminará:</p>
        <ul>
          <li>La cuenta y su acceso a la plataforma (se cerrarán sus sesiones abiertas).</li>
          <li><strong>{user.materials}</strong> material(es) generado(s): sesiones, guías, exámenes, rúbricas, presentaciones y sílabos.</li>
          <li><strong>{user.sources}</strong> fuente(s) subida(s) y sus conversaciones.</li>
        </ul>
      </div>
      <label className="field" htmlFor="delete-confirm"><span>Para confirmar, escribe el correo <strong>{user.email}</strong></span>
        <input id="delete-confirm" autoFocus autoComplete="off" value={typed} onChange={e => setTyped(e.target.value)} placeholder={user.email} />
      </label>
      <div className="toolbar profile-delete-actions">
        <button className="btn" onClick={onCancel} disabled={busy}>Cancelar</button>
        <button className="btn danger" onClick={onConfirm} disabled={!matches || busy}><Trash2 size={15} />{busy ? "Eliminando…" : "Eliminar definitivamente"}</button>
      </div>
    </section>
  </div>;
}

function UsersPanel({ me }: { me: string }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true), [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({ name: "", institution: "", email: "", password: "", is_admin: false });
  const [showPass, setShowPass] = useState(false), [creating, setCreating] = useState(false), [createError, setCreateError] = useState(""), [openForm, setOpenForm] = useState(false);
  const [pending, setPending] = useState<UserRow | null>(null), [deleting, setDeleting] = useState(false);
  const [change, setChange] = useState<{ user: UserRow; patch: { disabled?: boolean; is_admin?: boolean } } | null>(null), [changing, setChanging] = useState(false);

  useEffect(() => {
    api<UserRow[]>("/auth/users").then(setUsers).catch(e => setLoadError(errorMessage(e))).finally(() => setLoading(false));
  }, []);
  const filtered = useMemo(() => { const q = query.trim().toLowerCase(); return q ? users.filter(u => `${u.name} ${u.email} ${u.institution}`.toLowerCase().includes(q)) : users; }, [users, query]);
  const teachers = users.filter(u => !u.is_admin).length;

  async function create(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault(); setCreating(true); setCreateError("");
    try {
      const created = await api<UserRow>("/auth/users", post(form));
      setUsers(prev => [...prev, created]); setForm({ name: "", institution: "", email: "", password: "", is_admin: false }); setOpenForm(false);
      notify(`Cuenta ${created.is_admin ? "de administrador " : ""}creada para ${created.name}. Comparte su correo y contraseña.`);
    } catch (err) { setCreateError(errorMessage(err)); }
    finally { setCreating(false); }
  }
  async function applyChange() {
    if (!change) return; setChanging(true);
    try {
      const r = await api<{ id: string; is_admin: boolean; disabled: boolean }>(`/auth/users/${change.user.id}`, { method: "PATCH", body: JSON.stringify(change.patch) });
      setUsers(prev => prev.map(u => u.id === r.id ? { ...u, is_admin: r.is_admin, disabled: r.disabled } : u));
      notify(change.patch.disabled === true ? `Se desactivó la cuenta de ${change.user.name}.` : change.patch.disabled === false ? `Se activó la cuenta de ${change.user.name}.` : change.patch.is_admin ? `${change.user.name} ahora es administrador.` : `${change.user.name} ya no es administrador.`);
      setChange(null);
    } catch (err) { notify(errorMessage(err), "error"); }
    finally { setChanging(false); }
  }
  async function remove() {
    if (!pending) return; setDeleting(true);
    try { await api(`/auth/users/${pending.id}`, { method: "DELETE" }); setUsers(prev => prev.filter(u => u.id !== pending.id)); notify(`Se eliminó la cuenta de ${pending.name}.`); setPending(null); }
    catch (err) { notify(errorMessage(err), "error"); }
    finally { setDeleting(false); }
  }

  return <>
    <div className="profile-stats">
      <div className="card"><Users size={18} /><strong>{users.length}</strong><span>Cuentas en total</span></div>
      <div className="card"><User size={18} /><strong>{teachers}</strong><span>Docentes / invitados</span></div>
      <div className="card"><Shield size={18} /><strong>{users.length - teachers}</strong><span>Administradores</span></div>
    </div>

    <section className="card profile-card">
      <div className="profile-card-head">
        <h3><Plus size={18} /> Crear cuenta</h3>
        {!openForm && <button className="btn primary" onClick={() => setOpenForm(true)}><Plus size={15} /> Nueva cuenta</button>}
      </div>
      {openForm ? <form onSubmit={create}>
        {createError && <p className="error-box" role="alert">{createError}</p>}
        <div className="profile-form-grid">
          {([
            ["nu-name", "Nombre completo", "name", User, "text", "Prof. Ana García", true],
            ["nu-email", "Correo electrónico", "email", Mail, "email", "docente@correo.com", true],
            ["nu-inst", "Institución (opcional)", "institution", Building2, "text", "Universidad Nacional San Luis Gonzaga", false],
          ] as const).map(([id, label, key, Icon, type, ph, required]) =>
            <label key={id} className="field profile-field" htmlFor={id}><span>{label}</span>
              <div className="profile-input"><Icon size={15} aria-hidden /><input id={id} type={type} required={required} value={form[key]} placeholder={ph} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} /></div>
            </label>)}
          <label className="field profile-field" htmlFor="nu-pass"><span>Contraseña inicial</span>
            <div className="profile-input"><Lock size={15} aria-hidden /><input id="nu-pass" type={showPass ? "text" : "password"} required minLength={8} maxLength={128} autoComplete="new-password" value={form.password} placeholder="Mínimo 8 caracteres" onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
              <button type="button" className="profile-eye" onClick={() => setShowPass(!showPass)} aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}>{showPass ? <EyeOff size={15} /> : <Eye size={15} />}</button></div>
          </label>
        </div>
        <label className={`profile-admin-toggle${form.is_admin ? " on" : ""}`}>
          <input type="checkbox" checked={form.is_admin} onChange={e => setForm(f => ({ ...f, is_admin: e.target.checked }))} />
          <Shield size={16} aria-hidden />
          <span><strong>Cuenta de administrador</strong><small>Podrá crear, desactivar y eliminar cuentas de docentes. Puedes quitarle el rol más adelante.</small></span>
        </label>
        <p className="muted">El usuario podrá cambiar esta contraseña desde su perfil (pestaña Seguridad).</p>
        <div className="toolbar"><button className="btn primary" disabled={creating}>{creating ? "Creando…" : "Crear cuenta"}</button><button type="button" className="btn" onClick={() => { setOpenForm(false); setCreateError(""); }}>Cancelar</button></div>
      </form> : <p className="muted">Solo el administrador crea cuentas: no hay registro público.</p>}
    </section>

    <section className="card profile-card">
      <div className="profile-card-head">
        <h3><Users size={18} /> Cuentas registradas</h3>
        <label className="profile-search"><Search size={15} aria-hidden /><input aria-label="Buscar cuentas" placeholder="Buscar por nombre, correo o institución" value={query} onChange={e => setQuery(e.target.value)} /></label>
      </div>
      {loading && <p role="status" className="muted">Cargando cuentas…</p>}
      {loadError && <p className="error-box" role="alert">{loadError}</p>}
      {!loading && !filtered.length && <p className="muted">{query ? "No hay cuentas que coincidan con la búsqueda." : "Todavía no hay cuentas de docentes."}</p>}
      <ul className="profile-users">
        {filtered.map(u => <li key={u.id} className={u.id === me ? "is-me" : ""}>
          <span className={`profile-avatar small${u.is_admin ? " admin" : ""}`}>{initials(u.name)}</span>
          <div className="profile-user-main">
            <strong>{u.name}{u.is_admin && <em className="profile-badge admin"><Shield size={11} /> Administrador</em>}{u.id === me && <em className="profile-badge">Tú</em>}{u.protected && <em className="profile-badge">Principal</em>}{u.disabled && <em className="profile-badge off">Desactivada</em>}</strong>
            <small>{u.email}{u.institution ? ` · ${u.institution}` : ""}</small>
          </div>
          <div className="profile-user-meta">
            <span title="Materiales generados"><FileText size={13} /> {u.materials}</span>
            <span title="Fuentes subidas"><FolderOpen size={13} /> {u.sources}</span>
            <span title="Último ingreso">Último ingreso: {date(u.last_login)}</span>
            <span title="Fecha de creación">Creada: {date(u.created_at)}</span>
          </div>
          {u.id === me || u.protected ? <span className="profile-user-lock" title={u.protected ? "Cuenta administradora principal: no se puede modificar" : "Tu propia cuenta"}><Lock size={14} /></span>
            : <div className="profile-user-actions">
              <button className="btn icon" onClick={() => setChange({ user: u, patch: { disabled: !u.disabled } })} aria-label={`${u.disabled ? "Activar" : "Desactivar"} la cuenta de ${u.name}`} title={u.disabled ? "Activar cuenta" : "Desactivar cuenta"}>{u.disabled ? <CircleCheck size={15} /> : <Ban size={15} />}</button>
              <button className="btn icon" onClick={() => setChange({ user: u, patch: { is_admin: !u.is_admin } })} aria-label={`${u.is_admin ? "Quitar rol de administrador a" : "Hacer administrador a"} ${u.name}`} title={u.is_admin ? "Quitar rol de administrador" : "Hacer administrador"}>{u.is_admin ? <ShieldOff size={15} /> : <Shield size={15} />}</button>
              {!u.is_admin && <button className="btn icon profile-user-delete" onClick={() => setPending(u)} aria-label={`Eliminar la cuenta de ${u.name}`} title="Eliminar cuenta"><Trash2 size={15} /></button>}
            </div>}
        </li>)}
      </ul>
    </section>
    {pending && <DeleteDialog user={pending} busy={deleting} onCancel={() => setPending(null)} onConfirm={remove} />}
    {change && <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget && !changing) setChange(null); }}>
      <section className="modal card profile-delete" role="alertdialog" aria-modal="true" aria-labelledby="change-title">
        <header><span className="profile-delete-icon" style={{ background: "#EEF2FF", color: "#4361EE" }}>{change.patch.disabled === true ? <Ban size={22} /> : change.patch.disabled === false ? <CircleCheck size={22} /> : change.patch.is_admin ? <Shield size={22} /> : <ShieldOff size={22} />}</span>
          <h2 id="change-title">{change.patch.disabled === true ? "¿Desactivar esta cuenta?" : change.patch.disabled === false ? "¿Activar esta cuenta?" : change.patch.is_admin ? "¿Hacer administrador?" : "¿Quitar el rol de administrador?"}</h2>
          <button className="btn icon" aria-label="Cancelar" onClick={() => setChange(null)} disabled={changing}><X size={18} /></button></header>
        <div className="profile-delete-user"><span className="profile-avatar small">{initials(change.user.name)}</span><div><strong>{change.user.name}</strong><small>{change.user.email}</small></div></div>
        <p className="muted">{change.patch.disabled === true ? "No podrá iniciar sesión y sus sesiones abiertas se cerrarán ahora. Sus materiales y fuentes se conservan; puedes volver a activarla cuando quieras."
          : change.patch.disabled === false ? "Podrá volver a iniciar sesión con su contraseña actual."
          : change.patch.is_admin ? "Podrá crear, desactivar y eliminar cuentas de docentes, y cambiar roles de otros administradores (excepto la cuenta principal)."
          : "Seguirá siendo docente con sus materiales, pero perderá la gestión de usuarios. Sus sesiones abiertas se cerrarán ahora."}</p>
        <div className="toolbar profile-delete-actions"><button className="btn" onClick={() => setChange(null)} disabled={changing}>Cancelar</button><button className={`btn ${change.patch.disabled === true || change.patch.is_admin === false ? "danger" : "primary"}`} onClick={applyChange} disabled={changing}>{changing ? "Aplicando…" : "Confirmar"}</button></div>
      </section>
    </div>}
  </>;
}

export default function PerfilPage() {
  const { user } = useTeacher();
  const isAdmin = !!user?.is_admin;
  const [tab, setTab] = useState<Tab>("cuenta");
  const tabs: [Tab, string, typeof User][] = [["cuenta", "Mi cuenta", User], ["seguridad", "Seguridad", KeyRound], ...(isAdmin ? [["usuarios", "Gestión de usuarios", Users] as [Tab, string, typeof User]] : [])];

  return <div className="workspace profile-page">
    <section className="profile-hero">
      <span className={`profile-avatar${isAdmin ? " admin" : ""}`}>{initials(user?.name)}</span>
      <div>
        <span className="eyebrow">Mi perfil</span>
        <h1>{user?.name}</h1>
        <p><Mail size={14} /> {user?.email}{user?.institution ? <> · <Building2 size={14} /> {user.institution}</> : null}</p>
      </div>
      <em className={`profile-badge big${isAdmin ? " admin" : ""}`}>{isAdmin ? <><Shield size={13} /> Administrador</> : <><User size={13} /> Docente</>}</em>
    </section>

    <nav className="profile-tabs" role="tablist" aria-label="Secciones del perfil">
      {tabs.map(([id, label, Icon]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}><Icon size={15} />{label}</button>)}
    </nav>

    {tab === "cuenta" && <section className="card profile-card">
      <h3><User size={18} /> Datos de la cuenta</h3>
      <dl className="profile-info">
        <div><dt>Nombre de usuario</dt><dd>{user?.name}</dd></div>
        <div><dt>Correo electrónico</dt><dd>{user?.email}</dd></div>
        <div><dt>Institución</dt><dd>{user?.institution || "—"}</dd></div>
        <div><dt>Rol</dt><dd>{isAdmin ? "Administrador: gestiona las cuentas de la plataforma" : "Docente"}</dd></div>
      </dl>
      <p className="muted">Puedes iniciar sesión con tu correo o con tu nombre de usuario. Para cambiar tu contraseña, ve a la pestaña <button className="profile-link" onClick={() => setTab("seguridad")}>Seguridad</button>.</p>
    </section>}
    {tab === "seguridad" && <SecurityPanel />}
    {tab === "usuarios" && isAdmin && user && <UsersPanel me={user.id} />}
  </div>;
}
