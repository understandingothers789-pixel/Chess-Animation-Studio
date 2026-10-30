import { useState } from "react";
import {
  Copy,
  ClipboardPaste,
  RotateCcw,
  BookmarkPlus,
  Plus,
  Trash2,
} from "lucide-react";
import {
  type Project,
  type Effect,
  type Keyframe,
  type CameraSettings,
  cameraDefault,
  effectPreset,
  presets,
  easings,
  channels,
} from "../core/model";
import { segments } from "../core/timeline";
import { Range, Select, Color, Toggle, Section, timeLabel } from "./controls";
import type { Edit } from "./useProject";

const presetLabels: Record<string, string> = {
  clean: "Clean slide",
  soft: "Fast start · soft landing",
  spin: "Spin",
  wiggle: "Slow sway",
  hop: "Hop",
  dramatic: "Dramatic landing",
  capture: "Capture growth & glow",
};
export function Inspector({
  project,
  index,
  edit,
  onCopy,
  onPaste,
  hasCopy,
  onBeat,
  onStatus,
}: {
  project: Project;
  index: number;
  edit: Edit;
  onCopy: () => void;
  onPaste: () => void;
  hasCopy: boolean;
  onBeat: (id: string) => void;
  onStatus: (s: string) => void;
}) {
  const [tab, setTab] = useState("motion"),
    [presetName, setPresetName] = useState("My move style");
  const m = project.moves[index],
    e = m?.effect,
    s = segments(project)[index];
  const change = <K extends keyof Effect>(key: K, value: Effect[K]) =>
    edit(`move:${key}`, (p) => {
      p.moves[index].effect[key] = value;
    });
  const cam = e?.cameras[project.output] ?? cameraDefault();
  const camera = (key: keyof CameraSettings, value: unknown) =>
    change("cameras", {
      ...e.cameras,
      [project.output]: { ...cam, [key]: value },
    });
  if (!m)
    return (
      <aside className="inspector">
        <div className="panel-title">MOVE INSPECTOR</div>
        <div className="empty">
          <span>♞</span>
          <h3>Give every move a moment.</h3>
          <p>
            Import a game or enter a legal move on the board. Select a move to
            refine its animation.
          </p>
        </div>
      </aside>
    );
  return (
    <aside className="inspector">
      <div className="inspector-head">
        <div>
          <small>
            MOVE {index + 1} · {m.uci}
          </small>
          <h2>
            {m.san} <span>{presetLabels[e.preset]}</span>
          </h2>
        </div>
        <div className="icon-row">
          <button title="Copy effects" onClick={onCopy}>
            <Copy size={14} />
          </button>
          <button title="Paste effects" disabled={!hasCopy} onClick={onPaste}>
            <ClipboardPaste size={14} />
          </button>
          <button
            title="Reset move"
            onClick={() =>
              edit("Reset move", (p) => {
                p.moves[index].effect = structuredClone(p.defaults);
              })
            }
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>
      <nav className="inspector-tabs">
        {["motion", "camera", "look", "keys"].map((t) => (
          <button
            key={t}
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
          >
            {t === "keys" ? "Fine control" : t}
          </button>
        ))}
      </nav>
      <div className="inspector-content">
        {tab === "motion" && (
          <>
            <Section title="Movement">
              <Select
                label="Preset"
                value={e.preset}
                options={presets.map((p) => [p, presetLabels[p]] as const)}
                onChange={(v) =>
                  edit("Apply preset", (p) => {
                    const old = p.moves[index].effect;
                    p.moves[index].effect = {
                      ...effectPreset(v),
                      badge: old.badge,
                      cameras: old.cameras,
                      locked: old.locked,
                    };
                  })
                }
              />
              <Range
                label="Duration"
                value={e.duration}
                onChange={(v) => change("duration", v)}
                min={0.15}
                max={8}
                unit="s"
              />
              <Range
                label="Intensity"
                value={e.intensity}
                onChange={(v) => change("intensity", v)}
                min={0}
                max={2}
              />
              <Select
                label="Easing"
                value={e.easing}
                options={easings}
                onChange={(v) => change("easing", v)}
              />
              <Select
                label="Turn axis"
                value={e.axis}
                options={["x", "y", "z"]}
                onChange={(v) => change("axis", v)}
              />
              <Range
                label="Rotation"
                value={e.rotation}
                onChange={(v) => change("rotation", v)}
                min={-720}
                max={720}
                step={15}
                unit="°"
              />
              <Range
                label="Maximum size"
                value={e.scale}
                onChange={(v) => change("scale", v)}
                min={1}
                max={3}
                unit="×"
              />
              <Range
                label="Hop height"
                value={e.hop}
                onChange={(v) => change("hop", v)}
                min={0}
                max={3}
              />
            </Section>
            <Section title="Landing & timing">
              <Range
                label="Delay"
                value={e.delay}
                onChange={(v) => change("delay", v)}
                min={0}
                max={10}
                unit="s"
              />
              <Range
                label="Hold after move"
                value={e.hold}
                onChange={(v) => change("hold", v)}
                min={0}
                max={10}
                unit="s"
              />
              <Range
                label="Landing phase"
                value={e.landing}
                onChange={(v) => change("landing", v)}
                min={0.2}
                max={0.95}
              />
              <Range
                label="Settle window"
                value={e.settle}
                onChange={(v) => change("settle", v)}
                min={0.05}
                max={0.5}
              />
              <Toggle
                label="Lock automatic timing"
                checked={e.locked}
                onChange={(v) => change("locked", v)}
              />
              <label className="select-field">
                <span>Land on a beat</span>
                <select
                  aria-label="Landing beat"
                  value={e.landingBeat ?? ""}
                  onChange={(v) =>
                    v.target.value
                      ? onBeat(v.target.value)
                      : change("landingBeat", null)
                  }
                >
                  <option value="">Free timing</option>
                  {project.beats.map((b, i) => (
                    <option value={b.id} key={b.id}>
                      {i + 1} · {timeLabel(b.time)} {b.strong ? "★" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <p className="hint">
                Lands at {timeLabel(s.landing)}. Later moves shift when this
                move’s duration changes. Music stays in place.
              </p>
            </Section>
            <Section title="Travel details" open={false}>
              <Range
                label="Curved path"
                value={e.path}
                onChange={(v) => change("path", v)}
                min={-3}
                max={3}
              />
              <Range
                label="Overshoot"
                value={e.overshoot}
                onChange={(v) => change("overshoot", v)}
                min={0}
                max={0.4}
              />
              <Range
                label="Sway angle"
                value={e.wiggle}
                onChange={(v) => change("wiggle", v)}
                min={0}
                max={45}
                unit="°"
              />
              <Range
                label="Sway cycles"
                value={e.frequency}
                onChange={(v) => change("frequency", v)}
                min={1}
                max={12}
                step={1}
              />
              <Range
                label="Size peak phase"
                value={e.peak}
                onChange={(v) => change("peak", v)}
                min={0.1}
                max={0.95}
              />
            </Section>
            <Section title="Save reusable style" open={false}>
              <input
                aria-label="Preset name"
                value={presetName}
                maxLength={80}
                onChange={(e) => setPresetName(e.target.value)}
              />
              <button
                className="wide"
                onClick={() => {
                  if (!presetName.trim()) return;
                  edit("Save preset", (p) => {
                    p.savedPresets.push({
                      name: presetName.trim(),
                      effect: structuredClone(e),
                    });
                  });
                  onStatus("Preset saved in this project.");
                }}
              >
                <BookmarkPlus size={14} /> Save move as preset
              </button>
            </Section>
          </>
        )}
        {tab === "camera" && (
          <>
            <Section title={`${project.output} camera`}>
              <Select
                label="Framing"
                value={cam.mode}
                options={["route", "follow", "full", "manual"]}
                onChange={(v) => camera("mode", v)}
              />
              <Range
                label="Camera zoom"
                value={cam.zoom}
                onChange={(v) => camera("zoom", v)}
                min={0.6}
                max={3}
                unit="×"
              />
              <Range
                label="Pan X"
                value={cam.x}
                onChange={(v) => camera("x", v)}
                min={-4}
                max={4}
              />
              <Range
                label="Pan Y"
                value={cam.y}
                onChange={(v) => camera("y", v)}
                min={-4}
                max={4}
              />
              <Range
                label="Framing padding"
                value={cam.padding}
                onChange={(v) => camera("padding", v)}
                min={0}
                max={3}
              />
              <Range
                label="Transition"
                value={cam.transition}
                onChange={(v) => camera("transition", v)}
                min={0.05}
                max={3}
                unit="s"
              />
              <Range
                label="Tilt"
                value={cam.tilt}
                onChange={(v) => camera("tilt", v)}
                min={-25}
                max={25}
                step={1}
                unit="°"
              />
              <Range
                label="Camera rotation"
                value={cam.rotation}
                onChange={(v) => camera("rotation", v)}
                min={-30}
                max={30}
                step={1}
                unit="°"
              />
              <p className="hint">
                Route includes source and destination. Follow centers the moving
                piece. This override belongs only to {project.output}.
              </p>
              <button className="wide" onClick={() => camera("mode", "full")}>
                Return to full board
              </button>
            </Section>
          </>
        )}
        {tab === "look" && (
          <>
            <Section title="Highlights & trail">
              <Toggle
                label="Colored squares"
                checked={e.highlights}
                onChange={(v) => change("highlights", v)}
              />
              <Toggle
                label="Include route squares"
                checked={e.pathSquares}
                onChange={(v) => change("pathSquares", v)}
              />
              <Toggle
                label="Continuous trail"
                checked={e.trail}
                onChange={(v) => change("trail", v)}
              />
              <Color
                label="Source"
                value={e.sourceColor}
                onChange={(v) => change("sourceColor", v)}
              />
              <Color
                label="Destination"
                value={e.destColor}
                onChange={(v) => change("destColor", v)}
              />
              <Color
                label="Route / trail"
                value={e.pathColor}
                onChange={(v) => change("pathColor", v)}
              />
              <Range
                label="Highlight opacity"
                value={e.opacity}
                onChange={(v) => change("opacity", v)}
                min={0}
                max={1}
              />
              <Range
                label="Trail width"
                value={e.trailWidth}
                onChange={(v) => change("trailWidth", v)}
                min={0.02}
                max={0.6}
              />
              <Range
                label="Reveal phase"
                value={e.reveal}
                onChange={(v) => change("reveal", v)}
                min={0}
                max={0.8}
              />
              <Range
                label="Fade window"
                value={e.fade}
                onChange={(v) => change("fade", v)}
                min={0.01}
                max={1}
              />
              <Toggle
                label="Persist until next move"
                checked={e.persist}
                onChange={(v) => change("persist", v)}
              />
            </Section>
            <Section title="Capture & impact">
              <Color
                label="Glow color"
                value={e.glowColor}
                onChange={(v) => change("glowColor", v)}
              />
              <Range
                label="Glow strength"
                value={e.glow}
                onChange={(v) => change("glow", v)}
                min={0}
                max={2}
              />
              <Range
                label="Glow radius"
                value={e.radius}
                onChange={(v) => change("radius", v)}
                min={0.3}
                max={3}
              />
              <Range
                label="Impact phase"
                value={e.impact}
                onChange={(v) => change("impact", v)}
                min={0}
                max={1}
              />
              <Range
                label="Captured exit phase"
                value={e.capturedAt}
                onChange={(v) => change("capturedAt", v)}
                min={0}
                max={1}
              />
              <Range
                label="Expansion window"
                value={e.expansion}
                onChange={(v) => change("expansion", v)}
                min={0.02}
                max={0.4}
              />
              <Select
                label="Return easing"
                value={e.returnEase}
                options={easings}
                onChange={(v) => change("returnEase", v)}
              />
              <Toggle
                label="Impact particles"
                checked={e.impactParticles}
                onChange={(v) => change("impactParticles", v)}
              />
            </Section>
            <Section title="Classification badge">
              <label className="select-field">
                <span>Badge override</span>
                <select
                  aria-label="Badge override"
                  value={e.badge.manual === null ? "__auto" : e.badge.manual}
                  onChange={(v) =>
                    change("badge", {
                      ...e.badge,
                      manual:
                        v.target.value === "__auto" ? null : v.target.value,
                    })
                  }
                >
                  <option value="__auto">Automatic suggestion</option>
                  <option value="">No badge</option>
                  {[
                    "book",
                    "brilliant",
                    "best",
                    "good",
                    "inaccuracy",
                    "mistake",
                    "blunder",
                    "check",
                    "mate",
                  ].map((b) => (
                    <option value={b} key={b}>
                      {b}
                    </option>
                  ))}
                  {e.badge.manual &&
                    ![
                      "book",
                      "brilliant",
                      "best",
                      "good",
                      "inaccuracy",
                      "mistake",
                      "blunder",
                      "check",
                      "mate",
                    ].includes(e.badge.manual) && (
                      <option value={e.badge.manual}>{e.badge.manual}</option>
                    )}
                </select>
              </label>
              <label className="text-field">
                Custom text / symbol
                <input
                  aria-label="Custom badge"
                  maxLength={16}
                  value={e.badge.manual ?? ""}
                  onChange={(v) =>
                    change("badge", { ...e.badge, manual: v.target.value })
                  }
                />
              </label>
              {(
                ["size", "x", "y", "start", "end", "opacity", "glow"] as const
              ).map((k) => (
                <Range
                  key={k}
                  label={`Badge ${k}`}
                  value={e.badge[k]}
                  onChange={(v) => change("badge", { ...e.badge, [k]: v })}
                  min={k === "x" || k === "y" ? -3 : k === "size" ? 0.2 : 0}
                  max={
                    k === "x" || k === "y"
                      ? 3
                      : k === "size" || k === "glow"
                        ? 2
                        : 1
                  }
                />
              ))}
              <Toggle
                label="Expanding ring"
                checked={e.badge.ring}
                onChange={(v) => change("badge", { ...e.badge, ring: v })}
              />
              <p className="hint">
                Manual choices always win. Choose Automatic to revert; engine
                and book data remain preserved.
              </p>
            </Section>
          </>
        )}
        {tab === "keys" && (
          <>
            <p className="hint padded">
              Move-relative time runs from 0 to 1. Keyframes override preset
              curves. Rotation uses degrees; travel uses 0 → 1. Resting state is
              restored at the end.
            </p>
            <Keyframes effect={e} onChange={(v) => change("keys", v)} />
          </>
        )}
      </div>
    </aside>
  );
}
function Keyframes({
  effect,
  onChange,
}: {
  effect: Effect;
  onChange: (v: Effect["keys"]) => void;
}) {
  const [channel, setChannel] = useState<(typeof channels)[number]>("scale"),
    keys = effect.keys[channel] ?? [];
  const update = (i: number, v: Partial<Keyframe>) =>
    onChange({
      ...effect.keys,
      [channel]: keys.map((k, j) => (i === j ? { ...k, ...v } : k)),
    });
  return (
    <Section title="Normalized keyframes">
      <Select
        label="Channel"
        value={channel}
        options={channels}
        onChange={setChannel}
      />
      {keys.map((k, i) => (
        <div className="keyframe" key={i}>
          <label>
            Time
            <input
              aria-label={`Key ${i + 1} time`}
              type="number"
              min={0}
              max={1}
              step={0.01}
              value={k.t}
              onChange={(e) =>
                update(i, {
                  t: Math.max(0, Math.min(1, Number(e.target.value))),
                })
              }
            />
          </label>
          <label>
            Value
            <input
              aria-label={`Key ${i + 1} value`}
              type="number"
              min={-100}
              max={100}
              step={0.1}
              value={k.value}
              onChange={(e) =>
                update(i, {
                  value: Math.max(-100, Math.min(100, Number(e.target.value))),
                })
              }
            />
          </label>
          <select
            aria-label={`Key ${i + 1} easing`}
            value={k.easing}
            onChange={(e) =>
              update(i, { easing: e.target.value as Keyframe["easing"] })
            }
          >
            {easings.map((e) => (
              <option key={e}>{e}</option>
            ))}
          </select>
          <button
            aria-label={`Delete key ${i + 1}`}
            onClick={() =>
              onChange({
                ...effect.keys,
                [channel]: keys.filter((_, j) => j !== i),
              })
            }
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      <button
        className="wide"
        onClick={() =>
          onChange({
            ...effect.keys,
            [channel]: [
              ...keys,
              {
                t: keys.length ? Math.min(1, keys.at(-1)!.t + 0.25) : 0,
                value:
                  channel === "scale" ||
                  channel === "opacity" ||
                  channel === "zoom"
                    ? 1
                    : 0,
                easing: "smooth",
              },
            ],
          })
        }
      >
        <Plus size={14} /> Add keyframe
      </button>
      {keys.length > 0 && (
        <button
          className="wide text-button"
          onClick={() => onChange({ ...effect.keys, [channel]: [] })}
        >
          Restore preset curve
        </button>
      )}
    </Section>
  );
}
