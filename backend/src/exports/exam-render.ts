import PDFDocument from 'pdfkit';
import { AlignmentType, BorderStyle, Document, Footer, ImageRun, Packer, PageNumber, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import { loadImage } from '@napi-rs/canvas';
import { brandDocxHeader, stampPdfHeaders, UNICA } from './brand';

type ExamQuestion = { type: string; question: string; options?: string[]; correctAnswer?: string; explanation?: string; subquestions?: { question: string; correctAnswer: string }[]; image?: { assetId: string; caption?: string } };
export type ExamAssets = Map<string, { bytes: Buffer; mime: string }>;
type ExamData = { title: string; duration?: number; instructions?: string; questions: ExamQuestion[] };

const clean = (value: unknown) => String(value ?? '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1').replace(/^#{1,6}\s+/gm, '').trim();
const letter = (i: number, upper = false) => String.fromCharCode((upper ? 65 : 97) + i);
const optionsOf = (q: ExamQuestion) => q.type === 'true_false' ? ['Verdadero', 'Falso'] : q.type === 'multiple_choice' ? q.options ?? [] : [];
const kindLabel = (q: ExamQuestion) => q.type === 'case_study' ? 'Caso práctico' : q.type === 'multiple_choice' ? 'Opción múltiple' : q.type === 'true_false' ? 'Verdadero o falso' : q.type === 'short_answer' ? 'Respuesta breve' : 'Desarrollo';
const DEFAULT_INSTRUCTIONS = 'Lea atentamente cada pregunta antes de responder. Desarrolle sus respuestas con orden, claridad y fundamento. No está permitido el uso de material de consulta salvo indicación del docente.';
const facts = (data: ExamData) => [
 ['Duración', data.duration ? `${data.duration} minutos` : '—'],
 ['N.° de preguntas', String(data.questions.length)],
 ['Modalidad', 'Individual'],
];

const NAVY = '#' + UNICA.navy, RED = '#' + UNICA.red, INK = '#1F2937', MUTED = '#64748B', LINE = '#CBD5E1';

/** Formal written exam (or its answer key) with the UNICA header; no ruled answer lines. */
export function renderExamPdf(data: ExamData, answerKey = false, assets: ExamAssets = new Map()): Promise<Buffer> {
 return new Promise((resolve, reject) => {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 58, left: 56, right: 56, bottom: 60 }, bufferPages: true }); const chunks: Buffer[] = [];
  doc.on('data', b => chunks.push(b)); doc.on('error', reject); doc.on('end', () => resolve(Buffer.concat(chunks)));
  const L = 56, width = doc.page.width - 112, bottom = () => doc.page.height - 60;
  const ensure = (needed: number) => { if (doc.y + needed > bottom() && doc.y > 90) doc.addPage(); };
  const text = (value: string, opts: { bold?: boolean; size?: number; color?: string; indent?: number; align?: 'left' | 'justify' | 'center' } = {}) => {
   const content = clean(value), size = opts.size ?? 10.5, indent = opts.indent ?? 0;
   doc.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size);
   ensure(Math.min(doc.heightOfString(content, { width: width - indent, lineGap: 3 }) + 6, 90));
   doc.fillColor(opts.color ?? INK).text(content, L + indent, doc.y, { width: width - indent, lineGap: 3, align: opts.align ?? 'justify' }); doc.x = L;
  };
  const box = (title: string, body: string, fill: string, stroke: string) => {
   doc.font('Helvetica').fontSize(10); const h = doc.heightOfString(clean(body), { width: width - 24, lineGap: 3 }) + 34;
   ensure(Math.min(h, 200)); const y = doc.y;
   if (h < bottom() - y) { doc.rect(L, y, width, h).fillAndStroke(fill, stroke); doc.font('Helvetica-Bold').fontSize(9).fillColor(NAVY).text(title.toUpperCase(), L + 12, y + 9, { width: width - 24 }); doc.font('Helvetica').fontSize(10).fillColor(INK).text(clean(body), L + 12, y + 24, { width: width - 24, lineGap: 3, align: 'justify' }); doc.y = y + h; }
   else { text(title.toUpperCase(), { bold: true, size: 9, color: NAVY }); text(body, { size: 10 }); }
   doc.x = L; doc.moveDown(.8);
  };
  try {
   doc.font('Helvetica-Bold').fontSize(13).fillColor(NAVY).text(answerKey ? 'SOLUCIONARIO DE LA EVALUACIÓN' : 'EVALUACIÓN ESCRITA', L, doc.y + 4, { width, align: 'center', characterSpacing: 1 });
   doc.moveDown(.3).font('Helvetica-Bold').fontSize(15).fillColor(INK).text(clean(data.title), { width, align: 'center', lineGap: 2 });
   doc.moveDown(.8);
   // Exam facts: a single bordered row, like an institutional exam sheet.
   { const y = doc.y, cols = facts(data), cw = width / cols.length;
     cols.forEach(([k, v], i) => { doc.rect(L + i * cw, y, cw, 34).stroke(LINE); doc.font('Helvetica').fontSize(7.5).fillColor(MUTED).text(k.toUpperCase(), L + i * cw + 10, y + 6, { width: cw - 20 }); doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(v, L + i * cw + 10, y + 18, { width: cw - 20 }); });
     doc.y = y + 42; doc.x = L; }
   box('Instrucciones', data.instructions || DEFAULT_INSTRUCTIONS, '#F8FAFC', LINE);
   for (const [i, q] of data.questions.entries()) {
    ensure(110);
    const y = doc.y; doc.rect(L, y, width, 22).fill('#EEF2F7');
    doc.font('Helvetica-Bold').fontSize(10).fillColor(NAVY).text(`PREGUNTA ${i + 1}`, L + 10, y + 6, { lineBreak: false });
    doc.font('Helvetica').fontSize(8.5).fillColor(MUTED).text(kindLabel(q).toUpperCase(), L + 10, y + 7, { width: width - 20, align: 'right', lineBreak: false });
    doc.rect(L, y, 3, 22).fill(RED); doc.x = L; doc.y = y + 30;
    if (q.type === 'case_study') box('Situación', q.question, '#FFFFFF', LINE); else { text(q.question); doc.moveDown(.5); }
    const figure = q.image && assets.get(q.image.assetId);
    if (figure) {
     try {
      const img = (doc as any).openImage(figure.bytes), scale = Math.min((width - 40) / img.width, 240 / img.height, 1.5), w = img.width * scale, h = img.height * scale;
      ensure(h + 30); const y = doc.y; doc.image(figure.bytes, L + (width - w) / 2, y, { width: w, height: h }); doc.rect(L + (width - w) / 2, y, w, h).lineWidth(.5).stroke(LINE);
      doc.y = y + h + 4; doc.font('Helvetica-Oblique').fontSize(8).fillColor(MUTED).text(`Figura ${i + 1}${q.image!.caption ? ` · ${clean(q.image!.caption)}` : ''}`, L, doc.y, { width, align: 'center' }); doc.x = L; doc.moveDown(.6);
     } catch { /* unreadable image: the question keeps its text */ }
    }
    for (const [index, option] of optionsOf(q).entries()) { text(`${letter(index, true)})  ${clean(option)}`, { indent: 14, align: 'left' }); doc.moveDown(.25); }
    for (const [index, sub] of (q.subquestions ?? []).entries()) {
     text(`${letter(index)})  ${clean(sub.question)}`, { indent: 14 }); doc.moveDown(.3);
     if (answerKey) { text(`Respuesta: ${clean(sub.correctAnswer)}`, { indent: 28, size: 9.5, color: '#065F46' }); doc.moveDown(.3); }
    }
    if (answerKey && !q.subquestions?.length) { doc.moveDown(.2); box('Respuesta esperada', [q.correctAnswer, q.explanation].filter(Boolean).map(clean).join('\n\n'), '#ECFDF5', '#A7F3D0'); }
    else if (answerKey && q.explanation) { text(`Criterio: ${clean(q.explanation)}`, { indent: 14, size: 9.5, color: MUTED }); }
    doc.moveDown(1);
   }
   ensure(40); doc.moveDown(.5).font('Helvetica-Oblique').fontSize(9).fillColor(MUTED).text(answerKey ? 'Documento de uso exclusivo del docente.' : '— Fin de la evaluación —', L, doc.y, { width, align: 'center' });
   stampPdfHeaders(doc, answerKey ? 'Solucionario' : 'Evaluación escrita');
   const range = doc.bufferedPageRange();
   for (let p = range.start; p < range.start + range.count; p++) { doc.switchToPage(p); doc.page.margins.bottom = 0; doc.moveTo(L, doc.page.height - 42).lineTo(L + width, doc.page.height - 42).lineWidth(.5).strokeColor(LINE).stroke(); doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(`Página ${p + 1} de ${range.count}`, L, doc.page.height - 32, { width, align: 'center', lineBreak: false }); }
   doc.end();
  } catch (error) { doc.destroy(); reject(error); }
 });
}

