import {test,expect} from '@playwright/test';
import {createRequire} from 'node:module';
test.beforeEach(async({page})=>{await page.route('**/api/templates',r=>r.fulfill({json:[]}));});
test('each material studio keeps its fields and generates the right kind on desktop and mobile',async({page})=>{
 await page.route('**/api/auth/me',r=>r.fulfill({json:{id:'teacher',name:'Docente',email:'docente@example.test',institution:'Instituto'}}));
 await page.route('**/api/documents',r=>r.fulfill({json:[]}));
 await page.route('**/api/content',r=>r.fulfill({json:[]}));
 let sent:Record<string,unknown>={};
 await page.route('**/api/generate',r=>{sent=r.request().postDataJSON();return r.fulfill({status:400,json:{message:'Solicitud verificada'}});});
 const sections=[['clases','lesson','Preparar clase',7],['silabos','syllabus','Construir sílabo',18],['evaluaciones','exam','Generar evaluación',5],['rubricas','rubric','Construir rúbrica',2],['presentaciones','presentation','Crear presentación',5]] as const;
 for(const [path,kind,action,count] of sections){
  await page.setViewportSize({width:1440,height:1000});await page.goto(`/${path}`);
  await expect(page.locator(`.studio-${kind}`)).toBeVisible();
  await expect(page.locator('.studio-fields input,.studio-fields select,.studio-fields textarea')).toHaveCount(count);
  if(kind==='lesson'){
   await expect(page.getByRole('link',{name:'Sesiones',exact:true})).toHaveCount(0);
   await expect(page.getByLabel('Competencia (opcional)',{exact:true})).toBeHidden();
   await page.getByText('Más opciones (opcional)',{exact:true}).first().click();
   await page.getByLabel('Competencia (opcional)',{exact:true}).fill('Explicar fenómenos');
  }
  await expect(page.locator('.studio-blueprint')).toBeVisible();
  if(kind==='syllabus'){
   await expect(page.getByLabel('Semanas',{exact:true})).toHaveValue('18');
   await expect(page.getByLabel('Evaluaciones, pesos y semanas (opcional)',{exact:true})).toBeHidden();
   await page.getByText('Evaluación y bibliografía (opcional)',{exact:true}).first().click();
   await page.getByLabel('Evaluaciones, pesos y semanas (opcional)',{exact:true}).fill('Portafolio 100 %, semana 18');
  }
  await page.locator('.form-panel textarea').first().fill('Un tema para trabajar en el aula');
  await page.getByRole('button',{name:action,exact:true}).click();
  await expect(page.locator('.error-box')).toHaveText('Solicitud verificada');
  expect(sent.kind).toBe(kind);expect(Object.keys(sent.parameters as object)).toHaveLength(count+(kind==='presentation'?1:0));
  if(kind==='lesson')expect((sent.parameters as Record<string,unknown>).competency).toBe('Explicar fenómenos');
  if(kind==='syllabus')expect((sent.parameters as Record<string,unknown>).evaluationScheme).toBe('Portafolio 100 %, semana 18');
  await page.screenshot({path:`../artifacts/studio-${kind}.png`,fullPage:true});
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 }
});

