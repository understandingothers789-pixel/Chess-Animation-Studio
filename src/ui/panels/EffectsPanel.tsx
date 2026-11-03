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
export function EffectsPanel(q: PanelProps) {
  const p = q.project,
    edit = q.edit;
  return (
    <>
      <Section
        title="Cinematic Captures"
        status={p.cinematic.enabled ? "Enabled" : "Off"}
        onReset={() =>
          edit("Reset cinematic captures", (p) => {
            p.cinematic = blank().cinematic;
          })
        }
      >
        <Toggle
          label="Enable cinematic captures"
          checked={p.cinematic.enabled}
          onChange={(v) =>
            edit("Cinematic captures", (p) => {
              p.cinematic.enabled = v;
            })
          }
        />
        <Select
          label="Capture cinema preset"
          value=""
          options={[
            ["", "Choose preset"],
            ...["Subtle", "Cinematic", "Epic"].map(
              (v) => [v, v] as [string, string],
            ),
          ]}
          onChange={(v) => {
            if (v)
              edit("Capture cinema preset", (p) => {
                p.cinematic = {
                  ...cinematicPresets[v as keyof typeof cinematicPresets],
                };
              });
          }}
        />
        <Section title="Advanced cinema parameters" open={false}>
          {(["intensity", "amount", "size", "spread", "duration"] as const).map(
            (key) => (
              <Range
                key={key}
                label={`Cinema ${key}`}
                value={p.cinematic[key]}
                min={
                  key === "amount"
                    ? 8
                    : key === "size"
                      ? 0.01
                      : key === "duration"
                        ? 0.2
                        : key === "spread"
                          ? 0.1
                          : 0
                }
                max={
                  key === "amount"
                    ? 256
                    : key === "size"
                      ? 0.2
                      : key === "spread"
                        ? 4
                        : key === "duration"
                          ? 3
                          : 2
                }
                step={key === "amount" ? 1 : 0.01}
                onChange={(v) =>
                  edit("Cinematic captures", (p) => {
                    p.cinematic[key] = v;
                  })
                }
              />
            ),
          )}
        </Section>
        <Color
          label="Cinema color"
          value={p.cinematic.color}
          onChange={(v) =>
            edit("Cinema color", (p) => {
              p.cinematic.color = v;
            })
          }
        />
        {(["sparks", "fragments", "shockwaves", "dust"] as const).map((key) => (
          <Toggle
            key={key}
            label={`Cinema ${key}`}
            checked={p.cinematic[key]}
            onChange={(v) =>
              edit("Cinematic captures", (p) => {
                p.cinematic[key] = v;
              })
            }
          />
        ))}
      </Section>
      <Section
        title="Bloom & Glow"
        status={p.bloom.enabled ? "Enabled" : "Off"}
        onReset={() =>
          edit("Reset bloom", (p) => {
            p.bloom = blank().bloom;
          })
        }
      >
        <Toggle
          label="Enable bloom"
          checked={p.bloom.enabled}
          onChange={(v) =>
            edit("Bloom", (p) => {
              p.bloom.enabled = v;
            })
          }
        />
        {(["intensity", "threshold", "radius", "softness"] as const).map(
          (key) => (
            <Range
              key={key}
              label={`Bloom ${key}`}
              value={p.bloom[key]}
              min={key === "softness" ? 0.001 : 0}
              max={key === "radius" ? 8 : key === "intensity" ? 2 : 1}
              onChange={(v) =>
                edit("Bloom", (p) => {
                  p.bloom[key] = v;
                })
              }
            />
          ),
        )}
        {(["pieces", "captures", "highlights"] as const).map((key) => (
          <Toggle
            key={key}
            label={`Glow ${key}`}
            checked={p.bloom[key]}
            onChange={(v) =>
              edit("Bloom selection", (p) => {
                p.bloom[key] = v;
              })
            }
          />
        ))}
      </Section>
    </>
  );
}
