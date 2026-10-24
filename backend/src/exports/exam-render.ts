import PDFDocument from 'pdfkit';
type ExamQuestion={type:string;question:string;options?:string[];correctAnswer?:string;explanation?:string;subquestions?:{question:string;correctAnswer:string}[]};
type ExamData={title:string;duration?:number;instructions?:string;questions:ExamQuestion[]};
const clean=(value:string)=>value.replace(/\*\*([^*]+)\*\*/g,'$1').replace(/`([^`]+)`/g,'$1').replace(/^#{1,6}\s+/gm,'').trim();
export function renderExamPdf(data:ExamData,answerKey=false):Promise<Buffer>{
 return new Promise((resolve,reject)=>{
  const doc=new PDFDocument({size:'A4',margins:{top:48,left:48,right:48,bottom:64},bufferPages:true});const chunks:Buffer[]=[];const width=doc.page.width-96;
  doc.on('data',b=>chunks.push(b));doc.on('error',reject);doc.on('end',()=>resolve(Buffer.concat(chunks)));
  const bottom=()=>doc.page.height-64;
  const normal=()=>doc.font('Helvetica').fontSize(10.5).fillColor('#334155');
  const height=(text:string,bold=false,inset=0)=>doc.font(bold?'Helvetica-Bold':'Helvetica').fontSize(10.5).heightOfString(text,{width:width-inset,lineGap:4});
  const ensure=(needed:number)=>{if(doc.y+needed>bottom()&&doc.y>80)doc.addPage();};
  doc.on('pageAdded',()=>{doc.font('Helvetica').fontSize(8).fillColor('#64748B').text(clean(data.title).slice(0,85),48,36,{width,lineBreak:false});doc.moveTo(48,54).lineTo(48+width,54).strokeColor('#CBD5E1').stroke();doc.x=48;doc.y=76;normal();});
  const paragraph=(text:string,bold=false,inset=0)=>{const content=clean(text);ensure(Math.min(height(content,bold,inset)+10,100));doc.font(bold?'Helvetica-Bold':'Helvetica').fontSize(10.5).fillColor('#334155').text(content,48+inset,doc.y,{width:width-inset,lineGap:4});doc.x=48;doc.moveDown(.45);};
  const field=(label:string,x:number,y:number,end:number)=>{doc.font('Helvetica').fontSize(9).fillColor('#475569').text(label,x,y,{lineBreak:false});const start=x+doc.widthOfString(label)+8;doc.moveTo(start,y+12).lineTo(end,y+12).strokeColor('#94A3B8').lineWidth(.6).stroke();};
  try{
   doc.font('Helvetica-Bold').fontSize(9).fillColor('#2563EB').text(answerKey?'GUÍA DEL DOCENTE':'EVALUACIÓN ESCRITA').moveDown(.8);
   doc.fontSize(20).fillColor('#14213D').text(clean(data.title),{width,lineGap:3}).moveDown(.8);
   {const y=doc.y;field('Estudiante:',48,y,48+width*.69);field('Fecha:',48+width*.73,y,48+width);field('Curso / sección:',48,y+25,48+width);doc.x=48;doc.y=y+52;}
   normal();doc.fontSize(9).text([data.duration?`Tiempo: ${data.duration} minutos`:null,`${data.questions.length} preguntas`].filter(Boolean).join('    |    '),{width}).moveDown(1);
   paragraph('Instrucciones',true);paragraph(data.instructions||'Lee cada pregunta. Marca la alternativa correcta o desarrolla tu respuesta en el espacio indicado.');
   ensure(65);const bannerY=doc.y;doc.rect(48,bannerY,width,28).fill('#EFF6FF');doc.font('Helvetica-Bold').fontSize(11).fillColor('#1E40AF').text('Preguntas',60,bannerY+8,{width:width-24});doc.x=48;doc.y=bannerY+44;
   for(const [i,q] of data.questions.entries()){
    const options=q.type==='true_false'?['Verdadero','Falso']:q.type==='multiple_choice'?q.options??[]:[];
    const stem=`${i+1}. ${clean(q.question)}`;
    const lines=q.type==='development'?5:q.type==='short_answer'?2:0;
    const estimate=height(stem,true)+12+options.reduce((sum,option)=>sum+height(option,false,34)+9,0)+lines*25+20;
    ensure(estimate<doc.page.height-150?estimate:Math.min(height(stem,true)+45,120));
    paragraph(stem,true);
    for(const [index,option] of options.entries()){
     const content=clean(option);const optionHeight=height(content,false,34);ensure(Math.min(optionHeight+10,100));const optionY=doc.y;
     doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#475569').text(`${String.fromCharCode(65+index)})`,58,optionY,{width:24,lineBreak:false});
     normal();doc.text(content,82,optionY,{width:width-34,lineGap:4});doc.x=48;doc.moveDown(.5);
    }
    for(const [index,sub] of (q.subquestions??[]).entries()){
     ensure(Math.min(height(sub.question,false,10)+90,160));
     paragraph(`${String.fromCharCode(97+index)}) ${sub.question}`,false,10);
     if(answerKey)paragraph(`Respuesta: ${sub.correctAnswer}`,true,20);
     else for(let line=0;line<3;line++){ensure(25);const lineY=doc.y+18;doc.moveTo(58,lineY).lineTo(48+width,lineY).strokeColor('#CBD5E1').lineWidth(.5).stroke();doc.y+=25;doc.x=48;}
    }
    if(lines){doc.moveDown(.25);for(let line=0;line<lines;line++){ensure(25);const lineY=doc.y+18;doc.moveTo(58,lineY).lineTo(48+width,lineY).strokeColor('#CBD5E1').lineWidth(.5).stroke();doc.y+=25;doc.x=48;}}
    if(answerKey){paragraph(`Respuesta: ${q.correctAnswer??''}`,true,10);if(q.explanation)paragraph(q.explanation,false,10);}
    doc.moveDown(.7);
   }
   const range=doc.bufferedPageRange();for(let i=range.start;i<range.start+range.count;i++){doc.switchToPage(i);doc.page.margins.bottom=0;doc.moveTo(48,doc.page.height-43).lineTo(48+width,doc.page.height-43).strokeColor('#E2E8F0').stroke();doc.font('Helvetica').fontSize(8).fillColor('#64748B').text(`Evaluación · Página ${i+1} de ${range.count}`,48,doc.page.height-30,{width,align:'center',lineBreak:false});}
   doc.end();
  }catch(error){doc.destroy();reject(error);}
 });
}
