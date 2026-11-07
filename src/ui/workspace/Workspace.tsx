import { useEffect, useState, useRef } from "react";
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
    right: 430,
    timeline: 190,
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
export function useWorkspace() {
  const [layout, setLayout] = useState<Layout>(() => {
    try {
      const v = JSON.parse(localStorage.getItem("studio.workspace") ?? "null");
      if (!v || typeof v !== "object") return defaults;
      const number = (
        key: "left" | "right" | "timeline",
        min: number,
        max: number,
      ) =>
        typeof v[key] === "number" && Number.isFinite(v[key])
          ? Math.min(max, Math.max(min, v[key]))
          : defaults[key];
      return {
        left: number("left", 220, 500),
        right: number("right", 240, 540),
        timeline: number("timeline", 120, 520),
        hideLeft: v.hideLeft === true,
        hideRight: v.hideRight === true,
        hideTimeline: v.hideTimeline === true,
        compact: v.compact !== false,
        scale: [100, 110, 125, 150].includes(v.scale) ? v.scale : 100,
        mode: Object.hasOwn(modes, v.mode) ? v.mode : "Editing",
      };
    } catch {
      return defaults;
    }
  });
  useEffect(() => {
    localStorage.setItem("studio.workspace", JSON.stringify(layout));
  }, [layout]);
  const previousLayout = useRef<Layout>(defaults);
  const patch = (v: Partial<Layout>) => setLayout((p) => ({ ...p, ...v }));
  return {
    layout,
    patch,
    restore: () => setLayout(previousLayout.current),
    preset: (mode: string) => {
      if (mode === "Preview" && layout.mode !== "Preview")
        previousLayout.current = layout;
      patch({
        ...defaults,
        ...modes[mode],
        mode,
        compact: layout.compact,
        scale: layout.scale,
      });
    },
  };
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
          e.preventDefault();
          onChange(clamp(value + delta));
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
