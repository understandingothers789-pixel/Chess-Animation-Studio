import {
  applyMoveSettings,
  bulkGroups,
  settingsLabel as label,
} from "./bulkEditing";
import { effect, type Project, type Effect } from "../../core/project";
import {
  settingsKinds,
  settingsAffectTiming,
  type SettingsClipboard,
  type SettingsKind,
} from "../../core/editing";
import type { Edit } from "../state";
import type { MenuAction } from "../timeline/TimelineMenu";
export type MoveCommandContext = {
  p: Project;
  index: number;
  track: string;
  checked: Set<string>;
  edit: Edit;
  copied: { current: SettingsClipboard | null };
  inspect: (index: number, section: string) => void;
  navigate: (category: string, section?: string, control?: string) => void;
  preview: (index: number) => void;
  report: (message: string) => void;
  bulk?: (sourceId: string, kind: SettingsKind) => void;
};
export function moveCommands(c: MoveCommandContext): MenuAction[] {
  const { p, index, track, edit, copied } = c,
    m = p.moves[index];
  if (!m) return [];
  const changeSource = (
    label: string,
    fn: (effect: Effect, draft: Project) => void,
  ) =>
    edit(label, (draft) => {
      if (draft.id !== p.id) return;
      const target = draft.moves.find((move) => move.id === m.id);
      if (target) fn(target.effect, draft);
    });
  const one = [m.id],
    selected = p.moves.filter((m) => c.checked.has(m.id)).map((m) => m.id);
  const apply = (
    kind: SettingsKind,
    ids: string[],
    source: Effect,
    sourceFormat = p.format,
  ) => {
    applyMoveSettings(p, edit, c.report, kind, ids, source, sourceFormat);
  };

  const kinds: SettingsKind[] =
    track === "camera"
      ? ["camera"]
      : track === "effect"
        ? ["effects"]
        : settingsKinds;
  const copies = kinds.map((kind) => ({
    id: `copy.${kind}`,
    label: label(kind),
    run: () => {
      copied.current = {
        kind,
        source: structuredClone(m.effect),
        format: p.format,
      };
      c.report(`${label(kind)} copied from ${m.san}.`);
    },
  }));
  const pastes = kinds.map((kind) => ({
    label: label(kind),
    disabled:
      !copied.current ||
      (copied.current.kind !== "everything" && copied.current.kind !== kind),
    run: () => {
      if (copied.current)
        apply(kind, one, copied.current.source, copied.current.format);
    },
  }));
  const groups = bulkGroups(p, m.id, c.checked);
  const bulk = kinds.map((kind) => ({
    label: label(kind),
    children: Object.entries(groups).map(([name, ids]) => ({
      label: `${name} · ${ids.length}${settingsAffectTiming(kind) ? ` (${p.moves.filter((m) => ids.includes(m.id) && m.effect.locked).length} timing locked)` : ""}`,
      disabled: !ids.length,
      run: () => apply(kind, ids, m.effect),
    })),
  }));
  const actions: MenuAction[] = [
    { label: "Preview this move", run: () => c.preview(index) },
    {
      label:
        track === "camera"
          ? `Edit camera · ${p.format}${selected.length > 1 ? ` · ${selected.length} selected` : ""}…`
          : track === "effect"
            ? selected.length > 1
              ? `Edit effects · ${selected.length} selected…`
              : "Edit badges & move effects…"
            : selected.length > 1
              ? `Edit movement · ${selected.length} selected…`
              : "Edit movement & timing…",
      run: () => c.inspect(index, track === "effect" ? "effects" : track),
    },
    {
      label: "Apply animation preset…",
      run: () => {
        c.inspect(index, "move");
        c.navigate("presets");
      },
    },
    { label: "Copy", children: copies, separatorBefore: true },
    { label: `Paste to ${m.san}`, children: pastes },
    {
      label: `Apply ${m.san}’s settings to…${selected.length > 1 ? ` (${selected.length} selected)` : ""}`,
      children: bulk,
    },
  ];
  if (c.bulk)
    actions.push({
      id: "bulk.panel",
      label: `Bulk edit from ${m.san}…`,
      run: () =>
        c.bulk!(
          m.id,
          track === "camera"
            ? "camera"
            : track === "effect"
              ? "effects"
              : "movement",
        ),
    });
  if (track === "move") {
    actions.splice(3, 0, {
      label: "Speed / Duration",
      children: [
        ...[-0.5, -0.25, -0.1, 0.1, 0.25, 0.5].map((speed) => ({
          label: `${Math.round(Math.abs(speed) * 100)}% ${speed > 0 ? "faster" : "slower"}`,
          disabled: m.effect.locked,
          run: () =>
            changeSource("Change move speed", (e) => {
              e.duration = Math.max(
                0.2,
                Math.min(30, e.duration / (1 + speed)),
              );
            }),
        })),
        {
          label: "Set exact duration…",
          disabled: m.effect.locked,
          run: () => c.inspect(index, "duration"),
        },
        {
          label: "Reset duration",
          disabled: m.effect.locked,
          run: () =>
            changeSource("Reset duration", (e) => {
              e.duration = effect(m.effect.preset).duration;
            }),
        },
      ],
    });
    actions.push({
      label: "Lock timing",
      separatorBefore: true,
      checked: m.effect.locked,
      run: () =>
        changeSource("Toggle timing lock", (e) => {
          e.locked = !e.locked;
        }),
    });
    actions.push({
      label: "Reset movement only",
      run: () => apply("movement", one, effect(m.effect.preset)),
    });
  }
  if (track === "camera")
    actions.push({
      label: `Reset camera · ${p.format}`,
      run: () =>
        changeSource("Reset camera", (e) => {
          delete e.cameras[p.format];
        }),
    });
  if (track === "effect")
    actions.push(
      { label: "Edit badge…", run: () => c.inspect(index, "badge") },
      {
        label: "Edit beat spotlight…",
        run: () => c.inspect(index, "spotlight"),
      },
      {
        label: "Beat spotlight",
        disabled: m.effect.locked,
        checked: m.effect.jam.enabled,
        run: () =>
          changeSource("Toggle spotlight", (e) => {
            e.jam.enabled = !e.jam.enabled;
          }),
      },
      {
        label: "Move lighting",
        checked: m.effect.light.enabled,
        run: () =>
          changeSource("Toggle move lighting", (e) => {
            e.light.enabled = !e.light.enabled;
          }),
      },
      {
        label: "Reset visual effects only",
        run: () => apply("effects", one, effect(m.effect.preset)),
      },
      { label: "Composition-wide effects…", run: () => c.navigate("effects") },
    );
  return actions;
}
