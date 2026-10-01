import fs from 'node:fs/promises';
import path from 'node:path';

export type MemoryEntryKind =
  | 'folder'
  | 'name-suffix'
  | 'babele-name'
  | 'explicit-pair';

export interface MemoryEntry {
  source: string;
  target: string;
  file: string;
  kind: MemoryEntryKind;
  fieldPath?: string;
}

export interface TranslationMemory {
  entries: MemoryEntry[];
  terms: Map<string, Set<string>>;
  conflicts: Map<string, Set<string>>;
}

const IGNORED_KEYS = new Set([
  'mapping',
  '_stats',
  'ownership',
  'permission',
  'flags',
  '_id',
  'id',
  'uuid',
  '_key',
  'img',
  'icon',
  'src',
  'format',
  'type',
]);

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const cleanText = (value: string): string =>
  value.replace(/\s+/g, ' ').trim();

const addPair = (
  entries: MemoryEntry[],
  terms: Map<string, Set<string>>,
  conflicts: Map<string, Set<string>>,
  source: string,
  target: string,
  file: string,
  kind: MemoryEntryKind,
  fieldPath?: string,
) => {
  const cleanSource = cleanText(source);
  const cleanTarget = cleanText(target);

  if (!cleanSource || !cleanTarget || cleanSource === cleanTarget) return;

  entries.push({
    source: cleanSource,
    target: cleanTarget,
    file,
    kind,
    fieldPath,
  });

  const existing = terms.get(cleanSource) ?? new Set<string>();
  existing.add(cleanTarget);
  terms.set(cleanSource, existing);

  if (existing.size > 1) {
    conflicts.set(cleanSource, new Set(existing));
  }
};

const extractBracketSource = (value: string): { source: string; target: string } | null => {
  const match = value.match(/^(.*?)\s+\[([^\[\]]+)\]\s*$/);
  if (!match) return null;

  const target = cleanText(match[1]);
  const source = cleanText(match[2]);

  if (!target || !source) return null;
  return { source, target };
};

export class TranslationMemoryLoader {
  constructor(private readonly rootPath: string) {}

  public async load(): Promise<TranslationMemory> {
    const entries: MemoryEntry[] = [];
    const terms = new Map<string, Set<string>>();
    const conflicts = new Map<string, Set<string>>();

    await this.scanDirectory(
      this.rootPath,
      entries,
      terms,
      conflicts,
    );

    return {
      entries,
      terms,
      conflicts,
    };
  }

  private async scanDirectory(
    directory: string,
    entries: MemoryEntry[],
    terms: Map<string, Set<string>>,
    conflicts: Map<string, Set<string>>,
  ): Promise<void> {
    const files = await fs.readdir(directory, { withFileTypes: true });

    for (const file of files) {
      const fullPath = path.join(directory, file.name);

      if (file.isDirectory()) {
        await this.scanDirectory(fullPath, entries, terms, conflicts);
        continue;
      }

      if (!file.name.toLowerCase().endsWith('.json')) continue;

      await this.readJson(fullPath, entries, terms, conflicts);
    }
  }

