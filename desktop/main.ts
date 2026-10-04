import { listMemory,listConflicts,reviewMemory } from './memory/review';
import { MemoryStore } from './memory/store';
import {hashKey} from './memory/store';
import {translationPreflight} from './translation/preflight';
import {importSpanish} from './memory/spanishImport';
import {importTrustedBabele} from './memory/historicalBabeleImport';
import {inventory} from './translation/inventory';
import {generatePdfAlignments,bindPdfAlignment,searchPdfSegments,createPdfAlignment} from './memory/pdfAlignment';
import {approveVerifiedPdf} from './memory/pdfResolution';
import {canonicalResolution,applyCanonicalResolution} from './memory/canonicalResolution';
import {pdfField} from './memory/pdfReuse';
import {pdfHash,pdfRulesVersion} from './memory/pdfCorpus';

import { runLoggedBatch, runLoggedTranslation, exportRunReport } from './logging/runReport';
import { atomicWrite } from './atomicWriter';
import { app, BrowserWindow, dialog, ipcMain, shell, session } from 'electron';

import fs from 'node:fs/promises';

import path from 'node:path';

import { pathToFileURL } from 'node:url';

import { randomUUID } from 'node:crypto';

import { validateSettings, validateTranslation, trustedSender, allowedRendererResource } from './security';

import { JsonEngine } from '../src/services/json/jsonEngine';
import { health } from './providers';

import type { NativeSelection, ProviderSettings, DesktopProgress, BatchProgress } from './contracts';

import { discoverModule } from './moduleDiscovery';





let window: BrowserWindow;

let settings: ProviderSettings = { endpoint: 'http://127.0.0.1:11500', model: 'translategemma:27b' };

const selections = new Map<string, Map<string, string>>();

const roots = new Map<string, string>();

let batchSnapshot: BatchProgress | null = null;
let batch: { id: string; controller: AbortController; finished?: Promise<void> } | undefined;

const origins = new Set<string>();

let outputDirectory: string | undefined;
let lastReportDirectory:string|undefined;
let reviewing=false;
let translationController:AbortController|undefined;
const preflights=new Map<string,{handle:string;language:string;terms:string;settings:string;revision:number;fingerprint:string}>();
const pdfBindings=new Map<string,{entry:string;root:string;file:string;revision:number;fingerprint:string;fields:Map<string,{path:(string|number)[];hash:string}>}>();

let progress: DesktopProgress = { sequence: 0, state: 'IDLE', count: 0 };

function hasActiveWork(){return reviewing||Boolean(batch)||progress.state==='TRANSLATING';}

function publishProgress(state: DesktopProgress['state'], count: number,thermal?:DesktopProgress['thermal']) {

  progress = { state, count, sequence: progress.sequence + 1,thermal };

  if (!window.isDestroyed()) window.webContents.send('desktop:progress', progress);

}

const indexPath = path.join(__dirname, '../dist/index.html');

const expectedUrl = pathToFileURL(indexPath).href;

const settingsPath = () => path.join(app.getPath('userData'), 'provider.json');

// Screenshots in automated checks must not compete with Ollama for GPU memory.

if (process.argv.includes('--smoke-test')) app.disableHardwareAcceleration();



function handle(channel: string, action: (...args: any[]) => unknown) {

  ipcMain.handle('desktop:' + channel, async (event, ...args) => {

    if (!trustedSender(event.sender.id, event.senderFrame?.url || '', event.senderFrame === event.sender.mainFrame, window.webContents.id, expectedUrl)) throw new Error('Solicitud no autorizada.');

    try { return await action(...args); }

    catch (error) {

      // Never expose raw filesystem/provider errors or response bodies to the renderer.

      if (error instanceof Error && /^(Configuración inválida|Ollama debe|Nombre de modelo|Textos de traducción|Terminología inválida|Contexto inválido|No se pudo obtener)/.test(error.message)) throw error;

      throw new Error('No se pudo completar la operación. Comprueba la selección y los permisos.');

    }

  });

}



