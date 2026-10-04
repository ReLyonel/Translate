import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runBatch } from '../../desktop/jobs';
import { translate, providers } from '../../desktop/providers';
import { validateSettings } from '../../desktop/security';

const directories: string[] = [];
afterEach(async () => { vi.restoreAllMocks(); vi.unstubAllGlobals(); await Promise.all(directories.splice(0).map(directory => fs.rm(directory, {recursive: true, force: true}))); });
async function fixture() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'foundry-batch-')); directories.push(directory);
  const input = path.join(directory, 'input'); await fs.mkdir(path.join(input, 'nested'), {recursive: true});
  await fs.writeFile(path.join(input, 'nested', 'item.json'), JSON.stringify({_id:'abcdefghijklmnop', name:'Sword', description:'<p>Attack @UUID[Item.abcdefghijklmnop] 1d20</p>', img:'icons/sword.webp'}));
  await fs.writeFile(path.join(input, 'broken.json'), '{invalid');
  await fs.writeFile(path.join(input, 'asset.bin'), Buffer.from([0, 255, 42]));
  return {input, output:path.join(directory, 'output')};
}
describe('interchangeable local providers', () => {
  const settings = {endpoint:'http://127.0.0.1:11500', model:'translategemma:12b', libreEndpoint:'http://127.0.0.1:5000', fallback:true};
  it('falls back only when enabled and never on cancellation', async () => {
    vi.spyOn(providers.ollama, 'translate').mockRejectedValue(new Error('Offline'));
    const fallback = vi.spyOn(providers.libretranslate, 'translate').mockResolvedValue(['Espada']);
    expect(await translate(settings, {texts:['Sword']})).toEqual(['Espada']);
    expect(fallback).toHaveBeenCalledTimes(1);
    await expect(translate({...settings, fallback:false}, {texts:['Sword']})).rejects.toThrow('Offline');
    const controller = new AbortController(); controller.abort();
    await expect(translate(settings, {texts:['Sword']}, new Map(), controller.signal)).rejects.toThrow();
    expect(fallback).toHaveBeenCalledTimes(1);
  });
  it('keeps markers out of LibreTranslate and restores whitespace', async () => {
    const fetcher = vi.fn().mockResolvedValue({ok:true, json:async () => ({translatedText:'Espada'})}); vi.stubGlobal('fetch', fetcher);
    expect(await translate({...settings, provider:'libretranslate'}, {texts:[' Sword [[PROTECTED_001]] ']})).toEqual([' Espada [[PROTECTED_001]] ']);
    expect(JSON.parse(fetcher.mock.calls[0][1].body).q).toBe('Sword');
  });
  it('rejects remote fallback endpoints and unsupported providers', () => {
    expect(() => validateSettings({...settings, libreEndpoint:'http://example.com'})).toThrow();
    expect(() => validateSettings({...settings, provider:'unknown'})).toThrow();
  });
  it('enforces exact explicit glossary terms with the lighter provider', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    expect(await translate({...settings, provider:'libretranslate'}, {texts:['Sword [[PROTECTED_001]]'], terminology:[{source:'Sword', target:'Espada'}]})).toEqual(['Espada [[PROTECTED_001]]']);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
describe('recursive folder jobs', () => {
  it('translates nested JSON, preserves assets and originals, and reports invalid JSON', async () => {
    const {input, output} = await fixture();
    const original = await fs.readFile(path.join(input,'nested','item.json'));
    const result = await runBatch(input, output, async request => request.texts.map(text => text.replace('Sword','Espada').replace('Attack','Ataque')), new AbortController().signal, () => {},'auto',undefined,'folder',undefined,'FULL_PORTABLE_COPY');
    expect(result).toMatchObject({state:'COMPLETED', total:2, completed:2, failed:1});
    expect(await fs.readFile(path.join(input,'nested','item.json'))).toEqual(original);
    const translated = JSON.parse(await fs.readFile(path.join(output,'nested','item.json'), 'utf8'));
    expect(translated.name).toBe('Espada'); expect(translated._id).toBe('abcdefghijklmnop');
    expect(translated.description).toContain('@UUID[Item.abcdefghijklmnop] 1d20');
    expect(await fs.readFile(path.join(output,'asset.bin'))).toEqual(Buffer.from([0,255,42]));
    expect(await fs.readFile(path.join(output,'broken.json'),'utf8')).toBe('{invalid');
    await expect(runBatch(input, output, async () => [], new AbortController().signal, () => {})).rejects.toThrow();
  });
  it('blocks an output inside the source folder', async () => {
    const {input} = await fixture();
    await expect(runBatch(input, path.join(input,'copy'), async () => [], new AbortController().signal, () => {})).rejects.toThrow();
  });
  it('cancels without committing the current translated file', async () => {
    const {input, output} = await fixture(); const controller = new AbortController();
    const result = await runBatch(input, output, async request => { controller.abort(); return request.texts; }, controller.signal, () => {},'auto',undefined,'folder',undefined,'FULL_PORTABLE_COPY');
    expect(result.state).toBe('CANCELLED');
    await expect(fs.stat(path.join(output,'nested','item.json'))).rejects.toThrow();
    expect((await fs.readdir(path.join(output,'nested'))).some(name => name.endsWith('.tmp'))).toBe(false);
  });
  it('copies the original and records an error when a provider corrupts references', async () => {
    const {input, output} = await fixture();
    const result = await runBatch(input, output, async request => request.texts.map(() => 'Texto sin referencias'), new AbortController().signal, () => {},'auto',undefined,'folder',undefined,'FULL_PORTABLE_COPY');
    expect(result.failed).toBe(2);
    const source=JSON.parse(await fs.readFile(path.join(input,'nested','item.json'),'utf8'));
    const restored=JSON.parse(await fs.readFile(path.join(output,'nested','item.json'),'utf8'));
    expect(restored.description).toBe(source.description);expect(restored._id).toBe(source._id);
    expect(result.outcomes?.find(file=>file.file.endsWith('item.json'))?.status).toBe('WARNING');
  });
});
