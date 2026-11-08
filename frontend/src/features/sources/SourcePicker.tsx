"use client";
import { useState } from 'react';
import Link from 'next/link';
import { BookOpenCheck, CheckCircle2, Folder, Library, Search, Sparkles, UploadCloud } from 'lucide-react';
import { Source } from '@/services/api';
import './source-picker.css';

/** Teacher documents the AI will rely on, and how strictly: the most important choice of every generator. */
export default function SourcePicker({sources,selected,onChange,mode,onMode,chat=false}:{sources:Source[];selected:string[];onChange:(ids:string[])=>void;mode:'sources'|'general';onMode:(mode:'sources'|'general')=>void;chat?:boolean}) {
 const [search,setSearch]=useState('');
 const usable=sources.filter(s=>s.enabled!==false&&s.category!=='template');
 const visible=usable.filter(s=>`${s.name} ${s.folder}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
 const folders=[...new Set(visible.map(s=>s.folder||''))].sort((a,b)=>a.localeCompare(b));
 const readyIds=usable.filter(s=>s.status==='ready').map(s=>s.id);
 function selectFolder(folder:string){const ids=visible.filter(s=>(s.folder||'')===folder&&s.status==='ready').map(s=>s.id);const all=ids.every(id=>selected.includes(id));onChange(all?selected.filter(id=>!ids.includes(id)):[...new Set([...selected,...ids])]);}
 const needsSources=mode==='sources'&&!selected.length;

 return <fieldset className={`source-picker sp${chat?' sp-chat':''}`}>
  <legend className="sp-legend"><Library size={16} aria-hidden/>Tus fuentes</legend>
  <div className="sp-head">
   <p>{chat?'Elige los documentos que el asistente debe consultar en esta conversación.':'Elige los documentos (sílabos, libros, separatas, PDF de ejercicios…) en los que la IA debe basarse para crear el material.'}</p>
   <span className={`sp-count${selected.length?' on':''}`}><CheckCircle2 size={14} aria-hidden/>{selected.length} seleccionada{selected.length===1?'':'s'}</span>
  </div>

  <div className="sp-modes" role="radiogroup" aria-label="Cómo usar tus fuentes">
   <label className={`sp-mode${mode==='general'?' on':''}`}>
    <input type="radio" name={chat?'sp-mode-chat':'sp-mode'} checked={mode==='general'} onChange={()=>onMode('general')}/>
    <Sparkles size={18} aria-hidden/><span><strong>Mis fuentes + IA</strong><small>Usa tus documentos y completa con conocimiento general cuando haga falta.</small></span>
   </label>
   <label className={`sp-mode${mode==='sources'?' on':''}`}>
    <input type="radio" name={chat?'sp-mode-chat':'sp-mode'} checked={mode==='sources'} onChange={()=>onMode('sources')}/>
    <BookOpenCheck size={18} aria-hidden/><span><strong>Solo mis fuentes</strong><small>La IA no agrega información externa: todo sale de tus documentos.</small></span>
   </label>
  </div>
  {needsSources&&<p className="sp-warning" role="status">Con «Solo mis fuentes» debes seleccionar al menos un documento.</p>}

  {!usable.length?<div className="sp-empty">
   <UploadCloud size={26} aria-hidden/>
   {chat?<p>Adjunta archivos aquí para usarlos solo en esta conversación.</p>:<><p><strong>Aún no has subido documentos.</strong> Sube tus PDF, Word, PowerPoint o imágenes y aparecerán aquí para elegirlos.</p><Link className="btn primary" href="/fuentes"><UploadCloud size={15}/>Subir mis fuentes</Link></>}
  </div>:<>
   <div className="sp-tools">
    <label className="sp-search"><Search size={15} aria-hidden/><input type="search" aria-label="Buscar en mis fuentes" placeholder="Buscar por nombre o carpeta" value={search} onChange={e=>setSearch(e.target.value)}/></label>
    {readyIds.length>0&&<button type="button" className="btn subtle" onClick={()=>onChange(readyIds.every(id=>selected.includes(id))?[]:readyIds)}>{readyIds.every(id=>selected.includes(id))?'Quitar todas':'Seleccionar todas'}</button>}
   </div>
   <div className="source-folder-list sp-list">{folders.map(folder=>{const files=visible.filter(s=>(s.folder||'')===folder),ready=files.filter(s=>s.status==='ready');return <details className="source-folder-group" key={folder} open={search?true:folders.length<=2||folder===''}>
    <summary><Folder size={16}/>{folder||'Sin carpeta'} <span>({files.length})</span>{ready.length>0&&<button type="button" className="sp-folder-btn" onClick={e=>{e.preventDefault();selectFolder(folder);}}>{ready.every(s=>selected.includes(s.id))?'Quitar carpeta':'Elegir carpeta'}</button>}</summary>
    {files.map(s=><label className={`source-option sp-file${selected.includes(s.id)?' on':''}`} key={s.id}><input type="checkbox" disabled={s.status!=='ready'} checked={selected.includes(s.id)} onChange={()=>onChange(selected.includes(s.id)?selected.filter(id=>id!==s.id):[...selected,s.id])}/><span>{s.name}<small>{s.type} · {s.status==='ready'?'Lista para usar':s.status==='error'?'No se pudo leer':'Procesando…'}</small></span></label>)}
   </details>;})}</div>
   {!visible.length&&<p className="muted">No hay archivos o carpetas con ese nombre.</p>}
   {!chat&&<p className="sp-foot"><Link href="/fuentes">Subir u organizar documentos en Mis fuentes →</Link></p>}
  </>}
 </fieldset>;
}
