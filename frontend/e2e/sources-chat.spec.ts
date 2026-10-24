import { test,expect } from '@playwright/test';
import { createRequire } from 'node:module';
const requireBackend=createRequire(`${process.cwd()}/../backend/package.json`);
const PptxGenJS=requireBackend('pptxgenjs');

test.beforeEach(async({page})=>{
 await page.route('**/api/auth/me',r=>r.fulfill({json:{id:'teacher',name:'Docente',email:'docente@example.test',institution:'Instituto'}}));
 await page.route('**/api/conversations',r=>r.fulfill({json:[]}));
 await page.route('**/api/conversations/*/attachments',r=>r.fulfill({json:[]}));
});

test('original images and PowerPoint slides display even when AI indexing failed',async({page})=>{
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aY1cAAAAASUVORK5CYII=','base64');
 const presentation=new PptxGenJS();presentation.layout='LAYOUT_WIDE';const slide=presentation.addSlide();slide.background={color:'E8EDF8'};
 slide.addText('Diapositiva original',{x:1,y:0.5,w:10,h:1,fontSize:30,bold:true,color:'14213D'});slide.addText('Contenido con formato',{x:1,y:2,w:6,h:1,fontSize:20});slide.addImage({data:`image/png;base64,${png.toString('base64')}`,x:9,y:2,w:1,h:1});
 const pptx=Buffer.from(await presentation.write({outputType:'nodebuffer'}));
 await page.route('**/api/documents',r=>r.fulfill({json:[{id:'image',name:'qr.png',type:'PNG',size:png.length,status:'error',error:'La IA no encontró texto.',folder:'',created_at:'2026-10-07'},{id:'slides',name:'original.pptx',type:'PPTX',size:pptx.length,status:'error',folder:'',created_at:'2026-10-07'}]}));
 await page.route('**/api/documents/image/download',r=>r.fulfill({body:png,contentType:'application/octet-stream'}));
 await page.route('**/api/documents/slides/download',r=>r.fulfill({body:pptx,contentType:'application/octet-stream'}));
 await page.goto('/fuentes');await page.getByRole('button',{name:'Vista previa de qr.png'}).click();
 const image=page.getByRole('img',{name:'qr.png'});await expect(image).toBeVisible();expect(await image.evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBe(1);
 await page.getByRole('button',{name:'Cerrar vista previa'}).click();
 await page.getByRole('button',{name:'Vista previa de original.pptx'}).click();
 const frame=page.frameLocator('iframe[title="Diapositivas del PowerPoint original"]');
 await expect(frame.getByText('Diapositiva original',{exact:true})).toBeVisible({timeout:30000});
 await expect(frame.getByText('Contenido con formato',{exact:true})).toBeVisible();
 await expect(frame.locator('img').first()).toBeVisible();
 expect(await frame.locator('body').evaluate(()=>{try{return !!parent.document.cookie;}catch{return 'isolated';}})).toBe('isolated');
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('chat renders Markdown and keeps two Word downloads after reopening',async({page})=>{
 const artifacts=[{id:'instructions',title:'Indicaciones',kind:'summary',data:{title:'Indicaciones',sections:[{title:'Entrega',content:'Trabajo en grupos de 4.'}]}},{id:'rubric',title:'Rúbrica',kind:'rubric',data:{title:'Rúbrica',criteria:[]}}];
 const answer='## Documentos preparados\n\n**Dos archivos** listos.\n\n- Indicaciones\n- Rúbrica\n\n| Criterio | Peso |\n| --- | --- |\n| Análisis | 100 % |';
 await page.route('**/api/documents',r=>r.fulfill({json:[]}));
 await page.route('**/api/conversations',r=>r.fulfill({json:[{id:'conversation',title:'Trabajo grupal'}]}));
 await page.route('**/api/chat',r=>r.fulfill({json:{conversationId:'conversation',content:answer,citations:[],artifacts}}));
 await page.route('**/api/conversations/conversation/messages',r=>r.fulfill({json:[{id:'assistant',role:'assistant',content:answer,artifacts}]}));
 await page.route('**/api/content/*/export',r=>r.fulfill({body:Buffer.from('PK-test-document'),contentType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}));
 await page.goto('/chat');await page.getByLabel('Tu mensaje').fill('Necesito indicaciones y una rúbrica');await page.getByRole('button',{name:'Enviar',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Documentos preparados'})).toBeVisible();await expect(page.locator('.chat-markdown strong')).toHaveText('Dos archivos');await expect(page.locator('.chat-markdown table')).toBeVisible();
 await expect(page.getByRole('button',{name:'Descargar Word',exact:true})).toHaveCount(2);
 for(const [i,title] of ['Indicaciones','Rúbrica'].entries()){
  const event=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar Word',exact:true}).nth(i).click();expect((await event).suggestedFilename()).toBe(`${title}.docx`);
 }
 await page.getByRole('button',{name:'Nueva conversación'}).click();await page.getByRole('button',{name:'Trabajo grupal',exact:true}).click();await expect(page.getByRole('button',{name:'Descargar Word',exact:true})).toHaveCount(2);
});

test('chat selects a source folder, uploads locally and accepts a pasted image as a format reference',async({page})=>{
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aY1cAAAAASUVORK5CYII=','base64');
 const files:{id:string;conversation_id:string;name:string;type:string;size:number;purpose:string}[]=[];let created=false;let sent:Record<string,unknown>={};
 await page.route('**/api/documents',r=>r.fulfill({json:[{id:'s1',name:'Artículo uno.pdf',folder:'IA',type:'PDF',status:'ready'},{id:'s2',name:'Artículo dos.pdf',folder:'IA',type:'PDF',status:'ready'},{id:'s3',name:'Otro.pdf',folder:'Otros',type:'PDF',status:'ready'}]}));
 await page.route('**/api/conversations',r=>{if(r.request().method()==='POST'){created=true;return r.fulfill({json:{id:'chat-local',title:'Ejemplos'}});}return r.fulfill({json:created?[{id:'chat-local',title:'Ejemplos'}]:[]});});
 await page.route('**/api/conversations/chat-local/attachments',r=>{
  if(r.request().method()==='POST'){const image=r.request().postDataBuffer()?.includes(Buffer.from('ejemplo.png'));const file={id:`local-${files.length+1}`,conversation_id:'chat-local',name:image?'ejemplo.png':'tema.txt',type:image?'PNG':'TXT',size:100,purpose:image?'reference':'content'};files.push(file);return r.fulfill({json:file});}return r.fulfill({json:files});
 });
 await page.route('**/api/conversations/chat-local/attachments/*/download',r=>r.fulfill({body:png,contentType:'image/png'}));
 await page.route('**/api/conversations/chat-local/attachments/*',r=>r.fulfill({json:{ok:true}}));
 await page.route('**/api/chat',r=>{sent=r.request().postDataJSON();return r.fulfill({json:{conversationId:'chat-local',content:'Usaré las fuentes y el ejemplo de formato de esta conversación.',citations:[],artifacts:[]}});});
 await page.goto('/chat');const folder=page.locator('.source-folder-group').filter({hasText:'IA'});await folder.locator('summary').click();await folder.getByRole('button',{name:'Seleccionar carpeta'}).click();await expect(page.getByText('2 fuente(s) seleccionada(s)',{exact:true})).toBeVisible();
 await page.locator('input[type=file]').setInputFiles({name:'tema.txt',mimeType:'text/plain',buffer:Buffer.from('Tema para esta conversación.')});await expect(page.locator('.chat-local-files')).toContainText('tema.txt');
 await page.getByLabel('Tu mensaje').evaluate((textarea,base64)=>{const transfer=new DataTransfer();transfer.items.add(new File([Uint8Array.from(atob(base64),c=>c.charCodeAt(0))],'ejemplo.png',{type:'image/png'}));textarea.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,clipboardData:transfer}));},png.toString('base64'));
 await expect(page.getByRole('combobox',{name:'Uso de ejemplo.png'})).toHaveValue('reference');await expect(page.locator('.chat-local-files img')).toBeVisible();
 await page.getByLabel('Tu mensaje').fill('Usa estos archivos y esta imagen como ejemplo de formato.');await page.getByRole('button',{name:'Enviar',exact:true}).click();await expect(page.getByText('Usaré las fuentes y el ejemplo de formato de esta conversación.')).toBeVisible();
 expect(sent.sourceIds).toEqual(['s1','s2']);expect(sent.attachmentIds).toEqual(['local-1','local-2']);expect(page.url()).toContain('/chat');
 await page.getByRole('button',{name:'Nueva conversación'}).click();await expect(page.locator('.chat-local-files')).toHaveCount(0);await expect(page.getByText('0 fuente(s) seleccionada(s)',{exact:true})).toBeVisible();
});

test('dictation writes a reviewable message without sending automatically',async({page})=>{
 await page.addInitScript(()=>{
  class FakeRecognition{
   lang='';continuous=false;interimResults=false;onstart:(()=>void)|null=null;onend:(()=>void)|null=null;onerror:((e:{error:string})=>void)|null=null;onresult:((e:{resultIndex:number;results:{isFinal:boolean;0:{transcript:string}}[]})=>void)|null=null;
   start(){setTimeout(()=>{this.onstart?.();this.onresult?.({resultIndex:0,results:[{isFinal:true,0:{transcript:'Crea una actividad sobre inteligencia artificial'}}]});this.onend?.();},30);}stop(){this.onend?.();}abort(){this.onend?.();}
  }Object.assign(window,{SpeechRecognition:FakeRecognition});
 });
 let sends=0;await page.route('**/api/documents',r=>r.fulfill({json:[]}));await page.route('**/api/chat',r=>{sends++;return r.fulfill({json:{conversationId:'voice',content:'¿Para qué curso y nivel?',citations:[],artifacts:[]}});});
 await page.goto('/chat');await page.getByRole('button',{name:'Dictar mensaje'}).click();await expect(page.getByLabel('Tu mensaje')).toHaveValue('Crea una actividad sobre inteligencia artificial');expect(sends).toBe(0);await page.getByRole('button',{name:'Enviar',exact:true}).click();await expect(page.getByText('¿Para qué curso y nivel?')).toBeVisible();expect(sends).toBe(1);
});
