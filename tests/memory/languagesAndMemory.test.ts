import {afterEach,expect,it,vi} from 'vitest';
import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
import {MemoryStore} from '../../desktop/memory/store';
import {TranslationRuntime} from '../../desktop/translation/runtime';
import {providers} from '../../desktop/providers';
import {translationPreflight} from '../../desktop/translation/preflight';
import {inventory} from '../../desktop/translation/inventory';
import {reuseKey,cacheIdentity} from '../../desktop/translation/reuse';
import {ProtectedContentEngine as Protection} from '../../src/services/protected-content/protectedContentEngine';
const roots:string[]=[];const settings={endpoint:'http://127.0.0.1:11500',model:'translategemma:27b',thermalEnabled:false};
afterEach(async()=>{vi.restoreAllMocks();for(const root of roots.splice(0))await fs.rm(root,{recursive:true,force:true});});
async function fixture(source='Sword'){const root=await fs.mkdtemp(path.join(os.tmpdir(),'language-memory-'));roots.push(root);const store=await new MemoryStore(path.join(root,'memory')).load(),input=path.join(root,'input');await fs.mkdir(path.join(input,'packs/items/_source'),{recursive:true});await fs.writeFile(path.join(input,'packs/items/_source/a.json'),JSON.stringify({name:source}));return {root,store,input};}

it('auto detects per unit; manual selection overrides short-name uncertainty; no provider sees uncertain prose',async()=>{
 const {store}=await fixture(),spy=vi.spyOn(providers.ollama,'translate').mockImplementation(async(_settings,request)=>{expect(request.sourceLanguage).toBe(request.texts[0]==='Меч'?'ru':'en');return ['Espada'];});
 const runtime=new TranslationRuntime(store,settings);expect(await runtime.translate({texts:['Sword','Меч','Alice'],sourceLanguage:'auto'})).toEqual(['Espada','Espada','Alice']);
 expect(spy).toHaveBeenCalledTimes(2);expect(runtime.warnings.at(-1)?.reason).toBe('SOURCE_LANGUAGE_UNCERTAIN');expect(store.entries().map(e=>e.source_language).sort()).toEqual(['en','ru']);
 await new TranslationRuntime(store,settings).translate({texts:['Alice'],sourceLanguage:'en'});expect(spy).toHaveBeenCalledTimes(3);
});

it('uncertain automatic preflight and execution both preserve original and make zero network requests',async()=>{
 const {store,input}=await fixture('Alice'),fetcher=vi.spyOn(globalThis,'fetch').mockImplementation(async()=>{throw new Error('NETWORK_FORBIDDEN');});
 const report=await translationPreflight(input,'auto',store,settings,[],undefined,{offline:true});expect(report).toMatchObject({source_language_uncertain:1,strings_requiring_ai:0,estimated_model_calls:0});expect(report.warnings).toContain('SOURCE_LANGUAGE_UNCERTAIN');
 expect(await new TranslationRuntime(store,settings).translate({texts:['Alice'],sourceLanguage:'auto'})).toEqual(['Alice']);expect(fetcher).not.toHaveBeenCalled();expect(store.entries()).toEqual([]);
});

it('preflight never counts a cache target that execution rejects for contradictory glossary',async()=>{
 const {store,input}=await fixture();const [unit]=(await inventory(input)).units;const terms=[{source:'Sword',target:'Espada'}];
 await store.cache(reuseKey(store,settings,unit.source,'en',unit.context,terms),'Hoja',cacheIdentity(store,settings,unit.source,'en',unit.context,terms));
 const fetcher=vi.spyOn(globalThis,'fetch').mockImplementation(async()=>{throw new Error('NETWORK_FORBIDDEN');});
 const report=await translationPreflight(input,'en',store,settings,terms,undefined,{offline:true});expect(report).toMatchObject({cache_candidates:0,glossary_only_hits:1,estimated_model_calls:0});
 const runtime=new TranslationRuntime(store,settings);expect(await runtime.translate({texts:['Sword'],sourceLanguage:'en',units:[{sourceText:'Sword',context:unit.context}],terminology:terms})).toEqual(['Espada']);expect(runtime.metrics.values.cache_hits).toBe(0);expect(fetcher).not.toHaveBeenCalled();
});