const run = (text: string, o: { bold?: boolean; size?: number; color?: string; italics?: boolean } = {}) => new TextRun({ text, bold: o.bold, italics: o.italics, size: o.size ?? 21, color: o.color ?? '1F2937', font: 'Arial' });
const para = (children: TextRun[], o: { align?: (typeof AlignmentType)[keyof typeof AlignmentType]; after?: number; indent?: number; keepNext?: boolean } = {}) => new Paragraph({ alignment: o.align ?? AlignmentType.JUSTIFIED, spacing: { after: o.after ?? 120, line: 276 }, indent: o.indent ? { left: o.indent } : undefined, keepNext: o.keepNext, children });
const lines = (text: string, o: Parameters<typeof run>[1] = {}, p: Parameters<typeof para>[1] = {}) => clean(text).split(/\n+/).map(t => para([run(t, o)], p));
const border = (color: string) => ({ style: BorderStyle.SINGLE, size: 6, color });
const allBorders = (color: string) => ({ top: border(color), bottom: border(color), left: border(color), right: border(color) });
const boxed = (title: string, body: string, fill: string, stroke: string) => new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ cantSplit: body.length < 1500, children: [new TableCell({ shading: { type: ShadingType.CLEAR, fill, color: 'auto' }, borders: allBorders(stroke), margins: { top: 120, bottom: 120, left: 160, right: 160 }, children: [para([run(title.toUpperCase(), { bold: true, size: 17, color: UNICA.navy })], { after: 80 }), ...lines(body, { size: 20 })] })] })] });
const spacer = (after = 160) => new Paragraph({ spacing: { after }, children: [] });

