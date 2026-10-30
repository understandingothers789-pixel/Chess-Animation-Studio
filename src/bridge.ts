import type { Project, Asset, Format } from "./core/project";
export interface Settings {
  ffmpeg: string;
  stockfish: string;
  encoder: "auto" | "software";
  tokenPresent: boolean;
}
export interface ExportOptions {
  format: Format;
  start: number;
  end: number;
  width?: number;
  height?: number;
  fps?: number;
}
export interface ExportProgress {
  phase: string;
  done: number;
  total: number;
  path?: string;
  error?: string;
}
export interface Studio {
  sample(): Promise<Project>;
  open(): Promise<{ project: Project; path: string } | null>;
  openPath(path: string): Promise<{ project: Project; path: string }>;
  save(p: Project, as: boolean): Promise<string | null>;
  recover(): Promise<{ project: Project; path: string | null } | null>;
  discardRecovery(): Promise<void>;
  autosave(p: Project): Promise<void>;
  recent(): Promise<string[]>;
  importAsset(kind: "audio" | "image"): Promise<Asset | null>;
  assetData(a: Asset): Promise<string | null>;
  assetStatus(assets: Asset[]): Promise<Record<string, string | null>>;
  collect(p: Project): Promise<{ project: Project; path: string } | null>;
  badgePack(): Promise<{
    assets: Asset[];
    mapping: Record<string, string>;
  } | null>;
  chooseText(kind: "pgn" | "fen"): Promise<string | null>;
  settings(): Promise<Settings>;
  tool(kind: "ffmpeg" | "stockfish"): Promise<Settings>;
  setEncoder(encoder: "auto" | "software"): Promise<void>;
  token(value: string): Promise<void>;
  logs(): Promise<void>;
  analyze(
    p: Project,
    kind: "book" | "engine",
    indices: number[],
  ): Promise<Record<string, Project["moves"][number]["analysis"]>>;
  cancelAnalysis(): Promise<void>;
  onAnalysis(cb: (v: { done: number; total: number }) => void): () => void;
  export(p: Project, options: ExportOptions): Promise<boolean>;
  cancelExport(): Promise<void>;
  onExport(cb: (p: ExportProgress) => void): () => void;
  onTask(
    cb: (v: {
      project: Project;
      options: ExportOptions;
      assets: Record<string, string>;
    }) => void,
  ): () => void;
  frame(buffer: Uint8Array, index: number): Promise<void>;
  finish(error?: string): Promise<void>;
  workerReady(): void;
  presentation(): Promise<void>;
  present(state: {
    project: Project;
    time: number;
    playing: boolean;
    assets: Record<string, string>;
  }): void;
  onPresentation(
    cb: (s: {
      project: Project;
      time: number;
      playing: boolean;
      assets: Record<string, string>;
      at: number;
    }) => void,
  ): () => void;
}
declare global {
  interface Window {
    studio: Studio;
  }
}
