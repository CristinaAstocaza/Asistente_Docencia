process.env.STORAGE_DRIVER='local';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const JSZip=require('jszip');
const {renderAcademicDocx,renderAcademicPdf,renderAcademicRubricDocx,renderAcademicRubricPdf}=require('../dist/exports/academic-render');
const {validateSemantics}=require('../dist/ai/ai.module');
const activity={title:'Actividad: análisis de IA',achievement:'Analizar oportunidades y límites.',generalInstructions:'Investiga un caso y presenta un informe.',specificInstructions:['Describe el caso.','Contrasta dos fuentes.'],recommendations:['Organiza tus ideas.'],submission:['Entrega un informe escrito.'],evaluation:'Se evaluará el análisis, la evidencia y las conclusiones.'};
const names=['Estándar esperado','En proceso 2','En proceso 1','Inicial'];
const rubric={title:'Rúbrica de la actividad',scoringMode:'points',totalPoints:20,criteria:[5,5,4,2,2,2].map((max,i)=>({name:`Criterio ${i+1}`,definition:`Evalúa la dimensión ${i+1}.`,levels:names.map((name,j)=>({name,score:max*(4-j)/4,description:`Descriptor observable del nivel ${name}.`}))}))};
test('academic DOCX has real numbered headings and bullets; rubric uses six table columns and custom points',async()=>{
 const zip=await JSZip.loadAsync(await renderAcademicDocx(activity,'activity'));const xml=await zip.file('word/document.xml').async('string');assert.match(xml,/1\. Logro a evaluar/);assert.match(xml,/3\. Indicaciones específicas/);assert.match(xml,/<w:numPr>/);assert.doesNotMatch(xml,/>Secciones</);
 validateSemantics('rubric',rubric);assert.throws(()=>validateSemantics('rubric',{...rubric,totalPoints:19}));
 const table=await JSZip.loadAsync(await renderAcademicRubricDocx(rubric));const layout=await table.file('word/document.xml').async('string');assert.match(layout,/Definición del criterio/);assert.match(layout,/Estándar esperado/);assert.match(layout,/Puntaje máximo: 20/);assert.equal((layout.match(/<w:gridCol\b/g)||[]).length,6);assert.match(layout,/w:orient="landscape"/);assert.match(layout,/<w:tblHeader/);
});
test('academic PDFs keep activity structure and paginate long rubric descriptors without losing text',async()=>{
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
 async function read(bytes){const pdf=await pdfjs.getDocument({data:new Uint8Array(bytes),isEvalSupported:false}).promise;let text='';for(let i=1;i<=pdf.numPages;i++)text+=(await (await pdf.getPage(i)).getTextContent()).items.map(x=>x.str).join(' ');const pages=pdf.numPages;await pdf.cleanup();return {text,pages};}
 assert.match((await read(await renderAcademicPdf(activity,'activity'))).text,/Indicaciones específicas/);
 const long={...rubric,criteria:rubric.criteria.map(c=>({...c,levels:c.levels.map(l=>({...l,description:l.description+' Evidencia verificable.'.repeat(200)+' FINAL DEL DESCRIPTOR'}))}))};
 const parsed=await read(await renderAcademicRubricPdf(long));assert.ok(parsed.pages>1);assert.match(parsed.text,/Definición del criterio/);assert.equal((parsed.text.match(/FINAL DEL DESCRIPTOR/g)||[]).length,24);assert.ok((parsed.text.match(/Estándar esperado/g)||[]).length>=parsed.pages);
});
