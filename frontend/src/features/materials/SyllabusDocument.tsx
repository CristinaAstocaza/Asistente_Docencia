"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ExternalLink } from 'lucide-react';
import { api, post, request, errorMessage, Material } from '@/services/api';
import { notify } from '@/components/feedback';

/** The generated syllabus shown as the document that will be downloaded. */
export function SyllabusPreview({ material }: { material: Material }) {
 const [url, setUrl] = useState(''), [error, setError] = useState('');
 useEffect(() => {
  let active = true, created = '';
  request(`/content/${material.id}/syllabus-preview`).then(r => r.blob()).then(blob => { if (!active) return; created = URL.createObjectURL(blob); setUrl(created); }).catch(e => { if (active) setError(errorMessage(e)); });
  return () => { active = false; if (created) URL.revokeObjectURL(created); };
 }, [material.id, material.version]);
 if (error) return <p className="error-box" role="alert">{error}</p>;
 return url ? <iframe className="syllabus-preview-frame" src={url} title={`Vista previa de ${material.title}`} /> : <p className="loading-line" role="status">Preparando la vista previa del documento…</p>;
}

/** Accepting is optional: it only creates the course with its weeks in «Sesiones de aprendizaje». */
export function SyllabusAccept({ material, disabled }: { material: Material; disabled: boolean }) {
 const [accepted, setAccepted] = useState<boolean | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
 useEffect(() => {
  let active = true;
  api<{ syllabus_id: string }[]>('/courses').then(list => { if (active) setAccepted(list.some(c => c.syllabus_id === material.id)); }).catch(() => { if (active) setAccepted(false); });
  return () => { active = false; };
 }, [material.id]);
 async function accept() {
  setBusy(true); setError('');
  try { await api('/courses', post({ syllabusId: material.id })); setAccepted(true); notify('Curso creado en Sesiones de aprendizaje.'); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
 }
 return <aside className={`syllabus-accept${accepted ? ' done' : ''}`}>
  <div>
   <strong>{accepted ? 'Este sílabo ya es un curso' : '¿Vas a dictar este curso?'}</strong>
   <p>{accepted ? 'Sus semanas están en Sesiones de aprendizaje. Si editas el sílabo, vuelve a aceptarlo para actualizar las semanas que aún no preparaste.' : 'Es opcional. Si solo necesitas el documento, descárgalo. Si lo vas a dictar, acéptalo y sus semanas aparecerán en Sesiones de aprendizaje.'}</p>
   {error && <p className="error-box" role="alert">{error}</p>}
  </div>
  <div className="toolbar">
   <button type="button" className={accepted ? 'btn' : 'btn primary'} disabled={disabled || busy || accepted === null} onClick={accept}><CheckCircle2 size={14} />{accepted ? 'Actualizar curso' : 'Aceptar sílabo'}</button>
   {accepted && <Link className="btn" href="/sesiones"><ExternalLink size={14} />Ver semanas</Link>}
  </div>
 </aside>;
}

