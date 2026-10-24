export interface Teacher { id:string;name:string;email:string;institution:string;temporaryAccess?:boolean }
export interface Source {id:string;name:string;type:string;size:number;status:'processing'|'ready'|'error';error?:string;folder:string;category?:string;enabled?:boolean;url?:string;created_at:string}
export interface Citation {reference:number;documentId:string;chunkId:string;name:string;page:number|null}
export type Kind='guide'|'planning'|'activity'|'lesson'|'session'|'syllabus'|'questions'|'exam'|'rubric'|'presentation'|'summary';
export interface ChatAttachment {id:string;conversation_id:string;name:string;type:string;size:number;purpose:'content'|'reference';created_at:string}
export type Value=string|number|boolean|null|Value[]|{[key:string]:Value};
export interface Material {id:string;kind:Kind;title:string;data:Record<string,Value>;source_ids:string[];citations:Citation[];mode:'sources'|'general';version:number;created_at:string;updated_at:string;visualNotice?:string}
let refreshing:Promise<Response>|undefined;
export async function request(path:string,init:RequestInit={}) {
 const options={...init,credentials:'include' as const,headers:{...(init.body && !(init.body instanceof FormData)?{'Content-Type':'application/json'}:{}),...init.headers}};
 let response=await fetch(`/api${path}`,options);
 if(response.status===401 && (!path.startsWith('/auth/') || path==='/auth/me')) {
  if(!refreshing)refreshing=fetch('/api/auth/refresh',{method:'POST',credentials:'include'}).finally(()=>{refreshing=undefined;});
  const refresh=await refreshing;
  if(refresh.ok)response=await fetch(`/api${path}`,options);
 }
 if(!response.ok) {
  let message=response.status===413?'El archivo supera el tamaño permitido. El máximo es 50 MB.':response.status===401?'Tu sesión ha vencido. Inicia sesión nuevamente.':response.status>=500?'No se pudo conectar con el servidor o completar la solicitud. Intenta nuevamente.':`No se pudo completar la solicitud (HTTP ${response.status}).`;
  try {const error=await response.json();const detail=Array.isArray(error.message)?error.message.join('; '):error.message;if(detail&&detail!=='Internal server error')message=detail;}catch{}
  throw new Error(message);
 }
 return response;
}
export async function api<T>(path:string,init:RequestInit={}):Promise<T> {return (await request(path,init)).json();}
export const post=(body:unknown):RequestInit=>({method:'POST',body:JSON.stringify(body)});
export async function download(path:string,body:unknown,name:string) {
 const response=await request(path,post(body));const url=URL.createObjectURL(await response.blob());
 const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export const errorMessage=(error:unknown)=>error instanceof Error?error.message:'Ocurrió un error. Intenta nuevamente.';
