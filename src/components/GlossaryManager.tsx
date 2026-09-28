import React, { useState, useRef, useEffect } from 'react';
import {
  BookOpen,
  FileText,
  Upload,
  Search,
  Plus,
  Trash2,
  Edit2,
  Download,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Layers,
  Sparkles,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { terminologyEngine } from '../services/terminology/terminologyEngine';
import { PdfEngine, PdfExtractionProgress } from '../services/pdf/pdfEngine';
import { TerminologyEntry, DisambiguationRule } from '../types';
import { DISAMBIGUATION_RULES } from '../services/terminology/defaultTerms';

interface GlossaryManagerProps {
  onRefreshTerms: () => void;
}

export const GlossaryManager: React.FC<GlossaryManagerProps> = ({ onRefreshTerms }) => {
  const [terms, setTerms] = useState<TerminologyEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [sourceFilter, setSourceFilter] = useState('ALL');

  // PDF processing state
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<PdfExtractionProgress | null>(null);
  const [extractedPdfTerms, setExtractedPdfTerms] = useState<TerminologyEntry[]>([]);
  const [pdfFileName, setPdfFileName] = useState<string>('');

  // Add/Edit modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTerm, setEditingTerm] = useState<TerminologyEntry | null>(null);
  const [formData, setFormData] = useState({
    source: '',
    target: '',
    category: 'mechanical_term',
    context: '',
    notes: '',
  });

  const pdfInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const refreshList = () => {
    setTerms(terminologyEngine.getAllTerms());
    onRefreshTerms();
  };

  useEffect(() => {
    refreshList();
  }, []);

  // PDF Upload & Extraction
  const handlePdfFile = async (file: File) => {
    if (!file || file.type !== 'application/pdf') {
      alert('Por favor selecciona un archivo PDF válido.');
      return;
    }

    setPdfFileName(file.name);
    setIsProcessingPdf(true);
    setPdfProgress({
      currentPage: 1,
      totalPages: 1,
      status: 'Iniciando lectura de PDF...',
      foundTermsCount: 0,
    });

    try {
      // 1. Extract text page by page
      const { fullText, pageTexts } = await PdfEngine.extractTextFromPdf(file, (p) => {
        setPdfProgress(p);
      });

      // 2. Parse glossary pairs and bilingual matches
      setPdfProgress((prev) => (prev ? { ...prev, status: 'Extrayendo pares terminológicos...' } : null));
      const regexTerms = PdfEngine.extractRegexGlossaryPairs(pageTexts, file.name);

      // If we found few terms and server AI extraction is available, sample first few pages
      let finalTerms = regexTerms;
      if (finalTerms.length < 15 && fullText.length > 200) {
        setPdfProgress((prev) => (prev ? { ...prev, status: 'Analizando contexto técnico con IA...' } : null));
        try {
          const aiTerms = await PdfEngine.extractAiTerminology(fullText.slice(0, 12000), file.name);
          finalTerms = [...finalTerms, ...aiTerms];
        } catch (e) {
          console.warn('AI terminology extraction fallback to regex:', e);
        }
      }

      setExtractedPdfTerms(finalTerms);
      setPdfProgress((prev) => (prev ? { ...prev, status: `Completado: ${finalTerms.length} términos detectados.` } : null));
    } catch (err: any) {
      console.error('PDF parsing error:', err);
      alert(`Error al procesar el archivo PDF: ${err.message}`);
    } finally {
      setIsProcessingPdf(false);
    }
  };

  // Commit extracted PDF terms to active memory
  const handleCommitPdfTerms = () => {
    if (extractedPdfTerms.length === 0) return;
    terminologyEngine.addPdfTerms(extractedPdfTerms);
    refreshList();
    alert(`Se incorporaron exitosamente ${extractedPdfTerms.length} términos del PDF a la memoria activa.`);
    setExtractedPdfTerms([]);
  };

  // Clear PDF memory
  const handleClearPdf = () => {
    if (window.confirm('¿Seguro que deseas limpiar la memoria terminológica del PDF?')) {
      terminologyEngine.clearPdfMemory();
      refreshList();
    }
  };

  // Save new or edited term
  const handleSaveTerm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.source.trim() || !formData.target.trim()) return;

    if (editingTerm) {
      terminologyEngine.updateTerm(editingTerm.id, {
        source: formData.source.trim(),
        target: formData.target.trim(),
        category: formData.category,
        context: formData.context,
        notes: formData.notes,
        userApproved: true,
      });
    } else {
      terminologyEngine.addUserTerm({
        source: formData.source.trim(),
        target: formData.target.trim(),
        category: formData.category,
        context: formData.context,
        notes: formData.notes,
        confidence: 'high',
        status: 'confirmed',
        sourceDocument: 'Glosario de Usuario',
      });
    }

    setIsAddModalOpen(false);
    setEditingTerm(null);
    setFormData({ source: '', target: '', category: 'mechanical_term', context: '', notes: '' });
    refreshList();
  };

  // Delete term
  const handleDeleteTerm = (id: string, source: string) => {
    if (window.confirm(`¿Eliminar término "${source}"?`)) {
      terminologyEngine.deleteTerm(id);
      refreshList();
    }
  };

  // Export JSON
  const handleExportJson = () => {
    const jsonStr = terminologyEngine.exportJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dnd-translator-glossary-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import JSON
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const res = terminologyEngine.importJson(text);
        refreshList();
        alert(`Glosario importado: ${res.importedUser} términos de usuario, ${res.importedPdf} del PDF.`);
      } catch (err: any) {
        alert(err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Filtered terms
  const filteredTerms = terms.filter((term) => {
    if (categoryFilter !== 'ALL' && term.category !== categoryFilter) return false;
    if (sourceFilter === 'USER' && !term.userApproved) return false;
    if (sourceFilter === 'PDF' && !term.sourceDocument?.includes('PDF')) return false;
    if (sourceFilter === 'SRD' && term.sourceDocument?.includes('PDF')) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        term.source.toLowerCase().includes(q) ||
        term.target.toLowerCase().includes(q) ||
        (term.context && term.context.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* PDF Upload Section (Mandatory Source of Truth) */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-amber-950/80 border border-amber-800/60 flex items-center justify-center text-amber-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                <span>PDF Oficial de Referencia (Autoridad Terminológica)</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800/60 uppercase font-mono">
                  Prioridad #1
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Carga el PDF oficial en español (SRD 5.2.1 / Manual del Jugador 2024) para crear la memoria terminológica de referencia.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              ref={pdfInputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handlePdfFile(file);
                e.target.value = '';
              }}
              className="hidden"
            />
            <button
              onClick={() => pdfInputRef.current?.click()}
              disabled={isProcessingPdf}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs uppercase tracking-wider transition shadow-lg shadow-amber-950/40 disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              <span>{isProcessingPdf ? 'Procesando...' : 'Cargar PDF de Referencia'}</span>
            </button>

            {terminologyEngine.getPdfTermsCount() > 0 && (
              <button
                onClick={handleClearPdf}
                className="px-3 py-2 rounded-lg text-xs text-red-400 hover:text-red-300 hover:bg-red-950/40 border border-red-800/50 transition"
              >
                Limpiar PDF ({terminologyEngine.getPdfTermsCount()})
              </button>
            )}
          </div>
        </div>

        {/* PDF Progress bar */}
        {pdfProgress && (
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs font-mono space-y-2">
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center space-x-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                <span>{pdfProgress.status}</span>
              </span>
              <span>
                Página {pdfProgress.currentPage} de {pdfProgress.totalPages}
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all duration-200"
                style={{
                  width: `${Math.round((pdfProgress.currentPage / Math.max(1, pdfProgress.totalPages)) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Extracted PDF terms preview banner */}
        {extractedPdfTerms.length > 0 && (
          <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-amber-300 text-sm font-semibold">
                <CheckCircle2 className="w-4 h-4 text-amber-400" />
                <span>
                  {extractedPdfTerms.length} términos extraídos del PDF "{pdfFileName}"
                </span>
              </div>
              <button
                onClick={handleCommitPdfTerms}
                className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition"
              >
                Incorporar a Memoria Terminológica Activa
              </button>
            </div>

            <div className="max-h-40 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pr-1">
              {extractedPdfTerms.slice(0, 30).map((t, idx) => (
                <div key={idx} className="p-2 bg-slate-950 rounded border border-slate-800 text-xs font-mono">
                  <div className="text-slate-200 font-medium">{t.source}</div>
                  <div className="text-amber-400 font-bold">{t.target}</div>
                  {t.sourcePage && <span className="text-[10px] text-slate-500">Pág. {t.sourcePage}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Disambiguation Rules Summary */}
      <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-4 space-y-3">
        <div className="flex items-center space-x-2 text-slate-200 text-xs font-bold uppercase tracking-wider">
          <HelpCircle className="w-4 h-4 text-blue-400" />
          <span>Reglas Mecánicas de Desambiguación D&D 2024 / SRD 5.2.1</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {DISAMBIGUATION_RULES.slice(0, 3).map((rule) => (
            <div key={rule.id} className="p-3 bg-slate-950 rounded-lg border border-slate-800/80 text-xs space-y-1.5">
              <span className="font-mono font-bold text-amber-300 uppercase block">
                "{rule.term}"
              </span>
              <ul className="space-y-1 text-[11px] text-slate-400">
                {rule.options.map((opt, idx) => (
                  <li key={idx} className="flex items-center space-x-1.5">
                    <span className="text-slate-500">•</span>
                    <strong className="text-slate-200 font-mono">{opt.target}</strong>:
                    <span className="truncate">{opt.context}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Glossary Explorer & CRUD Table */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 shadow-xl space-y-4">
        {/* Table Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-slate-100">
              Glosario D&D ({filteredTerms.length} de {terms.length})
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setEditingTerm(null);
                setFormData({ source: '', target: '', category: 'mechanical_term', context: '', notes: '' });
                setIsAddModalOpen(true);
              }}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>Añadir Término</span>
            </button>

            <button
              onClick={handleExportJson}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs transition"
            >
              <Download className="w-4 h-4" />
              <span>Exportar Glosario</span>
            </button>

            <input
              ref={importInputRef}
              type="file"
              accept=".json"
              onChange={handleImportJson}
              className="hidden"
            />
            <button
              onClick={() => importInputRef.current?.click()}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs transition"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Importar JSON</span>
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
          <div className="flex items-center space-x-2">
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-300 focus:outline-none"
            >
              <option value="ALL">Todos los orígenes</option>
              <option value="USER">Personalizados / Usuario</option>
              <option value="PDF">Del PDF de Referencia</option>
              <option value="SRD">SRD 5.2.1 Base</option>
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-300 focus:outline-none"
            >
              <option value="ALL">Todas las categorías</option>
              <option value="mechanical_term">Mecánica / Reglas</option>
              <option value="spell">Conjuros</option>
              <option value="condition">Condiciones / Estados</option>
              <option value="skill">Habilidades</option>
              <option value="ability">Características</option>
              <option value="damage_type">Tipos de Daño</option>
              <option value="item">Objetos / Armas</option>
            </select>
          </div>

          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar término en inglés o español..."
              className="w-full pl-8 pr-3 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 font-mono focus:outline-none focus:border-slate-700"
            />
          </div>
        </div>

        {/* Terms Table */}
        <div className="border border-slate-800 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 sticky top-0 z-10">
              <tr>
                <th className="py-2.5 px-3">Término Original (Inglés)</th>
                <th className="py-2.5 px-3">Traducción Oficial (Español)</th>
                <th className="py-2.5 px-3">Categoría</th>
                <th className="py-2.5 px-3">Origen / Documento</th>
                <th className="py-2.5 px-3 text-center">Prioridad</th>
                <th className="py-2.5 px-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-900/50">
              {filteredTerms.map((term) => (
                <tr key={term.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-2.5 px-3 font-semibold text-slate-200">
                    {term.source}
                  </td>
                  <td className="py-2.5 px-3 font-bold text-amber-300">
                    {term.target}
                  </td>
                  <td className="py-2.5 px-3 text-slate-400">
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px]">
                      {term.category || 'general'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-400 truncate max-w-[150px]">
                    {term.sourceDocument || 'SRD 5.2.1'}
                    {term.sourcePage ? ` (Pág. ${term.sourcePage})` : ''}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {term.userApproved ? (
                      <span className="px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800/60 text-[9px] font-bold">
                        ★ USUARIO
                      </span>
                    ) : term.sourceDocument?.includes('PDF') ? (
                      <span className="px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800/60 text-[9px] font-bold">
                        PDF
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[9px]">
                        SRD 2024
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="flex items-center justify-end space-x-1">
                      <button
                        onClick={() => {
                          setEditingTerm(term);
                          setFormData({
                            source: term.source,
                            target: term.target,
                            category: term.category || 'mechanical_term',
                            context: term.context || '',
                            notes: term.notes || '',
                          });
                          setIsAddModalOpen(true);
                        }}
                        className="p-1 text-slate-400 hover:text-amber-300 transition"
                        title="Editar término"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteTerm(term.id, term.source)}
                        className="p-1 text-slate-400 hover:text-red-400 transition"
                        title="Eliminar término"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Term Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
              <BookOpen className="w-5 h-5 text-amber-400" />
              <span>{editingTerm ? 'Editar Término del Glosario' : 'Añadir Nuevo Término Oficial'}</span>
            </h3>

            <form onSubmit={handleSaveTerm} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  Término en Inglés (Source) *
                </label>
                <input
                  type="text"
                  required
                  value={formData.source}
                  onChange={(e) => setFormData((prev) => ({ ...prev, source: e.target.value }))}
                  placeholder="ej. attack roll, warding bond"
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  Traducción en Español (Target) *
                </label>
                <input
                  type="text"
                  required
                  value={formData.target}
                  onChange={(e) => setFormData((prev) => ({ ...prev, target: e.target.value }))}
                  placeholder="ej. tirada de ataque, vínculo protector"
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-amber-300 font-mono focus:outline-none focus:border-amber-500 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">Categoría</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs text-slate-200 focus:outline-none"
                  >
                    <option value="mechanical_term">Mecánica / Reglas</option>
                    <option value="spell">Conjuro</option>
                    <option value="condition">Condición / Estado</option>
                    <option value="skill">Habilidad</option>
                    <option value="ability">Característica</option>
                    <option value="damage_type">Tipo de Daño</option>
                    <option value="item">Objeto / Arma</option>
                    <option value="class_feature">Característica de Clase</option>
                    <option value="species_trait">Rasgo de Especie</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">Contexto</label>
                  <input
                    type="text"
                    value={formData.context}
                    onChange={(e) => setFormData((prev) => ({ ...prev, context: e.target.value }))}
                    placeholder="ej. Tiradas de d20"
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs text-slate-200 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded text-xs text-slate-400 hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded text-xs bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold"
                >
                  {editingTerm ? 'Guardar Cambios' : 'Añadir al Glosario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
