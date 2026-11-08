import PDFDocument from 'pdfkit';
import PptxGenJS from 'pptxgenjs';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { PresentationImage } from './presentation-images';
import { UNICA, UNICA_LOGO_SIZE, unicaLogoDataUri } from './brand';

const W=960,H=540;
type Theme={bg:string;ink:string;accent:string;second:string;soft:string;titleFont:'body'|'title'};
export const presentationThemes:Record<string,Theme>={
 institucional:{bg:'FFFFFF',ink:'1F2937',accent:'C8102E',second:'F2A900',soft:'FDECEE',titleFont:'body'},
 'académico':{bg:'F6F3EB',ink:'18332F',accent:'157568',second:'D49A3A',soft:'E5EDE5',titleFont:'title'},
 moderno:{bg:'F2F5FF',ink:'172554',accent:'3B54DB',second:'06B6D4',soft:'E3E9FF',titleFont:'body'},
 minimalista:{bg:'FAFAF7',ink:'222C34',accent:'226C61',second:'D8A854',soft:'EEF0E9',titleFont:'body'},
 creativo:{bg:'FFF6ED',ink:'44245E',accent:'8046BD',second:'ED8644',soft:'F0E3FB',titleFont:'body'},
 corporativo:{bg:'F1F5F9',ink:'142E49',accent:'16678B',second:'27A89D',soft:'E0EDF3',titleFont:'body'},
};
type Box={x:number;y:number;w:number;h:number};
type Node=({type:'shape';shape:'rect'|'roundRect'|'ellipse';fill:string;stroke?:string}&Box)
 |({type:'text';lines:string[];size:number;color:string;bold:boolean;font:'body'|'title';link?:string;align?:'left'|'center'}&Box)
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
 function text(s:SlideScene,value:unknown,x:number,y:number,w:number,h:number,size=20,color=theme.ink,bold=false,font:'body'|'title'='body',link?:string,align:'left'|'center'='left'){
  const valueText=String(value??'');let lines=wrap(metric,valueText,w,size,font+(bold?'-bold':''));
  while(lines.length*size*1.23>h&&size>12){size-=.5;lines=wrap(metric,valueText,w,size,font+(bold?'-bold':''));}
  if(lines.length*size*1.23>h)throw new Error('El contenido de una diapositiva es demasiado extenso. Divide el texto en más diapositivas.');
  s.nodes.push({type:'text',lines,x,y,w,h,size,color,bold,font,link,align});
 }
 function photo(s:SlideScene,image:PresentationImage,x:number,y:number,w:number,h:number){
  rect(s,x-8,y-8,w+16,h+16,theme.soft,'roundRect');
  const scale=Math.min(w/image.width,h/image.height),iw=image.width*scale,ih=image.height*scale;
  s.nodes.push({type:'image',image,x:x+(w-iw)/2,y:y+(h-ih)/2,w:iw,h:ih});
 }
 function body(s:SlideScene,items:string[],x:number,y:number,w:number,h:number,cards=true,start=0){
  const gap=12,each=(h-gap*(items.length-1))/Math.max(1,items.length);
  items.forEach((value,index)=>{
   if(cards){rect(s,x,y+index*(each+gap),w,each,'FFFFFF','roundRect');rect(s,x,y+index*(each+gap),4,each,index%2?theme.second:theme.accent);}
   text(s,String(start+index+1).padStart(2,'0'),x+16,y+index*(each+gap)+14,28,25,13,theme.accent,true);
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
  // A cover never spills into a near-empty "continuación" slide: its extra text goes to the speaker notes.
  // A divider shows one short phrase; anything longer goes to the speaker notes.
  if(item.layout==='section'){const all=(item.content||[]).map(String);raw.push({...item,content:all.slice(0,1).map((t:string)=>t.length>160?`${t.slice(0,t.lastIndexOf(' ',157)>80?t.lastIndexOf(' ',157):157)}…`:t),notes:`${item.notes||''}\n${all.join('\n')}`,original:index,part:0,parts:1});continue;}
  if(item.layout==='title'&&groups.length>1){raw.push({...item,content:groups[0],notes:`${item.notes||''}\n${groups.slice(1).flat().join('\n')}`,original:index,part:0,parts:1});continue;}
  groups.forEach((content,part)=>raw.push({...item,content,original:index,part,parts:groups.length}));
 }
 // Each part of the class has its own color (same palette as the session document).
 const partTone=(name:unknown,fallback:string)=>{
  const n=String(name??'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  if(/inicio|motivac|apertura|exploraci/.test(n))return '2E7D32';
  if(/desarrollo|transformaci|construcci|aplicaci/.test(n))return '1565C0';
  if(/cierre|conclusi|evaluaci|metacogn/.test(n))return 'B26A00';
  const order=Array.isArray(data.structure)?data.structure.findIndex((p:string)=>String(p).toLowerCase()===String(name??'').toLowerCase()):-1;
  return order>=0?['2E7D32','1565C0','B26A00','6A1B9A','00838F'][order%5]:fallback;
 };
 const tint=(hex:string,amount:number)=>hex.match(/../g)!.map(c=>Math.round(parseInt(c,16)+(255-parseInt(c,16))*amount).toString(16).padStart(2,'0')).join('').toUpperCase();
 // "Institucional" style: white slides with the UNICA shield, red header line, halftone dots and corner shapes.
 const institutional=data.style==='institucional';
 const RED='C8102E',NAVY='0B2A5B',GOLD='F2A900',INK='1F2937',BLACK='111111';
 const logoUri=unicaLogoDataUri();
 const logo:PresentationImage|null=logoUri?{data:logoUri,title:'Escudo UNICA',author:'UNICA',license:'',source:'',width:UNICA_LOGO_SIZE.width,height:UNICA_LOGO_SIZE.height,origin:'source'}:null;
 const place=(s:SlideScene,image:PresentationImage,x:number,y:number,h:number)=>s.nodes.push({type:'image',image,x,y,w:h*image.width/image.height,h});
 const dots=(s:SlideScene,x0:number,y0:number,cols:number,rows:number,fromRight=true)=>{for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const k=fromRight?(cols-c)/cols:(c+1)/cols,size=1.2+4.2*k*(1-r/(rows+1));if(size<1.4)continue;s.nodes.push({type:'shape',shape:'ellipse',x:Math.max(0,x0+c*13-size/2),y:Math.max(0,y0+r*13-size/2),w:size,h:size,fill:tint(RED,.35+.45*(1-k))});}};
 const framed=(s:SlideScene,image:PresentationImage,x:number,y:number,w:number,h:number)=>{rect(s,x-2,y-2,w+4,h+4,BLACK);rect(s,x,y,w,h,'FFFFFF');const scale=Math.min((w-12)/image.width,(h-12)/image.height),iw=image.width*scale,ih=image.height*scale;s.nodes.push({type:'image',image,x:x+(w-iw)/2,y:y+(h-ih)/2,w:iw,h:ih});};
 const bullets=(s:SlideScene,items:string[],x:number,y:number,w:number,h:number)=>{
  // Stacked from the top like a slide written by hand; the size shrinks only when the text needs it.
  let size=19,heights:number[]=[];
  const measure=()=>{heights=items.map(v=>wrap(metric,String(v),w-22,size,'body').length*size*1.23);return heights.reduce((a,b)=>a+b,0)+16*(items.length-1);};
  while(measure()>h&&size>12)size-=.5;
  let top=y;items.forEach((value,i)=>{rect(s,x,top+size*.45,7,7,i%2?NAVY:RED);text(s,value,x+22,top,w-22,heights[i]+2,size,INK);top+=heights[i]+16;});
 };
 const flow=(s:SlideScene,items:{label:string}[],x:number,y:number,w:number,h:number)=>{
  // Process diagram: framed boxes joined by arrows.
  rect(s,x-2,y-2,w+4,h+4,BLACK);rect(s,x,y,w,h,'FFFFFF');
  const list=items.slice(0,5),arrow=16,boxH=Math.min(52,(h-24-arrow*(list.length-1))/list.length),total=list.length*boxH+arrow*(list.length-1);let top=y+(h-total)/2;
  list.forEach((step,i)=>{rect(s,x+26,top,w-52,boxH,NAVY,'roundRect');rect(s,x+28,top+2,w-56,boxH-4,i%2?'FFFFFF':'EAF2FB','roundRect');rect(s,x+28,top+2,8,boxH-4,i%2?GOLD:RED);text(s,step.label,x+46,top+8,w-86,boxH-14,15,NAVY,true);top+=boxH;if(i<list.length-1){rect(s,x+w/2-1,top,2,arrow-5,BLACK);rect(s,x+w/2-5,top+arrow-7,10,6,BLACK,'roundRect');top+=arrow;}});
 };
 function institutionalSlide(s:SlideScene,item:any,index:number,image:PresentationImage|null){
  s.background='FFFFFF';
  const isCover=item.layout==='title'&&item.part===0,divider=item.layout==='section'&&item.part===0;
  if(isCover||divider){
   rect(s,0,30,430,8,BLACK,'roundRect');rect(s,720,0,240,78,RED,'roundRect');rect(s,0,402,200,138,RED,'roundRect');rect(s,540,522,440,8,BLACK,'roundRect');
   dots(s,760,330,15,15,false);
  }
  if(isCover){
   text(s,item.title,90,92,780,120,36,BLACK,true,'body',undefined,'center');
   const session=[item.subtitle,...(item.content||[]).slice(0,1)].filter(Boolean).join('\n');
   if(session)text(s,session,110,222,740,80,20,NAVY,false,'body',undefined,'center');
   if(logo)place(s,logo,W/2-50,318,108);
   text(s,UNICA.name,180,436,600,20,12,BLACK,true,'body',undefined,'center');
   return;
  }
  if(divider){
   if(logo)place(s,logo,42,58,62);
   const order=Array.isArray(data.structure)?data.structure.findIndex((p:string)=>String(p).toLowerCase()===String(item.section||item.title).toLowerCase()):-1;
   text(s,order>=0?`PARTE ${order+1} DE ${data.structure.length}`:'NUEVA PARTE',180,150,600,22,13,GOLD,true,'body',undefined,'center');
   text(s,item.section||item.title,130,182,700,80,54,RED,true,'body',undefined,'center');
   text(s,[item.title!==item.section?item.title:'',item.subtitle,...(item.content||[])].filter(Boolean).join('\n'),150,278,660,90,19,NAVY,false,'body',undefined,'center');
   return;
  }
  // Header: shield, part name in red, red rule and halftone dots.
  dots(s,770,4,15,6);
  if(logo)place(s,logo,42,12,56);
  const part=item.section||(item.layout==='activity'?'Actividad':item.layout==='conclusion'?'Cierre':'');
  if(part)text(s,part,200,22,560,44,32,RED,true,'body',undefined,'center');
  rect(s,0,80,W,2,RED);
  rect(s,60,522,840,22,index%2?RED:BLACK,'roundRect');
  text(s,`${item.title}${item.part?' · continuación':''}`,42,96,876,64,25,RED,true);
  let top=160;
  if(item.subtitle){text(s,item.subtitle,42,158,876,22,14,NAVY,true);top=188;}
  const visual=image?.origin==='source'?null:item.visual?.type!=='none'&&item.visual?.items?.length?item.visual:null;
  const right=!!(image||visual),bodyW=right?470:876,bottom=item.takeaway?440:504;
  if(item.layout==='activity'){rect(s,42,top,bodyW,30,tint(GOLD,.75),'roundRect');rect(s,42,top,6,30,GOLD);text(s,'Observa, resuelve y explica tu respuesta',58,top+7,bodyW-30,18,13,NAVY,true);top+=42;}
  bullets(s,item.content,42,top,bodyW,bottom-top);
  if(visual?.type==='diagram')flow(s,visual.items,546,top,374,bottom-top);
  else if(visual?.type==='chart'&&visual.items.every((v:any)=>typeof v.value==='number')){
   rect(s,544,top-2,378,bottom-top+4,BLACK);rect(s,546,top,374,bottom-top,'FFFFFF');
   const items=visual.items.slice(0,6),max=Math.max(...items.map((v:any)=>v.value),1),row=(bottom-top-30)/items.length;
   items.forEach((v:any,i:number)=>{const y=top+12+i*row;text(s,v.label,558,y+2,110,row-4,12,INK);rect(s,674,y+6,Math.max(1,180*v.value/max),Math.min(24,row-12),i%2?NAVY:RED,'roundRect');text(s,String(v.value),862,y+8,50,20,11,INK,true);});
   text(s,visual.source||'Datos del material: verificar la fuente original.',558,bottom-18,350,14,8,NAVY);
  }else if(image)framed(s,image,546,top,374,bottom-top);
  if(item.takeaway){rect(s,42,452,876,52,tint(RED,.9),'roundRect');rect(s,42,452,6,52,RED);text(s,item.takeaway,60,460,846,38,15,NAVY,true);}
  if(image)s.notes+=image.origin==='source'?`\nImagen tomada de: ${image.source}`:image.origin==='ai'?'\nIlustración generada con IA.':`\nImagen: ${image.title}\nAutor: ${image.author}\nLicencia: ${image.license}\n${image.source}`;
 }
 for(const [index,item] of raw.entries()){
  const s:SlideScene={background:theme.bg,nodes:[],title:item.title,notes:`${item.notes||''}\n${item.visualSuggestion||''}`};
  // Continuation slides of a long slide do not repeat its photo.
  const image=item.part===0?images[item.original]:null;const isCover=item.layout==='title'&&item.part===0;
  const tone=partTone(item.section,theme.accent),soft=tint(tone,.86);
  const divider=item.layout==='section'&&item.part===0;
  if(institutional){
   institutionalSlide(s,item,index,image);
   if(!isCover)text(s,`${index+1} / ${raw.length}`,840,525,56,16,9,divider?'111111':'FFFFFF',true);
   slides.push(s);continue;
  }
  if(isCover){
   rect(s,0,0,W,9,theme.accent);rect(s,0,9,530,H-9,theme.ink);rect(s,40,60,65,5,theme.second);
   rect(s,860,10,95,95,tint(theme.second,.5),'ellipse');
   const parts:string[]=Array.isArray(data.structure)&&data.structure.length?data.structure.map((p:string)=>String(p)):[];
   if(parts.length)text(s,parts.map(p=>String(p).toUpperCase()).join(' · '),42,83,430,28,11,theme.second,true);
   else text(s,'EXPLORAR · COMPRENDER · APLICAR',42,83,430,28,11,theme.second,true);
   text(s,item.title,42,140,430,164,40,'FFFFFF',true,theme.titleFont);
   text(s,[item.subtitle,...item.content].filter(Boolean).join('\n'),42,326,430,124,20,'FFFFFF');
   if(image)photo(s,image,576,111,328,288);
   else{rect(s,610,145,235,235,theme.soft,'ellipse');rect(s,657,193,141,141,theme.accent,'roundRect');text(s,'IDEAS\nEN ACCIÓN',677,238,104,88,23,'FFFFFF',true);}
  }else if(divider){
   // Divider between the parts of the class (e.g. Inicio, Desarrollo, Cierre).
   s.background=tone;rect(s,640,0,420,420,tint(tone,.18),'ellipse');rect(s,760,340,200,200,tint(tone,.32),'ellipse');rect(s,600,360,90,90,tint(tone,.45),'ellipse');
   rect(s,42,150,80,6,theme.second);
   const order=Array.isArray(data.structure)?data.structure.findIndex((p:string)=>String(p).toLowerCase()===String(item.section||item.title).toLowerCase()):-1;
   text(s,order>=0?`PARTE ${order+1} DE ${data.structure.length}`:'NUEVA PARTE',42,110,600,24,12,'FFFFFF',true);
   text(s,item.title,42,176,image?470:560,150,52,'FFFFFF',true,theme.titleFont);
   text(s,[item.subtitle,...item.content].filter(Boolean).join('\n'),42,340,image?470:560,120,20,'FFFFFF');
   if(image)photo(s,image,580,120,320,300);
  }else{
   rect(s,0,0,W,9,tone);rect(s,860,10,95,95,soft,'ellipse');rect(s,925,70,28,28,tint(tone,.5),'ellipse');
   const label=item.section?String(item.section).toUpperCase():item.layout==='activity'?'PONLO EN PRÁCTICA':item.layout==='conclusion'?'PARA LLEVAR A CLASE':'EXPLORA';
   const lw=Math.min(300,30+label.length*8);rect(s,42,24,lw,22,tone,'roundRect');text(s,label,52,29,lw-20,14,10,'FFFFFF',true);
    text(s,'/ ' + String(index+1).padStart(2,'0'),42+lw+10,28,60,16,11,tone,true);
   text(s,`${item.title}${item.part?' · continuación':''}`,42,58,820,70,31,theme.ink,true,theme.titleFont);
   if(item.subtitle)text(s,item.subtitle,42,132,850,30,13,tone);
   // A picture from the teacher's own sources wins over a drawn diagram.
   const visual=image?.origin==='source'?null:item.visual?.type!=='none'&&item.visual?.items?.length?item.visual:null;
   const hasRight=!!(image||visual);
   const cardsAt=(items:string[],x:number,y:number,w:number,h:number,start=0)=>{
    const gap=12,each=(h-gap*(items.length-1))/Math.max(1,items.length);
    items.forEach((value,i)=>{const top=y+i*(each+gap);rect(s,x,top,w,each,'FFFFFF','roundRect');rect(s,x,top,5,each,i%2?theme.second:tone);rect(s,x+16,top+12,26,26,i%2?tint(theme.second,.75):soft,'ellipse');text(s,String(start+i+1),x+16,top+17,26,16,12,i%2?theme.ink:tone,true);text(s,value,x+55,top+13,w-72,each-22,19,theme.ink);});
   };
   if(item.layout==='activity'){
    rect(s,42,164,hasRight?490:876,34,tone,'roundRect');text(s,'OBSERVA, RESUELVE Y EXPLICA TU RESPUESTA',58,173,hasRight?458:830,19,11,'FFFFFF',true);
    cardsAt(item.content,42,210,hasRight?490:876,254);
   }else if(!hasRight&&item.layout==='two-column'){
    const split=Math.ceil(item.content.length/2);cardsAt(item.content.slice(0,split),42,169,429,290);cardsAt(item.content.slice(split),489,169,429,290,split);
   }else cardsAt(item.content,42,169,hasRight?490:876,290);
   if(visual?.type==='diagram'){
    const values=visual.items.slice(0,6);const each=Math.min(48,250/values.length);
    values.forEach((step:any,i:number)=>{const y=181+i*(each+9);rect(s,570,y,348,each,i%2?soft:tone,'roundRect');text(s,step.label,588,y+8,312,each-12,17,i%2?theme.ink:'FFFFFF',true);});
   }else if(visual?.type==='chart'&&visual.items.every((v:any)=>typeof v.value==='number')){
    rect(s,557,164,361,306,'FFFFFF','roundRect');
    const items=visual.items.slice(0,6),max=Math.max(...items.map((v:any)=>v.value),1),row=250/items.length;
    items.forEach((v:any,i:number)=>{const y=182+i*row;text(s,v.label,573,y+2,102,row-4,13,theme.ink);rect(s,684,y+7,Math.max(1,172*v.value/max),Math.min(26,row-12),i%2?theme.second:tone,'roundRect');text(s,String(v.value),863,y+9,42,22,12,theme.ink,true);});
    text(s,visual.source||'Datos del material: verificar la fuente original.',573,447,327,17,8,tone);
   }else if(image){rect(s,560,171,352,284,soft,'roundRect');photo(s,image,570,181,332,264);}
   if(item.takeaway){rect(s,42,472,876,30,tone,'roundRect');text(s,item.takeaway,56,480,848,18,11,'FFFFFF',true);}
  }
  if(image)s.notes+=image.origin==='source'?`\nImagen tomada de: ${image.source}`:image.origin==='ai'?'\nIlustración generada con IA.':`\nImagen: ${image.title}\nAutor: ${image.author}\nLicencia: ${image.license}\n${image.source}`;
  text(s,String(data.title),42,515,isCover?470:650,15,8,isCover||divider?'FFFFFF':theme.ink);
  text(s,`${index+1} / ${raw.length}`,860,513,58,18,9,divider?'FFFFFF':isCover?theme.accent:tone,true);
  slides.push(s);
 }
 if(institutional){
  // References of the session, then the closing slide with the shield.
  const refs:string[]=(Array.isArray(data.references)?data.references:[]).map(String).filter(Boolean).slice(0,6);
  if(refs.length){const s:SlideScene={background:'FFFFFF',nodes:[],title:'Referencias bibliográficas',notes:'Bibliografía de la sesión de aprendizaje.'};dots(s,770,4,15,6);if(logo)place(s,logo,42,12,56);rect(s,0,80,W,2,RED);text(s,'Referencias bibliográficas',42,100,876,40,26,RED,true);bullets(s,refs,60,160,840,330);rect(s,60,522,840,22,RED,'roundRect');slides.push(s);}
  const end:SlideScene={background:'FFFFFF',nodes:[],title:UNICA.name,notes:''};dots(end,0,0,18,9,false);dots(end,720,400,18,10);if(logo)place(end,logo,W/2-80,120,170);text(end,UNICA.name,180,310,600,26,16,BLACK,true,'body',undefined,'center');text(end,'Ica - Perú',180,340,600,20,12,NAVY,false,'body',undefined,'center');slides.push(end);
 }
 // No credit or source slides: each picture's author and license are in the speaker notes of its slide.
 const unique=[...new Map(images.filter((image):image is PresentationImage=>!!image).map(image=>[image.origin&&image.origin!=='commons'?image.data:image.source,image])).values()];
 metric.end();return {title:data.title,style:data.style,slides,imageCount:unique.length};
}

export async function renderPresentationPptx(scene:PresentationScene):Promise<Buffer>{
 const ppt=new PptxGenJS();ppt.defineLayout({name:'DIDACTIC',width:W/72,height:H/72});ppt.layout='DIDACTIC';
 ppt.title=scene.title;ppt.author='Praxis';ppt.subject='Presentación educativa';ppt.theme={headFontFace:'Arial',bodyFontFace:'Arial'};
 for(const page of scene.slides){
  const slide=ppt.addSlide();slide.background={color:page.background};
  for(const node of page.nodes){
   const box={x:node.x/72,y:node.y/72,w:node.w/72,h:node.h/72};
   if(node.type==='shape')slide.addShape(ppt.ShapeType[node.shape],{...box,fill:{color:node.fill},line:{color:node.stroke||node.fill,width:0}});
   if(node.type==='text')slide.addText(node.lines.join('\n'),{...box,fontFace:node.font==='title'?'Georgia':'Arial',fontSize:node.size,color:node.color,bold:node.bold,margin:0,breakLine:false,paraSpaceAfter:0,lineSpacingMultiple:1.23,valign:'top',align:node.align||'left',hyperlink:node.link?{url:node.link}:undefined});
   if(node.type==='image')slide.addImage({...box,data:node.image.data,altText:node.image.title});
  }slide.addNotes(page.notes);
 }return Buffer.from(await ppt.write({outputType:'nodebuffer'}) as Buffer);
}

export function renderPresentationPdf(scene:PresentationScene):Promise<Buffer>{
 return new Promise((resolve,reject)=>{
  const doc=new PDFDocument({size:[W,H],margin:0,autoFirstPage:false,info:{Title:scene.title,Author:'Praxis'}});fonts(doc);
  const pieces:Buffer[]=[];doc.on('data',chunk=>pieces.push(chunk));doc.on('end',()=>resolve(Buffer.concat(pieces)));doc.on('error',reject);
  try{for(const page of scene.slides){doc.addPage({size:[W,H],margin:0});doc.rect(0,0,W,H).fill(`#${page.background}`);
   for(const node of page.nodes){
    if(node.type==='shape'){doc.fillColor(`#${node.fill}`);if(node.shape==='ellipse')doc.ellipse(node.x+node.w/2,node.y+node.h/2,node.w/2,node.h/2).fill();else if(node.shape==='roundRect')doc.roundedRect(node.x,node.y,node.w,node.h,8).fill();else doc.rect(node.x,node.y,node.w,node.h).fill();}
    if(node.type==='text'){doc.font(node.font+(node.bold?'-bold':'')).fontSize(node.size).fillColor(`#${node.color}`);node.lines.forEach((line,i)=>doc.text(line,node.x+(node.align==='center'?Math.max(0,(node.w-doc.widthOfString(line))/2):0),node.y+i*node.size*1.23,{lineBreak:false}));if(node.link)doc.link(node.x,node.y,node.w,node.h,node.link);}
    if(node.type==='image')doc.image(Buffer.from(node.image.data.split(',')[1],'base64'),node.x,node.y,{width:node.w,height:node.h});
   }
  }doc.end();}catch(error){doc.end();reject(error);}
 });
}
