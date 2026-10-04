import React, { useState, useEffect } from 'react';
import { TranslationReview } from './components/TranslationReview';
import { Header } from './components/Header';
import { QuickTranslator } from './components/QuickTranslator';
import { JsonTranslator } from './components/JsonTranslator';
import { GlossaryManager } from './components/GlossaryManager';
import { SettingsView } from './components/SettingsView';
import { terminologyEngine } from './services/terminology/terminologyEngine';

export default function App() {
  const [activeTab, setActiveTab] = useState<'quick' | 'json' | 'glossary' | 'settings' | 'review'>('json');
  const [pdfTermsCount, setPdfTermsCount] = useState(0);
  const [totalTermsCount, setTotalTermsCount] = useState(0);
  const [aiConnected, setAiConnected] = useState(false);
  const [directProgress,setDirectProgress]=useState<import('../desktop/contracts').DesktopProgress|null>(null);
  useEffect(()=>window.desktop.onProgress(setDirectProgress),[]);

  const refreshCounts = () => {
    setPdfTermsCount(terminologyEngine.getPdfTermsCount());
    setTotalTermsCount(terminologyEngine.getAllTerms().length);
  };

  useEffect(() => {
    refreshCounts();

    // Check backend health
    const checkHealth = () => window.desktop.health()
      .then((data) => {
        setAiConnected(Boolean(data.connected && data.modelInstalled));
      })
      .catch((err) => {
        console.warn('Backend health check error:', err);
        setAiConnected(false);
      });
    checkHealth();
    const timer = window.setInterval(checkHealth, 15000);
    return () => window.clearInterval(timer);
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
    <div className="desktop-shell">
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
      <div className="workspace">
      <header className="workspace-bar"><span>{({ json: 'Archivos JSON', quick: 'Texto rápido', glossary: 'Glosario y PDF', settings: 'Ajustes', review: 'Memoria y revisión' })[activeTab]}</span><span className="workspace-badge">Procesamiento local · Español</span></header>
      <main className="workspace-content">
        {directProgress?.state==='TRANSLATING'&&<div role="status" className="text-xs text-amber-300 p-3 flex items-center gap-3"><span>{directProgress.thermal?.state==='THERMAL_PAUSE'?'Pausa térmica: esperando enfriamiento':directProgress.thermal?.state==='THERMAL_WARNING'?'Advertencia térmica':'Traducción en curso'}</span><button className="secondary-action" onClick={()=>window.desktop.cancelTranslation()}>Cancelar traducción</button></div>}
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

        {activeTab === 'review' && <TranslationReview />}

        {activeTab === 'settings' && (
          <SettingsView onRefreshTerms={refreshCounts} />
        )}
      </main>

      {/* Compact Status Footer */}
      <footer className="workspace-footer"><span>Foundry VTT · Localización segura</span><span>JSON · Referencias protegidas</span></footer>
      </div>
    </div>
  );
}
