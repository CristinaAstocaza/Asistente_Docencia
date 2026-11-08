import { Document,Footer,HeadingLevel,Packer,Paragraph,TextRun,Table,TableRow,TableCell,WidthType,TableLayoutType,PageNumber,ImageRun,AlignmentType,BorderStyle,VerticalMergeType,VerticalAlign,TabStopType } from 'docx';
import PDFDocument from 'pdfkit';
import { unicaLogo } from './brand';

type Block =
  | { text: string; subtitle?: boolean; bullet?: boolean; centered?: boolean; bold?: boolean }
  | { headers: string[]; ratios: number[]; rows: string[][]; centered?: boolean; customColW?: number[]; merge?: number }
  | {
      type: 'signatures';
      date: string;
      directorTitle: string;
      teacherName: string;
      teacherTitle: string;
      teacherDni: string;
    };
type Section = { title: string; blocks: Block[] };

const text = (value: unknown) => String(value ?? '').replace(/\*\*(.*?)\*\*/g, '$1').trim();
const bullets = (items: string[] = []): Block[] => items.map(item => ({ text: item, bullet: true }));

function getWeekDateRange(weekIndex: number, periodStr?: string): string {
  let start = new Date(2026, 8, 7);
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

/** Horario y ambientes del formato UNICA: filas del documento base o una fila en blanco para completar a mano. */
export function unicaTimetable(d: any): string[][] {
  const rows = (d.generalData?.timetable ?? []).map((r: any) => [r.section, r.theorySchedule, r.theoryRoom, r.practiceSchedule, r.practiceRoom].map(v => String(v ?? '')));
  return rows.length ? rows : [[`${String(d.cycle || d.coverPage?.semester || '').replace(/\s*SEMESTRE\s*/i, '').trim() || 'I'} - A`, '', '', '', '']];
}

export function syllabusSections(d: any): Section[] {
  const g = d.generalData ?? {}, plan = d.evaluationPlan, bib = d.bibliographyDetails, c = d.coverPage ?? {};
  const sections: Section[] = [];

  const weeksCount = d.schedule?.length ? Math.max(...d.schedule.map((r: any) => Number(r.week) || 1)) : 14;
  const weeklyTotal = g.weeklyHours || 4;
  const theoryH = g.theoryHours ?? Math.max(1, Math.round(weeklyTotal * 0.5));
  const practiceH = g.practiceHours ?? Math.max(0, weeklyTotal - theoryH);
  const timetable = unicaTimetable(d);

  // I. INFORMACIÓN GENERAL Y DATOS DEL CURSO
  const sectionIBlocks: Block[] = [
    { text: '1.1  Datos Curriculares', subtitle: true },
    { text: `Nombre del Curso    : ${d.course || d.title}${g.courseCode ? `\nCódigo              : ${g.courseCode}` : ''}\nCréditos Académicos : ${String(d.credits || 4).padStart(2, '0')}\nCondición           : ${g.condition || 'Obligatorio'}\nÁrea de estudio     : ${g.nature || (g.careers?.length ? g.careers[0] : 'Teórico-Práctica')}` },
    { text: '1.2  Datos del Periodo Académico', subtitle: true },
    { text: `Periodo Académico   : ${g.term || c.year || '2026-I'}\nSemestre Académico  : ${d.cycle || c.semester || 'II'}\nPeriodo Cronológico : ${g.chronologicalPeriod || 'Del 07/09/2026 al 11/12/2026'}\nDuración            : ${weeksCount} semanas\nModalidad           : ${g.modality || 'Presencial'}${g.prerequisites ? `\nPrerrequisitos      : ${g.prerequisites}` : ''}` },
    { text: '1.3  Carga Horaria', subtitle: true },
    { text: `Número de Horas Semanales : Horas de Teoría (${theoryH})  Horas de Práctica (${practiceH})` },
    { text: 'Distribución de Horario y Ambientes', subtitle: true },
    {
      headers: ['Sección', 'Teoría\nHorario', 'Teoría\nLugar', 'Práctica\nHorario', 'Práctica\nLugar'],
      ratios: [0.12, 0.22, 0.20, 0.22, 0.24],
      centered: true,
      customColW: [55, 92, 92, 92, 92],
      rows: timetable
    },
    // Teacher block only when the teacher or the base document provided it.
    ...(g.teacherName || g.teacherEmail ? [
      { text: '1.4  Cuerpo Académico', subtitle: true },
      { text: [g.teacherName && `Docente de la Asignatura : ${g.teacherName}`, g.teacherEmail && `Correo institucional     : ${g.teacherEmail}`].filter(Boolean).join('\n') }
    ] : [])
  ];
  sections.push({ title: 'I. INFORMACIÓN GENERAL Y DATOS DEL CURSO', blocks: sectionIBlocks });

  // II. FUNDAMENTO CURRICULAR E INSTITUCIONAL
  const secIIBlocks: Block[] = [
    { text: '2.1  MISIÓN INSTITUCIONAL', subtitle: true },
    { text: c.mission || g.mission || 'Formar profesionales, con alto sentido ético, científico, humanístico y tecnológico, capaces de contribuir al desarrollo sostenible de la sociedad y al avance del conocimiento.' },
    { text: '2.2  SUMILLA', subtitle: true },
    { text: d.description || '' }
  ];
  if (d.rationale) {
    secIIBlocks.push({ text: '2.3  FUNDAMENTACIÓN DEL CURSO', subtitle: true }, { text: d.rationale });
  }
  sections.push({ title: 'II. FUNDAMENTO CURRICULAR E INSTITUCIONAL', blocks: secIIBlocks });

  // III. COMPETENCIAS, CAPACIDADES Y LOGROS DEL CURSO
  const compBlocks: Block[] = [
    { text: '3.1 COMPETENCIAS', subtitle: true },
    { text: d.competency || 'Aplica herramientas y metodologías avanzadas para la solución de problemas en el ámbito profesional.' },
    { text: '3.2 CAPACIDADES', subtitle: true },
    ...bullets(d.outcomes || []),
    { text: '3.3 LOGROS DEL CURSO', subtitle: true },
    { text: d.generalOutcome || `Al finalizar el curso, el estudiante diseña, modela y ejecuta soluciones de ${(d.course || d.title).toLowerCase()} aplicando metodologías actuales y estándares profesionales.` }
  ];
  sections.push({ title: 'III. COMPETENCIAS, CAPACIDADES Y LOGROS DEL CURSO', blocks: compBlocks });

  // IV. CONTENIDOS ORGANIZADOS EN UNIDADES Y SECUENCIAS DE APRENDIZAJES
  const unitBlocks: Block[] = [];
  const units = d.units || [];
  units.forEach((unit: any, i: number) => {
    unitBlocks.push({ text: `UNIDAD Nº ${i + 1}: ${unit.title.toUpperCase()}`, subtitle: true });
    if (unit.outcomes && unit.outcomes.length) {
      unitBlocks.push({ text: `LOGRO DE LA UNIDAD: ${unit.outcomes.join(' ')}` });
    }

    const weeks = unit.weeks ?? [];
    const unitRows: string[][] = [];
    for (const w of weeks) {
      const weekNum = Number(String(w).match(/\d+/)?.[0] || w);
      const sched = (d.schedule ?? []).find((s: any) => s.unit === i + 1 && s.week === weekNum)
                 || (d.schedule ?? []).find((s: any) => s.week === weekNum);
      const topic = sched?.topic || unit.topics?.[weeks.indexOf(w)] || `Desarrollo temático de la semana ${w}`;
      const acts = sched?.activities?.length ? sched.activities.map((a: string) => `• ${a}`).join('\n') : '• Presentación dialogada del tema.\n• Análisis guiado en clase.';
      const assess = sched?.assessments?.length ? sched.assessments.map((code: string) => {
        const item = plan?.items?.find((it: any) => it.code === code);
        return `Evaluación: ${code}${item ? ` — ${item.description}` : ''}`;
      }).join('\n') : '';
      const evidence = [
        'Participación fundamentada en clase.',
        'Práctica guiada y desarrollo de actividades.',
        ...(assess ? [assess] : [])
      ].join('\n');
      const bibRef = (bib?.base?.length ? `Texto obligatorio: ${bib.base[0]}` : (d.bibliography?.[0] || 'Referencias del sílabo.'));
      unitRows.push([
        `${w}ª`,
        topic,
        acts,
        evidence,
        bibRef
      ]);
    }

    unitBlocks.push({
      headers: ['Nº SEMANA', 'CONTENIDO DE APRENDIZAJE', 'ACTIVIDADES DE APRENDIZAJE', 'EVIDENCIAS DE APRENDIZAJE', 'BIBLIOGRAFÍA'],
      ratios: [0.08, 0.24, 0.24, 0.19, 0.25],
      rows: unitRows.length ? unitRows : [['1ª', 'Contenido temático de la unidad', 'Actividades de aprendizaje', 'Evidencias evaluables', 'Bibliografía recomendada']]
    });
  });
  sections.push({ title: 'IV. CONTENIDOS ORGANIZADOS EN UNIDADES Y SECUENCIAS DE APRENDIZAJES', blocks: unitBlocks });

  // V. ESTRATEGIAS METODOLÓGICAS
  sections.push({
    title: 'V. ESTRATEGIAS METODOLÓGICAS',
    blocks: [
      { text: '5.1  MÉTODOS DE ENSEÑANZA', subtitle: true },
      { text: d.methodology || 'Método inductivo-deductivo, aprendizaje basado en problemas, proyectos aplicados y talleres prácticos de laboratorio.' },
      { text: '5.2  MEDIOS Y MATERIALES', subtitle: true },
      { text: '5.2.1 Medios educativos:\nPizarra digital, presentaciones multimedia estructuradas, lecturas académicas seleccionadas, guías de laboratorio y separatas técnicas.\n\n5.2.2 Recursos tecnológicos:\nComputadora / laptop, proyector multimedia, acceso a internet, plataforma virtual institucional, entornos de desarrollo y software especializado.' }
    ]
  });

  // VI. EVALUACIÓN
  const evalBlocks: Block[] = [
    { text: '6.1  DESCRIPCIÓN DE LA EVALUACIÓN', subtitle: true },
    { text: 'Se evaluará de acuerdo con el Reglamento General de Pre-Grado:' },
    { text: 'Promedio Final = 50% (EC) + 40% (ED) + 10% (EA)', centered: true, bold: true },
    { text: 'Dónde:\n' +
      'EC: Evidencia de conocimiento (Parcial I y Parcial II)\n' +
      'ED: Evidencia de desempeño (Habilidades, Destrezas y Prácticas de laboratorio)\n' +
      'EA: Evidencia actitudinal (Puntualidad, aptitud para la ejecución de tareas, empeño y trabajo en equipo).'
    }
  ];

  const evalRows: string[][] = [];
  const midWeek = Math.floor(weeksCount / 2);
  const chronoPeriod = g.chronologicalPeriod || 'Del 07/09/2026 al 11/12/2026';
  for (let w = 1; w <= weeksCount; w++) {
    const dateStr = getWeekDateRange(w, chronoPeriod);
    // The plan's evidences (with their weight) come first; without them, the usual midterm/final weeks.
    const matched = plan?.items?.filter((it: any) => Number(it.week) === w) ?? [];
    const label = matched.length
      ? matched.map((it: any) => `${it.code} – ${it.description} (${it.weight} %)`).join('; ')
      : !plan?.items?.length && w === midWeek ? 'EXAMEN PARCIAL' : !plan?.items?.length && w === weeksCount ? 'EXAMEN FINAL' : 'Clases';
    const semanaText = `Semana ${String(w).padStart(2, '0')} – ${label}`;
    evalRows.push([String(w), dateStr, semanaText]);
  }

  evalBlocks.push(
    { text: '6.2  CRONOGRAMA DE EVALUACIÓN', subtitle: true },
    {
      headers: ['No', 'Fecha', 'Semana'],
      ratios: [0.08, 0.44, 0.48],
      centered: true,
      customColW: [32, 160, 180],
      rows: evalRows
    }
  );

  if (plan && plan.rules?.length) {
    evalBlocks.push({ text: 'Indicaciones sobre la evaluación', subtitle: true }, ...bullets(plan.rules));
  }
  sections.push({ title: 'VI. EVALUACIÓN', blocks: evalBlocks });

  // VII. FUENTES DE INFORMACIÓN (BIBLIOGRAFÍA APA 7)
  sections.push({
    title: 'VII. FUENTES DE INFORMACIÓN',
    blocks: bib ? [
      ...(bib.base.length ? [{ text: 'Bibliografía base / obligatoria (APA 7)', subtitle: true }, ...bullets(bib.base)] : []),
      ...(bib.complementary.length ? [{ text: 'Bibliografía complementaria (APA 7)', subtitle: true }, ...bullets(bib.complementary)] : []),
      ...(!bib.base.length && !bib.complementary.length ? [{ text: 'Referencias recomendadas según el plan curricular vigente.' }] : []),
      ...(bib.suggestions.length ? [{ text: 'Lecturas sugeridas', subtitle: true }, ...bullets(bib.suggestions)] : [])
    ] : bullets(d.bibliography)
  });

  // VIII. CRONOGRAMA DE ACTIVIDADES
  if (d.schedule && d.schedule.length) {
    sections.push({
      title: 'VIII. CRONOGRAMA DE ACTIVIDADES',
      blocks: [{
        headers: ['Unidad', 'Semana', 'Sesión', 'Tema específico', 'Actividades y evaluaciones'],
        ratios: [0.13, 0.10, 0.10, 0.31, 0.36],
        merge: 2,
        rows: [...d.schedule].sort((a: any, b: any) => a.week - b.week || a.session - b.session).map((row: any) => [
          `Unidad ${row.unit}`,
          String(row.week),
          String(row.session),
          row.topic,
          [
            ...row.activities.map((act: string) => `• ${act}`),
            ...row.assessments.map((code: string) => {
              const item = plan?.items.find((it: any) => it.code === code);
              return `Evaluación: ${code}${item ? ` — ${item.description}` : ''}`;
            })
          ].join('\n')
        ])
      }]
    });
  }

  // FIRMAS DE APROBACIÓN INSTITUCIONAL (Libre, sin cuadros, al director solo cargo, al docente DNI)
  const teacherDniVal = g.teacherDni ? (String(g.teacherDni).startsWith('DNI') ? String(g.teacherDni) : `DNI ${g.teacherDni}`) : '';
  sections.push({
    title: '',
    blocks: [
      {
        type: 'signatures',
        date: c.date || d.signatureDate || '03 de setiembre del 2026',
        directorTitle: 'Director del Departamento Académico',
        teacherName: g.teacherName || '',
        teacherTitle: 'Docente de la Asignatura',
        teacherDni: teacherDniVal
      }
    ]
  });

  return sections;
}

/** «Etiqueta : valor» lines (datos curriculares, periodo académico…) are drawn with aligned colons. */
const kvLines = (value: unknown) => { const lines = text(value).split('\n'); return lines.length > 1 && lines.every(l => /^[^:]{2,45}\s:\s/.test(l)) ? lines.map(l => { const i = l.indexOf(' : '); return [l.slice(0, i).trim(), l.slice(i + 3).trim()]; }) : null; };

/** Running text (not «Etiqueta : valor» lists or headings) is justified with 1.5 line spacing. */
const isProse = (value: unknown, o: { heading?: boolean; subtitle?: boolean; centered?: boolean; small?: boolean }) => !o.heading && !o.subtitle && !o.centered && !o.small && !text(value).includes('\n') && text(value).length > 80;

function paragraph(value: unknown, options: { heading?: boolean; subtitle?: boolean; bullet?: boolean; small?: boolean; centered?: boolean; bold?: boolean } = {}) {
  const kv = !options.heading && !options.subtitle && !options.centered ? kvLines(value) : null;
  if (kv) return new Paragraph({
    tabStops: [{ type: TabStopType.LEFT, position: 2900 }],
    spacing: { after: 140, line: 300 },
    children: kv.flatMap(([k, v], i) => [...(i ? [new TextRun({ break: 1 })] : []), new TextRun({ text: `${k}\t: ${v}`, font: 'Arial', size: 22, color: '000000' })]),
  });
  return new Paragraph({
    heading: options.heading ? HeadingLevel.HEADING_1 : options.subtitle ? HeadingLevel.HEADING_2 : undefined,
    alignment: options.centered ? AlignmentType.CENTER : isProse(value, options) ? AlignmentType.JUSTIFIED : AlignmentType.LEFT,
    keepNext: options.heading || options.subtitle,
    bullet: options.bullet ? { level: 0 } : undefined,
    spacing: { before: options.heading ? 260 : options.subtitle ? 160 : 0, after: options.small ? 80 : 140, line: options.small ? 220 : isProse(value, options) ? 360 : 276 },
    children: text(value).split('\n').flatMap((line, i) => [
      ...(i ? [new TextRun({ break: 1 })] : []),
      new TextRun({
        text: line,
        font: 'Arial',
        size: options.heading ? 26 : options.subtitle ? 23 : options.small ? 19 : 22,
        bold: options.heading || options.subtitle || options.bold,
        color: '000000'
      })
    ])
  });
}

function docxTable(headers: string[], rows: string[][], options: { centered?: boolean; customColW?: number[]; merge?: number } = {}) {
  const merge = options.merge || 0;
  const same = (r: number, c: number) => r > 0 && c < merge && rows[r].slice(0, c + 1).every((v, k) => v === rows[r - 1][k]);
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    alignment: options.centered ? AlignmentType.CENTER : AlignmentType.LEFT,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 8, color: '000000' },
      bottom: { style: BorderStyle.SINGLE, size: 8, color: '000000' },
      left: { style: BorderStyle.SINGLE, size: 8, color: '000000' },
      right: { style: BorderStyle.SINGLE, size: 8, color: '000000' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
      insideVertical: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
    },
    rows: [
      new TableRow({
        tableHeader: true,
        cantSplit: true,
        children: headers.map(h => new TableCell({
          shading: { fill: 'FFFFFF' },
          margins: { top: 100, bottom: 100, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, font: 'Arial', size: 19, color: '000000' })] })]
        }))
      }),
      ...rows.map((row, r) => new TableRow({
        cantSplit: true,
        children: row.map((cell, c) => new TableCell({
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          verticalMerge: same(r, c) ? VerticalMergeType.CONTINUE : c < merge && r + 1 < rows.length && same(r + 1, c) ? VerticalMergeType.RESTART : undefined,
          verticalAlign: c < merge ? VerticalAlign.CENTER : undefined,
          children: (same(r, c) ? [''] : cell.split('\n')).map(line => new Paragraph({ alignment: c < merge || /^\d+$/.test(cell) ? AlignmentType.CENTER : AlignmentType.LEFT, children: [new TextRun({ text: line, font: 'Arial', size: 19, color: '000000', bold: c === 0 && c < merge })] }))
        }))
      }))
    ]
  });
}

