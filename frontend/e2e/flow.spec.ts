import { test,expect } from '@playwright/test';
test('teacher can register, upload a source, use real dashboard data and log out',async({page})=>{
 const email=`smoke-${Date.now()}@example.test`;
 await page.goto('/register');await page.getByLabel('Nombre completo').fill('Docente de prueba');await page.getByLabel('Institución educativa').fill('Instituto de prueba');await page.getByLabel('Correo electrónico').fill(email);await page.getByLabel('Contraseña',{exact:true}).fill('PruebaSegura123');await page.getByRole('button',{name:'Crear mi cuenta gratis'}).click();
 await expect(page).toHaveURL(/\/dashboard/);await expect(page.getByRole('heading',{name:'Hola, Docente de prueba'})).toBeVisible();
 await page.getByRole('link',{name:'Mis fuentes',exact:true}).click();await page.locator('input[type=file]').setInputFiles({name:'sumas.txt',mimeType:'text/plain',buffer:Buffer.from('La suma reúne cantidades. Dos pares de objetos forman cuatro objetos. 2 + 2 = 4.')});await expect(page.getByRole('cell',{name:/sumas.txt/}).first()).toBeVisible();
 await page.getByRole('link',{name:'Dashboard',exact:true}).click();await expect(page.locator('.stat-card').first()).toContainText('1');
 await page.getByRole('link',{name:'Preparar mi clase',exact:true}).first().click();await expect(page.getByLabel('¿Qué aprenderán hoy?')).toBeVisible();await expect(page.locator('.source-picker').getByText('sumas.txt',{exact:false})).toBeVisible();
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Abrir menú'}).click();await expect(page.getByRole('link',{name:'Mis fuentes',exact:true})).toBeVisible();await page.getByRole('button',{name:'Cerrar menú'}).click();await page.setViewportSize({width:1280,height:720});
 await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();await expect(page).toHaveURL(/\/login/);
 await page.goto('/dashboard');await expect(page).toHaveURL(/\/login/);
});
test('login errors are displayed without granting access',async({page})=>{
 await page.goto('/login');await page.getByLabel('Correo electrónico').fill('missing@example.test');await page.getByLabel('Contraseña',{exact:true}).fill('InvalidPass123');await page.getByRole('button',{name:'Ingresar a la plataforma'}).click();await expect(page.locator('.error-box[role=alert]')).toContainText('Correo o contraseña incorrectos');await expect(page).toHaveURL(/\/login/);
});
test('mobile login fits the viewport without horizontal overflow',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/login');await expect(page.getByRole('button',{name:'Ingresar a la plataforma'})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