it('explicit glossary overrides persisted glossary consistently, and unresolved conflicts preserve original',async()=>{
 const {store,input}=await fixture();await store.setGlossary([{source:'Sword',target:'Hoja',version:'1'}]);const terms=[{source:'Sword',target:'Espada'}];const fetcher=vi.spyOn(globalThis,'fetch').mockImplementation(async()=>{throw new Error('NETWORK_FORBIDDEN');});
 const preview=await translationPreflight(input,'en',store,settings,terms,undefined,{offline:true});expect(preview).toMatchObject({glossary_only_hits:1,strings_requiring_ai:0});
 expect(await new TranslationRuntime(store,settings).translate({texts:['Sword'],sourceLanguage:'en',terminology:terms})).toEqual(['Espada']);
 const conflicts=[...terms,{source:'sword',target:'Sable'}];const failed=await translationPreflight(input,'en',store,settings,conflicts,undefined,{offline:true});expect(failed).toMatchObject({glossary_conflicted_strings:1,glossary_only_hits:0,estimated_model_calls:0});expect(failed.warnings).toContain('GLOSSARY_CONFLICT');
 const runtime=new TranslationRuntime(store,settings);expect(await runtime.translate({texts:['Sword'],sourceLanguage:'en',terminology:conflicts,onUnitFailure:()=>{}})).toEqual(['Sword']);expect(runtime.warnings[0].reason).toBe('GLOSSARY_CONFLICT');expect(fetcher).not.toHaveBeenCalled();
});

it('persists candidate/approved/rejected states without promoting provider results or cache to trusted TM',async()=>{
 const {store}=await fixture();vi.spyOn(providers.ollama,'translate').mockResolvedValue(['Espada']);
 await new TranslationRuntime(store,settings).translate({texts:['Sword'],sourceLanguage:'en'});
 let loaded=await new MemoryStore(store.directory).load();const candidate=loaded.entries()[0];expect(candidate).toMatchObject({status:'CANDIDATE',approved:false});expect(loaded.exact('Sword','en',{})).toBeUndefined();expect(Object.keys(loaded.readCache())).toHaveLength(1);
 await loaded.approve(candidate.id);loaded=await new MemoryStore(store.directory).load();expect(loaded.exact('Sword','en',{})?.status).toBe('APPROVED');expect(loaded.exact('Sword','ru',{})).toBeUndefined();expect(loaded.exact('Sword','en',{field_type:'description'})).toBeUndefined();
 await loaded.review({id:candidate.id,action:'REJECT'});loaded=await new MemoryStore(store.directory).load();expect(loaded.entries()[0]).toMatchObject({status:'REJECTED',approved:false});expect(loaded.exact('Sword','en',{})).toBeUndefined();
});

it.each(['ENOSPC','EACCES'])('failed approval on %s preserves both trusted state and original database',async code=>{
 const {store}=await fixture();const id=await store.candidate('Sword','Espada','en',{},'manual','');const file=path.join(store.directory,'store.json'),before=await fs.readFile(file);
 vi.spyOn(fs,'rename').mockRejectedValueOnce(Object.assign(new Error(code),{code}));await expect(store.approve(id)).rejects.toMatchObject({code});
 expect(await fs.readFile(file)).toEqual(before);expect(store.entries()[0]).toMatchObject({status:'CANDIDATE',approved:false});expect(store.exact('Sword','en',{})).toBeUndefined();expect((await fs.readdir(store.directory)).filter(n=>n.endsWith('.tmp'))).toEqual([]);
});

it('provider failure and cancellation do not create or approve memory, overwrite existing approved entries or increment use counts',async()=>{
 const {store}=await fixture();const id=await store.candidate('Shield','Escudo','en',{},'manual','');await store.approve(id);const before=await fs.readFile(path.join(store.directory,'store.json'));
 const spy=vi.spyOn(providers.ollama,'translate').mockRejectedValue(new Error('OFFLINE'));await expect(new TranslationRuntime(store,settings).translate({texts:['Sword'],sourceLanguage:'en'})).rejects.toThrow();
 const controller=new AbortController();spy.mockImplementation(async()=>{controller.abort();return ['Espada'];});await expect(new TranslationRuntime(store,settings).translate({texts:['Sword'],sourceLanguage:'en'},controller.signal)).rejects.toThrow();
 expect(await fs.readFile(path.join(store.directory,'store.json'))).toEqual(before);expect(store.entries()).toHaveLength(1);expect(store.entries()[0]).toMatchObject({approved:true,times_used:0});expect(Object.keys(store.readCache())).toHaveLength(0);
});

