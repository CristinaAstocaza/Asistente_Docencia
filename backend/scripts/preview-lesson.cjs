const fs=require('node:fs/promises');
const path=require('node:path');
const {createCanvas}=require('@napi-rs/canvas');
const {renderLessonDocx,renderLessonPdf}=require('../dist/exports/lesson-render');
const lesson={title:'Creación de una API para una base de datos temporal',objective:'Crear una API sencilla que guarde y consulte tareas en memoria.',introduction:'Duración: 10 minutos. Pregunta al grupo cómo una aplicación guarda sus tareas.',motivation:'¿Qué ocurre cuando presionamos «Guardar»? Recoge dos respuestas antes de explicar.',development:['**Una API** es el puente entre la aplicación y el servidor. El cliente solicita información y el servidor responde.','Usa GET para consultar tareas y POST para registrar una nueva.\n\n```js\nconst tareas = [{ id: 1, titulo: "Estudiar APIs" }];\n```'],examples:['El cliente solicita `GET /tareas` y recibe una lista en formato JSON.'],activity:'Duración: 20 minutos. Instrucciones: 1. Abrir el editor y crear el proyecto. 2. Definir una lista de tareas en memoria. 3. Crear la ruta GET y comprobar la respuesta. Materiales necesarios: computadora y editor de código.',closing:'Duración: 10 minutos. Pide a un estudiante explicar el recorrido de una petición.',questions:['¿Para qué sirve GET? Respuesta orientativa: consultar información.','¿Qué ocurre con los datos al reiniciar el servidor? Respuesta orientativa: se pierden porque están en memoria.']};
async function main(){
 const out=path.resolve(__dirname,'../../artifacts');const bytes=await renderLessonPdf(lesson);
 await fs.writeFile(path.join(out,'clase-ejemplo.pdf'),bytes);await fs.writeFile(path.join(out,'clase-ejemplo.docx'),await renderLessonDocx(lesson));
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');const pdf=await pdfjs.getDocument({data:new Uint8Array(bytes),isEvalSupported:false,standardFontDataUrl:path.resolve(__dirname,'../node_modules/pdfjs-dist/standard_fonts').replaceAll('\\','/')+'/'}).promise;
 for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i);const viewport=page.getViewport({scale:1.5});const canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;await fs.writeFile(path.join(out,`clase-ejemplo-pagina-${i}.png`),canvas.toBuffer('image/png'));}
 console.log(`Ejemplo Word y PDF generado: ${pdf.numPages} páginas PDF.`);await pdf.destroy();
}
main().catch(error=>{console.error(error);process.exitCode=1;});
