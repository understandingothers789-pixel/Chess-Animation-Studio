import { contextBridge, ipcRenderer } from "electron";
const invoke =
  (name: string) =>
  (...args: unknown[]) =>
    ipcRenderer.invoke(name, ...args);
const on = (name: string) => (cb: (value: unknown) => void) => {
  const f = (_event: unknown, value: unknown) => cb(value);
  ipcRenderer.on(name, f);
  return () => ipcRenderer.removeListener(name, f);
};
contextBridge.exposeInMainWorld("studio", {
  sample: invoke("sample"),
  open: invoke("open"),
  openPath: invoke("openPath"),
  save: invoke("save"),
  projectReport: invoke("projectReport"),
  recover: invoke("recover"),
  discardRecovery: invoke("discardRecovery"),
  autosave: invoke("autosave"),
  recent: invoke("recent"),
  importAsset: invoke("importAsset"),
  assetData: invoke("assetData"),
  assetStatus: invoke("assetStatus"),
  collect: invoke("collect"),
  badgePack: invoke("badgePack"),
  chooseText: invoke("chooseText"),
  settings: invoke("settings"),
  tool: invoke("tool"),
  setEncoder: invoke("setEncoder"),
  token: invoke("token"),
  logs: invoke("logs"),
  analyze: invoke("analyze"),
  cancelAnalysis: invoke("cancelAnalysis"),
  onAnalysis: on("analysis-progress"),
  export: invoke("export"),
  cancelExport: invoke("cancelExport"),
  onExport: on("export-progress"),
  onTask: on("export-task"),
  frame: invoke("frame"),
  finish: invoke("finish"),
  workerReady: () => ipcRenderer.send("worker-ready"),
  presentation: invoke("presentation"),
  present: (v: unknown) => ipcRenderer.send("present", v),
  onPresentation: on("present-state"),
});
