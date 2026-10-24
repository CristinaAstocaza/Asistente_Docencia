require('../dist/config');
const {randomUUID}=require('node:crypto');const {CloudinaryStorage}=require('../dist/documents/cloudinary');
async function main(){const storage=new CloudinaryStorage(),key=randomUUID(),original=Buffer.from('Archivo sintético privado para verificar el Asistente IA para Docentes.');let uploaded=false;
 try{await storage.put(key,original,'text/plain');uploaded=true;const downloaded=await storage.get(key);if(!downloaded.equals(original))throw new Error('Los bytes descargados no coinciden.');console.log('Cloudinary real: carga privada y descarga firmada correctas.');}
 finally{if(uploaded){await storage.delete(key);console.log('Archivo sintético eliminado.');}}
}
main().catch(e=>{console.error(e.message||'Falló Cloudinary.');process.exitCode=1;});
