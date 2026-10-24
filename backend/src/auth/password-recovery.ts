import { Body,Controller,Post,ServiceUnavailableException,BadRequestException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { Database } from '../database/database';
import { parse } from '../common/validation';
import { hashPassword,hashToken } from './auth.module';
import { settings } from '../config';
@Controller('auth')
export class PasswordRecoveryController {
 constructor(private readonly db:Database){}
 @Post('forgot-password') async forgot(@Body() input:unknown){
  const {email}=parse(z.object({email:z.email().max(254).transform(s=>s.toLowerCase())}),input);
  if(!process.env.MAIL_DELIVERY_URL||!process.env.MAIL_DELIVERY_TOKEN)throw new ServiceUnavailableException('La recuperación requiere configurar el servicio de correo del servidor.');
  const [user]=await this.db.query('SELECT id FROM users WHERE email=$1',[email]);
  if(user){
   const token=randomBytes(32).toString('base64url'),hash=hashToken(token);
   await this.db.query('INSERT INTO password_resets(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval \'30 minutes\')',[hash,user.id]);
   // Explicit account recovery request authorizes this transactional email only.
   try{
    const response=await fetch(process.env.MAIL_DELIVERY_URL,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${process.env.MAIL_DELIVERY_TOKEN}`},body:JSON.stringify({to:email,subject:'Recuperar acceso al Asistente IA para Docentes',text:`Abre este enlace en los próximos 30 minutos: ${settings.origin}/recuperar#token=${token}`}),signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error('Mail delivery failed');
   }catch{await this.db.query('DELETE FROM password_resets WHERE token_hash=$1',[hash]);/* Same response prevents account enumeration. */}
  }
  return {message:'Si el correo está registrado, recibirás un enlace de recuperación.'};
 }
 @Post('reset-password') async reset(@Body() input:unknown){
  const data=parse(z.object({token:z.string().min(40).max(100),password:z.string().min(8).max(128)}),input),password=await hashPassword(data.password);
  await this.db.transaction(async client=>{
   const {rows:[reset]}=await client.query('DELETE FROM password_resets WHERE token_hash=$1 AND expires_at>now() RETURNING user_id',[hashToken(data.token)]);
   if(!reset)throw new BadRequestException('El enlace ha caducado o ya fue utilizado.');
   await client.query('UPDATE users SET password_hash=$2 WHERE id=$1',[reset.user_id,password]);
   await client.query('DELETE FROM sessions WHERE user_id=$1',[reset.user_id]);
   await client.query('DELETE FROM password_resets WHERE user_id=$1',[reset.user_id]);
  });return {message:'Contraseña actualizada. Inicia sesión nuevamente.'};
 }
}
