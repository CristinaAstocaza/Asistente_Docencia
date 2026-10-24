import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
export function parse<T>(schema: z.ZodType<T>, input: unknown): T {
 const result = schema.safeParse(input);
 if (!result.success) {
  const names:Record<string,string>={questions:'Pregunta',subquestions:'subpunto',question:'enunciado',title:'título',correctAnswer:'respuesta esperada',explanation:'criterio de corrección',topic:'tema',instructions:'instrucciones',options:'alternativa',duration:'tiempo',count:'cantidad',slides:'diapositiva',content:'contenido'};
  const messages=result.error.issues.map(issue=>{
   const path=issue.path.map(key=>typeof key==='number'?String(key+1):names[String(key)]??String(key)).join(' · ');
   const message=issue.code==='too_small'&&issue.origin==='string'?'Completa este campo antes de guardar o generar.':issue.code==='too_big'?'El contenido supera el límite permitido.':issue.code==='invalid_type'?'Revisa el valor de este campo.':issue.message;
   return path?`${path}: ${message}`:message;
  });throw new BadRequestException(messages.join('; '));
 }
 return result.data;
}
export const uuid = z.uuid();
export const text = (max = 1000) => z.string().trim().min(1).max(max);
