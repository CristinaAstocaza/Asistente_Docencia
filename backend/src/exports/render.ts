import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import PDFDocument from 'pdfkit';
import { randomInt } from 'node:crypto';
export type Line={text:string;heading?:boolean};
const labels:Record<string,string>={title:'Título',objective:'Objetivo',introduction:'Inicio',motivation:'Motivación',development:'Desarrollo',examples:'Ejemplos',activity:'Actividad',closing:'Cierre',questions:'Preguntas',question:'Enunciado',options:'Alternativas',correctAnswer:'Respuesta correcta',explanation:'Explicación',difficulty:'Dificultad',topic:'Tema',source:'Fuente',criteria:'Criterios',levels:'Niveles',weight:'Peso (%)',name:'Nombre',score:'Puntuación',description:'Descripción',stages:'Etapas',minutes:'Minutos',activities:'Actividades',resources:'Recursos',assessment:'Evaluación',competency:'Competencia',outcome:'Logro',methodology:'Metodología',units:'Unidades',weeks:'Semanas',topics:'Temas',outcomes:'Resultados',bibliography:'Bibliografía',evaluation:'Evaluación',slides:'Diapositivas',content:'Contenido',notes:'Notas',visualSuggestion:'Sugerencia visual',style:'Estilo',duration:'Duración (min)',course:'Curso',credits:'Créditos',cycle:'Ciclo',area:'Área',instructions:'Instrucciones',sections:'Secciones',layout:'Distribución'};
export function flatten(value:any,answerKey=true):Line[] {
 const lines:Line[]=[];
 if(Array.isArray(value))value.forEach((v,i)=>{lines.push({text:`${i+1}.`,heading:true});lines.push(...flatten(v,answerKey));});
 else if(value && typeof value==='object') {
  for(const [key,v] of Object.entries(value)) {
   if(!answerKey && ['correctAnswer','explanation'].includes(key))continue;
   if(key==='title'){lines.push({text:String(v),heading:true});continue;}
   lines.push({text:labels[key] || key,heading:true});lines.push(...flatten(v,answerKey));
  }
 } else if(value!==null && value!==undefined)lines.push({text:String(value)});
 return lines;
}
export function shuffle<T>(input:T[]):T[] {
 const array=[...input];for(let i=array.length-1;i>0;i--){const j=randomInt(i+1);[array[i],array[j]]=[array[j],array[i]];}return array;
}
export function examVersion(data:any,variant:string) {
 const copy=structuredClone(data);
 if(variant==='B'){copy.questions=shuffle(copy.questions).map((q:any)=>({...q,options:shuffle(q.options)}));copy.title+= ' — Versión B';}
 else if(variant==='A')copy.title+=' — Versión A';
 return copy;
}
export async function renderDocx(lines:Line[]) {
 return Packer.toBuffer(new Document({sections:[{children:lines.map(l=>new Paragraph({heading:l.heading?HeadingLevel.HEADING_2:undefined,children:[new TextRun({text:l.text,font:'Arial',size:22})],spacing:{after:160}}))}]}));
}
export { renderAcademicRubricDocx as renderRubricDocx } from './academic-render';
export function renderPdf(lines:Line[]):Promise<Buffer> {
 return new Promise((resolve,reject)=>{
  const doc=new PDFDocument({size:'A4',margin:50,bufferPages:true});const pieces:Buffer[]=[];
  doc.on('data',d=>pieces.push(d));doc.on('end',()=>resolve(Buffer.concat(pieces)));doc.on('error',reject);
  for(const line of lines) {doc.font(line.heading?'Helvetica-Bold':'Helvetica').fontSize(line.heading?13:11).fillColor(line.heading?'#14213D':'#1F2937').text(line.text,{lineGap:3});doc.moveDown(0.4);}
  const range=doc.bufferedPageRange();for(let i=range.start;i<range.start+range.count;i++){doc.switchToPage(i);doc.text(`${i+1} / ${range.count}`,50,doc.page.height-35,{lineBreak:false,align:'center'});}
  doc.end();
 });
}
export { renderPresentationPdf,buildPresentationScene } from './presentation-render';
import { buildPresentationScene,renderPresentationPptx } from './presentation-render';
import type { PresentationImage } from './presentation-images';
export async function renderPptx(data:any,images:(PresentationImage|null)[]=[]) {
 return renderPresentationPptx(buildPresentationScene(data,images));
}
