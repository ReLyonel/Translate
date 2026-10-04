import fs from 'node:fs/promises';
import {ProtectedContentEngine as P} from '../src/services/protected-content/protectedContentEngine';
import {benchmarkQualityGate} from '../desktop/benchmark/gate';
import {hashKey} from '../desktop/memory/store';
import path from 'node:path';

// Offline evaluation only: never invokes Ollama, writes TM, or changes the corpus/results.
const corpus=JSON.parse(await fs.readFile('reports/benchmark/real-corpus.json','utf8'));
const directory=process.argv.includes('--corrected-protection')?'reports/benchmark/corrected-protection':'reports/benchmark';
const results=JSON.parse(await fs.readFile(path.join(directory,'results.json'),'utf8'));
if(results.status==='RUNNING')throw new Error('BENCHMARK_STILL_RUNNING');
if(hashKey(corpus.cases)!==results.corpus_hash)throw new Error('CORPUS_CHANGED');
const ramLines=await fs.readFile(path.join(directory,'server-ram.jsonl'),'utf8').catch(()=>'');
const ram=ramLines.trim()?ramLines.trim().split(/\r?\n/).map(line=>JSON.parse(line)):[];
const signature=(text:string)=>JSON.stringify([...P.protect(text).tokens.values()].map(t=>[t.type,t.original]));
const models=results.rows.map((row:any)=>{
 const cases:any[]=row.cases.map((entry:any)=>{
  if(entry.target===null)return {...entry,evaluation:'NO_VALIDATED_OUTPUT'};
  // The online restore gate returns the ORIGINAL on failure. It is not an
  // untranslated model response and must never be reclassified as a pass.
  if(!entry.structural_pass&&entry.target===entry.source)return {...entry,evaluation:'ORIGINAL_RESTORED_ONLINE',wrong_language:false,untranslated:false,valid:false};
  try{
   const gate=benchmarkQualityGate(entry.source,P.protect(entry.target).protectedText,entry.tags.includes('javascript'));
   if(signature(entry.source)!==signature(entry.target)){
    gate.structural_pass=false;gate.valid=false;gate.reasons.push('PROTECTED_CONTENT_CHANGED');
   }
   return {...entry,...gate,target:entry.target,valid:gate.valid&&!gate.wrong_language,evaluation:'COMMON_OFFLINE_GATE'};
  }catch{return {...entry,valid:false,structural_pass:false,reasons:['PROTECTED_CONTENT_CHANGED'],evaluation:'COMMON_OFFLINE_GATE'};}
 });
 const count=(predicate:(c:any)=>boolean)=>cases.filter(predicate).length;
 const reason=(value:string)=>count(c=>c.reasons.includes(value));
 const slices=Object.fromEntries(['en','ru','short','long','name','javascript'].map(slice=>{
  const selected=cases.filter(c=>c.language===slice||c.tags.includes(slice));
  return [slice,{samples:selected.length,gate_valid:selected.filter(c=>c.valid).length,structural_failures:selected.filter(c=>!c.structural_pass).length}];
 }));
 const observedRam=ram.filter(r=>r.model===row.model&&Number.isFinite(r.working_set_bytes)&&r.working_set_bytes>0);
 return {model:row.model,status:row.status,samples:cases.length,gate_valid:count(c=>c.valid),
  structural_failure_cases:count(c=>!c.structural_pass),script_file_failures:row.javascript_failures,
  validation_failure_cases:count(c=>!c.valid),placeholder_failure_cases:reason('PLACEHOLDER_FAILURE'),
  reference_failure_cases:reason('UUID_FAILURE'),html_failure_cases:reason('HTML_FAILURE'),roll_failure_cases:reason('ROLL_FAILURE'),
  wrong_language:count(c=>c.wrong_language),untranslated:count(c=>c.untranslated),retries:row.retries,
  original_fallback_cases:count(c=>!c.valid),requests:row.requests,http_successful_requests:row.successful_requests,
  accepted_chunks:row.chunks,duration_seconds:row.duration,average_latency_seconds:row.average_latency,
  strings_per_minute:row.strings_per_minute,valid_strings_per_minute:count(c=>c.valid)/row.duration*60,
  tokens_per_second:row.tokens_per_second,peak_vram_mib:row.peak_vram_mib,peak_gpu_temperature:row.peak_gpu_temperature,
  peak_vram_temperature:row.peak_vram_temperature,peak_runner_ram_bytes:row.peak_ram_bytes,
  peak_server_ram_bytes:observedRam.length?Math.max(...observedRam.map(r=>r.working_set_bytes)):directory.endsWith('corrected-protection')?row.peak_ollama_ram_bytes:null,
  server_ram_scope:'OLLAMA_AND_LLAMA_SERVER_WORKING_SET',languages:Object.fromEntries(Object.entries(row.languages).map(([language,value]:[string,any])=>[language,{...value,valid_translations:slices[language].gate_valid,structural_failures:slices[language].structural_failures}])),slices,
  applicable_approved_references:count(c=>!!c.reference),reference_literal_matches:count(c=>c.reference_exact===true),cases};
});
await fs.writeFile(path.join(directory,'evaluation.json'),JSON.stringify({schema_version:1,corpus_hash:results.corpus_hash,
 prompts_hash:results.prompts_hash,policy:'SAME_OFFLINE_GATE_ALL_MODELS_STRUCTURE_FIRST',
 limitations:['NULL_OUTPUT_TOKEN_TYPES_NOT_INFERRED','REFERENCE_FAILURE_INCLUDES_ENCODED_FOUNDRY_REFERENCES','LINGUISTIC_REVIEW_SEPARATE','MEMORY_TEMPERATURE_UNAVAILABLE'],models},null,2));
console.log(JSON.stringify(models.map(({cases,...summary}:any)=>summary),null,2));
