"use client";
import { useEffect,useRef,useState } from 'react';
import { Mic,Square } from 'lucide-react';
type Recognition={lang:string;continuous:boolean;interimResults:boolean;onstart:(()=>void)|null;onend:(()=>void)|null;onerror:((event:{error:string})=>void)|null;onresult:((event:{resultIndex:number;results:{length:number;[index:number]:{isFinal:boolean;[index:number]:{transcript:string}}}})=>void)|null;start:()=>void;stop:()=>void;abort:()=>void};
type SpeechWindow=Window&{SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition};
export default function SpeechInput({onTranscript,disabled}:{onTranscript:(text:string)=>void;disabled:boolean}){
 const recognition=useRef<Recognition|null>(null);const [listening,setListening]=useState(false),[interim,setInterim]=useState(''),[error,setError]=useState('');
 useEffect(()=>()=>{if(recognition.current){recognition.current.onresult=null;recognition.current.onend=null;recognition.current.abort();}},[]);
 useEffect(()=>{if(disabled)recognition.current?.abort();},[disabled]);
 function toggle(){
  setError('');if(recognition.current){recognition.current.stop();return;}
  const browser=window as SpeechWindow,Constructor=browser.SpeechRecognition??browser.webkitSpeechRecognition;
  if(!Constructor){setError('El dictado no está disponible en este navegador. Prueba con Chrome o Edge.');return;}
  const speech=new Constructor();recognition.current=speech;speech.lang='es-PE';speech.continuous=true;speech.interimResults=true;
  speech.onstart=()=>setListening(true);speech.onend=()=>{recognition.current=null;setListening(false);setInterim('');};
  speech.onerror=e=>{setError(e.error==='not-allowed'?'Permite el acceso al micrófono en el navegador para dictar.':e.error==='no-speech'?'No se detectó voz. Intenta nuevamente.':e.error==='audio-capture'?'No se encontró un micrófono disponible.':e.error==='aborted'?'':'No se pudo transcribir la voz. Comprueba tu conexión e intenta nuevamente.');};
  speech.onresult=e=>{let final='',partial='';for(let i=e.resultIndex;i<e.results.length;i++){if(e.results[i].isFinal)final+=e.results[i][0].transcript+' ';else partial+=e.results[i][0].transcript;}if(final.trim())onTranscript(final.trim());setInterim(partial);};
  try{speech.start();}catch{recognition.current=null;setListening(false);setError('No se pudo activar el micrófono. Comprueba los permisos del navegador.');}
 }
 return <div className="speech-input"><button type="button" className={`btn icon ${listening?'danger':''}`} disabled={disabled} onClick={toggle} title={listening?'Detener dictado':'Dictar mensaje'} aria-label={listening?'Detener dictado':'Dictar mensaje'} aria-pressed={listening}>{listening?<Square size={18}/>:<Mic size={18}/>}</button>{listening&&<p className="muted" role="status">Escuchando… {interim}</p>}{error&&<p className="error-text" role="alert">{error}</p>}</div>;
}
