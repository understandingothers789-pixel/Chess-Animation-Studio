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
export function RainbowControls({
  label,
  settings,
  edit,
}: {
  label: string;
  settings: Project["pulse"]["rainbow"];
  edit: (fn: (v: Project["pulse"]["rainbow"]) => void) => void;
}) {
  return (
    <div className="rainbow-controls">
      <Toggle
        label={label + " rainbow"}
        checked={settings.enabled}
        onChange={(v) =>
          edit((r) => {
            r.enabled = v;
          })
        }
      />
      {settings.enabled && (
        <>
          <p className="hint">
            Choose the colors to cycle through. Uncheck a color to skip it; edit
            the swatch to choose a darker shade.
          </p>
          <Range
            label={label + " color cycle length"}
            value={settings.duration}
            min={1}
            max={120}
            step={1}
            unit="s"
            resetValue={rainbowDefaults.duration}
            onChange={(v) =>
              edit((r) => {
                r.duration = v;
              })
            }
          />
          {settings.colors.map((c, i) => (
            <div className="button-row" key={i}>
              <Toggle
                label={label + " color " + (i + 1) + " enabled"}
                checked={settings.active[i]}
                onChange={(v) =>
                  edit((r) => {
                    r.active[i] = v;
                  })
                }
              />
              <Color
                label={label + " color " + (i + 1)}
                value={c}
                onChange={(v) =>
                  edit((r) => {
                    r.colors[i] = v;
                  })
                }
              />
              <button
                title="Reset color"
                aria-label={"Reset " + label + " color " + (i + 1)}
                onClick={() =>
                  edit((r) => {
                    r.colors[i] = rainbowDefaults.colors[i];
                  })
                }
              >
                ↺
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
