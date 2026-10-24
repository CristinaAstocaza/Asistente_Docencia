import PDFDocument from 'pdfkit';
import PptxGenJS from 'pptxgenjs';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { PresentationImage } from './presentation-images';

const W=960,H=540;
type Theme={bg:string;ink:string;accent:string;second:string;soft:string;titleFont:'body'|'title'};
export const presentationThemes:Record<string,Theme>={
 'académico':{bg:'F6F3EB',ink:'18332F',accent:'157568',second:'D49A3A',soft:'E5EDE5',titleFont:'title'},
 moderno:{bg:'F2F5FF',ink:'172554',accent:'3B54DB',second:'06B6D4',soft:'E3E9FF',titleFont:'body'},
 minimalista:{bg:'FAFAF7',ink:'222C34',accent:'226C61',second:'D8A854',soft:'EEF0E9',titleFont:'body'},
 creativo:{bg:'FFF6ED',ink:'44245E',accent:'8046BD',second:'ED8644',soft:'F0E3FB',titleFont:'body'},
 corporativo:{bg:'F1F5F9',ink:'142E49',accent:'16678B',second:'27A89D',soft:'E0EDF3',titleFont:'body'},
};
type Box={x:number;y:number;w:number;h:number};
type Node=({type:'shape';shape:'rect'|'roundRect'|'ellipse';fill:string;stroke?:string}&Box)
 |({type:'text';lines:string[];size:number;color:string;bold:boolean;font:'body'|'title';link?:string}&Box)
 |({type:'image';image:PresentationImage}&Box)
 ;
export interface SlideScene {background:string;nodes:Node[];notes:string;title:string}
export interface PresentationScene {title:string;style:string;slides:SlideScene[];imageCount:number}

function fonts(doc:PDFKit.PDFDocument){
 const windows=process.env.WINDIR||'C:/Windows';
 const regular=join(windows,'Fonts','arial.ttf'),bold=join(windows,'Fonts','arialbd.ttf');
 const title=join(windows,'Fonts','georgia.ttf'),titleBold=join(windows,'Fonts','georgiab.ttf');
 doc.registerFont('body',existsSync(regular)?regular:'Helvetica');doc.registerFont('body-bold',existsSync(bold)?bold:'Helvetica-Bold');
 doc.registerFont('title',existsSync(title)?title:'Times-Roman');doc.registerFont('title-bold',existsSync(titleBold)?titleBold:'Times-Bold');
}
function wrap(doc:PDFKit.PDFDocument,value:string,width:number,size:number,font:string){
 doc.font(font).fontSize(size);const result:string[]=[];
 for(const paragraph of value.replace(/\r/g,'').split('\n')){
  let line='';for(const word of paragraph.split(/\s+/).filter(Boolean)){
   if(line&&doc.widthOfString(`${line} ${word}`)>width){result.push(line);line='';}
   if(doc.widthOfString(word)>width){for(const char of word){if(line&&doc.widthOfString(line+char)>width){result.push(line);line='';}line+=char;}}
   else line+=`${line?' ':''}${word}`;
  }if(line)result.push(line);
 }return result;
}

