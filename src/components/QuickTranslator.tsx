import React, { useState, useEffect } from 'react';
import {
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  ShieldCheck,
  BookOpen,
  Info,
  HelpCircle,
  Plus,
  ArrowRight,
} from 'lucide-react';
import { translationService, TranslationResult } from '../services/translation/translationService';
import { terminologyEngine } from '../services/terminology/terminologyEngine';
import { TerminologyEntry, TranslationContext } from '../types';

interface QuickTranslatorProps {
  onAddTermToGlossary: (term: { source: string; target: string; category?: string }) => void;
  onRefreshTerms: () => void;
}

const SAMPLE_TEXTS = [
  {
    label: 'Combate & Ventaja (D&D 2024)',
    text: 'Whenever you make an attack roll or an ability check, you might have advantage or disadvantage. When you have advantage, you roll a second d20 and use the higher roll. A critical hit occurs on a natural 20.',
  },
  {
    label: 'Macro Foundry & Fórmulas',
    text: 'You touch another willing creature and cast @UUID[Compendium.dnd5e.spells.Item.wardingbond123]{Warding Bond}. While within 60 feet, the target gains +1 to Armor Class and saving throws. Roll bonus healing: [[/roll 1d8 + 3 # Healing]].',
  },
  {
    label: 'Desambiguación (Feature / Feat / Skill)',
    text: 'At 3rd level, your character gains a new subclass feature. When you reach 4th level, you can choose a feat instead of improving a skill proficiency.',
  },
];

