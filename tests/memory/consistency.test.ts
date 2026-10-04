import { expect,it } from 'vitest';import { consistencyReport } from '../../desktop/logging/consistencyReport';import { hashKey } from '../../desktop/memory/store';import type { ResolvedUnit } from '../../desktop/memory/provenance';
import { surroundingContext } from '../../desktop/memory/context';
const unit=(source:string,target:string,field='name'):ResolvedUnit=>({unit_id:hashKey([source,target,field]),locator_id:hashKey([source,field]),file:'test.json',source_language:'en',target_language:'es',source_hash:hashKey(source),target_hash:hashKey(target),origins:['TRANSLATEGEMMA'],provider:'ollama',model:'27b',quality:'PASS',publication:'VALIDATED',deduplicated:false,source_text:source,translated_text:target,system:'dnd5e',module:'test',field_type:field});
it('counts alternatives by module/system and preserves contextual differences for review',()=>{
 const units=[unit('Saving Throw','Tirada de Salvación'),unit('Saving Throw','Tirada de Salvación'),unit('Saving Throw','Salvación','description')];const report=consistencyReport(units,[],[]);expect(report.warning_count).toBe(1);expect(report.issues[0].variants.map(variant=>variant.count).sort()).toEqual([1,2]);expect(report.policy).toBe('REVIEW_ONLY');expect(units[2].translated_text).toBe('Salvación');
});
it('excludes failed/recovered results, unrelated systems and identical consistent translations',()=>{
 const a=unit('Charge','Carga'),b={...unit('Charge','Embestida'),system:'another'},failed={...unit('Charge','Cargar'),publication:'RECOVERED' as const};expect(consistencyReport([a,a,b,failed],[],[]).warning_count).toBe(0);
});
it('finds known term alternatives in different prose without matching a nested shorter variant twice',()=>{
 const units=[unit('Make a Saving Throw now','Realiza una Tirada de Salvación ahora'),unit('A Saving Throw is required','Es necesaria una Salvación')];const glossary=[{source:'Saving Throw',target:'Tirada de Salvación',system:'dnd5e',version:'1'},{source:'Saving Throw',target:'Salvación',system:'dnd5e',version:'1'}];const report=consistencyReport(units,[],glossary);expect(report.issues[0].reason).toBe('KNOWN_TERM_VARIANTS');expect(report.issues[0].variants.map(variant=>variant.count)).toEqual([1,1]);
});
it('does not include full long narrative or credential-like previews in the report',()=>{
 const source='Sensitive story '.repeat(20);const report=consistencyReport([unit(source,'A'.repeat(100)),unit(source,'B'.repeat(100))],[],[]);expect(JSON.stringify(report)).not.toContain('Sensitive story');expect(report.issues[0].term).toBeUndefined();const secret=consistencyReport([unit('secret_key','one'),unit('secret_key','two')],[],[]);expect(secret.issues[0].term).toBeUndefined();
});
it('does not merge known phrase variants across modules, systems or source languages',()=>{
 const first=unit('Make a Saving Throw','Realiza una Tirada de Salvación');
 const glossary=[{source:'Saving Throw',target:'Tirada de Salvación',version:'1'},{source:'Saving Throw',target:'Salvación',version:'1'}];
 for(const context of [{module:'another'},{system:'another'},{source_language:'ru'}]){
  const second={...unit('A Saving Throw is required','Es necesaria una Salvación'),...context};
  expect(consistencyReport([first,second],[],glossary).warning_count).toBe(0);
 }
});
it('uses the embedded item context instead of conflating it with its owning actor',()=>{
 const original={name:'Mage',type:'npc',items:[{name:'Charge',type:'weapon',system:{description:{value:'A weapon attack'}}},{name:'Charge',type:'spell',system:{description:{value:'A spell charge'}}}]};const weapon=surroundingContext(original,['items',0,'name'],'Charge'),spell=surroundingContext(original,['items',1,'name'],'Charge');expect(weapon.document_type).toBe('weapon');expect(spell.document_type).toBe('spell');expect(weapon.surrounding_context_hash).not.toBe(spell.surrounding_context_hash);
});
it('supplies only human context without HTML, references or executable blocks',()=>{
 const context=surroundingContext({name:'Sword',type:'weapon',system:{description:{value:'<p>A weapon @UUID[Item.a]</p><script>alert(1)</script>'}}},['name'],'Sword');expect(context.surrounding_context).toBe('A weapon');expect(context.surrounding_context).not.toContain('Item.a');
});
