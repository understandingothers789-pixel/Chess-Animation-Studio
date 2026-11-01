import { settingHelp } from "./help";
import { useState } from "react";
import {
  effect,
  moveLightDefaults,
  beatSpotlightDefaults,
  camera,
  channels,
  presets,
  badgeNames,
  type Project,
  type Effect,
  type Channel,
  type Preset,
} from "../core/project";
import type { Edit } from "./state";
import { Section, Range, Select, Toggle, Color, ScrubNumber } from "./controls";
export const presetLabels: Record<Preset, string> = {
  slide: "Clean slide",
  soft: "Soft landing",
  spin: "Thin-edge spin",
  flip: "Capture flip",
  sway: "Slow sway",
  "sway-half": "Half sway",
  hop: "Soft hop",
  dramatic: "Dramatic landing",
  capture: "Capture impact",
  finale: "Final move boom",
};
export function Inspector({
  project,
  index,
  checked,
  edit,
  onCopy,
  onPaste,
}: {
  project: Project;
  index: number;
  checked: Set<string>;
  edit: Edit;
  onCopy: () => void;
  onPaste: () => void;
}) {
  const [tab, setTab] = useState("motion"),
    [channel, setChannel] = useState<Channel>("rz"),
    [presetName, setPresetName] = useState("");
  const move = project.moves[index];
  if (!move)
    return (
      <aside className="inspector empty">
        <p>Select a move to shape its animation.</p>
      </aside>
    );
  const targets = (p: Project) =>
    checked.size ? p.moves.filter((m) => checked.has(m.id)) : [p.moves[index]];
  const each = (p: Project, fn: (e: Effect) => void) =>
    targets(p).forEach((m) => fn(m.effect));
  const resetFields = (keys: (keyof Effect)[]) =>
    edit("Reset " + keys.join(","), (p) =>
      each(p, (e) => {
        const defaults = effect(e.preset);
        for (const key of keys)
          (e as any)[key] = structuredClone(defaults[key]);
      }),
    );
  const e = move.effect,
    change = <K extends keyof Effect>(key: K, value: Effect[K]) =>
      edit(String(key), (p) => {
        each(p, (e) => {
          e[key] = structuredClone(value);
        });
      });
  const range = (
    key:
      | "duration"
      | "delay"
      | "hold"
      | "intensity"
      | "rotation"
      | "sway"
      | "cycles"
      | "hop"
      | "path"
      | "overshoot"
      | "scale"
      | "peak"
      | "landing"
      | "settle",
    label: string,
    min: number,
    max: number,
    step = 0.01,
    unit = "",
  ) => (
    <Range
      key={key}
      label={label}
      value={e[key]}
      onReset={() => resetFields([key])}
      onChange={(v) => change(key, v)}
      min={min}
      max={max}
      step={step}
      unit={unit}
    />
  );
  const capture = <K extends keyof Effect["capture"]>(
    k: K,
    v: Effect["capture"][K],
  ) =>
    edit("Capture " + k, (p) => {
      each(p, (e) => {
        e.capture[k] = v;
      });
    });
  const look = <K extends keyof Effect["highlight"]>(
    k: K,
    v: Effect["highlight"][K],
  ) =>
    edit("Highlight " + k, (p) => {
      each(p, (e) => {
        e.highlight[k] = v;
      });
    });
  const badge = <K extends keyof Effect["badge"]>(
    k: K,
    v: Effect["badge"][K],
  ) =>
    edit("Badge " + k, (p) => {
      each(p, (e) => {
        e.badge[k] = v;
      });
    });
  return (
    <aside className="inspector">
      <div className="inspector-title">
        <span className="eyebrow">SELECTED MOVE · {index + 1}</span>
        <h2>
          {move.san}
          <small>{presetLabels[e.preset]}</small>
        </h2>
        <p className="hint">
          {checked.size || 1} move{checked.size > 1 ? "s" : ""} selected ·
          Motion, Camera and Look changes apply to the selection. Keyframe-point
          edits use the active move.
        </p>
        <div className="button-row">
          <button
            onClick={onCopy}
            title="Copy all animation, camera and Look settings from this move"
          >
            Copy
          </button>
          <button
            onClick={onPaste}
            title="Paste the copied effect onto the selected moves"
          >
            Paste
          </button>
          <button onClick={() => change("keys", {})}>Clear keys</button>
        </div>
      </div>
      <nav className="tabs">
        {["motion", "camera", "look", "keys"].map((t) => (
          <button
            className={tab === t ? "active" : ""}
            key={t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </nav>
      <div className="inspector-content">
        <p className="inspector-guide">
          {
            (
              {
                motion: "How the piece moves and lands.",
                camera: "Framing and camera movement for this move.",
                look: "Highlights, badges and Beat spotlight — the music-synced zoom effect.",
                keys: "Advanced: animate individual values over the move.",
              } as Record<string, string>
            )[tab]
          }
        </p>
        {tab === "motion" && (
          <>
            <Section
              title="Movement"
              onReset={() =>
                resetFields([
                  "duration",
                  "intensity",
                  "easing",
                  "axis",
                  "rotation",
                  "sway",
                  "cycles",
                  "hop",
                  "scale",
                  "path",
                  "overshoot",
                ])
              }
            >
              <Select
                label="Move preset"
                value={e.preset}
                options={presets.map((v) => [v, presetLabels[v]] as const)}
                onChange={(v) =>
                  edit("Apply preset", (p) => {
                    for (const m of targets(p)) {
                      m.effect = {
                        ...effect(v),
                        badge: m.effect.badge,
                        light: m.effect.light,
                        jam: m.effect.jam,
                        cameras: m.effect.cameras,
                      };
                    }
                  })
                }
              />
              {range("duration", "Duration", 0.2, 8, 0.05, "s")}
              {range("intensity", "Intensity", 0, 2)}
              <Select
                label="Easing"
                value={e.easing}
                options={[
                  "smooth",
                  "linear",
                  "soft",
                  "accelerate",
                  "bounce",
                  "overshoot",
                ]}
                onChange={(v) => change("easing", v)}
              />
              <Select
                label="Turn axis"
                value={e.axis}
                options={["x", "y", "z"]}
                onChange={(v) => change("axis", v)}
              />
              {range("rotation", "Rotation", -720, 720, 5, "°")}
              {range("sway", "Sway angle", 0, 45, 1, "°")}
              {range("cycles", "Sway cycles", 0.5, 6, 0.5)}
              {range("hop", "Hop height", 0, 3)}
              {range("scale", "Maximum size", 1, 3)}
              {range("path", "Curved path", -3, 3)}
              {range("overshoot", "Overshoot", 0, 0.3)}
            </Section>
            <Section
              title="Timing & landing"
              onReset={() =>
                resetFields([
                  "delay",
                  "hold",
                  "landing",
                  "settle",
                  "peak",
                  "locked",
                  "landingBeat",
                ])
              }
            >
              {range("delay", "Departure delay", 0, 10, 0.05, "s")}
              {range("hold", "Hold after move", 0, 10, 0.05, "s")}
              {range("landing", "Landing phase", 0.25, 0.98)}
              {range("settle", "Settle window", 0.01, 0.5)}
              {range("peak", "Size peak phase", 0.1, 0.95)}
              <Toggle
                label="Lock timing"
                checked={e.locked}
                onChange={(v) => change("locked", v)}
              />
              <Select
                label="Landing beat"
                value={e.landingBeat ?? ""}
                options={[
                  ["", "Automatic / none"],
                  ...project.beats
                    .filter((b) => b.enabled)
                    .map(
                      (b) =>
                        [
                          b.id,
                          `${b.time.toFixed(2)}s${b.accent ? " · accent" : ""}`,
                        ] as [string, string],
                    ),
                ]}
                onChange={(v) => change("landingBeat", v || null)}
              />
            </Section>
            <Section
              title="Capture impact"
              open={e.preset === "capture" || move.san.includes("x")}
              onReset={() => resetFields(["capture"])}
            >
              {(
                [
                  "grow",
                  "expansion",
                  "returnTime",
                  "impact",
                  "exitAt",
                  "glow",
                  "radius",
                ] as const
              ).map((k) => (
                <Range
                  key={k}
                  label={
                    {
                      grow: "Capture size",
                      expansion: "Expansion window",
                      returnTime: "Return window",
                      impact: "Impact phase",
                      exitAt: "Captured exit phase",
                      glow: "Glow strength",
                      radius: "Glow radius",
                    }[k]
                  }
                  value={e.capture[k]}
                  onReset={() =>
                    edit("Reset capture " + k, (p) =>
                      each(p, (v) => {
                        v.capture[k] = effect(v.preset).capture[k];
                      }),
                    )
                  }
                  onChange={(v) => capture(k, v)}
                  min={
                    k === "grow"
                      ? 1
                      : k === "radius"
                        ? 0.3
                        : k === "impact"
                          ? 0.2
                          : k === "expansion"
                            ? 0.02
                            : k === "returnTime"
                              ? 0.05
                              : 0
                  }
                  max={
                    k === "grow" || k === "radius"
                      ? 3
                      : k === "glow"
                        ? 2
                        : k === "expansion"
                          ? 0.5
                          : k === "returnTime"
                            ? 0.8
                            : k === "impact"
                              ? 0.95
                              : 1
                  }
                />
              ))}
              <Color
                label="Capture glow"
                value={e.capture.color}
                onChange={(v) => capture("color", v)}
              />
              <Select
                label="Captured piece exit"
                value={e.capture.exit}
                options={[
                  ["dust", "Crumble into dust"],
                  ["fade", "Fade"],
                  ["shrink", "Shrink"],
                  ["drop", "Drop"],
                ]}
                onChange={(v) => capture("exit", v)}
              />
              {e.capture.exit === "dust" && (
                <>
                  <Range
                    label="Dust duration"
                    value={e.capture.dustDuration}
                    min={0.15}
                    max={1.5}
                    step={0.05}
                    resetValue={0.7}
                    onChange={(v) => capture("dustDuration", v)}
                    unit="s"
                  />
                  <Range
                    label="Dust amount"
                    value={e.capture.dustAmount}
                    min={16}
                    max={256}
                    step={1}
                    resetValue={128}
                    onChange={(v) => capture("dustAmount", v)}
                  />
                  <Range
                    label="Dust spread"
                    value={e.capture.dustSpread}
                    min={0.1}
                    max={2}
                    step={0.05}
                    resetValue={0.85}
                    onChange={(v) => capture("dustSpread", v)}
                  />
                  <Range
                    label="Dust fragment size"
                    value={e.capture.dustSize}
                    min={0.015}
                    max={0.15}
                    step={0.005}
                    resetValue={0.055}
                    onChange={(v) => capture("dustSize", v)}
                  />
                </>
              )}
              <Toggle
                label="Impact particles"
                checked={e.capture.particles}
                onChange={(v) => capture("particles", v)}
              />
            </Section>
            <label className="text-field">
              Preset name
              <input
                title={settingHelp("Preset name")}
                aria-description={settingHelp("Preset name")}
                aria-label="Preset name"
                value={presetName}
                maxLength={100}
                onChange={(e) => setPresetName(e.target.value)}
              />
            </label>
            <button
              className="wide"
              disabled={!presetName.trim()}
              onClick={() => {
                edit("Save preset", (p) => {
                  p.presets.push({
                    name: presetName.trim(),
                    effect: structuredClone(e),
                  });
                });
                setPresetName("");
              }}
            >
              Save as reusable preset
            </button>
          </>
        )}
        {tab === "camera" &&
          (() => {
            const c = e.cameras[project.format] ?? camera();
            const changeCamera = (key: keyof typeof c, value: unknown) =>
              edit("Camera " + key, (p) => {
                each(p, (e) => {
                  e.cameras[p.format] = {
                    ...(e.cameras[p.format] ?? camera()),
                    [key]: value,
                  };
                });
              });
            return (
              <Section
                title={`Camera · ${project.format}`}
                onReset={() =>
                  edit("Reset camera", (p) =>
                    each(p, (e) => {
                      delete e.cameras[p.format];
                    }),
                  )
                }
              >
                <Select
                  label="Camera framing"
                  value={c.mode}
                  options={[
                    ["route", "Include source & destination"],
                    ["follow", "Follow moving piece"],
                    ["manual", "Manual framing"],
                    ["full", "Full board"],
                  ]}
                  onChange={(v) => changeCamera("mode", v)}
                />
                {(
                  [
                    "x",
                    "y",
                    "zoom",
                    "tilt",
                    "rotation",
                    "padding",
                    "transition",
                  ] as const
                ).map((k) => (
                  <Range
                    key={k}
                    label={
                      {
                        x: "Pan X",
                        y: "Pan Y",
                        zoom: "Camera zoom",
                        tilt: "Camera tilt",
                        rotation: "Camera roll",
                        padding: "Framing padding",
                        transition: "Camera transition",
                      }[k]
                    }
                    value={c[k]}
                    resetValue={camera()[k]}
                    min={
                      k === "zoom"
                        ? 0.6
                        : k === "tilt"
                          ? -25
                          : k === "rotation"
                            ? -35
                            : k === "padding"
                              ? 0
                              : k === "transition"
                                ? 0.05
                                : -10
                    }
                    max={
                      k === "zoom"
                        ? 3
                        : k === "tilt"
                          ? 25
                          : k === "rotation"
                            ? 35
                            : k === "padding"
                              ? 2
                              : k === "transition"
                                ? 3
                                : 10
                    }
                    onChange={(v) => changeCamera(k, v)}
                  />
                ))}
                <p className="hint">
                  Framing is saved separately for each output format.
                </p>
              </Section>
            );
          })()}
        {tab === "look" && (
          <>
            <Section
              title="Beat spotlight transition"
              onReset={() => resetFields(["jam"])}
            >
              <button
                className="wide"
                title="Hold on the moved piece and add beat-synced zoom, rocking, glow, colors and sparkles to every selected move."
                onClick={() =>
                  change("jam", { ...beatSpotlightDefaults, enabled: true })
                }
              >
                Apply beat spotlight
              </button>
              <Toggle
                label="Beat spotlight"
                checked={e.jam.enabled}
                onChange={(v) =>
                  edit("Beat spotlight", (p) =>
                    each(p, (e) => {
                      e.jam.enabled = v;
                    }),
                  )
                }
              />
              <p className="hint">
                Runs after the move finishes. Reserves{" "}
                {e.jam.duration.toFixed(1)} seconds before the next move when
                enabled; disabling it restores the ordinary hold.
              </p>
              {e.jam.enabled && (
                <>
                  <Select
                    label="Beat zoom rhythm"
                    value={e.jam.rhythm}
                    options={[
                      ["alternate", "In / out on alternating beats"],
                      ["punch", "Punch in on each beat"],
                    ]}
                    onChange={(v) =>
                      edit("Spotlight rhythm", (p) =>
                        each(p, (e) => {
                          e.jam.rhythm = v;
                        }),
                      )
                    }
                  />
                  <Select
                    label="Spotlight beat source"
                    value={e.jam.clock}
                    options={[
                      ["auto", "Music markers, else BPM"],
                      ["bpm", "BPM grid"],
                    ]}
                    onChange={(v) =>
                      edit("Spotlight clock", (p) =>
                        each(p, (e) => {
                          e.jam.clock = v;
                        }),
                      )
                    }
                  />
                  <Color
                    label="Spotlight primary color"
                    value={e.jam.primary}
                    onChange={(v) =>
                      edit("Spotlight color", (p) =>
                        each(p, (e) => {
                          e.jam.primary = v;
                        }),
                      )
                    }
                  />
                  <Color
                    label="Spotlight secondary color"
                    value={e.jam.secondary}
                    onChange={(v) =>
                      edit("Spotlight color 2", (p) =>
                        each(p, (e) => {
                          e.jam.secondary = v;
                        }),
                      )
                    }
                  />
                  {(
                    [
                      "duration",
                      "bpm",
                      "offset",
                      "zoom",
                      "roll",
                      "focus",
                      "colorEvery",
                      "colorStrength",
                      "glow",
                      "particles",
                      "shake",
                      "blur",
                      "flash",
                      "desaturate",
                      "vignette",
                    ] as const
                  ).map((k) => (
                    <Range
                      key={k}
                      label={
                        {
                          duration: "Spotlight duration",
                          bpm: "Spotlight BPM",
                          offset: "Spotlight beat offset",
                          zoom: "Beat zoom amount",
                          roll: "Beat camera rock",
                          focus: "Spotlight focus",
                          colorEvery: "Beats per color",
                          colorStrength: "Beat color strength",
                          glow: "Spotlight glow",
                          particles: "Spotlight sparkles",
                          shake: "Beat shake",
                          blur: "Beat zoom blur",
                          flash: "Beat light flash",
                          desaturate: "Spotlight desaturation",
                          vignette: "Spotlight vignette",
                        }[k]
                      }
                      value={e.jam[k]}
                      min={
                        k === "duration"
                          ? 0.6
                          : k === "bpm"
                            ? 40
                            : k === "offset"
                              ? -1
                              : k === "colorEvery"
                                ? 1
                                : 0
                      }
                      max={
                        k === "duration" || k === "colorEvery"
                          ? 8
                          : k === "bpm"
                            ? 300
                            : k === "zoom"
                              ? 2
                              : k === "roll"
                                ? 30
                                : k === "particles"
                                  ? 128
                                  : k === "colorStrength"
                                    ? 0.75
                                    : k === "glow"
                                      ? 1.5
                                      : k === "shake"
                                        ? 0.4
                                        : k === "flash"
                                          ? 0.65
                                          : k === "vignette"
                                            ? 0.8
                                            : 1
                      }
                      step={
                        ["bpm", "colorEvery", "particles"].includes(k)
                          ? 1
                          : 0.01
                      }
                      resetValue={beatSpotlightDefaults[k]}
                      unit={
                        k === "duration" || k === "offset"
                          ? "s"
                          : k === "roll"
                            ? "°"
                            : k === "bpm"
                              ? "BPM"
                              : ""
                      }
                      onChange={(v) =>
                        edit("Spotlight " + k, (p) =>
                          each(p, (e) => {
                            e.jam[k] = v;
                          }),
                        )
                      }
                    />
                  ))}
                </>
              )}
            </Section>
            <Section
              title="Move light & flicker"
              onReset={() => resetFields(["light"])}
            >
              <button
                className="wide"
                title="Apply the red light wash and restrained flicker to every selected move."
                onClick={() =>
                  change("light", { ...moveLightDefaults, enabled: true })
                }
              >
                Apply red flicker
              </button>
              <Toggle
                label="Move light wash"
                checked={e.light.enabled}
                onChange={(v) =>
                  edit("Move light enabled", (p) =>
                    each(p, (e) => {
                      e.light.enabled = v;
                    }),
                  )
                }
              />
              <Color
                label="Move light color"
                value={e.light.color}
                onChange={(v) =>
                  edit("Move light color", (p) =>
                    each(p, (e) => {
                      e.light.color = v;
                    }),
                  )
                }
              />
              <Toggle
                label="Match move highlights"
                checked={e.light.highlights}
                onChange={(v) =>
                  edit("Move light highlights", (p) =>
                    each(p, (e) => {
                      e.light.highlights = v;
                    }),
                  )
                }
              />
              {(
                [
                  "strength",
                  "flicker",
                  "speed",
                  "fadeIn",
                  "hold",
                  "fadeOut",
                ] as const
              ).map((k) => (
                <Range
                  key={k}
                  label={
                    {
                      strength: "Move light strength",
                      flicker: "Move light flicker",
                      speed: "Move flicker speed",
                      fadeIn: "Move light fade in",
                      hold: "Move light hold",
                      fadeOut: "Move light fade out",
                    }[k]
                  }
                  value={e.light[k]}
                  min={k === "speed" ? 0.2 : 0}
                  max={
                    k === "strength"
                      ? 0.65
                      : k === "flicker"
                        ? 0.8
                        : k === "speed"
                          ? 10
                          : 2
                  }
                  step={0.01}
                  resetValue={moveLightDefaults[k]}
                  unit={
                    k === "speed"
                      ? " Hz"
                      : ["fadeIn", "hold", "fadeOut"].includes(k)
                        ? "s"
                        : ""
                  }
                  onChange={(v) =>
                    edit("Move light " + k, (p) =>
                      each(p, (e) => {
                        e.light[k] = v;
                      }),
                    )
                  }
                />
              ))}
            </Section>
            <Section
              title="Highlights & trail"
              onReset={() => resetFields(["highlight"])}
            >
              {(
                [
                  "showSource",
                  "showDestination",
                  "showPath",
                  "trail",
                  "persist",
                ] as const
              ).map((k) => (
                <Toggle
                  key={k}
                  label={
                    {
                      showSource: "Source square",
                      showDestination: "Destination square",
                      showPath: "Route squares",
                      trail: "Motion trail",
                      persist: "Persist after landing",
                    }[k]
                  }
                  checked={e.highlight[k]}
                  onChange={(v) => look(k, v)}
                />
              ))}
              {(["source", "destination", "path"] as const).map((k) => (
                <Color
                  key={k}
                  label={k + " color"}
                  value={e.highlight[k]}
                  onChange={(v) => look(k, v)}
                />
              ))}
              <Range
                label="Trail width"
                value={e.highlight.width}
                onReset={() =>
                  edit("Reset highlight width", (p) =>
                    each(p, (v) => {
                      v.highlight.width = effect(v.preset).highlight.width;
                    }),
                  )
                }
                min={0.02}
                max={0.6}
                onChange={(v) => look("width", v)}
              />
              <Range
                label="Highlight glow"
                value={e.highlight.glow}
                onReset={() =>
                  edit("Reset highlight glow", (p) =>
                    each(p, (v) => {
                      v.highlight.glow = effect(v.preset).highlight.glow;
                    }),
                  )
                }
                min={0}
                max={1}
                onChange={(v) => look("glow", v)}
              />
              <Range
                label="Highlight opacity"
                value={e.highlight.opacity}
                onReset={() =>
                  edit("Reset highlight opacity", (p) =>
                    each(p, (v) => {
                      v.highlight.opacity = effect(v.preset).highlight.opacity;
                    }),
                  )
                }
                min={0}
                max={1}
                onChange={(v) => look("opacity", v)}
              />
              <Range
                label="Highlight reveal phase"
                value={e.highlight.reveal}
                onReset={() =>
                  edit("Reset highlight reveal", (p) =>
                    each(p, (v) => {
                      v.highlight.reveal = effect(v.preset).highlight.reveal;
                    }),
                  )
                }
                min={0}
                max={0.9}
                onChange={(v) => look("reveal", v)}
              />
              <Range
                label="Highlight fade"
                value={e.highlight.fade}
                onReset={() =>
                  edit("Reset highlight fade", (p) =>
                    each(p, (v) => {
                      v.highlight.fade = effect(v.preset).highlight.fade;
                    }),
                  )
                }
                min={0.02}
                max={2}
                onChange={(v) => look("fade", v)}
              />
            </Section>
            <Section title="Move badge" onReset={() => resetFields(["badge"])}>
              <Select
                label="Badge override"
                value={e.badge.manual ?? "auto"}
                options={[
                  ["auto", "Automatic suggestion"],
                  ["none", "No badge"],
                  ...badgeNames.map((v) => [v, v] as [string, string]),
                ]}
                onChange={(v) =>
                  badge(
                    "manual",
                    v === "auto" ? null : (v as Effect["badge"]["manual"]),
                  )
                }
              />
              <label className="text-field">
                Custom badge text
                <input
                  title={settingHelp("Custom badge text")}
                  aria-description={settingHelp("Custom badge text")}
                  aria-label={"Custom badge text"}
                  value={e.badge.text}
                  maxLength={12}
                  onChange={(v) => badge("text", v.target.value)}
                />
              </label>
              {(
                [
                  "size",
                  "opacity",
                  "offsetX",
                  "offsetY",
                  "start",
                  "end",
                  "glow",
                ] as const
              ).map((k) => (
                <Range
                  key={k}
                  label={
                    {
                      size: "Badge size",
                      opacity: "Badge opacity",
                      offsetX: "Badge offset X",
                      offsetY: "Badge offset Y",
                      start: "Badge entry phase",
                      end: "Badge hold after move",
                      glow: "Badge glow",
                    }[k]
                  }
                  value={e.badge[k]}
                  onReset={() =>
                    edit("Reset badge " + k, (p) =>
                      each(p, (v) => {
                        v.badge[k] = effect(v.preset).badge[k];
                      }),
                    )
                  }
                  min={k === "size" ? 0.2 : k.startsWith("offset") ? -2 : 0}
                  max={
                    k === "size"
                      ? 1.5
                      : k.startsWith("offset")
                        ? 2
                        : k === "end"
                          ? 3
                          : 1
                  }
                  onChange={(v) => badge(k, v)}
                />
              ))}
              <Select
                label="Badge entry"
                value={e.badge.entry}
                options={["pop", "fade", "rise"]}
                onChange={(v) => badge("entry", v)}
              />
              <Toggle
                label="Expanding ring"
                checked={e.badge.ring}
                onChange={(v) => badge("ring", v)}
              />
              <p className="hint">
                Manual choices always override analysis suggestions.
              </p>
            </Section>
          </>
        )}
        {tab === "keys" && (
          <Section
            title="Normalized keyframes"
            onReset={() => resetFields(["keys"])}
          >
            <p className="hint">
              Key times run from 0 to 1 within this move. Duration edits
              preserve the curve. Rotation values use degrees; positions use
              board squares.
            </p>
            <Select
              label="Keyframe channel"
              value={channel}
              options={channels}
              onChange={setChannel}
            />
            {(e.keys[channel] ?? []).map((k, i) => (
              <div className="key-row" key={i}>
                <ScrubNumber
                  title={settingHelp(`Key ${i + 1} time`)}
                  aria-description={settingHelp(`Key ${i + 1} time`)}
                  aria-label={`Key ${i + 1} time`}
                  min={0}
                  max={1}
                  step={0.01}
                  value={k.at}
                  onValueChange={(n) =>
                    edit("Key time", (p) => {
                      p.moves[index].effect.keys[channel]![i].at = n;
                    })
                  }
                />
                <ScrubNumber
                  title={settingHelp(`Key ${i + 1} value`)}
                  aria-description={settingHelp(`Key ${i + 1} value`)}
                  aria-label={`Key ${i + 1} value`}
                  min={-10000}
                  max={10000}
                  step={0.1}
                  value={k.value}
                  onValueChange={(n) =>
                    edit("Key value", (p) => {
                      p.moves[index].effect.keys[channel]![i].value = n;
                    })
                  }
                />
                <select
                  title={settingHelp(`Key ${i + 1} easing`)}
                  aria-description={settingHelp(`Key ${i + 1} easing`)}
                  aria-label={`Key ${i + 1} easing`}
                  value={k.ease}
                  onChange={(v) =>
                    edit("Key easing", (p) => {
                      p.moves[index].effect.keys[channel]![i].ease = v.target
                        .value as "smooth";
                    })
                  }
                >
                  {["smooth", "linear", "soft", "accelerate"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
                <button
                  aria-label="Delete key"
                  onClick={() =>
                    edit("Delete key", (p) => {
                      p.moves[index].effect.keys[channel]!.splice(i, 1);
                    })
                  }
                >
                  ×
                </button>
              </div>
            ))}
            <button
              className="wide"
              onClick={() =>
                edit("Add key", (p) => {
                  const keys = (p.moves[index].effect.keys[channel] ??= []);
                  keys.push({
                    at: keys.length ? Math.min(1, keys.at(-1)!.at + 0.25) : 0,
                    value:
                      channel === "scale" ||
                      channel === "opacity" ||
                      channel === "cameraZoom"
                        ? 1
                        : 0,
                    ease: "smooth",
                  });
                })
              }
            >
              + Add keyframe
            </button>
            <button
              className="wide secondary"
              onClick={() =>
                edit("Reset curve", (p) => {
                  delete p.moves[index].effect.keys[channel];
                })
              }
            >
              Reset this curve
            </button>
          </Section>
        )}
      </div>
    </aside>
  );
}
