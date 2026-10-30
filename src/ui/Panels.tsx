import { useState } from "react";
import {
  Plus,
  Upload,
  Play,
  Trash2,
  Music2,
  Check,
  Sparkles,
  Link2,
  RefreshCw,
} from "lucide-react";
import {
  type Project,
  type Preset,
  type Asset,
  type Format,
  FORMATS,
  presets,
  uid,
} from "../core/model";
import { Select, Range, Color, Toggle, Section, timeLabel } from "./controls";
import type { Edit } from "./useProject";
import type { Settings } from "../bridge";
import { badgeFor, segments } from "../core/timeline";
import { correctBeat, syncBeatAnchors } from "../core/audio";
export const presetNames: Record<Preset, string> = {
  clean: "Clean slide",
  soft: "Soft landing",
  spin: "Thin-edge spin",
  wiggle: "Slow sway",
  hop: "Soft hop",
  dramatic: "Dramatic landing",
  capture: "Capture glow",
};
const presetDescriptions: Record<Preset, string> = {
  clean: "Quiet, precise movement",
  soft: "Quick start. Unhurried arrival.",
  spin: "A full turn with a solid edge",
  wiggle: "Lean one way, sweep back, settle upright",
  hop: "Lift, travel, settle",
  dramatic: "Grow, turn, slow down, land",
  capture: "Engulf, pulse, and return",
};

