import {expect,it} from 'vitest';
import {prepareCase,selectCases} from '../../desktop/benchmark/corpus';
import type {InventoryUnit} from '../../desktop/translation/inventory';
const unit=(source:string,index=0):InventoryUnit=>({file:'packs/items/_source/'+index+'.json',source,context:{document_type:'Item',json_path:['items',index,'description']}});
it('freezes protected human inputs/prompts without inventing bilingual references or exposing UUID/HTML to a model',()=>{
 const entry=prepareCase(unit('<p>The actor can attack @UUID[Item.abc] using [[1d20+5]].</p>'))!;
 expect(entry.language).toBe('en');expect(entry.reference).toBeNull();expect(entry.tags).toEqual(expect.arrayContaining(['html','uuid','roll','embedded','placeholders']));
 expect(entry.prompts.join('')).not.toContain('@UUID');expect(entry.prompts.join('')).not.toContain('<p>');expect(entry.prompts.join('')).toContain('English (en) to Spanish (es)');
 expect(entry.chunks.join('')).toContain('[[PROTECTED_');expect(prepareCase(unit('Alice'))).toBeUndefined();
});
it('selects the same small stratified corpus regardless of discovery order',()=>{
 const entries=Array.from({length:100},(_,index)=>prepareCase(unit(index%2?'Мультиатака':'The actor can make an attack.',index))!);
 const first=selectCases(entries,30),second=selectCases([...entries].reverse(),30);expect(first.map(c=>c.id)).toEqual(second.map(c=>c.id));expect(first).toHaveLength(60);expect(first.filter(c=>c.language==='ru')).toHaveLength(30);
});
it('keeps long prose semantically chunked under a finite per-segment budget',()=>{
 const entry=prepareCase(unit('The actor can make an attack. '.repeat(60)))!;expect(entry.tags).toContain('long');expect(entry.chunks.length).toBeGreaterThan(1);expect(entry.prompts).toHaveLength(entry.chunks.length);expect(entry.chunks.join('')).toBe(entry.source);
 expect(prepareCase(unit('The actor can make an attack. '.repeat(1000)))).toBeUndefined();
});
