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
    institution?: string;
    courseCode?: string;
    careers?: string[];
    modality?: string;
    weeklyHours?: number;
    term?: string;
    nature?: string;
    prerequisites?: string;
    teacherName?: string;
    teacherEmail?: string;
    teacherDni?: string;
    mission?: string;
    chronologicalPeriod?: string;
    theoryHours?: number;
    practiceHours?: number;
    condition?: string;
    timetable?: { section: string; theorySchedule: string; theoryRoom: string; practiceSchedule: string; practiceRoom: string }[];
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
  signatureDate?: string;
};

const List = ({ items }: { items: string[] }) => (
  <ul style={{ paddingLeft: '24px', margin: '6px 0', color: '#000000', fontSize: '15px', lineHeight: '1.5', textAlign: 'justify' }}>
    {items.map((item, i) => (
      <li key={i} style={{ marginBottom: '5px', color: '#000000' }}>{item}</li>
    ))}
  </ul>
);

/**
 * Genera el rango de fechas lunes-viernes para una semana dada,
 * siguiendo el formato de la UNICA (ejemplo de referencia):
 * "Del 7 al 11 de setiembre de 2026", "Del 28 de set. al 2 de oct. de 2026"
 */
function getWeekDateRange(weekIndex: number, periodStr?: string): string {
  let start = new Date(2026, 8, 7); // 7 de setiembre de 2026 por defecto (lunes)
  if (periodStr) {
    const match = periodStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const year = parseInt(match[3], 10);
      const parsed = new Date(year, month, day);
      if (!isNaN(parsed.getTime())) start = parsed;
    }
  }

  const monday = new Date(start.getTime() + (weekIndex - 1) * 7 * 24 * 60 * 60 * 1000);
  const friday = new Date(monday.getTime() + 4 * 24 * 60 * 60 * 1000);

  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'];
  const monthsShort = ['ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'set.', 'oct.', 'nov.', 'dic.'];

  const mMonth = monday.getMonth();
  const fMonth = friday.getMonth();
  const year = friday.getFullYear();

  if (mMonth === fMonth) {
    return `Del ${monday.getDate()} al ${friday.getDate()} de ${months[mMonth]} de ${year}`;
  } else {
    return `Del ${monday.getDate()} de ${monthsShort[mMonth]} al ${friday.getDate()} de ${monthsShort[fMonth]} de ${year}`;
  }
}

