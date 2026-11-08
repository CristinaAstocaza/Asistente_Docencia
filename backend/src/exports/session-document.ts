// Sesión de aprendizaje con la plantilla de la Guía Metodológica UNICA (R.R. N° 2210-R-UNICA-2025, 2.5),
// maquetada para leerse con facilidad: bandas de sección, logro destacado, caso en recuadro y momentos por color.
import PDFDocument from 'pdfkit';
import { AlignmentType, BorderStyle, Document, Footer, Header, ImageRun, Packer, PageNumber, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, VerticalAlign, WidthType } from 'docx';
import { dirname, join } from 'node:path';
import { loadImage } from '@napi-rs/canvas';
import { unicaLogo, UNICA_LOGO_SIZE } from './brand';

type Asset = { bytes: Buffer; mime: string };
export type CaseStudy = { title: string; hook?: string; scenario: string; facts?: string[]; questions?: string[] };

export const C = { navy: '14213D', accent: '157568', ink: '1F2937', muted: '64748B', line: 'CBD5E1', label: 'F1F5F9', head: 'E2E8F0', outcome: 'EAF4F1', caseBg: 'FFF8E7', caseBar: 'D49A3A' };
export const momentColors: Record<string, { bar: string; bg: string }> = {
 Inicio: { bar: '2E7D32', bg: 'E8F5E9' }, Desarrollo: { bar: '1565C0', bg: 'E3F2FD' }, Cierre: { bar: 'B26A00', bg: 'FFF3E0' },
};
export const plain = (s: unknown) => String(s ?? '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1').trim();

/** "**Título**: descripción" → { title, body }. */
export function splitActivity(text: unknown) {
 const m = String(text ?? '').match(/^\s*\*{0,2}([^:*\n]{3,90}?)\*{0,2}\s*:\s*([\s\S]+)$/);
 return m ? { title: plain(m[1]), body: plain(m[2]) } : { title: '', body: plain(text) };
}

/** Estructura del logro según la guía: Tiempo + Sujeto + Verbo + Contenido y condición. */
export function outcomeParts(outcome: unknown) {
 const m = plain(outcome).match(/^(.*?),?\s*(el estudiante|la estudiante|los estudiantes)\s+(\S+)\s+([\s\S]+)$/i);
 if (!m) return null;
 return { time: m[1].replace(/,$/, '').trim() || 'Al finalizar la sesión', subject: m[2][0].toUpperCase() + m[2].slice(1), verb: m[3].replace(/[,.;:]$/, ''), rest: m[4] };
}

function facts(d: any) {
 const n = d.sessionNumber;
 return {
  heading: n ? `SESIÓN DE APRENDIZAJE N° ${n}` : 'SESIÓN DE APRENDIZAJE',
  title: plain(d.sessionTitle || d.topic || d.title),
  course: [d.courseCode, d.course].filter(Boolean).join(' – ') || plain(d.area),
  unit: plain(d.unit || d.area),
  session: [n ? `Sesión N° ${n}` : '', plain(d.sessionTitle || d.topic)].filter(Boolean).join(': '),
  duration: `${d.duration} minutos`,
  evidence: (d.evidence?.length ? d.evidence : [d.assessment]).map(plain).filter(Boolean) as string[],
  bibliography: (d.bibliography?.length ? d.bibliography : ['Consulta las fuentes indicadas al final del documento.']).map(plain) as string[],
  caseStudy: d.caseStudy?.title ? d.caseStudy as CaseStudy : null,
 };
}

/* ------------------------------------------------------------------ PDF */

const PW = 595.28, PH = 841.89, X = 48, W = PW - 96, BOTTOM = PH - 62;

