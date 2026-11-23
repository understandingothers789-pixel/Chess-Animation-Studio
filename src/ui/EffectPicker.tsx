import { channelNames } from "./keyframes/KeyframePanel";
import { useState } from "react";
import {
  effect,
  camera,
  type Project,
  type Effect,
  type Channel,
} from "../core/project";
import { applyPresetEffect, pasteSettings } from "../core/editing";
import type { Edit } from "./state";

export function EffectPicker({
  project: p,
  index,
  checked,
  edit,
  browse,
  inspect,
  global,
}: {
  project: Project;
  index: number;
  checked: Set<string>;
  edit: Edit;
  browse: () => void;
  inspect: (tab: string, section?: string) => void;
  global: () => void;
}) {
  const [open, setOpen] = useState(false),
    [query, search] = useState("");
  const move = p.moves[index];
  if (!move) return null;
  const ids = new Set(
    p.moves
      .filter((m) => (checked.size ? checked.has(m.id) : m.id === move.id))
      .map((m) => m.id),
  );
  const change = (label: string, fn: (e: Effect) => void, sculpted = false) =>
    edit(label, (draft) => {
      if (sculpted) draft.style.pieceSet = "sculpted";
      for (const m of draft.moves) if (ids.has(m.id)) fn(m.effect);
    });
  const sections: Record<string, string> = {
    "Piece flip": "Movement",
    "3D piece flip": "Movement",
    "After-effect rebound": "After effect",
    "After effect": "After effect",
    "Soft hop": "Movement",
    Movement: "Movement",
    "Beat zoom": "Beat spotlight transition",
    "Flip + smooth beat zoom": "Beat spotlight transition",
    "Capture dust": "Capture impact",
    "Light wash": "Move light & flicker",
    "Follow camera": `Camera · ${p.format}`,
    Camera: `Camera · ${p.format}`,
  };
  const items = [
    {
      name: "3D piece flip",
      tab: "move",
      sculpted: true,
      add: (e: Effect) => {
        Object.assign(
          e,
          applyPresetEffect(
            e,
            effect("somersault"),
            p.format,
            false,
            "movement",
            true,
            false,
          ),
        );
        e.axis = "x";
      },
    },
    {
      name: "After-effect rebound",
      tab: "move",
      add: (e: Effect) => {
        e.after.kind = "rebound";
      },
    },
    {
      name: "Piece flip",
      tab: "move",
      add: (e: Effect) =>
        Object.assign(e, applyPresetEffect(e, effect("somersault"), p.format)),
    },
    {
      name: "Soft hop",
      tab: "move",
      add: (e: Effect) =>
        Object.assign(e, applyPresetEffect(e, effect("hop"), p.format)),
    },
    {
      name: "Beat zoom",
      tab: "effects",
      add: (e: Effect) => {
        e.jam.enabled = true;
        e.jam.rhythm = "swell";
      },
    },
    {
      name: "Flip + smooth beat zoom",
      tab: "effects",
      add: (e: Effect) => {
        Object.assign(e, applyPresetEffect(e, effect("somersault"), p.format));
        e.jam.enabled = true;
        e.jam.rhythm = "swell";
        e.jam.start = "landing";
      },
    },
    {
      name: "Capture dust",
      tab: "effects",
      add: (e: Effect) => {
        e.capture.exit = "dust";
      },
    },
    {
      name: "Light wash",
      tab: "effects",
      add: (e: Effect) => {
        e.light.enabled = true;
      },
    },
    {
      name: "Follow camera",
      tab: "camera",
      add: (e: Effect) => {
        e.cameras[p.format] = { ...camera(), mode: "follow" };
      },
    },
  ];
  const active = [
    {
      name: "Movement",
      tab: "move",
      on: move.effect.preset !== "slide",
      reset: (e: Effect) =>
        Object.assign(
          e,
          pasteSettings(e, {
            source: effect("slide"),
            format: p.format,
            kind: "movement",
          }),
        ),
    },
    {
      name: "After effect",
      tab: "move",
      on: move.effect.after.kind !== "none",
      reset: (e: Effect) => {
        e.after.kind = "none";
      },
    },
    {
      name: "Beat zoom",
      tab: "effects",
      on: move.effect.jam.enabled,
      reset: (e: Effect) => {
        e.jam.enabled = false;
      },
    },
    {
      name: "Light wash",
      tab: "effects",
      on: move.effect.light.enabled,
      reset: (e: Effect) => {
        e.light.enabled = false;
      },
    },
    {
      name: "Capture dust",
      tab: "effects",
      on: move.effect.capture.exit === "dust",
      reset: (e: Effect) => {
        e.capture.exit = "fade";
      },
    },
    {
      name: "Camera",
      tab: "camera",
      on: !!move.effect.cameras[p.format],
      reset: (e: Effect) => {
        delete e.cameras[p.format];
      },
    },
  ];
  const keyed = Object.keys(move.effect.keys).filter(
    (k) => move.effect.keys[k as Channel]?.length,
  ) as Channel[];
  return (
    <div className="effect-picker">
      <button
        className="wide primary"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        Add animation or effect
      </button>
      {open && (
        <div role="region" aria-label="Add animation or effect">
          <input
            aria-label="Search effects"
            title="Filter the available animations and effects by name."
            aria-description="Filter the available animations and effects by name."
            placeholder="Search effects…"
            value={query}
            onChange={(e) => search(e.target.value)}
          />
          <p>
            {ids.size} move{ids.size === 1 ? "" : "s"} selected · timing locks
            respected
          </p>
          {items
            .filter((v) => v.name.toLowerCase().includes(query.toLowerCase()))
            .map((v) => (
              <button
                key={v.name}
                aria-label={v.name}
                aria-description={
                  v.sculpted
                    ? "Uses sculpted artwork for the whole board."
                    : undefined
                }
                onClick={() => {
                  change("Add " + v.name, v.add, v.sculpted);
                  inspect(v.tab, sections[v.name]);
                  setOpen(false);
                }}
              >
                {v.name}
                {v.sculpted && (
                  <small className="effect-picker-scope">
                    {" "}
                    · 3D artwork on the whole board
                  </small>
                )}
              </button>
            ))}
          <button onClick={browse}>Browse all animation presets</button>
          <button onClick={global}>
            Composition glow and cinematic captures
          </button>
        </div>
      )}
      <details>
        <summary>Active effects · selected move</summary>
        <label>
          <input
            type="checkbox"
            aria-label="Enable beat zoom"
            title="Enable or disable beat zoom for selected moves while preserving its settings and timing locks."
            aria-description="Enable or disable beat zoom for selected moves while preserving its settings and timing locks."
            checked={move.effect.jam.enabled}
            onChange={(event) =>
              change("Toggle beat zoom", (e) => {
                e.jam.enabled = event.target.checked;
              })
            }
          />{" "}
          Beat zoom
        </label>
        <label>
          <input
            type="checkbox"
            aria-label="Enable light wash"
            title="Enable or disable the selected moves light wash while keeping its settings."
            aria-description="Enable or disable the selected moves light wash while keeping its settings."
            checked={move.effect.light.enabled}
            onChange={(event) =>
              change("Toggle light wash", (e) => {
                e.light.enabled = event.target.checked;
              })
            }
          />{" "}
          Light wash
        </label>
        {active
          .filter((v) => v.on)
          .map((v) => (
            <div className="button-row" key={v.name}>
              <button onClick={() => inspect(v.tab, sections[v.name])}>
                {v.name}
              </button>
              <button
                aria-label={`Remove ${v.name}`}
                onClick={() => change("Remove " + v.name, v.reset)}
              >
                Remove
              </button>
              <button
                aria-label={`Reset ${v.name} settings`}
                onClick={() =>
                  change("Reset " + v.name, (e) => {
                    const defaults = effect(e.preset);
                    if (v.name === "Beat zoom") e.jam = defaults.jam;
                    else if (v.name === "Light wash") e.light = defaults.light;
                    else if (v.name === "Capture dust")
                      e.capture = defaults.capture;
                    else v.reset(e);
                  })
                }
              >
                Reset
              </button>
            </div>
          ))}
        <button onClick={global}>
          Composition effects · {p.bloom.enabled ? "Glow on" : "Glow off"} ·{" "}
          {p.cinematic.enabled ? "Cinema on" : "Cinema off"}
        </button>
      </details>
      {keyed.length > 0 && (
        <details className="key-override">
          <summary>
            Custom curves control {keyed.map((k) => channelNames[k]).join(", ")}
          </summary>
          <p>
            These channels override preset motion. Restoring a channel removes
            its custom keys from the selected moves.
          </p>
          <button onClick={() => inspect("keys")}>Edit custom curves</button>
          {keyed.map((k) => (
            <button
              key={k}
              onClick={() =>
                change("Restore preset " + k, (e) => {
                  delete e.keys[k];
                })
              }
            >
              Restore preset {channelNames[k]}
            </button>
          ))}
        </details>
      )}
    </div>
  );
}
