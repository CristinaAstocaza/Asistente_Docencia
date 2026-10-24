const {test}=require('node:test');const assert=require('node:assert/strict');const {mkdtemp,rm,writeFile}=require('node:fs/promises');const {tmpdir}=require('node:os');const {join}=require('node:path');const {acquireLocalLock}=require('../dist/database/local-lock');
test('local database rejects a second process and releases its lock on close',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'docente-lock-'));try{const release=acquireLocalLock(dir);assert.throws(()=>acquireLocalLock(dir),/ya está abierta/);release();const next=acquireLocalLock(dir);next();await writeFile(join(dir,'.docente-process.lock'),'2147483647:stale');const recovered=acquireLocalLock(dir);recovered();}finally{await rm(dir,{recursive:true,force:true});}
});
