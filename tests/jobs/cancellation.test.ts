import {afterEach,expect,it,vi} from 'vitest';
import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
import {runBatch} from '../../desktop/jobs';
import {atomicWrite,atomicCopy} from '../../desktop/atomicWriter';
import {translate as providerTranslate} from '../../desktop/providers';
import {JsonEngine} from '../../src/services/json/jsonEngine';
import {runLoggedBatch} from '../../desktop/logging/runReport';
import {MemoryStore} from '../../desktop/memory/store';
import {providers} from '../../desktop/providers';
const roots:string[]=[];
afterEach(async()=>{vi.restoreAllMocks();vi.unstubAllGlobals();for(const root of roots.splice(0))await fs.rm(root,{recursive:true,force:true});});
async function fixture(){const root=await fs.mkdtemp(path.join(os.tmpdir(),'cancel-'));roots.push(root);const input=path.join(root,'input'),output=path.join(root,'output');await fs.mkdir(input);for(const name of ['a','b','c'])await fs.writeFile(path.join(input,name+'.json'),'{"name":"Sword"}');return {root,input,output};}

it('propagates abort into in-flight Ollama without retry or LibreTranslate fallback',async()=>{
 const controller=new AbortController();let entered!:()=>void;const started=new Promise<void>(resolve=>entered=resolve);
 const fetcher=vi.fn(async(_url:unknown,options?:RequestInit)=>new Promise<Response>((_,reject)=>{entered();options?.signal?.addEventListener('abort',()=>reject(options.signal?.reason),{once:true});}));vi.stubGlobal('fetch',fetcher);
 const result=providerTranslate({endpoint:'http://127.0.0.1:11500',model:'translategemma:27b',fallback:true},{texts:['Sword'],sourceLanguage:'en'},undefined,controller.signal);
 await started;const start=performance.now();controller.abort();await expect(result).rejects.toThrow();expect(performance.now()-start).toBeLessThan(1000);expect(fetcher).toHaveBeenCalledTimes(1);
});

it('cancels during extraction without publishing or invoking provider',async()=>{
 const {input,output}=await fixture();const controller=new AbortController(),analyze=JsonEngine.analyze.bind(JsonEngine);vi.spyOn(JsonEngine,'analyze').mockImplementation((...args)=>{controller.abort();return analyze(...args);});const provider=vi.fn();
 const result=await runBatch(input,output,provider,controller.signal,()=>{});expect(result.state).toBe('CANCELLED');expect(provider).not.toHaveBeenCalled();expect(await fs.readdir(output)).toEqual([]);
});

it('cancels during translation preserving completed output, originals and immutable snapshots',async()=>{
 const {input,output}=await fixture();const controller=new AbortController();let calls=0;const snapshots:any[]=[];
 const result=await runBatch(input,output,async request=>{if(++calls===2)controller.abort();return request.texts.map(t=>t.replace('Sword','Espada'));},controller.signal,p=>snapshots.push(p));
 expect(result).toMatchObject({state:'CANCELLED',completed:1});expect(await fs.readdir(output)).toEqual(['a.json']);expect(JSON.parse(await fs.readFile(path.join(output,'a.json'),'utf8')).name).toBe('Espada');expect(calls).toBe(2);
 expect(snapshots[0].completed).toBe(0);for(let i=1;i<snapshots.length;i++)expect(snapshots[i].sequence).toBeGreaterThan(snapshots[i-1].sequence);
 for(const name of ['a','b','c'])expect(await fs.readFile(path.join(input,name+'.json'),'utf8')).toBe('{"name":"Sword"}');
});

it.each(['initial-validation','staged-validation','staging-write'])('cleans temporary and prevents commit after abort at %s',async stage=>{
 const {root}=await fixture(),target=path.join(root,'translated.json'),controller=new AbortController();let validations=0;
 if(stage==='staging-write'){const open=fs.open.bind(fs);vi.spyOn(fs,'open').mockImplementation(async(...args)=>{const handle=await open(...args),write=handle.writeFile.bind(handle);vi.spyOn(handle,'writeFile').mockImplementation(async data=>{await write(data);controller.abort();});return handle;});}
 await expect(atomicWrite(target,'{}',controller.signal,()=>{validations++;if(stage==='initial-validation'&&validations===1||stage==='staged-validation'&&validations===2)controller.abort();})).rejects.toThrow();
 expect((await fs.readdir(root)).filter(n=>n.endsWith('.tmp')||n==='translated.json')).toEqual([]);
});

it('settles an already-started atomic commit before cancellation confirmation and never modifies it afterwards',async()=>{
 const {root}=await fixture(),target=path.join(root,'translated.json'),controller=new AbortController(),link=fs.link.bind(fs);let committed=0;
 vi.spyOn(fs,'link').mockImplementation(async(...args)=>{controller.abort();await link(...args);});
 await atomicWrite(target,'{}',controller.signal,()=>{},undefined,()=>committed++);
 expect(committed).toBe(1);expect(await fs.readFile(target,'utf8')).toBe('{}');expect((await fs.readdir(root)).some(n=>n.endsWith('.tmp'))).toBe(false);
 await expect(atomicWrite(path.join(root,'later.json'),'{}',controller.signal,()=>{})).rejects.toThrow();
});

it('aborts a resource copy before linking and removes its complete staging file',async()=>{
 const {root,input}=await fixture(),target=path.join(root,'resource.bin'),controller=new AbortController(),copy=fs.copyFile.bind(fs);
 vi.spyOn(fs,'copyFile').mockImplementation(async(...args)=>{await copy(...args);controller.abort();});
 await expect(atomicCopy(path.join(input,'a.json'),target,controller.signal)).rejects.toThrow();expect((await fs.readdir(root)).filter(n=>n.endsWith('.tmp')||n==='resource.bin')).toEqual([]);
});

it('cancellation emits a reconciled report and never commits incremental baseline or approved knowledge',async()=>{
 const {root,input,output}=await fixture();const store=await new MemoryStore(path.join(root,'memory')).load(),controller=new AbortController();let report='';
 vi.spyOn(providers.ollama,'translate').mockImplementation(async()=>{controller.abort();return ['Espada'];});
 await fs.mkdir(path.join(input,'packs/items/_source'),{recursive:true});await fs.writeFile(path.join(input,'packs/items/_source/a.json'),'{"name":"Sword"}');
 const cancelled=await runLoggedBatch(input,output,{endpoint:'http://127.0.0.1:11500',model:'translategemma:27b',thermalEnabled:false},store,path.join(root,'logs'),controller.signal,()=>{},'en','cancel-report',[],directory=>{report=directory;});
 expect(cancelled.state).toBe('CANCELLED');const summary=JSON.parse(await fs.readFile(path.join(report,'summary.json'),'utf8'));
 expect(summary).toMatchObject({status:'CANCELLED',total:1,processed:0,unprocessed:1});expect(summary.incremental.baseline_committed).not.toBe(true);
 expect(store.entries()).toEqual([]);expect(await fs.readdir(output)).toEqual([]);
});
