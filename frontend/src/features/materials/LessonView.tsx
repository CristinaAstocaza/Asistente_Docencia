import { BookOpen, MessageCircle, PencilRuler, Flag, Target, Clock } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Value } from '@/services/api';

// Older lessons may contain an entire numbered activity in one paragraph.
function readable(text:string) {
 return text.split(/(```[\s\S]*?```|`[^`\n]+`)/g).map((part,i)=>i%2?part:part.replace(/\s+(?=\d{1,2}\.\s+[A-ZÁÉÍÓÚÑ])/g,'\n\n').replace(/\s+(?=Materiales necesarios:)/g,'\n\n')).join('');
}
function Content({value}:{value:Value|undefined}) {
 const items=Array.isArray(value)?value:[value];
 const content=(item:Value|undefined,i:number)=>typeof item==='string'?<ReactMarkdown key={i}>{readable(item)}</ReactMarkdown>:null;
 return <div className="lesson-prose">{Array.isArray(value)?<ol>{items.map((item,i)=><li key={i}>{content(item,i)}</li>)}</ol>:items.map(content)}</div>;
}
const moments=[
 {title:'Cómo empezar',hint:'Activa lo que ya saben y despierta su curiosidad.',icon:MessageCircle,tone:'blue',parts:[['introduction','Abre la clase'],['motivation','Pregunta para conectar']]},
 {title:'Qué explicar',hint:'Presenta las ideas y acompáñalas con ejemplos.',icon:BookOpen,tone:'violet',parts:[['development','Explica paso a paso'],['examples','Ejemplos para el aula']]},
 {title:'Qué harán los estudiantes',hint:'Guía la práctica con instrucciones concretas.',icon:PencilRuler,tone:'amber',parts:[['activity','Actividad en el aula']]},
 {title:'Cómo cerrar',hint:'Recupera las ideas clave y comprueba lo aprendido.',icon:Flag,tone:'green',parts:[['closing','Cierra con una síntesis'],['questions','Comprueba si comprendieron']]},
];
export default function LessonView({data}:{data:Record<string,Value>}) {
 return <div className="daily-lesson"><section className="lesson-goal"><Target size={26} aria-hidden="true"/><div><span className="eyebrow">La meta de hoy</span><h3>Qué aprenderán hoy</h3><Content value={data.objective}/></div></section>
  <div className="lesson-route" aria-label="Recorrido de la clase">{moments.map(({title,icon:Icon,tone},i)=><div className={`lesson-route-item tone-${tone}`} key={title}><Icon size={20} aria-hidden="true"/><span>{i+1}. {title}</span></div>)}</div>
  <p className="lesson-time-note"><Clock size={16} aria-hidden="true"/>Los tiempos sugeridos son orientativos: ajústalos al ritmo de tu aula.</p>
  <div className="lesson-sections">{moments.map(({title,hint,icon:Icon,tone,parts},i)=><section className={`lesson-moment tone-${tone}`} key={title}><header><span className="lesson-moment-icon"><Icon size={24} aria-hidden="true"/></span><div><span className="eyebrow">Paso {i+1}</span><h3>{title}</h3><p>{hint}</p></div></header><div className="lesson-moment-body">{parts.map(([key,label])=><div className={`lesson-part lesson-part-${key}`} key={key}><h4>{label}</h4><Content value={data[key]}/></div>)}</div></section>)}</div>
 </div>;
}
