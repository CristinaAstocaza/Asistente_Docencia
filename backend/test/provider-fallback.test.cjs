process.env.GEMINI_API_KEY='test-key';process.env.GEMINI_MODEL='main-model';process.env.GEMINI_FALLBACK_MODELS='backup-model';process.env.AI_RETRY_ATTEMPTS='2';process.env.AI_TEXT_REQUESTS_PER_MINUTE='600';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {AIProvider}=require('../dist/ai/provider');
const ok=text=>new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text}]}}],usageMetadata:{}}),{status:200});
const busy=()=>new Response(JSON.stringify({error:{code:503,message:'high demand'}}),{status:503,headers:{'retry-after':'0.01'}});
test('a saturated main model retries and then hands the request to the backup model',async()=>{
 const calls=[];const real=global.fetch;
 global.fetch=async url=>{const model=String(url).match(/models\/([^:]+):/)[1];calls.push(model);return model==='main-model'?busy():ok('{"ok":true}');};
 try{const result=await new AIProvider().generate('sistema','prompt',{type:'object'});assert.equal(result.text,'{"ok":true}');}finally{global.fetch=real;}
 assert.deepEqual(calls,['main-model','main-model','backup-model']);
});
test('errors that are not saturation or quota are not retried on another model',async()=>{
 const calls=[];const real=global.fetch;
 global.fetch=async url=>{calls.push(String(url));return new Response(JSON.stringify({error:{code:400}}),{status:400});};
 try{await assert.rejects(()=>new AIProvider().generate('s','p'));}finally{global.fetch=real;}
 assert.equal(calls.length,1);
});
