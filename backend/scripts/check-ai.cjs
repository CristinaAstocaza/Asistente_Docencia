// A small, opt-in real-provider check. Does not upload teacher documents or log credentials.
const {AIProvider}=require('../dist/ai/provider');
const {contracts}=require('../dist/ai/contracts');
const {z}=require('zod');
async function main(){
 const provider=new AIProvider();
 const vector=await provider.embed('Dos pares forman cuatro.');
 console.log(`Embeddings: ${vector.length} dimensiones.`);
 const response=await provider.generate('Eres un planificador docente. Responde en español con una clase breve y fiel a la solicitud.','Prepara una clase breve sobre sumas: dos pares forman cuatro. Incluye un ejemplo y una pregunta.',z.toJSONSchema(contracts.lesson));
 const result=contracts.lesson.safeParse(JSON.parse(response.text));
 if(!result.success)throw new Error('El proveedor no devolvió una clase válida.');
 console.log('Generación estructurada de clase: correcta.');
 console.log(`Tokens de entrada: ${response.usage.promptTokenCount||0}; salida: ${response.usage.candidatesTokenCount||0}.`);
}
main().catch(error=>{console.error(error.message || 'No se pudo comprobar la IA.');process.exitCode=1;});