/** A single coordinate system and measured text feed both export formats. */
export function buildPresentationScene(data:any,images:(PresentationImage|null)[]=[],citations:{reference:number;name:string;page?:number|null}[]=[]):PresentationScene {
 const theme=presentationThemes[data.style]||presentationThemes['académico'];
 const metric=new PDFDocument({autoFirstPage:false});fonts(metric);
 const slides:SlideScene[]=[];
 const rect=(s:SlideScene,x:number,y:number,w:number,h:number,fill:string,shape:'rect'|'roundRect'|'ellipse'='rect')=>s.nodes.push({type:'shape',shape,x,y,w,h,fill});
 function text(s:SlideScene,value:unknown,x:number,y:number,w:number,h:number,size=20,color=theme.ink,bold=false,font:'body'|'title'='body',link?:string){
  const valueText=String(value??'');let lines=wrap(metric,valueText,w,size,font+(bold?'-bold':''));
  while(lines.length*size*1.23>h&&size>12){size-=.5;lines=wrap(metric,valueText,w,size,font+(bold?'-bold':''));}
  if(lines.length*size*1.23>h)throw new Error('El contenido de una diapositiva es demasiado extenso. Divide el texto en más diapositivas.');
  s.nodes.push({type:'text',lines,x,y,w,h,size,color,bold,font,link});
 }
 function photo(s:SlideScene,image:PresentationImage,x:number,y:number,w:number,h:number){
  rect(s,x-8,y-8,w+16,h+16,theme.soft,'roundRect');
  const scale=Math.min(w/image.width,h/image.height),iw=image.width*scale,ih=image.height*scale;
  s.nodes.push({type:'image',image,x:x+(w-iw)/2,y:y+(h-ih)/2,w:iw,h:ih});
 }
 function body(s:SlideScene,items:string[],x:number,y:number,w:number,h:number,cards=true){
  const gap=12,each=(h-gap*(items.length-1))/Math.max(1,items.length);
  items.forEach((value,index)=>{
   if(cards){rect(s,x,y+index*(each+gap),w,each,'FFFFFF','roundRect');rect(s,x,y+index*(each+gap),4,each,index%2?theme.second:theme.accent);}
   text(s,String(index+1).padStart(2,'0'),x+16,y+index*(each+gap)+14,28,25,13,theme.accent,true);
   text(s,value,x+55,y+index*(each+gap)+13,w-72,each-22,19,theme.ink);
  });
 }
 const raw:any[]=[];
 for(const [index,item] of data.slides.entries()){
  // Bound the visible text without discarding content. Long legacy slides get continuation pages.
  const groups:string[][]=[];let group:string[]=[],length=0;
  for(const entry of item.content||[]){
   const limit=item.layout==='title'?240:420,budget=item.layout==='title'?280:650;
   const chunks:string[]=[];let remaining=String(entry).trim();
   while(remaining.length>limit){const space=remaining.lastIndexOf(' ',limit);const end=space>limit/2?space:limit;chunks.push(remaining.slice(0,end).trim());remaining=remaining.slice(end).trim();}if(remaining)chunks.push(remaining);
   for(const part of chunks){if(group.length>=4||length+part.length>budget){if(group.length)groups.push(group);group=[];length=0;}group.push(part);length+=part.length;}
  }if(group.length)groups.push(group);if(!groups.length)groups.push([]);
  groups.forEach((content,part)=>raw.push({...item,content,original:index,part,parts:groups.length}));
 }
 for(const [index,item] of raw.entries()){
  const s:SlideScene={background:theme.bg,nodes:[],title:item.title,notes:`${item.notes||''}\n${item.visualSuggestion||''}`};
  const image=images[item.original];const isCover=item.layout==='title'&&item.part===0;
  rect(s,0,0,W,9,theme.accent);rect(s,895,20,95,95,theme.soft,'ellipse');rect(s,923,80,30,30,theme.second,'ellipse');
  if(isCover){
   rect(s,0,9,530,H-9,theme.ink);rect(s,40,60,65,5,theme.second);
   text(s,'EXPLORAR · COMPRENDER · APLICAR',42,83,430,28,11,theme.second,true);
   text(s,item.title,42,140,430,164,40,'FFFFFF',true,theme.titleFont);
   text(s,[item.subtitle,...item.content].filter(Boolean).join('\n'),42,326,430,124,20,'FFFFFF');
   if(image)photo(s,image,576,111,328,288);
   else{rect(s,610,145,235,235,theme.soft,'ellipse');rect(s,657,193,141,141,theme.accent,'roundRect');text(s,'IDEAS\nEN ACCIÓN',677,238,104,88,23,'FFFFFF',true);}
  }else{
   text(s,item.layout==='activity'?'PONLO EN PRÁCTICA':item.layout==='conclusion'?'PARA LLEVAR A CLASE':`EXPLORA / ${String(index+1).padStart(2,'0')}`,42,29,840,20,10,theme.accent,true);
   text(s,`${item.title}${item.part?' · continuación':''}`,42,62,840,66,31,theme.ink,true,theme.titleFont);
   if(item.subtitle)text(s,item.subtitle,42,132,850,30,13,theme.accent);
   const visual=item.visual?.type!=='none'&&item.visual?.items?.length?item.visual:null;
   const hasRight=!!(image||visual);
   if(item.layout==='activity'){
    rect(s,42,164,hasRight?490:876,34,theme.accent,'roundRect');text(s,'OBSERVA, RESUELVE Y EXPLICA TU RESPUESTA',58,173,hasRight?458:830,19,11,'FFFFFF',true);
    body(s,item.content,42,210,hasRight?490:876,254);
   }else if(!hasRight&&item.layout==='two-column'){
    const split=Math.ceil(item.content.length/2);body(s,item.content.slice(0,split),42,169,429,290);body(s,item.content.slice(split),489,169,429,290);
   }else body(s,item.content,42,169,hasRight?490:876,290);
   if(visual?.type==='diagram'){
    const values=visual.items.slice(0,6);const each=Math.min(48,250/values.length);
    values.forEach((step:any,i:number)=>{const y=181+i*(each+9);rect(s,570,y,348,each,i%2?theme.soft:theme.accent,'roundRect');text(s,step.label,588,y+8,312,each-12,17,i%2?theme.ink:'FFFFFF',true);});
   }else if(visual?.type==='chart'&&visual.items.every((v:any)=>typeof v.value==='number')){
    rect(s,557,164,361,306,'FFFFFF','roundRect');
    const items=visual.items.slice(0,6),max=Math.max(...items.map((v:any)=>v.value),1),row=250/items.length;
    items.forEach((v:any,i:number)=>{const y=182+i*row;text(s,v.label,573,y+2,102,row-4,13,theme.ink);rect(s,684,y+7,Math.max(1,172*v.value/max),Math.min(26,row-12),i%2?theme.second:theme.accent,'roundRect');text(s,String(v.value),863,y+9,42,22,12,theme.ink,true);});
    text(s,visual.source||'Datos del material: verificar la fuente original.',573,447,327,17,8,theme.accent);
   }else if(image)photo(s,image,570,181,332,264);
   if(item.takeaway){rect(s,42,474,876,27,theme.soft,'roundRect');text(s,item.takeaway,54,481,852,18,11,theme.accent,true);}
  }
  // The process diagram or chart takes priority over decorative photography.
  if(image){s.notes+=`\nImagen: ${image.title}\nAutor: ${image.author}\nLicencia: ${image.license}\n${image.source}`;}
  text(s,String(data.title),42,515,650,15,8,isCover?'FFFFFF':theme.ink);
  text(s,`${index+1} / ${raw.length}`,860,513,58,18,9,theme.accent,true);
  slides.push(s);
 }
 // Credits remain readable and clickable; keep attribution separate from teaching content.
 const unique=[...new Map(images.filter((image):image is PresentationImage=>!!image).map(image=>[image.source,image])).values()];
 for(let start=0;start<unique.length;start+=4){
  const s:SlideScene={background:theme.bg,nodes:[],title:'Créditos de imágenes',notes:'Fotografías educativas de Wikimedia Commons. Las imágenes ilustran el tema; no constituyen evidencia de cifras o afirmaciones.'};
  rect(s,0,0,W,9,theme.accent);text(s,'Créditos de imágenes',42,45,850,60,30,theme.ink,true,theme.titleFont);
  unique.slice(start,start+4).forEach((image,index)=>{const y=128+index*85;photo(s,image,46,y,92,60);text(s,`${image.title}\n${image.author} · ${image.license}`,160,y,750,64,12,theme.ink,false,'body',image.source);});
  text(s,'Fuente: Wikimedia Commons · Enlaces y licencias disponibles en cada crédito.',42,513,850,17,9,theme.accent);slides.push(s);
 }
 for(let start=0;start<citations.length;start+=6){
  const s:SlideScene={background:theme.bg,nodes:[],title:'Fuentes consultadas',notes:'Referencias recuperadas de los documentos del docente.'};
  rect(s,0,0,W,9,theme.accent);text(s,'Fuentes consultadas',42,45,850,60,30,theme.ink,true,theme.titleFont);
  citations.slice(start,start+6).forEach((citation,index)=>text(s,`[${citation.reference}] ${citation.name}${citation.page?` · página/diapositiva ${citation.page}`:''}`,42,130+index*55,876,48,16,theme.ink));
  slides.push(s);
 }
 metric.end();return {title:data.title,style:data.style,slides,imageCount:unique.length};
}

