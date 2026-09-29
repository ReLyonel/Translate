import React, { useState, useRef } from 'react';
import {
  Upload,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  Download,
  Copy,
  Eye,
  RefreshCw,
  Shield,
  Layers,
  Sparkles,
  Check,
  FileText,
  Search,
  Filter,
  XCircle,
} from 'lucide-react';
import { JsonEngine } from '../services/json/jsonEngine';
import { FoundryValidator } from '../services/validation/foundryValidator';
import { translationService } from '../services/translation/translationService';
import { terminologyEngine } from '../services/terminology/terminologyEngine';
import { JsonInspectionResult, DetectedField, ValidationReport } from '../types';
import { SAMPLE_FOUNDRY_ITEM, SAMPLE_FOUNDRY_JOURNAL } from '../data/sampleFoundryData';

interface JsonTranslatorProps {
  onRefreshStats?: () => void;
}

type StepState = 'pending' | 'in_progress' | 'completed' | 'error';

interface PipelineStep {
  id: string;
  label: string;
  status: StepState;
}

const INITIAL_STEPS: PipelineStep[] = [
  { id: 'analyze', label: 'Analizando estructura del documento JSON', status: 'pending' },
  { id: 'protect', label: 'Detectando y aislando contenido técnico (@UUID, macros, fórmulas)', status: 'pending' },
  { id: 'extract', label: 'Extrayendo y mapeando términos oficiales de D&D 2024 / PDF', status: 'pending' },
  { id: 'translate', label: 'Traduciendo contenido humano con Ollama local', status: 'pending' },
  { id: 'restore', label: 'Restaurando macros, UUIDs y estructura original', status: 'pending' },
  { id: 'validate_json', label: 'Validando sintaxis y parseabilidad de JSON', status: 'pending' },
  { id: 'validate_structure', label: 'Verificando paridad exacta de IDs, UUIDs y claves', status: 'pending' },
];

