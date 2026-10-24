import { BadRequestException,Body,Controller,Get,Injectable,Module,NotFoundException,Param,Post,Req,Res,UploadedFile,UseGuards,UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { randomUUID } from 'node:crypto';
import { Response } from 'express';
import { z } from 'zod';
import { Database } from '../database/database';
import { Storage } from '../documents/storage';
import { checkedUpload } from '../documents/documents.module';
import { AuthGuard,UserRequest } from '../auth/auth.module';
import { parse,uuid,text } from '../common/validation';
import { settings } from '../config';
import { createCanvas,loadImage } from '@napi-rs/canvas';
import { limited } from '../common/concurrency';
import { searchPresentationImage } from '../exports/presentation-images';
import {limaDayStart,userRequestFilter} from '../common/ai-usage';
@Injectable()
export class AssetManager {
 constructor(private readonly db:Database,private readonly storage:Storage){}
 async save(userId:string,bytes:Buffer,mime:string,caption='',provenance='teacher'){
  // Decode and normalize before persistence: malformed images cannot stall PDF exports.
  try{const image=await loadImage(bytes);if(image.width*image.height>16000000)throw new Error('Too large');const canvas=createCanvas(image.width,image.height);canvas.getContext('2d').drawImage(image,0,0);bytes=canvas.toBuffer('image/png');mime='image/png';}catch{throw new BadRequestException('Imagen dañada o demasiado grande. Máximo 16 millones de píxeles.');}
  const id=randomUUID();await this.storage.put(id,bytes,mime);
  try{await this.db.transaction(async client=>{
   await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[userId]);
   const {rows:[usage]}=await client.query('SELECT coalesce(sum(size),0) AS size FROM (SELECT size FROM documents WHERE user_id=$1 UNION ALL SELECT size FROM conversation_attachments WHERE user_id=$1 UNION ALL SELECT size FROM visual_assets WHERE user_id=$1) files',[userId]);
   if(Number(usage.size)+bytes.length>settings.storageLimit)throw new BadRequestException('Límite de almacenamiento alcanzado.');
   await client.query('INSERT INTO visual_assets(id,user_id,storage_key,mime,size,caption,provenance) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,userId,id,mime,bytes.length,caption,provenance]);
  });}catch(e){await this.storage.delete(id);throw e;}return {id,mime,caption,provenance};
 }
 async get(userId:string,id:string){const [asset]=await this.db.query('SELECT * FROM visual_assets WHERE id=$1 AND user_id=$2',[parse(uuid,id),userId]);if(!asset)throw new NotFoundException('Imagen no encontrada.');return {...asset,bytes:await this.storage.get(asset.storage_key)};}
}
export class VisualContentPlanner {plan(blocks:any[],mode:string){return mode==='none'?blocks.filter(b=>b.type!=='diagram'):blocks;}}
export class DiagramGenerator {items(labels:string[]){return labels.slice(0,40).map((label,i)=>`${i+1}. ${label}`);}}
@Injectable()
export class ImageGenerationProvider {
 async generate(prompt:string){
  return limited(()=>this.request(prompt));
 }
 private async request(prompt:string){
  const model=process.env.GEMINI_IMAGE_MODEL;
  if(!model)throw new BadRequestException('No hay modelo de imágenes configurado. Puedes continuar con texto, tablas, diagramas e imágenes propias.');
  const key=process.env.GEMINI_IMAGE_API_KEY||process.env.GEMINI_API_KEY;
  if(!key)throw new BadRequestException('Configura la clave de Gemini para imágenes en el servidor.');
  const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{parts:[{text:`Ilustración educativa, nunca evidencia clínica ni captura auténtica. ${prompt}`}]}],generationConfig:{responseModalities:['TEXT','IMAGE']}}),signal:AbortSignal.timeout(120000)});
  if(!response.ok)throw new BadRequestException(response.status===429?'Gemini alcanzó la cuota de imágenes. Revisa la cuota y facturación del proyecto.':response.status===403?'El proyecto de Gemini no tiene permiso para generar imágenes.':response.status===404?'El modelo de imágenes configurado no está disponible.':'Gemini no pudo generar la imagen. Intenta nuevamente.');
  const result=await response.json() as any;const asset=result.candidates?.[0]?.content?.parts?.find((p:any)=>p.inlineData)?.inlineData;
  if(!asset||!['image/png','image/jpeg'].includes(asset.mimeType))throw new BadRequestException('El modelo no devolvió una imagen compatible.');
  const bytes=Buffer.from(asset.data,'base64');if(bytes.length>10*1024*1024)throw new BadRequestException('Imagen demasiado grande.');return {bytes,mime:asset.mimeType};
 }
}
@Injectable()
export class VisualContentService {
 constructor(private readonly assets:AssetManager,private readonly images:ImageGenerationProvider){}
 assetBytes(userId:string,id:string){return this.assets.get(userId,id);}
 async generate(userId:string,prompt:string){const asset=await this.images.generate(prompt);return this.assets.save(userId,asset.bytes,asset.mime,'Ilustración generada por IA','generated');}
 async reference(userId:string,query:string){
  const image=await searchPresentationImage(query);
  if(!image)return null;
  const match=image.data.match(/^data:(image\/(?:png|jpeg));base64,(.+)$/);
  if(!match)return null;
  const caption=`${image.title.slice(0,140)} · ${image.author.slice(0,160)} · ${image.license.slice(0,80)} · ${image.source}`;
  const asset=await this.assets.save(userId,Buffer.from(match[2],'base64'),match[1],caption,'reference');
  return {...asset,source:image.source};
 }
}
@Controller('visual-assets') @UseGuards(AuthGuard)
export class VisualController {
 constructor(private readonly assets:AssetManager,private readonly visual:VisualContentService,private readonly db:Database){}
 @Get('capabilities') capabilities(){return {imageGeneration:!!process.env.GEMINI_IMAGE_MODEL&&!!(process.env.GEMINI_IMAGE_API_KEY||process.env.GEMINI_API_KEY),diagrams:true};}
 @Post() @UseInterceptors(FileInterceptor('file',{storage:memoryStorage(),limits:{fileSize:10*1024*1024,files:1,fields:0}}))
 async upload(@Req() req:UserRequest,@UploadedFile() file:Express.Multer.File){const {type}=await checkedUpload(file);if(!['PNG','JPG','JPEG'].includes(type))throw new BadRequestException('Selecciona una imagen PNG o JPEG.');return this.assets.save(req.user.id,file.buffer,type==='PNG'?'image/png':'image/jpeg');}
 @Post('generate') async generate(@Req() req:UserRequest,@Body() input:unknown){const {prompt}=parse(z.object({prompt:text(2000)}),input);const id=randomUUID();
  await this.db.transaction(async client=>{await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[req.user.id]);const {rows:[u]}=await client.query(`SELECT count(*) AS count FROM ai_usage WHERE user_id=$1 AND ${userRequestFilter} AND created_at>=${limaDayStart}`,[req.user.id]);if(Number(u.count)>=settings.dailyLimit)throw new BadRequestException('Límite diario IA alcanzado.');await client.query('INSERT INTO ai_usage(id,user_id,model,request_type) VALUES($1,$2,$3,$4)',[id,req.user.id,process.env.GEMINI_IMAGE_MODEL||'unconfigured','image_generation']);});return this.visual.generate(req.user.id,prompt);
 }
 @Get(':id') async get(@Req() req:UserRequest,@Param('id') id:string,@Res() res:Response){const asset=await this.assets.get(req.user.id,id);res.setHeader('Content-Type',asset.mime);res.setHeader('Content-Disposition','inline');res.send(asset.bytes);}
}
@Module({controllers:[VisualController],providers:[Storage,AssetManager,ImageGenerationProvider,VisualContentService],exports:[AssetManager,VisualContentService]})
export class VisualModule{}