export function renderSessionPdf(d: any, assets: Map<string, Asset> = new Map(), citations: any[] = []): Promise<Buffer> {
 return new Promise((resolve, reject) => {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 48, bottom: 40, left: X, right: X }, bufferPages: true, autoFirstPage: false, info: { Title: plain(d.title), Author: 'Asistente IA para Docentes' } });
  const fonts = join(dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts');
  doc.registerFont('S', join(fonts, 'LiberationSans-Regular.ttf')); doc.registerFont('S-B', join(fonts, 'LiberationSans-Bold.ttf'));
  const chunks: Buffer[] = []; doc.on('data', c => chunks.push(c)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);
  const F = facts(d);
  const f = (bold = false, size = 10, color = C.ink) => doc.font(bold ? 'S-B' : 'S').fontSize(size).fillColor(`#${color}`);
  const hOf = (text: string, width: number, bold = false, size = 10, gap = 2) => { f(bold, size); return doc.heightOfString(text, { width, lineGap: gap }); };
  const write = (text: string, x: number, y: number, width: number, bold = false, size = 10, color = C.ink, align: 'left' | 'center' | 'right' = 'left') => { f(bold, size, color).text(text, x, y, { width, lineGap: 2, align }); };
  const pageTop = () => {
   doc.rect(0, 0, PW, 5).fill(`#${C.accent}`);
   const shield = unicaLogo(); if (shield) doc.image(shield, X, 11, { height: 18 });
   write('UNIVERSIDAD NACIONAL "SAN LUIS GONZAGA"', X + (shield ? 22 : 0), 18, W * 0.55, true, 7.5, C.navy);
   write([F.course, d.sessionNumber ? `Semana ${d.sessionNumber}` : ''].filter(Boolean).join(' · '), X + W * 0.45, 18, W * 0.55, false, 7.5, C.muted, 'right');
   doc.moveTo(X, 32).lineTo(X + W, 32).lineWidth(0.5).strokeColor(`#${C.line}`).stroke();
   doc.y = 46;
  };
  const newPage = () => { doc.addPage(); pageTop(); };
  const ensure = (height: number) => { if (doc.y + height > BOTTOM) newPage(); };
  const band = (title: string) => {
   ensure(70); const y = doc.y + 6;
   doc.roundedRect(X, y, W, 22, 3).fill(`#${C.navy}`); doc.rect(X, y, 5, 22).fill(`#${C.accent}`);
   write(title, X + 14, y + 6, W - 24, true, 10.5, 'FFFFFF'); doc.y = y + 32;
  };

  try {
   newPage();
   // Title banner
   const sub = [F.unit, F.duration].filter(Boolean).join('   ·   ');
   const titleH = hOf(F.title, W - 120, true, 17, 3);
   const bannerH = 30 + 16 + titleH + 12 + hOf(sub, W - 40, false, 9) + 18;
   doc.roundedRect(X, doc.y, W, bannerH, 6).fill(`#${C.navy}`);
   const by = doc.y;
   const shield = unicaLogo();
   if (shield) { doc.roundedRect(X + W - 78, by + 14, 62, 64, 6).fill('#FFFFFF'); doc.image(shield, X + W - 72, by + 18, { height: 56 }); }
   doc.rect(X + 20, by + 20, 34, 3).fill(`#${C.caseBar}`);
   write(F.heading, X + 20, by + 30, W - 40, true, 9.5, 'A7F3D0');
   write(F.title, X + 20, by + 46, W - 120, true, 17, 'FFFFFF');
   write(sub, X + 20, by + 46 + titleH + 12, W - 40, false, 9, 'CBD5E1');
   doc.y = by + bannerH + 10;

   // I. Datos informativos
   band('I. DATOS INFORMATIVOS GENERALES');
   const rows: [string, string][] = [['Curso', F.course], ['Unidad N° y Título', F.unit], ['Sesión N° y Título', F.session], ['Duración de la Sesión', F.duration]];
   const lw = 140;
   for (const [label, value] of rows) {
    const rh = Math.max(hOf(label, lw - 16, true, 9.5), hOf(value, W - lw - 16, false, 9.5)) + 12;
    ensure(rh); const y = doc.y;
    doc.rect(X, y, lw, rh).fillAndStroke(`#${C.label}`, `#${C.line}`); doc.rect(X + lw, y, W - lw, rh).stroke(`#${C.line}`);
    write(label, X + 8, y + 6, lw - 16, true, 9.5, C.navy); write(value, X + lw + 8, y + 6, W - lw - 16, false, 9.5);
    doc.y = y + rh;
   }
   doc.y += 6;

   // II. Logro
   band('II. LOGRO DE APRENDIZAJE');
   const outcome = plain(d.outcome), oh = hOf(outcome, W - 34, false, 11, 3) + 20;
   ensure(oh); let y = doc.y;
   doc.rect(X, y, W, oh).fill(`#${C.outcome}`); doc.rect(X, y, 4, oh).fill(`#${C.accent}`);
   write(outcome, X + 18, y + 10, W - 34, false, 11, C.navy); doc.y = y + oh + 8;
   const parts = outcomeParts(d.outcome);
   if (parts) {
    const cells: [string, string, number][] = [['TIEMPO', parts.time, 0.2], ['SUJETO', parts.subject, 0.15], ['VERBO', parts.verb, 0.15], ['CONTENIDO Y CONDICIÓN', parts.rest, 0.5]];
    const ph = Math.max(...cells.map(([, v, r]) => hOf(v, W * r - 14, false, 8.5))) + 26;
    ensure(ph); y = doc.y; let x = X;
    for (const [label, value, r] of cells) {
     const cw = W * r; doc.rect(x, y, cw, ph).stroke(`#${C.line}`);
     write(label, x + 7, y + 6, cw - 14, true, 6.5, C.accent); write(value, x + 7, y + 17, cw - 14, label === 'VERBO', 8.5, label === 'VERBO' ? C.accent : C.ink);
     x += cw;
    }
    doc.y = y + ph + 6;
   }

   // III. Evidencias
   band('III. EVIDENCIAS DE APRENDIZAJE');
   for (const item of F.evidence) {
    const eh = hOf(item, W - 26, false, 10) + 8; ensure(eh); y = doc.y;
    doc.roundedRect(X + 4, y + 3, 8, 8, 2).fill(`#${C.accent}`); write(item, X + 22, y, W - 26, false, 10); doc.y = y + eh;
   }
   doc.y += 4;

   // IV. Secuencia didáctica
   band('IV. SECUENCIA DIDÁCTICA Y METODOLOGÍA (Durante la sesión)');
   const stages: any[] = d.stages || [], total = stages.reduce((s, x) => s + (Number(x.minutes) || 0), 0) || 1;
   ensure(40); y = doc.y; let bx = X;
   write('Distribución del tiempo', X, y, W, true, 8, C.muted); y += 13;
   stages.forEach((s, i) => {
    const color = momentColors[s.name] || momentColors.Desarrollo, bw = i === stages.length - 1 ? X + W - bx : Math.round(W * (s.minutes / total));
    doc.rect(bx, y, bw, 16).fill(`#${color.bar}`); write(`${s.name} · ${s.minutes} min`, bx + 4, y + 4, bw - 8, true, 7.5, 'FFFFFF', 'center'); bx += bw;
   });
   doc.y = y + 26;
   const cw = [86, W - 86 - 48 - 112, 48, 112], cx = [X, X + cw[0], X + cw[0] + cw[1], X + cw[0] + cw[1] + cw[2]];
   const tableHead = () => {
    const hh = 26; ensure(hh + 60); const ty = doc.y;
    ['Momento pedagógico', 'Actividades de aprendizaje', 'Tiempo', 'Recursos y materiales'].forEach((t, i) => { doc.rect(cx[i], ty, cw[i], hh).fillAndStroke(`#${C.head}`, `#${C.line}`); write(t, cx[i] + 5, ty + 5, cw[i] - 10, true, 8, C.navy, 'center'); });
    doc.y = ty + hh;
   };
   tableHead();
   for (const s of stages) {
    const color = momentColors[s.name] || momentColors.Desarrollo;
    const items = (s.activities || []).map(splitActivity).map((a: any) => ({ ...a, h: (a.title ? hOf(a.title, cw[1] - 14, true, 9) + 2 : 0) + hOf(a.body, cw[1] - 14, false, 9) + 9 }));
    const resources = (s.resources || []).map(plain).filter(Boolean) as string[];
    const resH = resources.reduce((h: number, r: string) => h + hOf(`• ${r}`, cw[3] - 12, false, 8.5) + 3, 0);
    let index = 0, first = true;
    while (index < items.length || first) {
     let room = BOTTOM - doc.y - 10, take = 0, used = 0;
     while (index + take < items.length && used + items[index + take].h <= room) { used += items[index + take].h; take++; }
     if (take === 0 && items.length) { if (room > 200 && items[index].h > room) { take = 1; used = items[index].h; } else { newPage(); tableHead(); continue; } }
     const rh = Math.max(used, first ? resH : 0, 46) + 12, ty = doc.y;
     doc.rect(cx[0], ty, cw[0], rh).fillAndStroke(`#${color.bg}`, `#${C.line}`); doc.rect(cx[0], ty, 4, rh).fill(`#${color.bar}`);
     write(first ? s.name : `${s.name} (continúa)`, cx[0] + 10, ty + 8, cw[0] - 14, true, 10, color.bar);
     for (let i = 1; i < 4; i++) doc.rect(cx[i], ty, cw[i], rh).stroke(`#${C.line}`);
     let iy = ty + 7;
     for (const a of items.slice(index, index + take)) {
      if (a.title) { write(a.title, cx[1] + 7, iy, cw[1] - 14, true, 9, C.navy); iy += hOf(a.title, cw[1] - 14, true, 9) + 2; }
      write(a.body, cx[1] + 7, iy, cw[1] - 14, false, 9); iy += hOf(a.body, cw[1] - 14, false, 9) + 9;
     }
     if (first) {
      write(String(s.minutes), cx[2], ty + 8, cw[2], true, 15, color.bar, 'center'); write('min', cx[2], ty + 27, cw[2], false, 8, C.muted, 'center');
      let ry = ty + 7; for (const r of resources) { write(`• ${r}`, cx[3] + 6, ry, cw[3] - 12, false, 8.5); ry += hOf(`• ${r}`, cw[3] - 12, false, 8.5) + 3; }
     }
     doc.y = ty + rh; index += take; first = false;
     if (!items.length) break;
     if (index < items.length) { newPage(); tableHead(); }
    }
   }
   if (d.methodology) {
    const text = plain(d.methodology), mh = hOf(text, W - 20, false, 9.5) + 26; ensure(mh); y = doc.y + 8;
    write('Estrategia metodológica', X, y, W, true, 9, C.accent); write(text, X, y + 13, W, false, 9.5); doc.y = y + mh;
   }

   // Caso de estudio: recurso del Desarrollo (el Inicio solo usa su versión breve).
   if (F.caseStudy) {
    const cs = F.caseStudy;
    const block = (height: number, draw: (top: number) => void) => { ensure(height); const top = doc.y; doc.rect(X, top, W, height).fill(`#${C.caseBg}`); doc.rect(X, top, 4, height).fill(`#${C.caseBar}`); draw(top); doc.y = top + height; };
    doc.y += 6;
    // The case heading always stays on the same page as the start of the scenario.
    const firstParagraph = plain(cs.scenario).split(/\n+/).find(Boolean) || '';
    ensure(hOf(cs.title, W - 34, true, 12.5) + 30 + Math.min(hOf(firstParagraph, W - 34, false, 10, 3) + 8, 120));
    block(hOf(cs.title, W - 34, true, 12.5) + 30, top => { write('CASO DE ESTUDIO · SE ANALIZA EN EL DESARROLLO', X + 18, top + 10, W - 34, true, 7.5, 'B26A00'); write(cs.title, X + 18, top + 22, W - 34, true, 12.5, C.navy); });
    if (cs.hook) { const hook = `Gancho para el Inicio: ${plain(cs.hook)}`; block(hOf(hook, W - 34, true, 9.5, 2) + 10, top => write(hook, X + 18, top + 2, W - 34, true, 9.5, '7A4B00')); }
    for (const p of plain(cs.scenario).split(/\n+/).filter(Boolean)) block(hOf(p, W - 34, false, 10, 3) + 8, top => write(p, X + 18, top + 2, W - 34, false, 10));
    if (cs.facts?.length) {
     block(18, top => write('Datos del caso', X + 18, top + 4, W - 34, true, 9, 'B26A00'));
     for (const fct of cs.facts) block(hOf(fct, W - 46, false, 9.5) + 5, top => { write('•', X + 20, top, 10, true, 9.5, 'B26A00'); write(plain(fct), X + 30, top, W - 46, false, 9.5); });
    }
    if (cs.questions?.length) {
     block(20, top => write('Preguntas para el análisis', X + 18, top + 6, W - 34, true, 9, 'B26A00'));
     cs.questions.forEach((q, i) => block(hOf(q, W - 50, false, 9.5) + 5, top => { write(`${i + 1}.`, X + 18, top, 14, true, 9.5, 'B26A00'); write(plain(q), X + 34, top, W - 50, false, 9.5); }));
    }
    block(8, () => undefined);
    doc.y += 4;
   }

   // V. Evaluación
   band('V. EVALUACIÓN DE APRENDIZAJE');
   const cards: [string, string][] = [['¿Qué se evalúa?', plain(d.assessment)], ['Tipo de evaluación', plain(d.evaluationType) || 'Formativa'], ['Instrumento', plain(d.instrument) || 'Rúbrica']];
   const cwid = (W - 16) / 3, chh = Math.max(...cards.map(([, v]) => hOf(v, cwid - 20, false, 9.5))) + 34;
   ensure(chh); y = doc.y;
   cards.forEach(([label, value], i) => { const x = X + i * (cwid + 8); doc.roundedRect(x, y, cwid, chh, 5).fillAndStroke('#F8FAFC', `#${C.line}`); doc.rect(x, y, cwid, 3).fill(`#${C.accent}`); write(label.toUpperCase(), x + 10, y + 10, cwid - 20, true, 7.5, C.accent); write(value, x + 10, y + 24, cwid - 20, false, 9.5); });
   doc.y = y + chh + 6;

   // VI. Bibliografía
   band('VI. BIBLIOGRAFÍA');
   for (const ref of F.bibliography) { const rh = hOf(ref, W - 18, false, 9.5) + 6; ensure(rh); y = doc.y; write(ref, X + 18, y, W - 18, false, 9.5); doc.rect(X + 4, y + 4, 5, 5).fill(`#${C.muted}`); doc.y = y + rh; }

   const images = (d.images || []).filter((i: any) => assets.has(i.assetId));
   if (images.length) {
    band('RECURSOS VISUALES');
    for (const img of images) { ensure(290); y = doc.y; doc.image(assets.get(img.assetId)!.bytes, X, y, { fit: [W * (img.width || 100) / 100, 250], align: 'center' }); write(plain(img.caption || 'Imagen educativa'), X, y + 256, W, false, 8.5, C.muted, 'center'); doc.y = y + 280; }
   }

   const range = doc.bufferedPageRange();
   for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i); const margin = doc.page.margins.bottom; doc.page.margins.bottom = 0;
    doc.moveTo(X, PH - 44).lineTo(X + W, PH - 44).lineWidth(0.5).strokeColor(`#${C.line}`).stroke();
    f(false, 7.5, C.muted).text(`${F.heading} · ${F.course}`.slice(0, 110), X, PH - 36, { width: W - 60, lineBreak: false });
    f(true, 7.5, C.muted).text(`${i + 1} / ${range.count}`, X + W - 60, PH - 36, { width: 60, align: 'right', lineBreak: false });
    doc.page.margins.bottom = margin;
   }
   doc.end();
  } catch (error) { doc.end(); reject(error); }
 });
}

