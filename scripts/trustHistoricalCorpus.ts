import fs from 'node:fs/promises';import path from 'node:path';
import {MemoryStore,hashKey} from '../desktop/memory/store';import {pdfHash} from '../desktop/memory/pdfCorpus';
import {inventory} from '../desktop/translation/inventory';import {importTrustedBabele,scanHistoricalBabele} from '../desktop/memory/historicalBabeleImport';
const paths=process.argv.slice(2).filter(a=>!a.startsWith('--'));
const moduleRoot=paths[0]||'C:/Users/leond/AppData/Local/FoundryVTT/Data/modules/fifthpendium',corpusRoot=paths[1]||'C:/Users/leond/OneDrive/Escritorio/spanish';
if(!process.argv.includes('--user-approved-corpus'))throw new Error('EXPLICIT_CORPUS_TRUST_DECLARATION_REQUIRED');
const directory=path.resolve(process.env.APPDATA||'','foundry-translator/translation-memory'),database=path.join(directory,'store.json'),bytes=await fs.readFile(database),before=pdfHash(bytes),store=await new MemoryStore(directory).load(),data=await inventory(moduleRoot);
const backups=path.join(directory,'backups');await fs.mkdir(backups,{recursive:true});const backup=path.join(backups,'T077-before-'+before+'.json');try{await fs.writeFile(backup,bytes,{flag:'wx'});}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;}
const imported=await importTrustedBabele(corpusRoot,data.units,store),first=pdfHash(await fs.readFile(database)),stats=store.statistics(),revision=store.revision;
const repeated=await importTrustedBabele(corpusRoot,data.units,store),second=pdfHash(await fs.readFile(database));if(first!==second||revision!==store.revision||JSON.stringify(stats)!==JSON.stringify(store.statistics()))throw new Error('IMPORT_NOT_IDEMPOTENT');
const after=await inventory(moduleRoot),source=await scanHistoricalBabele(corpusRoot,data.units);if(hashKey(data.fingerprints)!==hashKey(after.fingerprints)||source.source_fingerprint!==imported.source_fingerprint)throw new Error('ORIGINAL_SOURCE_CHANGED');
await fs.mkdir('reports/canonical-memory',{recursive:true});await fs.writeFile('reports/canonical-memory/tm-conflicts.json',JSON.stringify({schema_version:1,status:'TM_CONFLICT',conflicts:imported.conflicts},null,2));
const report={schema_version:1,mode:'USER_APPROVED_CORPUS_IMPORT_NO_INFERENCE',...imported,conflicts:imported.conflicts.length,reimport:repeated,source_unchanged:true,module_unchanged:true,idempotent:true,memory_before_sha256:before,memory_after_sha256:second,backup,canonical_identity_created:0,ollama_requests:0,statistics:stats};
await fs.writeFile('reports/canonical-memory/trusted-import.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,reimport:{created:repeated.created,unchanged:repeated.unchanged},reasons:undefined}));
