export interface ProviderSettings { endpoint: string; model: string; provider?: "ollama" | "libretranslate"; libreEndpoint?: string; fallback?: boolean; thermalEnabled?:boolean }

export interface ProviderHealth {

  connected: boolean; modelInstalled: boolean; model: string;

  executionMode: 'LOCAL'; provider: 'ollama' | 'libretranslate';

}

export interface NativeSelection { handle: string; name: string; kind: 'file' | 'directory'; files: { id: string; name: string }[] }

export interface TranslateRequest {

  file?:string;
  occurrenceScope?:string;
  sourceLanguage?: 'auto' | 'en' | 'ru';

  texts: string[]; terminology?: { source: string; target: string }[];
  units?:{sourceText:string;context?:import('./memory/store').MemoryContext}[];
  onUnitFailure?:(index:number,reason:RecoveryDiagnostic['reason'])=>void;
  telemetry?:(event:'ollama_requests'|'ollama_failures'|'ollama_retries'|'libretranslate_requests'|'fallback_libretranslate')=>void;
  inferenceMetrics?:(metrics:{prompt_tokens?:number;generated_tokens?:number;eval_duration?:number;load_duration?:number;prompt_chars:number;source_chars:number})=>void;

  context?: { docType?: string; notes?: string; system?:string; module?:string; fieldType?:string };

}

export interface DesktopProgress { sequence: number; state: 'IDLE' | 'TRANSLATING' | 'COMPLETED' | 'ERROR'|'CANCELLED'; count: number;thermal?:import('./thermal').GpuSample&{state:import('./thermal').ThermalState} }

export type OutputStrategy = 'TRANSLATION_OVERLAY' | 'FULL_PORTABLE_COPY';
export interface PublicationCounters { files_scanned:number; files_translated:number; files_unchanged:number; files_written:number; assets_skipped:number; bytes_avoided:number }

export interface RecoveryDiagnostic { scope:'STRING'|'FILE'|'JOB'; file:string; pathSegments?: (string|number)[]; reason:'PROVIDER_RESPONSE_INVALID'|'EMPTY_TRANSLATION'|'PROTECTED_CONTENT_INVALID'|'FILE_VALIDATION_FAILED'|'FILE_PARSE_FAILED'|'IO_FAILURE'|'QUALITY_VALIDATION_FAILED'|'SCRIPT_TRANSLATION_VALIDATION_FAILED'|'SCRIPT_TRANSLATION_CONTEXT_UNCERTAIN'; recovery:'ORIGINAL_RESTORED'|'ORIGINAL_COPIED'|'JOB_STOPPED' }
export interface FileOutcome { written?:boolean; file:string; status:'COMPLETED'|'WARNING'|'FAILED'; outputKind:'TRANSLATED'|'ORIGINAL_FALLBACK'|'RECOVERED'|'UNCHANGED'|'NOT_PUBLISHED'|'COMMIT_UNCERTAIN'; recoveredStrings:number; qualityGate?:import('../src/services/validation/qualityGate').QualityGate }
export interface BatchProgress { outputStrategy?:OutputStrategy; publication?:PublicationCounters; id: string; state: "RUNNING" | "COMPLETED" | "CANCELLED" | "ERROR"; thermal?:import('./thermal').GpuSample&{state:import('./thermal').ThermalState}; total: number; completed: number; failed: number; current: string; errors: string[]; warnings?: string[]; generatedLocalizations?: string[]; outcomes?:FileOutcome[]; diagnostics?:RecoveryDiagnostic[]; validated?:number; recoveredStrings?:number; sequence?:number; reportAvailable?:boolean }

export interface DesktopAPI {
  approveVerifiedPdf(hash:string):Promise<{approved:number;policy:string}>;
  resolveCanonicalPdf():Promise<{approved:number;policy:string}|null>;
  searchPdfSegments(query:string,language:'en'|'es'):Promise<ReturnType<typeof import('./memory/pdfAlignment').searchPdfSegments>>;
  createPdfAlignment(sourceId:string,targetId:string):Promise<Awaited<ReturnType<typeof import('./memory/pdfAlignment').createPdfAlignment>>>;
  generatePdfMemory():Promise<Awaited<ReturnType<typeof import('./memory/pdfAlignment').generatePdfAlignments>>>;
  preparePdfBinding(id:string):Promise<import('./memory/pdfAlignment').PdfBindingPreview|null>;
  commitPdfBinding(token:string,fieldId:string):Promise<Awaited<ReturnType<typeof import('./memory/pdfAlignment').bindPdfAlignment>>>;
  cancelTranslation():Promise<void>;
  preflightBatch(handle:string,language:'auto'|'en'|'ru',terminology?:{source:string;target:string}[]):Promise<import('./translation/preflight').TranslationPreflight&{token:string}>;
  importSpanishMemory(handle:string):Promise<Awaited<ReturnType<typeof import('./memory/spanishImport').importSpanish>>|null>;
  importApprovedHistoricalMemory(handle:string,declaration:'USER_APPROVED_TRANSLATION_CORPUS'):Promise<Awaited<ReturnType<typeof import('./memory/historicalBabeleImport').importTrustedBabele>>|null>;

  listMemory(query?:import('./memory/review').MemoryQuery):Promise<ReturnType<typeof import('./memory/review').listMemory>>;
  memoryConflicts():Promise<ReturnType<typeof import('./memory/review').listConflicts>>;
  reviewMemory(request:import('./memory/store').ReviewRequest):Promise<import('./memory/store').MemoryEntry>;


  startBatch(handle: string, language: "auto" | "en" | "ru", terminology?: {source: string; target: string}[],preflightToken?:string,outputStrategy?:OutputStrategy): Promise<BatchProgress | null>;
  getBatchProgress(): Promise<BatchProgress | null>;
  exportReport():Promise<boolean>;

  cancelBatch(id: string): Promise<void>;

  onBatchProgress(callback: (progress: BatchProgress) => void): () => void;

  getProgress(): Promise<DesktopProgress>;

  onProgress(callback: (progress: DesktopProgress) => void): () => void;

  health(): Promise<ProviderHealth>;

  getSettings(): Promise<ProviderSettings>;

  saveSettings(settings: ProviderSettings): Promise<ProviderSettings>;

  translate(request: TranslateRequest): Promise<string[]>;

  selectInput(kind: 'file' | 'directory'): Promise<NativeSelection | null>;

  readInput(handle: string, fileId: string): Promise<{ content: string; name: string }>;

  saveJson(content: string, name: string): Promise<{ saved: boolean }>;

  openOutput(): Promise<void>;

}

