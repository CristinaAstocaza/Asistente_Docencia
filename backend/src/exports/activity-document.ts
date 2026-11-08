// Actividad de aprendizaje con el mismo lenguaje visual de la sesión UNICA:
// banda de título, secciones numeradas, logro destacado, caso en recuadro, pasos numerados y checklist de entrega.
import PDFDocument from 'pdfkit';
import { AlignmentType, BorderStyle, Document, Footer, Header, Packer, PageNumber, Paragraph, ShadingType, TableRow, TextRun } from 'docx';
import { dirname, join } from 'node:path';
import { C, TW, bandDocx, borders, cell, gap, logoCell, logoRun, none, outcomeParts, para, plain, run, table } from './session-document';
import { unicaLogo } from './brand';

const PW = 595.28, PH = 841.89, X = 48, W = PW - 96, BOTTOM = PH - 62;
const TIP = { bg: 'EEF4FF', bar: '1565C0' };

function facts(d: any) {
 const week = d.sessionNumber ? `Semana ${d.sessionNumber}` : '';
 const sections: { key: string; title: string }[] = [
  { key: 'achievement', title: 'LOGRO A EVALUAR' }, { key: 'general', title: 'INDICACIÓN GENERAL' },
  ...(d.caseStudy?.title ? [{ key: 'case', title: 'CASO DE ESTUDIO' }] : []),
  { key: 'steps', title: 'INDICACIONES ESPECÍFICAS' },
  ...(d.recommendations?.length ? [{ key: 'tips', title: 'RECOMENDACIONES' }] : []),
  { key: 'submission', title: 'ENTREGA' }, { key: 'evaluation', title: 'CRITERIOS DE EVALUACIÓN' },
 ];
 return {
  heading: ['ACTIVIDAD DE APRENDIZAJE', week.toUpperCase()].filter(Boolean).join(' · '),
  title: plain(d.title),
  course: [d.courseCode, d.course].filter(Boolean).join(' – '),
  sub: [plain(d.unit), d.sessionTitle ? `Sesión: ${plain(d.sessionTitle)}` : ''].filter(Boolean).join('   ·   '),
  numbered: sections.map((s, i) => ({ ...s, title: `${i + 1}. ${s.title}` })),
  criteria: Array.isArray(d.rubric?.criteria) ? d.rubric.criteria as { name: string; value?: string }[] : [],
 };
}

/* ------------------------------------------------------------------ PDF */

