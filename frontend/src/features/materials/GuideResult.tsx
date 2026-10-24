"use client";
import {useEffect,useState} from 'react';
import {errorMessage,Material,request} from '@/services/api';
export default function GuideResult({material}:{material:Material}){
 const [url,setUrl]=useState(''),[error,setError]=useState('');
 useEffect(()=>{let active=true,objectUrl='';request(`/content/${material.id}/guide-preview`).then(r=>r.blob()).then(blob=>{if(active){objectUrl=URL.createObjectURL(blob);setUrl(objectUrl);}}).catch(e=>{if(active)setError(errorMessage(e));});return()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl);};},[material.id]);
 const publication=material.data.publication as {pageCount?:number;referenceName?:string}|undefined;
 return <section className="card"><div className="toolbar"><div className="grow"><span className="eyebrow">Documento terminado · guardado en tu historial</span><h2>{material.title}</h2><p>{publication?.pageCount?`${publication.pageCount} páginas, incluida la portada`:'Guía creada anteriormente'}{publication?.referenceName?` · Diseño inspirado en ${publication.referenceName}`:''}</p></div></div>{error&&<p className="error-box" role="alert">{error}</p>}{url?<><iframe title="Vista previa de la guía terminada" src={`${url}#toolbar=1&view=FitH`} style={{width:'100%',height:'80vh',minHeight:600,border:0,borderRadius:12}}/><a className="btn" href={url} target="_blank" rel="noreferrer">Abrir documento en otra pestaña</a></>:!error&&<p role="status">Preparando la vista del documento…</p>}</section>;
}
