"use client";
import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { api, errorMessage, Material, post, Source } from '@/services/api';
import SourcePicker from '@/features/sources/SourcePicker';
import GuideResult from './GuideResult';
import TemplatePicker from './TemplatePicker';
import './guide.css';

export default function GuideWorkspace() {
  const [topic, setTopic] = useState('');
  const [type, setType] = useState('Paso a paso');
  const [sources, setSources] = useState<Source[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [mode, setMode] = useState<'general' | 'sources'>('general');
  const [templateIds, setTemplates] = useState<string[]>([]);
  const [uploadingTemplates, setUploadingTemplates] = useState(false);
  const [templateMode, setTemplateMode] = useState('structure');
  const [parameters, setParameters] = useState<Record<string, string>>({ pages: '6' });
  const [material, setMaterial] = useState<Material | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [parentId, setParent] = useState('');

  useEffect(() => {
    let active = true;
    api<Source[]>('/documents')
      .then(v => { if (active) setSources(v); })
      .catch(e => { if (active) setError(errorMessage(e)); });

    const q = new URLSearchParams(window.location.search);
    const id = q.get('id');
    const from = q.get('from');

    queueMicrotask(() => {
      if (!active) return;
      if (q.get('topic')) setTopic(q.get('topic')!);
      if (from) setParent(from);
      setParameters(p => ({
        ...p,
        ...Object.fromEntries(['course', 'outcome', 'duration', 'week', 'unit'].filter(k => q.get(k)).map(k => [k, q.get(k)!]))
      }));
    });

    if (id || from) {
      api<Material>(`/content/${id || from}`)
        .then(m => {
          if (!active) return;
          if (id && m.kind === 'guide') setMaterial(m);
          else {
            setTopic(q.get('topic') || m.title);
            setSelected(m.source_ids);
            setMode(m.mode);
          }
        })
        .catch(e => { if (active) setError(errorMessage(e)); });
    }

    return () => { active = false; };
  }, []);

  async function generate() {
    setBusy(true);
    setError('');
    try {
      setMaterial(await api<Material>('/generate', post({
        kind: 'guide',
        topic,
        sourceIds: selected,
        mode,
        templateIds,
        visualAssetIds: [],
        templateMode,
        parentId: parentId || undefined,
        parameters: {
          ...Object.fromEntries(Object.entries(parameters).filter(([, v]) => v.trim())),
          guideType: type,
          visualMode: 'diagrams'
        }
      })));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="workspace">
      <header className="page-heading">
        <div>
          <span className="eyebrow">Materiales para aprender haciendo</span>
          <h1>Crear guía didáctica</h1>
          <p>Describe el material que necesitas y la IA te ayudará a crearlo.</p>
        </div>
        <a className="btn" href="/historial">Historial</a>
      </header>

      {error && <p role="alert" className="error-box">{error}</p>}
      {material?.visualNotice && <p role="status" className="muted">{material.visualNotice}</p>}

      {!material ? (
        <div className="card form-panel">
          <label className="field">
            ¿Sobre qué tema deseas crear tu guía?
            <textarea
              rows={5}
              value={topic}
              maxLength={2000}
              onChange={e => setTopic(e.target.value)}
              placeholder="Crea una guía práctica de Spring Boot con NetBeans, incluyendo código, diagramas, ejemplos y ejercicios."
            />
          </label>

          <SourcePicker
            sources={sources}
            selected={selected}
            onChange={setSelected}
            mode={mode}
            onMode={setMode}
          />


          <div className="toolbar">
            <label className="field grow">
              Tipo de guía
              <select value={type} onChange={e => setType(e.target.value)}>
                {['Paso a paso', 'Laboratorio', 'Análisis de casos'].map(t => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="field">
            Cantidad orientativa de páginas (incluida la portada)
            <input
              type="number"
              min={2}
              max={30}
              value={parameters.pages || 6}
              onChange={e => setParameters(v => ({ ...v, pages: e.target.value }))}
            />
          </label>
          <p className="muted">Si un apartado necesita más espacio, continuará en otra página para conservar el contenido.</p>

          <TemplatePicker
            value=""
            onChange={() => {}}
            values={templateIds}
            onValuesChange={setTemplates}
            onBusyChange={setUploadingTemplates}
            mode={templateMode}
            onMode={setTemplateMode}
          />

          <details className="lesson-options">
            <summary>Opciones avanzadas</summary>
            {[['career', 'Carrera'], ['course', 'Curso'], ['duration', 'Duración'], ['level', 'Nivel'], ['objectives', 'Objetivos'], ['guidelines', 'Lineamientos']].map(([key, label]) => (
              <label className="field" key={key}>
                {label}
                <input
                  value={parameters[key] || ''}
                  onChange={e => setParameters(v => ({ ...v, [key]: e.target.value }))}
                />
              </label>
            ))}
          </details>

          <button
            disabled={busy || uploadingTemplates || !topic.trim()}
            className="btn primary"
            onClick={() => void generate()}
          >
            {busy ? 'Generando guía…' : 'Generar guía con IA'}
          </button>
          {busy && (
            <p className="muted" role="status">
              Gemini está preparando el contenido. Una guía detallada puede tardar varios minutos.
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="toolbar">
            <button
              type="button"
              className="btn"
              onClick={() => {
                setMaterial(null);
                setError('');
                const url = new URL(window.location.href);
                url.searchParams.delete('id');
                window.history.replaceState(null, '', url);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              <ArrowLeft size={18} aria-hidden="true" />
              Volver para crear otra guía
            </button>
          </div>

          <GuideResult key={material.id} material={material} />

          <p className="muted">
            {material.mode === 'sources'
              ? 'Generada con tus fuentes seleccionadas'
              : 'Fuentes y conocimiento general de IA'}
          </p>

          {material.citations.length > 0 && (
            <details>
              <summary>Fuentes consultadas</summary>
              {material.citations.map((c, i) => (
                <p key={i}>
                  [{c.reference}] {c.name}
                  {c.page ? ` — página/diapositiva ${c.page}` : ''}
                </p>
              ))}
            </details>
          )}
        </>
      )}
    </div>
  );
}
