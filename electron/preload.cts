import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type { PrdProject } from '../src/types.js';

contextBridge.exposeInMainWorld('prdApp', {
  materials: {
    create:()=>ipcRenderer.invoke('materials:create'),
    list:()=>ipcRenderer.invoke('materials:list'),
    get:(id:string)=>ipcRenderer.invoke('materials:get',id),
    renameBundle:(id:string,name:string)=>ipcRenderer.invoke('materials:rename',id,name),
    deleteBundle:(id:string)=>ipcRenderer.invoke('materials:delete',id),
    add:(id:string,options:import('../src/material-types.js').MaterialAddition,files?:File[])=>{
      const paths=files?.map(file=>webUtils.getPathForFile(file));
      if(paths?.some(p=>!p))return Promise.reject(new Error('无法取得本地路径，请从资源管理器拖入文件或目录'));
      return ipcRenderer.invoke('materials:add',id,options,paths);
    },
    updateFile:(id:string,fileId:string,patch:import('../src/material-types.js').MaterialFilePatch)=>ipcRenderer.invoke('materials:update-file',id,fileId,patch),
    removeFile:(id:string,fileId:string)=>ipcRenderer.invoke('materials:remove-file',id,fileId),
    index:(id:string)=>ipcRenderer.invoke('materials:index',id),
    cancel:(id:string)=>ipcRenderer.invoke('materials:cancel',id),
    query:(id:string,query:import('../src/material-types.js').MaterialQuery)=>ipcRenderer.invoke('materials:query',id,query),
    read:(id:string,ids:string[])=>ipcRenderer.invoke('materials:read',id,ids),
    project:(id:string)=>ipcRenderer.invoke('materials:project',id),
  },
  importPrd: (file?: File) => {
    const filePath = file ? webUtils.getPathForFile(file) : undefined;
    if (file && !filePath) return Promise.reject(new Error('无法取得本地文件，请从资源管理器拖入文件'));
    return ipcRenderer.invoke('projects:import', filePath);
  },
  loadProjects: () => ipcRenderer.invoke('projects:list'),
  saveProject: (project: PrdProject) => ipcRenderer.invoke('projects:save', project),
  inspectRuntime: (config?: import('../src/types.js').RuntimeConfig) => ipcRenderer.invoke('runtime:inspect', config),
  prepareResult: (project: PrdProject) => ipcRenderer.invoke('projects:prepare-result', project),
  openResultDirectory: (taskId: string) => ipcRenderer.invoke('analysis:open-result', taskId),
  loadRuntimeConfig: () => ipcRenderer.invoke('runtime:config:get'),
  saveRuntimeConfig: (config: import('../src/types.js').RuntimeConfig) => ipcRenderer.invoke('runtime:config:save', config),
  testRuntime: (config: import('../src/types.js').RuntimeConfig) => ipcRenderer.invoke('runtime:test', config),
  loadAnalysisTasks: () => ipcRenderer.invoke('analysis:list'),
  startAnalysis: (project: PrdProject) => ipcRenderer.invoke('analysis:start', project),
  cancelAnalysis: (taskId: string) => ipcRenderer.invoke('analysis:cancel', taskId),
  retryAnalysis: (taskId: string) => ipcRenderer.invoke('analysis:retry', taskId),
  onAnalysisTaskUpdate: (callback: (task: import('../src/types.js').AnalysisTask) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, task: import('../src/types.js').AnalysisTask) => callback(task);
    ipcRenderer.on('analysis:task-update', listener);
    return () => ipcRenderer.removeListener('analysis:task-update', listener);
  },
});
