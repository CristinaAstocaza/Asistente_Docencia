import { Document, Footer, HeadingLevel, Packer, PageNumber, Paragraph, TextRun } from 'docx';
import PDFDocument from 'pdfkit';

type Block={text:string;kind:'paragraph'|'bullet'|'number'|'code'|'heading';number?:number};
const moments=[
 {title:'Cómo empezar',color:'2563EB',tint:'EFF6FF',parts:[['introduction','Abre la clase'],['motivation','Pregunta para conectar']]},
 {title:'Qué explicar',color:'7C3AED',tint:'F5F3FF',parts:[['development','Explica paso a paso'],['examples','Ejemplos para el aula']]},
 {title:'Qué harán los estudiantes',color:'B45309',tint:'FFFBEB',parts:[['activity','Actividad en el aula']]},
 {title:'Cómo cerrar',color:'047857',tint:'ECFDF5',parts:[['closing','Cierra con una síntesis'],['questions','Comprueba si comprendieron']]},
];
function readable(text:string) {
 return text.split(/(```[\s\S]*?```|`[^`\n]+`)/g).map((part,i)=>i%2?part:part.replace(/\s+(?=\d{1,2}\.\s+[A-ZÁÉÍÓÚÑ])/g,'\n\n').replace(/\s+(?=Materiales necesarios:)/g,'\n\n')).join('');
}
export function lessonBlocks(value:unknown):Block[] {
 const result:Block[]=[];
 for(const [index,item] of (Array.isArray(value)?value:[value]).entries()){
  if(typeof item!=='string')continue;
  let code=false,first=true;
  for(const line of readable(item).split('\n')){
   if(line.trim().startsWith('```')){code=!code;continue;}
   if(code){result.push({text:line,kind:'code'});continue;}
   const text=line.trim();if(!text)continue;
   const numbered=text.match(/^(\d+)\.\s+(.+)/),bullet=text.match(/^[-*•]\s+(.+)/),heading=text.match(/^#{1,6}\s+(.+)/);
   result.push(numbered?{text:numbered[2],kind:'number',number:Number(numbered[1])}:bullet?{text:bullet[1],kind:'bullet'}:heading?{text:heading[1],kind:'heading'}:first&&Array.isArray(value)?{text,kind:'number',number:index+1}:{text,kind:'paragraph'});first=false;
  }
 }
 return result;
}
function runs(text:string):TextRun[]{
 return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean).map(part=>new TextRun({text:part.startsWith('**')?part.slice(2,-2):part.startsWith('`')?part.slice(1,-1):part,bold:part.startsWith('**'),font:part.startsWith('`')?'Consolas':'Calibri'}));
}
const citation=(c:any)=>`[${c.reference}] ${c.name}${c.page?` — página/diapositiva ${c.page}`:''}`;
export async function renderLessonDocx(data:any,citations:any[]=[]){
 const children:Paragraph[]=[];
 const body=(value:unknown)=>{for(const b of lessonBlocks(value))children.push(new Paragraph({children:b.kind==='code'?[new TextRun({text:b.text,font:'Consolas',size:19})]:runs((b.kind==='number'?`${b.number}. `:'')+b.text),bullet:b.kind==='bullet'?{level:0}:undefined,heading:b.kind==='heading'?HeadingLevel.HEADING_3:undefined,shading:b.kind==='code'?{fill:'F1F5F9'}:undefined,indent:['number','code'].includes(b.kind)?{left:240}:undefined,spacing:{after:b.kind==='code'?20:140,line:300}}));};
 children.push(new Paragraph({spacing:{after:140},children:[new TextRun({text:'GUÍA PARA LA CLASE DEL DÍA',color:'2563EB',size:20,bold:true})]}));
 children.push(new Paragraph({heading:HeadingLevel.TITLE,children:[new TextRun({text:data.title,color:'14213D',size:38,bold:true})],spacing:{after:300},keepNext:true}));
 children.push(new Paragraph({text:'Qué aprenderán hoy',heading:HeadingLevel.HEADING_1,shading:{fill:'EFF6FF'},spacing:{before:120,after:160},keepNext:true}));body(data.objective);
 children.push(new Paragraph({children:[new TextRun({text:'Los tiempos sugeridos son orientativos: ajústalos al ritmo de tu aula.',italics:true,color:'64748B',size:20})],spacing:{after:240}}));
 for(const [i,m] of moments.entries()){
  children.push(new Paragraph({heading:HeadingLevel.HEADING_1,children:[new TextRun({text:`${i+1}. ${m.title}`,color:m.color,bold:true,size:28})],shading:{fill:m.tint},spacing:{before:260,after:180},keepNext:true}));
  for(const [key,label] of m.parts){children.push(new Paragraph({heading:HeadingLevel.HEADING_2,children:[new TextRun({text:label,color:'334155',bold:true,size:23})],spacing:{before:160,after:120},keepNext:true}));body(data[key]);}
 }
 if(citations.length){children.push(new Paragraph({text:'Fuentes consultadas',heading:HeadingLevel.HEADING_1,keepNext:true}));citations.forEach(c=>body(citation(c)));}
 return Packer.toBuffer(new Document({styles:{default:{document:{run:{font:'Calibri',size:22,color:'334155'},paragraph:{spacing:{line:300,after:140}}}}},sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:1000,bottom:1000,left:1100,right:1100}}},footers:{default:new Footer({children:[new Paragraph({alignment:'center',children:[new TextRun({text:'Clase del día · ',color:'64748B',size:18}),new TextRun({children:[PageNumber.CURRENT],color:'64748B',size:18})]})]})},children}]}));
}
const plain=(text:string)=>text.replace(/\*\*([^*]+)\*\*/g,'$1').replace(/`([^`]+)`/g,'$1');
export function renderLessonPdf(data:any,citations:any[]=[]):Promise<Buffer>{
 return new Promise((resolve,reject)=>{
  const doc=new PDFDocument({size:'A4',margin:48,bufferPages:true});const chunks:Buffer[]=[];
  doc.on('data',b=>chunks.push(b));doc.on('error',reject);doc.on('end',()=>resolve(Buffer.concat(chunks)));
  const width=doc.page.width-96;
  const space=(height:number)=>{if(doc.y+height>doc.page.height-55)doc.addPage();};
  const heading=(text:string,color:string,tint?:string,reserve=45)=>{
   doc.font('Helvetica-Bold').fontSize(tint?14:11);const height=doc.heightOfString(text,{width:width-24})+20;space(height+reserve);
   const y=doc.y;if(tint)doc.roundedRect(48,y,width,height,6).fill('#'+tint);
   doc.fillColor('#'+color).text(text,60,y+10,{width:width-24});doc.x=48;doc.y=y+height+12;
  };
  const body=(value:unknown)=>{for(const b of lessonBlocks(value)){
   doc.font(b.kind==='code'?'Courier':b.kind==='heading'?'Helvetica-Bold':'Helvetica').fontSize(b.kind==='code'?9:10.5).fillColor('#334155');
   const prefix=b.kind==='number'?`${b.number}. `:b.kind==='bullet'?'•  ':'';const text=prefix+(b.kind==='code'?b.text:plain(b.text));
   const indent=b.kind==='code'?12:0;const height=doc.heightOfString(text||' ',{width:width-indent,lineGap:4});
   space(Math.min(height+10,doc.page.height-110));
   if(b.kind==='code'&&height<doc.page.height-110)doc.rect(48,doc.y-2,width,height+5).fill('#F1F5F9').fillColor('#334155');
   doc.text(text||' ',48+indent,doc.y,{width:width-indent,lineGap:4});doc.x=48;doc.moveDown(b.kind==='code'?.15:.65);
  }};
  try{
   doc.font('Helvetica-Bold').fontSize(9).fillColor('#2563EB').text('GUÍA PARA LA CLASE DEL DÍA').moveDown(1);
   doc.fontSize(22).fillColor('#14213D').text(data.title,{width,lineGap:4}).moveDown(.8);
   heading('Qué aprenderán hoy','1E40AF','EFF6FF');body(data.objective);
   doc.font('Helvetica-Oblique').fontSize(9).fillColor('#64748B').text('Los tiempos sugeridos son orientativos: ajústalos al ritmo de tu aula.',{width}).moveDown(1);
   for(const [i,m] of moments.entries()){heading(`${i+1}. ${m.title}`,m.color,m.tint,140);for(const [key,label] of m.parts){heading(label,'334155');body(data[key]);}}
   if(citations.length){heading('Fuentes consultadas','334155');citations.forEach(c=>body(citation(c)));}
   const range=doc.bufferedPageRange();for(let i=range.start;i<range.start+range.count;i++){doc.switchToPage(i);doc.page.margins.bottom=0;doc.font('Helvetica').fontSize(8).fillColor('#64748B').text(`Clase del día · ${i+1} / ${range.count}`,48,doc.page.height-30,{width,align:'center',lineBreak:false});}
   doc.end();
  }catch(error){doc.destroy();reject(error);}
 });
}