export function GamePanel({
  project,
  selected,
  checked,
  onSelect,
  onCheck,
  onImport,
  onFile,
  onNew,
  promotion,
  setPromotion,
}: {
  project: Project;
  selected: number;
  checked: Set<string>;
  onSelect: (i: number) => void;
  onCheck: (id: string) => void;
  onImport: (text: string, fen: boolean, policy: string) => void;
  onFile: () => void;
  onNew: () => void;
  promotion: string;
  setPromotion: (v: string) => void;
}) {
  const [input, setInput] = useState(""),
    [kind, setKind] = useState("pgn"),
    [policy, setPolicy] = useState("match");
  return (
    <>
      <Section title="Game input">
        <div className="button-row">
          <button className="wide" onClick={onFile}>
            <Upload size={14} /> PGN / FEN file
          </button>
          <button onClick={onNew} title="New starting position">
            <Plus size={14} />
          </button>
        </div>
        <Select
          label="Paste format"
          value={kind}
          options={["pgn", "fen"]}
          onChange={setKind}
        />
        <textarea
          aria-label="PGN or FEN text"
          rows={4}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            kind === "pgn" ? "1. e4 e5 2. Nf3 Nc6…" : "Paste a FEN position…"
          }
        />
        <Select
          label="Existing move effects"
          value={policy}
          options={[
            ["match", "Keep matching moves"],
            ["ply", "Reassign by move number"],
            ["reset", "Reset imported moves"],
          ]}
          onChange={setPolicy}
        />
        <button
          className="primary wide"
          disabled={!input.trim()}
          onClick={() => onImport(input, kind === "fen", policy)}
        >
          Load {kind.toUpperCase()}
        </button>
        <p className="hint">
          Click a piece, then a legal destination in the preview to enter a
          move. A new variation preserves the existing lines.
        </p>
        <Select
          label="Promote pawn to"
          value={promotion}
          options={[
            ["q", "Queen"],
            ["r", "Rook"],
            ["b", "Bishop"],
            ["n", "Knight"],
          ]}
          onChange={setPromotion}
        />
      </Section>
      <div className="move-list-head">
        <strong>SELECTED LINE</strong>
        <span>{project.moves.length} plies</span>
      </div>
      <div className="move-list">
        {project.moves.map((m, i) => (
          <div
            key={m.id}
            className={`move-row ${i === selected ? "active" : ""}`}
          >
            <input
              aria-label={`Include ${i + 1} ${m.san} in batch`}
              type="checkbox"
              checked={checked.has(m.id)}
              onChange={() => onCheck(m.id)}
            />
            <button onClick={() => onSelect(i)}>
              <small>
                {Math.floor(i / 2) + 1}
                {i % 2 ? "…" : "."}
              </small>
              <b>{m.san}</b>
              <span className="move-badge">{badgeFor(m) ?? "·"}</span>
              <em>{m.effect.duration.toFixed(2)}s</em>
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
export function PresetsPanel({
  project,
  checked,
  selected,
  onApply,
  edit,
}: {
  project: Project;
  checked: Set<string>;
  selected: number;
  onApply: (preset: Preset, scope: string) => void;
  edit: Edit;
}) {
  const [scope, setScope] = useState(checked.size ? "checked" : "selected");
  return (
    <>
      <div className="panel-intro">
        <span className="eyebrow">A STRONG FIRST DRAFT</span>
        <h2>Make it move.</h2>
        <p>Apply a style, then make it yours in the inspector.</p>
        <small>
          {checked.size
            ? `${checked.size} checked moves`
            : `${selected >= 0 ? "Selected move" : "All moves"}`}
        </small>
      </div>
      <div className="padded">
        <Select
          label="Apply style to"
          value={scope}
          options={[
            ["selected", "Selected move"],
            ["checked", "Checked moves"],
            ["all", "Entire line"],
          ]}
          onChange={setScope}
        />
      </div>
      <div className="preset-list">
        {presets.map((preset, i) => (
          <button
            className="preset-card"
            key={preset}
            onClick={() => onApply(preset, scope)}
          >
            <span className={`preset-art art-${preset}`}>
              <i>♞</i>
              <b>{["→", "↝", "↻", "∿", "⌒", "✧", "◉"][i]}</b>
            </span>
            <span>
              <strong>{presetNames[preset]}</strong>
              <small>{presetDescriptions[preset]}</small>
            </span>
            <Plus size={15} />
          </button>
        ))}
      </div>
      {project.savedPresets.length > 0 && (
        <Section title="Your saved presets">
          {project.savedPresets.map((s, i) => (
            <div className="saved-preset" key={i}>
              <button
                onClick={() =>
                  edit("Apply saved preset", (p) => {
                    for (let j = 0; j < p.moves.length; j++)
                      if (
                        scope === "all" ||
                        (scope === "checked" && checked.has(p.moves[j].id)) ||
                        (scope === "selected" && j === selected)
                      )
                        p.moves[j].effect = structuredClone(s.effect);
                  })
                }
              >
                {s.name}
              </button>
              <button
                title="Remove saved preset"
                onClick={() =>
                  edit("Delete preset", (p) => {
                    p.savedPresets.splice(i, 1);
                  })
                }
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </Section>
      )}
      <p className="hint padded">
        Move styles are shared across formats. Camera overrides remain format
        specific.
      </p>
    </>
  );
}
export function MusicPanel({
  project,
  edit,
  time,
  onImport,
  onPreview,
  onAlign,
  onAddBeat,
  onStatus,
}: {
  project: Project;
  edit: Edit;
  time: number;
  onImport: (role: "music" | "sound") => void;
  onPreview: (id: string) => void;
  onAlign: (selection: "all" | "second" | "fourth" | "selected") => void;
  onAddBeat: (t: number) => void;
  onStatus: (s: string) => void;
}) {
  const [align, setAlign] = useState<"all" | "second" | "fourth" | "selected">(
    "all",
  );
  const m = project.music;
  const music = (key: string, value: unknown) =>
    edit(`music:${key}`, (p) => {
      if (p.music) {
        Object.assign(p.music, { [key]: value });
        if (key === "offset" || key === "trimStart") {
          for (const b of p.beats)
            if (b.sourceTime !== undefined && b.assetId === p.music.assetId)
              b.time = Math.max(
                0,
                p.music.offset + b.sourceTime - p.music.trimStart,
              );
          p.beats.sort((a, b) => a.time - b.time);
          syncBeatAnchors(p);
        }
      }
    });
  const audioAssets = project.assets.filter((a) => a.kind === "audio");
  return (
    <>
      <Section title="Music">
        <button className="primary wide" onClick={() => onImport("music")}>
          <Music2 size={14} /> Import a local song
        </button>
        {m ? (
          <>
            <div className="asset-name">
              {project.assets.find((a) => a.id === m.assetId)?.name ??
                "Missing music asset"}
            </div>
            <div className="mini-wave">
              <svg viewBox="0 0 1000 54" preserveAspectRatio="none">
                {m.waveform.map((v, i) => (
                  <line
                    key={i}
                    x1={(i / m.waveform.length) * 1000}
                    x2={(i / m.waveform.length) * 1000}
                    y1={27 - v * 24}
                    y2={27 + v * 24}
                  />
                ))}
              </svg>
            </div>
            <Range
              label="Music volume"
              value={m.volume}
              onChange={(v) => music("volume", v)}
              min={0}
              max={2}
            />
            <Toggle
              label="Mute music"
              checked={m.muted}
              onChange={(v) => music("muted", v)}
            />
            <Range
              label="Music start offset"
              value={m.offset}
              onChange={(v) => music("offset", v)}
              min={-60}
              max={120}
              unit="s"
            />
            <Range
              label="Trim start"
              value={m.trimStart}
              onChange={(v) =>
                music("trimStart", Math.min(v, m.trimEnd - 0.05))
              }
              min={0}
              max={m.duration}
              unit="s"
            />
            <Range
              label="Trim end"
              value={m.trimEnd}
              onChange={(v) =>
                music("trimEnd", Math.max(v, m.trimStart + 0.05))
              }
              min={0}
              max={m.duration}
              unit="s"
            />
            <Range
              label="Fade in"
              value={m.fadeIn}
              onChange={(v) => music("fadeIn", v)}
              min={0}
              max={10}
              unit="s"
            />
            <Range
              label="Fade out"
              value={m.fadeOut}
              onChange={(v) => music("fadeOut", v)}
              min={0}
              max={10}
              unit="s"
            />
            <button
              className="wide"
              onClick={() =>
                edit("Remove music", (p) => {
                  p.music = null;
                })
              }
            >
              Remove music track
            </button>
          </>
        ) : (
          <p className="hint">
            All audio stays on your computer. Beat detection suggests
            transients; correct them below.
          </p>
        )}
      </Section>
      <Section title="Beats & accents">
        <button className="wide" onClick={() => onAddBeat(time)}>
          <Plus size={14} /> Add beat at playhead
        </button>
        <Select
          label="Arrange landings on"
          value={align}
          options={[
            ["all", "Every beat"],
            ["second", "Every second beat"],
            ["fourth", "Every fourth beat"],
            ["selected", "Selected markers"],
          ]}
          onChange={setAlign}
        />
        <button
          className="wide"
          disabled={!project.beats.length}
          onClick={() => onAlign(align)}
        >
          <Sparkles size={14} /> Preview automatic timing
        </button>
        <p className="hint">
          Landing takes priority. Timing locks are respected. Preview before
          applying.
        </p>
        <div className="beat-list">
          {project.beats.map((b, i) => (
            <div className="beat-row" key={b.id}>
              <input
                aria-label={`Select beat ${i + 1}`}
                type="checkbox"
                checked={b.selected}
                onChange={(e) =>
                  edit("Select beat", (p) => {
                    p.beats.find((x) => x.id === b.id)!.selected =
                      e.target.checked;
                  })
                }
              />
              <input
                aria-label={`Beat ${i + 1} time`}
                type="number"
                min={0}
                max={86400}
                step={0.01}
                value={Number(b.time.toFixed(3))}
                onChange={(e) =>
                  edit("Correct beat", (p) => {
                    correctBeat(p, b.id, Number(e.target.value));
                  })
                }
              />
              <button
                className={b.strong ? "accent-button" : ""}
                title="Toggle strong accent"
                onClick={() =>
                  edit("Beat accent", (p) => {
                    p.beats.find((x) => x.id === b.id)!.strong = !b.strong;
                  })
                }
              >
                ★
              </button>
              <button
                title="Delete beat"
                onClick={() =>
                  edit("Delete beat", (p) => {
                    p.beats = p.beats.filter((x) => x.id !== b.id);
                    for (const m of p.moves)
                      if (m.effect.landingBeat === b.id)
                        m.effect.landingBeat = null;
                  })
                }
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Sound library">
        <Toggle
          label="Original move / capture sounds"
          checked={project.sound.enabled}
          onChange={(v) =>
            edit("Chess sounds", (p) => {
              p.sound.enabled = v;
            })
          }
        />
        <Range
          label="Chess sound volume"
          value={project.sound.chess}
          onChange={(v) =>
            edit("Chess volume", (p) => {
              p.sound.chess = v;
            })
          }
          min={0}
          max={2}
        />
        <Range
          label="Dramatic sound volume"
          value={project.sound.dramatic}
          onChange={(v) =>
            edit("Dramatic volume", (p) => {
              p.sound.dramatic = v;
            })
          }
          min={0}
          max={2}
        />
        <button className="wide" onClick={() => onImport("sound")}>
          <Upload size={14} /> Import sound
        </button>
        {audioAssets.map((a) => (
          <div className="sound-asset" key={a.id}>
            <input
              aria-label={`Name ${a.name}`}
              value={a.name}
              onChange={(e) =>
                edit("Rename sound", (p) => {
                  p.assets.find((x) => x.id === a.id)!.name = e.target.value;
                })
              }
            />
            <button title="Preview sound" onClick={() => onPreview(a.id)}>
              <Play size={13} />
            </button>
            <button
              title="Add cue to selected move in Inspector / playhead"
              onClick={() => {
                edit("Add sound cue", (p) => {
                  const s = segments(p).find(
                    (s) => time >= s.start && time < s.end,
                  );
                  p.cues.push({
                    id: uid(),
                    assetId: a.id,
                    moveId: s ? p.moves[s.index].id : null,
                    time: s ? time - s.landing : time,
                    volume: 1,
                    bus: "dramatic",
                  });
                });
                onStatus("Sound cue added at the playhead.");
              }}
            >
              <Plus size={13} />
            </button>
          </div>
        ))}
        {project.cues.map((c, i) => (
          <div className="cue-row" key={c.id}>
            <span>
              {project.assets.find((a) => a.id === c.assetId)?.name ??
                "Missing sound"}
            </span>
            <small>{c.moveId ? "Landing offset" : "Project time"}</small>
            <input
              aria-label={`Cue ${i + 1} time`}
              type="number"
              min={-60}
              max={86400}
              step={0.01}
              value={c.time}
              onChange={(e) =>
                edit("Cue time", (p) => {
                  p.cues[i].time = Number(e.target.value);
                })
              }
            />
            <Range
              label={`Cue ${i + 1} volume`}
              value={c.volume}
              onChange={(v) =>
                edit("Cue volume", (p) => {
                  p.cues[i].volume = v;
                })
              }
              min={0}
              max={2}
            />
            <Select
              label={`Cue ${i + 1} bus`}
              value={c.bus}
              options={["chess", "dramatic"]}
              onChange={(v) =>
                edit("Cue bus", (p) => {
                  p.cues[i].bus = v;
                })
              }
            />
            <button
              title="Remove cue"
              onClick={() =>
                edit("Remove cue", (p) => {
                  p.cues.splice(i, 1);
                })
              }
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </Section>
    </>
  );
}
export function DesignPanel({
  project,
  edit,
  onImage,
  onBadge,
  onPack,
}: {
  project: Project;
  edit: Edit;
  onImage: () => void;
  onBadge: (label: string) => void;
  onPack: () => void;
}) {
  const [badge, setBadge] = useState("brilliant"),
    layout = project.layouts[project.output];
  const ambient = (key: string, value: unknown) =>
    edit(`ambient:${key}`, (p) => {
      Object.assign(p.ambient, { [key]: value });
    });
  return (
    <>
      <Section title="Composition">
        <Select
          label="Output composition"
          value={project.output}
          options={FORMATS}
          onChange={(v) =>
            edit("Output format", (p) => {
              p.output = v;
            })
          }
        />
        <Range
          label="Layout zoom"
          value={layout.zoom}
          onChange={(v) =>
            edit("Layout zoom", (p) => {
              p.layouts[p.output].zoom = v;
            })
          }
          min={0.6}
          max={2}
        />
        <Range
          label="Layout X"
          value={layout.x}
          onChange={(v) =>
            edit("Layout X", (p) => {
              p.layouts[p.output].x = v;
            })
          }
          min={-3}
          max={3}
        />
        <Range
          label="Layout Y"
          value={layout.y}
          onChange={(v) =>
            edit("Layout Y", (p) => {
              p.layouts[p.output].y = v;
            })
          }
          min={-5}
          max={5}
        />
        <Select
          label="Background treatment"
          value={layout.background}
          options={["solid", "gradient", "particles", "image"]}
          onChange={(v) =>
            edit("Background treatment", (p) => {
              p.layouts[p.output].background = v;
              if (v === "particles") p.ambient.enabled = true;
            })
          }
        />
        <button className="wide" onClick={onImage}>
          <Upload size={14} /> Import background image
        </button>
        <p className="hint">
          Square-in-vertical retains a square board area with space above and
          below. Layout Y shifts the framing; the board is never stretched.
        </p>
      </Section>
      <Section title="Board palette">
        <Select
          label="Piece set"
          value={project.style.pieceSet ?? "lichess"}
          options={[
            ["lichess", "Lichess (Cburnett)"],
            ["chesscom", "Nibbler (Merida)"],
          ]}
          onChange={(v) =>
            edit("Piece set", (p) => {
              p.style.pieceSet = v;
            })
          }
        />
        <Color
          label="Light squares"
          value={project.style.light}
          onChange={(v) =>
            edit("Light squares", (p) => {
              p.style.light = v;
            })
          }
        />
        <Color
          label="Dark squares"
          value={project.style.dark}
          onChange={(v) =>
            edit("Dark squares", (p) => {
              p.style.dark = v;
            })
          }
        />
        <Color
          label="Background"
          value={project.style.background}
          onChange={(v) =>
            edit("Background", (p) => {
              p.style.background = v;
            })
          }
        />
        <Select
          label="Orientation"
          value={project.style.orientation}
          options={["white", "black"]}
          onChange={(v) =>
            edit("Orientation", (p) => {
              p.style.orientation = v;
            })
          }
        />
        <Toggle
          label="Coordinates"
          checked={project.style.coordinates}
          onChange={(v) =>
            edit("Coordinates", (p) => {
              p.style.coordinates = v;
            })
          }
        />
      </Section>
      <Section title="Snow & atmosphere">
        <Toggle
          label="Ambient particles"
          checked={project.ambient.enabled}
          onChange={(v) => ambient("enabled", v)}
        />
        <Select
          label="Particle layer"
          value={project.ambient.layer}
          options={["over", "behind", "both"]}
          onChange={(v) => ambient("layer", v)}
        />
        <Range
          label="Density"
          value={project.ambient.density}
          onChange={(v) => ambient("density", v)}
          min={0}
          max={300}
          step={1}
        />
        <Range
          label="Particle size"
          value={project.ambient.size}
          onChange={(v) => ambient("size", v)}
          min={0.01}
          max={0.15}
        />
        <Range
          label="Particle opacity"
          value={project.ambient.opacity}
          onChange={(v) => ambient("opacity", v)}
          min={0}
          max={1}
        />
        <Range
          label="Speed"
          value={project.ambient.speed}
          onChange={(v) => ambient("speed", v)}
          min={0}
          max={2}
        />
        <Range
          label="Drift"
          value={project.ambient.drift}
          onChange={(v) => ambient("drift", v)}
          min={-2}
          max={2}
        />
        <Range
          label="Direction"
          value={project.ambient.direction}
          onChange={(v) => ambient("direction", v)}
          min={-180}
          max={180}
          step={1}
          unit="°"
        />
        <Range
          label="Softness"
          value={project.ambient.softness}
          onChange={(v) => ambient("softness", v)}
          min={0}
          max={1}
        />
        <Range
          label="Depth variation"
          value={project.ambient.depth}
          onChange={(v) => ambient("depth", v)}
          min={0}
          max={1}
        />
        <Color
          label="Particle color"
          value={project.ambient.color}
          onChange={(v) => ambient("color", v)}
        />
        <label className="text-field">
          Random seed
          <input
            type="number"
            aria-label="Random seed"
            value={project.ambient.seed}
            onChange={(e) =>
              ambient("seed", Math.round(Number(e.target.value)))
            }
          />
        </label>
      </Section>
      <Section title="Beat-driven dark squares">
        <Toggle
          label="Music color pulses"
          checked={project.pulse.enabled}
          onChange={(v) =>
            edit("Pulses", (p) => {
              p.pulse.enabled = v;
            })
          }
        />
        <Color
          label="Pulse color"
          value={project.pulse.color}
          onChange={(v) =>
            edit("Pulse color", (p) => {
              p.pulse.color = v;
            })
          }
        />
        <Range
          label="Pulse intensity"
          value={project.pulse.intensity}
          onChange={(v) =>
            edit("Pulse intensity", (p) => {
              p.pulse.intensity = v;
            })
          }
          min={0}
          max={1}
        />
        <Range
          label="Attack"
          value={project.pulse.attack}
          onChange={(v) =>
            edit("Pulse attack", (p) => {
              p.pulse.attack = v;
            })
          }
          min={0.01}
          max={0.5}
          unit="s"
        />
        <Range
          label="Decay"
          value={project.pulse.decay}
          onChange={(v) =>
            edit("Pulse decay", (p) => {
              p.pulse.decay = v;
            })
          }
          min={0.05}
          max={2}
          unit="s"
        />
        <Select
          label="Pulse beats"
          value={project.pulse.selection}
          options={["all", "strong", "selected"]}
          onChange={(v) =>
            edit("Pulse selection", (p) => {
              p.pulse.selection = v;
            })
          }
        />
      </Section>
      <Section title="Local classification assets" open={false}>
        <p className="hint">
          Original badges work out of the box. Import permitted Chess.com or
          other PNG/WebP artwork locally. No official pack is redistributed.
        </p>
        <Select
          label="Badge asset"
          value={badge}
          options={[
            "book",
            "brilliant",
            "best",
            "good",
            "inaccuracy",
            "mistake",
            "blunder",
          ]}
          onChange={setBadge}
        />
        <button className="wide" onClick={onPack}>
          Import local badge pack manifest
        </button>
        <button className="wide" onClick={() => onBadge(badge)}>
          Import image for {badge}
        </button>
        {project.badgePack[badge] && (
          <button
            className="wide"
            onClick={() =>
              edit("Restore original badge", (p) => {
                delete p.badgePack[badge];
              })
            }
          >
            Restore original artwork
          </button>
        )}
      </Section>
    </>
  );
}
export function AnalysisPanel({
  project,
  selected,
  edit,
  busy,
  progress,
  onAnalyze,
  onCancel,
}: {
  project: Project;
  selected: number;
  edit: Edit;
  busy: boolean;
  progress: string;
  onAnalyze: (mode: "book" | "engine" | "both", all: boolean) => void;
  onCancel: () => void;
}) {
  const [scope, setScope] = useState("selected"),
    m = project.moves[selected];
  return (
    <>
      <div className="panel-intro">
        <span className="eyebrow">SUGGESTIONS, NOT VERDICTS</span>
        <h2>Give moves context.</h2>
        <p>
          Opening data and a local engine inform badges. Your override is always
          final.
        </p>
      </div>
      <Section title="Run analysis">
        <Select
          label="Analyze scope"
          value={scope}
          options={[
            ["selected", "Selected move"],
            ["all", "Entire line"],
          ]}
          onChange={setScope}
        />
        <div className="button-stack">
          {(["book", "engine", "both"] as const).map((mode) => (
            <button
              key={mode}
              disabled={busy || !project.moves.length}
              onClick={() => onAnalyze(mode, scope === "all")}
            >
              {mode === "book"
                ? "Lichess Masters"
                : mode === "engine"
                  ? "Local Stockfish"
                  : "Book + engine"}
            </button>
          ))}
        </div>
        {busy && (
          <button className="wide" onClick={onCancel}>
            Cancel analysis
          </button>
        )}
        <p className="hint">{progress || "No analysis running."}</p>
      </Section>
      <Section title="Current move">
        {m ? (
          <>
            {m.analysis.book ? (
              <div className="analysis-result">
                <strong>Book · {m.analysis.book.state}</strong>
                <span>
                  {m.analysis.book.games} games ·{" "}
                  {(m.analysis.book.frequency * 100).toFixed(2)}%
                </span>
                <p>{m.analysis.book.message}</p>
              </div>
            ) : (
              <p className="hint">Book: not analyzed</p>
            )}
            {m.analysis.engine ? (
              <div className="analysis-result">
                <strong>
                  Engine ·{" "}
                  {m.analysis.engine.state === "done"
                    ? m.analysis.engine.label
                    : "unavailable"}
                </strong>
                <span>
                  {m.analysis.engine.mate !== null
                    ? `Mate ${m.analysis.engine.mate}`
                    : `Loss ${m.analysis.engine.loss.toFixed(0)} cp`}{" "}
                  · depth {m.analysis.engine.depth}
                </span>
                <p>{m.analysis.engine.message}</p>
              </div>
            ) : (
              <p className="hint">Engine: not analyzed</p>
            )}
          </>
        ) : (
          <p className="hint">Select a move first.</p>
        )}
      </Section>
      <Section title="Analysis limits" open={false}>
        <Range
          label="Minimum book games"
          value={project.analysisSettings.minGames}
          onChange={(v) =>
            edit("Book minimum", (p) => {
              p.analysisSettings.minGames = v;
            })
          }
          min={1}
          max={1000}
          step={1}
        />
        <Range
          label="Minimum book frequency"
          value={project.analysisSettings.frequency}
          onChange={(v) =>
            edit("Book frequency", (p) => {
              p.analysisSettings.frequency = v;
            })
          }
          min={0}
          max={0.2}
          step={0.001}
        />
        <Range
          label="Opening cutoff (plies)"
          value={project.analysisSettings.cutoff}
          onChange={(v) =>
            edit("Book cutoff", (p) => {
              p.analysisSettings.cutoff = v;
            })
          }
          min={1}
          max={100}
          step={1}
        />
        <Range
          label="Engine depth limit"
          value={project.analysisSettings.depth}
          onChange={(v) =>
            edit("Engine depth", (p) => {
              p.analysisSettings.depth = v;
            })
          }
          min={1}
          max={24}
          step={1}
        />
        <Range
          label="Engine time per search"
          value={project.analysisSettings.moveTime}
          onChange={(v) =>
            edit("Engine time", (p) => {
              p.analysisSettings.moveTime = v;
            })
          }
          min={100}
          max={10000}
          step={100}
          unit="ms"
        />
        <p className="hint">
          2 engine threads, 128 MB hash. Best &lt;35 cp good; 35–89 inaccuracy;
          90–179 mistake; ≥180 blunder. Brilliant is manual.
        </p>
      </Section>
    </>
  );
}
export function SettingsPanel({
  settings,
  onConfigure,
  onLogs,
  assets,
  onRelink,
  onRemove,
  edit,
  onRefresh,
}: {
  settings: Settings | null;
  onConfigure: (key: "stockfish" | "ffmpeg" | "token", value?: string) => void;
  onLogs: () => void;
  assets: Asset[];
  onRelink: (a: Asset) => void;
  onRemove: (id: string) => void;
  edit: Edit;
  onRefresh: () => void;
}) {
  const [token, setToken] = useState("");
  return (
    <>
      <Section title="Local tools">
        <p className="hint">
          FFmpeg and Stockfish are separate local executables. Choose trusted
          builds; no binaries are downloaded by the app.
        </p>
        <code>{settings?.ffmpeg ?? "ffmpeg"}</code>
        <button className="wide" onClick={() => onConfigure("ffmpeg")}>
          Choose FFmpeg executable
        </button>
        <code>{settings?.stockfish ?? "stockfish"}</code>
        <button className="wide" onClick={() => onConfigure("stockfish")}>
          Choose Stockfish executable
        </button>
      </Section>
      <Section title="Masters authentication">
        <p className="hint">
          The current official API specifies OAuth2. If required, enter a
          Lichess token here. Windows encrypts it for your local user. It is
          never saved in projects.
        </p>
        <input
          aria-label="Lichess token"
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder={
            settings?.hasToken
              ? "Token stored securely"
              : "Optional local token"
          }
          autoComplete="off"
        />
        <button
          className="wide"
          disabled={!token.trim()}
          onClick={() => {
            onConfigure("token", token);
            setToken("");
          }}
        >
          Store token locally
        </button>
        {settings?.hasToken && (
          <button className="wide" onClick={() => onConfigure("token", "")}>
            Remove stored token
          </button>
        )}
      </Section>
      <Section title="Project assets">
        <button className="wide" onClick={onRefresh}>
          <RefreshCw size={14} /> Reload & check assets
        </button>
        {assets.map((a) => (
          <details className="asset-detail" key={a.id}>
            <summary>{a.name}</summary>
            <code>{a.path}</code>
            <label className="text-field">
              Source
              <input
                value={a.source}
                maxLength={1000}
                onChange={(e) =>
                  edit("Asset source", (p) => {
                    p.assets.find((x) => x.id === a.id)!.source =
                      e.target.value;
                  })
                }
              />
            </label>
            <label className="text-field">
              Usage guidance
              <textarea
                value={a.guidance}
                onChange={(e) =>
                  edit("Asset guidance", (p) => {
                    p.assets.find((x) => x.id === a.id)!.guidance =
                      e.target.value;
                  })
                }
              />
            </label>
            <button onClick={() => onRelink(a)}>
              <Link2 size={13} /> Relink
            </button>
            <button onClick={() => onRemove(a.id)}>
              <Trash2 size={13} /> Remove
            </button>
          </details>
        ))}
      </Section>
      <Section title="Diagnostics">
        <button className="wide" onClick={onLogs}>
          Open logs folder
        </button>
        <p className="hint">
          Activity logs rotate locally. Credentials and every-frame messages are
          excluded.
        </p>
      </Section>
    </>
  );
}
