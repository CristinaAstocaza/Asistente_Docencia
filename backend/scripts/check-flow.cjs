// Opt-in live-provider verification of the full API. Uses only a synthetic teaching source.
process.env.DATABASE_DRIVER='pglite';process.env.PGLITE_PATH='memory://';process.env.DOC_WORKER_DISABLED='1';process.env.NODE_ENV='test';
const {mkdtemp,readFile,rm}=require('node:fs/promises');const {tmpdir}=require('node:os');const {join}=require('node:path');
async function main(){
 const storage=await mkdtemp(join(tmpdir(),'docente-live-'));process.env.STORAGE_PATH=storage;
 const {createApp}=require('../dist/main'),{Database}=require('../dist/database/database'),{DocumentWorker}=require('../dist/documents/documents.module');
 const app=await createApp();
 try{
  const db=app.get(Database);await db.executeSchema(await readFile('src/database/schema.sql','utf8'));await app.listen(0,'127.0.0.1');const base=await app.getUrl()+'/api';let cookies='';
  async function call(path,body){const response=await fetch(base+path,{method:'POST',headers:{Cookie:cookies,...(!(body instanceof FormData)?{'Content-Type':'application/json'}:{})},body:body instanceof FormData?body:JSON.stringify(body)});if(response.headers.getSetCookie().length)cookies=response.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');if(!response.ok){const error=await response.json();throw new Error(`${path}: ${error.message||response.status}`);}return response;}
  await call('/auth/register',{name:'Prueba sintética',email:'flow@example.test',password:'PruebaSegura123'});
  const file=new FormData();file.append('file',new Blob(['La suma de números naturales reúne cantidades. Dos pares forman cuatro objetos: 2 + 2 = 4. La suma es conmutativa: 2 + 3 = 3 + 2. Para sumar se pueden utilizar fichas, dibujos y una recta numérica. El estudiante comprueba el resultado contando los objetos.']),'fuente-sintetica.txt');
  const source=await (await call('/documents',file)).json();await app.get(DocumentWorker).tick();const [doc]=await db.query('SELECT status,error FROM documents WHERE id=$1',[source.id]);if(doc.status!=='ready')throw new Error(`Procesamiento: ${doc.error}`);console.log('Fuente → extracción → embeddings → pgvector: correcto.');
  const chat=await (await call('/chat',{message:'Según el documento, ¿qué significa sumar?',sourceIds:[source.id],mode:'sources'})).json();if(!chat.citations.length)throw new Error('Faltan referencias en el chat.');console.log('Chat con fuente real y memoria: correcto.');
  const specifications=[['lesson',{duration:30}],['session',{duration:30,course:'Matemática',area:'Matemática',methodology:'Práctica con fichas'}],['syllabus',{weeks:4,credits:1,course:'Matemática básica',cycle:'Inicial'}],['questions',{count:2,type:'multiple_choice',difficulty:'easy'}],['exam',{count:2,duration:30,difficulty:'easy'}],['rubric',{criteriaCount:2}],['presentation',{count:3,style:'moderno'}],['summary',{}]];
  let previous;
  for(const [kind,parameters] of specifications){const material=await (await call('/generate',{kind,topic:'Prepara material breve sobre suma de números naturales para principiantes, basado solo en el documento. Respeta los parámetros indicados.',parameters,sourceIds:[source.id],mode:'sources',...(kind==='presentation'&&previous?{parentId:previous}:{})})).json();if(kind==='lesson')previous=material.id;console.log(`${kind}: JSON validado y persistido.`);const format=kind==='presentation'?'pptx':'pdf';const exported=await call(`/content/${material.id}/export`,{format});if(!(await exported.arrayBuffer()).byteLength)throw new Error('Exportación vacía.');console.log(`${kind}: exportación ${format} correcta.`);}
 }finally{await app.close();await rm(storage,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error.message||'Fallo de verificación.');process.exitCode=1;});
