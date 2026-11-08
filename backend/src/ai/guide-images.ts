import {BadRequestException} from '@nestjs/common';
import {randomUUID} from 'node:crypto';
import {paginateGuideChapter} from '../exports/guide-publication';
import {VisualContentService} from '../visual/visual.module';

export async function illustrateGuide(data:any,options:{userId:string;topic:string;mode:string;visuals:VisualContentService;citations:any[];ownIds?:string[];reserve:()=>Promise<unknown>;isRelevant?:(assetId:string,about:string)=>Promise<boolean>}){
 const {userId,topic,mode,visuals,citations}=options;
 if(mode==='none'||mode==='diagrams')return;
 const assets:{id:string;caption:string;chapter:number}[]=[],sources=new Set<string>();let generatedError='';
 for(const [i,id] of (options.ownIds||[]).entries()){const asset=await visuals.assetBytes(userId,id);assets.push({id,caption:asset.caption||'Imagen aportada por el docente',chapter:i+1});}
 if(mode==='generated'){
  try{await options.reserve();const asset=await visuals.generate(userId,`Ilustración educativa relacionada con ${topic}. ${data.objectives.join('; ')}`);assets.push({...asset,chapter:1});}
  catch(error){generatedError=error instanceof Error?error.message:'El proveedor no pudo generar la ilustración.';}
 }
 const searches=data.publication.imageSearches?.length?data.publication.imageSearches:[{query:topic,chapter:1},{query:topic+' diagram',chapter:2}];
 if(mode!=='own')for(const search of searches){
  if(assets.length>=4)break;
  // Full query, then 3 and 2 words; shortened queries must be fully described by the picture.
  const words=String(search.query).split(/\s+/).filter(Boolean);
  const attempts:[string,boolean][]=[[search.query,false],...(words.length>3?[[words.slice(0,3).join(' '),true] as [string,boolean]]:[]),...(words.length>2?[[words.slice(0,2).join(' '),true] as [string,boolean]]:[])];
  for(const [query,all] of attempts){
   try{const asset=await visuals.reference(userId,query,4,all);if(asset&&!sources.has(asset.source)){sources.add(asset.source);if(options.isRelevant&&!(await options.isRelevant(asset.id,`${search.query} (${topic})`)))continue;assets.push({...asset,chapter:search.chapter});break;}}catch{/* Other queries or a supplied image may still succeed. */}
  }
 }
 // Strict searches found nothing: one permissive pass before reporting that no image is available.
 if(!assets.length&&mode!=='own')for(const search of searches){try{const asset=await visuals.reference(userId,search.query);if(asset&&!(options.isRelevant&&!(await options.isRelevant(asset.id,`${search.query} (${topic})`)))){assets.push({...asset,chapter:search.chapter});break;}}catch{/* next query */}}
 if(!assets.length)throw new BadRequestException(`No se pudieron obtener imágenes para esta guía. ${generatedError} Selecciona «Imágenes de referencia» o adjunta imágenes propias.`.trim());
 // Reflow images with their section, leaving room for captions and references on A4.
 const sections=data.publication.pageTitles.map((title:string,i:number)=>({title,blocks:data.blocks.filter((b:any)=>b.page===i+2)}));
 // The picture goes right after the section's first explanation, next to what it illustrates (not alone at the end).
 for(const asset of assets){const index=Math.min(sections.length-1,Math.max(0,asset.chapter-1)),blocks=sections[index].blocks;const first=blocks.findIndex((b:any)=>b.type==='paragraph');const at=first>=0?first+1:Math.min(1,blocks.length);blocks.splice(at,0,{id:randomUUID(),type:'image',text:'',assetId:asset.id,caption:asset.caption,width:100});}
 const pages:{title:string;blocks:any[]}[]=sections.flatMap((section:any,i:number)=>paginateGuideChapter(section.title,section.blocks,i===sections.length-1?citations:[]));
 if(pages.length>29)throw new BadRequestException('Las imágenes y el contenido necesitan más de 30 páginas. Divide el tema en dos guías.');
 data.publication.pageTitles=pages.map(page=>page.title);data.publication.pageCount=pages.length+1;
 data.blocks=pages.flatMap((page,i)=>page.blocks.map(block=>({...block,page:i+2})));
 return generatedError?'Gemini no pudo generar ilustraciones. Se incluyeron imágenes de referencia con su autor y fuente.':undefined;
}
