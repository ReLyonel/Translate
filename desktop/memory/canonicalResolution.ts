import {hashKey,type MemoryStore} from './store';
import {PdfReuse,pdfField} from './pdfReuse';
import {pdfHash,pdfRulesVersion} from './pdfCorpus';
import type {InventoryUnit} from '../translation/inventory';
import {inventory} from '../translation/inventory';
import {reusable} from '../translation/reuse';
/** Stable full identity plus an approved SRD pair, never an ID/name-only join. */
export function canonicalResolution(store:MemoryStore,units:InventoryUnit[]){
 const pdf=new PdfReuse(store),approved=store.readEntries().filter(e=>e.pdf&&!e.pdf.binding&&e.approved&&e.status==='APPROVED'&&e.rules_version===pdfRulesVersion&&store.pdfCorpus.evidence(e.pdf,e.source_text,e.translated_text)&&pdf.exact(e.source_text,'en',e)?.translated_text===e.translated_text);
 const byTarget=new Map<string,typeof approved>();for(const e of approved){const key=JSON.stringify([e.system,e.field_type,e.translated_text]),rows=byTarget.get(key)||[];rows.push(e);byTarget.set(key,rows);}
 const maps=new Map<string,ReturnType<MemoryStore['readEntries']>[number][]>();const key=(uuid:unknown,version:unknown,path:unknown)=>JSON.stringify([uuid,version,path]);
 for(const e of store.readEntries().filter(e=>!e.pdf&&e.translation_engine==='manual-spanish-import'&&e.status!=='REJECTED'&&e.canonical_uuid&&e.canonical_version&&e.json_path)){const id=key(e.canonical_uuid,e.canonical_version,e.json_path),rows=maps.get(id)||[];rows.push(e);maps.set(id,rows);}
 let mapped=0,conflicts=0,missingApproval=0;const bindings:{alignment_id:string;file:string;path:(string|number)[];source_hash:string;uuid:string;classification:'VERIFIED'}[]=[];
 for(const unit of units){const c=unit.context;if(c.system!=='dnd5e'||!c.canonical_uuid||!c.canonical_version||!c.json_path||!pdfField(c))continue;
  const rows=(maps.get(key(c.canonical_uuid,c.canonical_version,c.json_path))||[]).filter(e=>e.source_text===unit.source&&e.system===c.system&&e.module===c.module&&e.document_type===c.document_type&&e.field_type===c.field_type);if(!rows.length)continue;mapped++;
  if(store.originalRequested(unit.source,'ru',c)||pdf.original(unit.source,'ru',c)||pdf.canonical(unit.source,c))continue;
  if(new Set(rows.map(e=>e.translated_text)).size!==1){conflicts++;continue;}const target=rows[0].translated_text;
  const pairs=byTarget.get(JSON.stringify([c.system,pdfField(c),target]))||[];if(new Set(pairs.map(e=>e.source_text)).size!==1){missingApproval++;continue;}
  try{if(store.rejected(unit.source,target,'ru',c)||!reusable(unit.source,target,c)){missingApproval++;continue;}}catch{missingApproval++;continue;}
  bindings.push({alignment_id:pairs[0].id,file:unit.file,path:c.json_path,source_hash:pdfHash(unit.source),uuid:c.canonical_uuid,classification:'VERIFIED'});
 }
 return {schema_version:1,policy:'FULL_FOUNDRY_IDENTITY_AND_APPROVED_SRD_PAIR',mapped_units:mapped,conflicting_units:conflicts,missing_approved_alignment:missingApproval,verified_bindings:bindings.length,bindings,input_hash:hashKey([store.revision,store.pdfCorpus.fingerprint,bindings])};
}
export async function applyCanonicalResolution(store:MemoryStore,root:string,expectedHash:string){
 await store.refreshPdf();const data=await inventory(root),plan=canonicalResolution(store,data.units);if(plan.input_hash!==expectedHash)throw new Error('CANONICAL_RESOLUTION_STALE');
 const pending:Parameters<MemoryStore['candidateBatch']>[0]=[];
 for(const binding of plan.bindings){const pair=store.readEntries().find(e=>e.id===binding.alignment_id)!,unit=data.units.find(u=>u.file===binding.file&&JSON.stringify(u.context.json_path)===JSON.stringify(binding.path)&&pdfHash(u.source)===binding.source_hash)!;if(!unit||unit.source.length>200000)throw new Error('CANONICAL_RESOLUTION_INVALID');
  pending.push({source:pair.source_text,target:pair.translated_text,language:'en',context:{...unit.context,pdf:{...pair.pdf!,binding:{source_hash:binding.source_hash,source_excerpt:unit.source.slice(0,600),source_text:unit.source,usage:'EXACT'}}},engine:'pdf-srd-binding',model:''});
 }
 const ids=await store.candidateBatch(pending);await store.approvePdfBatch(ids,store.revision);return {approved:ids.length,policy:plan.policy};
}
