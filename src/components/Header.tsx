import React from 'react';
import { BookOpen, FileCode, Languages, Settings, FileText, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';

interface HeaderProps {
  activeTab: 'quick' | 'json' | 'glossary' | 'settings';
  setActiveTab: (tab: 'quick' | 'json' | 'glossary' | 'settings') => void;
  pdfTermsCount: number;
  totalTermsCount: number;
  aiConnected: boolean;
  onOpenPdfModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  pdfTermsCount,
  totalTermsCount,
  aiConnected,
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-950/95 sticky top-0 z-40 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Branding */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-600 via-amber-600 to-red-800 flex items-center justify-center shadow-lg shadow-red-950/40 border border-red-500/30">
              <span className="font-serif font-black text-xl text-amber-100 tracking-tighter">D&D</span>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-serif font-bold text-lg text-slate-100 tracking-wide">
                  D&D Translator
                </span>
                <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase rounded bg-red-950/80 text-red-400 border border-red-800/50">
                  D&D 2024 / SRD 5.2.1
                </span>
                <span className="hidden md:inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded bg-slate-900 text-slate-400 border border-slate-800">
                  Foundry VTT / Babele
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Editor Técnico de Localización y Preservación Estructural
              </p>
            </div>
          </div>

          {/* Status indicators */}
          <div className="hidden lg:flex items-center space-x-4 text-xs font-mono">
            {/* PDF status */}
            <div
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full border ${
                pdfTermsCount > 0
                  ? 'bg-amber-950/30 border-amber-800/60 text-amber-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>
                PDF:{' '}
                <strong className={pdfTermsCount > 0 ? 'text-amber-200' : 'text-slate-400'}>
                  {pdfTermsCount > 0 ? `${pdfTermsCount} términos activos` : 'Sin cargar'}
                </strong>
              </span>
            </div>

            {/* Total Glossary */}
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300">
              <BookOpen className="w-3.5 h-3.5 text-blue-400" />
              <span>
                Glosario: <strong className="text-white">{totalTermsCount}</strong>
              </span>
            </div>

            {/* AI Engine Status */}
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300">
              <span
                className={`w-2 h-2 rounded-full ${
                  aiConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                }`}
              />
              <span className="flex items-center space-x-1">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                <span>Gemini 3.8 Flash</span>
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex space-x-1 sm:space-x-2">
            <button
              onClick={() => setActiveTab('quick')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'quick'
                  ? 'bg-red-950/70 text-amber-200 border border-red-700/60 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Languages className="w-4 h-4" />
              <span>Texto Rápido</span>
            </button>

            <button
              onClick={() => setActiveTab('json')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'json'
                  ? 'bg-red-950/70 text-amber-200 border border-red-700/60 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <FileCode className="w-4 h-4" />
              <span>Traducir JSON</span>
            </button>

            <button
              onClick={() => setActiveTab('glossary')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'glossary'
                  ? 'bg-red-950/70 text-amber-200 border border-red-700/60 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Glosario & PDF</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'settings'
                  ? 'bg-red-950/70 text-amber-200 border border-red-700/60 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
              title="Configuración"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Configuración</span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
};
