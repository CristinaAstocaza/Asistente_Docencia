process.env.STORAGE_DRIVER='local';
process.env.DATABASE_DRIVER='pglite';process.env.PGLITE_PATH='memory://';process.env.DOC_WORKER_DISABLED='1';process.env.NODE_ENV='test';
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {readFile,mkdtemp,rm}=require('node:fs/promises');
const {tmpdir}=require('node:os');const {join}=require('node:path');
const {createApp}=require('../dist/main');
const {Database}=require('../dist/database/database');
const {AIProvider}=require('../dist/ai/provider');
const {DocumentWorker}=require('../dist/documents/documents.module');
let app,base,db,storage;
const lesson={title:'Clase de sumas',objective:'Resolver sumas',introduction:'Agrupar objetos',motivation:'Contar pares',development:['Suma de pares'],examples:['2+2=4'],activity:'Contar objetos',closing:'Verificar resultados',questions:['¿Cómo sumaste?']};
const q={type:'multiple_choice',question:'¿Cuánto es 2 + 2?',options:['3','4'],correctAnswer:'4',explanation:'Son dos pares.',difficulty:'easy',topic:'Sumas',source:'Apuntes'};
const clients={a:{cookies:''},b:{cookies:''}};let documentId,materialId,bankId,conversationId;
async function call(client,path,body,method='POST') {
 const headers={Cookie:client.cookies};let payload;
 if(body instanceof FormData)payload=body;else if(body!==undefined){headers['Content-Type']='application/json';payload=JSON.stringify(body);}
 const response=await fetch(base+path,{method,headers,body:payload});
 const cookies=response.headers.getSetCookie();if(cookies.length){const map=new Map(client.cookies.split('; ').filter(Boolean).map(v=>v.split('=')));for(const cookie of cookies){const [key,value]=cookie.split(';')[0].split('=');map.set(key,value);}client.cookies=[...map].map(([k,v])=>`${k}=${v}`).join('; ');}
 return response;
}
before(async()=>{
 storage=await mkdtemp(join(tmpdir(),'docente-api-'));process.env.STORAGE_PATH=storage;
 app=await createApp();db=app.get(Database);await db.executeSchema(await readFile('src/database/schema.sql','utf8'));
 for(const provider of app.get(AIProvider,{each:true})){
  provider.embed=async()=>[1,...Array(767).fill(0)];
  provider.generate=async(system,prompt,schema)=>({text:schema?JSON.stringify(system.includes('Generador de preguntas')?{title:'Banco de sumas',questions:[q]}:lesson):'La suma de dos pares es cuatro [1].',usage:{promptTokenCount:100,candidatesTokenCount:40}});
 }
 await app.listen(0,'127.0.0.1');base=await app.getUrl()+'/api';
}, {timeout:120000});
after(async()=>{if(app)await app.close();if(storage)await rm(storage,{recursive:true,force:true});});
test('authentication rejects anonymous API requests and persists accounts',async()=>{
 assert.equal((await call(clients.a,'/documents',undefined,'GET')).status,401);
 for(const [name,client] of Object.entries(clients)){const r=await call(client,'/auth/register',{name,email:`${name}@example.test`,password:'password123',institution:'Instituto'});assert.equal(r.status,201);assert.ok(client.cookies.includes('docente_access='));}
 assert.equal((await call(clients.a,'/auth/register',{name:'Otro',email:'a@example.test',password:'password123'})).status,409);
 assert.equal((await call({cookies:''},'/auth/login',{email:'a@example.test',password:'wrong-pass'})).status,401);
});
test('origin validation rejects cross-origin authenticated writes',async()=>{
 const r=await fetch(base+'/profile',{method:'PATCH',headers:{Cookie:clients.a.cookies,Origin:'https://evil.example','Content-Type':'application/json'},body:JSON.stringify({name:'Atacante',institution:''})});assert.equal(r.status,403);
});
test('document upload stores metadata, worker indexes vectors and citations retain pages',async()=>{
 const form=new FormData();form.append('file',new Blob(['Sumas: dos pares forman cuatro. 2 + 2 = 4.']),'apuntes.txt');
 const r=await call(clients.a,'/documents',form);assert.equal(r.status,201);documentId=(await r.json()).id;
 await app.get(DocumentWorker).tick();const rows=await db.query('SELECT status FROM documents WHERE id=$1',[documentId]);assert.equal(rows[0].status,'ready');
 const chunks=await db.query('SELECT text FROM document_chunks WHERE document_id=$1',[documentId]);assert.match(chunks[0].text,/dos pares/);
});
test('another teacher cannot list, download, alter or retrieve private sources',async()=>{
 assert.equal((await (await call(clients.b,'/documents',undefined,'GET')).json()).length,0);
 for(const suffix of ['/preview','/download'])assert.equal((await call(clients.b,`/documents/${documentId}${suffix}`,undefined,'GET')).status,404);
 assert.equal((await call(clients.b,`/documents/${documentId}`,{name:'Robada',folder:''},'PATCH')).status,404);
 assert.equal((await call(clients.b,'/chat',{message:'Suma',sourceIds:[documentId],mode:'sources'})).status,404);
});
test('sources-only chat requires ready sources and persists conversation memory',async()=>{
 assert.equal((await call(clients.a,'/chat',{message:'Suma',mode:'sources',sourceIds:[]})).status,400);
 const first=await call(clients.a,'/chat',{message:'¿Cuánto suman dos pares?',mode:'sources',sourceIds:[documentId]});assert.equal(first.status,201);const result=await first.json();conversationId=result.conversationId;assert.equal(result.citations[0].documentId,documentId);
 assert.equal((await call(clients.a,'/chat',{message:'Explícalo con objetos',conversationId,mode:'sources',sourceIds:[documentId]})).status,201);
 const messages=await (await call(clients.a,`/conversations/${conversationId}/messages`,undefined,'GET')).json();assert.equal(messages.length,4);
 assert.equal((await call(clients.b,`/conversations/${conversationId}/messages`,undefined,'GET')).status,404);
});
test('generation saves structured content and rejects cross-account reads and writes',async()=>{
 const r=await call(clients.a,'/generate',{kind:'lesson',topic:'Sumas',sourceIds:[documentId],mode:'sources'});assert.equal(r.status,201);const m=await r.json();materialId=m.id;assert.equal(m.data.objective,lesson.objective);assert.equal(m.citations[0].name,'apuntes.txt');
 assert.equal((await call(clients.b,`/content/${materialId}`,undefined,'GET')).status,404);
 assert.equal((await call(clients.b,`/content/${materialId}`,{title:'Ajena',data:lesson,version:1},'PATCH')).status,404);
});
test('editing versions content, rejects stale writes and duplication creates an independent item',async()=>{
 const body={title:'Clase revisada',data:{...lesson,title:'Clase revisada'},version:1};
 const updated=await call(clients.a,`/content/${materialId}`,body,'PATCH');assert.equal(updated.status,200);assert.equal((await updated.json()).version,2);
 assert.equal((await call(clients.a,`/content/${materialId}`,body,'PATCH')).status,400);
 const versions=await (await call(clients.a,`/content/${materialId}/versions`,undefined,'GET')).json();assert.equal(versions.length,1);
 const copied=await (await call(clients.a,`/content/${materialId}/duplicate`,{})).json();assert.notEqual(copied.id,materialId);assert.equal(copied.version,1);
});
test('bank reuse creates an exam and download endpoints emit real files',async()=>{
 const bank=await (await call(clients.a,'/generate',{kind:'questions',topic:'Sumas',parameters:{count:1}})).json();bankId=bank.id;
 const exam=await (await call(clients.a,'/exams/from-bank',{bankId,title:'Práctica',count:1,duration:30})).json();assert.equal(exam.kind,'exam');
 for(const format of ['docx','pdf']){const r=await call(clients.a,`/content/${exam.id}/export`,{format,variant:'B'});assert.equal(r.status,201);const bytes=Buffer.from(await r.arrayBuffer());assert.equal(bytes.subarray(0,format==='pdf'?5:2).toString(),format==='pdf'?'%PDF-':'PK');if(format==='pdf'){const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');const pdf=await pdfjs.getDocument({data:new Uint8Array(bytes),isEvalSupported:false}).promise;const text=(await (await pdf.getPage(1)).getTextContent()).items.map(item=>item.str).join(' ');assert.match(text,/Estudiante:/);assert.match(text,/A\)/);assert.doesNotMatch(text,/multiple_choice|difficulty|Son dos pares/);await pdf.cleanup();}}
 const quiz=await call(clients.a,'/integrations/quizizz/export',{contentId:bankId});assert.equal(quiz.status,201);assert.equal(Buffer.from(await quiz.arrayBuffer()).subarray(0,2).toString(),'PK');
 assert.equal((await call(clients.b,`/content/${materialId}/export`,{format:'pdf'})).status,404);
});
test('dashboard and usage reflect actual persisted activity',async()=>{
 const dashboard=await (await call(clients.a,'/dashboard',undefined,'GET')).json();assert.equal(dashboard.documents,1);assert.equal(dashboard.counts.exam,1);assert.ok(dashboard.recent.length);
 const usage=await (await call(clients.a,'/usage',undefined,'GET')).json();assert.ok(usage.tokens_input>=100);assert.ok(usage.requests>=1);
});
test('quota enforcement rejects generation and storage beyond configured limits',async()=>{
 const {settings}=require('../dist/config');const daily=settings.dailyLimit,storage=settings.storageLimit;
 try{
  settings.dailyLimit=1;assert.equal((await call(clients.a,'/generate',{kind:'lesson',topic:'Sumas'})).status,429);
  settings.storageLimit=1;const form=new FormData();form.append('file',new Blob(['Texto válido']),'otra.txt');assert.equal((await call(clients.a,'/documents',form)).status,400);
  assert.equal((await db.query('SELECT count(*)::integer AS count FROM documents WHERE user_id=(SELECT id FROM users WHERE email=$1)',['a@example.test']))[0].count,1);
 }finally{settings.dailyLimit=daily;settings.storageLimit=storage;}
});
test('chat asks missing data, resumes with the same sources and persists two downloadable files',async()=>{
 const providers=app.get(AIProvider,{each:true});const originals=providers.map(p=>p.generate);
 const documents=[{kind:'activity',purpose:'Indicaciones del trabajo grupal'},{kind:'rubric',purpose:'Rúbrica del trabajo grupal'}];
 const details='Curso: Investigación. Nivel universitario. Grupos de 4. Informe escrito. Plazo: 20 de octubre de 2026. Ponderación: 30 %. Escala: 0 a 20.';
 try{
  for(const provider of providers)provider.generate=async(system,prompt)=>{
   let data;
   if(system.includes('Preparador de documentos')){
    const complete=prompt.includes('Grupos de 4');
    data={action:complete?'generate':'clarify',questions:complete?[]:['¿Cuál es el curso, nivel, cantidad de integrantes, plazo y ponderación?'],topic:'Uso de IA en investigación científica',documents,details:complete?details:''};
   }else if(system.includes('Constructor de rúbricas')){
    assert.match(prompt,/Grupos de 4/);assert.match(prompt,/Indicaciones/);
    data={title:'Rúbrica del trabajo',context:[{title:'Datos del trabajo',content:details}],criteria:[{name:'Análisis',weight:100,levels:['Excelente','Bueno','Básico','Inicio'].map((name,i)=>({name,score:4-i,description:`Nivel ${4-i} de análisis`}))}]};
   }else{
    assert.match(prompt,/Grupos de 4/);assert.match(prompt,/Indicaciones del trabajo grupal/);
    data={title:'Indicaciones del trabajo',context:[{title:'Datos y entrega',content:details}],achievement:'Analizar el uso responsable de IA.',generalInstructions:'Analicen el uso de IA en investigación.',specificInstructions:['Seleccionen un caso y justifiquen su análisis.'],recommendations:['Contrasten las fuentes.'],submission:['Entreguen un informe escrito.'],evaluation:'Se evaluará con la rúbrica adjunta.'};
   }
   return {text:JSON.stringify(data),usage:{}};
  };
  const before=(await db.query('SELECT count(*)::int AS count FROM generated_content'))[0].count;
  const first=await call(clients.a,'/chat',{message:'NECESITO UN DOC CON LAS INDICACIONES Y OTRO DOC CON LA RUBRICA',sourceIds:[documentId],mode:'sources'});
  assert.equal(first.status,201);const pending=await first.json();assert.equal(pending.artifacts.length,0);assert.match(pending.content,/curso/);
  assert.equal((await db.query('SELECT count(*)::int AS count FROM generated_content'))[0].count,before);
  const partial=await call(clients.a,'/chat',{conversationId:pending.conversationId,message:'Curso: Investigación.'});assert.equal(partial.status,201);assert.equal((await partial.json()).artifacts.length,0);
  const second=await call(clients.a,'/chat',{conversationId:pending.conversationId,message:details});assert.equal(second.status,201);const result=await second.json();assert.deepEqual(result.artifacts.map(a=>a.kind),['activity','rubric']);
  for(const artifact of result.artifacts){assert.deepEqual(artifact.source_ids,[documentId]);assert.equal(artifact.mode,'sources');const exported=await call(clients.a,`/content/${artifact.id}/export`,{format:'docx'});assert.equal(exported.status,201);const zip=await require('jszip').loadAsync(await exported.arrayBuffer());const xml=await zip.file('word/document.xml').async('string');assert.match(xml,/Grupos de 4/);if(artifact.kind==='rubric')assert.match(xml,/<w:tbl>/);}
  const messages=await (await call(clients.a,`/conversations/${pending.conversationId}/messages`,undefined,'GET')).json();assert.equal(messages.at(-1).artifacts.length,2);
  assert.equal((await call(clients.b,`/content/${result.artifacts[0].id}/export`,{format:'docx'})).status,404);
  assert.equal((await db.query('SELECT pending_generation FROM conversations WHERE id=$1',[pending.conversationId]))[0].pending_generation,null);
 }finally{providers.forEach((p,i)=>p.generate=originals[i]);}
});
test('chat-only attachments stay out of Sources, are scoped to one conversation and reach the multimodal model',async()=>{
 const conversation=await (await call(clients.a,'/conversations',{title:'Formato de actividad'})).json();
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aY1cAAAAASUVORK5CYII=','base64');
 const form=new FormData();form.append('file',new Blob([png],{type:'image/png'}),'ejemplo.png');form.append('purpose','reference');
 const response=await call(clients.a,`/conversations/${conversation.id}/attachments`,form);assert.equal(response.status,201);const attachment=await response.json();assert.equal(attachment.purpose,'reference');
 const text=new FormData();text.append('file',new Blob(['Tema: uso responsable de inteligencia artificial.']),'tema.txt');
 const factual=await (await call(clients.a,`/conversations/${conversation.id}/attachments`,text)).json();
 assert.equal((await (await call(clients.a,'/documents',undefined,'GET')).json()).length,1);
 assert.equal((await call(clients.b,`/conversations/${conversation.id}/attachments`,undefined,'GET')).status,404);
 assert.equal((await call(clients.b,`/conversations/${conversation.id}/attachments/${attachment.id}/download`,undefined,'GET')).status,404);
 const other=await (await call(clients.a,'/conversations',{})).json();assert.equal((await call(clients.a,'/chat',{conversationId:other.id,message:'Mira este ejemplo',attachmentIds:[attachment.id]})).status,404);
 const providers=app.get(AIProvider,{each:true}),originals=providers.map(p=>p.generate);
 try{
  for(const provider of providers)provider.generate=async(system,prompt,schema,images)=>{assert.match(prompt,/EJEMPLO DE FORMATO/);assert.match(prompt,/FUENTE DE CONTENIDO/);assert.match(prompt,/uso responsable/);assert.match(system,/no heredes tema/i);assert.equal(images.length,1);assert.equal(images[0].mime,'image/png');assert.equal(images[0].data,png.toString('base64'));return {text:'Puedo usar la imagen como referencia de estructura.',usage:{}};};
  const chat=await call(clients.a,'/chat',{conversationId:conversation.id,message:'Explícame la estructura de este ejemplo.',mode:'sources',attachmentIds:[attachment.id,factual.id]});assert.equal(chat.status,201);assert.equal((await chat.json()).citations.length,2);
  const history=await (await call(clients.a,`/conversations/${conversation.id}/messages`,undefined,'GET')).json();assert.equal(history[0].attachments.length,2);
 }finally{providers.forEach((p,i)=>p.generate=originals[i]);}
 const changed=await call(clients.a,`/conversations/${conversation.id}/attachments/${attachment.id}`,{purpose:'content'},'PATCH');assert.equal(changed.status,200);
 assert.equal((await call(clients.b,`/conversations/${conversation.id}/attachments/${attachment.id}`,undefined,'DELETE')).status,404);
 assert.equal((await call(clients.a,`/conversations/${conversation.id}/attachments/${attachment.id}`,undefined,'DELETE')).status,200);
 assert.equal((await call(clients.a,`/conversations/${conversation.id}/attachments/${attachment.id}/download`,undefined,'GET')).status,404);
});
test('presentation preview and exports keep the slide design and enforce ownership',async()=>{
 const user=await (await call(clients.a,'/auth/me',undefined,'GET')).json();
 const id=require('node:crypto').randomUUID();
 const data={title:'Presentación visual',style:'creativo',imageMode:'none',slides:[{title:'Idea inicial',content:['Explicación de un concepto educativo.'],layout:'title',notes:'Notas'},{title:'Aplicación',content:['Un ejemplo que permite aplicar el concepto.'],layout:'bullets',notes:'Notas'},{title:'Actividad',content:['Explica cómo usarías el concepto en tu aula.'],layout:'activity',notes:'Notas'}]};
 await db.query("INSERT INTO generated_content(id,user_id,kind,title,data,source_ids,citations,mode) VALUES($1,$2,'presentation',$3,$4,'[]','[]','general')",[id,user.id,data.title,JSON.stringify(data)]);
 const preview=await call(clients.a,`/content/${id}/presentation-preview`,undefined,'GET');assert.equal(preview.status,200);assert.equal(preview.headers.get('x-presentation-images'),'0');
 const pdf=await call(clients.a,`/content/${id}/export`,{format:'pdf'});assert.equal(pdf.status,201);
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
 for(const response of [preview,pdf]){const doc=await pdfjs.getDocument({data:new Uint8Array(await response.arrayBuffer()),isEvalSupported:false}).promise;try{assert.equal(doc.numPages,3);assert.deepEqual((await doc.getPage(1)).view,[0,0,960,540]);}finally{await doc.cleanup();}}
 const pptx=await call(clients.a,`/content/${id}/export`,{format:'pptx'});assert.equal(pptx.status,201);const zip=await require('jszip').loadAsync(await pptx.arrayBuffer());assert.match(await zip.file('ppt/slides/slide2.xml').async('string'),/Un ejemplo/);
 assert.equal((await call(clients.b,`/content/${id}/presentation-preview`,undefined,'GET')).status,404);
 assert.equal((await call({cookies:''},`/content/${id}/presentation-preview`,undefined,'GET')).status,401);
});


test('exam edits allow unfinished teacher guides and identify required empty fields',async()=>{
 const user=await (await call(clients.a,'/auth/me',undefined,'GET')).json(),id=require('node:crypto').randomUUID();
 const theory={...q,type:'development',question:'Explica la suma con objetos.',options:[],correctAnswer:'',explanation:''};
 const data={title:'Examen abierto',duration:45,instructions:'Responde y justifica.',questions:[theory,{...theory,type:'case_study',question:'Dos grupos reúnen sus objetos.',subquestions:[{question:'Cuenta los objetos.',correctAnswer:''},{question:'Explica cómo los agrupaste.',correctAnswer:''}]}]};
 await db.query("INSERT INTO generated_content(id,user_id,kind,title,data,source_ids,citations,mode) VALUES($1,$2,'exam',$3,$4,'[]','[]','general')",[id,user.id,data.title,JSON.stringify(data)]);
 const saved=await call(clients.a,`/content/${id}`,{title:data.title,data,version:1},'PATCH');assert.equal(saved.status,200);assert.equal((await saved.json()).version,2);
 const invalid=structuredClone(data);invalid.questions[1].subquestions[0].question='';
 const failed=await call(clients.a,`/content/${id}`,{title:data.title,data:invalid,version:2},'PATCH');assert.equal(failed.status,400);const message=(await failed.json()).message;assert.match(message,/Pregunta · 2 · subpunto · 1 · enunciado/);assert.doesNotMatch(message,/Too small/);
 const preserved=await (await call(clients.a,`/content/${id}`,undefined,'GET')).json();assert.equal(preserved.data.questions[1].subquestions[0].question,'Cuenta los objetos.');assert.equal(preserved.version,2);
});
test('refresh rotates tokens, revoked tokens cannot be reused, logout invalidates access',async()=>{
 const old=clients.a.cookies;assert.equal((await call(clients.a,'/auth/refresh',{})).status,201);assert.notEqual(old,clients.a.cookies);
 assert.equal((await call({cookies:old},'/auth/refresh',{})).status,401);
 await call(clients.a,'/auth/logout',{});assert.equal((await call(clients.a,'/auth/me',undefined,'GET')).status,401);
});
