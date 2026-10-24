import { BadRequestException, Body, Controller, Get, Module, NotFoundException, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Database } from '../database/database';
import { AuthGuard, UserRequest } from '../auth/auth.module';
import { parse, uuid } from '../common/validation';
import { examVersion, flatten, renderDocx, renderPdf } from './render';
import { quizWorkbook } from './quiz-workbook';
import { KahootExportService } from './kahoot';
import { AssetManager,VisualModule } from '../visual/visual.module';
import { renderGuideDocx,renderGuidePdf } from './guide-render';
import { renderPublishedGuideDocx,renderPublishedGuidePdf } from './guide-publication';
import { planningDocument } from './planning-render';
import { sessionDocument } from './session-render';
import { presentationImages } from './presentation-images';
import { buildPresentationScene,renderPresentationPdf,renderPresentationPptx } from './presentation-render';
import { renderAcademicDocx,renderAcademicPdf,renderAcademicRubricDocx,renderAcademicRubricPdf } from './academic-render';
import { renderLessonDocx,renderLessonPdf } from './lesson-render';
import { renderSyllabusDocx,renderSyllabusPdf } from './syllabus-render';
import { renderExamPdf } from './exam-render';
export function quizCsv(questions:any[],platform:string) {
 const escape=(value:unknown)=>`"${String(value??'').replace(/"/g,'""').replace(/^[=+@-]/,"'$&")}"`;
 const header=['Question Text','Question Type','Option 1','Option 2','Option 3','Option 4','Correct Answer','Time in seconds','Answer explanation'];
 const rows=questions.map(q=>{
  const options=q.type==='true_false'?['Verdadero','Falso']:q.options;
  if(!['multiple_choice','true_false'].includes(q.type) || options.length>4 || !options.includes(q.correctAnswer))throw new BadRequestException('El quiz requiere preguntas de opción múltiple o verdadero/falso con hasta cuatro alternativas.');
  return [q.question,'Multiple Choice',...Array.from({length:4},(_,i)=>options[i]||''),options.indexOf(q.correctAnswer)+1,30,q.explanation];
 });return '\ufeff'+[header,...rows].map(row=>row.map(escape).join(',')).join('\r\n');
}
@Controller() @UseGuards(AuthGuard)
export class ExportsController {
 constructor(private readonly db:Database,private readonly assets:AssetManager) {}
 async content(id:string,userId:string) {const [c]=await this.db.query('SELECT * FROM generated_content WHERE id=$1 AND user_id=$2',[parse(uuid,id),userId]);if(!c)throw new NotFoundException();return c;}
 @Get('content/:id/guide-preview') async guidePreview(@Req() req:UserRequest,@Param('id') id:string,@Res() res:Response){
  const content=await this.content(id,req.user.id);if(content.kind!=='guide')throw new BadRequestException('Selecciona una guía.');
  const images=new Map();for(const b of content.data.blocks)if(b.assetId&&!images.has(b.assetId))images.set(b.assetId,await this.assets.get(req.user.id,b.assetId));
  res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition','inline; filename="guia.pdf"');res.send(await renderPublishedGuidePdf(content.data,images,content.citations));
 }
 @Get('content/:id/presentation-preview') async preview(@Req() req:UserRequest,@Param('id') id:string,@Res() res:Response){
  const content=await this.content(id,req.user.id);
  if(content.kind!=='presentation')throw new BadRequestException('Selecciona una presentación.');
  const scene=buildPresentationScene(content.data,await presentationImages(content.data),content.citations);
  res.setHeader('Content-Type','application/pdf');res.setHeader('X-Presentation-Images',String(scene.imageCount));
  res.setHeader('Content-Disposition','inline; filename="presentacion.pdf"');res.send(await renderPresentationPdf(scene));
 }
 @Post('content/:id/export') async export(@Req() req:UserRequest,@Param('id') id:string,@Body() input:unknown,@Res() res:Response) {
  const params=parse(z.object({format:z.enum(['docx','pdf','pptx']),answerKey:z.boolean().default(false),variant:z.enum(['original','A','B']).default('original')}),input);
  const content=await this.content(id,req.user.id);
  const data=content.kind==='exam'?examVersion(content.data,params.variant):content.data;
  const lines=flatten(data,params.answerKey);
  if(content.citations.length) {lines.push({text:'Fuentes consultadas',heading:true});for(const c of content.citations)lines.push({text:`[${c.reference}] ${c.name}${c.page?` — página/diapositiva ${c.page}`:''}`});}
  let bytes:Buffer;
  if(content.kind==='session'&&['pdf','docx'].includes(params.format)){
   const session=sessionDocument(data),images=new Map();for(const image of data.images||[])images.set(image.assetId,await this.assets.get(req.user.id,image.assetId));bytes=params.format==='docx'?await renderGuideDocx(session,images,content.citations):await renderGuidePdf(session,images,content.citations);
  }
  else if(content.kind==='planning'&&['pdf','docx'].includes(params.format)){
   const plan=planningDocument(data);bytes=params.format==='docx'?await renderGuideDocx(plan,new Map(),content.citations):await renderGuidePdf(plan,new Map(),content.citations);
  }
  else if(content.kind==='guide'&&['pdf','docx'].includes(params.format)){
   const images=new Map();for(const b of data.blocks)if(b.assetId&&!images.has(b.assetId))images.set(b.assetId,await this.assets.get(req.user.id,b.assetId));
   bytes=params.format==='docx'?await renderPublishedGuideDocx(data,images,content.citations):await renderPublishedGuidePdf(data,images,content.citations);
  }
  else if(content.kind==='presentation'&&['pdf','pptx'].includes(params.format)){
   const images=await presentationImages(data);
   const scene=buildPresentationScene(data,images,content.citations);
   res.setHeader('X-Presentation-Images',String(scene.imageCount));
   bytes=params.format==='pptx'?await renderPresentationPptx(scene):await renderPresentationPdf(scene);
  }
  else if(params.format==='pptx')throw new BadRequestException('Solo las presentaciones se exportan a PowerPoint.');
  else if(['exam','questions'].includes(content.kind)&&params.format==='pdf')bytes=await renderExamPdf(data,params.answerKey);
  else if(content.kind==='syllabus')bytes=params.format==='docx'?await renderSyllabusDocx(data,content.citations):await renderSyllabusPdf(data,content.citations);
  else if(content.kind==='lesson')bytes=params.format==='docx'?await renderLessonDocx(data,content.citations):await renderLessonPdf(data,content.citations);
  else if(content.kind==='rubric')bytes=params.format==='docx'?await renderAcademicRubricDocx(data,content.citations):await renderAcademicRubricPdf(data,content.citations);
  else if(['activity','summary'].includes(content.kind))bytes=params.format==='docx'?await renderAcademicDocx(data,content.kind,content.citations):await renderAcademicPdf(data,content.kind,content.citations);
  else bytes=params.format==='docx'?await renderDocx(lines):await renderPdf(lines);
  await this.db.query('INSERT INTO exports(id,user_id,content_id,format) VALUES($1,$2,$3,$4)',[randomUUID(),req.user.id,id,params.format]);
  const mime={docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',pdf:'application/pdf',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation'}[params.format];
  res.setHeader('Content-Type',mime);res.setHeader('Content-Disposition',`attachment; filename="material-${id}.${params.format}"`);res.send(bytes);
 }
 @Post('integrations/:platform/export') async quiz(@Req() req:UserRequest,@Param('platform') platform:string,@Body() input:unknown,@Res() res:Response) {
  if(!['quizizz','kahoot'].includes(platform))throw new BadRequestException('Integración no disponible.');
  const data=parse(z.object({contentId:uuid}),input);const content=await this.content(data.contentId,req.user.id);
  if(!['questions','exam'].includes(content.kind))throw new BadRequestException('Selecciona preguntas o un examen.');
  const workbook=platform==='kahoot'?await new KahootExportService().export(content.data.questions):await quizWorkbook(content.data.questions,platform);
  await this.db.query('INSERT INTO exports(id,user_id,content_id,format) VALUES($1,$2,$3,$4)',[randomUUID(),req.user.id,content.id,`${platform}-xlsx`]);
  res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');res.setHeader('Content-Disposition',`attachment; filename="${platform}-preguntas.xlsx"`);res.send(workbook);
 }
}
@Module({imports:[VisualModule],controllers:[ExportsController]})
export class ExportsModule {}
