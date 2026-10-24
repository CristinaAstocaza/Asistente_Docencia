import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { resolve, join } from 'node:path';

export interface PresentationImage {data:string;title:string;author:string;license:string;source:string;width:number;height:number}
const pending=new Map<string,Promise<(PresentationImage|null)[]>>();
const clean=(text:string)=>text.replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim();
const hosts=new Set(['commons.wikimedia.org','upload.wikimedia.org','thumb.wikimedia.org']);

async function boundedFetch(value:string,signal:AbortSignal,limit:number):Promise<Buffer> {
 const url=new URL(value);
 if(url.protocol!=='https:'||!hosts.has(url.hostname)||url.username||url.password||url.port)throw new Error('Image host not allowed');
 const response=await fetch(url,{signal,redirect:'error',headers:{'User-Agent':'AsistenteDocente/1.0 (educational presentation images; Wikimedia Commons)'}});
 if(!response.ok||Number(response.headers.get('content-length')||0)>limit)throw new Error('Image provider unavailable');
 const reader=response.body?.getReader();if(!reader)throw new Error('Empty response');
 const chunks:Buffer[]=[];let total=0;
 try{while(true){const part=await reader.read();if(part.done)break;total+=part.value.length;if(total>limit)throw new Error('Image too large');chunks.push(Buffer.from(part.value));}}finally{await reader.cancel().catch(()=>{});}
 return Buffer.concat(chunks);
}

export async function searchPresentationImage(query:string,signal=AbortSignal.timeout(12000)):Promise<PresentationImage|null> {
 const params=new URLSearchParams({action:'query',format:'json',generator:'search',gsrnamespace:'6',gsrsearch:`${query.slice(0,160)} filetype:bitmap`,gsrlimit:'10',prop:'imageinfo',iiprop:'url|size|extmetadata|mime',iiurlwidth:'1000'});
 const payload=JSON.parse((await boundedFetch(`https://commons.wikimedia.org/w/api.php?${params}`,signal,2*1024*1024)).toString());
 const tokens=query.toLowerCase().split(/\W+/).filter(word=>word.length>3);
 const relevance=(page:any)=>{
  const title=page.title.toLowerCase(),description=clean(page.imageinfo?.[0]?.extmetadata?.ImageDescription?.value||'').toLowerCase();
  let score=tokens.reduce((sum,word)=>sum+(title.includes(word)?4:0)+(description.includes(word)?1:0),0);
  if(!/history|historical|antique|museum/.test(query)&&/historic|antique|museum|19th century|old classroom/.test(`${title} ${description}`))score-=12;
  return score;
 };
 const pages=Object.values(payload.query?.pages||{}).sort((a:any,b:any)=>relevance(b)-relevance(a)||a.index-b.index) as any[];
 for(const page of pages){
  const info=page.imageinfo?.[0],meta=info?.extmetadata;
  if(!info||!meta)continue;
  const description=`${page.title} ${clean(meta.ImageDescription?.value||'')}`.toLowerCase();
  if(/computer|laptop|tablet|digital/.test(query)&&!/computer|laptop|tablet|digital|computador|ordenador|portátil/.test(description))continue;
  if(/classroom/.test(query)&&!/classroom|computer lab|aula|school|escuela/.test(description))continue;
  const license=clean(meta.LicenseShortName?.value||'');
  if(!/^(CC BY(?:-SA)?(?: |$)|CC0|Public domain)/i.test(license)||/NC|ND/i.test(license))continue;
  const url=info.thumburl||info.url;
  if(!url||!/^image\/(jpeg|png)$/.test(info.thumbmime||info.mime)||info.width<400||info.height<250)continue;
  try{
   const bytes=await boundedFetch(url,signal,4*1024*1024);
   const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
   const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
   if(!png&&!jpeg)continue;
   return {data:`data:image/${png?'png':'jpeg'};base64,${bytes.toString('base64')}`,title:clean(page.title.replace(/^File:/,'')),author:clean(meta.Artist?.value||meta.Credit?.value||'Wikimedia Commons'),license,source:info.descriptionurl,width:info.thumbwidth||info.width,height:info.thumbheight||info.height};
  }catch{if(signal.aborted)return null;}
 }
 return null;
}

/** Cache the complete selection so PDF/PPTX reuse the same photos, even offline. */
export async function presentationImages(data:any):Promise<(PresentationImage|null)[]> {
 if(process.env.PRESENTATION_IMAGES==='off'||data.imageMode==='none')return data.slides.map(()=>null);
 const signature=JSON.stringify({title:data.title,slides:data.slides.map((s:any)=>({title:s.title,query:s.imageQuery||s.visualSuggestion}))});
 const key=createHash('sha256').update(`v2:${signature}`).digest('hex');
 if(pending.has(key))return pending.get(key)!;
 const job=(async()=>{
  const folder=resolve(process.env.STORAGE_PATH||'./storage','presentation-assets'),file=join(folder,`${key}.json`);
  try{const saved=JSON.parse(await readFile(file,'utf8'));if(saved.images.some(Boolean)||Date.now()-saved.created<3600000)return saved.images;}catch{}
  const queries=[...new Set<string>(data.slides.map((s:any)=>String(s.imageQuery||data.title).trim()).filter(Boolean))].slice(0,6);
  const found=new Map<string,PresentationImage|null>();
  const signal=AbortSignal.timeout(22000);
  // Two requests at a time; a provider outage never blocks the export.
  for(let i=0;i<queries.length&&!signal.aborted;i+=2)await Promise.all(queries.slice(i,i+2).map(async query=>{try{found.set(query,await searchPresentationImage(query,signal));}catch{found.set(query,null);}}));
  const primary=[...found.values()].find(Boolean)||null;
  const images=data.slides.map((s:any)=>found.get(String(s.imageQuery||data.title).trim())||(!s.imageQuery?primary:null));
  try{await mkdir(folder,{recursive:true});const temp=`${file}.${process.pid}.tmp`;await writeFile(temp,JSON.stringify({created:Date.now(),images}));await rename(temp,file);}catch{}
  return images;
 })().finally(()=>pending.delete(key));pending.set(key,job);return job;
}
