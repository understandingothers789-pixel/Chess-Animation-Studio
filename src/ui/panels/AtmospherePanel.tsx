import { settingHelp } from "../help";
import { useState } from "react";
import {
  effect,
  cinematicPresets,
  rainbowDefaults,
  blank,
  presets,
  formats,
  badgeNames,
  type Project,
  type Asset,
  type Preset,
  type Effect,
} from "../../core/project";
import { selectLine } from "../../core/chess";
import { align, syncMarkers } from "../../core/audio";
import { badge, segments } from "../../core/timeline";
import {
  Section,
  Range,
  Toggle,
  Color,
  Select,
  ScrubNumber,
  clock,
} from "../controls";
import { presetLabels } from "../presets/catalog";
import type { Edit } from "../state";
import type { Settings } from "../../bridge";
import type { PanelProps } from "./types";
import { RainbowControls } from "./RainbowControls";
export function AtmospherePanel(q: PanelProps) {
  const p = q.project,
    edit = q.edit;
  return (
    <>
      <Section
        title="Snow particles · amount & appearance"
        status={p.ambient.enabled ? "Enabled" : "Off"}
        onReset={() =>
          edit("Reset ambient", (p) => {
            p.ambient = blank().ambient;
          })
        }
      >
        <p className="hint">
          Adjust the number, size, speed and transparency of the snow here.
        </p>
        <Toggle
          label="Inside board only"
          checked={p.ambient.insideBoard}
          onChange={(v) =>
            edit("Snow area", (p) => {
              p.ambient.insideBoard = v;
            })
          }
        />
        <Toggle
          label="Ambient particles"
          checked={p.ambient.enabled}
          onChange={(v) =>
            edit("Particles", (p) => {
              p.ambient.enabled = v;
            })
          }
        />
        <Select
          label="Particle layer"
          value={p.ambient.layer}
          options={["over", "behind", "both"]}
          onChange={(v) =>
            edit("Particle layer", (p) => {
              p.ambient.layer = v;
            })
          }
        />
        {(
          [
            "count",
            "size",
            "opacity",
            "speed",
            "drift",
            "direction",
            "depth",
            "softness",
            "seed",
          ] as const
        ).map((k) => (
          <Range
            key={k}
            label={"Particle " + k}
            value={p.ambient[k]}
            resetValue={blank().ambient[k]}
            min={
              k === "size"
                ? 0.01
                : k === "softness"
                  ? 0.05
                  : k === "direction"
                    ? -2
                    : 0
            }
            max={
              k === "count"
                ? 400
                : k === "size"
                  ? 0.35
                  : k === "seed"
                    ? 1000000
                    : k === "opacity" || k === "softness"
                      ? 1
                      : 2
            }
            step={k === "count" || k === "seed" ? 1 : 0.01}
            onChange={(v) =>
              edit("Particle " + k, (p) => {
                p.ambient[k] = v;
              })
            }
          />
        ))}
        <RainbowControls
          label="Snow"
          settings={p.ambient.rainbow}
          edit={(fn) => edit("Snow rainbow", (p) => fn(p.ambient.rainbow))}
        />
        <Color
          label="Particle color"
          value={p.ambient.color}
          onChange={(v) =>
            edit("Particle color", (p) => {
              p.ambient.color = v;
            })
          }
        />
      </Section>
      <Section
        title="Board atmosphere"
        status={p.boardFX.enabled ? "Enabled" : "Off"}
        onReset={() =>
          edit("Reset board atmosphere", (p) => {
            p.boardFX = blank().boardFX;
          })
        }
      >
        <Toggle
          label="Board effects"
          checked={p.boardFX.enabled}
          onChange={(v) =>
            edit("Board FX", (p) => {
              p.boardFX.enabled = v;
            })
          }
        />
        <Toggle
          label="Dark-square tempo pulses"
          checked={p.boardFX.beatClock}
          onChange={(v) =>
            edit("Tempo pulses", (p) => {
              p.boardFX.beatClock = v;
            })
          }
        />
        {(
          ["lightingColor", "rimColor", "sweepColor", "vignetteColor"] as const
        ).map((k) => (
          <Color
            key={k}
            label={
              {
                lightingColor: "Lighting tint",
                rimColor: "Rim light color",
                sweepColor: "Sweep color",
                vignetteColor: "Vignette color",
              }[k]
            }
            value={
              p.boardFX[k] ??
              (k === "rimColor"
                ? p.style.accent
                : k === "vignetteColor"
                  ? "#080c0b"
                  : "#ffffff")
            }
            onChange={(v) =>
              edit(k, (p) => {
                p.boardFX[k] = v;
              })
            }
          />
        ))}
        <Color
          label="Tempo pulse color"
          value={p.boardFX.beatColor}
          onChange={(v) =>
            edit("Tempo color", (p) => {
              p.boardFX.beatColor = v;
            })
          }
        />
        {(
          [
            "shimmer",
            "shimmerSpeed",
            "bpm",
            "beatStrength",
            "beatDecay",
            "rim",
            "rimSpeed",
            "sweep",
            "sweepSpeed",
            "vignette",
            "vignetteSpeed",
          ] as const
        ).map((k) => (
          <Range
            key={k}
            label={
              {
                shimmer: "Lighting shimmer",
                shimmerSpeed: "Shimmer speed",
                introDuration: "Intro duration",
                introZoom: "Intro starting size",
                introTurn: "Intro turn degrees",
                bpm: "Pulse BPM",
                beatStrength: "Pulse strength",
                beatDecay: "Pulse decay",
                rim: "Breathing rim light",
                rimSpeed: "Rim breathing speed",
                sweep: "Light sweep strength",
                sweepSpeed: "Light sweep speed",
                vignette: "Vignette breathing",
                vignetteSpeed: "Vignette speed",
              }[k]
            }
            value={p.boardFX[k]}
            resetValue={blank().boardFX[k]}
            min={
              k === "beatDecay"
                ? 0.05
                : k === "bpm"
                  ? 20
                  : k.includes("Speed")
                    ? 0.05
                    : 0
            }
            max={
              k === "bpm"
                ? 240
                : k.includes("Speed")
                  ? 3
                  : k === "shimmer"
                    ? 0.2
                    : k === "sweep"
                      ? 0.3
                      : k === "beatDecay"
                        ? 2
                        : 0.5
            }
            onChange={(v) =>
              edit("Board " + k, (p) => {
                p.boardFX[k] = v;
              })
            }
          />
        ))}
      </Section>
    </>
  );
}
