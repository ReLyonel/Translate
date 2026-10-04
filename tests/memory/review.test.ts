import { afterEach,expect,it,vi } from 'vitest';
import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
import { MemoryStore } from '../../desktop/memory/store';
import { memoryConflicts } from '../../desktop/memory/conflicts';
import { listMemory,reviewMemory,validateReview } from '../../desktop/memory/review';
import { TranslationRuntime } from '../../desktop/translation/runtime';
import { providers } from '../../desktop/providers';
const roots:string[]=[];
afterEach(async()=>{vi.restoreAllMocks();for(const root of roots.splice(0))await fs.rm(root,{recursive:true,force:true});});
async function fixture(){const root=await fs.mkdtemp(path.join(os.tmpdir(),'review-'));roots.push(root);const store=await new MemoryStore(root).load();const id=await store.candidate('Sword','Espada','en',{system:'dnd5e',module:'test',field_type:'name'},'ollama','translategemma:27b');return {root,store,id};}
it('accepts explicitly and persists approval with a review revision',async()=>{
 const {root,store,id}=await fixture();await reviewMemory(store,{id,action:'ACCEPT',revision:0},()=>false);const reload=await new MemoryStore(root).load();expect(reload.entries()[0].approved).toBe(true);expect(reload.revision).toBe(1);
});
it('edits into a manual candidate and requires a separate approval',async()=>{
 const {store,id}=await fixture();await store.approve(id);const edited=await store.review({id,action:'EDIT',translatedText:'Sable',revision:1});expect(edited.approved).toBe(false);expect(edited.translation_engine).toBe('manual');expect(store.exact('Sword','en',edited)).toBeUndefined();await store.approve(edited.id);expect(store.exact('Sword','en',edited)?.translated_text).toBe('Sable');
});
it('rejects without deleting alternatives and invalidates previous cache',async()=>{
 const {store,id}=await fixture();await store.cache('old','Espada');await store.review({id,action:'REJECT'});expect(store.entries()).toHaveLength(1);expect(store.entries()[0].status).toBe('REJECTED');expect(store.getCache('old')).toBeUndefined();expect(store.rejected('Sword','Espada','en',store.entries()[0])).toBe(true);
});
it('restore original overrides other approved variants until a later explicit acceptance',async()=>{
 const {store,id}=await fixture();const other=await store.candidate('Sword','Sable','en',store.entries()[0],'manual','manual');await store.approve(other);await store.review({id,action:'RESTORE'});expect(store.originalRequested('Sword','en',store.entries()[0])).toBe(true);await store.approve(other);expect(store.originalRequested('Sword','en',store.entries()[0])).toBe(false);
});
it('finds contextual variants, keeps distinct surrounding contexts separate and resolves explicitly',async()=>{
 const {store,id}=await fixture();const context=store.entries()[0];const alternative=await store.candidate('Sword','Sable','en',context,'manual','manual');await store.approve(id);await store.approve(alternative);const isolated=await store.candidate('Sword','Hoja','en',{...context,surrounding_context_hash:'different'},'manual','manual');await store.approve(isolated);
 const groups=memoryConflicts(store.entries());expect(groups).toHaveLength(1);expect(groups[0].approved_conflict).toBe(true);expect(store.exact('Sword','en',context)).toBeUndefined();await store.review({id:alternative,action:'RESOLVE'});expect(store.exact('Sword','en',context)?.translated_text).toBe('Sable');expect(store.entries().find(entry=>entry.id===isolated)?.approved).toBe(true);expect(memoryConflicts(store.entries())).toEqual([]);
});
it('rejects lost tokens and malicious HTML edits without changing revision',async()=>{
 const {store}=await fixture();const id=await store.candidate('<p>Attack @UUID[Item.a]</p>','<p>Ataca @UUID[Item.a]</p>','en',{},'ollama','27b');
 for(const translatedText of ['<p>Ataca</p>','<p class="new">Ataca @UUID[Item.a]</p>'])await expect(store.review({id,action:'EDIT',translatedText})).rejects.toThrow('MEMORY_APPROVAL_INVALID');expect(store.revision).toBe(0);
});
it('rejects stale revisions and mutations while a job is active',async()=>{
 const {store,id}=await fixture();await store.approve(id);await expect(reviewMemory(store,{id,action:'REJECT',revision:0},()=>false)).rejects.toThrow('MEMORY_REVISION_CONFLICT');await expect(reviewMemory(store,{id,action:'REJECT',revision:1},()=>true)).rejects.toThrow('MEMORY_BUSY');expect(store.entries()[0].approved).toBe(true);
});
it('rolls back in-memory approval and preserves disk bytes on ENOSPC',async()=>{
 const {root,store,id}=await fixture();const original=await fs.readFile(path.join(root,'store.json'));vi.spyOn(fs,'rename').mockRejectedValue(Object.assign(new Error('full'),{code:'ENOSPC'}));await expect(store.approve(id)).rejects.toThrow('full');expect(store.entries()[0].approved).toBe(false);expect(store.revision).toBe(0);expect(await fs.readFile(path.join(root,'store.json'))).toEqual(original);expect(await fs.readdir(root)).toEqual(['store.json']);
});
it('serializes competing reviewers so only one can use the same revision',async()=>{
 const {store,id}=await fixture();const results=await Promise.allSettled([store.review({id,action:'ACCEPT',revision:0}),store.review({id,action:'REJECT',revision:0})]);expect(results.map(result=>result.status)).toEqual(['fulfilled','rejected']);expect(store.revision).toBe(1);expect(store.entries()[0].approved).toBe(true);
});
it('validates the IPC boundary and pages private memory without arbitrary fields',async()=>{
 const {store,id}=await fixture();expect(listMemory(store,{query:'espada',limit:1}).total).toBe(1);expect(()=>listMemory(store,{limit:200})).toThrow('MEMORY_QUERY_INVALID');expect(validateReview({id,action:'ACCEPT',revision:0,path:'C:/private',apiKey:'secret'})).not.toHaveProperty('path');expect(()=>validateReview({id:'../file',action:'ACCEPT',revision:0})).toThrow('MEMORY_REVIEW_INVALID');
});
it('does not silently regenerate a manually rejected result',async()=>{
 const {store,id}=await fixture();await store.review({id,action:'REJECT'});vi.spyOn(providers.ollama,'translate').mockResolvedValue(['Espada']);await expect(new TranslationRuntime(store,{endpoint:'http://localhost:11434',model:'translategemma:27b'},undefined,{system:'dnd5e',module:'test',field_type:'name'}).translate({texts:['Sword'],sourceLanguage:'en'})).rejects.toThrow('REJECTED_TRANSLATION');expect(store.entries().every(entry=>entry.status==='REJECTED')).toBe(true);
});
it('editing or rejecting after restore does not clear the original preference before approval',async()=>{
 const {root,store,id}=await fixture();await store.review({id,action:'RESTORE'});const edited=await store.review({id,action:'EDIT',translatedText:'Sable'});await store.review({id:edited.id,action:'REJECT'});const reloaded=await new MemoryStore(root).load();expect(reloaded.originalRequested('Sword','en',reloaded.entries()[0])).toBe(true);await reloaded.approve(edited.id);expect(reloaded.originalRequested('Sword','en',reloaded.entries()[0])).toBe(false);
});
it('persists usage for a run once and rolls all counters back together on disk failure',async()=>{
 const {store,id}=await fixture();const second=await store.candidate('Axe','Hacha','en',{},'manual','');const rename=vi.spyOn(fs,'rename');await store.usedMany([id,second,id]);expect(rename).toHaveBeenCalledOnce();expect(store.entries().map(entry=>entry.times_used)).toEqual([1,1]);rename.mockRejectedValue(Object.assign(new Error('full'),{code:'ENOSPC'}));await expect(store.usedMany([id,second])).rejects.toThrow();expect(store.entries().map(entry=>entry.times_used)).toEqual([1,1]);
});
it('preserves legacy IDs and a newer acceptance overrides rejection of an identical legacy variant',async()=>{
 const {root,store,id}=await fixture();await store.approve(id);const file=path.join(root,'store.json'),data=JSON.parse(await fs.readFile(file,'utf8'));const alias='f'.repeat(64);data.entries.push({...data.entries[0],id:alias,status:'CANDIDATE',approved:false,feedback:undefined});await fs.writeFile(file,JSON.stringify(data));const reload=await new MemoryStore(root).load();expect(await reload.candidate('Sword','Espada','en',reload.entries()[0],'ollama','27b')).toBe(id);await reload.review({id,action:'REJECT'});expect(reload.rejected('Sword','Espada','en',reload.entries()[0])).toBe(true);await reload.review({id:alias,action:'ACCEPT'});expect(reload.rejected('Sword','Espada','en',reload.entries()[0])).toBe(false);
});
