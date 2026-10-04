import { afterEach, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { runBatch } from '../../desktop/jobs';
import type { BatchProgress } from '../../desktop/contracts';
const roots:string[]=[];
afterEach(async()=>{vi.restoreAllMocks();for(const root of roots.splice(0))await fs.rm(root,{recursive:true,force:true});});
async function fixture(){const root=await fs.mkdtemp(path.join(os.tmpdir(),'recovery-'));roots.push(root);const input=path.join(root,'input'),output=path.join(root,'output');await fs.mkdir(input);return {input,output};}
const signal=()=>new AbortController().signal;
it('recovers one damaged string while publishing other valid translations as WARNING',async()=>{
 const {input,output}=await fixture();const source={_id:'abcdefghijklmnop',name:'Sword',description:'Use @UUID[Item.example]'};await fs.writeFile(path.join(input,'item.json'),JSON.stringify(source));
 const result=await runBatch(input,output,async request=>request.texts.map(text=>text.startsWith('Sword')?'Espada':'Lost reference'),signal(),()=>{});
 const translated=JSON.parse(await fs.readFile(path.join(output,'item.json'),'utf8'));expect(translated.name).toBe('Espada');expect(translated.description).toBe(source.description);
 expect(result).toMatchObject({completed:1,failed:1,validated:0,recoveredStrings:1});expect(result.outcomes?.[0]).toMatchObject({status:'WARNING',outputKind:'RECOVERED'});expect(result.diagnostics?.[0]).toMatchObject({scope:'STRING',recovery:'ORIGINAL_RESTORED',pathSegments:['description']});
});
it('offline provider preserves all units and continues to next file',async()=>{
 const {input,output}=await fixture();for(const name of ['a','b'])await fs.writeFile(path.join(input,name+'.json'),JSON.stringify({name:'Sword'}));
 const result=await runBatch(input,output,async()=>{throw new Error('private credentials');},signal(),()=>{});
 expect(result.state).toBe('COMPLETED');expect(result.recoveredStrings).toBe(2);expect(result.outcomes?.every(file=>file.status==='WARNING')).toBe(true);expect(JSON.stringify(result)).not.toContain('credentials');
});
it('file-level parse failure keeps original bytes and other files continue',async()=>{
 const {input,output}=await fixture();await fs.writeFile(path.join(input,'a.json'),'broken');await fs.writeFile(path.join(input,'b.json'),'{"name":"Sword"}');
 const result=await runBatch(input,output,async request=>request.texts.map(()=> 'Espada'),signal(),()=>{},'auto',undefined,'folder',undefined,'FULL_PORTABLE_COPY');expect(await fs.readFile(path.join(output,'a.json'),'utf8')).toBe('broken');expect(result.outcomes?.find(file=>file.file==='a.json')).toMatchObject({outputKind:'ORIGINAL_FALLBACK',status:'WARNING'});expect(result.validated).toBe(1);
});
it('disk failure stops job, exposes JOB scope and leaves no partial file',async()=>{
 const {input,output}=await fixture();await fs.writeFile(path.join(input,'a.json'),'{"name":"Sword"}');const snapshots:BatchProgress[]=[];
 vi.spyOn(fs,'link').mockRejectedValueOnce(Object.assign(new Error('ENOSPC'),{code:'ENOSPC'}));await expect(runBatch(input,output,async request=>request.texts,signal(),progress=>snapshots.push(progress),'auto',undefined,'folder',undefined,'FULL_PORTABLE_COPY')).rejects.toThrow();expect(snapshots.at(-1)?.state).toBe('ERROR');expect(snapshots.at(-1)?.diagnostics?.at(-1)?.scope).toBe('JOB');expect(await fs.readdir(output)).toEqual([]);
});
it('recovers a script string without changing code or other visible strings',async()=>{
 const {input,output}=await fixture();await fs.mkdir(path.join(input,'scripts'));await fs.writeFile(path.join(input,'scripts/ui.mjs'),'const ui={title:"Sword",description:"Use @UUID[Item.example]"};');
 const result=await runBatch(input,output,async request=>request.texts.map(text=>text==='Sword'?'Espada':'Lost reference'),signal(),()=>{},'en',undefined,'module');
 expect(await fs.readFile(path.join(output,'scripts/ui.mjs'),'utf8')).toBe('const ui={title:"Espada",description:"Use @UUID[Item.example]"};');expect(result.outcomes?.[0].status).toBe('WARNING');
});
