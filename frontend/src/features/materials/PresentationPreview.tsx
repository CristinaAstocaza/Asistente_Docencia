"use client";
import {useEffect,useRef,useState} from 'react';
import {Eye,X} from 'lucide-react';
import {request,errorMessage} from '@/services/api';

export default function PresentationPreview({id,disabled}:{id:string;disabled:boolean}){
 const [open,setOpen]=useState(false),[url,setUrl]=useState(''),[loading,setLoading]=useState(false),[error,setError]=useState(''),[images,setImages]=useState<number>();
 const controller=useRef<AbortController|null>(null);
 useEffect(()=>()=>controller.current?.abort(),[]);
 useEffect(()=>()=>{if(url)URL.revokeObjectURL(url);},[url]);
 useEffect(()=>{if(!open)return;const close=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false);};document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close);},[open]);
 async function preview(){setOpen(true);if(url)return;setLoading(true);setError('');const abort=new AbortController();controller.current=abort;try{const response=await request(`/content/${id}/presentation-preview`,{signal:abort.signal});const blob=await response.blob();if(abort.signal.aborted)return;setImages(Number(response.headers.get('X-Presentation-Images')||0));setUrl(URL.createObjectURL(blob));}catch(error){if(!abort.signal.aborted)setError(errorMessage(error));}finally{if(!abort.signal.aborted)setLoading(false);}}
 return <><button className="btn" disabled={disabled||loading} onClick={preview}><Eye size={14}/>Ver diseño final</button>{open&&<div className="modal-backdrop"><section className="modal card presentation-export-preview" role="dialog" aria-modal="true" aria-label="Diseño final de la presentación"><header className="source-modal-header"><h2>Así se verá tu presentación</h2><button className="btn icon" autoFocus aria-label="Cerrar diseño final" onClick={()=>setOpen(false)}><X size={22}/></button></header>{loading&&<p role="status">Preparando diapositivas y buscando fotografías…</p>}{error&&<p className="error-box" role="alert">{error}</p>}{url&&<><p className="muted">PowerPoint y PDF comparten esta composición. {images?`${images} imagen(es) con créditos al final.`:'Sin fotografías disponibles en esta exportación.'}</p><iframe className="source-pdf" src={url} title="Diapositivas con su diseño de exportación"/><a className="btn" href={url} download="presentacion.pdf">Descargar este PDF</a></>}</section></div>}</>;
}
