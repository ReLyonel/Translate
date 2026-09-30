import { describe, expect, it } from 'vitest';
import { parseTranslationResponse } from './jsonResponseParser';

describe('Ollama JSON response parser', () => {
  it('accepts valid JSON followed by explanatory text', () => {
    const raw = '["Primera traducción", "Segunda traducción"]\\n\\nListo.';
    expect(parseTranslationResponse(raw, 2)).toEqual([
      'Primera traducción',
      'Segunda traducción',
    ]);
  });

  it('accepts Ollama structured output with a translations property', () => {
    const raw = '{"translations":["Primera","Segunda"]}';
    expect(parseTranslationResponse(raw, 2)).toEqual(['Primera', 'Segunda']);
  });

  it('accepts a translation object emitted by a translation-tuned model', () => {
    const raw = '{"Original uno":"Primera","Original dos":"Segunda"}';
    expect(parseTranslationResponse(raw, 2)).toEqual(['Primera', 'Segunda']);
  });

  it('accepts JSON wrapped in markdown fences', () => {
    const raw = 'Aquí está el resultado:\\n\\n```json\\n["Primera", "Segunda"]\\n```';
    expect(parseTranslationResponse(raw, 2)).toEqual(['Primera', 'Segunda']);
  });

  it('handles brackets and escaped quotes inside translated strings', () => {
    const raw = '["Texto con [corchetes] y \\"comillas\\"", "Segundo"] texto extra';
    expect(parseTranslationResponse(raw, 2)).toEqual([
      'Texto con [corchetes] y "comillas"',
      'Segundo',
    ]);
  });

  it('rejects an array with the wrong number of items', () => {
    expect(() => parseTranslationResponse('["Uno"]', 2)).toThrow(/Esperadas: 2/);
  });

  it('rejects responses without a valid JSON array', () => {
    expect(() => parseTranslationResponse('No hay JSON válido aquí.', 2)).toThrow(
      /no devolvió un arreglo JSON válido/
    );
  });
});
