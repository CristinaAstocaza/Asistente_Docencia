import { BadRequestException } from '@nestjs/common';
import { quizWorkbook } from './quiz-workbook';
export class KahootValidationService {
 validate(questions:any[],seconds=30){
  if(![5,10,20,30,60,120].includes(seconds))throw new BadRequestException('Tiempo de Kahoot inválido.');
  if(!questions.length||questions.length>100)throw new BadRequestException('Selecciona de 1 a 100 preguntas.');
  return questions.map((q,i)=>{
   const options=q.type==='true_false'?['Verdadero','Falso']:q.options;
   if(!['multiple_choice','true_false'].includes(q.type)||!Array.isArray(options)||options.length<2||options.length>4||!options.includes(q.correctAnswer)||new Set(options).size!==options.length)throw new BadRequestException(`Pregunta ${i+1}: Kahoot requiere 2 a 4 alternativas distintas y una respuesta correcta válida.`);
   if(Array.from(q.question).length>120||options.some((s:string)=>Array.from(s).length>75))throw new BadRequestException(`Pregunta ${i+1}: máximo 120 caracteres en el enunciado y 75 por respuesta. Edita el material antes de exportar.`);
   return {...q,options,time:seconds};
  });
 }
}
export class KahootExportAdapter {export(questions:any[]){return quizWorkbook(questions,'kahoot');}}
export class KahootExportService {
 async export(questions:any[],seconds=30){return new KahootExportAdapter().export(new KahootValidationService().validate(questions,seconds));}
}