export async function renderPresentationPptx(scene:PresentationScene):Promise<Buffer>{
 const ppt=new PptxGenJS();ppt.defineLayout({name:'DIDACTIC',width:W/72,height:H/72});ppt.layout='DIDACTIC';
 ppt.title=scene.title;ppt.author='Asistente IA para Docentes';ppt.subject='Presentación educativa';ppt.theme={headFontFace:'Arial',bodyFontFace:'Arial'};
 for(const page of scene.slides){
  const slide=ppt.addSlide();slide.background={color:page.background};
  for(const node of page.nodes){
   const box={x:node.x/72,y:node.y/72,w:node.w/72,h:node.h/72};
   if(node.type==='shape')slide.addShape(ppt.ShapeType[node.shape],{...box,fill:{color:node.fill},line:{color:node.stroke||node.fill,width:0}});
   if(node.type==='text')slide.addText(node.lines.join('\n'),{...box,fontFace:node.font==='title'?'Georgia':'Arial',fontSize:node.size,color:node.color,bold:node.bold,margin:0,breakLine:false,paraSpaceAfter:0,lineSpacingMultiple:1.23,valign:'top',hyperlink:node.link?{url:node.link}:undefined});
   if(node.type==='image')slide.addImage({...box,data:node.image.data,altText:node.image.title});
  }slide.addNotes(page.notes);
 }return Buffer.from(await ppt.write({outputType:'nodebuffer'}) as Buffer);
}

