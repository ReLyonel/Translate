import fs from 'node:fs/promises';
import path from 'node:path';

export type MemoryEntryKind =
  | 'folder'
  | 'name-suffix'
  | 'babele-name'
  | 'explicit-pair'
  | 'legacy-term'
  | 'html-description';

export interface MemoryEntry {
  source: string;
  target: string;
  file: string;
  kind: MemoryEntryKind;
  fieldPath?: string;
  confidence: number;
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

const LEGACY_TERM_FIELDS = new Set([
  'skills',
  'abilities',
  'actionType',
  'activation',
  'weaponType',
  'equipmentType',
  'damageTypes',
  'spellSchools',
  'languages',
  'traits',
  'tools',
  'weaponProperties',
]);

const STANDARD_SHORT_KEYS = new Set([
  'str',
  'dex',
  'con',
  'int',
  'wis',
  'cha',
  'acr',
  'ani',
  'arc',
  'ath',
  'dec',
  'his',
  'ins',
  'itm',
  'inv',
  'med',
  'nat',
  'prc',
  'prf',
  'per',
  'rel',
  'slt',
  'ste',
  'sur',
]);

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const hasCyrillic = (value: string): boolean =>
  /[\u0400-\u04FF]/u.test(value);

const hasInvalidControlCharacters = (value: string): boolean =>
  value.includes('�') ||
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(value);

const normalizeTerm = (value: string): string =>
  value.replace(/\s+/g, ' ').trim();

const normalizeHtml = (value: string): string =>
  value.trim();

const hasNumericBonus = (value: string): boolean =>
  /\s\+\d+$/u.test(value);

const addPair = (
  entries: MemoryEntry[],
  terms: Map<string, Set<string>>,
  conflicts: Map<string, Set<string>>,
  source: string,
  target: string,
  file: string,
  kind: MemoryEntryKind,
  fieldPath?: string,
  confidence = 1,
): void => {
  const isHtml = kind === 'html-description';
  const cleanSource = isHtml ? normalizeHtml(source) : normalizeTerm(source);
  const cleanTarget = isHtml ? normalizeHtml(target) : normalizeTerm(target);

  if (!cleanSource || !cleanTarget || cleanSource === cleanTarget) return;

  // The corpus is a Spanish memory. A Cyrillic target indicates an untranslated
  // source leak and must never enter the active memory.
  if (
    hasInvalidControlCharacters(cleanSource) ||
    hasInvalidControlCharacters(cleanTarget) ||
    hasCyrillic(cleanTarget)
  ) {
    return;
  }

  entries.push({
    source: cleanSource,
    target: cleanTarget,
    file: path.normalize(file),
    kind,
    fieldPath,
    confidence,
  });

  const existing = terms.get(cleanSource) ?? new Set<string>();
  existing.add(cleanTarget);
  terms.set(cleanSource, existing);

  if (existing.size > 1) {
    conflicts.set(cleanSource, new Set(existing));
  }
};

const extractBracketSource = (
  value: string,
): { source: string; target: string } | null => {
  const match = value.match(/^(.+?)\s+\[([^\[\]]+)\]\s*$/u);
  if (!match) return null;

  const target = normalizeTerm(match[1]);
  const source = normalizeTerm(match[2]);

  if (!source || !target) return null;

  // A translated +N item cannot be aligned to a bracket source that lacks +N.
  if (!hasNumericBonus(source) && hasNumericBonus(target)) {
    return null;
  }

  return { source, target };
};

const getDescriptionValue = (value: unknown): string | null => {
  if (!isObjectRecord(value)) return null;

  const description = value.description;
  if (!isObjectRecord(description)) return null;

  return typeof description.value === 'string'
    ? description.value
    : null;
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

    const unique = new Map<string, MemoryEntry>();

    for (const entry of entries) {
      const key = [
        entry.source,
        entry.target,
        entry.kind,
        entry.file,
        entry.fieldPath ?? '',
      ].join('\u0000');

      const existing = unique.get(key);
      if (!existing || entry.confidence > existing.confidence) {
        unique.set(key, entry);
      }
    }

    return {
      entries: Array.from(unique.values()),
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
        '[TranslationMemory] No se pudo leer ' + filePath + ': ' + reason,
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

    const folders = json.folders;
    if (isObjectRecord(folders)) {
      for (const [source, target] of Object.entries(folders)) {
        if (typeof target !== 'string') continue;

        addPair(
          entries,
          terms,
          conflicts,
          source,
          target,
          filePath,
          'folder',
          'folders',
          0.9,
        );

        const sourceBracket = extractBracketSource(source);
        const targetBracket = extractBracketSource(target);

        if (sourceBracket && targetBracket) {
          addPair(
            entries,
            terms,
            conflicts,
            sourceBracket.source,
            targetBracket.target,
            filePath,
            'name-suffix',
            'folders',
            0.95,
          );
        }
      }
    }

    const flags = json.flags;
    const babele = isObjectRecord(flags) ? flags.babele : undefined;

    if (isObjectRecord(babele)) {
      this.extractBabelePairs(
        json,
        babele,
        filePath,
        'flags.babele',
        entries,
        terms,
        conflicts,
      );
    }

    const entriesNode = json.entries;
    if (isObjectRecord(entriesNode)) {
      for (const [entryId, entryValue] of Object.entries(entriesNode)) {
        if (!isObjectRecord(entryValue)) continue;

        this.extractNamePairs(
          entryValue,
          filePath,
          'entries.' + entryId,
          entries,
          terms,
          conflicts,
        );
      }
    }

    this.extractLegacyTerms(
      json,
      filePath,
      '',
      entries,
      terms,
      conflicts,
    );

    this.extractExplicitPairs(
      json,
      filePath,
      '',
      entries,
      terms,
      conflicts,
    );
  }

  private extractBabelePairs(
    translated: Record<string, unknown>,
    babele: Record<string, unknown>,
    filePath: string,
    fieldPath: string,
    entries: MemoryEntry[],
    terms: Map<string, Set<string>>,
    conflicts: Map<string, Set<string>>,
  ): void {
    const translatedName =
      typeof translated.name === 'string'
        ? translated.name
        : undefined;

    if (
      translatedName &&
      typeof babele.originalName === 'string'
    ) {
      addPair(
        entries,
        terms,
        conflicts,
        babele.originalName,
        translatedName,
        filePath,
        'babele-name',
        fieldPath + '.originalName',
        1,
      );
    }

    let originalPayload = babele.originalPayload;

    if (typeof originalPayload === 'string') {
      try {
        originalPayload = JSON.parse(originalPayload) as unknown;
      } catch {
        originalPayload = undefined;
      }
    }

    if (!isObjectRecord(originalPayload)) return;

    if (
      translatedName &&
      typeof originalPayload.name === 'string'
    ) {
      addPair(
        entries,
        terms,
        conflicts,
        originalPayload.name,
        translatedName,
        filePath,
        'babele-name',
        fieldPath + '.originalPayload.name',
        1,
      );
    }

    const originalDescription =
      getDescriptionValue(originalPayload);

    const translatedDescription =
      getDescriptionValue(translated);

    if (
      originalDescription !== null &&
      translatedDescription !== null
    ) {
      addPair(
        entries,
        terms,
        conflicts,
        originalDescription,
        translatedDescription,
        filePath,
        'html-description',
        fieldPath + '.originalPayload.system.description.value',
        1,
      );
    }

    if (
      typeof originalPayload.description === 'string' &&
      typeof translated.description === 'string'
    ) {
      addPair(
        entries,
        terms,
        conflicts,
        originalPayload.description,
        translated.description,
        filePath,
        'html-description',
        fieldPath + '.originalPayload.description',
        1,
      );
    }
  }

  private extractNamePairs(
    entry: Record<string, unknown>,
    filePath: string,
    fieldPath: string,
    entries: MemoryEntry[],
    terms: Map<string, Set<string>>,
    conflicts: Map<string, Set<string>>,
  ): void {
    this.walkNames(
      entry,
      filePath,
      fieldPath,
      entries,
      terms,
      conflicts,
    );
  }

  private walkNames(
    value: unknown,
    filePath: string,
    fieldPath: string,
    entries: MemoryEntry[],
    terms: Map<string, Set<string>>,
    conflicts: Map<string, Set<string>>,
  ): void {
    if (Array.isArray(value)) {
      value.forEach((child, index) => {
        this.walkNames(
          child,
          filePath,
          fieldPath + '[' + index + ']',
          entries,
          terms,
          conflicts,
        );
      });
      return;
    }

    if (!isObjectRecord(value)) return;

    for (const [key, child] of Object.entries(value)) {
      const nextPath = fieldPath
        ? fieldPath + '.' + key
        : key;

      if (IGNORED_KEYS.has(key)) continue;

      if (key === 'name' && typeof child === 'string') {
        const pair = extractBracketSource(child);

        if (pair) {
          addPair(
            entries,
            terms,
            conflicts,
            pair.source,
            pair.target,
            filePath,
            'name-suffix',
            nextPath,
            0.95,
          );
        }
      }

      if (isObjectRecord(child) || Array.isArray(child)) {
        this.walkNames(
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

  private extractLegacyTerms(
    value: unknown,
    filePath: string,
    fieldPath: string,
    entries: MemoryEntry[],
    terms: Map<string, Set<string>>,
    conflicts: Map<string, Set<string>>,
  ): void {
    if (Array.isArray(value)) {
      value.forEach((child, index) => {
        this.extractLegacyTerms(
          child,
          filePath,
          fieldPath + '[' + index + ']',
          entries,
          terms,
          conflicts,
        );
      });
      return;
    }

    if (!isObjectRecord(value)) return;

    for (const [key, child] of Object.entries(value)) {
      const nextPath = fieldPath
        ? fieldPath + '.' + key
        : key;

      if (
        LEGACY_TERM_FIELDS.has(key) &&
        isObjectRecord(child)
      ) {
        for (const [source, target] of Object.entries(child)) {
          if (typeof target !== 'string') continue;

          const sourceIsShort =
            STANDARD_SHORT_KEYS.has(source.toLowerCase());

          if (source.length < 3 && !sourceIsShort) continue;

          addPair(
            entries,
            terms,
            conflicts,
            source,
            target,
            filePath,
            'legacy-term',
            nextPath + '.' + source,
            0.85,
          );
        }
      }

      if (
        !IGNORED_KEYS.has(key) &&
        (isObjectRecord(child) || Array.isArray(child))
      ) {
        this.extractLegacyTerms(
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
          fieldPath + '[' + index + ']',
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
        1,
      );
    }

    for (const [key, child] of Object.entries(value)) {
      if (
        IGNORED_KEYS.has(key) ||
        key === 'source' ||
        key === 'target'
      ) {
        continue;
      }

      if (isObjectRecord(child) || Array.isArray(child)) {
        this.extractExplicitPairs(
          child,
          filePath,
          fieldPath ? fieldPath + '.' + key : key,
          entries,
          terms,
          conflicts,
        );
      }
    }
  }
}
