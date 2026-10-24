import { Material,Value } from '@/services/api';
export function syllabusParameters(material:Material):Record<string,string>{
 const d=material.data,g=(d.generalData??{}) as Record<string,Value>;
 const values:Record<string,string>={};
 for(const key of ['course','credits','cycle','description','competency'])if(d[key]!==undefined)values[key]=String(d[key]);
 for(const key of ['institution','courseCode','modality','weeklyHours','term','nature','prerequisites'])if(g[key]!==undefined&&g[key]!==0)values[key]=String(g[key]);
 if(Array.isArray(g.careers))values.careers=g.careers.join('\n');if(Array.isArray(d.outcomes))values.outcomes=d.outcomes.join('\n');
 const weeks=Array.isArray(d.schedule)?d.schedule.map(row=>Number((row as Record<string,Value>).week)):Array.isArray(d.units)?d.units.flatMap(unit=>((unit as Record<string,Value>).weeks as Value[]).flatMap(week=>String(week).match(/\d+/g)?.map(Number)??[])):[];
 if(weeks.length)values.weeks=String(Math.max(...weeks));
 const plan=d.evaluationPlan as {status:string;items:{code:string;description:string;week:number;weight:number}[];rules:string[]}|undefined;
 if(plan){if(plan.status==='provided')values.evaluationScheme=plan.items.map(item=>`${item.code}: ${item.description}, ${item.weight} %, semana ${item.week}`).join('\n');values.evaluationRules=plan.rules.join('\n');}
 const bib=d.bibliographyDetails as {base:string[];complementary:string[]}|undefined;
 if(bib)values.bibliography=[...bib.base,...bib.complementary].join('\n');
 return values;
}
