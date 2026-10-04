import fs from 'node:fs/promises';
import path from 'node:path';
import { nativePreflight } from '../desktop/compatibility/nativePreflight';
import { evaluateNativeEvidence, planHash } from '../desktop/compatibility/nativeAcceptance';
import { parseJsonStrict } from '../src/services/json/strictJson';

const [original,translated,destination,evidenceFile]=process.argv.slice(2);
if(!original || !translated || !destination) throw new Error('Uso: bunx tsx scripts/nativeAcceptance.ts ORIGINAL COPIA_TRADUCIDA NUEVO_DIRECTORIO_INFORME [runtime.json]');
let ancestor=path.resolve(destination);
const missing:string[]=[];
while(true) {
 try{ancestor=await fs.realpath(ancestor);break;}
 catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;missing.unshift(path.basename(ancestor));ancestor=path.dirname(ancestor);}
}
const target=path.join(ancestor,...missing);
for(const input of [original,translated]) {
 const root=await fs.realpath(input),relative=path.relative(root,target);
 if(!relative || (!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative))) throw new Error('REPORT_MUST_BE_OUTSIDE_MODULE');
}
const {plan,checks}=await nativePreflight(original,translated);
const evidence=evidenceFile?parseJsonStrict(await fs.readFile(evidenceFile,'utf8')):undefined;
const result=evaluateNativeEvidence(plan,checks,evidence);
await fs.mkdir(path.dirname(target),{recursive:true});
await fs.mkdir(target); // Never overwrite a prior run.
await fs.writeFile(path.join(target,'acceptance-plan.json'),JSON.stringify(plan,null,2)+'\n',{flag:'wx'});
await fs.copyFile(path.resolve('scripts/nativeRuntimeProbe.mjs'),path.join(target,'runtime-probe.mjs'));
const report={schemaVersion:1,generatedAt:new Date().toISOString(),planSha256:planHash(plan),preflight:checks,runtime:evidence??null,acceptance:result,scope:'NATIVE_RUNTIME_ACCEPTANCE_NOT_TRANSLATION_QUALITY'};
await fs.writeFile(path.join(target,'acceptance-report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({directory:target,status:result.status,cases:plan.cases.length,preflightFailures:checks.filter(check=>check.status==='FAILED').length}));
if(result.status==='FAILED')process.exitCode=1;