  private async readJson(
    filePath: string,
    entries: MemoryEntry[],
    terms: Map<string, Set<string>>,
    conflicts: Map<string, Set<string>>,
  ): Promise<void> {
    try {
      // Explicit UTF-8 decoding is important because the corpus contains
      // Russian source text and may be UTF-8 without a BOM.
      const raw = await fs.readFile(filePath, 'utf8');
      const json = JSON.parse(raw) as unknown;

      this.extractDocumentPairs(
        json,
        filePath,
        entries,
        terms,
        conflicts,
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(
        `[TranslationMemory] No se pudo leer ${filePath}: ${reason}`,
      );
    }
  }

  private extractDocumentPairs(
    json: unknown,
    filePath: string,
    entries: MemoryEntry[],
    terms: Map<string, Set<string>>,
    conflicts: Map<string, Set<string>>,
  ): void {
    if (!isObjectRecord(json)) return;

    // FifthPendium/Babele folder maps are direct source -> Spanish pairs.
    const folders = json.folders;
    if (isObjectRecord(folders)) {
      for (const [source, target] of Object.entries(folders)) {
        if (typeof target === 'string') {
          addPair(
            entries,
            terms,
            conflicts,
            source,
            target,
            filePath,
            'folder',
            'folders',
          );
        }
      }
    }

    // Babele-exported documents can carry the original name alongside the
    // translated document name.
    const babele = json.flags && isObjectRecord(json.flags)
      ? json.flags.babele
      : undefined;

    if (isObjectRecord(babele)) {
      const translatedName = typeof json.name === 'string' ? json.name : undefined;
      const originalName = typeof babele.originalName === 'string'
        ? babele.originalName
        : undefined;

      if (translatedName && originalName) {
        addPair(
          entries,
          terms,
          conflicts,
          originalName,
          translatedName,
          filePath,
          'babele-name',
          'name',
        );
      }

      const originalPayload = babele.originalPayload;
      if (isObjectRecord(originalPayload)) {
        const payloadName = typeof originalPayload.name === 'string'
          ? originalPayload.name
          : undefined;

        if (translatedName && payloadName) {
          addPair(
            entries,
            terms,
            conflicts,
            payloadName,
            translatedName,
            filePath,
            'babele-name',
            'name',
          );
        }
      }
    }

    const entriesNode = json.entries;
    if (isObjectRecord(entriesNode)) {
      for (const [entryId, entryValue] of Object.entries(entriesNode)) {
        if (!isObjectRecord(entryValue)) continue;

        this.extractEntry(
          entryValue,
          filePath,
          `entries.${entryId}`,
          entries,
          terms,
          conflicts,
        );
      }
    }

    // Some legacy JSON files are already explicit source -> target maps.
    this.extractExplicitPairs(
      json,
      filePath,
      '',
      entries,
      terms,
      conflicts,
    );
  }

  private extractEntry(
    entry: Record<string, unknown>,
    filePath: string,
    fieldPath: string,
    entries: MemoryEntry[],
    terms: Map<string, Set<string>>,
    conflicts: Map<string, Set<string>>,
  ): void {
    this.walkForNamePairs(
      entry,
      filePath,
      fieldPath,
      entries,
      terms,
      conflicts,
    );
  }

  private walkForNamePairs(
    value: unknown,
    filePath: string,
    fieldPath: string,
    entries: MemoryEntry[],
    terms: Map<string, Set<string>>,
    conflicts: Map<string, Set<string>>,
  ): void {
    if (!isObjectRecord(value)) return;

    for (const [key, child] of Object.entries(value)) {
      const nextPath = fieldPath ? `${fieldPath}.${key}` : key;

      if (IGNORED_KEYS.has(key)) continue;

      if (key === 'name' && typeof child === 'string') {
        const bracketPair = extractBracketSource(child);
        if (bracketPair) {
          addPair(
            entries,
            terms,
            conflicts,
            bracketPair.source,
            bracketPair.target,
            filePath,
            'name-suffix',
            nextPath,
          );
        }
      }

      if (isObjectRecord(child) || Array.isArray(child)) {
        this.walkForNamePairs(
          child,
          filePath,
          nextPath,
          entries,
          terms,
          conflicts,
        );
      }
    }
  }

  private extractExplicitPairs(
    value: unknown,
    filePath: string,
    fieldPath: string,
    entries: MemoryEntry[],
    terms: Map<string, Set<string>>,
    conflicts: Map<string, Set<string>>,
  ): void {
    if (Array.isArray(value)) {
      value.forEach((child, index) => {
        this.extractExplicitPairs(
          child,
          filePath,
          `${fieldPath}[${index}]`,
          entries,
          terms,
          conflicts,
        );
      });
      return;
    }

    if (!isObjectRecord(value)) return;

    if (
      typeof value.source === 'string' &&
      typeof value.target === 'string'
    ) {
      addPair(
        entries,
        terms,
        conflicts,
        value.source,
        value.target,
        filePath,
        'explicit-pair',
        fieldPath,
      );
    }

    for (const [key, child] of Object.entries(value)) {
      if (IGNORED_KEYS.has(key)) continue;

      // Avoid interpreting arbitrary Foundry objects as source/target maps.
      if (key === 'source' || key === 'target') continue;

      this.extractExplicitPairs(
        child,
        filePath,
        fieldPath ? `${fieldPath}.${key}` : key,
        entries,
        terms,
        conflicts,
      );
    }
  }
}
