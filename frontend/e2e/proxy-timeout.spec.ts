import {test,expect} from '@playwright/test';
test('guide generation survives more than thirty seconds through the Next.js API proxy',async({page})=>{
 const response=await page.request.post('/api/auth/register',{data:{name:'Prueba de espera IA',email:`proxy-${Date.now()}@example.test`,password:'synthetic-password-123'}});expect(response.status()).toBe(201);
 await page.goto('/guias');await page.getByLabel('¿Sobre qué tema deseas crear tu guía?').fill('Crea una guía práctica de react con visual, incluyendo código y, ejemplos.');
 await page.getByLabel('Recursos visuales').selectOption('generated');await expect(page.getByText('No hay un modelo de imágenes configurado.',{exact:false})).toBeVisible();
 await page.getByText('Opciones avanzadas',{exact:true}).click();await page.getByLabel('Carrera',{exact:true}).fill('ING. SISTEMAS');await page.getByLabel('Curso',{exact:true}).fill('Desarrollo de Software');await page.getByLabel('Duración',{exact:true}).fill('90');
 const started=Date.now(),generated=page.waitForResponse(r=>r.url().endsWith('/api/generate'),{timeout:60000});
 await page.getByRole('button',{name:'Generar guía con IA'}).click();expect((await generated).status()).toBe(201);
 expect(Date.now()-started).toBeGreaterThan(30000);await expect(page.locator('iframe')).toBeVisible();await expect(page.locator('.error-box')).toHaveCount(0);
});
