"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ChevronDown, ChevronRight, Download, ExternalLink, FileText, Presentation, ClipboardList, Grid3X3, RefreshCw, Loader2, Library } from 'lucide-react';
import { api, post, download, errorMessage, Source } from '@/services/api';
import SourcePicker from '@/features/sources/SourcePicker';
import { notify } from '@/components/feedback';
import './courses.css';

export type Week = { id: string; week: number; unit_title: string; topic: string; status: 'pending' | 'generating' | 'ready' | 'error'; error?: string | null; session_id?: string | null; presentation_id?: string | null; activity_id?: string | null; rubric_id?: string | null };
type CourseDetail = { id: string; title: string; code: string; weeks: Week[]; source_ids?: string[] };

const materials = [
 { key: 'session_id', label: 'Sesión de aprendizaje', icon: FileText, formats: ['docx', 'pdf'] },
 { key: 'presentation_id', label: 'Presentación (PPT)', icon: Presentation, formats: ['pptx', 'pdf'] },
 { key: 'activity_id', label: 'Actividad / guía', icon: ClipboardList, formats: ['docx', 'pdf'] },
 { key: 'rubric_id', label: 'Rúbrica de la actividad', icon: Grid3X3, formats: ['docx', 'pdf'] },
] as const;

/** One course on its own page: its weeks open into the session, slides, activity and rubric. */
export default function CourseWeeks() {
 const { id } = useParams<{ id: string }>();
 const [course, setCourse] = useState<CourseDetail | null>(null), [loading, setLoading] = useState(true);
 const [openWeeks, setOpenWeeks] = useState<number[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false);
 const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
 // Course sources: their text and pictures feed the session, slides and activity of every week.
 const [library, setLibrary] = useState<Source[] | null>(null), [chosen, setChosen] = useState<string[]>([]), [showSources, setShowSources] = useState(false);

 const refresh = useCallback(async () => { const detail = await api<CourseDetail>(`/courses/${id}`); setCourse(detail); return detail; }, [id]);
 useEffect(() => { let active = true; api<CourseDetail>(`/courses/${id}`).then(d => { if (active) setCourse(d); }).catch(e => { if (active) setError(errorMessage(e)); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [id]);

 // While a week is being prepared, check again every few seconds.
 useEffect(() => {
  if (timer.current) clearTimeout(timer.current);
  if (course?.weeks.some(w => w.status === 'generating')) timer.current = setTimeout(() => { refresh().catch(e => setError(errorMessage(e))); }, 4000);
  return () => { if (timer.current) clearTimeout(timer.current); };
 }, [course, refresh]);

 const update = (week: number, value: Partial<Week>) => setCourse(current => current ? { ...current, weeks: current.weeks.map(w => w.week === week ? { ...w, ...value } : w) } : current);

 async function openSources() {
  if (!course) return;
  setShowSources(open => !open); setChosen(course.source_ids || []);
  if (!library) try { setLibrary(await api<Source[]>('/documents')); } catch (e) { setError(errorMessage(e)); }
 }
 async function saveSources() {
  if (!course) return;
  setBusy(true);
  try { setCourse(await api<CourseDetail>(`/courses/${course.id}/sources`, post({ sourceIds: chosen }))); setShowSources(false); notify('Fuentes del curso guardadas. Se usarán en las semanas que prepares desde ahora.'); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
 }
 async function prepare(week: Week) {
  setError('');
  try { update(week.week, await api<Week>(`/courses/${id}/weeks/${week.week}/generate`, post({}))); } catch (e) { setError(errorMessage(e)); }
 }
 function toggle(week: Week) {
  const opening = !openWeeks.includes(week.week);
  setOpenWeeks(list => opening ? [...list, week.week] : list.filter(w => w !== week.week));
  const incomplete = !week.session_id || !week.presentation_id || !week.activity_id || !week.rubric_id;
  if (opening && (week.status === 'pending' || (week.status === 'ready' && incomplete))) void prepare(week);
 }
 async function exportFile(contentId: string, format: string, name: string) {
  setBusy(true);
  try { await download(`/content/${contentId}/export`, { format, answerKey: false }, `${name}.${format}`); notify('Descarga preparada.'); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
 }

 const ready = course?.weeks.filter(w => w.status === 'ready').length || 0, total = course?.weeks.length || 0;
 return <section className="courses-panel">
  <Link className="course-back" href="/sesiones"><ArrowLeft size={16} />Mis cursos</Link>
  {error && <p className="error-box" role="alert">{error}</p>}
  {loading && <p className="loading-line" role="status">Cargando el curso…</p>}
  {course && <>
   <header className="course-header">
    <div className="course-header-text">
     {course.code && <span className="course-code">{course.code}</span>}
     <h1>{course.title}</h1>
     <p>{ready} de {total} semanas preparadas. Abre una semana para crear su sesión, presentación, actividad y rúbrica.</p>
     <span className="course-progress large" aria-hidden="true"><span style={{ width: `${total ? Math.round(100 * ready / total) : 0}%` }} /></span>
    </div>
    <button type="button" className="btn course-sources-button" aria-expanded={showSources} onClick={openSources}><Library size={15} />Fuentes del curso ({course.source_ids?.length || 0})</button>
   </header>
   {showSources && <div className="course-sources"><p className="muted">Elige los documentos (PDF, Word o PowerPoint) del curso. La IA usará su contenido y extraerá sus imágenes para las diapositivas de las semanas que prepares desde ahora.</p>{library ? <SourcePicker sources={library} selected={chosen} onChange={setChosen} mode="general" onMode={() => undefined} /> : <p className="muted">Cargando tus fuentes…</p>}<div className="toolbar"><button type="button" className="btn primary" disabled={busy || !library} onClick={saveSources}>Guardar fuentes</button><a className="btn" href="/fuentes">Subir nuevas fuentes</a></div></div>}
   <div className="card course-weeks">
    {course.weeks.map(week => {
     const open = openWeeks.includes(week.week);
     return <article key={week.id} className={`course-week status-${week.status}`}>
      <button type="button" className="course-week-header" aria-expanded={open} onClick={() => toggle(week)}>
       {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
       <span className="course-week-number">Semana {String(week.week).padStart(2, '0')}</span>
       <span className="course-week-topic">{week.topic}{week.unit_title && <small>{week.unit_title}</small>}</span>
       <span className="course-week-state">{week.status === 'ready' ? 'Lista' : week.status === 'generating' ? 'Preparando…' : week.status === 'error' ? 'Con error' : 'Cerrada'}</span>
      </button>
      {open && <div className="course-week-body">
       {week.status === 'generating' && <p className="loading-line" role="status"><Loader2 size={16} className="spin" />Creando la sesión, la presentación, la actividad y su rúbrica de esta semana. Puede tardar unos minutos; puedes seguir trabajando.</p>}
       {week.status === 'error' && <div className="error-box" role="alert"><p>{week.error || 'No se pudo preparar la semana.'}</p><button className="btn" type="button" onClick={() => prepare(week)}><RefreshCw size={14} />Reintentar</button></div>}
       <ul className="course-materials">{materials.map(m => {
        const contentId = week[m.key]; const Icon = m.icon;
        return <li key={m.key}><Icon size={18} /><span>{m.label}</span>{contentId ? <div className="toolbar">
         <a className="btn" href={`/historial?id=${contentId}`}><ExternalLink size={14} />Abrir</a>
         {m.formats.map(f => <button key={f} type="button" className="btn" disabled={busy} onClick={() => exportFile(contentId, f, `Semana ${week.week} - ${m.label}`)}><Download size={14} />{f.toUpperCase()}</button>)}
        </div> : <span className="muted">{week.status === 'generating' ? 'En preparación…' : 'Pendiente'}</span>}</li>;
       })}</ul>
      </div>}
     </article>;
    })}
   </div>
  </>}
 </section>;
}
