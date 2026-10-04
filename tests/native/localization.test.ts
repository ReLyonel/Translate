import { afterEach, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { translateLocalization } from '../../desktop/compatibility/nativeLocalization';
import { registerSpanish, safeRelativePath } from '../../desktop/compatibility/moduleManifest';
import { runBatch } from '../../desktop/jobs';
const signal=()=>new AbortController().signal;
const translate=async (request:{texts:string[]})=>request.texts.map(text=>text.replaceAll('Hello','Hola').replaceAll('Привет','Hola'));
const roots:string[]=[];
afterEach(async()=>{vi.restoreAllMocks();for(const root of roots.splice(0)) await fs.rm(root,{recursive:true,force:true});});
async function fixture(languages:any[]=[{lang:'en',path:'lang/en.json'}]) {
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'native-localization-'));roots.push(root);
 const input=path.join(root,'input'),output=path.join(root,'output');await fs.mkdir(path.join(input,'lang'),{recursive:true});
 const manifest={id:'example',compatibility:{maximum:'13'},coreTranslation:false,packs:[{path:'packs/items'}],languages};
 await fs.writeFile(path.join(input,'module.json'),JSON.stringify(manifest));
 await fs.writeFile(path.join(input,'lang/en.json'),' {"UI.Hello":"Hello @UUID[Item.id]", "nested":{"label":"Hello"}} ');
 return {input,output,manifest};
}
it('preserves literal, nested and prototype-like keys, HTML, rolls and references',async()=>{
 const source='{"UI.Hello":"<p>Hello @UUID[Item.id] [[1d20]]</p>","nested":{"label":"Привет"},"__proto__":"Hello"}';
 const result=JSON.parse(await translateLocalization(source,'ru',translate,signal()));
 expect(result['UI.Hello']).toBe('<p>Hola @UUID[Item.id] [[1d20]]</p>');expect(result.nested.label).toBe('Hola');expect(Object.hasOwn(result,'__proto__')).toBe(true);
});
it.each(['{"a":"Hello","a":"Other"}','[]','{"a":3}','{"a":["Hello"]}','{"a":null}'])('rejects invalid dictionary %s',async source=>{
 await expect(translateLocalization(source,'en',translate,signal())).rejects.toThrow();
});
it.each([()=>[],()=>[''],()=>['Hola'],()=>['[[PROTECTED_999]]']])('rejects incomplete, empty or damaged responses',async provider=>{
 await expect(translateLocalization('{"a":"Hello @UUID[Item.id]"}','en',async()=>provider(),signal())).rejects.toThrow();
});
it.each(['../outside.json','/lang/en.json','C:/lang/en.json','lang\\en.json','lang/./en.json','lang//en.json'])('rejects unsafe path %s',value=>expect(safeRelativePath(value)).toBe(false));
it('allows only additive language changes and preserves all technical fields',()=>{
 const original={id:'example',languages:[{lang:'en',path:'lang/en.json',flags:{x:1}}],compatibility:{maximum:13},coreTranslation:false,packs:[],relationships:{requires:[{id:'babele'}]}};
 const entry={lang:'es' as const,name:'Español',path:'lang/fvtt-translator/es-001.json'};
 const result=JSON.parse(registerSpanish(JSON.stringify(original),[entry],new Set([entry.path])));
 expect({...result,languages:original.languages}).toEqual(original);expect(result.languages[1]).toEqual(entry);
 expect(()=>registerSpanish(JSON.stringify(original),[entry],new Set())).toThrow();
});
it('publishes dictionary before registering it, preserving source hashes and counters',async()=>{
 const {input,output,manifest}=await fixture();const before=await fs.readFile(path.join(input,'module.json'));
 const progress=await runBatch(input,output,translate,signal(),()=>{},'auto',undefined,'module',undefined,'FULL_PORTABLE_COPY');
 expect(progress.generatedLocalizations).toEqual(['lang/fvtt-translator/es-001.json']);expect(progress.total).toBe(0);
 const revised=JSON.parse(await fs.readFile(path.join(output,'module.json'),'utf8'));
 expect({...revised,languages:manifest.languages}).toEqual(manifest);
 expect(await fs.readFile(path.join(input,'module.json'))).toEqual(before);
 expect(JSON.parse(await fs.readFile(path.join(output,progress.generatedLocalizations![0]),'utf8'))['UI.Hello']).toBe('Hola @UUID[Item.id]');
});
it('keeps existing Spanish untouched with no provider calls',async()=>{
 const {input,output}=await fixture([{lang:'es',path:'lang/es.json'},{lang:'en',path:'lang/en.json'}]);
 await fs.writeFile(path.join(input,'lang/es.json'),'{"a":"Manual"}');let calls=0;
 const progress=await runBatch(input,output,async()=>{calls++;return [];},signal(),()=>{},'auto',undefined,'module',undefined,'FULL_PORTABLE_COPY');
 expect(calls).toBe(0);expect(progress.warnings?.[0]).toContain('SPANISH_ALREADY_EXISTS');
 expect(await fs.readFile(path.join(output,'module.json'))).toEqual(await fs.readFile(path.join(input,'module.json')));
});
it('rolls back generated dictionaries if a later dictionary fails',async()=>{
 const {input,output}=await fixture([{lang:'en',path:'lang/en.json'},{lang:'ru',path:'lang/missing.json'}]);
 const progress=await runBatch(input,output,translate,signal(),()=>{},'auto',undefined,'module',undefined,'FULL_PORTABLE_COPY');
 expect(progress.generatedLocalizations).toEqual([]);expect(progress.warnings?.[0]).toContain('NOT_PUBLISHED');
 await expect(fs.stat(path.join(output,'lang/fvtt-translator/es-001.json'))).rejects.toThrow();
 expect(await fs.readFile(path.join(output,'module.json'))).toEqual(await fs.readFile(path.join(input,'module.json')));
});
it('cancellation before manifest commit restores the original',async()=>{
 const {input,output}=await fixture();const controller=new AbortController();
 const progress=await runBatch(input,output,async request=>{controller.abort();return translate(request);},controller.signal,()=>{},'auto',undefined,'module',undefined,'FULL_PORTABLE_COPY');
 expect(progress.state).toBe('CANCELLED');expect(progress.generatedLocalizations).toEqual([]);
 expect(await fs.readFile(path.join(output,'module.json'))).toEqual(await fs.readFile(path.join(input,'module.json')));
});
it('does not overwrite colliding generated paths',async()=>{
 const {input,output}=await fixture();await fs.mkdir(path.join(input,'lang/fvtt-translator'));await fs.writeFile(path.join(input,'lang/fvtt-translator/es-001.json'),'original');
 const progress=await runBatch(input,output,translate,signal(),()=>{},'auto',undefined,'module',undefined,'FULL_PORTABLE_COPY');
 expect(progress.generatedLocalizations).toEqual([]);expect(await fs.readFile(path.join(output,'lang/fvtt-translator/es-001.json'),'utf8')).toBe('original');
});
it('preserves the manifest and removes dictionaries when atomic replace fails',async()=>{
 const {input,output}=await fixture();vi.spyOn(fs,'rename').mockRejectedValueOnce(Object.assign(new Error('disk'),{code:'ENOSPC'}));
 const progress=await runBatch(input,output,translate,signal(),()=>{},'auto',undefined,'module',undefined,'FULL_PORTABLE_COPY');
 expect(progress.generatedLocalizations).toEqual([]);
 expect(await fs.readFile(path.join(output,'module.json'))).toEqual(await fs.readFile(path.join(input,'module.json')));
 await expect(fs.stat(path.join(output,'lang/fvtt-translator/es-001.json'))).rejects.toThrow();
 expect((await fs.readdir(output)).some(name=>name.endsWith('.tmp'))).toBe(false);
});
it('publishes multiple EN/RU dictionaries without merging them',async()=>{
 const {input,output}=await fixture([{lang:'en',path:'lang/en.json'},{lang:'ru',path:'lang/ru.json'}]);await fs.writeFile(path.join(input,'lang/ru.json'),'{"UI.Hello":"Привет"}');
 const progress=await runBatch(input,output,translate,signal(),()=>{},'auto',undefined,'module',undefined,'FULL_PORTABLE_COPY');
 expect(progress.generatedLocalizations).toHaveLength(2);
 expect(JSON.parse(await fs.readFile(path.join(output,'lang/fvtt-translator/es-002.json'),'utf8'))).toEqual({'UI.Hello':'Hola'});
});
it('rejects a manifest source path escaping the module',async()=>{
 const {input,output}=await fixture([{lang:'en',path:'../outside.json'}]);
 const progress=await runBatch(input,output,translate,signal(),()=>{},'auto',undefined,'module',undefined,'FULL_PORTABLE_COPY');
 expect(progress.generatedLocalizations).toEqual([]);expect(progress.warnings?.[0]).toContain('NOT_PUBLISHED');
});
