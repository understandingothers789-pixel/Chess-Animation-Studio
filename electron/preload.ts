import { contextBridge, ipcRenderer } from "electron";
const invoke =
  (name: string) =>
  (...args: unknown[]) =>
    ipcRenderer.invoke(name, ...args);
const on = (name: string) => (fn: (...args: any[]) => void) => {
  const listener = (_event: unknown, ...args: any[]) => fn(...args);
  ipcRenderer.on(name, listener);
  return () => ipcRenderer.removeListener(name, listener);
};
contextBridge.exposeInMainWorld("studio", {
  importBadgePack: invoke("asset:badge-pack"),
  settings: invoke("settings"),
  configure: invoke("configure"),
  readProject: invoke("project:read"),
  saveProject: invoke("project:save"),
  autosave: invoke("project:autosave"),
  discardRecovery: invoke("project:discard-recovery"),
  importText: invoke("import:text"),
  pickAsset: invoke("asset:pick"),
  relinkAsset: invoke("asset:relink"),
  assetData: invoke("asset:data"),
  assetStatus: invoke("asset:status"),
  collectAssets: invoke("asset:collect"),
  analyze: invoke("analysis:start"),
  cancelAnalysis: invoke("analysis:cancel"),
  onAnalysis: on("analysis:progress"),
  exportVideo: invoke("export:start"),
  cancelExport: invoke("export:cancel"),
  onExport: on("export:progress"),
  exportFrame: invoke("export:frame"),
  exportFinish: invoke("export:finish"),
  onExportTask: on("export:task"),
  present: invoke("presentation:open"),
  presentationState: (state: unknown) =>
    ipcRenderer.send("presentation:state", state),
  onPresentation: on("presentation:state"),
  openLogs: invoke("logs:open"),
  log: (event: string, message: string) =>
    ipcRenderer.send("log", event, message),
  confirmDiscard: invoke("project:confirm-discard"),
  editingState: (project: unknown, path: string | null, dirty: boolean) =>
    ipcRenderer.send("editing:state", project, path, dirty),
});
