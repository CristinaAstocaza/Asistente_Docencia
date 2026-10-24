import { BadRequestException } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import JSZip from 'jszip';
type Adapter={startRow:number;columns:string[];rows:(questions:any[])=>unknown[][]};
function answers(question:any,max:number) {
 const options=question.type==='true_false'?['Verdadero','Falso']:question.options;
 if(!['multiple_choice','true_false'].includes(question.type) || options.length<2 || options.length>max || !options.includes(question.correctAnswer))throw new BadRequestException(`El quiz requiere preguntas de alternativa múltiple o verdadero/falso con 2 a ${max} opciones.`);
 return options;
}
const adapters:Record<string,Adapter>={
 kahoot:{startRow:9,columns:['A','B','C','D','E','F','G','H'],rows:questions=>questions.map((q,i)=>[i+1,q.question,...Array.from({length:4},(_,j)=>q.options[j]||''),q.time||30,String(q.options.indexOf(q.correctAnswer)+1)])},
 quizizz:{startRow:3,columns:['A','B','C','D','E','F','G','H','I','J','K'],rows:questions=>questions.map(q=>{
  const options=answers(q,5);return [q.question,'Multiple Choice',...Array.from({length:5},(_,i)=>options[i]||''),options.indexOf(q.correctAnswer)+1,30,'',q.explanation];
 })},
};
const escapeXml=(value:unknown)=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
export async function quizWorkbook(questions:any[],platform:string) {
 const adapter=adapters[platform];if(!adapter)throw new BadRequestException('Integración no disponible.');
 const rows=adapter.rows(questions);
 const zip=await JSZip.loadAsync(await readFile(resolve('assets',`${platform}-template.xlsx`)));
 const path='xl/worksheets/sheet1.xml';let sheet=await zip.file(path)!.async('string');
 const data=sheet.match(/<sheetData[^>]*>([\s\S]*?)<\/sheetData>/)![1];
 const prefix=[...data.matchAll(/<row\b[^>]*\br="(\d+)"[^>]*>[\s\S]*?<\/row>/g)].filter(m=>Number(m[1])<adapter.startRow).map(m=>m[0]).join('');
 const generated=rows.map((values,i)=>{
  const row=i+adapter.startRow;
  const cells=values.map((value,j)=>typeof value==='number'?`<c r="${adapter.columns[j]}${row}"><v>${value}</v></c>`:`<c r="${adapter.columns[j]}${row}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`).join('');
  return `<row r="${row}">${cells}</row>`;
 }).join('');
 sheet=sheet.replace(/<sheetData[^>]*>[\s\S]*?<\/sheetData>/,`<sheetData>${prefix}${generated}</sheetData>`).replace(/<dimension\s+ref="[^"]+"\s*\/>/,`<dimension ref="A1:${adapter.columns.at(-1)}${adapter.startRow+rows.length-1}"/>`);
 zip.file(path,sheet);return zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
}
