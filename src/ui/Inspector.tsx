import { settingHelp } from "./help";
import { useState } from "react";
import {
  effect,
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
import { Section, Range, Select, Toggle, Color } from "./controls";
export const presetLabels: Record<Preset, string> = {
  slide: "Clean slide",
  soft: "Soft landing",
  spin: "Thin-edge spin",
  sway: "Slow sway",
  "sway-half": "Half sway",
  hop: "Soft hop",
  dramatic: "Dramatic landing",
  capture: "Capture impact",
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
        <span className="eyebrow">
          MOVE {index + 1} · {move.id.slice(0, 6)}
        </span>
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
          <button onClick={onCopy}>Copy</button>
          <button onClick={onPaste}>Paste</button>
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
                min={0.02}
                max={0.6}
                onChange={(v) => look("width", v)}
              />
              <Range
                label="Highlight glow"
                value={e.highlight.glow}
                min={0}
                max={1}
                onChange={(v) => look("glow", v)}
              />
              <Range
                label="Highlight opacity"
                value={e.highlight.opacity}
                min={0}
                max={1}
                onChange={(v) => look("opacity", v)}
              />
              <Range
                label="Highlight reveal phase"
                value={e.highlight.reveal}
                min={0}
                max={0.9}
                onChange={(v) => look("reveal", v)}
              />
              <Range
                label="Highlight fade"
                value={e.highlight.fade}
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
                <input
                  title={settingHelp(`Key ${i + 1} time`)}
                  aria-description={settingHelp(`Key ${i + 1} time`)}
                  aria-label={`Key ${i + 1} time`}
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  value={k.at}
                  onChange={(v) => {
                    const n = +v.target.value;
                    if (Number.isFinite(n))
                      edit("Key time", (p) => {
                        p.moves[index].effect.keys[channel]![i].at = Math.max(
                          0,
                          Math.min(1, n),
                        );
                      });
                  }}
                />
                <input
                  title={settingHelp(`Key ${i + 1} value`)}
                  aria-description={settingHelp(`Key ${i + 1} value`)}
                  aria-label={`Key ${i + 1} value`}
                  type="number"
                  step={0.1}
                  value={k.value}
                  onChange={(v) => {
                    const n = +v.target.value;
                    if (Number.isFinite(n))
                      edit("Key value", (p) => {
                        p.moves[index].effect.keys[channel]![i].value = n;
                      });
                  }}
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
