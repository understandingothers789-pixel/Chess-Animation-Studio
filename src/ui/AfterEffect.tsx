import { afterEffectDefaults, type Effect } from "../core/project";
import { afterEffectWindow } from "../core/timeline";
import { Range, Section, Select } from "./controls";

const names = {
  none: "None",
  rebound: "Piece rebound",
  "size-pulse": "Piece size pulse",
  "camera-pulse": "Camera push-in",
} as const;

export function AfterEffect({
  effect,
  selection,
  preview,
  update,
  seek,
}: {
  effect: Effect;
  selection: Effect[];
  preview: ReturnType<typeof afterEffectWindow>;
  update: (label: string, change: (effect: Effect) => void) => void;
  seek?: (time: number) => void;
}) {
  const mixed = <K extends keyof Effect["after"]>(key: K) =>
    selection.some((fx) => fx.after[key] !== effect.after[key]);
  const locked = selection.every((fx) => fx.locked);
  const visible = selection.some((fx) => fx.after.kind !== "none");
  return (
    <Section
      title="After effect"
      status={mixed("kind") ? "Mixed" : names[effect.after.kind]}
      onReset={() =>
        update("Reset after effect", (fx) => {
          fx.after = { ...afterEffectDefaults };
        })
      }
    >
      <Select
        label="After-effect type"
        value={effect.after.kind}
        mixed={mixed("kind")}
        disabled={locked}
        options={Object.entries(names) as [keyof typeof names, string][]}
        onChange={(kind) =>
          update("After-effect type", (fx) => {
            fx.after.kind = kind;
          })
        }
      />
      {visible && (
        <>
          <Range
            label="After-effect delay"
            value={effect.after.delay}
            mixed={mixed("delay")}
            disabled={locked}
            min={0}
            max={3}
            step={0.01}
            unit="s"
            onChange={(delay) =>
              update("After-effect delay", (fx) => {
                fx.after.delay = delay;
              })
            }
          />
          <Range
            label="After-effect duration"
            value={effect.after.duration}
            mixed={mixed("duration")}
            disabled={locked}
            min={0.1}
            max={5}
            step={0.01}
            unit="s"
            onChange={(duration) =>
              update("After-effect duration", (fx) => {
                fx.after.duration = duration;
              })
            }
          />
          <Range
            label="After-effect strength"
            value={effect.after.strength * 100}
            mixed={mixed("strength")}
            min={0}
            max={100}
            step={1}
            unit="%"
            onChange={(strength) =>
              update("After-effect strength", (fx) => {
                fx.after.strength = strength / 100;
              })
            }
          />
        </>
      )}
      {preview && (
        <div className="button-row">
          <p className="hint">
            {preview.start.toFixed(2)}–{preview.end.toFixed(2)} s on the
            timeline.
          </p>
          {seek && (
            <button onClick={() => seek((preview.start + preview.end) / 2)}>
              View after-effect peak
            </button>
          )}
        </div>
      )}
      <p className="hint">
        Starts after the move finishes. The clip holds long enough to show it.
      </p>
    </Section>
  );
}
