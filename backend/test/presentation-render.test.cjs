process.env.STORAGE_DRIVER='local';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const JSZip=require('jszip');
const {createCanvas}=require('@napi-rs/canvas');
const {buildPresentationScene,renderPresentationPptx,renderPresentationPdf,presentationThemes}=require('../dist/exports/presentation-render');
const {searchPresentationImage}=require('../dist/exports/presentation-images');

function sample(){return {title:'Clase visual',style:'creativo',slides:[
 {title:'Aprender observando',content:['Una explicación que conecta el tema con situaciones cotidianas.'],layout:'title',notes:'Explicación completa del docente.',imageQuery:'classroom'},
 {title:'Comparar y argumentar',content:['Primera explicación con un ejemplo práctico para comprender el concepto.','Segunda explicación que invita a comparar resultados y justificar una respuesta.'],layout:'two-column',takeaway:'Relaciona la explicación con tu experiencia.',notes:'Notas adicionales.'},
 {title:'Resolver en equipo',content:['Observa el ejemplo, formula una hipótesis y comparte tu argumento.'],layout:'activity',notes:'Respuesta orientativa.'}
]};}
function picture(){const canvas=createCanvas(480,320);const ctx=canvas.getContext('2d');ctx.fillStyle='#157568';ctx.fillRect(0,0,480,320);return {data:canvas.toDataURL('image/png'),title:'Fotografía de prueba',author:'Autor de prueba',license:'CC BY 4.0',source:'https://commons.wikimedia.org/wiki/File:Example.png',width:480,height:320};}

test('PDF and PPTX share landscape geometry, readable text, embedded images and credits',async()=>{
 const scene=buildPresentationScene(sample(),[picture(),null,null],[{reference:1,name:'Lectura del docente.pdf',page:7}]);
 assert.equal(scene.slides.length,5);assert.equal(scene.imageCount,1);
 const ppt=await JSZip.loadAsync(await renderPresentationPptx(scene));
 assert.match(await ppt.file('ppt/presentation.xml').async('string'),/cx="12192000" cy="6858000"/);
 assert.ok(Object.keys(ppt.files).some(name=>name.startsWith('ppt/media/')));
 assert.match(await ppt.file('ppt/slides/slide4.xml').async('string'),/CC BY 4.0/);
 assert.match(await ppt.file('ppt/slides/slide5.xml').async('string'),/Lectura del docente.pdf/);
 assert.match(await ppt.file('ppt/notesSlides/notesSlide1.xml').async('string'),/Autor de prueba/);
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const pdf=await pdfjs.getDocument({data:new Uint8Array(await renderPresentationPdf(scene)),isEvalSupported:false}).promise;
 try{assert.equal(pdf.numPages,scene.slides.length);
  for(let i=0;i<scene.slides.length;i++){
   const page=await pdf.getPage(i+1);assert.deepEqual(page.view,[0,0,960,540]);
   const text=(await page.getTextContent()).items.map(v=>v.str).join(' ');
   for(const node of scene.slides[i].nodes.filter(n=>n.type==='text'))for(const line of node.lines)assert.ok(text.includes(line),`PDF lost text: ${line}`);
   const ops=await page.getOperatorList();if(i===0)assert.ok(ops.fnArray.includes(pdfjs.OPS.paintImageXObject));
  }
 }finally{await pdf.cleanup();}
});

test('all five styles preserve content and keep text inside the canvas',()=>{
 for(const style of Object.keys(presentationThemes)){
  const data=sample();data.style=style;
  const scene=buildPresentationScene(data);
  for(const slide of scene.slides)for(const node of slide.nodes){assert.ok(node.x>=0&&node.y>=0);if(node.type==='text'){assert.ok(node.x+node.w<=960);assert.ok(node.y+node.lines.length*node.size*1.23<=540);assert.ok(node.size>=8);}}
 }
 const data=sample();data.slides[1].content=Array.from({length:12},(_,i)=>`Explicación ${i+1}: un contenido que debe preservarse en las páginas de continuación, sin ocultar información.`);
 const scene=buildPresentationScene(data);assert.ok(scene.slides.length>3);
 const all=scene.slides.flatMap(s=>s.nodes.filter(n=>n.type==='text').flatMap(n=>n.lines)).join(' ');
 for(let i=1;i<=12;i++)assert.ok(all.includes(`Explicación ${i}:`));
});

test('image search rejects unlicensed media and unsafe download hosts',async()=>{
 const original=global.fetch;let calls=0;
 global.fetch=async()=>{calls++;return new Response(JSON.stringify({query:{pages:{1:{index:1,title:'File:Unsafe.jpg',imageinfo:[{thumburl:'http://127.0.0.1/private',mime:'image/jpeg',width:1000,height:700,extmetadata:{LicenseShortName:{value:'CC BY 4.0'}}}]},2:{index:2,title:'File:Restricted.jpg',imageinfo:[{url:'https://upload.wikimedia.org/image.jpg',mime:'image/jpeg',width:1000,height:700,extmetadata:{LicenseShortName:{value:'All rights reserved'}}}]}}}}));};
 try{assert.equal(await searchPresentationImage('educación'),null);assert.equal(calls,1);}finally{global.fetch=original;}
});
