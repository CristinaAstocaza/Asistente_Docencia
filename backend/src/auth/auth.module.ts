import { BadRequestException, Body, CanActivate, ConflictException, Controller, Delete, ExecutionContext, ForbiddenException, Get, Global, Injectable, Module, NotFoundException, Param, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
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
export type UserRequest = Request & { user: { id: string; name: string; email: string; institution: string; is_admin?: boolean } };
const credentials = z.object({ email: z.string().min(1).max(254).transform(x => x.trim().toLowerCase()), password: z.string().min(8).max(128) });
const newUser = z.object({
  email: z.email().max(254).transform(x => x.trim().toLowerCase()),
  password: z.string().min(8).max(128),
  name: text(100),
  institution: z.string().trim().max(200).default(''),
  // Only an administrator can reach this endpoint, so only an administrator can grant the role.
  is_admin: z.boolean().default(false)
});
const cookieOptions = { httpOnly: true, secure: settings.production, sameSite: 'lax' as const, path: '/api' };
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly db: Database) { }
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<UserRequest>();
    const token = req.cookies?.docente_access;
    if (!token) throw new UnauthorizedException('Inicia sesión para continuar.');
    const [user] = await this.db.query(`SELECT u.id,u.name,u.email,u.institution,u.academic_context,u.is_admin FROM sessions s JOIN users u ON u.id=s.user_id
   WHERE s.access_hash=$1 AND s.access_expires_at>now() AND s.expires_at>now()`, [hashToken(token)]);
    if (!user) throw new UnauthorizedException('Tu sesión ha caducado.');
    req.user = user; return true;
  }
}
@Injectable()
export class AuthService {
  constructor(private readonly db: Database) { }
  async issue(userId: string, response: Response) {
    const access = randomBytes(32).toString('base64url'), refresh = randomBytes(32).toString('base64url');
    await this.db.query(`INSERT INTO sessions(id,user_id,access_hash,refresh_hash,access_expires_at,expires_at)
   VALUES($1,$2,$3,$4,now()+interval '15 minutes',now()+interval '30 days')`, [randomUUID(), userId, hashToken(access), hashToken(refresh)]);
    this.cookies(response, access, refresh);
  }
  cookies(response: Response, access: string, refresh: string) {
    response.cookie('docente_access', access, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
    response.cookie('docente_refresh', refresh, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 });
  }
}
@Controller('auth')
export class AuthController {
  constructor(private readonly db: Database, private readonly auth: AuthService) { }
  // Accounts are created only by an administrator (POST /auth/users); there is no public sign-up.
  @Post('login') async login(@Body() input: unknown, @Res({ passthrough: true }) res: Response) {
    const data = parse(credentials, input);
    const [user] = await this.db.query('SELECT * FROM users WHERE LOWER(email)=$1 OR LOWER(name)=$1', [data.email]);
    // Use a valid dummy hash to avoid disclosing existing accounts through response timing.
    const valid = await verifyPassword(data.password, user?.password_hash || '00000000000000000000000000000000:' + '00'.repeat(64));
    if (!user || !valid) throw new UnauthorizedException('Usuario o contraseña incorrectos.');
    await this.auth.issue(user.id, res); return { id: user.id, name: user.name, email: user.email, institution: user.institution, is_admin: user.is_admin };
  }
  @Post('refresh') async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    if (!req.cookies?.docente_refresh) throw new UnauthorizedException();
    const access = randomBytes(32).toString('base64url'), refresh = randomBytes(32).toString('base64url');
    const [session] = await this.db.query(`UPDATE sessions SET access_hash=$1,refresh_hash=$2,access_expires_at=now()+interval '15 minutes'
    WHERE refresh_hash=$3 AND expires_at>now() RETURNING id`, [hashToken(access), hashToken(refresh), hashToken(req.cookies.docente_refresh)]);
    if (!session) throw new UnauthorizedException('Inicia sesión nuevamente.');
    this.auth.cookies(res, access, refresh); return { ok: true };
  }
  @Post('logout') async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.db.query('DELETE FROM sessions WHERE access_hash=$1 OR refresh_hash=$2', [hashToken(req.cookies?.docente_access || ''), hashToken(req.cookies?.docente_refresh || '')]);
    res.clearCookie('docente_access', cookieOptions); res.clearCookie('docente_refresh', cookieOptions); return { ok: true };
  }
  @Get('me') @UseGuards(AuthGuard) me(@Req() req: UserRequest) { return req.user; }
  /** Any signed-in user: change own password. Keeps this session and closes every other one. */
  @Post('change-password') @UseGuards(AuthGuard) async changePassword(@Req() req: UserRequest, @Body() input: unknown) {
    const data = parse(z.object({ currentPassword: z.string().min(1).max(128), newPassword: z.string().min(8, 'La nueva contraseña debe tener al menos 8 caracteres.').max(128) }), input);
    const [user] = await this.db.query('SELECT password_hash FROM users WHERE id=$1', [req.user.id]);
    if (!user || !(await verifyPassword(data.currentPassword, user.password_hash))) throw new BadRequestException('La contraseña actual no es correcta.');
    if (data.currentPassword === data.newPassword) throw new BadRequestException('La nueva contraseña debe ser distinta de la actual.');
    await this.db.query('UPDATE users SET password_hash=$2 WHERE id=$1', [req.user.id, await hashPassword(data.newPassword)]);
    await this.db.query('DELETE FROM sessions WHERE user_id=$1 AND access_hash<>$2', [req.user.id, hashToken(req.cookies?.docente_access || '')]);
    return { message: 'Contraseña actualizada. Se cerró la sesión en los demás dispositivos.' };
  }
  /** Admin: list all users */
  @Get('users') @UseGuards(AuthGuard) async listUsers(@Req() req: UserRequest) {
    if (!req.user.is_admin) throw new ForbiddenException('Solo administradores pueden gestionar usuarios.');
    return this.db.query(`SELECT u.id,u.name,u.email,u.institution,u.is_admin,u.created_at,
      (SELECT count(*)::int FROM generated_content g WHERE g.user_id=u.id) AS materials,
      (SELECT count(*)::int FROM documents d WHERE d.user_id=u.id) AS sources,
      (SELECT max(s.created_at) FROM sessions s WHERE s.user_id=u.id) AS last_login
      FROM users u ORDER BY u.is_admin DESC, u.created_at ASC`);
  }
  /** Admin: create a new user */
  @Post('users') @UseGuards(AuthGuard) async createUser(@Req() req: UserRequest, @Body() input: unknown) {
    if (!req.user.is_admin) throw new ForbiddenException('Solo administradores pueden crear usuarios.');
    const data = parse(newUser, input), id = randomUUID();
    try { await this.db.query('INSERT INTO users(id,email,password_hash,name,institution,is_admin) VALUES($1,$2,$3,$4,$5,$6)', [id, data.email, await hashPassword(data.password), data.name, data.institution, data.is_admin]); }
    catch (error: any) { if (error.code === '23505') throw new ConflictException('Este correo ya está registrado.'); throw error; }
    return { id, name: data.name, email: data.email, institution: data.institution, is_admin: data.is_admin, created_at: new Date().toISOString(), materials: 0, sources: 0, last_login: null };
  }
  /** Admin: delete a user (cannot delete yourself) */
  @Delete('users/:id') @UseGuards(AuthGuard) async deleteUser(@Req() req: UserRequest, @Param('id') id: string) {
    if (!req.user.is_admin) throw new ForbiddenException('Solo administradores pueden eliminar usuarios.');
    if (!z.uuid().safeParse(id).success) throw new NotFoundException('Usuario no encontrado.');
    if (id === req.user.id) throw new ForbiddenException('No puedes eliminarte a ti mismo.');
    const [target] = await this.db.query('SELECT is_admin FROM users WHERE id=$1', [id]);
    if (!target) throw new NotFoundException('Usuario no encontrado.');
    if (target.is_admin) throw new ForbiddenException('Las cuentas de administrador no se pueden eliminar.');
    await this.db.query('DELETE FROM users WHERE id=$1 AND is_admin=false', [id]);
    return { ok: true };
  }
}
@Global()
@Module({ controllers: [AuthController], providers: [AuthService, AuthGuard], exports: [AuthGuard] })
export class AuthModule { }
