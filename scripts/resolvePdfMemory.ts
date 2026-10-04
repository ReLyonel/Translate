import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {MemoryStore,hashKey} from '../desktop/memory/store';import {pdfHash} from '../desktop/memory/pdfCorpus';import {generatePdfAlignments} from '../desktop/memory/pdfAlignment';import {resolvePdfMemory} from '../desktop/memory/pdfResolution';import {canonicalResolution} from '../desktop/memory/canonicalResolution';import {inventory} from '../desktop/translation/inventory';
const directory=path.resolve(process.env.APPDATA||'','foundry-translator/translation-memory'),root=process.argv[2]||'C:/Users/leond/AppData/Local/FoundryVTT/Data/modules/fifthpendium',before=pdfHash(await fs.readFile(path.join(directory,'store.json'))),temporary=await fs.mkdtemp(path.join(os.tmpdir(),'pdf-repro-'));
let reproducibility:unknown;
try{
 await fs.copyFile(path.join(directory,'store.json'),path.join(temporary,'store.json'));await fs.cp(path.join(directory,'pdf-reference'),path.join(temporary,'pdf-reference'),{recursive:true});
 const a=await new MemoryStore(temporary).load(),first=await generatePdfAlignments(a),ids=()=>hashKey(a.readEntries().filter(e=>e.pdf).map(e=>e.id).sort()),firstHash=ids(),firstBytes=pdfHash(await fs.readFile(path.join(temporary,'store.json'))),second=await generatePdfAlignments(a);
 if(first.new_entries!==0||second.new_entries!==0||firstHash!==ids()||firstBytes!==pdfHash(await fs.readFile(path.join(temporary,'store.json'))))throw new Error('PDF_GENERATION_NOT_REPRODUCIBLE');
 reproducibility={first,second,ids_hash:firstHash,idempotent:true,approval_changes:0};
}finally{const resolved=path.resolve(temporary);if(!resolved.startsWith(path.resolve(os.tmpdir())+path.sep)||!path.basename(resolved).startsWith('pdf-repro-'))throw new Error('TEMP_PATH_INVALID');await fs.rm(resolved,{recursive:true,force:true});}
const store=await new MemoryStore(directory).load(),resolution=resolvePdfMemory(store),data=await inventory(root),canonical=canonicalResolution(store,data.units);
if(before!==pdfHash(await fs.readFile(path.join(directory,'store.json'))))throw new Error('READONLY_MEMORY_CHANGED');
await fs.mkdir('reports/pdf-resolution',{recursive:true});await fs.writeFile('reports/pdf-resolution/resolution.json',JSON.stringify({mode:'READ_ONLY_NO_INFERENCE',reproducibility,resolution,canonical,memory_unchanged:true},null,2));console.log(JSON.stringify({reproducibility,resolution:{counts:resolution.counts,groups:resolution.groups_total,duplicates:resolution.duplicates,auto:resolution.auto_approvable.length},canonical:{...canonical,bindings:undefined}}));
