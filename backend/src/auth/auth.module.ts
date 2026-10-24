import { Body, CanActivate, ConflictException, Controller, ExecutionContext, Get, Global, Injectable, Module, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { Database } from '../database/database';
import { parse, text } from '../common/validation';
import { settings } from '../config';
const scrypt = promisify(scryptCallback);
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export async function hashPassword(password: string) {
 const salt = randomBytes(16).toString('hex');
 const hash = await scrypt(password, salt, 64) as Buffer;
 return `${salt}:${hash.toString('hex')}`;
}
export async function verifyPassword(password: string, encoded: string) {
 const [salt, hex] = encoded.split(':');
 if (!salt || !hex) return false;
 const actual = await scrypt(password, salt, 64) as Buffer;
 const expected = Buffer.from(hex, 'hex');
 return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export type UserRequest = Request & { user: { id: string; name: string; email: string; institution: string; temporaryAccess?: boolean } };
const credentials = z.object({email: z.email().max(254).transform(x => x.toLowerCase()), password: z.string().min(8).max(128)});
const register = credentials.extend({name: text(100), institution: z.string().trim().max(200).default('')});
const cookieOptions = { httpOnly: true, secure: settings.production, sameSite: 'lax' as const, path: '/api' };
@Injectable()
export class AuthGuard implements CanActivate {
 constructor(private readonly db: Database) {}
 async canActivate(context: ExecutionContext) {
  const req = context.switchToHttp().getRequest<UserRequest>();
  if (settings.loginDisabled) {
   const [user] = await this.db.query(`INSERT INTO users(id,email,password_hash,name,institution)
    VALUES($1,$2,$3,$4,'') ON CONFLICT(email) DO UPDATE SET email=EXCLUDED.email
    RETURNING id,name,email,institution,academic_context`,
    ['00000000-0000-4000-8000-000000000001','temporal@asistente.local','disabled','Docente']);
   req.user = {...user, temporaryAccess: true};
   return true;
  }
  const token = req.cookies?.docente_access;
  if (!token) throw new UnauthorizedException('Inicia sesión para continuar.');
  const [user] = await this.db.query(`SELECT u.id,u.name,u.email,u.institution,u.academic_context FROM sessions s JOIN users u ON u.id=s.user_id
   WHERE s.access_hash=$1 AND s.access_expires_at>now() AND s.expires_at>now()`, [hashToken(token)]);
  if (!user) throw new UnauthorizedException('Tu sesión ha caducado.');
  req.user = user; return true;
 }
}
@Injectable()
export class AuthService {
 constructor(private readonly db: Database) {}
 async issue(userId: string, response: Response) {
  const access = randomBytes(32).toString('base64url'), refresh = randomBytes(32).toString('base64url');
  await this.db.query(`INSERT INTO sessions(id,user_id,access_hash,refresh_hash,access_expires_at,expires_at)
   VALUES($1,$2,$3,$4,now()+interval '15 minutes',now()+interval '30 days')`, [randomUUID(),userId,hashToken(access),hashToken(refresh)]);
  this.cookies(response, access, refresh);
 }
 cookies(response: Response, access: string, refresh: string) {
  response.cookie('docente_access', access, {...cookieOptions,maxAge:15*60*1000});
  response.cookie('docente_refresh', refresh, {...cookieOptions,maxAge:30*24*60*60*1000});
 }
}
@Controller('auth')
export class AuthController {
 constructor(private readonly db: Database, private readonly auth: AuthService) {}
 @Post('register') async register(@Body() input: unknown, @Res({passthrough:true}) res: Response) {
  const data = parse(register, input), id = randomUUID();
  try { await this.db.query('INSERT INTO users(id,email,password_hash,name,institution) VALUES($1,$2,$3,$4,$5)',[id,data.email,await hashPassword(data.password),data.name,data.institution]); }
  catch(error: any) { if (error.code === '23505') throw new ConflictException('Este correo ya está registrado.'); throw error; }
  await this.auth.issue(id,res); return {id,name:data.name,email:data.email,institution:data.institution};
 }
 @Post('login') async login(@Body() input: unknown, @Res({passthrough:true}) res: Response) {
  const data = parse(credentials, input);
  const [user] = await this.db.query('SELECT * FROM users WHERE email=$1',[data.email]);
  // Use a valid dummy hash to avoid disclosing existing accounts through response timing.
  const valid = await verifyPassword(data.password,user?.password_hash || '00000000000000000000000000000000:'+'00'.repeat(64));
  if (!user || !valid) throw new UnauthorizedException('Correo o contraseña incorrectos.');
  await this.auth.issue(user.id,res); return {id:user.id,name:user.name,email:user.email,institution:user.institution};
 }
 @Post('refresh') async refresh(@Req() req: Request, @Res({passthrough:true}) res: Response) {
  if (!req.cookies?.docente_refresh) throw new UnauthorizedException();
  const access = randomBytes(32).toString('base64url'), refresh = randomBytes(32).toString('base64url');
  const [session] = await this.db.query(`UPDATE sessions SET access_hash=$1,refresh_hash=$2,access_expires_at=now()+interval '15 minutes'
    WHERE refresh_hash=$3 AND expires_at>now() RETURNING id`,[hashToken(access),hashToken(refresh),hashToken(req.cookies.docente_refresh)]);
  if (!session) throw new UnauthorizedException('Inicia sesión nuevamente.');
  this.auth.cookies(res,access,refresh); return {ok:true};
 }
 @Post('logout') async logout(@Req() req: Request, @Res({passthrough:true}) res: Response) {
  await this.db.query('DELETE FROM sessions WHERE access_hash=$1 OR refresh_hash=$2',[hashToken(req.cookies?.docente_access || ''),hashToken(req.cookies?.docente_refresh || '')]);
  res.clearCookie('docente_access',cookieOptions); res.clearCookie('docente_refresh',cookieOptions); return {ok:true};
 }
 @Get('me') @UseGuards(AuthGuard) me(@Req() req: UserRequest) { return req.user; }
}
@Global()
@Module({controllers:[AuthController],providers:[AuthService,AuthGuard],exports:[AuthGuard]})
export class AuthModule {}
