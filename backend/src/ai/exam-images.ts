import type { SourceImage } from '../documents/source-images';

/**
 * Repairs the usual slips of the model before validation, so a whole exam is not rejected for them:
 * theory questions with an empty or single-item subquestions list, and cases with fewer than two subquestions.
 */
export function normalizeExamDraft(raw: any) {
 if (!raw || !Array.isArray(raw.questions)) return raw;
 for (const q of raw.questions) {
  if (!q || typeof q !== 'object') continue;
  if (!Array.isArray(q.options)) q.options = [];
  const subs = Array.isArray(q.subquestions) ? q.subquestions.filter((s: any) => s && String(s.question ?? '').trim()) : [];
  if (subs.length >= 2) { q.subquestions = subs; continue; }
  delete q.subquestions;
  // A lone subquestion becomes part of the statement; its expected answer joins the main one.
  if (subs.length === 1) {
   q.question = `${String(q.question ?? '').trim()}\n\n${String(subs[0].question).trim()}`.trim();
   if (subs[0].correctAnswer) q.correctAnswer = [q.correctAnswer, subs[0].correctAnswer].filter(Boolean).join('\n');
  }
  if (q.type === 'case_study') q.type = 'development';
 }
 return raw;
}

/** Prompt section that lets the model attach figures from the sources to the problems that need them. */
export function examImageBrief(images: SourceImage[]) {
 return `IMÁGENES DE LAS FUENTES (se adjuntan en este orden): ${images.map(image => `${image.id}: ${image.document}${image.page ? `, página ${image.page}` : ''}${image.caption ? ` — texto cercano: «${image.caption}»` : ''}`).join(' | ')}.
Si una pregunta o problema que tomas o adaptas de las fuentes necesita una figura, gráfico, tabla o diagrama para resolverse, escribe el identificador de esa imagen en sourceImage de la pregunta y redacta el enunciado haciendo referencia a ella («Observe la figura…»). Descarta logotipos, iconos y decoraciones. Usa cada imagen una sola vez y no inventes identificadores.`;
}

/** Keeps only real extracted figures referenced by questions and stores them as the teacher's images. */
export async function linkExamImages(data: any, images: SourceImage[], save: (image: SourceImage) => Promise<string>) {
 const byId = new Map(images.map(image => [image.id, image])), used = new Set<string>();
 for (const q of data.questions || []) {
  const id = String(q.sourceImage || '').trim(); delete q.sourceImage; delete q.image;
  const image = byId.get(id);
  if (!image || used.has(id)) continue;
  try {
   q.image = { assetId: await save(image), caption: `${image.document}${image.page ? `, p. ${image.page}` : ''}`, width: image.width, height: image.height };
   used.add(id);
  } catch { /* the question stays without its figure */ }
 }
 return data;
}