test('academic syllabus shows ten sections, evaluation formula and complete weekly schedule on desktop and mobile',async({page})=>{
 const requireBackend=createRequire(`${process.cwd()}/../backend/package.json`);const data=requireBackend('./test/fixtures/syllabus.cjs');
 await page.route('**/api/auth/me',r=>r.fulfill({json:{id:'teacher',name:'Docente',email:'docente@example.test',institution:'Instituto'}}));
 await page.route('**/api/documents',r=>r.fulfill({json:[]}));
 await page.route('**/api/content/academic',r=>r.fulfill({json:{id:'academic',kind:'syllabus',title:data.title,data,source_ids:[],citations:[],mode:'general',version:1}}));
 await page.goto('/silabos?id=academic');
 await expect(page.getByRole('textbox',{name:'Curso',exact:true})).toHaveValue(data.course);
 await expect(page.getByRole('spinbutton',{name:'Semanas',exact:true})).toHaveValue('18');
 await expect(page.locator('.syllabus-document>section')).toHaveCount(10);
 await expect(page.locator('.syllabus-document table')).toHaveCount(3);
 await expect(page.locator('.syllabus-schedule tbody tr')).toHaveCount(18);
 await expect(page.locator('.syllabus-formula')).toContainText('(15 %) AP1');
 await expect(page.locator('.syllabus-unit')).toHaveCount(4);
 await page.locator('.syllabus-document').screenshot({path:'../artifacts/silabo-academico-desktop.png'});
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.locator('.syllabus-document').screenshot({path:'../artifacts/silabo-academico-mobile.png'});
 await page.getByRole('button',{name:'Editar',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'Fundamentación',exact:true})).toBeVisible();
});

