"use client";
import { useState } from 'react';
import { Material,Value } from '@/services/api';
import { labels } from './catalog';
import LessonView from './LessonView';
import GuideView,{Guide,BlockView} from './GuideView';
import './guide.css';
import SyllabusView from './SyllabusView';
function display(value:Value):React.ReactNode {
 if(value===null)return null;
 if(Array.isArray(value))return <div className="content-list">{value.map((v,i)=><div key={i} className={typeof v==='object'?'content-block':''}>{typeof v==='string'?<p>• {v}</p>:display(v)}</div>)}</div>;
 if(typeof value==='object')return <div className="structured-content">{Object.entries(value).map(([key,v])=><section key={key}>{key==='title'?<h2>{String(v)}</h2>:<><h3>{labels[key]||key}</h3>{display(v)}</>}</section>)}</div>;
 return <p className="preserve-lines">{labels[String(value)]||String(value)}</p>;
}
export function StructuredEditor({value,onChange,label='Contenido'}:{value:Value;onChange:(v:Value)=>void;label?:string}) {
 if(Array.isArray(value))return <fieldset className="editor-group"><legend>{label}</legend>{value.map((v,i)=><div className="editor-item" key={i}><StructuredEditor value={v} label={`${label} ${i+1}`} onChange={next=>onChange(value.map((x,j)=>j===i?next:x))}/><button type="button" className="btn subtle" onClick={()=>onChange(value.filter((_,j)=>j!==i))}>Quitar</button></div>)}<button type="button" className="btn subtle" onClick={()=>onChange([...value,typeof value[0]==='object'?structuredClone(value[0]):''])}>Agregar elemento</button></fieldset>;
 if(value && typeof value==='object')return <fieldset className="editor-group"><legend>{label}</legend>{Object.entries(value).map(([key,v])=><StructuredEditor key={key} label={labels[key]||key} value={v} onChange={next=>onChange({...value,[key]:next})}/>)}</fieldset>;
 const options:Record<string,string[]>={'Origen del sistema de evaluación':['provided','proposed'],'Dificultad':['easy','medium','hard'],'Estilo':['académico','moderno','minimalista','creativo','corporativo'],'Distribución':['title','bullets','two-column','activity','conclusion'],'Tipo':['diagram','chart','none'].includes(String(value))?['diagram','chart','none']:['multiple_choice','true_false','development','short_answer']};
 return <label className="field">{label}{typeof value==='number'?<input type="number" value={value} onChange={e=>onChange(Number(e.target.value))}/>:options[label]?<select value={String(value)} onChange={e=>onChange(e.target.value)}>{options[label].map(v=><option key={v} value={v}>{labels[v]||v}</option>)}</select>:<textarea rows={String(value||'').length>120?4:2} value={String(value??'')} onChange={e=>onChange(e.target.value)}/>}</label>;
}
export default function MaterialView({material}:{material:Material}) {
 const [slide,setSlide]=useState(0);
 const data=material.data;
 if(material.kind==='guide')return <GuideView data={data as unknown as Guide}/>;
 if(material.kind==='planning')return <div>{(data.weeks as {unit:string;topic:string;outcome:string;evidence:string}[]).map((w,i)=><section key={i}><h3>{w.unit} · Semana {i+1}: {w.topic}</h3><p>{w.outcome}</p><p>Evidencia: {w.evidence}</p></section>)}</div>;
 if(material.kind==='lesson') {
  return <LessonView data={data}/>;
 }
 if(material.kind==='session') {
  const stages=data.stages as {name:string;minutes:number;activities:Value;resources:Value}[];
  return <div><div className="toolbar"><span className="badge">{String(data.duration)} minutos</span><span className="badge">{String(data.area)}</span><span className="badge">{String(data.course)}</span></div><section className="lesson-objective"><h3>Logro de aprendizaje</h3>{display(data.outcome)}<h3>Competencia</h3>{display(data.competency)}<h3>Metodología</h3>{display(data.methodology)}</section>{stages.map((stage,i)=><section className="session-stage" key={i}><header><h3>{i+1}. {stage.name}</h3><span className="badge">{stage.minutes} min</span></header><div className="stage-columns"><div><h3>Actividades</h3>{display(stage.activities)}</div><div><h3>Recursos</h3>{display(stage.resources)}</div></div></section>)}<h3>Evidencias y evaluación</h3>{display(data.assessment)}{data.evidence&&<><h3>Evidencias de aprendizaje</h3>{display(data.evidence)}</>}{data.bibliography&&<><h3>Bibliografía</h3>{display(data.bibliography)}</>}{(data.images as {assetId:string;caption:string;width:number}[]|undefined)?.map(image=><BlockView key={image.assetId} block={{id:image.assetId,type:'image',text:'',...image}}/>)}</div>;
 }
 if(material.kind==='syllabus')return <SyllabusView data={data}/>;

 if(material.kind==='activity'){
  const sections=[{title:'1. Logro a evaluar',value:data.achievement},{title:'2. Indicación general',value:data.generalInstructions},{title:'3. Indicaciones específicas',value:data.specificInstructions},{title:'4. Recomendaciones',value:data.recommendations},{title:'5. Entrega',value:data.submission},{title:'6. Criterios de evaluación',value:data.evaluation}];
  return <div className="academic-preview"><h2>{String(data.title)}</h2>{data.context&&display(data.context)}{sections.map(s=><section key={s.title}><h3>{s.title}</h3>{display(s.value)}</section>)}</div>;
 }
 if(material.kind==='summary')return <div className="academic-preview"><h2>{String(data.title)}</h2>{(data.sections as {title:string;content:string}[]).map((s,i)=><section key={i}><h3>{i+1}. {s.title}</h3><p className="preserve-lines">{s.content}</p></section>)}</div>;
 if(material.kind==='rubric'){
  const criteria=data.criteria as {name:string;definition?:string;weight?:number;levels:{name:string;score:number;description:string}[]}[];
  const names=criteria[0]?.levels.map(l=>l.name)??[];
  return <div className="academic-preview"><h2>{String(data.title)}</h2>{data.context&&display(data.context)}<p className="muted">{data.scoringMode==='points'?`Puntaje máximo: ${data.totalPoints} puntos.`:'Los pesos de los criterios suman 100 %.'}</p><div className="table-scroll"><table className="data-table"><thead><tr><th>Criterio</th><th>Definición del criterio</th>{names.map(n=><th key={n}>{n}</th>)}</tr></thead><tbody>{criteria.map((c,i)=><tr key={i}><td>{c.name}{data.scoringMode!=='points'&&c.weight!==undefined&&<small>Peso: {c.weight} %</small>}</td><td>{c.definition??c.name}</td>{names.map(n=>{const level=c.levels.find(l=>l.name===n);return <td key={n}>{level&&<><p>{level.description}</p><strong>{level.score} puntos</strong></>}</td>;})}</tr>)}</tbody></table></div></div>;
 }
 if(material.kind==='presentation') {
  const slides=data.slides as Record<string,Value>[];const index=Math.min(slide,slides.length-1),item=slides[index];
  const visual=item.visual as {type:string;items:{label:string;value?:number}[]}|undefined;
  return <div><div className="slide-preview"><span className="eyebrow">{String(data.style)} · {index+1} / {slides.length}</span><h2>{String(item.title)}</h2>{display(item.content)}{visual&&visual.type!=='none'&&<div className={`slide-visual ${visual.type}`}>{visual.items.map((v,i)=><div key={i} className="visual-step" style={visual.type==='chart'?{width:`${Math.max(15,100*(v.value||0)/Math.max(...visual.items.map(x=>x.value||0),1))}%`}:undefined}>{v.label}{visual.type==='chart'?` · ${v.value}`:''}</div>)}</div>}</div><div className="toolbar"><button className="btn" disabled={index===0} onClick={()=>setSlide(index-1)}>Anterior</button><button className="btn" disabled={index===slides.length-1} onClick={()=>setSlide(index+1)}>Siguiente</button></div><h3>Notas del docente</h3>{display(item.notes)}<h3>Sugerencia visual</h3>{display(item.visualSuggestion)}</div>;
 }
 if(material.kind==='questions'||material.kind==='exam')return <div>{data.instructions&&display(data.instructions)}{(data.questions as Record<string,Value>[]).map((q,i)=><article className="question-card" key={i}><h3>{i+1}. {String(q.question)}</h3><span className="badge">{labels[String(q.difficulty)]} · {labels[String(q.type)]}</span>{display(q.options)}{Array.isArray(q.subquestions)&&<ol className="exam-subquestions">{(q.subquestions as Record<string,Value>[]).map((sub,index)=><li key={index}>{String(sub.question)}</li>)}</ol>}<details><summary>Respuesta y explicación</summary>{display(q.correctAnswer)}{Array.isArray(q.subquestions)&&(q.subquestions as Record<string,Value>[]).map((sub,index)=><p key={index}><strong>{String.fromCharCode(97+index)}) </strong>{String(sub.correctAnswer)}</p>)}{display(q.explanation)}{q.source&&<p className="muted">Fuente: {String(q.source)}</p>}</details></article>)}</div>;
 return <>{display(data)}</>;
}
