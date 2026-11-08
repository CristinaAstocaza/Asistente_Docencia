import { BadRequestException, Body, Controller, Delete, Get, Injectable, Module, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Database } from '../database/database';
import { AuthGuard, UserRequest } from '../auth/auth.module';
import { parse, uuid } from '../common/validation';
import { AIModule, AIService } from '../ai/ai.module';
import { generationInput } from '../ai/contracts';

export interface WeekPlan { week: number; unitNumber: number | null; unitTitle: string; unitOutcome: string; topic: string; activities: string[]; assessments: string[] }

const clip = (value: unknown, max: number) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const weekNumber = (value: unknown) => Number(String(value ?? '').match(/\d+/)?.[0] || 0);

/** One entry per week of the syllabus, built from its schedule and units. */
export function syllabusWeeks(data: any): WeekPlan[] {
 const schedule: any[] = Array.isArray(data?.schedule) ? data.schedule : [], units: any[] = Array.isArray(data?.units) ? data.units : [];
 const total = Math.min(52, Math.max(0, ...schedule.map(r => Number(r.week) || 0), ...units.flatMap(u => (u.weeks || []).map(weekNumber))));
 const plans: WeekPlan[] = [];
 for (let week = 1; week <= total; week++) {
  const rows = schedule.filter(r => Number(r.week) === week);
  let unitIndex = rows.length ? Number(rows[0].unit) - 1 : -1;
  if (!units[unitIndex]) unitIndex = units.findIndex(u => (u.weeks || []).some((w: unknown) => weekNumber(w) === week));
  const unit = units[unitIndex];
  const position = unit ? (unit.weeks || []).findIndex((w: unknown) => weekNumber(w) === week) : -1;
  const topic = rows.map(r => r.topic).filter(Boolean).join(' / ') || unit?.topics?.[position] || unit?.topics?.[0] || `Semana ${week}`;
  plans.push({ week, unitNumber: unit ? unitIndex + 1 : null, unitTitle: clip(unit?.title, 300), unitOutcome: clip((unit?.outcomes || []).join(' '), 1200), topic: clip(topic, 600), activities: rows.flatMap(r => r.activities || []).map((a: unknown) => clip(a, 300)).slice(0, 8), assessments: rows.flatMap(r => r.assessments || []).map((a: unknown) => clip(a, 40)) });
 }
 return plans;
}

type Case = { title: string; hook?: string; scenario: string; facts?: string[]; questions?: string[] };

export const caseBrief = (c: Case) => `CASO DE LA SESIÓN (úsalo tal cual): «${c.title}». ${clip(c.scenario, 900)}${c.facts?.length ? ` Datos: ${c.facts.join('; ')}.` : ''}${c.questions?.length ? ` Preguntas: ${c.questions.join(' ')}` : ''}`;

const normal = (s: unknown) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
export const mentionsCase = (deck: any, c: Case) => (deck?.slides || []).some((s: any) => normal([s.title, s.subtitle, ...(s.content || [])].join(' ')).includes(normal(c.title)));

/** Slide plan that follows the UNICA didactic sequence (Inicio, Desarrollo, Cierre). */
export const deckPlan = (week: number, course: string, c: Case | null) => `Presentación de la sesión de la semana ${week} del curso ${course}, basada en la sesión del material previo. Usa EXACTAMENTE estas 12 diapositivas en este orden, con section = Inicio, Desarrollo o Cierre y structure = ["Inicio","Desarrollo","Cierre"]:
1 portada (layout title, section Inicio);
2 separadora «Inicio» (layout section);
3 motivación: situación breve y pregunta retadora${c?.hook ? ` (usa este gancho: ${c.hook})` : ''}, SIN entregar aún todos los datos del caso;
4 logro de la sesión y evidencia esperada;
5 activación de saberes previos (preguntas);
6 separadora «Desarrollo» (layout section);
7 y 8 conceptos clave con ejemplos (lo necesario para resolver el caso);
9 «Caso: ${c ? c.title : 'título del caso'}» con el escenario completo y sus datos;
10 actividad en equipos (layout activity) con las preguntas de análisis del caso;
11 separadora «Cierre» (layout section);
12 síntesis, preguntas metacognitivas y conclusión (layout conclusion).
${c ? caseBrief(c) : ''} Cada diapositiva de contenido lleva imageQuery de 2 o 3 palabras concretas en inglés (objetos o escenas reales y actuales del tema, sin palabras ambiguas: p. ej. «server rack», «pharmacy shelves», «paper ledger» en lugar de «notebook») y visualSuggestion.`;

