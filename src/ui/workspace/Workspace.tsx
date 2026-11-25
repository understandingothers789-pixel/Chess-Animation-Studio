import { useEffect, useState } from "react";
export type Layout = {
  left: number;
  right: number;
  timeline: number;
  hideLeft: boolean;
  hideRight: boolean;
  hideTimeline: boolean;
  mode: string;
  compact: boolean;
  scale: number;
};
const defaults: Layout = {
  left: 300,
  right: 340,
  timeline: 240,
  hideLeft: false,
  hideRight: false,
  hideTimeline: false,
  mode: "Editing",
  compact: true,
  scale: 100,
};
const modes: Record<string, Partial<Layout>> = {
  Editing: defaults,
  Preview: { hideLeft: true, hideRight: true, hideTimeline: true },
  Effects: {
    hideLeft: false,
    hideRight: false,
    hideTimeline: false,
    left: 245,
    right: 340,
    timeline: 130,
  },
  Storyboard: {
    hideLeft: false,
    hideRight: false,
    hideTimeline: false,
    left: 300,
    right: 340,
    timeline: 280,
  },
  Timeline: {
    hideLeft: true,
    hideRight: false,
    hideTimeline: false,
    timeline: 380,
  },
};
function readLayout(value: unknown, mode: string): Layout {
  const base = { ...defaults, ...modes[mode], mode };
  if (!value || typeof value !== "object") return base;
  const v = value as Partial<Layout>;
  const number = (
    key: "left" | "right" | "timeline",
    min: number,
    max: number,
  ) =>
    typeof v[key] === "number" && Number.isFinite(v[key])
      ? Math.min(max, Math.max(min, v[key]))
      : base[key];
  return {
    left: number("left", 220, 500),
    right: number("right", 240, 540),
    timeline: number("timeline", 120, 520),
    hideLeft: typeof v.hideLeft === "boolean" ? v.hideLeft : base.hideLeft,
    hideRight: typeof v.hideRight === "boolean" ? v.hideRight : base.hideRight,
    hideTimeline:
      typeof v.hideTimeline === "boolean" ? v.hideTimeline : base.hideTimeline,
    compact: v.compact !== false,
    scale: v.scale && [100, 110, 125, 150].includes(v.scale) ? v.scale : 100,
    mode,
  };
}