export function renderPresentationPdf(scene:PresentationScene):Promise<Buffer>{
 return new Promise((resolve,reject)=>{
  const doc=new PDFDocument({size:[W,H],margin:0,autoFirstPage:false,info:{Title:scene.title,Author:'Asistente IA para Docentes'}});fonts(doc);
  const pieces:Buffer[]=[];doc.on('data',chunk=>pieces.push(chunk));doc.on('end',()=>resolve(Buffer.concat(pieces)));doc.on('error',reject);
  try{for(const page of scene.slides){doc.addPage({size:[W,H],margin:0});doc.rect(0,0,W,H).fill(`#${page.background}`);
   for(const node of page.nodes){
    if(node.type==='shape'){doc.fillColor(`#${node.fill}`);if(node.shape==='ellipse')doc.ellipse(node.x+node.w/2,node.y+node.h/2,node.w/2,node.h/2).fill();else if(node.shape==='roundRect')doc.roundedRect(node.x,node.y,node.w,node.h,8).fill();else doc.rect(node.x,node.y,node.w,node.h).fill();}
    if(node.type==='text'){doc.font(node.font+(node.bold?'-bold':'')).fontSize(node.size).fillColor(`#${node.color}`);node.lines.forEach((line,i)=>doc.text(line,node.x,node.y+i*node.size*1.23,{lineBreak:false}));if(node.link)doc.link(node.x,node.y,node.w,node.h,node.link);}
    if(node.type==='image')doc.image(Buffer.from(node.image.data.split(',')[1],'base64'),node.x,node.y,{width:node.w,height:node.h});
   }
  }doc.end();}catch(error){doc.end();reject(error);}
 });
}
