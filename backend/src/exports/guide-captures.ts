// «Así debería verse»: expected results of a programming step, drawn as images for the guide.
// web → the page in a browser frame (headless Chromium), terminal → a console window, api → a Postman-like response.
import { createCanvas, GlobalFonts, loadImage, type SKRSContext2D } from '@napi-rs/canvas';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

export type CaptureSpec = { kind: 'web' | 'terminal' | 'api'; title?: string; html?: string; command?: string; output?: string; method?: string; url?: string; requestBody?: string; status?: number; response?: string };

let fontsReady = false;
function fonts() {
 if (fontsReady) return; fontsReady = true;
 const win = process.env.WINDIR || 'C:/Windows';
 for (const [file, family] of [
  [join(win, 'Fonts', 'consola.ttf'), 'CaptureMono'], ['/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 'CaptureMono'], ['/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf', 'CaptureMono'],
 ] as const) if (existsSync(file)) { GlobalFonts.registerFromPath(file, family); break; }
 try { const std = join(dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts'); GlobalFonts.registerFromPath(join(std, 'LiberationSans-Regular.ttf'), 'CaptureSans'); GlobalFonts.registerFromPath(join(std, 'LiberationSans-Bold.ttf'), 'CaptureSansBold'); } catch { /* system fonts */ }
}
const MONO = '15px CaptureMono, Consolas, "DejaVu Sans Mono", monospace', SANS = '14px CaptureSans, Arial, sans-serif', BOLD = '14px CaptureSansBold, Arial, sans-serif';

/** Long lines wrap at the window width instead of being cut. */
function wrapLines(ctx: SKRSContext2D, text: string, width: number, max = 48) {
 const out: string[] = [];
 for (const raw of String(text ?? '').replace(/\t/g, '  ').split('\n')) {
  let line = raw;
  while (line && ctx.measureText(line).width > width) { let cut = line.length; while (cut > 1 && ctx.measureText(line.slice(0, cut)).width > width) cut--; out.push(line.slice(0, cut)); line = line.slice(cut); }
  out.push(line);
  if (out.length >= max) { out.length = max; out.push('…'); break; }
 }
 return out;
}

function windowBar(ctx: SKRSContext2D, width: number, bg: string, label: string, labelColor: string) {
 ctx.fillStyle = bg; ctx.fillRect(0, 0, width, 38);
 ['#FF5F57', '#FEBC2E', '#28C840'].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(20 + i * 20, 19, 6, 0, Math.PI * 2); ctx.fill(); });
 ctx.font = SANS; ctx.fillStyle = labelColor; ctx.textAlign = 'center'; ctx.fillText(label.slice(0, 90), width / 2, 24); ctx.textAlign = 'left';
}

/** Console window: the command (green prompt) and the output it prints. */
export function renderTerminal(spec: CaptureSpec): Buffer {
 fonts();
 const width = 1000, pad = 20, lineH = 21;
 const probe = createCanvas(10, 10).getContext('2d'); probe.font = MONO;
 const command = String(spec.command || '').trim(), output = wrapLines(probe, String(spec.output || ''), width - pad * 2);
 const commands = command ? wrapLines(probe, `$ ${command}`, width - pad * 2, 6) : [];
 const height = 38 + pad + (commands.length + output.length) * lineH + pad;
 const canvas = createCanvas(width, height), ctx = canvas.getContext('2d');
 ctx.fillStyle = '#1E1E2E'; ctx.fillRect(0, 0, width, height);
 windowBar(ctx, width, '#2B2B3A', spec.title || 'Terminal', '#A6ADC8');
 ctx.font = MONO; let y = 38 + pad + 14;
 for (const line of commands) { ctx.fillStyle = '#A6E3A1'; ctx.fillText(line, pad, y); y += lineH; }
 for (const line of output) { ctx.fillStyle = /error|exception|fail/i.test(line) ? '#F38BA8' : '#E5E7EB'; ctx.fillText(line, pad, y); y += lineH; }
 return canvas.toBuffer('image/png');
}

const statusText: Record<number, string> = { 200: 'OK', 201: 'Created', 204: 'No Content', 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 500: 'Internal Server Error' };
/** JSON tokens coloured like an API client: keys, strings, numbers and literals. */
function drawJsonLine(ctx: SKRSContext2D, line: string, x: number, y: number) {
 const tokens = line.match(/"(?:[^"\\]|\\.)*"\s*:|"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:e[+-]?\d+)?|\btrue\b|\bfalse\b|\bnull\b|[^"\d\-tfn]+|./gi) || [line];
 for (const t of tokens) {
  ctx.fillStyle = /^".*"\s*:$/.test(t) ? '#A626A4' : /^"/.test(t) ? '#50A14F' : /^-?\d/.test(t) ? '#C18401' : /^(true|false|null)$/.test(t) ? '#0184BC' : '#383A42';
  ctx.fillText(t, x, y); x += ctx.measureText(t).width;
 }
}

