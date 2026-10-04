import fs from 'node:fs/promises';import path from 'node:path';
import {discoverModule} from '../moduleDiscovery';import {parseJsonStrict} from '../../src/services/json/strictJson';
import {MemoryStore,hashKey} from './store';import {pdfHash} from './pdfCorpus';import {reusable} from '../translation/reuse';import type {InventoryUnit} from '../translation/inventory';
import {historicalContext,historicalPolicy,historicalImportVersion,type HistoricalSource,type TrustedHistoricalCorpus} from './historicalTrust';

/** Host-side adapter only. No Babele converters, runtime dependency or output format. */
export async function scanHistoricalBabele(folder:string,units:InventoryUnit[]){
 const root=await fs.realpath(folder),files=(await discoverModule(root)).files.filter(f=>/\.json$/i.test(f.relative)).sort((a,b)=>a.relative.localeCompare(b.relative));
 const reasons:Record<string,number>={},add=(reason:string)=>{reasons[reason]=(reasons[reason]||0)+1;};const hashes:Record<string,string>={};
 const byPackId=new Map<string,InventoryUnit[]>(),byPackName=new Map<string,InventoryUnit[]>();
 const rootNames=new Map(units.filter(u=>JSON.stringify(u.context.json_path)==='["name"]').map(u=>[u.file,u.source]));
 for(const unit of units){const c=historicalContext(unit.context);if(!c)continue;const id=unit.identity_evidence?.document_id||unit.context.canonical_uuid?.split('.').at(-1),pack=c.module+'.'+c.pack;
  for(const [map,key] of [[byPackId,pack+':'+id],[byPackName,pack+':'+rootNames.get(unit.file)]] as const){const rows=map.get(key)||[];rows.push(unit);map.set(key,rows);}}
 let entries=0,embedded=0;
 const pairs=new Map<string,{source:string;target:string;historical:HistoricalSource}>();
 for(const file of files){if((await fs.lstat(file.absolute)).size>50000000){add('HISTORICAL_FILE_TOO_LARGE');continue;}const bytes=await fs.readFile(file.absolute);hashes[file.relative]=pdfHash(bytes);let value:any;
  try{value=parseJsonStrict(bytes.toString('utf8'));}catch{add('HISTORICAL_PARSE_FAILED');continue;}
  if(!value?.entries||Array.isArray(value.entries)||typeof value.entries!=='object'){add('HISTORICAL_FORMAT_UNSUPPORTED');continue;}
  const pack=path.basename(file.relative,'.json');
  const collect=(unit:InventoryUnit,target:string,key:string,observed:boolean)=>{
   if(!/[\u0400-\u04ff]/.test(unit.source)){add('HISTORICAL_SOURCE_LANGUAGE_NOT_RU');return;}if(!reusable(unit.source,target,unit.context)){add('HISTORICAL_FIELD_VALIDATION_FAILED');return;}
   const context=historicalContext(unit.context)!;const identity=hashKey([unit.source,target,context]);const prior=pairs.get(identity),occurrence={file:unit.file,json_path:[...(unit.context.json_path||[])]};
   if(prior){if(!prior.historical.occurrences.some(o=>JSON.stringify(o)===JSON.stringify(occurrence)))prior.historical.occurrences.push(occurrence);if(observed&&prior.historical.source_binding!=='LITERAL_RU_KEY'){prior.historical.source_binding='LITERAL_RU_KEY';prior.historical.source_file=file.relative;prior.historical.source_file_hash=hashes[file.relative];prior.historical.entry_key=key;}return;}
   pairs.set(identity,{source:unit.source,target,historical:{provenance:'HISTORICAL_BABELE',translation_origin:'USER_TRANSLATED',translation_approval:'REVIEW_REQUIRED',source_corpus:'historical-babele-ru-es',source_file:file.relative,source_file_hash:hashes[file.relative],entry_key:key,import_version:historicalImportVersion,canonical_identity:'UNKNOWN',reuse_policy:historicalPolicy(unit.source),context,source_binding:observed?'LITERAL_RU_KEY':'NATIVE_FIELD_PROJECTION',occurrences:[occurrence]}});
  };
  const embeddedNames=(object:any,relevant:InventoryUnit[],breadcrumb:string,depth=0)=>{
   if(depth>8||!object||typeof object!=='object'||Array.isArray(object)){add('HISTORICAL_EMBEDDED_OR_CONVERTER_UNSUPPORTED');return;}
   for(const [key,child] of Object.entries(object) as [string,any][]){embedded++;const target=typeof child==='string'?child:child?.name;
    if(typeof target==='string'&&/[\u0400-\u04ff]/.test(key))for(const unit of relevant.filter(u=>u.source===key&&u.context.json_path?.at(-1)==='name'&&u.context.json_path.length>1))collect(unit,target,breadcrumb+'.'+key,true);
    if(child?.items)embeddedNames(child.items,relevant,breadcrumb+'.'+key+'.items',depth+1);
    if(child?.description)add('HISTORICAL_EMBEDDED_DESCRIPTION_SOURCE_UNAVAILABLE');
   }
  };
  for(const [key,entry] of Object.entries(value.entries) as [string,any][]){entries++;if(!entry||typeof entry!=='object'){add('HISTORICAL_ENTRY_UNSUPPORTED');continue;}
   const relevant=(/^\w{16}$/.test(key)?byPackId:byPackName).get(pack+':'+key)||[];
   if(new Set(relevant.map(u=>u.file)).size!==1){add('HISTORICAL_SOURCE_NOT_UNIQUE');continue;}
   for(const [field,target] of Object.entries(entry)){
    if(field==='items'&&target&&typeof target==='object'){embeddedNames(target,relevant,key+'.items');continue;}
    if(typeof target!=='string'){add('HISTORICAL_EMBEDDED_OR_CONVERTER_UNSUPPORTED');continue;}
    let location:any=field==='name'?'name':value.mapping?.[field];if(location&&typeof location==='object'){if(location.converter){add('HISTORICAL_CONVERTER_NOT_EXECUTED');continue;}location=location.path;}
    if(typeof location!=='string'){add('HISTORICAL_FIELD_MAPPING_NOT_EXPLICIT');continue;}
    const matched=relevant.filter(u=>u.context.json_path?.join('.')===location);if(!matched.length){add('HISTORICAL_TRANSLATABLE_FIELD_NOT_FOUND');continue;}
    for(const unit of matched)collect(unit,target,key,field==='name'&&key===unit.source);
   }
  }
 }
 const grouped=new Map<string,typeof pairs extends Map<string,infer T>?T[]:never>();for(const row of pairs.values()){const key=hashKey([row.source,row.historical.context]),rows=grouped.get(key)||[];rows.push(row);grouped.set(key,rows);}
 const conflicts=[...grouped.entries()].filter(([,rows])=>new Set(rows.map(r=>r.target)).size>1).map(([id,rows])=>{for(const row of rows)row.historical.reuse_policy='CONFLICT';return {id,status:'TM_CONFLICT',source_ru:rows[0].source,candidate_es:[...new Set(rows.map(r=>r.target))],contexts:[rows[0].historical.context],occurrences:rows.flatMap(r=>r.historical.occurrences),provenance:'HISTORICAL_BABELE',source_files:[...new Set(rows.map(r=>r.historical.source_file))]};});
 return {root,files:hashes,source_fingerprint:hashKey(hashes),entries_loaded:entries,embedded_entries_loaded:embedded,unique_groups:grouped.size,rows:[...pairs.values()],conflicts,reasons};
}
export async function importTrustedBabele(folder:string,units:InventoryUnit[],store:MemoryStore){
 const plan=await scanHistoricalBabele(folder,units),previous=store.trustedCorpora()['historical-babele-ru-es'];
 const corpus:TrustedHistoricalCorpus={id:'historical-babele-ru-es',provenance:'HISTORICAL_BABELE',translation_origin:'USER_TRANSLATED',trust:'USER_APPROVED_TRANSLATION_CORPUS',translation_approval:'APPROVED_MANUAL',root:plan.root,fingerprint:plan.source_fingerprint,files:plan.files,approved_by:'LOCAL_USER_EXPLICIT_CORPUS_DECLARATION',approved_at:previous?.approved_at||new Date().toISOString(),import_version:historicalImportVersion};
 // Trust is sealed over the current source snapshot. No reread of historical files at runtime.
 for(const [relative,sha] of Object.entries(plan.files))if(pdfHash(await fs.readFile(path.join(plan.root,relative)))!==sha)throw new Error('TRUSTED_SOURCE_CHANGED');
 const imported=await store.importTrustedHistorical(corpus,plan.rows,store.revision);
 return {...imported,source_fingerprint:plan.source_fingerprint,babele_entries_loaded:plan.entries_loaded,babele_unique_groups:plan.unique_groups,conflicts:plan.conflicts,reasons:plan.reasons};
}
export async function auditHistoricalBabele(folder:string,units:InventoryUnit[],store:MemoryStore){
 const plan=await scanHistoricalBabele(folder,units),groups=new Map<string,(typeof plan.rows)[number][]>();for(const row of plan.rows){const key=hashKey([row.source,row.historical.context]);groups.set(key,[...(groups.get(key)||[]),row]);}
 let approved=0,unverified=0,exact=0;for(const rows of groups.values()){if(rows.some(r=>r.historical.source_binding==='LITERAL_RU_KEY'))exact++;if(rows.some(r=>r.historical.reuse_policy==='CONFLICT'))continue;const row=rows[0],unit=units.find(u=>u.source===row.source&&historicalContext(u.context)&&hashKey(historicalContext(u.context))===hashKey(row.historical.context));const hit=unit&&store.exact(row.source,'ru',unit.context);if(hit?.translated_text===row.target)approved++;else unverified++;}
 return {schema_version:2,policy:'USER_DECLARED_APPROVED_CORPUS_TEXTUAL_TM_ONLY',babele_entries_loaded:plan.entries_loaded,babele_embedded_entries_loaded:plan.embedded_entries_loaded,babele_field_candidates:plan.unique_groups,babele_ru_es_exact_candidates:exact,babele_approved_hits:approved,babele_historical_unverified_hits:unverified,conflicting_groups:plan.conflicts.length,canonical_mappings_created:0,approved_automatically:0,reasons:plan.reasons,source_fingerprint:plan.source_fingerprint};
}
