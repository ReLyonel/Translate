import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { JsonEngine } from '../src/services/json/jsonEngine';
import {ProtectedContentEngine as Protection} from '../src/services/protected-content/protectedContentEngine';
import { surroundingContext } from './memory/context';
import {canonicalContext} from './translation/inventory';
import {parseJsonStrict} from '../src/services/json/strictJson';
import { recoverUnits } from './translation/recoverUnits';
import { jsonQualityGate } from '../src/services/validation/qualityGate';
import { atomicWrite, atomicCopy } from './atomicWriter';

import { discoverModule } from './moduleDiscovery';
import { translateScript, inspectScript } from './scriptTranslation';

import { publishLocalization } from './compatibility/publishLocalization';
import type { BatchProgress, TranslateRequest, OutputStrategy } from './contracts';

export async function runBatch(input: string, output: string, translate: (request: TranslateRequest) => Promise<string[]>, signal: AbortSignal, publish: (progress: BatchProgress) => void, language: TranslateRequest['sourceLanguage'] = 'auto', id:string = randomUUID(), mode: 'folder' | 'module' = 'folder',observe:(event:'files_scanned'|'strings_detected'|'strings_translatable'|'validation_time',value:number)=>void=()=>{}, outputStrategy:OutputStrategy='TRANSLATION_OVERLAY') {
  if(!['TRANSLATION_OVERLAY','FULL_PORTABLE_COPY'].includes(outputStrategy))throw new Error('OUTPUT_STRATEGY_INVALID');
  const full=outputStrategy==='FULL_PORTABLE_COPY';
  const root = await fs.realpath(input);
  const parent = await fs.realpath(path.dirname(output));
  output = path.join(parent, path.basename(output));
  const relative = path.relative(root, output);
  if (!relative || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative))) throw new Error('La salida debe estar fuera de la carpeta original.');
  const discovery = await discoverModule(root, signal);
  const files = discovery.files;
  let manifest:any={};const manifestFile=files.find(file=>file.relative==='module.json');if(manifestFile&&(await fs.stat(manifestFile.absolute)).size<5000000)try{manifest=parseJsonStrict(await fs.readFile(manifestFile.absolute,'utf8'));}catch{}
  observe('files_scanned',files.length);
  const kind = (file: typeof files[number]) => mode === 'module' ? file.kind : /\.json$/i.test(file.relative) ? 'json' : null;
  signal.throwIfAborted();
  await fs.mkdir(output); // Refuse existing destinations, including originals.
  const progress: BatchProgress = { outputStrategy, publication:{files_scanned:0,files_translated:0,files_unchanged:0,files_written:0,assets_skipped:0,bytes_avoided:0}, id, state: 'RUNNING', total: files.filter(file => kind(file)).length, completed: 0, failed: 0, current: '', errors: [], outcomes: [], diagnostics: [], validated: 0, recoveredStrings: 0 };
  const emit = () => {progress.sequence=(progress.sequence||0)+1;publish(structuredClone(progress));};
  emit();
  if(full) for (const directory of discovery.directories) { signal.throwIfAborted(); await fs.mkdir(path.join(output, directory), { recursive: true }); }
  for (const entry of files) {
    const file = entry.absolute;
    if (signal.aborted) break;
    const name = path.relative(root, file);
    progress.current = name; emit();
    const target = path.join(output, name);
    if(full) await fs.mkdir(path.dirname(target), { recursive: true });
    try {
      if ((await fs.lstat(file)).isSymbolicLink() || await fs.realpath(file) !== file) throw new Error('SOURCE_CHANGED');
      if (!kind(entry)) { if(full){await atomicCopy(file,target,signal);progress.publication!.files_written++;}else{progress.publication!.bytes_avoided+=(await fs.stat(file)).size;if(/\.(?:webp|png|jpe?g|gif|svg|mp3|ogg|wav|flac|mp4|webm|woff2?|ttf|otf|bin|db|ldb|pdf|zip)$/i.test(name))progress.publication!.assets_skipped++;} emit();continue; }
      progress.publication!.files_scanned++;
      if((await fs.stat(file)).size>50000000) {
        if(full){await atomicCopy(file,target,signal);progress.publication!.files_written++;}else progress.publication!.bytes_avoided+=(await fs.stat(file)).size;
        progress.publication!.files_unchanged++;
        progress.completed++;progress.failed++;
        progress.errors.push(name+': archivo demasiado grande; copia original conservada.');
        progress.diagnostics!.push({scope:'FILE',file:name,reason:'FILE_VALIDATION_FAILED',recovery:full?'ORIGINAL_COPIED':'ORIGINAL_RESTORED'});
        progress.outcomes!.push({file:name,status:'WARNING',outputKind:'ORIGINAL_FALLBACK',written:full,recoveredStrings:0});
        emit();continue;
      }
      const originalBytes=await fs.readFile(file);
      let content=originalBytes;
      let recovered=0;
      let uncertain=0;
      let fallback=false;
      let originalParsed=false;
      let gate: ReturnType<typeof jsonQualityGate>|undefined;
      const changes: {path:string;pathSegments?:(string|number)[];value:string}[]=[];
      try {
        if(originalBytes.length>50000000) throw new Error('FILE_TOO_LARGE');
        if(kind(entry)==='script') {
          const scriptUnits=inspectScript(originalBytes.toString('utf8'),start=>{uncertain++;progress.diagnostics!.push({scope:'STRING',file:name,pathSegments:['script','source_offset',start],reason:'SCRIPT_TRANSLATION_CONTEXT_UNCERTAIN',recovery:'ORIGINAL_RESTORED'});});originalParsed=true;
          scriptUnits.forEach(unit=>Protection.protect(unit.text));
          observe('strings_detected',scriptUnits.length);observe('strings_translatable',scriptUnits.length);
          content=Buffer.from(await translateScript(originalBytes.toString('utf8'),translate,signal,language,(index,reason)=>{
            recovered++;
            progress.diagnostics!.push({scope:'STRING',file:name,pathSegments:['script',index],reason,recovery:'ORIGINAL_RESTORED'});
          }));
          gate={status:recovered||uncertain?'WARNING':'PASS',checks:{original_parse:'PASS',translation:recovered||uncertain?'WARNING':'PASS',protected_tokens:'PASS',references:'PASS',structure:'PASS',format:'PASS',output_parse:'PASS'}};
        }else {
          const original=JsonEngine.parse(originalBytes.toString('utf8'));
          originalParsed=true;
          const inspection=JsonEngine.analyze(original,name);
          const fields=inspection.fields.filter(field=>field.classification==='TRANSLATABLE');
          observe('strings_detected',inspection.totalStrings);observe('strings_translatable',fields.length);
          if(jsonQualityGate(originalBytes.toString('utf8'),originalBytes.toString('utf8'),fields.map(field=>field.pathSegments||[])).status==='FAILED')throw new Error('SOURCE_GATE_FAILED');
          for(let start=0;start<fields.length;start+=32) {
            signal.throwIfAborted();
            const group=fields.slice(start,start+32);
            const restored=await recoverUnits(group.map(field=>field.originalValue),translate,signal,language,(index,reason)=>{
              recovered++;
              progress.diagnostics!.push({scope:'STRING',file:name,pathSegments:group[index].pathSegments,reason,recovery:'ORIGINAL_RESTORED'});
            },group.map(field=>({system:typeof original._stats?.systemId==='string'?original._stats.systemId:undefined,document_type:typeof original.type==='string'?original.type:'JSON',...surroundingContext(original,field.pathSegments||[],field.originalValue),field_type:field.path.split('.').slice(-2).join('.'),json_path:field.pathSegments,...canonicalContext(manifest,name,original,field.pathSegments||[])})));
            group.forEach((field,index)=>changes.push({path:field.path,pathSegments:field.pathSegments,value:restored[index]}));
          }
          if(changes.some((change,index)=>fields[index].originalValue!==change.value))content=Buffer.from(JSON.stringify(JsonEngine.reconstruct(original,changes),null,2));
          const validationStart=performance.now();
          gate=jsonQualityGate(originalBytes.toString('utf8'),content.toString('utf8'),changes.map(change=>change.pathSegments||[]),recovered);
          observe('validation_time',(performance.now()-validationStart)/1000);
          if(gate.status==='FAILED')throw new Error('FILE_VALIDATION_FAILED');
        }
      }catch(error) {
        signal.throwIfAborted();
        if((error as NodeJS.ErrnoException)?.code)throw error;
        content=originalBytes;fallback=true;
        progress.diagnostics!.push({scope:'FILE',file:name,reason:kind(entry)==='script'?'SCRIPT_TRANSLATION_VALIDATION_FAILED':originalParsed?'FILE_VALIDATION_FAILED':'FILE_PARSE_FAILED',recovery:full?'ORIGINAL_COPIED':'ORIGINAL_RESTORED'});
      }
      const validate=async(bytes:Buffer)=>{
        if(fallback){if(!bytes.equals(originalBytes))throw new Error('ORIGINAL_COPY_CHANGED');return;}
        if(kind(entry)==='json') {
          const result=jsonQualityGate(originalBytes.toString('utf8'),bytes.toString('utf8'),changes.map(change=>change.pathSegments||[]),recovered);
          if(result.status==='FAILED')throw new Error('OUTPUT_GATE_FAILED');
        }else {
          const verified=await translateScript(bytes.toString('utf8'),async request=>request.texts,signal,language);
          if(verified!==bytes.toString('utf8'))throw new Error('OUTPUT_SCRIPT_INVALID');
        }
      };
      const changed=!content.equals(originalBytes);
      if(changed)progress.publication!.files_translated++;else progress.publication!.files_unchanged++;
      if(full||changed){await fs.mkdir(path.dirname(target),{recursive:true});await atomicWrite(target,content,signal,validate,undefined,()=>{progress.publication!.files_written++;});}
      else progress.publication!.bytes_avoided+=originalBytes.length;
      const warning=fallback||recovered>0||uncertain>0;
      progress.completed++;
      progress.recoveredStrings!+=recovered;
      if(warning){progress.failed++;progress.errors.push(name+': advertencia; contenido original recuperado.');}
      else progress.validated!++;
      progress.outcomes!.push({file:name,written:full||changed,status:warning?'WARNING':'COMPLETED',outputKind:fallback?'ORIGINAL_FALLBACK':recovered?'RECOVERED':content.equals(originalBytes)?'UNCHANGED':'TRANSLATED',recoveredStrings:recovered,qualityGate:gate});
    } catch (error) {
      if(signal.aborted)break;
      progress.state='ERROR';
      progress.diagnostics!.push({scope:'JOB',file:name,reason:'IO_FAILURE',recovery:'JOB_STOPPED'});
      let outputKind:'NOT_PUBLISHED'|'COMMIT_UNCERTAIN'='COMMIT_UNCERTAIN';
      try {await fs.lstat(target);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')outputKind='NOT_PUBLISHED';}
      progress.outcomes!.push({file:name,status:'FAILED',outputKind,recoveredStrings:0});
      emit();throw error;
    }
    emit();
  }
  if (mode === 'module' && !signal.aborted) {
    progress.current = 'Localización nativa'; emit();
    const localization = await publishLocalization(root, output, files, translate, signal,outputStrategy);
    progress.warnings = [...(progress.warnings||[]),...localization.warnings];
    progress.generatedLocalizations = localization.generated;
    progress.publication!.files_written+=localization.generated.length+(localization.generated.length&&!full?1:0);
    if(localization.generated.length&&!full&&manifestFile)progress.publication!.bytes_avoided-=(await fs.stat(manifestFile.absolute)).size;
  }
  progress.state = signal.aborted ? 'CANCELLED' : 'COMPLETED'; progress.current = ''; emit();
  return progress;
}