test('daily lesson makes legacy instructions readable with lists, code and colored moments',async({page})=>{
 await page.route('**/api/auth/me',r=>r.fulfill({json:{id:'teacher',name:'Docente',email:'docente@example.test',institution:'Instituto'}}));
 await page.route('**/api/documents',r=>r.fulfill({json:[]}));
 const data={title:'Creación de una API para una base de datos temporal',objective:'Crear una API sencilla que guarde y consulte tareas en memoria.',introduction:'Duración: 10 minutos. Pregunta al grupo cómo una aplicación guarda sus tareas.',motivation:'¿Qué ocurre cuando presionamos «Guardar»? Recoge dos respuestas antes de explicar.',development:['**Una API** es el puente entre la aplicación y el servidor. El cliente solicita información y el servidor responde.','Usa GET para consultar tareas y POST para registrar una nueva.\n\n```js\nconst tareas = [{ id: 1, titulo: "Estudiar APIs" }];\n```'],examples:['El cliente solicita `GET /tareas` y recibe una lista en formato JSON.'],activity:'Duración: 20 minutos. Instrucciones: 1. Abrir el editor y crear el proyecto. 2. Definir una lista de tareas en memoria. 3. Crear la ruta GET y comprobar la respuesta. Materiales necesarios: computadora y editor de código.',closing:'Duración: 10 minutos. Pide a un estudiante explicar el recorrido de una petición.',questions:['¿Para qué sirve GET? **Respuesta orientativa:** consultar información.','¿Qué ocurre con los datos al reiniciar el servidor? **Respuesta orientativa:** se pierden porque están en memoria.']};
 await page.route('**/api/content/readable',r=>r.fulfill({json:{id:'readable',kind:'lesson',title:data.title,data,source_ids:[],citations:[],mode:'general',version:1}}));
 await page.goto('/clases?id=readable');
 await expect(page.locator('.lesson-part-activity ol li')).toHaveCount(3);
 await expect(page.locator('.lesson-part-development pre code')).toContainText('const tareas');
 await expect(page.locator('.lesson-part-development strong')).toHaveText('Una API');
 await expect(page.locator('.lesson-route-item')).toHaveCount(4);
 await page.screenshot({path:'../artifacts/clase-legible-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.screenshot({path:'../artifacts/clase-legible-mobile.png',fullPage:true});
});

test('presentation final preview loads the designed PDF and reuses it when reopened',async({page})=>{
 await page.route('**/api/auth/me',r=>r.fulfill({json:{id:'teacher',name:'Docente',email:'docente@example.test',institution:'Instituto'}}));
 await page.route('**/api/documents',r=>r.fulfill({json:[]}));
 await page.route('**/api/content/deck',r=>r.fulfill({json:{id:'deck',kind:'presentation',title:'Presentación visual',data:{title:'Presentación visual',style:'moderno',slides:[{title:'Introducción',content:['Concepto y ejemplo'],notes:'Explicación',visualSuggestion:'Fotografía educativa'}]},source_ids:[],citations:[],mode:'general',version:1}}));
 const requireBackend=createRequire(`${process.cwd()}/../backend/package.json`);
 const {buildPresentationScene,renderPresentationPdf}=requireBackend('./dist/exports/presentation-render');
 const bytes=await renderPresentationPdf(buildPresentationScene({title:'Presentación visual',style:'moderno',slides:[{title:'Introducción',content:['Concepto y ejemplo'],layout:'title',notes:'Explicación'}]}));
 let requests=0;
 await page.route('**/api/content/deck/presentation-preview',r=>{requests++;return r.fulfill({body:bytes,contentType:'application/pdf',headers:{'X-Presentation-Images':'5'}});});
 await page.goto('/presentaciones?id=deck');await page.getByRole('button',{name:'Ver diseño final'}).click();
 const dialog=page.getByRole('dialog',{name:'Diseño final de la presentación'});
 await expect(dialog.locator('iframe')).toHaveAttribute('src',/^blob:/);await expect(dialog).toContainText('5 imagen(es)');
 await page.getByRole('button',{name:'Cerrar diseño final'}).click();await expect(dialog).toHaveCount(0);
 await page.getByRole('button',{name:'Ver diseño final'}).click();await expect(dialog.locator('iframe')).toBeVisible();expect(requests).toBe(1);
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
});

test('class, session and syllabus show their complete content in their specific layouts',async({page})=>{
 await page.route('**/api/auth/me',r=>r.fulfill({json:{id:'teacher',name:'Docente',email:'docente@example.test',institution:'Instituto'}}));
 await page.route('**/api/documents',r=>r.fulfill({json:[]}));
 const examples=[
  {path:'clases',kind:'lesson',selector:'.lesson-sections',data:{title:'Clase de prueba',objective:'Comprender un concepto',introduction:'Situación inicial',motivation:'Pregunta motivadora',development:['Concepto central'],examples:['Ejemplo práctico'],activity:'Trabajo en equipo',closing:'Síntesis final',questions:['Reflexión final']}},
  {path:'sesiones',kind:'session',selector:'.session-stage',data:{title:'Sesión de prueba',area:'Ciencia',course:'Biología',duration:60,competency:'Explicar fenómenos',outcome:'Interpretar evidencias',methodology:'Indagación',stages:['Inicio','Desarrollo','Cierre'].map(name=>({name,minutes:20,activities:[`Actividad de ${name}`],resources:['Cuaderno']})),assessment:'Lista de cotejo'}},
  {path:'silabos',kind:'syllabus',selector:'.syllabus-unit',data:{title:'Sílabo de prueba',course:'Biología',credits:3,cycle:'II',description:'Curso introductorio',competency:'Investigar',outcomes:['Analizar'],units:[{title:'Células',weeks:['1','2'],topics:['Membrana'],outcomes:['Reconocer estructuras']}],methodology:'Proyectos',evaluation:['Exposición'],bibliography:['Lectura de referencia']}},
 ];
 for(const item of examples){
  await page.route('**/api/content/preview',r=>r.fulfill({json:{id:'preview',kind:item.kind,title:item.data.title,data:item.data,source_ids:[],citations:[],mode:'general',version:1}}));
  await page.goto(`/${item.path}?id=preview`);
  if(item.kind==='session')await expect(page).toHaveURL(/\/sesiones\?id=preview$/);
  await expect(page.locator(item.selector).first()).toBeVisible();
  if(item.kind==='lesson'){
   await expect(page.locator('.lesson-sections>section')).toHaveCount(4);
   for(const title of ['Cómo empezar','Qué explicar','Qué harán los estudiantes','Cómo cerrar'])await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();
   await expect(page.getByRole('link',{name:'Crear sesiones de aprendizaje'})).toHaveCount(1);
  }
  await expect(page.getByRole('button',{name:'Editar',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Editar',exact:true}).click();await expect(page.locator('.editor-group').first()).toBeVisible();
  await page.getByRole('button',{name:'Cancelar edición'}).click();
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.unroute('**/api/content/preview');
 }
});
