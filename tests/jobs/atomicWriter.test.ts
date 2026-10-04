import { afterEach, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { atomicWrite, atomicCopy } from '../../desktop/atomicWriter';
const roots:string[]=[];
afterEach(async()=>{vi.restoreAllMocks();for(const root of roots.splice(0))await fs.rm(root,{recursive:true,force:true});});
async function fixture(){const root=await fs.mkdtemp(path.join(os.tmpdir(),'atomic-'));roots.push(root);return {root,target:path.join(root,'output.json')};}
const signal=()=>new AbortController().signal;
const validate=(bytes:Buffer)=>{JSON.parse(bytes.toString('utf8'));};
it('validates both before staging and before publication',async()=>{
 const {root,target}=await fixture();let count=0;await atomicWrite(target,'{"a":1}',signal(),bytes=>{validate(bytes);count++;});
 expect(count).toBe(2);expect(await fs.readFile(target,'utf8')).toBe('{"a":1}');expect(await fs.readdir(root)).toEqual(['output.json']);
});
it('rejects invalid data without creating a temporary or target',async()=>{
 const {root,target}=await fixture();await expect(atomicWrite(target,'broken',signal(),validate)).rejects.toThrow();expect(await fs.readdir(root)).toEqual([]);
});
it('refuses collisions while preserving existing output',async()=>{
 const {root,target}=await fixture();await fs.writeFile(target,'original');await expect(atomicWrite(target,'{}',signal(),validate)).rejects.toThrow();expect(await fs.readFile(target,'utf8')).toBe('original');expect(await fs.readdir(root)).toEqual(['output.json']);
});
it('cleans a temporary after second validation fails',async()=>{
 const {root,target}=await fixture();let calls=0;await expect(atomicWrite(target,'{}',signal(),()=>{if(++calls===2)throw new Error('FINAL_GATE');})).rejects.toThrow('FINAL_GATE');expect(await fs.readdir(root)).toEqual([]);
});
it('abort during final validation publishes nothing',async()=>{
 const {root,target}=await fixture();const controller=new AbortController();let calls=0;await expect(atomicWrite(target,'{}',controller.signal,()=>{if(++calls===2)controller.abort();})).rejects.toThrow();expect(await fs.readdir(root)).toEqual([]);
});
it.each(['ENOSPC','EACCES'])('does not publish when disk/permission commit fails: %s',async code=>{
 const {root,target}=await fixture();vi.spyOn(fs,'link').mockRejectedValueOnce(Object.assign(new Error(code),{code}));await expect(atomicWrite(target,'{}',signal(),validate)).rejects.toThrow(code);expect(await fs.readdir(root)).toEqual([]);
});
it('cleans partially written temporary on disk full',async()=>{
 const {root,target}=await fixture();const open=fs.open.bind(fs);
 vi.spyOn(fs,'open').mockImplementation(async(...args:Parameters<typeof fs.open>)=>{
  const handle=await open(...args);const write=handle.writeFile.bind(handle);
  vi.spyOn(handle,'writeFile').mockImplementation(async()=>{await write('{');throw Object.assign(new Error('ENOSPC'),{code:'ENOSPC'});});return handle;
 });
 await expect(atomicWrite(target,'{}',signal(),validate)).rejects.toThrow('ENOSPC');expect(await fs.readdir(root)).toEqual([]);
});
it('replaces only an exact expected copy',async()=>{
 const {target}=await fixture();await fs.writeFile(target,'old');await expect(atomicWrite(target,'{}',signal(),validate,Buffer.from('other'))).rejects.toThrow('REPLACE_TARGET_CHANGED');expect(await fs.readFile(target,'utf8')).toBe('old');
 await atomicWrite(target,'{}',signal(),validate,Buffer.from('old'));expect(await fs.readFile(target,'utf8')).toBe('{}');
});
it('copies binary resources byte for byte',async()=>{
 const {root,target}=await fixture();const source=path.join(root,'source.bin');const bytes=Buffer.from([0,255,12,42]);await fs.writeFile(source,bytes);await atomicCopy(source,target,signal());expect(await fs.readFile(target)).toEqual(bytes);expect(await fs.readFile(source)).toEqual(bytes);
});
it('propagates cleanup failure without claiming the already committed file is partial',async()=>{
 const {target}=await fixture();vi.spyOn(fs,'rm').mockRejectedValueOnce(new Error('CLEANUP_FAILED'));
 await expect(atomicWrite(target,'{}',signal(),validate)).rejects.toThrow('CLEANUP_FAILED');expect(await fs.readFile(target,'utf8')).toBe('{}');
});
