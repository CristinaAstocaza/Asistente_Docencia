const {test}=require('node:test');
const assert=require('node:assert/strict');
const JSZip=require('jszip');
const {renderSessionDocx,renderSessionPdf}=require('../dist/exports/session-document');
const {renderActivityDocx,renderActivityPdf}=require('../dist/exports/activity-document');
const {renderAcademicRubricDocx,renderAcademicRubricPdf}=require('../dist/exports/academic-render');
const citations=[{reference:1,name:'Data-Warehouse-I.pdf',page:1}];
const session={title:'Sesión',area:'Unidad',course:'Curso',topic:'Tema',duration:90,competency:'C',outcome:'Al finalizar la sesión, el estudiante diseña un modelo.',methodology:'Activa',stages:[{name:'Inicio',minutes:20,activities:['Motivación'],resources:['PPT']},{name:'Desarrollo',minutes:50,activities:['Análisis'],resources:['Caso']},{name:'Cierre',minutes:20,activities:['Síntesis'],resources:['Rúbrica']}],assessment:'Formativa'};
const activity={title:'Actividad',achievement:'Logro',generalInstructions:'Indicaciones',specificInstructions:['Paso'],recommendations:[],submission:['Informe'],evaluation:'Se evaluará con la rúbrica «R».',rubric:{title:'R',criteria:[{name:'Claridad',value:'25 %'}]}};
const level=(name,score)=>({name,score,description:'Descriptor.'});
const rubric={title:'Rúbrica',scoringMode:'weighted',criteria:[{name:'Claridad',definition:'Qué se evalúa',weight:100,levels:[level('A',4),level('B',3),level('C',2),level('D',1)]}]};
const docxText=async bytes=>(await (await JSZip.loadAsync(bytes)).file('word/document.xml').async('string'));
const pdfText=async bytes=>{const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');const pdf=await pdfjs.getDocument({data:new Uint8Array(bytes),isEvalSupported:false}).promise;let t='';for(let i=1;i<=pdf.numPages;i++)t+=(await (await pdf.getPage(i)).getTextContent()).items.map(x=>x.str).join(' ');await pdf.cleanup();return t;};
test('session, activity and rubric documents do not list the consulted sources',async()=>{
 for(const bytes of [await renderSessionDocx(session,new Map(),citations),await renderActivityDocx(activity,citations),await renderAcademicRubricDocx(rubric,citations)]){const xml=await docxText(bytes);assert.doesNotMatch(xml,/Fuentes consultadas|Data-Warehouse-I/);}
 for(const bytes of [await renderSessionPdf(session,new Map(),citations),await renderActivityPdf(activity,citations),await renderAcademicRubricPdf(rubric,citations)]){const text=await pdfText(bytes);assert.doesNotMatch(text,/Fuentes consultadas|Data-Warehouse-I/);}
});
test('the activity names its rubric but does not repeat the criteria table',async()=>{
 const xml=await docxText(await renderActivityDocx(activity));assert.match(xml,/Se evaluará con la rúbrica/);assert.doesNotMatch(xml,/Criterio de la rúbrica|Peso \/ puntaje/);
 assert.doesNotMatch(await pdfText(await renderActivityPdf(activity)),/Criterio de la rúbrica|Peso \/ puntaje/);
});
