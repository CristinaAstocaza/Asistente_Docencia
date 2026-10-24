import { Global, Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient, QueryResultRow } from 'pg';
import { settings } from '../config';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { acquireLocalLock } from './local-lock';
function localDatabase() {
 if(process.env.DATABASE_DRIVER!=='pglite')return null;
 const path=process.env.PGLITE_PATH || './data/postgres';
 if(path!=='memory://')mkdirSync(dirname(resolve(path)),{recursive:true});
 return new PGlite(path,{extensions:{vector}});
}
@Injectable()
export class Database implements OnModuleDestroy {
  readonly pool = new Pool({ connectionString: settings.database, max: 10 });
  private readonly local:PGlite|null;
  private readonly releaseLocalLock?:()=>void;
  constructor() {
   const path=process.env.PGLITE_PATH||'./data/postgres';
   if(process.env.DATABASE_DRIVER==='pglite'){
    if(settings.production)throw new Error('PGlite is only supported in local development. Use PostgreSQL in production.');
    if(path!=='memory://'){mkdirSync(resolve(path),{recursive:true});this.releaseLocalLock=acquireLocalLock(resolve(path));}
   }
   try{this.local=localDatabase();}catch(error){this.releaseLocalLock?.();throw error;}
  }
  async query<T extends QueryResultRow = any>(sql: string, params: unknown[] = []): Promise<T[]> {
    if(this.local) return (await this.local.query<T>(sql,params)).rows;
    return (await this.pool.query<T>(sql, params)).rows;
  }
  async transaction<T>(action: (client: PoolClient) => Promise<T>): Promise<T> {
    if(this.local) return this.local.transaction(async tx=>action(tx as unknown as PoolClient));
    const client = await this.pool.connect();
    try { await client.query('BEGIN'); const value = await action(client); await client.query('COMMIT'); return value; }
    catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  async executeSchema(sql:string) { if(this.local)await this.local.exec(sql);else await this.pool.query(sql); }
  async onModuleDestroy() { try{if(this.local)await this.local.close();}finally{await this.pool.end();this.releaseLocalLock?.();} }
}
@Global()
@Module({ providers: [Database], exports: [Database] })
export class DatabaseModule {}
