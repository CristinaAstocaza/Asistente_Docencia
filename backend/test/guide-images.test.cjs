process.env.STORAGE_DRIVER='local';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');const {createCanvas}=require('@napi-rs/canvas');
const {illustrateGuide}=require('../dist/ai/guide-images');
const {renderPublishedGuidePdf,defaultGuideDesign}=require('../dist/exports/guide-publication');
function guide(){return {title:'Educational guide',guideType:'Laboratory',objectives:['Study'],publication:{pageCount:2,pageTitles:['Learning activity'],design:defaultGuideDesign,imageSearches:[{query:'medical instruments',chapter:1},{query:'nursing instruments diagram',chapter:1}]},blocks:[{id:randomUUID(),type:'paragraph',text:'Educational content. '.repeat(100),page:2}]};}
test('image quota failure falls back to credited references and exports actual images on A4 pages',async()=>{
 const data=guide(),images=new Map();let requests=0;
 const bytes=createCanvas(600,400).toBuffer('image/png');
 const notice=await illustrateGuide(data,{userId:'teacher',topic:'Nursing',mode:'generated',citations:[],reserve:async()=>{},visuals:{generate:async()=>{throw Error('Quota exceeded');},reference:async()=>{requests++;const id=randomUUID();images.set(id,{bytes,mime:'image/png'});return {id,caption:'Reference image · Author · CC BY 4.0 · https://commons.wikimedia.org/wiki/File:Example.png',source:`source-${requests}`};}}});
 assert.match(notice,/referencia/);assert.equal(data.blocks.filter(b=>b.type==='image').length,2);
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');const task=pdfjs.getDocument({data:new Uint8Array(await renderPublishedGuidePdf(data,images)),useSystemFonts:true});const pdf=await task.promise;let imageCount=0;
 assert.equal(pdf.numPages,data.publication.pageCount);
 for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i);assert.ok(Math.abs(page.view[2]-595.28)<1);assert.ok(Math.abs(page.view[3]-841.89)<1);const ops=await page.getOperatorList();imageCount+=ops.fnArray.filter(op=>op===pdfjs.OPS.paintImageXObject||op===pdfjs.OPS.paintInlineImageXObject).length;}
 assert.equal(imageCount,2);await task.destroy();
});
test('missing images produce an explicit error instead of a text-only guide',async()=>{
 await assert.rejects(()=>illustrateGuide(guide(),{userId:'teacher',topic:'Nursing',mode:'references',citations:[],reserve:async()=>{},visuals:{reference:async()=>null}}),/No se pudieron obtener imágenes/);
});
test('own images are read through ownership checks and do not request generated or reference images',async()=>{
 const data=guide(),id=randomUUID();await illustrateGuide(data,{userId:'teacher',topic:'Nursing',mode:'own',ownIds:[id],citations:[],reserve:async()=>{},visuals:{assetBytes:async(user,asset)=>{assert.equal(user,'teacher');assert.equal(asset,id);return {caption:'Teacher image'};}}});
 assert.equal(data.blocks.filter(b=>b.assetId===id).length,1);
});
