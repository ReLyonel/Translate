import { afterEach,expect,it,vi } from 'vitest';import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
import { RunLogger,safeDiagnostic,loadLogPolicy } from '../../desktop/logging/runLogger';import { runLoggedBatch,runLoggedTranslation } from '../../desktop/logging/runReport';import { MemoryStore } from '../../desktop/memory/store';import { providers } from '../../desktop/providers';
const roots:string[]=[];afterEach(async()=>{vi.restoreAllMocks();for(const root of roots.splice(0))await fs.rm(root,{recursive:true,force:true});});
async function fixture(){const root=await fs.mkdtemp(path.join(os.tmpdir(),'logs-'));roots.push(root);return root;}
it('drops secret fields, raw content and credential-like values',()=>{const diagnostic=safeDiagnostic({source:'private prose',api_key:'private-key',reason:'secret=private-key',status:'FAILED',file:'pack/item.json'});expect(JSON.stringify(diagnostic)).not.toContain('private');expect(diagnostic.status).toBe('FAILED');});
it('rotates bounded logs and preserves unrelated files',async()=>{
 const root=await fixture();await fs.writeFile(path.join(root,'keep.txt'),'keep');const logger=await new RunLogger(root,{maxBytes:300,maxFiles:2,maxRuns:2,retentionDays:30}).init();for(let index=0;index<20;index++)await logger.event('app',{status:'WARNING',reason:'TEST_'+index});const names=await fs.readdir(root);expect(names).not.toContain('app.log.3');for(const name of names.filter(name=>name.startsWith('app.log')))expect((await fs.stat(path.join(root,name))).size).toBeLessThanOrEqual(300);expect(await fs.readFile(path.join(root,'keep.txt'),'utf8')).toBe('keep');
});
it('retains only bounded managed run directories',async()=>{const root=await fixture();for(let index=0;index<4;index++)await new RunLogger(root,{maxBytes:300,maxFiles:2,maxRuns:2,retentionDays:30}).init();expect((await fs.readdir(path.join(root,'runs'))).length).toBeLessThanOrEqual(2);});
it('writes all four report artifacts and reconciles success counters',async()=>{
 const root=await fixture(),input=path.join(root,'input'),output=path.join(root,'output');await fs.mkdir(path.join(input,'packs/items/_source'),{recursive:true});await fs.writeFile(path.join(input,'packs/items/_source/a.json'),'{"name":"Sword"}');const store=await new MemoryStore(path.join(root,'memory')).load();vi.spyOn(providers.ollama,'translate').mockResolvedValue(['Espada']);let report='';
 await runLoggedBatch(input,output,{endpoint:'http://localhost:11434',model:'translategemma:27b'},store,path.join(root,'logs'),new AbortController().signal,()=>{},'en','job',[],directory=>report=directory);
 expect((await fs.readdir(report)).sort()).toEqual(['errors.json','skipped.json','summary.json','warnings.json']);const summary=JSON.parse(await fs.readFile(path.join(report,'summary.json'),'utf8'));expect(summary.processed+summary.unprocessed).toBe(summary.total);expect(summary.metrics.strings_detected).toBe(1);expect(summary.metrics.strings_unique).toBe(1);expect(summary.output_strategy).toBe('TRANSLATION_OVERLAY');expect(summary.publication).toEqual({files_scanned:1,files_translated:1,files_unchanged:0,files_written:1,assets_skipped:0,bytes_avoided:0});
});
it('creates all log channels even without errors or warnings',async()=>{
 const root=await fixture();await new RunLogger(root).init();
 for(const name of ['app.log','errors.log','translation.log'])expect((await fs.stat(path.join(root,name))).isFile()).toBe(true);
});
it('exports a cancelled run without creating an output or trusted TM',async()=>{
 const root=await fixture(),input=path.join(root,'input');await fs.mkdir(input);const store=await new MemoryStore(path.join(root,'memory')).load();const controller=new AbortController();controller.abort();let report='';
 await expect(runLoggedBatch(input,path.join(root,'output'),{endpoint:'http://localhost:11434',model:'translategemma:27b'},store,path.join(root,'logs'),controller.signal,()=>{},'en','cancel',[],directory=>report=directory)).rejects.toThrow();
 expect(JSON.parse(await fs.readFile(path.join(report,'summary.json'),'utf8')).status).toBe('CANCELLED');expect(store.entries()).toEqual([]);
 await expect(fs.stat(path.join(root,'output'))).rejects.toThrow();
});
it('records early job failures with all four artifacts',async()=>{
 const root=await fixture(),input=path.join(root,'input'),output=path.join(root,'output');await fs.mkdir(input);await fs.mkdir(output);const store=await new MemoryStore(path.join(root,'memory')).load();let report='';
 await expect(runLoggedBatch(input,output,{endpoint:'http://localhost:11434',model:'translategemma:27b'},store,path.join(root,'logs'),new AbortController().signal,()=>{},'en','error',[],directory=>report=directory)).rejects.toThrow();
 expect(JSON.parse(await fs.readFile(path.join(report,'summary.json'),'utf8')).status).toBe('ERROR');expect(JSON.parse(await fs.readFile(path.join(report,'errors.json'),'utf8'))[0].reason).toBe('JOB_FAILED');
 expect((await fs.readdir(report)).length).toBe(4);
});
it('recovers only a suspicious string and marks the published file WARNING',async()=>{
 const root=await fixture(),input=path.join(root,'input'),output=path.join(root,'output');await fs.mkdir(path.join(input,'packs/items/_source'),{recursive:true});await fs.writeFile(path.join(input,'packs/items/_source/a.json'),'{"name":"Sword","description":"Make an attack roll"}');const store=await new MemoryStore(path.join(root,'memory')).load();
 vi.spyOn(providers.ollama,'translate').mockImplementation(async(_settings,request)=>[request.texts[0]==='Sword'?'Translation: Espada':'Realiza una tirada de ataque']);
 let report='';const progress=await runLoggedBatch(input,output,{endpoint:'http://localhost:11434',model:'translategemma:27b'},store,path.join(root,'logs'),new AbortController().signal,()=>{},'en','recovery',[],directory=>report=directory);
 const result=JSON.parse(await fs.readFile(path.join(output,'packs/items/_source/a.json'),'utf8'));expect(result.name).toBe('Sword');expect(result.description).toBe('Realiza una tirada de ataque');expect(progress.outcomes?.[0].status).toBe('WARNING');expect(progress.recoveredStrings).toBe(1);expect(progress.validated).toBe(0);
 const warnings=JSON.parse(await fs.readFile(path.join(report,'warnings.json'),'utf8'));expect(warnings.some((item:any)=>item.reason==='MODEL_EXPLANATION')).toBe(true);expect(store.entries().every(entry=>entry.source_text!=='Sword')).toBe(true);
});
it('a noncritical language warning cannot count a file as COMPLETED or enter cache',async()=>{
 const root=await fixture(),input=path.join(root,'input');await fs.mkdir(path.join(input,'packs/items/_source'),{recursive:true});await fs.writeFile(path.join(input,'packs/items/_source/a.json'),JSON.stringify({description:'A detailed description of the mysterious ancient castle where travelers meet before leaving for their adventure.'}));const store=await new MemoryStore(path.join(root,'memory')).load();
 vi.spyOn(providers.ollama,'translate').mockResolvedValue(['Mystic bronze lanterns illuminate silver chambers beyond silent marble corridors near ancient sapphire portals.']);
 const progress=await runLoggedBatch(input,path.join(root,'output'),{endpoint:'http://localhost:11434',model:'translategemma:27b'},store,path.join(root,'logs'),new AbortController().signal,()=>{},'en','warning');
 expect(progress.outcomes?.[0].status).toBe('WARNING');expect(progress.validated).toBe(0);expect(store.entries()).toEqual([]);
});
it('direct translations also create redacted error reports',async()=>{
 const root=await fixture(),store=await new MemoryStore(path.join(root,'memory')).load();let report='';vi.spyOn(providers.ollama,'translate').mockRejectedValue(new Error('Bearer private-secret'));
 await expect(runLoggedTranslation({texts:['private source'],sourceLanguage:'en'},{endpoint:'http://localhost:11434',model:'translategemma:27b'},store,path.join(root,'logs'),directory=>report=directory)).rejects.toThrow();
 const errors=await fs.readFile(path.join(report,'errors.json'),'utf8');expect(errors).not.toContain('private');expect(JSON.parse(errors)[0].reason).toBe('TRANSLATION_FAILED');
});
it('loads persistent retention settings and rejects nonfinite limits',async()=>{
 const root=await fixture();await fs.writeFile(path.join(root,'log-policy.json'),'{"maxBytes":800,"maxRuns":3}');
 expect(await loadLogPolicy(root)).toMatchObject({maxBytes:800,maxRuns:3,maxFiles:3,retentionDays:30});
 expect(()=>new RunLogger(root,{maxBytes:Infinity,maxRuns:3,maxFiles:3,retentionDays:30})).toThrow('LOG_POLICY_INVALID');
});
it('retention removes aged managed runs and preserves unrelated directories',async()=>{
 const root=await fixture();const old=await new RunLogger(root).init();const oldDirectory=path.join(root,'runs',old.run);const date=new Date(Date.now()-40*86400000);await fs.utimes(oldDirectory,date,date);
 await fs.mkdir(path.join(root,'runs','keep'));await new RunLogger(root).init();await expect(fs.stat(oldDirectory)).rejects.toThrow();expect((await fs.stat(path.join(root,'runs','keep'))).isDirectory()).toBe(true);
});
it('a memory disk failure stops the job rather than being reported as provider recovery',async()=>{
 const root=await fixture(),input=path.join(root,'input');await fs.mkdir(path.join(input,'packs/items/_source'),{recursive:true});await fs.writeFile(path.join(input,'packs/items/_source/a.json'),'{"name":"Sword"}');const store=await new MemoryStore(path.join(root,'memory')).load();
 vi.spyOn(providers.ollama,'translate').mockResolvedValue(['Espada']);vi.spyOn(store,'candidate').mockRejectedValue(Object.assign(new Error('disk full'),{code:'ENOSPC'}));let report='';
 await expect(runLoggedBatch(input,path.join(root,'output'),{endpoint:'http://localhost:11434',model:'translategemma:27b'},store,path.join(root,'logs'),new AbortController().signal,()=>{},'en','disk',[],directory=>report=directory)).rejects.toThrow('disk full');
 const errors=JSON.parse(await fs.readFile(path.join(report,'errors.json'),'utf8'));expect(errors[0].reason).toBe('IO_FAILURE');expect(await fs.readFile(path.join(input,'packs/items/_source/a.json'),'utf8')).toBe('{"name":"Sword"}');
});
