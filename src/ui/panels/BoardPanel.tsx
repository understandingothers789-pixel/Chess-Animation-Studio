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
export function BoardPanel(q: PanelProps) {
  const p = q.project,
    edit = q.edit;
  return (
    <>
      <Section
        title="Board & pieces"
        onReset={() =>
          edit("Reset style", (p) => {
            p.style = blank().style;
          })
        }
      >
        <Select
          label="Piece artwork"
          value={p.style.pieceSet}
          options={[
            ["merida", "Nibbler (Merida)"],
            ["sculpted", "Sculpted 3D"],
            ["neo", "Neo"],
            ["cburnett", "Lichess (Cburnett)"],
          ]}
          onChange={(v) =>
            edit("Piece artwork", (p) => {
              p.style.pieceSet = v;
            })
          }
        />
        <p className="hint">
          {p.style.pieceSet === "sculpted"
            ? "Solid figures with rounded surfaces. Turn around the X or Y axis to show depth."
            : "Illustrated faces with contoured sides that deepen during X- and Y-axis turns."}
        </p>
        {p.style.pieceSet !== "sculpted" && (
          <Toggle
            label="Solid sides on turns"
            checked={p.style.solidPieceSides}
            onChange={(value) =>
              edit("Solid sides on turns", (p) => {
                p.style.solidPieceSides = value;
              })
            }
          />
        )}
        {(["light", "dark", "rim", "accent"] as const).map((k) => (
          <Color
            label={
              {
                light: "Light squares",
                dark: "Dark squares",
                rim: "Board rim",
                background: "Background",
                accent: "Accent",
              }[k]
            }
            key={k}
            value={p.style[k]}
            onChange={(v) =>
              edit("Color " + k, (p) => {
                p.style[k] = v;
              })
            }
          />
        ))}
        <Select
          label="Orientation"
          value={p.style.orientation}
          options={["white", "black"]}
          onChange={(v) =>
            edit("Orientation", (p) => {
              p.style.orientation = v;
            })
          }
        />
        <Toggle
          label="Board coordinates"
          checked={p.style.coordinates}
          onChange={(v) =>
            edit("Coordinates", (p) => {
              p.style.coordinates = v;
            })
          }
        />
      </Section>
    </>
  );
}
