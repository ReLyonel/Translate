import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

export type MemoryStatus = 'approved' | 'review' | 'rejected';
export interface TranslationMemoryEntry { source: string; target: string; sourceHash: string; sourceLanguage: 'en'; targetLanguage: 'es'; sourceDocument: string; sourcePage: number; targetDocument: string; targetPage: number; confidence: number; status: MemoryStatus; authority: string; matchType: string; }
export interface TranslationMatch { entry: TranslationMemoryEntry; matchType: 'hash' | 'normalized' | 'exact' | 'phrase' | 'fuzzy'; confidence: number; }
const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();
export const sourceHash = (value: string) => createHash('sha256').update(normalize(value)).digest('hex');

/** Loads local JSONL memory and only returns approved, high-confidence automatic matches. */
export class TranslationSourceManager {
  public constructor(private entries: TranslationMemoryEntry[] = []) {}
  public static fromJsonl(file = 'data/sources/translation-memory/en-es.jsonl') {
    if (!existsSync(file)) return new TranslationSourceManager();
    return new TranslationSourceManager(readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line) as TranslationMemoryEntry));
  }
  public find(source: string): TranslationMatch | undefined {
    const approved = this.entries.filter((entry) => entry.status === 'approved' && entry.confidence >= 0.9);
    const hash = sourceHash(source);
    const exactHash = approved.find((entry) => entry.sourceHash === hash);
    if (exactHash) return { entry: exactHash, matchType: 'hash', confidence: 1 };
    const normalized = normalize(source);
    const exact = approved.find((entry) => normalize(entry.source) === normalized);
    if (exact) return { entry: exact, matchType: 'normalized', confidence: 1 };
    const phrase = approved.find((entry) => normalized.length >= 16 && normalize(entry.source).includes(normalized));
    if (phrase) return { entry: phrase, matchType: 'phrase', confidence: 0.92 };
    return undefined; // fuzzy matches are review-only, never automatic.
  }
}
