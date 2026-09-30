/**
 * Parses Ollama's response as the expected JSON array of strings.
 *
 * Ollama is instructed to emit native JSON, but a local model can still append
 * markdown or explanatory text. We therefore scan for complete JSON arrays and
 * accept only one that matches the expected output contract.
 */
export function parseJsonStringArray(raw: string, expectedLength: number): string[] {
  const source = raw.replace(/^\uFEFF/, '').trim();
  const candidates = extractBalancedArrays(source);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (
        Array.isArray(parsed) &&
        parsed.length === expectedLength &&
        parsed.every((value) => typeof value === 'string')
      ) {
        return parsed as string[];
      }
    } catch {
      // Try the next balanced array candidate.
    }
  }

  const preview = source.slice(0, 1200);
  throw new Error(
    [
      'Ollama no devolvió un arreglo JSON válido con la cantidad de traducciones esperada.',
      `Esperadas: ${expectedLength}.`,
      `Respuesta recibida (primeros 1200 caracteres): ${preview}`,
    ].join(' ')
  );
}

function extractBalancedArrays(source: string): string[] {
  const candidates: string[] = [];

  for (let start = 0; start < source.length; start++) {
    if (source[start] !== '[') continue;

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

      if (char === '[') {
        depth++;
      } else if (char === ']') {
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
