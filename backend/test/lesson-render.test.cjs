process.env.STORAGE_DRIVER='local';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const JSZip=require('jszip');
const {lessonBlocks,renderLessonDocx,renderLessonPdf}=require('../dist/exports/lesson-render');
// Deliberately unordered: exports must follow the classroom sequence, not JSON key order.
const lesson={closing:'Síntesis final de la clase.',activity:'Duración: 20 minutos. Instrucciones: 1. Abrir el editor. 2. Crear un servidor. 3. Probar la ruta. Materiales necesarios: computadora.',examples:['Ejemplo con `GET /tareas`.'],objective:'Construir una API sencilla.',title:'Creación de una API temporal',questions:['¿Cómo responde el servidor?'],motivation:'Pregunta inicial para conectar.',development:['**Una API** comunica al cliente con el servidor.\n\n```js\nconst tareas = [{ id: 1 }];\n```'],introduction:'Duración: 10 minutos. Presenta un caso cotidiano.'};
test('lesson formatting separates legacy inline steps without changing code or decimal values',()=>{
 const blocks=lessonBlocks(lesson.activity);assert.equal(blocks.filter(b=>b.kind==='number').length,3);assert.equal(blocks.at(-1).text,'Materiales necesarios: computadora.');
 const code=lessonBlocks('Precio: 1.5 soles. `1. Crear`\n```js\nconst x = "2. Probar";\n```');assert.equal(code.filter(b=>b.kind==='number').length,0);assert.equal(code.at(-1).kind,'code');assert.equal(code.at(-1).text,'const x = "2. Probar";');
});
test('Word lesson has classroom order, colored headings, code font and footer',async()=>{
 const zip=await JSZip.loadAsync(await renderLessonDocx(lesson,[{reference:1,name:'Manual API',page:2}]));const xml=await zip.file('word/document.xml').async('string');
 const headings=['Creación de una API temporal','Qué aprenderán hoy','1. Cómo empezar','2. Qué explicar','3. Qué harán los estudiantes','4. Cómo cerrar','Fuentes consultadas'];
 let previous=-1;for(const heading of headings){const index=xml.indexOf(heading);assert.ok(index>previous,heading);previous=index;}
 assert.match(xml,/w:fill="F5F3FF"/);assert.match(xml,/Consolas/);assert.match(xml,/w:val="Heading1"/);assert.match(xml,/1\. Abrir el editor/);assert.match(xml,/Manual API/);assert.ok(zip.file('word/footer1.xml'));
});
test('PDF lesson preserves order and long content across pages with visible footers',async()=>{
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const long={...lesson,development:[...lesson.development,'Explicación del servidor. '.repeat(700)+'FIN DEL CONTENIDO LARGO']};
 const pdf=await pdfjs.getDocument({data:new Uint8Array(await renderLessonPdf(long)),isEvalSupported:false}).promise;
 let text='';assert.ok(pdf.numPages>2);
 for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i);const items=(await page.getTextContent()).items;const pageText=items.map(x=>x.str).join(' ');text+=pageText+' ';assert.match(pageText,new RegExp('Clase del día · '+i+' / '+pdf.numPages));for(const item of items)if(item.str.trim())assert.ok(item.transform[5]>=20&&item.transform[5]<=page.view[3]-35,item.str);}
 let previous=-1;for(const heading of ['Qué aprenderán hoy','1. Cómo empezar','2. Qué explicar','3. Qué harán los estudiantes','4. Cómo cerrar']){const index=text.indexOf(heading);assert.ok(index>previous,heading);previous=index;}
 assert.match(text,/FIN DEL CONTENIDO LARGO/);assert.match(text,/const\s+tareas/);assert.match(text,/3\. Probar la ruta/);await pdf.cleanup();
});
