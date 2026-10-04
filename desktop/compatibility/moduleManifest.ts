import { parseJsonStrict } from '../../src/services/json/strictJson';
import { structuralDiff } from '../../src/services/validation/structuralDiff';

export interface LanguageRegistration { lang: 'es'; name: string; path: string }
export function safeRelativePath(value: unknown): value is string {
  return typeof value==='string' && value.length>0 && !/[\\:\x00-\x1f]/.test(value) && !value.startsWith('/') && value.split('/').every(part=>part!=='' && part!=='.' && part!=='..');
}
export function registerSpanish(source: string, additions: LanguageRegistration[], verifiedFiles: Set<string>) {
  const original=parseJsonStrict(source);
  if (!original || typeof original!=='object' || Array.isArray(original) || typeof original.id!=='string') throw new Error('MANIFEST_INVALID');
  if (original.languages!==undefined && !Array.isArray(original.languages)) throw new Error('MANIFEST_LANGUAGES_INVALID');
  const existing=original.languages ?? [];
  if (existing.some((entry:any)=>!entry || typeof entry.lang!=='string' || !safeRelativePath(entry.path))) throw new Error('MANIFEST_LANGUAGES_INVALID');
  if (existing.some((entry:any)=>/^es(?:-|$)/i.test(entry.lang))) throw new Error('SPANISH_ALREADY_EXISTS');
  const paths=new Set(existing.map((entry:any)=>entry.path.toLowerCase()));
  for (const entry of additions) {
    if (entry.lang!=='es' || entry.name!=='Español' || !safeRelativePath(entry.path) || !verifiedFiles.has(entry.path) || paths.has(entry.path.toLowerCase())) throw new Error('MANIFEST_REGISTRATION_INVALID');
    paths.add(entry.path.toLowerCase());
  }
  const result=structuredClone(original);
  result.languages=[...existing,...additions];
  const baseline=structuredClone(result);
  if (original.languages===undefined) delete baseline.languages;
  else baseline.languages=baseline.languages.slice(0,existing.length);
  if (structuralDiff(original,baseline,[]).length) throw new Error('MANIFEST_STRUCTURE_INVALID');
  const serialized=JSON.stringify(result,null,2)+'\n';
  parseJsonStrict(serialized);
  return serialized;
}
