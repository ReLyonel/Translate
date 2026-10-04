import type { MemoryContext } from './store';

export type TranslationOrigin = 'TM_EXACT_APPROVED'|'HISTORICAL_BABELE'|'PDF_EXACT'|'PDF_CANONICAL'|'PDF_CONTEXT'|'PROTECTED_ONLY'|'CANONICAL_APPROVED_TRANSLATION'|'GLOSSARY'|'TM_EXACT'|'TM_FUZZY_CONTEXT'|'CACHE'|'TRANSLATEGEMMA'|'PROVIDER'|'MANUAL'|'ORIGINAL_FALLBACK';
export interface UnitProvenance extends MemoryContext {
  historical_reference?:{source_corpus:string;source_file:string;provenance:'HISTORICAL_BABELE';translation_origin:'USER_TRANSLATED';approval:'APPROVED_MANUAL';canonical_identity:'UNKNOWN';import_version:string};
  pdf_reference?:import('./pdfReuse').PdfDiagnostic;
  unit_id:string;
  locator_id:string;
  file:string;
  occurrence_scope?:string;
  source_language:string;
  target_language:'es';
  source_hash:string;
  target_hash:string;
  origins:TranslationOrigin[];
  provider:string|null;
  model:string|null;
  quality:'PASS'|'WARNING'|'FAILED';
  publication:'PENDING'|'VALIDATED'|'RECOVERED'|'NOT_PUBLISHED';
  deduplicated:boolean;
  memory_id?:string;
  incremental?:boolean;
  reuse_key?:string;
  reason?:string;
  attempted_provider?:string;
  attempted_model?:string;
}
/** Full prose is private runtime state, never included in diagnostic reports. */
export interface ResolvedUnit extends UnitProvenance {source_text:string;translated_text:string}
export function publicProvenance(unit:ResolvedUnit):UnitProvenance {
  const {source_text,translated_text,surrounding_context,reuse_key,pdf,...diagnostic}=unit;
  return diagnostic;
}