async function selectInput(kind: unknown): Promise<NativeSelection | null> {

  if (kind !== 'file' && kind !== 'directory') throw new Error('Selección inválida.');

  const result = await dialog.showOpenDialog(window, { title: kind === 'file' ? 'Seleccionar JSON' : 'Seleccionar carpeta', properties: [kind === 'file' ? 'openFile' : 'openDirectory'], ...(kind === 'file' ? { filters: [{ name: 'JSON Foundry', extensions: ['json'] }] } : {}) });

  if (result.canceled) return null;

  const root = await fs.realpath(result.filePaths[0]);

  const files = new Map<string, string>();

  const names: { id: string; name: string }[] = [];

  async function add(file: string, name: string) {

    if (names.length >= 10_000) throw new Error('Selección demasiado grande.');

    const id = randomUUID(); files.set(id, file); names.push({ id, name });

    origins.add(file.toLowerCase());

  }

  async function walk(directory: string) {

    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {

      const file = path.join(directory, entry.name);

      if (entry.isSymbolicLink()) continue;

      if (entry.isDirectory()) await walk(file);

      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) await add(file, path.relative(root, file));

    }

  }

  if (kind === 'directory') {
    const discovered = await discoverModule(root);
    for (const file of discovered.files.filter(file => file.kind === 'json')) await add(file.absolute, file.relative);
  }

  else { if (!root.toLowerCase().endsWith('.json')) throw new Error('Formato inválido.'); await add(root, path.basename(root)); }

  const handle = randomUUID(); selections.set(handle, files); if (kind === 'directory') roots.set(handle, root);

  return { handle, name: path.basename(root), kind, files: names };

}



async function readInput(handle: unknown, fileId: unknown) {

  if (typeof handle !== 'string' || typeof fileId !== 'string') throw new Error('Selección inválida.');

  const file = selections.get(handle)?.get(fileId);

  if (!file || (await fs.lstat(file)).isSymbolicLink() || (await fs.realpath(file)).toLowerCase() !== file.toLowerCase()) throw new Error('Selección inválida.');

  if ((await fs.stat(file)).size > 50_000_000) throw new Error('Archivo demasiado grande.');

  return { content: (await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, ''), name: path.basename(file) };

}



async function saveJson(content: unknown, name: unknown) {

  if (typeof content !== 'string' || content.length > 50_000_000 || typeof name !== 'string' || name.length > 240 || /[\\/:]/.test(name)) throw new Error('Salida inválida.');

  JsonEngine.parse(content);

  const result = await dialog.showSaveDialog(window, { title: 'Guardar copia JSON', defaultPath: name, filters: [{ name: 'JSON', extensions: ['json'] }] });

  if (result.canceled || !result.filePath) return { saved: false };

  const parent = await fs.realpath(path.dirname(result.filePath));

  const target = path.join(parent, path.basename(result.filePath));

  if (origins.has(target.toLowerCase())) throw new Error('Original protegido.');

  await atomicWrite(target,content,new AbortController().signal,bytes=>{JsonEngine.parse(bytes.toString('utf8'));});
  outputDirectory = parent;
  return { saved: true };

}



