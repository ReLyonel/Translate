import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { discoverModule } from '../desktop/moduleDiscovery';
import { translateLocalization } from '../desktop/compatibility/nativeLocalization';
import { safeRelativePath, registerSpanish } from '../desktop/compatibility/moduleManifest';
import { parseJsonStrict } from '../src/services/json/strictJson';
import { JsonEngine } from '../src/services/json/jsonEngine';
import { translateScript } from '../desktop/scriptTranslation';

// Deliberately no CLI source-path override: permission is restricted to this tree.
const authorized=await fs.realpath('C:/Users/leond/AppData/Local/FoundryVTT/Data/modules');
const reportRoot=path.resolve('reports/native-localization');
await fs.mkdir(reportRoot,{recursive:true});
const hash=(content:Buffer)=>createHash('sha256').update(content).digest('hex');
const identity=async(request:{texts:string[]})=>request.texts;
const signal=new AbortController().signal;
const results:Record<string,unknown>[]=[];
for (const moduleName of ['fifthpendium','colorsettings','ActiveAuras']) {
 const moduleRoot=path.join(authorized,moduleName);
 const discovery=await discoverModule(moduleRoot,signal);
 const manifestFile=discovery.files.find(file=>file.relative==='module.json')!;
 const manifestBytes=await fs.readFile(manifestFile.absolute);
 const manifest=parseJsonStrict(manifestBytes.toString('utf8'));
 const english=manifest.languages?.find((entry:any)=>entry.lang==='en' && safeRelativePath(entry.path));
 const dictionary=discovery.files.find(file=>file.relative.split(path.sep).join('/')===english?.path);
 if (!dictionary) throw new Error('REAL_DICTIONARY_NOT_FOUND');
 const before=await fs.readFile(dictionary.absolute);
 const translated=await translateLocalization(before.toString('utf8'),'en',identity,signal);
 parseJsonStrict(translated);
 let registration='NOT_APPLICABLE_EXISTING_ES';
 if (!manifest.languages.some((entry:any)=>/^es(?:-|$)/i.test(entry.lang))) {
  const entry={lang:'es' as const,name:'Español',path:'lang/fvtt-translator/es-001.json'};
  registerSpanish(manifestBytes.toString('utf8'),[entry],new Set([entry.path]));registration='PASS';
 }
 const source=discovery.files.find(file=>file.kind==='json');
 if (source) JsonEngine.parse((await fs.readFile(source.absolute)).toString('utf8'));
 const script=discovery.files.find(file=>file.kind==='script');
 if (script) {
  const bytes=await fs.readFile(script.absolute);
  const reconstructed=await translateScript(bytes.toString('utf8'),identity,signal,'en');
  if(reconstructed!==bytes.toString('utf8')) throw new Error('IDENTITY_SCRIPT_CHANGED');
  if(hash(bytes)!==hash(await fs.readFile(script.absolute))) throw new Error('SCRIPT_SOURCE_CHANGED');
 }
 const unchanged=hash(before)===hash(await fs.readFile(dictionary.absolute)) && hash(manifestBytes)===hash(await fs.readFile(manifestFile.absolute));
 if(!unchanged) throw new Error('ORIGINAL_CHANGED');
 results.push({module:moduleName,dictionary:english.path,dictionary_sha256:hash(before),manifest_sha256:hash(manifestBytes),originals_unchanged:unchanged,localization_integrity:'PASS',manifest_registration:registration,source_json:source?.relative??null,script:script?.relative??null});
}
await fs.writeFile(path.join(reportRoot,'summary.json'),JSON.stringify({timestamp:new Date().toISOString(),provider:'IDENTITY_INTEGRITY_ONLY',linguistic_quality:'NOT_RUN',foundry_runtime:'NOT_RUN',results},null,2));
console.log(JSON.stringify({report:path.join(reportRoot,'summary.json'),modules:results.length,originals_unchanged:true}));
