import { KeyframePanel } from "./keyframes/KeyframePanel";
import { CurveEditor } from "./keyframes/CurveEditor";
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
import { presetLabels } from "./presets/catalog";
export function Inspector({
  project,
  index,
  checked,
  edit,
  onCopy,
  onPaste,
  onPreview,
  previewing,
  previewDisabled,
  onGlobalEffects,
  seek,
}: {
  project: Project;
  index: number;
  checked: Set<string>;
  edit: Edit;
  onCopy: () => void;
  onPaste: () => void;
  onPreview: () => void;
  previewing: boolean;
  previewDisabled: boolean;
  onGlobalEffects: () => void;
  seek?: (time: number) => void;
}) {
  const [tab, setTab] = useState("move"),
    [channel, setChannel] = useState<Channel>("rz"),
    [presetName, setPresetName] = useState("");
  const move = project.moves[index];
  if (!move)
    return (
      <aside className="inspector empty">
        <p>Select a move to shape its animation.</p>
      </aside>
    );
  const validChecked = new Set(
    project.moves.filter((m) => checked.has(m.id)).map((m) => m.id),
  );
  const selectionCount = validChecked.size || 1;
  const targets = (p: Project) =>
    validChecked.size
      ? p.moves.filter((m) => validChecked.has(m.id))
      : [p.moves[index]];
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
  const e =
      validChecked.size && !validChecked.has(move.id)
        ? targets(project)[0].effect
        : move.effect,
    change = <K extends keyof Effect>(key: K, value: Effect[K]) =>
      edit(String(key), (p) => {
        each(p, (e) => {
          e[key] = structuredClone(value);
        });
      });
  const selectedEffects = targets(project).map((m) => m.effect);
  const mixed = (get: (v: Effect) => unknown) =>
    selectedEffects.some(
      (v) => JSON.stringify(get(v)) !== JSON.stringify(get(e)),
    );
  const effectStatus = (get: (v: Effect) => unknown) =>
    mixed(get)
      ? "Mixed"
      : JSON.stringify(get(e)) === JSON.stringify(get(effect(e.preset)))
        ? "Enabled"
        : "Customized";
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
      mixed={mixed((v) => v[key])}
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
          <small>{presetLabels[move.effect.preset]}</small>
        </h2>
        <p className="hint">
          {selectionCount} move{selectionCount > 1 ? "s" : ""} selected ·
          Animation, effects and camera use this selection. Keys use the active
          move.
        </p>
        <button
          className="wide primary"
          disabled={previewDisabled}
          onClick={onPreview}
        >
          {previewing ? "Restore timeline" : "Preview this move"}
        </button>
        {move.san.includes("x") && (
          <button className="wide" onClick={() => setTab("effects")}>
            Capture selected · Edit capture effects
          </button>
        )}
        <details className="secondary-actions">
          <summary>Copy / Paste</summary>
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
          </div>
        </details>
      </div>
      <nav className="tabs">
        {["move", "effects", "camera", "keys"].map((t) => (
          <button
            className={tab === t ? "active" : ""}
            aria-pressed={tab === t}
            data-tab={t}
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
                move: "How the piece moves and lands.",
                camera: "Framing and camera movement for this move.",
                effects:
                  "Capture impact, move lighting, highlights, badges and Beat spotlight — the music-synced zoom effect.",
                keys: "Advanced: animate individual values over the move.",
              } as Record<string, string>
            )[tab]
          }
        </p>
        {
          <div data-inspector-tab="move" hidden={tab !== "move"}>
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
                  mixed={mixed((v) => v.preset)}
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
                  mixed={mixed((v) => v.easing)}
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
                <Section title="Advanced movement" open={false}>
                  <Select
                    label="Turn axis"
                    value={e.axis}
                    mixed={mixed((v) => v.axis)}
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
                  mixed={mixed((v) => v.locked)}
                  onChange={(v) => change("locked", v)}
                />
                <Select
                  label="Landing beat"
                  value={e.landingBeat ?? ""}
                  mixed={mixed((v) => v.landingBeat)}
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
          </div>
        }
        {(() => {
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
            <div data-inspector-tab="camera" hidden={tab !== "camera"}>
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
                  mixed={mixed(
                    (v) => (v.cameras[project.format] ?? camera()).mode,
                  )}
                  options={[
                    ["route", "Include source & destination"],
                    ["follow", "Follow moving piece"],
                    ["game", "Game close-up"],
                    ["manual", "Manual framing"],
                    ["full", "Full board"],
                  ]}
                  onChange={(v) => changeCamera("mode", v)}
                />
                <Range
                  label="Game close-up width (all moves)"
                  value={project.gameViewWidth}
                  resetValue={8}
                  min={3}
                  max={16}
                  step={0.1}
                  onChange={(v) =>
                    edit("Game close-up width", (p) => {
                      p.gameViewWidth = v;
                    })
                  }
                />
                <p className="hint">
                  Width in board squares. Shorts close-ups use an 8-by-7 window
                  with background above and below. Square videos show equal
                  width and height.
                </p>
                <button
                  onClick={() =>
                    edit("Use game close-up for all moves", (p) => {
                      for (const move of p.moves)
                        move.effect.cameras[p.format] = {
                          ...(move.effect.cameras[p.format] ?? camera()),
                          mode: "game",
                        };
                    })
                  }
                >
                  Use game close-up for all moves
                </button>
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
                    mixed={mixed(
                      (v) => (v.cameras[project.format] ?? camera())[k],
                    )}
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
            </div>
          );
        })()}
        {
          <div data-inspector-tab="effects" hidden={tab !== "effects"}>
            <>
              <p className="hint">
                Capture impact shapes this move. Global cinema adds a separate
                particle layer at the move’s impact time; it does not override
                these values.
              </p>
              <button className="wide" onClick={onGlobalEffects}>
                Composition · Cinematic Captures & Bloom
              </button>
              <Section
                title="Capture impact"
                status={effectStatus((x) => x.capture)}
                onReset={() => resetFields(["capture"])}
              >
                {(
                  [
                    "cameraShake",
                    "impactLight",
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
                        cameraShake: "Capture camera shake",
                        impactLight: "Capture light pulse",
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
                    mixed={mixed((v) => v.capture[k])}
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
                  mixed={mixed((v) => v.capture.color)}
                  onChange={(v) => capture("color", v)}
                />
                <Select
                  label="Captured piece exit"
                  value={e.capture.exit}
                  mixed={mixed((v) => v.capture.exit)}
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
                      mixed={mixed((v) => v.capture.dustDuration)}
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
                      mixed={mixed((v) => v.capture.dustAmount)}
                      min={16}
                      max={256}
                      step={1}
                      resetValue={128}
                      onChange={(v) => capture("dustAmount", v)}
                    />
                    <Range
                      label="Dust spread"
                      value={e.capture.dustSpread}
                      mixed={mixed((v) => v.capture.dustSpread)}
                      min={0.1}
                      max={2}
                      step={0.05}
                      resetValue={0.85}
                      onChange={(v) => capture("dustSpread", v)}
                    />
                    <Range
                      label="Dust fragment size"
                      value={e.capture.dustSize}
                      mixed={mixed((v) => v.capture.dustSize)}
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
                  mixed={mixed((v) => v.capture.particles)}
                  onChange={(v) => capture("particles", v)}
                />
              </Section>

              <Section
                title="Beat spotlight transition"
                status={
                  mixed((v) => v.jam.enabled)
                    ? "Mixed"
                    : e.jam.enabled
                      ? "Enabled"
                      : "Off"
                }
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
                  mixed={mixed((v) => v.jam.enabled)}
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
                      mixed={mixed((v) => v.jam.rhythm)}
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
                      mixed={mixed((v) => v.jam.clock)}
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
                      mixed={mixed((v) => v.jam.primary)}
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
                      mixed={mixed((v) => v.jam.secondary)}
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
                        mixed={mixed((v) => v.jam[k])}
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
                status={
                  mixed((v) => v.light.enabled)
                    ? "Mixed"
                    : e.light.enabled
                      ? "Enabled"
                      : "Off"
                }
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
                  mixed={mixed((v) => v.light.enabled)}
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
                  mixed={mixed((v) => v.light.color)}
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
                  mixed={mixed((v) => v.light.highlights)}
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
                    mixed={mixed((v) => v.light[k])}
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
                status={
                  mixed((v) => v.highlight)
                    ? "Mixed"
                    : e.highlight.showSource ||
                        e.highlight.showDestination ||
                        e.highlight.showPath ||
                        e.highlight.trail
                      ? "Enabled"
                      : "Off"
                }
                onReset={() => resetFields(["highlight"])}
              >
                <Toggle
                  label="Use different colors for White and Black"
                  checked={e.highlight.byMover}
                  mixed={mixed((v) => v.highlight.byMover)}
                  onChange={(v) => look("byMover", v)}
                />
                {e.highlight.byMover ? (
                  <>
                    <Color
                      label="White move color"
                      value={e.highlight.whiteColor}
                      mixed={mixed((v) => v.highlight.whiteColor)}
                      onChange={(v) => look("whiteColor", v)}
                    />
                    <Color
                      label="Black move color"
                      value={e.highlight.blackColor}
                      mixed={mixed((v) => v.highlight.blackColor)}
                      onChange={(v) => look("blackColor", v)}
                    />
                  </>
                ) : (
                  <>
                    {(["source", "destination", "path"] as const).map((k) => (
                      <div className="highlight-color-apply" key={k}>
                        <Color
                          label={k + " color"}
                          value={e.highlight[k]}
                          mixed={mixed((v) => v.highlight[k])}
                          onChange={(v) => look(k, v)}
                        />
                        <button
                          type="button"
                          title={`Apply the ${k} color to all highlight squares for the selected moves`}
                          aria-label={`Apply ${k} color to all`}
                          onClick={() => {
                            const color = e.highlight[k];
                            edit("Apply color to all highlights", (p) =>
                              each(p, (v) => {
                                v.highlight.source = color;
                                v.highlight.destination = color;
                                v.highlight.path = color;
                              }),
                            );
                          }}
                        >
                          Apply to all
                        </button>
                      </div>
                    ))}
                  </>
                )}
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
                    mixed={mixed((v) => v.highlight[k])}
                    onChange={(v) => look(k, v)}
                  />
                ))}
                <Range
                  label="Trail width"
                  value={e.highlight.width}
                  mixed={mixed((v) => v.highlight.width)}
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
                  mixed={mixed((v) => v.highlight.glow)}
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
                  mixed={mixed((v) => v.highlight.opacity)}
                  onReset={() =>
                    edit("Reset highlight opacity", (p) =>
                      each(p, (v) => {
                        v.highlight.opacity = effect(
                          v.preset,
                        ).highlight.opacity;
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
                  mixed={mixed((v) => v.highlight.reveal)}
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
                  mixed={mixed((v) => v.highlight.fade)}
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
              <Section
                title="Move badge"
                status={
                  mixed((v) => v.badge)
                    ? "Mixed"
                    : e.badge.manual === "none"
                      ? "Off"
                      : e.badge.manual
                        ? "Customized"
                        : "Enabled"
                }
                onReset={() => resetFields(["badge"])}
              >
                <Select
                  label="Badge override"
                  value={e.badge.manual ?? "auto"}
                  mixed={mixed((v) => v.badge.manual)}
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
                    value={mixed((v) => v.badge.text) ? "" : e.badge.text}
                    placeholder={
                      mixed((v) => v.badge.text) ? "Mixed" : undefined
                    }
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
                    mixed={mixed((v) => v.badge[k])}
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
                  mixed={mixed((v) => v.badge.entry)}
                  options={["pop", "fade", "rise"]}
                  onChange={(v) => badge("entry", v)}
                />
                <Toggle
                  label="Expanding ring"
                  checked={e.badge.ring}
                  mixed={mixed((v) => v.badge.ring)}
                  onChange={(v) => badge("ring", v)}
                />
                <p className="hint">
                  Manual choices always override analysis suggestions.
                </p>
              </Section>
            </>
          </div>
        }
        {
          <div data-inspector-tab="keys" hidden={tab !== "keys"}>
            <KeyframePanel
              project={project}
              index={index}
              edit={edit}
              seek={seek}
            />
          </div>
        }
      </div>
    </aside>
  );
}
