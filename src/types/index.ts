export type TermConfidence = 'high' | 'medium' | 'low';
export type TermStatus = 'confirmed' | 'inferred' | 'uncertain';

export interface TerminologyEntry {
  id: string;
  source: string; // English
  target: string; // Spanish
  category?: string; // e.g. "mechanical_term", "spell", "condition", "ability", "action", "item", "class_feature", "rule"
  context?: string;
  confidence: TermConfidence;
  sourceDocument?: string;
  sourcePage?: number;
  userApproved?: boolean;
  status: TermStatus;
  notes?: string;
}

export interface DisambiguationRule {
  id: string;
  term: string; // e.g. "Feature", "Feat", "Trait", "Skill", "Proficiency"
  options: {
    target: string;
    context: string;
    description: string;
    recommendedWhen?: string;
  }[];
}

export type JsonFieldClassification = 'TRANSLATABLE' | 'PROTECTED' | 'UNCERTAIN';

export interface DetectedField {
  id: string;
  path: string;
  pathSegments?: (string | number)[];
  originalValue: string;
  translatedValue?: string;
  classification: JsonFieldClassification;
  reason: string;
  userInclude: boolean;
  detectedTerms?: TerminologyEntry[];
  uncertainTerms?: string[];
  placeholderCount?: number;
  status?: 'pending' | 'translating' | 'completed' | 'error';
}

export interface JsonInspectionResult {
  fileName: string;
  fileSize: number;
  totalObjects: number;
  totalStrings: number;
  translatableCount: number;
  protectedCount: number;
  uncertainCount: number;
  rawJson: any;
  fields: DetectedField[];
}

export interface ProtectedToken {
  token: string; // e.g. "[[PROTECTED_001]]"
  id?: string;
  original: string;
  type: 'uuid' | 'roll' | 'embed' | 'dice' | 'html' | 'macro' | 'code' | 'system' | 'reference';
  position?: number;
  hash?: string;
}

export interface ProtectionResult {
  protectedText: string;
  tokens: Map<string, ProtectedToken>;
}

export interface ValidationReport {
  isValid: boolean;
  originalKeysCount: number;
  translatedKeysCount: number;
  modifiedKeys: string[];
  structuralErrors?: { path: (string | number)[]; code: string }[];
  modifiedIds: string[];
  modifiedUuids: string[];
  modifiedMacros: string[];
  modifiedFormulas: string[];
  numericChanges?: string[];
  modifiedPaths?: string[];
  placeholderErrors: string[];
  htmlErrors: string[];
  translatedTextsCount: number;
  confirmedTermsCount: number;
  reviewedTermsCount: number;
  uncertainTermsCount: number;
  timestamp: string;
}

export interface TranslationContext {
  docType?: 'spell' | 'item' | 'actor' | 'class' | 'journal' | 'generic' | 'babele';
  entityName?: string;
  notes?: string;
}

export interface AppSettings {
  sourceLanguage: string;
  targetLanguage: string;
  model: string;
  mode: 'dnd2024' | 'srd521' | 'custom';
  terminologyMode: 'pdf_plus_glossary' | 'glossary_only' | 'pdf_only';
  foundryPreservation: boolean;
  autoValidate: boolean;
  batchSize: number;
}