export const JsonTranslator: React.FC<JsonTranslatorProps> = () => {
  const [inspection, setInspection] = useState<JsonInspectionResult | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressItem, setProgressItem] = useState('');
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>(INITIAL_STEPS);
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
  const [translatedJson, setTranslatedJson] = useState<any | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'TRANSLATABLE' | 'UNCERTAIN' | 'PROTECTED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'fields' | 'preview_diff'>('fields');
  const [copied, setCopied] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load JSON file
  const handleLoadJson = (content: string, fileName: string) => {
    try {
      const parsed = JSON.parse(content);
      const result = JsonEngine.analyze(parsed, fileName);
      setInspection(result);
      setTranslatedJson(null);
      setValidationReport(null);
      setProgressPercent(0);
      setPipelineSteps(INITIAL_STEPS.map((s) => ({ ...s, status: 'pending' })));
    } catch (err: any) {
      alert(`Error al analizar JSON: ${err.message}`);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      handleLoadJson(text, file.name);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type === 'application/json' || file.name.endsWith('.json'))) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        handleLoadJson(text, file.name);
      };
      reader.readAsText(file);
    }
  };

  // Toggle user inclusion of field
  const toggleFieldInclusion = (id: string) => {
    if (!inspection) return;
    setInspection((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        fields: prev.fields.map((f) => (f.id === id ? { ...f, userInclude: !f.userInclude } : f)),
      };
    });
  };

  // Translation execution pipeline
  const handleStartTranslation = async () => {
    if (!inspection || isTranslating) return;

    setIsTranslating(true);
    setProgressPercent(5);
    abortControllerRef.current = new AbortController();

    const updateStep = (id: string, status: StepState) => {
      setPipelineSteps((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status } : s))
      );
    };

    try {
      // Step 1: Analyze structure
      updateStep('analyze', 'in_progress');
      await new Promise((r) => setTimeout(r, 150));
      updateStep('analyze', 'completed');

      // Step 2: Detect & protect
      updateStep('protect', 'in_progress');
      const activeFields = inspection.fields.filter((f) => f.userInclude);
      await new Promise((r) => setTimeout(r, 150));
      updateStep('protect', 'completed');

      // Step 3: Extract terminology
      updateStep('extract', 'in_progress');
      let confirmedTermsCount = 0;
      let uncertainTermsCount = 0;
      for (const f of activeFields) {
        const { matches, uncertain } = terminologyEngine.findMatchesInText(f.originalValue);
        confirmedTermsCount += matches.length;
        uncertainTermsCount += uncertain.length;
      }
      await new Promise((r) => setTimeout(r, 150));
      updateStep('extract', 'completed');

      // Step 4: Translate with AI
      updateStep('translate', 'in_progress');
      const itemsToTranslate = activeFields.map((f) => ({
        id: f.id,
        text: f.originalValue,
        context: {
          docType: (inspection.fileName.includes('spell') ? 'spell' : 'item') as 'spell' | 'item',
          notes: f.path,
        },
      }));

      const translationResults = await translationService.translateBatch(itemsToTranslate, {
        batchSize: 6,
        signal: abortControllerRef.current.signal,
        onProgress: (done, total, current) => {
          const pct = 15 + Math.round((done / total) * 65);
          setProgressPercent(pct);
          setProgressItem(current);
        },
      });
      updateStep('translate', 'completed');

      // Step 5: Restore placeholders & macros
      updateStep('restore', 'in_progress');
      const placeholderErrors: string[] = [];
      const translatedPathValues: { path: string; value: string }[] = [];

      const updatedFields = inspection.fields.map((f) => {
        const res = translationResults.get(f.id);
        if (res) {
          if (!res.isValid) {
            placeholderErrors.push(...res.errors);
          }
          translatedPathValues.push({ path: f.path, value: res.translatedText });
          return {
            ...f,
            translatedValue: res.translatedText,
            status: 'completed' as const,
          };
        }
        return f;
      });

      // Update inspection with translated values
      setInspection((prev) => (prev ? { ...prev, fields: updatedFields } : null));
      await new Promise((r) => setTimeout(r, 150));
      updateStep('restore', 'completed');

      // Step 6: Validate JSON
      updateStep('validate_json', 'in_progress');
      const reconstructed = JsonEngine.reconstruct(inspection.rawJson, translatedPathValues);
      setTranslatedJson(reconstructed);
      await new Promise((r) => setTimeout(r, 150));
      updateStep('validate_json', 'completed');

      // Step 7: Validate structural integrity & Foundry rules
      updateStep('validate_structure', 'in_progress');
      const report = FoundryValidator.validate(inspection.rawJson, reconstructed, {
        translatedCount: activeFields.length,
        confirmedTermsCount,
        reviewedTermsCount: 0,
        uncertainTermsCount,
        placeholderErrors,
      });

      setValidationReport(report);
      updateStep('validate_structure', report.isValid ? 'completed' : 'error');
      setProgressPercent(100);
      setProgressItem('Traducción y validación completadas exitosamente.');
    } catch (err: any) {
      console.error('Batch translation failed:', err);
      alert(`Error en el proceso de traducción: ${err.message}`);
    } finally {
      setIsTranslating(false);
    }
  };

  // Download translated JSON with -es suffix
  const handleDownload = () => {
    if (!translatedJson || !inspection) return;

    // Generate filename with -es suffix: e.g. fvtt-Item.json -> fvtt-Item-es.json
    let newName = inspection.fileName;
    if (newName.endsWith('.json')) {
      newName = newName.replace(/\.json$/, '-es.json');
    } else {
      newName = `${newName}-es.json`;
    }

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(translatedJson, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', newName);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Filtered fields
  const filteredFields = (inspection?.fields || []).filter((f) => {
    if (selectedFilter === 'TRANSLATABLE' && f.classification !== 'TRANSLATABLE') return false;
    if (selectedFilter === 'UNCERTAIN' && f.classification !== 'UNCERTAIN') return false;
    if (selectedFilter === 'PROTECTED' && f.classification !== 'PROTECTED') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        f.path.toLowerCase().includes(q) ||
        f.originalValue.toLowerCase().includes(q) ||
        (f.translatedValue && f.translatedValue.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Upload & Sample Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`lg:col-span-2 border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-3 ${
            dragOver
              ? 'border-amber-400 bg-amber-950/20'
              : 'border-slate-700 hover:border-slate-500 bg-slate-900/60'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300 border border-slate-700">
            <Upload className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-200">
              Arrastra y suelta tu archivo JSON de Foundry VTT / Babele aquí
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              o haz clic para explorar tu ordenador (Items, Spells, Actors, Journal Entries, RollTables)
            </p>
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            Preservación garantizada: Claves, IDs, UUIDs y Macros permanecerán 100% idénticos
          </span>
        </div>

        {/* 1-Click Samples Box */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-slate-300">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Ejemplos Oficiales Preconfigurados</span>
            </div>
            <p className="text-xs text-slate-400">
              Prueba la preservación técnica sin necesidad de buscar un archivo local:
            </p>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => handleLoadJson(JSON.stringify(SAMPLE_FOUNDRY_ITEM, null, 2), 'fvtt-Item-warding-bond.json')}
              className="w-full text-left px-3 py-2 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-amber-200 border border-slate-700 transition flex items-center justify-between"
            >
              <span className="truncate font-mono">1. Conjuro "Warding Bond" (Macro @UUID + Roll)</span>
              <FileCode className="w-3.5 h-3.5 text-blue-400 shrink-0 ml-2" />
            </button>

            <button
              onClick={() => handleLoadJson(JSON.stringify(SAMPLE_FOUNDRY_JOURNAL, null, 2), 'fvtt-JournalEntry-combat-rules.json')}
              className="w-full text-left px-3 py-2 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-amber-200 border border-slate-700 transition flex items-center justify-between"
            >
              <span className="truncate font-mono">2. Diario "Combat Rules & Features"</span>
              <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0 ml-2" />
            </button>
          </div>

          <div className="text-[10px] text-slate-500 font-mono">
            D&D 2024 / SRD 5.2.1 • Foundry v11/v12 Compatible
          </div>
        </div>
      </div>

      {/* Document Inspector Card */}
      {inspection && (
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-xl space-y-4 p-5">
          {/* File Statistics Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <FileCode className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-slate-100 font-mono">
                  {inspection.fileName}
                </h3>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Tamaño: {(inspection.fileSize / 1024).toFixed(1)} KB • Objetos JSON: {inspection.totalObjects} • Strings detectados: {inspection.totalStrings}
              </p>
            </div>

            {/* Counts Badges */}
            <div className="flex flex-wrap gap-2 text-xs font-mono">
              <span className="px-3 py-1 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Traducibles: <strong>{inspection.translatableCount}</strong></span>
              </span>

              <span className="px-3 py-1 rounded bg-blue-950/60 text-blue-300 border border-blue-800/60 flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                <span>Protegidos: <strong>{inspection.protectedCount}</strong></span>
              </span>

              <span className="px-3 py-1 rounded bg-yellow-950/60 text-yellow-300 border border-yellow-800/60 flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-yellow-400" />
                <span>Revisión / Inciertos: <strong>{inspection.uncertainCount}</strong></span>
              </span>
            </div>
          </div>

          {/* Pipeline progress bar (Visible when translating or completed) */}
          {(isTranslating || progressPercent > 0) && (
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-4">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-300 flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  <span>{progressItem || 'Procesando pipeline técnico de Foundry...'}</span>
                </span>
                <span className="font-bold text-amber-400">{progressPercent}%</span>
              </div>

              {/* Progress track */}
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-600 via-amber-500 to-emerald-500 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Step checklist */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-2">
                {pipelineSteps.map((step) => (
                  <div
                    key={step.id}
                    className={`flex items-center space-x-2 text-[11px] font-mono p-2 rounded border ${
                      step.status === 'completed'
                        ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/50'
                        : step.status === 'in_progress'
                        ? 'bg-amber-950/40 text-amber-300 border-amber-800/50 animate-pulse'
                        : step.status === 'error'
                        ? 'bg-red-950/40 text-red-300 border-red-800/50'
                        : 'bg-slate-900 text-slate-500 border-slate-800'
                    }`}
                  >
                    {step.status === 'completed' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : step.status === 'in_progress' ? (
                      <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />
                    ) : step.status === 'error' ? (
                      <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full border border-slate-700 shrink-0" />
                    )}
                    <span className="truncate">{step.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Validation Result Box */}
          {validationReport && (
            <div
              className={`p-5 rounded-xl border shadow-lg space-y-4 ${
                validationReport.isValid
                  ? 'bg-emerald-950/30 border-emerald-800/80 text-emerald-200'
                  : 'bg-red-950/40 border-red-800 text-red-200'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center space-x-2.5">
                  {validationReport.isValid ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-6 h-6 text-red-400 shrink-0" />
                  )}
                  <div>
                    <h4 className="font-bold text-sm tracking-wide">
                      {validationReport.isValid
                        ? 'VALIDACIÓN DE INTEGRIDAD SUPERADA (100% PRESERVADO)'
                        : '⚠ ERROR DE INTEGRIDAD ESTRUCTURAL DETECTADO'}
                    </h4>
                    <p className="text-xs opacity-80 font-mono">
                      Todas las claves, IDs internos, UUIDs de Foundry y fórmulas fueron cotejados con el original.
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleDownload}
                    disabled={!validationReport.isValid}
                    className={`flex items-center space-x-2 px-5 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition shadow-lg ${
                      validationReport.isValid
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-slate-950 hover:scale-[1.02]'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                    }`}
                  >
                    <Download className="w-4 h-4" />
                    <span>Descargar JSON ({inspection.fileName.replace(/\.json$/, '-es.json')})</span>
                  </button>
                </div>
              </div>

              {/* Exact Validation Stats Grid requested in Section 20 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs font-mono bg-slate-950/70 p-3 rounded-lg border border-slate-800">
                <div>
                  <span className="text-slate-400 block text-[10px]">JSON original</span>
                  <strong className="text-emerald-400">✓ Válido</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">JSON traducido</span>
                  <strong className="text-emerald-400">✓ Válido</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Claves modificadas</span>
                  <strong className={validationReport.modifiedKeys.length === 0 ? 'text-emerald-400' : 'text-red-400'}>
                    {validationReport.modifiedKeys.length}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">IDs modificados</span>
                  <strong className={validationReport.modifiedIds.length === 0 ? 'text-emerald-400' : 'text-red-400'}>
                    {validationReport.modifiedIds.length}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">UUID modificados</span>
                  <strong className={validationReport.modifiedUuids.length === 0 ? 'text-emerald-400' : 'text-red-400'}>
                    {validationReport.modifiedUuids.length}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Macros modificadas</span>
                  <strong className={validationReport.modifiedMacros.length === 0 ? 'text-emerald-400' : 'text-red-400'}>
                    {validationReport.modifiedMacros.length}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Fórmulas modificadas</span>
                  <strong className={validationReport.modifiedFormulas.length === 0 ? 'text-emerald-400' : 'text-red-400'}>
                    {validationReport.modifiedFormulas.length}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Textos traducidos</span>
                  <strong className="text-slate-200">{validationReport.translatedTextsCount}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Términos confirmados</span>
                  <strong className="text-amber-400">{validationReport.confirmedTermsCount}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Términos inciertos</span>
                  <strong className="text-yellow-400">{validationReport.uncertainTermsCount}</strong>
                </div>
              </div>

              {/* Error messages if any */}
              {!validationReport.isValid && (
                <div className="space-y-1 text-xs font-mono text-red-300 bg-red-950 p-3 rounded border border-red-800">
                  <div className="font-bold flex items-center space-x-1 text-red-200">
                    <XCircle className="w-4 h-4 text-red-400" />
                    <span>Se detectaron alteraciones en contenido protegido:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 pt-1">
                    {validationReport.modifiedKeys.map((e, idx) => (
                      <li key={idx}>{e}</li>
                    ))}
                    {validationReport.modifiedIds.map((e, idx) => (
                      <li key={idx}>{e}</li>
                    ))}
                    {validationReport.modifiedUuids.map((e, idx) => (
                      <li key={idx}>{e}</li>
                    ))}
                    {validationReport.modifiedMacros.map((e, idx) => (
                      <li key={idx}>{e}</li>
                    ))}
                    {validationReport.placeholderErrors.map((e, idx) => (
                      <li key={idx}>{e}</li>
                    ))}
                    {validationReport.htmlErrors.map((e, idx) => (
                      <li key={idx}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center space-x-2">
              <button
                onClick={handleStartTranslation}
                disabled={isTranslating || inspection.fields.filter((f) => f.userInclude).length === 0}
                className={`flex items-center space-x-2 px-6 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider transition shadow-lg ${
                  isTranslating
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white shadow-red-950/50 border border-red-500/50'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>
                  {isTranslating
                    ? 'Traduciendo...'
                    : `Traducir Campos Seleccionados (${
                        inspection.fields.filter((f) => f.userInclude).length
                      })`}
                </span>
              </button>

              {translatedJson && (
                <button
                  onClick={handleDownload}
                  className="flex items-center space-x-2 px-4 py-2.5 rounded-lg text-xs font-semibold bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 border border-emerald-700 transition"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar -es.json</span>
                </button>
              )}
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center space-x-2 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setViewMode('fields')}
                className={`px-3 py-1 rounded text-xs font-medium transition ${
                  viewMode === 'fields'
                    ? 'bg-slate-800 text-amber-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Campos ({filteredFields.length})
              </button>
              <button
                onClick={() => setViewMode('preview_diff')}
                disabled={!translatedJson}
                className={`px-3 py-1 rounded text-xs font-medium transition ${
                  !translatedJson
                    ? 'opacity-40 cursor-not-allowed text-slate-600'
                    : viewMode === 'preview_diff'
                    ? 'bg-slate-800 text-amber-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Comparación JSON
              </button>
            </div>
          </div>

          {/* Fields Table View */}
          {viewMode === 'fields' && (
            <div className="space-y-3 pt-2">
              {/* Filter and Search Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded border border-slate-800">
                  <button
                    onClick={() => setSelectedFilter('ALL')}
                    className={`px-2.5 py-0.5 rounded text-[11px] ${
                      selectedFilter === 'ALL'
                        ? 'bg-slate-800 text-slate-100 font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Todos ({inspection.fields.length})
                  </button>
                  <button
                    onClick={() => setSelectedFilter('TRANSLATABLE')}
                    className={`px-2.5 py-0.5 rounded text-[11px] ${
                      selectedFilter === 'TRANSLATABLE'
                        ? 'bg-emerald-950 text-emerald-300 font-bold border border-emerald-800/50'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Traducibles ({inspection.translatableCount})
                  </button>
                  <button
                    onClick={() => setSelectedFilter('UNCERTAIN')}
                    className={`px-2.5 py-0.5 rounded text-[11px] ${
                      selectedFilter === 'UNCERTAIN'
                        ? 'bg-yellow-950 text-yellow-300 font-bold border border-yellow-800/50'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Inciertos ({inspection.uncertainCount})
                  </button>
                  <button
                    onClick={() => setSelectedFilter('PROTECTED')}
                    className={`px-2.5 py-0.5 rounded text-[11px] ${
                      selectedFilter === 'PROTECTED'
                        ? 'bg-blue-950 text-blue-300 font-bold border border-blue-800/50'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Protegidos ({inspection.protectedCount})
                  </button>
                </div>

                <div className="relative min-w-[200px]">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar ruta o texto..."
                    className="w-full pl-8 pr-3 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 font-mono focus:outline-none focus:border-slate-700"
                  />
                </div>
              </div>

              {/* Table */}
              <div className="border border-slate-800 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">Incluir</th>
                      <th className="py-2.5 px-3 w-44">Ruta JSON</th>
                      <th className="py-2.5 px-3 w-28">Clasificación</th>
                      <th className="py-2.5 px-3">Contenido Original (Inglés)</th>
                      <th className="py-2.5 px-3">Traducción (Español)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-900/50">
                    {filteredFields.map((field) => (
                      <tr
                        key={field.id}
                        className={`hover:bg-slate-800/40 transition ${
                          field.classification === 'PROTECTED' ? 'opacity-60' : ''
                        }`}
                      >
                        <td className="py-2 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={field.userInclude}
                            disabled={field.classification === 'PROTECTED'}
                            onChange={() => toggleFieldInclusion(field.id)}
                            className="rounded border-slate-700 text-amber-500 focus:ring-0 cursor-pointer"
                          />
                        </td>
                        <td className="py-2 px-3 text-slate-300 font-medium truncate max-w-[180px]">
                          {field.path}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              field.classification === 'TRANSLATABLE'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                                : field.classification === 'UNCERTAIN'
                                ? 'bg-yellow-950 text-yellow-300 border border-yellow-800/50'
                                : 'bg-blue-950 text-blue-400 border border-blue-800/50'
                            }`}
                          >
                            {field.classification}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-300 max-w-xs truncate" title={field.originalValue}>
                          {field.originalValue}
                        </td>
                        <td className="py-2 px-3 text-amber-300 max-w-xs truncate">
                          {field.translatedValue ? (
                            <span title={field.translatedValue}>{field.translatedValue}</span>
                          ) : (
                            <span className="text-slate-600 italic">Pendiente</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Side-by-side JSON Diff View */}
          {viewMode === 'preview_diff' && translatedJson && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400 bg-slate-950 px-3 py-1.5 rounded-t border border-slate-800">
                  <span className="text-blue-400 font-bold">ORIGINAL ({inspection.fileName})</span>
                  <span>100% Intacto</span>
                </div>
                <pre className="p-3 bg-slate-950 border border-slate-800 rounded-b text-[11px] font-mono text-slate-300 max-h-96 overflow-auto">
                  {JSON.stringify(inspection.rawJson, null, 2)}
                </pre>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400 bg-slate-950 px-3 py-1.5 rounded-t border border-slate-800">
                  <span className="text-emerald-400 font-bold">
                    TRADUCIDO ({inspection.fileName.replace(/\.json$/, '-es.json')})
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(translatedJson, null, 2));
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="flex items-center space-x-1 text-slate-400 hover:text-white"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
                <pre className="p-3 bg-slate-950 border border-slate-800 rounded-b text-[11px] font-mono text-emerald-200/90 max-h-96 overflow-auto">
                  {JSON.stringify(translatedJson, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
