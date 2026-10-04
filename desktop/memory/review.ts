import { MemoryStore,type ReviewRequest,type MemoryEntry } from './store';
import { memoryConflicts } from './conflicts';
import {resolvePdfMemory,type ResolutionClass} from './pdfResolution';

export type ReviewEntry=MemoryEntry&{original_requested:boolean};
export interface MemoryQuery {query?:string;source?:'ALL'|'PDF';resolution?:'ALL'|ResolutionClass;status?:'ALL'|'CANDIDATE'|'APPROVED'|'REJECTED';offset?:number;limit?:number}
export function listMemory(store:MemoryStore,value:unknown={}) {
  const input=value as MemoryQuery;
  if(input?.source!==undefined&&!['ALL','PDF'].includes(input.source))throw new Error('MEMORY_QUERY_INVALID');
  if(!input||typeof input!=='object'||Array.isArray(input)||input.query!==undefined&&(typeof input.query!=='string'||input.query.length>2000)||input.status!==undefined&&!['ALL','CANDIDATE','APPROVED','REJECTED'].includes(input.status))throw new Error('MEMORY_QUERY_INVALID');
  const offset=input.offset??0,limit=input.limit??50;
  if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>100)throw new Error('MEMORY_QUERY_INVALID');
  const query=(input.query||'').toLowerCase();
  if(input.resolution!==undefined&&!['ALL','VERIFIED','HIGH_CONFIDENCE','AMBIGUOUS','REJECTED'].includes(input.resolution))throw new Error('MEMORY_QUERY_INVALID');
  const plan=input.source==='PDF'?resolvePdfMemory(store):undefined;
  const classifications=new Map(plan?.groups.flatMap(group=>group.variants.map(variant=>[variant.id,variant.classification] as const))||[]);
  const entries=store.readEntries().filter(entry=>(input.source!=='PDF'||entry.pdf)&&(!input.status||input.status==='ALL'||entry.status===input.status)&&(!query||entry.source_text.toLowerCase().includes(query)||entry.translated_text.toLowerCase().includes(query)||entry.module?.toLowerCase().includes(query)||entry.system?.toLowerCase().includes(query)));
  const filtered=entries.filter(e=>!input.resolution||input.resolution==='ALL'||classifications.get(e.id)===input.resolution);
  filtered.sort((a,b)=>b.updated_at.localeCompare(a.updated_at)||a.id.localeCompare(b.id));
  return {revision:store.revision,total:filtered.length,resolution:plan?{counts:plan.counts,groups:plan.groups_total,duplicates:plan.duplicates,input_hash:plan.input_hash,auto_approvable:plan.auto_approvable.length}:undefined,entries:structuredClone(filtered.slice(offset,offset+limit)).map(entry=>({...entry,original_requested:store.originalRequested(entry.source_text,entry.source_language,entry)}))};
}
export function listConflicts(store:MemoryStore){return {revision:store.revision,conflicts:memoryConflicts(store.readEntries())};}
export function validateReview(value:unknown):ReviewRequest {
  const input=value as ReviewRequest;
  if(!input||typeof input!=='object'||typeof input.id!=='string'||!/^[a-f0-9]{64}$/.test(input.id)||!['ACCEPT','EDIT','REJECT','RESTORE','RESOLVE'].includes(input.action)||!Number.isSafeInteger(input.revision)||input.revision!<0||input.action==='EDIT'&&(typeof input.translatedText!=='string'||input.translatedText.length>200000))throw new Error('MEMORY_REVIEW_INVALID');
  return {id:input.id,action:input.action,revision:input.revision,translatedText:input.action==='EDIT'?input.translatedText:undefined};
}
export async function reviewMemory(store:MemoryStore,value:unknown,isBusy:()=>boolean){
  if(isBusy())throw new Error('MEMORY_BUSY');
  return store.review(validateReview(value));
}
