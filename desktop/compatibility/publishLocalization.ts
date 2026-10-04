import fs from 'node:fs/promises';
import path from 'node:path';
import { atomicWrite } from '../atomicWriter';
import { parseJsonStrict } from '../../src/services/json/strictJson';
import { translateLocalization } from './nativeLocalization';
import { registerSpanish, safeRelativePath, type LanguageRegistration } from './moduleManifest';
import type { TranslateRequest, OutputStrategy } from '../contracts';

export async function publishLocalization(root: string, output: string, files: {absolute:string;relative:string}[], translate:(request:TranslateRequest)=>Promise<string[]>, signal:AbortSignal,outputStrategy:OutputStrategy='FULL_PORTABLE_COPY') {
  const warnings:string[]=[];
  const created:string[]=[];
  let manifestCommitted=false;
  const manifest=files.find(file=>file.relative==='module.json');
  if (!manifest) return {warnings,generated:created};
  try {
    const source=await fs.readFile(manifest.absolute,'utf8');
    const original=parseJsonStrict(source);
    if (!original || Array.isArray(original) || typeof original.id!=='string') throw new Error('MANIFEST_INVALID');
    if (original.languages===undefined) return {warnings,generated:created};
    if (!Array.isArray(original.languages)) throw new Error('MANIFEST_LANGUAGES_INVALID');
    if (original.languages.some((entry:any)=>/^es(?:-|$)/i.test(entry?.lang))) return {warnings:['SPANISH_ALREADY_EXISTS: se conservan sus archivos y registros.'],generated:created};
    const candidates=original.languages.filter((entry:any)=>entry?.lang==='en' || entry?.lang==='ru');
    if (!candidates.length) return {warnings,generated:created};
    const additions:LanguageRegistration[]=[];
    for (let index=0;index<candidates.length;index++) {
      signal.throwIfAborted();
      const entry=candidates[index];
      if (!safeRelativePath(entry.path)) throw new Error('LOCALIZATION_PATH_INVALID');
      const input=files.find(file=>file.relative.split(path.sep).join('/')===entry.path);
      if (!input || (await fs.lstat(input.absolute)).isSymbolicLink() || await fs.realpath(input.absolute)!==input.absolute) throw new Error('LOCALIZATION_SOURCE_INVALID');
      if ((await fs.stat(input.absolute)).size>50000000) throw new Error('LOCALIZATION_TOO_LARGE');
      const dictionarySource=await fs.readFile(input.absolute,'utf8');
      const content=await translateLocalization(dictionarySource,entry.lang,request=>translate({...request,file:entry.path,occurrenceScope:'module.json:languages['+original.languages.indexOf(entry)+']'}),signal);
      if(JSON.stringify(parseJsonStrict(dictionarySource))===JSON.stringify(parseJsonStrict(content)))continue;
      // Dedicated namespace prevents overwriting any existing dictionary.
      const relative=`lang/fvtt-translator/es-${String(index+1).padStart(3,'0')}.json`;
      if(files.some(file=>file.relative.split(path.sep).join('/')===relative))throw new Error('LOCALIZATION_SOURCE_COLLISION');
      const target=path.join(output,relative);
      await fs.mkdir(path.dirname(target),{recursive:true});
      if (await fs.realpath(path.dirname(target))!==path.dirname(target)) throw new Error('LOCALIZATION_OUTPUT_PATH_INVALID');
      await atomicWrite(target,content,signal,bytes=>{parseJsonStrict(bytes.toString('utf8'));if(bytes.toString('utf8')!==content)throw new Error('LOCALIZATION_TEMP_CHANGED');},undefined,()=>created.push(relative));
      additions.push({lang:'es',name:'Español',path:relative});
    }
    if(!additions.length)return {warnings,generated:created};
    const revised=registerSpanish(source,additions,new Set(created));
    const target=path.join(output,'module.json');
    if (outputStrategy==='FULL_PORTABLE_COPY' && ((await fs.lstat(target)).isSymbolicLink() || await fs.realpath(target)!==target || await fs.readFile(target,'utf8')!==source)) throw new Error('MANIFEST_OUTPUT_CHANGED');
    await atomicWrite(target,revised,signal,bytes=>{parseJsonStrict(bytes.toString('utf8'));if(bytes.toString('utf8')!==registerSpanish(source,additions,new Set(created)))throw new Error('MANIFEST_TEMP_CHANGED');},outputStrategy==='FULL_PORTABLE_COPY'?Buffer.from(source):undefined,()=>{manifestCommitted=true;});
    return {warnings,generated:created};
  } catch {
    // Once the manifest is committed, its validated dictionaries must remain present.
    if(manifestCommitted)return {warnings:['LOCALIZATION_COMMIT_CLEANUP_WARNING: archivos publicados válidos conservados.'],generated:created};
    for (const relative of created) await fs.rm(path.join(output,relative),{force:true});
    warnings.push(signal.aborted?'LOCALIZATION_CANCELLED: manifiesto original conservado.':'LOCALIZATION_NOT_PUBLISHED: manifiesto original conservado.');
    return {warnings,generated:[]};
  }
}
