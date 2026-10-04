import {hashKey,type MemoryEntry, type MemoryStore} from './store';
import {pdfExactText,pdfRulesVersion} from './pdfCorpus';
import {reusable} from '../translation/reuse';
export type ResolutionClass='VERIFIED'|'HIGH_CONFIDENCE'|'AMBIGUOUS'|'REJECTED';
export const resolutionPolicy='pdf-resolution-1';
const groupKey=(e:MemoryEntry)=>hashKey([e.source_language,e.target_language,e.system,e.module,e.document_type,e.field_type,pdfExactText(e.source_text),e.pdf?.edition,e.pdf?.binding?[e.canonical_uuid,e.canonical_version,e.json_path,e.pdf.binding.source_hash,e.pdf.binding.usage]:null]);
function eligible(store:MemoryStore,e:MemoryEntry){try{return e.system==='dnd5e'&&e.source_language==='en'&&!!e.pdf&&store.pdfCorpus.evidence(e.pdf,e.source_text,e.translated_text)&&reusable(e.source_text,e.translated_text,e)&&!store.originalRequested(e.source_text,e.source_language,e)&&!store.rejected(e.source_text,e.translated_text,e.source_language,e);}catch{return false;}}
/** Confidence describes evidence, never an inferred translation approval. */
function buildResolution(store:MemoryStore){
 const buckets=new Map<string,MemoryEntry[]>();for(const entry of store.readEntries().filter(e=>e.pdf)){const key=groupKey(entry),rows=buckets.get(key)||[];rows.push(entry);buckets.set(key,rows);}
 const groups=[...buckets].sort(([a],[b])=>a.localeCompare(b)).map(([id,rows])=>{
  const safe=rows.filter(e=>eligible(store,e)),approved=safe.filter(e=>e.approved&&e.status==='APPROVED'&&e.rules_version===pdfRulesVersion),targets=new Set(safe.map(e=>e.translated_text)),approvedTargets=new Set(approved.map(e=>e.translated_text));
  const verified=approvedTargets.size===1?approved[0]:undefined;
  const variants=rows.map(e=>{
   let classification:ResolutionClass='AMBIGUOUS',reason='NO_BILINGUAL_IDENTITY_PROOF',authority:string|undefined;
   if(!safe.includes(e)){classification='REJECTED';reason=e.status==='REJECTED'?'REJECTED_BY_USER':'INVALID_OR_STALE_EVIDENCE';}
   else if(approvedTargets.size>1){reason='APPROVED_CONFLICT';}
   else if(verified&&e.translated_text===verified.translated_text&&e.source_text===verified.source_text){classification='VERIFIED';reason=e.approved?'ALREADY_APPROVED':'EXACT_APPROVED_ALIGNMENT';authority=verified.id;}
   else if(targets.size>1){reason='MULTIPLE_TRANSLATIONS';}
   else if(e.pdf?.method==='MANUAL_ALIGNMENT'||e.pdf?.binding){classification='HIGH_CONFIDENCE';reason='EXPLICIT_SELECTION_REQUIRES_REVIEW';}
   return {id:e.id,classification,reason,authority,approved:e.approved,translated_text:e.translated_text,score:e.pdf!.score,source:e.pdf!.source,target:e.pdf!.target};
  }).sort((a,b)=>a.id.localeCompare(b.id));
  return {id,source_text:rows[0].source_text,field_type:rows[0].field_type,canonical_uuid:rows[0].canonical_uuid,variants};
 });
 const counts={VERIFIED:0,HIGH_CONFIDENCE:0,AMBIGUOUS:0,REJECTED:0};for(const group of groups)for(const variant of group.variants)counts[variant.classification]++;
 const input_hash=hashKey([resolutionPolicy,store.revision,store.pdfCorpus.fingerprint,groups]);
 return {schema_version:1,policy:resolutionPolicy,input_hash,reference_fingerprint:store.pdfCorpus.fingerprint,revision:store.revision,candidates:groups.reduce((n,g)=>n+g.variants.length,0),groups_total:groups.length,duplicates:groups.reduce((n,g)=>n+g.variants.length-new Set(g.variants.map(v=>v.translated_text)).size,0),counts,auto_approvable:groups.flatMap(g=>g.variants).filter(v=>v.classification==='VERIFIED'&&!v.approved).map(v=>v.id),groups};
}
const plans=new WeakMap<MemoryStore,{stamp:string;plan:ReturnType<typeof buildResolution>}>();
/** One host-only immutable-by-contract plan per store; pagination never recomputes all proofs. */
export function resolvePdfMemory(store:MemoryStore){const stamp=JSON.stringify([store.revision,store.pdfEpoch,store.pdfCorpus.fingerprint,store.readEntries().length]);const previous=plans.get(store);if(previous?.stamp===stamp)return previous.plan;const plan=buildResolution(store);plans.set(store,{stamp,plan});return plan;}
/** Atomic propagation only from an existing approved identical bilingual/contextual proof. */
export async function approveVerifiedPdf(store:MemoryStore,expectedHash:string){await store.refreshPdf();const plan=resolvePdfMemory(store);if(plan.input_hash!==expectedHash)throw new Error('PDF_RESOLUTION_STALE');const ids=plan.auto_approvable;await store.approvePdfBatch(ids,plan.revision);return {approved:ids.length,policy:resolutionPolicy};}
