/**
 * Parses Ollama's response as the expected translation payload.
 *
 * Preferred contract:
 *   { "translations": ["...", "..."] }
 *
 * Compatibility fallbacks:
 *   - a bare JSON array of strings
 *   - an object whose values are the translated strings
 *
 * The latter is intentionally kept as a fallback for translation-tuned local
 * models such as TranslateGemma that may naturally emit source -> translation
 * maps despite an explicit array instruction.
 */
export function parseTranslationResponse(raw: string, expectedLength: number): string[] {
  const source = raw.replace(/^\uFEFF/, '').trim();
  const candidates = extractBalancedJsonValues(source);

  for (const candidate of candidates) {
    let parsed: unknown;

    try {
      parsed = JSON.parse(candidate);
    } catch {
      continue;
    }

    const translations = extractTranslations(parsed, expectedLength);
    if (translations) return translations;
  }

  const preview = source.slice(0, 1200);
  throw new Error(
    [
      'Ollama no devolvió una respuesta JSON válida con la cantidad de traducciones esperada.',
      `Esperadas: ${expectedLength}.`,
      `Respuesta recibida (primeros 1200 caracteres): ${preview}`,
    ].join(' ')
  );
}

function extractTranslations(parsed: unknown, expectedLength: number): string[] | null {
  if (Array.isArray(parsed)) {
    if (
      parsed.length === expectedLength &&
      parsed.every((value) => typeof value === 'string')
    ) {
      return parsed as string[];
    }
    return null;
  }

  if (!parsed || typeof parsed !== 'object') return null;

  const record = parsed as Record<string, unknown>;

  if ('translations' in record) {
    const translations = record.translations;
    if (
      Array.isArray(translations) &&
      translations.length === expectedLength &&
      translations.every((value) => typeof value === 'string')
    ) {
      return translations as string[];
    }
    return null;
  }

  const values = Object.values(record);
  if (
    values.length === expectedLength &&
    values.every((value) => typeof value === 'string')
  ) {
    return values as string[];
  }

  return null;
}

function extractBalancedJsonValues(source: string): string[] {
  const candidates: string[] = [];

  for (let start = 0; start < source.length; start++) {
    const opening = source[start];
    if (opening !== '[' && opening !== '{') continue;

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < source.length; index++) {
      const char = source[index];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === '\\\\') {
          escaped = true;
        } else if (char === '"') {
          inString = false;
        }
        continue;
      }

      if (char === '"') {
        inString = true;
        continue;
      }

      if (char === '[' || char === '{') {
        depth++;
      } else if (char === ']' || char === '}') {
        depth--;
        if (depth === 0) {
          candidates.push(source.slice(start, index + 1));
          break;
        }
      }
    }
  }

  return candidates;
}
