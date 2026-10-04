import fs from 'node:fs/promises';import path from 'node:path';import {execFile} from 'node:child_process';
import {hashKey} from '../desktop/memory/store';import {ProtectedContentEngine as P} from '../src/services/protected-content/protectedContentEngine';
import {benchmarkQualityGate} from '../desktop/benchmark/gate';import {translateScript} from '../desktop/scriptTranslation';
import {ThermalGuard,defaultThermalPolicy,readNvidia} from '../desktop/thermal';import {benchmarkGate} from '../desktop/benchmark/policy';
import {correctedFrozenInputs} from '../desktop/benchmark/frozenInput';

const endpoint='http://127.0.0.1:11500',file='reports/benchmark/real-corpus.json',bytes=await fs.readFile(file),corpus=JSON.parse(bytes.toString()),seal='87c0b280baf15069f17d03548896cad71cc4b5682700eb63e2896b0d9a030268';
if(corpus.corpus_hash!==seal||hashKey(corpus.cases)!==seal||corpus.cases.length!==120)throw new Error('FROZEN_CORPUS_CHANGED');
const corrected=process.argv.includes('--corrected-protection'),runDirectory=corrected?'reports/benchmark/corrected-protection':'reports/benchmark';
await fs.mkdir(runDirectory,{recursive:true});
const inputCases=corrected?correctedFrozenInputs(corpus.cases):corpus.cases;
if(corrected)await fs.writeFile(path.join(runDirectory,'effective-input.json'),JSON.stringify({corpus_hash:seal,protection_rules:P.rulesVersion,original_prompts_hash:hashKey(corpus.cases.map((c:any)=>c.prompts)),effective_prompts_hash:hashKey(inputCases.map((c:any)=>c.prompts)),cases:inputCases},null,2));
const database=path.join(process.env.APPDATA!,'foundry-translator/translation-memory/store.json'),memoryBefore=hashKey(await fs.readFile(database));
const models=['translategemma:4b','translategemma:12b','translategemma:27b'];
const tags=await (await fetch(endpoint+'/api/tags')).json() as any;if(models.some(m=>!tags.models.some((t:any)=>t.name===m)))throw new Error('MODELS_MISSING');
const originalHashes=new Map<string,string>();for(const c of corpus.cases){const absolute=path.join(corpus.root,c.file);if(!originalHashes.has(absolute))originalHashes.set(absolute,hashKey(await fs.readFile(absolute)));}
let rows:any[]=[];let report:any={schema_version:1,corpus_hash:seal,prompts_hash:hashKey(inputCases.map((c:any)=>c.prompts)),original_prompts_hash:hashKey(corpus.cases.map((c:any)=>c.prompts)),protection_rules:P.rulesVersion,configuration:{temperature:0,num_ctx:4096,num_predict:2048,serial:true,glossary:corpus.glossary},rows,status:'RUNNING',quality_policy:'STRUCTURE_FIRST_LINGUISTIC_REVIEW_SEPARATE',ram_scope:'RUNNER_RSS_AND_SUM_ALL_OLLAMA_AND_LLAMA_SERVER_PROCESSES_WORKING_SET'};
if(process.argv.includes('--resume')){const previous=JSON.parse(await fs.readFile(path.join(runDirectory,'results.json'),'utf8'));if(previous.corpus_hash!==seal||previous.prompts_hash!==report.prompts_hash||previous.rows.some((r:any)=>r.status==='THERMAL_ABORT'))throw new Error('RESUME_NOT_SAFE');report=previous;rows=previous.rows.filter((r:any)=>r.status==='COMPLETED_AWAITING_LINGUISTIC_REVIEW');report.rows=rows;report.status='RUNNING';}
const checkpoint=()=>fs.writeFile(path.join(runDirectory,'results.json'),JSON.stringify(report,null,2));
let active:AbortController|undefined;process.on('SIGINT',()=>active?.abort(new Error('USER_ABORT')));
async function ollamaRam():Promise<number|null>{if(process.platform!=='win32')return null;try{return await new Promise<number|null>((resolve)=>execFile('powershell.exe',['-NoProfile','-Command',"(Get-Process -Name '*ollama*','llama-server' -ErrorAction SilentlyContinue | Measure-Object -Property WorkingSet64 -Sum).Sum"],{windowsHide:true,timeout:5000},(error,out)=>resolve(!error&&out.trim()?Number(out.trim()):null)));}catch{return null;}}
for(const model of models){
 if(rows.some(r=>r.model===model))continue;
 let gpu=await readNvidia();const coolStarted=performance.now(),coolTarget=(rows[0]?.thermal?.samples[0]?.gpus[0]?.temperature??48)+2;
 while(gpu.available&&(gpu.gpus.some(g=>(g.temperature??Infinity)>coolTarget||(g.utilization??100)>10))&&performance.now()-coolStarted<300000){await new Promise(resolve=>setTimeout(resolve,3000));gpu=await readNvidia();if(Math.floor((performance.now()-coolStarted)/3000)%10===0)console.log(JSON.stringify({model,status:'WAITING_FOR_IDLE_COOL_GPU',temperature:gpu.gpus[0]?.temperature,utilization:gpu.gpus[0]?.utilization}));}
const readiness=benchmarkGate({warnings:[],canonical_candidates:0,pdf_canonical_candidates:0},gpu);
 if(readiness!=='PASS'){rows.push({model,status:readiness});report.status='BLOCKED';break;}
 const controller=new AbortController();active=controller;const row:any={model,status:'RUNNING',cooldown_seconds:(performance.now()-coolStarted)/1000,initial_gpu:gpu,cases:[],languages:{},requests:0,successful_requests:0,retries:0,validation_retries:0,fallbacks:0,structural_failures:0,placeholder_failures:0,html_failures:0,uuid_failures:0,roll_failures:0,javascript_failures:0,wrong_language:0,untranslated:0,validation_failures:0,valid_translations:0,generated_tokens:0,eval_duration:0,peak_vram_mib:null,peak_ram_bytes:0,peak_ollama_ram_bytes:null,latencies:[],attempt_failures:[],chunks:0};rows.push(row);
 const guard=new ThermalGuard(readNvidia,{...defaultThermalPolicy,poll_ms:2000},value=>{for(const g of value.sample.gpus)if(g.vram_used!==null)row.peak_vram_mib=Math.max(row.peak_vram_mib??0,g.vram_used);row.peak_ram_bytes=Math.max(row.peak_ram_bytes,process.memoryUsage().rss);if(value.state==='THERMAL_PAUSE')controller.abort(new Error('THERMAL_ABORT'));});
 const started=performance.now(),timeout=setTimeout(()=>controller.abort(new Error('TIME_LIMIT_ABORT')),20*60*1000);let lastRam=0;
 try{
  await guard.start();
  for(const language of ['en','ru']){
   const group:any={cases:0,valid_translations:0,wrong_language:0,untranslated:0,structural_failures:0,duration:0,requests:0,retries:0,generated_tokens:0,eval_duration:0};row.languages[language]=group;const languageStart=performance.now();
   for(const c of inputCases.filter((c:any)=>c.language===language)){
    controller.signal.throwIfAborted();const caseStart=performance.now(),requestStart=row.requests,retryStart=row.retries,tokenStart=row.generated_tokens,evalStart=row.eval_duration;let wire='',failure:string|undefined;
    for(let index=0;index<c.chunks.length;index++){
     let accepted=false;
     for(let attempt=0;attempt<2;attempt++){
      controller.signal.throwIfAborted();if(attempt){row.retries++;row.validation_retries++;}row.requests++;
      const t=performance.now();
      try{
       const response=await fetch(endpoint+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.any([controller.signal,AbortSignal.timeout(120000)]),body:JSON.stringify({model,stream:false,messages:[{role:'user',content:c.prompts[index]}],options:report.configuration.temperature===0?{temperature:0,num_ctx:4096,num_predict:2048}:{},keep_alive:'5m'})});
       if(!response.ok)throw new Error('PROVIDER_UNAVAILABLE');const body=await response.json() as any;row.successful_requests++;
       if(typeof body.eval_count==='number')row.generated_tokens+=body.eval_count;if(typeof body.eval_duration==='number')row.eval_duration+=body.eval_duration;
       const value=body.message?.content;await fs.appendFile(path.join(runDirectory,'responses.jsonl'),JSON.stringify({model,id:c.id,chunk:index,attempt,content:value??null})+'\n');const markers=(s:string)=>s.match(/\[\[PROTECTED_[^\]]+\]\]/g)||[];
       if(typeof value!=='string'||!value.trim()||body.done===false||body.done_reason==='length')throw new Error('RESPONSE_INVALID');
       if(JSON.stringify(markers(value))!==JSON.stringify(markers(c.chunks[index])))throw new Error('PLACEHOLDER_FAILURE');
       if(/^\s*```|^\s*(?:translation|traducción)\s*:/i.test(value))throw new Error('OUTPUT_FORMAT_FAILURE');
       wire+=(c.chunks[index].match(/^\s*/)?.[0]||'')+value.trim()+(c.chunks[index].match(/\s*$/)?.[0]||'');accepted=true;row.chunks++;break;
      }catch(error){controller.signal.throwIfAborted();failure=error instanceof Error?error.message:'PROVIDER_FAILURE';row.attempt_failures.push({id:c.id,chunk:index,attempt,reason:failure});}
      finally{row.latencies.push((performance.now()-t)/1000);}
     }
     if(!accepted)break;failure=undefined;
    }
    const result=failure?{valid:false,structural_pass:failure!=='PLACEHOLDER_FAILURE',wrong_language:false,untranslated:false,target:null,reasons:[failure],quality:{status:'FAILED',reasons:[failure]}}:benchmarkQualityGate(c.source,wire,c.tags.includes('javascript'));
    row.cases.push({id:c.id,language,tags:c.tags,source:c.source,...result,reference:c.reference,reference_exact:result.target!==null&&c.reference?result.target===c.reference.target:null,duration:(performance.now()-caseStart)/1000});
    group.cases++;if(result.valid){row.valid_translations++;group.valid_translations++;}else row.validation_failures++;
    if(!result.structural_pass){row.structural_failures++;group.structural_failures++;}
    if(result.wrong_language){row.wrong_language++;group.wrong_language++;}if(result.untranslated){row.untranslated++;group.untranslated++;}
    for(const [reason,key] of [['PLACEHOLDER_FAILURE','placeholder_failures'],['HTML_FAILURE','html_failures'],['UUID_FAILURE','uuid_failures'],['ROLL_FAILURE','roll_failures']])if(result.reasons.includes(reason))row[key]++;
    if(!result.valid)row.fallbacks++;group.requests+=row.requests-requestStart;group.retries+=row.retries-retryStart;group.generated_tokens+=row.generated_tokens-tokenStart;group.eval_duration+=row.eval_duration-evalStart;
    if(performance.now()-lastRam>5000){const ram=await ollamaRam();if(ram!==null)row.peak_ollama_ram_bytes=Math.max(row.peak_ollama_ram_bytes??0,ram);lastRam=performance.now();}
    await checkpoint();if(group.cases%10===0)console.log(JSON.stringify({model,language,completed:group.cases,requests:row.requests,valid:row.valid_translations,gpu:guard.max_gpu}));
   }
   group.duration=(performance.now()-languageStart)/1000;group.strings_per_minute=group.cases/group.duration*60;group.tokens_per_second=group.eval_duration?group.generated_tokens/(group.eval_duration/1e9):null;
  }
  // Reinsert only frozen script segments into frozen full scripts, via the existing AST/gate.
  for(const script of corpus.script_validation_sources){const translated=new Map(row.cases.filter((c:any)=>c.target!==null&&c.structural_pass).map((c:any)=>[c.id,c]));const indices=new Map(corpus.cases.filter((c:any)=>c.file===script.file).map((c:any)=>[Number(c.context.json_path.at(-1)),c.id]));let offset=0;
   try{await translateScript(script.source,async request=>{const start=offset;offset+=request.texts.length;return request.texts.map((text,i)=>{const id=indices.get(start+i),entry=translated.get(id) as any;return entry?P.protect(entry.target).protectedText:text;});},new AbortController().signal,'ru',()=>{throw new Error('SCRIPT_INTERPOLATION_FAILURE');});}
   catch{row.javascript_failures++;row.structural_failures++;}offset=0;
  }
  row.status='COMPLETED_AWAITING_LINGUISTIC_REVIEW';
 }catch(error){row.status=controller.signal.reason?.message==='THERMAL_ABORT'?'THERMAL_ABORT':'ABORTED';row.reason=error instanceof Error?error.message:'BENCHMARK_FAILURE';}
 finally{
  clearTimeout(timeout);await guard.poll();guard.stop();row.duration=(performance.now()-started)/1000;row.average_latency=row.latencies.length?row.latencies.reduce((a:number,b:number)=>a+b,0)/row.latencies.length:null;row.strings_per_minute=row.cases.length/row.duration*60;row.tokens_per_second=row.eval_duration?row.generated_tokens/(row.eval_duration/1e9):null;row.peak_gpu_temperature=guard.max_gpu;row.peak_vram_temperature=guard.max_memory;row.thermal=guard.report();
  try{await fetch(endpoint+'/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model,keep_alive:0}),signal:AbortSignal.timeout(10000)});}catch{}
  await checkpoint();console.log(JSON.stringify({model,status:row.status,completed:row.cases.length,duration:row.duration,structural_failures:row.structural_failures,valid:row.valid_translations}));
 }
 if(row.status==='THERMAL_ABORT'||row.status==='ABORTED'){report.status=row.status;break;}
}
for(const [source,hash]of originalHashes)if(hash!==hashKey(await fs.readFile(source)))throw new Error('SOURCE_CHANGED');
if(hashKey(bytes)!==hashKey(await fs.readFile(file))||memoryBefore!==hashKey(await fs.readFile(database)))throw new Error('FROZEN_MEMORY_CHANGED');
report.originals_unchanged=true;report.memory_unchanged=true;report.corpus_unchanged=true;if(report.status==='RUNNING')report.status='COMPLETED_AWAITING_LINGUISTIC_REVIEW';await checkpoint();
