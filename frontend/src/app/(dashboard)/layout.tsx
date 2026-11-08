"use client";
import { useState } from 'react';
import Link from 'next/link';
import { Menu, Search } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import AuthProvider, { useTeacher } from '@/components/AuthProvider';
import { Notices } from '@/components/feedback';
import SectionHelp from '@/components/SectionHelp';
function Shell({ children }: { children: React.ReactNode }) {
    const [mobileOpen, setMobileOpen] = useState(false); const { user } = useTeacher();
    return <div className={`app-shell ${mobileOpen ? 'mobile-nav-open' : ''}`}><Sidebar />{mobileOpen && <button className="nav-backdrop" aria-label="Cerrar menú" onClick={() => setMobileOpen(false)} />}<div className="app-main"><header className="app-header"><button className="btn mobile-menu" aria-label="Abrir menú" aria-expanded={mobileOpen} onClick={() => setMobileOpen(!mobileOpen)}><Menu size={20} /></button><form action="/historial" className="header-search"><Search size={16} /><input name="q" aria-label="Buscar materiales" placeholder="Buscar materiales en tu historial…" /></form><SectionHelp /><Link href="/perfil" className="header-profile" style={{ textDecoration: 'none', cursor: 'pointer' }} title="Ver mi perfil"><span className={`header-avatar${user?.is_admin ? ' admin' : ''}`} aria-hidden>{(user?.name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('')}</span><span className="header-profile-text"><strong>{user?.name}</strong><small>{user?.is_admin ? 'Administrador' : 'Docente'}</small></span></Link></header><main id="main-content">{children}</main></div><Notices /></div>;
}
export default function Layout({ children }: { children: React.ReactNode }) { return <AuthProvider><a className="skip-link" href="#main-content">Saltar al contenido</a><Shell>{children}</Shell></AuthProvider>; }
