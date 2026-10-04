import * as pdfjsLib from 'pdfjs-dist';
import { TerminologyEntry } from '../../types';

// Set worker source
if (typeof window !== 'undefined') {
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
}

export interface PdfExtractionProgress {
  currentPage: number;
  totalPages: number;
  status: string;
  foundTermsCount: number;
}

export class PdfEngine {
  /**
   * Extracts text from all pages of a PDF File object.
   */
  public static async extractTextFromPdf(
    file: File,
    onProgress?: (p: PdfExtractionProgress) => void
  ): Promise<{ fullText: string; pageTexts: { page: number; text: string }[] }> {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdfDoc = await loadingTask.promise;
    const totalPages = pdfDoc.numPages;

    const pageTexts: { page: number; text: string }[] = [];
    let fullText = '';

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      if (onProgress) {
        onProgress({
          currentPage: pageNum,
          totalPages,
          status: `Leyendo página ${pageNum} de ${totalPages}...`,
          foundTermsCount: 0,
        });
      }

      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageStr = textContent.items
        .map((item: any) => item.str || '')
        .join(' ');

      pageTexts.push({ page: pageNum, text: pageStr });
      fullText += `\n--- PÁGINA ${pageNum} ---\n${pageStr}`;
    }

    return { fullText, pageTexts };
  }

  /**
   * Parses text locally for common glossary and bilingual dictionary formats:
   * e.g.
   * - "advantage / ventaja"
   * - "advantage — ventaja"
   * - "attack roll : tirada de ataque"
   * - "saving throw (tirada de salvación)"
   */
  public static extractRegexGlossaryPairs(
    pageTexts: { page: number; text: string }[],
    sourceDocName: string
  ): TerminologyEntry[] {
    const extracted: TerminologyEntry[] = [];
    const seen = new Set<string>();

    const patterns = [
      /([a-zA-Z\s'’]{2,35})\s*(?:—|–|-|:|\/|=>|->)\s*([a-zA-ZáéíóúÁÉÍÓÚñÑ\s'’]{2,35})/g,
      /([a-zA-Z\s'’]{2,35})\s*\(([a-zA-ZáéíóúÁÉÍÓÚñÑ\s'’]{2,35})\)/g,
    ];

    for (const { page, text } of pageTexts) {
      for (const pat of patterns) {
        let match: RegExpExecArray | null;
        while ((match = pat.exec(text)) !== null) {
          const source = match[1].trim();
          const target = match[2].trim();

          // Filter out false positives: numbers, headers, too long, too short
          if (
            source.length >= 3 &&
            target.length >= 3 &&
            !/\d/.test(source) &&
            !seen.has(source.toLowerCase()) &&
            source.split(' ').length <= 4 &&
            target.split(' ').length <= 4
          ) {
            seen.add(source.toLowerCase());
            extracted.push({
              id: `pdf-term-${extracted.length + 1}`,
              source,
              target,
              category: 'mechanical_term',
              confidence: 'high',
              sourceDocument: sourceDocName,
              sourcePage: page,
              status: 'confirmed',
            });
          }
        }
      }
    }

    return extracted;
  }

  /**
   * Deliberately unavailable: PDF corpus extraction must not send excerpts to any model.
   * Terminology is created from reviewed local alignments and SRD sources instead.
   */
  public static async extractAiTerminology(
    excerpt: string,
    sourceDocName: string
  ): Promise<TerminologyEntry[]> {
    void excerpt;
    void sourceDocName;
    throw new Error('La extracción terminológica por IA está deshabilitada: los PDFs se procesan localmente y requieren revisión humana.');
  }
}