export const QuickTranslator: React.FC<QuickTranslatorProps> = ({
  onAddTermToGlossary,
  onRefreshTerms,
}) => {
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [translationResult, setTranslationResult] = useState<TranslationResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Live terminology detection
  const [detectedTerms, setDetectedTerms] = useState<TerminologyEntry[]>([]);
  const [uncertainTerms, setUncertainTerms] = useState<string[]>([]);

  // Disambiguation selection state
  const [docContext, setDocContext] = useState<TranslationContext>({
    docType: 'generic',
    notes: 'Texto rápido de D&D',
  });

  // Modal or inline for adding uncertain term
  const [newTermModal, setNewTermModal] = useState<{ source: string; target: string } | null>(null);

  // Scan terms whenever input text changes
  useEffect(() => {
    if (!inputText.trim()) {
      setDetectedTerms([]);
      setUncertainTerms([]);
      return;
    }

    const { matches, uncertain } = terminologyEngine.findMatchesInText(inputText, docContext);
    setDetectedTerms(matches);
    setUncertainTerms(uncertain);
  }, [inputText, docContext]);

  // Translate handler
  const handleTranslate = async () => {
    if (!inputText.trim() || isTranslating) return;

    setIsTranslating(true);
    setErrorMessage(null);

    try {
      const result = await translationService.translateSingle(inputText, docContext);
      setTranslationResult(result);
      setOutputText(result.translatedText);

      if (!result.isValid && result.errors.length > 0) {
        setErrorMessage(result.errors.join('; '));
      }
    } catch (err: any) {
      console.error('Translation error:', err);
      setErrorMessage(err.message || 'Error al traducir con el servidor');
    } finally {
      setIsTranslating(false);
    }
  };

  // Copy handler
  const handleCopy = () => {
    if (!outputText) return;
    navigator.clipboard.writeText(outputText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Clear handler
  const handleClear = () => {
    setInputText('');
    setOutputText('');
    setTranslationResult(null);
    setErrorMessage(null);
  };

  // Keyboard shortcut Ctrl+Enter or Cmd+Enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleTranslate();
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Quick sample buttons bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Ejemplos de prueba rápida:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {SAMPLE_TEXTS.map((sample, idx) => (
            <button
              key={idx}
              onClick={() => {
                setInputText(sample.text);
              }}
              className="px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-200 border border-slate-700 transition"
            >
              {sample.label}
            </button>
          ))}
        </div>
      </div>

      {/* Dual translation panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: English Original */}
        <div className="flex flex-col bg-slate-900 rounded-xl border border-slate-800 shadow-xl overflow-hidden focus-within:border-slate-700 transition">
          <div className="px-4 py-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <h2 className="text-sm font-semibold text-slate-200 tracking-wide">
                TEXTO ORIGINAL (INGLÉS)
              </h2>
            </div>
            <div className="text-[11px] font-mono text-slate-400 flex items-center space-x-2">
              <span>{inputText.length} caracteres</span>
              <span className="hidden sm:inline text-slate-600">•</span>
              <span className="hidden sm:inline text-slate-500">Ctrl + Enter para traducir</span>
            </div>
          </div>

          <div className="p-4 flex-1 flex flex-col">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pega aquí el texto en inglés de D&D 2024, compendio, conjuro o entrada de Foundry VTT..."
              className="w-full flex-1 min-h-[260px] bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none resize-none font-mono text-sm leading-relaxed"
            />
          </div>

          {/* Context bar */}
          <div className="px-4 py-2.5 bg-slate-950/50 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              <span className="text-slate-400">Contexto:</span>
              <select
                value={docContext.docType}
                onChange={(e) =>
                  setDocContext((prev) => ({
                    ...prev,
                    docType: e.target.value as any,
                  }))
                }
                className="bg-slate-800 text-slate-200 border border-slate-700 rounded px-2 py-0.5 text-xs focus:outline-none"
              >
                <option value="generic">Reglas Generales D&D</option>
                <option value="spell">Conjuro / Magia</option>
                <option value="item">Objeto / Equipo / Arma</option>
                <option value="class">Clase / Subclase (Feature = Característica)</option>
                <option value="actor">Criatura / Especie (Trait = Rasgo)</option>
                <option value="journal">Diario / Lore</option>
              </select>
            </div>
            <span className="text-slate-500 font-mono text-[11px]">
              Preservación Foundry: <strong className="text-emerald-400">ACTIVA</strong>
            </span>
          </div>
        </div>

        {/* Right: Spanish Translation */}
        <div className="flex flex-col bg-slate-900 rounded-xl border border-slate-800 shadow-xl overflow-hidden focus-within:border-slate-700 transition">
          <div className="px-4 py-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <h2 className="text-sm font-semibold text-slate-200 tracking-wide">
                TRADUCCIÓN OFICIAL (ESPAÑOL)
              </h2>
            </div>
            <div className="flex items-center space-x-2">
              {translationResult && (
                <span
                  className={`text-[11px] font-mono px-2 py-0.5 rounded border ${
                    translationResult.isValid
                      ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800/50'
                      : 'bg-red-950/50 text-red-400 border-red-800/50'
                  }`}
                >
                  {translationResult.isValid ? '✓ Integridad Verificada' : '⚠ Error de Integridad'}
                </span>
              )}
            </div>
          </div>

          <div className="p-4 flex-1 flex flex-col relative">
            {isTranslating ? (
              <div className="flex-1 flex flex-col items-center justify-center space-y-3 py-16 text-slate-400">
                <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-mono">
                  Traduciendo con terminología D&D 2024 y protegiendo macros...
                </p>
              </div>
            ) : (
              <textarea
                value={outputText}
                onChange={(e) => setOutputText(e.target.value)}
                placeholder="La traducción técnica aparecerá aquí, respetando exactamente el PDF de referencia y la jerarquía de D&D..."
                className="w-full flex-1 min-h-[260px] bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none resize-none font-mono text-sm leading-relaxed"
              />
            )}
          </div>

          {/* Validation summary bar */}
          <div className="px-4 py-2.5 bg-slate-950/50 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-400">
            <div className="flex items-center space-x-3">
              <span>
                Términos aplicados: <strong className="text-slate-200">{detectedTerms.length}</strong>
              </span>
              {translationResult && (
                <span>
                  Placeholders protegidos:{' '}
                  <strong className="text-emerald-400">{translationResult.tokensCount}</strong>
                </span>
              )}
            </div>
            {outputText && (
              <span className="text-slate-400">{outputText.length} caracteres</span>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 py-1">
        <div className="flex items-center space-x-3">
          <button
            onClick={handleTranslate}
            disabled={isTranslating || !inputText.trim()}
            className={`flex items-center space-x-2 px-6 py-2.5 rounded-lg font-medium text-sm transition-all shadow-lg ${
              isTranslating || !inputText.trim()
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                : 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white shadow-red-950/50 border border-red-500/50 hover:scale-[1.01]'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>{isTranslating ? 'Traduciendo...' : 'Traducir Texto'}</span>
          </button>

          <button
            onClick={handleCopy}
            disabled={!outputText}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-medium border transition ${
              copied
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                : outputText
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                : 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'
            }`}
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? '¡Copiado!' : 'Copiar traducción'}</span>
          </button>

          <button
            onClick={handleClear}
            disabled={!inputText && !outputText}
            className="flex items-center space-x-2 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 border border-transparent hover:border-slate-700 transition"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Limpiar</span>
          </button>
        </div>

        <div className="flex items-center space-x-2 text-xs text-slate-400 font-mono">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Macros `@UUID[...]` y `[[/roll]]` protegidas por tokens</span>
        </div>
      </div>

      {/* Error alert if integrity failed */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-950/60 border border-red-800/80 text-red-200 text-xs flex items-start space-x-3 shadow-lg">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-semibold text-sm text-red-300">
              Alerta de Integridad o Traducción
            </h4>
            <p className="font-mono text-red-200/90 leading-relaxed">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Live Terminology Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Detected terms in text */}
        <div className="lg:col-span-2 bg-slate-900/90 rounded-xl border border-slate-800 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <BookOpen className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Memoria Terminológica Detectada en este Texto ({detectedTerms.length})
              </h3>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              Prioridad: PDF &gt; SRD 5.2.1
            </span>
          </div>

          {detectedTerms.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-2">
              {inputText.trim()
                ? 'No se identificaron términos mecánicos D&D predefinidos en el texto actual.'
                : 'Escribe o pega texto en inglés para ver los términos oficiales identificados automáticamente.'}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {detectedTerms.map((term) => (
                <div
                  key={term.id}
                  className="p-2 rounded bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs"
                >
                  <div className="overflow-hidden pr-2">
                    <div className="flex items-center space-x-1.5">
                      <span className="font-mono font-medium text-slate-200 truncate">
                        {term.source}
                      </span>
                      <ArrowRight className="w-3 h-3 text-slate-500 shrink-0" />
                      <span className="font-mono font-bold text-amber-300 truncate">
                        {term.target}
                      </span>
                    </div>
                    {term.context && (
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">{term.context}</p>
                    )}
                  </div>
                  <div className="shrink-0 flex items-center space-x-1">
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                        term.sourceDocument?.includes('PDF')
                          ? 'bg-amber-950 text-amber-300 border border-amber-800/60'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {term.sourceDocument?.includes('PDF') ? 'PDF' : 'SRD 2024'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Human in the loop / Uncertain Terms & Disambiguation */}
        <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-4 space-y-3 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <HelpCircle className="w-4 h-4 text-yellow-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Revisión Humana & Desambiguación
              </h3>
            </div>

            {uncertainTerms.length > 0 ? (
              <div className="space-y-2">
                <div className="p-2.5 rounded-lg bg-yellow-950/40 border border-yellow-800/50 text-xs space-y-1.5">
                  <div className="flex items-center space-x-1 text-yellow-400 font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Término no registrado en glosario:</span>
                  </div>
                  {uncertainTerms.map((phrase, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-slate-950 p-2 rounded border border-yellow-800/30"
                    >
                      <span className="font-mono text-yellow-200 text-xs font-semibold">
                        "{phrase}"
                      </span>
                      <button
                        onClick={() => setNewTermModal({ source: phrase, target: '' })}
                        className="px-2 py-0.5 text-[11px] bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded flex items-center space-x-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Añadir a Glosario</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-3 rounded bg-slate-950/60 border border-slate-800/80 text-xs text-slate-400 space-y-2">
                <div className="flex items-center space-x-1.5 text-slate-300 font-medium">
                  <Info className="w-3.5 h-3.5 text-blue-400" />
                  <span>Reglas de Desambiguación D&D 2024:</span>
                </div>
                <ul className="space-y-1 text-[11px] text-slate-400 list-disc list-inside">
                  <li>
                    <strong className="text-slate-300 font-mono">Feature:</strong> Característica (clase)
                  </li>
                  <li>
                    <strong className="text-slate-300 font-mono">Feat:</strong> Dote (personaje)
                  </li>
                  <li>
                    <strong className="text-slate-300 font-mono">Trait:</strong> Rasgo (especie/monstruo)
                  </li>
                  <li>
                    <strong className="text-slate-300 font-mono">Proficiency:</strong> Competencia
                  </li>
                  <li>
                    <strong className="text-slate-300 font-mono">Skill:</strong> Habilidad
                  </li>
                </ul>
              </div>
            )}
          </div>

          <div className="text-[11px] text-slate-500 font-mono pt-2 border-t border-slate-800 flex items-center justify-between">
            <span>Autoridad: Humano</span>
            <span className="text-amber-400">Sin traducción inventada</span>
          </div>
        </div>
      </div>

      {/* Modal for adding term to glossary */}
      {newTermModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
              <BookOpen className="w-4 h-4 text-amber-400" />
              <span>Añadir Término Oficial al Glosario</span>
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  Término en Inglés (Source)
                </label>
                <input
                  type="text"
                  value={newTermModal.source}
                  onChange={(e) =>
                    setNewTermModal((prev) => (prev ? { ...prev, source: e.target.value } : null))
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-sm text-slate-200 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  Traducción Oficial en Español (Target)
                </label>
                <input
                  type="text"
                  value={newTermModal.target}
                  onChange={(e) =>
                    setNewTermModal((prev) => (prev ? { ...prev, target: e.target.value } : null))
                  }
                  placeholder="ej. vínculo protector"
                  autoFocus
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-sm text-slate-200 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setNewTermModal(null)}
                className="px-3 py-1.5 rounded text-xs text-slate-400 hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                disabled={!newTermModal.target.trim()}
                onClick={() => {
                  onAddTermToGlossary({
                    source: newTermModal.source,
                    target: newTermModal.target,
                    category: 'mechanical_term',
                  });
                  setNewTermModal(null);
                  onRefreshTerms();
                  // Re-run matches
                  const { matches, uncertain } = terminologyEngine.findMatchesInText(
                    inputText,
                    docContext
                  );
                  setDetectedTerms(matches);
                  setUncertainTerms(uncertain);
                }}
                className="px-4 py-1.5 rounded text-xs bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold disabled:opacity-50"
              >
                Guardar en Glosario
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
