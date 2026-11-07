import { syncMarkers } from "../../core/audio";
import type { Project } from "../../core/project";
import type { Edit } from "../state";
import { Range, Toggle } from "../controls";
export function StoryMusic({
  p,
  edit,
  time,
  importMusic,
}: {
  p: Project;
  edit: Edit;
  time: number;
  importMusic: () => void;
}) {
  return (
    <details className="story-music">
      <summary>Soundtrack & output beats</summary>
      <p className="hint">
        One continuous soundtrack across all shots. Beats use storyboard output
        time. Lighting settings are shared; beat markers use separate clocks.
      </p>
      <button onClick={importMusic}>Import soundtrack</button>
      <p>
        {p.assets.find((a) => a.id === p.music.asset)?.name ??
          "No soundtrack selected"}
      </p>
      <Toggle
        label="Mute storyboard soundtrack"
        checked={p.music.muted}
        onChange={(v) =>
          edit("Mute soundtrack", (d) => {
            d.music.muted = v;
          })
        }
      />
      {(
        [
          ["volume", "Soundtrack volume", 0, 2, 0.05],
          ["offset", "Soundtrack output offset", -60, 60, 0.1],
          ["trimStart", "Soundtrack source start", 0, 3600, 0.1],
          ["trimEnd", "Soundtrack source end (0 = full)", 0, 3600, 0.1],
          ["fadeIn", "Soundtrack fade in", 0, 30, 0.1],
          ["fadeOut", "Soundtrack fade out", 0, 30, 0.1],
        ] as const
      ).map(([key, label, min, max, step]) => (
        <Range
          key={key}
          label={label}
          min={min}
          max={max}
          step={step}
          value={p.music[key]}
          onChange={(v) =>
            edit(label, (d) => {
              d.music[key] = v;
              if (key === "offset" || key === "trimStart")
                d.beats = syncMarkers(d).beats;
            })
          }
        />
      ))}
      <Toggle
        label="Music-driven board pulse"
        checked={p.pulse.enabled}
        onChange={(v) =>
          edit("Board pulse", (d) => {
            d.pulse.enabled = v;
          })
        }
      />
      <Range
        label="Storyboard pulse intensity"
        value={p.pulse.intensity}
        min={0}
        max={1}
        step={0.05}
        onChange={(v) =>
          edit("Board pulse intensity", (d) => {
            d.pulse.intensity = v;
          })
        }
      />
      <button
        disabled={!p.beats.length}
        onClick={() =>
          edit("Use detected soundtrack beats", (d) => {
            d.storyboard.beats = d.beats.map((b) => ({
              id: crypto.randomUUID(),
              time: b.time,
              enabled: b.enabled,
              accent: b.accent,
            }));
          })
        }
      >
        Replace output beats with detected music beats
      </button>
      <p className="hint">
        Detected music markers keep their soundtrack timestamps. Source move
        timing is unchanged.
      </p>
      <button
        onClick={() =>
          edit("Add storyboard beat", (d) => {
            d.storyboard.beats.push({
              id: crypto.randomUUID(),
              time,
              enabled: true,
              accent: false,
            });
            d.storyboard.beats.sort((a, b) => a.time - b.time);
          })
        }
      >
        Add beat at {time.toFixed(2)}s
      </button>
      {p.storyboard.beats.map((b) => (
        <div className="button-row" key={b.id}>
          <small>{b.time.toFixed(2)}s</small>
          <Toggle
            label={`Accent at ${b.time.toFixed(2)}s`}
            checked={b.accent}
            onChange={(v) =>
              edit("Storyboard accent", (d) => {
                d.storyboard.beats.find((x) => x.id === b.id)!.accent = v;
              })
            }
          />
          <button
            aria-label={`Remove beat at ${b.time.toFixed(2)}s`}
            onClick={() =>
              edit("Remove storyboard beat", (d) => {
                d.storyboard.beats = d.storyboard.beats.filter(
                  (x) => x.id !== b.id,
                );
              })
            }
          >
            ×
          </button>
        </div>
      ))}
    </details>
  );
}
