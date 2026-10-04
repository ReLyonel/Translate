import fs from 'node:fs/promises';
import path from 'node:path';
import type { BatchProgress,ProviderSettings,TranslateRequest } from '../contracts';
import { MemoryStore } from '../memory/store';
import { TranslationRuntime } from '../translation/runtime';
import { RunLogger,loadLogPolicy } from './runLogger';
import { publicProvenance } from '../memory/provenance';
import { IncrementalSession,type IncrementalReport } from '../memory/incremental';
import { consistencyReport } from './consistencyReport';
import { moduleIdentity } from '../memory/moduleIdentity';
import { runBatch } from '../jobs';
import {ThermalGuard,defaultThermalPolicy} from '../thermal';
import {promptVersion,promptLimits} from '../translation/prompt';

export async function runLoggedBatch(input:string,output:string,settings:ProviderSettings,store:MemoryStore,logsRoot:string,signal:AbortSignal,publish:(progress:BatchProgress)=>void,language:'auto'|'en'|'ru',id:string,terms:{source:string;target:string}[]=[],onReport:(directory:string)=>void=()=>{},thermal?:ThermalGuard,outputStrategy:import('../contracts').OutputStrategy='TRANSLATION_OVERLAY') {
  const logger=await new RunLogger(logsRoot,await loadLogPolicy(logsRoot)).init();
  const runtime=new TranslationRuntime(store,settings,logger,{module:path.basename(input)});
  runtime.extractedExternally=true;
  let snapshot:BatchProgress={id,state:'RUNNING',total:0,completed:0,failed:0,current:'',errors:[]};
  let reportDirectory='';const warningFiles=new Set<string>();
  const guard=thermal||new ThermalGuard(undefined,{...defaultThermalPolicy,enabled:settings.thermalEnabled!==false&&(settings.provider||'ollama')==='ollama'},value=>{snapshot={...snapshot,sequence:(snapshot.sequence||0)+1,thermal:{...value.sample,state:value.state}};publish(snapshot);});
  runtime.thermal=guard;
  const adjusted=(progress:BatchProgress):BatchProgress=>{const outcomes=progress.outcomes?.map(item=>warningFiles.has(item.file)&&item.status==='COMPLETED'?{...item,status:'WARNING' as const,qualityGate:item.qualityGate?{...item.qualityGate,status:'WARNING' as const,checks:{...item.qualityGate.checks,translation:'WARNING' as const}}:undefined}:item);return {...progress,sequence:Math.max(progress.sequence||0,snapshot.sequence||0)+1,thermal:snapshot.thermal,outcomes,validated:outcomes?outcomes.filter(item=>item.status==='COMPLETED').length:progress.validated,failed:outcomes?outcomes.filter(item=>item.status!=='COMPLETED').length:progress.failed};};
  await logger.event('app',{status:'RUNNING',reason:'JOB_STARTED'});
  try {
    await store.refreshPdf();await guard.start();
    const identity=await moduleIdentity(input);runtime.baseContext.module=identity.module;
    runtime.incremental=await new IncrementalSession(path.join(store.directory,'incremental'),identity.namespace).load();
    return adjusted(await runBatch(input,output,async request=>{const previous=runtime.warnings.length;if(request.context?.docType==='native-localization'){runtime.metrics.values.strings_detected+=request.texts.length;runtime.metrics.values.strings_translatable+=request.texts.length;}try{return await runtime.translate({...request,file:request.file||snapshot.current,terminology:terms},signal);}finally{if(runtime.warnings.length>previous){warningFiles.add(snapshot.current);for(const warning of runtime.warnings.slice(previous))warning.file=snapshot.current;}}},signal,progress=>{snapshot=adjusted(progress);publish(snapshot);},language,id,'module',(event,value)=>{
      if(event==='strings_detected'||event==='strings_translatable')runtime.metrics.values[event]=Math.max(runtime.metrics.values[event],0)+value;
      else runtime.metrics.values[event]+=value;
    },outputStrategy));
  }catch(error){snapshot={...snapshot,state:signal.aborted?'CANCELLED':'ERROR'};throw error;}
  finally {
    guard.stop();
    let finalizationError:unknown;
    if(signal.aborted)snapshot={...snapshot,state:'CANCELLED'};
    runtime.metrics.values.files_processed=snapshot.completed;
    const outcomes=new Map((snapshot.outcomes||[]).map(item=>[item.file.split(path.sep).join('/'),item]));
    for(const unit of runtime.units){
      const outcome=outcomes.get(unit.file.split(path.sep).join('/'));
      if(outcome&&['TRANSLATED','UNCHANGED','RECOVERED'].includes(outcome.outputKind))unit.publication=unit.quality==='FAILED'?'RECOVERED':'VALIDATED';
      else if(outcome?.outputKind==='ORIGINAL_FALLBACK'){
        unit.publication='RECOVERED';unit.translated_text=unit.source_text;unit.target_hash=unit.source_hash;unit.provider=null;unit.model=null;unit.origins=[...new Set([...unit.origins,'ORIGINAL_FALLBACK' as const])];unit.reason='FILE_ORIGINAL_RESTORED';
      }else if(unit.document_type==='native-localization'&&(snapshot.generatedLocalizations?.length||0)>0)unit.publication='VALIDATED';
      else unit.publication='NOT_PUBLISHED';
    }
    const complete=!signal.aborted&&snapshot.state==='COMPLETED'&&snapshot.failed===0&&!runtime.warnings.length&&!(snapshot.warnings||[]).some(item=>/NOT_PUBLISHED|CANCELLED/.test(item))&&runtime.units.every(unit=>unit.quality==='PASS'&&unit.publication==='VALIDATED'&&unit.reuse_key);
    let incremental:IncrementalReport|undefined;
    try{incremental=runtime.incremental?.describe(runtime.units,complete);if(complete){
      await runtime.commitUsage();
      if(runtime.incremental&&incremental){await runtime.incremental.commit(runtime.units,signal);incremental.baseline_committed=true;}
    }}catch(error){finalizationError=error;snapshot={...snapshot,state:signal.aborted?'CANCELLED':'ERROR'};if(incremental)incremental.complete=false;}
    const consistency=consistencyReport(runtime.units,store.entries(),[...store.glossary({module:runtime.baseContext.module}),...terms.map(term=>({...term,version:'user'}))]);
    const diagnostics:Record<string,unknown>[]=(snapshot.diagnostics||[]).map(item=>({scope:item.scope,file:item.file,json_path:item.pathSegments,status:item.scope==='JOB'?'FAILED':'WARNING',reason:item.reason,recovery_action:item.recovery,provider:settings.provider||'ollama',model:settings.model,source_language:language,target_language:'es'}));
    const errors=diagnostics.filter(item=>item.status==='FAILED');if(snapshot.state==='ERROR'&&!errors.length)errors.push({scope:'JOB',file:snapshot.current,status:'FAILED',reason:'JOB_FAILED',recovery_action:'JOB_STOPPED',provider:settings.provider||'ollama',model:settings.model,source_language:language,target_language:'es',json_path:undefined});
    if(finalizationError)errors.push({scope:'JOB',status:'FAILED',reason:'INCREMENTAL_FINALIZATION_FAILED',recovery_action:'BASELINE_REVIEW_REQUIRED'});
    const memoryWarning=store.statistics().approved_entries>0&&runtime.metrics.values.tm_exact_hits+runtime.metrics.values.canonical_hits+runtime.metrics.values.pdf_exact_hits+runtime.metrics.values.pdf_canonical_hits===0;
    const warnings=[...(store.pdfCorpus.warning?[{status:'WARNING',reason:store.pdfCorpus.warning,recovery_action:'REIMPORT_PDF_REFERENCE'}]:[]),...(memoryWarning?[{status:'WARNING',reason:'MEMORY_UTILIZATION_WARNING',recovery_action:'REVIEW_MEMORY_PREFLIGHT'}]:[]),...(consistency.warning_count?[{status:'WARNING',reason:'TERMINOLOGY_VARIANTS',recovery_action:'REVIEW_REQUIRED'}]:[]),...diagnostics.filter(item=>item.status==='WARNING'),...runtime.warnings,...(snapshot.warnings||[]).map(()=>({status:'WARNING',reason:'LOCALIZATION_WARNING'}))];
    const unprocessed=Math.max(0,snapshot.total-snapshot.completed);
    const skipped=unprocessed?[{status:'SKIPPED',reason:signal.aborted?'CANCELLED':'JOB_STOPPED'}]:[];
    await logger.event('app',{status:snapshot.state,reason:'JOB_FINISHED'});
    for(const error of errors)await logger.event('errors',error);
    reportDirectory=await logger.report({schema_version:1,output_strategy:outputStrategy,publication:snapshot.publication,job_id:id,status:snapshot.state,total:snapshot.total,processed:snapshot.completed,validated:snapshot.validated||0,warning_files:(snapshot.outcomes||[]).filter(item=>item.status==='WARNING').length,failed_files:(snapshot.outcomes||[]).filter(item=>item.status==='FAILED').length,warning_count:warnings.length,unprocessed,metrics:runtime.metrics.finish(),memory:store.statistics(),pdf_memory:await runtime.pdf.reportStatistics(),thermal:guard.report(),prompt:{version:promptVersion,limits:promptLimits,...runtime.promptAudit()},sequence:snapshot.sequence||0,translation_provenance:runtime.units.map(publicProvenance),terminology_consistency:consistency,incremental},errors,warnings,skipped);
    onReport(reportDirectory);
    snapshot={...snapshot,sequence:(snapshot.sequence||0)+1,reportAvailable:true,warnings:[...(snapshot.warnings||[]),...runtime.warnings.map(warning=>String(warning.reason)),...(consistency.warning_count?['Variantes terminologicas detectadas: '+consistency.warning_count+'. Revisa el informe.']:[])]};publish(snapshot);
    if(finalizationError)throw finalizationError;
  }
}
export async function exportRunReport(directory:string,destination:string) {
  await fs.mkdir(destination);
  for(const name of ['summary.json','errors.json','warnings.json','skipped.json'])await fs.copyFile(path.join(directory,name),path.join(destination,name));
}