const isCaseSlide = (s: any, c: Case) => /^caso\b/.test(normal(s.title)) || (normal(s.title).includes(normal(c.title)) && s.layout !== 'title');
/** Where the full case belongs: in Desarrollo, after the concepts and before the team activity. */
function casePosition(slides: any[]) {
 const activity = slides.findIndex(s => s.layout === 'activity' && normal(s.section) === 'desarrollo');
 if (activity >= 0) return activity;
 const closing = slides.findIndex(s => s.layout === 'section' && normal(s.section || s.title) === 'cierre');
 return closing >= 0 ? closing : slides.length;
}
/** UNICA sequence: Inicio only teases the case; the full case is analysed in Desarrollo once the concepts are explained. */
export function placeCase(input: any[], c: Case) {
 // The motivating situation belongs to Inicio, right after its divider.
 let slides = input;
 const isHook = (s: any) => !/^caso\b/.test(normal(s.title)) && /situacion|pregunta retadora|reto inicial|motivacion|gancho/.test(normal(s.title));
 const hookAt = slides.findIndex(s => isHook(s) && s.layout !== 'section' && normal(s.section) !== 'inicio');
 if (hookAt >= 0) {
  const rest = slides.filter((_, i) => i !== hookAt), divider = rest.findIndex(s => s.layout === 'section' && normal(s.section || s.title) === 'inicio');
  const at = divider >= 0 ? divider + 1 : Math.min(1, rest.length);
  slides = [...rest.slice(0, at), { ...slides[hookAt], section: 'Inicio' }, ...rest.slice(at)];
 }
 const starts = slides.findIndex(s => /^caso\b/.test(normal(s.title)));
 const found = starts >= 0 ? starts : slides.findIndex(s => isCaseSlide(s, c) && !isHook(s));
 if (found >= 0) {
  if (normal(slides[found].section) === 'desarrollo') return slides;
  const rest = slides.filter((_, i) => i !== found);
  const at = casePosition(rest);
  return [...rest.slice(0, at), { ...slides[found], section: 'Desarrollo' }, ...rest.slice(at)];
 }
 const slide = { title: `Caso: ${clip(c.title, 150)}`, subtitle: 'Caso de estudio para el análisis en equipos', section: 'Desarrollo', layout: 'bullets',
  content: [clip(c.scenario, 600), ...(c.facts || []).slice(0, 3).map(f => clip(f, 600))].filter(Boolean).slice(0, 4),
  takeaway: c.questions?.[0] ? clip(c.questions[0], 180) : undefined, notes: `Preguntas para el análisis: ${(c.questions || []).join(' ')}`.slice(0, 2000), visualSuggestion: 'Caso de estudio de la sesión.' };
 const at = casePosition(slides);
 return [...slides.slice(0, at), slide, ...slides.slice(at)];
}

@Injectable()
export class CoursesService {
 constructor(private readonly db: Database, private readonly ai: AIService) {}

 async accept(userId: string, syllabusId: string) {
  const [syllabus] = await this.db.query('SELECT id,kind,title,data FROM generated_content WHERE id=$1 AND user_id=$2', [syllabusId, userId]);
  if (!syllabus) throw new NotFoundException('Sílabo no encontrado.');
  if (syllabus.kind !== 'syllabus') throw new BadRequestException('Selecciona un sílabo.');
  const weeks = syllabusWeeks(syllabus.data);
  if (!weeks.length) throw new BadRequestException('El sílabo no tiene semanas en su cronograma.');
  const d = syllabus.data, info = { weeklyHours: Number(d.generalData?.weeklyHours) || null, credits: d.credits ?? null, cycle: d.cycle || '', institution: d.coverPage?.institution || d.generalData?.institution || '', faculty: d.coverPage?.faculty || '' };
  const [course] = await this.db.query(`INSERT INTO courses(id,user_id,syllabus_id,title,code,info) VALUES($1,$2,$3,$4,$5,$6)
   ON CONFLICT(syllabus_id) DO UPDATE SET title=EXCLUDED.title,code=EXCLUDED.code,info=EXCLUDED.info RETURNING *`,
   [randomUUID(), userId, syllabusId, clip(d.course || syllabus.title, 300), clip(d.generalData?.courseCode, 100), JSON.stringify(info)]);
  for (const w of weeks) await this.db.query(`INSERT INTO course_weeks(id,course_id,week,unit_title,topic,info) VALUES($1,$2,$3,$4,$5,$6)
   ON CONFLICT(course_id,week) DO UPDATE SET unit_title=EXCLUDED.unit_title,topic=EXCLUDED.topic,info=EXCLUDED.info WHERE course_weeks.status='pending'`,
   [randomUUID(), course.id, w.week, w.unitTitle, w.topic, JSON.stringify(w)]);
  // Weeks removed from an edited syllabus disappear if nothing was generated for them yet.
  await this.db.query(`DELETE FROM course_weeks WHERE course_id=$1 AND week>$2 AND status='pending'`, [course.id, weeks.length]);
  return this.get(userId, course.id);
 }