/* ----------------------------------------------------------------- DOCX */

export const TW = 9906; // usable width in twips (A4, 1000 margins)
export const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const thin = { style: BorderStyle.SINGLE, size: 4, color: C.line };
export const borders = { top: thin, bottom: thin, left: thin, right: thin };
export const run = (text: string, o: { bold?: boolean; size?: number; color?: string } = {}) => new TextRun({ text, bold: o.bold, size: o.size ?? 20, color: o.color ?? C.ink, font: 'Arial' });
export const para = (children: TextRun[], o: { after?: number; before?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; shade?: string; barColor?: string; indent?: number } = {}) => new Paragraph({
 children, alignment: o.align, spacing: { after: o.after ?? 80, before: o.before ?? 0 },
 shading: o.shade ? { type: ShadingType.CLEAR, color: 'auto', fill: o.shade } : undefined,
 border: o.barColor ? { left: { style: BorderStyle.SINGLE, size: 24, color: o.barColor, space: 8 } } : undefined,
 indent: o.indent ? { left: o.indent } : undefined,
});
export const cell = (children: Paragraph[], width: number, o: { shade?: string; borders?: any; span?: number } = {}) => new TableCell({ children, width: { size: width, type: WidthType.DXA }, shading: o.shade ? { type: ShadingType.CLEAR, color: 'auto', fill: o.shade } : undefined, borders: o.borders ?? borders, margins: { top: 80, bottom: 80, left: 110, right: 110 }, verticalAlign: VerticalAlign.TOP, columnSpan: o.span });
export const table = (rows: TableRow[], widths: number[]) => new Table({ width: { size: TW, type: WidthType.DXA }, columnWidths: widths, rows });
export const bandDocx = (title: string) => table([new TableRow({ children: [cell([para([run(title, { bold: true, color: 'FFFFFF', size: 21 })], { after: 0 })], TW, { shade: C.navy, borders: { top: none, bottom: none, right: none, left: { style: BorderStyle.SINGLE, size: 36, color: C.accent } } })] })], [TW]);
export const gap = (after = 120) => new Paragraph({ children: [], spacing: { after } });

