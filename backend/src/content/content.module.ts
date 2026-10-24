import { BadRequestException, Body, Controller, Delete, Get, Module, NotFoundException, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Database } from '../database/database';
import { AuthGuard, UserRequest } from '../auth/auth.module';
import { parse, text, uuid } from '../common/validation';
import { contracts, examEditContract, Kind } from '../ai/contracts';
import { validateSemantics } from '../ai/ai.module';
import {userRequestFilter} from '../common/ai-usage';
@Controller() @UseGuards(AuthGuard)
export class ContentController {
 constructor(private readonly db:Database) {}
 async owned(id:string,userId:string) {
  const [content]=await this.db.query('SELECT * FROM generated_content WHERE id=$1 AND user_id=$2',[parse(uuid,id),userId]);
  if(!content)throw new NotFoundException('Material no encontrado.');return content;
 }
 @Get('content') list(@Req() req:UserRequest) {return this.db.query('SELECT * FROM generated_content WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 200',[req.user.id]);}
 @Post('content') async create(@Req() req:UserRequest,@Body() input:unknown){
  const inputData=parse(z.object({kind:z.enum(['planning','syllabus']),data:z.unknown()}),input);
  const data=parse(contracts[inputData.kind] as z.ZodType<any>,inputData.data);validateSemantics(inputData.kind,data);
  const [saved]=await this.db.query('INSERT INTO generated_content(id,user_id,kind,title,data,mode) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[randomUUID(),req.user.id,inputData.kind,data.title,JSON.stringify(data),'general']);return saved;
 }
 @Get('content/:id') open(@Req() req:UserRequest,@Param('id') id:string) {return this.owned(id,req.user.id);}
 @Get('content/:id/versions') async versions(@Req() req:UserRequest,@Param('id') id:string) {await this.owned(id,req.user.id);return this.db.query('SELECT version,data,created_at FROM content_versions WHERE content_id=$1 ORDER BY version DESC',[id]);}
 @Patch('content/:id') async update(@Req() req:UserRequest,@Param('id') id:string,@Body() input:unknown) {
  const change=parse(z.object({title:text(300),data:z.unknown(),version:z.number().int().positive()}),input);
  return this.db.transaction(async client=>{
   const {rows:[content]}=await client.query('SELECT * FROM generated_content WHERE id=$1 AND user_id=$2 FOR UPDATE',[parse(uuid,id),req.user.id]);
   if(!content)throw new NotFoundException('Material no encontrado.');
   if(content.version!==change.version)throw new BadRequestException('Este material cambió. Vuelve a abrirlo antes de guardar.');
   const data=parse((content.kind==='exam'?examEditContract:contracts[content.kind as Kind]) as z.ZodType<any>,change.data);data.title=change.title;validateSemantics(content.kind,data);
   if(content.kind==='session'&&data.images?.length){const ids=[...new Set(data.images.map((b:any)=>b.assetId))];const assets=await client.query('SELECT id FROM visual_assets WHERE id=ANY($1::uuid[]) AND user_id=$2',[ids,req.user.id]);if(ids.length!==assets.rows.length)throw new BadRequestException('Una imagen no está disponible para este docente.');}
   if(content.kind==='guide'){const ids=data.blocks.filter((b:any)=>b.assetId).map((b:any)=>b.assetId);if(ids.length){const assets=await client.query('SELECT id FROM visual_assets WHERE id=ANY($1::uuid[]) AND user_id=$2',[ids,req.user.id]);if(new Set(ids).size!==assets.rows.length)throw new BadRequestException('Una imagen no está disponible para este docente.');}}
   await client.query('INSERT INTO content_versions(id,content_id,version,data) VALUES($1,$2,$3,$4)',[randomUUID(),id,content.version,JSON.stringify(content.data)]);
   const {rows:[saved]}=await client.query('UPDATE generated_content SET title=$3,data=$4,version=version+1,updated_at=now() WHERE id=$1 AND user_id=$2 RETURNING *',[id,req.user.id,change.title,JSON.stringify(data)]);
   return saved;
  });
 }
 @Post('content/:id/duplicate') async duplicate(@Req() req:UserRequest,@Param('id') id:string) {
  const content=await this.owned(id,req.user.id),title=`${content.title} (copia)`;
  const [copy]=await this.db.query('INSERT INTO generated_content(id,user_id,kind,title,data,source_ids,citations,mode) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',[randomUUID(),req.user.id,content.kind,title,JSON.stringify({...content.data,title}),JSON.stringify(content.source_ids),JSON.stringify(content.citations),content.mode]);if(content.template_snapshot)await this.db.query('UPDATE generated_content SET template_id=$2,template_snapshot=$3 WHERE id=$1',[copy.id,content.template_id,JSON.stringify(content.template_snapshot)]);return {...copy,template_id:content.template_id,template_snapshot:content.template_snapshot};
 }
 @Delete('content/:id') async remove(@Req() req:UserRequest,@Param('id') id:string) {await this.owned(id,req.user.id);await this.db.query('DELETE FROM generated_content WHERE id=$1 AND user_id=$2',[id,req.user.id]);return {ok:true};}
 @Post('exams/from-bank') async fromBank(@Req() req:UserRequest,@Body() input:unknown) {
  const data=parse(z.object({bankId:uuid,title:text(300),count:z.number().int().min(1).max(50),duration:z.number().int().min(5).max(480)}),input);
  const bank=await this.owned(data.bankId,req.user.id);if(bank.kind!=='questions')throw new BadRequestException('Selecciona un banco de preguntas.');
  if(bank.data.questions.length<data.count)throw new BadRequestException('El banco no tiene suficientes preguntas.');
  const exam={title:data.title,duration:data.duration,instructions:'Responde las preguntas indicadas.',questions:bank.data.questions.slice(0,data.count)};
  const [saved]=await this.db.query('INSERT INTO generated_content(id,user_id,kind,title,data,source_ids,citations,mode) VALUES($1,$2,\'exam\',$3,$4,$5,$6,$7) RETURNING *',[randomUUID(),req.user.id,data.title,JSON.stringify(exam),JSON.stringify(bank.source_ids),JSON.stringify(bank.citations),bank.mode]);return saved;
 }
 @Get('dashboard') async dashboard(@Req() req:UserRequest) {
  const [docs]=await this.db.query('SELECT count(*)::integer AS count,coalesce(sum(size),0)::bigint AS bytes FROM documents WHERE user_id=$1',[req.user.id]);
  const counts=await this.db.query('SELECT kind,count(*)::integer AS count FROM generated_content WHERE user_id=$1 GROUP BY kind',[req.user.id]);
  return {documents:docs.count,storageBytes:Number(docs.bytes),counts:Object.fromEntries(counts.map(x=>[x.kind,x.count])),recent:await this.db.query('SELECT id,kind,title,version,created_at FROM generated_content WHERE user_id=$1 ORDER BY created_at DESC LIMIT 8',[req.user.id]),sources:await this.db.query('SELECT id,name,type,size,status,created_at FROM documents WHERE user_id=$1 ORDER BY created_at DESC LIMIT 5',[req.user.id])};
 }
 @Get('usage') async usage(@Req() req:UserRequest) {const [usage]=await this.db.query(`SELECT count(*) FILTER (WHERE ${userRequestFilter})::integer AS requests,coalesce(sum(tokens_input),0)::integer AS tokens_input,coalesce(sum(tokens_output),0)::integer AS tokens_output FROM ai_usage WHERE user_id=$1`,[req.user.id]);return usage;}
 @Patch('profile') async profile(@Req() req:UserRequest,@Body() input:unknown) {
  const data=parse(z.object({name:text(100),institution:z.string().trim().max(200)}),input);
  const [user]=await this.db.query('UPDATE users SET name=$2,institution=$3 WHERE id=$1 RETURNING id,name,email,institution',[req.user.id,data.name,data.institution]);return user;
 }
}
@Module({controllers:[ContentController]})
export class ContentModule {}
