// What the teacher asked the guide to contain, and checks that each page delivers it.
export type GuideElement = 'code' | 'diagram' | 'table' | 'exercises' | 'solutions' | 'capture';
export const guideElements: GuideElement[] = ['code', 'diagram', 'table', 'exercises', 'solutions', 'capture'];
export type GuideRequirements = Record<GuideElement, boolean> & { images: boolean };

const plain = (s: unknown) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Reads the request (topic, guide type and visual mode) into the elements the document must include. */
export function guideRequirements(topic: string, parameters: Record<string, unknown>, programming = false): GuideRequirements {
 const text = plain([topic, parameters.guideType, parameters.instructions].join(' '));
 const visual = String(parameters.visualMode || 'auto');
 return {
  code: programming || /\bcodigo|\bsql\b|\bscript|\bcomando|\bconsultas? sql|\bquery|\bprograma(r|cion)?\b|\bfuncion(es)? en\b/.test(text),
  diagram: /diagrama|esquema|flujo|mapa (conceptual|mental)|organizador/.test(text) || visual === 'diagrams',
  table: /\btabla|\bcuadro|comparativ|\bmatriz/.test(text),
  exercises: /ejercicio|problemas? (propuestos|resueltos)|practica(s)? propuesta/.test(text) || /ejercicios/.test(plain(parameters.guideType)),
  solutions: /solucion|solucionario|resuelto|respuestas? (de|a) (los|las) (ejercicios|preguntas|problemas)/.test(text),
  // Programming guides show what each step should produce («así debería verse»).
  capture: programming || /captura|pantallazo|resultado esperado|como (deberia|debe) (verse|quedar)/.test(text),
  images: /\bimagen|\bimagenes|\bfoto|ilustraci/.test(text) || ['auto', 'references', 'generated', 'own'].includes(visual),
 };
}

export const requirementList = (r: GuideRequirements) => guideElements.filter(e => r[e]);

const labels: Record<GuideElement, string> = { code: 'código', diagram: 'diagramas', table: 'tablas', exercises: 'ejercicios', solutions: 'soluciones de los ejercicios', capture: 'capturas del resultado esperado' };
export const requirementLabels = (list: GuideElement[]) => list.map(e => labels[e]).join(', ');

/** What a page must contain for each element; written for the model. */
export function requirementInstructions(list: GuideElement[]) {
 const text: Record<GuideElement, string> = {
  code: 'al menos un bloque code con código completo y ejecutable (en text va el código, nunca un título o una descripción)',
  diagram: 'un bloque diagram con 3 a 6 items que representen el esquema, la estructura o el proceso explicado',
  table: 'un bloque table con fila de encabezado y al menos 3 filas de datos',
  exercises: 'una lista numerada de ejercicios con el enunciado completo de cada uno',
  solutions: 'la solución completa de cada ejercicio; si la solución es código, un bloque code por ejercicio con el código completo',
  capture: 'después del código, al menos un bloque capture con el resultado que el alumno debe obtener; en text va el contenido completo: kind=web → documento HTML con CSS (sin JavaScript), kind=terminal → salida de la consola (y capture.command), kind=api → JSON de respuesta (y capture.method, url, status)',
 };
 return list.map(e => `- ${text[e]}`).join('\n');
}

const codeHint = /[;{}=<>]|::|->|\b(select|create|insert|update|delete|alter|drop|with|from|where|import|def|class|function|const|let|var|return|print|echo|npm|npx|pip|git|mkdir|cd|docker|java|python)\b/i;
/** A code block must carry code: a single line of prose («Solución del ejercicio 1») is not code. */
export function isRealCode(text: string) {
 const lines = String(text || '').split('\n').filter(l => l.trim());
 if (!lines.length) return false;
 if (lines.length >= 2) return lines.some(l => codeHint.test(l) || /^[\s│├└─|]+\S/.test(l) || /^\s*[\w.-]+\/(\S*)$/.test(l));
 // One line: code syntax, or a terminal command (lowercase program followed by its arguments).
 return codeHint.test(lines[0]) || /^[a-z][\w.-]*(\s+\S+)+$/.test(lines[0].trim());
}

/** First missing element in a drafted chapter, as a correction for the model. */
export function requirementIssue(blocks: any[], list: GuideElement[]): string | undefined {
 const empty = blocks.find(b => b.type === 'code' && !isRealCode(b.text));
 if (empty) return `El bloque code «${String(empty.text).slice(0, 80)}» no contiene código. Pon el título en un heading o paragraph y en text el código completo.`;
 const code = blocks.filter(b => b.type === 'code' && isRealCode(b.text));
 for (const element of list) {
  if (element === 'code' && !code.length) return 'Falta el código pedido: incluye al menos un bloque code con código completo y ejecutable.';
  if (element === 'diagram' && !blocks.some(b => b.type === 'diagram' && (b.items || []).length >= 3)) return 'Falta el diagrama pedido: incluye un bloque diagram con 3 a 6 items que representen el esquema o el proceso.';
  if (element === 'table' && !blocks.some(b => b.type === 'table' && (b.rows || []).length >= 3)) return 'Falta la tabla pedida: incluye un bloque table con encabezado y al menos 3 filas.';
  if (element === 'exercises' && !blocks.some(b => /ejercicio/i.test([b.text, ...(b.items || [])].join(' ')))) return 'Faltan los ejercicios pedidos: incluye una lista numerada de ejercicios con su enunciado completo.';
  if (element === 'capture' && !blocks.some(b => b.type === 'capture' && b.capture)) return 'Falta la captura del resultado esperado: después del código añade un bloque capture con kind y title, y en text el contenido completo (HTML de la página, salida de la consola o JSON de respuesta).';
  if (element === 'solutions') {
   if (!blocks.some(b => /soluci[oó]n|respuesta/i.test([b.text, ...(b.items || [])].join(' ')))) return 'Faltan las soluciones pedidas: desarrolla la solución completa de cada ejercicio.';
   if (list.includes('code') && !code.length) return 'Las soluciones deben incluir el código completo de cada ejercicio en bloques code.';
  }
 }
}

/** Every requested element is assigned to at least one chapter; missing ones go to sensible places. */
export function assignRequirements(chapters: { includes?: GuideElement[] }[], list: GuideElement[]) {
 const n = chapters.length;
 for (const c of chapters) c.includes = [...new Set((c.includes || []).filter(e => list.includes(e)))];
 const place = (element: GuideElement, index: number) => { const c = chapters[Math.max(0, Math.min(n - 1, index))]; if (!c.includes!.includes(element)) c.includes!.push(element); };
 for (const element of list) {
  if (chapters.some(c => c.includes!.includes(element))) continue;
  // Captures go wherever there is code; without code, like code.
  if (element === 'capture') { const withCode = chapters.filter(c => c.includes!.includes('code')); if (withCode.length) { for (const c of withCode) if (!c.includes!.includes('capture')) c.includes!.push('capture'); continue; } }
  if (element === 'exercises' || element === 'solutions') place(element, n - 1);
  else if (element === 'diagram') place(element, n > 2 ? 1 : 0);
  else if (element === 'table') place(element, Math.floor(n / 2));
  else for (let i = n > 2 ? 1 : 0; i < Math.max(1, n - 1); i++) place(element, i);
 }
 return chapters;
}
