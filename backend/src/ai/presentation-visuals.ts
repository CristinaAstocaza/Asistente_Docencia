import type { VisualContentService } from '../visual/visual.module';

/**
 * Gives every content slide a picture when possible, in this order:
 * an image from the teacher's sources (already linked), a relevant Wikimedia photo, then an AI illustration.
 * Pictures are stored as the teacher's private assets, so exports are fast and identical every time.
 */
export async function illustratePresentation(data: any, o: { userId: string; visuals: VisualContentService; reserve: () => Promise<unknown>; maxGenerated?: number; deadlineMs?: number; isRelevant?: (assetId: string, about: string) => Promise<boolean> }) {
 if (data.imageMode === 'none' || data.imageMode === 'sources') return;
 // Automated tests and offline setups never call Wikimedia or the image model.
 if (process.env.PRESENTATION_IMAGES === 'off' || (process.env.NODE_ENV === 'test' && process.env.PRESENTATION_IMAGES !== 'on')) return;
 const deadline = Date.now() + (o.deadlineMs ?? 150000), maxGenerated = o.maxGenerated ?? 4;
 const wanted = (data.slides || []).filter((s: any) => s.layout !== 'section' && !s.sourceImage && !s.assetId);
 const used = new Set<string>();
 let generated = 0, generationFailed = false;
 const one = async (s: any) => {
  if (Date.now() > deadline) return;
  const query = String(s.imageQuery || '').trim();
  // Full query first, then 3 and 2 words; every word must describe the picture (an unrelated photo is worse than none).
  const words = query.split(/\s+/).filter(Boolean);
  const attempts: [string, boolean][] = [[query, true], ...(words.length > 3 ? [[words.slice(0, 3).join(' '), true] as [string, boolean]] : []), ...(words.length > 2 ? [[words.slice(0, 2).join(' '), true] as [string, boolean]] : [])];
  for (const [q, all] of query ? attempts : []) {
   if (Date.now() > deadline) return;
   try {
    const ref = await o.visuals.reference(o.userId, q, 4, all);
    if (ref && !used.has(ref.source)) { used.add(ref.source); if (o.isRelevant && !(await o.isRelevant(ref.id, `${s.title} (${data.title})`))) continue; s.assetId = ref.id; s.imageCredit = { origin: 'commons', title: ref.title, author: ref.author, license: ref.license, source: ref.source }; return; }
   } catch { /* next attempt or the illustration below */ }
  }
  if (generationFailed || generated >= maxGenerated || Date.now() > deadline) return;
  generated++;
  try {
   await o.reserve();
   const prompt = `Ilustración didáctica moderna, plana y colorida, sin texto, letras ni logotipos, para una clase universitaria sobre «${data.title}». Representa: ${s.visualSuggestion || s.title}. Diapositiva: ${s.title}.`;
   const asset = await o.visuals.generate(o.userId, prompt.slice(0, 900), `Ilustración: ${s.title}`.slice(0, 200));
   s.assetId = asset.id; s.imageCredit = { origin: 'ai', title: String(s.title).slice(0, 300) };
  } catch { generationFailed = true; }
 };
 for (let i = 0; i < wanted.length; i += 3) await Promise.all(wanted.slice(i, i + 3).map(one));
}
