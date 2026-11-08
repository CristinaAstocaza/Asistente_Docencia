import { z } from 'zod';
const text=z.string().min(1).max(25000),list=z.array(text).min(1).max(100),optionalList=z.array(text).max(100);
const details={
 generalData:z.object({institution:z.string().max(200),courseCode:z.string().max(100),careers:optionalList,modality:z.string().max(100),weeklyHours:z.number().nonnegative().max(60),term:z.string().max(200),nature:z.string().max(200),prerequisites:z.string().max(1000),
  theoryHours:z.number().nonnegative().max(60).optional(),practiceHours:z.number().nonnegative().max(60).optional(),chronologicalPeriod:z.string().max(200).optional(),condition:z.string().max(100).optional(),mission:z.string().max(3000).optional(),
  teacherName:z.string().max(300).optional(),teacherDni:z.string().max(30).optional(),teacherEmail:z.string().max(200).optional(),
  timetable:z.array(z.object({section:z.string().max(60),theorySchedule:z.string().max(120),theoryRoom:z.string().max(120),practiceSchedule:z.string().max(120),practiceRoom:z.string().max(120)})).max(12).optional()}),
 rationale:text,
 generalOutcome:text,
 evaluationPlan:z.object({status:z.enum(['provided','proposed']),items:z.array(z.object({code:z.string().min(1).max(30),description:text,week:z.number().int().min(1).max(52),weight:z.number().positive().max(100),observation:text})).min(1).max(30),rules:optionalList}),
 bibliographyDetails:z.object({base:optionalList,complementary:optionalList,suggestions:optionalList}),
 competencies:z.array(z.object({career:text,competency:text})).min(1).max(30),
 schedule:z.array(z.object({unit:z.number().int().min(1).max(30),week:z.number().int().min(1).max(52),session:z.number().int().positive().max(364),topic:text,activities:list,assessments:z.array(z.string().min(1).max(30)).max(30)})).min(1).max(364),
};
const coverPageSchema = z.object({
 institution: z.string().max(300).optional(),
 faculty: z.string().max(300).optional(),
 department: z.string().max(300).optional(),
 logoUrl: z.string().max(2000).optional(),
 logoBase64: z.string().optional(),
 course: z.string().max(300).optional(),
 semester: z.string().max(100).optional(),
 year: z.string().max(50).optional(),
 location: z.string().max(100).optional(),
}).optional();

export const syllabusContract=z.object({
 title:text,
 course:text,
 credits:z.number().nonnegative(),
 cycle:text,
 description:text,
 competency:text,
 outcomes:list,
 units:z.array(z.object({title:text,weeks:list,topics:list,outcomes:list})).min(1).max(30),
 methodology:text,
 evaluation:list,
 bibliography:list,
  coverPage:coverPageSchema,
  baseSections:z.array(z.object({title:text,content:text})).max(50).optional(),
  signatureDate:z.string().max(100).optional(),
  changesSummary:optionalList.optional(),
  pendingFields:optionalList.optional(),
  verificationNotes:optionalList.optional()
}).extend(Object.fromEntries(Object.entries(details).map(([key,schema])=>[key,schema.optional()])) as {[K in keyof typeof details]:z.ZodOptional<(typeof details)[K]>});
export const syllabusGenerationContract=syllabusContract.extend(details);


