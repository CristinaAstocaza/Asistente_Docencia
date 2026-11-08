"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { HelpCircle, X, Lightbulb, Target, FolderOpen, Wand2, Download, ListChecks, ShieldCheck, MessageSquare, Search, CalendarDays } from "lucide-react";
import "./section-help.css";

type Card = { icon: typeof HelpCircle; title: string; text: string };
type Help = { title: string; intro: string; cards: Card[] };

const create = (what: string, extra: Card, formats = "PDF o Word"): Card[] => [
  { icon: Target, title: "1. Describe lo que necesitas", text: `Escribe el tema de ${what} con el mayor detalle posible: curso, nivel y lo que quieres lograr.` },
  { icon: Wand2, title: "2. Da indicaciones a la IA", text: "En «Indicaciones para la IA» dile qué priorizar, qué evitar o qué extraer de tus documentos." },
  { icon: FolderOpen, title: "3. Elige tus fuentes", text: "Marca los documentos en «Tus fuentes». Con «Solo mis fuentes» la IA no agrega información externa." },
  extra,
  { icon: Download, title: "Revisa y descarga", text: `El resultado aparece como PDF, igual al archivo final. Descárgalo en ${formats} y queda guardado en tu Historial.` },
];

const HELP: Record<string, Help> = {
  "/dashboard": { title: "Dashboard", intro: "Tu punto de partida: un resumen de lo que has creado y accesos rápidos.", cards: [
    { icon: ListChecks, title: "Tu actividad", text: "Cada tarjeta muestra cuántos materiales tienes por tipo. Haz clic en una para ir a esa sección." },
    { icon: Wand2, title: "¿Qué quieres crear hoy?", text: "Elige el tipo de material y llegarás directamente a su formulario." },
    { icon: FolderOpen, title: "Empieza por tus fuentes", text: "Sube tus sílabos, separatas o libros en «Mis fuentes» para que la IA trabaje con tu propio contenido." },
    { icon: Search, title: "Busca rápido", text: "Usa el buscador de la barra superior para encontrar cualquier material de tu Historial." },
  ] },
  "/perfil": { title: "Mi perfil", intro: "Tus datos, tu seguridad y, si eres administrador, la gestión de cuentas.", cards: [
    { icon: ShieldCheck, title: "Cambia tu contraseña", text: "En la pestaña «Seguridad» escribe tu contraseña actual y la nueva. Se cerrará la sesión en otros dispositivos." },
    { icon: ListChecks, title: "Gestión de usuarios (admin)", text: "Crea cuentas para los docentes con su correo y una contraseña inicial. No existe registro público." },
    { icon: Lightbulb, title: "Desactivar en vez de eliminar", text: "Desactivar bloquea el acceso al instante y conserva los materiales; puedes reactivarla. Eliminar borra todo y pide confirmar escribiendo el correo." },
    { icon: ShieldCheck, title: "Roles de administrador", text: "Con el escudo das o quitas el rol de administrador. La cuenta principal y la tuya propia están protegidas." },
  ] },
  "/fuentes": { title: "Mis fuentes", intro: "Los documentos que la IA usará como base para crear tus materiales.", cards: [
    { icon: FolderOpen, title: "Sube tus documentos", text: "Arrastra PDF, Word, PowerPoint, TXT o imágenes (hasta 50 MB). Cuando digan «Listo», ya puedes usarlos." },
    { icon: ListChecks, title: "Organiza por carpetas", text: "Usa «Organizar» para poner cada archivo en una carpeta (por curso o unidad) y elegirlos juntos al generar." },
    { icon: Lightbulb, title: "Problemas con figuras", text: "Si tus PDF tienen ejercicios con gráficos o tablas, en Exámenes puedes pedir a la IA que los extraiga con sus imágenes." },
  ] },
  "/chat": { title: "Chat IA", intro: "Conversa con la IA sobre tus documentos o pídele materiales directamente.", cards: [
    { icon: MessageSquare, title: "Pregunta con contexto", text: "Selecciona tus fuentes a la izquierda: la IA responderá citando tus documentos." },
    { icon: FolderOpen, title: "Adjunta archivos", text: "Puedes adjuntar archivos solo para esta conversación sin guardarlos en Mis fuentes." },
    { icon: Download, title: "Materiales desde el chat", text: "Si pides una actividad, rúbrica o examen, aparecerá su vista previa en PDF para descargarla." },
  ] },
  "/clases": { title: "Preparar mi clase", intro: "Una guía rápida para tu clase de hoy: cómo empezar, qué explicar, qué harán los estudiantes y cómo cerrar.", cards: create("la clase", { icon: CalendarDays, title: "Ajusta el tiempo", text: "Indica el tiempo disponible: la IA reparte los momentos de la clase según esos minutos." }) },
  "/sesiones": { title: "Sesiones de aprendizaje", intro: "Tus cursos semana a semana con el formato de la UNICA.", cards: [
    { icon: ListChecks, title: "1. Crea el sílabo", text: "Ve a «Sílabos», genera el sílabo del curso y pulsa «Aceptar sílabo»." },
    { icon: CalendarDays, title: "2. Abre una semana", text: "El curso aparece aquí con sus 16–18 semanas. Al abrir una se preparan su sesión, presentación, actividad y rúbrica." },
    { icon: Download, title: "3. Descarga", text: "Cada material de la semana se descarga en PDF o Word. Si algo falla, usa «Reintentar»." },
  ] },
  "/guias": { title: "Guías didácticas", intro: "Material de estudio paso a paso, con imágenes y ejercicios, listo para entregar a tus estudiantes.", cards: create("la guía", { icon: ListChecks, title: "Tipo y páginas", text: "Elige «Paso a paso», «Laboratorio» o «Análisis de casos» e indica cuántas páginas aproximadas quieres." }) },
  "/silabos": { title: "Sílabos", intro: "Sílabos con el formato oficial de la Universidad Nacional San Luis Gonzaga.", cards: [
    { icon: FolderOpen, title: "Parte de un sílabo existente", text: "Adjunta un sílabo en PDF: la IA tomará sus datos institucionales y estructura para el nuevo curso." },
    { icon: Target, title: "Completa los datos del curso", text: "Curso, créditos, semanas y horas. Lo que dejes vacío lo propone la IA." },
    { icon: ListChecks, title: "Acepta el sílabo", text: "Al aceptarlo se crea el curso en «Sesiones de aprendizaje» con todas sus semanas." },
  ] },
  "/presentaciones": { title: "Presentaciones", intro: "Diapositivas listas para clase, con imágenes y el mismo diseño en PowerPoint y PDF.", cards: create("la presentación", { icon: Lightbulb, title: "Usa un PDF de ejemplo", text: "Si tienes una presentación modelo, añádela como ejemplo: la IA copiará su estructura (no su contenido)." }, "PowerPoint o PDF") },
  "/evaluaciones": { title: "Exámenes", intro: "Evaluaciones formales con teoría y casos prácticos, con su solucionario.", cards: create("el examen", { icon: Lightbulb, title: "Problemas de tus fuentes", text: "Escribe en indicaciones, por ejemplo: «Extrae 3 problemas de mis fuentes con sus gráficos». Las figuras se colocarán en el examen." }) },
  "/rubricas": { title: "Rúbricas", intro: "Criterios claros con cuatro niveles de desempeño para evaluar productos y exposiciones.", cards: create("la rúbrica (el producto o actividad a evaluar)", { icon: ListChecks, title: "Número de criterios", text: "Indica cuántos criterios quieres y el nivel educativo; la IA redacta los descriptores de cada nivel." }) },
  "/historial": { title: "Historial", intro: "Todo lo que has generado, guardado y listo para descargar.", cards: [
    { icon: Search, title: "Busca y filtra", text: "Escribe parte del título o filtra por tipo de material." },
    { icon: Download, title: "Abre o descarga", text: "«Abrir» muestra la vista previa en PDF. También puedes descargar en Word o PDF directamente." },
    { icon: ListChecks, title: "Duplica o elimina", text: "Duplica un material para reutilizarlo o elimínalo con el ícono de la papelera." },
  ] },
};

