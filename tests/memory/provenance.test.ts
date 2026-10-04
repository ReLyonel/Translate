import { afterEach,expect,it,vi } from 'vitest';import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
import { MemoryStore } from '../../desktop/memory/store';import { TranslationRuntime } from '../../desktop/translation/runtime';import { providers } from '../../desktop/providers';import { publicProvenance } from '../../desktop/memory/provenance';
const roots:string[]=[];const settings={endpoint:'http://localhost:11434',model:'translategemma:27b'};
afterEach(async()=>{vi.restoreAllMocks();vi.unstubAllGlobals();for(const root of roots.splice(0))await fs.rm(root,{recursive:true,force:true});});
async function fixture(){const root=await fs.mkdtemp(path.join(os.tmpdir(),'origins-'));roots.push(root);return new MemoryStore(root).load();}
it('tracks fresh model production, dedup occurrences and cache without exporting prose',async()=>{
 const store=await fixture();vi.spyOn(providers.ollama,'translate').mockResolvedValue(['Espada']);const runtime=new TranslationRuntime(store,settings);await runtime.translate({texts:['Sword','Sword'],sourceLanguage:'en'});expect(runtime.units[0].origins).toEqual(['TRANSLATEGEMMA']);expect(runtime.units[1].deduplicated).toBe(true);expect(runtime.units[0].unit_id).not.toBe(runtime.units[1].unit_id);
 const second=new TranslationRuntime(store,settings);await second.translate({texts:['Sword'],sourceLanguage:'en'});expect(second.units[0].origins).toEqual(['CACHE']);expect(publicProvenance(second.units[0])).not.toHaveProperty('source_text');expect(publicProvenance(second.units[0])).not.toHaveProperty('translated_text');
});
it('identifies manually approved exact memory without claiming a provider call',async()=>{
 const store=await fixture();const id=await store.candidate('Sword','Espada','en',{},'manual','');await store.approve(id);const spy=vi.spyOn(providers.ollama,'translate');const runtime=new TranslationRuntime(store,settings);await runtime.translate({texts:['Sword'],sourceLanguage:'en'});expect(runtime.units[0].origins).toEqual(['TM_EXACT','MANUAL']);expect(runtime.units[0].provider).toBeNull();expect(runtime.units[0].memory_id).toBe(id);expect(spy).not.toHaveBeenCalled();
});
it('attributes a whole glossary term to glossary and records no AI producer',async()=>{
 const store=await fixture();vi.spyOn(providers.ollama,'translate').mockImplementation(async(_settings,request)=>request.texts);const runtime=new TranslationRuntime(store,settings);expect(await runtime.translate({texts:['Sword'],sourceLanguage:'en',terminology:[{source:'Sword',target:'Espada'}]})).toEqual(['Espada']);expect(runtime.units[0].origins).toEqual(['GLOSSARY']);expect(runtime.units[0].provider).toBeNull();expect(store.entries()[0].translation_engine).toBe('glossary');
});
it('records fuzzy as context and protects its examples before sending model notes',async()=>{
 const store=await fixture();const id=await store.candidate('Make an attack roll @UUID[Item.a]','Realiza una tirada de ataque @UUID[Item.a]','en',{},'manual','');await store.approve(id);
 vi.spyOn(providers.ollama,'translate').mockImplementation(async(_settings,request)=>{expect(request.context?.notes).not.toContain('Item.a');return request.texts.map(text=>text.replace('Make a melee attack roll','Realiza una tirada de ataque cuerpo a cuerpo'));});
 const runtime=new TranslationRuntime(store,settings);await runtime.translate({texts:['Make a melee attack roll @UUID[Item.a]'],sourceLanguage:'en'});expect(runtime.units[0].origins).toEqual(['TM_FUZZY_CONTEXT','TRANSLATEGEMMA']);
});
it('attributes fallback to actual LibreTranslate rather than the failed Ollama model',async()=>{
 const store=await fixture();vi.spyOn(providers.ollama,'translate').mockRejectedValue(new Error('offline'));vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({translatedText:'Espada'})));const runtime=new TranslationRuntime(store,{...settings,fallback:true});await runtime.translate({texts:['Sword'],sourceLanguage:'en'});expect(runtime.units[0]).toMatchObject({origins:['PROVIDER'],provider:'libretranslate',model:'LibreTranslate'});expect(runtime.metrics.values.libretranslate_requests).toBe(1);
});
it('records original restoration and does not call AI after a manual restore decision',async()=>{
 const store=await fixture();const id=await store.candidate('Sword','Espada','en',{},'ollama','27b');await store.review({id,action:'RESTORE'});const spy=vi.spyOn(providers.ollama,'translate');const failure=vi.fn(),runtime=new TranslationRuntime(store,settings);expect(await runtime.translate({texts:['Sword'],sourceLanguage:'en',onUnitFailure:failure})).toEqual(['Sword']);expect(failure).toHaveBeenCalledOnce();expect(runtime.units[0].origins).toEqual(['MANUAL','ORIGINAL_FALLBACK']);expect(spy).not.toHaveBeenCalled();
});
it('stores contextual notes privately and omits them from public provenance',async()=>{
 const store=await fixture();vi.spyOn(providers.ollama,'translate').mockImplementation(async(_settings,request)=>{expect(request.context?.notes).toContain('Visible document context');return ['Carga'];});const runtime=new TranslationRuntime(store,settings);await runtime.translate({texts:['Charge'],sourceLanguage:'en',units:[{sourceText:'Charge',context:{surrounding_context:'A weapon attack',surrounding_context_hash:'context-hash'}}]});expect(publicProvenance(runtime.units[0])).not.toHaveProperty('surrounding_context');expect(store.entries()[0].surrounding_context).toBe('A weapon attack');
});
it('records both glossary and model when only part of a sentence uses a glossary term',async()=>{
 const store=await fixture();vi.spyOn(providers.ollama,'translate').mockImplementation(async(_settings,request)=>request.texts.map(text=>text.replace('Make a ','Realiza una ')));const runtime=new TranslationRuntime(store,settings);await runtime.translate({texts:['Make a Saving Throw'],sourceLanguage:'en',terminology:[{source:'Saving Throw',target:'Tirada de Salvación'}]});expect(runtime.units[0].origins).toEqual(['GLOSSARY','TRANSLATEGEMMA']);
});
it('rejects cached references with equal placeholder counts but different original bytes',async()=>{
 const store=await fixture();vi.spyOn(store,'getCache').mockReturnValue('Espada @UUID[Item.other]');const spy=vi.spyOn(providers.ollama,'translate').mockImplementation(async(_settings,request)=>request.texts.map(text=>text.replace('Sword','Espada')));const runtime=new TranslationRuntime(store,settings);expect(await runtime.translate({texts:['Sword @UUID[Item.a]'],sourceLanguage:'en'})).toEqual(['Espada @UUID[Item.a]']);expect(spy).toHaveBeenCalledOnce();expect(runtime.metrics.values.cache_hits).toBe(0);
});
