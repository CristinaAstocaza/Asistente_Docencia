"use client";
import { useEffect, useState } from 'react';
import { Download, ExternalLink, RefreshCw } from 'lucide-react';
import { request, post, errorMessage, Material } from '@/services/api';
import './pdf-preview.css';

/** The document exactly as it will be downloaded: the server renders the PDF and the page shows it. */
export default function DocumentPdfPreview({ material, onDownload }: { material: Material; onDownload: (format: string, answerKey?: boolean) => void }) {
 const [answerKey, setAnswerKey] = useState(false);
 const [attempt, setAttempt] = useState(0);
 const [result, setResult] = useState<{ key: string; url?: string; error?: string }>({ key: '' });
 const exam = material.kind === 'exam' || material.kind === 'questions';
 const key = `${material.id}:${material.version}:${answerKey}:${attempt}`;
 const loading = result.key !== key, url = loading ? '' : result.url ?? '', error = loading ? '' : result.error ?? '';

 useEffect(() => {
  let active = true, objectUrl = '';
  request(`/content/${material.id}/export`, post({ format: 'pdf', preview: true, answerKey }))
   .then(r => r.blob())
   .then(blob => { if (!active) return; objectUrl = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' })); setResult({ key, url: objectUrl }); })
   .catch(e => { if (active) setResult({ key, error: errorMessage(e) }); });
  return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
 }, [key, material.id, answerKey]);

 return <div className="pdf-preview">
  <div className="pdf-preview-bar">
   {exam ? <div className="pdf-preview-switch" role="group" aria-label="Versión del documento">
    <button className={!answerKey ? 'active' : ''} onClick={() => setAnswerKey(false)}>Examen del estudiante</button>
    <button className={answerKey ? 'active' : ''} onClick={() => setAnswerKey(true)}>Solucionario</button>
   </div> : <span className="pdf-preview-label">Vista previa del documento final</span>}
   <div className="pdf-preview-actions">
    <button className="btn primary" onClick={() => onDownload('pdf', answerKey)}><Download size={14} />Descargar PDF</button>
    {!(exam && answerKey) && material.kind !== 'presentation' && <button className="btn" onClick={() => onDownload('docx', answerKey)}><Download size={14} />Word</button>}
    {url && <a className="btn icon" href={url} target="_blank" rel="noreferrer" title="Abrir en otra pestaña" aria-label="Abrir el PDF en otra pestaña"><ExternalLink size={15} /></a>}
   </div>
  </div>
  {loading && <div className="pdf-preview-loading" role="status"><span className="pdf-spinner" />Preparando la vista previa en PDF…</div>}
  {error && <div className="error-box" role="alert">{error}<button className="btn" onClick={() => setAttempt(a => a + 1)}><RefreshCw size={14} />Reintentar</button></div>}
  {url && !error && <iframe className="pdf-preview-frame" src={`${url}#navpanes=0&view=FitH`} title={`Vista previa en PDF: ${material.title}`} hidden={loading} />}
 </div>;
}