export async function renderSyllabusDocx(data: any, citations: any[] = []) {
  const c = data.coverPage ?? {};
  const g = data.generalData ?? {};
  const institution = c.institution || g.institution;
  const faculty = c.faculty || (g.careers?.length ? `FACULTAD DE ${g.careers[0].toUpperCase()}` : '');
  const department = c.department || '';
  const courseTitle = c.course || data.course || data.title;
  const semester = c.semester || (data.cycle ? `${String(data.cycle).toUpperCase()} SEMESTRE` : '');
  const year = c.year || '2026 – I';
  const location = c.location || 'ICA-PERÚ';
  const logoBuffer = c.logoBase64 ? Buffer.from(c.logoBase64, 'base64') : unicaLogo();

  const children: (Paragraph | Table)[] = [];

  if (institution) {
    children.push(
      new Paragraph({ alignment: 'center', spacing: { before: 200, after: 100 }, children: [new TextRun({ text: institution.toUpperCase(), bold: true, font: 'Arial', size: 28, color: '000000' })] }),
      ...(faculty ? [new Paragraph({ alignment: 'center', spacing: { after: 100 }, children: [new TextRun({ text: faculty.toUpperCase(), bold: true, font: 'Arial', size: 24, color: '000000' })] })] : []),
      ...(department ? [new Paragraph({ alignment: 'center', spacing: { after: 300 }, children: [new TextRun({ text: department.toUpperCase(), bold: true, font: 'Arial', size: 22, color: '000000' })] })] : [new Paragraph({ spacing: { after: 200 }, children: [] })]),
      ...(logoBuffer ? [new Paragraph({ alignment: 'center', spacing: { before: 300, after: 400 }, children: [new ImageRun({ data: logoBuffer, transformation: { width: 150, height: 150 }, type: 'png' })] })] : []),
      new Paragraph({ alignment: 'center', spacing: { before: 400, after: 200 }, children: [new TextRun({ text: 'SILABO DE LA ASIGNATURA DE:', bold: true, font: 'Arial', size: 24, color: '000000' })] }),
      new Paragraph({ alignment: 'center', spacing: { after: 300 }, children: [new TextRun({ text: courseTitle.toUpperCase(), bold: true, font: 'Arial', size: 30, color: '000000' })] }),
      ...(semester ? [new Paragraph({ alignment: 'center', spacing: { after: 120 }, children: [new TextRun({ text: semester.toUpperCase(), bold: true, font: 'Arial', size: 22, color: '000000' })] })] : []),
      new Paragraph({ alignment: 'center', spacing: { after: 500 }, children: [new TextRun({ text: year, bold: true, font: 'Arial', size: 22, color: '000000' })] }),
      new Paragraph({ alignment: 'center', spacing: { before: 500, after: 200 }, children: [new TextRun({ text: location.toUpperCase(), bold: true, font: 'Arial', size: 20, color: '000000' })] }),
      new Paragraph({ pageBreakBefore: true, children: [] }),
      ...(logoBuffer ? [new Paragraph({ alignment: 'center', spacing: { before: 100, after: 100 }, children: [new ImageRun({ data: logoBuffer, transformation: { width: 50, height: 50 }, type: 'png' })] })] : []),
      new Paragraph({ alignment: 'center', children: [new TextRun({ text: institution.toUpperCase(), bold: true, font: 'Arial', size: 22, color: '000000' })] }),
      ...(faculty ? [new Paragraph({ alignment: 'center', children: [new TextRun({ text: faculty.toUpperCase(), bold: true, font: 'Arial', size: 20, color: '000000' })] })] : []),
      ...(department ? [new Paragraph({ alignment: 'center', spacing: { after: 100 }, children: [new TextRun({ text: department.toUpperCase(), bold: true, font: 'Arial', size: 18, color: '000000' })] })] : []),
      new Paragraph({ alignment: 'center', spacing: { after: 300 }, children: [new TextRun({ text: 'SÍLABO', bold: true, font: 'Arial', size: 24, color: '000000' })] })
    );
  } else {
    children.push(
      new Paragraph({ alignment: 'center', children: [new TextRun({ text: 'SÍLABO', bold: true, font: 'Arial', size: 32, color: '000000' })] }),
      new Paragraph({ alignment: 'center', children: [new TextRun({ text: data.course || data.title, bold: true, font: 'Arial', size: 26, color: '000000' })], spacing: { after: 220 } })
    );
  }

  for (const section of syllabusSections(data)) {
    if (section.title) {
      children.push(paragraph(section.title, { heading: true }));
    }
    for (const block of section.blocks) {
      if ('type' in block && block.type === 'signatures') {
        children.push(new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { before: 400, after: 600 },
          children: [new TextRun({ text: block.date, bold: true, font: 'Arial', size: 21, color: '000000' })]
        }));
        children.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
            insideHorizontal: { style: BorderStyle.NONE },
            insideVertical: { style: BorderStyle.NONE }
          },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  children: [
                    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '................................................................', font: 'Arial', size: 20, color: '000000' })] }),
                    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80 }, children: [new TextRun({ text: block.directorTitle, bold: true, font: 'Arial', size: 20, color: '000000' })] })
                  ]
                }),
                new TableCell({
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  children: [
                    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '................................................................', font: 'Arial', size: 20, color: '000000' })] }),
                    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80 }, children: [new TextRun({ text: block.teacherName, bold: true, font: 'Arial', size: 20, color: '000000' })] }),
                    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: block.teacherTitle, bold: true, font: 'Arial', size: 20, color: '000000' })] }),
                    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: block.teacherDni, bold: true, font: 'Arial', size: 20, color: '000000' })] })
                  ]
                })
              ]
            })
          ]
        }));
      } else if ('text' in block) {
        children.push(paragraph(block.text, { subtitle: block.subtitle, bullet: block.bullet, centered: block.centered, bold: block.bold }));
      } else if ('headers' in block) {
        children.push(docxTable(block.headers, block.rows, { centered: block.centered, customColW: block.customColW, merge: block.merge }));
      }
    }
  }

  if (citations.length) {
    children.push(paragraph('Referencias bibliográficas', { subtitle: true }));
    for (const c of citations) children.push(paragraph(`[${c.reference}] ${c.name}${c.page ? `, p. ${c.page}` : ''}.`, { small: true }));
  }

  const doc = new Document({
    sections: [{
      footers: { default: new Footer({ children: [new Paragraph({ alignment: 'center', children: [new TextRun({ text: 'Sílabo · Página ', font: 'Arial', size: 18, color: '000000' }), new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 18, color: '000000' }), new TextRun({ text: ' de ', font: 'Arial', size: 18, color: '000000' }), new TextRun({ children: [PageNumber.TOTAL_PAGES], font: 'Arial', size: 18, color: '000000' })] })] }) },
      children
    }]
  });
  return Packer.toBuffer(doc);
}

