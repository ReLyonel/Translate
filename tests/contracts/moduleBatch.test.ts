import { afterEach, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { runBatch } from '../../desktop/jobs';
import { inspectScript, translateScript } from '../../desktop/scriptTranslation';
import { translationKind } from '../../desktop/moduleDiscovery';
import { ProtectedContentEngine } from '../../src/services/protected-content/protectedContentEngine';
const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => fs.rm(root, {recursive:true, force:true}))); });
const translate = async (request: {texts:string[]}) => request.texts.map(text => text.replaceAll('Sword', 'Espada').replaceAll('Hello', 'Hola').replaceAll('Primary', 'Principal'));
it('round-trips references that enclose protected HTML or entities', () => {
  for (const text of ['<p>@UUID[Item.foo&amp;bar]</p>', '<p>@Embed[Item.foo</p><p>@Embed[Item.bar]]</p>']) {
    const protectedValue = ProtectedContentEngine.protect(text);
    const restored = ProtectedContentEngine.restore(protectedValue.protectedText,protectedValue.tokens);
    expect(restored.isValid).toBe(true); expect(restored.restoredText).toBe(text);
  }
  expect(()=>ProtectedContentEngine.protect('<p>@Embed[Item.foo</p><p>@Embed[Item.bar]</p>')).toThrow('AMBIGUOUS');
});
it('discovers only source JSON under pack/packs and JS variants under scripts', () => {
  for (const file of ['pack/a/_source/b/item.json','packs/a/_source/item.json']) expect(translationKind(file)).toBe('json');
  for (const file of ['scripts/ui.mjs','scripts/nested/ui.cjs','scripts/ui.js']) expect(translationKind(file)).toBe('script');
  for (const file of ['module.json','lang/en.json','packs/a/item.json','other/_source/item.json','scripts/icon.png']) expect(translationKind(file)).toBe(null);
});
it('copies a complete module, including empty directories, and ignores unrelated JSON', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(),'module-batch-')); roots.push(root);
  const input = path.join(root,'module'); const output = path.join(root,'copy');
  await fs.mkdir(path.join(input,'packs','a','_source'),{recursive:true}); await fs.mkdir(path.join(input,'scripts'),{recursive:true}); await fs.mkdir(path.join(input,'empty'));
  await fs.writeFile(path.join(input,'packs','a','_source','item.json'),' {"name":"Sword","_id":"abcdefghijklmnop"} ');
  await fs.writeFile(path.join(input,'module.json'),' {"name":"Sword"} ');
  await fs.writeFile(path.join(input,'scripts','ui.mjs'),'import x from "./Sword.mjs"; const ui = {title: "Hello", choices:{main:"Primary"}};');
  const result = await runBatch(input,output,translate,new AbortController().signal,()=>{},'en',undefined,'module',undefined,'FULL_PORTABLE_COPY');
  expect(result).toMatchObject({state:'COMPLETED',total:2,completed:2,failed:0});
  expect(await fs.readFile(path.join(output,'module.json'),'utf8')).toBe(' {"name":"Sword"} ');
  expect(JSON.parse(await fs.readFile(path.join(output,'packs','a','_source','item.json'),'utf8')).name).toBe('Espada');
  const script = await fs.readFile(path.join(output,'scripts','ui.mjs'),'utf8');
  expect(script).toContain('"./Sword.mjs"'); expect(script).toContain('"Hola"'); expect(script).toContain('"Principal"');
  expect((await fs.stat(path.join(output,'empty'))).isDirectory()).toBe(true);
  expect(await fs.readFile(path.join(input,'scripts','ui.mjs'),'utf8')).toContain('"Hello"');
});
it('skips absent pack and scripts but still copies all root files', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(),'module-batch-')); roots.push(root);
  const input = path.join(root,'module'); await fs.mkdir(input); await fs.writeFile(path.join(input,'item.json'),'{"name":"Sword"}');
  const output = path.join(root,'copy');
  const result = await runBatch(input,output,translate,new AbortController().signal,()=>{},'auto',undefined,'module',undefined,'FULL_PORTABLE_COPY');
  expect(result).toMatchObject({total:0,completed:0,failed:0,state:'COMPLETED'});
  expect(await fs.readFile(path.join(output,'item.json'),'utf8')).toBe('{"name":"Sword"}');
});
it('protects script localization keys, imports, expressions and technical calls', async () => {
  const source = 'import x from "./ui.mjs"; const id="Sword"; Hooks.on("Hello",()=>{}); const ui={title:"Hello",hint:game.i18n.localize("FP.Settings.Hint"),content:`<p>Hello ${actor.name} @UUID[Item.abcdefghijklmnop]</p>`}; ui.notifications.warn("Hello");';
  const output = await translateScript(source,translate,new AbortController().signal,'en');
  expect(output).toContain('const id="Sword"'); expect(output).toContain('Hooks.on("Hello"'); expect(output).toContain('"FP.Settings.Hint"');
  expect(output).toContain('${actor.name}'); expect(output).toContain('@UUID[Item.abcdefghijklmnop]'); expect(output).toContain('<p>Hola');
  expect(output).toContain('warn("Hola")');
});
it('escapes translated script literals and rejects invalid source syntax', async () => {
  const output = await translateScript('const ui={title:"Hello",content:`Hello ${actor.name}`};',async request=>request.texts.map(()=> 'Hola ` ${evil()} " \\'),new AbortController().signal,'en');
  expect(output).not.toContain('evil()'); expect(output).toContain('${actor.name}'); expect(inspectScript(output)).toHaveLength(2);
  expect(()=>inspectScript('const = broken')).toThrow();
});
it('keeps interpolated HTML attributes out of translation', async () => {
  const source = 'const ui={content:`<a href="${url}" class="${css}">Hello</a>`};';
  const output = await translateScript(source, async request => { expect(request.texts.join('')).not.toContain('href'); expect(request.texts.join('')).not.toContain('class'); return translate(request); }, new AbortController().signal,'en');
  expect(output).toBe('const ui={content:`<a href="${url}" class="${css}">Hola</a>`};');
});
it('does not translate technical literals inside UI callback functions', async () => {
  const source = 'const ui={content:()=>{const key="Hello"; return registry.get(key);},title:"Hello"};';
  const output = await translateScript(source,translate,new AbortController().signal,'en');
  expect(output).toContain('const key="Hello"'); expect(output).toContain('title:"Hola"');
});
it('rejects duplicate-key files before provider and preserves original copy', async () => {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'duplicate-batch-')); roots.push(root);
  const input=path.join(root,'module'); await fs.mkdir(path.join(input,'packs','items','_source'),{recursive:true});
  const source='{"name":"Attack","name":"Sword"}';
  await fs.writeFile(path.join(input,'packs','items','_source','duplicate.json'),source);
  let calls=0;
  const result=await runBatch(input,path.join(root,'copy'),async request=>{calls++;return request.texts;},new AbortController().signal,()=>{},'en',undefined,'module',undefined,'FULL_PORTABLE_COPY');
  expect(calls).toBe(0); expect(result.failed).toBe(1);
  expect(await fs.readFile(path.join(root,'copy','packs','items','_source','duplicate.json'),'utf8')).toBe(source);
});
