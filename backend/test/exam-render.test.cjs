process.env.STORAGE_DRIVER='local';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {renderExamPdf}=require('../dist/exports/exam-render');
const sample={title:'Práctica de Modelado de Datos',duration:60,instructions:'Lee cuidadosamente y marca una alternativa por pregunta.',questions:[{source:'FUENTE INTERNA',topic:'TEMA INTERNO',difficulty:'hard',correctAnswer:'Describe la estructura de los datos.',explanation:'EXPLICACIÓN RESERVADA',options:['Define detalles físicos del almacenamiento.','Describe la estructura de los datos.','Optimiza índices y consultas.','Configura permisos de acceso.'],type:'multiple_choice',question:'¿Cuál es el propósito del modelado conceptual de datos?'},{type:'true_false',question:'Un modelo conceptual depende de un gestor de base de datos específico.',options:[],correctAnswer:'Falso',explanation:'EXPLICACIÓN RESERVADA'},{type:'development',question:'Explica la diferencia entre un modelo conceptual y uno físico con un ejemplo.',options:[],correctAnswer:'RESPUESTA RESERVADA',explanation:'EXPLICACIÓN RESERVADA'}]};
async function read(bytes){const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');return pdfjs.getDocument({data:new Uint8Array(bytes),isEvalSupported:false}).promise;}
test('student PDF has exam layout, ordered questions and lettered alternatives without technical fields or solutions',async()=>{
 const pdf=await read(await renderExamPdf(sample));let text='';for(let i=1;i<=pdf.numPages;i++)text+=(await (await pdf.getPage(i)).getTextContent()).items.map(item=>item.str).join(' ')+' ';
 for(const expected of ['EVALUACIÓN ESCRITA','Estudiante:','Fecha:','Curso / sección:','60 minutos','Instrucciones','1. ¿Cuál','2. Un modelo','3. Explica','A)','B)','C)','D)','Verdadero','Falso','Página 1 de'])assert.ok(text.includes(expected),expected);
 for(const forbidden of ['multiple_choice','true_false','development','FUENTE INTERNA','TEMA INTERNO','EXPLICACIÓN RESERVADA','RESPUESTA RESERVADA','correctAnswer','difficulty','type'])assert.ok(!text.includes(forbidden),forbidden);await pdf.cleanup();
});
test('long exams paginate without losing questions, overlapping footers or separating short questions from their alternatives',async()=>{
 const data={...sample,questions:Array.from({length:25},(_,i)=>({...sample.questions[0],question:`Pregunta ${i+1}: ${'Analiza el diseño de una base de datos. '.repeat(i===0?90:1)}`}))};
 const pdf=await read(await renderExamPdf(data));assert.ok(pdf.numPages>2);let all='';
 for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i),items=(await page.getTextContent()).items,text=items.map(item=>item.str).join(' ');all+=text+' ';assert.ok(text.includes(`Página ${i} de ${pdf.numPages}`));for(const item of items)if(item.str.trim())assert.ok(item.transform[5]>=20&&item.transform[5]<=page.view[3]-28,item.str);for(let n=2;n<=25;n++)if(text.includes(`Pregunta ${n}:`))assert.ok(text.includes('D)'),`Alternativas de ${n}`);}
 assert.ok(all.includes('25. Pregunta 25:'));await pdf.cleanup();
});
test('solution compatibility remains opt-in and never affects the student download',async()=>{
 const pdf=await read(await renderExamPdf(sample,true));let text='';for(let i=1;i<=pdf.numPages;i++)text+=(await (await pdf.getPage(i)).getTextContent()).items.map(item=>item.str).join(' ');assert.ok(text.includes('GUÍA DEL DOCENTE'));assert.ok(text.includes('EXPLICACIÓN RESERVADA'));await pdf.cleanup();
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
