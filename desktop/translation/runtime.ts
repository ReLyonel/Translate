import type { ProviderSettings,TranslateRequest } from '../contracts';
import { translate as providerTranslate } from '../providers';
import { MemoryStore,hashKey,contextData,type MemoryContext } from '../memory/store';
import { ProtectedContentEngine as Protection } from '../../src/services/protected-content/protectedContentEngine';
import { validateQuality,validateLanguage } from './quality';
import { RunMetrics } from '../metrics/runMetrics';
import { RunLogger } from '../logging/runLogger';
import { validateHtmlIntegrity } from '../../src/services/validation/htmlIntegrity';
import type { ResolvedUnit,TranslationOrigin } from '../memory/provenance';
import type { IncrementalSession } from '../memory/incremental';
import type {ThermalGuard} from '../thermal';
import {reuseKey,estimatedSourceCalls,cacheIdentity,effectiveTerms} from './reuse';
import {PdfReuse,pdfDiagnostic,type PdfDiagnostic} from '../memory/pdfReuse';
import {sourceLanguage} from '../../src/services/translation/languageDetector';

export class TranslationRuntime {
  readonly metrics=new RunMetrics();
  readonly warnings:Record<string,unknown>[]=[];
  readonly units:ResolvedUnit[]=[];
  private used=new Set<string>();
  private unique=new Set<string>();
  extractedExternally=false;
  thermal?:ThermalGuard;
  readonly pdf:PdfReuse;
  readonly inferenceAudit={responses:0,reported_fields:new Set<string>(),max_prompt_chars:0,max_source_chars:0};
  constructor(readonly store:MemoryStore,readonly settings:ProviderSettings,readonly logger?:RunLogger,readonly baseContext:MemoryContext={},public incremental?:IncrementalSession){this.pdf=new PdfReuse(store);}