app.whenReady().then(async () => {

  // Historical corpus terms lack approval/context metadata. Keep their files, but
  // do not apply them as mandatory terminology before the approved TM migration.
  const store=await new MemoryStore(path.join(app.getPath('userData'),'translation-memory')).load();

  try { settings = validateSettings(JSON.parse(await fs.readFile(settingsPath(), 'utf8'))); } catch { /* first run uses local defaults */ }

  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));

  session.defaultSession.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !allowedRendererResource(details.url, path.dirname(indexPath)) }));

  window = new BrowserWindow({ width: 1180, height: 800, minWidth: 900, minHeight: 650, title: 'Traductor Foundry', show: false, autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true } });

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  window.webContents.on('will-navigate', event => event.preventDefault());

  handle('health', () => health(settings));

  handle('settings', () => ({ ...settings }));

  handle('saveSettings', async value => {

    const next = validateSettings(value);

    await fs.writeFile(settingsPath(), JSON.stringify(next), { mode: 0o600 });

    settings = next; return { ...settings };

  });

  handle('progress', () => ({ ...progress }));
  handle('cancelTranslation',()=>{translationController?.abort();});
  handle('listMemory',query=>listMemory(store,query));
  handle('resolveCanonicalPdf',async()=>{if(hasActiveWork())throw new Error('MEMORY_BUSY');reviewing=true;try{const selected=await dialog.showOpenDialog(window,{title:'Seleccionar módulo para vínculos SRD verificados',properties:['openDirectory']});if(selected.canceled)return null;const root=await fs.realpath(selected.filePaths[0]);await store.refreshPdf();const plan=canonicalResolution(store,(await inventory(root)).units);preflights.clear();pdfBindings.clear();return await applyCanonicalResolution(store,root,plan.input_hash);}finally{reviewing=false;}});
  handle('approveVerifiedPdf',async hash=>{if(hasActiveWork()||typeof hash!=='string'||!/^[a-f0-9]{64}$/.test(hash))throw new Error('PDF_RESOLUTION_INVALID');reviewing=true;try{preflights.clear();pdfBindings.clear();return await approveVerifiedPdf(store,hash);}finally{reviewing=false;}});
  handle('memoryConflicts',()=>listConflicts(store));
  handle('searchPdfSegments',(query,language)=>searchPdfSegments(store,query,language));
  handle('createPdfAlignment',async(sourceId,targetId)=>{
    if(hasActiveWork()||typeof sourceId!=='string'||typeof targetId!=='string'||sourceId.length>100||targetId.length>100)throw new Error('PDF_ALIGNMENT_INVALID');reviewing=true;
    try{preflights.clear();pdfBindings.clear();return await createPdfAlignment(store,sourceId,targetId);}finally{reviewing=false;}
  });
  handle('generatePdfMemory',async()=>{
    if(hasActiveWork())throw new Error('MEMORY_BUSY');reviewing=true;
    try{preflights.clear();pdfBindings.clear();return await generatePdfAlignments(store);}finally{reviewing=false;}
  });
  handle('preparePdfBinding',async id=>{
    if(hasActiveWork()||typeof id!=='string'||!/^[a-f0-9]{64}$/.test(id))throw new Error('PDF_BINDING_INVALID');reviewing=true;
    try{
      await store.refreshPdf();const entry=store.readEntries().find(row=>row.id===id);
      if(!entry?.pdf||entry.pdf.binding||!entry.approved||entry.rules_version!==pdfRulesVersion||!store.pdfCorpus.evidence(entry.pdf,entry.source_text,entry.translated_text))throw new Error('PDF_ALIGNMENT_NOT_APPROVED');
      const directory=await dialog.showOpenDialog(window,{title:'Seleccionar módulo del vínculo SRD',properties:['openDirectory']});if(directory.canceled)return null;
      const root=await fs.realpath(directory.filePaths[0]);
      const document=await dialog.showOpenDialog(window,{title:'Seleccionar JSON dentro del módulo',defaultPath:root,properties:['openFile'],filters:[{name:'Documentos JSON',extensions:['json']}]});if(document.canceled)return null;
      const selected=await fs.realpath(document.filePaths[0]),file=path.relative(root,selected);
      if(!file||file.startsWith('..')||path.isAbsolute(file))throw new Error('PDF_BINDING_INVALID');
      const units=(await inventory(root)).units.filter(unit=>unit.file===file&&unit.context.system==='dnd5e'&&unit.context.canonical_uuid&&unit.context.canonical_version&&pdfField(unit.context)===entry.field_type&&unit.source.length<=200000);
      if(!units.length||units.length>100)throw new Error('PDF_BINDING_UNVERIFIED');
      const token=randomUUID(),fields=new Map<string,{path:(string|number)[];hash:string}>();pdfBindings.clear();
      const preview=units.map(unit=>{const fieldId=randomUUID();fields.set(fieldId,{path:unit.context.json_path!,hash:pdfHash(unit.source)});return {id:fieldId,path:unit.context.json_path!,source_excerpt:unit.source.slice(0,600),source_text:unit.source,canonical_uuid:unit.context.canonical_uuid!};});
      pdfBindings.set(token,{entry:id,root,file,revision:store.revision,fingerprint:store.pdfCorpus.fingerprint,fields});return {token,file,fields:preview};
    }finally{reviewing=false;}
  });
  handle('commitPdfBinding',async(token,fieldId)=>{
    if(hasActiveWork()||typeof token!=='string'||typeof fieldId!=='string')throw new Error('PDF_BINDING_INVALID');
    const selection=pdfBindings.get(token),field=selection?.fields.get(fieldId);if(!selection||!field||selection.revision!==store.revision)throw new Error('PDF_BINDING_STALE');
    reviewing=true;try{await store.refreshPdf();if(selection.fingerprint!==store.pdfCorpus.fingerprint)throw new Error('PDF_BINDING_STALE');pdfBindings.delete(token);preflights.clear();return await bindPdfAlignment(store,selection.entry,selection.root,selection.file,field.path,field.hash);}finally{reviewing=false;}
  });
  handle('reviewMemory',async value=>{if(reviewing)throw new Error('MEMORY_BUSY');reviewing=true;try{return await reviewMemory(store,value,()=>Boolean(batch)||progress.state==='TRANSLATING');}finally{reviewing=false;}});

  handle('translate', async value => {

    const request = validateTranslation(value);

    if (reviewing || batch || progress.state === 'TRANSLATING') throw new Error('Traducción ya activa.');

    publishProgress('TRANSLATING', request.texts.length);
    const controller=new AbortController();translationController=controller;

    try { const result = await runLoggedTranslation(request,settings,store,path.join(app.getPath('userData'),'logs'),directory=>{lastReportDirectory=directory;},controller.signal,guard=>publishProgress('TRANSLATING',request.texts.length,{...guard.sample,state:guard.state})); publishProgress('COMPLETED', result.length); return result; }

    catch (error) { publishProgress(controller.signal.aborted?'CANCELLED':'ERROR', request.texts.length); throw error; }finally{translationController=undefined;}

  });

  handle('batchSnapshot', () => batchSnapshot);
  handle('preflightBatch',async(handleId,language,terminology)=>{
    if(hasActiveWork()||typeof handleId!=='string'||!roots.has(handleId)||!['auto','en','ru'].includes(language))throw new Error('PREFLIGHT_INVALID');
    const terms=validateTranslation({texts:['validation'],terminology}).terminology||[];
    reviewing=true;const capturedSettings={...settings};try{const report=await translationPreflight(roots.get(handleId)!,language,store,capturedSettings,terms);const token=randomUUID();preflights.clear();preflights.set(token,{handle:handleId,language,terms:hashKey(terms),settings:hashKey(capturedSettings),revision:store.revision,fingerprint:report.fingerprint});return {...report,token};}finally{reviewing=false;}
  });
  handle('importApprovedHistoricalMemory',async (handleId,declaration)=>{
    if(declaration!=='USER_APPROVED_TRANSLATION_CORPUS'||typeof handleId!=='string'||!roots.has(handleId))throw new Error('CORPUS_TRUST_DECLARATION_REQUIRED');
    if(hasActiveWork())throw new Error('MEMORY_BUSY');reviewing=true;try{const selected=await dialog.showOpenDialog(window!,{title:'Corpus historico traducido y revisado por el usuario',properties:['openDirectory']});if(selected.canceled||!selected.filePaths[0])return null;const data=await inventory(roots.get(handleId)!);const result=await importTrustedBabele(selected.filePaths[0],data.units,store);preflights.clear();return result;}finally{reviewing=false;}
  });
  handle('importSpanishMemory',async handleId=>{
    if(hasActiveWork()||typeof handleId!=='string'||!roots.has(handleId))throw new Error('MEMORY_BUSY');
    const selected=await dialog.showOpenDialog(window,{title:'Seleccionar memoria española',properties:['openDirectory']});if(selected.canceled)return null;
    if(hasActiveWork())throw new Error('MEMORY_BUSY');reviewing=true;try{preflights.clear();return await importSpanish(selected.filePaths[0],roots.get(handleId)!,store);}finally{reviewing=false;}
  });
  handle('startBatch', async (handleId, language, terminology,preflightToken,outputStrategy='TRANSLATION_OVERLAY') => {

    if(!['TRANSLATION_OVERLAY','FULL_PORTABLE_COPY'].includes(outputStrategy))throw new Error('OUTPUT_STRATEGY_INVALID');
    const terms = validateTranslation({ texts: ['validation'], terminology }).terminology;
    const root = roots.get(handleId);

    if (!root || reviewing || batch || progress.state === 'TRANSLATING' || !['auto', 'en', 'ru'].includes(language)) throw new Error('Lote no disponible.');
    const reviewed=preflights.get(preflightToken);
    if(!reviewed||reviewed.handle!==handleId||reviewed.language!==language||reviewed.terms!==hashKey(terms||[])||reviewed.settings!==hashKey(settings)||reviewed.revision!==store.revision)throw new Error('PREFLIGHT_REQUIRED');
    reviewing=true;try {
    const destination = await dialog.showSaveDialog(window, { title: 'Crear carpeta de traducci\u00f3n', defaultPath: root + '_es', buttonLabel: 'Crear carpeta' });

    if (destination.canceled || !destination.filePath) return null;

    await store.refreshPdf();if(reviewed.fingerprint!==hashKey([(await inventory(root)).fingerprints,store.pdfCorpus.fingerprint]))throw new Error('PREFLIGHT_STALE');
    if(reviewed.revision!==store.revision||reviewed.settings!==hashKey(settings))throw new Error('PREFLIGHT_STALE');preflights.delete(preflightToken);
    const controller = new AbortController(); const id = randomUUID(); batch = { id, controller };

    const snapshot = { id, outputStrategy:outputStrategy as import('./contracts').OutputStrategy, state: 'RUNNING' as const, total: (await discoverModule(root)).files.filter(file => file.kind).length, completed: 0, failed: 0, current: '', errors: [] as string[] };

    batchSnapshot = snapshot;
    const selectedSettings = { ...settings };

    batch.finished = runLoggedBatch(root,destination.filePath,selectedSettings,store,path.join(app.getPath('userData'),'logs'),controller.signal,value => {

      batchSnapshot = value;
      if (value.state !== 'RUNNING') outputDirectory = destination.filePath;
      if (!window.isDestroyed()) window.webContents.send('desktop:batchProgress', value);

    },language,id,terms,directory=>{lastReportDirectory=directory;},undefined,outputStrategy).then(() => { outputDirectory = destination.filePath; }).catch(() => {

      batchSnapshot = { ...(batchSnapshot || snapshot), state: controller.signal.aborted ? 'CANCELLED' : 'ERROR', sequence:(batchSnapshot?.sequence||0)+1,errors: [...(batchSnapshot?.errors || []), 'No se pudo completar el lote. Usa una carpeta de salida nueva y comprueba los permisos.'] };
      if (!window.isDestroyed()) window.webContents.send('desktop:batchProgress', batchSnapshot);

    }).finally(() => { batch = undefined; });

    return snapshot;
    }finally{reviewing=false;}
  });

  handle('cancelBatch', async id => { const active = batch; if (active && active.id === id) { active.controller.abort(); await active.finished; } });

  handle('exportReport',async()=>{
    if(!lastReportDirectory)throw new Error('Sin informe disponible.');
    const destination=await dialog.showSaveDialog(window,{title:'Exportar informe a carpeta nueva',defaultPath:'informe-traduccion'});
    if(destination.canceled||!destination.filePath)return false;
    const reportTarget=path.join(await fs.realpath(path.dirname(destination.filePath)),path.basename(destination.filePath));
    for(const root of roots.values()){const relative=path.relative(root,reportTarget);if(!relative||(!relative.startsWith('..')&&!path.isAbsolute(relative)))throw new Error('Original protegido.');}
    await exportRunReport(lastReportDirectory,reportTarget);return true;
  });

  handle('selectInput', selectInput);

  handle('readInput', readInput);

  handle('saveJson', saveJson);

  handle('openOutput', async () => { if (!outputDirectory) throw new Error('Sin salida.'); const error = await shell.openPath(outputDirectory); if (error) throw new Error('No se pudo abrir salida.'); });

  await window.loadFile(indexPath);

  window.show();

  if (process.argv.includes('--smoke-test')) {

    const report = await window.webContents.executeJavaScript(`(async () => {

      const button = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Traducir JSON'));

      button?.click(); await new Promise(resolve => setTimeout(resolve, 150));

      let invalidPayloadRejected = false; try { await window.desktop.translate({texts:[42]}); } catch { invalidPayloadRejected = true; }

      return {title:document.title, text:document.body.innerText.slice(0,1000), bridge:typeof window.desktop?.translate, node:typeof window.require, nativeSelectors:document.body.innerText.includes('Seleccionar carpeta'), invalidPayloadRejected, health:await window.desktop.health()};

    })()`);

    await fs.writeFile(path.join(app.getPath('userData'), 'desktop-smoke.json'), JSON.stringify(report, null, 2));

    await fs.writeFile(path.join(app.getPath('userData'), 'desktop-smoke.png'), (await window.webContents.capturePage()).toPNG());

    const layouts = [];

    for (const width of [900, 1180]) {

      window.setSize(width, 800);

      await new Promise(resolve => setTimeout(resolve, 100));

      layouts.push(await window.webContents.executeJavaScript(`({width:innerWidth, overflow:document.documentElement.scrollWidth > innerWidth, selected:document.querySelector('[aria-current="page"]')?.textContent})`));

    }

    const views = await window.webContents.executeJavaScript(`(async () => {

      const result = [];

      for (const button of document.querySelectorAll('.nav-item')) { button.click(); await new Promise(resolve => setTimeout(resolve, 100)); result.push({name:button.textContent, content:document.querySelector('main').innerText.length}); }

      document.querySelector('.nav-item').click(); await new Promise(resolve => setTimeout(resolve, 100));

      [...document.querySelectorAll('button')].find(b => b.textContent.includes('Conjuro con referencias'))?.click(); await new Promise(resolve => setTimeout(resolve, 100));

      return {pages:result, exampleLoaded:document.querySelector('main').innerText.includes('conjuro.json')};

    })()`);

    await fs.writeFile(path.join(app.getPath('userData'), 'desktop-example.png'), (await window.webContents.capturePage()).toPNG());

    const memoryReview = await window.webContents.executeJavaScript(`(async () => {
      [...document.querySelectorAll('.nav-item')].find(button => button.textContent.includes('Memoria'))?.click();
      await new Promise(resolve => setTimeout(resolve, 300));
      const page = await window.desktop.listMemory({limit:1});
      const pdfPage = await window.desktop.listMemory({source:'PDF',limit:1});
      const conflicts = await window.desktop.memoryConflicts();
      return {bridge:typeof window.desktop.reviewMemory,pdfBridge:typeof window.desktop.generatePdfMemory,bindingBridge:typeof window.desktop.preparePdfBinding,pdfPaged:pdfPage.entries.length<=1&&pdfPage.entries.every(entry=>entry.pdf?.source?.page>0),loaded:document.querySelector('main').innerText.includes('Memoria y revisión'), revisionValid:Number.isSafeInteger(page.revision), paged:page.entries.length<=1, conflictsValid:Array.isArray(conflicts.conflicts)};
    })()`);
    await fs.writeFile(path.join(app.getPath('userData'), 'desktop-review.png'), (await window.webContents.capturePage()).toPNG());
    Object.assign(report, { layouts, views, memoryReview });

    await fs.writeFile(path.join(app.getPath('userData'), 'desktop-smoke.json'), JSON.stringify(report, null, 2));

    if (layouts.some(layout => layout.overflow) || views.pages.some((page: { content: number }) => page.content < 20) || !views.exampleLoaded) throw new Error('Comprobación de interfaz fallida.');

    if (report.bridge !== 'function' || report.node !== 'undefined' || !report.nativeSelectors || !report.invalidPayloadRejected) throw new Error('Comprobación desktop fallida.');
    if(memoryReview.bridge!=='function'||memoryReview.pdfBridge!=='function'||memoryReview.bindingBridge!=='function'||!memoryReview.pdfPaged||!memoryReview.loaded||!memoryReview.revisionValid||!memoryReview.paged||!memoryReview.conflictsValid)throw new Error('Comprobación de memoria fallida.');

    app.quit();

  }

}).catch((error) => {

  if (process.argv.includes('--smoke-test')) console.error('Desktop smoke:', error instanceof Error ? error.message : 'Error de comprobación');

  if (!process.argv.includes('--smoke-test')) dialog.showErrorBox('Error de inicio', 'No se pudo iniciar el Traductor Foundry.');

  app.exit(1);

});

app.on('window-all-closed', () => app.quit());



app.on('before-quit', () => batch?.controller.abort());

