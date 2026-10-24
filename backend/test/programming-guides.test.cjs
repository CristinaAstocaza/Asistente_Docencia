process.env.STORAGE_DRIVER='local';
const {test}=require('node:test');const assert=require('node:assert/strict');const {randomUUID}=require('node:crypto');
const JSZip=require('jszip');
const {generateGuidePublication}=require('../dist/ai/guide-generation');
const {programmingGuideIssue}=require('../dist/ai/programming-guide');
const {cleanGuideBlocks}=require('../dist/common/guide-content');
const {renderPublishedGuidePdf,renderPublishedGuideDocx,defaultGuideDesign}=require('../dist/exports/guide-publication');

test('filenames cannot pass as TypeScript or HTML implementations',()=>{
 for(const path of ['src/app/task.model.ts','src/app/app.component.ts','src/app/app.component.html'])assert.match(programmingGuideIssue([{type:'code',language:'typescript',text:path}]),/solo una ruta/);
 assert.match(programmingGuideIssue([{type:'paragraph',text:'Edita src/app/app.component.html para agregar el formulario.'},{type:'paragraph',text:'Revisa el resultado.'},{type:'code',text:'ng serve'}]),/Falta el contenido/);
 assert.equal(programmingGuideIssue([{type:'code',filePath:'src/app/task.model.ts',language:'typescript',text:'export interface Task {\n  id: number;\n  title: string;\n  completed: boolean;\n}'}]),undefined);
 assert.equal(programmingGuideIssue([{type:'paragraph',text:'Importa Task desde task.model.ts.'},{type:'paragraph',text:'Archivo completo a continuación.'},{type:'code',filePath:'src/app/task.model.ts',text:'export interface Task { id: number; }'}]),undefined);
});

test('filename-only drafts are corrected with complete code, then exported with the filename and implementation',async()=>{
 let drafts=0;const source='export interface Task {\n  id: number;\n  title: string;\n  completed: boolean;\n}';
 const provider={generate:async(system,prompt,schema)=>{
  assert.match(system,/TODO su contenido/);
  if(schema.properties.chapters)return {text:JSON.stringify({title:'Modelo de tareas',guideType:'Práctica',objectives:['Definir la tarea','Usar el modelo'],chapters:[{title:'Modelo de datos',brief:'Escribir interfaz Task'}]}),usage:{}};
  drafts++;if(drafts===2)assert.match(prompt,/solo una ruta/);
  return {text:JSON.stringify({blocks:[{type:'paragraph',text:'Paso 1. Crea el archivo y pega este contenido. Comprueba que el editor reconoce la interfaz Task sin errores.'},{type:'code',filePath:'src/app/task.model.ts',language:'typescript',text:drafts===1?'src/app/task.model.ts':source}]}),usage:{}};
 }};
 const data=await generateGuidePublication({provider,system:'',prompt:'',topic:'Angular tareas',parameters:{guideType:'Práctica paso a paso',pages:2},teacher:{},citations:[],initialUsage:'test',reserve:async()=>'',record:async()=>{}});
 assert.equal(drafts,2);assert.equal(data.blocks[1].text,source);assert.equal(data.blocks[1].filePath,'src/app/task.model.ts');
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');const task=pdfjs.getDocument({data:new Uint8Array(await renderPublishedGuidePdf(data,new Map())),useSystemFonts:true});const doc=await task.promise;let text='';for(let i=1;i<=doc.numPages;i++)text+=(await (await doc.getPage(i)).getTextContent()).items.map(x=>x.str).join(' ');assert.ok(text.includes('src/app/task.model.ts'));assert.ok(text.includes('export interface Task'));await task.destroy();
});

test('leaked UUID lines are hidden in existing PDF and Word exports without losing real code or metadata',async()=>{
 const leaked=randomUUID(),legitimate=randomUUID();
 const blocks=[{id:leaked,type:'paragraph',text:`${leaked}\nAbre src/app y revisa el componente.`,page:2},{id:randomUUID(),type:'code',text:`${leaked}\nconst resourceId = "${legitimate}";`,language:'typescript',page:2}];
 const cleaned=cleanGuideBlocks(blocks);assert.equal(cleaned[0].id,leaked);assert.ok(!cleaned[0].text.includes(leaked));assert.ok(cleaned[1].text.includes(legitimate));assert.ok(blocks[0].text.includes(leaked));
 const data={title:'Proyecto',guideType:'Práctica',objectives:['Crear un formulario'],blocks,publication:{pageCount:2,pageTitles:['Implementación'],design:defaultGuideDesign}};
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');const task=pdfjs.getDocument({data:new Uint8Array(await renderPublishedGuidePdf(data,new Map())),useSystemFonts:true});const pdf=await task.promise;
 let text='';for(let i=1;i<=pdf.numPages;i++)text+=(await (await pdf.getPage(i)).getTextContent()).items.map(item=>item.str).join(' ');
 assert.ok(!text.includes(leaked));assert.ok(text.includes(legitimate));await task.destroy();
 const zip=await JSZip.loadAsync(await renderPublishedGuideDocx(data,new Map()));const xml=await zip.file('word/document.xml').async('string');assert.ok(!xml.includes(leaked));assert.ok(xml.includes(legitimate));
});

test('Angular implementation retries vague instructions and accepts actual commands and code',async()=>{
 let drafts=0;
 const provider={generate:async(system,prompt,schema)=>{
  assert.match(system,/comando exacto de terminal/);assert.match(system,/ruta y nombre del archivo/);
  if(schema.properties.chapters)return {text:JSON.stringify({title:'Mini proyecto Angular',guideType:'Práctica paso a paso',objectives:['Crear formulario','Verificar acciones'],chapters:[{title:'Formulario y acciones',brief:'Mostrar implementación'}]}),usage:{}};
  drafts++;
  const items=['1. Abre la terminal en la carpeta del proyecto para crear un componente.','2. Edita el archivo del componente para preparar el formulario.','3. Abre el navegador y comprueba que funciona el formulario.'];
  if(drafts===1)return {text:JSON.stringify({blocks:[{type:'list',items}]}),usage:{}};
  assert.match(prompt,/Falta el ejemplo ejecutable/);
  return {text:JSON.stringify({blocks:[{type:'list',items},{type:'code',language:'bash',text:'ng generate component mini-proyecto'},{type:'paragraph',text:'Archivo: src/app/mini-proyecto/mini-proyecto.ts'},{type:'code',language:'typescript',text:'export class MiniProyecto {\n  nombre = "";\n}'}]}),usage:{}};
 }};
 const result=await generateGuidePublication({provider,system:'',prompt:'',topic:'Angular con un mini proyecto',parameters:{guideType:'Práctica paso a paso',pages:2},teacher:{},citations:[],initialUsage:'test',reserve:async()=>'',record:async()=>{}});
 assert.equal(drafts,2);assert.equal(result.blocks.filter(b=>b.type==='code').length,2);
});
