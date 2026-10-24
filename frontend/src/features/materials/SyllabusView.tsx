"use client";
import { Value } from '@/services/api';

type Unit = { title: string; weeks: string[]; topics: string[]; outcomes: string[] };
type Syllabus = {
 course: string;
 credits: number;
 cycle: string;
 description: string;
 competency: string;
 outcomes: string[];
 units: Unit[];
 methodology: string;
 evaluation: string[];
 bibliography: string[];
 rationale?: string;
 generalOutcome?: string;
 generalData?: {
  institution: string;
  courseCode: string;
  careers: string[];
  modality: string;
  weeklyHours: number;
  term: string;
  nature: string;
  prerequisites: string;
  teacherName?: string;
  teacherEmail?: string;
  mission?: string;
 };
 evaluationPlan?: {
  status: string;
  items: { code: string; description: string; week: number; weight: number; observation: string }[];
  rules: string[];
 };
 bibliographyDetails?: { base: string[]; complementary: string[]; suggestions: string[] };
 competencies?: { career: string; competency: string }[];
 schedule?: { unit: number; week: number; session: number; topic: string; activities: string[]; assessments: string[] }[];
 changesSummary?: string[];
 pendingFields?: string[];
 verificationNotes?: string[];
};

const List = ({ items }: { items: string[] }) => (
 <ul style={{ paddingLeft: '20px', margin: '6px 0' }}>
  {items.map((item, i) => <li key={i} style={{ marginBottom: '3px' }}>{item}</li>)}
 </ul>
);