export default function SyllabusView({ data }: { data: Record<string, Value> }) {
  const d = data as unknown as Syllabus;
  const c = (data.coverPage as Record<string, string>) || {};
  const g = d.generalData;
  const plan = d.evaluationPlan;
  const bib = d.bibliographyDetails;

  const institution = c.institution || g?.institution;
  const faculty = c.faculty || (g?.careers?.length ? `FACULTAD DE ${g.careers[0].toUpperCase()}` : '');
  const department = c.department || '';
  const courseTitle = c.course || d.course || (data.title as string);
  const semester = c.semester || g?.term || d.cycle || 'II';
  const year = c.year || '2026 – I';
  const location = c.location || 'ICA-PERÚ';
  const chronoPeriod = g?.chronologicalPeriod || 'Del 07/09/2026 al 11/12/2026';

  const weeksTotal = d.schedule?.length ? Math.max(...d.schedule.map(r => Number(r.week) || 1)) : 14;
  const weeklyTotal = g?.weeklyHours || 4;
  const theoryH = g?.theoryHours ?? Math.max(1, Math.round(weeklyTotal * 0.5));
  const practiceH = g?.practiceHours ?? Math.max(0, weeklyTotal - theoryH);
  // Horario del documento base; sin datos, una fila en blanco como en el formato impreso de la UNICA.
  const timetable = g?.timetable?.length
    ? g.timetable.map(r => [r.section, r.theorySchedule, r.theoryRoom, r.practiceSchedule, r.practiceRoom].map(v => String(v ?? '')))
    : [[`${String(d.cycle || c.semester || '').replace(/\s*SEMESTRE\s*/i, '').trim() || 'I'} - A`, '', '', '', '']];

  const schedule = [...(d.schedule ?? [])].sort((a, b) => a.week - b.week || a.session - b.session);

  return (
    <div
      className="syllabus-document"
      style={{
        background: '#FFFFFF',
        padding: '72px 90px',
        maxWidth: '980px',
        margin: '0 auto',
        borderRadius: '6px',
        border: '1.5px solid #000000',
        color: '#000000',
        fontFamily: 'Arial, sans-serif',
        lineHeight: 1.6,
        boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
      }}
    >
      {/* PORTADA INSTITUCIONAL */}
      {institution && (
        <header
          className="syllabus-cover-preview card"
          style={{
            textAlign: 'center',
            minHeight: '840px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '56px 40px',
            marginBottom: '44px',
            background: '#FFFFFF',
            border: '2px solid #000000',
            borderRadius: '4px',
            color: '#000000',
          }}
        >
          <div>
            <h2 style={{ fontSize: '21px', fontWeight: 800, color: '#000000', marginBottom: '8px', letterSpacing: '0.5px' }}>
              {institution.toUpperCase()}
            </h2>
            {faculty && <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#000000', marginBottom: '6px' }}>{faculty.toUpperCase()}</h3>}
            {department && <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#000000', marginBottom: '24px' }}>{department.toUpperCase()}</h4>}
          </div>
          {(
            <div style={{ margin: '20px auto', display: 'flex', justifyContent: 'center' }}>
              <img
                src={c.logoBase64 ? `data:image/png;base64,${c.logoBase64}` : "/unica-logo.png"}
                alt="Escudo institucional"
                style={{ maxHeight: '150px', maxWidth: '170px', objectFit: 'contain' }}
              />
            </div>
          )}
          <div>
            <div style={{ marginBottom: '12px', fontSize: '16px', fontWeight: 700, color: '#000000', letterSpacing: '0.5px' }}>
              SILABO DE LA ASIGNATURA DE:
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: '#000000', marginBottom: '16px', letterSpacing: '0.3px' }}>
              {courseTitle.toUpperCase()}
            </div>
          </div>
          <div>
            {semester && <div style={{ fontSize: '16px', fontWeight: 700, color: '#000000', marginBottom: '6px' }}>{semester.toUpperCase()}</div>}
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#000000', marginBottom: '28px' }}>{year}</div>
            <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#000000', letterSpacing: '1px' }}>{location.toUpperCase()}</div>
          </div>
        </header>
      )}

      {/* ENCABEZADO INSTITUCIONAL DE HOJAS SIGUIENTES (MODELO UNICA) */}
      {institution && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', paddingBottom: '16px', marginBottom: '32px', borderBottom: '2px solid #000000' }}>
          {(
            <img src={c.logoBase64 ? `data:image/png;base64,${c.logoBase64}` : "/unica-logo.png"} alt="Escudo" style={{ height: '60px', width: '60px', objectFit: 'contain' }} />
          )}
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '15px', fontWeight: 800, color: '#000000', letterSpacing: '0.3px' }}>{institution.toUpperCase()}</div>
            {faculty && <div style={{ fontSize: '14px', fontWeight: 700, color: '#000000' }}>{faculty.toUpperCase()}</div>}
            {department && <div style={{ fontSize: '13px', fontWeight: 700, color: '#000000' }}>{department.toUpperCase()}</div>}
            <div style={{ fontSize: '15px', fontWeight: 800, color: '#000000', marginTop: '6px', letterSpacing: '1px' }}>SÍLABO</div>
          </div>
        </div>
      )}

      {/* I. INFORMACIÓN GENERAL Y DATOS DEL CURSO */}
      <section style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '16.5px', fontWeight: 800, color: '#000000', textTransform: 'uppercase', marginBottom: '16px' }}>
          I. INFORMACIÓN GENERAL Y DATOS DEL CURSO
        </h3>

        <div style={{ marginBottom: '16px' }}>
          <h4 style={{ fontSize: '15.5px', fontWeight: 700, color: '#000000', margin: '8px 0 6px 12px' }}>1.1 Datos Curriculares</h4>
          <table style={{ width: '100%', fontSize: '15px', borderCollapse: 'collapse', marginLeft: '16px', color: '#000000' }}>
            <tbody>
              <tr><td style={{ width: '240px', padding: '4px 0' }}>Nombre del Curso</td><td>: <strong>{courseTitle}</strong></td></tr>
              {g?.courseCode && <tr><td style={{ padding: '4px 0' }}>Código</td><td>: {g.courseCode}</td></tr>}
              <tr><td style={{ padding: '4px 0' }}>Créditos Académicos</td><td>: {String(d.credits || 4).padStart(2, '0')}</td></tr>
              <tr><td style={{ padding: '4px 0' }}>Condición</td><td>: {g?.condition || 'Obligatorio'}</td></tr>
              <tr><td style={{ padding: '4px 0' }}>Área de estudio</td><td>: {g?.nature || (g?.careers?.length ? g.careers[0] : 'Teórico-Práctica')}</td></tr>
            </tbody>
          </table>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <h4 style={{ fontSize: '15.5px', fontWeight: 700, color: '#000000', margin: '8px 0 6px 12px' }}>1.2 Datos del Periodo Académico</h4>
          <table style={{ width: '100%', fontSize: '15px', borderCollapse: 'collapse', marginLeft: '16px', color: '#000000' }}>
            <tbody>
              <tr><td style={{ width: '240px', padding: '4px 0' }}>Periodo Académico</td><td>: {g?.term || c.year || '2026-I'}</td></tr>
              <tr><td style={{ padding: '4px 0' }}>Semestre Académico</td><td>: {d.cycle || c.semester || 'II'}</td></tr>
              <tr><td style={{ padding: '4px 0' }}>Periodo Cronológico</td><td>: {chronoPeriod}</td></tr>
              <tr><td style={{ padding: '4px 0' }}>Duración</td><td>: {weeksTotal} semanas</td></tr>
              <tr><td style={{ padding: '4px 0' }}>Modalidad</td><td>: {g?.modality || 'Presencial'}</td></tr>
              {g?.prerequisites && <tr><td style={{ padding: '4px 0' }}>Prerrequisitos</td><td>: {g.prerequisites}</td></tr>}
            </tbody>
          </table>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <h4 style={{ fontSize: '15.5px', fontWeight: 700, color: '#000000', margin: '8px 0 6px 12px' }}>1.3 Carga Horaria</h4>
          <p style={{ fontSize: '15px', marginLeft: '16px', color: '#000000', margin: '4px 0 8px 16px' }}>
            Número de Horas Semanales : Horas de Teoría ({theoryH})  Horas de Práctica ({practiceH})
          </p>
          <div style={{ marginTop: '12px' }}>
            <h5 style={{ fontSize: '15px', fontWeight: 700, color: '#000000', margin: '8px 0 8px 16px' }}>Distribución de Horario y Ambientes</h5>
            {/* TABLA DE HORARIO CENTRADA */}
            <div style={{ display: 'flex', justifyContent: 'center', margin: '10px 0' }}>
              <table
                style={{
                  width: 'auto',
                  minWidth: '600px',
                  maxWidth: '780px',
                  fontSize: '13.5px',
                  border: '1.5px solid #000000',
                  borderCollapse: 'collapse',
                  color: '#000000',
                }}
              >
                <thead>
                  <tr style={{ background: '#FFFFFF' }}>
                    <th rowSpan={2} style={{ border: '1px solid #000000', padding: '7px 12px', textAlign: 'center', verticalAlign: 'middle', fontWeight: 800 }}>
                      Sección
                    </th>
                    <th colSpan={2} style={{ border: '1px solid #000000', padding: '7px 12px', textAlign: 'center', fontWeight: 800 }}>
                      Teoría
                    </th>
                    <th colSpan={2} style={{ border: '1px solid #000000', padding: '7px 12px', textAlign: 'center', fontWeight: 800 }}>
                      Práctica
                    </th>
                  </tr>
                  <tr style={{ background: '#FFFFFF' }}>
                    <th style={{ border: '1px solid #000000', padding: '6px 12px', textAlign: 'center', fontWeight: 700 }}>Horario</th>
                    <th style={{ border: '1px solid #000000', padding: '6px 12px', textAlign: 'center', fontWeight: 700 }}>Lugar</th>
                    <th style={{ border: '1px solid #000000', padding: '6px 12px', textAlign: 'center', fontWeight: 700 }}>Horario</th>
                    <th style={{ border: '1px solid #000000', padding: '6px 12px', textAlign: 'center', fontWeight: 700 }}>Lugar</th>
                  </tr>
                </thead>
                <tbody>
                  {timetable.map((row, r) => (
                    <tr key={r}>
                      {row.map((cell, k) => (
                        <td key={k} style={{ border: '1px solid #000000', padding: '6px 12px', textAlign: 'center', fontWeight: k === 0 ? 700 : 400, height: '28px' }}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {(g?.teacherName || g?.teacherEmail) && (
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ fontSize: '15.5px', fontWeight: 700, color: '#000000', margin: '8px 0 6px 12px' }}>1.4 Cuerpo Académico</h4>
            <table style={{ width: '100%', fontSize: '15px', borderCollapse: 'collapse', marginLeft: '16px', color: '#000000' }}>
              <tbody>
                {g?.teacherName && <tr><td style={{ width: '240px', padding: '4px 0' }}>Docente de la Asignatura</td><td>: {g.teacherName}</td></tr>}
                {g?.teacherEmail && <tr><td style={{ padding: '4px 0' }}>Correo institucional</td><td>: {g.teacherEmail}</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* II. FUNDAMENTO CURRICULAR E INSTITUCIONAL */}
      <section style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '16.5px', fontWeight: 800, color: '#000000', textTransform: 'uppercase', marginBottom: '14px' }}>
          II. FUNDAMENTO CURRICULAR E INSTITUCIONAL
        </h3>
        <div style={{ marginBottom: '16px', marginLeft: '12px' }}>
          <h4 style={{ fontSize: '15.5px', fontWeight: 700, color: '#000000', marginBottom: '6px' }}>2.1 MISIÓN INSTITUCIONAL</h4>
          <p style={{ fontSize: '15px', lineHeight: 1.5, textAlign: 'justify', color: '#000000', margin: 0 }}>
            {c.mission || g?.mission || 'Formar profesionales, con alto sentido ético, científico, humanístico y tecnológico, capaces de contribuir al desarrollo sostenible de la sociedad y al avance del conocimiento.'}
          </p>
        </div>
        <div style={{ marginBottom: '16px', marginLeft: '12px' }}>
          <h4 style={{ fontSize: '15.5px', fontWeight: 700, color: '#000000', marginBottom: '6px' }}>2.2 SUMILLA</h4>
          <p style={{ fontSize: '15px', lineHeight: 1.5, textAlign: 'justify', color: '#000000', margin: 0 }}>{d.description}</p>
        </div>
        {d.rationale && (
          <div style={{ marginBottom: '16px', marginLeft: '12px' }}>
            <h4 style={{ fontSize: '15.5px', fontWeight: 700, color: '#000000', marginBottom: '6px' }}>2.3 FUNDAMENTACIÓN</h4>
            <p style={{ fontSize: '15px', lineHeight: 1.5, textAlign: 'justify', color: '#000000', margin: 0 }}>{d.rationale}</p>
          </div>
        )}
      </section>

      {/* III. COMPETENCIAS, CAPACIDADES Y LOGROS DEL CURSO */}
      <section style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '16.5px', fontWeight: 800, color: '#000000', textTransform: 'uppercase', marginBottom: '14px' }}>
          III. COMPETENCIAS, CAPACIDADES Y LOGROS DEL CURSO
        </h3>

        <div style={{ marginBottom: '16px', marginLeft: '12px' }}>
          <h4 style={{ fontSize: '15.5px', fontWeight: 700, color: '#000000', marginBottom: '6px' }}>3.1 COMPETENCIAS</h4>
          <p style={{ fontSize: '15px', lineHeight: 1.5, textAlign: 'justify', color: '#000000', margin: 0 }}>{d.competency}</p>
        </div>

        <div style={{ marginBottom: '16px', marginLeft: '12px' }}>
          <h4 style={{ fontSize: '15.5px', fontWeight: 700, color: '#000000', marginBottom: '6px' }}>3.2 CAPACIDADES</h4>
          <List items={d.outcomes} />
        </div>

        <div style={{ marginBottom: '16px', marginLeft: '12px' }}>
          <h4 style={{ fontSize: '15.5px', fontWeight: 700, color: '#000000', marginBottom: '6px' }}>3.3 LOGROS DEL CURSO</h4>
          <p style={{ fontSize: '15px', lineHeight: 1.5, textAlign: 'justify', color: '#000000', margin: 0 }}>
            {d.generalOutcome || `Al finalizar el curso, el estudiante diseña, modela y ejecuta soluciones de ${courseTitle.toLowerCase()} aplicando metodologías actuales y estándares profesionales.`}
          </p>
        </div>
      </section>

      {/* IV. CONTENIDOS ORGANIZADOS EN UNIDADES Y SECUENCIAS DE APRENDIZAJES */}
      <section style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '16.5px', fontWeight: 800, color: '#000000', textTransform: 'uppercase', marginBottom: '16px' }}>
          IV. CONTENIDOS ORGANIZADOS EN UNIDADES Y SECUENCIAS DE APRENDIZAJES
        </h3>
        <div className="syllabus-units">
          {d.units.map((unit, i) => {
            const weeks = unit.weeks ?? [];
            return (
              <div key={i} style={{ marginBottom: '26px' }}>
                <table
                  style={{
                    width: '100%',
                    fontSize: '13.5px',
                    border: '1.5px solid #000000',
                    borderCollapse: 'collapse',
                    color: '#000000',
                  }}
                >
                  <thead>
                    {/* ENCABEZADO DE UNIDAD */}
                    <tr>
                      <th
                        colSpan={5}
                        style={{
                          border: '1px solid #000000',
                          padding: '9px 12px',
                          textAlign: 'left',
                          fontWeight: 800,
                          fontSize: '14.5px',
                          color: '#000000',
                          background: '#FFFFFF',
                        }}
                      >
                        UNIDAD Nº {i + 1}: {unit.title.toUpperCase()}
                      </th>
                    </tr>
                    {/* LOGRO DE LA UNIDAD */}
                    {unit.outcomes?.length > 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          style={{
                            border: '1px solid #000000',
                            padding: '9px 12px',
                            textAlign: 'left',
                            fontSize: '14px',
                            lineHeight: 1.6,
                            color: '#000000',
                            background: '#FFFFFF',
                          }}
                        >
                          <strong>LOGRO DE LA UNIDAD:</strong> {unit.outcomes.join(' ')}
                        </td>
                      </tr>
                    )}
                    {/* ENCABEZADOS DE LAS 5 COLUMNAS */}
                    <tr style={{ background: '#FFFFFF' }}>
                      <th style={{ border: '1px solid #000000', padding: '7px 8px', width: '7%', textAlign: 'center', fontWeight: 800, fontSize: '13px' }}>
                        Nº SEMANA
                      </th>
                      <th style={{ border: '1px solid #000000', padding: '7px 10px', width: '24%', textAlign: 'left', fontWeight: 800, fontSize: '13px' }}>
                        CONTENIDO DE APRENDIZAJE
                      </th>
                      <th style={{ border: '1px solid #000000', padding: '7px 10px', width: '24%', textAlign: 'left', fontWeight: 800, fontSize: '13px' }}>
                        ACTIVIDADES DE APRENDIZAJE
                      </th>
                      <th style={{ border: '1px solid #000000', padding: '7px 10px', width: '19%', textAlign: 'left', fontWeight: 800, fontSize: '13px' }}>
                        EVIDENCIAS DE APRENDIZAJE
                      </th>
                      <th style={{ border: '1px solid #000000', padding: '7px 10px', width: '26%', textAlign: 'left', fontWeight: 800, fontSize: '13px', whiteSpace: 'nowrap' }}>
                        BIBLIOGRAFÍA
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {weeks.map((w, idx) => {
                      const weekNum = Number(String(w).match(/\d+/)?.[0] || w);
                      const sched = schedule.find(s => s.unit === i + 1 && s.week === weekNum) || schedule.find(s => s.week === weekNum);
                      const topic = sched?.topic || unit.topics?.[idx] || `Desarrollo temático de la semana ${w}`;
                      const acts = sched?.activities ?? [
                        'Presentación dialogada del tema y resolución de casos.',
                        'Análisis guiado sobre aplicaciones prácticas en clase.',
                      ];
                      const assess = sched?.assessments?.map(code => {
                        const it = plan?.items?.find(item => item.code === code);
                        return `Evaluación: ${code}${it ? ` — ${it.description}` : ''}`;
                      }) ?? [];
                      const bibRef = bib?.base?.[0]
                        ? `Texto obligatorio: ${bib.base[0]}`
                        : (d.bibliography?.[0] ? `Texto obligatorio: ${d.bibliography[0]}` : 'Texto obligatorio: Referencias del sílabo.');
                      const bibOpt = bib?.complementary?.[0]
                        ? `Texto opcional: ${bib.complementary[0]}`
                        : (d.bibliography?.[1] ? `Texto opcional: ${d.bibliography[1]}` : null);

                      return (
                        <tr key={w}>
                          <td style={{ border: '1px solid #000000', padding: '8px 6px', textAlign: 'center', fontWeight: 700, fontSize: '13.5px' }}>
                            {w}ª
                          </td>
                          <td style={{ border: '1px solid #000000', padding: '8px 10px', fontSize: '13.5px', lineHeight: 1.55 }}>
                            {topic}
                          </td>
                          <td style={{ border: '1px solid #000000', padding: '8px 10px', fontSize: '13.5px', lineHeight: 1.55 }}>
                            <ul style={{ margin: 0, paddingLeft: '16px' }}>
                              {acts.map((act, aIdx) => (
                                <li key={aIdx} style={{ marginBottom: '4px' }}>{act}</li>
                              ))}
                            </ul>
                          </td>
                          <td style={{ border: '1px solid #000000', padding: '8px 10px', fontSize: '13.5px', lineHeight: 1.55 }}>
                            <p style={{ margin: '0 0 4px' }}>Participación fundamentada en clase.</p>
                            <p style={{ margin: '0 0 4px' }}>Práctica guiada y desarrollo de actividades.</p>
                            {assess.length > 0 && (
                              <p style={{ margin: '4px 0 0', fontWeight: 700, color: '#000000' }}>{assess.join('; ')}</p>
                            )}
                          </td>
                          <td style={{ border: '1px solid #000000', padding: '8px 10px', fontSize: '13px', lineHeight: 1.5 }}>
                            <div style={{ marginBottom: bibOpt ? '6px' : '0' }}>{bibRef}</div>
                            {bibOpt && <div>{bibOpt}</div>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      </section>

      {/* V. ESTRATEGIAS METODOLÓGICAS */}
      <section style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '16.5px', fontWeight: 800, color: '#000000', textTransform: 'uppercase', marginBottom: '14px' }}>
          V. ESTRATEGIAS METODOLÓGICAS
        </h3>
        <div style={{ marginLeft: '12px', marginBottom: '14px' }}>
          <h4 style={{ fontSize: '15.5px', fontWeight: 700, color: '#000000', marginBottom: '6px' }}>5.1 MÉTODOS DE ENSEÑANZA</h4>
          <p style={{ fontSize: '15px', lineHeight: 1.5, textAlign: 'justify', color: '#000000', margin: 0 }}>
            {d.methodology || 'Método inductivo-deductivo, aprendizaje basado en problemas, proyectos aplicados y talleres prácticos de laboratorio.'}
          </p>
        </div>
        <div style={{ marginLeft: '12px' }}>
          <h4 style={{ fontSize: '15.5px', fontWeight: 700, color: '#000000', marginBottom: '6px' }}>5.2 MEDIOS Y MATERIALES</h4>
          <p style={{ fontSize: '15px', lineHeight: 1.5, textAlign: 'justify', color: '#000000', margin: 0 }}>
            <strong>5.2.1 Medios educativos:</strong> Pizarra digital, presentaciones multimedia estructuradas, lecturas académicas seleccionadas, guías de laboratorio y separatas técnicas.<br />
            <strong>5.2.2 Recursos tecnológicos:</strong> Computadora / laptop, proyector multimedia, acceso a internet, plataforma virtual institucional, entornos de desarrollo y software especializado.
          </p>
        </div>
      </section>

      {/* VI. EVALUACIÓN */}
      <section style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '16.5px', fontWeight: 800, color: '#000000', textTransform: 'uppercase', marginBottom: '14px' }}>
          VI. EVALUACIÓN
        </h3>

        <div style={{ marginLeft: '12px', marginBottom: '18px' }}>
          <h4 style={{ fontSize: '15.5px', fontWeight: 700, color: '#000000', marginBottom: '6px' }}>6.1 DESCRIPCIÓN DE LA EVALUACIÓN</h4>
          <p style={{ fontSize: '15px', lineHeight: 1.5, textAlign: 'justify', color: '#000000', margin: 0 }}>
            Se evaluará de acuerdo con el Reglamento General de Pre-Grado:
          </p>

          {/* FÓRMULA DE EVALUACIÓN CENTRADA */}
          <div style={{ display: 'flex', justifyContent: 'center', margin: '18px 0' }}>
            <div
              style={{
                padding: '12px 32px',
                border: '1.5px solid #000000',
                borderRadius: '4px',
                fontWeight: 800,
                fontSize: '15.5px',
                color: '#000000',
                background: '#FFFFFF',
                textAlign: 'center',
                letterSpacing: '0.4px',
              }}
            >
              Promedio Final = 50% (EC) + 40% (ED) + 10% (EA)
            </div>
          </div>

          <p style={{ fontSize: '15px', lineHeight: 1.75, color: '#000000', margin: '10px 0 0' }}>
            Dónde:<br />
            <strong>EC:</strong> Evidencia de conocimiento (Parcial I y Parcial II)<br />
            <strong>ED:</strong> Evidencia de desempeño (Habilidades, Destrezas y Prácticas de laboratorio)<br />
            <strong>EA:</strong> Evidencia actitudinal (Puntualidad, aptitud para la ejecución de tareas, empeño y trabajo en equipo).
          </p>
        </div>

        {/* 6.2 CRONOGRAMA DE EVALUACIÓN (COLUMNAS APEGADAS Y TABLA CENTRADA) */}
        <div style={{ marginLeft: '12px' }}>
          <h4 style={{ fontSize: '15.5px', fontWeight: 700, color: '#000000', marginBottom: '10px' }}>6.2 CRONOGRAMA DE EVALUACIÓN</h4>

          {/* CENTRADO DE LA TABLA */}
          <div style={{ display: 'flex', justifyContent: 'center', margin: '14px 0' }}>
            <table
              style={{
                width: 'auto',
                border: '1.5px solid #000000',
                borderCollapse: 'collapse',
                color: '#000000',
                fontSize: '13.5px',
                tableLayout: 'auto',
              }}
            >
              <thead>
                <tr style={{ background: '#FFFFFF' }}>
                  <th style={{ border: '1px solid #000000', padding: '6px 10px', width: '42px', textAlign: 'center', fontWeight: 800 }}>
                    No
                  </th>
                  <th style={{ border: '1px solid #000000', padding: '6px 14px', textAlign: 'left', fontWeight: 800, whiteSpace: 'nowrap' }}>
                    Fecha
                  </th>
                  <th style={{ border: '1px solid #000000', padding: '6px 14px', textAlign: 'left', fontWeight: 800, whiteSpace: 'nowrap' }}>
                    Semana
                  </th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: weeksTotal }, (_, idx) => {
                  const w = idx + 1;
                  const mid = Math.floor(weeksTotal / 2);
                  const dateStr = getWeekDateRange(w, chronoPeriod);

                  // The plan's evidences (with their weight) come first; without them, the usual midterm/final weeks.
                  const matched = plan?.items?.filter(it => Number(it.week) === w) ?? [];
                  const label = matched.length
                    ? matched.map(it => `${it.code} – ${it.description} (${it.weight} %)`).join('; ')
                    : !plan?.items?.length && w === mid ? 'EXAMEN PARCIAL' : !plan?.items?.length && w === weeksTotal ? 'EXAMEN FINAL' : 'Clases';
                  const semanaText = `Semana ${String(w).padStart(2, '0')} – ${label}`;

                  return (
                    <tr key={w}>
                      <td style={{ border: '1px solid #000000', padding: '5px 10px', textAlign: 'center', fontWeight: 600 }}>
                        {w}
                      </td>
                      <td style={{ border: '1px solid #000000', padding: '5px 14px', textAlign: 'left', whiteSpace: 'nowrap' }}>
                        {dateStr}
                      </td>
                      <td style={{ border: '1px solid #000000', padding: '5px 14px', textAlign: 'left', whiteSpace: 'nowrap' }}>
                        {semanaText}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* VII. FUENTES DE INFORMACIÓN (BIBLIOGRAFÍA APA 7) */}
      <section style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '16.5px', fontWeight: 800, color: '#000000', textTransform: 'uppercase', marginBottom: '14px' }}>
          VII. FUENTES DE INFORMACIÓN
        </h3>
        {bib ? (
          <div style={{ marginLeft: '12px' }}>
            {bib.base.length > 0 && (
              <div style={{ marginBottom: '14px' }}>
                <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#000000', marginBottom: '6px' }}>
                  Bibliografía base / obligatoria (APA 7)
                </h4>
                <List items={bib.base} />
              </div>
            )}
            {bib.complementary.length > 0 && (
              <div>
                <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#000000', marginBottom: '6px' }}>
                  Bibliografía complementaria (APA 7)
                </h4>
                <List items={bib.complementary} />
              </div>
            )}
          </div>
        ) : (
          <div style={{ marginLeft: '12px' }}>
            <List items={d.bibliography} />
          </div>
        )}
      </section>

      {/* VIII. CRONOGRAMA DE ACTIVIDADES (CENTRADO Y BORDES NEGROS SÓLIDOS) */}
      {schedule.length > 0 && (
        <section style={{ marginBottom: '32px' }}>
          <h3 style={{ fontSize: '16.5px', fontWeight: 800, color: '#000000', textTransform: 'uppercase', marginBottom: '14px' }}>
            VIII. CRONOGRAMA DE ACTIVIDADES
          </h3>
          <div style={{ overflowX: 'auto', display: 'flex', justifyContent: 'center', margin: '12px 0' }}>
            <table
              style={{
                width: '100%',
                border: '1.5px solid #000000',
                borderCollapse: 'collapse',
                fontSize: '13.5px',
                color: '#000000',
              }}
            >
              <thead>
                <tr style={{ background: '#FFFFFF' }}>
                  <th style={{ border: '1px solid #000000', padding: '7px 8px', width: '85px', textAlign: 'center', fontWeight: 800 }}>
                    Unidad
                  </th>
                  <th style={{ border: '1px solid #000000', padding: '7px 8px', width: '80px', textAlign: 'center', fontWeight: 800 }}>
                    Semana
                  </th>
                  <th style={{ border: '1px solid #000000', padding: '7px 8px', width: '80px', textAlign: 'center', fontWeight: 800 }}>
                    Sesión
                  </th>
                  <th style={{ border: '1px solid #000000', padding: '7px 12px', width: '38%', textAlign: 'left', fontWeight: 800 }}>
                    Tema específico
                  </th>
                  <th style={{ border: '1px solid #000000', padding: '7px 12px', textAlign: 'left', fontWeight: 800 }}>
                    Actividades y evaluaciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((row, idx) => {
                  // One merged cell per unit (and per week when it has several sessions).
                  const firstOfUnit = idx === 0 || schedule[idx - 1].unit !== row.unit;
                  const unitSpan = firstOfUnit ? schedule.slice(idx).findIndex(r => r.unit !== row.unit) : 0;
                  const firstOfWeek = firstOfUnit || schedule[idx - 1].week !== row.week;
                  const weekSpan = firstOfWeek ? schedule.slice(idx).findIndex((r, k) => r.week !== row.week || (k > 0 && r.unit !== row.unit)) : 0;
                  const acts = row.activities ?? [];
                  const assess = row.assessments?.map(code => {
                    const it = plan?.items?.find(item => item.code === code);
                    return `Evaluación: ${code}${it ? ` — ${it.description}` : ''}`;
                  }) ?? [];
                  return (
                    <tr key={idx}>
                      {firstOfUnit && (
                        <td rowSpan={unitSpan < 0 ? schedule.length - idx : unitSpan} style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'center', verticalAlign: 'middle', fontWeight: 800, background: '#F8FAFC' }}>
                          Unidad {row.unit}
                        </td>
                      )}
                      {firstOfWeek && (
                        <td rowSpan={weekSpan < 0 ? schedule.length - idx : weekSpan} style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'center', verticalAlign: 'middle' }}>
                          {row.week}
                        </td>
                      )}
                      <td style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'center' }}>
                        {row.session}
                      </td>
                      <td style={{ border: '1px solid #000000', padding: '6px 12px', lineHeight: 1.5 }}>
                        {row.topic}
                      </td>
                      <td style={{ border: '1px solid #000000', padding: '6px 12px', lineHeight: 1.5 }}>
                        <ul style={{ margin: 0, paddingLeft: '16px' }}>
                          {acts.map((act, aIdx) => (
                            <li key={aIdx} style={{ marginBottom: '3px' }}>{act}</li>
                          ))}
                          {assess.map((as, asIdx) => (
                            <li key={`as-${asIdx}`} style={{ fontWeight: 700, color: '#000000' }}>{as}</li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* BLOQUE DE FIRMAS (LIBRE, SIN CUADROS) */}
      <section style={{ marginTop: '54px', marginBottom: '32px' }}>
        <div style={{ textAlign: 'right', fontWeight: 700, fontSize: '15px', color: '#000000', marginBottom: '44px' }}>
          {c.date || d.signatureDate || '03 de setiembre del 2026'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', textAlign: 'center' }}>
          <div>
            <div style={{ color: '#000000', letterSpacing: '2px', marginBottom: '8px', fontSize: '14px' }}>
              ................................................................
            </div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '15px', color: '#000000' }}>
              Director del Departamento Académico
            </p>
          </div>
          <div>
            <div style={{ color: '#000000', letterSpacing: '2px', marginBottom: '8px', fontSize: '14px' }}>
              ................................................................
            </div>
            {g?.teacherName && (
              <p style={{ margin: 0, fontWeight: 700, fontSize: '15px', color: '#000000' }}>
                {g.teacherName}
              </p>
            )}
            <p style={{ margin: '4px 0 0', fontWeight: 700, fontSize: '14px', color: '#000000' }}>
              Docente de la Asignatura
            </p>
            {g?.teacherDni && (
              <p style={{ margin: '4px 0 0', fontWeight: 700, fontSize: '14px', color: '#000000' }}>
                {String(g.teacherDni).startsWith('DNI') ? String(g.teacherDni) : `DNI ${g.teacherDni}`}
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
