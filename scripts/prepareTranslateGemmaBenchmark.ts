import fs from 'node:fs/promises';import path from 'node:path';import {parse} from 'acorn';
import {inventory} from '../desktop/translation/inventory';import {inspectScript} from '../desktop/scriptTranslation';
import {MemoryStore,hashKey} from '../desktop/memory/store';import {prepareCase,selectCases} from '../desktop/benchmark/corpus';
import {readNvidia} from '../desktop/thermal';import {promptVersion,promptLimits} from '../desktop/translation/prompt';

const root='C:/Users/leond/AppData/Local/FoundryVTT/Data/modules/fifthpendium';
const directory=path.resolve(process.env.APPDATA!,'foundry-translator/translation-memory'),database=path.join(directory,'store.json'),before=hashKey(await fs.readFile(database));
const store=await new MemoryStore(directory).load(),data=await inventory(root),candidates=data.units.map(prepareCase).filter(c=>c!==undefined);
const scriptFiles=new Map<string,{source:string;spans:ReturnType<typeof inspectScript>;templates:{start:number;end:number;expressions:string[]}[]} >();
for(const candidate of candidates){
 if(candidate.tags.includes('javascript')){
  let script=scriptFiles.get(candidate.file);
  if(!script){const source=await fs.readFile(path.join(root,candidate.file),'utf8'),templates:{start:number;end:number;expressions:string[]}[]=[];const tree=parse(source,{ecmaVersion:'latest',sourceType:candidate.file.endsWith('.cjs')?'script':'module'});
   const walk=(node:any)=>{if(!node||typeof node!=='object')return;if(node.type==='TemplateLiteral')templates.push({start:node.start,end:node.end,expressions:node.expressions.map((e:any)=>source.slice(e.start,e.end))});for(const value of Object.values(node))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);};walk(tree);script={source,spans:inspectScript(source),templates};scriptFiles.set(candidate.file,script);
  }
  const index=Number(candidate.context.json_path?.at(-1)),span=script.spans[index];
  if(span){const vicinity=script.source.slice(Math.max(0,span.start-500),span.end+100);if(vicinity.includes('Dialog'))candidate.tags.push('dialog');if(vicinity.includes('notifications.'))candidate.tags.push('notification');if(span.template)candidate.tags.push('template');}
 }
 const entry=store.exact(candidate.source,candidate.language,candidate.context);
 if(entry?.approved&&!entry.pdf)candidate.reference={target:entry.translated_text,entry_id:entry.id,approval:'APPROVED',provenance:entry.historical?.provenance||entry.translation_engine};
}
const cases=selectCases(candidates),coverage=Object.fromEntries([...new Set(cases.flatMap(c=>c.tags))].sort().map(tag=>[tag,cases.filter(c=>c.tags.includes(tag)).length]));
const scripts=[...new Set(cases.filter(c=>c.tags.includes('javascript')).map(c=>c.file))].map(file=>{const script=scriptFiles.get(file)!;return {file,source:script.source,source_hash:hashKey(script.source),authorized_ranges:script.spans,templates:script.templates};});
const manifest={schema_version:2,mode:'PREPARED_NO_INFERENCE',root,corpus_hash:hashKey(cases),cases,script_validation_sources:scripts,coverage,approved_references:cases.filter(c=>c.reference).length,ground_truth_policy:'APPROVED_COMPATIBLE_TM_ONLY_PDF_AMBIGUOUS_EXCLUDED',glossary:[],prompt:{version:promptVersion,limits:promptLimits},serial:true,batching:false,concurrency:false};
let installed:string[]=[];try{const response=await fetch('http://127.0.0.1:11500/api/tags',{signal:AbortSignal.timeout(5000)});if(response.ok)installed=((await response.json()) as any).models.map((m:any)=>m.name);}catch{}
const models=['translategemma:4b','translategemma:12b','translategemma:27b'],missing=models.filter(m=>!installed.includes(m));
const pending=['translation_failures','wrong_language','untranslated_text','placeholder_failures','html_failures','uuid_failures','roll_failures','script_interpolation_failures','validation_retries','fallbacks','requests','successful_requests','retries','chunks','duration','average_latency','tokens_per_second','strings_per_minute','GPU_temperature','GPU_memory_temperature','VRAM_usage','RAM_usage','CPU_usage','semantic_quality','RU_quality','EN_quality'];
const report={schema_version:2,status:missing.length?'WAITING_FOR_MODELS':'PREPARED_AWAITING_RUN',installed,missing,corpus_hash:manifest.corpus_hash,segments:cases.length,EN:cases.filter(c=>c.language==='en').length,RU:cases.filter(c=>c.language==='ru').length,coverage,approved_references:manifest.approved_references,expected_initial_requests_per_model:cases.reduce((n,c)=>n+c.chunks.length,0),rows:models.map(model=>({model,status:installed.includes(model)?'NOT_RUN':'NOT_INSTALLED',...Object.fromEntries(pending.map(k=>[k,null]))})),gpu:await readNvidia(),default_model:'translategemma:27b',recommendation:'NO_COMPARATIVE_EVIDENCE_KEEP_EXISTING_DEFAULT',baseline:{strings_unique:29339,tm_hits:3984,cache_hits:0,glossary_hits:0,dedup_hits:623,strings_requiring_model:24379,estimated_model_requests:29949},request_gap:{extra_initial_requests:5570,retries:0,fallbacks:0,cause:'SEMANTIC_CHUNKING',policy:'INITIAL_ESTIMATE_EXCLUDES_RETRIES_AND_FALLBACKS'},ollama_inference_requests:0};
if(before!==hashKey(await fs.readFile(database)))throw new Error('BENCHMARK_CHANGED_MEMORY');
for(const file of scripts)if(file.source_hash!==hashKey(await fs.readFile(path.join(root,file.file),'utf8')))throw new Error('BENCHMARK_SOURCE_CHANGED');
await fs.mkdir('reports/benchmark',{recursive:true});await fs.writeFile('reports/benchmark/real-corpus.json',JSON.stringify(manifest,null,2));await fs.writeFile('reports/benchmark/preparation.json',JSON.stringify({...report,memory_unchanged:true},null,2));
console.log(JSON.stringify(report));
