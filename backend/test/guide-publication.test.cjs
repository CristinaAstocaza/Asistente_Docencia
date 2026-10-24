const {test}=require('node:test');const assert=require('node:assert/strict');const {randomUUID}=require('node:crypto');const JSZip=require('jszip');
const {generateGuidePublication,requestedGuidePages}=require('../dist/ai/guide-generation');const {renderPublishedGuidePdf,renderPublishedGuideDocx}=require('../dist/exports/guide-publication');

test('practical guides accept precise short steps without word-count padding or retries',async()=>{
 const items=['1. Abre la terminal en la carpeta del proyecto.','2. Ejecuta npm install y espera a que termine.','3. Ejecuta npm start y comprueba que aparece la página inicial.'];
 let calls=0;const provider={generate:async(system,prompt,schema)=>{
  calls++;assert.match(system,/una acción concreta por paso/);
  if(schema.properties.chapters)return {text:JSON.stringify({title:'Proyecto',guideType:'Práctica paso a paso',objectives:['Preparar el proyecto','Verificar el resultado'],chapters:[{title:'Preparación',brief:'Instalar y ejecutar'}]}),usage:{}};
  assert.doesNotMatch(prompt,/220–300|al menos 150|150–200/);
  return {text:JSON.stringify({blocks:[{type:'list',items}]}),usage:{}};
 }};
 const data=await generateGuidePublication({provider,system:'',prompt:'',topic:'Crear un proyecto',parameters:{guideType:'Práctica paso a paso',pages:2},teacher:{},citations:[],initialUsage:'initial',reserve:async()=>'',record:async()=>{}});
 assert.equal(calls,2);assert.deepEqual(data.blocks[0].items,items);
 assert.ok((await renderPublishedGuidePdf(data,new Map())).length>1000);
 const zip=await JSZip.loadAsync(await renderPublishedGuideDocx(data,new Map()));const xml=await zip.file('word/document.xml').async('string');assert.ok(xml.includes('1. Abre la terminal'));const stepParagraph=xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g).find(paragraph=>paragraph.includes('1. Abre la terminal'));assert.ok(!stepParagraph.includes('<w:numPr>'));
});

test('short practical validation still rejects vague or empty instructions',()=>{
 const {practicalGuideHasSubstance,isPracticalGuide}=require('../dist/ai/guide-generation');
 assert.equal(practicalGuideHasSubstance([{type:'list',items:['Preparar','Hacer','Revisar']}]),false);
 assert.equal(practicalGuideHasSubstance([]),false);
 assert.equal(isPracticalGuide({guideType:'Laboratorio'}),true);assert.equal(isPracticalGuide({guideType:'Estudio'}),false);
});

test('zero heading levels in model output do not discard a valid chapter',async()=>{
 let calls=0;const provider={generate:async(_,prompt,schema)=>{
  calls++;const data=require('./guide-fixture.cjs').fixture(schema,prompt);
  if(data.blocks)for(const block of data.blocks)block.level=0;
  return {text:JSON.stringify(data),usage:{}};
 }};
 const data=await generateGuidePublication({provider,system:'',prompt:'',topic:'Instrumental, Materiales y Bioseguridad',parameters:{pages:2},teacher:{},citations:[],initialUsage:'initial',reserve:async()=>'',record:async()=>{}});
 assert.equal(calls,2);
 assert.ok(data.blocks.some(b=>b.type==='heading'&&b.level===1));
 for(const block of data.blocks.filter(b=>b.type!=='heading'))assert.equal(block.level,undefined);
 assert.ok((await renderPublishedGuidePdf(data,new Map())).length>1000);
});

