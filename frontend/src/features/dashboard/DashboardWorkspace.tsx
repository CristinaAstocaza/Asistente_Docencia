"use client";
import { useEffect,useState } from 'react';
import Link from 'next/link';
import { FileText,BookOpen,FileCheck2,Award,Sparkles,CalendarDays,GraduationCap,Presentation,ClipboardList,FolderOpen,ArrowRight,MessageSquare,UploadCloud,Clock } from 'lucide-react';
import { api,errorMessage,Kind } from '@/services/api';
import { useTeacher } from '@/components/AuthProvider';
import { catalog } from '@/features/materials/catalog';
import './dashboard.css';

interface Dashboard {documents:number;storageBytes:number;storageLimit?:number;counts:Partial<Record<Kind,number>>;recent:{id:string;kind:Kind;title:string;version:number;created_at:string}[];sources:{id:string;name:string;type:string;status:string}[]}

const stats:{label:string;kind?:Kind;icon:typeof FileText;tone:string;href:string}[]=[
 {label:'Fuentes cargadas',icon:FolderOpen,tone:'blue',href:'/fuentes'},
 {label:'Clases preparadas',kind:'lesson',icon:GraduationCap,tone:'violet',href:'/clases'},
 {label:'Sesiones',kind:'session',icon:CalendarDays,tone:'indigo',href:'/sesiones'},
 {label:'Guías didácticas',kind:'guide',icon:BookOpen,tone:'teal',href:'/guias'},
 {label:'Sílabos',kind:'syllabus',icon:ClipboardList,tone:'amber',href:'/silabos'},
 {label:'Presentaciones',kind:'presentation',icon:Presentation,tone:'orange',href:'/presentaciones'},
 {label:'Exámenes',kind:'exam',icon:FileCheck2,tone:'rose',href:'/evaluaciones'},
 {label:'Rúbricas',kind:'rubric',icon:Award,tone:'green',href:'/rubricas'},
];
const actions=[
 {href:'/clases',icon:GraduationCap,title:'Preparar mi clase',text:'Explicación, ejemplos, actividad y cierre para hoy.',tone:'violet'},
 {href:'/sesiones',icon:CalendarDays,title:'Sesión de aprendizaje',text:'Secuencia didáctica con el formato de la UNICA.',tone:'indigo'},
 {href:'/evaluaciones',icon:FileCheck2,title:'Crear examen',text:'Evaluación formal con versiones A/B y solucionario.',tone:'rose'},
 {href:'/presentaciones',icon:Presentation,title:'Presentación',text:'Diapositivas listas en PowerPoint y PDF.',tone:'orange'},
 {href:'/guias',icon:BookOpen,title:'Guía didáctica',text:'Material de estudio paso a paso con imágenes.',tone:'teal'},
 {href:'/rubricas',icon:Award,title:'Rúbrica',text:'Criterios y niveles de desempeño claros.',tone:'green'},
];
const greeting=()=>{const h=new Date().getHours();return h<12?'Buenos días':h<19?'Buenas tardes':'Buenas noches';};
const day=(d:string)=>new Date(d).toLocaleDateString('es-PE',{timeZone:'America/Lima',day:'2-digit',month:'short',year:'numeric'});

