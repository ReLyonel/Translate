import type { ProviderSettings, TranslateRequest } from './contracts';

import path from 'node:path';
import { ProtectedContentEngine as Protection } from '../src/services/protected-content/protectedContentEngine';

import { fileURLToPath } from 'node:url';



export function allowedRendererResource(url: string, rendererRoot: string): boolean {

  if (url.startsWith('blob:') || url.startsWith('data:')) return true;

  try {

    const relative = path.relative(rendererRoot, fileURLToPath(url));

    return relative !== '' && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);

  } catch { return false; }

}



export function validateSettings(value: unknown): ProviderSettings {

  const settings = value as ProviderSettings;

  if (!settings || typeof settings.endpoint !== 'string' || typeof settings.model !== 'string') throw new Error('Configuración inválida.');

  const url = new URL(settings.endpoint);

  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {

    throw new Error('Ollama debe usar una dirección HTTP local sin credenciales.');

  }

  if (!/^[\w.:/-]{1,120}$/.test(settings.model)) throw new Error('Nombre de modelo inválido.');

  const libre = new URL(settings.libreEndpoint || 'http://127.0.0.1:5000');

  if (libre.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(libre.hostname) || libre.username || libre.password || libre.search || libre.hash || libre.pathname !== '/') throw new Error('Configuraci\u00f3n inv\u00e1lida.');

  if (settings.provider !== undefined && !['ollama', 'libretranslate'].includes(settings.provider)) throw new Error('Configuraci\u00f3n inv\u00e1lida.');

  return { endpoint: url.origin, model: settings.model, provider: settings.provider || 'ollama', libreEndpoint: libre.origin, fallback: settings.fallback === true, thermalEnabled:settings.thermalEnabled!==false };

}



export function validateTranslation(value: unknown): TranslateRequest {

  const request = value as TranslateRequest;

  if (request?.sourceLanguage !== undefined && !['auto', 'en', 'ru'].includes(request.sourceLanguage)) throw new Error('Textos de traducción inválidos.');

  if (!request || !Array.isArray(request.texts) || request.texts.length < 1 || request.texts.length > 64 || request.texts.some(text => typeof text !== 'string' || text.length > 200_000)) throw new Error('Textos de traducción inválidos.');

  if (request.terminology && (!Array.isArray(request.terminology) || request.terminology.length > 1000 || request.terminology.some(term => !term || typeof term.source !== 'string' || typeof term.target !== 'string'))) throw new Error('Terminología inválida.');

  if (request.context && (typeof request.context !== 'object' || [request.context.docType, request.context.notes,request.context.system,request.context.module,request.context.fieldType].some(v => v !== undefined && (typeof v !== 'string' || v.length > 10_000)))) throw new Error('Contexto inválido.');

  if(request.units&&(!Array.isArray(request.units)||request.units.length!==request.texts.length||request.units.some((unit,index)=>!unit||typeof unit.sourceText!=='string'||unit.sourceText.length>200_000||Protection.protect(unit.sourceText).protectedText!==request.texts[index])))throw new Error('TRANSLATION_UNIT_INVALID');
  return { units:request.units?.map(unit=>({sourceText:unit.sourceText})),sourceLanguage: request.sourceLanguage || 'auto', texts: request.texts, terminology: (request.terminology || []).map(term => ({ source: term.source, target: term.target })), context: { docType: request.context?.docType, notes: request.context?.notes,system:request.context?.system,module:request.context?.module,fieldType:request.context?.fieldType } };

}



export function trustedSender(senderId: number, frameUrl: string, mainFrame: boolean, windowId: number, expectedUrl: string): boolean {

  return senderId === windowId && mainFrame && frameUrl === expectedUrl;

}

