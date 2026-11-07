import { moveCommands } from "./moveCommands";
import { annotationCommands, type AnnotationStyle } from "./annotationCommands";
import type { SettingsClipboard, SettingsKind } from "../../core/editing";
import type { Project } from "../../core/project";
import { segments, duration } from "../../core/timeline";
import type { Edit } from "../state";
import type { MenuAction } from "../timeline/TimelineMenu";
import type { Dispatch, SetStateAction } from "react";
export type TimelineTarget = {
  x: number;
  y: number;
  track: string;
  index: number;
  id?: string;
  at: number;
};
type Context = {
  p: Project;
  menu: TimelineTarget;
  time: number;
  selected: number;
  checked: Set<string>;
  edit: Edit;
  copied: { current: SettingsClipboard | null };
  annotationStyle: { current: AnnotationStyle | null };
  inspect: (index: number, section: string, id?: string) => void;
  navigate: (category: string, section?: string, control?: string) => void;
  preview: (index: number) => void;
  report: (message: string) => void;
  addToStoryboard?: (ids: string[]) => void;
  bulk?: (sourceId: string, kind: SettingsKind) => void;
  seek: (time: number) => void;
  viewportWidth: number;
  setZoom: Dispatch<SetStateAction<number>>;
  setSnap: Dispatch<SetStateAction<boolean>>;
  snap: boolean;
  setHiddenTracks: Dispatch<SetStateAction<string[]>>;
  hiddenTracks: string[];
};
export function timelineCommands({
  p,
  menu,
  time,
  selected,
  checked,
  edit,
  copied,
  annotationStyle,
  inspect,
  navigate,
  preview,
  report,
  bulk,
  addToStoryboard,
  seek,
  viewportWidth,
  setZoom,
  setSnap,
  snap,
  setHiddenTracks,
  hiddenTracks,
}: Context): MenuAction[] {
  const length = duration(p),
    seq = segments(p);
  const actions: MenuAction[] = [];
  const add = (
    label: string,
    run: () => void,
    disabled = false,
    danger = false,
  ) => actions.push({ label, run, disabled, danger });
  if (menu) {
    const m = p.moves[menu.index];
    if (menu.track.startsWith("header:")) {
      const track = menu.track.slice(7);
      add("Open track settings…", () =>
        track === "music"
          ? navigate("music", "Music", "Music volume value")
          : ["camera", "effect", "move"].includes(track)
            ? inspect(selected, track === "effect" ? "effects" : track)
            : track === "annotation"
              ? inspect(selected, "annotations")
              : navigate("game"),
      );
      if (["camera", "effect", "music", "annotation"].includes(track))
        add("Hide track", () =>
          setHiddenTracks((t) => [...new Set([...t, track])]),
        );
      if (track === "music") {
        add("Dark-square pulse settings…", () =>
          navigate("music", "Dark-square beat pulse", "Pulse dark squares"),
        );
        add("Knight horse sound settings…", () =>
          navigate("music", "Knight horse sound", "Horse sound volume value"),
        );
      }
      if (track === "music")
        add(
          "Add beat at playhead",
          () =>
            edit("Add beat", (p) => {
              p.beats.push({
                id: crypto.randomUUID(),
                time,
                enabled: true,
                accent: false,
              });
            }),
          p.beatsLocked,
        );
    } else if (menu.track === "intro") {
      add("Edit intro & title…", () => inspect(menu.index, "intro"));
      add("Go to intro start", () => seek(0));
    } else if (["move", "camera", "effect"].includes(menu.track)) {
      actions.push(
        ...moveCommands({
          p,
          index: menu.index,
          track: menu.track,
          checked,
          edit,
          copied,
          inspect,
          navigate,
          preview,
          report,
          bulk,
          addToStoryboard,
        }),
      );
    } else if (menu.track === "annotation") {
      actions.push(
        ...annotationCommands(
          p,
          menu.id,
          menu.index,
          time,
          edit,
          inspect,
          seek,
          annotationStyle,
        ),
      );
    } else if (menu.track === "music") {
      add("Music volume…", () =>
        navigate("music", "Music", "Music volume value"),
      );
      add("Music trim…", () =>
        navigate("music", "Music", "Source trim start value"),
      );
      add("Dark-square pulse settings…", () =>
        navigate("music", "Dark-square beat pulse", "Pulse dark squares"),
      );
      add("Knight horse sound settings…", () =>
        navigate("music", "Knight horse sound", "Horse sound volume value"),
      );
      add(p.music.muted ? "Unmute music" : "Mute music", () =>
        edit("Toggle music mute", (p) => {
          p.music.muted = !p.music.muted;
        }),
      );
      add(
        p.pulse.enabled
          ? "Disable dark-square beat pulse"
          : "Enable dark-square beat pulse",
        () =>
          edit("Toggle beat pulse", (p) => {
            p.pulse.enabled = !p.pulse.enabled;
          }),
      );
      add(
        p.audio.knightHorse
          ? "Disable knight horse sound"
          : "Enable knight horse sound",
        () =>
          edit("Toggle horse cue", (p) => {
            p.audio.knightHorse = !p.audio.knightHorse;
          }),
      );
      add(
        "Add beat here",
        () =>
          edit("Add beat", (p) => {
            p.beats.push({
              id: crypto.randomUUID(),
              time: menu.at,
              enabled: true,
              accent: false,
            });
            p.beats.sort((a, b) => a.time - b.time);
          }),
        p.beatsLocked,
      );
      add(p.beatsLocked ? "Unlock beat markers" : "Lock beat markers", () =>
        edit("Toggle beat lock", (p) => {
          p.beatsLocked = !p.beatsLocked;
        }),
      );
      if (menu.id) {
        const beat = p.beats.find((b) => b.id === menu.id);
        if (beat) {
          add("Move playhead here", () => seek(beat.time));
          add(
            "Set beat to playhead",
            () =>
              edit("Move beat", (p) => {
                const b = p.beats.find((b) => b.id === menu.id)!;
                b.time = time;
                if (b.sourceTime !== undefined)
                  b.sourceTime = time + p.music.trimStart - p.music.offset;
              }),
            p.beatsLocked,
          );
          actions.push({
            label: "Beat enabled",
            checked: beat.enabled,
            disabled: p.beatsLocked,
            run: () =>
              edit("Toggle beat", (p) => {
                const b = p.beats.find((b) => b.id === menu.id)!;
                b.enabled = !b.enabled;
              }),
          });
        }
      }
      if (menu.id) {
        add(
          "Toggle beat accent",
          () =>
            edit("Toggle beat accent", (p) => {
              const b = p.beats.find((b) => b.id === menu.id);
              if (b) b.accent = !b.accent;
            }),
          p.beatsLocked,
        );
        add(
          "Delete beat",
          () =>
            edit("Delete beat", (p) => {
              p.beats = p.beats.filter((b) => b.id !== menu.id);
            }),
          p.beatsLocked,
          true,
        );
      }
    } else {
      add("Fit timeline to window", () =>
        setZoom(Math.max(0.02, viewportWidth / Math.max(1, length * 52))),
      );
      add(snap ? "Disable snapping" : "Enable snapping", () => setSnap(!snap));
    }
    if (menu.track === "timeline" || menu.track.startsWith("header:")) {
      add("Reset timeline view", () => {
        setHiddenTracks([]);
        setZoom(1);
        setSnap(true);
      });
      add("Show all tracks", () => setHiddenTracks([]), !hiddenTracks.length);
    }
  }

  return actions;
}