export function renderSyllabusPdf(data: any, citations: any[] = []): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // MÁRGENES MÁS AMPLIOS (56pt laterales ~ 2cm a 2.5cm)
    const marginX = 56;
    const marginY = 52;
    const doc = new PDFDocument({ size: 'A4', margins: { top: marginY, left: marginX, right: marginX, bottom: marginY }, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', b => chunks.push(b));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    const width = doc.page.width - marginX * 2;

    try {
      const c = data.coverPage ?? {};
      const g = data.generalData ?? {};
      const institution = c.institution || g.institution;
      const faculty = c.faculty || (g.careers?.length ? `FACULTAD DE ${g.careers[0].toUpperCase()}` : '');
      const department = c.department || '';
      const courseTitle = c.course || data.course || data.title;
      const semester = c.semester || (data.cycle ? `${String(data.cycle).toUpperCase()} SEMESTRE` : '');
      const year = c.year || '2026 – I';
      const location = c.location || 'ICA-PERÚ';
      const logoBuffer = c.logoBase64 ? Buffer.from(c.logoBase64, 'base64') : unicaLogo();

      const room = (h: number) => { if (doc.y + h > doc.page.height - 56) doc.addPage(); };

      const body = (val: unknown, sub = false, bullet = false, centered = false, bold = false) => {
        room(sub ? 34 : 22);
        const isBold = sub || bold;
        doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica')
           .fontSize(sub ? 11 : 10)
           .fillColor('#000000');
        const prefix = bullet ? '• ' : '';
        const kv = !centered && !sub ? kvLines(val) : null;
        if (kv) {
          for (const [k, v] of kv) {
            room(16); const y = doc.y;
            doc.text(k, marginX, y, { width: 150, lineGap: 2 }); const after = doc.y;
            doc.text(`: ${v}`, marginX + 150, y, { width: width - 150, lineGap: 2 });
            doc.y = Math.max(doc.y, after);
          }
        } else if (centered) {
          doc.text(prefix + text(val), marginX, doc.y, { width, align: 'center', lineGap: 2 });
        } else if (isProse(val, { subtitle: sub })) {
          doc.text(prefix + text(val), marginX, doc.y, { width, align: 'justify', lineGap: 5 });
        } else {
          doc.text(prefix + text(val), marginX, doc.y, { width, lineGap: 2 });
        }
        doc.moveDown(sub ? 0.35 : 0.25);
      };

      const table = (t: { headers: string[]; ratios: number[]; rows: string[][]; centered?: boolean; customColW?: number[]; merge?: number }) => {
        room(50);
        const colW = t.customColW ? [...t.customColW] : t.ratios.map(r => r * width);
        const tableWidth = colW.reduce((sum, w) => sum + w, 0);
        const startX = t.centered ? marginX + Math.max(0, (width - tableWidth) / 2) : marginX;

        const bottom = () => doc.page.height - 56;
        const centerCol = (i: number) => ['No', 'Nº', 'Nº SEMANA', 'Sección', 'Unidad', 'Semana', 'Sesión'].includes(t.headers[i]) || i < (t.merge || 0);
        const font = (head: boolean) => doc.font(head ? 'Helvetica-Bold' : 'Helvetica').fontSize(head ? 9 : 8.5);
        // Lines are measured here so a row can be split exactly where the page ends.
        const wrap = (value: string, w: number) => {
          const out: string[] = [];
          for (const paragraph of String(value ?? '').split('\n')) {
            let line = '';
            for (const word of paragraph.split(/\s+/).filter(Boolean)) {
              const next = line ? `${line} ${word}` : word;
              if (doc.widthOfString(next) <= w) { line = next; continue; }
              if (line) out.push(line);
              line = '';
              let piece = '';
              for (const char of word) { if (doc.widthOfString(piece + char) > w && piece) { out.push(piece); piece = ''; } piece += char; }
              line = piece;
            }
            out.push(line);
          }
          return out;
        };
        // Merged cells: a leading column equal to the row above has no top border and no repeated text (except at the top of a page).
        let cont: boolean[] = [], pageFresh = true;
        const closeLine = () => doc.moveTo(startX, doc.y).lineTo(startX + tableWidth, doc.y).lineWidth(0.8).stroke('#000000');
        const drawLines = (lines: string[][], head: boolean, lineH: number) => {
          const rowH = Math.max(1, ...lines.map(l => l.length)) * lineH + 12, startY = doc.y;
          let x = startX;
          lines.forEach((cellLines, i) => {
            const merged = !head && i < (t.merge || 0);
            if (merged) {
              doc.moveTo(x, startY).lineTo(x, startY + rowH).moveTo(x + colW[i], startY).lineTo(x + colW[i], startY + rowH).lineWidth(0.8).stroke('#000000');
              if (!cont[i] || pageFresh) doc.moveTo(x, startY).lineTo(x + colW[i], startY).lineWidth(0.8).stroke('#000000');
              if (cont[i] && !pageFresh) { x += colW[i]; return; }
            } else doc.rect(x, startY, colW[i], rowH).lineWidth(0.8).stroke('#000000');
            font(head || (merged && i === 0)).fillColor('#000000');
            const inner = Math.max(10, colW[i] - 12);
            cellLines.forEach((line, n) => {
              const offset = head || centerCol(i) ? Math.max(0, (inner - doc.widthOfString(line)) / 2) : 0;
              doc.text(line, x + 6 + offset, startY + 6 + n * lineH, { lineBreak: false });
            });
            x += colW[i];
          });
          doc.y = startY + rowH;
          if (!head) pageFresh = false;
        };
        const newPage = () => { closeLine(); doc.addPage(); pageFresh = true; drawRow(t.headers, true); };
        function drawRow(cells: string[], head = false) {
          font(head);
          const lineH = doc.currentLineHeight(true) + 1.5;
          let rest = cells.map((cell, i) => wrap(cell, Math.max(10, colW[i] - 12)));
          const fresh = bottom() - marginY - 60;
          while (true) {
            const needed = Math.max(1, ...rest.map(l => l.length)) * lineH + 12, available = bottom() - doc.y;
            if (needed <= available) { drawLines(rest, head, lineH); return; }
            // A row that fits on a fresh page moves there whole; only longer rows are split.
            if (head || available < lineH * 3 + 12 || needed <= fresh) { if (head) { doc.addPage(); continue; } newPage(); continue; }
            const fit = Math.floor((available - 12) / lineH);
            drawLines(rest.map(l => l.slice(0, fit)), head, lineH);
            rest = rest.map(l => l.slice(fit));
            newPage();
          }
        }

        room(60);
        drawRow(t.headers, true);
        t.rows.forEach((r, n) => { cont = r.map((_, c) => n > 0 && c < (t.merge || 0) && r.slice(0, c + 1).every((v, k) => v === t.rows[n - 1][k])); drawRow(r, false); });
        closeLine();
        doc.moveDown(0.6);
      };

      // Portada aprovechando toda la altura de la página A4 (842 pt)
      if (institution) {
        let topY = 60;
        doc.font('Helvetica-Bold').fontSize(16).fillColor('#000000').text(institution.toUpperCase(), marginX, topY, { align: 'center', width });
        if (faculty) {
          doc.font('Helvetica-Bold').fontSize(13).fillColor('#000000').text(faculty.toUpperCase(), marginX, doc.y + 6, { align: 'center', width });
        }
        if (department) {
          doc.font('Helvetica-Bold').fontSize(11.5).fillColor('#000000').text(department.toUpperCase(), marginX, doc.y + 5, { align: 'center', width });
        }

        const logoY = 205;
        if (logoBuffer) {
          doc.image(logoBuffer, (doc.page.width - 135) / 2, logoY, { width: 135, height: 135 });
        }

        const titleHeaderY = 390;
        doc.font('Helvetica-Bold').fontSize(12.5).fillColor('#000000').text('SILABO DE LA ASIGNATURA DE:', marginX, titleHeaderY, { align: 'center', width });
        doc.font('Helvetica-Bold').fontSize(18).fillColor('#000000').text(courseTitle.toUpperCase(), marginX, doc.y + 12, { align: 'center', width });

        const semY = 535;
        if (semester) {
          doc.font('Helvetica-Bold').fontSize(12.5).fillColor('#000000').text(semester.toUpperCase(), marginX, semY, { align: 'center', width });
        }
        doc.font('Helvetica-Bold').fontSize(12.5).fillColor('#000000').text(year, marginX, doc.y + 6, { align: 'center', width });

        doc.font('Helvetica-Bold').fontSize(11.5).fillColor('#000000').text(location.toUpperCase(), marginX, doc.page.height - 80, { align: 'center', width });
        doc.addPage();

        // Encabezado Página 2 en adelante
        const p2StartY = marginY;
        if (logoBuffer) {
          doc.image(logoBuffer, marginX, p2StartY, { width: 44, height: 44 });
        }
        const headerX = logoBuffer ? marginX + 52 : marginX;
        const headerW = logoBuffer ? width - 52 : width;
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#000000').text(institution.toUpperCase(), headerX, p2StartY, { align: 'center', width: headerW });
        if (faculty) doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000').text(faculty.toUpperCase(), headerX, doc.y + 2, { align: 'center', width: headerW });
        if (department) doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#000000').text(department.toUpperCase(), headerX, doc.y + 2, { align: 'center', width: headerW });
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#000000').text('SÍLABO', headerX, doc.y + 6, { align: 'center', width: headerW });
        doc.y = Math.max(doc.y + 14, p2StartY + 54);
        doc.moveDown(0.8);
      }

      // SECCIONES
      for (const section of syllabusSections(data)) {
        if (section.title) {
          room(60);
          doc.font('Helvetica-Bold').fontSize(12).fillColor('#000000');
          doc.text(section.title, marginX, doc.y, { width }).moveDown(0.4);
        }
        for (const block of section.blocks) {
          if ('type' in block && block.type === 'signatures') {
            room(130);
            doc.moveDown(1.5);
            // Fecha alineada a la derecha
            doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#000000')
               .text(block.date, marginX, doc.y, { width, align: 'right' });
            doc.moveDown(4.5);

            const colW = (width - 40) / 2;
            const col1X = marginX;
            const col2X = marginX + colW + 40;
            const lineY = doc.y;

            // Líneas punteadas
            doc.font('Helvetica').fontSize(10).fillColor('#000000');
            doc.text('................................................................', col1X, lineY, { width: colW, align: 'center' });
            doc.text('................................................................', col2X, lineY, { width: colW, align: 'center' });

            // Textos centrados debajo de cada línea (al director solo cargo, al docente nombre + cargo + DNI)
            doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000');
            doc.text(block.directorTitle, col1X, lineY + 15, { width: colW, align: 'center' });

            doc.text(block.teacherName, col2X, lineY + 15, { width: colW, align: 'center' });
            doc.text(block.teacherTitle, col2X, lineY + 29, { width: colW, align: 'center' });
            doc.text(block.teacherDni, col2X, lineY + 43, { width: colW, align: 'center' });

            doc.y = lineY + 68;
          } else if ('text' in block) {
            body(block.text, block.subtitle, block.bullet, block.centered, block.bold);
          } else if ('headers' in block) {
            table(block);
          }
        }
        doc.moveDown(0.6);
      }

      if (citations.length) {
        room(40);
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#000000').text('FUENTES CONSULTADAS', marginX, doc.y, { width }).moveDown(0.3);
        for (const c of citations) body(`[${c.reference}] ${c.name}${c.page ? `, p. ${c.page}` : ''}.`, false, true);
      }

      // Pie de página
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.page.margins.bottom = 0;
        doc.font('Helvetica').fontSize(8.5).fillColor('#000000').text(`Sílabo · ${i + 1} / ${range.count}`, marginX, doc.page.height - 28, { width, align: 'center', lineBreak: false });
      }
      doc.end();
    } catch (error) {
      doc.destroy();
      reject(error);
    }
  });
}
