import fs from 'node:fs/promises';import path from 'node:path';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {MemoryStore} from '../desktop/memory/store';import {generatePdfAlignments,bindPdfAlignment} from '../desktop/memory/pdfAlignment';import {PdfReuse} from '../desktop/memory/pdfReuse';import {pdfHash} from '../desktop/memory/pdfCorpus';
const [command,...args]=process.argv.slice(2),directory=path.resolve(process.env.APPDATA||'','foundry-translator/translation-memory'),database=path.join(directory,'store.json');
if(!['generate','bind','audit'].includes(command))throw new Error('Usage: managePdfMemory.ts generate | audit | bind entryId moduleRoot file jsonPath');
const before=await fs.readFile(database);let backup:string|undefined;
if(command!=='audit'){
 const processes=await promisify(execFile)('powershell.exe',['-NoProfile','-NonInteractive','-Command',"@(Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'Traductor Foundry.exe' -or ($_.Name -eq 'electron.exe' -and $_.CommandLine -like '*Translate*') }).Count"],{windowsHide:true});
 if(Number(processes.stdout.trim()))throw new Error('Close the translator before changing its private memory.');
 backup=path.join(directory,'backups',new Date().toISOString().replace(/[:.]/g,'-')+'-before-pdf-alignment.json');await fs.mkdir(path.dirname(backup),{recursive:true});await fs.writeFile(backup,before,{flag:'wx'});
}
const store=await new MemoryStore(directory).load(),originalIds=new Set(store.readEntries().map(entry=>entry.id)),approvedBefore=store.statistics().approved_entries;
const result=command==='generate'?await generatePdfAlignments(store):command==='bind'?await bindPdfAlignment(store,args[0],args[1],args[2],JSON.parse(args[3])):new PdfReuse(store).statistics();
const after=await fs.readFile(database),remaining=new Set(store.readEntries().map(entry=>entry.id));
if(store.statistics().approved_entries!==approvedBefore||[...originalIds].some(id=>!remaining.has(id))||command==='audit'&&pdfHash(before)!==pdfHash(after))throw new Error('PDF_MEMORY_POSTCONDITION_FAILED');
const report={schema_version:1,operation:command,result,memory:store.statistics(),backup,old_entries_preserved:true,approved_automatically:0,inference_requests:0,sha256_before:pdfHash(before),sha256_after:pdfHash(after)};
await fs.mkdir('reports/pdf-memory',{recursive:true});await fs.writeFile('reports/pdf-memory/'+command+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
