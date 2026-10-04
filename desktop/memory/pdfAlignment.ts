import type {MemoryStore,MemoryEntry} from './store';
import {pdfHash,pdfPointer,pdfRulesVersion,type PdfSegment,type PdfEvidence} from './pdfCorpus';
import {inventory} from '../translation/inventory';
import {reusable} from '../translation/reuse';
import {pdfField} from './pdfReuse';
export interface PdfBindingPreview {token:string;file:string;fields:{id:string;path:(string|number)[];source_excerpt:string;source_text:string;canonical_uuid:string}[]}

const numbers=(text:string)=>JSON.stringify((text.match(/\b\d+(?:[dD]\d+)?\b/g)||[]).sort());
/** Port of the existing page/type/length candidate strategy. Scores are never approval. */
export async function generatePdfAlignments(store:MemoryStore,signal?:AbortSignal){
  await store.refreshPdf();const corpus=store.pdfCorpus;if(corpus.warning)throw new Error(corpus.warning);
  const en=[...corpus.segments.values()].filter(row=>row.language==='en'&&!/-l\d+$/.test(row.id)),es=[...corpus.segments.values()].filter(row=>row.language==='es'&&!/-l\d+$/.test(row.id));
  if(!en.length||!es.length)throw new Error('PDF_SRD_PAIR_UNAVAILABLE');
  const pages=new Map<number,PdfSegment[]>();for(const segment of es){const rows=pages.get(segment.page)||[];rows.push(segment);pages.set(segment.page,rows);}
  const enPages=Math.max(...en.map(row=>row.page)),esPages=Math.max(...es.map(row=>row.page));
  const pending:Parameters<MemoryStore['candidateBatch']>[0]=[];let noMatch=0,invalidCandidates=0;
  let prepared=0;
  for(const source of en){
    signal?.throwIfAborted();if(++prepared%50===0)await new Promise<void>(resolve=>setImmediate(resolve));
    const expected=source.page*esPages/enPages,candidates: {target:PdfSegment;score:number}[]=[];
    for(let page=Math.max(1,Math.round(expected)-3);page<=Math.min(esPages,Math.round(expected)+3);page++)for(const target of pages.get(page)||[]){
      if(source.kind!==target.kind||numbers(source.text)!==numbers(target.text))continue;
      const ratio=target.text.length/Math.max(1,source.text.length);if(ratio<.55||ratio>2.1)continue;
      const score=.5*Math.max(0,1-Math.abs(page-expected)/4)+.3*Math.min(ratio,1/ratio)+.2;
      candidates.push({target,score});
    }
    candidates.sort((a,b)=>b.score-a.score||a.target.id.localeCompare(b.target.id));if(!candidates.length){noMatch++;continue;}
    for(const {target,score} of candidates.slice(0,2)){
      const pdf:PdfEvidence={edition:'srd-5.2.1',source:pdfPointer(source),target:pdfPointer(target),kind:source.kind,method:'STRUCTURAL_CANDIDATE',score};
      try{if(!reusable(source.text,target.text,{document_type:'PDF_SRD'})){invalidCandidates++;continue;}}catch{invalidCandidates++;continue;}
      pending.push({source:source.text,target:target.text,language:'en',context:{system:'dnd5e',module:'srd-5.2.1',document_type:'PDF_SRD',field_type:source.kind==='heading'?'name':'description',pdf},engine:'pdf-srd-alignment',model:''});
    }
  }
  signal?.throwIfAborted();const before=store.readEntries().length;await store.candidateBatch(pending);
  return {schema_version:1,source_segments:en.length,target_segments:es.length,candidate_pairs:pending.length,new_entries:store.readEntries().length-before,no_match:noMatch,invalid_candidates:invalidCandidates,approved_automatically:0,policy:'REVIEW_REQUIRED',reference_fingerprint:corpus.fingerprint};
}
export function searchPdfSegments(store:MemoryStore,query:string,language:'en'|'es'){
  if(typeof query!=='string'||query.trim().length<2||query.length>200||!['en','es'].includes(language))throw new Error('PDF_QUERY_INVALID');
  if(store.pdfCorpus.warning)throw new Error(store.pdfCorpus.warning);
  const needle=query.toLowerCase();return [...store.pdfCorpus.segments.values()].filter(row=>row.language===language&&row.text.toLowerCase().includes(needle)).sort((a,b)=>Number(b.text.toLowerCase()===needle)-Number(a.text.toLowerCase()===needle)||a.text.length-b.text.length||a.id.localeCompare(b.id)).slice(0,30).map(row=>({...row}));
}
export async function createPdfAlignment(store:MemoryStore,sourceId:string,targetId:string){
  await store.refreshPdf();const source=store.pdfCorpus.segments.get(sourceId),target=store.pdfCorpus.segments.get(targetId);
  if(!source||!target||source.language!=='en'||target.language!=='es'||source.kind!==target.kind||!reusable(source.text,target.text,{document_type:'PDF_SRD'}))throw new Error('PDF_ALIGNMENT_INVALID');
  const pdf:PdfEvidence={edition:'srd-5.2.1',source:pdfPointer(source),target:pdfPointer(target),kind:source.kind,method:'MANUAL_ALIGNMENT',score:1};
  const id=await store.candidate(source.text,target.text,'en',{system:'dnd5e',module:'srd-5.2.1',document_type:'PDF_SRD',field_type:source.kind==='heading'?'name':'description',pdf},'pdf-srd-manual-alignment','');return {id,approved_automatically:0,policy:'REVIEW_REQUIRED'};
}

/** Explicit binding creates another candidate; it never approves a guessed Foundry identity. */
export async function bindPdfAlignment(store:MemoryStore,id:string,root:string,file:string,jsonPath:(string|number)[],expectedSourceHash?:string){
  await store.refreshPdf();const entry=store.readEntries().find(row=>row.id===id);
  if(!entry?.pdf||entry.pdf.binding||!entry.approved||entry.rules_version!==pdfRulesVersion||!store.pdfCorpus.evidence(entry.pdf,entry.source_text,entry.translated_text))throw new Error('PDF_ALIGNMENT_NOT_APPROVED');
  const data=await inventory(root),unit=data.units.find(row=>row.file.replaceAll('\\','/')===file.replaceAll('\\','/')&&JSON.stringify(row.context.json_path)===JSON.stringify(jsonPath));
  if(!unit?.context.canonical_uuid||!unit.context.canonical_version||unit.context.system!=='dnd5e'||pdfField(unit.context)!==entry.field_type||unit.source.length>200000)throw new Error('PDF_BINDING_UNVERIFIED');
  if(expectedSourceHash&&pdfHash(unit.source)!==expectedSourceHash)throw new Error('PDF_BINDING_STALE');
  let direct=false;try{direct=reusable(unit.source,entry.translated_text,unit.context);}catch{/* Context can aid IA, never remove the original technical structure. */}
  const pdf:PdfEvidence={...entry.pdf,binding:{source_hash:pdfHash(unit.source),source_excerpt:unit.source.slice(0,600),source_text:unit.source,usage:direct?'EXACT':'CONTEXT_ONLY'}};
  const result=await store.candidate(entry.source_text,entry.translated_text,'en',{...unit.context,pdf},'pdf-srd-binding','');
  return {id:result,approved_automatically:0,policy:'REVIEW_BINDING_REQUIRED',usage:pdf.binding!.usage,canonical_uuid:unit.context.canonical_uuid};
}
