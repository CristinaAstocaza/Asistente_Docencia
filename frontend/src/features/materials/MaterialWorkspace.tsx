"use client";
import { useEffect,useState } from 'react';
import { Sparkles,Download } from 'lucide-react';
import { api,post,download,errorMessage,Kind,Material,Source } from '@/services/api';
import { notify } from '@/components/feedback';
import SourcePicker from '@/features/sources/SourcePicker';
import { catalog,labels } from './catalog';
import { syllabusParameters } from './syllabus-parameters';
import { studios } from './studio';
import './studio.css';
import PresentationBrief from './PresentationBrief';
import SyllabusBase,{SyllabusImport} from './SyllabusBase';
import { SyllabusAccept } from './SyllabusDocument';
import FieldHelp from './FieldHelp';
import TemplatePicker from './TemplatePicker';
import AiInstructions from './AiInstructions';
import DocumentPdfPreview from './DocumentPdfPreview';
export default function MaterialWorkspace({kind}:{kind:Kind}) {
 const [aiInstructions,setAiInstructions]=useState('');
 const usesInstructions=kind!=='presentation'&&kind!=='syllabus';
 const [templateId,setTemplateId]=useState(''),[templateMode,setTemplateMode]=useState('structure');
 const [presentationInstructions,setPresentationInstructions]=useState(''),[referencePdf,setReferencePdf]=useState<Source|null>(null),[uploadingReference,setUploadingReference]=useState(false);
 const [syllabusPdf,setSyllabusPdf]=useState<Source|null>(null);
 const [syllabusBackup,setSyllabusBackup]=useState<{topic:string;parameters:Record<string,string>}|null>(null);
 const [baseSections,setBaseSections]=useState<{title:string;content:string}[]>([]);
 // Syllabus base document: keys found in the PDF (null = no document) and its original course name.
 const [docFields,setDocFields]=useState<string[]|null>(null),[sourceCourse,setSourceCourse]=useState('');
 const generationKind=kind;
 const config=catalog[generationKind];const studio=studios[generationKind];const Icon=studios[kind].icon;const [topic,setTopic]=useState(''),[parameters,setParameters]=useState<Record<string,string>>(()=>Object.fromEntries(catalog[kind].fields.map(f=>[f.key,f.value])));
 const [sources,setSources]=useState<Source[]>([]),[selected,setSelected]=useState<string[]>([]),[mode,setMode]=useState<'sources'|'general'>('general');
 const [material,setMaterial]=useState<Material|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[parentId,setParentId]=useState<string>();
 const [banks,setBanks]=useState<Material[]>([]),[bankId,setBankId]=useState('');
 useEffect(()=>{let active=true;api<Source[]>('/documents').then(s=>{if(active)setSources(s);}).catch(e=>{if(active)setError(errorMessage(e));});const query=new URLSearchParams(window.location.search);const id=query.get('id'),from=query.get('from');const seed=query.get('topic');const course=query.get('course'),outcome=query.get('outcome'),duration=query.get('duration'),unit=query.get('unit'),week=query.get('week');queueMicrotask(()=>{if(!active)return;if(seed)setTopic(seed);setParameters(p=>({...p,...(course?{course}:{}),...(outcome?{outcome}:{}),...(duration?{duration}:{}),...(unit?{unit}:{}),...(week?{week}:{})}));});
  if(id)api<Material>(`/content/${id}`).then(m=>{if(active){setMaterial(m);setTopic(m.title);setSelected(m.source_ids);setMode(m.mode);if(kind==='syllabus'&&m.kind==='syllabus')setParameters(p=>({...p,...syllabusParameters(m)}));}}).catch(e=>{if(active)setError(errorMessage(e));});
  if(from)api<Material>(`/content/${from}`).then(m=>{if(active){setParentId(m.id);setTopic(seed||m.title);setSelected(m.source_ids);setMode(m.mode);if(kind==='syllabus'&&m.kind==='syllabus')setParameters(p=>({...p,...syllabusParameters(m)}));}}).catch(e=>{if(active)setError(errorMessage(e));});
  if(kind==='exam')api<Material[]>('/content').then(items=>{if(active)setBanks(items.filter(m=>m.kind==='questions'));}).catch(()=>{});
  return()=>{active=false;};
 },[kind]);
 const teacherKeys=['teacherName','teacherDni','teacherEmail'],institutionalKeys=['institution','faculty','department','courseCode','careers','term','nature','prerequisites'];
 // With a base document only the course and the data found in it are shown; teacher fields disappear when the document has none.
 const fieldVisible=(key:string)=>kind!=='syllabus'?true:docFields?(key==='course'||docFields.includes(key)):!institutionalKeys.includes(key);
 const courseMissing=kind==='syllabus'&&!parameters.course?.trim();
 function syllabusValues(){
  const out:Record<string,string|number>={};
  for(const f of config.fields){if(!fieldVisible(f.key))continue;const v=(parameters[f.key]??'').trim();if(v)out[f.key]=f.type==='number'?Number(v):v;}
  for(const k of teacherKeys)if(out[k]===undefined)out[k]='';
  if(sourceCourse)out.sourceCourse=sourceCourse;
  return out;
 }
 function importSyllabus(data:SyllabusImport,source:Source){
  setSyllabusPdf(source);setBaseSections(data.sections||[]);if(!syllabusBackup)setSyllabusBackup({topic,parameters});
  const next:Record<string,string>={...parameters,course:''},found:string[]=[];
  for(const f of config.fields){
   if(f.key==='course')continue;
   const raw=(data.fields[f.key]||'').trim();
   let value=f.type==='number'?(raw.match(/\d+(\.\d+)?/)?.[0]||''):raw;
   if(f.options&&value)value=f.options.find(o=>o.toLowerCase()===value.toLowerCase())||'';
   next[f.key]=value||(f.options?f.value:'');
   if(value)found.push(f.key);
  }
  setParameters(next);setDocFields(found);setSourceCourse((data.fields.course||data.topic||'').trim());
  setSources(current=>[...current.filter(s=>s.id!==source.id),source]);
 }
 async function generate() {
  if(busy||uploadingReference)return;setBusy(true);setError('');
  try {
   const values=kind==='syllabus'?syllabusValues():Object.fromEntries(config.fields.map(f=>[f.key,f.type==='number'?Number(parameters[f.key]):parameters[f.key]]));
   const finalTopic=topic.trim()||(kind==='syllabus'?`Sílabo de ${parameters.course.trim()}`:topic);
   const refPdfId = kind==='presentation'?referencePdf?.id:kind==='syllabus'?syllabusPdf?.id:undefined;
    const result=kind==='exam'&&bankId?await api<Material>('/exams/from-bank',post({bankId,title:topic,count:Number(parameters.count),duration:Number(parameters.duration)})):await api<Material>('/generate',post({kind:generationKind,topic:finalTopic,templateId:templateId||undefined,templateMode,parameters:kind==='presentation'?{...values,instructions:presentationInstructions}:usesInstructions&&aiInstructions.trim()?{...values,instructions:aiInstructions.trim()}:values,referencePdfId:refPdfId,baseSections:kind==='syllabus'&&baseSections.length?baseSections:undefined,sourceIds:bankId?(banks.find(b=>b.id===bankId)?.source_ids??selected):selected,mode:bankId?(banks.find(b=>b.id===bankId)?.mode??mode):mode,parentId:bankId||parentId}));
   setMaterial(result);notify('Material generado y guardado en tu historial.');
  }catch(e){setError(errorMessage(e));}finally{setBusy(false);}
 }
 async function exportFile(format:string,answerKey=false,variant='original') {if(!material)return;setBusy(true);try{await download(`/content/${material.id}/export`,{format,answerKey,variant},`${material.title}${variant==='original'?'':`-${variant}`}.${format}`);notify('Exportación preparada.');}catch(e){setError(errorMessage(e));}finally{setBusy(false);}}
 return <div className={`workspace material-studio studio-${generationKind}`}><header className="page-heading studio-heading"><div><span className="eyebrow"><Icon size={16}/>{studio.kicker}</span><h1>{catalog[kind].title}</h1><p>{catalog[kind].description}</p></div><a className="btn" href="/historial">Ver historial</a></header>{error&&<p className="error-box" role="alert">{error}</p>}
  <div className={`workspace-grid${!material&&kind!=='syllabus'?' studio-setup':''}`}><div className="card form-panel"><h2>{studio.form}</h2>{kind==='syllabus'&&<SyllabusBase onBusy={setUploadingReference} disabled={busy} onImport={importSyllabus} onClear={()=>{setSyllabusPdf(null);setBaseSections([]);setDocFields(null);setSourceCourse('');if(syllabusBackup){setTopic(syllabusBackup.topic);setParameters(syllabusBackup.parameters);}setSyllabusBackup(null);}}/>}{kind==='syllabus'&&docFields&&<p className="muted">Se usarán los datos de {sourceCourse?`«${sourceCourse}»`:'el sílabo base'} con el formato de la UNICA. Escribe el curso del nuevo sílabo. Abajo aparecen únicamente los datos encontrados en el documento.</p>}{kind==='exam'&&<p className="muted">El examen combina preguntas abiertas de teoría y casos prácticos con subpreguntas. La cantidad cuenta las preguntas principales; cada caso cuenta como una.</p>}<p className="muted">El ícono ⓘ explica cada campo con ejemplos: pasa el cursor, tócalo o enfócalo con el teclado.</p><label className="field"><span>{studio.topic}<FieldHelp field="topic"/></span><textarea aria-label={studio.topic} rows={3} value={topic} maxLength={2000} onChange={e=>setTopic(e.target.value)} placeholder={studio.placeholder}/></label>{usesInstructions&&!(kind==='exam'&&bankId)&&<AiInstructions kind={generationKind} value={aiInstructions} onChange={setAiInstructions} hasSources={selected.length>0}/>}{kind==='presentation'&&<PresentationBrief instructions={presentationInstructions} onInstructions={setPresentationInstructions} onReference={source=>{setReferencePdf(source);if(source)setSources(current=>[...current.filter(s=>s.id!==source.id),source]);}} onBusy={setUploadingReference} disabled={busy}/>}{!(kind==='exam'&&bankId)&&<SourcePicker sources={sources} selected={selected} onChange={setSelected} mode={mode} onMode={setMode}/>}<div className="studio-fields">{(studio.groups.length?studio.groups:[['Detalles',...config.fields.map(f=>f.key)]]).map(([title,...keys])=>{const shown=keys.filter(fieldVisible);if(!shown.length)return null;const group=<fieldset className="studio-field-group" key={title}><legend>{title}</legend><div>{shown.map(key=>{const f=config.fields.find(field=>field.key===key);if(!f)return null;return <label key={f.key} className="field"><span>{f.label}<FieldHelp field={f.key} label={f.label}/></span>{f.options?<select aria-label={f.label} value={parameters[f.key]} onChange={e=>setParameters(p=>({...p,[f.key]:e.target.value}))}>{f.options.map(o=><option key={o} value={o}>{f.key==='imageMode'&&o==='none'?'Sin fotografías':labels[o]||o}</option>)}</select>:f.type==='textarea'?<textarea aria-label={f.label} rows={3} value={parameters[f.key]} onChange={e=>setParameters(p=>({...p,[f.key]:e.target.value}))}/>:<input aria-label={f.label} placeholder={kind==='syllabus'&&f.key==='course'&&sourceCourse?`Documento base: ${sourceCourse}`:undefined} type={f.type||'text'} min={f.type==='number'?(kind==='exam'&&f.key==='count'?2:1):undefined} max={f.key==='count'?(kind==='presentation'?30:50):undefined} value={parameters[f.key]} onChange={e=>setParameters(p=>({...p,[f.key]:e.target.value}))}/>}</label>;})}</div></fieldset>;return (kind==='lesson'&&keys.includes('objective'))?<details key={title} className="lesson-options"><summary>{title}</summary>{group}</details>:group;})}</div>
   {generationKind==='exam'&&<label className="field">Reutilizar preguntas guardadas<select value={bankId} onChange={e=>setBankId(e.target.value)}><option value="">Generar preguntas nuevas con IA</option>{banks.map(b=><option key={b.id} value={b.id}>{b.title}</option>)}</select></label>}
   {kind!=='exam'&&<TemplatePicker value={templateId} onChange={setTemplateId} mode={templateMode} onMode={setTemplateMode}/>}{parentId&&<p className="muted">Usaremos también el material de origen como referencia.</p>}<button className="btn primary full" disabled={busy||uploadingReference||(kind==='syllabus'?courseMissing&&(!topic.trim()||!!docFields):!topic.trim())||(mode==='sources'&&!selected.length&&!(generationKind==='exam'&&bankId))} onClick={generate}><Sparkles size={16}/>{busy?'Procesando…':studio.action}</button><p className="muted">Revisa el contenido antes de utilizarlo en clase.</p></div>
   <div className={`card result-panel${material?'':' is-empty'}`} aria-busy={busy}>{busy&&<p className="loading-line" role="status">Analizando el contexto y preparando tu material…</p>}{!material?kind==='syllabus'?<p className="syllabus-empty">Aquí aparecerá el sílabo como documento, listo para descargar.</p>:<div className="studio-empty compact"><span className="studio-empty-icon"><Icon size={24}/></span><span className="studio-result-label">Vista previa</span><h2>{studio.preview}</h2><p>Aquí verás el documento en PDF, listo para revisar y descargar.</p><ol className="studio-steps"><li><b>1</b><span><strong>Describe el tema</strong>y, si quieres, da indicaciones a la IA.</span></li><li><b>2</b><span><strong>Ajusta los detalles</strong>y elige tus fuentes.</span></li><li><b>3</b><span><strong>Pulsa «{studio.action}»</strong>y descarga en {kind==='presentation'?'PowerPoint o PDF':'PDF o Word'}.</span></li></ol></div>:<><div className="result-head"><h2>{material.title}</h2>{material.kind==='presentation'&&<button className="btn" disabled={busy} onClick={()=>exportFile('pptx')}><Download size={14}/>PowerPoint</button>}</div>
   {material.kind==='syllabus'&&<SyllabusAccept material={material} disabled={busy}/>}
   <DocumentPdfPreview key={material.id} material={material} onDownload={(f,key)=>exportFile(f,key)}/>
   <p className="muted">Modo: {material.mode==='sources'?'Únicamente tus fuentes':'Fuentes y conocimiento general de IA'}</p>{material.citations.length>0&&<details><summary>Fuentes consultadas</summary>{material.citations.map((c,i)=><p className="muted" key={i}>[{c.reference}] {c.name}{c.page?` — p. ${c.page}`:''}</p>)}</details>}
   <div className="toolbar">{(['guide','presentation','exam','rubric'] as Kind[]).filter(k=>k!==material.kind&&!(kind==='exam'&&k==='exam')).map(k=><a className="btn" key={k} aria-disabled={busy} href={busy?undefined:`${catalog[k].path}?from=${material.id}`}>Crear {catalog[k].title.toLowerCase()}</a>)}</div></>}</div></div></div>;
}
