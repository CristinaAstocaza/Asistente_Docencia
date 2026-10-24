process.env.STORAGE_DRIVER='local';
// Real Gemini verification with synthetic requests and an ephemeral database.
process.env.DATABASE_DRIVER='pglite';process.env.PGLITE_PATH='memory://';process.env.DOC_WORKER_DISABLED='1';process.env.NODE_ENV='test';
const {readFile,mkdtemp,rm}=require('node:fs/promises');const {tmpdir}=require('node:os');const {join}=require('node:path');const {randomUUID}=require('node:crypto');
async function main(){
 const path=await mkdtemp(join(tmpdir(),'docente-real-'));process.env.STORAGE_PATH=path;
 const {createApp}=require('../dist/main');const {Database}=require('../dist/database/database');const {AIService}=require('../dist/ai/ai.module');const {hashPassword}=require('../dist/auth/auth.module');const {renderGuideDocx,renderGuidePdf}=require('../dist/exports/guide-render');
 let app;
 try{
  app=await createApp();const db=app.get(Database);await db.executeSchema(await readFile('src/database/schema.sql','utf8'));
  if(!process.env.GEMINI_API_KEY)throw new Error('Falta GEMINI_API_KEY; no se puede comprobar el proveedor real.');
  const user=randomUUID();await db.query('INSERT INTO users(id,email,password_hash,name) VALUES($1,$2,$3,$4)',[user,'synthetic@example.test',await hashPassword('synthetic-password'),'Verificación sintética']);
  const ai=app.get(AIService);
  for(const [career,topic] of [['Ingeniería de Sistemas','Guía breve de Python para sumar dos números'],['Enfermería','Guía educativa sobre instrumentos de medición de temperatura'],['Derecho','Guía para analizar argumentos de un caso hipotético'],['Contabilidad','Guía breve de registro de una compra ficticia']]){
   await db.query('UPDATE users SET academic_context=$2 WHERE id=$1',[user,JSON.stringify({career})]);
   const result=await ai.generate(user,{kind:'guide',topic,sourceIds:[],mode:'general',parameters:{visualMode:'diagrams',guideType:'Estudio',instructions:'Guía breve con 5 a 8 bloques y un ejercicio. Usa diagramas o tablas si ayudan.'}});
   const docx=await renderGuideDocx(result.data,new Map()),pdf=await renderGuidePdf(result.data,new Map());if(docx.length<1000||pdf.subarray(0,5).toString()!=='%PDF-')throw new Error('Exportación inválida.');
   console.log(`${career}: ${result.data.blocks.length} bloques validados, DOCX y PDF correctos.`);
  }
  const plan=await ai.generate(user,{kind:'planning',topic:'Planificación breve de introducción a la informática',sourceIds:[],mode:'general',parameters:{weeks:2,theoryHours:1,practiceHours:1,course:'Informática',period:'Propuesta editable'}});
  console.log(`Planificación real: ${plan.data.weeks.length} semanas, horas y contrato validados.`);
 }finally{await app?.close();await rm(path,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e.message||'Falló la comprobación del proveedor.');process.exitCode=1;});
