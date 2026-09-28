import { TerminologyEntry, TranslationContext, ProtectedToken } from '../../types';
import { terminologyEngine } from '../terminology/terminologyEngine';
import { ProtectedContentEngine } from '../protected-content/protectedContentEngine';

export interface TranslationResult {
  originalText: string;
  translatedText: string;
  matchedTerms: TerminologyEntry[];
  uncertainTerms: string[];
  tokensCount: number;
  isValid: boolean;
  errors: string[];
}

export interface TranslationProvider {
  name: string;
  translate(
    texts: string[],
    terminology: TerminologyEntry[],
    context?: TranslationContext
  ): Promise<string[]>;
}

export class GeminiTranslationProvider implements TranslationProvider {
  public name = 'Google Gemini (gemini-3.8-flash)';

  public async translate(
    texts: string[],
    terminology: TerminologyEntry[],
    context?: TranslationContext
  ): Promise<string[]> {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        texts,
        terminology,
        context,
        sourceLanguage: 'English',
        targetLanguage: 'Spanish',
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Error HTTP ${res.status} al traducir con el servidor.`);
    }

    const data = await res.json();
    return data.translations;
  }
}

export class TranslationService {
  private provider: TranslationProvider;

  constructor(provider?: TranslationProvider) {
    this.provider = provider || new GeminiTranslationProvider();
  }

  public setProvider(provider: TranslationProvider) {
    this.provider = provider;
  }

  /**
   * Translates a single text string through the full D&D localization pipeline:
   * 1. Terminology detection & retrieval
   * 2. Programmatic protection of macros, UUIDs, formulas
   * 3. Translation via provider with strict system constraints
   * 4. Placeholder restoration & integrity verification
   */
  public async translateSingle(
    text: string,
    context?: TranslationContext
  ): Promise<TranslationResult> {
    if (!text || text.trim() === '') {
      return {
        originalText: text,
        translatedText: text,
        matchedTerms: [],
        uncertainTerms: [],
        tokensCount: 0,
        isValid: true,
        errors: [],
      };
    }

    // 1. Detect terminology
    const { matches: matchedTerms, uncertain: uncertainTerms } = terminologyEngine.findMatchesInText(text, context);

    // 2. Protect content
    const { protectedText, tokens } = ProtectedContentEngine.protect(text);

    // 3. Translate protected text
    const [translatedProtected] = await this.provider.translate(
      [protectedText],
      matchedTerms,
      context
    );

    // 4. Restore placeholders
    const { restoredText, isValid, errors } = ProtectedContentEngine.restore(
      translatedProtected,
      tokens
    );

    return {
      originalText: text,
      translatedText: restoredText,
      matchedTerms,
      uncertainTerms,
      tokensCount: tokens.size,
      isValid,
      errors,
    };
  }

  /**
   * Translates a batch of texts in chunks to optimize token usage and avoid rate limits.
   */
  public async translateBatch(
    items: { id: string; text: string; context?: TranslationContext }[],
    options: {
      batchSize?: number;
      onProgress?: (completed: number, total: number, currentItem: string) => void;
      signal?: AbortSignal;
    } = {}
  ): Promise<Map<string, TranslationResult>> {
    const batchSize = options.batchSize || 8;
    const results = new Map<string, TranslationResult>();
    const total = items.length;
    let completed = 0;

    for (let i = 0; i < total; i += batchSize) {
      if (options.signal?.aborted) {
        throw new Error('Traducción cancelada por el usuario.');
      }

      const chunk = items.slice(i, i + batchSize);

      // Prepare chunk: detect terms & protect
      const chunkPrepared = chunk.map((item) => {
        const { matches, uncertain } = terminologyEngine.findMatchesInText(item.text, item.context);
        const { protectedText, tokens } = ProtectedContentEngine.protect(item.text);
        return {
          id: item.id,
          original: item.text,
          protectedText,
          tokens,
          matches,
          uncertain,
          context: item.context,
        };
      });

      // Merge unique terminology across chunk
      const mergedTermsMap = new Map<string, TerminologyEntry>();
      for (const p of chunkPrepared) {
        for (const m of p.matches) {
          mergedTermsMap.set(m.source.toLowerCase(), m);
        }
      }
      const chunkTerms = Array.from(mergedTermsMap.values());

      // Translate chunk via server
      const translatedBatch = await this.provider.translate(
        chunkPrepared.map((p) => p.protectedText),
        chunkTerms,
        chunk[0]?.context
      );

      // Restore each item
      for (let j = 0; j < chunkPrepared.length; j++) {
        const p = chunkPrepared[j];
        const transProtected = translatedBatch[j] || p.original;
        const { restoredText, isValid, errors } = ProtectedContentEngine.restore(
          transProtected,
          p.tokens
        );

        results.set(p.id, {
          originalText: p.original,
          translatedText: restoredText,
          matchedTerms: p.matches,
          uncertainTerms: p.uncertain,
          tokensCount: p.tokens.size,
          isValid,
          errors,
        });

        completed++;
        if (options.onProgress) {
          options.onProgress(completed, total, p.original.slice(0, 40));
        }
      }
    }

    return results;
  }
}

// Global Singleton
export const translationService = new TranslationService();
