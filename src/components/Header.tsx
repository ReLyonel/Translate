import React from 'react';
import { BookOpen, FileCode, Languages, Settings, ShieldCheck, ArrowUpRight, ClipboardCheck } from 'lucide-react';
interface HeaderProps {
  activeTab: 'quick' | 'json' | 'glossary' | 'settings' | 'review';
  setActiveTab: (tab: 'quick' | 'json' | 'glossary' | 'settings' | 'review') => void;
  pdfTermsCount: number; totalTermsCount: number; aiConnected: boolean;
  onOpenPdfModal?: () => void;
}
const tabs = [
  { id: 'json', label: 'Archivos JSON', icon: FileCode },
  { id: 'quick', label: 'Texto rápido', icon: Languages },
  { id: 'glossary', label: 'Glosario y PDF', icon: BookOpen },
  { id: 'review', label: 'Memoria y revisión', icon: ClipboardCheck },
  { id: 'settings', label: 'Ajustes', icon: Settings },
] as const;
export function Header({ activeTab, setActiveTab, totalTermsCount, pdfTermsCount, aiConnected }: HeaderProps) {
  return <aside className="app-sidebar">
    <div className="app-brand"><span className="brand-icon"><Languages size={20} /></span><div><strong>Foundry Translate</strong><small>Tu contenido, en español</small></div></div>
    <span className="sidebar-label">ESPACIO DE TRABAJO</span>
    <nav aria-label="Navegación principal">{tabs.map(tab => <button key={tab.id} aria-current={activeTab === tab.id ? 'page' : undefined} onClick={() => setActiveTab(tab.id)} className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}><tab.icon size={17} /><span>{tab.label}</span>{activeTab === tab.id && <ArrowUpRight size={14} />}</button>)}</nav>
    <div className="sidebar-bottom">
      <div className="local-status"><span className={`status-dot ${aiConnected ? 'connected' : ''}`} /><span>{aiConnected ? 'Motor local conectado' : 'Motor sin conexión'}</span></div>
      <button className="sidebar-stat" onClick={() => setActiveTab('glossary')}><BookOpen size={14} />{totalTermsCount} términos en glosario{pdfTermsCount > 0 && <small> · {pdfTermsCount} de PDF</small>}</button>
      <p className="sidebar-note"><ShieldCheck size={14} />Tus archivos originales se conservan.</p>
    </div>
  </aside>;
}