/** API client view: method and URL, status, optional request body and the JSON response. */
export function renderApi(spec: CaptureSpec): Buffer {
 fonts();
 const width = 1000, pad = 20, lineH = 21;
 const pretty = (value?: string) => { const v = String(value ?? '').trim(); if (!v) return ''; try { return JSON.stringify(JSON.parse(v), null, 2); } catch { return v; } };
 const probe = createCanvas(10, 10).getContext('2d'); probe.font = MONO;
 const request = pretty(spec.requestBody), response = pretty(spec.response);
 const reqLines = request ? wrapLines(probe, request, width - pad * 2 - 16, 14) : [], resLines = wrapLines(probe, response, width - pad * 2 - 16, 40);
 const height = 38 + 64 + (reqLines.length ? 34 + reqLines.length * lineH + 16 : 0) + 34 + resLines.length * lineH + pad + 10;
 const canvas = createCanvas(width, height), ctx = canvas.getContext('2d');
 ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, width, height);
 windowBar(ctx, width, '#F3F4F6', spec.title || 'Cliente de API', '#4B5563');
 const method = String(spec.method || 'GET').toUpperCase(), color = ({ GET: '#16A34A', POST: '#EA580C', PUT: '#2563EB', PATCH: '#7C3AED', DELETE: '#DC2626' } as Record<string, string>)[method] || '#4B5563';
 let y = 38 + 16;
 ctx.strokeStyle = '#D1D5DB'; ctx.lineWidth = 1; ctx.strokeRect(pad, y, width - pad * 2, 38);
 ctx.fillStyle = color; ctx.font = BOLD; ctx.fillText(method, pad + 14, y + 25);
 ctx.fillStyle = '#111827'; ctx.font = MONO; ctx.fillText(String(spec.url || '').slice(0, 90), pad + 24 + ctx.measureText(method).width + 20, y + 25);
 y += 38 + 10;
 const section = (label: string, lines: string[], badge?: string, badgeColor?: string) => {
  ctx.fillStyle = '#6B7280'; ctx.font = BOLD; ctx.fillText(label, pad, y + 16);
  if (badge) { const w = ctx.measureText(badge).width + 20, x = width - pad - w; ctx.fillStyle = badgeColor!; ctx.beginPath(); ctx.roundRect(x, y, w, 24, 6); ctx.fill(); ctx.fillStyle = '#FFFFFF'; ctx.fillText(badge, x + 10, y + 17); }
  y += 30; ctx.fillStyle = '#F9FAFB'; ctx.fillRect(pad, y, width - pad * 2, lines.length * lineH + 12); ctx.font = MONO;
  lines.forEach((line, i) => drawJsonLine(ctx, line, pad + 8, y + 18 + i * lineH)); y += lines.length * lineH + 16;
 };
 if (reqLines.length) section('Cuerpo de la solicitud', reqLines);
 const status = Number(spec.status) || 200;
 section('Respuesta', resLines, `${status} ${statusText[status] || ''}`.trim(), status < 300 ? '#16A34A' : status < 500 ? '#EA580C' : '#DC2626');
 return canvas.toBuffer('image/png');
}

