import { afterEach, describe, expect, it, vi } from 'vitest';
import { health, translate } from '../../desktop/ollama';
const settings = { endpoint: 'http://127.0.0.1:11500', model: 'translategemma:27b' };
afterEach(() => vi.unstubAllGlobals());
describe('desktop Ollama adapter', () => {
  it('detects Russian and allows explicit source language', async () => {
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(Response.json({ message: { content: 'Archivo' } })));
    vi.stubGlobal('fetch', fetcher);
    await translate(settings, { texts: ['Архив'], sourceLanguage: 'auto' });
    expect(JSON.parse(fetcher.mock.calls[0][1].body).messages[0].content).toContain('Russian (ru)');
    await translate(settings, { texts: ['Архив'], sourceLanguage: 'en' });
    expect(JSON.parse(fetcher.mock.calls[1][1].body).messages[0].content).toContain('English (en)');
  });
  it('uses local health and reports installed model', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ models: [{ name: settings.model }] }));
    vi.stubGlobal('fetch', fetcher);
    expect(await health(settings)).toMatchObject({ executionMode: 'LOCAL', connected: true, modelInstalled: true });
    expect(fetcher.mock.calls[0][0]).toBe(settings.endpoint + '/api/tags');
  });
  it('keeps opaque placeholders and glossary priority in provider payload', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ message: { content: 'Ataque [[PROTECTED_001]]' } }));
    vi.stubGlobal('fetch', fetcher);
    expect(await translate(settings, { texts: ['Attack [[PROTECTED_001]]'], terminology: [{ source: 'Attack', target: 'Ataque' }] }, new Map([['Attack', 'Otro']]))).toEqual(['Ataque [[PROTECTED_001]]']);
    const body = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(body.model).toBe(settings.model);
    expect(body.messages[0].content).toContain('["Attack","Ataque"]');
    expect(body.messages[0].content).not.toContain('Otro');
    expect(body.messages[0].content).toContain('[[PROTECTED_001]]');
  });
  it('retries malformed provider output once and hides raw errors', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('secret-api-key-in-response'));
    vi.stubGlobal('fetch', fetcher);
    await expect(translate(settings, { texts: ['Attack'] })).rejects.toThrow('No se pudo obtener una traducción válida');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('recovers after one malformed response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({ message: { content: '{}' } })).mockResolvedValueOnce(Response.json({ message: { content: 'Ataque' } })));
    expect(await translate(settings, { texts: ['Attack'] })).toEqual(['Ataque']);
  });
  it('preserves adjacent opaque tokens and spaces in a single-unit request', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ message: { content: '[[PROTECTED_001]][[PROTECTED_002]] Archivo [[PROTECTED_003]]' } }));
    vi.stubGlobal('fetch', fetcher);
    expect(await translate(settings, { texts: ['[[PROTECTED_001]][[PROTECTED_002]] Архив [[PROTECTED_003]]'] })).toEqual(['[[PROTECTED_001]][[PROTECTED_002]] Archivo [[PROTECTED_003]]']);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('rejects invented placeholders including template markers', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(Response.json({ message: { content: '{"translations":["[[PROTECTED_###]] Archivo"]}' } }))));
    await expect(translate(settings, { texts: ['Архив'] })).rejects.toThrow('No se pudo obtener');
  });
  it('counts real HTTP attempts, failures and retries',async()=>{
    const telemetry=vi.fn();
    const fetcher=vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(Response.json({message:{content:'Espada'}}));
    vi.stubGlobal('fetch',fetcher);
    await translate(settings,{texts:['Sword'],telemetry});
    expect(telemetry.mock.calls.map(call=>call[0])).toEqual(['ollama_requests','ollama_failures','ollama_retries','ollama_requests']);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
