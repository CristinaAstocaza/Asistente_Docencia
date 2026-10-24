require('../dist/config');
async function main(){
 const key=process.env.GEMINI_API_KEY;if(!key)throw new Error('Falta la clave de IA.');
 if(process.argv.includes('--models')) {
  const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models',{headers:{'x-goog-api-key':key},signal:AbortSignal.timeout(30000)});
  const data=await response.json();console.log((data.models||[]).filter(m=>m.supportedGenerationMethods?.includes('generateContent')).map(m=>m.name).join('\n'));return;
 }
 const model=process.env.GEMINI_MODEL||'gemini-3.8-flash';
 const {contracts}=require('../dist/ai/contracts');const {z}=require('zod');
 const {providerSchema}=require('../dist/ai/provider');
 const kind=process.argv.find(arg=>arg.startsWith('--kind='))?.split('=')[1]||'lesson';
 const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{parts:[{text:'Escribe material breve sobre sumas en español.'}]}],generationConfig:{responseFormat:{text:{mimeType:'APPLICATION_JSON',schema:providerSchema(z.toJSONSchema(contracts[kind],{unrepresentable:'any'}))}},maxOutputTokens:2000}}),signal:AbortSignal.timeout(60000)});
 const data=await response.json();console.log(`HTTP ${response.status}`);
 if(data.error)console.log(String(data.error.message||data.error.status).split(key).join('[redacted]').slice(0,800));
 else console.log(`Resultado: ${data.candidates?.[0]?.finishReason||'empty'}`);
}
main().catch(()=>{console.error('No se pudo diagnosticar la conexión.');process.exitCode=1;});
