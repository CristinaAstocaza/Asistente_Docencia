process.env.STORAGE_DRIVER='local';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {ImageGenerationProvider}=require('../dist/visual/visual.module');
const {AIProvider}=require('../dist/ai/provider');
test('image requests use their separate key while text requests keep the original key',async()=>{
 const previous={image:process.env.GEMINI_IMAGE_API_KEY,text:process.env.GEMINI_API_KEY,model:process.env.GEMINI_IMAGE_MODEL},originalFetch=global.fetch;
 const seen=[];process.env.GEMINI_IMAGE_API_KEY='image-test-key';process.env.GEMINI_API_KEY='text-test-key';process.env.GEMINI_IMAGE_MODEL='image-test-model';
 global.fetch=async(url,init)=>{seen.push({url:String(url),key:init.headers['x-goog-api-key']});return {ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:'Test response'},{inlineData:{mimeType:'image/png',data:Buffer.from('image').toString('base64')}}]}}]})};};
 try{
  await new ImageGenerationProvider().generate('Test');await new AIProvider().generate('System','Text');
  assert.equal(seen[0].key,'image-test-key');assert.match(seen[0].url,/image-test-model/);assert.equal(seen[1].key,'text-test-key');
 }finally{
  global.fetch=originalFetch;
  for(const [name,value] of [['GEMINI_IMAGE_API_KEY',previous.image],['GEMINI_API_KEY',previous.text],['GEMINI_IMAGE_MODEL',previous.model]]){if(value===undefined)delete process.env[name];else process.env[name]=value;}
 }
});