export function renderActivityPdf(d: any, citations: any[] = []): Promise<Buffer> {
 return new Promise((resolve, reject) => {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 48, bottom: 40, left: X, right: X }, bufferPages: true, autoFirstPage: false, info: { Title: plain(d.title), Author: 'Asistente IA para Docentes' } });
  const fonts = join(dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts');
  doc.registerFont('S', join(fonts, 'LiberationSans-Regular.ttf')); doc.registerFont('S-B', join(fonts, 'LiberationSans-Bold.ttf'));
  const chunks: Buffer[] = []; doc.on('data', c => chunks.push(c)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);
  const F = facts(d);
  const f = (bold = false, size = 10, color = C.ink) => doc.font(bold ? 'S-B' : 'S').fontSize(size).fillColor(`#${color}`);
  // Body text: justified with ~1.5 line spacing.
  const gapOf = (size: number) => size * 0.5;
  const hOf = (text: string, width: number, bold = false, size = 10, justify = false) => { f(bold, size); return doc.heightOfString(text, { width, lineGap: justify ? gapOf(size) : 2 }); };
  const write = (text: string, x: number, y: number, width: number, o: { bold?: boolean; size?: number; color?: string; align?: 'left' | 'center' | 'right' | 'justify' } = {}) => {
   const size = o.size ?? 10; f(o.bold, size, o.color ?? C.ink).text(text, x, y, { width, lineGap: o.align === 'justify' ? gapOf(size) : 2, align: o.align ?? 'left' });
  };
  const pageTop = () => {
   doc.rect(0, 0, PW, 5).fill(`#${C.accent}`);
   const shield = unicaLogo(); if (shield) doc.image(shield, X, 11, { height: 18 });
   write('UNIVERSIDAD NACIONAL "SAN LUIS GONZAGA"', X + (shield ? 22 : 0), 18, W * 0.55, { bold: true, size: 7.5, color: C.navy });
   write([F.course, d.sessionNumber ? `Semana ${d.sessionNumber}` : ''].filter(Boolean).join(' · '), X + W * 0.45, 18, W * 0.55, { size: 7.5, color: C.muted, align: 'right' });
   doc.moveTo(X, 32).lineTo(X + W, 32).lineWidth(0.5).strokeColor(`#${C.line}`).stroke();
   doc.y = 46;
  };
  const newPage = () => { doc.addPage(); pageTop(); };
  const ensure = (height: number) => { if (doc.y + height > BOTTOM) newPage(); };
  const band = (key: string) => {
   const title = F.numbered.find(s => s.key === key)!.title;
   ensure(70); const y = doc.y + 8;
   doc.roundedRect(X, y, W, 22, 3).fill(`#${C.navy}`); doc.rect(X, y, 5, 22).fill(`#${C.accent}`);
   write(title, X + 14, y + 6, W - 24, { bold: true, size: 10.5, color: 'FFFFFF' }); doc.y = y + 32;
  };
  const paragraph = (text: string, size = 10.5) => { const h = hOf(text, W, false, size, true) + 8; ensure(Math.min(h, 120)); write(text, X, doc.y, W, { size, align: 'justify' }); doc.y += 8; };
  const block = (height: number, bg: string, bar: string, draw: (top: number) => void) => { ensure(height); const top = doc.y; doc.rect(X, top, W, height).fill(`#${bg}`); doc.rect(X, top, 4, height).fill(`#${bar}`); draw(top); doc.y = top + height; };

  try {
   newPage();
   const titleH = hOf(F.title, W - 120, true, 17);
   const subH = F.sub ? hOf(F.sub, W - 40, false, 9) + 10 : 0;
   const bannerH = 46 + titleH + subH + 18, by = doc.y;
   doc.roundedRect(X, by, W, bannerH, 6).fill(`#${C.accent}`);
   const shield = unicaLogo();
   if (shield) { doc.roundedRect(X + W - 78, by + 14, 62, 64, 6).fill('#FFFFFF'); doc.image(shield, X + W - 72, by + 18, { height: 56 }); }
   doc.rect(X + 20, by + 20, 34, 3).fill(`#${C.caseBar}`);
   write(F.heading, X + 20, by + 30, W - 40, { bold: true, size: 9.5, color: 'D1FAE5' });
   write(F.title, X + 20, by + 46, W - 120, { bold: true, size: 17, color: 'FFFFFF' });
   if (F.sub) write(F.sub, X + 20, by + 46 + titleH + 10, W - 40, { size: 9, color: 'E2E8F0' });
   doc.y = by + bannerH + 6;
   // Agreed details (modalidad, grupos, plazo…) right under the title.
   for (const c of (d.context || []).filter((x: any) => x?.title && x?.content)) {
    const label = plain(c.title), value = plain(c.content), lw = 150, rh = Math.max(hOf(label, lw - 16, true, 9.5), hOf(value, W - lw - 16, false, 9.5)) + 12;
    ensure(rh); const y = doc.y;
    doc.rect(X, y, lw, rh).fillAndStroke(`#${C.label}`, `#${C.line}`); doc.rect(X + lw, y, W - lw, rh).stroke(`#${C.line}`);
    write(label, X + 8, y + 6, lw - 16, { bold: true, size: 9.5, color: C.navy }); write(value, X + lw + 8, y + 6, W - lw - 16, { size: 9.5 }); doc.y = y + rh;
   }

   band('achievement');
   const outcome = plain(d.achievement), oh = hOf(outcome, W - 34, false, 11, true) + 20;
   block(oh, C.outcome, C.accent, top => write(outcome, X + 18, top + 10, W - 34, { size: 11, color: C.navy, align: 'justify' }));
   const parts = outcomeParts(d.achievement);
   if (parts) {
    doc.y += 6;
    const cells: [string, string, number][] = [['TIEMPO', parts.time, 0.2], ['SUJETO', parts.subject, 0.15], ['VERBO', parts.verb, 0.15], ['CONTENIDO Y CONDICIÓN', parts.rest, 0.5]];
    const ph = Math.max(...cells.map(([, v, r]) => hOf(v, W * r - 14, false, 8.5))) + 26; ensure(ph); const y = doc.y; let x = X;
    for (const [label, value, r] of cells) { const cw = W * r; doc.rect(x, y, cw, ph).stroke(`#${C.line}`); write(label, x + 7, y + 6, cw - 14, { bold: true, size: 6.5, color: C.accent }); write(value, x + 7, y + 17, cw - 14, { bold: label === 'VERBO', size: 8.5, color: label === 'VERBO' ? C.accent : C.ink }); x += cw; }
    doc.y = y + ph;
   }

   band('general');
   for (const p of plain(d.generalInstructions).split(/\n+/).filter(Boolean)) paragraph(p);

   if (d.caseStudy?.title) {
    const cs = d.caseStudy;
    band('case');
    const first = plain(cs.scenario).split(/\n+/).find(Boolean) || '';
    ensure(hOf(cs.title, W - 34, true, 12.5) + 30 + Math.min(hOf(first, W - 34, false, 10, true) + 8, 120));
    block(hOf(cs.title, W - 34, true, 12.5) + 24, C.caseBg, C.caseBar, top => write(plain(cs.title), X + 18, top + 10, W - 34, { bold: true, size: 12.5, color: C.navy }));
    for (const p of plain(cs.scenario).split(/\n+/).filter(Boolean)) block(hOf(p, W - 34, false, 10, true) + 8, C.caseBg, C.caseBar, top => write(p, X + 18, top + 2, W - 34, { size: 10, align: 'justify' }));
    if (cs.facts?.length) {
     block(18, C.caseBg, C.caseBar, top => write('Datos del caso', X + 18, top + 4, W - 34, { bold: true, size: 9, color: 'B26A00' }));
     for (const x of cs.facts) block(hOf(plain(x), W - 46, false, 9.5) + 5, C.caseBg, C.caseBar, top => { write('•', X + 20, top, 10, { bold: true, size: 9.5, color: 'B26A00' }); write(plain(x), X + 30, top, W - 46, { size: 9.5 }); });
    }
    if (cs.questions?.length) {
     block(20, C.caseBg, C.caseBar, top => write('Preguntas que debes responder', X + 18, top + 6, W - 34, { bold: true, size: 9, color: 'B26A00' }));
     cs.questions.forEach((q: string, i: number) => block(hOf(plain(q), W - 50, false, 9.5) + 5, C.caseBg, C.caseBar, top => { write(`${i + 1}.`, X + 18, top, 14, { bold: true, size: 9.5, color: 'B26A00' }); write(plain(q), X + 34, top, W - 50, { size: 9.5 }); }));
    }
    block(8, C.caseBg, C.caseBar, () => undefined);
   }

   band('steps');
   (d.specificInstructions || []).map(plain).forEach((step: string, i: number) => {
    const sh = Math.max(hOf(step, W - 44, false, 10, true), 18) + 12; ensure(sh); const y = doc.y;
    if (i % 2 === 0) doc.rect(X, y, W, sh).fill('#F8FAFC');
    doc.circle(X + 14, y + 13, 10).fill(`#${C.accent}`); write(String(i + 1), X + 4, y + 8, 20, { bold: true, size: 9.5, color: 'FFFFFF', align: 'center' });
    write(step, X + 34, y + 6, W - 44, { size: 10, align: 'justify' }); doc.y = y + sh;
   });

   if (d.recommendations?.length) {
    band('tips');
    for (const tip of d.recommendations.map(plain)) block(hOf(tip, W - 40, false, 10, true) + 10, TIP.bg, TIP.bar, top => { doc.rect(X + 14, top + 7, 6, 6).fill(`#${TIP.bar}`); write(tip, X + 28, top + 4, W - 40, { size: 10, align: 'justify' }); });
   }

   band('submission');
   for (const item of (d.submission || []).map(plain)) {
    const ih = hOf(item, W - 30, false, 10) + 9; ensure(ih); const y = doc.y;
    doc.roundedRect(X + 4, y + 2, 10, 10, 2).lineWidth(1).stroke(`#${C.accent}`); write(item, X + 24, y, W - 30, { size: 10 }); doc.y = y + ih;
   }

   band('evaluation');
   paragraph(plain(d.evaluation));

   const range = doc.bufferedPageRange();
   for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i); const margin = doc.page.margins.bottom; doc.page.margins.bottom = 0;
    doc.moveTo(X, PH - 44).lineTo(X + W, PH - 44).lineWidth(0.5).strokeColor(`#${C.line}`).stroke();
    f(false, 7.5, C.muted).text(`${F.heading}${F.course ? ` · ${F.course}` : ''}`.slice(0, 110), X, PH - 36, { width: W - 60, lineBreak: false });
    f(true, 7.5, C.muted).text(`${i + 1} / ${range.count}`, X + W - 60, PH - 36, { width: 60, align: 'right', lineBreak: false });
    doc.page.margins.bottom = margin;
   }
   doc.end();
  } catch (error) { doc.end(); reject(error); }
 });
}

