import { JsonEngine } from '../json/jsonEngine';
import { FoundryValidator } from './foundryValidator';
import { ProtectedContentEngine as Protection } from '../protected-content/protectedContentEngine';

export type GateStatus = 'PASS' | 'WARNING' | 'FAILED';
export interface QualityGate {
  status: GateStatus;
  checks: Record<'original_parse'|'translation'|'protected_tokens'|'references'|'structure'|'format'|'output_parse', GateStatus>;
}
/** A recovered string is publishable only after the whole file is revalidated, never COMPLETED. */
export function jsonQualityGate(originalText:string, outputText:string, allowedPaths:(string|number)[][], recovered=0):QualityGate {
  const checks:QualityGate['checks']={original_parse:'FAILED',translation:recovered?'WARNING':'PASS',protected_tokens:'FAILED',references:'FAILED',structure:'FAILED',format:'FAILED',output_parse:'FAILED'};
  let before:any,after:any;
  try{before=JsonEngine.parse(originalText);checks.original_parse='PASS';}catch{return {status:'FAILED',checks};}
  try{after=JsonEngine.parse(outputText);checks.output_parse='PASS';}catch{return {status:'FAILED',checks};}
  const read=(object:any,segments:(string|number)[])=>segments.reduce((value,segment)=>value?.[segment],object);
  const signature=(text:string)=>JSON.stringify([...Protection.protect(text).tokens.values()].map(token=>[token.type,token.original]));
  try {
    checks.protected_tokens=allowedPaths.every(segments=>typeof read(before,segments)==='string' && typeof read(after,segments)==='string' && signature(read(before,segments))===signature(read(after,segments)))?'PASS':'FAILED';
    if(allowedPaths.some(segments=>typeof read(before,segments)==='string' && read(before,segments).trim() && (typeof read(after,segments)!=='string' || !read(after,segments).trim())))checks.translation='FAILED';
  }catch{return {status:'FAILED',checks};}
  let report:ReturnType<typeof FoundryValidator.validate>;
  try{report=FoundryValidator.validate(before,after,{translatedCount:allowedPaths.length,allowedPaths,confirmedTermsCount:0,reviewedTermsCount:0,uncertainTermsCount:0});}catch{return {status:'FAILED',checks};}
  checks.structure=report.structuralErrors?.length?'FAILED':'PASS';
  checks.format=report.htmlErrors.length?'FAILED':'PASS';
  checks.references=report.modifiedIds.length || report.modifiedUuids.length || report.modifiedFormulas.length || report.modifiedMacros.length?'FAILED':'PASS';
  const status=Object.values(checks).includes('FAILED')?'FAILED':recovered?'WARNING':'PASS';
  return {status,checks};
}
