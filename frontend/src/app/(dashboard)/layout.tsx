"use client";
import { useState } from 'react';
import { Menu,Search } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import AuthProvider,{useTeacher} from '@/components/AuthProvider';
import { Notices } from '@/components/feedback';
function Shell({children}:{children:React.ReactNode}) {
 const [collapsed,setCollapsed]=useState(false),[mobileOpen,setMobileOpen]=useState(false);const {user}=useTeacher();
 return <div className={`app-shell ${mobileOpen?'mobile-nav-open':''}`}><Sidebar collapsed={collapsed} setCollapsed={setCollapsed}/>{mobileOpen&&<button className="nav-backdrop" aria-label="Cerrar menú" onClick={()=>setMobileOpen(false)}/>}<div className="app-main"><header className="app-header"><button className="btn mobile-menu" aria-label="Abrir menú" aria-expanded={mobileOpen} onClick={()=>setMobileOpen(!mobileOpen)}><Menu size={20}/></button><form action="/historial" className="header-search"><Search size={16}/><input name="q" aria-label="Buscar materiales" placeholder="Buscar materiales en tu historial…"/></form><a className="header-profile" href="/configuracion">{user?.name}</a></header><main id="main-content">{children}</main></div><Notices/></div>;
}
export default function Layout({children}:{children:React.ReactNode}) {return <AuthProvider><a className="skip-link" href="#main-content">Saltar al contenido</a><Shell>{children}</Shell></AuthProvider>;}
