import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Database } from './database';
async function main() {
  const db = new Database();
  try { await db.executeSchema(await readFile(resolve('src/database/schema.sql'), 'utf8'));
   // Register existing originals under their current driver before switching new writes.
   await db.query(`INSERT INTO stored_files(storage_key,driver) SELECT DISTINCT storage_key::uuid,$1 FROM (
    SELECT storage_key FROM documents UNION SELECT storage_key FROM conversation_attachments UNION SELECT storage_key FROM visual_assets
   ) files WHERE storage_key IS NOT NULL ON CONFLICT DO NOTHING`,[process.env.LEGACY_STORAGE_DRIVER||process.env.STORAGE_DRIVER||'local']);
   console.log('Esquema aplicado; ubicaciones de archivos conservadas.'); }
  finally { await db.onModuleDestroy(); }
}
main().catch(() => { console.error('No se pudo aplicar el esquema. Comprueba DATABASE_URL y PostgreSQL con pgvector.'); process.exitCode = 1; });