export default function SyllabusView({ data }: { data: Record<string, Value> }) {
 const d = data as unknown as Syllabus;
 const g = d.generalData;
 const plan = d.evaluationPlan;
 const bib = d.bibliographyDetails;
 const c = (data.coverPage as Record<string, string>) || {};

 const institution = c.institution || g?.institution;
 const faculty = c.faculty || (g?.careers?.length ? `FACULTAD DE ${g.careers[0].toUpperCase()}` : '');
 const department = c.department || '';
 const courseTitle = c.course || d.course || (data.title as string);
 const semester = c.semester || g?.term || d.cycle || 'II';
 const year = c.year || '2026 – I';
 const location = c.location || 'ICA-PERÚ';

 const weeksTotal = d.schedule?.length ? Math.max(...d.schedule.map(r => Number(r.week) || 1)) : 14;
 const weeklyTotal = g?.weeklyHours || 5;
 const theoryH = Math.max(1, Math.round(weeklyTotal * 0.6));
 const practiceH = Math.max(1, weeklyTotal - theoryH);

 const schedule = [...(d.schedule ?? [])].sort((a, b) => a.week - b.week || a.session - b.session);

 return (
  <div className="syllabus-document" style={{ background: '#FFFFFF', padding: '36px', borderRadius: '12px', border: '1px solid #E2E8F0', color: '#0F172A' }}>
   {/* PORTADA INSTITUCIONAL */}
   {institution && (
    <header className="syllabus-cover-preview card" style={{ textAlign: 'center', padding: '48px 32px', marginBottom: '36px', background: '#FFFFFF', border: '1.5px solid #CBD5E1', borderRadius: '8px' }}>
     <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#14213D', marginBottom: '8px', letterSpacing: '0.5px' }}>{institution.toUpperCase()}</h2>
     {faculty && <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>{faculty.toUpperCase()}</h3>}
     {department && <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#64748B', marginBottom: '24px' }}>{department.toUpperCase()}</h4>}
     {c.logoBase64 && (
      <div style={{ margin: '24px auto', display: 'flex', justifyContent: 'center' }}>
       <img src={`data:image/png;base64,${c.logoBase64}`} alt="Escudo institucional" style={{ maxHeight: '130px', maxWidth: '150px', objectFit: 'contain' }} />
      </div>
     )}
     <div style={{ marginTop: '24px', marginBottom: '10px', fontSize: '14px', fontWeight: 700, color: '#14213D', letterSpacing: '0.5px' }}>SILABO DE LA ASIGNATURA DE:</div>
     <div style={{ fontSize: '22px', fontWeight: 800, color: '#1E3A8A', marginBottom: '14px', letterSpacing: '0.2px' }}>{courseTitle.toUpperCase()}</div>
     {semester && <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>{semester.toUpperCase()}</div>}
     <div style={{ fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '20px' }}>{year}</div>
     <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', letterSpacing: '1px' }}>{location.toUpperCase()}</div>
    </header>
   )}

   {/* ENCABEZADO INSTITUCIONAL DE HOJAS SIGUIENTES (TAL CUAL EL MODELO UNICA) */}
   {institution && (
    <div style={{ display: 'flex', alignItems: 'center', gap: '20px', paddingBottom: '16px', marginBottom: '24px', borderBottom: '1.5px solid #000' }}>
     {c.logoBase64 && (
      <img src={`data:image/png;base64,${c.logoBase64}`} alt="Escudo" style={{ height: '54px', width: '54px', objectFit: 'contain' }} />
     )}
     <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ fontSize: '13px', fontWeight: 800, color: '#000', letterSpacing: '0.3px' }}>{institution.toUpperCase()}</div>
      {faculty && <div style={{ fontSize: '12px', fontWeight: 700, color: '#000' }}>{faculty.toUpperCase()}</div>}
      {department && <div style={{ fontSize: '11px', fontWeight: 700, color: '#000' }}>{department.toUpperCase()}</div>}
      <div style={{ fontSize: '13px', fontWeight: 800, color: '#000', marginTop: '6px', letterSpacing: '1px' }}>SÍLABO</div>
     </div>
    </div>
   )}

   {/* I. INFORMACIÓN GENERAL Y DATOS DEL CURSO */}
   <section style={{ marginBottom: '24px' }}>
    <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#000', textTransform: 'uppercase', marginBottom: '14px' }}>I. INFORMACIÓN GENERAL Y DATOS DEL CURSO</h3>
    
    <div style={{ marginBottom: '12px' }}>
     <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#000', margin: '8px 0 6px 12px' }}>1.1 Datos Curriculares</h4>
     <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse', marginLeft: '16px' }}>
      <tbody>
       <tr><td style={{ width: '220px', padding: '3px 0', color: '#1e293b' }}>Nombre del Curso</td><td>: <strong>{courseTitle}</strong></td></tr>
       <tr><td style={{ padding: '3px 0', color: '#1e293b' }}>Código</td><td>: {g?.courseCode || '1P35024'}</td></tr>
       <tr><td style={{ padding: '3px 0', color: '#1e293b' }}>Créditos Académicos</td><td>: {String(d.credits || 4).padStart(2, '0')}</td></tr>
       <tr><td style={{ padding: '3px 0', color: '#1e293b' }}>Condición</td><td>: Obligatorio</td></tr>
       <tr><td style={{ padding: '3px 0', color: '#1e293b' }}>Área de estudio</td><td>: {g?.nature || (g?.careers?.length ? g.careers[0] : 'Formación de Especialidad')}</td></tr>
      </tbody>
     </table>
    </div>

    <div style={{ marginBottom: '12px' }}>
     <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#000', margin: '8px 0 6px 12px' }}>1.2 Datos del Periodo Académico</h4>
     <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse', marginLeft: '16px' }}>
      <tbody>
       <tr><td style={{ width: '220px', padding: '3px 0', color: '#1e293b' }}>Periodo Académico</td><td>: {g?.term || c.year || '2026-I'}</td></tr>
       <tr><td style={{ padding: '3px 0', color: '#1e293b' }}>Semestre Académico</td><td>: {c.semester || d.cycle || 'II'}</td></tr>
       <tr><td style={{ padding: '3px 0', color: '#1e293b' }}>Periodo Cronológico</td><td>: Del 07/09/2026 al 11/12/2026</td></tr>
       <tr><td style={{ padding: '3px 0', color: '#1e293b' }}>Duración de la asignatura</td><td>: {weeksTotal} semanas</td></tr>
       <tr><td style={{ padding: '3px 0', color: '#1e293b' }}>Modalidad</td><td>: {g?.modality || 'Presencial'}</td></tr>
       <tr><td style={{ padding: '3px 0', color: '#1e293b' }}>Prerrequisitos</td><td>: {g?.prerequisites || 'Haber aprobado los créditos correspondientes'}</td></tr>
      </tbody>
     </table>
    </div>

    <div style={{ marginBottom: '12px' }}>
     <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#000', margin: '8px 0 6px 12px' }}>1.3 Carga Horaria</h4>
     <p style={{ fontSize: '13px', marginLeft: '16px', color: '#1e293b' }}>
      Número de Horas Semanales : Horas de Teoría ({theoryH})  Horas de Práctica ({practiceH})
     </p>
     <div style={{ marginTop: '8px', marginLeft: '16px' }}>
      <h5 style={{ fontSize: '12px', fontWeight: 700, color: '#000', margin: '4px 0' }}>Horario y Ambientes:</h5>
      <table className="data-table" style={{ width: '100%', fontSize: '12.5px', border: '1px solid #CBD5E1' }}>
       <thead>
        <tr style={{ background: '#F8FAFC' }}>
         <th style={{ border: '1px solid #CBD5E1', padding: '6px 10px', textAlign: 'center' }}>Sección</th>
         <th style={{ border: '1px solid #CBD5E1', padding: '6px 10px', textAlign: 'center' }}>Teoría (Horario / Aula)</th>
         <th style={{ border: '1px solid #CBD5E1', padding: '6px 10px', textAlign: 'center' }}>Práctica (Horario / Laboratorio)</th>
        </tr>
       </thead>
       <tbody>
        <tr>
         <td style={{ border: '1px solid #CBD5E1', padding: '6px 10px', textAlign: 'center', fontWeight: 600 }}>II - A</td>
         <td style={{ border: '1px solid #CBD5E1', padding: '6px 10px' }}>{theoryH * 2} horas semanales (Aula N° 103)</td>
         <td style={{ border: '1px solid #CBD5E1', padding: '6px 10px' }}>{practiceH * 2} horas semanales (Laboratorio de Cómputo)</td>
        </tr>
       </tbody>
      </table>
     </div>
    </div>

    <div style={{ marginBottom: '12px' }}>
     <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#000', margin: '8px 0 6px 12px' }}>1.4 Cuerpo Académico</h4>
     <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse', marginLeft: '16px' }}>
      <tbody>
       <tr><td style={{ width: '220px', padding: '3px 0', color: '#1e293b' }}>Docente de la Asignatura</td><td>: {g?.teacherName || 'Dr. Lino Martin Quispe Tincopa [COMPLETAR]'}</td></tr>
       <tr><td style={{ padding: '3px 0', color: '#1e293b' }}>Correo institucional</td><td>: {g?.teacherEmail || 'lino.quispe@unica.edu.pe [COMPLETAR]'}</td></tr>
      </tbody>
     </table>
    </div>
   </section>

   {/* II. FUNDAMENTO CURRICULAR E INSTITUCIONAL */}
   <section style={{ marginBottom: '24px' }}>
    <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#000', textTransform: 'uppercase', marginBottom: '10px' }}>II. FUNDAMENTO CURRICULAR E INSTITUCIONAL</h3>
    <div style={{ marginBottom: '12px', marginLeft: '12px' }}>
     <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#000', marginBottom: '4px' }}>2.1 MISIÓN INSTITUCIONAL</h4>
     <p style={{ fontSize: '13px', lineHeight: 1.7, color: '#1e293b' }}>
      {c.mission || g?.mission || 'Formar profesionales, con alto sentido ético, científico, humanístico y tecnológico, capaces de contribuir al desarrollo sostenible de la sociedad y al avance del conocimiento.'}
     </p>
    </div>
    <div style={{ marginBottom: '12px', marginLeft: '12px' }}>
     <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#000', marginBottom: '4px' }}>2.2 SUMILLA</h4>
     <p style={{ fontSize: '13px', lineHeight: 1.7, color: '#1e293b' }}>{d.description}</p>
    </div>
    {d.rationale && (
     <div style={{ marginBottom: '12px', marginLeft: '12px' }}>
      <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#000', marginBottom: '4px' }}>2.3 FUNDAMENTACIÓN</h4>
      <p style={{ fontSize: '13px', lineHeight: 1.7, color: '#1e293b' }}>{d.rationale}</p>
     </div>
    )}
   </section>

   {/* III. COMPETENCIAS, CAPACIDADES Y LOGROS DEL CURSO */}
   <section style={{ marginBottom: '24px' }}>
    <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#000', textTransform: 'uppercase', marginBottom: '10px' }}>III. COMPETENCIAS, CAPACIDADES Y LOGROS DEL CURSO</h3>
    
    <div style={{ marginBottom: '14px', marginLeft: '12px' }}>
     <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#000', marginBottom: '4px' }}>3.1 COMPETENCIAS</h4>
     <p style={{ fontSize: '13px', lineHeight: 1.7, color: '#1e293b' }}>{d.competency}</p>
    </div>

    <div style={{ marginBottom: '14px', marginLeft: '12px' }}>
     <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#000', marginBottom: '4px' }}>3.2 CAPACIDADES</h4>
     <List items={d.outcomes} />
    </div>

    <div style={{ marginBottom: '14px', marginLeft: '12px' }}>
     <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#000', marginBottom: '4px' }}>3.3 LOGROS DEL CURSO</h4>
     <p style={{ fontSize: '13px', lineHeight: 1.7, color: '#1e293b' }}>
      {d.generalOutcome || `Al finalizar el curso, el estudiante diseña, modela y ejecuta soluciones de ${courseTitle.toLowerCase()} aplicando metodologías actuales y estándares profesionales.`}
     </p>
    </div>
   </section>

   {/* IV. CONTENIDOS ORGANIZADOS EN UNIDADES Y SECUENCIAS DE APRENDIZAJES (TABLA OFICIAL 5 COLUMNAS) */}
   <section style={{ marginBottom: '24px' }}>
    <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#000', textTransform: 'uppercase', marginBottom: '14px' }}>IV. CONTENIDOS ORGANIZADOS EN UNIDADES Y SECUENCIAS DE APRENDIZAJES</h3>
    <div className="syllabus-units">
     {d.units.map((unit, i) => {
      const weeks = unit.weeks ?? [];
      return (
       <article className="syllabus-unit" key={i} style={{ padding: '20px', border: '1px solid #CBD5E1', borderRadius: '8px', marginBottom: '20px', background: '#FFFFFF' }}>
        <header style={{ borderBottom: '1.5px solid #000', paddingBottom: '8px', marginBottom: '12px' }}>
         <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: 800, color: '#000' }}>UNIDAD Nº {i + 1}: {unit.title.toUpperCase()}</h4>
         {unit.outcomes?.length > 0 && (
          <p style={{ fontSize: '12.5px', color: '#1e293b', margin: '6px 0 0', fontWeight: 600 }}>
           LOGRO DE LA UNIDAD: <span style={{ fontWeight: 400 }}>{unit.outcomes.join(' ')}</span>
          </p>
         )}
        </header>

        {/* TABLA DE 5 COLUMNAS POR UNIDAD */}
        <div className="table-scroll">
         <table className="data-table" style={{ width: '100%', fontSize: '11.5px', border: '1px solid #CBD5E1' }}>
          <thead>
           <tr style={{ background: '#F8FAFC' }}>
            <th style={{ border: '1px solid #CBD5E1', padding: '6px 8px', width: '60px', textAlign: 'center' }}>Nº SEMANA</th>
            <th style={{ border: '1px solid #CBD5E1', padding: '6px 10px', width: '28%' }}>CONTENIDO DE APRENDIZAJE</th>
            <th style={{ border: '1px solid #CBD5E1', padding: '6px 10px', width: '26%' }}>ACTIVIDADES DE APRENDIZAJE</th>
            <th style={{ border: '1px solid #CBD5E1', padding: '6px 10px', width: '22%' }}>EVIDENCIAS DE APRENDIZAJE</th>
            <th style={{ border: '1px solid #CBD5E1', padding: '6px 8px', width: '18%' }}>BIBLIOGRAFÍA</th>
           </tr>
          </thead>
          <tbody>
           {weeks.map((w, idx) => {
            const weekNum = Number(String(w).match(/\d+/)?.[0] || w);
            const sched = schedule.find(s => s.unit === i + 1 && s.week === weekNum) || schedule.find(s => s.week === weekNum);
            const topic = sched?.topic || unit.topics?.[idx] || `Desarrollo temático de la semana ${w}`;
            const acts = sched?.activities ?? ['Exposición dialogada sobre el tema.', 'Análisis guiado y participación en clase.'];
            const assess = sched?.assessments?.map(code => {
             const it = plan?.items?.find(item => item.code === code);
             return `Evaluación: ${code}${it ? ` — ${it.description}` : ''}`;
            }) ?? [];
            const bibRef = bib?.base?.[0] ? `Texto obligatorio: ${bib.base[0]}` : (d.bibliography?.[0] || 'Referencias del sílabo.');

            return (
             <tr key={w}>
              <td style={{ border: '1px solid #CBD5E1', padding: '6px 8px', textAlign: 'center', fontWeight: 700 }}>{w}ª</td>
              <td style={{ border: '1px solid #CBD5E1', padding: '6px 10px' }}>{topic}</td>
              <td style={{ border: '1px solid #CBD5E1', padding: '6px 10px' }}>
               <List items={acts} />
              </td>
              <td style={{ border: '1px solid #CBD5E1', padding: '6px 10px' }}>
               <p style={{ margin: '0 0 4px', fontSize: '11px' }}>Participación fundamentada en clase.</p>
               <p style={{ margin: '0 0 4px', fontSize: '11px' }}>Práctica guiada y desarrollo de actividades.</p>
               {assess.length > 0 && (
                <p style={{ margin: '4px 0 0', fontWeight: 700, color: '#1E40AF' }}>{assess.join('; ')}</p>
               )}
              </td>
              <td style={{ border: '1px solid #CBD5E1', padding: '6px 8px', fontSize: '10.5px' }}>{bibRef}</td>
             </tr>
            );
           })}
          </tbody>
         </table>
        </div>
       </article>
      );
     })}
    </div>
   </section>

   {/* V. ESTRATEGIAS METODOLÓGICAS */}
   <section style={{ marginBottom: '24px' }}>
    <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#000', textTransform: 'uppercase', marginBottom: '10px' }}>V. ESTRATEGIAS METODOLÓGICAS</h3>
    <div style={{ marginLeft: '12px', marginBottom: '10px' }}>
     <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#000', marginBottom: '4px' }}>5.1 MÉTODOS DE ENSEÑANZA</h4>
     <p style={{ fontSize: '13px', lineHeight: 1.7, color: '#1e293b' }}>
      {d.methodology || 'Método inductivo-deductivo, aprendizaje basado en problemas, proyectos aplicados y talleres prácticos de laboratorio.'}
     </p>
    </div>
    <div style={{ marginLeft: '12px' }}>
     <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#000', marginBottom: '4px' }}>5.2 MEDIOS Y MATERIALES</h4>
     <p style={{ fontSize: '13px', lineHeight: 1.7, color: '#1e293b' }}>
      <strong>5.2.1 Medios educativos:</strong> Pizarra digital, presentaciones multimedia estructuradas, lecturas académicas seleccionadas, guías de laboratorio y separatas técnicas.<br />
      <strong>5.2.2 Recursos tecnológicos:</strong> Computadora / laptop, proyector multimedia, acceso a internet, plataforma virtual institucional, entornos de desarrollo y software especializado.
     </p>
    </div>
   </section>

   {/* VI. EVALUACIÓN */}
   <section style={{ marginBottom: '24px' }}>
    <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#000', textTransform: 'uppercase', marginBottom: '10px' }}>VI. EVALUACIÓN</h3>
    
    <div style={{ marginLeft: '12px', marginBottom: '12px' }}>
     <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#000', marginBottom: '4px' }}>6.1 DESCRIPCIÓN DE LA EVALUACIÓN</h4>
     <p style={{ fontSize: '13px', lineHeight: 1.7, color: '#1e293b' }}>
      Se evaluará de acuerdo con el Reglamento General de Pre-Grado:<br /><br />
      <strong>Promedio Final = 50% (EC) + 40% (ED) + 10% (EA)</strong><br /><br />
      Dónde:<br />
      <strong>EC:</strong> Evidencia de conocimiento (Parcial I y Parcial II)<br />
      <strong>ED:</strong> Evidencia de desempeño (Habilidades, Destrezas y Prácticas de laboratorio)<br />
      <strong>EA:</strong> Evidencia actitudinal (Puntualidad, aptitud para la ejecución de tareas, empeño y trabajo en equipo).
     </p>
    </div>

    <div style={{ marginLeft: '12px' }}>
     <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#000', marginBottom: '6px' }}>6.2 CRONOGRAMA DE EVALUACIÓN</h4>
     <div className="table-scroll">
      <table className="data-table" style={{ width: '100%', fontSize: '12px', border: '1px solid #CBD5E1' }}>
       <thead>
        <tr style={{ background: '#F8FAFC' }}>
         <th style={{ border: '1px solid #CBD5E1', padding: '6px 8px', width: '50px', textAlign: 'center' }}>Nº</th>
         <th style={{ border: '1px solid #CBD5E1', padding: '6px 10px', width: '35%' }}>Fecha / Periodo</th>
         <th style={{ border: '1px solid #CBD5E1', padding: '6px 10px' }}>Semana y Actividad de Evaluación</th>
        </tr>
       </thead>
       <tbody>
        {Array.from({ length: weeksTotal }, (_, idx) => {
         const w = idx + 1;
         const mid = Math.floor(weeksTotal / 2);
         let semanaText = `Semana ${String(w).padStart(2, '0')} – Clases y desarrollo temático`;
         if (w === mid) semanaText = `Semana ${String(w).padStart(2, '0')} – EXAMEN PARCIAL I (EC1)`;
         else if (w === weeksTotal) semanaText = `Semana ${String(w).padStart(2, '0')} – EXAMEN FINAL (EC2)`;
         else if (plan?.items) {
          const matched = plan.items.filter(it => it.week === w);
          if (matched.length) {
           semanaText = `Semana ${String(w).padStart(2, '0')} – ${matched.map(it => `${it.code} (${it.description})`).join('; ')}`;
          }
         }
         return (
          <tr key={w}>
           <td style={{ border: '1px solid #CBD5E1', padding: '5px 8px', textAlign: 'center' }}>{w}</td>
           <td style={{ border: '1px solid #CBD5E1', padding: '5px 10px' }}>Semana {w} del semestre regular</td>
           <td style={{ border: '1px solid #CBD5E1', padding: '5px 10px' }}>{semanaText}</td>
          </tr>
         );
        })}
       </tbody>
      </table>
     </div>
    </div>
   </section>

   {/* VII. FUENTES DE INFORMACIÓN (BIBLIOGRAFÍA APA 7) */}
   <section style={{ marginBottom: '24px' }}>
    <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#000', textTransform: 'uppercase', marginBottom: '10px' }}>VII. FUENTES DE INFORMACIÓN</h3>
    {bib ? (
     <div style={{ marginLeft: '12px' }}>
      {bib.base.length > 0 && (
       <div style={{ marginBottom: '10px' }}>
        <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#000', marginBottom: '4px' }}>Bibliografía base / obligatoria (APA 7)</h4>
        <List items={bib.base} />
       </div>
      )}
      {bib.complementary.length > 0 && (
       <div>
        <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#000', marginBottom: '4px' }}>Bibliografía complementaria (APA 7)</h4>
        <List items={bib.complementary} />
       </div>
      )}
     </div>
    ) : (
     <div style={{ marginLeft: '12px' }}><List items={d.bibliography} /></div>
    )}
   </section>

   {/* BLOQUE DE FIRMAS INSTITUCIONALES (OFICIAL UNICA) */}
   <section style={{ marginTop: '48px', marginBottom: '24px', paddingTop: '24px' }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '48px', textAlign: 'center', marginTop: '36px' }}>
     <div style={{ borderTop: '1px solid #64748B', paddingTop: '12px' }}>
      <p style={{ margin: 0, fontWeight: 700, fontSize: '13px', color: '#0F172A' }}>Dr. Lino Martin Quispe Tincopa</p>
      <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748B' }}>Director del Departamento Académico<br />Facultad de Ingeniería de Sistemas<br />DNI 21564811</p>
     </div>
     <div style={{ borderTop: '1px solid #64748B', paddingTop: '12px' }}>
      <p style={{ margin: 0, fontWeight: 700, fontSize: '13px', color: '#0F172A' }}>Docente de la Asignatura</p>
      <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748B' }}>Nombre: [COMPLETAR]<br />DNI: [COMPLETAR]<br />(Firma y Sello)</p>
     </div>
    </div>
   </section>

   {/* CONTROL DE CAMBIOS Y CAMPOS PENDIENTES (AUDITORÍA SUNEDU) */}
   {((d.changesSummary && d.changesSummary.length > 0) || (d.pendingFields && d.pendingFields.length > 0) || (d.verificationNotes && d.verificationNotes.length > 0)) && (
    <section style={{ marginTop: '36px', padding: '20px', background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px' }}>
     <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A', textTransform: 'uppercase', marginBottom: '12px' }}>📋 Control de Cambios y Campos Pendientes (Auditoría SUNEDU)</h3>
     {d.changesSummary && d.changesSummary.length > 0 && (
      <div style={{ marginBottom: '12px' }}>
       <h4 style={{ fontSize: '12px', fontWeight: 700, color: '#166534', margin: '4px 0' }}>✓ Mejoras y correcciones respecto al sílabo base:</h4>
       <List items={d.changesSummary} />
      </div>
     )}
     {d.pendingFields && d.pendingFields.length > 0 && (
      <div style={{ marginBottom: '12px' }}>
       <h4 style={{ fontSize: '12px', fontWeight: 700, color: '#9A3412', margin: '4px 0' }}>⚠️ Campos por completar por el docente [COMPLETAR]:</h4>
       <List items={d.pendingFields} />
      </div>
     )}
     {d.verificationNotes && d.verificationNotes.length > 0 && (
      <div>
       <h4 style={{ fontSize: '12px', fontWeight: 700, color: '#1E40AF', margin: '4px 0' }}>ℹ️ Referencias o aspectos por verificar [VERIFICAR]:</h4>
       <List items={d.verificationNotes} />
      </div>
     )}
    </section>
   )}
  </div>
 );
}
