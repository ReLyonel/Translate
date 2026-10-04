import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { discoverModule } from '../desktop/moduleDiscovery';
import { JsonEngine } from '../src/services/json/jsonEngine';
import { ProtectedContentEngine as Protection } from '../src/services/protected-content/protectedContentEngine';
import { jsonQualityGate } from '../src/services/validation/qualityGate';

const authorized=await fs.realpath('C:/Users/leond/AppData/Local/FoundryVTT/Data/modules');
const root=path.join(authorized,'fifthpendium');
if(await fs.realpath(root)!==root)throw new Error('AUTHORIZED_ROOT_CHANGED');
const discovery=await discoverModule(root);
const results:Record<string,unknown>[]=[];
const coverage:Record<string,number>={};
const referenceKinds:Record<string,number>={};
const rollCommands:Record<string,number>={};
const fixtures=new Map<string,{input:string;expected:string;file:string;jsonPath:(string|number)[];sourceCoreVersion:string|null}>();
const versions=new Set<string>();
const hash=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
for(const file of discovery.files.filter(file=>file.kind==='json')) {
 const bytes=await fs.readFile(file.absolute),before=hash(bytes);
 let status='PASS',reason='',strings=0;
 try {
  const original=JsonEngine.parse(bytes.toString('utf8'));
  if(original._stats?.coreVersion)versions.add(String(original._stats.coreVersion));
  const fields=JsonEngine.analyze(original).fields.filter(field=>field.classification==='TRANSLATABLE');
  for(const field of fields) {
   const value=Protection.protect(field.originalValue);strings++;
   for(const token of value.tokens.values()) {
    coverage[token.type]=(coverage[token.type]||0)+1;
    let category='';
    if(token.type==='reference') {const kind=token.original.match(/^@([A-Za-z]+)/)?.[1]||'OTHER';referenceKinds[kind]=(referenceKinds[kind]||0)+1;category='reference-'+kind;}
    if(token.type==='roll') {const command=token.original.match(/^\[\[\s*([^\s\]]+)/)?.[1]||'OTHER';const key=command.startsWith('/')||command==='lookup'?command:'formula';rollCommands[key]=(rollCommands[key]||0)+1;category='roll-'+key;}
    if(category && !fixtures.has(category))fixtures.set(category,{input:'Attack '+token.original,expected:'Ataca '+token.original,file:file.relative,jsonPath:field.pathSegments||[],sourceCoreVersion:original._stats?.coreVersion??null});
   }
   const restored=Protection.restore(value.protectedText,value.tokens);
   if(!restored.isValid || restored.restoredText!==field.originalValue)throw new Error('ROUNDTRIP_FAILED');
  }
  if(jsonQualityGate(bytes.toString('utf8'),bytes.toString('utf8'),fields.map(field=>field.pathSegments||[])).status!=='PASS'){status='WARNING';reason='ORIGINAL_VALIDATION_FAILED';}
 }catch(error){status='WARNING';reason=error instanceof Error && error.message==='AMBIGUOUS_TECHNICAL_SYNTAX'?'AMBIGUOUS_TECHNICAL_SYNTAX':'UNSUPPORTED_OR_INVALID_ORIGINAL';}
 if(hash(await fs.readFile(file.absolute))!==before)throw new Error('ORIGINAL_CHANGED');
 results.push({file:file.relative,sha256:before,status,reason,strings});
}
const destination=path.resolve('reports/foundry-coverage');await fs.mkdir(destination,{recursive:true});
for(const fixture of fixtures.values()) {
 const value=Protection.protect(fixture.input);const restored=Protection.restore(value.protectedText.replace('Attack','Ataca'),value.tokens);
 if(!restored.isValid || restored.restoredText!==fixture.expected)throw new Error('REAL_FIXTURE_FAILED');
}
await fs.writeFile(path.join(destination,'private-fixtures.json'),JSON.stringify({scope:'TECHNICAL_SYNTAX_EXTRACTED_FROM_REAL_FILES_WITH_SYNTHETIC_PROSE',redistribution:false,fixtures:[...fixtures.entries()].map(([kind,fixture])=>({kind,...fixture}))},null,2));
await fs.writeFile(path.join(destination,'summary.json'),JSON.stringify({schemaVersion:1,createdAt:new Date().toISOString(),rulesVersion:Protection.rulesVersion,provider:'IDENTITY_INTEGRITY_ONLY',foundryRuntime:'NOT_RUN',sourceCoreVersions:[...versions],originalsUnchanged:true,files:results.length,coverage,referenceKinds,rollCommands,realFixtureTests:fixtures.size,warnings:results.filter(file=>file.status==='WARNING').length,results},null,2));
console.log(JSON.stringify({files:results.length,warnings:results.filter(file=>file.status==='WARNING').length,originalsUnchanged:true,report:path.join(destination,'summary.json')}));
