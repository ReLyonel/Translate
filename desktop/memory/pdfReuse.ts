import type {MemoryStore,MemoryContext,MemoryEntry} from './store';
import {pdfText,pdfExactText,pdfHash,pdfRulesVersion,type PdfEvidence} from './pdfCorpus';
import {reusable} from '../translation/reuse';
import {ProtectedContentEngine as P} from '../../src/services/protected-content/protectedContentEngine';
import {pdfReferenceStatistics} from './pdfReference';

export const pdfField=(context:MemoryContext)=>context.field_type==='name'||context.json_path?.at(-1)==='name'?'name':/(?:^|\.)(?:description|summary|content|text)(?:\.|$)/.test(context.field_type||'')?'description':null;
export type PdfDiagnostic=Pick<PdfEvidence,'edition'|'source'|'target'|'kind'|'edited'>;
export const pdfDiagnostic=(entry:MemoryEntry):PdfDiagnostic|undefined=>{const pointer=(p:PdfEvidence['source'])=>({document:p.document,segment:p.segment,page:p.page,text_hash:p.text_hash});return entry.pdf?{edition:entry.pdf.edition,source:pointer(entry.pdf.source),target:pointer(entry.pdf.target),kind:entry.pdf.kind,edited:entry.pdf.edited}:undefined;};
const stopWords=new Set(['the','a','an','of','to','and','or','in','on','for','with','is','you','your','this','that']);
const words=(text:string)=>new Set((text.toLowerCase().match(/\p{L}+/gu)||[]).filter(word=>!stopWords.has(word)));
const safePair=(entry:MemoryEntry)=>{try{return reusable(entry.source_text,entry.translated_text,entry);}catch{return false;}};
function referenceNote(entry:MemoryEntry){
  if(P.protect(entry.source_text).tokens.size||P.protect(entry.translated_text).tokens.size)return undefined;
  const pair='SRD 5.2.1 reference: '+JSON.stringify([entry.source_text,entry.translated_text]);if(Buffer.byteLength(pair,'utf8')<=200)return pair;
  // Full Spanish sentences only: never cut a decimal, word, formula or a JSON pair.
  for(const sentence of entry.translated_text.split(/(?<=[.!?])\s+(?=[\p{Lu}¿¡])/u)){if(!/[.!?]$/.test(sentence.trim()))continue;const note='SRD 5.2.1 ES reference: '+JSON.stringify(sentence.trim());if(Buffer.byteLength(note,'utf8')<=200)return note;}
  return undefined;
}

