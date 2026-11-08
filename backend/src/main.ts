import 'reflect-metadata';
import './config';
import { Controller, Get, Module, OnModuleInit } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Database, DatabaseModule } from './database/database';
import { AuthModule } from './auth/auth.module';
import { ensureAdmin } from './auth/admin-seed';
import { DocumentsModule } from './documents/documents.module';
import { AIModule } from './ai/ai.module';
import { ContentModule } from './content/content.module';
import { ExportsModule } from './exports/exports.module';
import { AcademicModule } from './academic/academic.module';
import { CoursesModule } from './courses/courses.module';
import { VisualModule } from './visual/visual.module';
import { settings } from './config';

@Controller('health')
class HealthController implements OnModuleInit {
 constructor(private readonly db:Database) {}
 async onModuleInit() {
  try {
   const schema = await readFile(resolve('src/database/schema.sql'), 'utf8');
   await this.db.executeSchema(schema);
  } catch(e) { /* schema already applied or migration handled externally */ }
  try { await ensureAdmin(this.db); }
  catch(e) { console.error('No se pudo preparar la cuenta administradora:', e instanceof Error ? e.message : e); }
 }
 @Get() async health() {await this.db.query('SELECT 1');return {status:'ok',aiConfigured:!!process.env.GEMINI_API_KEY};}
}
@Module({imports:[DatabaseModule,AuthModule,DocumentsModule,AIModule,ContentModule,ExportsModule,AcademicModule,VisualModule,CoursesModule],controllers:[HealthController]})
export class AppModule {}
export async function createApp() {
 const app=await NestFactory.create(AppModule,{bodyParser:false,logger:process.env.NODE_ENV==='test'?['error']:['error','warn','log']});
 // Behind a reverse proxy (Nginx, Render, Railway…) TRUST_PROXY=1 makes rate limits see each visitor's real IP.
 if(process.env.TRUST_PROXY)app.getHttpAdapter().getInstance().set('trust proxy',/^\d+$/.test(process.env.TRUST_PROXY)?Number(process.env.TRUST_PROXY):process.env.TRUST_PROXY);
 app.setGlobalPrefix('api');app.enableShutdownHooks();app.enableCors({origin:settings.origin,credentials:true});
 app.use(helmet());app.use(cookieParser());app.use(json({limit:'1mb'}));app.use(urlencoded({extended:false,limit:'1mb'}));
 app.use('/api',rateLimit({windowMs:60*1000,limit:120,standardHeaders:'draft-8',legacyHeaders:false,message:{message:'Demasiadas solicitudes. Intenta en un minuto.'}}));
 // Brute-force guard: only failed sign-ins count, so normal browsing (session checks, account management) is never blocked.
 app.use('/api/auth/login',rateLimit({windowMs:15*60*1000,limit:20,skipSuccessfulRequests:true,standardHeaders:'draft-8',legacyHeaders:false,message:{message:'Demasiados intentos fallidos. Espera 15 minutos e intenta de nuevo.'}}));
 app.use((req:any,res:any,next:any)=>{
  res.setHeader('Cache-Control','no-store');
  if(!['GET','HEAD','OPTIONS'].includes(req.method)) {
   const origin=req.headers.origin;
   if((origin && origin!==settings.origin) || req.headers['sec-fetch-site']==='cross-site')return res.status(403).json({message:'Origen no permitido.'});
  }next();
 });
 return app;
}
async function start(){
 let app:Awaited<ReturnType<typeof createApp>>|undefined;
 try{app=await createApp();await app.listen(Number(process.env.PORT||4000),process.env.HOST||'127.0.0.1');}
 catch(error){console.error('No se pudo iniciar la API:',error instanceof Error?error.message:'Error desconocido.');await app?.close().catch(()=>{});process.exitCode=1;}
}
if(require.main===module)void start();
