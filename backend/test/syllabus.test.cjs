process.env.STORAGE_DRIVER='local';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const JSZip=require('jszip');
const {contracts}=require('../dist/ai/contracts');
const {syllabusGenerationContract}=require('../dist/ai/syllabus');
const {validateSemantics,AIService}=require('../dist/ai/ai.module');
const {syllabusSections,renderSyllabusDocx,renderSyllabusPdf}=require('../dist/exports/syllabus-render');
const sample=require('./fixtures/syllabus.cjs');
test('new syllabus generation requires all ten sections and legacy syllabi remain editable',async()=>{
 const rich=syllabusGenerationContract.parse(sample);validateSemantics('syllabus',rich,{weeks:18});
 const legacy={title:sample.title,course:sample.course,credits:3,cycle:'2',description:sample.description,competency:sample.competency,outcomes:sample.outcomes,units:sample.units,methodology:sample.methodology,evaluation:sample.evaluation,bibliography:sample.bibliography};
 assert.ok(contracts.syllabus.safeParse(legacy).success);assert.ok(!syllabusGenerationContract.safeParse(legacy).success);validateSemantics('syllabus',legacy);
 let schema;const ai=new AIService({query:async()=>[rich]},{generate:async(_system,_prompt,value)=>{schema=value;return {text:JSON.stringify(sample),usage:{}};}});ai.reserve=async()=>'';ai.context=async()=>({context:'',citations:[]});ai.record=async()=>{};
 await ai.generate('teacher',{kind:'syllabus',topic:'Comunicación',sourceIds:[],mode:'general',parameters:{weeks:18}});for(const key of ['generalData','rationale','generalOutcome','evaluationPlan','bibliographyDetails','competencies','schedule'])assert.ok(schema.required.includes(key),key);
});
test('syllabus rejects wrong weights, missing weeks, mismatched units and evaluation codes',()=>{
 for(const change of [d=>d.evaluationPlan.items[0].weight=5,d=>d.schedule.pop(),d=>d.schedule[0].unit=2,d=>d.schedule[2].assessments=['DESCONOCIDO'],d=>d.evaluationPlan.items[0].week=4,d=>d.schedule.push(d.schedule[0]),d=>d.units[0].weeks.push('4')]){const invalid=structuredClone(sample);change(invalid);assert.throws(()=>validateSemantics('syllabus',invalid,{weeks:18}));}
});
test('Word syllabus has ten ordered sections and real evaluation and schedule tables',async()=>{
 assert.equal(syllabusSections(sample).length,10);const zip=await JSZip.loadAsync(await renderSyllabusDocx(sample));const xml=await zip.file('word/document.xml').async('string');let previous=-1;
 for(const section of syllabusSections(sample)){const index=xml.indexOf(section.title);assert.ok(index>previous,section.title);previous=index;}
 assert.equal((xml.match(/<w:tbl>/g)||[]).length,4);assert.equal((xml.match(/<w:tblHeader/g)||[]).length,4);assert.match(xml,/Promedio final/);assert.match(xml,/25 %/);assert.match(xml,/Presentación y evaluación del portafolio final/);assert.ok(zip.file('word/footer1.xml'));
});
test('PDF repeats table headers and keeps long cronogram rows without clipping',async()=>{
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');const data=structuredClone(sample);data.schedule[0].activities=['Actividad con evidencia observable. '.repeat(150)+'FIN DE ACTIVIDAD LARGA'];
 const pdf=await pdfjs.getDocument({data:new Uint8Array(await renderSyllabusPdf(data)),isEvalSupported:false}).promise;let all='';let cronogramPages=0;
 for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i),items=(await page.getTextContent()).items;const content=items.map(item=>item.str).join(' ');all+=content+' ';assert.match(content,new RegExp('Sílabo · '+i+' / '+pdf.numPages));if(content.includes('Unidad de aprendizaje'))cronogramPages++;for(const item of items)if(item.str.trim())assert.ok(item.transform[5]>=16&&item.transform[5]<=page.view[3]-30,item.str);}
 assert.ok(cronogramPages>=2);assert.match(all,/FIN DE ACTIVIDAD LARGA/);assert.match(all,/portafolio final/);assert.match(all,/18/);await pdf.cleanup();
});
