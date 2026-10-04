import { createHash } from 'node:crypto';

export type AcceptanceStatus = 'PASS' | 'FAILED' | 'NOT_RUN' | 'WARNING';
export interface NativeCase {
  id: string; uuid: string; documentType: 'Actor' | 'Item' | 'JournalEntry';
  expectedName: string; fields: { segments: (string | number)[]; expected: string }[];
}
export interface NativePlan {
  schemaVersion: 1; targetCore: '14.368'; module: { id: string; version: string };
  cases: NativeCase[]; sourceHashes: { file: string; sha256: string }[];
}
export const planHash = (plan: NativePlan) => createHash('sha256').update(JSON.stringify(plan)).digest('hex');
export function validateNativePlan(plan: any): asserts plan is NativePlan {
  if (!plan || plan.schemaVersion!==1 || plan.targetCore!=='14.368' || !/^[A-Za-z0-9_-]+$/.test(plan.module?.id) || typeof plan.module?.version!=='string' || !Array.isArray(plan.cases) || !Array.isArray(plan.sourceHashes)) throw new Error('NATIVE_PLAN_INVALID');
  const ids=new Set<string>();
  for (const item of plan.cases) {
    if (!item || typeof item.id!=='string' || ids.has(item.id) || !['Actor','Item','JournalEntry'].includes(item.documentType) || !item.uuid?.startsWith('Compendium.'+plan.module.id+'.') || typeof item.expectedName!=='string' || !Array.isArray(item.fields)) throw new Error('NATIVE_CASE_INVALID');
    ids.add(item.id);
    for (const field of item.fields) if (!field || !Array.isArray(field.segments) || !field.segments.length || field.segments.some((segment:any)=>!(typeof segment==='string' || (Number.isInteger(segment)&&segment>=0))) || typeof field.expected!=='string') throw new Error('NATIVE_FIELD_INVALID');
  }
  for (const entry of plan.sourceHashes) if (!entry || typeof entry.file!=='string' || !/^[a-f0-9]{64}$/.test(entry.sha256)) throw new Error('NATIVE_HASH_INVALID');
}

/** Manifest dependencies are evidence, never automatically removed. */
export function diagnoseBabele(manifest: any) {
  const checks: { code:string; status:AcceptanceStatus }[]=[];
  for (const [key,required] of [['requires',true],['recommends',false]] as const) {
    const entries=manifest.relationships?.[key];
    if (entries!==undefined && !Array.isArray(entries)) checks.push({code:'DEPENDENCIES_INVALID',status:'FAILED'});
    else if (entries?.some((entry:any)=>String(entry?.id).toLowerCase()==='babele')) checks.push({code:required?'BABELE_REQUIRED':'BABELE_RECOMMENDED',status:required?'FAILED':'WARNING'});
  }
  if (manifest.dependencies!==undefined) {
    if (!Array.isArray(manifest.dependencies)) checks.push({code:'LEGACY_DEPENDENCIES_INVALID',status:'FAILED'});
    else if (manifest.dependencies.some((entry:any)=>String(typeof entry==='string'?entry:entry?.id??entry?.name).toLowerCase()==='babele')) checks.push({code:'BABELE_REQUIRED_LEGACY',status:'FAILED'});
  }
  return checks;
}

export const requiredRuntimeChecks=['module_load','babele_absent','actors','items','journals','compendiums','descriptions','links','uuid_references','inline_rolls','spanish_language'] as const;
export interface RuntimeEvidence {
  schemaVersion: 1; planSha256:string; executedAt:string;
  core:{version:string;build:number}; module:{id:string;version:string}; system:{id:string;version:string};
  checks: {id:string;status:AcceptanceStatus}[];
  cases:{id:string;status:AcceptanceStatus}[];
  console:{warnings:number;errors:number;startupReviewed:boolean};
}
export function evaluateNativeEvidence(plan:NativePlan, preflight:{code:string;status:AcceptanceStatus}[], evidence?:unknown) {
  validateNativePlan(plan);
  if (!evidence) return {status:'NOT_RUN' as AcceptanceStatus,reasons:['RUNTIME_EVIDENCE_MISSING']};
  const runtime=evidence as RuntimeEvidence;
  const reasons:string[]=[];
  if (runtime.schemaVersion!==1 || runtime.planSha256!==planHash(plan) || runtime.module?.id!==plan.module.id || runtime.module?.version!==plan.module.version) reasons.push('EVIDENCE_BINDING_INVALID');
  if(runtime.core?.version!=='14.368' || runtime.core?.build!==368) reasons.push('CORE_VERSION_MISMATCH');
  if(!runtime.system?.id || !runtime.system?.version || !runtime.executedAt || !Number.isFinite(Date.parse(runtime.executedAt))) reasons.push('RUNTIME_METADATA_INVALID');
  const checks=Array.isArray(runtime.checks)?runtime.checks:[];
  const cases=Array.isArray(runtime.cases)?runtime.cases:[];
  if(checks.length!==requiredRuntimeChecks.length || new Set(checks.map(item=>item.id)).size!==checks.length || checks.some(item=>!requiredRuntimeChecks.includes(item.id as any))) reasons.push('RUNTIME_CHECKS_INVALID');
  if(cases.length!==plan.cases.length || new Set(cases.map(item=>item.id)).size!==cases.length || cases.some(item=>!plan.cases.some(expected=>expected.id===item.id))) reasons.push('RUNTIME_CASES_INVALID');
  if([...checks,...cases].some(item=>!['PASS','FAILED','NOT_RUN','WARNING'].includes(item.status))) reasons.push('RUNTIME_STATUS_INVALID');
  if(!runtime.console || !Number.isInteger(runtime.console.errors) || runtime.console.errors<0 || !Number.isInteger(runtime.console.warnings) || runtime.console.warnings<0 || typeof runtime.console.startupReviewed!=='boolean') reasons.push('CONSOLE_EVIDENCE_INVALID');
  if(reasons.length) return {status:'FAILED' as AcceptanceStatus,reasons};
  if(preflight.some(item=>item.status==='FAILED') || [...checks,...cases].some(item=>item.status==='FAILED') || runtime.console.errors>0) return {status:'FAILED' as AcceptanceStatus,reasons:['CHECK_FAILED']};
  const hasDocuments=['Actor','Item','JournalEntry'].every(type=>plan.cases.some(item=>item.documentType===type));
  const descriptions=plan.cases.flatMap(item=>item.fields).filter(field=>/(?:description|content|text)/i.test(field.segments.join('.')));
  const hasReferences=descriptions.some(field=>/@UUID\[[^\]]+\]/.test(field.expected));
  const hasRolls=descriptions.some(field=>/\[\[/.test(field.expected));
  if(!hasDocuments || !descriptions.length || !hasReferences || !hasRolls || !runtime.console.startupReviewed || [...checks,...cases].some(item=>item.status==='NOT_RUN')) return {status:'NOT_RUN' as AcceptanceStatus,reasons:['ACCEPTANCE_INCOMPLETE']};
  if([...checks,...cases].some(item=>item.status==='WARNING') || runtime.console.warnings>0) return {status:'WARNING' as AcceptanceStatus,reasons:['RUNTIME_WARNINGS']};
  return {status:'PASS' as AcceptanceStatus,reasons:[]};
}
