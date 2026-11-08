import { randomUUID } from 'node:crypto';
import { hashPassword } from './auth.module';

// The administrator's identity can be overridden per deployment; its password lives only in the environment (.env).
export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'marcusdoriano23@gmail.com').trim().toLowerCase();
export const ADMIN_NAME = (process.env.ADMIN_NAME || 'DocenteLino2026').trim();
// Earlier deployments seeded the admin with these addresses; it is moved to ADMIN_EMAIL so data is kept.
const LEGACY_ADMIN_EMAILS = ['docentelino2026@docentia.edu.pe', 'marcusdoriano@wrcoasociados.com'];

type Db = { query: (sql: string, params?: unknown[]) => Promise<any[]> };

/**
 * Ensures the seeded administrator exists under ADMIN_EMAIL. An existing account keeps its current password;
 * a new one is created only when ADMIN_PASSWORD is set (never with a password written in the code).
 */
export async function ensureAdmin(db: Db): Promise<'created' | 'moved' | 'kept' | 'skipped'> {
  const [current] = await db.query('SELECT id FROM users WHERE LOWER(email)=$1', [ADMIN_EMAIL]);
  if (current) { await db.query('UPDATE users SET is_admin=true WHERE id=$1', [current.id]); return 'kept'; }
  const [legacy] = await db.query('SELECT id FROM users WHERE LOWER(email)=ANY($1::text[]) ORDER BY created_at LIMIT 1', [LEGACY_ADMIN_EMAILS]);
  if (legacy) { await db.query('UPDATE users SET email=$2,is_admin=true WHERE id=$1', [legacy.id, ADMIN_EMAIL]); return 'moved'; }
  const password = process.env.ADMIN_PASSWORD || '';
  if (password.length < 8) {
   console.warn('ADMIN_PASSWORD no está definida (mínimo 8 caracteres): no se creó la cuenta administradora.');
   return 'skipped';
  }
  await db.query('INSERT INTO users(id,email,password_hash,name,institution,is_admin) VALUES($1,$2,$3,$4,$5,true)',
    [randomUUID(), ADMIN_EMAIL, await hashPassword(password), ADMIN_NAME, 'Institución Educativa']);
  return 'created';
}
