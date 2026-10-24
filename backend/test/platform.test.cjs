process.env.STORAGE_DRIVER='local';
process.env.DATABASE_DRIVER='pglite';process.env.PGLITE_PATH='memory://';process.env.DOC_WORKER_DISABLED='1';process.env.NODE_ENV='test';process.env.PRESENTATION_IMAGES='off';
const {test,before,after}=require('node:test');const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');const {readFile,mkdtemp,rm}=require('node:fs/promises');const {tmpdir}=require('node:os');const {join}=require('node:path');
const {Document,Packer,Paragraph}=require('docx');const JSZip=require('jszip');
const {createApp}=require('../dist/main');const {Database}=require('../dist/database/database');const {AIProvider}=require('../dist/ai/provider');const {hashToken}=require('../dist/auth/auth.module');const {KahootExportService}=require('../dist/exports/kahoot');const {guideContract}=require('../dist/ai/educational-contracts');
let app,db,base,folder,owner,other,guide,plan,template,asset,lastPrompt,lastSystem;
const block=()=>({id:randomUUID(),type:'paragraph',text:'Contenido educativo revisable.'});
const guideData=()=>({title:'Guía de anatomía',guideType:'Estudio',objectives:['Identificar estructuras'],blocks:[{id:randomUUID(),type:'heading',text:'Fundamentos',level:1},block(),{id:randomUUID(),type:'table',text:'',rows:[['Instrumento','Uso'],['Estetoscopio','Auscultación educativa']]},{id:randomUUID(),type:'diagram',text:'',items:['Estudiar','Practicar','Reflexionar']},{id:randomUUID(),type:'code',text:'print("ejemplo")',language:'python'}]});
const week=()=>({id:randomUUID(),unit:'Unidad 1',topic:'Fundamentos',outcome:'Explicar principios',activities:['Analizar un caso'],evidence:'Informe',resources:['Lectura'],theoryHours:2,practiceHours:1});
async function call(client,path,body,method='POST'){
 const response=await fetch(base+path,{method,headers:{Cookie:client?.cookies||'',...(body!==undefined&&!(body instanceof FormData)?{'Content-Type':'application/json'}:{})},body:body===undefined?undefined:body instanceof FormData?body:JSON.stringify(body)});
 if(client){const cookies=response.headers.getSetCookie();if(cookies.length)client.cookies=cookies.map(c=>c.split(';')[0]).join('; ');}return response;
}
async function json(client,path,body,method='POST'){const r=await call(client,path,body,method);assert.ok(r.ok,`${path}: ${r.status} ${r.ok?'':await r.text()}`);return r.json();}
before(async()=>{folder=await mkdtemp(join(tmpdir(),'docente-platform-'));process.env.STORAGE_PATH=folder;app=await createApp();db=app.get(Database);await db.executeSchema(await readFile('src/database/schema.sql','utf8'));
 for(const provider of app.get(AIProvider,{each:true})){provider.embed=async()=>[1,...Array(767).fill(0)];provider.generate=async(system,prompt,schema)=>{
  lastPrompt=prompt;lastSystem=system;let value;
  if(schema?.properties?.blocks||schema?.properties?.chapters||schema?.properties?.accentColor)value=require('./guide-fixture.cjs').fixture(schema,prompt);
  else if(schema?.properties?.weeks)value={title:'Plan de anatomía',course:'Anatomía',period:'2026-II',weeks:[week(),week()]};
  else if(schema?.properties?.tables)value={sections:[{title:'Fundamentos',description:'Conceptos básicos'},{title:'Práctica',description:'Procedimientos'}],tables:[{name:'Datos',columns:['Campo','Valor']}],notes:'Secciones numeradas'};
  else if(schema?.properties?.theoryHours)value={...JSON.parse(prompt).week,topic:'Tema regenerado'};
  else if(schema?.properties?.type)value={...JSON.parse(prompt).block,text:'Contenido mejorado solamente en este bloque.'};
  else if(schema?.properties?.content)value={content:'Apartado pedagógico regenerado.'};
  else value='Respuesta contextual';return {text:typeof value==='string'?value:JSON.stringify(value),usage:{promptTokenCount:5,candidatesTokenCount:10}};
 };}
 await app.listen(0,'127.0.0.1');base=await app.getUrl()+'/api';owner={};other={};for(const [n,c] of [['owner',owner],['other',other]]){const u=await json(c,'/auth/register',{name:n,email:`${n}@platform.test`,password:'password123'});c.id=u.id;}
},{timeout:120000});
after(async()=>{await app?.close();if(folder)await rm(folder,{recursive:true,force:true});});
test('academic context is optional, private and included in generation',async()=>{
 assert.deepEqual(await json(owner,'/academic-context',undefined,'GET'),{});
 await json(owner,'/academic-context',{career:'Enfermería',country:'Perú'},'PATCH');assert.equal((await json(other,'/academic-context',undefined,'GET')).career,undefined);
 guide=await json(owner,'/generate',{kind:'guide',topic:'Instrumentos médicos educativos'});assert.equal(guide.kind,'guide');assert.match(lastPrompt,/Enfermería/);assert.match(lastSystem,/salud/);
 assert.equal((await call(other,`/content/${guide.id}`,undefined,'GET')).status,404);
});
test('templates analyse Word structure once, enforce ownership and retain snapshots',async()=>{
 const bytes=await Packer.toBuffer(new Document({sections:[{children:[new Paragraph('I. Fundamentos'),new Paragraph('II. Práctica')]}]}));const form=new FormData();form.append('file',new Blob([bytes]),'plantilla.docx');const doc=await json(owner,'/documents',form);
 template=await json(owner,'/templates',{documentId:doc.id,name:'Formato institucional',kind:'guide'});assert.equal(template.structure.sections.length,2);
 assert.equal((await call(other,'/templates',{documentId:doc.id,name:'Ajena',kind:'guide'})).status,404);
 guide=await json(owner,'/generate',{kind:'guide',topic:'Anatomía',templateId:template.id,templateMode:'inspiration'});assert.match(lastPrompt,/inspiración/);assert.equal(guide.template_id,template.id);
 assert.equal((await call(other,'/generate',{kind:'guide',topic:'Privado',templateId:template.id})).status,404);
 const copy=await json(owner,`/content/${guide.id}/duplicate`,{});assert.equal(copy.template_snapshot.name,template.name);
});
test('guide images are private and preserve bytes in DOCX and PDF',async()=>{
 const png=require('@napi-rs/canvas').createCanvas(48,32).toBuffer('image/png');const form=new FormData();form.append('file',new Blob([png]),'instrumento.png');asset=await json(owner,'/visual-assets',form);
 assert.equal((await call(other,`/visual-assets/${asset.id}`,undefined,'GET')).status,404);assert.equal((await call(null,`/visual-assets/${asset.id}`,undefined,'GET')).status,401);
 guide=await json(owner,`/content/${guide.id}`,{title:guide.title,data:{...guide.data,blocks:[...guide.data.blocks,{id:randomUUID(),type:'image',text:'',assetId:asset.id,caption:'Imagen educativa propia',width:70}]},version:guide.version},'PATCH');
 const doc=await call(owner,`/content/${guide.id}/export`,{format:'docx'});assert.equal(doc.status,201);const zip=await JSZip.loadAsync(Buffer.from(await doc.arrayBuffer()));assert.ok(Object.keys(zip.files).some(p=>p.startsWith('word/media/')&&!zip.files[p].dir));const xml=await zip.file('word/document.xml').async('string');assert.match(xml,/w:tbl/);assert.match(xml,/Courier New/);
 const pdf=await call(owner,`/content/${guide.id}/export`,{format:'pdf'});assert.equal(pdf.status,201);assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0,5).toString(),'%PDF-');
 const stolen={...guide.data,blocks:[{id:randomUUID(),type:'image',assetId:asset.id,text:''}]};const otherGuide=await json(other,'/generate',{kind:'guide',topic:'Caso'});assert.equal((await call(other,`/content/${otherGuide.id}`,{title:'Ajena',data:stolen,version:1},'PATCH')).status,400);
});
test('AI rewriting changes only the requested guide block and requires current version',async()=>{
 const original=structuredClone(guide.data),target=original.blocks[1];const result=await json(owner,`/content/${guide.id}/rewrite-block`,{blockId:target.id,version:guide.version,action:'simplify'});assert.equal(result.block.id,target.id);assert.match(result.block.text,/solamente/);
 const persisted=await json(owner,`/content/${guide.id}`,undefined,'GET');assert.deepEqual(persisted.data,original);
 assert.equal((await call(owner,`/content/${guide.id}/rewrite-block`,{blockId:target.id,version:1,action:'expand'})).status,400);
 assert.equal((await call(other,`/content/${guide.id}/rewrite-block`,{blockId:target.id,version:guide.version,action:'expand'})).status,404);
});
test('planning supports manual creation, ordered weeks, versions and single-week regeneration',async()=>{
 plan=await json(owner,'/content',{kind:'planning',data:{title:'Plan manual',course:'Anatomía',period:'2026-II',weeks:[week(),week()]}});
 const ids=plan.data.weeks.map(w=>w.id);plan=await json(owner,`/content/${plan.id}`,{title:plan.title,data:{...plan.data,weeks:[...plan.data.weeks].reverse()},version:1},'PATCH');assert.deepEqual(plan.data.weeks.map(w=>w.id),ids.reverse());assert.equal((await json(owner,`/content/${plan.id}/versions`,undefined,'GET')).length,1);
 const result=await json(owner,`/content/${plan.id}/regenerate-week`,{weekId:plan.data.weeks[0].id,version:plan.version});assert.equal(result.week.topic,'Tema regenerado');assert.equal(result.week.theoryHours,2);
 const generated=await json(owner,'/generate',{kind:'planning',topic:'Anatomía',parameters:{weeks:2,theoryHours:2,practiceHours:1}});assert.equal(generated.data.weeks.length,2);
 assert.equal((await call(owner,'/generate',{kind:'planning',topic:'Anatomía',parameters:{weeks:3}})).status,400);
});
test('disabled sources and template documents cannot enter retrieval',async()=>{
 const form=new FormData();form.append('file',new Blob(['Material docente']),'fuente.txt');const doc=await json(owner,'/documents',form);
 await json(owner,`/documents/${doc.id}`,{name:doc.name,enabled:false,category:'template'},'PATCH');assert.equal((await call(owner,'/generate',{kind:'guide',topic:'Material',sourceIds:[doc.id]})).status,400);
});
test('session sections regenerate independently, and sessions export private images and six academic sections',async()=>{
 const data={title:'Sesión de anatomía',area:'Salud',course:'Anatomía',topic:'Instrumentos',duration:60,competency:'Explicar instrumentos',outcome:'Identificar instrumentos',methodology:'Estudio guiado',stages:[{name:'Inicio',minutes:10,activities:['Activar conocimientos'],resources:['Pizarra']},{name:'Desarrollo',minutes:40,activities:['Analizar instrumentos'],resources:['Lectura']},{name:'Cierre',minutes:10,activities:['Reflexionar'],resources:['Cuaderno']}],assessment:'Explicación oral',images:[{assetId:asset.id,caption:'Instrumento educativo',width:70}]};
 const id=randomUUID();await db.query('INSERT INTO generated_content(id,user_id,kind,title,data,mode) VALUES($1,$2,$3,$4,$5,$6)',[id,owner.id,'session',data.title,JSON.stringify(data),'general']);
 const result=await json(owner,`/content/${id}/rewrite-section`,{section:'outcome',version:1});assert.match(result.content,/regenerado/);assert.equal((await json(owner,`/content/${id}`,undefined,'GET')).data.outcome,data.outcome);
 assert.equal((await call(other,`/content/${id}/rewrite-section`,{section:'outcome',version:1})).status,404);
 const response=await call(owner,`/content/${id}/export`,{format:'docx'});assert.equal(response.status,201);const zip=await JSZip.loadAsync(Buffer.from(await response.arrayBuffer()));const xml=await zip.file('word/document.xml').async('string');assert.match(xml,/I\. Datos informativos/);assert.match(xml,/VI\. Bibliografía/);assert.ok(Object.keys(zip.files).some(p=>p.startsWith('word/media/')&&!zip.files[p].dir));
});
test('Kahoot uses official XLSX headers, correct columns and validation without truncation',async()=>{
 const q={type:'multiple_choice',question:'¿Qué instrumento?',options:['Estetoscopio','Balanza'],correctAnswer:'Estetoscopio'};const bytes=await new KahootExportService().export([q]);const zip=await JSZip.loadAsync(bytes),xml=await zip.file('xl/worksheets/sheet1.xml').async('string');assert.match(xml,/<c r="B9"[^>]*>.*¿Qué instrumento/);assert.match(xml,/<c r="G9"><v>30/);assert.match(xml,/<c r="H9" t="inlineStr">.*<t[^>]*>1<\/t>/);assert.match(await zip.file('xl/sharedStrings.xml').async('string'),/120 max length/);
 await assert.rejects(()=>new KahootExportService().export([{...q,question:'x'.repeat(121)}]));await assert.rejects(()=>new KahootExportService().export([{...q,type:'development'}]));await assert.rejects(()=>new KahootExportService().export([q],45));
});
test('storage retains local originals when new uploads switch to Cloudinary',async()=>{
 const {Storage}=require('../dist/documents/storage');const before=process.env.STORAGE_DRIVER;process.env.STORAGE_DRIVER='cloudinary';
 try{const storage=new Storage(db),bytes=await storage.get(asset.id);assert.equal(bytes.subarray(1,4).toString(),'PNG');const key=randomUUID(),data=Buffer.from('new-cloudinary-file');let remote;
  storage.cloudinary.put=async(id,buffer)=>{remote=buffer;};storage.cloudinary.get=async()=>remote;storage.cloudinary.delete=async()=>{remote=undefined;};
  await storage.put(key,data,'text/plain');assert.equal((await db.query('SELECT driver FROM stored_files WHERE storage_key=$1',[key]))[0].driver,'cloudinary');assert.ok((await storage.get(key)).equals(data));await storage.delete(key);assert.equal((await db.query('SELECT * FROM stored_files WHERE storage_key=$1',[key])).length,0);
 }finally{process.env.STORAGE_DRIVER=before;}
});
test('password reset is one-time, revokes sessions and never exposes reset tokens',async()=>{
 const token='test-token-'.repeat(6);await db.query("INSERT INTO password_resets(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '30 minutes')",[hashToken(token),owner.id]);
 const result=await json(null,'/auth/reset-password',{token,password:'newpassword123'});assert.ok(!result.token);assert.equal((await call(owner,'/auth/me',undefined,'GET')).status,401);assert.equal((await call(null,'/auth/reset-password',{token,password:'password123'})).status,400);
 assert.equal((await call(null,'/auth/login',{email:'owner@platform.test',password:'password123'})).status,401);await json(owner,'/auth/login',{email:'owner@platform.test',password:'newpassword123'});
});
test('guide contracts reject broken tables, missing images and duplicate block ids',()=>{
 assert.equal(guideContract.safeParse({...guideData(),blocks:[{id:randomUUID(),type:'table',text:'',rows:[['a','b'],['c']]}]}).success,false);
 assert.equal(guideContract.safeParse({...guideData(),blocks:[{id:randomUUID(),type:'image',text:''}]}).success,false);
});
