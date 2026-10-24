"use client";
import { useEffect,useState,useRef } from 'react';
import { Send,Brain,Plus,Paperclip } from 'lucide-react';
import { api,post,errorMessage,Source,Citation,Material,ChatAttachment } from '@/services/api';
import SourcePicker from '@/features/sources/SourcePicker';
import ChatMarkdown from '@/components/ChatMarkdown';
import ChatArtifacts from './ChatArtifacts';
import AttachmentList from './ChatAttachments';
import SpeechInput from './SpeechInput';

type Message={id:string;role:string;content:string;sources?:Citation[];artifacts?:Material[];attachments?:ChatAttachment[]};
type Conversation={id:string;title:string;source_ids?:string[];mode?:'sources'|'general'};
export default function ChatWorkspace(){
 const [sources,setSources]=useState<Source[]>([]),[selected,setSelected]=useState<string[]>([]),[mode,setMode]=useState<'sources'|'general'>('general');
 const [messages,setMessages]=useState<Message[]>([]),[input,setInput]=useState(''),[busy,setBusy]=useState(false),[uploading,setUploading]=useState(false),[error,setError]=useState('');
 const [conversations,setConversations]=useState<Conversation[]>([]),[conversationId,setConversationId]=useState<string>(),[attachments,setAttachments]=useState<ChatAttachment[]>([]),[activeAttachments,setActiveAttachments]=useState<string[]>([]);
 const bottom=useRef<HTMLDivElement>(null),fileInput=useRef<HTMLInputElement>(null);const locked=busy||uploading;
 useEffect(()=>{let active=true;Promise.all([api<Source[]>('/documents'),api<Conversation[]>('/conversations')]).then(([s,c])=>{if(active){setSources(s);setConversations(c);}}).catch(e=>{if(active)setError(errorMessage(e));});return()=>{active=false;};},[]);
 useEffect(()=>{bottom.current?.scrollIntoView({behavior:'smooth'});},[messages,busy]);
 async function open(conversation:Conversation){
  if(locked)return;setError('');setBusy(true);
  try{
   const [history,files]=await Promise.all([api<Message[]>(`/conversations/${conversation.id}/messages`),api<ChatAttachment[]>(`/conversations/${conversation.id}/attachments`)]);
   setMessages(history);setConversationId(conversation.id);setAttachments(files);setActiveAttachments(history.findLast(m=>m.role==='user')?.attachments?.map(f=>f.id)??files.map(f=>f.id).slice(0,10));setSelected(conversation.source_ids??[]);setMode(conversation.mode??'general');setInput('');
  }catch(e){setError(errorMessage(e));}finally{setBusy(false);}
 }
 async function upload(files:File[],pasted=false){
  if(!files.length||locked)return;setUploading(true);setError('');
  try{
   if(activeAttachments.length+files.length>10)throw new Error('Selecciona hasta 10 adjuntos por mensaje. Desmarca alguno para agregar más.');
   for(const file of files){if(file.size>50*1024*1024)throw new Error(`${file.name} supera los 50 MB.`);if(file.type.startsWith('image/')&&file.size>8*1024*1024)throw new Error(`${file.name} supera los 8 MB por imagen. Reduce su tamaño.`);}
   let id=conversationId;
   if(!id){const created=await api<Conversation>('/conversations',post({title:input.trim().slice(0,100)||'Nueva conversación'}));id=created.id;setConversationId(id);setConversations(c=>[created,...c]);}
   for(const file of files){const data=new FormData();data.append('file',file);data.append('purpose',pasted?'reference':'content');const saved=await api<ChatAttachment>(`/conversations/${id}/attachments`,{method:'POST',body:data});setAttachments(a=>[...a,saved]);setActiveAttachments(a=>[...a,saved.id]);}
  }catch(e){setError(errorMessage(e));}finally{setUploading(false);if(fileInput.current)fileInput.current.value='';}
 }
 async function purpose(file:ChatAttachment,value:ChatAttachment['purpose']){
  if(locked)return;setUploading(true);setError('');try{await api(`/conversations/${file.conversation_id}/attachments/${file.id}`,{method:'PATCH',body:JSON.stringify({purpose:value})});setAttachments(a=>a.map(f=>f.id===file.id?{...f,purpose:value}:f));}catch(e){setError(errorMessage(e));}finally{setUploading(false);}
 }
 async function remove(file:ChatAttachment){
  if(locked)return;setUploading(true);setError('');try{
   if(!messages.some(m=>m.attachments?.some(f=>f.id===file.id)))await api(`/conversations/${file.conversation_id}/attachments/${file.id}`,{method:'DELETE'});
   setAttachments(a=>a.filter(f=>f.id!==file.id));setActiveAttachments(a=>a.filter(id=>id!==file.id));
  }catch(e){setError(errorMessage(e));}finally{setUploading(false);}
 }
 async function send(e:React.FormEvent){
  e.preventDefault();if(!input.trim()||locked)return;setBusy(true);setError('');const content=input;setInput('');const userId=crypto.randomUUID();
  setMessages(m=>[...m,{id:userId,role:'user',content,attachments:attachments.filter(f=>activeAttachments.includes(f.id))}]);
  try{
   const response=await api<{conversationId:string;content:string;citations:Citation[];artifacts:Material[]}>('/chat',post({message:content,conversationId,sourceIds:selected,attachmentIds:activeAttachments,mode}));
   setConversationId(response.conversationId);setMessages(m=>[...m,{id:crypto.randomUUID(),role:'assistant',content:response.content,sources:response.citations,artifacts:response.artifacts}]);setConversations(await api<Conversation[]>('/conversations'));
  }catch(e){setError(errorMessage(e));setInput(content);setMessages(m=>m.filter(x=>x.id!==userId));}finally{setBusy(false);}
 }
 function toggleAttachment(id:string){if(activeAttachments.includes(id))setActiveAttachments(a=>a.filter(i=>i!==id));else if(activeAttachments.length<10)setActiveAttachments(a=>[...a,id]);else setError('Selecciona hasta 10 adjuntos por mensaje.');}
 return <div className="workspace"><header className="page-heading"><div><span className="eyebrow">Fuentes → conversación → material</span><h1>Chat IA</h1><p>Explora tus documentos y prepara recursos con contexto.</p></div><button className="btn" disabled={locked} onClick={()=>{setMessages([]);setConversationId(undefined);setAttachments([]);setActiveAttachments([]);setSelected([]);setMode('general');setInput('');setError('');}}><Plus size={16}/>Nueva conversación</button></header>
  <input ref={fileInput} type="file" multiple accept=".pdf,.docx,.pptx,.txt,.png,.jpg,.jpeg" hidden onChange={e=>void upload(Array.from(e.target.files??[]))}/>
  <div className="chat-grid"><aside className="card form-panel"><SourcePicker chat sources={sources} selected={selected} onChange={setSelected} mode={mode} onMode={setMode}/><button type="button" className="btn" disabled={locked} onClick={()=>fileInput.current?.click()}><Paperclip size={16}/>Adjuntar a este chat</button><p className="muted">Los adjuntos de este chat no se agregan a Mis fuentes.</p><h3>Conversaciones</h3>{conversations.map(c=><button key={c.id} className={`conversation-link ${conversationId===c.id?'active':''}`} disabled={locked} onClick={()=>void open(c)}>{c.title}</button>)}</aside>
   <section className="card chat-panel" onDragOver={e=>{if(e.dataTransfer.types.includes('Files'))e.preventDefault();}} onDrop={e=>{if(e.dataTransfer.files.length){e.preventDefault();void upload(Array.from(e.dataTransfer.files));}}} onPaste={e=>{const files=Array.from(e.clipboardData.files).filter(f=>f.type.startsWith('image/'));if(files.length){e.preventDefault();void upload(files,true);}}}>
    <div className="chat-messages">{messages.length===0&&<div className="empty-state"><Brain size={36}/><h2>¿Qué prepararás hoy?</h2><p>Adjunta documentos o pega una imagen como ejemplo. También puedes seleccionar tus fuentes por carpeta.</p><div className="toolbar">{['Resume mis documentos','Prepara una actividad y una rúbrica sobre el tema de mis fuentes','Crea una rúbrica para una exposición grupal'].map(s=><button className="btn" key={s} onClick={()=>setInput(s)}>{s}</button>)}</div></div>}
     {messages.map(m=><article key={m.id} className={`chat-message ${m.role}`}><strong>{m.role==='user'?'Tú':'Asistente IA'}</strong>{m.role==='assistant'?<ChatMarkdown>{m.content}</ChatMarkdown>:<p className="preserve-lines">{m.content}</p>}{m.attachments?.length?<AttachmentList files={m.attachments}/>:null}{m.artifacts?.length?<ChatArtifacts artifacts={m.artifacts}/>:null}{m.role==='assistant'&&m.sources?.length?<details><summary>Fuentes consultadas</summary>{m.sources.map((s,i)=><p className="muted" key={i}>[{s.reference}] {s.name}{s.page?` — p. ${s.page}`:''}</p>)}</details>:null}</article>)}
     {busy&&<p className="loading-line" role="status">Revisando contexto y preparando la respuesta…</p>}<div ref={bottom}/>
    </div>
    {error&&<p className="error-box" role="alert">{error}</p>}{uploading&&<p className="loading-line" role="status">Guardando adjunto en esta conversación…</p>}
    {attachments.length>0&&<div style={{padding:'8px 16px',background:'rgba(241, 245, 249, 0.6)',borderRadius:'12px',margin:'8px 0',border:'1px solid var(--color-border)'}}><AttachmentList files={attachments} active={activeAttachments} onToggle={toggleAttachment} onPurpose={purpose} onRemove={remove} disabled={locked}/></div>}
    <form className="chat-composer" onSubmit={send}><label className="field grow">Tu mensaje<textarea rows={2} maxLength={6000} value={input} onChange={e=>setInput(e.target.value)} placeholder="Escribe tu mensaje..." onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();e.currentTarget.form?.requestSubmit();}}}/></label><div className="chat-composer-actions"><button type="button" className="btn icon" disabled={locked} aria-label="Adjuntar archivo a este chat" title="Adjuntar archivo" onClick={()=>fileInput.current?.click()}><Paperclip size={18}/></button><SpeechInput key={conversationId??'new'} disabled={locked} onTranscript={text=>setInput(value=>`${value}${value?' ':''}${text}`.slice(0,6000))}/><button className="btn primary" disabled={locked||!input.trim()||(mode==='sources'&&!selected.length&&!activeAttachments.length)}><Send size={16}/>Enviar</button></div></form>
   </section>
  </div>
 </div>;
}
