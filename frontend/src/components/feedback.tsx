"use client";
import { useEffect,useState } from 'react';
export function notify(message:string,type:'success'|'error'='success') {window.dispatchEvent(new CustomEvent('docente:notice',{detail:{message,type}}));}
export function Notices() {
 const [notices,setNotices]=useState<{id:number;message:string;type:string}[]>([]);
 useEffect(()=>{const timers=new Set<ReturnType<typeof setTimeout>>();const listener=(event:Event)=>{const detail=(event as CustomEvent).detail,id=Date.now()+Math.random();setNotices(n=>[...n,{id,...detail}]);const timer=setTimeout(()=>{setNotices(n=>n.filter(x=>x.id!==id));timers.delete(timer);},6000);timers.add(timer);};window.addEventListener('docente:notice',listener);return()=>{window.removeEventListener('docente:notice',listener);timers.forEach(clearTimeout);};},[]);
 return <div className="notice-stack" aria-live="polite">{notices.map(n=><div key={n.id} role={n.type==='error'?'alert':'status'} className={`notice ${n.type}`}>{n.message}<button aria-label="Cerrar aviso" onClick={()=>setNotices(ns=>ns.filter(x=>x.id!==n.id))}>×</button></div>)}</div>;
}
