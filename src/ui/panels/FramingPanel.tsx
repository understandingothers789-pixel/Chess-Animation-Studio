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
export function FramingPanel(q: PanelProps) {
  const p = q.project,
    edit = q.edit;
  const layout = p.layouts[p.format];
  return (
    <>
      <Select
        label="Output format"
        value={p.format}
        options={formats}
        onChange={(v) =>
          edit("Output format", (p) => {
            p.format = v;
          })
        }
      />
      <Color
        label="Background color"
        value={p.style.background}
        onChange={(v) =>
          edit("Background color", (p) => {
            p.style.background = v;
          })
        }
      />
      <Section
        title={"Composition · " + p.format}
        onReset={() =>
          edit("Reset composition", (p) => {
            p.layouts[p.format] = blank().layouts[p.format];
          })
        }
      >
        <Select
          label="Background treatment"
          value={layout.background}
          options={["solid", "gradient", "particles", "image"]}
          onChange={(v) =>
            edit("Background treatment", (p) => {
              p.layouts[p.format].background = v;
              if (v === "particles") p.ambient.enabled = true;
            })
          }
        />
        <button
          className="wide"
          onClick={() => q.run(() => q.importAsset("image", "background"))}
        >
          Import background image
        </button>
        {(["x", "y", "zoom"] as const).map((k) => (
          <Range
            key={k}
            label={{ x: "Layout X", y: "Layout Y", zoom: "Layout zoom" }[k]}
            value={layout[k]}
            resetValue={k === "zoom" ? 1 : 0}
            min={k === "zoom" ? 0.6 : k === "y" ? -4 : -3}
            max={k === "zoom" ? 1.5 : k === "y" ? 4 : 3}
            onChange={(v) =>
              edit("Layout " + k, (p) => {
                p.layouts[p.format][k] = v;
              })
            }
          />
        ))}
        <p className="hint">
          Square-in-vertical keeps a square chess viewport. Layout Y positions
          it within the vertical canvas.
        </p>
      </Section>
      <Section
        title="Shorts framing"
        onReset={() =>
          edit("Reset Shorts framing", (p) => {
            p.shorts = blank().shorts;
          })
        }
      >
        <Toggle
          label="Shorts crop"
          checked={p.shorts.enabled}
          onChange={(v) =>
            edit("Shorts crop", (p) => {
              p.shorts.enabled = v;
              if (v) p.format = "vertical";
            })
          }
        />
        <Toggle
          label="Follow action in Shorts"
          checked={p.shorts.follow}
          onChange={(v) =>
            edit("Shorts tracking", (p) => {
              p.shorts.follow = v;
            })
          }
        />
        <Range
          label="Shorts tracking strength"
          value={p.shorts.tracking}
          min={0}
          max={1}
          step={0.01}
          resetValue={0.35}
          onChange={(v) =>
            edit("Shorts tracking strength", (p) => {
              p.shorts.tracking = v;
            })
          }
        />
        <Range
          label="Visible board width"
          value={p.shorts.width}
          min={4}
          max={8}
          step={0.1}
          unit=" squares"
          resetValue={6}
          onChange={(v) =>
            edit("Shorts width", (p) => {
              p.shorts.width = v;
            })
          }
        />
        <Range
          label="Shorts board height"
          value={p.shorts.height}
          min={0.55}
          max={1}
          step={0.01}
          resetValue={0.72}
          onChange={(v) =>
            edit("Shorts height", (p) => {
              p.shorts.height = v;
            })
          }
        />
        <Range
          label="Shorts board position"
          value={p.shorts.position}
          min={0}
          max={1}
          step={0.01}
          resetValue={0.5}
          onChange={(v) =>
            edit("Shorts position", (p) => {
              p.shorts.position = v;
            })
          }
        />
        <Color
          label="Shorts bar color"
          value={p.shorts.barColor}
          onChange={(v) =>
            edit("Shorts bars", (p) => {
              p.shorts.barColor = v;
            })
          }
        />
        <p className="hint">
          A portrait close-up that crops the outer files, with space above and
          below. Camera settings and the intro still apply. Background images
          apply to the other views.
        </p>
      </Section>
    </>
  );
}