/** Direct text/JSON translations use the same private diagnostics and reuse pipeline. */
export async function runLoggedTranslation(request:TranslateRequest,settings:ProviderSettings,store:MemoryStore,logsRoot:string,onReport:(directory:string)=>void=()=>{},signal?:AbortSignal,onThermal:(guard:ThermalGuard)=>void=()=>{}) {
  const logger=await new RunLogger(logsRoot,await loadLogPolicy(logsRoot)).init();
  const runtime=new TranslationRuntime(store,settings,logger);
  const guard=new ThermalGuard(undefined,{...defaultThermalPolicy,enabled:settings.thermalEnabled!==false&&(settings.provider||'ollama')==='ollama'},onThermal);runtime.thermal=guard;
  let status='ERROR',processed=0;
  const errors:Record<string,unknown>[]=[];
  await logger.event('app',{status:'RUNNING',reason:'TRANSLATION_STARTED'});
  try {
    await store.refreshPdf();await guard.start();const results=await runtime.translate(request,signal);
    processed=results.length;status=runtime.warnings.length?'WARNING':'COMPLETED';return results;
  }catch(error){
    if(signal?.aborted)status='CANCELLED';
    const reason=error instanceof Error&&/^[A-Z_]+$/.test(error.message)?error.message:'TRANSLATION_FAILED';
    errors.push({status:'FAILED',reason,provider:settings.provider||'ollama',model:settings.model,recovery_action:'OUTPUT_NOT_PUBLISHED'});
    throw error;
  }finally{
    guard.stop();
    for(const error of errors)await logger.event('errors',error);
    await logger.event('app',{status,reason:'TRANSLATION_FINISHED'});
    const unprocessed=request.texts.length-processed;
    const directory=await logger.report({schema_version:1,scope:'STRINGS',status,total:request.texts.length,processed,unprocessed,warning_count:runtime.warnings.length,metrics:runtime.metrics.finish(),pdf_memory:await runtime.pdf.reportStatistics(),thermal:guard.report(),prompt:{version:promptVersion,limits:promptLimits,...runtime.promptAudit()},translation_provenance:runtime.units.map(publicProvenance)},errors,runtime.warnings,unprocessed?[{status:'SKIPPED',reason:'TRANSLATION_STOPPED'}]:[]);
    onReport(directory);
  }
}
