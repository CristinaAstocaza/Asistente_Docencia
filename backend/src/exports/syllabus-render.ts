import { Document,Footer,HeadingLevel,Packer,Paragraph,TextRun,Table,TableRow,TableCell,WidthType,TableLayoutType,PageNumber,ImageRun } from 'docx';
import PDFDocument from 'pdfkit';

type Block={text:string;subtitle?:boolean;bullet?:boolean}|{headers:string[];ratios:number[];rows:string[][]};
type Section={title:string;blocks:Block[]};

const text=(value:unknown)=>String(value??'').replace(/\*\*(.*?)\*\*/g,'$1').trim();
const bullets=(items:string[]=[]):Block[]=>items.map(item=>({text:item,bullet:true}));

export function syllabusSections(d:any):Section[]{
 const g=d.generalData??{},plan=d.evaluationPlan,bib=d.bibliographyDetails,c=d.coverPage??{};
 const sections:Section[]=[];

 const weeksCount = d.schedule?.length ? Math.max(...d.schedule.map((r:any) => Number(r.week) || 1)) : 14;
 const weeklyTotal = g.weeklyHours || 5;
 const theoryH = Math.max(1, Math.round(weeklyTotal * 0.6));
 const practiceH = Math.max(1, weeklyTotal - theoryH);

 // I. INFORMACIÓN GENERAL Y DATOS DEL CURSO
 const sectionIBlocks: Block[] = [
  { text: '1.1  Datos Curriculares', subtitle: true },
  { text: `Nombre del Curso    : ${d.course || d.title}\nCódigo              : ${g.courseCode || '1P35024'}\nCréditos Académicos : ${String(d.credits || 4).padStart(2, '0')}\nCondición           : Obligatorio\nÁrea de estudio     : ${g.nature || (g.careers?.length ? g.careers[0] : 'Formación de Especialidad')}` },
  { text: '1.2  Datos del Periodo Académico', subtitle: true },
  { text: `Periodo Académico   : ${g.term || c.year || '2026-I'}\nSemestre Académico  : ${c.semester || d.cycle || 'II'}\nPeriodo Cronológico : Del 07/09/2026 al 11/12/2026\nDuración            : ${weeksCount} semanas\nModalidad           : ${g.modality || 'Presencial'}\nPrerrequisitos      : ${g.prerequisites || 'Haber aprobado los créditos correspondientes'}` },
  { text: '1.3  Carga Horaria', subtitle: true },
  { text: `Número de Horas Semanales : Horas de Teoría (${theoryH})  Horas de Práctica (${practiceH})` },
  { text: 'Distribución de Horario y Ambientes', subtitle: true },
  {
   headers: ['Sección', 'Teoría (Horario / Aula)', 'Práctica (Horario / Lab)'],
   ratios: [0.15, 0.42, 0.43],
   rows: [
    ['II - A', `${theoryH * 2} horas semanales (Aula N° 103)`, `${practiceH * 2} horas semanales (Laboratorio de Cómputo)`]
   ]
  },
  { text: '1.4  Cuerpo Académico', subtitle: true },
  { text: `Docente de la Asignatura : ${g.teacherName || 'Dr. Lino Martin Quispe Tincopa [COMPLETAR]'}\nCorreo institucional     : ${g.teacherEmail || 'lino.quispe@unica.edu.pe [COMPLETAR]'}` }
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

  // Generar tabla de 5 columnas oficial
  const weeks = unit.weeks ?? [];
  const unitRows: string[][] = [];
  for (const w of weeks) {
   const weekNum = Number(String(w).match(/\d+/)?.[0] || w);
   const sched = (d.schedule ?? []).find((s: any) => s.unit === i + 1 && s.week === weekNum)
              || (d.schedule ?? []).find((s: any) => s.week === weekNum);
   const topic = sched?.topic || unit.topics?.[weeks.indexOf(w)] || `Desarrollo temático de la semana ${w}`;
   const acts = sched?.activities?.length ? sched.activities.map((a: string) => `• ${a}`).join('\n') : '• Exposición dialogada sobre el tema.\n• Análisis guiado y participación en clase.';
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
   ratios: [0.10, 0.32, 0.26, 0.20, 0.12],
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
  { text: 'Se evaluará de acuerdo con el Reglamento General de Pre-Grado:\n\n' +
   'Promedio Final = 50% (EC) + 40% (ED) + 10% (EA)\n\n' +
   'Dónde:\n' +
   'EC: Evidencia de conocimiento (Parcial I y Parcial II)\n' +
   'ED: Evidencia de desempeño (Habilidades, Destrezas y Prácticas de laboratorio)\n' +
   'EA: Evidencia actitudinal (Puntualidad, aptitud para la ejecución de tareas, empeño y trabajo en equipo).'
  }
 ];

 const evalRows: string[][] = [];
 const midWeek = Math.floor(weeksCount / 2);
 for (let w = 1; w <= weeksCount; w++) {
  let semanaText = `Semana ${String(w).padStart(2, '0')} – Clases y desarrollo temático`;
  if (w === midWeek) semanaText = `Semana ${String(w).padStart(2, '0')} – EXAMEN PARCIAL I (EC1)`;
  else if (w === weeksCount) semanaText = `Semana ${String(w).padStart(2, '0')} – EXAMEN FINAL (EC2)`;
  else if (plan?.items) {
   const matched = plan.items.filter((it:any) => it.week === w);
   if (matched.length) {
    semanaText = `Semana ${String(w).padStart(2, '0')} – ${matched.map((it:any) => `${it.code} (${it.description})`).join('; ')}`;
   }
  }
  evalRows.push([String(w), `Semana ${w} del semestre regular`, semanaText]);
 }

 evalBlocks.push(
  { text: '6.2  CRONOGRAMA DE EVALUACIÓN', subtitle: true },
  {
   headers: ['Nº', 'Fecha / Periodo', 'Semana'],
   ratios: [0.10, 0.40, 0.50],
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
 if (d.schedule) {
  sections.push({
   title: 'VIII. CRONOGRAMA DE ACTIVIDADES',
   blocks: [{
    headers: ['Unidad', 'Semana', 'Sesión', 'Tema específico', 'Actividades y evaluaciones'],
    ratios: [0.16, 0.10, 0.08, 0.32, 0.34],
    rows: [...d.schedule].sort((a:any, b:any) => a.week - b.week || a.session - b.session).map((row:any) => [
     `Unidad ${row.unit}`,
     `Semana ${row.week}`,
     `Sesión ${row.session}`,
     row.topic,
     [
      ...row.activities.map((act:string) => `• ${act}`),
      ...row.assessments.map((code:string) => {
       const item = plan?.items.find((it:any) => it.code === code);
       return `Evaluación: ${code}${item ? ` — ${item.description}` : ''}`;
      })
     ].join('\n')
    ])
   }]
  });
 }

 // FIRMAS DE APROBACIÓN INSTITUCIONAL
 sections.push({
  title: 'FIRMAS DE APROBACIÓN INSTITUCIONAL',
  blocks: [
   {
    headers: ['Director del Departamento Académico', 'Docente de la Asignatura'],
    ratios: [0.50, 0.50],
    rows: [
     [
      '\n\n\n_____________________________________\nDr. Lino Martin Quispe Tincopa\nDirector del Departamento Académico\nFacultad de Ingeniería de Sistemas',
      '\n\n\n_____________________________________\nDocente de la Asignatura\nNombre: [COMPLETAR]\nDNI: [COMPLETAR]'
     ]
    ]
   }
  ]
 });

 for (const section of d.baseSections ?? []) {
  sections.push({ title: section.title, blocks: [{ text: section.content }] });
 }

 if ((d.changesSummary && d.changesSummary.length) || (d.pendingFields && d.pendingFields.length) || (d.verificationNotes && d.verificationNotes.length)) {
  const auditBlocks: Block[] = [];
  if (d.changesSummary?.length) {
   auditBlocks.push({ text: 'Lista de cambios y mejoras respecto al sílabo base:', subtitle: true }, ...bullets(d.changesSummary));
  }
  if (d.pendingFields?.length) {
   auditBlocks.push({ text: 'Campos pendientes por completar [COMPLETAR]:', subtitle: true }, ...bullets(d.pendingFields));
  }
  if (d.verificationNotes?.length) {
   auditBlocks.push({ text: 'Referencias o aspectos por verificar [VERIFICAR]:', subtitle: true }, ...bullets(d.verificationNotes));
  }
  sections.push({ title: 'CONTROL DE CAMBIOS Y CAMPOS PENDIENTES (AUDITORÍA SUNEDU)', blocks: auditBlocks });
 }

 return sections;
}

function paragraph(value:unknown,options:{heading?:boolean;subtitle?:boolean;bullet?:boolean;small?:boolean}={}){
 return new Paragraph({
  heading:options.heading?HeadingLevel.HEADING_1:options.subtitle?HeadingLevel.HEADING_2:undefined,
  keepNext:options.heading||options.subtitle,
  bullet:options.bullet?{level:0}:undefined,
  spacing:{before:options.heading?260:options.subtitle?160:0,after:options.small?80:140,line:options.small?220:276},
  children:text(value).split('\n').flatMap((line,i)=>[
   ...(i?[new TextRun({break:1})]:[]),
   new TextRun({text:line,font:'Arial',size:options.heading?25:options.subtitle?22:options.small?18:21,bold:options.heading||options.subtitle,color:options.heading?'0F172A':options.small?'64748B':'334155'})
  ])
 });
}

function docxTable(headers:string[],rows:string[][]){
 return new Table({
  width:{size:100,type:WidthType.PERCENTAGE},
  rows:[
   new TableRow({
    tableHeader:true,
    cantSplit:true,
    children:headers.map(h=>new TableCell({
     shading:{fill:'F8FAFC'},
     margins:{top:100,bottom:100,left:120,right:120},
     children:[new Paragraph({children:[new TextRun({text:h,bold:true,font:'Arial',size:18,color:'0F172A'})]})]
    }))
   }),
   ...rows.map(row=>new TableRow({
    cantSplit:true,
    children:row.map(cell=>new TableCell({
     margins:{top:80,bottom:80,left:120,right:120},
     children:cell.split('\n').map(line=>new Paragraph({children:[new TextRun({text:line,font:'Arial',size:18,color:'334155'})]}))
    }))
   }))
  ]
 });
}

export async function renderSyllabusDocx(data:any,citations:any[]=[]){
 const c = data.coverPage ?? {};
 const g = data.generalData ?? {};
 const institution = c.institution || g.institution;
 const faculty = c.faculty || (g.careers?.length ? `FACULTAD DE ${g.careers[0].toUpperCase()}` : '');
 const department = c.department || '';
 const courseTitle = c.course || data.course || data.title;
 const semester = c.semester || g.term || data.cycle || '';
 const year = c.year || '2026 – I';
 const location = c.location || 'ICA-PERÚ';
 const logoBuffer = c.logoBase64 ? Buffer.from(c.logoBase64, 'base64') : null;

 const children:(Paragraph|Table)[]=[];

 if (institution) {
  // Carátula institucional completa
  children.push(
   new Paragraph({alignment:'center',spacing:{before:200,after:100},children:[new TextRun({text:institution.toUpperCase(),bold:true,font:'Arial',size:26,color:'14213D'})]}),
   ...(faculty?[new Paragraph({alignment:'center',spacing:{after:100},children:[new TextRun({text:faculty.toUpperCase(),bold:true,font:'Arial',size:22,color:'334155'})]})]:[]),
   ...(department?[new Paragraph({alignment:'center',spacing:{after:300},children:[new TextRun({text:department.toUpperCase(),bold:true,font:'Arial',size:20,color:'475569'})]})]:[new Paragraph({spacing:{after:200},children:[]})]),
   ...(logoBuffer?[new Paragraph({alignment:'center',spacing:{before:300,after:400},children:[new ImageRun({data:logoBuffer,transformation:{width:150,height:150},type:'png'})] })]:[]),
   new Paragraph({alignment:'center',spacing:{before:400,after:200},children:[new TextRun({text:'SILABO DE LA ASIGNATURA DE:',bold:true,font:'Arial',size:24,color:'14213D'})]}),
   new Paragraph({alignment:'center',spacing:{after:300},children:[new TextRun({text:courseTitle.toUpperCase(),bold:true,font:'Arial',size:28,color:'1E3A8A'})]}),
   ...(semester?[new Paragraph({alignment:'center',spacing:{after:120},children:[new TextRun({text:semester.toUpperCase(),bold:true,font:'Arial',size:20,color:'334155'})]})]:[]),
   new Paragraph({alignment:'center',spacing:{after:500},children:[new TextRun({text:year,bold:true,font:'Arial',size:20,color:'334155'})]}),
   new Paragraph({alignment:'center',spacing:{before:500,after:200},children:[new TextRun({text:location.toUpperCase(),bold:true,font:'Arial',size:20,color:'64748B'})]}),
   new Paragraph({pageBreakBefore:true,children:[]}),
   // Encabezado institucional de la Página 2 (logo pequeño + textos centrados)
   ...(logoBuffer ? [new Paragraph({ alignment: 'center', spacing: { before: 100, after: 100 }, children: [new ImageRun({ data: logoBuffer, transformation: { width: 50, height: 50 }, type: 'png' })] })] : []),
   new Paragraph({ alignment: 'center', children: [new TextRun({ text: institution.toUpperCase(), bold: true, font: 'Arial', size: 19, color: '0F172A' })] }),
   ...(faculty ? [new Paragraph({ alignment: 'center', children: [new TextRun({ text: faculty.toUpperCase(), bold: true, font: 'Arial', size: 17, color: '334155' })] })] : []),
   ...(department ? [new Paragraph({ alignment: 'center', spacing: { after: 100 }, children: [new TextRun({ text: department.toUpperCase(), bold: true, font: 'Arial', size: 16, color: '475569' })] })] : []),
   new Paragraph({ alignment: 'center', spacing: { after: 300 }, children: [new TextRun({ text: 'SÍLABO', bold: true, font: 'Arial', size: 20, color: '0F172A' })] })
  );
 } else {
  children.push(
   new Paragraph({alignment:'center',children:[new TextRun({text:'SÍLABO',bold:true,font:'Arial',size:30,color:'14213D'})]}),
   new Paragraph({alignment:'center',children:[new TextRun({text:data.course || data.title,bold:true,font:'Arial',size:25})],spacing:{after:220}})
  );
 }

 for(const section of syllabusSections(data)){
  children.push(paragraph(section.title,{heading:true}));
  for(const block of section.blocks){
   if('text' in block) children.push(paragraph(block.text,{subtitle:block.subtitle,bullet:block.bullet}));
   else children.push(docxTable(block.headers,block.rows));
  }
 }

 if(citations.length){
  children.push(paragraph('Referencias bibliográficas',{subtitle:true}));
  for(const c of citations) children.push(paragraph(`[${c.reference}] ${c.name}${c.page?`, p. ${c.page}`:''}.`,{small:true}));
 }

 const doc = new Document({
  sections:[{
   footers:{default:new Footer({children:[new Paragraph({alignment:'center',children:[new TextRun({text:'Sílabo · Página ',font:'Arial',size:18,color:'64748B'}),new TextRun({children:[PageNumber.CURRENT],font:'Arial',size:18,color:'64748B'}),new TextRun({text:' de ',font:'Arial',size:18,color:'64748B'}),new TextRun({children:[PageNumber.TOTAL_PAGES],font:'Arial',size:18,color:'64748B'})]})]})},
   children
  }]
 });
 return Packer.toBuffer(doc);
}

export function renderSyllabusPdf(data:any,citations:any[]=[]):Promise<Buffer>{
 return new Promise((resolve,reject)=>{
  const doc=new PDFDocument({size:'A4',margins:{top:44,left:44,right:44,bottom:48},bufferPages:true});
  const chunks:Buffer[]=[];
  doc.on('data',b=>chunks.push(b));
  doc.on('error',reject);
  doc.on('end',()=>resolve(Buffer.concat(chunks)));
  const width=doc.page.width-88;

  try {
   const c = data.coverPage ?? {};
   const g = data.generalData ?? {};
   const institution = c.institution || g.institution;
   const faculty = c.faculty || (g.careers?.length ? `FACULTAD DE ${g.careers[0].toUpperCase()}` : '');
   const department = c.department || '';
   const courseTitle = c.course || data.course || data.title;
   const semester = c.semester || g.term || data.cycle || '';
   const year = c.year || '2026 – I';
   const location = c.location || 'ICA-PERÚ';
   const logoBuffer = c.logoBase64 ? Buffer.from(c.logoBase64, 'base64') : null;

   const room=(h:number)=>{if(doc.y+h>doc.page.height-56)doc.addPage();};
   const body=(val:unknown,sub=false,bullet=false)=>{
    room(sub?32:20);
    doc.font(sub?'Helvetica-Bold':'Helvetica').fontSize(sub?9.5:8.5).fillColor(sub?'#0F172A':'#334155');
    const prefix=bullet?'• ':'';
    doc.text(prefix+text(val),44,doc.y,{width,lineGap:1.5});
    doc.moveDown(sub?0.3:0.2);
   };
   const table=(t:{headers:string[];ratios:number[];rows:string[][]})=>{
    room(48);
    const colW=t.ratios.map(r=>r*width);
    const drawRow=(cells:string[],head=false)=>{
     const rowH=Math.max(...cells.map((cell,i)=>{
      doc.font(head?'Helvetica-Bold':'Helvetica').fontSize(head?8:7.5);
      return doc.heightOfString(cell,{width:colW[i]-8});
     }))+8;
     room(rowH+8);
     const startY=doc.y;
     if(head){
      doc.rect(44,startY,width,rowH).fill('#F8FAFC');
     }
     let currentX=44;
     cells.forEach((cell,i)=>{
      doc.rect(currentX,startY,colW[i],rowH).stroke('#E2E8F0');
      doc.font(head?'Helvetica-Bold':'Helvetica').fontSize(head?8:7.5).fillColor(head?'#0F172A':'#334155');
      doc.text(cell,currentX+4,startY+4,{width:colW[i]-8});
      currentX+=colW[i];
     });
     doc.y=startY+rowH;
    };
    drawRow(t.headers,true);
    for(const r of t.rows)drawRow(r,false);
    doc.moveDown(0.5);
   };

   // Portada si hay institución
   if (institution) {
    let topY = 70;
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#14213D').text(institution.toUpperCase(), 44, topY, { align: 'center', width });
    topY = doc.y + 6;
    if (faculty) {
     doc.font('Helvetica-Bold').fontSize(11).fillColor('#334155').text(faculty.toUpperCase(), 44, topY, { align: 'center', width });
     topY = doc.y + 4;
    }
    if (department) {
     doc.font('Helvetica-Bold').fontSize(10).fillColor('#64748B').text(department.toUpperCase(), 44, topY, { align: 'center', width });
     topY = doc.y + 24;
    } else {
     topY += 24;
    }
    if (logoBuffer) {
     doc.image(logoBuffer, (doc.page.width - 120) / 2, topY, { width: 120, height: 120 });
     topY += 136;
    } else {
     topY += 40;
    }
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#14213D').text('SILABO DE LA ASIGNATURA DE:', 44, topY, { align: 'center', width });
    topY = doc.y + 8;
    doc.font('Helvetica-Bold').fontSize(15).fillColor('#1E3A8A').text(courseTitle.toUpperCase(), 44, topY, { align: 'center', width });
    topY = doc.y + 10;
    if (semester) {
     doc.font('Helvetica-Bold').fontSize(10).fillColor('#334155').text(semester.toUpperCase(), 44, topY, { align: 'center', width });
     topY = doc.y + 4;
    }
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#334155').text(year, 44, topY, { align: 'center', width });
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#64748B').text(location.toUpperCase(), 44, doc.page.height - 70, { align: 'center', width });
    doc.addPage();

    // Encabezado Página 2
    const startY = 44;
    if (logoBuffer) {
     doc.image(logoBuffer, 44, startY, { width: 44, height: 44 });
    }
    const headerX = logoBuffer ? 96 : 44;
    const headerW = logoBuffer ? width - 52 : width;
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000').text(institution.toUpperCase(), headerX, startY, { align: 'center', width: headerW });
    if (faculty) doc.font('Helvetica-Bold').fontSize(9).fillColor('#000000').text(faculty.toUpperCase(), headerX, doc.y + 2, { align: 'center', width: headerW });
    if (department) doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#000000').text(department.toUpperCase(), headerX, doc.y + 2, { align: 'center', width: headerW });
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000').text('SÍLABO', headerX, doc.y + 6, { align: 'center', width: headerW });
    doc.y = Math.max(doc.y + 12, startY + 52);
    doc.moveDown(0.8);
   }

   // SECCIONES
   for(const section of syllabusSections(data)){
    room(60);
    doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#000000');
    doc.text(section.title, 44, doc.y, { width }).moveDown(0.4);
    for(const block of section.blocks){
     if('text' in block) body(block.text, block.subtitle, block.bullet);
     else table(block);
    }
    doc.moveDown(0.6);
   }

   if(citations.length){
    room(40);
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000').text('FUENTES CONSULTADAS', 44, doc.y, { width }).moveDown(0.3);
    for(const c of citations) body(`[${c.reference}] ${c.name}${c.page?`, p. ${c.page}`:''}.`, false, true);
   }

   // Pie de página
   const range = doc.bufferedPageRange();
   for(let i = range.start; i < range.start + range.count; i++){
    doc.switchToPage(i);
    doc.page.margins.bottom = 0;
    doc.font('Helvetica').fontSize(8).fillColor('#64748B').text(`Sílabo · ${i+1} / ${range.count}`, 44, doc.page.height - 24, { width, align: 'center', lineBreak: false });
   }
   doc.end();
  } catch(error) {
   doc.destroy();
   reject(error);
  }
 });
}