/** Approved alignments only. A fuzzy match is context and never an automatic replacement. */
export class PdfReuse {
  readonly spanishAuthority={provenance:'SRD_ES',authority:'AUTHORITATIVE_REFERENCE',scope:'PROVEN_SRD_DOCUMENT_AND_FIELD_ONLY'} as const;
  private stamp='';private entries:MemoryEntry[]=[];
  private exacts=new Map<string,MemoryEntry[]>();private bindings=new Map<string,MemoryEntry[]>();
  private activeIds=new Set<string>();
  private contexts=new Map<string,{entry:MemoryEntry;words:Set<string>;note:string}[]>();
  constructor(readonly store:MemoryStore){}
  private refresh(){
    const stamp=this.store.revision+':'+this.store.pdfEpoch+':'+this.store.pdfCorpus.fingerprint;if(stamp===this.stamp)return;
    this.stamp=stamp;this.entries=this.store.readEntries().filter(entry=>entry.pdf&&entry.system==='dnd5e'&&entry.source_language==='en'&&this.store.pdfCorpus.evidence(entry.pdf,entry.source_text,entry.translated_text));
    this.exacts.clear();this.bindings.clear();
    this.activeIds=new Set(this.entries.filter(entry=>entry.approved&&entry.status==='APPROVED'&&entry.rules_version===pdfRulesVersion&&!this.store.originalRequested(entry.source_text,'en',entry)&&!this.store.rejected(entry.source_text,entry.translated_text,'en',entry)&&safePair(entry)).map(entry=>entry.id));
    for(const entry of this.entries){
      if(entry.pdf!.binding){const key=JSON.stringify([entry.canonical_uuid,entry.canonical_version,entry.json_path,entry.module,entry.system,entry.document_type,entry.field_type,entry.pdf!.binding.source_hash]);const rows=this.bindings.get(key)||[];rows.push(entry);this.bindings.set(key,rows);}
      else {const key=entry.field_type+':'+pdfText(entry.source_text);const rows=this.exacts.get(key)||[];rows.push(entry);this.exacts.set(key,rows);}
    }
    this.contexts.clear();for(const rows of this.exacts.values()){
      const active=rows.filter(row=>this.active(row));if(new Set(active.map(row=>row.translated_text)).size!==1)continue;
      const entry=active[0];if(P.protect(entry.source_text).tokens.size||P.protect(entry.translated_text).tokens.size)continue;
      const note=referenceNote(entry);if(!note)continue;
      const field=entry.field_type!,values=this.contexts.get(field)||[];values.push({entry,words:words(entry.source_text),note});this.contexts.set(field,values);
    }
  }
  private active(entry:MemoryEntry){return this.activeIds.has(entry.id);}
  private compatible(context:MemoryContext){return context.system==='dnd5e'&&context.document_type!=='Script'&&Boolean(pdfField(context));}
  private bound(source:string,context:MemoryContext){return JSON.stringify([context.canonical_uuid,context.canonical_version,context.json_path,context.module,context.system,context.document_type,context.field_type,pdfHash(source)]);}
  private unique(rows:MemoryEntry[]){const active=rows.filter(row=>this.active(row));return new Set(active.map(row=>row.translated_text)).size===1?active[0]:undefined;}
  exact(source:string,language:string,context:MemoryContext){this.refresh();return language==='en'&&this.compatible(context)?this.unique(this.exacts.get(pdfField(context)+':'+pdfExactText(source))||[]):undefined;}
  canonical(source:string,context:MemoryContext){this.refresh();if(!this.compatible(context)||!context.canonical_uuid||!context.canonical_version||!context.json_path)return undefined;const rows=this.bindings.get(this.bound(source,context))||[];return this.unique(rows)?rows.find(row=>this.active(row)&&row.pdf!.binding!.usage!=='CONTEXT_ONLY'):undefined;}
  original(source:string,language:string,context:MemoryContext){this.refresh();if(!this.compatible(context))return false;const rows=[...(this.bindings.get(this.bound(source,context))||[]),...(language==='en'?this.exacts.get(pdfField(context)+':'+pdfExactText(source))||[]:[])];return rows.some(row=>this.store.originalRequested(row.source_text,'en',row));}
  reviewCandidates(source:string,language:string,context:MemoryContext){this.refresh();if(!this.compatible(context))return 0;return (language==='en'?this.exacts.get(pdfField(context)+':'+pdfExactText(source))||[]:this.bindings.get(this.bound(source,context))||[]).filter(row=>row.status==='CANDIDATE').length;}
  context(source:string,language:string,context:MemoryContext){
    this.refresh();if(!this.compatible(context))return undefined;
    const linked=this.bindings.get(this.bound(source,context))||[],active=linked.filter(row=>this.active(row));
    if(new Set(active.map(row=>row.translated_text)).size>1)return undefined;
    const bound=this.unique(linked);if(bound){const note=referenceNote(bound);if(note)return {entry:bound,note};}
    if(language!=='en')return undefined;
    const a=words(P.protect(source).protectedText.replace(/\[\[PROTECTED_\d+\]\]/g,' '));if(a.size<3)return undefined;
    const matches=(this.contexts.get(pdfField(context)!)||[]).map(row=>{const b=row.words,common=[...a].filter(word=>b.has(word)).length;return {...row,common,score:common/Math.max(1,new Set([...a,...b]).size)};}).filter(row=>row.common>=3&&row.score>=.5).sort((a,b)=>b.score-a.score||a.entry.id.localeCompare(b.entry.id));
    // One complete reference. No partial JSON or raw technical tokens in model context.
    if(matches.length)return {entry:matches[0].entry,note:matches[0].note};
    return undefined;
  }
  statistics(){this.refresh();const generic=this.entries.filter(entry=>!entry.pdf!.binding);const groups=new Map<string,Set<string>>();for(const entry of generic.filter(row=>this.active(row))){const key=entry.field_type+':'+pdfText(entry.source_text);const values=groups.get(key)||new Set<string>();values.add(entry.translated_text);groups.set(key,values);}return {spanish_authority:this.spanishAuthority,alignment_entries:this.entries.length,approved_alignments:this.entries.filter(row=>this.active(row)).length,candidate_alignments:this.entries.filter(row=>row.status==='CANDIDATE').length,conflicting_approved_alignments:[...groups.values()].filter(set=>set.size>1).length,conflicting_canonical_bindings:[...this.bindings.values()].filter(rows=>new Set(rows.filter(row=>this.active(row)).map(row=>row.translated_text)).size>1).length,canonical_bindings:this.entries.filter(row=>row.pdf!.binding&&this.active(row)).length,reference_fingerprint:this.store.pdfCorpus.fingerprint,warning:this.store.pdfCorpus.warning};}
  async reportStatistics(){
    const stats=this.statistics();
    try{return {...await pdfReferenceStatistics(this.store.directory),...stats,approved_translation_pairs:stats.approved_alignments};}
    catch{return {loaded:false,verified_documents:0,documents_by_language:{} as Record<string,number>,pages:0,segments:0,approved_translation_pairs:0,policy:'VERIFIED_REFERENCE_ALIGNMENT_REQUIRED',...this.statistics(),warning:this.store.pdfCorpus.warning||'PDF_REFERENCE_INVALID'};}
  }
}