/* ----------------------------------------------------------------- DOCX */

const justified = (text: string, o: { size?: number; color?: string; bold?: boolean; shade?: string; bar?: string; after?: number } = {}) => new Paragraph({
 children: [run(text, { size: o.size ?? 21, color: o.color, bold: o.bold })], alignment: AlignmentType.JUSTIFIED, spacing: { after: o.after ?? 100, line: 360 },
 shading: o.shade ? { type: ShadingType.CLEAR, color: 'auto', fill: o.shade } : undefined,
 border: o.bar ? { left: { style: BorderStyle.SINGLE, size: 24, color: o.bar, space: 8 } } : undefined,
});

export async function renderActivityDocx(d: any, citations: any[] = []) {
 const F = facts(d), children: any[] = [];
 const band = (key: string) => children.push(gap(140), bandDocx(F.numbered.find(s => s.key === key)!.title), gap(60));
 children.push(table([new TableRow({ children: [cell([
  para([run(F.heading, { bold: true, color: 'D1FAE5', size: 19 })], { after: 60, before: 80 }),
  para([run(F.title, { bold: true, color: 'FFFFFF', size: 32 })], { after: 80 }),
  ...(F.sub ? [para([run(F.sub, { color: 'E2E8F0', size: 18 })], { after: 80 })] : []),
 ], TW - 1500, { shade: C.accent, borders: { top: none, bottom: none, left: none, right: none } }), logoCell(C.accent)] })], [TW - 1500, 1500]));

 const context = (d.context || []).filter((x: any) => x?.title && x?.content);
 if (context.length) { const lw = 2800; children.push(gap(100), table(context.map((c: any) => new TableRow({ children: [cell([para([run(plain(c.title), { bold: true, color: C.navy, size: 19 })], { after: 0 })], lw, { shade: C.label }), cell([para([run(plain(c.content), { size: 19 })], { after: 0 })], TW - lw)] })), [lw, TW - lw])); }
 band('achievement');
 children.push(justified(plain(d.achievement), { size: 22, color: C.navy, shade: C.outcome, bar: C.accent }));
 const parts = outcomeParts(d.achievement);
 if (parts) {
  const widths = [0.2, 0.15, 0.15, 0.5].map(r => Math.round(TW * r));
  const cells: [string, string][] = [['TIEMPO', parts.time], ['SUJETO', parts.subject], ['VERBO', parts.verb], ['CONTENIDO Y CONDICIÓN', parts.rest]];
  children.push(table([new TableRow({ children: cells.map(([l, v], i) => cell([para([run(l, { bold: true, color: C.accent, size: 14 })], { after: 20 }), para([run(v, { bold: l === 'VERBO', color: l === 'VERBO' ? C.accent : C.ink, size: 17 })], { after: 0 })], widths[i])) })], widths));
 }
 band('general');
 for (const p of plain(d.generalInstructions).split(/\n+/).filter(Boolean)) children.push(justified(p));
 if (d.caseStudy?.title) {
  const cs = d.caseStudy, box = { shade: C.caseBg, barColor: C.caseBar };
  band('case');
  children.push(para([run(plain(cs.title), { bold: true, color: C.navy, size: 25 })], { ...box, after: 60 }));
  for (const p of plain(cs.scenario).split(/\n+/).filter(Boolean)) children.push(justified(p, { shade: C.caseBg, bar: C.caseBar, after: 60 }));
  if (cs.facts?.length) children.push(para([run('Datos del caso', { bold: true, color: 'B26A00', size: 18 })], { ...box, after: 20 }), ...cs.facts.map((x: string) => para([run('•  ', { bold: true, color: 'B26A00' }), run(plain(x), { size: 19 })], { ...box, after: 20 })));
  if (cs.questions?.length) children.push(para([run('Preguntas que debes responder', { bold: true, color: 'B26A00', size: 18 })], { ...box, after: 20 }), ...cs.questions.map((q: string, i: number) => para([run(`${i + 1}.  `, { bold: true, color: 'B26A00' }), run(plain(q), { size: 19 })], { ...box, after: 20 })));
 }
 band('steps');
 const sw = [700, TW - 700];
 children.push(table((d.specificInstructions || []).map((step: string, i: number) => new TableRow({ children: [
  cell([para([run(String(i + 1), { bold: true, color: 'FFFFFF', size: 22 })], { after: 0, align: AlignmentType.CENTER })], sw[0], { shade: C.accent, borders: { top: none, bottom: { style: BorderStyle.SINGLE, size: 12, color: 'FFFFFF' }, left: none, right: none } }),
  cell([justified(plain(step), { after: 0 })], sw[1], { shade: i % 2 ? undefined : 'F8FAFC', borders: { top: none, bottom: { style: BorderStyle.SINGLE, size: 4, color: C.line }, left: none, right: none } }),
 ] })), sw));
 if (d.recommendations?.length) { band('tips'); for (const tip of d.recommendations) children.push(justified(plain(tip), { shade: TIP.bg, bar: TIP.bar, after: 60 })); }
 band('submission');
 for (const item of d.submission || []) children.push(para([run('☐  ', { color: C.accent, size: 22, bold: true }), run(plain(item))], { after: 70 }));
 band('evaluation');
 children.push(justified(plain(d.evaluation)));
 return Packer.toBuffer(new Document({
  styles: { default: { document: { run: { font: 'Arial', size: 21 } } } },
  sections: [{
   properties: { page: { margin: { top: 1000, bottom: 900, left: 1000, right: 1000 } } },
   headers: { default: new Header({ children: [new Paragraph({ spacing: { after: 0 }, children: [...logoRun(22), run('  UNIVERSIDAD NACIONAL "SAN LUIS GONZAGA"', { bold: true, color: C.navy, size: 15 }), run(F.course ? `     ${F.course}` : '', { color: C.muted, size: 15 })] })] }) },
   footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `${F.heading} · `, size: 15, color: C.muted }), new TextRun({ children: [PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES], size: 15, color: C.muted })] })] }) },
   children,
  }],
 }));
}
