import PDFDocument from 'pdfkit';
import {Document,Packer,Paragraph,TextRun,Table,TableRow,TableCell,WidthType,HeadingLevel,Header,Footer,PageNumber,AlignmentType,SectionType,ImageRun,BorderStyle} from 'docx';
import {loadImage} from '@napi-rs/canvas';
import {BadRequestException} from '@nestjs/common';
import {dirname,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {cleanGuideBlocks} from '../common/guide-content';
function publicationDoc(options:PDFKit.PDFDocumentOptions){const doc=new PDFDocument(options),fonts=join(dirname(require.resolve('pdfjs-dist/package.json')),'standard_fonts');doc.registerFont('GuideSans',join(fonts,'LiberationSans-Regular.ttf'));doc.registerFont('GuideSans-Bold',join(fonts,'LiberationSans-Bold.ttf'));return doc;}
export const defaultGuideDesign={accentColor:'#4361EE',fontStyle:'sans',density:'standard',coverStyle:'modern'};
const W=595.28,H=841.89,X=48,BOTTOM=754,WIDTH=W-2*X;
const plain=(s:unknown)=>String(s??'').replace(/\*\*([^*]+)\*\*/g,'$1').replace(/\*([^*]+)\*/g,'$1');
export function guidePages(data:any){
 data={...data,blocks:cleanGuideBlocks(data.blocks).filter(b=>!['heading','paragraph','code'].includes(b.type)||b.text.trim())};
 if(data.publication)return data.publication.pageTitles.map((title:string,i:number)=>({title,blocks:data.blocks.filter((b:any)=>(b.page||data.publication.pageCount)===i+2)}));
 // Legacy documents keep their content; split at measured capacity, never pad them to a requested length.
 const doc=publicationDoc({size:'A4'}),pages:any[]=[];let blocks:any[]=[],height=0;
 for(const b of data.blocks){const size=blockHeight(doc,b,10.5);if(height+size>600&&blocks.length){pages.push({title:'Contenido de la guía',blocks});blocks=[];height=0;}blocks.push(b);height+=size;}
 if(blocks.length)pages.push({title:'Contenido de la guía',blocks});doc.end();return pages;
}
function font(doc:PDFKit.PDFDocument,bold=false,serif=false){return doc.font(serif?(bold?'Times-Bold':'Times-Roman'):(bold?'GuideSans-Bold':'GuideSans'));}
function textHeight(doc:PDFKit.PDFDocument,text:string,size:number,width=WIDTH,bold=false,code=false){doc.font(code?'Courier':bold?'GuideSans-Bold':'GuideSans').fontSize(size);return doc.heightOfString(code?text:plain(text),{width,lineGap:code?1:3});}
function blockHeight(doc:PDFKit.PDFDocument,b:any,size:number):number{
 if(b.type==='heading')return textHeight(doc,b.text,size+2,WIDTH,true)+15;
 if(b.type==='paragraph')return textHeight(doc,b.text,size)+10;
 if(b.type==='code')return textHeight(doc,b.text,Math.max(8,size-1.8),WIDTH-28,false,true)+36+(b.filePath?textHeight(doc,b.filePath,8,WIDTH-28)+4:0);
 if(b.type==='list')return (b.items||[]).reduce((h:number,s:string)=>h+textHeight(doc,'• '+s,size,WIDTH-12)+5,0)+6;
 if(b.type==='table'){const cw=WIDTH/b.rows[0].length;return b.rows.reduce((h:number,r:string[],i:number)=>h+Math.max(25,...r.map(s=>textHeight(doc,s,Math.max(8,size-1),cw-16,i===0)+16)),0)+12;}
 if(b.type==='diagram')return (b.items||[]).reduce((h:number,s:string)=>h+Math.max(32,textHeight(doc,s,size,WIDTH-52)+16)+10,0)+4;
 if(b.type==='image')return 240+8+textHeight(doc,b.caption||'',8,WIDTH)+12;return 0;
}
function pageSize(doc:PDFKit.PDFDocument,title:string,blocks:any[],citations:any[]=[]){
 for(const size of [10.5,10,9.5,9]){
  const heading=textHeight(doc,title,20,WIDTH,true)+24;
  const refs=citations.length?35+citations.reduce((h,c)=>h+textHeight(doc,`[${c.reference}] ${c.name}`,8,WIDTH)+5,0):0;
  if(112+heading+blocks.reduce((h,b)=>h+blockHeight(doc,b,size),0)+refs<=BOTTOM)return size;
 }return null;
}
export function guidePageFits(title:string,blocks:any[],citations:any[]=[]){const doc=publicationDoc({size:'A4'});const result=pageSize(doc,title,blocks,citations)!==null;doc.end();return result;}
// Keep valid content when a chapter exceeds a page instead of asking the model to discard it.
export function paginateGuideChapter(title:string,blocks:any[],citations:any[]=[]):{title:string;blocks:any[]}[]{
 const pages:{title:string;blocks:any[]}[]=[],pending=[...blocks];let current:any[]=[];
 const pageTitle=()=>pages.length?`${title} (continuación)`:title;
 const flush=()=>{pages.push({title:pageTitle(),blocks:current});current=[];};
 while(pending.length){
  const block=pending.shift()!;
  if(guidePageFits(pageTitle(),[...current,block])){current.push(block);continue;}
  if(current.length){flush();pending.unshift(block);continue;}
  let parts:any[]=[];
  if(block.items?.length>1){const mid=Math.ceil(block.items.length/2);parts=[{...block,items:block.items.slice(0,mid)},{...block,items:block.items.slice(mid)}];}
  else if(block.type==='table'&&block.rows.length>2){const mid=Math.ceil(block.rows.length/2);parts=[{...block,rows:block.rows.slice(0,mid)},{...block,rows:[block.rows[0],...block.rows.slice(mid)]}];}
  else if(block.type==='table'){parts=block.rows.map((row:string[])=>({type:'paragraph',text:row.join(' · ')}));}
  else {
   const text=block.text||block.items?.[0]||'';
   const separator=block.type==='code'?'\n':' ';
   const tokens=text.split(block.type==='code'?/\n/:/\s+/);
   if(tokens.length>1){const mid=Math.ceil(tokens.length/2);parts=[tokens.slice(0,mid),tokens.slice(mid)].map(part=>block.items?{...block,items:[part.join(separator)]}:{...block,text:part.join(separator)});}
  }
  if(!parts.length)throw new BadRequestException('Un bloque del documento no se puede distribuir en una página.');
  pending.unshift(...parts.map(part=>({...part,id:randomUUID()})));
 }
 if(current.length)flush();
 if(citations.length&&pages.length){
  const last=pages[pages.length-1];
  if(!guidePageFits(last.title,last.blocks,citations)){
   const refsTitle='Fuentes consultadas';
   if(!guidePageFits(refsTitle,[],citations))throw new BadRequestException('Las referencias superan una página. Reduce las fuentes seleccionadas.');
   pages.push({title:refsTitle,blocks:[]});
  }
 }
 return pages;
}
function header(doc:PDFKit.PDFDocument,data:any,index:number,total:number){
 const accent=data.publication?.design?.accentColor||defaultGuideDesign.accentColor;
 doc.rect(0,0,W,6).fill(accent);doc.font('GuideSans').fontSize(8).fillColor('#64748B').text(plain(data.guideType).toUpperCase(),X,30,{width:WIDTH-90,lineBreak:false});
 doc.font('GuideSans').fontSize(8).text(`${String(index+1).padStart(2,'0')} / ${total}`,W-X-70,30,{width:70,align:'right',lineBreak:false});doc.moveTo(X,51).lineTo(W-X,51).strokeColor('#E2E8F0').stroke();doc.y=72;doc.x=X;
}
function footer(doc:PDFKit.PDFDocument,data:any,index:number,total:number){
 const margin=doc.page.margins.bottom;doc.page.margins.bottom=0;doc.font('GuideSans').fontSize(8).fillColor('#64748B').text(plain(data.publication?.course||data.guideType).slice(0,100),X,H-38,{width:WIDTH-70,lineBreak:false});doc.text(`${index+1} / ${total}`,W-X-60,H-38,{width:60,align:'right',lineBreak:false});doc.page.margins.bottom=margin;
}
function cover(doc:PDFKit.PDFDocument,data:any,total:number){
 const p=data.publication||{},accent=p.design?.accentColor||defaultGuideDesign.accentColor;
 doc.rect(0,0,W,300).fill('#14213D');doc.rect(0,0,12,H).fill(accent);doc.circle(W-30,60,100).fillOpacity(.17).fill(accent).fillOpacity(1);doc.circle(W-50,260,45).fillOpacity(.14).fill('#FFFFFF').fillOpacity(1);
 doc.font('GuideSans-Bold').fontSize(10).fillColor('#A5B4FC').text(plain(data.guideType).toUpperCase(),48,48,{width:WIDTH-100});
 let titleSize=30;while(titleSize>20&&textHeight(doc,data.title,titleSize,WIDTH-20,true)>150)titleSize--;
 doc.font('GuideSans-Bold').fontSize(titleSize).fillColor('#FFFFFF').text(plain(data.title),48,98,{width:WIDTH-20,lineGap:4});
 doc.font('GuideSans').fontSize(12).fillColor('#C7D2FE').text(p.course||'Material de aprendizaje',48,252,{width:WIDTH});
 doc.rect(48,330,40,4).fill(accent);doc.font('GuideSans-Bold').fontSize(16).fillColor('#14213D').text('Ruta de aprendizaje',48,354);
 doc.font('GuideSans').fontSize(10.5).fillColor('#334155');for(const objective of data.objectives.slice(0,5))doc.text('• '+plain(objective),48,doc.y+10,{width:WIDTH,lineGap:3});
 const meta=[p.career,p.duration?`Duración: ${p.duration} minutos`:'',p.teacher,p.institution].filter(Boolean).join('\n');doc.font('GuideSans').fontSize(10).fillColor('#64748B').text(meta,48,660,{width:WIDTH,lineGap:4});footer(doc,data,0,total);
}
type Asset={bytes:Buffer;mime:string};
export function renderPublishedGuidePdf(data:any,assets:Map<string,Asset>,citations:any[]=[]):Promise<Buffer>{return new Promise((resolve,reject)=>{
 const pages=guidePages(data),total=pages.length+1,doc=publicationDoc({size:'A4',margin:X,autoFirstPage:false}),pieces:Buffer[]=[];
 doc.on('data',b=>pieces.push(b));doc.on('end',()=>resolve(Buffer.concat(pieces)));doc.on('error',reject);
 try{
  doc.addPage();cover(doc,data,total);
  for(let i=0;i<pages.length;i++){
   const page=pages[i],refs=i===pages.length-1?citations:[],size=pageSize(doc,page.title,page.blocks,refs);
   if(size===null)throw new BadRequestException(`El apartado «${page.title}» supera el espacio de una página. Regenera la guía para ajustar su extensión.`);
   doc.addPage();header(doc,data,i+1,total);const accent=data.publication?.design?.accentColor||defaultGuideDesign.accentColor;
   font(doc,true).fontSize(9).fillColor(accent).text(`APARTADO ${String(i+1).padStart(2,'0')}`,X,72);font(doc,true).fontSize(20).fillColor('#14213D').text(page.title,X,91,{width:WIDTH,lineGap:3});doc.y+=16;
   for(const b of page.blocks){
    const y=doc.y;
    if(b.type==='code'){
     const h=blockHeight(doc,b,size),pathHeight=b.filePath?textHeight(doc,b.filePath,8,WIDTH-28)+4:0;doc.roundedRect(X,y,WIDTH,h-8,7).fill('#14213D');doc.font('GuideSans').fontSize(7).fillColor('#A5B4FC').text((b.language||'código').toUpperCase(),X+14,y+8,{width:WIDTH-28});if(b.filePath)doc.font('GuideSans').fontSize(8).fillColor('#C7D2FE').text(b.filePath,X+14,y+22,{width:WIDTH-28,lineGap:3});doc.font('Courier').fontSize(Math.max(8,size-1.8)).fillColor('#F1F5F9').text(b.text,X+14,y+22+pathHeight,{width:WIDTH-28,lineGap:1});doc.y=y+h;
    }else if(b.type==='table'){
     const cw=WIDTH/b.rows[0].length;let ry=y;
     b.rows.forEach((row:string[],ri:number)=>{const h=Math.max(25,...row.map(s=>textHeight(doc,s,Math.max(8,size-1),cw-16,ri===0)+16));row.forEach((s,j)=>{doc.rect(X+j*cw,ry,cw,h).fillAndStroke(ri===0?'#EEF2FF':ri%2?'#FFFFFF':'#F8FAFC','#E2E8F0');font(doc,ri===0).fontSize(Math.max(8,size-1)).fillColor('#1F2937').text(plain(s),X+j*cw+8,ry+8,{width:cw-16,lineGap:3});});ry+=h;});doc.y=ry+12;
    }else if(b.type==='diagram'){
     let ry=y;for(const [n,s] of b.items.entries()){const h=Math.max(32,textHeight(doc,s,size,WIDTH-52)+16);doc.roundedRect(X,ry,WIDTH,h,6).fill('#EEF2FF');doc.circle(X+17,ry+h/2,10).fill(accent);doc.font('GuideSans-Bold').fontSize(8).fillColor('#FFFFFF').text(String(n+1),X+11,ry+h/2-4,{width:12,align:'center'});font(doc).fontSize(size).fillColor('#14213D').text(plain(s),X+36,ry+8,{width:WIDTH-52,lineGap:3});ry+=h+10;}doc.y=ry+4;
    }else if(b.type==='image'){
     const h=blockHeight(doc,b,size),asset=assets.get(b.assetId);if(asset)doc.image(asset.bytes,X,y,{fit:[WIDTH,240],align:'center'});doc.font('GuideSans').fontSize(8).fillColor('#64748B').text(plain(b.caption),X,y+248,{width:WIDTH,lineGap:3});doc.y=y+h;
    }else if(b.type==='list'){
     for(const s of b.items){font(doc).fontSize(size).fillColor('#334155').text((/^\s*\d+[.)]\s/.test(s)?'':'• ')+plain(s),X+6,doc.y,{width:WIDTH-12,lineGap:3});doc.y+=5;}doc.y+=6;
    }else{font(doc,b.type==='heading',data.publication?.design?.fontStyle==='serif').fontSize(b.type==='heading'?size+2:size).fillColor(b.type==='heading'?'#14213D':'#334155').text(plain(b.text),X,y,{width:WIDTH,lineGap:3});doc.y+=b.type==='heading'?15:10;}
    doc.x=X;
   }
   if(refs.length){font(doc,true).fontSize(10).fillColor('#14213D').text('Fuentes consultadas',X,doc.y+10);for(const c of refs)font(doc).fontSize(8).fillColor('#64748B').text(`[${c.reference}] ${c.name}${c.page?` — página ${c.page}`:''}`,X,doc.y+5,{width:WIDTH});}
   if(doc.y>BOTTOM+5)throw new BadRequestException('El contenido desborda su página. Regenera la guía para ajustar la maquetación.');footer(doc,data,i+1,total);
  }
  doc.end();
 }catch(e){doc.destroy();reject(e);}
});}
const wordRuns=(s:string,opts:any={})=>s.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map(t=>new TextRun({...opts,text:plain(t),bold:t.startsWith('**'),italics:t.startsWith('*')&&!t.startsWith('**')}));
export async function renderPublishedGuideDocx(data:any,assets:Map<string,Asset>,citations:any[]=[]){
 const pages=guidePages(data),accent=(data.publication?.design?.accentColor||defaultGuideDesign.accentColor).slice(1),family=data.publication?.design?.fontStyle==='serif'?'Georgia':'Arial';
 const para=(text:string,heading=false)=>new Paragraph({heading:heading?HeadingLevel.HEADING_2:undefined,keepNext:heading,spacing:{after:100,line:260},children:wordRuns(text,{font:family,size:20,color:heading?'14213D':'334155'})});
 const coverChildren:any[]=[new Table({width:{size:100,type:WidthType.PERCENTAGE},rows:[new TableRow({children:[new TableCell({shading:{fill:'14213D'},margins:{top:400,bottom:400,left:260,right:260},children:[new Paragraph({children:[new TextRun({text:data.guideType.toUpperCase(),color:'A5B4FC',bold:true,size:22})],spacing:{after:280}}),new Paragraph({children:[new TextRun({text:plain(data.title),bold:true,color:'FFFFFF',size:54,font:'Arial'})],spacing:{after:280}}),new Paragraph({children:[new TextRun({text:data.publication?.course||'Material de aprendizaje',color:'C7D2FE',size:24})]})]})]})]}),new Paragraph({text:'Ruta de aprendizaje',heading:HeadingLevel.HEADING_1,spacing:{before:500,after:240}}),...data.objectives.map((s:string)=>new Paragraph({children:wordRuns(s,{size:22}),bullet:{level:0},spacing:{after:180}})),para([data.publication?.career,data.publication?.teacher,data.publication?.institution].filter(Boolean).join(' · '))];
 const sections:any[]=[];const makeSection=(children:any[],cover=false)=>({properties:{type:SectionType.NEXT_PAGE,page:{size:{width:11906,height:16838},margin:{top:900,bottom:900,left:960,right:960}}},headers:{default:new Header({children:[new Paragraph({border:{bottom:{style:BorderStyle.SINGLE,color:accent,size:14,space:8}},children:[new TextRun({text:cover?'':data.guideType.toUpperCase(),size:16,color:accent})]})]})},footers:{default:new Footer({children:[new Paragraph({alignment:AlignmentType.RIGHT,children:[new TextRun({children:[PageNumber.CURRENT,' / ',PageNumber.TOTAL_PAGES],size:16,color:'64748B'})]})]})},children});
 sections.push(makeSection(coverChildren,true));
 for(const [i,page] of pages.entries()){
  const children:any[]=[new Paragraph({children:[new TextRun({text:`APARTADO ${String(i+1).padStart(2,'0')}`,size:18,bold:true,color:accent})],spacing:{after:180}}),new Paragraph({heading:HeadingLevel.HEADING_1,children:[new TextRun({text:page.title,font:family,size:36,bold:true,color:'14213D'})],spacing:{after:260}})];
  for(const b of page.blocks){
   if(b.type==='table'||b.type==='diagram'){
    const rows=b.type==='table'?b.rows:b.items.map((s:string,n:number)=>[`${n+1}. ${s}`]);children.push(new Table({width:{size:100,type:WidthType.PERCENTAGE},rows:rows.map((r:string[],ri:number)=>new TableRow({tableHeader:b.type==='table'&&ri===0,cantSplit:true,children:r.map(s=>new TableCell({shading:{fill:ri===0||b.type==='diagram'?'EEF2FF':ri%2?'FFFFFF':'F8FAFC'},margins:{top:90,bottom:90,left:90,right:90},children:[para(s)]}))}))}));children.push(new Paragraph({spacing:{after:80}}));
   }else if(b.type==='code'){
    if(b.filePath)children.push(para(b.filePath,true));
    for(const line of b.text.split('\n'))children.push(new Paragraph({shading:{fill:'F1F5F9'},spacing:{after:0,line:200},children:[new TextRun({text:line,font:'Courier New',size:17,color:'14213D'})]}));
   }
   else if(b.type==='list')for(const s of b.items)children.push(new Paragraph({bullet:/^\s*\d+[.)]\s/.test(s)?undefined:{level:0},children:wordRuns(s,{font:family,size:20}),spacing:{after:80,line:260}}));
   else if(b.type==='image'){const a=assets.get(b.assetId);if(a){const image=await loadImage(a.bytes),scale=Math.min(450/image.width,230/image.height);children.push(new Paragraph({alignment:AlignmentType.CENTER,children:[new ImageRun({type:a.mime==='image/png'?'png':'jpg',data:a.bytes,transformation:{width:image.width*scale,height:image.height*scale}})]}));children.push(para(b.caption||''));}}
   else children.push(para(b.text,b.type==='heading'));
  }
  if(i===pages.length-1&&citations.length)children.push(para('Fuentes consultadas',true),...citations.map(c=>para(`[${c.reference}] ${c.name}${c.page?` — ${c.page}`:''}`)));
  sections.push(makeSection(children));
 }
 return Packer.toBuffer(new Document({styles:{default:{document:{run:{font:family,size:20},paragraph:{spacing:{line:260,after:100}}}}},sections}));
}
