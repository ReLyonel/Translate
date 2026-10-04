import {afterEach,expect,it,vi} from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {runBatch} from '../../desktop/jobs';
import {discoverModule} from '../../desktop/moduleDiscovery';
import type {BatchProgress} from '../../desktop/contracts';

const roots:string[]=[];
afterEach(async()=>{vi.restoreAllMocks();for(const root of roots.splice(0))await fs.rm(root,{recursive:true,force:true});});
async function fixture(){const root=await fs.mkdtemp(path.join(os.tmpdir(),'directory-'));roots.push(root);const input=path.join(root,'input'),output=path.join(root,'output');await fs.mkdir(path.join(input,'packs','Items','_source'),{recursive:true});return {root,input,output,source:path.join(input,'packs','Items','_source')};}
const signal=()=>new AbortController().signal;
const translate=vi.fn(async(request:{texts:string[]})=>request.texts.map(text=>text.replaceAll('Sword','Espada')));

it('preserves case-sensitive relative names, nested arrays, technical paths and invalid originals while continuing',async()=>{
 const {input,output,source}=await fixture();await fs.mkdir(path.join(source,'Nested'));
 const original=' {"_id":"abcdefghijklmnop","name":"Sword","items":[{"name":"Sword","img":"modules/example/Assets/Sword.webp"}],"system":{"formula":"1d20+5"}} ';
 await fs.writeFile(path.join(source,'Nested','Sword.JSON'),original);await fs.writeFile(path.join(source,'broken.json'),'{broken');
 const result=await runBatch(input,output,translate,signal(),()=>{},'en',undefined,'module');
 expect(result).toMatchObject({state:'COMPLETED',total:2,completed:2,failed:1});
 const translated=JSON.parse(await fs.readFile(path.join(output,'packs','Items','_source','Nested','Sword.JSON'),'utf8'));
 expect(translated).toMatchObject({_id:'abcdefghijklmnop',name:'Espada',items:[{name:'Espada',img:'modules/example/Assets/Sword.webp'}],system:{formula:'1d20+5'}});
 expect(await fs.readFile(path.join(source,'Nested','Sword.JSON'),'utf8')).toBe(original);
 expect(await fs.readFile(path.join(source,'broken.json'),'utf8')).toBe('{broken');
 await expect(fs.stat(path.join(output,'packs','Items','_source','broken.json'))).rejects.toMatchObject({code:'ENOENT'});
});

it('rejects a real Windows junction before discovery can traverse external files or create output',async()=>{
 const {root,input,output,source}=await fixture();const external=path.join(root,'external');await fs.mkdir(external);await fs.writeFile(path.join(external,'item.json'),'{"name":"Sword"}');
 await fs.symlink(external,path.join(source,'linked'),process.platform==='win32'?'junction':'dir');
 const provider=vi.fn();await expect(runBatch(input,output,provider,signal(),()=>{},'en',undefined,'module')).rejects.toThrow('enlaces');
 expect(provider).not.toHaveBeenCalled();await expect(fs.stat(output)).rejects.toMatchObject({code:'ENOENT'});
 expect(await fs.readFile(path.join(external,'item.json'),'utf8')).toBe('{"name":"Sword"}');
});

it('fails closed on discovery permissions, before creating output or invoking provider',async()=>{
 const {input,output}=await fixture();vi.spyOn(fs,'readdir').mockRejectedValueOnce(Object.assign(new Error('denied'),{code:'EACCES'}));
 const provider=vi.fn();await expect(runBatch(input,output,provider,signal(),()=>{})).rejects.toMatchObject({code:'EACCES'});
 expect(provider).not.toHaveBeenCalled();await expect(fs.stat(output)).rejects.toMatchObject({code:'ENOENT'});
});

it.each(['EACCES','ENOSPC'])('stops safely on %s while preserving previously completed files',async code=>{
 const {input,output,source}=await fixture();for(const name of ['a','b','c'])await fs.writeFile(path.join(source,name+'.json'),'{"name":"Sword"}');
 const link=fs.link.bind(fs);let commits=0;vi.spyOn(fs,'link').mockImplementation(async(...args)=>{if(++commits===2)throw Object.assign(new Error(code),{code});return link(...args);});
 const snapshots:BatchProgress[]=[];await expect(runBatch(input,output,translate,signal(),p=>snapshots.push(p),'en',undefined,'module')).rejects.toMatchObject({code});
 expect(snapshots.at(-1)).toMatchObject({state:'ERROR',completed:1});expect(snapshots.at(-1)?.diagnostics?.at(-1)).toMatchObject({scope:'JOB',reason:'IO_FAILURE'});
 const written=path.join(output,'packs','Items','_source');expect(await fs.readdir(written)).toEqual(['a.json']);expect(JSON.parse(await fs.readFile(path.join(written,'a.json'),'utf8')).name).toBe('Espada');
 for(const name of ['a','b','c'])expect(await fs.readFile(path.join(source,name+'.json'),'utf8')).toBe('{"name":"Sword"}');
});

it('rejects existing and interior destinations and aborts discovery without touching source',async()=>{
 const {input,output}=await fixture();await fs.mkdir(output);const provider=vi.fn();
 await expect(runBatch(input,output,provider,signal(),()=>{})).rejects.toMatchObject({code:'EEXIST'});
 await expect(runBatch(input,path.join(input,'overlay'),provider,signal(),()=>{})).rejects.toThrow('fuera');
 const controller=new AbortController();controller.abort();await expect(discoverModule(input,controller.signal)).rejects.toThrow();expect(provider).not.toHaveBeenCalled();
});
