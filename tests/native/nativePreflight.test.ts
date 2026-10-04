import { afterEach, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { nativePreflight } from '../../desktop/compatibility/nativePreflight';
const roots:string[]=[];
afterEach(async()=>{for(const root of roots.splice(0))await fs.rm(root,{recursive:true,force:true});});
async function fixture() {
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'foundry-native-'));roots.push(root);const original=path.join(root,'original'),translated=path.join(root,'translated');
 await fs.mkdir(path.join(original,'packs/items/_source'),{recursive:true});await fs.mkdir(path.join(original,'scripts'));
 await fs.writeFile(path.join(original,'module.json'),JSON.stringify({id:'example',version:'1',compatibility:{minimum:14},packs:[{name:'items',path:'packs/items',type:'Item'}]}));
 await fs.writeFile(path.join(original,'packs/items/_source/item.json'),JSON.stringify({_id:'abcdefghijklmnop',name:'Sword',system:{description:{value:'<p>Sword @UUID[Item.abcdefghijklmnop] [[/r 1d20]]</p>'}}}));
 await fs.writeFile(path.join(original,'packs/items/CURRENT'),'MANIFEST-000001');await fs.writeFile(path.join(original,'scripts/ui.js'),'const ui = { label: "Sword" };');
 await fs.cp(original,translated,{recursive:true});return {root,original,translated};
}
it('prepares native UUID cases, source hashes and runtime pending status',async()=>{
 const {original,translated}=await fixture();const result=await nativePreflight(original,translated);
 expect(result.plan.cases[0].uuid).toBe('Compendium.example.items.Item.abcdefghijklmnop');expect(result.plan.sourceHashes.some(item=>item.file==='packs/items/CURRENT')).toBe(true);
 expect(result.checks.filter(check=>check.status==='FAILED')).toEqual([]);expect(result.checks.some(check=>check.status==='NOT_RUN')).toBe(true);
});
it('rejects source ID corruption and technical script changes',async()=>{
 const {original,translated}=await fixture();await fs.writeFile(path.join(translated,'scripts/ui.js'),'const changed = { label: "Espada" };');
 const file=path.join(translated,'packs/items/_source/item.json');const doc=JSON.parse(await fs.readFile(file,'utf8'));doc._id='changed';await fs.writeFile(file,JSON.stringify(doc));
 const result=await nativePreflight(original,translated);expect(result.checks.some(check=>check.code==='SCRIPT_TECHNICAL_CHANGED')).toBe(true);expect(result.checks.some(check=>check.code==='SOURCE_INTEGRITY_FAILED')).toBe(true);
});
it('flags source-only packs without claiming they have been rebuilt',async()=>{
 const {original,translated}=await fixture();await fs.rm(path.join(translated,'packs/items/CURRENT'));expect((await nativePreflight(original,translated)).checks.some(check=>check.code==='PACK_EFFECTIVE_FILES_MISSING')).toBe(true);
});
it('does not accept a maximum core version below the target',async()=>{
 const {original,translated}=await fixture();for(const root of [original,translated]){const file=path.join(root,'module.json');const manifest=JSON.parse(await fs.readFile(file,'utf8'));manifest.compatibility.maximum=13;await fs.writeFile(file,JSON.stringify(manifest));}
 expect((await nativePreflight(original,translated)).checks.some(check=>check.code==='CORE_MANIFEST_INCOMPATIBLE')).toBe(true);
});
it('rejects mutated or missing existing localization registration',async()=>{
 const {original,translated}=await fixture();const file=path.join(translated,'module.json');const manifest=JSON.parse(await fs.readFile(file,'utf8'));manifest.languages=[{lang:'es',path:'../outside.json'}];await fs.writeFile(file,JSON.stringify(manifest));
 expect((await nativePreflight(original,translated)).checks.some(check=>check.code==='LANGUAGE_FILE_MISSING')).toBe(true);
});
it('never accepts the original root as its own translated copy',async()=>{
 const {original}=await fixture();await expect(nativePreflight(original,original)).rejects.toThrow('SEPARATE');
});