 list(userId: string) {
  return this.db.query(`SELECT c.*,count(w.id)::integer AS weeks,count(w.id) FILTER (WHERE w.status='ready')::integer AS ready
   FROM courses c LEFT JOIN course_weeks w ON w.course_id=c.id WHERE c.user_id=$1 GROUP BY c.id ORDER BY c.created_at DESC`, [userId]);
 }

 async get(userId: string, id: string) {
  const [course] = await this.db.query('SELECT * FROM courses WHERE id=$1 AND user_id=$2', [parse(uuid, id), userId]);
  if (!course) throw new NotFoundException('Curso no encontrado.');
  const weeks = await this.db.query('SELECT * FROM course_weeks WHERE course_id=$1 ORDER BY week', [course.id]);
  return { ...course, weeks };
 }

 async remove(userId: string, id: string) {
  const course = await this.get(userId, id);
  await this.db.query('DELETE FROM courses WHERE id=$1', [course.id]);
  return { ok: true };
 }

 /** Claims the week (one generation at a time) and builds its materials in the background. */
 async start(userId: string, id: string, week: number) {
  const course = await this.get(userId, id);
  const row = course.weeks.find((w: any) => w.week === week);
  if (!row) throw new NotFoundException('Semana no encontrada.');
  const [claimed] = await this.db.query(`UPDATE course_weeks SET status='generating',error=NULL,updated_at=now() WHERE id=$1 AND (
   status IN ('pending','error') OR (status='generating' AND updated_at<now()-interval '15 minutes')
   OR (status='ready' AND (session_id IS NULL OR presentation_id IS NULL OR activity_id IS NULL OR rubric_id IS NULL))) RETURNING *`, [row.id]);
  if (!claimed) return row;
  void this.run(userId, course, claimed).catch(() => undefined);
  return claimed;
 }

 /** The teacher chooses the sources of a course; they are used for every week (text and pictures). */
 async setSources(userId: string, id: string, sourceIds: string[]) {
  const course = await this.get(userId, id), ids = [...new Set(sourceIds)];
  if (ids.length) {
   const docs = await this.db.query(`SELECT id FROM documents WHERE id=ANY($1::uuid[]) AND user_id=$2 AND enabled=true AND category<>'template'`, [ids, userId]);
   if (docs.length !== ids.length) throw new NotFoundException('Una de las fuentes no está disponible para este docente.');
  }
  await this.db.query('UPDATE courses SET source_ids=$2 WHERE id=$1', [course.id, JSON.stringify(ids)]);
  return this.get(userId, id);
 }

 /** Rebuilds only the week's presentation; the session, activity and rubric stay as they are. */
 async regeneratePresentation(userId: string, id: string, week: number) {
  const course = await this.get(userId, id);
  const row = course.weeks.find((w: any) => w.week === week);
  if (!row) throw new NotFoundException('Semana no encontrada.');
  if (!row.session_id) throw new BadRequestException('Primero prepara la sesión de esta semana.');
  const [claimed] = await this.db.query(`UPDATE course_weeks SET presentation_id=NULL,status='generating',error=NULL,updated_at=now() WHERE id=$1 AND (status<>'generating' OR updated_at<now()-interval '15 minutes') RETURNING *`, [row.id]);
  if (!claimed) throw new BadRequestException('Esta semana ya se está preparando. Espera a que termine.');
  void this.run(userId, course, claimed).catch(() => undefined);
  return claimed;
 }

