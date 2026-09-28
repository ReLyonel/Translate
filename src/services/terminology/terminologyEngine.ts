import { TerminologyEntry, TranslationContext, DisambiguationRule } from '../../types';
import { OFFICIAL_SRD_TERMS, DISAMBIGUATION_RULES } from './defaultTerms';

const STORAGE_KEY = 'dnd_translator_glossary_v1';
const PDF_MEMORY_KEY = 'dnd_translator_pdf_terms_v1';

export class TerminologyEngine {
  private terms: Map<string, TerminologyEntry> = new Map();
  private pdfTerms: Map<string, TerminologyEntry> = new Map();
  private userTerms: Map<string, TerminologyEntry> = new Map();

  constructor() {
    this.initDefaultTerms();
    this.loadFromStorage();
  }

  private initDefaultTerms() {
    for (const term of OFFICIAL_SRD_TERMS) {
      this.terms.set(term.source.toLowerCase(), term);
    }
  }

  public loadFromStorage() {
    try {
      const storedUser = localStorage.getItem(STORAGE_KEY);
      if (storedUser) {
        const parsed: TerminologyEntry[] = JSON.parse(storedUser);
        for (const t of parsed) {
          this.userTerms.set(t.source.toLowerCase(), t);
        }
      }

      const storedPdf = localStorage.getItem(PDF_MEMORY_KEY);
      if (storedPdf) {
        const parsed: TerminologyEntry[] = JSON.parse(storedPdf);
        for (const t of parsed) {
          this.pdfTerms.set(t.source.toLowerCase(), t);
        }
      }
    } catch (e) {
      console.error('Error loading stored terminology:', e);
    }
  }

