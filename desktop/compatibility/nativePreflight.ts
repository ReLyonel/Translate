import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { discoverModule } from '../moduleDiscovery';
import { parseJsonStrict } from '../../src/services/json/strictJson';
import { structuralDiff } from '../../src/services/validation/structuralDiff';
import { FoundryValidator } from '../../src/services/validation/foundryValidator';
import { JsonEngine } from '../../src/services/json/jsonEngine';
import { inspectScript } from '../scriptTranslation';
import { safeRelativePath } from './moduleManifest';
import { ProtectedContentEngine } from '../../src/services/protected-content/protectedContentEngine';
import { diagnoseBabele, validateNativePlan, type AcceptanceStatus, type NativePlan } from './nativeAcceptance';

export async function nativePreflight(originalRoot:string, translatedRoot:string, signal=new AbortController().signal) {
  originalRoot=await fs.realpath(originalRoot);translatedRoot=await fs.realpath(translatedRoot);
  if(originalRoot===translatedRoot) throw new Error('SEPARATE_TRANSLATED_COPY_REQUIRED');
  const [before,after]=await Promise.all([discoverModule(originalRoot,signal),discoverModule(translatedRoot,signal)]);
  const checks:{code:string;status:AcceptanceStatus;file?:string}[]=[];
  const readManifest=async(root:string)=>parseJsonStrict(await fs.readFile(path.join(root,'module.json'),'utf8'));
  const [original,translated]=await Promise.all([readManifest(originalRoot),readManifest(translatedRoot)]);
  const withoutLanguages=(value:any)=>{const copy=structuredClone(value);delete copy.languages;return copy;};
  if(structuralDiff(withoutLanguages(original),withoutLanguages(translated),[]).length) checks.push({code:'MANIFEST_TECHNICAL_CHANGED',status:'FAILED'});
  checks.push(...diagnoseBabele(translated));
  const compareVersion=(value:string)=>{const parts=value.split('.').map(Number);if(parts.some(part=>!Number.isFinite(part)))return null;return (parts[0]-14)||((parts[1]??368)-368);};
  for(const [key,sign] of [['minimum',1],['maximum',-1]] as const) {
    if(translated.compatibility?.[key]!==undefined) {
      const comparison=compareVersion(String(translated.compatibility[key]));
      if(comparison===null || comparison*sign>0)checks.push({code:'CORE_MANIFEST_INCOMPATIBLE',status:'FAILED'});
    }
  }
  const plan:NativePlan={schemaVersion:1,targetCore:'14.368',module:{id:translated.id,version:String(translated.version)},cases:[],sourceHashes:[]};
  for(const entry of after.files.filter(file=>file.relative==='module.json' || file.kind)) {
    signal.throwIfAborted();
    const content=await fs.readFile(entry.absolute);
    plan.sourceHashes.push({file:entry.relative.split(path.sep).join('/'),sha256:createHash('sha256').update(content).digest('hex')});
    const previous=before.files.find(file=>file.relative===entry.relative);
    if(!previous) {checks.push({code:'SOURCE_FILE_ADDED',status:'FAILED',file:entry.relative});continue;}
    if(entry.kind==='json') {
      try {
        const source=JsonEngine.parse((await fs.readFile(previous.absolute)).toString('utf8'));
        const result=JsonEngine.parse(content.toString('utf8'));
        const validation=FoundryValidator.validate(source,result,{translatedCount:0,confirmedTermsCount:0,reviewedTermsCount:0,uncertainTermsCount:0});
        if(!validation.isValid) checks.push({code:'SOURCE_INTEGRITY_FAILED',status:'FAILED',file:entry.relative});
        const pack=translated.packs?.find((pack:any)=>safeRelativePath(pack.path) && entry.relative.split(path.sep).join('/').startsWith(pack.path.replace(/\/$/,'')+'/_source/'));
        if(pack && ['Actor','Item','JournalEntry'].includes(pack.type) && typeof result._id==='string' && typeof result.name==='string' && plan.cases.filter(item=>item.documentType===pack.type).length<3) {
          const fields=JsonEngine.analyze(result).fields.filter(field=>field.classification==='TRANSLATABLE' && field.pathSegments?.length && field.path!=='name').slice(0,8).map(field=>({segments:field.pathSegments!,expected:field.originalValue}));
          plan.cases.push({id:'case-'+String(plan.cases.length+1),uuid:`Compendium.${translated.id}.${pack.name}.${pack.type}.${result._id}`,documentType:pack.type,expectedName:result.name,fields});
        }
      } catch {checks.push({code:'SOURCE_PARSE_FAILED',status:'FAILED',file:entry.relative});}
    } else if(entry.kind==='script') {
      try {
        const source=(await fs.readFile(previous.absolute)).toString('utf8'),target=content.toString('utf8');
        const left=inspectScript(source),right=inspectScript(target);
        const skeleton=(text:string,spans:typeof left)=>{let result=text;for(const span of [...spans].reverse())result=result.slice(0,span.start)+'__VISIBLE__'+result.slice(span.end);return result;};
        const tokens=(text:string)=>JSON.stringify([...ProtectedContentEngine.protect(text).tokens.values()].map(token=>[token.type,token.original]));
        if(left.length!==right.length || skeleton(source,left)!==skeleton(target,right) || left.some((span,index)=>!right[index] || tokens(span.text)!==tokens(right[index].text))) checks.push({code:'SCRIPT_TECHNICAL_CHANGED',status:'FAILED',file:entry.relative});
      } catch {checks.push({code:'SCRIPT_PARSE_FAILED',status:'FAILED',file:entry.relative});}
    }
  }
  for(const entry of before.files.filter(file=>file.kind)) if(!after.files.some(file=>file.relative===entry.relative)) checks.push({code:'SOURCE_FILE_REMOVED',status:'FAILED',file:entry.relative});
  for(const pack of translated.packs??[]) {
    if(!safeRelativePath(pack.path) || typeof pack.name!=='string') {checks.push({code:'PACK_PATH_INVALID',status:'FAILED'});continue;}
    if(!after.files.some(file=>file.relative.split(path.sep).join('/').startsWith(pack.path+'/') && !file.relative.split(path.sep).includes('_source'))) checks.push({code:'PACK_EFFECTIVE_FILES_MISSING',status:'FAILED',file:pack.path});
  }
  const existing=original.languages??[], languages=translated.languages??[];
  if(!Array.isArray(existing) || !Array.isArray(languages) || structuralDiff(existing,languages.slice(0,existing.length),[]).length) checks.push({code:'LANGUAGE_REGISTRY_CHANGED',status:'FAILED'});
  else for(const entry of languages) {
    const file=safeRelativePath(entry.path)?after.files.find(file=>file.relative.split(path.sep).join('/')===entry.path):undefined;
    if(!file) checks.push({code:'LANGUAGE_FILE_MISSING',status:'FAILED'});
    else {try{parseJsonStrict(await fs.readFile(file.absolute,'utf8'));}catch{checks.push({code:'LANGUAGE_FILE_INVALID',status:'FAILED',file:entry.path});}}
  }
  const artifactPaths=new Set<string>((Array.isArray(languages)?languages:[]).filter((entry:any)=>safeRelativePath(entry.path)).map((entry:any)=>entry.path));
  for(const entry of after.files) {
    const relative=entry.relative.split(path.sep).join('/');
    if(artifactPaths.has(relative) || (Array.isArray(translated.packs) && translated.packs.some((pack:any)=>safeRelativePath(pack.path) && relative.startsWith(pack.path+'/') && !relative.split('/').includes('_source')))) {
      const content=await fs.readFile(entry.absolute);signal.throwIfAborted();
      plan.sourceHashes.push({file:relative,sha256:createHash('sha256').update(content).digest('hex')});
    }
  }
  checks.push({code:'REPACKED_CONTENT_REQUIRES_RUNTIME',status:'NOT_RUN'});
  validateNativePlan(plan);
  return {plan,checks};
}