/** Single supported format: syllabus of the Universidad Nacional "San Luis Gonzaga" (UNICA, Ica). */
export const syllabusPrompt=`Eres un diseñador curricular universitario de la Universidad Nacional "San Luis Gonzaga" (UNICA, Ica-Perú), experto en sílabos por competencias (SUNEDU).
Redactas SIEMPRE con el formato oficial de sílabo de la UNICA. El programa dibuja el documento con un diseño fijo idéntico al de la UNICA; tú solo entregas el contenido en el esquema JSON.

FORMATO FIJO (no lo cambies, no agregues ni quites secciones):
- Portada (coverPage): institution = UNIVERSIDAD NACIONAL "SAN LUIS GONZAGA" (salvo otro valor en Parámetros), faculty (ej. FACULTAD DE INGENIERÍA DE SISTEMAS), department (ej. DEPARTAMENTO ACADÉMICO DE INGENIERÍA DE SISTEMAS), course (curso solicitado), semester (ej. II SEMESTRE), year (ej. 2026 - I), location = ICA-PERÚ.
- I. INFORMACIÓN GENERAL Y DATOS DEL CURSO: 1.1 Datos Curriculares, 1.2 Datos del Periodo Académico, 1.3 Carga Horaria (horas de teoría + práctica = horas semanales; tabla de horario y ambientes en generalData.timetable), 1.4 Cuerpo Académico.
- II. FUNDAMENTO CURRICULAR E INSTITUCIONAL: 2.1 Misión institucional, 2.2 Sumilla (description), 2.3 Fundamentación del curso (rationale).
- III. COMPETENCIAS, CAPACIDADES Y LOGROS DEL CURSO: 3.1 competency, 3.2 outcomes (capacidades), 3.3 generalOutcome.
- IV. CONTENIDOS ORGANIZADOS EN UNIDADES Y SECUENCIAS DE APRENDIZAJES: por unidad «UNIDAD Nº n: TÍTULO», LOGRO DE LA UNIDAD y tabla Nº semana | contenido | actividades | evidencias | bibliografía (sale de units y schedule).
- V. ESTRATEGIAS METODOLÓGICAS (methodology), VI. EVALUACIÓN (evaluationPlan), VII. FUENTES DE INFORMACIÓN (bibliographyDetails), VIII. CRONOGRAMA DE ACTIVIDADES (schedule) y firmas.

CONTENIDO DEL CURSO:
1. generalData: institución, código, carreras, modalidad, horas semanales, theoryHours y practiceHours (suman las horas semanales), term (periodo académico), chronologicalPeriod, condition, nature (área de estudio) y prerrequisitos. Los datos de Parámetros y del sílabo base de la UNICA tienen prioridad; no inventes docente, DNI, correo, aulas ni horarios: si no se dieron, deja esos campos vacíos o sin filas.
2. rationale: relevancia académica y profesional, necesidad formativa y aporte al perfil de egreso, con rigor académico.
3. description (sumilla): naturaleza del curso (teórico/práctico), propósito y ejes temáticos; distinta de la fundamentación.
4. competency, competencies, outcomes y generalOutcome («Al finalizar el curso, el estudiante…» con verbo observable de Bloom, objeto, contexto y calidad esperada).
5. units: unidades coherentes, título en mayúsculas, weeks como cadenas numéricas individuales (["1","2","3","4"]), outcomes medibles y topics desarrollados (uno por semana).
6. methodology: métodos, rol del docente y del estudiante, estrategias (ABP, casos, trabajo colaborativo), trabajo autónomo y recursos.
7. evaluationPlan: una sola fórmula coherente; los pesos suman exactamente 100 %; cada ítem con código, descripción, semana, peso y observación.
8. schedule: TODAS las semanas solicitadas; cada fila con unit (desde 1), week, session, topic, activities concretas con verbos medibles y assessments (códigos de evaluationPlan de esa semana o []). Las semanas de cada unidad coinciden con el cronograma.
9. bibliographyDetails: APA 7, obras reales y pertinentes; base (obligatoria), complementary y suggestions. bibliography conserva el resumen textual.

SÍLABO BASE DE LA UNICA: si se adjunta, úsalo como referencia del curso (datos institucionales, horario, docente, misión, fechas y nivel de detalle) y mejora su contenido; corrige incoherencias de horas, semanas y fórmulas. Si se pide un curso distinto al del sílabo base, ningún tema del curso original debe quedar.

REGLAS:
- NUNCA uses marcadores como [COMPLETAR], [VERIFICAR], [X] ni corchetes de relleno.
- No incluyas notas de auditoría, cambios ni campos pendientes: el sílabo se entrega limpio como documento oficial.
- Elimina cualquier texto ajeno a un sílabo formal (menciones a IA, archivos o prompts).`;