/** Word version of the formal exam, matching the PDF layout. */
export async function renderExamDocx(data: ExamData, answerKey = false, assets: ExamAssets = new Map()) {
 const children: (Paragraph | Table)[] = [
  para([run(answerKey ? 'SOLUCIONARIO DE LA EVALUACIÓN' : 'EVALUACIÓN ESCRITA', { bold: true, size: 26, color: UNICA.navy })], { align: AlignmentType.CENTER, after: 60 }),
  para([run(clean(data.title), { bold: true, size: 30 })], { align: AlignmentType.CENTER, after: 240 }),
  new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ children: facts(data).map(([k, v]) => new TableCell({ borders: allBorders('CBD5E1'), margins: { top: 80, bottom: 80, left: 140, right: 140 }, children: [para([run(k.toUpperCase(), { size: 15, color: '64748B' })], { after: 20, align: AlignmentType.LEFT }), para([run(v, { bold: true, size: 21 })], { after: 0, align: AlignmentType.LEFT })] })) })] }),
  spacer(180),
  boxed('Instrucciones', data.instructions || DEFAULT_INSTRUCTIONS, 'F8FAFC', 'CBD5E1'), spacer(240),
 ];
 for (const [i, q] of data.questions.entries()) {
  children.push(new Paragraph({ keepNext: true, spacing: { before: 120, after: 140 }, shading: { type: ShadingType.CLEAR, fill: 'EEF2F7', color: 'auto' }, border: { left: { style: BorderStyle.SINGLE, size: 24, color: UNICA.red, space: 6 } }, children: [run(`PREGUNTA ${i + 1}`, { bold: true, size: 20, color: UNICA.navy }), run(`   ·   ${kindLabel(q)}`, { size: 17, color: '64748B' })] }));
  if (q.type === 'case_study') children.push(boxed('Situación', q.question, 'FFFFFF', 'CBD5E1'), spacer(120)); else children.push(...lines(q.question));
  const figure = q.image && assets.get(q.image.assetId);
  if (figure) {
   try {
    const size = await loadImage(figure.bytes), scale = Math.min(420 / size.width, 260 / size.height, 1.5);
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80, after: 40 }, children: [new ImageRun({ type: figure.mime === 'image/png' ? 'png' : 'jpg', data: figure.bytes, transformation: { width: Math.round(size.width * scale), height: Math.round(size.height * scale) } })] }));
    children.push(para([run(`Figura ${i + 1}${q.image!.caption ? ` · ${clean(q.image!.caption)}` : ''}`, { italics: true, size: 16, color: '64748B' })], { align: AlignmentType.CENTER }));
   } catch { /* unreadable image */ }
  }
  for (const [index, option] of optionsOf(q).entries()) children.push(para([run(`${letter(index, true)})  `, { bold: true }), run(clean(option))], { indent: 360, align: AlignmentType.LEFT, after: 60 }));
  for (const [index, sub] of (q.subquestions ?? []).entries()) {
   children.push(para([run(`${letter(index)})  `, { bold: true }), run(clean(sub.question))], { indent: 360 }));
   if (answerKey) children.push(para([run('Respuesta: ', { bold: true, size: 19, color: '065F46' }), run(clean(sub.correctAnswer), { size: 19, color: '065F46' })], { indent: 720 }));
  }
  if (answerKey && !q.subquestions?.length) children.push(boxed('Respuesta esperada', [q.correctAnswer, q.explanation].filter(Boolean).map(clean).join('\n'), 'ECFDF5', 'A7F3D0'));
  else if (answerKey && q.explanation) children.push(para([run(`Criterio: ${clean(q.explanation)}`, { size: 19, color: '64748B' })], { indent: 360 }));
  children.push(spacer(220));
 }
 children.push(para([run(answerKey ? 'Documento de uso exclusivo del docente.' : '— Fin de la evaluación —', { italics: true, size: 18, color: '64748B' })], { align: AlignmentType.CENTER }));
 return Packer.toBuffer(new Document({ styles: { default: { document: { run: { font: 'Arial', size: 21 } } } }, sections: [{
  properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1300, bottom: 1000, left: 1130, right: 1130, header: 500 } } },
  headers: { default: brandDocxHeader(answerKey ? 'Solucionario' : 'Evaluación escrita') },
  footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: ['Página ', PageNumber.CURRENT, ' de ', PageNumber.TOTAL_PAGES], size: 16, color: '64748B', font: 'Arial' })] })] }) },
  children,
 }] }));
}
