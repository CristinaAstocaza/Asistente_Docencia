process.env.STORAGE_DRIVER='local';
// Ephemeral real API for browser tests; no paid AI calls or persistent accounts.
process.env.DATABASE_DRIVER='pglite';process.env.PGLITE_PATH='memory://';process.env.DOC_WORKER_DISABLED='1';
const {mkdtemp,readFile,rm}=require('node:fs/promises');const {tmpdir}=require('node:os');const {join}=require('node:path');
async function main(){
 const storage=await mkdtemp(join(tmpdir(),'docente-browser-'));process.env.STORAGE_PATH=storage;
 const {createApp}=require('../dist/main');const {Database}=require('../dist/database/database');
 const app=await createApp();await app.get(Database).executeSchema(await readFile('src/database/schema.sql','utf8'));await app.listen(Number(process.env.PORT || 4000),'127.0.0.1');
 if(process.env.TEST_PLATFORM_AI==='1'){
  const {AIProvider}=require('../dist/ai/provider');const {randomUUID}=require('node:crypto');
  for(const provider of app.get(AIProvider,{each:true}))provider.generate=async(system,prompt,schema)=>{
   const delay=Number(process.env.TEST_PLATFORM_AI_DELAY_MS)||0;
   if(delay&&schema?.properties?.chapters)await new Promise(resolve=>setTimeout(resolve,delay));
   const data=require('./guide-fixture.cjs').fixture(schema,prompt)||{...JSON.parse(prompt).block,text:'Explicacion sencilla del bloque.'};
   return {text:JSON.stringify(data),usage:{promptTokenCount:10,candidatesTokenCount:10}};
  };
 }
 const cleanup=async()=>{await app.close();await rm(storage,{recursive:true,force:true});process.exit(0);};process.once('SIGINT',cleanup);process.once('SIGTERM',cleanup);
}
main().catch(()=>{console.error('No se pudo iniciar la API de pruebas.');process.exitCode=1;});
