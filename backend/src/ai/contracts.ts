import { z } from 'zod';
import { activityStyle,rubricStyle } from './document-style';
import { syllabusContract,syllabusPrompt } from './syllabus';
import { guideContract,planningContract,guidePrompt,planningPrompt } from './educational-contracts';
const academicImage=z.object({assetId:z.uuid(),caption:z.string().max(1000),width:z.number().min(20).max(100)});
const s = z.string().min(1).max(15000), strings = z.array(s).min(1).max(100);
const section = z.object({title:s,content:s});
export const question = z.object({
 type:z.enum(['multiple_choice','true_false','development','short_answer','case_study']),question:s,options:z.array(s).max(6),
 subquestions:z.array(z.object({question:s,correctAnswer:s})).min(2).max(6).optional(),
 correctAnswer:s,explanation:s,difficulty:z.enum(['easy','medium','hard']),topic:s,source:z.string(),
}).superRefine((q,ctx)=>{
 if (q.type === 'multiple_choice' && (q.options.length<2 || !q.options.includes(q.correctAnswer))) ctx.addIssue({code:'custom',message:'La respuesta correcta debe coincidir con una alternativa.'});
 if (q.type === 'true_false' && !['Verdadero','Falso'].includes(q.correctAnswer)) ctx.addIssue({code:'custom',message:'Respuesta verdadero/falso inválida.'});
});
export const contracts = {
 guide:guideContract,
 planning:planningContract,
 activity:z.object({title:s,context:z.array(section).max(12).optional(),achievement:s,generalInstructions:s,specificInstructions:strings,recommendations:z.array(s).max(30),submission:strings,evaluation:s}),
 lesson:z.object({title:s,objective:s,introduction:s,motivation:s,development:strings,examples:strings,activity:s,closing:s,questions:strings}),
 session:z.object({title:s,area:s,course:s,topic:s,duration:z.number().int().positive().max(480),competency:s,outcome:s,methodology:s,stages:z.array(z.object({name:z.enum(['Inicio','Desarrollo','Cierre']),minutes:z.number().int().positive(),activities:strings,resources:strings})).length(3),assessment:s,evidence:z.array(s).max(30).optional(),bibliography:z.array(s).max(30).optional(),images:z.array(academicImage).max(20).optional()}),
 syllabus:syllabusContract,
 questions:z.object({title:s,questions:z.array(question).min(1).max(50)}),
 exam:z.object({title:s,instructions:s,duration:z.number().int().positive().max(480),questions:z.array(question).min(1).max(50)}),
 rubric:z.object({title:s,context:z.array(section).max(12).optional(),scoringMode:z.enum(['weighted','points']).optional(),totalPoints:z.number().positive().max(1000).optional(),criteria:z.array(z.object({name:s,definition:s.optional(),weight:z.number().positive().max(100).optional(),levels:z.array(z.object({name:s,score:z.number().nonnegative(),description:s})).length(4)})).min(1).max(20)}),
 presentation:z.object({title:s,style:z.enum(['académico','moderno','minimalista','creativo','corporativo']),imageMode:z.enum(['internet','none']).optional(),slides:z.array(z.object({title:z.string().min(1).max(160),subtitle:z.string().max(160).optional(),content:z.array(z.string().min(1).max(600)).min(1).max(6),takeaway:z.string().max(180).optional(),imageQuery:z.string().max(160).optional(),layout:z.enum(['title','bullets','two-column','activity','conclusion']),notes:s,visualSuggestion:s,visual:z.object({type:z.enum(['diagram','chart','none']),source:z.string().max(500).optional(),items:z.array(z.object({label:z.string().min(1).max(120),value:z.number().nonnegative().optional()})).max(6)}).optional()})).min(3).max(30)}),
 summary:z.object({title:s,sections:z.array(section).min(1).max(20)}),
};
export type Kind = keyof typeof contracts;
// Teacher guides may be completed later while editing; generated guides stay required.
export const examEditContract=contracts.exam.extend({questions:z.array(question.safeExtend({
 correctAnswer:z.string().max(15000),explanation:z.string().max(15000),topic:z.string().max(15000),
 subquestions:z.array(z.object({question:s,correctAnswer:z.string().max(15000)})).min(2).max(6).optional(),
})).min(1).max(50)});
export const examGenerationContract=contracts.exam.superRefine((exam,ctx)=>{
 if(!exam.questions.some(q=>q.type==='development')||!exam.questions.some(q=>q.type==='case_study'))ctx.addIssue({code:'custom',message:'El examen debe combinar teoría abierta y casos prácticos.'});
 for(const q of exam.questions){
  if(!['development','case_study'].includes(q.type)||q.options.length)ctx.addIssue({code:'custom',message:'El examen debe utilizar preguntas abiertas sin alternativas.'});
  if(q.type==='case_study'&&!q.subquestions?.length)ctx.addIssue({code:'custom',message:'Cada caso debe incluir al menos dos subpreguntas.'});
 }
});
export const kinds = Object.keys(contracts) as [Kind,...Kind[]];
export const agentPrompts: Record<Kind,string> = {
 guide:guidePrompt,
 planning:planningPrompt,
 activity:activityStyle,
 lesson:'Asistente para preparar la clase del día: entrega contenido concreto y listo para usar en el aula, adaptado al curso, grado o nivel y tiempo disponible. Organiza el contenido en cómo empezar (introduction y motivation: pregunta o dinámica breve), qué explicar (development y examples: explicaciones claras y ejemplos resueltos), qué harán los estudiantes (activity: instrucciones paso a paso y materiales necesarios) y cómo cerrar (closing y questions: síntesis y preguntas rápidas para comprobar el aprendizaje, con respuestas orientativas). Redacta objective en lenguaje sencillo. Incluye tiempos aproximados dentro del contenido de cada bloque, cuya suma se ajuste a duration; son orientativos y no un cronograma rígido. Si se proporcionan objetivo, competencia, logro o metodología, úsalos para orientar el contenido sin añadir una ficha de planificación formal. Evita lenguaje burocrático, consignas genéricas y actividades sin explicar cómo realizarlas. Usa párrafos breves separados por saltos de línea, negritas Markdown para ideas clave y una instrucción por línea en listas numeradas. Separa los materiales necesarios de los pasos de la actividad. Escribe el código en bloques Markdown con su lenguaje. Cada elemento de development, examples y questions debe contener una idea o ejemplo concreto; evita repetir el título de la sección dentro del texto.',
 session:'Constructor de sesiones: organiza Inicio, Desarrollo y Cierre; la suma de minutos debe coincidir con la duración solicitada. Incluye competencias, logro, metodología, recursos y evaluación.',
 syllabus:syllabusPrompt,
 questions:'Generador de preguntas: respeta cantidad, tipo y dificultad. En alternativa múltiple correctAnswer debe coincidir exactamente con una opción. Incluye explicación y fuente real o cadena vacía si no hay fuente.',
 exam:'Constructor de exámenes mixtos: combina preguntas abiertas de teoría (type=development) y casos prácticos (type=case_study), aproximadamente mitad de cada uno y al menos uno de cada tipo. No generes alternativas ni verdadero/falso: options siempre es []. Respeta temas, nivel, dificultad, tiempo y cantidad: count cuenta preguntas principales, cada caso cuenta como una pregunta. En teoría pide explicar, comparar o justificar conceptos. En cada caso describe una situación concreta con datos suficientes para resolverla; incluye de 2 a 4 subquestions ordenadas, cada una con question y correctAnswer, para analizar, aplicar conceptos y justificar una solución. No escribas las subpreguntas otra vez en el enunciado. Incluye instrucciones y respuestas orientativas con explicación para el docente. Ignora el antiguo parámetro type si estuviera presente: todos los exámenes nuevos usan esta combinación.',
 rubric:'Constructor de rúbricas: '+rubricStyle,
 presentation:'Diseñador de presentaciones didácticas: crea una historia educativa que explique, ejemplifique y haga participar, respetando el número de diapositivas y el estilo. Alterna portada (title), conceptos con ejemplos (bullets), comparaciones (two-column), una actividad práctica (activity) y conclusiones (conclusion). Usa títulos específicos, un subtitle breve y un takeaway que sintetice la idea clave. Incluye 3–4 puntos sustantivos por diapositiva de contenido, de 100–180 caracteres cada uno: definición y explicación, ejemplo concreto, aplicación y pregunta o recomendación. Evita frases genéricas y repetir el mismo contenido. En portada basta una introducción breve. Si detail=extended, profundiza en mecanismos, relaciones, limitaciones y casos de uso, sin saturar las diapositivas. Escribe notes completas (80–120 palabras) con explicaciones adicionales, guía para el docente y respuesta orientativa de las actividades. Incluye imageQuery: 2–4 palabras concretas en inglés para buscar una fotografía educativa relevante en Wikimedia Commons (objetos, lugares, fenómenos; evita títulos abstractos, calificativos como modern o learning y nunca inventes URLs; si el tema trata de tecnología educativa, incluye computer, laptop o tablet en las fotos de aula). Las fotografías ilustran, no prueban los hechos. visualSuggestion describe cómo ayuda la imagen a entender el concepto. Añade diagramas de 2–5 pasos para procesos. SOLO usa chart cuando los valores numéricos se encuentren en las fuentes proporcionadas; indica la referencia y unidad en visual.source. Sin cifras respaldadas, usa diagram o none: no inventes porcentajes, tendencias, citas ni referencias bibliográficas. Respeta imageMode solicitado.',
 summary:'Analista de fuentes: resume conceptos relevantes en secciones, distinguiendo contenido sustentado de sugerencias.',
};
export const generationInput = z.object({kind:z.enum(kinds),topic:z.string().trim().min(1).max(2000),sourceIds:z.array(z.uuid()).max(30).default([]),mode:z.enum(['sources','general']).default('general'),parameters:z.record(z.string().max(100),z.union([z.string().max(100000),z.number(),z.boolean()])).default({}),parentId:z.uuid().optional(),templateId:z.uuid().optional(),templateIds:z.array(z.uuid()).max(10).optional(),visualAssetIds:z.array(z.uuid()).max(10).optional(),templateMode:z.enum(['structure','inspiration']).optional(),referencePdfId:z.uuid().optional(),baseSections:z.array(z.object({title:z.string().min(1).max(200),content:z.string().min(1).max(15000)})).max(40).optional()}).superRefine((input,ctx)=>{
 if(input.kind!=='syllabus')for(const [key,value] of Object.entries(input.parameters))if(typeof value==='string'&&value.length>3000)ctx.addIssue({code:'custom',path:['parameters',key],message:'Este campo admite hasta 3000 caracteres.'});
 if(input.referencePdfId&&!['presentation','syllabus'].includes(input.kind))ctx.addIssue({code:'custom',message:'El PDF de ejemplo se utiliza en Presentaciones y Sílabos.'});
 const limits:Record<string,[number,number]>={count:input.kind==='presentation'?[3,30]:input.kind==='exam'?[2,50]:[1,50],duration:[5,480],weeks:[1,52],credits:[0,30],weeklyHours:[1,60],criteriaCount:[1,20]};
 for(const [key,[min,max]] of Object.entries(limits))if(input.parameters[key]!==undefined){const value=Number(input.parameters[key]);if(!Number.isFinite(value)||value<min||value>max || (key!=='credits'&&!Number.isInteger(value)))ctx.addIssue({code:'custom',message:`${key} debe estar entre ${min} y ${max}${key==='credits'?'':' y ser entero'}.`});}
});
