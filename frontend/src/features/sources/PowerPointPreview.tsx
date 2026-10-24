"use client";
import { useEffect,useRef,useState } from 'react';

// Render Office markup in an opaque, script-only sandbox. It cannot access
// application cookies, DOM, local storage or make outbound requests.
export default function PowerPointPreview({bytes}:{bytes:ArrayBuffer}) {
 const frame=useRef<HTMLIFrameElement>(null);
 const [error,setError]=useState(''),[loading,setLoading]=useState(true);
 useEffect(()=>{const receive=(event:MessageEvent)=>{if(event.source!==frame.current?.contentWindow)return;if(event.data?.type==='pptx-rendered'||event.data?.type==='pptx-error')setLoading(false);if(event.data?.type==='pptx-error')setError('No se pudo mostrar esta presentación. Puedes descargar el PowerPoint original.');};window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive);},[]);
 const html=`<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'self'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'"><style>body{margin:0;background:#e5e7eb;font-family:Arial}#slides{width:100%;overflow:auto}section{margin:12px auto}img{max-width:100%}</style></head><body><div id="slides"></div><script src="/vendor/pptx-preview.umd.js"></script><script>window.addEventListener('message',async(event)=>{if(event.source!==parent||event.data?.type!=='preview')return;try{const target=document.getElementById('slides');const width=Math.max(280,document.documentElement.clientWidth-24);const viewer=pptxPreview.init(target,{width,height:width*9/16,mode:'list'});await viewer.preview(event.data.bytes);if(!viewer.slideCount)throw new Error();parent.postMessage({type:'pptx-rendered'},'*');}catch(e){parent.postMessage({type:'pptx-error'},'*');}});</script></body></html>`;
 return <div>{loading&&<p role="status">Cargando diapositivas...</p>}{error&&<p role="alert" className="error-box">{error}</p>}<iframe ref={frame} className="source-pptx" title="Diapositivas del PowerPoint original" sandbox="allow-scripts" srcDoc={html} onLoad={()=>{setError('');setLoading(true);frame.current?.contentWindow?.postMessage({type:'preview',bytes},'*');}}/><p className="muted">Vista de las diapositivas originales. Las animaciones y algunas fuentes pueden variar en el navegador; el archivo descargado conserva todos sus elementos.</p></div>;
}
