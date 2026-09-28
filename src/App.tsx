import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { QuickTranslator } from './components/QuickTranslator';
import { JsonTranslator } from './components/JsonTranslator';
import { GlossaryManager } from './components/GlossaryManager';
import { SettingsView } from './components/SettingsView';
import { terminologyEngine } from './services/terminology/terminologyEngine';

export default function App() {
  const [activeTab, setActiveTab] = useState<'quick' | 'json' | 'glossary' | 'settings'>('quick');
  const [pdfTermsCount, setPdfTermsCount] = useState(0);
  const [totalTermsCount, setTotalTermsCount] = useState(0);
  const [aiConnected, setAiConnected] = useState(true);

  const refreshCounts = () => {
    setPdfTermsCount(terminologyEngine.getPdfTermsCount());
    setTotalTermsCount(terminologyEngine.getAllTerms().length);
  };

  useEffect(() => {
    refreshCounts();

    // Check backend health
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        setAiConnected(Boolean(data.geminiConfigured));
      })
      .catch((err) => {
        console.warn('Backend health check error:', err);
        setAiConnected(false);
      });
  }, []);

  const handleAddTermToGlossary = (term: { source: string; target: string; category?: string }) => {
    terminologyEngine.addUserTerm({
      source: term.source,
      target: term.target,
      category: term.category || 'mechanical_term',
      confidence: 'high',
      status: 'confirmed',
      sourceDocument: 'Glosario de Usuario',
    });
    refreshCounts();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-red-900/60 selection:text-amber-200">
      {/* Navigation Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pdfTermsCount={pdfTermsCount}
        totalTermsCount={totalTermsCount}
        aiConnected={aiConnected}
        onOpenPdfModal={() => setActiveTab('glossary')}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-12">
        {activeTab === 'quick' && (
          <QuickTranslator
            onAddTermToGlossary={handleAddTermToGlossary}
            onRefreshTerms={refreshCounts}
          />
        )}

        {activeTab === 'json' && (
          <JsonTranslator onRefreshStats={refreshCounts} />
        )}

        {activeTab === 'glossary' && (
          <GlossaryManager onRefreshTerms={refreshCounts} />
        )}

        {activeTab === 'settings' && (
          <SettingsView onRefreshTerms={refreshCounts} />
        )}
      </main>

      {/* Compact Status Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-3 text-center text-xs font-mono text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
          <span>D&D Translator • Localización Técnica D&D 2024 / SRD 5.2.1 • Foundry VTT v11/v12</span>
          <span className="text-[11px] text-slate-600">Preservación estricta de claves, IDs, UUIDs y macros</span>
        </div>
      </footer>
    </div>
  );
}
