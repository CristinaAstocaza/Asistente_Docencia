import {test,expect} from '@playwright/test';
import {signInAsNewTeacher} from './accounts';
test('teacher downloads a finished guide with real persistence and exports',async({page})=>{
 const email=`platform-${Date.now()}@example.test`;
 await signInAsNewTeacher(page,{name:'Docente de prueba',email,password:'password123'});await page.goto('/dashboard');await expect(page).toHaveURL(/dashboard/);
 await page.goto('/guias');await page.locator('textarea').first().fill('Guide of medical instruments');await page.locator('input[type=number]').fill('10');await page.getByRole('button').filter({hasText:/Generar/}).click();await expect(page.locator('iframe')).toBeVisible();await expect(page.locator('.guide-editor')).toHaveCount(0);await expect(page.getByText(/10 p/)).toBeVisible();const download=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar Word'}).click();expect((await download).suggestedFilename()).toMatch(/\.docx$/);
 await page.goto('/historial');await page.getByRole('row').filter({hasText:/instrumentos/}).getByRole('button',{name:'Abrir',exact:true}).click();await expect(page.getByRole('button',{name:'Editar',exact:true})).toHaveCount(0);await page.getByRole('link',{name:'Ver documento terminado'}).click();await expect(page.locator('iframe')).toBeVisible();
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:'../artifacts/guide-mobile.png',fullPage:true});
});
