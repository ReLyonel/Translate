import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';
import {MemoryStore} from '../desktop/memory/store';import {translationPreflight} from '../desktop/translation/preflight';import {importSpanish} from '../desktop/memory/spanishImport';
const moduleRoot=process.argv[2]||'C:/Users/leond/AppData/Local/FoundryVTT/Data/modules/fifthpendium';
const spanish=process.argv[3]||'C:/Users/leond/OneDrive/Escritorio/spanish';
const userData=path.join(process.env.APPDATA||'','foundry-translator');const database=path.join(userData,'translation-memory/store.json');
const digest=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');const before=digest(await fs.readFile(database));
const store=await new MemoryStore(path.dirname(database)).load();
let settings={endpoint:'http://127.0.0.1:11500',model:'translategemma:27b'};try{settings=JSON.parse(await fs.readFile(path.join(userData,'provider.json'),'utf8'));}catch{}
const preflight=await translationPreflight(moduleRoot,'ru',store,settings);
const source=await importSpanish(spanish,moduleRoot,store,true);
if(before!==digest(await fs.readFile(database)))throw new Error('AUDIT_CHANGED_MEMORY');
const report={schema_version:1,mode:'READ_ONLY_NO_INFERENCE',preflight,spanish_source:source,memory_unchanged:true,memory_sha256:before,benchmark_12b_vs_27b:'NOT_RUN',source_policy:'JSON remains candidate. PDF reuse requires approved bilingual alignment and proven full native identity; names/positions alone never establish identity.',baseline:{accepted:false,reason:'NO_APPROVED_MEMORY_AND_ZERO_TRUSTED_HITS',historical:{files:4109,processed:1577,strings_translatable:10614,ollama_requests:12325,cancelled:true},comparable:false,comparison_reason:'Historical partial cancelled runtime versus complete discovery; estimated calls exclude retries and runtime failures.',reduction_percent:null}};
await fs.mkdir('reports/thermal-memory',{recursive:true});await fs.writeFile('reports/thermal-memory/preflight.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({files:preflight.files,strings:preflight.strings_translatable,unique:preflight.strings_unique,canonical:preflight.canonical_candidates,exact:preflight.exact_tm_candidates,cache:preflight.cache_candidates,ai:preflight.strings_requiring_ai,estimated_calls:preflight.estimated_model_calls,memory:preflight.memory,placement:preflight.placement,spanish:source,warnings:preflight.warnings}));
