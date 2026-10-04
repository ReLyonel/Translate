import { describe, it, expect } from 'vitest';

import { validateSettings, validateTranslation, trustedSender, allowedRendererResource } from '../../desktop/security';
import { ProtectedContentEngine as Protection } from '../../src/services/protected-content/protectedContentEngine';

import path from 'node:path';

import { pathToFileURL } from 'node:url';



describe('desktop boundary', () => {
  it('binds original unit text to its protected payload and strips host callbacks',()=>{
    const sourceText='<p>Sword @UUID[Item.a]</p>',text=Protection.protect(sourceText).protectedText;
    const validated=validateTranslation({texts:[text],units:[{sourceText,context:{module:'untrusted'}}],onUnitFailure:()=>{}});
    expect(validated.units).toEqual([{sourceText}]);expect(validated.onUnitFailure).toBeUndefined();
    expect(()=>validateTranslation({texts:[text],units:[{sourceText:'Different'}]})).toThrow('TRANSLATION_UNIT_INVALID');
  });

  it('allows bundled assets but blocks arbitrary local files and remote resources', () => {

    const root = path.resolve('dist');

    expect(allowedRendererResource(pathToFileURL(path.join(root, 'assets/app.js')).href, root)).toBe(true);

    expect(allowedRendererResource(pathToFileURL(path.resolve('.env')).href, root)).toBe(false);

    expect(allowedRendererResource(pathToFileURL(path.resolve('dist-other/secret.txt')).href, root)).toBe(false);

    expect(allowedRendererResource('https://example.com/script.js', root)).toBe(false);

  });

  it('accepts only local Ollama endpoints without credentials', () => {

    expect(validateSettings({ endpoint: 'http://127.0.0.1:11500', model: 'translategemma:27b' })).toEqual({ endpoint: 'http://127.0.0.1:11500', model: 'translategemma:27b', provider: 'ollama', libreEndpoint: 'http://127.0.0.1:5000', fallback: false, thermalEnabled: true });

    for (const endpoint of ['https://example.com', 'http://127.0.0.1.evil.com', 'file:///secret', 'http://secret@localhost:11434', 'http://localhost:11434/?key=secret']) {

      expect(() => validateSettings({ endpoint, model: 'model' })).toThrow();

    }

  });

  it('rejects untrusted windows, frames and navigations', () => {

    const url = 'file:///app/dist/index.html';

    expect(trustedSender(1, url, true, 1, url)).toBe(true);

    expect(trustedSender(2, url, true, 1, url)).toBe(false);

    expect(trustedSender(1, url, false, 1, url)).toBe(false);

    expect(trustedSender(1, 'https://evil.com', true, 1, url)).toBe(false);

  });

  it('rejects malformed payloads and strips arbitrary fields/secrets', () => {

    for (const payload of [null, {}, { texts: [] }, { texts: [42] }, { texts: ['ok'], terminology: [null] }, { texts: ['ok'], context: { notes: 42 } }]) {

      expect(() => validateTranslation(payload)).toThrow();

    }

    const result = validateTranslation({ texts: ['[[PROTECTED_001]]'], apiKey: 'secret', path: 'C:/secret', terminology: [{ source: 'Attack', target: 'Ataque', apiKey: 'secret' }], context: { docType: 'item', apiKey: 'secret' } });

    expect(JSON.stringify(result)).not.toContain('secret');

    expect(result.texts).toEqual(['[[PROTECTED_001]]']);

  });

});

