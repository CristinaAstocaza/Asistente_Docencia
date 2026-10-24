import { Injectable, ServiceUnavailableException, HttpException } from '@nestjs/common';
import { settings } from '../config';
import { Database } from '../database/database';
import { randomUUID } from 'node:crypto';
import { limited } from '../common/concurrency';
import { providerPacing } from '../common/provider-pacing';
export type InlineAsset={mime:string;data:string};
// Provider schema describes shape; full bounds/refinements remain enforced by Zod.
// Deep bounded arrays and safe-integer extrema can exceed the provider's grammar limits.
export function providerSchema(schema:any):any {
 if(Array.isArray(schema))return schema.map(providerSchema);
 if(!schema || typeof schema!=='object')return schema;
 const allowed=new Set(['type','properties','items','required','enum','description','anyOf','oneOf','$defs','$ref','definitions']);
 return Object.fromEntries(Object.entries(schema).filter(([key])=>allowed.has(key)).map(([key,value])=>[key,key==='properties'||key==='$defs'||key==='definitions'?Object.fromEntries(Object.entries(value as object).map(([name,child])=>[name,providerSchema(child)])):providerSchema(value)]));
}
@Injectable()
export class AIProvider {
 constructor(private readonly db?:Database) {}
 async request(model: string, method: string, body: unknown): Promise<any> {
  return limited(()=>this.performRequest(model,method,body));
 }
 private async performRequest(model:string,method:string,body:unknown):Promise<any>{
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new ServiceUnavailableException('Configura GEMINI_API_KEY en el servidor para utilizar IA.');
  try {
   let response:Response|undefined;
   for(let attempt=0;attempt<3;attempt++) {
   if(method==='generateContent')await providerPacing.acquire(model,Math.max(1,Number(process.env.AI_TEXT_REQUESTS_PER_MINUTE)||12));
   response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:${method}`, {
    method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify(body),signal:AbortSignal.timeout(120000),
   });
   if(response.ok || ![429,502,503,504].includes(response.status) || attempt===2)break;
   await response.arrayBuffer();await new Promise(resolve=>setTimeout(resolve,1000*(attempt+1)));
   }
   if (!response!.ok) throw new HttpException(response!.status === 429 ? 'El proveedor de IA alcanzó su límite. Intenta más tarde.' : response!.status===503 ? 'El proveedor de IA está temporalmente saturado. Intenta nuevamente.' : response!.status===404 ? 'El modelo de IA configurado no está disponible. Actualiza GEMINI_MODEL en el servidor.' : 'El proveedor de IA no pudo completar la solicitud. Comprueba el modelo y la configuración.',response!.status === 429 ? 429 : 502);
   return await response!.json();
  } catch(error) { if (error instanceof HttpException) throw error; throw new ServiceUnavailableException('No se pudo conectar con el proveedor de IA.'); }
 }
 async embed(text: string, query = false, userId?:string): Promise<number[]> {
  const response = await this.request(settings.embeddingModel,'embedContent',{
   model:`models/${settings.embeddingModel}`,content:{parts:[{text}]},taskType:query?'RETRIEVAL_QUERY':'RETRIEVAL_DOCUMENT',outputDimensionality:768,
  });
  const vector = response.embedding?.values;
  if (!Array.isArray(vector) || vector.length !== 768 || !vector.every(Number.isFinite)) throw new ServiceUnavailableException('Embedding inválido del proveedor.');
  if(userId && this.db)await this.db.query('INSERT INTO ai_usage(id,user_id,model,request_type,tokens_input) VALUES($1,$2,$3,$4,$5)',[randomUUID(),userId,settings.embeddingModel,query?'embedding_query':'embedding_document',response.usageMetadata?.promptTokenCount || 0]);
  return vector;
 }
 async generate(system: string, prompt: string, schema?: object, image?: InlineAsset|InlineAsset[]) {
  const response = await this.request(settings.model,'generateContent',{
   systemInstruction:{parts:[{text:system}]},contents:[{role:'user',parts:[{text:prompt},...(image?(Array.isArray(image)?image:[image]).map(asset=>({inlineData:{mimeType:asset.mime,data:asset.data}})):[])]}],
   generationConfig:{...(schema?{responseFormat:{text:{mimeType:'APPLICATION_JSON',schema:providerSchema(schema)}}}:{}),maxOutputTokens:16000},
  });
  const text = response.candidates?.[0]?.content?.parts?.filter((part:any)=>part.text && !part.thought).map((part:any)=>part.text).join('');
  if (!text || response.candidates?.[0]?.finishReason !== 'STOP') throw new ServiceUnavailableException('La IA devolvió un resultado vacío o incompleto. Reduce la cantidad de contenido solicitado.');
  return {text,usage:response.usageMetadata || {}};
 }
}
