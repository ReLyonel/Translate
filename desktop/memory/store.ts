import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID,createHash } from 'node:crypto';
import { ProtectedContentEngine as Protection } from '../../src/services/protected-content/protectedContentEngine';
import { validateQuality } from '../translation/quality';
import { parseJsonStrict } from '../../src/services/json/strictJson';
import { validateHtmlIntegrity } from '../../src/services/validation/htmlIntegrity';
import {PdfCorpus,validPdfEvidence,pdfRulesVersion,type PdfEvidence} from './pdfCorpus';
import {canonicalEvidence,validCanonicalEvidence,evidenceMatches,evidenceIntegrity,type CanonicalEvidence} from './canonicalEvidence';
import {historicalContextMatches,historicalEntryId,historicalPolicy,validHistoricalSource,validTrustedCorpus,type HistoricalSource,type TrustedHistoricalCorpus} from './historicalTrust';
export interface CacheIdentity {schema_version:1;key:string;source_hash:string;source_language:string;target_language:'es';context_hash:string;provider:string;model:string;prompt_version:string;glossary_hash:string;rules_version:string;review_revision:number;pdf_fingerprint:string|null}
export interface CacheRecord {value:string;created_at:string;identity?:CacheIdentity}
export function validCacheIdentity(v:CacheIdentity){return v?.schema_version===1&&v.target_language==='es'&&['key','source_hash','context_hash','glossary_hash'].every(k=>typeof (v as any)[k]==='string'&&/^[a-f0-9]{64}$/.test((v as any)[k]))&&['source_language','provider','model','prompt_version','rules_version'].every(k=>typeof (v as any)[k]==='string')&&Number.isSafeInteger(v.review_revision)&&v.review_revision>=0&&(v.pdf_fingerprint===null||typeof v.pdf_fingerprint==='string');}
export type MemoryContext={pack?:string;pdf?:PdfEvidence;canonical_uuid?:string;canonical_version?:string;system?:string;module?:string;document_type?:string;field_type?:string;surrounding_context_hash?:string;surrounding_context?:string;json_path?:(string|number)[]};
export type ReviewAction='ACCEPT'|'EDIT'|'REJECT'|'RESTORE'|'RESOLVE';
export interface ReviewRequest {id:string;action:ReviewAction;translatedText?:string;revision?:number}
export interface MemoryEntry extends MemoryContext {historical?:HistoricalSource;reuse_scope?:'EXACT_SOURCE_ONLY';source_evidence?:{format:'NATIVE_PACK'|'HISTORICAL_BABELE';file:string;sha256:string;approved_by:string;approved_at:string};canonical_evidence?:CanonicalEvidence; feedback?:{action:ReviewAction;at:string;revision:number;previous_id?:string}; id:string;source_text:string;translated_text:string;source_language:string;target_language:'es';approved:boolean;status:'CANDIDATE'|'APPROVED'|'REJECTED';times_used:number;created_at:string;updated_at:string;translation_engine:string;model:string;rules_version:string }
export interface GlossaryTerm {source:string;target:string;system?:string;module?:string;version:string}
export const hashKey=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const compatible=(a:MemoryContext,b:MemoryContext)=>['canonical_uuid','canonical_version','system','module','document_type','field_type','surrounding_context_hash'].every(key=>(a as any)[key]===(b as any)[key]);
export function contextData(context:MemoryContext):MemoryContext {
  const result:MemoryContext={};
  for(const key of ['pack','canonical_uuid','canonical_version','system','module','document_type','field_type','surrounding_context_hash','surrounding_context'] as const)if(typeof context[key]==='string')result[key]=context[key];
  if(context.json_path&&Array.isArray(context.json_path)&&context.json_path.every(key=>typeof key==='string'||Number.isSafeInteger(key)))result.json_path=[...context.json_path];
  if(context.pdf){if(!validPdfEvidence(context.pdf))throw new Error('PDF_ALIGNMENT_INVALID');result.pdf=structuredClone(context.pdf);}
  return result;
}
export class MemoryStore {
  pdfCorpus=new PdfCorpus();pdfEpoch=0;
  async refreshPdf(){this.pdfCorpus=await new PdfCorpus().load(this.directory);}
  private mutations=Promise.resolve();
  private state:{legacy_cache?:Record<string,CacheRecord>;trusted_corpora?:Record<string,TrustedHistoricalCorpus>;original_choices?:Record<string,{restore:boolean;revision:number}>;review_revision?:number;version:1;entries:MemoryEntry[];cache:Record<string,CacheRecord>;glossary:GlossaryTerm[]}={version:1,entries:[],cache:{},glossary:[]};
  private queue=Promise.resolve();
  constructor(readonly directory:string){}
  async load(){await fs.mkdir(this.directory,{recursive:true});if(await fs.realpath(this.directory)!==this.directory)throw new Error('MEMORY_PATH_INVALID');try{const file=path.join(this.directory,'store.json');if((await fs.lstat(file)).isSymbolicLink())throw new Error('MEMORY_PATH_INVALID');const value=parseJsonStrict(await fs.readFile(file,'utf8'));if(value.review_revision!==undefined&&(!Number.isSafeInteger(value.review_revision)||value.review_revision<0))throw new Error('MEMORY_SCHEMA_INVALID');if(value.version!==1 || !Array.isArray(value.entries)||!Array.isArray(value.glossary)||!value.cache||typeof value.cache!=='object'||Array.isArray(value.cache))throw new Error('MEMORY_SCHEMA_INVALID');const ids=new Set<string>();for(const entry of value.entries){if(entry?.feedback&&(!['ACCEPT','EDIT','REJECT','RESTORE','RESOLVE'].includes(entry.feedback.action)||!Number.isSafeInteger(entry.feedback.revision)||entry.feedback.revision<1||entry.feedback.revision>(value.review_revision||0)||typeof entry.feedback.at!=='string'))throw new Error('MEMORY_SCHEMA_INVALID');if(!entry||['id','source_text','translated_text','source_language','created_at','updated_at','translation_engine','model','rules_version'].some(key=>typeof entry[key]!=='string')||entry.target_language!=='es'||!['CANDIDATE','APPROVED','REJECTED'].includes(entry.status)||entry.approved!==(entry.status==='APPROVED')||!Number.isSafeInteger(entry.times_used)||entry.times_used<0||ids.has(entry.id)||(entry.pdf!==undefined&&!validPdfEvidence(entry.pdf))||(entry.canonical_evidence!==undefined&&!evidenceIntegrity(entry))||['canonical_uuid','canonical_version','system','module','document_type','field_type','surrounding_context_hash','surrounding_context'].some(key=>entry[key]!==undefined&&typeof entry[key]!=='string')||(entry.json_path!==undefined&&(!Array.isArray(entry.json_path)||entry.json_path.some((key:any)=>typeof key!=='string'&&typeof key!=='number'))))throw new Error('MEMORY_SCHEMA_INVALID');ids.add(entry.id);}for(const cached of Object.values(value.cache) as any[]){if(!cached||typeof cached.value!=='string'||typeof cached.created_at!=='string')throw new Error('MEMORY_SCHEMA_INVALID');}for(const term of value.glossary){if(!term||typeof term.source!=='string'||typeof term.target!=='string'||typeof term.version!=='string'||!term.source.trim()||!term.target.trim())throw new Error('MEMORY_SCHEMA_INVALID');}if(value.original_choices!==undefined&&(typeof value.original_choices!=='object'||value.original_choices===null||Array.isArray(value.original_choices)||Object.entries(value.original_choices).some(([key,choice]:[string,any])=>!/^[a-f0-9]{64}$/.test(key)||!choice||typeof choice.restore!=='boolean'||!Number.isSafeInteger(choice.revision)||choice.revision<0||choice.revision>(value.review_revision||0))))throw new Error('MEMORY_SCHEMA_INVALID');for(const e of value.entries as MemoryEntry[]){if(e.reuse_scope!==undefined&&e.reuse_scope!=='EXACT_SOURCE_ONLY'||e.source_evidence&&(!['NATIVE_PACK','HISTORICAL_BABELE'].includes(e.source_evidence.format)||typeof e.source_evidence.file!=='string'||!/^[a-f0-9]{64}$/.test(e.source_evidence.sha256)||typeof e.source_evidence.approved_by!=='string'||!Number.isFinite(Date.parse(e.source_evidence.approved_at))))throw new Error('MEMORY_SOURCE_EVIDENCE_INVALID');}for(const [key,cached] of Object.entries(value.cache) as [string,CacheRecord][]){if(cached.identity&&(!validCacheIdentity(cached.identity)||cached.identity.key!==key))throw new Error('CACHE_SCHEMA_INVALID');}if(value.legacy_cache&&(typeof value.legacy_cache!=='object'||Array.isArray(value.legacy_cache)||Object.values(value.legacy_cache).some((r:any)=>!r||r.identity||typeof r.value!=='string'||typeof r.created_at!=='string')))throw new Error('LEGACY_CACHE_INVALID');if(value.trusted_corpora&&(typeof value.trusted_corpora!=='object'||Array.isArray(value.trusted_corpora)||Object.entries(value.trusted_corpora).some(([id,c]:[string,any])=>!validTrustedCorpus(c)||c.id!==id)))throw new Error('TRUSTED_CORPUS_INVALID');for(const e of value.entries as MemoryEntry[])if(e.historical&&(!validHistoricalSource(e.historical)||e.reuse_scope!=='EXACT_SOURCE_ONLY'||e.canonical_uuid||e.canonical_evidence||!value.trusted_corpora?.[e.historical.source_corpus]||value.trusted_corpora[e.historical.source_corpus].files[e.historical.source_file]!==e.historical.source_file_hash||e.approved&&e.historical.translation_approval!=='APPROVED_MANUAL'))throw new Error('HISTORICAL_MEMORY_INVALID');this.state=value;}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}this.pdfEpoch=this.state.entries.some(entry=>entry.pdf)?1:0;await this.refreshPdf();return this;}
  private persist(){const snapshot=JSON.stringify(this.state);const write=async()=>{const temporary=path.join(this.directory,randomUUID()+'.tmp');let committed=false;try{const handle=await fs.open(temporary,'wx');try{await handle.writeFile(snapshot);await handle.sync();}finally{await handle.close();}await fs.rename(temporary,path.join(this.directory,'store.json'));committed=true;}finally{if(!committed)await fs.rm(temporary,{force:true});}};const next=this.queue.then(write);this.queue=next.catch(()=>{});return next;}
  entries(){return structuredClone(this.state.entries);}
  /** Host-only immutable-by-contract view; IPC services clone only returned pages. */
  readEntries():readonly MemoryEntry[]{return this.state.entries;}
  statistics(){return {memory_database_loaded:true,memory_entries_total:this.state.entries.length,approved_entries:this.state.entries.filter(e=>e.approved).length,entries_by_language_pair:Object.fromEntries([...new Set(this.state.entries.map(e=>e.source_language+'->'+e.target_language))].map(pair=>[pair,this.state.entries.filter(e=>e.source_language+'->'+e.target_language===pair).length])),glossary_entries:this.state.glossary.length,cache_entries:Object.keys(this.state.cache).length+Object.keys(this.state.legacy_cache||{}).length,legacy_cache_unverified:Object.keys(this.readLegacyCache()).length};}
  canonical(context:MemoryContext){if(!context.canonical_uuid||!context.canonical_version||!context.system||!context.json_path)return undefined;const entries=this.state.entries.filter(e=>!e.pdf&&!e.historical&&e.reuse_scope!=='EXACT_SOURCE_ONLY'&&e.approved&&evidenceMatches(e)&&e.rules_version===Protection.rulesVersion&&e.canonical_uuid===context.canonical_uuid&&e.canonical_version===context.canonical_version&&e.system===context.system&&e.document_type===context.document_type&&JSON.stringify(e.json_path)===JSON.stringify(context.json_path));return new Set(entries.map(e=>e.translated_text)).size===1?structuredClone(entries[0]):undefined;}
  exact(source:string,language:string,context:MemoryContext){const lookup=this.historicalLookup(source,language,context);if(lookup.reason==='TM_CONFLICT')return undefined;const entries=this.state.entries.filter(entry=>!entry.pdf&&!entry.historical&&entry.approved&&entry.status==='APPROVED'&&entry.source_text===source&&entry.source_language===language&&entry.target_language==='es'&&entry.rules_version===Protection.rulesVersion&&compatible(entry,context));if(lookup.entry)entries.push(lookup.entry);return new Set(entries.map(entry=>entry.translated_text)).size===1?structuredClone(entries[0]):undefined;}
  fuzzy(source:string,language:string,context:MemoryContext,limit=3){const words=(text:string)=>new Set((text.toLowerCase().match(/\p{L}+/gu)||[]));const a=words(source);const eligible=this.state.entries.filter(entry=>!entry.pdf&&!entry.historical&&entry.approved&&entry.status==='APPROVED'&&entry.source_language===language&&entry.rules_version===Protection.rulesVersion&&compatible(entry,context)&&entry.source_text!==source);const alternatives=new Map<string,Set<string>>();for(const entry of eligible){const values=alternatives.get(entry.source_text)||new Set<string>();values.add(entry.translated_text);alternatives.set(entry.source_text,values);}return eligible.filter(entry=>alternatives.get(entry.source_text)?.size===1).map(entry=>{const b=words(entry.source_text);const common=[...a].filter(word=>b.has(word)).length;return {entry,common,score:common/Math.max(1,new Set([...a,...b]).size)};}).filter(item=>item.common>=3&&item.score>=.5).sort((a,b)=>b.score-a.score).slice(0,Math.min(limit,3)).map(item=>structuredClone(item.entry));}
  get revision(){return this.state.review_revision||0;}
  trustedCorpora(){return structuredClone(this.state.trusted_corpora||{});}
  private historicalStamp='';private historicalIndex=new Map<string,MemoryEntry[]>();
  historicalLookup(source:string,language:string,context:MemoryContext){
    const stamp=this.revision+':'+this.state.entries.length;if(stamp!==this.historicalStamp){this.historicalIndex.clear();for(const e of this.state.entries)if(e.historical){const key=e.source_language+':'+e.source_text,rows=this.historicalIndex.get(key)||[];rows.push(e);this.historicalIndex.set(key,rows);}this.historicalStamp=stamp;}
    const rows=this.historicalIndex.get(language+':'+source)||[],scoped=rows.filter(e=>historicalContextMatches(e,context)&&e.status!=='REJECTED');
    const result={candidates:rows.length,compatible:scoped.length,entry:undefined as MemoryEntry|undefined,decision:'CONTEXT_REQUIRED' as 'SAFE_EXACT'|'CONTEXT_REQUIRED'|'CONFLICT',reason:'TM_CONTEXT_MISMATCH'};
    if(!rows.length)return {...result,reason:'TM_SOURCE_NOT_FOUND'};
    if(scoped.some(e=>e.historical!.reuse_policy==='CONFLICT')||new Set(scoped.map(e=>e.translated_text)).size>1)return {...result,decision:'CONFLICT' as const,reason:'TM_CONFLICT'};
    const eligible=scoped.filter(e=>e.approved&&e.historical!.translation_approval==='APPROVED_MANUAL'&&e.rules_version===Protection.rulesVersion&&e.historical!.source_binding!=='NATIVE_FIELD_PROJECTION');
    if(!eligible.length)return {...result,reason:scoped.some(e=>e.historical!.source_binding==='NATIVE_FIELD_PROJECTION')?'TM_SOURCE_BINDING_UNVERIFIED':scoped.length?'TM_NOT_APPROVED':'TM_CONTEXT_MISMATCH'};
    return {...result,entry:eligible[0],decision:'SAFE_EXACT' as const,reason:'TM_EXACT_APPROVED'};
  }
  /** Atomic corpus declaration and textual TM import. Never creates canonical identity. */
  async importTrustedHistorical(corpus:TrustedHistoricalCorpus,rows:{source:string;target:string;historical:HistoricalSource}[],revision:number){
    if(!validTrustedCorpus(corpus))throw new Error('TRUSTED_CORPUS_INVALID');
    const previous=this.state.trusted_corpora?.[corpus.id];if(previous&&previous.fingerprint!==corpus.fingerprint)throw new Error('TRUSTED_SOURCE_CHANGED');
    const prepared=rows.map(row=>{
      const h=structuredClone(row.historical);if(!validHistoricalSource(h)||h.source_corpus!==corpus.id||corpus.files[h.source_file]!==h.source_file_hash||!/[\u0400-\u04ff]/.test(row.source))throw new Error('HISTORICAL_MEMORY_INVALID');
      const context:MemoryContext={system:h.context.system,module:h.context.module,pack:h.context.pack,document_type:h.context.document_type,field_type:h.context.field_type,json_path:h.context.field_path,surrounding_context_hash:h.context.surrounding_context_hash};
      const now=previous?.approved_at||corpus.approved_at,approved=h.reuse_policy!=='CONFLICT';h.translation_approval=approved?'APPROVED_MANUAL':'REVIEW_REQUIRED';
      const entry:MemoryEntry={...context,id:historicalEntryId(row.source,row.target,h.context,corpus.id),historical:h,reuse_scope:'EXACT_SOURCE_ONLY',source_text:row.source,translated_text:row.target,source_language:'ru',target_language:'es',approved,status:approved?'APPROVED':'CANDIDATE',times_used:0,created_at:now,updated_at:now,translation_engine:'manual-historical-babele',model:'',rules_version:Protection.rulesVersion};this.validTranslation(entry,row.target);return entry;
    });
    const ids=new Set(this.state.entries.map(e=>e.id)),fresh=prepared.filter(e=>!ids.has(e.id)&&!!ids.add(e.id));
    if(previous&&!fresh.length){if(revision!==this.revision)throw new Error('MEMORY_REVISION_CONFLICT');return {created:0,unchanged:prepared.length,approved_created:0,revision:this.revision};}
    return this.transaction(()=>{if(revision!==this.revision)throw new Error('MEMORY_REVISION_CONFLICT');this.state.trusted_corpora={...this.state.trusted_corpora,[corpus.id]:previous||structuredClone(corpus)};const existing=new Set(this.state.entries.map(e=>e.id)),committed=fresh.filter(e=>!existing.has(e.id));this.state.entries.push(...committed);this.state.review_revision=this.revision+1;return {created:committed.length,unchanged:prepared.length-committed.length,approved_created:committed.filter(e=>e.approved).length,revision:this.revision};});
  }
  private invalidateCurrentCache(){this.state.cache=Object.fromEntries(Object.entries(this.state.cache).filter(([,row])=>!row.identity));}
  private transaction<T>(mutate:()=>T):Promise<T>{
    const next=this.mutations.then(async()=>{
      const before=structuredClone(this.state);
      try{const result=mutate();await this.persist();return result;}catch(error){this.state=before;throw error;}
    });
    this.mutations=next.then(()=>{},()=>{});return next;
  }
  private validTranslation(entry:MemoryEntry,target:string){
    if(entry.pdf?.binding&&(!/^Compendium\.[-\w]+\.[-\w]+\.(Actor|Item|JournalEntry|RollTable|Scene|Macro|Cards|Playlist|Adventure)\.\w{16}$/.test(entry.canonical_uuid||'')||!entry.canonical_version||!entry.module||!entry.document_type||!entry.field_type||!entry.json_path?.length||entry.pdf.binding.source_text===undefined))throw new Error('PDF_BINDING_UNVERIFIED');
    if(entry.pdf&&!this.pdfCorpus.evidence({...entry.pdf,edited:entry.pdf.edited||target!==entry.translated_text},entry.source_text,target))throw new Error('PDF_ALIGNMENT_EVIDENCE_INVALID');
    const a=Protection.protect(entry.source_text),b=Protection.protect(target);
    if(validateQuality(entry.source_text,target).status!=='PASS'||(entry.document_type!=='Script'&&validateHtmlIntegrity(entry.source_text,target).length)||JSON.stringify([...a.tokens.values()].map(token=>[token.type,token.original]))!==JSON.stringify([...b.tokens.values()].map(token=>[token.type,token.original])))throw new Error('MEMORY_APPROVAL_INVALID');
  }
  async candidate(source:string,target:string,language:string,context:MemoryContext,engine:string,model:string){
    return (await this.candidateBatch([{source,target,language,context,engine,model}]))[0];
  }
  async candidateBatch(values:{source:string;target:string;language:string;context:MemoryContext;engine:string;model:string;reuseScope?:'EXACT_SOURCE_ONLY';sourceEvidence?:MemoryEntry['source_evidence']}[]){
    if(!values.length)return [];
    const result=await this.transaction(()=>{
      const existingIds=values.length>1||values.some(value=>value.context.pdf)?new Map(this.state.entries.map(entry=>[entry.id,entry])):new Map<string,MemoryEntry>();
      const results:string[]=[];
      for(const {source,target,language,context,engine,model,reuseScope,sourceEvidence} of values){
      const identity=[source,target,language,context.system,context.module,context.document_type,context.field_type,context.surrounding_context_hash,context.canonical_uuid,context.canonical_version,context.canonical_uuid?context.json_path:undefined,Protection.rulesVersion];
      const scopedIdentity=reuseScope?[...identity,reuseScope]:identity;const id=hashKey(context.pdf?[...scopedIdentity,context.pdf]:scopedIdentity);
      const existing=existingIds.get(id)||(!context.pdf&&this.state.entries.find(entry=>!entry.pdf&&entry.reuse_scope===reuseScope&&entry.source_text===source&&entry.translated_text===target&&entry.source_language===language&&entry.rules_version===Protection.rulesVersion&&compatible(entry,context)&&(!context.canonical_uuid||JSON.stringify(entry.json_path)===JSON.stringify(context.json_path))));if(existing){results.push(existing.id);continue;}
      const now=new Date().toISOString();const entry:MemoryEntry={...contextData(context),...(reuseScope?{reuse_scope:reuseScope}:{}),...(sourceEvidence?{source_evidence:structuredClone(sourceEvidence)}:{}),id,source_text:source,translated_text:target,source_language:language,target_language:'es',status:'CANDIDATE',approved:false,times_used:0,created_at:now,updated_at:now,translation_engine:engine,model,rules_version:context.pdf?pdfRulesVersion:Protection.rulesVersion};entry.canonical_evidence=entry.reuse_scope==='EXACT_SOURCE_ONLY'?undefined:canonicalEvidence(entry);this.state.entries.push(entry);existingIds.set(id,entry);results.push(id);
      }return results;
    });
    if(values.some(value=>value.context.pdf))this.pdfEpoch++;return result;
  }
  async approvePdfBatch(ids:string[],revision:number){
    if(!ids.length)return;
    await this.refreshPdf();
    return this.transaction(()=>{
      if(revision!==this.revision||ids.length>10000||new Set(ids).size!==ids.length)throw new Error('MEMORY_REVISION_CONFLICT');
      const entries=ids.map(id=>this.state.entries.find(e=>e.id===id));
      if(entries.some(e=>!e?.pdf||e.status!=='CANDIDATE'))throw new Error('PDF_RESOLUTION_INVALID');
      for(const e of entries)this.validTranslation(e!,e!.translated_text);
      const now=new Date().toISOString(),next=this.revision+1;
      for(const e of entries){e!.approved=true;e!.status='APPROVED';e!.rules_version=pdfRulesVersion;e!.updated_at=now;e!.feedback={action:'ACCEPT',at:now,revision:next};e!.canonical_evidence=e!.reuse_scope==='EXACT_SOURCE_ONLY'?undefined:canonicalEvidence(e!,now);if(e!.canonical_evidence){e!.canonical_evidence!.approved_by='VERIFIED_EVIDENCE_PROPAGATION';e!.canonical_evidence!.match_type='PDF_REFERENCE';}}
      this.state.review_revision=next;this.invalidateCurrentCache();
    });
  }
  async review(request:ReviewRequest){
    if(this.state.entries.find(entry=>entry.id===request.id)?.pdf&&['ACCEPT','RESOLVE','EDIT'].includes(request.action))await this.refreshPdf();
    return this.transaction(()=>{
      if(request.revision!==undefined&&request.revision!==this.revision)throw new Error('MEMORY_REVISION_CONFLICT');
      const entry=this.state.entries.find(item=>item.id===request.id);if(!entry)throw new Error('MEMORY_ENTRY_UNKNOWN');
      if(!['ACCEPT','EDIT','REJECT','RESTORE','RESOLVE'].includes(request.action))throw new Error('MEMORY_REVIEW_INVALID');
      const now=new Date().toISOString(),revision=this.revision+1;
      const feedback={action:request.action,at:now,revision};let result=entry;
      const choiceKey=this.choiceKey(entry.source_text,entry.source_language,entry);
      this.state.original_choices||={};
      if(!Object.hasOwn(this.state.original_choices,choiceKey)&&this.originalRequested(entry.source_text,entry.source_language,entry))this.state.original_choices[choiceKey]={restore:true,revision:this.revision};
      if(request.action==='ACCEPT'||request.action==='RESOLVE'){
        this.validTranslation(entry,entry.translated_text);
        entry.status='APPROVED';entry.approved=true;entry.rules_version=entry.pdf?pdfRulesVersion:Protection.rulesVersion;
        if(request.action==='RESOLVE')for(const alternative of this.state.entries){
          const sameSource=entry.pdf?.binding?alternative.pdf?.binding?.source_hash===entry.pdf.binding.source_hash&&JSON.stringify(alternative.json_path)===JSON.stringify(entry.json_path):alternative.source_text===entry.source_text;
          if(alternative.id!==entry.id&&sameSource&&alternative.source_language===entry.source_language&&(alternative.historical&&entry.historical?JSON.stringify(alternative.historical.context)===JSON.stringify(entry.historical.context):compatible(alternative,entry))){
            alternative.status='REJECTED';alternative.approved=false;alternative.updated_at=now;alternative.feedback={...feedback};if(alternative.historical)alternative.historical={...alternative.historical,translation_approval:'REVIEW_REQUIRED'};alternative.canonical_evidence=alternative.reuse_scope==='EXACT_SOURCE_ONLY'?undefined:canonicalEvidence(alternative,now);
          }
        }
      }else if(request.action==='EDIT'){
        if(typeof request.translatedText!=='string'||request.translatedText.length>200000)throw new Error('MEMORY_REVIEW_INVALID');
        this.validTranslation(entry,request.translatedText);
        const identity=[entry.source_text,request.translatedText,entry.source_language,entry.system,entry.module,entry.document_type,entry.field_type,entry.surrounding_context_hash,entry.canonical_uuid,entry.canonical_version,entry.canonical_uuid?entry.json_path:undefined,Protection.rulesVersion];
        const pdf=entry.pdf?{...entry.pdf,edited:true}:undefined;
        const scopedIdentity=entry.reuse_scope?[...identity,entry.reuse_scope]:identity;
        const id=entry.historical?historicalEntryId(entry.source_text,request.translatedText,entry.historical.context,entry.historical.source_corpus):hashKey(pdf?[...scopedIdentity,pdf]:scopedIdentity);
        entry.status='REJECTED';entry.approved=false;
        result=this.state.entries.find(item=>item.id===id)||{...entry,...(pdf?{pdf}:{}),id,translated_text:request.translatedText,created_at:now,times_used:0};
        if(!this.state.entries.some(item=>item.id===id))this.state.entries.push(result);
        result.status='CANDIDATE';result.approved=false;result.translation_engine='manual';result.model='manual';result.rules_version=result.pdf?pdfRulesVersion:Protection.rulesVersion;
        result.feedback={...feedback,previous_id:entry.id};result.updated_at=now;
      }else{entry.status='REJECTED';entry.approved=false;}
      for(const changed of new Set([entry,result]))if(changed.historical){changed.historical=structuredClone(changed.historical);changed.historical.translation_approval=changed.approved?'APPROVED_MANUAL':'REVIEW_REQUIRED';if(changed.approved&&['ACCEPT','RESOLVE'].includes(request.action))changed.historical.source_binding='USER_REVIEWED_PAIR';if(changed===result&&request.action==='RESOLVE')changed.historical.reuse_policy=historicalPolicy(changed.source_text);}
      entry.feedback={...feedback};entry.updated_at=now;entry.canonical_evidence=entry.reuse_scope==='EXACT_SOURCE_ONLY'?undefined:canonicalEvidence(entry,now);if(result!==entry)result.canonical_evidence=result.reuse_scope==='EXACT_SOURCE_ONLY'?undefined:canonicalEvidence(result,now);
      if(['ACCEPT','RESOLVE','RESTORE'].includes(request.action))this.state.original_choices[choiceKey]={restore:request.action==='RESTORE',revision};
      this.state.review_revision=revision;this.invalidateCurrentCache();
      return structuredClone(result);
    });
  }
  async approve(id:string){await this.review({id,action:'ACCEPT'});}
  private choiceKey(source:string,language:string,context:MemoryContext){if(context.pdf?.binding)return hashKey(['pdf-binding-choice',context.pdf.binding.source_hash,context.canonical_uuid,context.canonical_version,context.system,context.module,context.document_type,context.field_type,context.json_path]);const identity=[source,language,context.system,context.module,context.document_type,context.field_type,context.surrounding_context_hash];return hashKey(context.canonical_uuid?[...identity,context.canonical_uuid,context.canonical_version,context.json_path]:identity);}
  originalRequested(source:string,language:string,context:MemoryContext){
    const historical=this.state.entries.filter(e=>e.historical&&e.source_text===source&&e.source_language===language&&historicalContextMatches(e,context)&&e.feedback&&['ACCEPT','RESTORE','RESOLVE'].includes(e.feedback.action)).sort((a,b)=>(b.feedback?.revision||0)-(a.feedback?.revision||0));if(historical[0]?.feedback?.action==='RESTORE')return true;
    const key=this.choiceKey(source,language,context);
    if(this.state.original_choices&&Object.hasOwn(this.state.original_choices,key))return this.state.original_choices[key].restore;
    const decisions=this.state.entries.filter(entry=>entry.source_text===source&&entry.source_language===language&&compatible(entry,context)&&entry.feedback&&['ACCEPT','RESTORE','RESOLVE'].includes(entry.feedback.action));
    decisions.sort((a,b)=>(b.feedback?.revision||0)-(a.feedback?.revision||0));
    return decisions[0]?.feedback?.action==='RESTORE';
  }
  rejected(source:string,target:string,language:string,context:MemoryContext){const variants=this.state.entries.filter(entry=>entry.source_text===source&&entry.translated_text===target&&entry.source_language===language&&(entry.historical?historicalContextMatches(entry,context):compatible(entry,context)));const latest=Math.max(0,...variants.map(entry=>entry.feedback?.revision||0));return variants.some(entry=>entry.status==='REJECTED'&&(entry.feedback?.revision||0)===latest)&&!variants.some(entry=>entry.approved&&(entry.feedback?.revision||0)===latest);}
  async used(id:string){await this.usedMany([id]);}
  async usedMany(ids:string[]){if(!ids.length)return;const selected=new Set(ids);await this.transaction(()=>{const now=new Date().toISOString();for(const entry of this.state.entries)if(selected.has(entry.id)){entry.times_used=Math.min(Number.MAX_SAFE_INTEGER,entry.times_used+1);entry.updated_at=now;}});}
  getCache(key:string,expected?:CacheIdentity){const row=this.state.cache[key];return row?.identity&&validCacheIdentity(row.identity)&&row.identity.key===key&&(!expected||Object.entries(expected).every(([field,value])=>(row.identity as any)[field]===value))?row.value:undefined;}
  readCache():Readonly<Record<string,CacheRecord>>{return this.state.cache;}
  readLegacyCache():Readonly<Record<string,CacheRecord>>{return {...Object.fromEntries(Object.entries(this.state.cache).filter(([,row])=>!row.identity)),...this.state.legacy_cache};}
  async cache(key:string,value:string,identity?:CacheIdentity){if(identity&&(!validCacheIdentity(identity)||identity.key!==key))throw new Error('CACHE_SCHEMA_INVALID');await this.transaction(()=>{const previous=this.state.cache[key];if(previous&&!previous.identity){this.state.legacy_cache??={};this.state.legacy_cache[key]??=structuredClone(previous);}this.state.cache[key]={value,created_at:new Date().toISOString(),...(identity?{identity:structuredClone(identity)}:{})};const keys=Object.keys(this.state.cache).filter(key=>this.state.cache[key].identity);for(const obsolete of keys.slice(0,Math.max(0,keys.length-5000)))delete this.state.cache[obsolete];});}
  glossary(context:MemoryContext){return this.state.glossary.filter(term=>(!term.system||term.system===context.system)&&(!term.module||term.module===context.module)).map(term=>({...term}));}
  async setGlossary(terms:GlossaryTerm[]){const keys=new Map<string,string>();for(const term of terms){if(!term.source.trim()||!term.target.trim()||!term.version)throw new Error('GLOSSARY_INVALID');const key=hashKey([term.source.toLowerCase(),term.system,term.module]);if(keys.has(key)&&keys.get(key)!==term.target)throw new Error('GLOSSARY_CONFLICT');keys.set(key,term.target);}await this.transaction(()=>{this.state.glossary=structuredClone(terms);});}
}
