process.env.STORAGE_DRIVER='local';process.env.PRESENTATION_IMAGES='off';
process.env.DATABASE_DRIVER='pglite';process.env.PGLITE_PATH='memory://';process.env.DOC_WORKER_DISABLED='1';process.env.NODE_ENV='test';
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {readFile,mkdtemp,rm}=require('node:fs/promises');const {tmpdir}=require('node:os');const {join}=require('node:path');const {randomUUID}=require('node:crypto');
const {createApp}=require('../dist/main');const {Database}=require('../dist/database/database');const {AIProvider}=require('../dist/ai/provider');
const {syllabusWeeks}=require('../dist/courses/courses.module');
const syllabus=require('./fixtures/syllabus.cjs');
const {createTeacher}=require('./accounts.cjs');
let app,base,db,storage,cookies='',prompts=[];
const call=async(path,body,method=body===undefined?'GET':'POST')=>{const r=await fetch(base+path,{method,headers:{Cookie:cookies,...(body!==undefined?{'Content-Type':'application/json'}:{})},body:body===undefined?undefined:JSON.stringify(body)});const c=r.headers.getSetCookie();if(c.length)cookies=c.map(v=>v.split(';')[0]).join('; ');return r;};
const session={title:'Sesión',area:'Unidad',course:'Curso',topic:'Tema',duration:200,competency:'Comunica',outcome:'Al finalizar la sesión, el estudiante diseña un mensaje oral, aplicando recursos expresivos.',methodology:'Aprendizaje activo',stages:[{name:'Inicio',minutes:30,activities:['**Situación problema**: caso'],resources:['PPT']},{name:'Desarrollo',minutes:120,activities:['**Trabajo colaborativo**: análisis'],resources:['Caso impreso']},{name:'Cierre',minutes:40,activities:['**Metacognición**: preguntas'],resources:['Rúbrica']}],assessment:'Evaluación formativa',evidence:['Esquema del mensaje'],bibliography:['Autor (2024). Libro.'],evaluationType:'Formativa',instrument:'Lista de cotejo',caseStudy:{title:'La radio comunitaria de Pisco',scenario:'Una radio comunitaria (ficticia) pierde oyentes porque sus locutores no se expresan con claridad.',facts:['Audiencia: 40 % menos en 6 meses'],questions:['¿Qué recursos expresivos fallan?','¿Qué propondrías?']}};
const slide=(t,section,layout='bullets')=>({title:t,section,layout,content:['Explicación del tema con un ejemplo concreto.'],notes:'Notas.',visualSuggestion:'Imagen.'});
const deck={title:'Presentación',style:'académico',structure:['Inicio','Desarrollo','Cierre'],slides:[slide('Portada','Inicio','title'),slide('Inicio','Inicio','section'),slide('Logro','Inicio'),slide('Saberes previos','Inicio'),slide('Desarrollo','Desarrollo','section'),slide('Concepto 1','Desarrollo'),slide('Concepto 2','Desarrollo'),slide('Concepto 3','Desarrollo'),slide('Situación retadora: La radio comunitaria de Pisco','Desarrollo'),slide('Actividad en equipos','Desarrollo','activity'),slide('Cierre','Cierre','section'),slide('Conclusión','Cierre','conclusion')]};
const level=(name,score)=>({name,score,description:'Descriptor observable del nivel.'});
const rubric={title:'Rúbrica del mensaje oral',scoringMode:'weighted',criteria:['Claridad','Recursos','Estructura','Propuesta'].map(name=>({name,definition:'Qué se evalúa',weight:25,levels:[level('Estándar esperado',4),level('En proceso 2',3),level('En proceso 1',2),level('Inicial',1)]}))};
const activity={title:'Actividad',achievement:'Logro',generalInstructions:'Indicaciones',specificInstructions:['Paso 1'],recommendations:['Revisa'],submission:['Entrega'],evaluation:'Rúbrica'};
before(async()=>{
 storage=await mkdtemp(join(tmpdir(),'docente-courses-'));process.env.STORAGE_PATH=storage;
 app=await createApp();db=app.get(Database);await db.executeSchema(await readFile('src/database/schema.sql','utf8'));
 for(const provider of app.get(AIProvider,{each:true})){provider.embed=async()=>[1,...Array(767).fill(0)];let sessions=0;provider.generate=async(system,prompt,schema)=>{prompts.push(prompt);const p=schema?.properties||{};const weak=p.stages&&sessions++===0;return {text:JSON.stringify(p.stages?(weak?{...session,outcome:'Al finalizar la sesión, el estudiante comprende los recursos expresivos.'}:session):p.slides?deck:p.criteria?rubric:activity),usage:{}};};}
 await app.listen(0,'127.0.0.1');base=await app.getUrl()+'/api';
},{timeout:120000});
after(async()=>{if(app)await app.close();if(storage)await rm(storage,{recursive:true,force:true});});
test('syllabus weeks follow the schedule and units',()=>{
 const weeks=syllabusWeeks(syllabus);assert.equal(weeks.length,18);assert.equal(weeks[0].unitNumber,1);assert.ok(weeks[0].topic.length>3);
});
test('accepting a syllabus creates a course whose weeks generate a session, slides and an activity',async()=>{
 cookies=(await createTeacher(base,{name:'Docente',email:'c@example.test',password:'password123',institution:'UNICA'})).cookies;
 const [user]=await db.query("SELECT id FROM users WHERE email='c@example.test'");const id=randomUUID();
 await db.query('INSERT INTO generated_content(id,user_id,kind,title,data,source_ids,citations,mode) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[id,user.id,'syllabus','Sílabo',JSON.stringify({...syllabus,generalData:{...syllabus.generalData,courseCode:'1P35024',weeklyHours:4}}),'[]','[]','general']);
 // The syllabus can be previewed as its PDF without being accepted, and the preview is not counted as an export.
 const preview=await call(`/content/${id}/syllabus-preview`);assert.equal(preview.status,200);assert.equal(Buffer.from(await preview.arrayBuffer()).subarray(0,5).toString(),'%PDF-');
 assert.equal((await db.query('SELECT count(*)::int AS n FROM exports WHERE content_id=$1',[id]))[0].n,0);
 const accepted=await call('/courses',{syllabusId:id});assert.equal(accepted.status,201);const course=await accepted.json();
 assert.equal(course.code,'1P35024');assert.equal(course.weeks.length,18);assert.ok(course.weeks.every(w=>w.status==='pending'));
 assert.equal((await call('/courses',{syllabusId:id})).status,201);assert.equal((await (await call('/courses')).json()).length,1);
 // Course sources: only the teacher's own documents can be chosen.
 assert.equal((await call(`/courses/${course.id}/sources`,{sourceIds:[randomUUID()]})).status,404);
 assert.deepEqual((await (await call(`/courses/${course.id}/sources`,{sourceIds:[]})).json()).source_ids,[]);
 const started=await (await call(`/courses/${course.id}/weeks/2/generate`,{})).json();assert.equal(started.status,'generating');
 let week;for(let i=0;i<100;i++){week=(await (await call(`/courses/${course.id}`)).json()).weeks.find(w=>w.week===2);if(week.status!=='generating')break;await new Promise(r=>setTimeout(r,100));}
 assert.equal(week.status,'ready',week.error);assert.ok(week.session_id&&week.presentation_id&&week.activity_id);
 const s=await (await call(`/content/${week.session_id}`)).json();assert.equal(s.data.sessionNumber,2);assert.equal(s.data.courseCode,'1P35024');assert.equal(s.data.duration,200);
 assert.ok(prompts.some(p=>/Semana 2/.test(p)&&/SIN entregar aún todos los datos del caso/.test(p)));
 assert.match(s.data.outcome,/diseña/);assert.ok(prompts.some(p=>/CORRECCIÓN OBLIGATORIA: el logro propuesto usaba «comprende»/.test(p)));
 const a=await (await call(`/content/${week.activity_id}`)).json();assert.equal(a.data.achievement,s.data.outcome);
 // The same case travels from the session to the slides and the activity; the activity names its rubric.
 assert.equal(a.data.caseStudy.title,'La radio comunitaria de Pisco');assert.match(a.data.evaluation,/rúbrica «Rúbrica del mensaje oral».*Claridad \(25 %\)/);
 const d=await (await call(`/content/${week.presentation_id}`)).json();const slideIndex=d.data.slides.findIndex(x=>x.title==='Caso: La radio comunitaria de Pisco');
 // UNICA sequence: the full case comes after the concepts, right before the team activity.
 assert.ok(slideIndex>0);assert.equal(d.data.slides[slideIndex].section,'Desarrollo');assert.equal(d.data.slides[slideIndex+1].layout,'activity');assert.ok(d.data.slides.findIndex(x=>x.title==='Concepto 1')<slideIndex);
 const hook=d.data.slides.findIndex(x=>x.title.startsWith('Situación retadora'));assert.equal(d.data.slides[hook].section,'Inicio');assert.equal(d.data.slides[hook-1].layout,'section');
 assert.ok(prompts.some(p=>/CASO DE LA SESIÓN \(úsalo tal cual\): «La radio comunitaria de Pisco»/.test(p)));
 assert.ok(week.rubric_id);assert.equal((await call(`/content/${week.rubric_id}/export`,{format:'pdf'})).status,201);
 const act=await call(`/content/${week.activity_id}/export`,{format:'docx'});const JSZip=require('jszip');const ax=await (await JSZip.loadAsync(Buffer.from(await act.arrayBuffer()))).file('word/document.xml').async('string');assert.match(ax,/3\. CASO DE ESTUDIO/);assert.match(ax,/La radio comunitaria de Pisco/);assert.match(ax,/Claridad/);assert.equal(a.data.rubric.criteria.length,4);assert.equal(a.data.sessionNumber,2);
 const sd=await call(`/content/${week.session_id}/export`,{format:'docx'});const sx=await (await JSZip.loadAsync(Buffer.from(await sd.arrayBuffer()))).file('word/document.xml').async('string');for(const t of ['SESIÓN DE APRENDIZAJE N° 2','II. LOGRO DE APRENDIZAJE','CONTENIDO Y CONDICIÓN','SE ANALIZA EN EL DESARROLLO','Distribución del tiempo','VI. BIBLIOGRAFÍA'])assert.ok(sx.includes(t),t);
 const docx=await call(`/content/${week.session_id}/export`,{format:'pdf'});assert.equal(docx.status,201);
 const ppt=await call(`/content/${week.presentation_id}/export`,{format:'pptx'});assert.equal(ppt.status,201);
 // «Regenerar PPT»: only the presentation is rebuilt.
 const again=await (await call(`/courses/${course.id}/weeks/2/presentation`,{})).json();assert.equal(again.status,'generating');
 let redone;for(let i=0;i<100;i++){redone=(await (await call(`/courses/${course.id}`)).json()).weeks.find(w=>w.week===2);if(redone.status!=='generating')break;await new Promise(r=>setTimeout(r,100));}
 assert.equal(redone.status,'ready',redone.error);assert.notEqual(redone.presentation_id,week.presentation_id);
 for(const k of ['session_id','activity_id','rubric_id'])assert.equal(redone[k],week[k],k);
 const other={};const r=await fetch(base+`/courses/${course.id}`,{headers:{}});assert.equal(r.status,401);
});