  async translate(request:TranslateRequest,signal?:AbortSignal) {
    const outputs:string[]=[];
    const local=new Map<string,{wire:string;record:ResolvedUnit}>();
    for(let index=0;index<request.texts.length;index++) {
      signal?.throwIfAborted();
      const callerText=request.texts[index];
      const returnRaw=!request.units?.[index]&&!/\[\[PROTECTED_/.test(callerText);
      const unit=request.units?.[index]??(returnRaw?{sourceText:callerText}:undefined);
      const source=unit?.sourceText??callerText;
      const protection=Protection.protect(source);
      const text=returnRaw?protection.protectedText:callerText;
      const context:MemoryContext=contextData({...this.baseContext,document_type:request.context?.docType??this.baseContext.document_type,system:request.context?.system??this.baseContext.system,module:request.context?.module??this.baseContext.module,field_type:request.context?.fieldType??this.baseContext.field_type,...unit?.context});
      for(const key of ['system','module','document_type','field_type','surrounding_context_hash','surrounding_context'] as const)if(typeof context[key]!=='string')delete context[key];
      const language=sourceLanguage(source,request.sourceLanguage)||'unknown';
      const file=request.file||'';
      const sourceHash=hashKey(source);
      const locator=hashKey([file,request.occurrenceScope,context.json_path||['request',index],language,context.system,context.module,context.document_type,context.field_type]);
      let actual:string=this.settings.provider||'ollama';let attempted=false;
      const base={...context,file,occurrence_scope:request.occurrenceScope,source_language:language,target_language:'es' as const,source_hash:sourceHash,locator_id:locator,unit_id:hashKey([locator,sourceHash,context.surrounding_context_hash]),source_text:source,publication:'PENDING' as const};
      try {
        const known=!/\[\[PROTECTED_/.test(text)||Boolean(unit&&protection.protectedText===text);
        const scoped=this.store.glossary(context),explicit=request.terminology||[];
        const terminology=effectiveTerms(this.store,context,explicit);
        const glossaryVersion=hashKey([scoped,explicit]);
        const identity=hashKey([source,language,context.system,context.module,context.document_type,context.field_type,context.surrounding_context_hash,context.canonical_uuid,context.canonical_version,context.canonical_uuid?context.json_path:undefined,context.pack,glossaryVersion,known?null:index]);
        if(!this.extractedExternally){this.metrics.values.strings_detected++;this.metrics.values.strings_translatable++;}
        if(protection.tokens.size)this.metrics.values.strings_protected++;
        if(this.unique.has(identity))this.metrics.values.strings_deduplicated++;else{this.unique.add(identity);this.metrics.values.strings_unique++;}
        if(known&&(this.store.originalRequested(source,language,context)||this.pdf.original(source,language,context)))throw new Error('MANUAL_ORIGINAL_REQUESTED');
        if(!text.replace(/\[\[PROTECTED_\d+\]\]/g,'').trim()){
          this.units.push({...base,translated_text:source,target_hash:sourceHash,origins:['PROTECTED_ONLY'],provider:null,model:null,quality:'PASS',deduplicated:false,reuse_key:known?reuseKey(this.store,this.settings,source,language,context,explicit):undefined});outputs.push(returnRaw?source:text);continue;
        }
        if(language==='unknown')throw new Error('SOURCE_LANGUAGE_UNCERTAIN');
        const validate=(wire:string)=>{
          const expected=text.match(/\[\[PROTECTED_[^\]]+\]\]/g)||[],found=wire.match(/\[\[PROTECTED_[^\]]+\]\]/g)||[];
          if(JSON.stringify(expected)!==JSON.stringify(found))throw new Error('PROTECTED_CONTENT_INVALID');
          const restored=known&&unit?Protection.restore(wire,protection.tokens):{isValid:true,restoredText:wire};
          if(!restored.isValid)throw new Error('PROTECTED_CONTENT_INVALID');
          if(known&&this.store.rejected(source,restored.restoredText,language,context))throw new Error('REJECTED_TRANSLATION');
          const checkLanguage=request.sourceLanguage==='en'||request.sourceLanguage==='ru'||/[\u0400-\u04ff]/.test(source)||validateLanguage(source).reasons.includes('TARGET_LANGUAGE_ENGLISH');
          const quality=validateQuality(source,restored.restoredText,checkLanguage);
          if(context.document_type!=='Script'&&known&&validateHtmlIntegrity(source,restored.restoredText).length)throw new Error('HTML_VALIDATION_FAILED');
          if(quality.status==='FAILED')throw new Error(quality.reasons[0]);
          return {target:restored.restoredText,quality};
        };
        const duplicate=local.get(identity);
        if(duplicate){
          const result=validate(duplicate.wire);
          this.units.push({...duplicate.record,...base,translated_text:result.target,target_hash:hashKey(result.target),deduplicated:true});
          outputs.push(returnRaw?result.target:duplicate.wire);this.metrics.values.characters_reused+=source.length;continue;
        }
        const human=protection.protectedText.replace(/\[\[PROTECTED_[^\]]+\]\]/g,' ').trim();
        const glossaryOnly=terminology.some(term=>term.source.toLowerCase()===human.toLowerCase());
        const glossaryApplied=terminology.some(term=>{const literal=term.source.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const expression=new RegExp('(?<![\\p{L}\\p{N}_])'+literal+'(?![\\p{L}\\p{N}_])','iu');return protection.protectedText.split(/\[\[PROTECTED_[^\]]+\]\]/g).some(fragment=>expression.test(fragment));});
        const toWire=(target:string)=>{if(!unit)return target;const value=Protection.protect(target);const signature=(tokens:typeof value.tokens)=>JSON.stringify([...tokens.values()].map(token=>[token.type,token.original]));if(signature(value.tokens)!==signature(protection.tokens))throw new Error('PROTECTED_CONTENT_INVALID');return value.protectedText;};
        const compatibleGlossary=(target:string)=>terminology.every(term=>!source.toLowerCase().includes(term.source.toLowerCase())||target.includes(term.target));
        let wire:string|undefined,memoryId:string|undefined,origins:TranslationOrigin[]=[],recordProvider:string|null=actual,recordModel:string|null=actual==='ollama'?this.settings.model:'LibreTranslate',incrementalHit=false;
        let pdfReference:PdfDiagnostic|undefined;
        let historicalReference:ResolvedUnit['historical_reference'];
        const cacheKey=reuseKey(this.store,this.settings,source,language,context,explicit);
        const skippedPdfCalls=()=>{
          const previous=this.incremental?.lookup(locator,sourceHash,cacheKey),cached=previous&&(previous.provider===null||previous.provider===actual&&previous.model===recordModel)?previous.target:this.store.getCache(cacheKey,cacheIdentity(this.store,this.settings,source,language,context,explicit));
          if(cached!==undefined)try{if(compatibleGlossary(cached)&&validate(toWire(cached)).quality.status==='PASS')return 0;}catch{/* Invalid ordinary reuse cannot reduce the estimate. */}
          return estimatedSourceCalls(this.settings,source,terminology);
        };
        const canonical=known?this.store.canonical(context):undefined;
        const canonicalPdf=known?this.pdf.canonical(source,context):undefined,exactPdf=known?this.pdf.exact(source,language,context):undefined;
        const exactMatches=[canonicalPdf,exactPdf,canonical,known?this.store.exact(source,language,context):undefined].filter((entry):entry is NonNullable<typeof entry>=>Boolean(entry));
        for(const exact of exactMatches){
          if(wire!==undefined)break;
          const canonicalHit=exact===canonical;
          try{
            const candidate=toWire(exact.translated_text);
            if((!exact.historical||compatibleGlossary(exact.translated_text))&&validate(candidate).quality.status==='PASS'){
              wire=candidate;this.used.add(exact.id);memoryId=exact.id;
              if(exact.pdf){
                const bound=exact===canonicalPdf;this.metrics.values[bound?'pdf_canonical_hits':'pdf_exact_hits']++;origins=[bound?'PDF_CANONICAL':'PDF_EXACT'];pdfReference=pdfDiagnostic(exact);
                this.metrics.values.pdf_model_calls_avoided+=skippedPdfCalls();
              }else{this.metrics.values[canonicalHit?'canonical_hits':'tm_exact_hits']++;origins=[canonicalHit?'CANONICAL_APPROVED_TRANSLATION':'TM_EXACT'];}
              if(exact.historical){origins.push('TM_EXACT_APPROVED','HISTORICAL_BABELE');const h=exact.historical;historicalReference={source_corpus:h.source_corpus,source_file:h.source_file,provenance:h.provenance,translation_origin:h.translation_origin,approval:'APPROVED_MANUAL',canonical_identity:'UNKNOWN',import_version:h.import_version};}
              recordProvider=exact.translation_engine;recordModel=exact.model;
              if(exact.translation_engine.startsWith('manual')){origins.push('MANUAL');recordProvider=null;recordModel=null;}
              if(exact.translation_engine==='glossary'){origins.push('GLOSSARY');recordProvider=null;recordModel=null;}
              if(exact.pdf){recordProvider=null;recordModel=null;if(exact.pdf.edited)origins.push('MANUAL');}
            }
          }catch{/* Every trusted hit still passes current integrity. */}
        }
        if(wire===undefined&&known){
          const previous=this.incremental?.lookup(locator,sourceHash,cacheKey);
          const prior=previous&&(previous.provider===null||previous.provider===actual&&previous.model===recordModel)?previous:undefined;
          const cached=prior?.target??this.store.getCache(cacheKey,cacheIdentity(this.store,this.settings,source,language,context,explicit));
          if(cached!==undefined)try{
            const candidate=toWire(cached);
            if(compatibleGlossary(cached)&&validate(candidate).quality.status==='PASS'){
              wire=candidate;this.metrics.values.cache_hits++;origins=['CACHE'];incrementalHit=Boolean(prior);
              if(prior){recordProvider=prior.provider;recordModel=prior.model;}
              if(glossaryOnly){origins.push('GLOSSARY');recordProvider=null;recordModel=null;}
            }
          }catch{/* An invalid or rejected hit is a miss. */}
          if(wire===undefined)this.metrics.values.cache_misses++;
        }
        if(wire===undefined){
          const fuzzy=known?this.store.fuzzy(source,language,context):[];
          const pdfContext=known&&actual==='ollama'&&!glossaryOnly&&estimatedSourceCalls(this.settings,source,terminology)>0?this.pdf.context(source,language,context):undefined;
          this.metrics.values.tm_fuzzy_hits+=fuzzy.length?1:0;
          const notes=fuzzy.length?'Approved terminology examples (context only): '+JSON.stringify(fuzzy.map(entry=>({source:Protection.protect(entry.source_text).protectedText.slice(0,300),target:Protection.protect(entry.translated_text).protectedText.slice(0,300)})))+'\n'+(request.context?.notes||''):(request.context?.notes||'');
          const visibleNotes=context.surrounding_context?'Visible document context: '+context.surrounding_context.slice(0,600)+'\n'+notes:notes;
          const contextualNotes=pdfContext?pdfContext.note+'\n'+visibleNotes:visibleNotes;
          const telemetry=(event:Parameters<NonNullable<TranslateRequest['telemetry']>>[0])=>{if(event==='fallback_libretranslate')actual='libretranslate';else this.metrics.values[event]++;request.telemetry?.(event);};
          const start=performance.now();
          try{
            const inferenceMetrics:NonNullable<TranslateRequest['inferenceMetrics']>=metrics=>{this.inferenceAudit.responses++;this.inferenceAudit.max_prompt_chars=Math.max(this.inferenceAudit.max_prompt_chars,metrics.prompt_chars);this.inferenceAudit.max_source_chars=Math.max(this.inferenceAudit.max_source_chars,metrics.source_chars);for(const key of ['prompt_tokens','generated_tokens','eval_duration','load_duration'] as const)if(metrics[key]!==undefined){this.metrics.values[key]+=metrics[key]!;this.inferenceAudit.reported_fields.add(key);}request.inferenceMetrics?.(metrics);};
            attempted=true;const action=(activeSignal?:AbortSignal)=>providerTranslate(this.settings,{...request,texts:[text],units:unit?[unit]:undefined,sourceLanguage:language,terminology,context:{...request.context,notes:contextualNotes.slice(0,600)},telemetry,inferenceMetrics},new Map(),activeSignal);
            const results=await (this.thermal?this.thermal.execute(action,signal):action(signal));
            if(results.length!==1)throw new Error('PROVIDER_RESPONSE_INVALID');wire=results[0];
          }finally{this.metrics.values.translation_time+=(performance.now()-start)/1000;}
          signal?.throwIfAborted();
          const validationStart=performance.now();let result:ReturnType<typeof validate>;
          try{result=validate(wire);}finally{this.metrics.values.validation_time+=(performance.now()-validationStart)/1000;}
          this.metrics.translatedUnits++;this.metrics.values.characters_translated+=source.length;
          recordProvider=glossaryOnly?null:actual;recordModel=glossaryOnly?null:actual==='ollama'?this.settings.model:'LibreTranslate';
          origins=glossaryOnly?['GLOSSARY']:[...(glossaryApplied?['GLOSSARY' as const]:[]),...(fuzzy.length&&actual==='ollama'?['TM_FUZZY_CONTEXT' as const]:[]),actual==='ollama'&&this.settings.model.startsWith('translategemma:')?'TRANSLATEGEMMA':'PROVIDER'];
          if(pdfContext&&actual==='ollama'){origins.push('PDF_CONTEXT');pdfReference=pdfDiagnostic(pdfContext.entry);this.metrics.values.pdf_context_hits++;this.used.add(pdfContext.entry.id);}
          if(result.quality.status==='WARNING'){
            const warning={...context,file,field:context.field_type,status:'WARNING',reason:result.quality.reasons[0],provider:actual,model:recordModel||'',source_language:language,target_language:'es'};
            this.warnings.push(warning);await this.logger?.event('translation',warning);
          }else if(known){
            memoryId=await this.store.candidate(source,result.target,language,context,glossaryOnly?'glossary':actual,recordModel||'');
            if(actual===(this.settings.provider||'ollama'))await this.store.cache(cacheKey,result.target,cacheIdentity(this.store,this.settings,source,language,context,explicit));
          }
        }else this.metrics.values.characters_reused+=source.length;
        const final=validate(wire);
        const record:ResolvedUnit={...base,historical_reference:historicalReference,pdf_reference:pdfReference,translated_text:final.target,target_hash:hashKey(final.target),origins,provider:recordProvider,model:recordModel,quality:final.quality.status,deduplicated:false,memory_id:memoryId,incremental:incrementalHit,reuse_key:known?cacheKey:undefined};
        this.units.push(record);local.set(identity,{wire,record});outputs.push(returnRaw?final.target:wire);
      }catch(error){
        signal?.throwIfAborted();
        const reason=error instanceof Error&&/^[A-Z_]+$/.test(error.message)?error.message:'PROVIDER_RESPONSE_INVALID';
        this.units.push({...base,translated_text:source,target_hash:sourceHash,origins:reason==='MANUAL_ORIGINAL_REQUESTED'?['MANUAL','ORIGINAL_FALLBACK']:['ORIGINAL_FALLBACK'],provider:null,model:null,attempted_provider:attempted?actual:undefined,attempted_model:attempted?(actual==='ollama'?this.settings.model:'LibreTranslate'):undefined,quality:'FAILED',deduplicated:false,reason});
        if((!request.onUnitFailure&&reason!=='SOURCE_LANGUAGE_UNCERTAIN')||(error as NodeJS.ErrnoException).code)throw error;
        request.onUnitFailure?.(index,'QUALITY_VALIDATION_FAILED');
        const warning={...context,file,field:context.field_type,status:'WARNING',reason,recovery_action:'ORIGINAL_RESTORED',provider:actual,model:actual==='ollama'?this.settings.model:'LibreTranslate',source_language:language,target_language:'es'};
        this.warnings.push(warning);await this.logger?.event('translation',warning);outputs.push(callerText);
      }
    }
    return outputs;
  }
  async commitUsage(){await this.store.usedMany([...this.used]);this.used.clear();}
  promptAudit(){return {...this.inferenceAudit,reported_fields:[...this.inferenceAudit.reported_fields]};}
}
