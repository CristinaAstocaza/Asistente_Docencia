import { HttpException } from '@nestjs/common';
// One bounded pool per process, shared across all Nest module instances.
let active=0;
export async function limited<T>(operation:()=>Promise<T>):Promise<T>{
 const max=Math.max(1,Math.min(8,Number(process.env.AI_MAX_CONCURRENCY)||2));
 if(active>=max)throw new HttpException('El asistente está atendiendo otras solicitudes. Intenta nuevamente en unos segundos.',429);
 active++;try{return await operation();}finally{active--;}
}
