import React, { useState, useEffect } from 'react';

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

import type { ProviderSettings } from '../../desktop/contracts';

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

  const [provider, setProvider] = useState<ProviderSettings>({ provider: 'ollama', libreEndpoint: 'http://127.0.0.1:5000', fallback: false, endpoint: 'http://127.0.0.1:11500', model: 'translategemma:27b' });

  const [providerMessage, setProviderMessage] = useState('');

  useEffect(() => { window.desktop.getSettings().then(setProvider).catch(() => setProviderMessage('No se pudo leer la configuración.')); }, []);



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

      <section className="bg-slate-900 rounded-xl border border-slate-800 p-5 space-y-3">

        <h3 className="font-bold">Motor de traducción local</h3>

        <p className="text-sm text-slate-400">El texto protegido se procesa en tu equipo. Esta versión no envía contenido a proveedores externos y no necesita API keys.</p>

        <label className="block">Dirección local<input className="block w-full bg-slate-950 p-2 rounded" value={provider.endpoint} onChange={e => setProvider({ ...provider, endpoint: e.target.value })} /></label>

        <label className="block">Proveedor<select className="block w-full bg-slate-950 p-2 rounded" value={provider.provider || 'ollama'} onChange={e => setProvider({ ...provider, provider: e.target.value as 'ollama' | 'libretranslate' })}><option value="ollama">TranslateGemma / Ollama (preferente)</option><option value="libretranslate">LibreTranslate (ligero)</option></select></label>

        <label className="block">Modelo Ollama<select className="block w-full bg-slate-950 p-2 rounded" value={provider.model} onChange={e => setProvider({ ...provider, model: e.target.value })}><option value="translategemma:12b">TranslateGemma 12B</option><option value="translategemma:27b">TranslateGemma 27B</option></select></label>

        <label className="block">Dirección local de LibreTranslate<input className="block w-full bg-slate-950 p-2 rounded" value={provider.libreEndpoint || 'http://127.0.0.1:5000'} onChange={e => setProvider({ ...provider, libreEndpoint: e.target.value })} /></label>

        <label className="flex gap-2"><input type="checkbox" checked={provider.fallback || false} onChange={e => setProvider({ ...provider, fallback: e.target.checked })} />Usar LibreTranslate si Ollama falla (requiere servicio local activo)</label>
        <label className="flex gap-2"><input type="checkbox" checked={provider.thermalEnabled!==false} onChange={e=>setProvider({...provider,thermalEnabled:e.target.checked})}/>Observar NVIDIA y pausar inferencia ante temperatura elevada (sensores disponibles)</label>
        <p className="text-xs text-slate-400">No modifica ventiladores, potencia ni clocks. Si el driver no informa temperatura de memoria, no puede detectar su sobrecalentamiento.</p>

        <button className="bg-amber-800 rounded px-4 py-2" onClick={async () => {

          try { setProvider(await window.desktop.saveSettings(provider)); const state = await window.desktop.health(); setProviderMessage(state.connected && state.modelInstalled ? 'Configuración guardada. Motor conectado.' : 'Configuración guardada. Comprueba el servicio seleccionado y el modelo instalado.'); }

          catch { setProviderMessage('Configuración inválida: usa una dirección HTTP local y un nombre de modelo válido.'); }

        }}>Guardar y comprobar conexión</button>

        <p role="status" className="text-sm">{providerMessage}</p>

      </section>

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

                <option value="Russian">Ruso</option>

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

                {provider.provider === 'libretranslate' ? 'LibreTranslate local' : 'Ollama local · ' + provider.model}

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

            • <strong>Procesamiento Local:</strong> El análisis, la clasificación y la reconstrucción se ejecutan dentro de la aplicación de escritorio. Solo el texto protegido se envía al proveedor local seleccionado.

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