it('approved Russian enriched text is reused byte-exactly with references, Unicode and accents, without Ollama',async()=>{
 const {store}=await fixture();const source='<p>Вампир @UUID[Actor.abcdefghijklmnop] [[1d20+5]]</p>',target='<p>Vampiro @UUID[Actor.abcdefghijklmnop] [[1d20+5]]</p>',context={system:'dnd5e',module:'test',document_type:'Actor',field_type:'description'};
 const id=await store.candidate(source,target,'ru',context,'manual','');await store.approve(id);const reload=await new MemoryStore(store.directory).load();const spy=vi.spyOn(providers.ollama,'translate').mockImplementation(async()=>{throw new Error('MODEL_FORBIDDEN');});
 const runtime=new TranslationRuntime(reload,settings);const [wire]=await runtime.translate({texts:[Protection.protect(source).protectedText],sourceLanguage:'auto',units:[{sourceText:source,context}]});expect(Protection.restore(wire,Protection.protect(source).tokens).restoredText).toBe(target);expect(runtime.metrics.values.tm_exact_hits).toBe(1);expect(spy).not.toHaveBeenCalled();expect(reload.entries()[0].source_text).toBe(source);
});

it('deduplicates compatible approved occurrences but invokes the provider for a different context',async()=>{
 const {store}=await fixture();const a={system:'dnd5e',module:'test',document_type:'Actor',field_type:'name'},b={...a,document_type:'Item'};const id=await store.candidate('Вампир','Vampiro','ru',a,'manual','');await store.approve(id);
 const spy=vi.spyOn(providers.ollama,'translate').mockResolvedValue(['Vampiro']);const runtime=new TranslationRuntime(store,settings);
 expect(await runtime.translate({texts:['Вампир','Вампир','Вампир'],sourceLanguage:'ru',units:[a,a,b].map(context=>({sourceText:'Вампир',context}))})).toEqual(['Vampiro','Vampiro','Vampiro']);
 expect(runtime.metrics.values).toMatchObject({tm_exact_hits:1,strings_unique:2,strings_deduplicated:1});expect(spy).toHaveBeenCalledTimes(1);
});

it('conflicting approved alternatives never supply exact or fuzzy targets and glossary can safely resolve the text',async()=>{
 const {store}=await fixture();for(const target of ['Carga','Embestida']){const id=await store.candidate('Charge',target,'en',{system:'dnd5e',field_type:'name'},'manual','');await store.approve(id);}
 const context={system:'dnd5e',field_type:'name'};expect(store.exact('Charge','en',context)).toBeUndefined();expect(store.fuzzy('Charge now','en',context)).toEqual([]);
 const spy=vi.spyOn(providers.ollama,'translate').mockImplementation(async()=>{throw new Error('MODEL_FORBIDDEN');});const runtime=new TranslationRuntime(store,settings);
 expect(await runtime.translate({texts:['Charge'],sourceLanguage:'en',units:[{sourceText:'Charge',context}],terminology:[{source:'Charge',target:'Carga'}]})).toEqual(['Carga']);expect(runtime.metrics.values.tm_exact_hits).toBe(0);expect(spy).not.toHaveBeenCalled();
});

it('current cache needs exact model/prompt/language/context metadata; legacy rows are preserved without hits',async()=>{
 const {store}=await fixture(),source='Sword',identity=cacheIdentity(store,settings,source,'en',{});await store.cache(identity.key,'Espada',identity);
 expect(store.getCache(identity.key,identity)).toBe('Espada');
 for(const changed of [{model:'translategemma:12b'},{prompt_version:'obsolete'},{source_language:'ru'},{context_hash:'b'.repeat(64)},{glossary_hash:'c'.repeat(64)}])expect(store.getCache(identity.key,{...identity,...changed})).toBeUndefined();
 await store.cache('legacy','Sable');const reload=await new MemoryStore(store.directory).load();expect(reload.getCache('legacy')).toBeUndefined();expect(reload.readLegacyCache().legacy.value).toBe('Sable');
});