type Browser = { newContext: (o: any) => Promise<any>; close: () => Promise<void> };
async function launchBrowser(): Promise<Browser | null> {
 try {
  const { chromium } = await import('playwright-core');
  const path = process.env.CHROMIUM_PATH;
  for (const options of [path ? { executablePath: path } : null, { channel: 'chrome' }, { channel: 'msedge' }, {}].filter(Boolean) as any[]) {
   try { return await chromium.launch({ ...options, headless: true, args: ['--no-sandbox', '--disable-gpu'] }) as any; } catch { /* next candidate */ }
  }
 } catch { /* playwright-core not available */ }
 return null;
}

/** The page the student should see, rendered without JavaScript or network access, inside a browser frame. */
export async function renderWeb(spec: CaptureSpec, browser: Browser): Promise<Buffer> {
 fonts();
 const context = await browser.newContext({ viewport: { width: 1000, height: 640 }, javaScriptEnabled: false, deviceScaleFactor: 1 });
 try {
  const page = await context.newPage();
  // AI-written HTML is only displayed: no scripts, no requests to the network.
  await page.route('**/*', (route: any) => /^(data|about):/.test(route.request().url()) ? route.continue() : route.abort());
  await page.setContent(String(spec.html || ''), { waitUntil: 'load', timeout: 10000 });
  // Cropped to the content (the lowest visible element), not to the empty window.
  const bottom = await page.evaluate('Math.ceil(Math.max(0, ...Array.from(document.body.querySelectorAll("*")).map(e => e.getBoundingClientRect().bottom)))') as number;
  const height = Math.min(900, Math.max(220, bottom + 28));
  const shot: Buffer = await page.screenshot({ clip: { x: 0, y: 0, width: 1000, height }, timeout: 10000 });
  const image = await loadImage(shot), canvas = createCanvas(1000, height + 70), ctx = canvas.getContext('2d');
  ctx.fillStyle = '#E5E7EB'; ctx.fillRect(0, 0, 1000, height + 70);
  windowBar(ctx, 1000, '#E5E7EB', spec.title || 'Vista en el navegador', '#4B5563');
  ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.roundRect(120, 42, 760, 24, 12); ctx.fill();
  ctx.fillStyle = '#4B5563'; ctx.font = SANS; ctx.fillText(String(spec.url || 'http://localhost:4200').slice(0, 80), 136, 59);
  ctx.drawImage(image, 0, 70);
  return canvas.toBuffer('image/png');
 } finally { await context.close(); }
}

const captionOf = (spec: CaptureSpec) => spec.kind === 'web' ? `Así debería verse en el navegador${spec.title ? `: ${spec.title}` : '.'}`
 : spec.kind === 'terminal' ? `Salida esperada en la terminal${spec.title ? `: ${spec.title}` : spec.command ? `: ${spec.command}` : '.'}`
 : `Respuesta esperada de ${String(spec.method || 'GET').toUpperCase()} ${spec.url || ''}`.trim();

/**
 * Turns every capture block into an image block (the picture the student should obtain).
 * Without a browser, a web capture becomes a short note instead of failing the guide.
 */
export async function renderGuideCaptures(blocks: any[], save: (png: Buffer, caption: string) => Promise<string>) {
 if (!blocks.some(b => b.type === 'capture')) return blocks;
 let browser: Browser | null | undefined;
 const out: any[] = [];
 try {
  for (const block of blocks) {
   if (block.type !== 'capture' || !block.capture) { out.push(block); continue; }
   const spec: CaptureSpec = block.capture, caption = captionOf(spec);
   try {
    let png: Buffer | null = null;
    if (spec.kind === 'terminal') png = renderTerminal(spec);
    else if (spec.kind === 'api') png = renderApi(spec);
    else { if (browser === undefined) browser = await launchBrowser(); if (browser) png = await renderWeb(spec, browser); }
    if (png) { const { width, height } = await loadImage(png); out.push({ id: block.id, type: 'image', text: '', assetId: await save(png, caption), caption, width: 100, ratio: Math.round(1000 * height / width) / 1000, page: block.page, capture: spec }); continue; }
   } catch { /* falls back to the note below */ }
   out.push({ id: block.id, type: 'paragraph', text: `**Resultado esperado:** ${spec.title || caption}`, page: block.page });
  }
 } finally { if (browser) await browser.close().catch(() => undefined); }
 return out;
}
