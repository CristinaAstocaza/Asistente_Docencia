import { BadRequestException, Body, Controller, Delete, Get, Injectable, Module, NotFoundException, OnModuleDestroy, OnModuleInit, Param, Patch, Post, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { z } from 'zod';
import { Database } from '../database/database';
import { AuthGuard, UserRequest } from '../auth/auth.module';
import { parse, text, uuid } from '../common/validation';
import { Storage } from './storage';
import { AIProvider } from '../ai/provider';
import { chunkPages, extract, maxFileSize, validateFile } from './extract';
import { fetchWebSource } from './web-source';
import { settings } from '../config';
export async function checkedUpload(file:Express.Multer.File|undefined) {
 if(!file)throw new BadRequestException('Selecciona un archivo.');
 const decoded=Buffer.from(file.originalname,'latin1').toString('utf8');
 const originalName=[...file.originalname].every(c=>c.codePointAt(0)!<=255)&&!decoded.includes('\uFFFD')?decoded:file.originalname;
 const name=originalName.replace(/[\/\\\u0000-\u001f]/g,'_').slice(0,200);
 const type=validateFile(name,file.buffer);
 if(process.env.SCAN_URL){
  const scan=await fetch(process.env.SCAN_URL,{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:new Uint8Array(file.buffer),signal:AbortSignal.timeout(30000)});
  if(!scan.ok||(await scan.json() as any).clean!==true)throw new BadRequestException('El archivo no pasó la revisión de seguridad.');
 }else if(settings.production)throw new BadRequestException('Configura el escáner de archivos en el servidor.');
 return {name,type};
}
@Injectable()
export class DocumentWorker implements OnModuleInit, OnModuleDestroy {
 private timer?:NodeJS.Timeout; private busy=false; private closing=false;
 constructor(private readonly db:Database,private readonly storage:Storage,private readonly provider:AIProvider) {}
 onModuleInit() { if(process.env.DOC_WORKER_DISABLED!=='1')this.timer=setInterval(()=>{ void this.tick(); },2000); }
 onModuleDestroy() { this.closing=true;if(this.timer)clearInterval(this.timer); }
 async tick() {
  if(this.busy||this.closing)return;this.busy=true;let documentId:string|undefined;const token=randomUUID();let heartbeat:NodeJS.Timeout|undefined;
  try {
   const [doc]=await this.db.query(`UPDATE documents SET processing_token=$1,processing_started_at=now() WHERE id=(
    SELECT id FROM documents WHERE status='processing' AND (processing_started_at IS NULL OR processing_started_at<now()-interval '15 minutes')
    ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`,[token]);
   if(!doc)return;documentId=doc.id;
   heartbeat=setInterval(()=>{void this.db.query('UPDATE documents SET processing_started_at=now() WHERE id=$1 AND processing_token=$2',[doc.id,token]).catch(()=>{});},30000);
    const bytes=await this.storage.get(doc.storage_key);
    const chunks=chunkPages(await extract(bytes,doc.type==='WEB'?'TXT':doc.type,this.provider));
    if(!chunks.length)throw new BadRequestException('No se encontró texto. Si es un PDF escaneado, sube sus páginas como imágenes.');
    const vectors:number[][]=[];
    for(const chunk of chunks)vectors.push(await this.provider.embed(chunk.text,false,doc.user_id));
   await this.db.transaction(async client=>{
    const {rows:[current]}=await client.query('SELECT id FROM documents WHERE id=$1 AND processing_token=$2 FOR UPDATE',[doc.id,token]);
    if(!current)return;
    await client.query('DELETE FROM document_chunks WHERE document_id=$1',[doc.id]);
    for(let i=0;i<chunks.length;i++) {
     await client.query('INSERT INTO document_chunks(id,document_id,ordinal,page,text,embedding) VALUES($1,$2,$3,$4,$5,$6::vector)',[randomUUID(),doc.id,i,chunks[i].page,chunks[i].text,JSON.stringify(vectors[i])]);
    }
    await client.query("UPDATE documents SET status='ready',error=NULL,processing_token=NULL,processing_started_at=NULL WHERE id=$1",[doc.id]);
   });
  } catch(error:any) {
   if(documentId)await this.db.query("UPDATE documents SET status='error',error=$2,processing_token=NULL,processing_started_at=NULL WHERE id=$1 AND processing_token=$3",[documentId,error instanceof BadRequestException || error?.getStatus ? error.message.slice(0,500) : 'No se pudo procesar el documento. Comprueba el formato y la configuración de IA.',token]).catch(()=>{});
  } finally {if(heartbeat)clearInterval(heartbeat);this.busy=false;}
 }
}
@Controller('documents') @UseGuards(AuthGuard)
export class DocumentsController {
 constructor(private readonly db:Database,private readonly storage:Storage) {}
 @Get() list(@Req() req:UserRequest) { return this.db.query('SELECT id,name,type,size,status,error,folder,url,category,enabled,created_at FROM documents WHERE user_id=$1 ORDER BY created_at DESC',[req.user.id]); }
 async owned(id:string,userId:string) {const [doc]=await this.db.query('SELECT * FROM documents WHERE id=$1 AND user_id=$2',[parse(uuid,id),userId]);if(!doc)throw new NotFoundException('Fuente no encontrada.');return doc;}
 async save(req:UserRequest,name:string,type:string,data:Buffer,url?:string) {
  const id=randomUUID();
  await this.storage.put(id,data,type==='PDF'?'application/pdf':'application/octet-stream');
  try {
   await this.db.transaction(async client=>{
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[req.user.id]);
    const {rows:[usage]}=await client.query('SELECT coalesce(sum(size),0) AS size FROM (SELECT size FROM documents WHERE user_id=$1 UNION ALL SELECT size FROM conversation_attachments WHERE user_id=$1 UNION ALL SELECT size FROM visual_assets WHERE user_id=$1) files',[req.user.id]);
    if(Number(usage.size)+data.length>settings.storageLimit)throw new BadRequestException('Has alcanzado el límite de almacenamiento.');
    await client.query('INSERT INTO documents(id,user_id,name,type,size,storage_key,url) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,req.user.id,name,type,data.length,id,url || null]);
   });
  } catch(error) {await this.storage.delete(id);throw error;}
  return this.owned(id,req.user.id).then(({storage_key,user_id,...doc})=>doc);
 }
 @Post() @UseInterceptors(FileInterceptor('file',{storage:memoryStorage(),limits:{fileSize:maxFileSize,files:1,fields:0}}))
 async upload(@Req() req:UserRequest,@UploadedFile() file:Express.Multer.File) {
  const {name,type}=await checkedUpload(file);
  return this.save(req,name,type,file.buffer);
 }
 @Post('web') async web(@Req() req:UserRequest,@Body() input:unknown) {
  const data=parse(z.object({url:z.url().max(2000),name:text(200)}),input);
  let content:string;try{content=await fetchWebSource(data.url);}catch(error){if(error instanceof BadRequestException)throw error;throw new BadRequestException('No se pudo conectar con el sitio. Comprueba el enlace y vuelve a intentarlo.');}
  if(!content)throw new BadRequestException('El enlace no contiene texto.');
  return this.save(req,data.name,'WEB',Buffer.from(content),data.url);
 }
 @Get(':id/preview') async preview(@Req() req:UserRequest,@Param('id') id:string) {
  const doc=await this.owned(id,req.user.id);
  return {id:doc.id,name:doc.name,status:doc.status,error:doc.error,chunks:await this.db.query('SELECT ordinal,page,text FROM document_chunks WHERE document_id=$1 ORDER BY ordinal LIMIT 40',[doc.id])};
 }
 @Get(':id/download') async download(@Req() req:UserRequest,@Param('id') id:string,@Res() res:Response) {
  const doc=await this.owned(id,req.user.id);res.setHeader('Content-Type','application/octet-stream');res.setHeader('Content-Disposition',`attachment; filename*=UTF-8''${encodeURIComponent(doc.name)}`);res.send(await this.storage.get(doc.storage_key));
 }
 @Patch(':id') async rename(@Req() req:UserRequest,@Param('id') id:string,@Body() input:unknown) {
  await this.owned(id,req.user.id);const data=parse(z.object({name:text(200),folder:z.string().trim().max(100).optional(),category:z.enum(['material','syllabus','summary','guideline','template','example']).optional(),enabled:z.boolean().optional()}),input);
  await this.db.query('UPDATE documents SET name=$3,folder=coalesce($4,folder),category=coalesce($5,category),enabled=coalesce($6,enabled) WHERE id=$1 AND user_id=$2',[id,req.user.id,data.name,data.folder??null,data.category??null,data.enabled??null]);return {ok:true};
 }
 @Post(':id/retry') async retry(@Req() req:UserRequest,@Param('id') id:string) {
  const doc=await this.owned(id,req.user.id);if(doc.status!=='error')throw new BadRequestException('Solo se pueden reintentar fuentes con error.');
  await this.db.query("UPDATE documents SET status='processing',error=NULL WHERE id=$1 AND user_id=$2",[id,req.user.id]);return {ok:true};
 }
 @Delete(':id') async remove(@Req() req:UserRequest,@Param('id') id:string) {
  const doc=await this.owned(id,req.user.id);
  await this.db.query('DELETE FROM documents WHERE id=$1 AND user_id=$2',[id,req.user.id]);await this.storage.delete(doc.storage_key);return {ok:true};
 }
}
@Module({controllers:[DocumentsController],providers:[Storage,AIProvider,DocumentWorker]})
export class DocumentsModule {}
