import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {execSync} from 'node:child_process';

function isProcessAlive(pid:number):boolean{
 try{
  process.kill(pid,0);
  return true;
 }catch(e:any){
  if(e.code==='ESRCH')return false;
  if(process.platform==='win32'&&e.code==='EPERM'){
   try{
    const out=execSync(`tasklist /FI "PID eq ${pid}" /NH`,{encoding:'utf8',stdio:['pipe','pipe','ignore']});
    return out.toLowerCase().includes('node');
   }catch{
    return false;
   }
  }
  throw e;
 }
}

// PGlite's file directory must never be opened by a worker and migration together.
export function acquireLocalLock(directory:string):()=>void{
 const file=join(directory,'.docente-process.lock'),token=`${process.pid}:${Date.now()}`;
 for(let attempt=0;attempt<2;attempt++){
  try{writeFileSync(file,token,{flag:'wx'});return()=>{try{if(readFileSync(file,'utf8')===token)unlinkSync(file);}catch(error:any){if(error.code!=='ENOENT')throw error;}};}
  catch(error:any){
   if(error.code!=='EEXIST')throw error;
   let existing:string;try{existing=readFileSync(file,'utf8');}catch(e:any){if(e.code==='ENOENT')continue;throw e;}
   const pid=Number(existing.split(':')[0]);if(!Number.isInteger(pid)||pid<1)throw new Error('El archivo de bloqueo de la base local no es válido.');
   if(!isProcessAlive(pid)){
    try{if(readFileSync(file,'utf8')===existing)unlinkSync(file);}catch{}
    continue;
   }
   throw new Error(`La base local ya está abierta por el proceso ${pid}. Detén la API antes de ejecutar migraciones o iniciar otra instancia.`);
  }
 }throw new Error('No se pudo adquirir el bloqueo de la base local.');
}
