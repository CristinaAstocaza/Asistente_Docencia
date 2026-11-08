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
test('syllabus corrects weights, codes, duplicate rows and unit weeks, and rejects missing weeks',()=>{
 const coherent=d=>{
  assert.equal(d.evaluationPlan.items.reduce((sum,i)=>sum+i.weight,0),100);
  const weekOf=new Map(d.evaluationPlan.items.map(i=>[i.code,i.week]));
  for(const row of d.schedule)for(const code of row.assessments)assert.equal(weekOf.get(code),row.week,code);
  for(const item of d.evaluationPlan.items)assert.ok(d.schedule.some(r=>r.week===item.week&&r.assessments.includes(item.code)),item.code);
  assert.equal(new Set(d.schedule.map(r=>`${r.week}-${r.session}`)).size,d.schedule.length);
  d.units.forEach((u,i)=>assert.deepEqual(u.weeks,[...new Set(d.schedule.filter(r=>r.unit===i+1).map(r=>String(r.week)))].sort((a,b)=>a-b)));
 };
 for(const change of [d=>d.evaluationPlan.items[0].weight=5,d=>d.schedule[0].unit=2,d=>d.schedule[2].assessments=['DESCONOCIDO'],d=>d.evaluationPlan.items[0].week=4,d=>d.schedule.push(structuredClone(d.schedule[0])),d=>d.units[0].weeks.push('4')]){
  const fixed=structuredClone(sample);change(fixed);validateSemantics('syllabus',fixed,{weeks:18});coherent(fixed);
 }
 const missing=structuredClone(sample);missing.schedule=missing.schedule.filter(r=>r.week!==18);
 assert.throws(()=>validateSemantics('syllabus',missing,{weeks:18}),/no cubre todas las semanas/);
});
test('Word syllabus follows the UNICA sections in order with its tables and evaluation weights',async()=>{
 const titles=syllabusSections(sample).map(s=>s.title).filter(Boolean);
 assert.deepEqual(titles.map(t=>t.split('.')[0]),['I','II','III','IV','V','VI','VII','VIII']);
 const zip=await JSZip.loadAsync(await renderSyllabusDocx(sample));const xml=await zip.file('word/document.xml').async('string');let previous=-1;
 for(const title of titles){const index=xml.indexOf(title);assert.ok(index>previous,title);previous=index;}
 // Timetable, one table per unit, evaluation schedule, activity schedule and the signature layout.
 assert.equal((xml.match(/<w:tbl>/g)||[]).length,sample.units.length+4);
 assert.match(xml,/Promedio Final = 50% \(EC\) \+ 40% \(ED\) \+ 10% \(EA\)/);assert.match(xml,/PTF – Portafolio final \(25 %\)/);assert.match(xml,/Presentación y evaluación del portafolio final/);assert.ok(zip.file('word/footer1.xml'));
 // Cronograma: one merged cell per unit; prose justified with 1.5 line spacing.
 assert.ok((xml.match(/<w:vMerge w:val="restart"\/>/g)||[]).length>=sample.units.length);assert.ok(!/Semana 1<\/w:t>/.test(xml.slice(xml.indexOf('VIII. CRONOGRAMA'))));
 assert.match(xml,/<w:spacing[^>]*w:line="360"[^>]*\/><w:jc w:val="both"\/>/);
});
test('PDF repeats table headers and keeps long cronogram rows without clipping',async()=>{
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');const data=structuredClone(sample);data.schedule[0].activities=['Actividad con evidencia observable. '.repeat(150)+'FIN DE ACTIVIDAD LARGA'];
 const pdf=await pdfjs.getDocument({data:new Uint8Array(await renderSyllabusPdf(data)),isEvalSupported:false}).promise;let all='';let cronogramPages=0;
 for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i),items=(await page.getTextContent()).items;const content=items.map(item=>item.str).join(' ');all+=content+' ';assert.match(content,new RegExp('Sílabo · '+i+' / '+pdf.numPages));if(content.includes('Tema específico'))cronogramPages++;for(const item of items)if(item.str.trim())assert.ok(item.transform[5]>=16&&item.transform[5]<=page.view[3]-30,item.str);}
 assert.ok(cronogramPages>=2);assert.match(all,/FIN DE ACTIVIDAD LARGA/);assert.match(all,/portafolio final/);assert.match(all,/18/);await pdf.cleanup();
});

test('the signature date is the day the syllabus is created, never a typed or imported one',()=>{
 const {applyUnicaData,signatureDate}=require('../dist/ai/syllabus');
 assert.equal(signatureDate(new Date('2026-09-03T15:00:00Z')),'03 de setiembre del 2026');
 const data=applyUnicaData(structuredClone(sample),{signatureDate:'01 de enero del 2020'});
 assert.equal(data.signatureDate,signatureDate());assert.match(data.signatureDate,/^\d{2} de [a-z]+ del \d{4}$/);
});
