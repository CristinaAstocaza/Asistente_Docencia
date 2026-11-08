"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, ChevronRight } from 'lucide-react';
import { api, errorMessage } from '@/services/api';
import './courses.css';

type Course = { id: string; title: string; code: string; weeks: number; ready?: number };

/** «Sesiones de aprendizaje»: one card per accepted syllabus; each card opens the course page with its weeks. */
export default function CoursesPanel() {
 const [courses, setCourses] = useState<Course[]>([]), [error, setError] = useState('');
 useEffect(() => { let active = true; api<Course[]>('/courses').then(list => { if (active) setCourses(list); }).catch(e => { if (active) setError(errorMessage(e)); }); return () => { active = false; }; }, []);

 return <section className="courses-panel">
  <header className="courses-hero">
   <div className="courses-hero-text">
    <span className="courses-kicker"><BookOpen size={15} />Sesiones de aprendizaje</span>
    <h1>Tus cursos, semana a semana</h1>
    <p>Cada sílabo que aceptas se convierte en un curso. Abre una semana y se preparan su sesión de aprendizaje, la presentación, una actividad y su rúbrica, con el formato de la UNICA.</p>
   </div>
   <ol className="courses-steps" aria-label="Cómo funciona">
    <li><span>1</span><div><strong>Genera tu sílabo</strong><small>En la sección Sílabos</small></div></li>
    <li><span>2</span><div><strong>Acepta el sílabo</strong><small>Su curso aparece aquí</small></div></li>
    <li><span>3</span><div><strong>Abre una semana</strong><small>Se crean sus materiales</small></div></li>
   </ol>
  </header>
  {error && <p className="error-box" role="alert">{error}</p>}
  {!courses.length ? <div className="courses-empty">
   <span className="courses-empty-icon"><BookOpen size={30} /></span>
   <h2>Aún no tienes cursos</h2>
   <p>Genera un sílabo y pulsa <strong>Aceptar sílabo</strong>: su curso aparecerá aquí con todas sus semanas.</p>
   <a className="btn primary" href="/silabos">Ir a Sílabos</a>
  </div> : <>
   <h2 className="courses-section-title">Mis cursos <small>{courses.length}</small></h2>
   <div className="courses-grid">{courses.map(c => {
    const total = c.weeks, ready = c.ready || 0, percent = total ? Math.round(100 * ready / total) : 0;
    return <Link key={c.id} className="course-box" href={`/sesiones/${c.id}`}>
     <span className="course-box-top">{c.code ? <span className="course-code">{c.code}</span> : <span />}<span className="course-weeks-count">{total} semanas</span></span>
     <strong>{c.title}</strong>
     <span className="course-progress" aria-label={`${ready} de ${total} semanas preparadas`}><span style={{ width: `${percent}%` }} /></span>
     <span className="course-box-foot">{ready} de {total} semanas preparadas<span className="course-open">Ver semanas<ChevronRight size={15} /></span></span>
    </Link>;
   })}</div>
  </>}
 </section>;
}
