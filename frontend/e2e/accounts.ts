import { expect, type Page } from '@playwright/test';

// There is no public sign-up: the seeded administrator creates the teacher, then the teacher signs in.
export async function signInAsNewTeacher(page: Page, data: { name: string; email: string; password: string; institution?: string }) {
  const admin = await page.request.post('/api/auth/login', { data: { email: 'DocenteLino2026', password: process.env.ADMIN_PASSWORD ?? '' } });
  expect(admin.ok()).toBeTruthy();
  const created = await page.request.post('/api/auth/users', { data: { institution: '', ...data } });
  expect(created.status()).toBe(201);
  await page.request.post('/api/auth/logout', { data: {} });
  const login = await page.request.post('/api/auth/login', { data: { email: data.email, password: data.password } });
  expect(login.ok()).toBeTruthy();
}