export default function SectionHelp() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const key = Object.keys(HELP).find(k => pathname === k || pathname.startsWith(`${k}/`));
  const help = key ? HELP[key] : null;
  useEffect(() => { if (!open) return; const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); }; window.addEventListener("keydown", esc); return () => window.removeEventListener("keydown", esc); }, [open]);
  if (!help) return null;
  return <>
    <button type="button" className="help-trigger" onClick={() => setOpen(true)} aria-haspopup="dialog" title="Ver indicaciones de esta sección"><HelpCircle size={17} /><span>¿Cómo se usa?</span></button>
    {open && createPortal(<div className="help-backdrop" onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}>
      <aside className="help-panel" role="dialog" aria-modal="true" aria-labelledby="help-title">
        <header><span className="help-badge"><HelpCircle size={16} />Indicaciones</span><button className="btn icon" autoFocus aria-label="Cerrar indicaciones" onClick={() => setOpen(false)}><X size={18} /></button></header>
        <h2 id="help-title">{help.title}</h2>
        <p className="help-intro">{help.intro}</p>
        <ul className="help-cards">{help.cards.map(({ icon: Icon, title, text }) => <li key={title}><span className="help-card-icon"><Icon size={18} /></span><div><strong>{title}</strong><p>{text}</p></div></li>)}</ul>
      </aside>
    </div>, document.body)}
  </>;
}