test('normalizing model metadata preserves content and still rejects malformed blocks',()=>{
 const {normalizeGuideDraft,guidePageDraft}=require('../dist/ai/guide-generation');
 const original={blocks:[{type:'paragraph',text:'Keep this content',level:0},{type:'heading',text:'Title',level:0}]};
 const normalized=normalizeGuideDraft(original);
 assert.equal(original.blocks[0].level,0);assert.equal(normalized.blocks[0].text,original.blocks[0].text);
 assert.ok(guidePageDraft.safeParse(normalized).success);
 assert.equal(guidePageDraft.safeParse(normalizeGuideDraft({blocks:[{type:'heading',text:'Title',level:-1}]})).success,false);
 assert.equal(guidePageDraft.safeParse(normalizeGuideDraft({blocks:[{type:'unknown',text:'Text',level:0}]})).success,false);
});
test('code examples count as substantive content and correction receives the rejected draft',async()=>{
 const {guidePageHasSubstance}=require('../dist/ai/guide-generation');assert.ok(guidePageHasSubstance([{type:'paragraph',text:'Explanation '.repeat(105)},{type:'code',text:Array.from({length:10},(_,i)=>`const step${i} = ${i};`).join('\n')}]));assert.equal(guidePageHasSubstance([{type:'paragraph',text:'Short'},{type:'code',text:'x'}]),false);
 let pages=0;const provider={generate:async(_,prompt,schema)=>{
  if(schema.properties.chapters)return {text:JSON.stringify({title:'Study',guideType:'Study',objectives:['One','Two'],chapters:[{title:'Topic',brief:'Explain'}]}),usage:{}};
  pages++;if(pages===1)return {text:JSON.stringify({blocks:[{type:'paragraph',text:'Rejected draft marker'},{type:'paragraph',text:'Short'}]}),usage:{}};
  assert.match(prompt,/Rejected draft marker/);return {text:JSON.stringify(require('./guide-fixture.cjs').fixture(schema,prompt)),usage:{}};
 }};
 const data=await generateGuidePublication({provider,system:'',prompt:'',topic:'Study',parameters:{pages:2},teacher:{},citations:[],initialUsage:'initial',reserve:async()=>'',record:async()=>{}});assert.equal(data.publication.pageCount,2);assert.equal(pages,2);
});
test('ten requested pages contain developed chapters and export to ten PDF pages with styled Word sections',async()=>{
 const provider={generate:async(_,prompt,schema)=>({text:JSON.stringify(require('./guide-fixture.cjs').fixture(schema,prompt)),usage:{}})};
 const data=await generateGuidePublication({provider,system:'',prompt:'',topic:'Study',parameters:{pages:10},teacher:{name:'Teacher'},citations:[],initialUsage:randomUUID(),reserve:async()=>randomUUID(),record:async()=>{}});
 assert.equal(data.publication.pageTitles.length,9);const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');const task=pdfjs.getDocument({data:new Uint8Array(await renderPublishedGuidePdf(data,new Map())),useSystemFonts:true});const pdf=await task.promise;assert.equal(pdf.numPages,10);
 for(let n=2;n<=10;n++)assert.ok((await (await pdf.getPage(n)).getTextContent()).items.length>10);await task.destroy();
 const zip=await JSZip.loadAsync(await renderPublishedGuideDocx(data,new Map()));const xml=await zip.file('word/document.xml').async('string');assert.equal((xml.match(/<w:sectPr>/g)||[]).length,10);assert.match(xml,/4361EE/);assert.match(xml,/Courier New/);
});
test('short content is retried then rejected instead of saving empty pages',async()=>{
 let calls=0;const provider={generate:async(_,prompt,schema)=>{calls++;return {text:JSON.stringify(schema.properties.chapters?{title:'Study',guideType:'Study',objectives:['One','Two'],chapters:[{title:'Topic',brief:'Explain'}]}:{blocks:[{type:'paragraph',text:'Too short'},{type:'paragraph',text:'Still short'}]}),usage:{}};}};
 await assert.rejects(generateGuidePublication({provider,system:'',prompt:'',topic:'Study',parameters:{pages:2},teacher:{},citations:[],initialUsage:'initial',reserve:async()=>'',record:async()=>{}}),/poco desarrollado/);assert.equal(calls,5);assert.throws(()=>requestedGuidePages('',{pages:31}));
});

test('oversized chapters continue on extra pages without regenerating or losing their content',async()=>{
 let calls=0;const paragraphs=Array.from({length:8},(_,i)=>({type:'paragraph',text:`Unique marker ${i}. `+'Educational explanation with an observable example and evaluation criteria. '.repeat(16)}));
 const provider={generate:async(_,prompt,schema)=>{calls++;return {text:JSON.stringify(schema.properties.chapters?{title:'Study',guideType:'Laboratory',objectives:['One','Two'],chapters:[{title:'PARTE III - ZONAS DE PUNCIÓN Y SELECCIÓN ANATÓMICA',brief:'Explain in detail'}]}:{blocks:paragraphs}),usage:{}};}};
 const data=await generateGuidePublication({provider,system:'',prompt:'',topic:'Study',parameters:{pages:2},teacher:{},citations:[],initialUsage:'initial',reserve:async()=>'',record:async()=>{}});
 assert.equal(calls,2);assert.ok(data.publication.pageCount>2);assert.equal(data.blocks.map(b=>b.text).join('\n'),paragraphs.map(b=>b.text).join('\n'));
 assert.equal(new Set(data.blocks.map(b=>b.id)).size,data.blocks.length);
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');const task=pdfjs.getDocument({data:new Uint8Array(await renderPublishedGuidePdf(data,new Map())),useSystemFonts:true});const pdf=await task.promise;
 assert.equal(pdf.numPages,data.publication.pageCount);await task.destroy();
});

test('one oversized paragraph is split without dropping text or producing overflowing pages',()=>{
 const {paginateGuideChapter,guidePageFits}=require('../dist/exports/guide-publication');
 const text=Array.from({length:1800},(_,i)=>`word${i}`).join(' ');
 const pages=paginateGuideChapter('Long chapter',[{id:randomUUID(),type:'paragraph',text}]);
 assert.ok(pages.length>1);
 assert.equal(pages.flatMap(p=>p.blocks.map(b=>b.text)).join(' '),text);
 for(const page of pages)assert.ok(guidePageFits(page.title,page.blocks));
});
