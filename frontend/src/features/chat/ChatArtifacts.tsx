"use client";
import { useState } from 'react';
import { Download,FileText } from 'lucide-react';
import { download,errorMessage,Material } from '@/services/api';
import MaterialView from '@/features/materials/MaterialView';

export default function ChatArtifacts({artifacts}:{artifacts:Material[]}) {
 const [busy,setBusy]=useState(''),[error,setError]=useState('');
 async function save(material:Material,format:'docx'|'pdf'|'pptx') {
  setBusy(`${material.id}-${format}`);setError('');
  try{await download(`/content/${material.id}/export`,{format},`${material.title.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').slice(0,120)}.${format}`);}catch(e){setError(errorMessage(e));}finally{setBusy('');}
 }
 return <div className="chat-artifacts">{artifacts.map(a=><section className="chat-artifact" key={a.id}><h3><FileText size={18}/>{a.title}</h3><div className="toolbar"><button className="btn primary" disabled={!!busy} onClick={()=>save(a,'docx')}><Download size={16}/>{busy===`${a.id}-docx`?'Descargando…':'Descargar Word'}</button><button className="btn" disabled={!!busy} onClick={()=>save(a,'pdf')}>Descargar PDF</button>{a.kind==='presentation'&&<button className="btn" disabled={!!busy} onClick={()=>save(a,'pptx')}>Descargar PowerPoint</button>}</div><details><summary>Revisar documento</summary><MaterialView material={a}/></details></section>)}{error&&<p role="alert" className="error-box">{error}</p>}</div>;
}
