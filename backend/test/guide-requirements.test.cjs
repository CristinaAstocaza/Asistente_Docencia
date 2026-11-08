const {test}=require('node:test');
const assert=require('node:assert/strict');
const {guideRequirements,requirementList,isRealCode,requirementIssue,assignRequirements}=require('../dist/ai/guide-requirements');
const {generateGuidePublication}=require('../dist/ai/guide-generation');
test('the request is read into the elements the guide must contain',()=>{
 const r=guideRequirements('Guía de Data Warehouse con código SQL completo, diagramas del esquema, una tabla comparativa, imágenes y ejercicios con su solución.',{visualMode:'none'});
 assert.deepEqual(requirementList(r),['code','diagram','table','exercises','solutions']);assert.equal(r.images,true);
 assert.deepEqual(requirementList(guideRequirements('Lectura sobre la historia del arte',{visualMode:'none'})),[]);
});
test('a code block must hold code, not a title',()=>{
 for(const t of ['Solución del Ejercicio 1 (Ventas por país del cliente)','Árbol de directorios del proyecto Data Warehouse',''])assert.equal(isRealCode(t),false,t);
 for(const t of ['SELECT * FROM ventas;','ng generate component mini-proyecto','proyecto/\n├── sql/\n└── datos/','CREATE TABLE dim_tiempo (\n id INT PRIMARY KEY\n);'])assert.equal(isRealCode(t),true,t);
 assert.match(requirementIssue([{type:'code',text:'Solución del Ejercicio 1'}],[]),/no contiene código/);
 assert.match(requirementIssue([{type:'paragraph',text:'Ejercicio 1: consulta.'}],['exercises','solutions','code']),/soluciones/i);
 assert.equal(requirementIssue([{type:'list',items:['Ejercicio 1: ventas por país']},{type:'paragraph',text:'Solución del ejercicio 1:'},{type:'code',text:'SELECT pais, SUM(total) FROM ventas GROUP BY pais;'}],['exercises','solutions','code']),undefined);
});
test('every requested element is assigned to a chapter',()=>{
 const chapters=assignRequirements([{},{},{},{}],['code','diagram','exercises','solutions']);
 assert.ok(chapters[1].includes.includes('diagram'));assert.ok(chapters[3].includes.includes('exercises')&&chapters[3].includes.includes('solutions'));assert.ok(chapters.some(c=>c.includes.includes('code')));
});
test('a page without the requested diagram is written again with that correction',async()=>{
 let drafts=0,correction='';
 const words='La dimensión de tiempo organiza las fechas del almacén de datos y permite analizar las ventas por día, mes y año con consultas agregadas. '.repeat(8);
 const provider={generate:async(system,prompt,schema)=>{
  if(schema.properties.chapters)return {text:JSON.stringify({title:'Modelo estrella',guideType:'Estudio',objectives:['Comprender el esquema','Aplicarlo'],chapters:[{title:'El esquema estrella',brief:'Explicar hechos y dimensiones'}]}),usage:{}};
  drafts++;if(drafts===2)correction=prompt;
  const blocks=[{type:'paragraph',text:words}];
  if(drafts>1)blocks.push({type:'diagram',text:'',items:['Tabla de hechos: ventas','Dimensión tiempo','Dimensión producto','Dimensión cliente']});
  return {text:JSON.stringify({blocks}),usage:{}};
 }};
 const result=await generateGuidePublication({provider,system:'',prompt:'',topic:'Guía de estudio del modelo estrella con un diagrama del esquema',parameters:{guideType:'Estudio',pages:2,visualMode:'none'},teacher:{},citations:[],initialUsage:'t',reserve:async()=>'',record:async()=>{}});
 assert.equal(drafts,2);assert.match(correction,/Falta el diagrama pedido/);assert.match(correction,/Esta página DEBE incluir/);
 assert.equal(result.blocks.filter(b=>b.type==='diagram').length,1);
});
test('a picture never ends up alone on a page',()=>{
 const {paginateGuideChapter,guidePageFits}=require('../dist/exports/guide-publication');
 const para=i=>({id:'p'+i,type:'paragraph',text:`Párrafo ${i}: `+'El modelo estrella organiza las ventas en una tabla de hechos rodeada de dimensiones. '.repeat(5)});
 const blocks=[];for(let i=0;guidePageFits('Apartado',[...blocks,para(i)]);i++)blocks.push(para(i));
 const pages=paginateGuideChapter('Apartado',[...blocks,{id:'img',type:'image',text:'',assetId:'a',caption:'Esquema estrella',width:100}]);
 assert.ok(pages.every(p=>!(p.blocks.length===1&&p.blocks[0].type==='image')),JSON.stringify(pages.map(p=>p.blocks.map(b=>b.type))));
 assert.equal(pages.flatMap(p=>p.blocks).length,blocks.length+1);
});
test('a photo the visual check rejects is not used; the next search is tried',async()=>{
 const {illustrateGuide}=require('../dist/ai/guide-images');
 const data={title:'Modelo estrella',objectives:['x'],blocks:[{id:'a',type:'paragraph',text:'Texto del apartado.',page:2}],publication:{pageTitles:['Esquema'],pageCount:2,imageSearches:[{query:'star schema',chapter:1},{query:'data warehouse',chapter:1}]}};
 const found={'star schema':{id:'satellite',source:'s1',caption:'Gaia satellite'},'data warehouse':{id:'dw',source:'s2',caption:'Data warehouse diagram'}};
 const checked=[];
 await illustrateGuide(data,{userId:'t',topic:'Data warehouse',mode:'references',citations:[],reserve:async()=>{},visuals:{reference:async(user,q)=>found[q]||null},isRelevant:async id=>{checked.push(id);return id!=='satellite';}});
 const images=data.blocks.filter(b=>b.type==='image').map(b=>b.assetId);
 assert.deepEqual(images,['dw']);assert.ok(checked.includes('satellite'));
});
test('captures of the expected result become images (terminal, API and web page)',async()=>{
 const {renderGuideCaptures}=require('../dist/exports/guide-captures');
 const saved=[];const save=async(png,caption)=>{assert.equal(png.subarray(1,4).toString(),'PNG');saved.push(caption);return '00000000-0000-4000-8000-00000000000'+saved.length;};
 const blocks=await renderGuideCaptures([
  {id:'a',type:'paragraph',text:'Paso 1',page:2},
  {id:'b',type:'capture',page:2,capture:{kind:'terminal',command:'java Calculadora',output:'Suma: 12'}},
  {id:'c',type:'capture',page:2,capture:{kind:'api',method:'GET',url:'http://localhost:8080/api/tareas',status:200,response:'[{"id":1}]'}},
  {id:'d',type:'capture',page:2,capture:{kind:'web',title:'Lista de tareas',html:'<html><body><h1>Mis tareas</h1></body></html>'}},
 ],save);
 assert.equal(blocks[0].type,'paragraph');
 assert.deepEqual(blocks.slice(1,3).map(b=>b.type),['image','image']);assert.match(blocks[1].caption,/Salida esperada en la terminal/);assert.match(blocks[2].caption,/Respuesta esperada de GET/);
 // The web capture needs a browser: an image when one is installed, otherwise a short note (never a broken guide).
 assert.ok(blocks[3].type==='image'?/Así debería verse/.test(blocks[3].caption):/Resultado esperado/.test(blocks[3].text));
});
test('a programming page with code but no capture of its result is written again',async()=>{
 let drafts=0,correction='';
 const provider={generate:async(system,prompt,schema)=>{
  if(schema.properties.chapters)return {text:JSON.stringify({title:'Calculadora Java',guideType:'Práctica paso a paso',objectives:['Crear la clase','Ejecutar'],chapters:[{title:'Clase principal',brief:'Escribir y ejecutar la calculadora'}]}),usage:{}};
  drafts++;if(drafts===2)correction=prompt;
  const blocks=[{type:'list',items:['1. Abre NetBeans y crea el proyecto Calculadora.','2. Pega el código en la clase principal.','3. Ejecuta el proyecto con F6.']},{type:'code',filePath:'src/calculadora/Calculadora.java',language:'java',text:'public class Calculadora {\n  public static void main(String[] a){ System.out.println("Suma: " + (8+4)); }\n}'}];
  if(drafts>1)blocks.push({type:'capture',capture:{kind:'terminal',title:'Salida en NetBeans',command:'run',output:'Suma: 12'}});
  return {text:JSON.stringify({blocks}),usage:{}};
 }};
 const data=await generateGuidePublication({provider,system:'',prompt:'',topic:'Calculadora en Java con NetBeans',parameters:{guideType:'Práctica paso a paso',pages:2},teacher:{},citations:[],initialUsage:'t',reserve:async()=>'',record:async()=>{}});
 assert.equal(drafts,2);assert.match(correction,/Falta la captura del resultado esperado/);
 assert.equal(data.blocks.filter(b=>b.type==='capture').length,1);
});
test('a capture never ends up alone on a page either',()=>{
 const {paginateGuideChapter,guidePageFits}=require('../dist/exports/guide-publication');
 const para=i=>({id:'p'+i,type:'paragraph',text:`Párrafo ${i}: `+'La clase Calculadora encapsula las operaciones y el menú muestra las opciones al usuario. '.repeat(5)});
 const blocks=[];for(let i=0;guidePageFits('Apartado',[...blocks,para(i)]);i++)blocks.push(para(i));
 const pages=paginateGuideChapter('Apartado',[...blocks,{id:'c',type:'capture',text:'',capture:{kind:'terminal',title:'Salida',output:'Suma: 12'}}]);
 assert.ok(pages.every(p=>!(p.blocks.length===1&&p.blocks[0].type==='capture')));
});
test('a page cut off by the output limit is written again instead of losing the guide',async()=>{
 const {ServiceUnavailableException}=require('@nestjs/common');let drafts=0,correction='';
 const words='Una API REST expone recursos mediante rutas y verbos HTTP; el controlador recibe la solicitud y devuelve JSON. '.repeat(10);
 const provider={generate:async(system,prompt,schema)=>{
  if(schema.properties.chapters)return {text:JSON.stringify({title:'API REST',guideType:'Estudio',objectives:['Comprender REST','Probar la API'],chapters:[{title:'Conceptos',brief:'Explicar REST'}]}),usage:{}};
  drafts++;if(drafts===1)throw new ServiceUnavailableException('La IA devolvió un resultado vacío o incompleto. Reduce la cantidad de contenido solicitado.');
  correction=prompt;return {text:JSON.stringify({blocks:[{type:'paragraph',text:words}]}),usage:{}};
 }};
 const data=await generateGuidePublication({provider,system:'',prompt:'',topic:'Estudio de conceptos de una API REST',parameters:{guideType:'Estudio',pages:2,visualMode:'none'},teacher:{},citations:[],initialUsage:'t',reserve:async()=>'',record:async()=>{}});
 assert.equal(drafts,2);assert.match(correction,/superó el límite de longitud/);assert.equal(data.blocks.length,1);
});
