import {afterEach,it,expect,vi} from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {runBatch} from '../../desktop/jobs';
import {inspectScript,translateScript,validateScriptTranslation} from '../../desktop/scriptTranslation';
const roots:string[]=[];
afterEach(async()=>{vi.restoreAllMocks();for(const root of roots.splice(0))await fs.rm(root,{recursive:true,force:true});});
async function fixture(){const root=await fs.mkdtemp(path.join(os.tmpdir(),'overlay-'));roots.push(root);const input=path.join(root,'module'),output=path.join(root,'output');await fs.mkdir(path.join(input,'packs/items/_source'),{recursive:true});return {root,input,output};}
async function put(input:string,relative:string,content:string|Buffer){const file=path.join(input,relative);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,content);}
const signal=()=>new AbortController().signal;
const translator=async(request:{texts:string[]})=>request.texts.map(text=>text.replaceAll('Sword','Espada').replaceAll('Hello','Hola'));
it('defaults to native overlay, preserving relative paths and source identities without assets',async()=>{
 const {input,output}=await fixture();const file='packs/items/_source/item.json';
 const original={_id:'ABC123',_key:'!items!ABC123',name:'Sword',type:'weapon',img:'modules/module/assets/a.webp',flags:{technical:{key:'Sword'}},system:{damage:{formula:'1d20+5'}}};
 await put(input,file,JSON.stringify(original));await put(input,'assets/a.webp',Buffer.from([1,2,3]));await put(input,'scripts/ui.mjs',"// keep\nui.notifications.info('Hello');\n");
 const before=await fs.readFile(path.join(input,file));
 const result=await runBatch(input,output,translator,signal(),()=>{},'en',undefined,'module');
 expect(result.outputStrategy).toBe('TRANSLATION_OVERLAY');expect(result.publication).toMatchObject({files_scanned:2,files_translated:2,files_unchanged:0,files_written:2,assets_skipped:1,bytes_avoided:3});
 const translated=JSON.parse(await fs.readFile(path.join(output,file),'utf8'));expect({...translated,name:original.name}).toEqual(original);
 expect(await fs.readFile(path.join(input,file))).toEqual(before);expect(await fs.readFile(path.join(output,'scripts/ui.mjs'),'utf8')).toBe("// keep\nui.notifications.info('Hola');\n");
 await expect(fs.stat(path.join(output,'assets'))).rejects.toThrow();
});
it('does not reformat or publish unchanged JSON, empty directories or unchanged scripts',async()=>{
 const {input,output}=await fixture();const original=' { "name" : "Sword" }\r\n';await put(input,'packs/items/_source/a.json',original);await put(input,'scripts/ui.js','const id="Sword";');await fs.mkdir(path.join(input,'empty'));
 const result=await runBatch(input,output,async request=>request.texts,signal(),()=>{},'en',undefined,'module');
 expect(await fs.readdir(output)).toEqual([]);expect(result.publication).toMatchObject({files_scanned:2,files_translated:0,files_unchanged:2,files_written:0,bytes_avoided:Buffer.byteLength(original)+Buffer.byteLength('const id="Sword";')});expect(result.outcomes?.every(item=>item.written===false)).toBe(true);
});
it('explicit full copy retains assets, empty directories and unchanged bytes',async()=>{
 const {input,output}=await fixture();const original=' { "name" : "Sword" }\r\n';await put(input,'packs/items/_source/a.json',original);await put(input,'assets/a.png',Buffer.from([1,2]));await fs.mkdir(path.join(input,'empty'));
 const result=await runBatch(input,output,async request=>request.texts,signal(),()=>{},'en',undefined,'module',undefined,'FULL_PORTABLE_COPY');
 expect(await fs.readFile(path.join(output,'packs/items/_source/a.json'),'utf8')).toBe(original);expect(await fs.readFile(path.join(output,'assets/a.png'))).toEqual(Buffer.from([1,2]));expect((await fs.stat(path.join(output,'empty'))).isDirectory()).toBe(true);expect(result.publication).toMatchObject({files_written:2,assets_skipped:0,bytes_avoided:0});
});
it('invalid JSON and script restore source and warnings without creating overlay files',async()=>{
 const {input,output}=await fixture();await put(input,'packs/items/_source/a.json','{"name":"Sword","name":"Bad"}');await put(input,'scripts/a.js','const = broken');
 const translate=vi.fn(translator);const result=await runBatch(input,output,translate,signal(),()=>{},'en',undefined,'module');
 expect(translate).not.toHaveBeenCalled();expect(await fs.readdir(output)).toEqual([]);expect(result.failed).toBe(2);expect(result.diagnostics).toContainEqual(expect.objectContaining({reason:'SCRIPT_TRANSLATION_VALIDATION_FAILED',recovery:'ORIGINAL_RESTORED'}));expect(result.publication).toMatchObject({files_unchanged:2,files_written:0});
});
it('provider failure keeps original and does not publish unchanged fallback',async()=>{
 const {input,output}=await fixture();await put(input,'packs/items/_source/a.json','{"name":"Sword"}');const result=await runBatch(input,output,async()=>{throw new Error('offline');},signal(),()=>{},'en',undefined,'module');expect(result.failed).toBe(1);expect(await fs.readdir(output)).toEqual([]);expect(result.publication?.files_written).toBe(0);
});
it('cancellation writes neither in-progress overlay nor temporary files',async()=>{
 const {input,output}=await fixture();await put(input,'packs/items/_source/a.json','{"name":"Sword"}');const controller=new AbortController();const result=await runBatch(input,output,async request=>{controller.abort();return translator(request);},controller.signal,()=>{},'en',undefined,'module');expect(result.state).toBe('CANCELLED');expect(await fs.readdir(output)).toEqual([]);
});
it('atomic failure stops overlay publication and leaves no partial file',async()=>{
 const {input,output}=await fixture();await put(input,'packs/items/_source/a.json','{"name":"Sword"}');vi.spyOn(fs,'link').mockRejectedValueOnce(Object.assign(new Error('disk full'),{code:'ENOSPC'}));await expect(runBatch(input,output,translator,signal(),()=>{},'en',undefined,'module')).rejects.toThrow();expect(await fs.readdir(path.join(output,'packs/items/_source'))).toEqual([]);expect(await fs.readFile(path.join(input,'packs/items/_source/a.json'),'utf8')).toBe('{"name":"Sword"}');
});
it('overlay registers only necessary manifest changes after validated Spanish dictionary',async()=>{
 const {input,output}=await fixture();const manifest={id:'module',version:'1',languages:[{lang:'en',path:'lang/en.json'}],packs:[],esmodules:['scripts/ui.mjs']};await put(input,'module.json',JSON.stringify(manifest));await put(input,'lang/en.json','{"UI.Title":"Hello"}');const result=await runBatch(input,output,translator,signal(),()=>{},'en',undefined,'module');expect(result.publication?.files_written).toBe(2);const revised=JSON.parse(await fs.readFile(path.join(output,'module.json'),'utf8'));expect({...revised,languages:manifest.languages}).toEqual(manifest);await expect(fs.stat(path.join(output,'lang/en.json'))).rejects.toThrow();expect(result.publication?.bytes_avoided).toBe(Buffer.byteLength('{"UI.Title":"Hello"}'));
});
it('unchanged dictionaries do not create Spanish files or alter module manifest',async()=>{
 const {input,output}=await fixture();await put(input,'module.json','{"id":"module","languages":[{"lang":"en","path":"lang/en.json"}]}');await put(input,'lang/en.json','{"UI.Title":"Hello"}');const result=await runBatch(input,output,async request=>request.texts,signal(),()=>{},'en',undefined,'module');expect(result.generatedLocalizations).toEqual([]);expect(await fs.readdir(output)).toEqual([]);
});
it('preserves all interpolations including visible strings nested inside expressions',async()=>{
 const source="export const ui={content:`Hello ${ui.notifications.info('Hello')} ${actor.name}`}; // original";const output=await translateScript(source,translator,signal(),'en');expect(output).toBe("export const ui={content:`Hola ${ui.notifications.info('Hello')} ${actor.name}`}; // original");
});
it('AST rejects executable changes, imports, keys, exports and interpolations',()=>{
 const source='import x from "./a.js"; export const ui={title:"Hello",content:`Hello ${actor.name}`};';for(const changed of [source.replace('./a.js','./b.js'),source.replace('actor.name','actor.id'),source.replace('title:','identifier:'),source.replace('export const','const')])expect(()=>validateScriptTranslation(source,changed)).toThrow();
});
it('AST leaves unknown technical object fields, commands and selectors untouched',async()=>{
 const source='const registry={name:"Hello",title:"Sword",content:"Hello"}; fetch("Hello"); Hooks.on("Hello",()=>{}); document.querySelector("Hello");';expect(inspectScript(source)).toEqual([]);expect(await translateScript(source,translator,signal(),'en')).toBe(source);
});
it('reports uncertain UI-like script fields without translating or publishing them',async()=>{
 const {input,output}=await fixture();await put(input,'scripts/ui.js','const registry={title:"Hello"};');const provider=vi.fn(translator);const result=await runBatch(input,output,provider,signal(),()=>{},'en',undefined,'module');expect(provider).not.toHaveBeenCalled();expect(result.outcomes?.[0]).toMatchObject({status:'WARNING',written:false,outputKind:'UNCHANGED'});expect(result.diagnostics?.[0]).toMatchObject({reason:'SCRIPT_TRANSLATION_CONTEXT_UNCERTAIN',recovery:'ORIGINAL_RESTORED'});expect(await fs.readdir(output)).toEqual([]);
});
it('supports Foundry dialogs, ChatMessage, settings and notifications by AST context',async()=>{
 const source='new Dialog({title:"Hello",content:"Sword"}); ChatMessage.create({content:"Hello",flavor:"Hello"}); game.settings.register("mod","key",{name:"Hello",hint:"Sword"}); ui.notifications.warn("Hello");';const output=await translateScript(source,translator,signal(),'en');expect(output).toContain('title:"Hola"');expect(output).toContain('flavor:"Hola"');expect(output).toContain('hint:"Espada"');expect(output).toContain('warn("Hola")');expect(output).toContain('register("mod","key"');
});
it('never removes dictionary referenced by an already committed overlay manifest after cleanup failure',async()=>{
 const {input,output}=await fixture();await put(input,'module.json','{"id":"module","languages":[{"lang":"en","path":"lang/en.json"}]}');await put(input,'lang/en.json','{"UI.Title":"Hello"}');const remove=fs.rm.bind(fs);vi.spyOn(fs,'rm').mockImplementation(async(target,options)=>{if(String(target).includes('module.json.')&&String(target).endsWith('.tmp'))throw new Error('cleanup denied');return remove(target,options);});const result=await runBatch(input,output,translator,signal(),()=>{},'en',undefined,'module');expect(result.warnings?.[0]).toContain('COMMIT_CLEANUP_WARNING');const manifest=JSON.parse(await fs.readFile(path.join(output,'module.json'),'utf8'));expect(JSON.parse(await fs.readFile(path.join(output,manifest.languages[1].path),'utf8'))).toEqual({'UI.Title':'Hola'});
});
