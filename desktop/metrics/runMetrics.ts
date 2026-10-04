export const metricNames=['files_scanned','files_processed','strings_detected','strings_translatable','strings_protected','strings_unique','strings_deduplicated','canonical_hits','pdf_exact_hits','pdf_canonical_hits','pdf_context_hits','pdf_model_calls_avoided','tm_exact_hits','tm_fuzzy_hits','cache_hits','cache_misses','ollama_requests','ollama_failures','ollama_retries','libretranslate_requests','prompt_tokens','generated_tokens','eval_duration','load_duration','translation_time','validation_time','total_time','strings_per_second','characters_translated','characters_reused'] as const;
export class RunMetrics {
  values=Object.fromEntries(metricNames.map(name=>[name,0])) as Record<typeof metricNames[number],number>;
  translatedUnits=0;
  started=performance.now();
  finish(){this.values.total_time=(performance.now()-this.started)/1000;this.values.strings_per_second=this.translatedUnits?this.translatedUnits/Math.max(this.values.translation_time,.001):0;return {...this.values};}
}
