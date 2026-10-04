import type { ProviderSettings, TranslateRequest, ProviderHealth } from './contracts';
import * as ollama from './ollama';

export interface TranslationProvider {
  health(settings: ProviderSettings): Promise<ProviderHealth>;
  translate(settings: ProviderSettings, request: TranslateRequest, memory: Map<string, string>, signal?: AbortSignal): Promise<string[]>;
}
const libretranslate: TranslationProvider = {
  async health(settings) {
    let connected = false;
    try { const response = await fetch((settings.libreEndpoint || 'http://127.0.0.1:5000') + '/languages', { signal: AbortSignal.timeout(5000) }); const languages = await response.json() as {code: string}[]; connected = response.ok && ['en', 'ru', 'es'].every(code => languages.some(language => language.code === code)); } catch { /* unavailable */ }
    return { provider: 'libretranslate', executionMode: 'LOCAL', connected, modelInstalled: connected, model: 'LibreTranslate' };
  },
  async translate(settings, request, _memory, signal) {
    // Translate prose only. Technical markers remain in the host.
    const result: string[] = [];
    for (const text of request.texts) {
      let output = '';
      for (const part of text.split(/(\[\[PROTECTED_\d+\]\])/g)) {
        signal?.throwIfAborted();
        if (!part.trim() || /^\[\[PROTECTED_\d+\]\]$/.test(part)) { output += part; continue; }
        request.telemetry?.('libretranslate_requests');
        const response = await fetch((settings.libreEndpoint || 'http://127.0.0.1:5000') + '/translate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(120000)]) : AbortSignal.timeout(120000),
          body: JSON.stringify({ q: part.trim(), source: request.sourceLanguage || 'auto', target: 'es', format: 'text' }),
        });
        if (!response.ok) throw new Error('No se pudo obtener una traducción con LibreTranslate.');
        const body = await response.json() as {translatedText?: unknown};
        if (typeof body.translatedText !== 'string' || !body.translatedText.trim() || /\[\[PROTECTED_/.test(body.translatedText)) throw new Error('No se pudo obtener una traducción válida.');
        output += (part.match(/^\s*/)?.[0] || '') + body.translatedText + (part.match(/\s*$/)?.[0] || '');
      }
      result.push(output);
    }
    return result;
  },
};
export const providers: Record<'ollama' | 'libretranslate', TranslationProvider> = { ollama, libretranslate };
export const health = (settings: ProviderSettings) => providers[settings.provider || 'ollama'].health(settings);
export async function translate(settings: ProviderSettings, request: TranslateRequest, memory = new Map<string, string>(), signal?: AbortSignal): Promise<string[]> {
  // Exact glossary matches are substituted locally, including with the lighter provider.
  const replacements: Map<string, string>[] = [];
  const texts = request.texts.map(text => {
    const terms = new Map<string, string>(); replacements.push(terms);
    let next = Math.max(0, ...Array.from(text.matchAll(/\[\[PROTECTED_(\d+)\]\]/g), match => Number(match[1]))) + 1;
    for (const term of [...(request.terminology || [])].sort((a, b) => b.source.length - a.source.length)) {
      if (!term.source.trim() || !term.target.trim()) continue;
      const escaped = term.source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const expression = new RegExp('(?<![\\p{L}\\p{N}_])' + escaped + '(?![\\p{L}\\p{N}_])', 'giu');
      text = text.split(/(\[\[PROTECTED_\d+\]\])/g).map(part => /^\[\[PROTECTED_\d+\]\]$/.test(part) ? part : part.replace(expression, () => {
        const token = `[[PROTECTED_${next++}]]`; terms.set(token, term.target); return token;
      })).join('');
    }
    return text;
  });
  const prepared = { ...request, texts };
  let result: string[];
  try { signal?.throwIfAborted();result = texts.every(text=>!text.replace(/\[\[PROTECTED_\d+\]\]/g,'').trim())?texts:await providers[settings.provider || 'ollama'].translate(settings, prepared, memory, signal); }
  catch (error) {
    signal?.throwIfAborted();
    if ((settings.provider || 'ollama') !== 'ollama' || !settings.fallback) throw error;
    request.telemetry?.('fallback_libretranslate');
    result = await libretranslate.translate(settings, prepared, memory, signal);
  }
  return result.map((text, index) => { for (const [token, value] of replacements[index]) text = text.replaceAll(token, value); return text; });
}
