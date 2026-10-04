import { afterEach,expect,it,vi } from 'vitest';
import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
import { MemoryStore } from '../../desktop/memory/store';
import { TranslationRuntime } from '../../desktop/translation/runtime';
import { providers } from '../../desktop/providers';
import { ProtectedContentEngine as Protection } from '../../src/services/protected-content/protectedContentEngine';
const roots:string[]=[];afterEach(async()=>{vi.restoreAllMocks();for(const root of roots.splice(0))await fs.rm(root,{recursive:true,force:true});});
const settings={endpoint:'http://localhost:11434',model:'translategemma:27b'};
async function fixture(){const directory=await fs.mkdtemp(path.join(os.tmpdir(),'tm-'));roots.push(directory);const store=await new MemoryStore(directory).load();return {store,directory};}
it('persists candidates, never reuses them as approved TM, and requires explicit approval',async()=>{
 const {store,directory}=await fixture();const id=await store.candidate('Sword','Espada','en',{},'ollama','27b');expect(store.exact('Sword','en',{})).toBeUndefined();await store.approve(id);const reload=await new MemoryStore(directory).load();expect(reload.exact('Sword','en',{})?.translated_text).toBe('Espada');expect(reload.entries()[0].times_used).toBe(0);
});
it('does not resolve conflicting approved exact translations arbitrarily',async()=>{
 const {store}=await fixture();for(const target of ['Carga','Cargar']){const id=await store.candidate('Charge',target,'en',{system:'test'},'manual','');await store.approve(id);}expect(store.exact('Charge','en',{system:'test'})).toBeUndefined();
});
it('returns approved contextual fuzzy entries without replacing new text',async()=>{
 const {store}=await fixture();const id=await store.candidate('Make an attack roll','Realiza una tirada de ataque','en',{},'manual','');await store.approve(id);const spy=vi.spyOn(providers.ollama,'translate').mockImplementation(async(_settings,request)=>{expect(request.context?.notes).toContain('context only');return ['Realiza una tirada de ataque cuerpo a cuerpo'];});
 const runtime=new TranslationRuntime(store,settings);expect(await runtime.translate({sourceLanguage:'en',texts:['Make a melee attack roll']})).toEqual(['Realiza una tirada de ataque cuerpo a cuerpo']);expect(spy).toHaveBeenCalledTimes(1);expect(runtime.metrics.values.tm_fuzzy_hits).toBe(1);
});
it('approved exact match avoids provider and stats update only on explicit commit',async()=>{
 const {store}=await fixture();const id=await store.candidate('Sword','Espada','en',{},'manual','');await store.approve(id);const spy=vi.spyOn(providers.ollama,'translate');const runtime=new TranslationRuntime(store,settings);expect(await runtime.translate({texts:['Sword'],sourceLanguage:'en'})).toEqual(['Espada']);expect(spy).not.toHaveBeenCalled();expect(store.entries()[0].times_used).toBe(0);await runtime.commitUsage();expect(store.entries()[0].times_used).toBe(1);
});
it('deduplicates equivalent text and persists versioned cache across runtime instances',async()=>{
 const {store}=await fixture();const spy=vi.spyOn(providers.ollama,'translate').mockResolvedValue(['Espada']);const runtime=new TranslationRuntime(store,settings);expect(await runtime.translate({texts:['Sword','Sword'],sourceLanguage:'en'})).toEqual(['Espada','Espada']);expect(spy).toHaveBeenCalledTimes(1);expect(runtime.metrics.values.strings_deduplicated).toBe(1);
 const second=new TranslationRuntime(store,settings);expect(await second.translate({texts:['Sword'],sourceLanguage:'en'})).toEqual(['Espada']);expect(second.metrics.values.cache_hits).toBe(1);expect(spy).toHaveBeenCalledTimes(1);
 await new TranslationRuntime(store,{...settings,model:'translategemma:12b'}).translate({texts:['Sword'],sourceLanguage:'en'});expect(spy).toHaveBeenCalledTimes(2);
});
it('never deduplicates different references hidden behind identical markers',async()=>{
 const {store}=await fixture();const spy=vi.spyOn(providers.ollama,'translate').mockImplementation(async(_settings,request)=>request.texts.map(text=>text.replace('Sword','Espada')));
 const sources=['Sword @UUID[Item.a]','Sword @UUID[Item.b]'];const request={sourceLanguage:'en' as const,texts:sources.map(source=>Protection.protect(source).protectedText),units:sources.map(sourceText=>({sourceText}))};const runtime=new TranslationRuntime(store,settings);await runtime.translate(request);expect(spy).toHaveBeenCalledTimes(2);expect(runtime.metrics.values.strings_unique).toBe(2);
});
it('does not apply exact TM across systems or field contexts',async()=>{
 const {store}=await fixture();const id=await store.candidate('Charge','Carga','en',{system:'a',field_type:'name'},'manual','');await store.approve(id);expect(store.exact('Charge','en',{system:'b',field_type:'name'})).toBeUndefined();expect(store.exact('Charge','en',{system:'a',field_type:'description'})).toBeUndefined();
});
it('rejects glossary conflicts within the same scope',async()=>{
 const {store}=await fixture();await expect(store.setGlossary([{source:'Charge',target:'Carga',version:'1'},{source:'Charge',target:'Embestida',version:'1'}])).rejects.toThrow('GLOSSARY_CONFLICT');
});
it('approved exact TM precedes glossary under the urgent canonical-first policy',async()=>{
 const {store}=await fixture();await store.setGlossary([{source:'Sword',target:'Hoja',system:'test',version:'1'}]);const id=await store.candidate('Sword','Hoja','en',{system:'test'},'manual','');await store.approve(id);const spy=vi.spyOn(providers.ollama,'translate').mockImplementation(async(_settings,request)=>request.texts);const runtime=new TranslationRuntime(store,settings,undefined,{system:'test'});expect(await runtime.translate({sourceLanguage:'en',texts:['Sword'],terminology:[{source:'Sword',target:'Espada'}]})).toEqual(['Hoja']);expect(runtime.metrics.values.tm_exact_hits).toBe(1);expect(spy).not.toHaveBeenCalled();
});
it('does not cache or approve suspicious provider responses',async()=>{
 const {store}=await fixture();vi.spyOn(providers.ollama,'translate').mockResolvedValue(['Translation: Espada']);await expect(new TranslationRuntime(store,settings).translate({texts:['Sword']})).rejects.toThrow('MODEL_EXPLANATION');expect(store.entries()).toEqual([]);
});
it('abort cannot create trusted knowledge',async()=>{
 const {store}=await fixture();const controller=new AbortController();vi.spyOn(providers.ollama,'translate').mockImplementation(async()=>{controller.abort();return ['Espada'];});await expect(new TranslationRuntime(store,settings).translate({texts:['Sword']},controller.signal)).rejects.toThrow();expect(store.entries()).toEqual([]);
});
it('protects direct HTML and references before the provider sees any text',async()=>{
 const {store}=await fixture();const source='<p>Sword @UUID[Item.a]</p>';
 const spy=vi.spyOn(providers.ollama,'translate').mockImplementation(async(_settings,request)=>{
   expect(request.texts[0]).not.toContain('<p>');expect(request.texts[0]).not.toContain('@UUID');
   return request.texts.map(text=>text.replace('Sword','Espada'));
 });
 expect(await new TranslationRuntime(store,settings).translate({texts:[source],sourceLanguage:'en'})).toEqual(['<p>Espada @UUID[Item.a]</p>']);
 expect(spy).toHaveBeenCalledTimes(1);
});
it('does not collapse case or whitespace during deduplication',async()=>{
 const {store}=await fixture();const spy=vi.spyOn(providers.ollama,'translate').mockResolvedValue(['Espada']);
 await new TranslationRuntime(store,settings).translate({texts:['Sword','sword',' Sword'],sourceLanguage:'en'});
 expect(spy).toHaveBeenCalledTimes(3);
});
it('invalidates persisted cache when glossary version changes',async()=>{
 const {store}=await fixture();const spy=vi.spyOn(providers.ollama,'translate').mockResolvedValue(['Espada']);
 await new TranslationRuntime(store,settings).translate({texts:['Sword'],sourceLanguage:'en'});
 await store.setGlossary([{source:'shield',target:'escudo',version:'2'}]);
 await new TranslationRuntime(store,settings).translate({texts:['Sword'],sourceLanguage:'en'});
 expect(spy).toHaveBeenCalledTimes(2);
});
it('retains Russian source identity and never auto-approves its translation',async()=>{
 const {store}=await fixture();vi.spyOn(providers.ollama,'translate').mockResolvedValue(['Espada']);
 await new TranslationRuntime(store,settings).translate({texts:['\u041c\u0435\u0447'],sourceLanguage:'ru'});
 expect(store.entries()[0].source_language).toBe('ru');expect(store.entries()[0].approved).toBe(false);
});
it('rejects corrupted memory schemas without treating them as an empty store',async()=>{
 const {directory}=await fixture();await fs.writeFile(path.join(directory,'store.json'),JSON.stringify({version:1,entries:[{approved:true}],glossary:[],cache:{}}));
 await expect(new MemoryStore(directory).load()).rejects.toThrow('MEMORY_SCHEMA_INVALID');
});
it('does not retrieve irrelevant fuzzy entries or leak candidates into context',async()=>{
 const {store}=await fixture();await store.candidate('Make an attack roll','Realiza una tirada de ataque','en',{},'manual','');
 expect(store.fuzzy('Make a melee attack roll','en',{})).toEqual([]);
 const id=await store.candidate('Roll for gold','Tira para obtener oro','en',{},'manual','');await store.approve(id);
 expect(store.fuzzy('Make a melee attack roll','en',{})).toEqual([]);
});
it('excludes conflicting approved variants from fuzzy context',async()=>{
 const {store}=await fixture();for(const target of ['Realiza una tirada de ataque','Haz una tirada de ataque']){const id=await store.candidate('Make an attack roll',target,'en',{},'manual','');await store.approve(id);}
 expect(store.fuzzy('Make a melee attack roll','en',{})).toEqual([]);
});
it('revalidates cached tokens and treats corrupted results as misses',async()=>{
 const {store}=await fixture();vi.spyOn(store,'getCache').mockReturnValue('<p>Espada</p>');const spy=vi.spyOn(providers.ollama,'translate').mockImplementation(async(_settings,request)=>request.texts.map(text=>text.replace('Sword','Espada')));
 const runtime=new TranslationRuntime(store,settings);expect(await runtime.translate({texts:['<p>Sword @UUID[Item.a]</p>'],sourceLanguage:'en'})).toEqual(['<p>Espada @UUID[Item.a]</p>']);expect(spy).toHaveBeenCalledTimes(1);expect(runtime.metrics.values.cache_hits).toBe(0);expect(runtime.metrics.values.cache_misses).toBe(1);
});
