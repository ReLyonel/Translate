import { contextBridge, ipcRenderer } from 'electron';

import type { DesktopAPI } from './contracts';

const api: DesktopAPI = {
  approveVerifiedPdf:hash=>ipcRenderer.invoke('desktop:approveVerifiedPdf',hash),
  resolveCanonicalPdf:()=>ipcRenderer.invoke('desktop:resolveCanonicalPdf'),
  searchPdfSegments:(query,language)=>ipcRenderer.invoke('desktop:searchPdfSegments',query,language),
  createPdfAlignment:(sourceId,targetId)=>ipcRenderer.invoke('desktop:createPdfAlignment',sourceId,targetId),
  generatePdfMemory:()=>ipcRenderer.invoke('desktop:generatePdfMemory'),
  preparePdfBinding:id=>ipcRenderer.invoke('desktop:preparePdfBinding',id),
  commitPdfBinding:(token,fieldId)=>ipcRenderer.invoke('desktop:commitPdfBinding',token,fieldId),
  cancelTranslation:()=>ipcRenderer.invoke('desktop:cancelTranslation'),
  preflightBatch:(handle,language,terminology)=>ipcRenderer.invoke('desktop:preflightBatch',handle,language,terminology),
  importSpanishMemory:handle=>ipcRenderer.invoke('desktop:importSpanishMemory',handle),
  importApprovedHistoricalMemory:(handle,declaration)=>ipcRenderer.invoke('desktop:importApprovedHistoricalMemory',handle,declaration),
  listMemory:query=>ipcRenderer.invoke('desktop:listMemory',query),
  memoryConflicts:()=>ipcRenderer.invoke('desktop:memoryConflicts'),
  reviewMemory:request=>ipcRenderer.invoke('desktop:reviewMemory',request),


  startBatch: (handle, language, terminology,token,outputStrategy) => ipcRenderer.invoke('desktop:startBatch', handle, language, terminology,token,outputStrategy),
  getBatchProgress: () => ipcRenderer.invoke('desktop:batchSnapshot'),
  exportReport:()=>ipcRenderer.invoke('desktop:exportReport'),

  cancelBatch: id => ipcRenderer.invoke('desktop:cancelBatch', id),

  onBatchProgress: callback => {

    const listener = (_event: unknown, progress: Parameters<typeof callback>[0]) => callback(progress);

    ipcRenderer.on('desktop:batchProgress', listener);

    return () => { ipcRenderer.removeListener('desktop:batchProgress', listener); };

  },

  getProgress: () => ipcRenderer.invoke('desktop:progress'),

  onProgress: callback => {

    const listener = (_event: unknown, progress: Parameters<typeof callback>[0]) => callback(progress);

    ipcRenderer.on('desktop:progress', listener);

    return () => { ipcRenderer.removeListener('desktop:progress', listener); };

  },

  health: () => ipcRenderer.invoke('desktop:health'),

  getSettings: () => ipcRenderer.invoke('desktop:settings'),

  saveSettings: settings => ipcRenderer.invoke('desktop:saveSettings', settings),

  translate: request => ipcRenderer.invoke('desktop:translate', request),

  selectInput: kind => ipcRenderer.invoke('desktop:selectInput', kind),

  readInput: (handle, fileId) => ipcRenderer.invoke('desktop:readInput', handle, fileId),

  saveJson: (content, name) => ipcRenderer.invoke('desktop:saveJson', content, name),

  openOutput: () => ipcRenderer.invoke('desktop:openOutput'),

};

contextBridge.exposeInMainWorld('desktop', Object.freeze(api));

