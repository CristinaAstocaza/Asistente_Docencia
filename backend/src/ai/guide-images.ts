import {BadRequestException} from '@nestjs/common';
import {randomUUID} from 'node:crypto';
import {paginateGuideChapter} from '../exports/guide-publication';
import {VisualContentService} from '../visual/visual.module';

export async function illustrateGuide(data:any,options:{userId:string;topic:string;mode:string;visuals:VisualContentService;citations:any[];ownIds?:string[];reserve:()=>Promise<unknown>}){
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
  if(assets.length>=3)break;
  try{const asset=await visuals.reference(userId,search.query);if(asset&&!sources.has(asset.source)){sources.add(asset.source);assets.push({...asset,chapter:search.chapter});}}catch{/* Other queries or a supplied image may still succeed. */}
 }
 if(!assets.length)throw new BadRequestException(`No se pudieron obtener imágenes para esta guía. ${generatedError} Selecciona «Imágenes de referencia» o adjunta imágenes propias.`.trim());
 // Reflow images with their section, leaving room for captions and references on A4.
 const sections=data.publication.pageTitles.map((title:string,i:number)=>({title,blocks:data.blocks.filter((b:any)=>b.page===i+2)}));
 for(const asset of assets){const index=Math.min(sections.length-1,Math.max(0,asset.chapter-1));sections[index].blocks.push({id:randomUUID(),type:'image',text:'',assetId:asset.id,caption:asset.caption,width:100});}
 const pages:{title:string;blocks:any[]}[]=sections.flatMap((section:any,i:number)=>paginateGuideChapter(section.title,section.blocks,i===sections.length-1?citations:[]));
 if(pages.length>29)throw new BadRequestException('Las imágenes y el contenido necesitan más de 30 páginas. Divide el tema en dos guías.');
 data.publication.pageTitles=pages.map(page=>page.title);data.publication.pageCount=pages.length+1;
 data.blocks=pages.flatMap((page,i)=>page.blocks.map(block=>({...block,page:i+2})));
 return generatedError?'Gemini no pudo generar ilustraciones. Se incluyeron imágenes de referencia con su autor y fuente.':undefined;
}