/** Header line and banner cell with the UNICA shield, shared by the session and the activity. */
export const logoRun = (height: number) => { const bytes = unicaLogo(); return bytes ? [new ImageRun({ data: bytes, type: 'png', transformation: { width: Math.round(height * UNICA_LOGO_SIZE.width / UNICA_LOGO_SIZE.height), height } })] : []; };
export const logoCell = (shade: string) => cell([new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 }, children: logoRun(64) })], 1500, { shade: 'FFFFFF', borders: { top: { style: BorderStyle.SINGLE, size: 24, color: shade }, bottom: { style: BorderStyle.SINGLE, size: 24, color: shade }, left: { style: BorderStyle.SINGLE, size: 24, color: shade }, right: { style: BorderStyle.SINGLE, size: 24, color: shade } } });

export async function renderSessionDocx(d: any, assets: Map<string, Asset> = new Map(), citations: any[] = []) {
 const F = facts(d), children: (Paragraph | Table)[] = [];
 // Title banner
 children.push(table([new TableRow({ children: [cell([
  para([run(F.heading, { bold: true, color: 'A7F3D0', size: 19 })], { after: 60, before: 80 }),
  para([run(F.title, { bold: true, color: 'FFFFFF', size: 32 })], { after: 80 }),
  para([run([F.unit, F.duration].filter(Boolean).join('   ·   '), { color: 'CBD5E1', size: 18 })], { after: 80 }),
 ], TW - 1500, { shade: C.navy, borders: { top: none, bottom: none, left: none, right: none } }), logoCell(C.navy)] })], [TW - 1500, 1500]), gap(160));

 children.push(bandDocx('I. DATOS INFORMATIVOS GENERALES'), gap(60));
 const lw = 2800;
 children.push(table([['Curso', F.course], ['Unidad N° y Título', F.unit], ['Sesión N° y Título', F.session], ['Duración de la Sesión', F.duration]].map(([l, v]) => new TableRow({ children: [cell([para([run(l, { bold: true, color: C.navy, size: 19 })], { after: 0 })], lw, { shade: C.label }), cell([para([run(v, { size: 19 })], { after: 0 })], TW - lw)] })), [lw, TW - lw]), gap(160));

 children.push(bandDocx('II. LOGRO DE APRENDIZAJE'), gap(60));
 children.push(para([run(plain(d.outcome), { size: 22, color: C.navy })], { shade: C.outcome, barColor: C.accent, after: 100 }));
 const parts = outcomeParts(d.outcome);
 if (parts) {
  const widths = [0.2, 0.15, 0.15, 0.5].map(r => Math.round(TW * r));
  const cells: [string, string][] = [['TIEMPO', parts.time], ['SUJETO', parts.subject], ['VERBO', parts.verb], ['CONTENIDO Y CONDICIÓN', parts.rest]];
  children.push(table([new TableRow({ children: cells.map(([l, v], i) => cell([para([run(l, { bold: true, color: C.accent, size: 14 })], { after: 20 }), para([run(v, { bold: l === 'VERBO', color: l === 'VERBO' ? C.accent : C.ink, size: 17 })], { after: 0 })], widths[i])) })], widths));
 }
 children.push(gap(160), bandDocx('III. EVIDENCIAS DE APRENDIZAJE'), gap(60));
 for (const e of F.evidence) children.push(para([run('■  ', { color: C.accent, size: 16 }), run(e)], { after: 60, indent: 120 }));

 children.push(gap(160), bandDocx('IV. SECUENCIA DIDÁCTICA Y METODOLOGÍA (Durante la sesión)'), gap(60));
 const stages: any[] = d.stages || [], total = stages.reduce((s, x) => s + (Number(x.minutes) || 0), 0) || 1;
 const bar = stages.map((s, i) => Math.max(900, Math.round(TW * s.minutes / total)));
 const scale = TW / bar.reduce((a, b) => a + b, 0), barW = bar.map(b => Math.round(b * scale));
 children.push(para([run('Distribución del tiempo', { bold: true, color: C.muted, size: 16 })], { after: 40 }));
 children.push(table([new TableRow({ children: stages.map((s, i) => cell([para([run(`${s.name} · ${s.minutes} min`, { bold: true, color: 'FFFFFF', size: 16 })], { after: 0, align: AlignmentType.CENTER })], barW[i], { shade: (momentColors[s.name] || momentColors.Desarrollo).bar, borders: { top: none, bottom: none, left: none, right: none } })) })], barW), gap(100));
 const sw = [1700, TW - 1700 - 950 - 2200, 950, 2200];
 const head = new TableRow({ tableHeader: true, children: ['Momento pedagógico', 'Actividades de aprendizaje', 'Tiempo', 'Recursos y materiales'].map((t, i) => cell([para([run(t, { bold: true, color: C.navy, size: 17 })], { after: 0, align: AlignmentType.CENTER })], sw[i], { shade: C.head })) });
 const bodyRows = stages.map(s => {
  const color = momentColors[s.name] || momentColors.Desarrollo;
  const acts = (s.activities || []).map(splitActivity).flatMap((a: any) => [...(a.title ? [para([run(a.title, { bold: true, color: C.navy, size: 18 })], { after: 20 })] : []), para([run(a.body, { size: 18 })], { after: 100 })]);
  return new TableRow({ children: [
   cell([para([run(s.name, { bold: true, color: color.bar, size: 21 })], { after: 0 })], sw[0], { shade: color.bg, borders: { ...borders, left: { style: BorderStyle.SINGLE, size: 30, color: color.bar } } }),
   cell(acts.length ? acts : [para([run('')])], sw[1]),
   cell([para([run(String(s.minutes), { bold: true, color: color.bar, size: 30 })], { after: 0, align: AlignmentType.CENTER }), para([run('min', { color: C.muted, size: 16 })], { after: 0, align: AlignmentType.CENTER })], sw[2]),
   cell((s.resources || []).map((r: string) => para([run(`• ${plain(r)}`, { size: 17 })], { after: 40 })), sw[3]),
  ] });
 });
 children.push(table([head, ...bodyRows], sw));
 if (d.methodology) children.push(gap(80), para([run('Estrategia metodológica', { bold: true, color: C.accent, size: 18 })], { after: 30 }), para([run(plain(d.methodology), { size: 19 })]));

 if (F.caseStudy) {
  const cs = F.caseStudy, box = { shade: C.caseBg, barColor: C.caseBar };
  children.push(gap(120),
   para([run('CASO DE ESTUDIO · SE ANALIZA EN EL DESARROLLO', { bold: true, color: 'B26A00', size: 15 })], { ...box, after: 0, before: 0 }),
   para([run(cs.title, { bold: true, color: C.navy, size: 25 })], { ...box, after: 60 }),
   ...(cs.hook ? [para([run('Gancho para el Inicio: ', { bold: true, color: '7A4B00', size: 19 }), run(plain(cs.hook), { size: 19, color: '7A4B00' })], { ...box, after: 60 })] : []),
   ...plain(cs.scenario).split(/\n+/).filter(Boolean).map(p => para([run(p)], { ...box, after: 60 })),
   ...(cs.facts?.length ? [para([run('Datos del caso', { bold: true, color: 'B26A00', size: 18 })], { ...box, after: 20 }), ...cs.facts.map(x => para([run('•  ', { bold: true, color: 'B26A00' }), run(plain(x), { size: 19 })], { ...box, after: 20 }))] : []),
   ...(cs.questions?.length ? [para([run('Preguntas para el análisis', { bold: true, color: 'B26A00', size: 18 })], { ...box, after: 20, before: 0 }), ...cs.questions.map((q, i) => para([run(`${i + 1}.  `, { bold: true, color: 'B26A00' }), run(plain(q), { size: 19 })], { ...box, after: 20 }))] : []),
  );
 }

 children.push(gap(160), bandDocx('V. EVALUACIÓN DE APRENDIZAJE'), gap(60));
 const ew = Math.round(TW / 3), cards: [string, string][] = [['¿QUÉ SE EVALÚA?', plain(d.assessment)], ['TIPO DE EVALUACIÓN', plain(d.evaluationType) || 'Formativa'], ['INSTRUMENTO', plain(d.instrument) || 'Rúbrica']];
 children.push(table([new TableRow({ children: cards.map(([l, v]) => cell([para([run(l, { bold: true, color: C.accent, size: 15 })], { after: 40 }), para([run(v, { size: 19 })], { after: 0 })], ew, { shade: 'F8FAFC', borders: { ...borders, top: { style: BorderStyle.SINGLE, size: 18, color: C.accent } } })) })], [ew, ew, TW - 2 * ew]));

 children.push(gap(160), bandDocx('VI. BIBLIOGRAFÍA'), gap(60));
 for (const ref of F.bibliography) children.push(new Paragraph({ children: [run(ref, { size: 19 })], spacing: { after: 80 }, indent: { left: 420, hanging: 420 } }));

 for (const img of (d.images || []).filter((i: any) => assets.has(i.assetId))) {
  const asset = assets.get(img.assetId)!, image = await loadImage(asset.bytes), s = Math.min(450 * (img.width || 100) / 100 / image.width, 320 / image.height);
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 160 }, children: [new ImageRun({ data: asset.bytes, type: asset.mime === 'image/png' ? 'png' : 'jpg', transformation: { width: image.width * s, height: image.height * s } })] }), para([run(plain(img.caption || 'Imagen educativa'), { size: 16, color: C.muted })], { align: AlignmentType.CENTER }));
 }

 return Packer.toBuffer(new Document({
  styles: { default: { document: { run: { font: 'Arial', size: 20 } } } },
  sections: [{
   properties: { page: { margin: { top: 1000, bottom: 900, left: 1000, right: 1000 } } },
   headers: { default: new Header({ children: [new Paragraph({ spacing: { after: 0 }, children: [...logoRun(22), run('  UNIVERSIDAD NACIONAL "SAN LUIS GONZAGA"', { bold: true, color: C.navy, size: 15 }), run(`     ${F.course}`, { color: C.muted, size: 15 })] })] }) },
   footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `${F.heading} · `, size: 15, color: C.muted }), new TextRun({ children: [PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES], size: 15, color: C.muted })] })] }) },
   children,
  }],
 }));
}
