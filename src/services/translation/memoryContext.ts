import fs from 'node:fs/promises';
import path from 'node:path';

export interface MemoryTerm {
  source: string;
  target: string;
}

interface GeneratedMemoryPayload {
  terms?: Record<string, string>;
}

const DEFAULT_MEMORY_FILES = [
  path.resolve(
    process.cwd(),
    'data',
    'sources',
    'translation-memory',
    'generated',
    'fifthpendium-memory.json',
  ),
  path.resolve(
    process.cwd(),
    'data',
    'sources',
    'translation-memory',
    'fifthpendium-memory.json',
  ),
];

let cachedTerms: Map<string, string> | null = null;

export async function loadTranslationMemoryTerms(): Promise<Map<string, string>> {
  if (cachedTerms) return cachedTerms;

  for (const file of DEFAULT_MEMORY_FILES) {
    try {
      const raw = await fs.readFile(file, 'utf8');
      const payload = JSON.parse(raw) as GeneratedMemoryPayload;

      if (!payload.terms || typeof payload.terms !== 'object') {
        continue;
      }

      cachedTerms = new Map(
        Object.entries(payload.terms)
          .filter(
            ([source, target]) =>
              source.trim().length >= 3 &&
              typeof target === 'string' &&
              target.trim().length > 0,
          )
          .map(([source, target]) => [source, target]),
      );

      return cachedTerms;
    } catch {
      // Try the next supported location. Missing memory is a valid degraded mode.
    }
  }

  cachedTerms = new Map();
  return cachedTerms;
}

export function findRelevantMemoryTerms(
  texts: string[],
  terms: Map<string, string>,
  maxTerms = 48,
): MemoryTerm[] {
  if (terms.size === 0 || texts.length === 0) {
    return [];
  }

  const haystacks = texts.map((text) => text.toLocaleLowerCase('es'));

  return [...terms.entries()]
    .filter(([source]) => {
      const normalized = source.toLocaleLowerCase('es');
      return haystacks.some((text) => text.includes(normalized));
    })
    .sort((a, b) => {
      // Prefer longer phrases so "Saving Throw" wins over "Throw".
      return b[0].length - a[0].length;
    })
    .slice(0, maxTerms)
    .map(([source, target]) => ({ source, target }));
}

export function mergeTerminology(
  explicitTerms: MemoryTerm[],
  memoryTerms: MemoryTerm[],
): MemoryTerm[] {
  const merged = new Map<string, MemoryTerm>();

  for (const term of memoryTerms) {
    merged.set(term.source.toLocaleLowerCase('es'), term);
  }

  // User/system terminology always wins over historical memory.
  for (const term of explicitTerms) {
    if (
      !term ||
      typeof term.source !== 'string' ||
      typeof term.target !== 'string' ||
      !term.source.trim() ||
      !term.target.trim()
    ) {
      continue;
    }

    merged.set(
      term.source.toLocaleLowerCase('es'),
      {
        source: term.source.trim(),
        target: term.target.trim(),
      },
    );
  }

  return [...merged.values()];
}

export function resetTranslationMemoryCache(): void {
  cachedTerms = null;
}
