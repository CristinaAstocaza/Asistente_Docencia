import JSZip from 'jszip';
import { createHash } from 'node:crypto';
import { createCanvas, loadImage, type Canvas } from '@napi-rs/canvas';

/** A picture found inside a teacher's source document, ready to place on a slide. */
export interface SourceImage { id: string; document: string; page: number | null; width: number; height: number; caption: string; bytes: Buffer; thumbnail: string }

const MAX_IMAGES = 10, MAX_DOCUMENTS = 6, MAX_PDF_PAGES = 40, MIN_W = 220, MIN_H = 160;
const usable = (w: number, h: number) => w >= MIN_W && h >= MIN_H && w / h <= 4 && h / w <= 4;

/** Draws onto a white page (no transparent holes in JPEG) and scales down to `max` pixels. */
function scaled(source: Canvas | Awaited<ReturnType<typeof loadImage>>, w: number, h: number, max: number) {
 const scale = Math.min(1, max / Math.max(w, h)), cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
 const canvas = createCanvas(cw, ch), ctx = canvas.getContext('2d');
 ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, cw, ch); ctx.drawImage(source as any, 0, 0, cw, ch);
 return canvas;
}

async function encode(source: Canvas | Awaited<ReturnType<typeof loadImage>>, w: number, h: number) {
 const full = await scaled(source, w, h, 1200).encode('jpeg', 84);
 const thumb = await scaled(source, w, h, 448).encode('jpeg', 70);
 const scale = Math.min(1, 1200 / Math.max(w, h));
 return { bytes: Buffer.from(full), thumbnail: Buffer.from(thumb).toString('base64'), width: Math.round(w * scale), height: Math.round(h * scale) };
}

/** pdf.js raw image (gray 1-bit, RGB or RGBA) -> canvas. */
function rawToCanvas(img: any): Canvas | null {
 const { width: w, height: h, data } = img;
 if (!data || !w || !h) return null;
 const canvas = createCanvas(w, h), ctx = canvas.getContext('2d'), out = ctx.createImageData(w, h), px = out.data;
 if (data.length === w * h * 4) px.set(data);
 else if (data.length === w * h * 3) for (let s = 0, d = 0; s < data.length; s += 3, d += 4) { px[d] = data[s]; px[d + 1] = data[s + 1]; px[d + 2] = data[s + 2]; px[d + 3] = 255; }
 else if (data.length === w * h) for (let s = 0, d = 0; s < data.length; s++, d += 4) { px[d] = px[d + 1] = px[d + 2] = data[s]; px[d + 3] = 255; }
 else if (data.length === Math.ceil(w / 8) * h) {
  const row = Math.ceil(w / 8);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const bit = (data[y * row + (x >> 3)] >> (7 - (x & 7))) & 1, d = (y * w + x) * 4, v = bit ? 255 : 0; px[d] = px[d + 1] = px[d + 2] = v; px[d + 3] = 255; }
 } else return null;
 ctx.putImageData(out, 0, 0);
 return canvas;
}

const objectOf = (page: any, name: string) => new Promise<any>(resolve => {
 const timer = setTimeout(() => resolve(null), 3000);
 const store = String(name).startsWith('g_') ? page.commonObjs : page.objs;
 try { store.get(name, (value: any) => { clearTimeout(timer); resolve(value); }); } catch { clearTimeout(timer); resolve(null); }
});

async function fromPdf(bytes: Buffer, limit: number, deadline: number) {
 const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
 const task = pdfjs.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, isOffscreenCanvasSupported: false, useSystemFonts: true } as any);
 const doc = await task.promise, found: { canvas: Canvas; page: number; caption: string }[] = [];
 try {
  for (let n = 1; n <= Math.min(doc.numPages, MAX_PDF_PAGES) && found.length < limit && Date.now() < deadline; n++) {
   const page = await doc.getPage(n), ops = await page.getOperatorList();
   const names = new Set<string>();
   ops.fnArray.forEach((fn: number, i: number) => { if (fn === pdfjs.OPS.paintImageXObject) names.add(ops.argsArray[i][0]); });
   if (!names.size) continue;
   const caption = (await page.getTextContent()).items.map((item: any) => item.str || '').join(' ').replace(/\s+/g, ' ').trim().slice(0, 220);
   for (const name of names) {
    const img = await objectOf(page, name);
    if (!img || !usable(img.width, img.height)) continue;
    const canvas = img.bitmap ? null : rawToCanvas(img);
    if (canvas) found.push({ canvas, page: n, caption });
    if (found.length >= limit) break;
   }
  }
 } finally { await task.destroy(); }
 return found;
}

async function fromOffice(bytes: Buffer, folder: string, limit: number) {
 const zip = await JSZip.loadAsync(bytes), found: { image: Awaited<ReturnType<typeof loadImage>>; caption: string }[] = [];
 const files = Object.keys(zip.files).filter(f => f.startsWith(folder) && /\.(png|jpe?g|gif|bmp|webp)$/i.test(f)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
 for (const file of files) {
  if (found.length >= limit) break;
  try { const image = await loadImage(await zip.files[file].async('nodebuffer')); if (usable(image.width, image.height)) found.push({ image, caption: '' }); } catch {}
 }
 return found;
}

/** Collects at most a few usable pictures from the selected sources; failures never block generation. */
export async function collectSourceImages(docs: { name: string; type: string; storage_key: string | null }[], read: (key: string) => Promise<Buffer>): Promise<SourceImage[]> {
 const result: SourceImage[] = [], seen = new Set<string>(), deadline = Date.now() + 20000;
 for (const doc of docs.slice(0, MAX_DOCUMENTS)) {
  if (result.length >= MAX_IMAGES || Date.now() > deadline || !doc.storage_key) break;
  const type = String(doc.type).toUpperCase(), room = MAX_IMAGES - result.length;
  try {
   const bytes = await read(doc.storage_key);
   const items: { source: any; w: number; h: number; page: number | null; caption: string }[] = [];
   if (type === 'PDF') for (const item of await fromPdf(bytes, room, deadline)) items.push({ source: item.canvas, w: item.canvas.width, h: item.canvas.height, page: item.page, caption: item.caption });
   else if (type === 'DOCX' || type === 'PPTX') for (const item of await fromOffice(bytes, type === 'DOCX' ? 'word/media/' : 'ppt/media/', room)) items.push({ source: item.image, w: item.image.width, h: item.image.height, page: null, caption: item.caption });
   for (const item of items) {
    const encoded = await encode(item.source, item.w, item.h);
    const hash = createHash('sha1').update(encoded.thumbnail).digest('hex');
    if (seen.has(hash)) continue;
    seen.add(hash);
    result.push({ id: `img${result.length + 1}`, document: doc.name, page: item.page, caption: item.caption, ...encoded });
    if (result.length >= MAX_IMAGES) break;
   }
  } catch { /* an unreadable source simply contributes no pictures */ }
 }
 return result;
}
