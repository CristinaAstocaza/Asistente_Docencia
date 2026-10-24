import { redirect } from 'next/navigation';
export default async function EvaluationRedirect({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const params=await searchParams,query=new URLSearchParams();
 for(const [key,value] of Object.entries(params))if(value!==undefined)for(const item of Array.isArray(value)?value:[value])query.append(key,item);
 redirect(`/evaluaciones${query.size?`?${query}`:''}`);
}
