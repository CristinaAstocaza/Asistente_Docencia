"use client";
import Image from 'next/image';
import ChatMarkdown from '@/components/ChatMarkdown';
export interface Block {id:string;type:'heading'|'paragraph'|'list'|'table'|'code'|'diagram'|'image';text:string;level?:number;items?:string[];rows?:string[][];language?:string;assetId?:string;caption?:string;width?:number}
export interface Guide {title:string;guideType:string;objectives:string[];blocks:Block[]}
export function BlockView({block:b}:{block:Block}){
 if(b.type==='heading')return b.level===2?<h3>{b.text}</h3>:<h2>{b.text}</h2>;
 if(b.type==='code')return <pre><code>{b.text}</code></pre>;
 if(b.type==='list')return <ul>{b.items?.map((s,i)=><li key={i}><ChatMarkdown>{s}</ChatMarkdown></li>)}</ul>;
 if(b.type==='diagram')return <div className="guide-diagram">{b.items?.map((s,i)=><div key={i}><span>{i+1}</span><p>{s}</p></div>)}</div>;
 if(b.type==='table')return <div className="table-scroll"><table className="data-table"><tbody>{b.rows?.map((row,i)=><tr key={i}>{row.map((c,j)=>i===0?<th key={j}>{c}</th>:<td key={j}>{c}</td>)}</tr>)}</tbody></table></div>;
 // Authenticated source, local API only. Teacher images are never labeled real captures by default.
 if(b.type==='image')return <figure style={{width:`${b.width||100}%`}}><Image unoptimized width={900} height={540} src={`/api/visual-assets/${b.assetId}`} alt={b.caption||'Imagen educativa'} style={{maxWidth:'100%',maxHeight:480,objectFit:'contain'}}/><figcaption>{b.caption||'Imagen educativa'}</figcaption></figure>;
 return <ChatMarkdown>{b.text}</ChatMarkdown>;
}
export default function GuideView({data}:{data:Guide}){return <article className="guide-page"><h1>{data.title}</h1><p className="badge">{data.guideType}</p><h2>Objetivos</h2><ul>{data.objectives.map((o,i)=><li key={i}>{o}</li>)}</ul>{data.blocks.map(b=><section key={b.id}><BlockView block={b}/></section>)}</article>;}
