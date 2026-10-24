import { createHash } from 'node:crypto';
import { ServiceUnavailableException } from '@nestjs/common';
// Original bytes remain private; URLs and credentials never reach the browser.
export class CloudinaryStorage {
 private readonly cloud=process.env.CLOUDINARY_CLOUD_NAME;
 private readonly key=process.env.CLOUDINARY_API_KEY;
 private readonly secret=process.env.CLOUDINARY_API_SECRET;
 private publicId(key:string){if(!/^[a-f0-9-]{36}$/.test(key))throw new Error('Invalid storage key');return `docente/${key}`;}
 private signed(params:Record<string,string>){
  if(!this.cloud||!this.key||!this.secret)throw new ServiceUnavailableException('Configura las credenciales de Cloudinary en el servidor.');
  const canonical=Object.entries(params).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('&');
  return {...params,api_key:this.key,signature:createHash('sha1').update(canonical+this.secret).digest('hex')};
 }
 private async response(response:Response){if(!response.ok)throw new ServiceUnavailableException('Cloudinary no pudo completar la operación.');return response;}
 async put(key:string,data:Buffer,mime:string){
  const params=this.signed({public_id:this.publicId(key),timestamp:String(Math.floor(Date.now()/1000)),type:'private',overwrite:'false'});
  const form=new FormData();for(const [k,v] of Object.entries(params))form.append(k,v);form.append('file',new Blob([new Uint8Array(data)],{type:mime}),'original');
  await this.response(await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(this.cloud!)}/raw/upload`,{method:'POST',body:form,signal:AbortSignal.timeout(60000)}));
 }
 async get(key:string){
  const params=this.signed({public_id:this.publicId(key),timestamp:String(Math.floor(Date.now()/1000)),expires_at:String(Math.floor(Date.now()/1000)+60),type:'private'});
  const query=new URLSearchParams(params);
  const response=await this.response(await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(this.cloud!)}/raw/download?${query}`,{signal:AbortSignal.timeout(60000)}));
  return Buffer.from(await response.arrayBuffer());
 }
 async delete(key:string){
  const params=this.signed({public_id:this.publicId(key),timestamp:String(Math.floor(Date.now()/1000)),type:'private',invalidate:'true'});
  await this.response(await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(this.cloud!)}/raw/destroy`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(params),signal:AbortSignal.timeout(30000)}));
 }
}
