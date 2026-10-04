import React, { useState, useEffect } from 'react';

import { FilePlus2, FolderOpen, LoaderCircle } from 'lucide-react';

import { terminologyEngine } from '../services/terminology/terminologyEngine';
import type { NativeSelection, DesktopProgress, BatchProgress } from '../../desktop/contracts';



export function BatchTranslator({ onLoad, disabled = false }: { onLoad: (content: string, name: string) => void; disabled?: boolean }) {

  const [selection, setSelection] = useState<NativeSelection | null>(null);

  const [batch, setBatch] = useState<BatchProgress | null>(null);
  const [cancelling,setCancelling]=useState(false);

  const [language, setLanguage] = useState<'auto' | 'en' | 'ru'>('auto');
  const [outputStrategy,setOutputStrategy]=useState<import('../../desktop/contracts').OutputStrategy>('TRANSLATION_OVERLAY');
  const [preflight,setPreflight]=useState<(import('../../desktop/translation/preflight').TranslationPreflight&{token:string})|null>(null);
  const [memoryMessage,setMemoryMessage]=useState('');
  const [historicalReviewed,setHistoricalReviewed]=useState(false);
  const terms=()=>terminologyEngine.getAllTerms().map(term=>({source:term.source,target:term.target}));

  useEffect(() => { let active = true; const unsubscribe = window.desktop.onBatchProgress(value => { if (active) setBatch(value); }); window.desktop.getBatchProgress().then(value => { if (active) setBatch(current => current || value); }).catch(() => {}); return () => { active = false; unsubscribe(); }; }, []);

  const running = batch?.state === 'RUNNING';

  const [error, setError] = useState('');

  const [busy, setBusy] = useState(false);

  const [progress, setProgress] = useState<DesktopProgress | null>(null);

  useEffect(() => {

    let active = true;

    const update = (value: DesktopProgress) => { if (active) setProgress(current => !current || value.sequence >= current.sequence ? value : current); };

    const unsubscribe = window.desktop.onProgress(update);

    window.desktop.getProgress().then(update).catch(() => {});

    return () => { active = false; unsubscribe(); };

  }, []);

  async function select(kind: 'file' | 'directory') {

    setError(''); setBusy(true);

    try {

      const next = await window.desktop.selectInput(kind);

      if (!next) return;

      setSelection(next);
      setPreflight(null);setMemoryMessage('');

      if (kind === 'file' && next.files[0]) {

        const file = await window.desktop.readInput(next.handle, next.files[0].id);

        onLoad(file.content, file.name);

      }

    } catch { setError('No se pudo abrir la selección. Comprueba permisos y tamaño.'); }

    finally { setBusy(false); }

  }

  async function cancelBatch() {
    if(!batch||cancelling)return;
    // Feedback is immediate; IPC resolves only after in-flight publication/cleanup settles.
    setCancelling(true);
    try { await window.desktop.cancelBatch(batch.id); }
    catch { setError('No se pudo confirmar la cancelación. Comprueba el estado del lote.'); }
    finally { setCancelling(false); }
  }

  return <section className="selection-panel space-y-3">

    <div className="flex gap-2 items-center flex-wrap">

      <button disabled={busy || disabled || running} onClick={() => select('file')} className="primary-action">{busy ? <LoaderCircle size={16} className="animate-spin" /> : <FilePlus2 size={16} />}Seleccionar archivo</button>

      <button disabled={busy || disabled || running} onClick={() => select('directory')} className="secondary-action"><FolderOpen size={16} />Seleccionar carpeta</button>

      <span className="text-xs text-slate-500 ml-auto">JSON · Copias seguras</span>

    </div>

    {selection?.kind === 'directory' && <>
      <p className="text-xs text-amber-300">Esta versión traduce las fuentes. La reconstrucción de compendios nativos y la verificación en Foundry siguen pendientes.</p>

      <p className="text-xs text-slate-400">{selection.name} · {selection.files.length} JSON en _source. Se traducen fuentes y textos visibles de scripts conservando el módulo original.</p>
      <label className="text-xs text-slate-300">Salida <select aria-label="Estrategia de salida" disabled={running||busy} value={outputStrategy} onChange={e=>{setOutputStrategy(e.target.value as typeof outputStrategy);setPreflight(null);}} className="bg-slate-950 p-2 rounded ml-2"><option value="TRANSLATION_OVERLAY">Solo archivos modificados</option><option value="FULL_PORTABLE_COPY">Copia completa con recursos</option></select></label>
      <p className="text-xs text-slate-400">{outputStrategy==='TRANSLATION_OVERLAY'?'Archivos traducidos para integrar con el módulo original. Esta salida no es un módulo autónomo; sustituye únicamente los archivos incluidos y conserva los demás.':'Copia completa para validación aislada o distribución, incluidos los recursos originales.'}</p>

      <div className="flex gap-2 items-center">

        <select aria-label="Idioma del lote" disabled={running||busy} value={language} onChange={e => {setLanguage(e.target.value as typeof language);setPreflight(null);}} className="bg-slate-950 p-2 rounded text-xs"><option value="auto">Detectar idioma</option><option value="en">Inglés</option><option value="ru">Ruso</option></select>

        <button className="secondary-action" disabled={running||disabled||busy} onClick={async()=>{setBusy(true);setPreflight(null);setError('');try{setPreflight(await window.desktop.preflightBatch(selection.handle,language,terms()));}catch{setError('No se pudo analizar la carpeta.');}finally{setBusy(false);}}}>Analizar antes de traducir</button>
        <button className="secondary-action" disabled={running||disabled||busy} onClick={async()=>{setBusy(true);setPreflight(null);try{const result=await window.desktop.importSpanishMemory(selection.handle);if(result){setMemoryMessage(`${result.candidates} candidatas de traducción. Apruébalas en Memoria y revisión antes de volver a analizar. ${result.unmatched} entradas sin coincidencia segura. ${result.reviewable_unique_units} campos compatibles estructuralmente; ${result.conflicting_units} con alternativas en conflicto.`);}}catch{setError('No se pudo preparar la memoria española.');}finally{setBusy(false);}}}>Importar memoria candidata</button>
        <label className="text-sm text-slate-300"><input type="checkbox" checked={historicalReviewed} disabled={running||busy} onChange={e=>setHistoricalReviewed(e.target.checked)}/> Declaro que traduje o revisé este corpus histórico</label>
        <button className="secondary-action" disabled={!historicalReviewed||running||disabled||busy} onClick={async()=>{setBusy(true);setPreflight(null);try{const result=await window.desktop.importApprovedHistoricalMemory(selection.handle,'USER_APPROVED_TRANSLATION_CORPUS');if(result)setMemoryMessage(`${result.approved_created} traducciones aprobadas importadas; ${result.unchanged} entradas ya existentes; ${result.conflicts.length} conflictos excluidos. La aprobación no atribuye identidad canónica. Vuelve a analizar para comprobar la reutilización.`);}catch{setError('No se pudo importar el corpus aprobado. Si su contenido cambió, necesita una nueva declaración de confianza.');}finally{setBusy(false);}}}>Importar histórico aprobado</button>

      </div>
      {memoryMessage&&<p className="text-xs text-amber-300">{memoryMessage}</p>}
      {preflight&&<div className="rounded-lg border border-slate-700 p-3 text-xs space-y-2">
        <p>{preflight.files} archivos · {preflight.strings_translatable} cadenas · {preflight.strings_unique} únicas</p>
        <p>Canónicas/SRD: {preflight.canonical_candidates} · TM: {preflight.exact_tm_candidates} · Caché: {preflight.cache_candidates} · Glosario: {preflight.glossary_only_hits} · Contexto fuzzy: {preflight.fuzzy_tm_candidates} · Solo tokens: {preflight.protected_only_strings}</p>
        <p>Requieren IA: {preflight.strings_requiring_ai} · Peticiones estimadas, sin reintentos: {preflight.estimated_model_calls}</p>
        <details><summary className="cursor-pointer text-slate-300">Diagnóstico de reutilización por fuente</summary><div className="mt-2 space-y-2 text-slate-400"><p>Identidad RU declarada: {preflight.reuse_diagnostics.canonical.declared_ru_documents} documentos · Con español aprobado utilizable: {preflight.reuse_diagnostics.canonical.demonstrable_ru_documents}</p><p>Histórico aprobado: {preflight.reuse_diagnostics.historical.babele_approved_entries} entradas · {preflight.babele_safe_exact_hits} hits seguros · {preflight.reuse_diagnostics.historical.babele_conflicts} conflictos excluidos · {preflight.reuse_diagnostics.historical.babele_context_required} entradas requieren contexto</p><p>TM: {preflight.reuse_diagnostics.translation_memory.entries_loaded} entradas · {preflight.reuse_diagnostics.translation_memory.approved_entries} aprobadas · {preflight.reuse_diagnostics.translation_memory.context_rejected} unidades rechazadas por contexto · {preflight.reuse_diagnostics.translation_memory.source_binding_unverified} asociaciones de texto fuente sin verificar</p><p>Caché actual: {preflight.cache_candidates} hits · Caché antigua aislada: {preflight.reuse_diagnostics.cache.legacy_cache_unverified} registros</p><p>PDF: VERIFIED {preflight.reuse_diagnostics.pdf.verified} · HIGH_CONFIDENCE {preflight.reuse_diagnostics.pdf.high_confidence} · AMBIGUOUS {preflight.reuse_diagnostics.pdf.ambiguous} · REJECTED {preflight.reuse_diagnostics.pdf.rejected}</p>{([['CANONICAL',preflight.reuse_diagnostics.canonical.reasons],['TM',preflight.reuse_diagnostics.translation_memory.reasons],['CACHE',preflight.reuse_diagnostics.cache.reasons]] as const).map(([label,reasons])=><p key={label}>{label}: {Object.entries(reasons).map(([reason,count])=>`${reason}: ${count}`).join(' · ')||'Sin rechazos registrados'}</p>)}<p>La aprobación histórica acredita una traducción en su contexto; no demuestra identidad canónica. El SRD español prevalece cuando su correspondencia está verificada.</p></div></details>
        <p>{preflight.model} · Backend: {preflight.placement.backend} · VRAM del modelo cargado: {preflight.placement.vram_estimated===null?'No disponible':(preflight.placement.vram_estimated/1024**3).toFixed(1)+' GiB'}</p>
        <p>Memoria: {preflight.memory.memory_entries_total} entradas, {preflight.memory.approved_entries} aprobadas · Glosario persistente: {preflight.memory.glossary_entries} · Caché: {preflight.memory.cache_entries}</p>
        <p>PDF verificados: {preflight.pdf_memory.verified_documents} · Pares aprobados: {preflight.pdf_memory.approved_alignments} · Conflictos: {preflight.pdf_memory.conflicting_approved_alignments}</p>
        <p>SRD PDF: {preflight.pdf_exact_candidates} exactas · {preflight.pdf_canonical_candidates} por vínculo · {preflight.pdf_context_candidates} para contexto · {preflight.pdf_review_candidates} cadenas con propuestas pendientes. Peticiones omitidas estimadas: {preflight.pdf_model_calls_avoided}.</p>
        {preflight.warnings.map(warning=><p key={warning} className="text-amber-300">{warning==='MEMORY_UTILIZATION_WARNING'?'MEMORY_UTILIZATION_WARNING: memoria cargada sin coincidencias aprobadas. Revisa idioma, identidad, contexto y aprobación.':warning}</p>)}
        {preflight.gpu.gpus.map((gpu,i)=><p key={i}>{gpu.name} · GPU: {gpu.temperature??'N/D'} °C · Memoria: {gpu.memory_temperature===null?'No disponible':gpu.memory_temperature+' °C'}</p>)}
        {!preflight.gpu.available&&<p className="text-amber-300">Telemetría NVIDIA no disponible. No se puede detectar sobrecalentamiento con estos sensores.</p>}
        <div className="flex gap-2"><button className="primary-action" disabled={running||disabled||busy} onClick={async()=>{setBusy(true);try{const result=await window.desktop.startBatch(selection.handle,language,terms(),preflight.token,outputStrategy);if(result){setBatch(result);setPreflight(null);}}catch{setPreflight(null);setError('El análisis cambió o no se pudo iniciar. Analiza nuevamente.');}finally{setBusy(false);}}}>{outputStrategy==='TRANSLATION_OVERLAY'?'Generar archivos traducidos':'Generar copia completa'}</button><button className="secondary-action" onClick={()=>setPreflight(null)}>Descartar análisis</button></div>
      </div>}

      <select aria-label="Archivo de la carpeta" disabled={disabled || running} className="w-full bg-slate-950 rounded p-2 text-xs border border-slate-700" defaultValue="" onChange={async e => {

        if (!e.target.value) return;

        try { const file = await window.desktop.readInput(selection.handle, e.target.value); onLoad(file.content, file.name); }

        catch { setError('No se pudo leer el archivo seleccionado.'); }

      }}><option value="">Seleccionar JSON…</option>{selection.files.map(file => <option key={file.id} value={file.id}>{file.name}</option>)}</select>

    </>}

    {batch && <div role="status" className="text-xs space-y-2">

      <p>{batch.state === 'RUNNING' ? 'Traduciendo carpeta' : batch.state === 'COMPLETED' ? 'Lote completado' : batch.state === 'ERROR' ? 'Error de lote' : 'Lote cancelado'}: {batch.completed}/{batch.total} archivos procesados; {batch.failed} con advertencias; {batch.validated ?? 0} validados sin fallos.</p>

      <progress className="w-full" value={batch.completed} max={batch.total || 1} />

      <p className="truncate">{batch.current}</p>
      {batch.publication&&<p>Analizados: {batch.publication.files_scanned} · Traducidos: {batch.publication.files_translated} · Sin cambios: {batch.publication.files_unchanged} · Escritos: {batch.publication.files_written} · Assets omitidos: {batch.publication.assets_skipped} · Espacio no duplicado: {(batch.publication.bytes_avoided/1024**2).toFixed(1)} MiB</p>}
      {batch.outputStrategy==='TRANSLATION_OVERLAY'&&<p>Archivos traducidos para integrar con el módulo original.</p>}
      {batch.thermal&&<p className={batch.thermal.state==='NORMAL'?'text-slate-400':'text-amber-300'}>{batch.thermal.state==='THERMAL_PAUSE'?'Pausa térmica: esperando enfriamiento. Puedes cancelar el lote.':batch.thermal.state==='THERMAL_WARNING'?'Advertencia térmica':'Monitor térmico'} · {batch.thermal.gpus.map(g=>`GPU ${g.temperature??'N/D'} °C · Memoria ${g.memory_temperature??'N/D'} °C`).join(' / ')}</p>}

      {running ? <button className="secondary-action" disabled={cancelling} onClick={cancelBatch}>{cancelling?'Cancelando…':'Cancelar lote'}</button> : <button className="secondary-action" onClick={() => window.desktop.openOutput().catch(() => setError('Salida no disponible.'))}>Abrir carpeta de salida</button>}

      {batch.errors.map(message => <p key={message} className="text-amber-300">{message}</p>)}
      {batch.warnings?.map(message => <p key={message} className="text-amber-300">{message}</p>)}
      {!!batch.generatedLocalizations?.length && <p>{batch.generatedLocalizations.length} archivos de localización española generados y registrados.</p>}
      {batch.reportAvailable && <button className="secondary-action" onClick={()=>window.desktop.exportReport().catch(()=>setError('No se pudo exportar el informe.'))}>Exportar informe</button>}

    </div>}

    {error && <p role="alert" className="text-red-300">{error}</p>}

    {progress?.state === 'TRANSLATING' && <p role="status" className="text-sm text-amber-300">Traduciendo {progress.count} cadenas con el motor seleccionado…</p>}

  </section>;

}

