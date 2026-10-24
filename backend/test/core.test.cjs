process.env.STORAGE_DRIVER='local';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {hashPassword,verifyPassword}=require('../dist/auth/auth.module');
const {chunkPages,validateFile,extract}=require('../dist/documents/extract');
const {publicAddress}=require('../dist/documents/web-source');
const {routePlan,validateSemantics}=require('../dist/ai/ai.module');
const {flatten,examVersion,renderDocx,renderPdf,renderPptx}=require('../dist/exports/render');
const {quizCsv}=require('../dist/exports/exports.module');
const {quizWorkbook}=require('../dist/exports/quiz-workbook');
const JSZip=require('jszip');
const q={type:'multiple_choice',question:'¿Cuánto es 2 + 2?',options:['3','4'],correctAnswer:'4',explanation:'Dos pares forman cuatro.',difficulty:'easy',topic:'Suma',source:''};
test('passwords use unique salts and reject incorrect passwords',async()=>{
 const a=await hashPassword('secreto-seguro'),b=await hashPassword('secreto-seguro');assert.notEqual(a,b);assert.equal(await verifyPassword('secreto-seguro',a),true);assert.equal(await verifyPassword('incorrecta',a),false);
});
test('uploads validate actual bytes and reject renamed executable files',()=>{
 assert.equal(validateFile('apuntes.txt',Buffer.from('Álgebra y sumas')),'TXT');assert.throws(()=>validateFile('archivo.pdf',Buffer.from('MZprogram')));assert.throws(()=>validateFile('archivo.exe',Buffer.from('MZ')));assert.throws(()=>validateFile('archivo.txt',Buffer.from([1,0,1])));
});
test('chunking preserves pages, overlap and limits without sending whole documents',()=>{
 const chunks=chunkPages([{page:12,text:'abcdefghijklmno'},{page:13,text:'xyz'}],8,2);assert.deepEqual(chunks,[{page:12,text:'abcdefgh'},{page:12,text:'ghijklmn'},{page:12,text:'mno'},{page:13,text:'xyz'}]);assert.throws(()=>chunkPages([],8,8));
});
test('web source address validation blocks private networks and IPv4 mapped IPv6',()=>{
 for(const ip of ['127.0.0.1','10.1.2.3','169.254.169.254','172.20.0.1','192.168.1.1','::1','::ffff:127.0.0.1','fc00::1'])assert.equal(publicAddress(ip),false,ip);assert.equal(publicAddress('8.8.8.8'),true);
});
test('router supports chained material generation without routing explanatory questions',()=>{
 assert.deepEqual(routePlan('Prepárame una clase y luego crea una presentación'),['lesson','presentation']);assert.deepEqual(routePlan('Explícame qué es una rúbrica'),[]);
});
test('rubric and session semantics reject invalid totals',()=>{
 assert.throws(()=>validateSemantics('rubric',{criteria:[{weight:70,levels:[]}]}));assert.throws(()=>validateSemantics('session',{duration:60,stages:[{name:'Inicio',minutes:10},{name:'Desarrollo',minutes:20},{name:'Cierre',minutes:10}]}));
});
test('student export omits answers and exam variants preserve solution identities',()=>{
 const original={title:'Examen',questions:[q]};const variant=examVersion(original,'B');assert.deepEqual(original.questions[0].options,['3','4']);assert.ok(variant.questions[0].options.includes(variant.questions[0].correctAnswer));assert.ok(!flatten(original,false).some(l=>l.text==='Respuesta correcta'||l.text===q.explanation));
});
test('exports create valid DOCX, PDF and editable PPTX containers',async()=>{
 const docx=await renderDocx(flatten({title:'Clase',objective:'Aprender a sumar.'}));const zip=await JSZip.loadAsync(docx);assert.ok(zip.file('word/document.xml'));
 const pdf=await renderPdf([{text:'Clase de matemática',heading:true},{text:'Aprender a sumar.'}]);assert.equal(pdf.subarray(0,5).toString(),'%PDF-');
 const pptx=await renderPptx({title:'Clase',style:'moderno',slides:[{title:'Sumas',content:['2 + 2 = 4'],layout:'bullets',notes:'Explicar con pares.',visualSuggestion:'Dos pares de objetos.'}]});const ppt=await JSZip.loadAsync(pptx);assert.ok(ppt.file('ppt/slides/slide1.xml'));assert.ok(ppt.file('ppt/notesSlides/notesSlide1.xml'));
});
test('DOCX and PPTX extraction return real text and slide provenance',async()=>{
 const docx=await renderDocx([{text:'Material propio del docente'}]);assert.match((await extract(docx,'DOCX',{}))[0].text,/Material propio/);
 const pptx=await renderPptx({title:'Tema',slides:[{title:'Primera',content:['Concepto específico'],notes:'Notas',visualSuggestion:'Imagen'}]});const pages=await extract(pptx,'PPTX',{});assert.equal(pages[0].page,1);assert.match(pages[0].text,/Concepto específico/);
 const pdf=await renderPdf([{text:'Fuente docente en PDF'}]);const pdfPages=await extract(pdf,'PDF',{});assert.equal(pdfPages[0].page,1);assert.match(pdfPages[0].text,/Fuente docente/);
});
test('presentations contain editable diagrams and quantitative shapes shared with PDF',async()=>{
 const pptx=await renderPptx({title:'Conceptos',style:'moderno',slides:[{title:'Proceso',content:['Organizar el trabajo'],layout:'two-column',notes:'Explicación',visualSuggestion:'Diagrama',visual:{type:'diagram',items:[{label:'Inicio'},{label:'Desarrollo'},{label:'Cierre'}]}},{title:'Valores',content:['Datos de ejemplo'],layout:'bullets',notes:'Comparar',visualSuggestion:'Gráfico',visual:{type:'chart',items:[{label:'A',value:2},{label:'B',value:4}]}}]});
 const zip=await JSZip.loadAsync(pptx);const slide=await zip.file('ppt/slides/slide1.xml').async('string');assert.match(slide,/Inicio/);assert.match(slide,/Cierre/);const chart=await zip.file('ppt/slides/slide2.xml').async('string');assert.match(chart,/<a:t>A<\/a:t>/);assert.match(chart,/<a:t>4<\/a:t>/);assert.ok((chart.match(/<p:sp>/g)||[]).length>8);
});
test('quiz export validates supported answers and neutralizes spreadsheet formulas',()=>{
 const csv=quizCsv([{...q,question:'=HYPERLINK("example")'}],'quizizz');assert.ok(csv.includes("'=HYPERLINK"));assert.throws(()=>quizCsv([{...q,type:'development',options:[]}],'quizizz'));
});
test('quiz workbooks preserve official headers and remove example rows',async()=>{
 for(const platform of ['quizizz']){
  const bytes=await quizWorkbook([q],platform);const zip=await JSZip.loadAsync(bytes);const sheet=await zip.file('xl/worksheets/sheet1.xml').async('string');
  assert.match(sheet,/r="A3"/);assert.ok(sheet.includes(q.question));
 }

});
