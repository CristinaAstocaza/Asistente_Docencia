"use client";
import {useState} from 'react';
import {api,errorMessage,Material} from '@/services/api';
interface ImageAsset {assetId:string;caption:string;width:number}
export default function MaterialImages({material,onSaved}:{material:Material;onSaved:(m:Material)=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');const images=(material.data.images||[]) as unknown as ImageAsset[];
 async function persist(next:ImageAsset[]){const m=await api<Material>(`/content/${material.id}`,{method:'PATCH',body:JSON.stringify({title:material.title,version:material.version,data:{...material.data,images:next}})});onSaved(m);}
 return <details><summary>Imágenes de la sesión</summary>{error&&<p className="error-box" role="alert">{error}</p>}<label className="field">Añadir imagen PNG o JPEG<input type="file" disabled={busy} accept="image/png,image/jpeg" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;setBusy(true);setError('');try{const form=new FormData();form.append('file',file);const a=await api<{id:string}>('/visual-assets',{method:'POST',body:form});await persist([...images,{assetId:a.id,caption:file.name,width:100}]);}catch(e){setError(errorMessage(e));}finally{setBusy(false);e.target.value='';}}}/></label>{images.map((image,i)=><div className="toolbar" key={image.assetId}><span>{image.caption}</span><button className="btn danger" disabled={busy} onClick={async()=>{setBusy(true);try{await persist(images.filter((_,j)=>j!==i));}catch(e){setError(errorMessage(e));}finally{setBusy(false);}}}>Quitar imagen</button></div>)}</details>;
}
