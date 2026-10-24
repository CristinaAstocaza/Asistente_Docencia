import { Document,Header,Footer,HeadingLevel,Packer,Paragraph,TextRun,Table,TableRow,TableCell,WidthType,PageOrientation,AlignmentType,TableLayoutType,PageNumber } from 'docx';
import PDFDocument from 'pdfkit';

const clean=(text:unknown)=>String(text??'').replace(/\*\*(.*?)\*\*/g,'$1').replace(/^#{1,6}\s+/gm,'').trim();
type Section={title:string;paragraphs?:string[];bullets?:string[]};
export function academicSections(data:any,kind:string):Section[]{
 if(kind==='activity')return [
  {title:'1. Logro a evaluar',paragraphs:[data.achievement]},
  {title:'2. Indicación general',paragraphs:[data.generalInstructions]},
  {title:'3. Indicaciones específicas',bullets:data.specificInstructions},
  ...(data.recommendations?.length?[{title:'4. Recomendaciones',bullets:data.recommendations}]:[]),
  {title:`${data.recommendations?.length?5:4}. Entrega`,bullets:data.submission},
  {title:`${data.recommendations?.length?6:5}. Criterios de evaluación`,paragraphs:[data.evaluation]},
 ];
 return (data.sections??[]).map((s:any,i:number)=>({title:`${i+1}. ${clean(s.title).replace(/^\d+[.)]\s*/,'')}`,paragraphs:[s.content]}));
}
export const citationText = (c: any) => {
 const cleanName = String(c.name || 'Documento de referencia').replace(/\.[a-zA-Z0-9]+$/, '').replace(/[-_]/g, ' ');
 const pagePart = c.page ? `, p. ${c.page}` : '';
 return `[${c.reference}] ${cleanName}${pagePart}.`;
};
function paragraph(text:unknown,options:{bold?:boolean;heading?:boolean;bullet?:boolean;center?:boolean;small?:boolean}={}){
 return new Paragraph({alignment:options.center?AlignmentType.CENTER:AlignmentType.LEFT,heading:options.heading?HeadingLevel.HEADING_2:undefined,keepNext:options.heading,bullet:options.bullet?{level:0}:undefined,spacing:{before:options.heading?220:0,after:140,line:276},children:clean(text).split('\n').flatMap((part,i)=>[...(i?[new TextRun({break:1})]:[]),new TextRun({text:part,font:'Arial',size:options.small?18:22,bold:options.bold??options.heading})])});
}
function document(children:(Paragraph|Table)[],landscape=false){
 return new Document({styles:{default:{document:{run:{font:'Arial',size:22},paragraph:{spacing:{line:276,after:140}}}}},sections:[{properties:{page:{size:{width:11906,height:16838,orientation:landscape?PageOrientation.LANDSCAPE:PageOrientation.PORTRAIT},margin:{top:900,bottom:900,left:900,right:900}}},headers:{default:new Header({children:[new Paragraph({text:'Material académico',alignment:AlignmentType.RIGHT,children:[new TextRun({text:'',size:16})]})]})},footers:{default:new Footer({children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({children:[PageNumber.CURRENT,' / ',PageNumber.TOTAL_PAGES],font:'Arial',size:18})]})]})},children}]});
}
const contextParagraphs=(data:any)=>(data.context??[]).map((s:any)=>paragraph(`${s.title}: ${s.content}`,{small:true}));
export async function renderAcademicDocx(data:any,kind:string,citations:any[]=[]){
 const children:Paragraph[]=[paragraph(data.title,{bold:true,center:true}),...contextParagraphs(data)];
 for(const section of academicSections(data,kind)){
  children.push(paragraph(section.title,{heading:true}));
  for(const text of section.paragraphs??[])for(const line of clean(text).split(/\n+/))children.push(paragraph(line));
  for(const text of section.bullets??[])children.push(paragraph(text,{bullet:true}));
 }
 if(citations.length)children.push(paragraph('Referencias bibliográficas',{heading:true}),...citations.map(c=>paragraph(citationText(c),{small:true})));
 return Packer.toBuffer(document(children));
}
export function rubricNames(data:any):string[]{return data.criteria[0]?.levels.map((l:any)=>l.name)??[];}
export async function renderAcademicRubricDocx(data:any,citations:any[]=[]){
 const names=rubricNames(data),widths=[1900,2350,...names.map(()=>2670)];
 const cell=(text:string,column:number,header=false)=>new TableCell({width:{size:widths[column],type:WidthType.DXA},margins:{top:100,bottom:100,left:100,right:100},shading:header?{fill:'D9D9D9'}:undefined,children:[paragraph(text,{bold:header,small:true,center:header})]});
 const rows=[new TableRow({tableHeader:true,cantSplit:true,children:['Criterio','Definición del criterio',...names].map((n,i)=>cell(n,i,true))})];
 for(const criterion of data.criteria){
  rows.push(new TableRow({children:[cell(`${criterion.name}${data.scoringMode!=='points'&&criterion.weight!==undefined?`\nPeso: ${criterion.weight} %`:''}`,0),cell(criterion.definition??criterion.name,1),...names.map((name,i)=>{const l=criterion.levels.find((l:any)=>l.name===name);return cell(`${l.description}\n\n${l.score} puntos`,i+2);})]}));
 }
 const legend=data.scoringMode==='points'?`Puntaje máximo: ${data.totalPoints} puntos.`:'Calificación ponderada: los pesos de los criterios suman 100 %.';
 return Packer.toBuffer(document([paragraph(data.title,{center:true,bold:true}),...contextParagraphs(data),paragraph(legend,{small:true}),new Table({width:{size:100,type:WidthType.PERCENTAGE},columnWidths:widths,layout:TableLayoutType.FIXED,rows}),...(citations.length?[paragraph('Fuentes consultadas',{heading:true}),...citations.map(c=>paragraph(citationText(c),{small:true}))]:[])],true));
}
function pdfBytes(landscape:boolean,render:(doc:PDFKit.PDFDocument)=>void):Promise<Buffer>{
 return new Promise((resolve,reject)=>{
  const doc=new PDFDocument({size:'A4',layout:landscape?'landscape':'portrait',margin:48,bufferPages:true});const chunks:Buffer[]=[];
  doc.on('data',b=>chunks.push(b));doc.on('error',reject);doc.on('end',()=>resolve(Buffer.concat(chunks)));
  try{render(doc);const range=doc.bufferedPageRange();for(let i=range.start;i<range.start+range.count;i++){doc.switchToPage(i);const bottom=doc.page.margins.bottom;doc.page.margins.bottom=0;doc.font('Helvetica').fontSize(8).fillColor('#666666').text(`${i+1} / ${range.count}`,48,doc.page.height-30,{width:doc.page.width-96,align:'center',lineBreak:false});doc.page.margins.bottom=bottom;}doc.end();}catch(error){doc.destroy();reject(error);}
 });
}
function pdfTitle(doc:PDFKit.PDFDocument,title:string){doc.font('Helvetica-Bold').fontSize(14).fillColor('#111111').text(clean(title),{align:'center'}).moveDown(1);}
function pdfContext(doc:PDFKit.PDFDocument,data:any){for(const s of data.context??[])doc.font('Helvetica').fontSize(9).fillColor('#333333').text(`${clean(s.title)}: ${clean(s.content)}`,{lineGap:3}).moveDown(.4);}
export function renderAcademicPdf(data:any,kind:string,citations:any[]=[]){
 return pdfBytes(false,doc=>{
  pdfTitle(doc,data.title);pdfContext(doc,data);
  const width=doc.page.width-96;
  for(const section of academicSections(data,kind)){
   if(doc.y>doc.page.height-130)doc.addPage();
   doc.moveDown(.6).font('Helvetica-Bold').fontSize(11).fillColor('#111111').text(section.title,{width}).moveDown(.5);
   for(const text of section.paragraphs??[])doc.font('Helvetica').fontSize(10.5).text(clean(text),{width,lineGap:5}).moveDown(.7);
   for(const text of section.bullets??[])doc.font('Helvetica').fontSize(10.5).text(`•  ${clean(text)}`,{width,lineGap:4}).moveDown(.5);
  }
  if(citations.length){doc.moveDown().font('Helvetica-Bold').fontSize(10).text('Referencias bibliográficas');for(const c of citations)doc.font('Helvetica').fontSize(8.5).text(citationText(c),{lineGap:3});}
 });
}
export function renderAcademicRubricPdf(data:any,citations:any[]=[]){
 return pdfBytes(true,doc=>{
  pdfTitle(doc,data.title);pdfContext(doc,data);
  doc.font('Helvetica').fontSize(9).text(data.scoringMode==='points'?`Puntaje máximo: ${data.totalPoints} puntos.`:'Los pesos de los criterios suman 100 %.').moveDown(.8);
  const names=rubricNames(data),totalWidth=doc.page.width-96,widths=[totalWidth*.14,totalWidth*.16,...names.map(()=>totalWidth*.175)];
  const headings=['Criterio','Definición del criterio',...names];let y=doc.y;
  const drawRow=(texts:string[],height:number,header=false)=>{
   let x=48;
   for(let i=0;i<texts.length;i++){
    doc.rect(x,y,widths[i],height).fillAndStroke(header?'#D9D9D9':'#FFFFFF','#555555');
    const score=!header&&i>=2?texts[i].match(/(?:\n\n|^)([\d.]+ puntos)$/):null;
    const body=score?texts[i].slice(0,score.index):texts[i];
    doc.fillColor('#111111').font(header?'Helvetica-Bold':'Helvetica').fontSize(header?9:8.5).text(body,x+7,y+7,{width:widths[i]-14,height:height-(score?38:14),lineGap:2,align:header?'center':'left'});
    if(score){doc.moveTo(x,y+height-24).lineTo(x+widths[i],y+height-24).stroke('#555555');doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#111111').text(score[1],x+7,y+height-18,{width:widths[i]-14,align:'center',lineBreak:false});}x+=widths[i];
   }y+=height;doc.y=y;doc.x=48;
  };
  const header=()=>{const height=Math.max(38,...headings.map((t,i)=>doc.font('Helvetica-Bold').fontSize(9).heightOfString(t,{width:widths[i]-14,lineGap:2})+14));drawRow(headings,height,true);};
  const nextPage=()=>{doc.addPage();pdfTitle(doc,`${data.title} (continuación)`);y=doc.y;header();};
  if(y>doc.page.height-160){doc.addPage();y=48;}header();
  // Split unusually long descriptors across pages; repeat the table header.
  for(const c of data.criteria){
   let remaining=[`${c.name}${data.scoringMode!=='points'&&c.weight!==undefined?`\nPeso: ${c.weight} %`:''}`,c.definition??c.name,...names.map(name=>{const l=c.levels.find((l:any)=>l.name===name);return `${l.description}\n\n${l.score} puntos`;})].map(clean);
   doc.font('Helvetica').fontSize(8.5);const fullHeight=Math.max(45,...remaining.map((t,i)=>doc.heightOfString(t,{width:widths[i]-14,lineGap:2})+14));
   if(fullHeight>doc.page.height-60-y&&fullHeight<doc.page.height-160)nextPage();
   while(remaining.some(Boolean)){
    if(y>doc.page.height-140)nextPage();
    const available=doc.page.height-60-y;
    const texts=remaining.map((text,i)=>{
     doc.font('Helvetica').fontSize(8.5);if(doc.heightOfString(text,{width:widths[i]-14,lineGap:2})<=available-14)return text;
     let low=0,high=text.length;while(low<high){const mid=Math.ceil((low+high)/2);if(doc.heightOfString(text.slice(0,mid),{width:widths[i]-14,lineGap:2})<=available-14)low=mid;else high=mid-1;}
     const space=text.lastIndexOf(' ',low);return text.slice(0,space>low*.7?space:Math.max(1,low));
    });
    const height=Math.max(45,...texts.map((t,i)=>doc.heightOfString(t,{width:widths[i]-14,lineGap:2})+14));
    drawRow(texts,height);remaining=remaining.map((text,i)=>text.slice(texts[i].length).trim());if(remaining.some(Boolean))nextPage();
   }
  }
  if(citations.length){if(y>doc.page.height-120)doc.addPage();doc.moveDown().font('Helvetica-Bold').fontSize(10).text('Fuentes consultadas');for(const c of citations)doc.font('Helvetica').fontSize(8.5).text(citationText(c));}
 });
}
