import { useId } from 'react';
import { Info } from 'lucide-react';

type Help = { text: string; examples?: string[] };

const help: Record<string, Help> = {
 topic: { text: 'Escribe el tema y lo que quieres lograr o evaluar.', examples: ['Biología: identificar las partes de la célula y explicar sus funciones.'] },
 count: { text: 'Cantidad de preguntas que se generarán.' },
 type: { text: 'Cómo responderán: alternativas, verdadero/falso o una respuesta escrita.' },
 difficulty: { text: 'Fácil: recordar conceptos. Media: aplicar lo aprendido. Difícil: analizar casos y justificar decisiones.' },
 level: { text: 'A quién va dirigido.', examples: ['3.º de secundaria', 'Primer ciclo universitario'] },
 examType: { text: 'Práctica para ejercitar, parcial para una parte del curso o final para el curso completo.' },
 duration: { text: 'Tiempo total disponible, en minutos.', examples: ['45'] },
 competency: { text: 'Capacidad que el estudiante desarrollará al integrar conocimientos y habilidades.', examples: ['Argumentar una postura con evidencias'] },
 objective: { text: 'Qué quieres conseguir con esta clase.', examples: ['Que los estudiantes comprendan cómo funciona una API'] },
 outcome: { text: 'Lo que el estudiante podrá demostrar al terminar.', examples: ['Crear una API con dos rutas funcionales'] },
 outcomes: { text: 'Resultados que podrán demostrar al finalizar el curso.', examples: ['Elaborar y presentar un informe con argumentos y fuentes'] },
 methodology: { text: 'Cómo se desarrollará el aprendizaje.', examples: ['Explicación breve, trabajo en equipos y resolución de un caso'] },
 criteriaCount: { text: 'Cantidad de aspectos que evaluarás.', examples: ['4: claridad, precisión, organización y uso de evidencias'] },
 evaluationScheme: { text: 'Evaluaciones, sus porcentajes y las semanas en que se toman.', examples: ['Práctica 30 % (semana 6), proyecto 30 % (semana 12), final 40 % (semana 16)'] },
 bibliography: { text: 'Fuentes del curso con autor, año y título; puedes añadir un enlace.' },
 // Syllabus (formato UNICA)
 course: { text: 'Nombre de la asignatura tal como figura en el plan de estudios.', examples: ['Base de Datos I', 'Inteligencia Artificial'] },
 credits: { text: 'Créditos académicos del curso según el plan de estudios.', examples: ['3', '4'] },
 weeks: { text: 'Duración del semestre en semanas. El cronograma tendrá una fila por semana.', examples: ['16', '17'] },
 weeklyHours: { text: 'Total de horas académicas por semana (teoría + práctica).', examples: ['5 (3 de teoría y 2 de práctica)'] },
 theoryHours: { text: 'Horas semanales de clase teórica.', examples: ['3'] },
 practiceHours: { text: 'Horas semanales de práctica o laboratorio.', examples: ['2'] },
 cycle: { text: 'Semestre o ciclo del plan de estudios al que pertenece el curso. Aparece en la portada como «IV SEMESTRE».', examples: ['IV', 'VI'] },
 modality: { text: 'Cómo se dicta el curso: Presencial, Virtual o Semipresencial.' },
 institution: { text: 'Nombre oficial de la universidad.', examples: ['UNIVERSIDAD NACIONAL "SAN LUIS GONZAGA"'] },
 faculty: { text: 'Facultad o escuela a la que pertenece el curso.', examples: ['FACULTAD DE INGENIERÍA DE SISTEMAS'] },
 department: { text: 'Departamento académico que dicta el curso.', examples: ['DEPARTAMENTO ACADÉMICO DE INGENIERÍA DE SISTEMAS'] },
 courseCode: { text: 'Código del curso en el plan de estudios.', examples: ['IS-401', '1P35024'] },
 careers: { text: 'Carrera o escuela profesional que lleva el curso. Si son varias, escribe una por línea.', examples: ['Ingeniería de Sistemas'] },
 term: { text: 'Año y semestre en que se dicta el curso (periodo académico de la universidad). Aparece en la portada.', examples: ['2026-I', '2026-II'] },
 chronologicalPeriod: { text: 'Fechas de inicio y fin de las clases. Con ellas se calcula la fecha de cada semana en el cronograma de evaluación.', examples: ['Del 07/09/2026 al 24/12/2026'] },
 condition: { text: 'Indica si todos los estudiantes del plan deben llevar el curso o si es uno que pueden elegir.', examples: ['Obligatorio', 'Electivo'] },
 nature: { text: 'Área de estudio o tipo de curso según el plan.', examples: ['Teórico-práctico', 'Formación de especialidad'] },
 prerequisites: { text: 'Cursos que el estudiante debe haber aprobado antes.', examples: ['Algoritmos y Estructura de Datos'] },
 mission: { text: 'Misión de la universidad tal como figura en sus documentos oficiales. Se copia en el punto 2.1 del sílabo.' },
 timetable: { text: 'Una fila por sección, con sus datos separados por « | »: sección, horario y aula de teoría, horario y lugar de práctica.', examples: ['IV - A | Lunes 08:00 - 10:00 | Aula 103 | Miércoles 08:00 - 10:00 | Laboratorio 2'] },
 teacherName: { text: 'Nombre del docente tal como irá en el sílabo y en las firmas. Déjalo vacío si aún no se asigna.', examples: ['Mg. Ana Torres Quispe'] },
 teacherDni: { text: 'DNI del docente; aparece debajo de su firma.', examples: ['41234567'] },
 teacherEmail: { text: 'Correo institucional del docente.', examples: ['ana.torres@unica.edu.pe'] },
};

/** Info icon with a floating explanation and short examples (hover or keyboard focus). */
export default function FieldHelp({ field, label }: { field: string; label?: string }) {
 const id = useId(); const item = help[field]; if (!item) return null;
 return <span className="field-help" tabIndex={0} role="note" aria-label={`Ayuda: ${label || field}`} aria-describedby={id}>
  <Info size={15} aria-hidden="true" />
  <span id={id} className="field-help-popover" role="tooltip">
   {label && <strong className="field-help-title">{label}</strong>}
   <span>{item.text}</span>
   {item.examples?.length ? <span className="field-help-examples"><em>Ejemplo{item.examples.length > 1 ? 's' : ''}:</em>{item.examples.map(e => <code key={e}>{e}</code>)}</span> : null}
  </span>
 </span>;
}
