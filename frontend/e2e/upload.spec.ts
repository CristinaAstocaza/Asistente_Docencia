import {test,expect} from '@playwright/test';
import {writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';

test('uploads a 50 MB source through Next.js and preserves every byte',async({page},testInfo)=>{
 const registration=await page.request.post('/api/auth/register',{data:{name:'Prueba de subida',email:`upload-${Date.now()}@example.test`,password:'PruebaUpload123!'}});
 expect(registration.status()).toBe(201);
 await page.goto('/fuentes');
  await expect(page.getByText('Agregar un enlace web')).toHaveCount(1);
 const bytes=Buffer.alloc(50*1024*1024,65);
 bytes.write('Documento de prueba: inicio.');bytes.write('Fin del archivo completo.',bytes.length-25);
 await mkdir(testInfo.outputDir,{recursive:true});
 const file=testInfo.outputPath('fuente-50mb.txt');await writeFile(file,bytes);
 await page.locator('input[type=file]').setInputFiles(file);
 await expect(page.locator('td strong').filter({hasText:'fuente-50mb.txt'})).toBeVisible({timeout:60000});
 const documents=await (await page.request.get('/api/documents')).json();
 const source=documents.find((d:{name:string})=>d.name==='fuente-50mb.txt');
 expect(source.size).toBe(bytes.length);
 const downloaded=await page.request.get(`/api/documents/${source.id}/download`);
 expect(downloaded.ok()).toBe(true);
 const originalHash=createHash('sha256').update(bytes).digest('hex');
 expect(createHash('sha256').update(await downloaded.body()).digest('hex')).toBe(originalHash);
 await page.request.delete(`/api/documents/${source.id}`);
 const oversized=testInfo.outputPath('demasiado-grande.txt');await writeFile(oversized,Buffer.alloc(50*1024*1024+1,65));
 await page.locator('input[type=file]').setInputFiles(oversized);
 await expect(page.locator('.error-box')).toContainText('supera los 50 MB');
});