 private async sources(userId: string, course: any) {
  const [syllabus] = await this.db.query('SELECT source_ids FROM generated_content WHERE id=$1 AND user_id=$2', [course.syllabus_id, userId]);
  const chosen: string[] = Array.isArray(course.source_ids) ? course.source_ids : [];
  const ids: string[] = chosen.length ? chosen : Array.isArray(syllabus?.source_ids) ? syllabus.source_ids : [];
  if (!ids.length) return [];
  const docs = await this.db.query(`SELECT id FROM documents WHERE id=ANY($1::uuid[]) AND user_id=$2 AND status='ready' AND enabled=true AND category<>'template'`, [ids, userId]);
  return docs.map((d: any) => d.id as string);
 }

 private async run(userId: string, course: any, row: any) {
  const plan: WeekPlan = { ...row.info, week: row.week, topic: row.topic, unitTitle: row.unit_title };
  const unit = plan.unitNumber ? `Unidad N° ${plan.unitNumber}: ${plan.unitTitle}` : plan.unitTitle;
  const duration = Math.min(480, Math.max(45, (Number(course.info?.weeklyHours) || 4) * 50));
  const sourceIds = await this.sources(userId, course);
  const brief = `Curso: ${course.code ? `${course.code} – ` : ''}${course.title}. ${unit ? `${unit}. ` : ''}Semana ${row.week}: ${plan.topic}.${plan.unitOutcome ? ` Logro de la unidad: ${plan.unitOutcome}` : ''}${plan.activities?.length ? ` Actividades del sílabo: ${plan.activities.join('; ')}.` : ''}${plan.assessments?.length ? ` Evaluaciones de la semana: ${plan.assessments.join(', ')}.` : ''}`.slice(0, 1900);
  const save = (column: string, value: string) => this.db.query(`UPDATE course_weeks SET ${column}=$2,updated_at=now() WHERE id=$1`, [row.id, value]);
  const generate = (input: Record<string, unknown>) => this.ai.generate(userId, generationInput.parse({ mode: 'general', sourceIds, ...input }));
  try {
   let sessionId: string = row.session_id;
   if (!sessionId) {
    const session = await generate({ kind: 'session', topic: brief, parentId: course.syllabus_id, parameters: { course: `${course.code ? `${course.code} – ` : ''}${course.title}`.slice(0, 300), area: unit.slice(0, 300) || course.title.slice(0, 300), unit: unit.slice(0, 300), week: String(row.week), duration, level: 'Universitario', modality: 'Presencial' } });
    sessionId = session.id;
    // The course data is fixed by the syllabus, not by the model.
    await this.db.query(`UPDATE generated_content SET data=data||$2::jsonb WHERE id=$1`, [sessionId, JSON.stringify({ courseCode: course.code || undefined, course: course.title, unit: unit || undefined, sessionNumber: row.week, sessionTitle: plan.topic })]);
    await save('session_id', sessionId);
   }
   const [sessionRow] = await this.db.query(`SELECT data FROM generated_content WHERE id=$1`, [sessionId]);
   const outcome: string = sessionRow?.data?.outcome || '', caseStudy = sessionRow?.data?.caseStudy?.title ? sessionRow.data.caseStudy : null;
   const patch = (id: string, value: object) => this.db.query(`UPDATE generated_content SET data=data||$2::jsonb WHERE id=$1`, [id, JSON.stringify(value)]);
   if (!row.presentation_id) {
    const deck = await generate({ kind: 'presentation', topic: `Semana ${row.week}: ${plan.topic}`.slice(0, 2000), parentId: sessionId, parameters: { count: 12, style: 'institucional', level: 'Universitario', imageMode: 'internet', detail: 'extended', instructions: deckPlan(row.week, course.title, caseStudy).slice(0, 3000) } });
    // Sequence check: the full case is shown in Desarrollo, never before the concepts.
    // The references slide shows the session's bibliography.
    const references = (sessionRow?.data?.bibliography || []).map((r: unknown) => clip(r, 600)).filter(Boolean).slice(0, 6);
    await patch(deck.id, { ...(caseStudy ? { slides: placeCase(deck.data.slides, caseStudy) } : {}), ...(references.length ? { references } : {}) });
    await save('presentation_id', deck.id);
   }
   let activityId: string = row.activity_id;
   if (!activityId) {
    const activity = await generate({ kind: 'activity', topic: `Actividad de la semana ${row.week}: ${plan.topic}. Debe permitir lograr y evidenciar el logro de la sesión del material previo.${caseStudy ? ` ${caseBrief(caseStudy)} La actividad se resuelve sobre ESTE caso: nómbralo por su título y usa sus datos y preguntas; no digas «el caso provisto en clase».` : ''}`.slice(0, 2000), parentId: sessionId, parameters: { course: course.title.slice(0, 300), level: 'Universitario' } });
    activityId = activity.id;
    // The activity evaluates exactly the session outcome, on the same case.
    await patch(activityId, { ...(outcome ? { achievement: outcome } : {}), ...(caseStudy ? { caseStudy } : {}), course: course.title, ...(course.code ? { courseCode: course.code } : {}), ...(unit ? { unit } : {}), sessionNumber: row.week, sessionTitle: plan.topic });
    await save('activity_id', activityId);
   }
   if (!row.rubric_id) {
    const [activityRow] = await this.db.query(`SELECT title,data FROM generated_content WHERE id=$1`, [activityId]);
    const a = activityRow?.data || {};
    const rubric = await generate({ kind: 'rubric', topic: `Rúbrica para evaluar la actividad «${activityRow?.title || plan.topic}» (semana ${row.week}). Logro: ${outcome || a.achievement || ''}. Producto: ${(a.submission || []).join(' ')}`.slice(0, 2000), parentId: activityId, parameters: { criteriaCount: 4, level: 'Universitario' } });
    const criteria = (rubric.data?.criteria || []).map((c: any) => `${c.name}${c.weight ? ` (${c.weight} %)` : c.levels?.[0]?.score ? ` (${c.levels[0].score} pts)` : ''}`);
    // The activity names the rubric that grades it.
    const summary = (rubric.data?.criteria || []).map((c: any) => ({ name: String(c.name).slice(0, 300), value: c.weight ? `${c.weight} %` : c.levels?.[0]?.score !== undefined ? `${c.levels[0].score} pts` : undefined }));
    await patch(activityId, { evaluation: `Se evaluará con la rúbrica «${rubric.title}»${criteria.length ? `, según estos criterios: ${criteria.join('; ')}` : ''}.`, rubric: { title: String(rubric.title).slice(0, 300), criteria: summary } });
    await save('rubric_id', rubric.id);
   }
   await this.db.query(`UPDATE course_weeks SET status='ready',error=NULL,updated_at=now() WHERE id=$1`, [row.id]);
  } catch (error) {
   const message = error instanceof Error ? error.message : 'No se pudo preparar la semana.';
   await this.db.query(`UPDATE course_weeks SET status='error',error=$2,updated_at=now() WHERE id=$1`, [row.id, message.slice(0, 500)]);
  }
 }
}

