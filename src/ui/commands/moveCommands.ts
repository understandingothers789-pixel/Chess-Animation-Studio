import { effect, type Project, type Effect } from "../../core/project";
import {
  moveGroups,
  pasteSettings,
  settingsKinds,
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
  navigate: (category: string, section?: string) => void;
  preview: (index: number) => void;
  report: (message: string) => void;
};
const label = (kind: SettingsKind) =>
  kind === "everything"
    ? "Everything (all formats)"
    : kind[0].toUpperCase() + kind.slice(1);
export function moveCommands(c: MoveCommandContext): MenuAction[] {
  const { p, index, track, edit, copied } = c,
    m = p.moves[index];
  if (!m) return [];
  const one = [m.id],
    selected = p.moves.filter((m) => c.checked.has(m.id)).map((m) => m.id);
  const apply = (
    kind: SettingsKind,
    ids: string[],
    source: Effect,
    sourceFormat = p.format,
  ) => {
    const locked = p.moves.filter(
      (m) => ids.includes(m.id) && m.effect.locked,
    ).length;
    edit(`Apply ${kind} to ${ids.length} moves`, (draft) => {
      for (const move of draft.moves.filter((m) => ids.includes(m.id)))
        move.effect = pasteSettings(
          move.effect,
          { kind, source, format: sourceFormat },
          p.format,
        );
    });
    c.report(
      `${label(kind)} applied to ${ids.length} moves${locked && ["timing", "everything"].includes(kind) ? `; timing preserved for ${locked} locked moves` : ""}. Undo is available.`,
    );
  };
  const kinds: SettingsKind[] =
    track === "camera"
      ? ["camera"]
      : track === "effect"
        ? ["effects"]
        : settingsKinds;
  const copies = kinds.map((kind) => ({
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
  const groups = {
    "This move": one,
    ...(selected.length > 1 ? { "Selected moves": selected } : {}),
    ...moveGroups(p),
  };
  const bulk = kinds.map((kind) => ({
    label: label(kind),
    children: Object.entries(groups).map(([name, ids]) => ({
      label: `${name} · ${ids.length}${["timing", "everything"].includes(kind) ? ` (${p.moves.filter((m) => ids.includes(m.id) && m.effect.locked).length} timing locked)` : ""}`,
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
    { label: "Copy", children: copies },
    { label: "Paste to this move", children: pastes },
    {
      label: `Apply source settings to…${selected.length > 1 ? ` (${selected.length} selected)` : ""}`,
      children: bulk,
    },
  ];
  if (track === "move") {
    actions.splice(3, 0, {
      label: "Speed / Duration",
      children: [
        ...[-0.5, -0.25, -0.1, 0.1, 0.25, 0.5].map((speed) => ({
          label: `${Math.round(Math.abs(speed) * 100)}% ${speed > 0 ? "faster" : "slower"}`,
          disabled: m.effect.locked,
          run: () =>
            edit("Change move speed", (p) => {
              const e = p.moves[index].effect;
              e.duration = Math.max(
                0.2,
                Math.min(30, e.duration / (1 + speed)),
              );
            }),
        })),
        {
          label: "Set exact duration…",
          disabled: m.effect.locked,
          run: () => c.inspect(index, "move"),
        },
        {
          label: "Reset duration",
          disabled: m.effect.locked,
          run: () =>
            edit("Reset duration", (p) => {
              p.moves[index].effect.duration = effect(m.effect.preset).duration;
            }),
        },
      ],
    });
    actions.push({
      label: "Lock timing",
      checked: m.effect.locked,
      run: () =>
        edit("Toggle timing lock", (p) => {
          p.moves[index].effect.locked = !p.moves[index].effect.locked;
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
        edit("Reset camera", (p) => {
          delete p.moves[index].effect.cameras[p.format];
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
          edit("Toggle spotlight", (p) => {
            p.moves[index].effect.jam.enabled =
              !p.moves[index].effect.jam.enabled;
          }),
      },
      {
        label: "Move lighting",
        checked: m.effect.light.enabled,
        run: () =>
          edit("Toggle move lighting", (p) => {
            p.moves[index].effect.light.enabled =
              !p.moves[index].effect.light.enabled;
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
