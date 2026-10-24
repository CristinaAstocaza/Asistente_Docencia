process.env.STORAGE_DRIVER='local';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {AIService}=require('../dist/ai/ai.module');
const {generationInput}=require('../dist/ai/contracts');
const ids=['00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002'];

test('generation includes every owned reference and preserves their structures in the saved snapshot',async()=>{
 const templates=ids.map((id,i)=>({id,name:`reference-${i}.pdf`,structure:{sections:[{title:`Section ${i}`,description:`Structure ${i}`}],notes:''}}));
 let prompt='',snapshot;const lookups=[];
 const db={query:async(sql,args)=>{
  if(sql.includes('FROM institutional_templates')){assert.equal(args[1],'teacher');lookups.push(args[0]);return templates.filter(t=>t.id===args[0]);}
  if(sql.startsWith('UPDATE generated_content')){snapshot=JSON.parse(args[2]);return [];}
  return [{id:ids[0],name:'Teacher'}];
 }};
 const service=new AIService(db,{generate:async(_,text)=>{prompt=text;return {text:JSON.stringify({title:'Summary',sections:[{title:'Overview',content:'Educational content'}]}),usage:{}};}});
 service.reserve=async()=>'';service.record=async()=>{};service.context=async()=>({context:'',citations:[]});
 const input=generationInput.parse({kind:'summary',topic:'Study',templateId:ids[0],templateIds:ids,templateMode:'structure'});
 await service.generate('teacher',input);
 assert.deepEqual(lookups,ids);
 for(const template of templates){assert.ok(prompt.includes(template.name));assert.ok(prompt.includes(template.structure.sections[0].title));}
 assert.deepEqual(snapshot.structure.references.map(t=>t.id),ids);
});

test('foreign or missing references reject generation before any model request',async()=>{
 const service=new AIService({query:async()=>[]},{generate:async()=>{throw Error('Must not call provider');}});
 await assert.rejects(()=>service.generate('other',generationInput.parse({kind:'guide',topic:'Study',templateIds:ids})),/Plantilla no encontrada/);
 assert.equal(generationInput.safeParse({kind:'guide',topic:'Study',templateIds:Array(11).fill(ids[0])}).success,false);
});
