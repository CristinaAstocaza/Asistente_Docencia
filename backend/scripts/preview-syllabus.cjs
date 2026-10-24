const fs=require('node:fs/promises');
const path=require('node:path');
const {createCanvas}=require('@napi-rs/canvas');
const {renderSyllabusDocx,renderSyllabusPdf}=require('../dist/exports/syllabus-render');
const sample=require('../test/fixtures/syllabus.cjs');
async function main(){
 const out=path.resolve(__dirname,'../../artifacts'),bytes=await renderSyllabusPdf(sample);
 await fs.writeFile(path.join(out,'silabo-academico-ejemplo.pdf'),bytes);await fs.writeFile(path.join(out,'silabo-academico-ejemplo.docx'),await renderSyllabusDocx(sample));
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');const pdf=await pdfjs.getDocument({data:new Uint8Array(bytes),isEvalSupported:false,standardFontDataUrl:path.resolve(__dirname,'../node_modules/pdfjs-dist/standard_fonts').replaceAll('\\','/')+'/'}).promise;
 for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i),viewport=page.getViewport({scale:1.5}),canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;await fs.writeFile(path.join(out,`silabo-academico-pagina-${i}.png`),canvas.toBuffer('image/png'));}
 console.log(`Sílabo de ejemplo Word y PDF: ${pdf.numPages} páginas PDF.`);await pdf.destroy();
}
main().catch(error=>{console.error(error);process.exitCode=1;});
