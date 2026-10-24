import {randomUUID} from 'node:crypto';
export function planningDocument(data:any){
 return {title:data.title,guideType:'Planificación académica',objectives:[`Curso: ${data.course}`,`Periodo: ${data.period||'No informado'}`],blocks:data.weeks.flatMap((w:any,i:number)=>[
  {id:randomUUID(),type:'heading',text:`${w.unit} — Semana ${i+1}: ${w.topic}`},
  {id:randomUUID(),type:'table',text:'',rows:[['Campo','Plan de la semana'],['Logro',w.outcome],['Actividades',w.activities.join('\n')],['Evidencia',w.evidence],['Recursos',w.resources.join('\n')||'No indicados'],['Horas teóricas',String(w.theoryHours)],['Horas prácticas',String(w.practiceHours)]]},
 ])};
}
