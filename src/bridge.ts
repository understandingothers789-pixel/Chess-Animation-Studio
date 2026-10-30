import type { Project, Asset, Format } from "./core/model";
export interface ExportOptions {
  format: Format;
  encoder: "auto" | "software";
  width?: number;
  height?: number;
  fps?: number;
  start?: number;
  end?: number;
  path?: string;
}
export interface Settings {
  ffmpeg: string;
  stockfish: string;
  hasToken: boolean;
  recent: string[];
  recovery: boolean;
}
export interface AnalysisProgress {
  moveId: string;
  index: number;
  total: number;
  analysis: Project["moves"][number]["analysis"];
}
export interface ExportProgress {
  phase: "rendering" | "encoding" | "complete" | "cancelled" | "error";
  done: number;
  total: number;
  message: string;
  path?: string;
}
export interface StudioBridge {
  importBadgePack(): Promise<{
    assets: Asset[];
    badges: Record<string, string>;
  } | null>;
  settings(): Promise<Settings>;
  configure(
    key: "ffmpeg" | "stockfish" | "token",
    value?: string,
  ): Promise<Settings>;
  readProject(
    path?: string,
    recovery?: boolean,
  ): Promise<{ project: Project; path: string | null } | null>;
  saveProject(
    project: Project,
    path: string | null,
    saveAs?: boolean,
  ): Promise<string | null>;
  autosave(project: Project, path: string | null): Promise<void>;
  discardRecovery(): Promise<void>;
  importText(): Promise<{ text: string; name: string } | null>;
  pickAsset(kind: Asset["kind"]): Promise<Asset | null>;
  relinkAsset(asset: Asset): Promise<Asset | null>;
  assetData(
    asset: Asset,
    projectPath: string | null,
  ): Promise<{ data: string; mime: string }>;
  assetStatus(
    assets: Asset[],
    projectPath: string | null,
  ): Promise<Record<string, string | null>>;
  collectAssets(
    project: Project,
    path: string | null,
  ): Promise<{ project: Project; path: string } | null>;
  analyze(
    project: Project,
    mode: "book" | "engine" | "both",
    ids: string[],
  ): Promise<void>;
  cancelAnalysis(): Promise<void>;
  onAnalysis(fn: (p: AnalysisProgress) => void): () => void;
  exportVideo(
    project: Project,
    projectPath: string | null,
    options: ExportOptions,
  ): Promise<void>;
  cancelExport(): Promise<void>;
  onExport(fn: (p: ExportProgress) => void): () => void;
  exportFrame(frame: Uint8Array, index: number): Promise<void>;
  exportFinish(error?: string): Promise<void>;
  onExportTask(
    fn: (task: {
      project: Project;
      options: ExportOptions;
      assets: Record<string, string>;
    }) => void,
  ): () => void;
  present(): Promise<void>;
  presentationState(state: {
    project: Project;
    time: number;
    playing: boolean;
    assets: Record<string, string>;
  }): void;
  onPresentation(
    fn: (state: {
      project: Project;
      time: number;
      playing: boolean;
      assets: Record<string, string>;
    }) => void,
  ): () => void;
  openLogs(): Promise<void>;
  log(event: string, message: string): void;
  confirmDiscard(): Promise<boolean>;
  editingState(project: Project, path: string | null, dirty: boolean): void;
}
declare global {
  interface Window {
    studio: StudioBridge;
    __studioTest?: unknown;
  }
}
