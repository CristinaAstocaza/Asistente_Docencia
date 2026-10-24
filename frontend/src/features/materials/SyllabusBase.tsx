"use client";
import {useRef,useState} from 'react';
import {Paperclip,FileText,X} from 'lucide-react';
import {api,errorMessage,Source} from '@/services/api';

export type SyllabusImport={topic:string;fields:Record<string,string>;sections?:{title:string;content:string}[]};

export default function SyllabusBase({onImport,onClear,onBusy,disabled}:{onImport:(data:SyllabusImport,source:Source)=>void;onClear:()=>void;onBusy:(busy:boolean)=>void;disabled:boolean}){
 const input=useRef<HTMLInputElement>(null);
 const [file,setFile]=useState<Source|null>(null);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');

 async function upload(value:File){
  setError('');
  if(!value.name.toLowerCase().endsWith('.pdf')||value.size>50*1024*1024){
   setError('Selecciona un documento PDF de hasta 50 MB.');
   return;
  }
  setLoading(true);
  onBusy(true);
  try{
   const body=new FormData();
   body.append('file',value);
   const source=await api<Source>('/documents',{method:'POST',body});
   const imported=await api<SyllabusImport>('/syllabus/import',{method:'POST',body:JSON.stringify({referencePdfId:source.id})});
   setFile(source);
   onImport(imported,source);
  }catch(e){
   setError(errorMessage(e));
  }finally{
   setLoading(false);
   onBusy(false);
  }
 }

 return <section className="syllabus-base">
  <h3>Adjuntar sílabo o documento de referencia (opcional)</h3>
  <p className="muted">Si adjuntas un sílabo o documento base, la IA tomará su estructura y contenidos como guía para generar el nuevo sílabo y autocompletará los datos básicos del curso.</p>
  <button className="btn" type="button" disabled={disabled||loading} onClick={()=>input.current?.click()}>
   <Paperclip size={18}/>
   {loading?'Analizando documento…':file?'Cambiar documento base':'Adjuntar documento base (PDF)'}
  </button>
  <input ref={input} type="file" accept=".pdf,application/pdf" hidden aria-label="Adjuntar documento en PDF" onChange={e=>{const f=e.target.files?.[0];if(f)void upload(f);e.target.value='';}}/>
  {loading&&<p className="loading-line" role="status">Extrayendo datos clave del curso...</p>}
  {file&&<div className="presentation-reference">
   <FileText size={20}/>
   <span>{file.name}</span>
   <button type="button" className="btn icon" disabled={disabled||loading} aria-label="Quitar documento base" onClick={()=>{setFile(null);onClear();}}>
    <X size={16}/>
   </button>
  </div>}
  {error&&<p className="error-box" role="alert">{error}</p>}
 </section>;
}
