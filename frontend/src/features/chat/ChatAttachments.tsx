"use client";
import Image from 'next/image';
import { FileText,X } from 'lucide-react';
import { ChatAttachment } from '@/services/api';
export default function AttachmentList({files,active,onToggle,onPurpose,onRemove,disabled=false}:{files:ChatAttachment[];active?:string[];onToggle?:(id:string)=>void;onPurpose?:(file:ChatAttachment,purpose:ChatAttachment['purpose'])=>void;onRemove?:(file:ChatAttachment)=>void;disabled?:boolean}){
 return (
  <div style={{display:'flex',flexWrap:'wrap',gap:'10px',margin:'10px 0'}}>
   {files.map(file=>{
    const url=`/api/conversations/${file.conversation_id}/attachments/${file.id}/download`;
    const isSelected = active ? active.includes(file.id) : true;
    return (
     <div
      key={file.id}
      style={{
       display:'inline-flex',
       alignItems:'center',
       gap:'10px',
       padding:'8px 14px',
       borderRadius:'12px',
       background: isSelected ? 'rgba(67, 97, 238, 0.08)' : '#F1F5F9',
       border: `1.5px solid ${isSelected ? 'rgba(67, 97, 238, 0.4)' : '#E2E8F0'}`,
       color: isSelected ? '#1E293B' : '#64748B',
       fontSize:'13px',
       fontWeight: 500,
       transition:'all 0.2s ease',
      }}
     >
      <div style={{width:'28px',height:'28px',borderRadius:'8px',background:'rgba(67, 97, 238, 0.15)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--color-primary)',flexShrink:0}}>
       <FileText size={16}/>
      </div>
      {onToggle ? (
       <label style={{cursor:'pointer',display:'flex',alignItems:'center',gap:'6px',margin:0}}>
        <input type="checkbox" checked={isSelected} disabled={disabled} onChange={()=>onToggle(file.id)} style={{accentColor:'var(--color-primary)'}}/>
        <span style={{maxWidth:'240px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{file.name}</span>
       </label>
      ) : (
       <a href={url} target="_blank" rel="noopener noreferrer" style={{color:'inherit',textDecoration:'none',maxWidth:'260px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={file.name}>
        {file.name}
       </a>
      )}
      {onRemove && (
       <button
        type="button"
        disabled={disabled}
        onClick={()=>onRemove(file)}
        aria-label={`Quitar ${file.name}`}
        style={{background:'none',border:'none',cursor:'pointer',color:'#94A3B8',display:'flex',alignItems:'center',padding:'2px',borderRadius:'4px'}}
        onMouseOver={e=>e.currentTarget.style.color='#EF4444'}
        onMouseOut={e=>e.currentTarget.style.color='#94A3B8'}
       >
        <X size={15}/>
       </button>
      )}
     </div>
    );
   })}
  </div>
 );
}
