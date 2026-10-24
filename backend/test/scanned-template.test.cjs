process.env.STORAGE_DRIVER='local';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {AcademicController}=require('../dist/academic/academic.module');
const {renderPdf}=require('../dist/exports/render');
const {defaultGuideDesign}=require('../dist/exports/guide-publication');
const id='00000000-0000-4000-8000-000000000001';
function blankPdf(){
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> >>'];
 let pdf='%PDF-1.4\n';const offsets=[0];
 objects.forEach((body,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${body}\nendobj\n`;});
 const xref=Buffer.byteLength(pdf);pdf+='xref\n0 4\n0000000000 65535 f \n'+offsets.slice(1).map(offset=>`${String(offset).padStart(10,'0')} 00000 n \n`).join('');
 return Buffer.from(pdf+`trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
}

for(const scanned of [true,false])test(`template analysis uses ${scanned?'visual PDF reading when text is absent':'extracted text for a normal PDF'}`,async()=>{
 const bytes=scanned?blankPdf():await renderPdf([{text:'Introduction and learning objectives'}]);
 let calls=0,saved;
 const db={query:async(sql,args)=>{
  if(sql.startsWith('SELECT'))return [{id,type:'PDF',storage_key:id}];
  saved=JSON.parse(args[5]);return [{id,structure:saved}];
 }};
 const provider={generate:async(system,prompt,schema,assets)=>{
  calls++;
  if(calls===1){
   if(scanned){assert.equal(assets[0].mime,'application/pdf');assert.deepEqual(Buffer.from(assets[0].data,'base64'),bytes);assert.match(prompt,/Lee visualmente/);}
   else{assert.equal(assets,undefined);assert.match(prompt,/Introduction/);}
   return {text:JSON.stringify({sections:[{title:'Introduction',description:'Learning objectives'}],tables:[],notes:''}),usage:{}};
  }
  return {text:JSON.stringify(defaultGuideDesign),usage:{}};
 }};
 const controller=new AcademicController(db,{reserve:async()=>id,record:async()=>{}},provider,{get:async()=>bytes});
 const result=await controller.create({user:{id}},{documentId:id,name:'reference.pdf',kind:'custom'});
 assert.equal(result.structure.sections[0].title,'Introduction');assert.deepEqual(saved.design,defaultGuideDesign);assert.equal(calls,2);
});
