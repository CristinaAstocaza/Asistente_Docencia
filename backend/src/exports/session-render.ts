import {randomUUID} from 'node:crypto';
export function sessionDocument(data:any){
 const heading=(text:string)=>({id:randomUUID(),type:'heading',text});
 const paragraph=(text:string)=>({id:randomUUID(),type:'paragraph',text});
 return {title:data.title,guideType:'Sesión de aprendizaje',objectives:[data.outcome],blocks:[
  heading('I. Datos informativos'),{id:randomUUID(),type:'table',text:'',rows:[['Campo','Detalle'],['Curso',data.course],['Área',data.area],['Tema',data.topic],['Duración',`${data.duration} minutos`]]},
  heading('II. Propósito de aprendizaje'),paragraph(data.competency),paragraph(data.outcome),paragraph(data.methodology),
  heading('III. Evidencias de aprendizaje'),...(data.evidence||[data.assessment]).map(paragraph),
  heading('IV. Secuencia didáctica'),...data.stages.flatMap((s:any)=>[heading(`${s.name} — ${s.minutes} minutos`),{id:randomUUID(),type:'list',text:'',items:s.activities},paragraph(`Recursos: ${s.resources.join('; ')}`)]),
  heading('V. Evaluación'),paragraph(data.assessment),heading('VI. Bibliografía'),...(data.bibliography||['Consulta las fuentes indicadas al final del documento.']).map(paragraph),
  ...(data.images||[]).map((i:any)=>({id:randomUUID(),type:'image',text:'',...i})),
 ]};
}
