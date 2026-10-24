import { z } from 'zod';
const text=z.string().min(1).max(15000);
export const documentBlock=z.object({
 id:z.uuid(),type:z.enum(['heading','paragraph','list','table','code','diagram','image']),
 text:z.string().max(15000).default(''),level:z.number().int().min(1).max(3).optional(),
 items:z.array(z.string().max(3000)).max(40).optional(),
 rows:z.array(z.array(z.string().max(2000)).min(1).max(8)).max(60).optional(),
 filePath:z.string().max(240).optional(),language:z.string().max(40).optional(),assetId:z.uuid().optional(),
 caption:z.string().max(1000).optional(),width:z.number().min(20).max(100).optional(),
 page:z.number().int().min(2).max(30).optional(),
}).superRefine((b,ctx)=>{
 if(['heading','paragraph','code'].includes(b.type)&&!b.text.trim())ctx.addIssue({code:'custom',message:'El bloque requiere texto.'});
 if(['list','diagram'].includes(b.type)&&!b.items?.length)ctx.addIssue({code:'custom',message:'El bloque requiere elementos.'});
 if(b.type==='table'&&(!b.rows?.length||b.rows.some(r=>r.length!==b.rows![0].length)))ctx.addIssue({code:'custom',message:'La tabla debe ser rectangular.'});
 if(b.type==='image'&&!b.assetId)ctx.addIssue({code:'custom',message:'Selecciona una imagen propia o generada.'});
});
export const guideDesign=z.object({accentColor:z.string().regex(/^#[0-9a-fA-F]{6}$/),fontStyle:z.enum(['sans','serif']),density:z.enum(['standard','compact']),coverStyle:z.enum(['academic','modern'])});
export const guidePublication=z.object({pageCount:z.number().int().min(2).max(30),pageTitles:z.array(z.string().min(1).max(160)).min(1).max(29),design:guideDesign,course:z.string().max(200),career:z.string().max(200),teacher:z.string().max(200),institution:z.string().max(200),duration:z.string().max(100),referenceName:z.string().max(200).optional(),imageSearches:z.array(z.object({query:z.string().min(1).max(160),chapter:z.number().int().min(1).max(29)})).max(4).optional()});
export const guideContract=z.object({title:text,guideType:text,objectives:z.array(text).min(1).max(20),blocks:z.array(documentBlock).min(1).max(500),publication:guidePublication.optional()});
export const planWeek=z.object({id:z.uuid(),unit:text,topic:text,outcome:text,activities:z.array(text).min(1).max(20),evidence:text,resources:z.array(text).max(20),theoryHours:z.number().min(0).max(60),practiceHours:z.number().min(0).max(60)});
export const planningContract=z.object({title:text,course:text,period:z.string().max(200),weeks:z.array(planWeek).min(1).max(52)});
export const guidePrompt='Generador de guías didácticas completas: adapta la organización a la carrera y solicitud. Para informática incluye requisitos, pasos, código ejecutable, resultados y ejercicios; salud: fundamentos, instrumentos, precauciones educativas y evaluación; derecho: caso, conceptos y análisis; contabilidad: tablas, procedimientos y ejercicios. Nunca uses una estructura de programación para otras disciplinas. Devuelve bloques editables. El servidor asigna sus identificadores: nunca incluyas UUID ni identificadores internos en títulos, explicaciones, listas o código. Usa heading, paragraph, list, table, code y diagram (items representan pasos); las tablas son rectangulares. No inventes assetId ni imágenes: el docente puede incorporarlas después. Incluye objetivos, introducción, procedimientos detallados, ejemplos resueltos, errores frecuentes cuando proceda y evaluación. Con visualMode=none no añadas diagramas. No inventes bibliografía. Si hay un ejemplo de formato en modo structure, respeta sus títulos, orden y tablas cuando corresponda. Los ejemplos institucionales orientan la estructura, no se copian como contenido.';
export const planningPrompt='Planificador académico: organiza todas las semanas solicitadas en unidades coherentes. Cada semana tiene UUID v4 único, tema, logro, actividades concretas, evidencia, recursos y distribución de horas teóricas y prácticas. Usa un sílabo previo o sumilla si se proporciona. Marca los datos no suministrados como propuesta editable; no inventes datos oficiales. Devuelve exactamente weeks semanas; respeta theoryHours y practiceHours semanales si se indican.';
