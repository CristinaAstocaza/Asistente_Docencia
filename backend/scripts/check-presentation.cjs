// Build reviewable exports. --ai makes one real generation call; image searches use Wikimedia.
const {mkdir,writeFile,readFile}=require('node:fs/promises');
const {resolve}=require('node:path');
require('../dist/config');
const {buildPresentationScene,renderPresentationPptx,renderPresentationPdf}=require('../dist/exports/presentation-render');
const {presentationImages}=require('../dist/exports/presentation-images');
const {createCanvas}=require('@napi-rs/canvas');
const {contracts,agentPrompts}=require('../dist/ai/contracts');
async function main(){
 let data={title:'Inteligencia artificial en el aula',style:'moderno',imageMode:'internet',slides:[
  {title:'Inteligencia artificial en el aula',subtitle:'Comprender sus posibilidades y aprender a usarla con criterio.',content:['Una guía práctica para explorar, contrastar y aplicar.'],layout:'title',imageQuery:'artificial intelligence robot',notes:'Presenta el tema como una oportunidad para aprender y desarrollar criterio, no como un reemplazo del trabajo docente.'},
  {title:'De los datos a una respuesta',content:['Un modelo identifica patrones en ejemplos y los utiliza para elaborar una respuesta ante una nueva solicitud.','La calidad depende de los datos, del contexto y de cómo formulamos la tarea; una respuesta fluida puede contener errores.','Ejemplo: pedir una explicación para secundaria requiere indicar el nivel, el objetivo y los conocimientos previos.'],layout:'bullets',takeaway:'Una respuesta convincente siempre necesita revisión.',imageQuery:'artificial intelligence robot',notes:'Explica la diferencia entre reconocer patrones y comprender como una persona. Pide al grupo ejemplos de respuestas correctas y erróneas.'},
  {title:'Un proceso que mantiene al docente al mando',content:['Define qué debe aprender el estudiante y qué evidencia permitirá comprobarlo.','Usa la IA para proponer ejemplos, preguntas o un primer borrador; contrasta el resultado con fuentes confiables.','Adapta el material al aula y evalúa si la actividad exige comprender, argumentar y aplicar.'],layout:'two-column',visual:{type:'diagram',items:[{label:'Definir el objetivo'},{label:'Crear un borrador'},{label:'Contrastar y adaptar'},{label:'Aplicar y evaluar'}]},imageQuery:'classroom students',notes:'Recorre cada etapa con un ejemplo de tu curso. No compartas información personal de los estudiantes.'},
  {title:'Beneficios y límites: comparar para decidir',content:['Apoyo: permite explorar distintas explicaciones y ejemplos para un mismo concepto. El docente decide cuáles son pertinentes.','Límite: puede omitir contexto o inventar referencias. Revisa hechos, citas y adecuación al nivel educativo.','Aplicación: compara dos borradores de una actividad e identifica cuál exige mayor razonamiento y por qué.'],layout:'two-column',imageQuery:'classroom students',notes:'Promueve una comparación basada en criterios, no en qué texto parece más elaborado.'},
  {title:'Actividad: mejorar una solicitud',content:['En parejas, comparen «Explícame la fotosíntesis» con una solicitud que indique nivel, objetivo, ejemplo y una pregunta final.','Redacten su propia versión y anticipen qué datos debería incluir una buena respuesta.','Revisen el resultado: señalen un acierto, una afirmación por verificar y una mejora. Compartan la justificación.'],layout:'activity',imageQuery:'students learning classroom',takeaway:'La meta es aprender a formular, contrastar y argumentar.',notes:'Ofrece una lista de cotejo: claridad del objetivo, pertinencia del ejemplo, exactitud y evidencia de comprensión.'},
  {title:'Tres decisiones para usar la IA con criterio',content:['Empieza por el aprendizaje esperado: el recurso tiene sentido cuando contribuye a un objetivo educativo concreto.','Verifica los resultados y conserva el juicio docente: comprueba hechos, fuentes y lenguaje antes de llevarlos al aula.','Evalúa el proceso: pide que el estudiante explique cómo contrastó, corrigió y aplicó lo aprendido.'],layout:'conclusion',imageQuery:'teacher classroom',takeaway:'La IA propone; el docente revisa y el estudiante aprende.',notes:'Cierra con una pregunta: ¿qué tarea de tu curso mejorarías y cómo comprobarías que la mejora beneficia al aprendizaje?'}
 ]};
 if(process.argv.includes('--saved'))data=JSON.parse(await readFile(resolve('../artifacts/presentacion-didactica.json'),'utf8'));
 if(process.argv.includes('--ai')){
  const {AIProvider}=require('../dist/ai/provider');const {z}=require('zod');
  const result=await new AIProvider().generate(agentPrompts.presentation,'Crea 6 diapositivas sobre inteligencia artificial en el aula para docentes, estilo moderno, imageMode=internet, detail=extended. No tienes fuentes para cifras: usa ejemplos y diagramas, sin porcentajes ni citas inventadas.',z.toJSONSchema(contracts.presentation,{unrepresentable:'any'}));
  data=contracts.presentation.parse(JSON.parse(result.text));data.imageMode='internet';
 }
 const images=await presentationImages(data),scene=buildPresentationScene(data,images);
 const folder=resolve('../artifacts');await mkdir(folder,{recursive:true});
 await writeFile(resolve(folder,'presentacion-didactica.pptx'),await renderPresentationPptx(scene));
 const bytes=await renderPresentationPdf(scene);await writeFile(resolve(folder,'presentacion-didactica.pdf'),bytes);
 await writeFile(resolve(folder,'presentacion-didactica.json'),JSON.stringify(data,null,2));
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');const pdf=await pdfjs.getDocument({data:new Uint8Array(bytes),isEvalSupported:false}).promise;
 try{for(let i=1;i<=Math.min(6,pdf.numPages);i++){const page=await pdf.getPage(i),viewport=page.getViewport({scale:1.4}),canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;await writeFile(resolve(folder,`presentacion-didactica-${i}.png`),canvas.toBuffer('image/png'));}}finally{await pdf.destroy();}
 console.log(JSON.stringify({slides:scene.slides.length,images:scene.imageCount,pptx:'artifacts/presentacion-didactica.pptx',pdf:'artifacts/presentacion-didactica.pdf'}));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