export default function DashboardWorkspace() {
 const {user}=useTeacher();const [data,setData]=useState<Dashboard|null>(null),[error,setError]=useState('');
 useEffect(()=>{let active=true;api<Dashboard>('/dashboard').then(d=>{if(active)setData(d);}).catch(e=>{if(active)setError(errorMessage(e));});return()=>{active=false;};},[]);
 const total=data?Object.values(data.counts).reduce((a,b)=>a+(b||0),0):0;
 const usedMb=(data?.storageBytes||0)/1024/1024,limitMb=(data?.storageLimit||500*1024*1024)/1024/1024,usedPct=Math.min(100,usedMb/limitMb*100);
 const longDate=new Date().toLocaleDateString('es-PE',{timeZone:'America/Lima',weekday:'long',day:'numeric',month:'long'}),today=longDate.charAt(0).toUpperCase()+longDate.slice(1);

 return <div className="workspace dash">
  <section className="dash-hero">
   <div>
    <span className="dash-date">{today}</span>
    <h1>{greeting()}, {user?.name}</h1>
    <p>Transforma tus fuentes en clases, evaluaciones y materiales con el formato de la Universidad Nacional San Luis Gonzaga.</p>
    <div className="dash-hero-actions">
     <Link className="btn primary" href="/clases"><Sparkles size={16}/>Preparar mi clase</Link>
     <Link className="btn ghost-light" href="/fuentes"><UploadCloud size={16}/>Subir fuentes</Link>
     <Link className="btn ghost-light" href="/chat"><MessageSquare size={16}/>Abrir chat IA</Link>
    </div>
   </div>
   <div className="dash-hero-summary" aria-label="Resumen">
    <strong>{data?total:'—'}</strong><span>materiales creados</span>
    <strong>{data?data.documents:'—'}</strong><span>fuentes disponibles</span>
   </div>
  </section>

  {error&&<p role="alert" className="error-box">{error}</p>}

  <h2 className="dash-title">Tu actividad</h2>
  <div className="dash-stats">
   {stats.map(({label,kind,icon:Icon,tone,href})=><Link key={label} href={href} className={`dash-stat tone-${tone}`}>
    <span className="dash-stat-icon"><Icon size={18}/></span>
    <span className="dash-stat-text"><strong>{data?(kind?data.counts[kind]||0:data.documents):'—'}</strong><small>{label}</small></span>
   </Link>)}
  </div>

  <h2 className="dash-title">¿Qué quieres crear hoy?</h2>
  <div className="dash-actions">
   {actions.map(({href,icon:Icon,title,text,tone})=><Link key={href} href={href} className={`dash-action tone-${tone}`}>
    <span className="dash-stat-icon"><Icon size={20}/></span>
    <span><strong>{title}</strong><small>{text}</small></span>
    <ArrowRight size={16} className="dash-action-arrow"/>
   </Link>)}
  </div>

  <div className="dash-columns">
   <section className="card dash-panel">
    <header><h2>Actividad reciente</h2><Link href="/historial">Ver historial <ArrowRight size={14}/></Link></header>
    {!data&&!error&&<p className="muted" role="status">Cargando tu actividad…</p>}
    {data&&!data.recent.length&&<div className="dash-empty"><Clock size={26}/><p>Tus materiales aparecerán aquí cuando los generes.</p><Link className="btn primary" href="/clases">Crear mi primer material</Link></div>}
    <ul className="dash-list">{data?.recent.map(m=><li key={m.id}><Link href={`${m.kind==='summary'?'/historial':catalog[m.kind].path}?id=${m.id}`}>
     <span className={`kind-pill kind-${m.kind}`}>{catalog[m.kind]?.title||m.kind}</span>
     <strong>{m.title}</strong>
     <small>v{m.version} · {day(m.created_at)}</small>
    </Link></li>)}</ul>
   </section>
   <section className="card dash-panel">
    <header><h2>Fuentes recientes</h2><Link href="/fuentes">Mis fuentes <ArrowRight size={14}/></Link></header>
    {data&&!data.sources.length&&<div className="dash-empty"><FolderOpen size={26}/><p>Sube PDF, Word o PowerPoint para que el asistente use tus propios materiales.</p><Link className="btn primary" href="/fuentes"><UploadCloud size={15}/>Subir documentos</Link></div>}
    <ul className="dash-list">{data?.sources.map(s=><li key={s.id}><Link href="/fuentes">
     <FileText size={16} className="dash-file"/>
     <strong>{s.name}</strong>
     <span className={`badge ${s.status==='ready'?'ready':s.status==='error'?'error':''}`}>{s.status==='ready'?'Lista':s.status==='error'?'Error':'Procesando'}</span>
    </Link></li>)}</ul>
    <div className="dash-storage">
     <div><span>Almacenamiento</span><span>{usedMb.toFixed(1)} MB de {limitMb.toFixed(0)} MB</span></div>
     <div className="dash-storage-bar" role="progressbar" aria-valuenow={Math.round(usedPct)} aria-valuemin={0} aria-valuemax={100}><span style={{width:`${usedPct}%`}}/></div>
    </div>
   </section>
  </div>
 </div>;
}
