import type {MemoryStore} from './store';import {PdfReuse} from './pdfReuse';
/** Audits available sealed extraction schemas; extraction locations are not canonical IDs. */
export function auditSrdIdentities(store:MemoryStore){
 const segments=[...store.pdfCorpus.segments.values()],en=segments.filter(s=>s.language==='en'),es=segments.filter(s=>s.language==='es'),stats=new PdfReuse(store).statistics();
 const enIds=new Set(en.map(s=>s.id)),shared=es.filter(s=>enIds.has(s.id)).length;
 const uuidTexts=segments.filter(s=>/@UUID\[|Compendium\.[-\w]+\.[-\w]+\./.test(s.text)).length;
 return {provenance:'SRD_ES',authority:'AUTHORITATIVE_REFERENCE',srd_en_entries:en.length,srd_es_entries:es.length,srd_en_es_verified_links:stats.approved_alignments,ru_to_srd_verified_links:stats.canonical_bindings,available_format:'PDF_SEALED_TEXT_EXTRACTION',native_foundry_id_fields:0,explicit_uuid_text_segments:uuidTexts,shared_segment_ids:shared,document_identifiers:'SHA256_OF_LANGUAGE_SPECIFIC_PDF',section_identifiers:'EXTRACTION_PAGE_AND_ORDER_NOT_CANONICAL',equivalent_structure_policy:'POSITION_LENGTH_NUMBERS_OR_HEADING_SIMILARITY_DO_NOT_VERIFY_ALIGNMENT',decision:stats.approved_alignments?'VERIFIED_ALIGNMENT_AVAILABLE':'NO_DETERMINISTIC_BILINGUAL_ENTRY_IDENTITY',reason_codes:stats.approved_alignments?[]:['SRD_NO_SHARED_CANONICAL_ENTRY_KEYS','SRD_ALIGNMENT_REVIEW_REQUIRED'],source_warning:store.pdfCorpus.warning||null};
}
