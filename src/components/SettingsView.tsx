import React, { useState } from 'react';
import {
  Settings,
  ShieldCheck,
  Cpu,
  Lock,
  RotateCcw,
  Sparkles,
  Info,
  Check,
  AlertTriangle,
  FileCheck,
} from 'lucide-react';
import { terminologyEngine } from '../services/terminology/terminologyEngine';
import { AppSettings } from '../types';

interface SettingsViewProps {
  onRefreshTerms: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onRefreshTerms }) => {
  const [settings, setSettings] = useState<AppSettings>({
    sourceLanguage: 'English',
    targetLanguage: 'Spanish',
    model: 'translategemma:27b',
    mode: 'dnd2024',
    terminologyMode: 'pdf_plus_glossary',
    foundryPreservation: true,
    autoValidate: true,
    batchSize: 8,
  });

  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleResetToDefault = () => {
    if (
      window.confirm(
        '¿Restablecer el glosario a los términos mecánicos oficiales del SRD 5.2.1 / D&D 2024? Se eliminarán los términos añadidos manualmente.'
      )
    ) {
      terminologyEngine.resetToDefault();
      onRefreshTerms();
      alert('Glosario restablecido a la versión oficial de D&D 2024 / SRD 5.2.1.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Title */}
      <div className="flex items-center space-x-3 pb-3 border-b border-slate-800">
        <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-slate-200">
          <Settings className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-100">Configuración & Seguridad del Sistema</h2>
          <p className="text-xs text-slate-400">
            Parámetros del motor de traducción, jerarquía terminológica y reglas de Foundry VTT
          </p>
        </div>
      </div>

      {/* Main Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Languages and Localization */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
            <Cpu className="w-4 h-4 text-blue-400" />
            <span>Idiomas & Reglas</span>
          </h3>

          <div className="space-y-3 text-xs font-mono">
            <div>
              <label className="block text-slate-400 mb-1">Idioma Origen</label>
              <select
                value={settings.sourceLanguage}
                onChange={(e) => setSettings({ ...settings, sourceLanguage: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-200 focus:outline-none"
              >
                <option value="English">Inglés (English - Estándar oficial D&D)</option>
                <option value="Russian">Ruso (Russian - Arquitectura preparada)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Idioma Destino</label>
              <select
                value={settings.targetLanguage}
                onChange={(e) => setSettings({ ...settings, targetLanguage: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-200 focus:outline-none"
              >
                <option value="Spanish">Español (Castellano Neutro D&D 2024)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Modo Normativo</label>
              <select
                value={settings.mode}
                onChange={(e) => setSettings({ ...settings, mode: e.target.value as any })}
                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-200 focus:outline-none"
              >
                <option value="dnd2024">Dungeons & Dragons 2024 (SRD 5.2.1 Oficial)</option>
                <option value="srd521">SRD 5.2.1 CC-BY-4.0 Estricto</option>
              </select>
            </div>
          </div>
        </div>

        {/* Foundry & Engine Controls */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Preservación de Foundry VTT</span>
          </h3>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 rounded bg-slate-950 border border-slate-800">
              <div>
                <span className="font-semibold text-slate-200 block">Preservación Foundry VTT</span>
                <span className="text-[11px] text-slate-400">
                  Protege macros `@UUID`, `@Roll`, formulas de dados y atributos
                </span>
              </div>
              <span className="px-2.5 py-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono font-bold">
                ACTIVADA
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded bg-slate-950 border border-slate-800">
              <div>
                <span className="font-semibold text-slate-200 block">Jerarquía Terminológica</span>
                <span className="text-[11px] text-slate-400">PDF del usuario tiene prioridad absoluta</span>
              </div>
              <span className="px-2.5 py-1 rounded bg-amber-950 text-amber-300 border border-amber-800 font-mono font-bold">
                PDF + GLOSARIO
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded bg-slate-950 border border-slate-800">
              <div>
                <span className="font-semibold text-slate-200 block">Modelo de IA en Backend</span>
                <span className="text-[11px] text-slate-400">Llamadas aisladas sin exponer API keys</span>
              </div>
              <span className="px-2 py-1 rounded bg-slate-800 text-slate-300 font-mono font-bold">
                Ollama local · translategemma:27b
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Security & Privacy Statement */}
      <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-5 space-y-3">
        <div className="flex items-center space-x-2 text-slate-200 font-bold text-sm">
          <Lock className="w-4 h-4 text-amber-400" />
          <span>Garantías de Privacidad & Seguridad (Regla Absoluta)</span>
        </div>
        <div className="text-xs text-slate-400 space-y-2 leading-relaxed">
          <p>
            • <strong>Procesamiento Local:</strong> Los archivos JSON cargados nunca se suben ni se almacenan en servidores externos. El análisis estructural, clasificación de campos y reconstrucción se ejecutan en la memoria de tu navegador.
          </p>
          <p>
            • <strong>Aislamiento de Metadatos:</strong> Únicamente se envían al modelo de IA los textos humanos seleccionados, previa sustitución de identificadores técnicos y UUIDs por tokens temporales <code className="text-amber-300">[[PROTECTED_###]]</code>.
          </p>
          <p>
            • <strong>Preservación Estructural:</strong> Si se detecta cualquier discrepancia entre las claves originales y las traducidas, el sistema bloquea la descarga para proteger tus compendios de Foundry VTT de corrupción de datos.
          </p>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-950/20 border border-red-900/50 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-bold text-red-300 flex items-center space-x-1.5">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span>Restablecer Memoria Terminológica</span>
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Restaura el glosario predeterminado oficial de D&D 2024 / SRD 5.2.1 eliminando personalizaciones.
          </p>
        </div>

        <button
          onClick={handleResetToDefault}
          className="px-4 py-2 rounded-lg bg-red-950 hover:bg-red-900 text-red-200 border border-red-800 text-xs font-mono font-bold transition flex items-center space-x-2"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Restablecer Glosario</span>
        </button>
      </div>
    </div>
  );
};
