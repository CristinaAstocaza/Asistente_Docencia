import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { request } from 'node:https';
import { BadRequestException } from '@nestjs/common';
export function publicAddress(ip:string) {
 if (isIP(ip) === 6) return /^2[0-9a-f]{3}:/i.test(ip) && !/^2001:(db8|0):/i.test(ip);
 const parts=ip.split('.').map(Number),[a,b]=parts;
 return parts.length===4 && parts.every(x=>Number.isInteger(x)&&x>=0&&x<=255) && !(a===0||a===10||a===127||a>=224||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||b===0))||(a===100&&b>=64&&b<=127)||(a===198&&(b===18||b===19)));
}
export async function fetchWebSource(value:string,redirects=0):Promise<string> {
 let url:URL;try{url=new URL(value);}catch{throw new BadRequestException('El enlace no es una URL válida.');}
 if(url.protocol!=='https:' || url.username || url.password || (url.port && url.port!=='443') || redirects>3) throw new BadRequestException('Utiliza un enlace HTTPS público sin credenciales.');
 const hostname=url.hostname.replace(/^\[|\]$/g,'');
 const addresses=await lookup(hostname,{all:true});
 if(!addresses.length || addresses.some(a=>!publicAddress(a.address))) throw new BadRequestException('El enlace apunta a una dirección no permitida.');
 // Pin DNS for this connection, preventing DNS rebinding between validation and request.
 const address=addresses[0];
 const result=await new Promise<{body:string;location?:string}>((resolve,reject)=>{
  const req=request(url,{lookup:((_host:any,opts:any,callback:any)=>opts.all?callback(null,addresses):callback(null,address.address,address.family)) as any,headers:{'User-Agent':'Mozilla/5.0 (compatible; AsistenteDocente/1.0)','Accept':'text/html,text/plain','Accept-Encoding':'identity'},timeout:20000},res=>{
   if(res.statusCode && res.statusCode>=300 && res.statusCode<400) { res.resume(); resolve({body:'',location:res.headers.location}); return; }
   if(res.statusCode===403||res.statusCode===429){res.destroy();reject(new BadRequestException('El sitio bloquea la lectura automática. Descarga el contenido y súbelo como PDF o TXT.'));return;}
   if(res.statusCode!==200 || !/^(text\/html|text\/plain|application\/xhtml\+xml)/i.test(res.headers['content-type'] || '')) {res.destroy();reject(new BadRequestException(`El enlace no contiene texto accesible (HTTP ${res.statusCode}).`));return;}
   const pieces:Buffer[]=[];let size=0;
   res.on('data',(data:Buffer)=>{size+=data.length;if(size>2*1024*1024)res.destroy(new BadRequestException('Página demasiado grande.'));else pieces.push(data);});
   res.on('end',()=>resolve({body:Buffer.concat(pieces).toString('utf8')}));res.on('error',reject);
  }); req.on('timeout',()=>req.destroy(new BadRequestException('El sitio tardó demasiado en responder. Intenta nuevamente.')));req.on('error',reject);req.end();
 });
 if(result.location) return fetchWebSource(new URL(result.location,url).href,redirects+1);
 return result.body.replace(/<(script|style|nav|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim();
}
