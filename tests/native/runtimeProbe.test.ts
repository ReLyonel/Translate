import { afterEach, expect, it, vi } from 'vitest';
import { runNativeProbe } from '../../scripts/nativeRuntimeProbe.mjs';
import { evaluateNativeEvidence, type NativePlan } from '../../desktop/compatibility/nativeAcceptance';
afterEach(()=>vi.unstubAllGlobals());
const text='<p>@UUID[Item.ref] [[/r 1d20]]</p>';
const plan:NativePlan={schemaVersion:1,targetCore:'14.368',module:{id:'example',version:'1'},sourceHashes:[],cases:['Actor','Item','JournalEntry'].map((documentType,index)=>({id:String(index),documentType:documentType as any,uuid:`Compendium.example.pack${index}.id`,expectedName:'Espada',fields:[{segments:['description'],expected:text}]}))};
function setup(babele=false,actual=text) {
 const modules=new Map([['example',{id:'example',version:'1',active:true}]]);if(babele)modules.set('babele',{id:'babele',version:'1',active:false});
 vi.stubGlobal('game',{ready:true,modules,version:'14.368',release:{build:368},system:{id:'test',version:'1'},i18n:{lang:'es'}});
 vi.stubGlobal('fromUuid',async(uuid:string)=>{if(uuid==='Item.ref')return {};const item=plan.cases.find(item=>item.uuid===uuid);return item?{uuid,name:'Espada',documentName:item.documentType,toObject:()=>({description:actual})}:null;});
 vi.stubGlobal('foundry',{applications:{ux:{TextEditor:{enrichHTML:async(text:string)=>text}}}});
 vi.stubGlobal('DOMParser',class{parseFromString(){return {querySelectorAll:()=>[{}]};}});
}
it('tests the browser probe contract with simulated Foundry, without claiming native evidence',async()=>{
 setup();const report=await runNativeProbe(plan,{startupReviewed:true});expect(evaluateNativeEvidence(plan,[],report).status).toBe('PASS');
});
it('detects installed but disabled Babele in the actual probe path',async()=>{
 setup(true);const report=await runNativeProbe(plan,{startupReviewed:true});expect(report.checks.find(item=>item.id==='babele_absent')?.status).toBe('FAILED');
});
it('detects an effective compendium still containing untranslated text',async()=>{
 setup(false,'Untranslated description');const report=await runNativeProbe(plan,{startupReviewed:true});expect(report.cases.every(item=>item.status==='FAILED')).toBe(true);expect(evaluateNativeEvidence(plan,[],report).status).toBe('FAILED');
});
