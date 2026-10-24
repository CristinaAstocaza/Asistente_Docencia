import { useId } from 'react';

const help:Record<string,string>={
 topic:'Escribe el tema y lo que quieres evaluar. Ej.: Biología: identificar las partes de la célula y explicar sus funciones.',
 count:'Cantidad de preguntas que se generarán.',
 type:'Elige cómo responderán: alternativas, verdadero/falso o una respuesta escrita.',
 difficulty:'Fácil: recordar conceptos. Media: aplicar lo aprendido. Difícil: analizar casos y justificar decisiones.',
 level:'Indica a quién va dirigido. Ej.: 3.º de secundaria o primer ciclo universitario.',
 examType:'Tipo de evaluación: práctica para ejercitar, parcial para una parte del curso o final para el curso completo.',
 duration:'Tiempo total disponible, en minutos. Ej.: 45 para una clase o evaluación de 45 minutos.',
 competency:'Capacidad que el estudiante desarrollará al integrar conocimientos y habilidades. Ej.: argumentar una postura con evidencias.',
 objective:'Qué quieres conseguir con esta clase. Ej.: que los estudiantes comprendan cómo funciona una API.',
 outcome:'Lo que el estudiante podrá demostrar al terminar. Ej.: crear una API con dos rutas funcionales.',
 outcomes:'Resultados que podrán demostrar al finalizar el curso. Ej.: elaborar y presentar un informe con argumentos y fuentes.',
 methodology:'Cómo se desarrollará el aprendizaje. Ej.: explicación breve, trabajo en equipos y resolución de un caso.',
 credits:'Créditos académicos asignados al curso según el plan de estudios. Ej.: 3 créditos.',
 course:'Nombre de la asignatura o curso universitario. Ej.: Inteligencia Artificial.',
 weeklyHours:'Horas académicas semanales en total (teoría y práctica). Ej.: 4 horas.',
 modality:'Modalidad de impartición: Presencial, Virtual o Semipresencial.',
 cycle:'Periodo o nivel del programa. Ej.: segundo ciclo universitario.',
 evaluationScheme:'Indica las evaluaciones, sus porcentajes y las semanas. Ej.: práctica 30% (semana 6), proyecto 30% (semana 12), final 40% (semana 18).',
 prerequisites:'Cursos o conocimientos necesarios antes de iniciar. Ej.: haber aprobado Comunicación I.',
 bibliography:'Fuentes del curso. Incluye autor, año y título; puedes añadir un enlace.',
 criteriaCount:'Cantidad de aspectos que evaluarás. Ej.: claridad, precisión, organización y uso de evidencias.',
};
export default function FieldHelp({field}:{field:string}){
 const id=useId();const text=help[field];if(!text)return null;
 return <span className="field-help" tabIndex={0} role="note" aria-label="Ayuda del campo" aria-describedby={id}><span aria-hidden="true">*</span><span id={id} className="field-help-popover" role="tooltip">{text}</span></span>;
}
