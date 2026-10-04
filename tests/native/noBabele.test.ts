import { describe, expect, it } from 'vitest';
import { diagnoseBabele, evaluateNativeEvidence, planHash, requiredRuntimeChecks, type NativePlan, type RuntimeEvidence } from '../../desktop/compatibility/nativeAcceptance';
const plan:NativePlan={schemaVersion:1,targetCore:'14.368',module:{id:'example',version:'1'},cases:['Actor','Item','JournalEntry'].map((type,index)=>({id:String(index),uuid:'Compendium.example.pack.'+index,documentType:type as any,expectedName:'Document',fields:[{segments:['description'],expected:'@UUID[Item.ref] [[/r 1d20]]'}]})),sourceHashes:[]};
function evidence():RuntimeEvidence {return {schemaVersion:1,planSha256:planHash(plan),executedAt:new Date().toISOString(),core:{version:'14.368',build:368},module:plan.module,system:{id:'dnd5e',version:'5.3'},checks:requiredRuntimeChecks.map(id=>({id,status:'PASS'})),cases:plan.cases.map(item=>({id:item.id,status:'PASS'})),console:{warnings:0,errors:0,startupReviewed:true}};}
describe('Babele independence',()=>{
 it('rejects required dependencies without mutating the manifest',()=>{
  const manifest={relationships:{requires:[{id:'babele'}]}};const before=JSON.stringify(manifest);
  expect(diagnoseBabele(manifest)).toContainEqual({code:'BABELE_REQUIRED',status:'FAILED'});expect(JSON.stringify(manifest)).toBe(before);
 });
 it('diagnoses optional integration without silently removing it',()=>expect(diagnoseBabele({relationships:{recommends:[{id:'babele'}]}})).toContainEqual({code:'BABELE_RECOMMENDED',status:'WARNING'}));
 it('detects legacy dependencies',()=>expect(diagnoseBabele({dependencies:[{name:'babele'}]})).toContainEqual({code:'BABELE_REQUIRED_LEGACY',status:'FAILED'}));
 it('requires a real runtime report',()=>expect(evaluateNativeEvidence(plan,[]).status).toBe('NOT_RUN'));
 it('accepts complete evidence bound to the exact plan',()=>expect(evaluateNativeEvidence(plan,[],evidence()).status).toBe('PASS'));
 it('does not accept inactive but installed Babele',()=>{const report=evidence();report.checks.find(check=>check.id==='babele_absent')!.status='FAILED';expect(evaluateNativeEvidence(plan,[],report).status).toBe('FAILED');});
 it.each(['version','hash','cases','checks','console','module'])('rejects invalid evidence: %s',kind=>{
  const report=evidence();if(kind==='version')report.core.version='14.364';if(kind==='hash')report.planSha256='other';if(kind==='cases')report.cases.push(report.cases[0]);if(kind==='checks')report.checks.pop();if(kind==='console')report.console.errors=-1;if(kind==='module')report.module={id:'other',version:'1'};
  expect(evaluateNativeEvidence(plan,[],report).status).toBe('FAILED');
 });
 it('does not equate probe-window console capture with startup review',()=>{const report=evidence();report.console.startupReviewed=false;expect(evaluateNativeEvidence(plan,[],report).status).toBe('NOT_RUN');});
 it('fails preflight dependencies even if the runtime report claims success',()=>expect(evaluateNativeEvidence(plan,[{code:'BABELE_REQUIRED',status:'FAILED'}],evidence()).status).toBe('FAILED'));
 it('distinguishes warnings, runtime errors and unexecuted checks',()=>{
  const report=evidence();report.console.warnings=1;expect(evaluateNativeEvidence(plan,[],report).status).toBe('WARNING');report.console.errors=1;expect(evaluateNativeEvidence(plan,[],report).status).toBe('FAILED');report.console={errors:0,warnings:0,startupReviewed:true};report.checks[0].status='NOT_RUN';expect(evaluateNativeEvidence(plan,[],report).status).toBe('NOT_RUN');
 });
});