export function useWorkspace() {
  const [{ layout, saved, returnMode }, set] = useState<{
    layout: Layout;
    saved: Partial<Record<string, Layout>>;
    returnMode: string;
  }>(() => {
    try {
      const current = JSON.parse(
        localStorage.getItem("studio.workspace") ?? "null",
      );
      const stored = JSON.parse(
        localStorage.getItem("studio.workspace.layouts") ?? "null",
      );
      const layout = readLayout(
        current,
        Object.hasOwn(modes, current?.mode) ? current.mode : "Editing",
      );
      const saved = Object.fromEntries(
        Object.keys(modes)
          .filter((mode) => stored?.saved?.[mode])
          .map((mode) => [mode, readLayout(stored.saved[mode], mode)]),
      );
      const returnMode =
        Object.hasOwn(modes, stored?.returnMode) &&
        stored.returnMode !== "Preview"
          ? stored.returnMode
          : "Editing";
      return { layout, saved, returnMode };
    } catch {
      return { layout: defaults, saved: {}, returnMode: "Editing" };
    }
  });
  useEffect(() => {
    localStorage.setItem("studio.workspace", JSON.stringify(layout));
    localStorage.setItem(
      "studio.workspace.layouts",
      JSON.stringify({ saved, returnMode }),
    );
  }, [layout, saved, returnMode]);
  const patch = (v: Partial<Layout>) =>
    set((state) => ({ ...state, layout: { ...state.layout, ...v } }));
  const preset = (mode: string) =>
    set((state) => {
      const current = state.layout;
      if (!Object.hasOwn(modes, mode) || mode === current.mode) return state;
      return {
        saved: { ...state.saved, [current.mode]: current },
        returnMode: mode === "Preview" ? current.mode : state.returnMode,
        layout: {
          ...(state.saved[mode] ?? readLayout(null, mode)),
          compact: current.compact,
          scale: current.scale,
        },
      };
    });
  return { layout, patch, preset, restore: () => preset(returnMode) };
}
export function Splitter({
  label,
  value,
  min,
  max,
  vertical = false,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  vertical?: boolean;
  onChange: (n: number) => void;
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  const [start, setStart] = useState<{ at: number; value: number } | null>(
    null,
  );
  return (
    <div
      className={"splitter " + (vertical ? "horizontal" : "")}
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation={vertical ? "horizontal" : "vertical"}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      onKeyDown={(e) => {
        const delta = (
          {
            ArrowLeft: -10,
            ArrowRight: 10,
            ArrowUp: -10,
            ArrowDown: 10,
          } as Record<string, number>
        )[e.key];
        if (delta) {
          const relevant = vertical
            ? ["ArrowUp", "ArrowDown"]
            : ["ArrowLeft", "ArrowRight"];
          if (!relevant.includes(e.key)) return;
          e.preventDefault();
          onChange(
            clamp(
              value + delta * (label.includes("Right") || vertical ? -1 : 1),
            ),
          );
        }
      }}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        setStart({ at: vertical ? e.clientY : e.clientX, value });
      }}
      onPointerMove={(e) => {
        if (start)
          onChange(
            clamp(
              start.value +
                ((vertical ? e.clientY : e.clientX) - start.at) *
                  (label.includes("Right") || vertical ? -1 : 1),
            ),
          );
      }}
      onPointerUp={() => setStart(null)}
      onLostPointerCapture={() => setStart(null)}
    />
  );
}
export function WorkspaceBar({
  workspace,
  onPreset,
}: {
  workspace: ReturnType<typeof useWorkspace>;
  onPreset?: (name: string) => void;
}) {
  const { layout: l, patch, preset } = workspace;
  return (
    <div className="workspace-bar" aria-label="Workspace controls">
      {l.mode === "Preview" && (
        <button onClick={workspace.restore}>Return to editing</button>
      )}
      <label>
        Workspace{" "}
        <select
          aria-label="Workspace preset"
          title="Switch between balanced editing, a large preview, detailed effects and an expanded timeline."
          aria-description="Switch between balanced editing, a large preview, detailed effects and an expanded timeline."
          value={l.mode}
          onChange={(e) => {
            preset(e.target.value);
            onPreset?.(e.target.value);
          }}
        >
          {Object.keys(modes).map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </label>
      <button
        aria-pressed={!l.hideLeft}
        onClick={() => patch({ hideLeft: !l.hideLeft })}
      >
        Settings
      </button>
      <button
        aria-pressed={!l.hideRight}
        onClick={() => patch({ hideRight: !l.hideRight })}
      >
        Inspector
      </button>
      <button
        aria-pressed={!l.hideTimeline}
        onClick={() => patch({ hideTimeline: !l.hideTimeline })}
      >
        Timeline
      </button>
      <button
        aria-pressed={l.compact}
        onClick={() => patch({ compact: !l.compact })}
      >
        Compact navigation
      </button>
      <label>
        UI scale{" "}
        <select
          aria-label="UI scale"
          title="Enlarge editor controls without changing the exported video."
          aria-description="Enlarge editor controls without changing the exported video."
          value={l.scale}
          onChange={(e) => patch({ scale: +e.target.value })}
        >
          {[100, 110, 125, 150].map((v) => (
            <option key={v} value={v}>
              {v}%
            </option>
          ))}
        </select>
      </label>
      <span title="Space: play/pause · ←/→: move · Ctrl+Z: undo · Ctrl+S: save">
        Shortcuts ⓘ
      </span>
    </div>
  );
}
