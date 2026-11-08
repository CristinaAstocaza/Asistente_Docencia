import { BorderStyle, Header, ImageRun, Paragraph, TabStopPosition, TabStopType, TextRun } from 'docx';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Institutional identity of the Universidad Nacional "San Luis Gonzaga" (UNICA) used by every document. */
export const UNICA = { name: 'UNIVERSIDAD NACIONAL "SAN LUIS GONZAGA"', red: 'C8102E', navy: '0B2A5B', yellow: 'F2A900' };
export const UNICA_LOGO_SIZE = { width: 240, height: 257 };

let logo: Buffer | null | undefined;
/** The UNICA shield (assets/unica-logo.png); null if the file is missing, so documents still render. */
export function unicaLogo(): Buffer | null {
 if (logo === undefined) { try { logo = readFileSync(join(__dirname, '..', '..', 'assets', 'unica-logo.png')); } catch { logo = null; } }
 return logo;
}
export const unicaLogoDataUri = () => { const bytes = unicaLogo(); return bytes ? `data:image/png;base64,${bytes.toString('base64')}` : null; };

/** Logo width for a given height, keeping the shield's proportions. */
export const logoWidth = (height: number) => Math.round(height * UNICA_LOGO_SIZE.width / UNICA_LOGO_SIZE.height);

/**
 * Stamps the UNICA shield and name on top of every page of a buffered PDFKit document
 * (call it once, after the content, before doc.end()). Needs a top margin of at least 48 pt.
 */
export function stampPdfHeaders(doc: PDFKit.PDFDocument, label = '') {
 const shield = unicaLogo(), range = doc.bufferedPageRange();
 for (let i = range.start; i < range.start + range.count; i++) {
  doc.switchToPage(i);
  const left = doc.page.margins.left, right = doc.page.width - doc.page.margins.right, top = doc.page.margins.top;
  doc.page.margins.top = 0;
  if (shield) doc.image(shield, left, 12, { height: 24 });
  const x = left + (shield ? logoWidth(24) + 6 : 0);
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#' + UNICA.navy).text(UNICA.name, x, 20, { lineBreak: false });
  if (label) doc.font('Helvetica').fontSize(7.5).fillColor('#64748B').text(label, x, 20, { width: right - x, align: 'right', lineBreak: false });
  doc.moveTo(left, 40).lineTo(right, 40).lineWidth(.8).strokeColor('#' + UNICA.red).stroke();
  doc.page.margins.top = top;
 }
}

/** Word page header with the UNICA shield and name, used by every document except rubrics. */
export function brandDocxHeader(label = ''): Header {
 const shield = unicaLogo();
 return new Header({ children: [new Paragraph({
  spacing: { after: 120 }, border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: UNICA.red, space: 4 } },
  tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
  children: [
   ...(shield ? [new ImageRun({ data: shield, type: 'png', transformation: { width: logoWidth(28), height: 28 } })] : []),
   new TextRun({ text: `  ${UNICA.name}`, bold: true, color: UNICA.navy, size: 16, font: 'Arial' }),
   ...(label ? [new TextRun({ text: `\t${label}`, color: '64748B', size: 15, font: 'Arial' })] : []),
  ],
 })] });
}
