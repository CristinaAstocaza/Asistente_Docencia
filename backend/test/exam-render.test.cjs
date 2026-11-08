process.env.STORAGE_DRIVER='local';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {renderExamPdf}=require('../dist/exports/exam-render');
const sample={title:'Práctica de Modelado de Datos',duration:60,instructions:'Lee cuidadosamente y marca una alternativa por pregunta.',questions:[{source:'FUENTE INTERNA',topic:'TEMA INTERNO',difficulty:'hard',correctAnswer:'Describe la estructura de los datos.',explanation:'EXPLICACIÓN RESERVADA',options:['Define detalles físicos del almacenamiento.','Describe la estructura de los datos.','Optimiza índices y consultas.','Configura permisos de acceso.'],type:'multiple_choice',question:'¿Cuál es el propósito del modelado conceptual de datos?'},{type:'true_false',question:'Un modelo conceptual depende de un gestor de base de datos específico.',options:[],correctAnswer:'Falso',explanation:'EXPLICACIÓN RESERVADA'},{type:'development',question:'Explica la diferencia entre un modelo conceptual y uno físico con un ejemplo.',options:[],correctAnswer:'RESPUESTA RESERVADA',explanation:'EXPLICACIÓN RESERVADA'}]};
const header=s=>/SAN LUIS GONZAGA|^Clase del día$|^Evaluación escrita$|^Solucionario$/.test(s.trim());
async function read(bytes){const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');return pdfjs.getDocument({data:new Uint8Array(bytes),isEvalSupported:false}).promise;}
test('student PDF has exam layout, ordered questions and lettered alternatives without technical fields or solutions',async()=>{
 const pdf=await read(await renderExamPdf(sample));let text='';for(let i=1;i<=pdf.numPages;i++)text+=(await (await pdf.getPage(i)).getTextContent()).items.map(item=>item.str).join(' ')+' ';
 for(const expected of ['UNIVERSIDAD NACIONAL "SAN LUIS GONZAGA"','EVALUACIÓN ESCRITA','60 minutos','INSTRUCCIONES','PREGUNTA 1','¿Cuál','PREGUNTA 2','Un modelo','PREGUNTA 3','Explica','A)','B)','C)','D)','Verdadero','Falso','Página 1 de'])assert.ok(text.includes(expected),expected);
 // Formal exam: no ruled answer lines or blank student fields.
 for(const forbidden of ['Estudiante:','Curso / sección:','APELLIDOS','NOMBRES','DNI','FIRMA','NOTA','___'])assert.ok(!text.includes(forbidden),forbidden);
 for(const forbidden of ['multiple_choice','true_false','development','FUENTE INTERNA','TEMA INTERNO','EXPLICACIÓN RESERVADA','RESPUESTA RESERVADA','correctAnswer','difficulty','type'])assert.ok(!text.includes(forbidden),forbidden);await pdf.cleanup();
});
test('long exams paginate without losing questions, overlapping footers or separating short questions from their alternatives',async()=>{
 const data={...sample,questions:Array.from({length:25},(_,i)=>({...sample.questions[0],question:`Pregunta ${i+1}: ${'Analiza el diseño de una base de datos. '.repeat(i===0?90:1)}`}))};
 const pdf=await read(await renderExamPdf(data));assert.ok(pdf.numPages>2);let all='';
 for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i),items=(await page.getTextContent()).items,text=items.map(item=>item.str).join(' ');all+=text+' ';assert.ok(text.includes(`Página ${i} de ${pdf.numPages}`));for(const item of items)if(item.str.trim()&&!header(item.str))assert.ok(item.transform[5]>=20&&item.transform[5]<=page.view[3]-28,item.str);for(let n=2;n<=25;n++)if(text.includes(`Pregunta ${n}:`))assert.ok(text.includes('D)'),`Alternativas de ${n}`);}
 assert.ok(all.includes('PREGUNTA 25')&&all.includes('Pregunta 25:'));await pdf.cleanup();
});
test('solution compatibility remains opt-in and never affects the student download',async()=>{
 const pdf=await read(await renderExamPdf(sample,true));let text='';for(let i=1;i<=pdf.numPages;i++)text+=(await (await pdf.getPage(i)).getTextContent()).items.map(item=>item.str).join(' ');assert.ok(text.includes('SOLUCIONARIO'));assert.ok(text.includes('EXPLICACIÓN RESERVADA'));await pdf.cleanup();
});
module.exports.sample=sample;
test('mixed exams require theory and cases, and export every subquestion without student answers',async()=>{
 const {examGenerationContract}=require('../dist/ai/contracts');
 const theory={type:'development',question:'Explica el concepto de integridad de datos.',options:[],correctAnswer:'Respuesta reservada docente',explanation:'Fundamento del concepto.',difficulty:'medium',topic:'Datos',source:''};
 const caseQuestion={...theory,type:'case_study',question:'Una empresa tiene registros duplicados. Analiza la situación.',subquestions:[{question:'Identifica el problema principal.',correctAnswer:'Solución privada uno'},{question:'Propón una medida de prevención.',correctAnswer:'Solución privada dos'}]};
 const exam={title:'Examen mixto',instructions:'Explica y justifica tus respuestas.',duration:60,questions:[theory,caseQuestion]};
 assert.ok(examGenerationContract.safeParse(exam).success);
 assert.equal(examGenerationContract.safeParse({...exam,questions:[theory,theory]}).success,false);
 assert.equal(examGenerationContract.safeParse({...exam,questions:[theory,{...caseQuestion,subquestions:undefined}]}).success,false);
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const pdf=await pdfjs.getDocument({data:new Uint8Array(await renderExamPdf(exam)),isEvalSupported:false}).promise;
 let text='';for(let i=1;i<=pdf.numPages;i++)text+=(await (await pdf.getPage(i)).getTextContent()).items.map(item=>item.str).join(' ');
 assert.match(text,/a\) Identifica el problema principal/);assert.match(text,/b\) Propón una medida de prevención/);assert.doesNotMatch(text,/Solución privada|Respuesta reservada/);await pdf.cleanup();
});
test('model slips in subquestions are repaired instead of rejecting the exam',()=>{
 const {normalizeExamDraft}=require('../dist/ai/exam-images');const {examGenerationContract}=require('../dist/ai/contracts');
 const base={options:[],correctAnswer:'R',explanation:'E',difficulty:'medium',topic:'T',source:''};
 const raw={title:'Estadística inferencial',instructions:'Responda.',duration:60,questions:[
  {...base,type:'development',question:'Explique el intervalo de confianza.',subquestions:[]},
  {...base,type:'development',question:'Defina el error tipo I.',subquestions:[{question:'Dé un ejemplo.',correctAnswer:'Rechazar H0 verdadera.'}]},
  {...base,type:'case_study',question:'Una fábrica mide pesos.',subquestions:[{question:'Plantee H0.',correctAnswer:'mu=500'},{question:'Concluya.',correctAnswer:'No se rechaza.'}]},
  {...base,type:'case_study',question:'Caso incompleto.',subquestions:[{question:'Única.',correctAnswer:'x'}]},
 ]};
 assert.equal(examGenerationContract.safeParse(structuredClone(raw)).success,false,'the raw draft is invalid');
 const fixed=normalizeExamDraft(raw);const result=examGenerationContract.safeParse(fixed);assert.ok(result.success,JSON.stringify(result.error?.issues));
 assert.equal(fixed.questions[0].subquestions,undefined);assert.match(fixed.questions[1].question,/Dé un ejemplo/);assert.match(fixed.questions[1].correctAnswer,/Rechazar H0/);
 assert.equal(fixed.questions[3].type,'development');assert.equal(fixed.questions[2].subquestions.length,2);
});
test('figures from the sources are linked only when real and drawn in the exam PDF and Word',async()=>{
 const {linkExamImages}=require('../dist/ai/exam-images');const {renderExamDocx}=require('../dist/exports/exam-render');
 const {createCanvas}=require('@napi-rs/canvas');const c=createCanvas(400,240);const g=c.getContext('2d');g.fillStyle='#2563EB';g.fillRect(0,0,400,240);const png=c.toBuffer('image/png');
 const images=[{id:'img-1',document:'Problemas.pdf',page:3,width:400,height:240,caption:'',bytes:png,thumbnail:''}];
 const data={title:'Examen con figura',duration:30,instructions:'Responda.',questions:[{type:'development',question:'Observe la figura e interprete el histograma.',options:[],correctAnswer:'R',explanation:'',sourceImage:'img-1',image:{assetId:'forged'}},{type:'development',question:'Sin figura.',options:[],correctAnswer:'R',explanation:'',sourceImage:'inventada'}]};
 await linkExamImages(data,images,async()=> 'asset-1');
 assert.deepEqual(data.questions[0].image,{assetId:'asset-1',caption:'Problemas.pdf, p. 3',width:400,height:240});assert.equal(data.questions[1].image,undefined);assert.equal(data.questions[0].sourceImage,undefined);
 const assets=new Map([['asset-1',{bytes:png,mime:'image/png'}]]);
 const pdf=await read(await renderExamPdf(data,false,assets));const page=await pdf.getPage(1);const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const ops=await page.getOperatorList();assert.ok(ops.fnArray.filter(op=>op===pdfjs.OPS.paintImageXObject).length>=2,'shield plus the figure');
 const text=(await page.getTextContent()).items.map(i=>i.str).join(' ');assert.match(text,/Figura 1 · Problemas\.pdf, p\. 3/);await pdf.cleanup();
 const docx=await renderExamDocx(data,false,assets);const zip=await require('jszip').loadAsync(docx);assert.ok(Object.keys(zip.files).filter(f=>f.startsWith('word/media/')).length>=2);
});
