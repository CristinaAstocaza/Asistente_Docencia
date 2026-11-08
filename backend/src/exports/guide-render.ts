import { Document,Footer,Header,PageNumber,Packer,Paragraph,TextRun,HeadingLevel,Table,TableRow,TableCell,WidthType,ImageRun,AlignmentType } from 'docx';
import PDFDocument from 'pdfkit';
import { brandDocxHeader, stampPdfHeaders } from './brand';
import {loadImage} from '@napi-rs/canvas';
type Asset={bytes:Buffer;mime:string};
function runs(text:string){return String(text??'').split('\n').flatMap((line,index)=>line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part,i)=>new TextRun({text:part.replace(/^\*{1,2}|\*{1,2}$/g,''),bold:part.startsWith('**'),italics:part.startsWith('*')&&!part.startsWith('**'),break:index>0&&i===0?1:undefined})));}
export async function renderGuideDocx(data:any,assets:Map<string,Asset>,citations:any[]=[]){
 const children:(Paragraph|Table)[]=[new Paragraph({text:data.title,heading:HeadingLevel.TITLE}),...(data.objectives?.length?[new Paragraph({text:'Objetivos',heading:HeadingLevel.HEADING_1}),...data.objectives.map((text:string)=>new Paragraph({text,bullet:{level:0}}))]:[])];
 for(const b of data.blocks){
  if(b.type==='table'){const n=b.rows[0].length,ratios=Array.isArray(b.widths)&&b.widths.length===n?b.widths:Array(n).fill(1),total=ratios.reduce((x:number,y:number)=>x+y,0);children.push(new Table({width:{size:100,type:WidthType.PERCENTAGE},columnWidths:ratios.map((r:number)=>Math.round(9900*r/total)),rows:b.rows.map((row:string[],i:number)=>new TableRow({tableHeader:i===0,cantSplit:row.every(text=>text.length<1200),children:row.map((text,j)=>new TableCell({width:{size:Math.round(100*ratios[j]/total),type:WidthType.PERCENTAGE},children:[new Paragraph({children:runs(text)})]}))}))}));}
  else if(b.type==='image'){
   const asset=assets.get(b.assetId);if(asset){const image=await loadImage(asset.bytes),scale=Math.min(450*(b.width||100)/100/image.width,360/image.height);children.push(new Paragraph({alignment:AlignmentType.CENTER,children:[new ImageRun({data:asset.bytes,type:asset.mime==='image/png'?'png':'jpg',transformation:{width:image.width*scale,height:image.height*scale}})]}));}
   children.push(new Paragraph({text:b.caption||'Imagen educativa',alignment:AlignmentType.CENTER}));
  }else if(b.type==='diagram')for(const [i,text] of b.items.entries()){children.push(new Table({width:{size:100,type:WidthType.PERCENTAGE},rows:[new TableRow({cantSplit:true,children:[new TableCell({shading:{fill:'EEF2FF'},children:[new Paragraph({children:runs(`${i+1}. ${text}`),alignment:AlignmentType.CENTER})]})]})]}));if(i<b.items.length-1)children.push(new Paragraph({text:'↓',alignment:AlignmentType.CENTER,keepNext:true}));}
  else if(b.type==='list')for(const text of b.items)children.push(new Paragraph({children:runs(text),bullet:{level:0}}));
  else for(const line of b.text.split('\n'))children.push(new Paragraph({heading:b.type==='heading'?(b.level===2?HeadingLevel.HEADING_2:HeadingLevel.HEADING_1):undefined,keepNext:b.type==='heading',children:b.type==='code'?[new TextRun({text:line,font:'Courier New',size:18})]:runs(line),spacing:{after:140}}));
 }
 if(citations.length)children.push(new Paragraph({text:'Fuentes consultadas',heading:HeadingLevel.HEADING_1}),...citations.map(c=>new Paragraph({text:`[${c.reference}] ${c.name}${c.page?` — ${c.page}`:''}`})));
 return Packer.toBuffer(new Document({styles:{default:{document:{run:{font:'Arial',size:22}}}},sections:[{properties:{page:{margin:{top:1300,bottom:1000,left:1000,right:1000,header:500}}},headers:{default:brandDocxHeader(data.guideType||'Material académico')},footers:{default:new Footer({children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({children:[PageNumber.CURRENT,' / ',PageNumber.TOTAL_PAGES]})]})]})},children}]}));
}
export function renderGuidePdf(data:any,assets:Map<string,Asset>,citations:any[]=[]):Promise<Buffer>{return new Promise((resolve,reject)=>{
 const doc=new PDFDocument({size:'A4',margins:{top:58,bottom:48,left:48,right:48},bufferPages:true}),chunks:Buffer[]=[];doc.on('data',b=>chunks.push(b));doc.on('error',reject);doc.on('end',()=>resolve(Buffer.concat(chunks)));
 const width=doc.page.width-96,clean=(s:string)=>s.replace(/\*\*/g,'');
 const paragraph=(text:string,heading=false,code=false)=>{if(heading&&doc.y>doc.page.height-130)doc.addPage();doc.font(code?'Courier':heading?'Helvetica-Bold':'Helvetica').fontSize(heading?14:code?9:11).fillColor('#14213D').text(code?text:clean(text),48,doc.y,{width,lineGap:4}).moveDown(.6);};
 try{
  paragraph(data.title,true);if(data.objectives?.length){paragraph('Objetivos',true);for(const s of data.objectives)paragraph(`• ${s}`);}
  for(const b of data.blocks){
   if(b.type==='image'){
    const asset=assets.get(b.assetId);if(asset){if(doc.y>doc.page.height-340)doc.addPage();const y=doc.y;doc.image(asset.bytes,48,y,{fit:[width*(b.width||100)/100,260]});doc.y=y+270;}paragraph(b.caption||'Imagen educativa');
   }else if(b.type==='table'){
    const header=b.rows[0],n=header.length,bottom=doc.page.height-60;
    // Optional column proportions (e.g. the UNICA session sequence); otherwise equal columns.
    const ratios=Array.isArray(b.widths)&&b.widths.length===n?b.widths:Array(n).fill(1),total=ratios.reduce((x:number,y:number)=>x+y,0);
    const cw=ratios.map((r:number)=>width*r/total),cx=cw.map((_:number,i:number)=>48+cw.slice(0,i).reduce((x:number,y:number)=>x+y,0));
    const style=(head:boolean)=>doc.font(head?'Helvetica-Bold':'Helvetica').fontSize(9).fillColor('#14213D');
    const measure=(cells:string[],head:boolean)=>{style(head);return Math.max(28,...cells.map((c,i)=>doc.heightOfString(clean(String(c??'')),{width:cw[i]-12})+14));};
    const draw=(cells:string[],head:boolean)=>{
     const h=measure(cells,head);
     if(!head&&doc.y+h>bottom){doc.addPage();draw(header,true);}
     if(h>bottom-60){style(false);for(const [i,c] of cells.entries())paragraph(`${header[i]}: ${c}`);return;}
     const y=doc.y;style(head);
     cells.forEach((c,i)=>{doc.rect(cx[i],y,cw[i],h).stroke('#cbd5e1');style(head).text(clean(String(c??'')),cx[i]+6,y+7,{width:cw[i]-12});});
     doc.y=y+h;doc.x=48;
    };
    // The header never stays alone at the bottom of a page.
    if(doc.y+measure(header,true)+Math.min(b.rows[1]?measure(b.rows[1],false):0,160)>bottom)doc.addPage();
    b.rows.forEach((r:string[],i:number)=>draw(r,i===0));doc.moveDown();
   }else if(b.type==='diagram'){
    for(const [i,s] of b.items.entries()){const h=Math.max(38,doc.font('Helvetica').fontSize(11).heightOfString(s,{width:width-32})+24);if(doc.y+h>doc.page.height-60)doc.addPage();const y=doc.y;doc.roundedRect(48,y,width,h,6).fill('#eef2ff');doc.fillColor('#14213D').text(`${i+1}. ${s}`,60,y+10,{width:width-24});doc.y=y+h+10;}
   }else if(b.type==='list')for(const s of b.items)paragraph(`• ${s}`);
   else paragraph(b.text,b.type==='heading',b.type==='code');
  }
  if(citations.length){paragraph('Fuentes consultadas',true);for(const c of citations)paragraph(`[${c.reference}] ${c.name}${c.page?` — ${c.page}`:''}`);}
  stampPdfHeaders(doc,data.guideType||'Material académico');
  const pages=doc.bufferedPageRange();for(let i=0;i<pages.count;i++){doc.switchToPage(i);doc.font('Helvetica').fontSize(8).text(`${i+1} / ${pages.count}`,48,doc.page.height-30,{lineBreak:false});}doc.end();
 }catch(e){doc.destroy();reject(e);}
});}
