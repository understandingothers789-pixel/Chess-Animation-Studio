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
export function BadgeArtworkPanel(q: PanelProps) {
  const p = q.project,
    edit = q.edit;
  const [badgeKind, setBadgeKind] = useState("brilliant");
  return (
    <>
      <Section title="Badge artwork">
        <Select
          label="Badge to replace"
          value={badgeKind}
          options={badgeNames}
          onChange={setBadgeKind}
        />
        <button
          className="wide"
          onClick={() =>
            q.run(() => q.importAsset("image", "badge", badgeKind))
          }
        >
          Import badge image
        </button>
        <button
          className="wide"
          onClick={() =>
            q.run(async () => {
              const pack = await window.studio.badgePack();
              if (pack)
                edit("Import badge pack", (p) => {
                  p.assets.push(...pack.assets);
                  Object.assign(p.badgeAssets, pack.mapping);
                });
            })
          }
        >
          Import badge pack manifest
        </button>
        <button
          className="wide"
          onClick={() =>
            edit("Reset badge artwork", (p) => {
              delete p.badgeAssets[badgeKind];
            })
          }
        >
          Use built-in badge
        </button>
        <p className="hint">
          Pack source and usage guidance are retained with the local assets.
        </p>
      </Section>
    </>
  );
}
