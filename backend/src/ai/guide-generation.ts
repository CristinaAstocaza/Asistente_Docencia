import {BadRequestException} from '@nestjs/common';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {AIProvider,InlineAsset} from './provider';
import {documentBlock,guideContract,guideDesign} from './educational-contracts';
import {parse} from '../common/validation';
import {defaultGuideDesign,paginateGuideChapter} from '../exports/guide-publication';
import {cleanGuideBlocks} from '../common/guide-content';
import {programmingGuideIssue} from './programming-guide';
export const guidePlan=z.object({title:z.string().min(1).max(240),guideType:z.string().min(1).max(100),objectives:z.array(z.string().min(1).max(180)).min(2).max(5),chapters:z.array(z.object({title:z.string().min(1).max(120),brief:z.string().min(1).max(1800)})).min(1).max(29),imageSearches:z.array(z.object({query:z.string().min(1).max(160),chapter:z.number().int().min(1).max(29)})).min(2).max(4).optional()});
const draftBlock=z.object({type:z.enum(['heading','paragraph','list','table','code','diagram']),text:z.string().max(15000).default(''),level:z.number().int().min(1).max(3).optional(),items:z.array(z.string().max(3000)).max(40).optional(),rows:z.array(z.array(z.string().max(2000)).min(1).max(8)).max(60).optional(),filePath:z.string().max(240).optional(),language:z.string().max(40).optional()});
export const guidePageDraft=z.object({blocks:z.array(draftBlock).min(1).max(40)});
export function normalizeGuideDraft(value:unknown):unknown {
 if(!value||typeof value!=='object'||!('blocks' in value)||!Array.isArray(value.blocks))return value;
 return {...value,blocks:cleanGuideBlocks(value.blocks).map(block=>{
  if(!block||typeof block!=='object'||Array.isArray(block))return block;
  const normalized={...block};
  // Models sometimes populate optional heading metadata on every block.
  if(normalized.type!=='heading')delete normalized.level;
  else if(normalized.level===0||normalized.level===null)normalized.level=1;
  return normalized;
 })};
}
export function requestedGuidePages(topic:string,parameters:Record<string,unknown>){
 const written=topic.match(/\b(\d{1,2})\s*(?:páginas|paginas|hojas)\b/i)?.[1];const raw=parameters.pages||written||6;const count=Number(raw);
 if(!Number.isInteger(count)||count<2||count>30)throw new BadRequestException('La guía debe tener de 2 a 30 páginas, incluida la portada.');return count;
}
export function guidePageWordCount(blocks:any[]){return blocks.filter(b=>b.type!=='code'&&b.type!=='image').flatMap(b=>[b.text,...b.items||[],...b.rows?.flat()||[]]).join(' ').split(/\s+/).filter(Boolean).length;}
export function guidePageHasSubstance(blocks:any[]){const words=guidePageWordCount(blocks);const codeLines=blocks.filter(b=>b.type==='code').reduce((n,b)=>n+b.text.split('\n').filter((line:string)=>line.trim()).length,0);const structuredItems=blocks.reduce((n,b)=>n+(b.items?.length||0)+(b.rows?.length?Math.max(0,b.rows.length-1):0),0);return words>=120||(words>=80&&(codeLines>=8||structuredItems>=4));}
export function isPracticalGuide(parameters:Record<string,unknown>,topic=''){
 return /paso\s*a\s*paso|práctica|practica|laboratorio|proyecto/i.test(String(parameters.guideType||''))||/paso\s*a\s*paso/i.test(topic);
}
export function isProgrammingGuide(topic:string,parameters:Record<string,unknown>){
 return /\b(angular|react|vue|javascript|typescript|python|java|spring boot|html|css|sql|programación|programacion|desarrollo web|desarrollo de aplicaciones|node\.js)\b/i.test([topic,parameters.course,parameters.career].join(' '));
}
const programmingStyle='Guía de programación para principiantes: cada paso de implementación debe mostrar qué escribir, no solo decir que se edite un archivo. Incluye bloques code con el comando exacto de terminal, ruta y nombre del archivo antes de cada fragmento, código funcional que se debe agregar o reemplazar y una comprobación del resultado esperado. Para explorar directorios, muestra un árbol realista de carpetas y ejemplos breves de los archivos mencionados. Para formularios incluye la implementación coherente del componente y de su plantilla, con los imports y dependencias necesarios. Mantén los nombres consistentes entre archivos, evita pseudocódigo, puntos suspensivos o comentarios que sustituyan funcionalidad. Distribuye el código en más páginas si hace falta. Para cada archivo usa un bloque code con filePath igual a su ruta y text con TODO su contenido, incluidos imports, clases, métodos y plantilla. Una ruta como src/app/task.model.ts NO es código y nunca debe ser el único contenido de text. Organiza cada paso así: título breve, ruta del archivo, código completo para copiar y pegar, comprobación de una frase. Da prioridad al código sobre la explicación. Nunca imprimas UUID, id o assetId como contenido: esos identificadores los asigna el servidor.';
export function practicalGuideHasSubstance(blocks:any[]){
 const words=guidePageWordCount(blocks);
 const items=blocks.flatMap(b=>b.items||[]).filter((item:string)=>item.trim().split(/\s+/).length>=3);
 const rows=blocks.filter(b=>b.type==='table').reduce((n,b)=>n+Math.max(0,(b.rows?.length||0)-1),0);
 const steps=blocks.filter(b=>b.type==='heading'&&/paso\s*\d/i.test(b.text)).length;
 const code=blocks.some(b=>b.type==='code'&&b.text.trim().split('\n').length>=3);
 return words>=12&&(items.length>=3||rows>=2||steps>=2||code||blocks.some(b=>b.type==='paragraph'&&words>=30));
}
const practicalStyle='Guía práctica concisa: usa instrucciones numeradas, una acción concreta por paso, verbo directo, herramienta o lugar exacto y una comprobación breve del resultado. Preferentemente 3–6 pasos por apartado, de 10–30 palabras cada uno. Usa listas numeradas (items que comienzan por "1.", "2.", etc.) o títulos "Paso 1", "Paso 2". Añade solo materiales necesarios, advertencias relevantes y criterios de verificación. Limita cada párrafo de apoyo a 2 frases. No añadas introducciones extensas, repeticiones, explicaciones obvias ni texto para llenar páginas. Conserva los detalles técnicos necesarios y las precauciones de seguridad; no acortes código funcional ni elimines datos indispensables. Un apartado breve y ejecutable es válido: no hay mínimo de palabras.';
export async function generateGuidePublication(options:{provider:AIProvider;system:string;prompt:string;topic:string;parameters:Record<string,unknown>;teacher:any;template?:any;citations:any[];initialUsage:string;reserve:(kind:string)=>Promise<string>;record:(id:string,usage:any)=>Promise<void>;images?:InlineAsset[]}){
 const {provider,system,prompt,parameters,teacher,template,citations}=options,count=requestedGuidePages(options.topic,parameters);
 const practical=isPracticalGuide(parameters,options.topic);
 const programming=isProgrammingGuide(options.topic,parameters);
 const writingStyle=[practical||programming?practicalStyle:'',programming?programmingStyle:''].filter(Boolean).join('\n');
 let design:any=template?.structure?.design||defaultGuideDesign;
 if(!guideDesign.safeParse(design).success)design=defaultGuideDesign;
 const first=await provider.generate(system+'\n'+writingStyle+'\nDirector editorial: planifica un documento académico terminado, no un resumen. La portada cuenta como una página. Diseña un itinerario progresivo, con procedimientos explicados, ejemplos completos, aplicación y evaluación. No repitas capítulos para rellenar páginas.',prompt+`\nEntrega un plan de exactamente ${count-1} apartados, uno por cada página de contenido. Cada brief explica qué debe desarrollar esa página y cómo se conecta con las demás. Las páginas iniciales presentan fundamentos y requisitos; las centrales desarrollan contenido concreto y ejemplos; las finales contienen ejercicios, resultados esperados y criterios de revisión. Adapta esta secuencia a la disciplina. La plantilla es una referencia de organización y diseño; sus temas y datos institucionales no se copian. Incluye imageSearches con 3 búsquedas concretas EN INGLÉS para imágenes educativas pertinentes en Wikimedia Commons y el número de apartado (chapter, desde 1) al que corresponde cada imagen. En salud busca ilustraciones anatómicas o del instrumental y del procedimiento solicitado; evita imágenes decorativas genéricas.`,z.toJSONSchema(guidePlan),options.images);
 await options.record(options.initialUsage,first.usage);let raw:any;try{raw=JSON.parse(first.text);}catch{throw new BadRequestException('No se pudo planificar la guía. Intenta nuevamente.');}
 const plan=parse(guidePlan,raw);if(plan.chapters.length!==count-1)throw new BadRequestException('La IA no cubrió todas las páginas solicitadas. Intenta nuevamente.');
 const blocks:any[]=[],pageTitles:string[]=[];let previous='';
 for(const [index,chapter] of plan.chapters.entries()){
  let accepted:any[]|undefined,reason='',previousDraft='';
  for(let attempt=0;attempt<4;attempt++){
   const usage=await options.reserve('guide_page');
   const result=await provider.generate(system+'\n'+writingStyle+'\nRedactor académico: desarrolla UNA página de un documento terminado. El contenido debe permitir que el docente lo use directamente, sin tener que completar explicaciones. No escribas un esquema ni recomendaciones sobre lo que otro autor debe escribir. No añadas imágenes ni identificadores de assets. No vuelvas a incluir el título de la página como un bloque. Usa negritas Markdown para conceptos clave y código íntegro cuando corresponda.',`${prompt}\n<plan_completo>${JSON.stringify(plan)}</plan_completo>\nPágina ${index+2} de ${count}: ${chapter.title}\nObjetivo específico de esta página: ${chapter.brief}\nConexión con la página anterior: ${previous}\n${programming?`Archivos y comandos ya mostrados; mantén sus nombres, imports e integración: <codigo_anterior>${JSON.stringify(blocks.filter(b=>b.type==='code').map(b=>({filePath:b.filePath,language:b.language,text:b.text})))}</codigo_anterior>\n`:''}${practical||programming?writingStyle:attempt===0?'Escribe aproximadamente 220–300 palabras de explicación sustantiva, incluyendo ejemplos o instrucciones concretas, sin contar el código. Cada página requiere al menos 150 palabras útiles. Si incluyes código, limita cada fragmento a 15–20 líneas, con explicación de sus partes y resultado esperado. Máximo 6 bloques, 6 filas por tabla y 4 pasos por diagrama. Evita repetir listas de objetivos o textos de otras páginas.':'Desarrolla 150–200 palabras con explicaciones concretas y ejemplos pertinentes a la disciplina. Usa párrafos, listas o tablas según el tema. Incluye código únicamente si el tema lo requiere. No reduzcas información necesaria solo para encajar en una página.'} ${index===plan.chapters.length-1&&citations.length?'Deja espacio para las referencias sin añadir texto de relleno.':''}\n${reason?`Corrige este problema de la respuesta anterior: ${reason}. Conserva el contenido sustantivo y los ejemplos, ajustando su extensión. Borrador que debes corregir: <borrador>${previousDraft}</borrador>`:''}`,z.toJSONSchema(guidePageDraft));
   await options.record(usage,result.usage);previousDraft=result.text;let value:any;try{value=JSON.parse(result.text);}catch{reason='La respuesta debe ser JSON válido.';continue;}
   const draft=guidePageDraft.safeParse(normalizeGuideDraft(value));if(!draft.success){reason='Corrige estos campos: '+draft.error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; ');continue;}
   const validated=z.array(documentBlock).safeParse(draft.data.blocks.map(b=>({...b,id:randomUUID(),page:index+2})));
   if(!validated.success){reason='Corrige los bloques inválidos: '+validated.error.issues.map(i=>i.message).join('; ');continue;}
   const page=validated.data;
   if(programming){const issue=programmingGuideIssue(page);if(issue){reason=issue;continue;}}
   if(!(practical?practicalGuideHasSubstance(page):guidePageHasSubstance(page))){reason=practical?'Faltan indicaciones utilizables: incluye acciones concretas con herramientas o materiales, y una comprobación del resultado. No alargues el texto para rellenar.':'El apartado está poco desarrollado. Añade explicaciones concretas, ejemplos y criterios de revisión pertinentes al tema; no repitas frases para aumentar la extensión.';continue;}
   accepted=page;break;
  }
  if(!accepted)throw new BadRequestException(`No se pudo completar el apartado «${chapter.title}». ${reason}`);
  const pages=paginateGuideChapter(chapter.title,accepted,index===plan.chapters.length-1?citations:[]);
  if(pageTitles.length+pages.length+(plan.chapters.length-index-1)>29)throw new BadRequestException('El contenido necesita más de 30 páginas. Divide el tema en dos guías.');
  for(const page of pages){pageTitles.push(page.title);blocks.push(...page.blocks.map(b=>({...b,page:pageTitles.length+1})));}
  previous=chapter.brief;
 }
 return parse(guideContract,{title:plan.title,guideType:plan.guideType,objectives:plan.objectives,blocks,publication:{pageCount:pageTitles.length+1,pageTitles,design,course:String(parameters.course||''),career:String(parameters.career||teacher?.academic_context?.career||''),teacher:teacher?.name||'',institution:teacher?.institution||'',duration:String(parameters.duration||''),referenceName:template?.name,imageSearches:plan.imageSearches}});
}
