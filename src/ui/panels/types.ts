import type { Project, Asset } from "../../core/project";
import type { Edit } from "../state";
import type { Settings } from "../../bridge";
export interface PanelProps {
  project: Project;
  edit: Edit;
  replace: (p: Project) => void;
  selected: number;
  checked: Set<string>;
  setChecked: (s: Set<string>) => void;
  select: (
    i: number,
    modifiers?: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean },
  ) => void;
  time: number;
  seek: (t: number) => void;
  assets: Record<string, string>;
  missing: Set<string>;
  settings: Settings;
  setSettings: (s: Settings) => void;
  run: (fn: () => Promise<unknown>) => void;
  message: (s: string) => void;
  importText: (text: string, kind: "pgn" | "fen", preserve: boolean) => void;
  importAsset: (
    kind: "audio" | "image",
    use: "music" | "sound" | "background" | "badge",
    badge?: string,
  ) => Promise<void>;
  analyzeMusic: () => Promise<void>;
  onOpen: () => void;
  openRecent: (s: string) => void;
  recent: string[];
  path: string | null;
  promotion: string;
  setPromotion: (s: string) => void;
  analysisProgress: { done: number; total: number } | null;
}