  public saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(this.userTerms.values())));
      localStorage.setItem(PDF_MEMORY_KEY, JSON.stringify(Array.from(this.pdfTerms.values())));
    } catch (e) {
      console.error('Error saving terminology to storage:', e);
    }
  }

  public addPdfTerms(entries: TerminologyEntry[]) {
    for (const entry of entries) {
      const normalized = entry.source.toLowerCase().trim();
      const existing = this.pdfTerms.get(normalized);
      this.pdfTerms.set(normalized, {
        ...entry,
        id: existing?.id || entry.id || `pdf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        sourceDocument: entry.sourceDocument || 'PDF Oficial D&D 2024',
        confidence: entry.confidence || 'high',
        status: 'confirmed',
      });
    }
    this.saveToStorage();
  }

  public addUserTerm(entry: Omit<TerminologyEntry, 'id'> & { id?: string }): TerminologyEntry {
    const id = entry.id || `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const fullEntry: TerminologyEntry = {
      ...entry,
      id,
      userApproved: true,
      status: 'confirmed',
      confidence: 'high',
    };
    this.userTerms.set(entry.source.toLowerCase().trim(), fullEntry);
    this.saveToStorage();
    return fullEntry;
  }

  public updateTerm(id: string, updates: Partial<TerminologyEntry>) {
    // Check in userTerms
    for (const [key, term] of this.userTerms.entries()) {
      if (term.id === id) {
        this.userTerms.set(key, { ...term, ...updates });
        this.saveToStorage();
        return;
      }
    }
    // Check in pdfTerms
    for (const [key, term] of this.pdfTerms.entries()) {
      if (term.id === id) {
        this.pdfTerms.set(key, { ...term, ...updates, userApproved: true });
        this.saveToStorage();
        return;
      }
    }
    // Check in default terms -> promote to user override
    for (const [, term] of this.terms.entries()) {
      if (term.id === id) {
        this.addUserTerm({ ...term, ...updates, userApproved: true });
        return;
      }
    }
  }

  public deleteTerm(id: string) {
    for (const [key, term] of this.userTerms.entries()) {
      if (term.id === id) {
        this.userTerms.delete(key);
        this.saveToStorage();
        return;
      }
    }
    for (const [key, term] of this.pdfTerms.entries()) {
      if (term.id === id) {
        this.pdfTerms.delete(key);
        this.saveToStorage();
        return;
      }
    }
  }

  public clearPdfMemory() {
    this.pdfTerms.clear();
    this.saveToStorage();
  }

  public resetToDefault() {
    this.userTerms.clear();
    this.pdfTerms.clear();
    this.terms.clear();
    this.initDefaultTerms();
    this.saveToStorage();
  }

  /**
   * Hierarchy resolution:
   * 1. userApproved / userTerms
   * 2. pdfTerms (sourceDocument === PDF)
   * 3. official SRD / D&D 2024 terms
   */
  public getEffectiveTerm(sourceText: string): TerminologyEntry | undefined {
    const key = sourceText.toLowerCase().trim();
    if (this.userTerms.has(key)) {
      return this.userTerms.get(key);
    }
    if (this.pdfTerms.has(key)) {
      return this.pdfTerms.get(key);
    }
    if (this.terms.has(key)) {
      return this.terms.get(key);
    }
    return undefined;
  }

  public getAllTerms(): TerminologyEntry[] {
    const merged = new Map<string, TerminologyEntry>();
    // Base SRD
    for (const [key, val] of this.terms) {
      merged.set(key, val);
    }
    // PDF overrides
    for (const [key, val] of this.pdfTerms) {
      merged.set(key, val);
    }
    // User overrides
    for (const [key, val] of this.userTerms) {
      merged.set(key, val);
    }
    return Array.from(merged.values());
  }

  public getPdfTermsCount(): number {
    return this.pdfTerms.size;
  }

  public getUserTermsCount(): number {
    return this.userTerms.size;
  }

  public getDisambiguationRule(term: string): DisambiguationRule | undefined {
    const lower = term.toLowerCase().trim();
    return DISAMBIGUATION_RULES.find((r) => r.term.toLowerCase() === lower);
  }

  /**
   * Detects all terminology matches inside a piece of English text.
   * Uses multi-word greedy matching (longest phrases checked first).
   */
  public findMatchesInText(
    text: string,
    context?: TranslationContext
  ): { matches: TerminologyEntry[]; uncertain: string[] } {
    if (!text || typeof text !== 'string') {
      return { matches: [], uncertain: [] };
    }

    const allTerms = this.getAllTerms();
    // Sort descending by word count and length so "saving throw against..." or "attack roll" matches before "attack"
    allTerms.sort((a, b) => b.source.length - a.source.length);

    const matches: TerminologyEntry[] = [];
    const matchedSpans: { start: number; end: number }[] = [];
    const textLower = text.toLowerCase();

    for (const term of allTerms) {
      const termLower = term.source.toLowerCase();
      // Regex with word boundaries where possible
      const escaped = termLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'gi');

      let m: RegExpExecArray | null;
      while ((m = regex.exec(textLower)) !== null) {
        const start = m.index;
        const end = start + termLower.length;

        // Check if overlaps with an already matched longer term
        const overlaps = matchedSpans.some(
          (span) => (start >= span.start && start < span.end) || (end > span.start && end <= span.end)
        );

        if (!overlaps) {
          matchedSpans.push({ start, end });
          if (!matches.some((existing) => existing.source.toLowerCase() === termLower)) {
            // Apply contextual disambiguation if applicable
            let effectiveEntry = term;
            if (termLower === 'feature' && context?.docType === 'class') {
              effectiveEntry = { ...term, target: 'característica', context: 'Clase / subclase' };
            } else if (termLower === 'trait' && (context?.docType === 'actor' || context?.notes?.includes('species'))) {
              effectiveEntry = { ...term, target: 'rasgo', context: 'Especie / Linaje' };
            }
            matches.push(effectiveEntry);
          }
        }
      }
    }

    // Identify uncertain D&D expressions (e.g., words like "warding bond", "counterspell", "attunement", etc.)
    const uncertain: string[] = [];
    const commonDndPatterns = [
      /\b([a-z]+'s [a-z]+)\b/gi, // e.g. "hunter's mark", "mage's sanctum"
      /\b([a-z]+ bond)\b/gi,     // e.g. "warding bond"
      /\b([a-z]+ blast)\b/gi,    // e.g. "eldritch blast"
      /\b([a-z]+ slot)\b/gi,
    ];

    for (const pat of commonDndPatterns) {
      let match: RegExpExecArray | null;
      while ((match = pat.exec(textLower)) !== null) {
        const phrase = match[1];
        const known = allTerms.some((t) => t.source.toLowerCase() === phrase);
        if (!known && !uncertain.includes(phrase)) {
          uncertain.push(phrase);
        }
      }
    }

    return { matches, uncertain };
  }

  public exportJson(): string {
    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      userTerms: Array.from(this.userTerms.values()),
      pdfTerms: Array.from(this.pdfTerms.values()),
    };
    return JSON.stringify(data, null, 2);
  }

  public importJson(jsonString: string): { importedUser: number; importedPdf: number } {
    try {
      const data = JSON.parse(jsonString);
      let countUser = 0;
      let countPdf = 0;

      if (Array.isArray(data.userTerms)) {
        for (const t of data.userTerms) {
          if (t.source && t.target) {
            this.userTerms.set(t.source.toLowerCase().trim(), { ...t, userApproved: true });
            countUser++;
          }
        }
      }
      if (Array.isArray(data.pdfTerms)) {
        for (const t of data.pdfTerms) {
          if (t.source && t.target) {
            this.pdfTerms.set(t.source.toLowerCase().trim(), t);
            countPdf++;
          }
        }
      }
      // If it's a simple key-value map e.g. {"attack roll": "tirada de ataque"}
      if (!data.userTerms && !data.pdfTerms && typeof data === 'object') {
        for (const [key, val] of Object.entries(data)) {
          if (typeof val === 'string') {
            this.addUserTerm({
              source: key,
              target: val,
              confidence: 'high',
              status: 'confirmed',
              sourceDocument: 'Importado',
            });
            countUser++;
          }
        }
      }

      this.saveToStorage();
      return { importedUser: countUser, importedPdf: countPdf };
    } catch (e) {
      throw new Error('El archivo importado no es un JSON de glosario válido.');
    }
  }
}

// Global Singleton
export const terminologyEngine = new TerminologyEngine();