@Controller() @UseGuards(AuthGuard)
export class CoursesController {
 constructor(private readonly courses: CoursesService) {}
 @Post('courses') accept(@Req() req: UserRequest, @Body() input: unknown) { const { syllabusId } = parse(z.object({ syllabusId: uuid }), input); return this.courses.accept(req.user.id, syllabusId); }
 @Get('courses') list(@Req() req: UserRequest) { return this.courses.list(req.user.id); }
 @Get('courses/:id') get(@Req() req: UserRequest, @Param('id') id: string) { return this.courses.get(req.user.id, id); }
 @Delete('courses/:id') remove(@Req() req: UserRequest, @Param('id') id: string) { return this.courses.remove(req.user.id, id); }
 @Post('courses/:id/sources') setSources(@Req() req: UserRequest, @Param('id') id: string, @Body() input: unknown) { const { sourceIds } = parse(z.object({ sourceIds: z.array(uuid).max(30) }), input); return this.courses.setSources(req.user.id, id, sourceIds); }
 @Post('courses/:id/weeks/:week/presentation') regeneratePresentation(@Req() req: UserRequest, @Param('id') id: string, @Param('week') week: string) {
  return this.courses.regeneratePresentation(req.user.id, id, parse(z.coerce.number().int().min(1).max(52), week));
 }
 @Post('courses/:id/weeks/:week/generate') start(@Req() req: UserRequest, @Param('id') id: string, @Param('week') week: string) {
  return this.courses.start(req.user.id, id, parse(z.coerce.number().int().min(1).max(52), week));
 }
}

@Module({ imports: [AIModule], controllers: [CoursesController], providers: [CoursesService] })
export class CoursesModule {}
