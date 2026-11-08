"use client";
import { Wand2 } from 'lucide-react';
import type { Kind } from '@/services/api';

const examples: Partial<Record<Kind, string[]>> = {
 exam: ['Extrae 3 problemas de mis fuentes con sus gráficos y agrega 2 casos nuevos.', 'Usa solo los ejercicios del capítulo 4 y respeta sus datos numéricos.', 'Incluye un caso sobre prueba de hipótesis con una tabla de datos.'],
 questions: ['Toma los ejercicios resueltos de mis fuentes y conviértelos en preguntas.', 'Incluye preguntas que usen las figuras del documento.'],
 session: ['Incluye una dinámica grupal de 15 minutos al inicio.', 'Usa ejemplos del contexto peruano.'],
 lesson: ['Explica con analogías sencillas y un ejercicio resuelto paso a paso.', 'Toma los problemas de la página 12 de mis fuentes.'],
 rubric: ['Da más peso a la argumentación que a la presentación.', 'Redacta los niveles en lenguaje sencillo para estudiantes.'],
 activity: ['Plantea la actividad en parejas con entrega en PDF.'],
};

/** Free-text guidance for the AI: what to extract from the sources, what to emphasise, what to avoid. */
export default function AiInstructions({ kind, value, onChange, hasSources }: { kind: Kind; value: string; onChange: (v: string) => void; hasSources: boolean }) {
 const list = examples[kind] ?? ['Prioriza los conceptos de mis fuentes y agrega ejemplos aplicados.', 'Usa un lenguaje claro para estudiantes de primer ciclo.'];
 return <fieldset className="ai-instructions">
  <legend><Wand2 size={15} aria-hidden />Indicaciones para la IA <small>(opcional)</small></legend>
  <textarea aria-label="Indicaciones para la IA" rows={3} maxLength={3000} value={value} onChange={e => onChange(e.target.value)}
   placeholder="Dile a la IA qué hacer con tus fuentes: qué problemas o imágenes extraer, qué enfoque usar o qué evitar." />
  <div className="ai-instructions-examples" aria-label="Ejemplos de indicaciones">
   {list.map(example => <button type="button" key={example} onClick={() => onChange(value.trim() ? `${value.trim()}\n${example}` : example)}>{example}</button>)}
  </div>
  {(kind === 'exam' || kind === 'questions') && <p className="muted">{hasSources
   ? 'Si tus fuentes tienen figuras, gráficos o tablas, la IA puede incluirlas en los problemas que las necesiten.'
   : 'Para extraer problemas e imágenes, primero selecciona tus fuentes abajo (en Mis fuentes puedes subir PDF, Word o imágenes).'}</p>}
 </fieldset>;
}
