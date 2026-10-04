import {PdfReuse} from '../memory/pdfReuse';
import {sourceLanguage} from '../../src/services/translation/languageDetector';
import {auditReuse} from '../memory/reuseAudit';
import {inventory} from './inventory';import {MemoryStore,hashKey} from '../memory/store';import {reuseKey,reusable,estimatedSourceCalls,cacheIdentity,effectiveTerms} from './reuse';import {semanticChunks,promptVersion,promptLimits} from './prompt';import {ProtectedContentEngine as P} from '../../src/services/protected-content/protectedContentEngine';import {readNvidia} from '../thermal';import type {ProviderSettings} from '../contracts';
export async function modelPlacement(settings:ProviderSettings){
 try{const response=await fetch(settings.endpoint+'/api/ps',{signal:AbortSignal.timeout(3000)});if(!response.ok)throw new Error();const data=await response.json() as any;const model=data.models?.find((m:any)=>m.name===settings.model);if(!model)return {backend:'NOT_LOADED',vram_estimated:null,size:null,size_vram:null};
  const size=typeof model.size==='number'?model.size:null,vram=typeof model.size_vram==='number'?model.size_vram:null;return {backend:size!==null&&vram!==null?(vram===0?'CPU':vram>=size?'GPU':'CPU_GPU'):'UNKNOWN',vram_estimated:vram,size,size_vram:vram,context_length:model.context_length??null};
 }catch{return {backend:'UNKNOWN',vram_estimated:null,size:null,size_vram:null};}
}
export async function translationPreflight(root:string,language:'auto'|'en'|'ru',store:MemoryStore,settings:ProviderSettings,terms:{source:string;target:string}[]=[],signal?:AbortSignal,options:{offline?:boolean}={}){
 await store.refreshPdf();signal?.throwIfAborted();
 const pdf=new PdfReuse(store),revision=store.revision,data=await inventory(root,signal),unique=new Set<string>();let babeleHits=0,manualApproved=0,exact=0,fuzzy=0,canonical=0,cache=0,glossary=0,ai=0,calls=0,original=0,protectedOnly=0,pdfExact=0,pdfCanonical=0,pdfContext=0,pdfReview=0,pdfAvoided=0;
 let uncertain=0,glossaryConflicts=0;
 for(const unit of data.units){signal?.throwIfAborted();const lang=sourceLanguage(unit.source,language)||'unknown',key=reuseKey(store,settings,unit.source,lang,unit.context,terms);if(unique.has(key))continue;unique.add(key);
  if(store.originalRequested(unit.source,lang,unit.context)||pdf.original(unit.source,lang,unit.context)){original++;continue;}
  if(!P.protect(unit.source).protectedText.replace(/\[\[PROTECTED_\d+\]\]/g,'').trim()){protectedOnly++;continue;}
  if(lang==='unknown'){uncertain++;continue;}
  let terminology:ReturnType<typeof effectiveTerms>;try{terminology=effectiveTerms(store,unit.context,terms);}catch{glossaryConflicts++;continue;}
  const valid=(target:string)=>!store.rejected(unit.source,target,lang,unit.context)&&reusable(unit.source,target,unit.context);
  const skippedPdfCalls=()=>{const scoped=terminology,cached=store.getCache(key,cacheIdentity(store,settings,unit.source,lang,unit.context,terms));if(cached!==undefined&&valid(cached)&&scoped.every(term=>!unit.source.toLowerCase().includes(term.source.toLowerCase())||cached.includes(term.target)))return 0;return estimatedSourceCalls(settings,unit.source,scoped);};
  if(pdf.reviewCandidates(unit.source,lang,unit.context))pdfReview++;
  const bound=pdf.canonical(unit.source,unit.context);if(bound&&valid(bound.translated_text)){pdfCanonical++;pdfAvoided+=skippedPdfCalls();continue;}
  const fromPdf=pdf.exact(unit.source,lang,unit.context);if(fromPdf&&valid(fromPdf.translated_text)){pdfExact++;pdfAvoided+=skippedPdfCalls();continue;}
  const approved=store.canonical(unit.context);if(approved&&valid(approved.translated_text)){canonical++;if(approved.translation_engine.startsWith('manual'))manualApproved++;continue;}
  const tm=store.exact(unit.source,lang,unit.context);if(tm&&valid(tm.translated_text)&&(!tm.historical||terminology.every(term=>!unit.source.toLowerCase().includes(term.source.toLowerCase())||tm.translated_text.includes(term.target)))){exact++;if(tm.historical)babeleHits++;if(tm.translation_engine.startsWith('manual'))manualApproved++;continue;}
  const cached=store.getCache(key,cacheIdentity(store,settings,unit.source,lang,unit.context,terms));if(cached!==undefined&&valid(cached)&&terminology.every(term=>!unit.source.toLowerCase().includes(term.source.toLowerCase())||cached.includes(term.target))){cache++;continue;}
  let text=P.protect(unit.source).protectedText;for(const term of terminology.sort((a,b)=>b.source.length-a.source.length)){
   const escaped=term.source.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');text=text.split(/(\[\[PROTECTED_\d+\]\])/g).map(part=>/^\[\[PROTECTED_\d+\]\]$/.test(part)?part:part.replace(new RegExp('(?<![\\p{L}\\p{N}_])'+escaped+'(?![\\p{L}\\p{N}_])','giu'),'[[PROTECTED_999999]]')).join('');
  }
  const spans=[...new Set(text.split(/\[\[PROTECTED_\d+\]\]/g).map(s=>s.trim()).filter(Boolean))];if(!spans.length){glossary++;continue;}
  if(store.fuzzy(unit.source,lang,unit.context).length)fuzzy++;if((settings.provider||'ollama')==='ollama'&&pdf.context(unit.source,lang,unit.context))pdfContext++;ai++;if(settings.model.startsWith('translategemma:')){try{calls+=semanticChunks(text).length;}catch{calls++;}}else for(const span of spans)try{calls+=semanticChunks(span).length;}catch{calls++;}
 }
 const stats=store.statistics(),warnings:string[]=[];
 if(uncertain)warnings.push('SOURCE_LANGUAGE_UNCERTAIN');
 if(glossaryConflicts)warnings.push('GLOSSARY_CONFLICT');
 if(stats.memory_entries_total>0&&exact+canonical+pdfExact+pdfCanonical===0)warnings.push('MEMORY_UTILIZATION_WARNING');if(!stats.approved_entries&&stats.memory_entries_total)warnings.push('NO_APPROVED_MEMORY');if(data.skipped.length)warnings.push('PREFLIGHT_INCOMPLETE_FILES');if(store.pdfCorpus.warning)warnings.push(store.pdfCorpus.warning);
 if(store.revision!==revision)throw new Error('MEMORY_REVISION_CONFLICT');
 const {mapping_records,...reuse_diagnostics}=await auditReuse(store,data.units,settings,language,terms,signal);
 return {schema_version:1,reuse_diagnostics,babele_safe_exact_hits:babeleHits,manual_approved_hits:manualApproved,files:data.files,strings_translatable:data.units.length,strings_unique:unique.size,exact_tm_candidates:exact,fuzzy_tm_candidates:fuzzy,canonical_candidates:canonical,pdf_exact_candidates:pdfExact,pdf_canonical_candidates:pdfCanonical,pdf_context_candidates:pdfContext,pdf_review_candidates:pdfReview,pdf_model_calls_avoided:pdfAvoided,pdf_avoided_calls_policy:'UNRETRIED_FRAGMENTS_NO_BASELINE',cache_candidates:cache,glossary_only_hits:glossary,protected_only_strings:protectedOnly,original_choices:original,source_language_uncertain:uncertain,glossary_conflicted_strings:glossaryConflicts,strings_requiring_ai:ai,estimated_model_calls:calls,estimate_policy:'NO_RETRIES_NO_RUNTIME_FAILURES',incremental_reuse_estimated:false,memory:stats,pdf_memory:await pdf.reportStatistics(),warnings,skipped_files:data.skipped.length,model:settings.model,placement:options.offline?{backend:'NOT_QUERIED_DRY_RUN',vram_estimated:null,size:null,size_vram:null}:await modelPlacement(settings),gpu:await readNvidia(),prompt:{version:promptVersion,limits:promptLimits},revision,fingerprint:hashKey([data.fingerprints,store.pdfCorpus.fingerprint])};
}
export type TranslationPreflight=Awaited<ReturnType<typeof translationPreflight>>;