const UNICA = 'UNIVERSIDAD NACIONAL "SAN LUIS GONZAGA"';
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'];
/** «04 de noviembre del 2026», as written above the signatures of UNICA syllabi. */
export function signatureDate(now = new Date()) {
 const [year, month, day] = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now).split('-').map(Number);
 return `${String(day).padStart(2, '0')} de ${MONTHS[month - 1]} del ${year}`;
}
const num = (value: unknown) => { const n = Number(String(value ?? '').match(/\d+(\.\d+)?/)?.[0]); return Number.isFinite(n) ? n : undefined; };

/** Rows typed as "Sección | Teoría horario | Teoría lugar | Práctica horario | Práctica lugar". */
export function parseTimetable(value: unknown) {
 return String(value ?? '').split(/\r?\n/).map(line => line.split('|').map(cell => cell.trim())).filter(cells => cells.some(Boolean) && cells.length >= 2 && !/^secci[oó]n$/i.test(cells[0]))
  .slice(0, 12).map(([section = '', theorySchedule = '', theoryRoom = '', practiceSchedule = '', practiceRoom = '']) => ({ section, theorySchedule, theoryRoom, practiceSchedule, practiceRoom }));
}

/** Teacher/base-document data always wins over what the model wrote; the cover is always UNICA. */
export function applyUnicaData(data: any, p: Record<string, unknown>) {
 const g = data.generalData = { ...(data.generalData || {}) };
 const text = (key: string) => String(p[key] ?? '').trim();
 for (const key of ['courseCode', 'modality', 'term', 'nature', 'prerequisites', 'chronologicalPeriod', 'condition', 'mission'] as const) if (text(key)) g[key] = text(key);
 if (text('careers')) g.careers = text('careers').split(/\r?\n|;/).map(s => s.trim()).filter(Boolean);
 for (const key of ['weeklyHours', 'theoryHours', 'practiceHours'] as const) { const n = num(p[key]); if (n !== undefined) g[key] = n; }
 if (g.theoryHours !== undefined && g.practiceHours !== undefined && !num(p.weeklyHours)) g.weeklyHours = g.theoryHours + g.practiceHours;
 const timetable = parseTimetable(p.timetable);
 if (timetable.length) g.timetable = timetable;
 if (text('cycle')) data.cycle = text('cycle');
 const credits = num(p.credits); if (credits !== undefined) data.credits = credits;
 // The signature date is the day the document is created (Lima time), not one typed or copied from the base PDF.
 data.signatureDate = signatureDate();
 const cover = data.coverPage = { ...(data.coverPage || {}) };
 for (const key of ['institution', 'faculty', 'department'] as const) if (text(key)) cover[key] = text(key);
 cover.institution = cover.institution || g.institution || UNICA;
 g.institution = g.institution || cover.institution;
 if (text('course')) { cover.course = text('course'); data.course = text('course'); }
 // UNICA cover: «IV SEMESTRE» from the cycle and «2026 - II» from the academic period.
 const cycle = String(data.cycle || '').trim(), term = String(g.term || '').trim();
 if (cycle) cover.semester = /semestre|ciclo/i.test(cycle) ? cycle.toUpperCase() : `${cycle.toUpperCase()} SEMESTRE`;
 if (term) cover.year = term.replace(/\s*-\s*/, ' - ');
 cover.location = cover.location || 'ICA-PERÚ';
 if (cover.semester && cover.year && cover.semester.replace(/\s/g, '') === cover.year.replace(/\s/g, '')) delete cover.semester;
 delete data.renderedSections; delete data.design; delete data.baseSections;
 return data;
}
