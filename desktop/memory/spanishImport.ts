import fs from 'node:fs/promises';import path from 'node:path';import {parseJsonStrict} from '../../src/services/json/strictJson';import {discoverModule} from '../moduleDiscovery';import {inventory} from '../translation/inventory';import {MemoryStore} from './store';
import {reusable} from '../translation/reuse';
/** Offline reader only: no Babele runtime, converters, scripts or PDFs. Literal name keys only recover name fields; IDs do not approve source equivalence. */
export async function importSpanish(folder:string,moduleRoot:string,store:MemoryStore,dryRun=false){
 const root=await fs.realpath(folder),files=(await discoverModule(root)).files.filter(f=>/\.json$/i.test(f.relative)),units=(await inventory(moduleRoot)).units;let candidates=0,unmatched=0,unsupported=0;
 const pending:Parameters<MemoryStore['candidateBatch']>[0]=[];
 const compatibleUnits=new Map<string,Set<string>>();let structurallyCompatible=0;const names=new Map(units.filter(u=>JSON.stringify(u.context.json_path)==='["name"]').map(u=>[u.file,u.source]));
 for(const file of files){if((await fs.stat(file.absolute)).size>50000000){unsupported++;continue;}let v:any;try{v=parseJsonStrict(await fs.readFile(file.absolute,'utf8'));}catch{unsupported++;continue;}
  if(!v?.entries||Array.isArray(v.entries)){unsupported++;continue;}const packagePack=path.basename(file.relative,'.json');
  for(const [id,entry] of Object.entries(v.entries) as [string,any][]){if(!entry||typeof entry!=='object'||!/^\w{16}$/.test(id)&&!/[\u0400-\u04ff]/.test(id)){unmatched++;continue;}
   const relevant=units.filter(unit=>unit.context.canonical_uuid?.startsWith('Compendium.'+packagePack+'.')&&(/^\w{16}$/.test(id)?unit.context.canonical_uuid.endsWith('.'+id):names.get(unit.file)===id));if(new Set(relevant.map(u=>u.file)).size!==1){unmatched++;continue;}
   for(const [field,target] of Object.entries(entry)){if(typeof target!=='string'||!/^\w{16}$/.test(id)&&field!=='name'){unsupported++;continue;}let location:unknown=field==='name'?'name':v.mapping?.[field];if(location&&typeof location==='object')location=(location as any).path;if(typeof location!=='string'){unsupported++;continue;}
    for(const unit of relevant.filter(unit=>unit.context.json_path?.join('.')===location)){try{if(reusable(unit.source,target,unit.context)){structurallyCompatible++;const key=JSON.stringify([unit.context.canonical_uuid,unit.context.json_path]);const targets=compatibleUnits.get(key)||new Set<string>();targets.add(target);compatibleUnits.set(key,targets);}}catch{}if(!dryRun)pending.push({source:unit.source,target,language:/[\u0400-\u04ff]/.test(unit.source)?'ru':'en',context:unit.context,engine:'manual-spanish-import',model:'',reuseScope:'EXACT_SOURCE_ONLY'});candidates++;}
   }
  }
 }if(!dryRun)await store.candidateBatch(pending);return {files:files.length,candidates,structurally_compatible_candidates:structurallyCompatible,reviewable_unique_units:compatibleUnits.size,conflicting_units:[...compatibleUnits.values()].filter(targets=>targets.size>1).length,unmatched,unsupported,approved_automatically:0,policy:'REVIEW_REQUIRED'};
}
