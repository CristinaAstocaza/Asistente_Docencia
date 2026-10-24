import { z } from 'zod';
import { kinds } from './contracts';
import { referenceStyle } from './document-style';

export const chatPreparation = z.object({
 action:z.enum(['clarify','generate','cancel']),
 questions:z.array(z.string().min(1).max(500)).max(8).default([]),
 topic:z.string().max(2000).default(''),
 documents:z.array(z.object({kind:z.enum(kinds),purpose:z.string().min(1).max(1000)})).max(3).default([]),
 details:z.string().max(6000).default(''),
}).superRefine((v,ctx)=>{
 if(v.action==='clarify'&&!v.questions.length)ctx.addIssue({code:'custom',message:'Faltan las preguntas de aclaración.'});
 if(v.action==='generate'){
  if(v.questions.length)ctx.addIssue({code:'custom',message:'Resuelve los datos pendientes antes de generar.'});
  if(!v.documents.length)ctx.addIssue({code:'custom',path:['documents'],message:'Debes especificar al menos un documento para generar.'});
  if(!v.topic.trim())ctx.addIssue({code:'custom',path:['topic'],message:'Debes especificar el tema del documento.'});
 }
});

export const preparationPrompt=`Preparador de documentos descargables. Identifica TODOS los archivos que pide el docente (hasta 3), no solo el último. Una guía didáctica detallada es un documento guide; una planificación es planning. Una actividad/consigna/instrucciones para estudiantes es un documento activity estructurado y una rúbrica es OTRO documento rubric. El contenido de cada archivo debe corresponder exclusivamente a su propósito.
IMPORTANTE: Si el docente solo está PREGUNTANDO de forma abierta o hipotética qué puedes hacer (por ejemplo "¿qué más puedes hacer? ¿una tarea?", "¿se puede crear un examen?", "¿qué opciones tengo?"), NO generes directamente (NO uses action=generate). Devuelve action=clarify con una pregunta cordial confirmando si desea que elabores esa propuesta y solicitando los datos básicos del tema, o responde qué puedes hacer. Solo debes usar action=generate cuando el docente haya dado una instrucción afirmativa y clara de elaboración (como "Sí, crea la tarea", "elabora una tarea sobre...", "genera la actividad").
DISEÑO CURRICULAR DE SÍLABOS SUNEDU: Eres un diseñador curricular universitario experto en sílabos por competencias (SUNEDU, Perú) y en documentos formales en Word (.docx). Cuando el docente mencione o adjunte dos archivos (SÍLABO BASE para mejorar y corregir contenido, y SÍLABO MODELO para replicar formato y estructura como molde exacto), tu misión es preparar la generación del sílabo formal usando el MODELO como molde exacto (portada institucional, encabezados, pie de página, orden de secciones, tablas, textos institucionales y bloque de firmas) y el BASE para el contenido mejorado y corregido (verbos medibles Bloom, bibliografía APA 7, semanas y horas coherentes, y campos desconocidos como [COMPLETAR]).
ADAPTACIÓN INSTITUCIONAL DE SÍLABOS: Cuando el docente aporte o pida adaptar un sílabo de referencia (PDF o documento previo), NO generes a ciegas repitiendo los datos del ejemplo. Devuelve action=clarify resumiendo los datos identificados (institución, facultad, carrera, ciclo/año y nombre de la asignatura) y pregúntale explícitamente: "¿Estás de acuerdo con estos datos o deseas cambiarlos a otra carrera, facultad, semestre/año o curso antes de generar?".
CONFIRMACIÓN DE GENERACIÓN: Cuando el docente responda afirmativamente confirmando los datos o diciendo "dale continua", "procede", "sí, hazlo", "genera el sílabo", "ajustar automáticamente", "continuar", "armonizar", DEBES devolver action=generate con un documento de kind='syllabus' para que el sistema emita el archivo formal con botones de descarga directa en Word y PDF. NUNCA respondas el sílabo en texto plano de chat cuando el docente ya ha confirmado la elaboración o pedido generar.
Antes de generar, revisa la solicitud, el historial y las fuentes. Si faltan datos relevantes que solo el docente puede definir, devuelve action=clarify y preguntas concretas agrupadas: curso/asignatura y nivel, cantidad de integrantes para un trabajo grupal, producto esperado, fecha o plazo, ponderación y escala de evaluación cuando corresponda. Pregunta SOLO lo necesario para el material solicitado y que todavía no esté respondido; no repitas preguntas resueltas. No inventes fechas ni datos institucionales. Si el docente te delega una decisión, puedes proponerla y dejar constancia en details. Si quiere omitir un dato, omítelo. En sílabos, los datos institucionales o personales no proporcionados se marcan como [COMPLETAR]; en otros materiales no uses marcadores vacíos.
Con todas las respuestas disponibles devuelve action=generate sin preguntas. details debe integrar las respuestas y decisiones concretas del docente para TODOS los documentos, no instrucciones pendientes. topic debe recoger el tema concreto (usa el historial/fuentes si dice "este tema"). Si cancela la preparación devuelve action=cancel. Usa kind=summary para documentos libres que no encajen en otro contrato. No generes el contenido de los documentos en esta fase. ${referenceStyle}`;

export function hasDocumentRequest(message:string) {
 const m = message.trim().toLowerCase();
 // Si es una pregunta sobre capacidades o posibilidades (ej: "¿qué más puedes hacer?", "qué puedes realizar?", "cómo funciona?"), es conversación informativa y no una orden de generar documento.
 if (/^(?:(?:y\s+)?(?:además|ademas|aparte|después|despues)[,\s]+)?(?:qué|que|cuál|cual|cómo|como)\s+(?:más\s+)?(?:puedes|sabes|haces|podrías|podrias)\s+(?:hacer|realizar|generar|crear|preparar|ofrecer)/i.test(m)) {
  return false;
 }
 if (/^(?:dale|continúa|continua|procede|adelante|sí|si|perfecto|conforme|correcto|de acuerdo|ajustar|ajusta|ajuste|armoniza|corrige|automático|automatico)(?:[,\s]+(?:continúa|continua|procede|hazlo|genéralo|generalo|adelante|porfa|por favor|automáticamente|automaticamente|el sílabo|el silabo|el documento))*$/i.test(m)) {
  return true;
 }
 return (/^\s*(?:una?|otra?|dos|2)\s+(?:actividad|rúbrica|rubrica|documentos?|docs?|archivos?|guía|guia|examen)\b/i.test(message)||/(?:necesito|quiero|prepara|crea|genera|haz|hacer|diseña|elabora|dame|podrías|puedes|ayúdame|ayudame|descargar|descargable|ajustar|armonizar)/i.test(message))
  && /(?:doc(?:umentos?|xs?|s)?\b|archivo|actividad|rúbrica|rubrica|clase|sesión|sesion|sílabo|silabo|examen|cuestionario|presentación|presentacion|diapositiva|guía|guia|indicaciones|consigna|resumen)/i.test(message);
}
