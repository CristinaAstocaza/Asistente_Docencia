import { BadRequestException,Body,Controller,Delete,Get,Injectable,NotFoundException,OnModuleInit,Param,Patch,Post,Req,Res,UploadedFile,UseGuards,UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import { z } from 'zod';
import { Database } from '../database/database';
import { Storage } from '../documents/storage';
import { checkedUpload } from '../documents/documents.module';
import { extract,maxFileSize } from '../documents/extract';
import { AuthGuard,UserRequest } from '../auth/auth.module';
import { parse,uuid } from '../common/validation';
import { settings } from '../config';
import type { InlineAsset } from './provider';

export type AttachmentContext={context:string;images:InlineAsset[];citations:any[]};
const metadata='id,conversation_id,name,type,size,purpose,created_at';
const mime=(type:string)=>({PNG:'image/png',JPG:'image/jpeg',JPEG:'image/jpeg',PDF:'application/pdf',TXT:'text/plain; charset=utf-8',DOCX:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',PPTX:'application/vnd.openxmlformats-officedocument.presentationml.presentation'}[type]??'application/octet-stream');

@Injectable()
export class ChatAttachments implements OnModuleInit {
 constructor(private readonly db:Database,private readonly storage:Storage){}
 async onModuleInit(){
  await this.db.query(`CREATE TABLE IF NOT EXISTS conversation_attachments (
   id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
   conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
   name text NOT NULL,type text NOT NULL,size bigint NOT NULL,storage_key text NOT NULL,
   purpose text NOT NULL DEFAULT 'content',created_at timestamptz NOT NULL DEFAULT now())`);
  await this.db.query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_ids jsonb NOT NULL DEFAULT '[]'");
 }
 async conversation(id:string,userId:string){const [row]=await this.db.query('SELECT id FROM conversations WHERE id=$1 AND user_id=$2',[parse(uuid,id),userId]);if(!row)throw new NotFoundException('Conversación no encontrada.');}
 async owned(id:string,conversationId:string,userId:string){
  const [row]=await this.db.query('SELECT * FROM conversation_attachments WHERE id=$1 AND conversation_id=$2 AND user_id=$3',[parse(uuid,id),parse(uuid,conversationId),userId]);
  if(!row)throw new NotFoundException('Adjunto no encontrado en este chat.');return row;
 }
 async list(id:string,userId:string){await this.conversation(id,userId);return this.db.query(`SELECT ${metadata} FROM conversation_attachments WHERE conversation_id=$1 AND user_id=$2 ORDER BY created_at,id`,[id,userId]);}
 async context(id:string,userId:string,ids:string[],offset=0):Promise<AttachmentContext>{
  if(!ids.length)return {context:'',images:[],citations:[]};
  const rows=await this.db.query('SELECT * FROM conversation_attachments WHERE id=ANY($1::uuid[]) AND conversation_id=$2 AND user_id=$3',[ids,id,userId]);
  if(rows.length!==new Set(ids).size)throw new NotFoundException('Un adjunto no pertenece a esta conversación.');
  const images:InlineAsset[]=[],parts:string[]=[],citations:any[]=[];let inlineSize=0;
  for(const [i,row] of rows.entries()){
   const bytes=await this.storage.get(row.storage_key),reference=offset+i+1;
   const visual=['PNG','JPG','JPEG','PDF'].includes(row.type);
   const sendVisual=visual&&bytes.length<=8*1024*1024&&inlineSize+bytes.length<=20*1024*1024;
   if(visual&&row.type!=='PDF'&&!sendVisual)throw new BadRequestException('Las imágenes seleccionadas superan el límite de 20 MB por mensaje u 8 MB por imagen. Reduce su tamaño o desmarca algunas.');
   let content='';
   if(!['PNG','JPG','JPEG'].includes(row.type))content=(await extract(bytes,row.type,{} as any)).map(p=>`${p.page?`Página ${p.page}: `:''}${p.text}`).join('\n').slice(0,18000);
   if(sendVisual){images.push({mime:mime(row.type),data:bytes.toString('base64')});inlineSize+=bytes.length;}
   parts.push(`[${reference}] Adjunto: ${row.name}. Uso: ${row.purpose==='reference'?'EJEMPLO DE FORMATO (no heredar sus datos ni su tema)':'FUENTE DE CONTENIDO'}.${sendVisual?` Archivo visual adjunto ${images.length}.`:''}\n${content}`);
   citations.push({reference,documentId:row.id,chunkId:row.id,name:row.name,page:null,attachment:true});
  }
  return {context:parts.join('\n\n'),images,citations};
 }
}

@Controller('conversations/:conversationId/attachments') @UseGuards(AuthGuard)
export class ChatAttachmentsController {
 constructor(private readonly db:Database,private readonly files:ChatAttachments,private readonly storage:Storage){}
 @Get() list(@Req() req:UserRequest,@Param('conversationId') id:string){return this.files.list(id,req.user.id);}
 @Post() @UseInterceptors(FileInterceptor('file',{storage:memoryStorage(),limits:{fileSize:maxFileSize,files:1,fields:1}}))
 async upload(@Req() req:UserRequest,@Param('conversationId') conversationId:string,@UploadedFile() file:Express.Multer.File,@Body() input:unknown){
  await this.files.conversation(conversationId,req.user.id);
  const {purpose}=parse(z.object({purpose:z.enum(['content','reference']).default('content')}),input);
  const {name,type}=await checkedUpload(file);const id=randomUUID();
  await this.storage.put(id,file.buffer,mime(type));
  try{return await this.db.transaction(async client=>{
   await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[req.user.id]);
   const {rows:[usage]}=await client.query('SELECT coalesce(sum(size),0) AS size FROM (SELECT size FROM documents WHERE user_id=$1 UNION ALL SELECT size FROM conversation_attachments WHERE user_id=$1 UNION ALL SELECT size FROM visual_assets WHERE user_id=$1) files',[req.user.id]);
   if(Number(usage.size)+file.size>settings.storageLimit)throw new BadRequestException('Has alcanzado el límite de almacenamiento.');
   const {rows:[count]}=await client.query('SELECT count(*)::int AS count FROM conversation_attachments WHERE conversation_id=$1',[conversationId]);
   if(count.count>=20)throw new BadRequestException('Este chat admite hasta 20 adjuntos. Elimina uno para agregar otro.');
   const {rows:[saved]}=await client.query(`INSERT INTO conversation_attachments(id,user_id,conversation_id,name,type,size,storage_key,purpose) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING ${metadata}`,[id,req.user.id,conversationId,name,type,file.size,id,purpose]);return saved;
  });}catch(error){await this.storage.delete(id);throw error;}
 }
 @Patch(':id') async purpose(@Req() req:UserRequest,@Param('conversationId') conversationId:string,@Param('id') id:string,@Body() input:unknown){
  await this.files.owned(id,conversationId,req.user.id);const {purpose}=parse(z.object({purpose:z.enum(['content','reference'])}),input);
  await this.db.query('UPDATE conversation_attachments SET purpose=$2 WHERE id=$1',[id,purpose]);return {ok:true};
 }
 @Get(':id/download') async download(@Req() req:UserRequest,@Param('conversationId') conversationId:string,@Param('id') id:string,@Res() res:Response){
  const row=await this.files.owned(id,conversationId,req.user.id);
  res.setHeader('Content-Type',mime(row.type));res.setHeader('Content-Disposition',`inline; filename*=UTF-8''${encodeURIComponent(row.name)}`);res.send(await this.storage.get(row.storage_key));
 }
 @Delete(':id') async remove(@Req() req:UserRequest,@Param('conversationId') conversationId:string,@Param('id') id:string){
  const row=await this.files.owned(id,conversationId,req.user.id);await this.db.query('DELETE FROM conversation_attachments WHERE id=$1',[id]);await this.storage.delete(row.storage_key);return {ok:true};
 }
}
