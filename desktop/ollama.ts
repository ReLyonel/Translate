import { parseTranslationResponse } from '../src/services/translation/jsonResponseParser';

import { findRelevantMemoryTerms, mergeTerminology } from '../src/services/translation/memoryContext';

import type { ProviderSettings, ProviderHealth, TranslateRequest } from './contracts';
import {semanticChunks,translationPrompt,promptLimits} from './translation/prompt';

async function translateNative(settings:ProviderSettings,request:TranslateRequest,signal?:AbortSignal):Promise<string[]>{
 const language=request.sourceLanguage==='ru'||request.sourceLanguage!=='en'&&request.texts.some(text=>/[\u0400-\u04ff]/.test(text))?'ru':'en';const results:string[]=[];
 for(const source of request.texts){let translated='';for(const chunk of semanticChunks(source)){
  const prompt=translationPrompt(chunk,language,request.context?.notes,request.terminology);
  for(let attempt=0;attempt<2;attempt++){
   signal?.throwIfAborted();if(attempt)request.telemetry?.('ollama_retries');
   try{
    request.telemetry?.('ollama_requests');const response=await fetch(settings.endpoint+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},signal:signal?AbortSignal.any([signal,AbortSignal.timeout(300000)]):AbortSignal.timeout(300000),body:JSON.stringify({model:settings.model,stream:false,messages:[{role:'user',content:prompt}],options:{temperature:0,num_ctx:promptLimits.num_ctx,num_predict:promptLimits.max_output_tokens},keep_alive:'5m'})});
    if(!response.ok)throw new Error('PROVIDER_UNAVAILABLE');const body=await response.json() as any;
    const metrics:any={prompt_chars:prompt.length,source_chars:chunk.length};for(const [to,from] of [['prompt_tokens','prompt_eval_count'],['generated_tokens','eval_count'],['eval_duration','eval_duration'],['load_duration','load_duration']])if(typeof body[from]==='number'&&Number.isFinite(body[from])&&body[from]>=0)metrics[to]=body[from];request.inferenceMetrics?.(metrics);
    const value=body.message?.content;const markers=(text:string)=>text.match(/\[\[PROTECTED_[^\]]+\]\]/g)||[];
    let objectOutput=false;try{const parsed=JSON.parse(value);objectOutput=parsed!==null&&typeof parsed==='object';}catch{}
    if(typeof value!=='string'||!value.trim()||objectOutput||JSON.stringify(markers(value))!==JSON.stringify(markers(chunk))||/^\s*```|^\s*(?:translation|traducción)\s*:/i.test(value)||/\[\[PROTECTED_/g.test(value.replace(/\[\[PROTECTED_\d+\]\]/g,''))||body.done===false||body.done_reason==='length')throw new Error('PROVIDER_RESPONSE_INVALID');
    translated+=(chunk.match(/^\s*/)?.[0]||'')+value.trim()+(chunk.match(/\s*$/)?.[0]||'');break;
   }catch{signal?.throwIfAborted();request.telemetry?.('ollama_failures');if(attempt===1)throw new Error('No se pudo obtener una traducción válida. Comprueba Ollama y el modelo en Ajustes.');}
  }
 }results.push(translated);}return results;
}



export async function health(settings: ProviderSettings): Promise<ProviderHealth> {

  try {

    const response = await fetch(settings.endpoint + '/api/tags', { signal: AbortSignal.timeout(5000) });

    const body = await response.json() as { models?: { name: string }[] };

    return { provider: 'ollama', executionMode: 'LOCAL', connected: response.ok, model: settings.model, modelInstalled: Boolean(body.models?.some(m => m.name === settings.model || m.name.startsWith(settings.model + ':'))) };

  } catch { return { provider: 'ollama', executionMode: 'LOCAL', connected: false, modelInstalled: false, model: settings.model }; }

}



async function translatePlain(settings: ProviderSettings, request: TranslateRequest, memory = new Map<string, string>(), signal?: AbortSignal): Promise<string[]> {
  if(settings.model.startsWith('translategemma:'))return translateNative(settings,request,signal);

  const sourceLanguage = request.sourceLanguage === 'ru' || (request.sourceLanguage !== 'en' && request.texts.some(text => /[\u0400-\u04ff]/.test(text))) ? 'ruso' : 'inglés';

  const messages = [

    { role: 'system', content: `Traduce del ${sourceLanguage} al español para Foundry VTT. Recibes fragmentos de texto humano. Traduce únicamente esos textos sin añadir etiquetas, marcadores, comentarios ni contenido adicional. La terminología proporcionada es obligatoria. Devuelve solo un objeto JSON {"translations":["..."]}, con una traducción por texto en el mismo orden.` },

    { role: 'user', content: JSON.stringify({ context: request.context, terminology: mergeTerminology(request.terminology || [], findRelevantMemoryTerms(request.texts, memory, 48)), texts: request.texts }) },

  ];

  for (let attempt = 0; attempt < 2; attempt++) {
    if(attempt)request.telemetry?.('ollama_retries');

    try {

      request.telemetry?.('ollama_requests');
      const response = await fetch(settings.endpoint + '/api/chat', {

        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(300_000)]) : AbortSignal.timeout(300_000),

        body: JSON.stringify({ model: settings.model, stream: false, messages, format: { type: 'object', properties: { translations: { type: 'array', items: { type: 'string' }, minItems: request.texts.length, maxItems: request.texts.length } }, required: ['translations'], additionalProperties: false }, options: { temperature: 0, num_ctx: 16384 }, keep_alive: '30m' }),

      });

      if (!response.ok) throw new Error('Proveedor no disponible.');

      const body = await response.json() as { message?: { content?: string } };

      const translations = parseTranslationResponse(body.message?.content || '', request.texts.length);

      if (translations.some(text => /\[\[PROTECTED_[^\]]+\]\]/.test(text))) throw new Error('El proveedor introdujo marcadores inesperados.');

      return translations;

    } catch {
      request.telemetry?.('ollama_failures');

      signal?.throwIfAborted();

      if (attempt === 1) throw new Error('No se pudo obtener una traducción válida. Comprueba Ollama y el modelo en Ajustes.');

      messages.push({ role: 'user', content: 'Devuelve exclusivamente el objeto JSON solicitado y exactamente ' + request.texts.length + ' traducciones.' });

    }

  }

  throw new Error('Traducción no disponible.');

}



// Technical tokens never leave the host: translate prose spans, then join the

// untouched tokens in their original order. This also bounds each model response.

export async function translate(settings: ProviderSettings, request: TranslateRequest, memory = new Map<string, string>(), signal?: AbortSignal): Promise<string[]> {
  if(settings.model.startsWith('translategemma:')){
    const results:string[]=[];for(const text of request.texts){signal?.throwIfAborted();results.push(text.replace(/\[\[PROTECTED_\d+\]\]/g,'').trim()? (await translateNative(settings,{...request,texts:[text]},signal))[0]:text);}return results;
  }

  const token = /^\[\[PROTECTED_\d+\]\]$/;

  const texts: string[] = [];

  const unique = new Map<string, number>();

  const fragments = request.texts.map(text => text.split(/(\[\[PROTECTED_\d+\]\])/g).map(part => {

    if (token.test(part) || !part.trim()) return { literal: part };

    const source = part.trim();

    if (!unique.has(source)) { unique.set(source, texts.length); texts.push(source); }

    return { index: unique.get(source)!, before: part.match(/^\s*/)?.[0] || '', after: part.match(/\s*$/)?.[0] || '' };

  }));

  const translated: string[] = [];

  for (let i = 0; i < texts.length; i += settings.model.startsWith('translategemma:')?1:4) {

    translated.push(...await translatePlain(settings, { ...request, texts: texts.slice(i, i + (settings.model.startsWith('translategemma:')?1:4)) }, memory, signal));

  }

  return fragments.map(parts => parts.map(part => 'literal' in part ? part.literal : part.before + translated[part.index].trim() + part.after).join(''));

}

