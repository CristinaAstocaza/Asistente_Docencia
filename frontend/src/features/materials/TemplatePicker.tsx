"use client";
import { useEffect,useState } from 'react';
import { api,errorMessage,Source,post } from '@/services/api';
export interface Template {id:string;name:string;kind:string;structure:{sections:{title:string;description:string}[];notes:string}}
export default function TemplatePicker({value,onChange,values,onValuesChange,mode,onMode,onBusyChange}:{value:string;onChange:(s:string)=>void;values?:string[];onValuesChange?:(ids:string[])=>void;mode:string;onMode:(s:string)=>void;onBusyChange?:(busy:boolean)=>void}){
 const [items,setItems]=useState<Template[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const selected=values??(value?[value]:[]);
 function change(ids:string[]){if(ids.length>10){setError('Puedes usar hasta 10 documentos de referencia.');return;}if(onValuesChange)onValuesChange(ids);else onChange(ids[0]||'');}
 useEffect(()=>{let active=true;api<Template[]>('/templates').then(v=>{if(active)setItems(v);}).catch(e=>{if(active)setError(errorMessage(e));});return()=>{active=false;};},[]);
 async function upload(files:File[]){
  if(onValuesChange&&selected.length+files.length>10){setError('Puedes usar hasta 10 documentos de referencia.');return;}
  setBusy(true);onBusyChange?.(true);setError('');let ids=[...selected];const errors:string[]=[];
  try{for(const file of files){try{
   const form=new FormData();form.append('file',file);
   const source=await api<Source>('/documents',{method:'POST',body:form});
   await api(`/documents/${source.id}`,{method:'PATCH',body:JSON.stringify({name:source.name,category:'template',enabled:false})});
   const template=await api<Template>('/templates',post({documentId:source.id,name:source.name,kind:'custom'}));
   setItems(v=>[template,...v]);ids=onValuesChange?[...ids,template.id]:[template.id];change(ids);
  }catch(e){errors.push(`${file.name}: ${errorMessage(e)}`);}}setError(errors.join(' · '));}
  finally{setBusy(false);onBusyChange?.(false);}
 }
 return <details className="lesson-options"><summary>Usar {onValuesChange?'documentos':'un documento'} como ejemplo de formato (opcional)</summary>
  <label className="field">{onValuesChange?'Agregar plantilla guardada':'Plantilla guardada'}<select disabled={busy} value={onValuesChange?'':value} onChange={e=>{const id=e.target.value;if(onValuesChange){if(id&&!selected.includes(id))change([...selected,id]);}else onChange(id);}}><option value="">{onValuesChange?'Seleccionar referencia':'Sin plantilla'}</option>{items.filter(t=>!onValuesChange||!selected.includes(t.id)).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
  <label className="field">Subir {onValuesChange?'ejemplos':'ejemplo'} PDF o Word<input disabled={busy} type="file" multiple={!!onValuesChange} accept=".pdf,.docx" onChange={e=>{const files=Array.from(e.target.files||[]);if(files.length)void upload(files);e.target.value='';}}/></label>
  {onValuesChange&&selected.length>0&&<ul aria-label="Documentos de referencia">{selected.map((id,i)=><li key={id}>{items.find(t=>t.id===id)?.name||'Referencia guardada'}{i===0?' (diseño principal)':''} <button type="button" className="btn" disabled={busy} onClick={()=>change(selected.filter(v=>v!==id))} aria-label={`Quitar ${items.find(t=>t.id===id)?.name||'referencia'}`}>Quitar</button></li>)}</ul>}
  {selected.length>0&&<label className="field">Uso de {onValuesChange?'los ejemplos':'el ejemplo'}<select value={mode} onChange={e=>onMode(e.target.value)}><option value="structure">Respetar estructura</option><option value="inspiration">Utilizar como inspiración</option></select></label>}
  {busy&&<p role="status">Analizando y guardando las referencias…</p>}{error&&<p className="error-box" role="alert">{error}</p>}
  <p className="muted">Las estructuras se guardan para reutilizarlas. {onValuesChange?'Puedes agregar varios documentos. El primero orienta el diseño visual y todos aportan su estructura.':'El PDF orienta la organización; su diseño puede variar.'}</p>
 </details>;
}
