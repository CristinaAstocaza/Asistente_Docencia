import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env') });
const shared = config({ path: resolve(process.cwd(), '../.env'), processEnv: {} }).parsed;
// Empty placeholders in the local example must not mask existing shared credentials.
for(const [name,value] of Object.entries(shared || {}))if(!process.env[name] && value)process.env[name]=value;
export const settings = {
  loginDisabled: process.env.LOGIN_DISABLED === 'true',
  database: process.env.DATABASE_URL || 'postgresql://docente:docente_dev@localhost:5432/docente',
  origin: process.env.APP_ORIGIN || 'http://localhost:3000',
  production: process.env.NODE_ENV === 'production',
  model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
  embeddingModel: process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001',
  storageLimit: Number(process.env.STORAGE_LIMIT_MB || 500) * 1024 * 1024,
  dailyLimit: Number(process.env.AI_DAILY_REQUEST_LIMIT || 100),
};
