import { settingHelp } from "./help";
import { useState } from "react";
import {
  effect,
  rainbowDefaults,
  blank,
  presets,
  formats,
  badgeNames,
  type Project,
  type Asset,
  type Preset,
  type Effect,
} from "../core/project";
import { selectLine } from "../core/chess";
import { align, syncMarkers } from "../core/audio";
import { badge, segments } from "../core/timeline";
import {
  Section,
  Range,
  Toggle,
  Color,
  Select,
  ScrubNumber,
  clock,
} from "./controls";
import { presetLabels } from "./Inspector";
import type { Edit } from "./state";
import type { Settings } from "../bridge";
export interface PanelProps {
  project: Project;
  edit: Edit;
  replace: (p: Project) => void;
  selected: number;
  checked: Set<string>;
  setChecked: (s: Set<string>) => void;
  select: (
    i: number,
    modifiers?: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean },
  ) => void;
  time: number;
  seek: (t: number) => void;
  assets: Record<string, string>;
  missing: Set<string>;
  settings: Settings;
  setSettings: (s: Settings) => void;
  run: (fn: () => Promise<unknown>) => void;
  message: (s: string) => void;
  importText: (text: string, kind: "pgn" | "fen", preserve: boolean) => void;
  importAsset: (
    kind: "audio" | "image",
    use: "music" | "sound" | "background" | "badge",
    badge?: string,
  ) => Promise<void>;
  analyzeMusic: () => Promise<void>;
  onOpen: () => void;
  openRecent: (s: string) => void;
  recent: string[];
  path: string | null;
  promotion: string;
  setPromotion: (s: string) => void;
  analysisProgress: { done: number; total: number } | null;
}
function RainbowControls({
  label,
  settings,
  edit,
}: {
  label: string;
  settings: Project["pulse"]["rainbow"];
  edit: (fn: (v: Project["pulse"]["rainbow"]) => void) => void;
}) {
  return (
    <div className="rainbow-controls">
      <Toggle
        label={label + " rainbow"}
        checked={settings.enabled}
        onChange={(v) =>
          edit((r) => {
            r.enabled = v;
          })
        }
      />
      {settings.enabled && (
        <>
          <p className="hint">
            Choose the colors to cycle through. Uncheck a color to skip it; edit
            the swatch to choose a darker shade.
          </p>
          <Range
            label={label + " color cycle length"}
            value={settings.duration}
            min={1}
            max={120}
            step={1}
            unit="s"
            resetValue={rainbowDefaults.duration}
            onChange={(v) =>
              edit((r) => {
                r.duration = v;
              })
            }
          />
          {settings.colors.map((c, i) => (
            <div className="button-row" key={i}>
              <Toggle
                label={label + " color " + (i + 1) + " enabled"}
                checked={settings.active[i]}
                onChange={(v) =>
                  edit((r) => {
                    r.active[i] = v;
                  })
                }
              />
              <Color
                label={label + " color " + (i + 1)}
                value={c}
                onChange={(v) =>
                  edit((r) => {
                    r.colors[i] = v;
                  })
                }
              />
              <button
                title="Reset color"
                aria-label={"Reset " + label + " color " + (i + 1)}
                onClick={() =>
                  edit((r) => {
                    r.colors[i] = rainbowDefaults.colors[i];
                  })
                }
              >
                ↺
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
export function GamePanel(q: PanelProps) {
  const { project: p, edit } = q;
  const [text, setText] = useState(""),
    [kind, setKind] = useState<"pgn" | "fen">("pgn"),
    [preserve, setPreserve] = useState(true);
  return (
    <>
      <Section title="Game & variations">
        <Select
          label="Variation"
          value={String(p.line)}
          options={p.lines.map((l, i) => [String(i), l.name] as const)}
          onChange={(v) => q.run(async () => q.replace(selectLine(p, +v)))}
        />
        <button className="wide" onClick={q.onOpen}>
          Open saved composition…
        </button>
        <label className="text-field">
          Composition name
          <input
            title={settingHelp("Composition name")}
            aria-description={settingHelp("Composition name")}
            aria-label={"Composition name"}
            value={p.title}
            onChange={(e) =>
              edit("Title", (p) => {
                p.title = e.target.value;
              })
            }
          />
        </label>
      </Section>
      <Section title="Import a game">
        <div className="segmented">
          {(["pgn", "fen"] as const).map((v) => (
            <button
              className={kind === v ? "active" : ""}
              title={
                v === "pgn"
                  ? "Import a game with PGN moves and variations."
                  : "Import a starting board position from a FEN string."
              }
              aria-description={
                v === "pgn"
                  ? "Import a game with PGN moves and variations."
                  : "Import a starting board position from a FEN string."
              }
              key={v}
              onClick={() => setKind(v)}
            >
              {v.toUpperCase()}
            </button>
          ))}
        </div>
        <textarea
          title={settingHelp("Game text")}
          aria-description={settingHelp("Game text")}
          aria-label="Game text"
          rows={5}
          placeholder={
            kind === "pgn" ? "1. e4 e5 2. Nf3 Nc6…" : "Paste a FEN position…"
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Toggle
          label="Preserve matching move effects"
          checked={preserve}
          onChange={setPreserve}
        />
        <div className="button-row">
          <button
            onClick={() =>
              q.run(async () => {
                const t = await window.studio.chooseText(kind);
                if (t !== null) setText(t);
              })
            }
          >
            Choose file…
          </button>
          <button
            className="primary"
            disabled={!text.trim()}
            onClick={() => q.importText(text, kind, preserve)}
          >
            Import {kind.toUpperCase()}
          </button>
        </div>
        <p className="hint">
          Click a piece in the preview, then a legal destination to enter a
          move. New board input creates a separate variation.
        </p>
        <Select
          label="Promote pawn to"
          value={q.promotion}
          options={[
            ["q", "Queen"],
            ["r", "Rook"],
            ["b", "Bishop"],
            ["n", "Knight"],
          ]}
          onChange={q.setPromotion}
        />
      </Section>
      <div className="list-heading">
        <span>{p.moves.length} PLIES</span>
        <button
          onClick={() =>
            q.setChecked(
              q.checked.size === p.moves.length
                ? new Set()
                : new Set(p.moves.map((m) => m.id)),
            )
          }
        >
          {q.checked.size ? "Clear checks" : "Check all"}
        </button>
      </div>
      <div className="move-list">
        {p.moves.map((m, i) => (
          <div
            className={"move-row " + (q.selected === i ? "active" : "")}
            key={m.id}
          >
            <input
              title={settingHelp("Check move " + (i + 1))}
              aria-description={settingHelp("Check move " + (i + 1))}
              aria-label={"Check move " + (i + 1)}
              type="checkbox"
              checked={q.checked.has(m.id)}
              onChange={(e) => {
                const s = new Set(q.checked);
                if (e.target.checked) s.add(m.id);
                else s.delete(m.id);
                q.setChecked(s);
              }}
            />
            <button onClick={(event) => q.select(i, event)}>
              <span className="muted">
                {i % 2 === 0 ? Math.floor(i / 2) + 1 + "." : "…"}
              </span>
              <strong>{m.san}</strong>
              <span className="badge-mini">{badge(m) ?? ""}</span>
              <small>{m.effect.duration.toFixed(2)}s</small>
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
export function StylesPanel(q: PanelProps) {
  const [scope, setScope] = useState<"selected" | "checked" | "all">(
    "selected",
  );
  const apply = (e: Effect, preserveAccents = false) =>
    q.edit("Apply style", (p) => {
      p.moves.forEach((m, i) => {
        if (
          scope === "all" ||
          (scope === "selected" && i === q.selected) ||
          (scope === "checked" && q.checked.has(m.id))
        ) {
          const b = m.effect.badge,
            c = m.effect.cameras;
          m.effect = {
            ...structuredClone(e),
            badge: b,
            cameras: c,
            ...(preserveAccents
              ? { light: m.effect.light, jam: m.effect.jam }
              : {}),
          };
        }
      });
    });
  return (
    <>
      <Section title="Move styles">
        <Select
          label="Apply style to"
          value={scope}
          options={[
            ["selected", "Selected move"],
            ["checked", "Checked moves"],
            ["all", "Every move"],
          ]}
          onChange={setScope}
        />
        <div className="preset-grid">
          {presets.map((v) => (
            <button
              className="preset-card"
              title={`${presetLabels[v]}: apply this animation using the scope chosen in Apply style to.`}
              key={v}
              onClick={() => apply(effect(v), true)}
            >
              <span>
                {
                  {
                    slide: "↗",
                    soft: "⌁",
                    spin: "⟳",
                    flip: "↻",
                    sway: "〰",
                    "sway-half": "◜",
                    hop: "⌒",
                    dramatic: "✦",
                    capture: "◎",
                    finale: "✹",
                  }[v]
                }
              </span>
              <strong>{presetLabels[v]}</strong>
              <small>
                {v === "sway"
                  ? "Lean, reverse, settle"
                  : v === "spin"
                    ? "A thin solid turn"
                    : v === "capture"
                      ? "Grow, glow, return"
                      : v === "flip"
                        ? "Fast–slow–fast 360° turn"
                        : v === "finale"
                          ? "Checkmate-style impact and beat zoom"
                          : "Refine in the inspector"}
              </small>
            </button>
          ))}
        </div>
      </Section>
      <button
        className="wide primary"
        onClick={() =>
          q.edit("Apply selected to all and default", (p) => {
            const e = p.moves[q.selected]?.effect;
            if (!e) return;
            p.defaults = structuredClone(e);
            p.moves.forEach((m) => {
              const badge = m.effect.badge,
                cameras = m.effect.cameras;
              m.effect = { ...structuredClone(e), badge, cameras };
            });
          })
        }
      >
        Apply selected action to all moves & default
      </button>
      <Section title="Your saved presets">
        {q.project.presets.length ? (
          q.project.presets.map((v, i) => (
            <div className="button-row" key={i}>
              <button className="grow" onClick={() => apply(v.effect)}>
                {v.name}
              </button>
              <button
                aria-label={"Delete " + v.name}
                onClick={() =>
                  q.edit("Delete preset", (p) => {
                    p.presets.splice(i, 1);
                  })
                }
              >
                ×
              </button>
            </div>
          ))
        ) : (
          <p className="hint">
            Save a refined move as a preset from the Motion inspector.
          </p>
        )}
        <button
          className="wide"
          onClick={() =>
            q.edit("Default style", (p) => {
              if (p.moves[q.selected])
                p.defaults = structuredClone(p.moves[q.selected].effect);
            })
          }
        >
          Use selected move as default for new imports
        </button>
      </Section>
    </>
  );
}
export function MusicPanel(q: PanelProps) {
  const p = q.project,
    edit = q.edit;
  const [preview, setPreview] = useState<{
      project: Project;
      aligned: number;
      skipped: number;
    } | null>(null),
    [mode, setMode] = useState<"all" | "alternate" | "fourth" | "accents">(
      "all",
    ),
    [soundId, setSoundId] = useState("");
  const changeMusic = (key: keyof Project["music"], value: unknown) =>
    edit("Music " + key, (p) => {
      (p.music as any)[key] = value;
      const synced = syncMarkers(p);
      p.beats = synced.beats;
    });
  return (
    <>
      <Section
        title="Music"
        onReset={() =>
          edit("Reset music settings", (p) => {
            p.music = {
              ...blank().music,
              asset: p.music.asset,
              sourceDuration: p.music.sourceDuration,
            };
            p.beats = syncMarkers(p).beats;
          })
        }
      >
        <button
          className="wide primary"
          onClick={() => q.run(() => q.importAsset("audio", "music"))}
        >
          + Import music
        </button>
        <p className="asset-name">
          {p.assets.find((a) => a.id === p.music.asset)?.name ??
            "No music selected"}
        </p>
        <Toggle
          label="Mute music"
          checked={p.music.muted}
          onChange={(v) => changeMusic("muted", v)}
        />
        {(
          [
            "volume",
            "offset",
            "trimStart",
            "trimEnd",
            "fadeIn",
            "fadeOut",
          ] as const
        ).map((k) => (
          <Range
            key={k}
            label={
              {
                volume: "Music volume",
                offset: "Project start offset",
                trimStart: "Source trim start",
                trimEnd: "Source trim end (0 = full)",
                fadeIn: "Fade in",
                fadeOut: "Fade out",
              }[k]
            }
            value={p.music[k]}
            resetValue={blank().music[k]}
            min={k === "offset" ? -60 : 0}
            max={
              k === "volume"
                ? 2
                : k === "fadeIn" || k === "fadeOut"
                  ? 30
                  : k.startsWith("trim")
                    ? 3600
                    : 60
            }
            step={k === "volume" ? 0.01 : 0.05}
            unit={k === "volume" ? "" : "s"}
            onChange={(v) => changeMusic(k, v)}
          />
        ))}
        <p className="hint">
          Volume points smoothly change music level over time. At the playhead,
          set Music volume, then add a point.
        </p>
        <button
          className="wide"
          onClick={() =>
            edit("Add music volume point", (p) => {
              const t = Math.round(q.time * 1000) / 1000;
              p.music.volumePoints = [
                ...p.music.volumePoints.filter((point) => point.time !== t),
                { time: t, value: p.music.volume },
              ].sort((a, b) => a.time - b.time);
            })
          }
        >
          Add volume point at {clock(q.time)}
        </button>
        {p.music.volumePoints.map((point) => (
          <div key={point.time}>
            <button onClick={() => q.seek(point.time)}>
              Go to {clock(point.time)} · {point.value.toFixed(2)}
            </button>
            <button
              onClick={() =>
                edit("Remove music volume point", (p) => {
                  p.music.volumePoints = p.music.volumePoints.filter(
                    (item) => item.time !== point.time,
                  );
                })
              }
            >
              Remove
            </button>
          </div>
        ))}
        <button
          className="wide"
          disabled={!p.music.asset || p.beatsLocked}
          onClick={() => q.run(q.analyzeMusic)}
        >
          Analyze waveform & likely beats
        </button>
        <p className="hint">
          Beat detection follows audio transients. Correct markers manually for
          syncopated or quiet music.
        </p>
      </Section>
      <Section title="Land moves on beats">
        <Select
          label="Use markers"
          value={mode}
          options={[
            ["all", "All enabled markers"],
            ["alternate", "Every second marker"],
            ["fourth", "Every fourth marker"],
            ["accents", "Strong accents only"],
          ]}
          onChange={setMode}
        />
        <button className="wide" onClick={() => setPreview(align(p, mode))}>
          Preview timing arrangement
        </button>
        {preview && (
          <div className="notice">
            <p>
              {preview.aligned} landings aligned; {preview.skipped} locked or
              unmatched moves left alone.
            </p>
            <p>Duration: {segments(preview.project).at(-1)?.end.toFixed(2)}s</p>
            <div className="button-row">
              <button
                onClick={() => {
                  q.replace(preview.project);
                  setPreview(null);
                }}
              >
                Apply timing
              </button>
              <button onClick={() => setPreview(null)}>Cancel</button>
            </div>
          </div>
        )}
        <p className="hint">
          Uses 0.5–5 second move durations. Timing locks are respected. Changes
          are undoable.
        </p>
      </Section>
      <Section title="Beat markers">
        <Toggle
          label="Lock beat markers"
          checked={p.beatsLocked}
          onChange={(v) =>
            edit("Lock beat markers", (p) => {
              p.beatsLocked = v;
            })
          }
        />
        <fieldset
          disabled={p.beatsLocked}
          style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
        >
          <button
            className="wide"
            onClick={() =>
              edit("Add beat", (p) => {
                p.beats.push({
                  id: crypto.randomUUID(),
                  time: q.time,
                  accent: true,
                  enabled: true,
                });
                p.beats.sort((a, b) => a.time - b.time);
              })
            }
          >
            + Marker at playhead
          </button>
          <div className="marker-list">
            {p.beats.map((b) => (
              <div className="marker-row" key={b.id}>
                <input
                  title={settingHelp("Enable beat")}
                  aria-description={settingHelp("Enable beat")}
                  aria-label="Enable beat"
                  type="checkbox"
                  checked={b.enabled}
                  onChange={(e) =>
                    edit("Enable beat", (p) => {
                      p.beats.find((v) => v.id === b.id)!.enabled =
                        e.target.checked;
                    })
                  }
                />
                <ScrubNumber
                  title={settingHelp("Beat time")}
                  aria-description={settingHelp("Beat time")}
                  aria-label="Beat time"
                  min={0}
                  max={7200}
                  step={0.01}
                  value={Number(b.time.toFixed(3))}
                  onValueChange={(time) =>
                    edit("Beat time", (p) => {
                      const v = p.beats.find((v) => v.id === b.id)!;
                      v.time = time;
                      if (v.sourceTime !== undefined)
                        v.sourceTime =
                          time + p.music.trimStart - p.music.offset;
                    })
                  }
                />
                <button
                  className={b.accent ? "accent" : ""}
                  title={settingHelp("Beat accent")}
                  aria-label="Beat accent"
                  onClick={() =>
                    edit("Beat accent", (p) => {
                      const v = p.beats.find((v) => v.id === b.id)!;
                      v.accent = !v.accent;
                    })
                  }
                >
                  {b.accent ? "●" : "○"}
                </button>
                <button
                  aria-label="Delete beat"
                  onClick={() =>
                    edit("Delete beat", (p) => {
                      p.beats = p.beats.filter((v) => v.id !== b.id);
                    })
                  }
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </fieldset>
      </Section>
      <Section
        title="Sound library"
        onReset={() =>
          edit("Reset audio", (p) => {
            p.audio = blank().audio;
          })
        }
      >
        <Toggle
          label="Automatic move & capture cues"
          checked={p.audio.automatic}
          onChange={(v) =>
            edit("Automatic sounds", (p) => {
              p.audio.automatic = v;
            })
          }
        />
        <Range
          label="Chess sounds volume"
          value={p.audio.chess}
          resetValue={blank().audio.chess}
          min={0}
          max={2}
          onChange={(v) =>
            edit("Chess volume", (p) => {
              p.audio.chess = v;
            })
          }
        />
        <Range
          label="Effect sounds volume"
          value={p.audio.effects}
          resetValue={blank().audio.effects}
          min={0}
          max={2}
          onChange={(v) =>
            edit("Effects volume", (p) => {
              p.audio.effects = v;
            })
          }
        />
        <button
          className="wide"
          onClick={() => q.run(() => q.importAsset("audio", "sound"))}
        >
          + Import sound
        </button>
        <Select
          label="Sound to assign"
          value={soundId}
          options={[
            ["", "Choose a sound"],
            ...p.assets
              .filter((a) => a.kind === "audio")
              .map((a) => [a.id, a.name] as [string, string]),
          ]}
          onChange={setSoundId}
        />
        {soundId && q.assets[soundId] && (
          <audio controls src={q.assets[soundId]} />
        )}
        <button
          className="wide"
          disabled={!soundId || !p.moves[q.selected]}
          onClick={() =>
            edit("Add sound cue", (p) => {
              p.cues.push({
                id: crypto.randomUUID(),
                asset: soundId,
                move: p.moves[q.selected].id,
                time: 0,
                volume: 1,
                kind: "custom",
                bus: "effects",
              });
            })
          }
        >
          Assign to selected move landing
        </button>
        {p.cues.map((c) => (
          <div className="cue" key={c.id}>
            <strong>
              {p.assets.find((a) => a.id === c.asset)?.name ?? c.kind}
            </strong>
            <small>
              {c.move
                ? "Move " + (p.moves.findIndex((m) => m.id === c.move) + 1)
                : "Project time"}
            </small>
            <Range
              label="Cue offset"
              value={c.time}
              resetValue={0}
              min={c.move ? -10 : 0}
              max={c.move ? 10 : 600}
              step={0.01}
              onChange={(v) =>
                edit("Cue time", (p) => {
                  p.cues.find((v) => v.id === c.id)!.time = v;
                })
              }
            />
            <Range
              label="Cue volume"
              value={c.volume}
              resetValue={1}
              min={0}
              max={2}
              onChange={(v) =>
                edit("Cue volume", (p) => {
                  p.cues.find((v) => v.id === c.id)!.volume = v;
                })
              }
            />
            <Select
              label="Sound bus"
              value={c.bus}
              options={["chess", "effects"]}
              onChange={(v) =>
                edit("Cue bus", (p) => {
                  p.cues.find((x) => x.id === c.id)!.bus = v;
                })
              }
            />
            <button
              onClick={() =>
                edit("Delete cue", (p) => {
                  p.cues = p.cues.filter((v) => v.id !== c.id);
                })
              }
            >
              Remove cue
            </button>
          </div>
        ))}
      </Section>
    </>
  );
}
export function ScenePanel(q: PanelProps) {
  const p = q.project,
    edit = q.edit,
    [badgeKind, setBadgeKind] = useState("brilliant");
  const layout = p.layouts[p.format];
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
          Nocturne's vector artwork, with a thin solid edge and mirrored reverse
          face.
        </p>
        {(["light", "dark", "rim", "background", "accent"] as const).map(
          (k) => (
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
          ),
        )}
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
      <Section
        title="Snow particles · amount & appearance"
        onReset={() =>
          edit("Reset ambient", (p) => {
            p.ambient = blank().ambient;
          })
        }
      >
        <p className="hint">
          Adjust the number, size, speed and transparency of the snow here.
        </p>
        <Toggle
          label="Inside board only"
          checked={p.ambient.insideBoard}
          onChange={(v) =>
            edit("Snow area", (p) => {
              p.ambient.insideBoard = v;
            })
          }
        />
        <Toggle
          label="Ambient particles"
          checked={p.ambient.enabled}
          onChange={(v) =>
            edit("Particles", (p) => {
              p.ambient.enabled = v;
            })
          }
        />
        <Select
          label="Particle layer"
          value={p.ambient.layer}
          options={["over", "behind", "both"]}
          onChange={(v) =>
            edit("Particle layer", (p) => {
              p.ambient.layer = v;
            })
          }
        />
        {(
          [
            "count",
            "size",
            "opacity",
            "speed",
            "drift",
            "direction",
            "depth",
            "softness",
            "seed",
          ] as const
        ).map((k) => (
          <Range
            key={k}
            label={"Particle " + k}
            value={p.ambient[k]}
            resetValue={blank().ambient[k]}
            min={
              k === "size"
                ? 0.01
                : k === "softness"
                  ? 0.05
                  : k === "direction"
                    ? -2
                    : 0
            }
            max={
              k === "count"
                ? 400
                : k === "size"
                  ? 0.35
                  : k === "seed"
                    ? 1000000
                    : k === "opacity" || k === "softness"
                      ? 1
                      : 2
            }
            step={k === "count" || k === "seed" ? 1 : 0.01}
            onChange={(v) =>
              edit("Particle " + k, (p) => {
                p.ambient[k] = v;
              })
            }
          />
        ))}
        <RainbowControls
          label="Snow"
          settings={p.ambient.rainbow}
          edit={(fn) => edit("Snow rainbow", (p) => fn(p.ambient.rainbow))}
        />
        <Color
          label="Particle color"
          value={p.ambient.color}
          onChange={(v) =>
            edit("Particle color", (p) => {
              p.ambient.color = v;
            })
          }
        />
      </Section>
      <Section
        title="Board atmosphere & intro"
        onReset={() =>
          edit("Reset board atmosphere", (p) => {
            p.boardFX = blank().boardFX;
            p.lead = blank().lead;
          })
        }
      >
        <Toggle
          label="Board effects"
          checked={p.boardFX.enabled}
          onChange={(v) =>
            edit("Board FX", (p) => {
              p.boardFX.enabled = v;
            })
          }
        />
        <Toggle
          label="Zoom-and-turn intro"
          checked={p.boardFX.intro}
          onChange={(v) =>
            edit("Intro", (p) => {
              p.boardFX.intro = v;
            })
          }
        />
        <Range
          label="Intro lead-in"
          value={p.lead}
          resetValue={blank().lead}
          min={0.2}
          max={8}
          onChange={(v) =>
            edit("Intro lead", (p) => {
              p.lead = v;
              p.boardFX.introDuration = Math.min(p.boardFX.introDuration, v);
            })
          }
        />
        <Toggle
          label="Dark-square tempo pulses"
          checked={p.boardFX.beatClock}
          onChange={(v) =>
            edit("Tempo pulses", (p) => {
              p.boardFX.beatClock = v;
            })
          }
        />
        {(
          ["lightingColor", "rimColor", "sweepColor", "vignetteColor"] as const
        ).map((k) => (
          <Color
            key={k}
            label={
              {
                lightingColor: "Lighting tint",
                rimColor: "Rim light color",
                sweepColor: "Sweep color",
                vignetteColor: "Vignette color",
              }[k]
            }
            value={
              p.boardFX[k] ??
              (k === "rimColor"
                ? p.style.accent
                : k === "vignetteColor"
                  ? "#080c0b"
                  : "#ffffff")
            }
            onChange={(v) =>
              edit(k, (p) => {
                p.boardFX[k] = v;
              })
            }
          />
        ))}
        <Color
          label="Tempo pulse color"
          value={p.boardFX.beatColor}
          onChange={(v) =>
            edit("Tempo color", (p) => {
              p.boardFX.beatColor = v;
            })
          }
        />
        {(
          [
            "shimmer",
            "shimmerSpeed",
            "introDuration",
            "introZoom",
            "introTurn",
            "bpm",
            "beatStrength",
            "beatDecay",
            "rim",
            "rimSpeed",
            "sweep",
            "sweepSpeed",
            "vignette",
            "vignetteSpeed",
          ] as const
        ).map((k) => (
          <Range
            key={k}
            label={
              {
                shimmer: "Lighting shimmer",
                shimmerSpeed: "Shimmer speed",
                introDuration: "Intro duration",
                introZoom: "Intro starting size",
                introTurn: "Intro turn degrees",
                bpm: "Pulse BPM",
                beatStrength: "Pulse strength",
                beatDecay: "Pulse decay",
                rim: "Breathing rim light",
                rimSpeed: "Rim breathing speed",
                sweep: "Light sweep strength",
                sweepSpeed: "Light sweep speed",
                vignette: "Vignette breathing",
                vignetteSpeed: "Vignette speed",
              }[k]
            }
            value={p.boardFX[k]}
            resetValue={blank().boardFX[k]}
            min={
              k === "introDuration"
                ? 0.2
                : k === "beatDecay"
                  ? 0.05
                  : k === "introTurn"
                    ? -90
                    : k === "bpm"
                      ? 20
                      : k === "introZoom"
                        ? 0.2
                        : k.includes("Speed")
                          ? 0.05
                          : 0
            }
            max={
              k === "introTurn"
                ? 90
                : k === "bpm"
                  ? 240
                  : k === "introDuration"
                    ? 8
                    : k.includes("Speed")
                      ? 3
                      : k === "shimmer"
                        ? 0.2
                        : k === "sweep"
                          ? 0.3
                          : k === "introZoom"
                            ? 1
                            : k === "beatDecay"
                              ? 2
                              : 0.5
            }
            onChange={(v) =>
              edit("Board " + k, (p) => {
                p.boardFX[k] = v;
                if (k === "introDuration") p.lead = Math.max(p.lead, v);
              })
            }
          />
        ))}
      </Section>
      <Section
        title="Dark-square beat pulse"
        onReset={() =>
          edit("Reset pulse", (p) => {
            p.pulse = blank().pulse;
          })
        }
      >
        <Toggle
          label="Pulse dark squares"
          checked={p.pulse.enabled}
          onChange={(v) =>
            edit("Beat pulse", (p) => {
              p.pulse.enabled = v;
            })
          }
        />
        <Toggle
          label="Accents only"
          checked={p.pulse.accentsOnly}
          onChange={(v) =>
            edit("Pulse accents", (p) => {
              p.pulse.accentsOnly = v;
            })
          }
        />
        <RainbowControls
          label="Pulse"
          settings={p.pulse.rainbow}
          edit={(fn) => edit("Pulse rainbow", (p) => fn(p.pulse.rainbow))}
        />
        <Color
          label="Pulse color"
          value={p.pulse.color}
          onChange={(v) =>
            edit("Pulse color", (p) => {
              p.pulse.color = v;
            })
          }
        />
        {(["intensity", "attack", "decay"] as const).map((k) => (
          <Range
            key={k}
            label={"Pulse " + k}
            value={p.pulse[k]}
            resetValue={blank().pulse[k]}
            min={k === "intensity" ? 0 : k === "attack" ? 0.01 : 0.05}
            max={k === "attack" ? 0.4 : 1}
            onChange={(v) =>
              edit("Pulse " + k, (p) => {
                p.pulse[k] = v;
              })
            }
          />
        ))}
      </Section>
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
export function AnalysisPanel(q: PanelProps) {
  const p = q.project,
    [scope, setScope] = useState<"selected" | "checked" | "all">("selected"),
    [busy, setBusy] = useState(false);
  const analyze = (kind: "book" | "engine") =>
    q.run(async () => {
      setBusy(true);
      try {
        const indices = p.moves.flatMap((m, i) =>
          scope === "all" ||
          (scope === "selected" && i === q.selected) ||
          (scope === "checked" && q.checked.has(m.id))
            ? [i]
            : [],
        );
        const result = await window.studio.analyze(p, kind, indices);
        q.edit("Analysis results", (p) => {
          for (const m of p.moves)
            if (result[m.id]) m.analysis = { ...m.analysis, ...result[m.id] };
        });
      } finally {
        setBusy(false);
      }
    });
  return (
    <>
      <Section title="Analysis suggestions">
        <Select
          label="Analyze"
          value={scope}
          options={[
            ["selected", "Selected move"],
            ["checked", "Checked moves"],
            ["all", "All moves"],
          ]}
          onChange={setScope}
        />
        <button
          className="wide"
          disabled={busy}
          onClick={() => analyze("book")}
        >
          Look up Masters opening moves
        </button>
        <button
          className="wide"
          disabled={busy || !q.settings.stockfish}
          onClick={() => analyze("engine")}
        >
          Analyze with local Stockfish
        </button>
        {busy && (
          <button
            className="wide"
            onClick={() => q.run(() => window.studio.cancelAnalysis())}
          >
            Cancel analysis{" "}
            {q.analysisProgress
              ? `${q.analysisProgress.done}/${q.analysisProgress.total}`
              : ""}
          </button>
        )}
        <p className="hint">
          Manual badges always win. Engine labels use centipawn loss, not
          Chess.com's proprietary classifications.
        </p>
      </Section>
      <Section title="Resource limits">
        {(
          [
            "depth",
            "milliseconds",
            "threads",
            "hash",
            "minGames",
            "frequency",
            "cutoff",
          ] as const
        ).map((k) => (
          <Range
            key={k}
            label={
              {
                depth: "Maximum depth",
                milliseconds: "Time per position",
                threads: "Engine threads",
                hash: "Engine hash MB",
                minGames: "Minimum Masters games",
                frequency: "Minimum book frequency",
                cutoff: "Opening cutoff (plies)",
              }[k]
            }
            value={p.analysis[k]}
            resetValue={blank().analysis[k]}
            min={
              k === "depth"
                ? 4
                : k === "milliseconds"
                  ? 100
                  : k === "threads" || k === "minGames"
                    ? 1
                    : k === "hash"
                      ? 16
                      : 0
            }
            max={
              k === "depth"
                ? 24
                : k === "milliseconds"
                  ? 15000
                  : k === "threads"
                    ? 8
                    : k === "hash"
                      ? 512
                      : k === "minGames"
                        ? 1000000
                        : k === "frequency"
                          ? 1
                          : 80
            }
            step={k === "frequency" ? 0.001 : 1}
            onChange={(v) =>
              q.edit("Analysis " + k, (p) => {
                p.analysis[k] = v;
              })
            }
          />
        ))}
      </Section>
      <Section title="Selected move results">
        {(() => {
          const a = p.moves[q.selected]?.analysis;
          return a ? (
            <>
              {a.book ? (
                <p>
                  Masters: <strong>{a.book.state}</strong>
                  <br />
                  {a.book.message}
                </p>
              ) : (
                <p className="hint">Opening not analyzed.</p>
              )}
              {a.engine ? (
                <p>
                  Engine:{" "}
                  <strong>
                    {a.engine.state === "done"
                      ? a.engine.label
                      : a.engine.state}
                  </strong>
                  <br />
                  Loss {a.engine.loss} cp · depth {a.engine.depth}
                  <br />
                  {a.engine.message}
                </p>
              ) : (
                <p className="hint">Engine not analyzed.</p>
              )}
            </>
          ) : null;
        })()}
      </Section>
    </>
  );
}
export function FilesPanel(q: PanelProps) {
  const p = q.project,
    [token, setToken] = useState("");
  return (
    <>
      <Section title="Share project settings">
        <p className="hint">
          Save a readable report of move animations, cameras, music and scene
          settings. Share it when you need help identifying an effect. Media
          files are not included.
        </p>
        <button
          onClick={() =>
            q.run(async () => {
              const file = await window.studio.projectReport(p);
              if (file) q.message("Project settings report saved.");
            })
          }
        >
          Export settings report
        </button>
      </Section>
      <Section title="Local tools">
        <button
          title="Choose your local FFmpeg executable to enable MP4 export. The app does not bundle an encoder."
          className="wide"
          onClick={() =>
            q.run(async () => q.setSettings(await window.studio.tool("ffmpeg")))
          }
        >
          Choose FFmpeg executable…
        </button>
        <p className="path">
          {q.settings.ffmpeg || "FFmpeg is required for MP4 export."}
        </p>
        <button
          title="Choose a local Stockfish executable for optional engine analysis and move-badge suggestions."
          className="wide"
          onClick={() =>
            q.run(async () =>
              q.setSettings(await window.studio.tool("stockfish")),
            )
          }
        >
          Choose Stockfish executable…
        </button>
        <p className="path">
          {q.settings.stockfish || "Stockfish is optional."}
        </p>
        <Select
          label="Video encoder"
          value={q.settings.encoder}
          options={[
            ["auto", "Probe hardware, fall back to software"],
            ["software", "Software H.264 (libx264)"],
          ]}
          onChange={(v) =>
            q.run(async () => {
              await window.studio.setEncoder(v);
              q.setSettings({ ...q.settings, encoder: v });
            })
          }
        />
        <p className="hint">
          Get FFmpeg from ffmpeg.org/download.html and Stockfish from
          stockfishchess.org/download. Executables are configured locally and
          not bundled.
        </p>
      </Section>
      <Section title="Masters token (optional)">
        <p className="hint">
          The current Masters API may require authentication. Enter a token
          locally if needed. It is encrypted using Windows credential protection
          and excluded from projects and logs.
        </p>
        <input
          title={settingHelp("Masters token")}
          aria-description={settingHelp("Masters token")}
          aria-label="Masters token"
          type="password"
          autoComplete="off"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <button
          className="wide"
          onClick={() =>
            q.run(async () => {
              await window.studio.token(token);
              setToken("");
              q.setSettings(await window.studio.settings());
              q.message("Credential setting updated.");
            })
          }
        >
          {token ? "Store token securely" : "Remove saved token"}
        </button>
        <small>
          {q.settings.tokenPresent
            ? "A token is stored."
            : "No token is stored."}
        </small>
      </Section>
      <Section title="Project & recovery">
        <p className="path">{q.path ?? "Unsaved composition"}</p>
        <button
          className="wide"
          onClick={() =>
            q.run(async () => {
              const result = await window.studio.collect(p);
              if (result) {
                q.replace(result.project);
                q.message("Portable project collected: " + result.path);
              }
            })
          }
        >
          Collect assets into portable project
        </button>
        <button
          className="wide"
          onClick={() => q.run(() => window.studio.logs())}
        >
          Open activity logs
        </button>
        {q.recent.map((f) => (
          <button
            className="wide recent"
            key={f}
            onClick={() => q.openRecent(f)}
          >
            {f.split(/[\\/]/).at(-1)}
          </button>
        ))}
      </Section>
      <Section title="Local asset references">
        {p.assets.map((a) => (
          <div className="asset-card" key={a.id}>
            <strong>{a.name}</strong>
            <small className={q.missing.has(a.id) ? "danger" : "muted"}>
              {q.missing.has(a.id) ? "Missing — relink to restore" : a.kind}
            </small>
            <label className="text-field">
              Name
              <input
                title={settingHelp("Asset name")}
                aria-description={settingHelp("Asset name")}
                aria-label={"Asset name"}
                value={a.name}
                onChange={(e) =>
                  q.edit("Asset name", (p) => {
                    p.assets.find((x) => x.id === a.id)!.name = e.target.value;
                  })
                }
              />
            </label>
            <p className="path">{a.path}</p>
            <small>{a.source}</small>
            {a.guidance && <p className="hint">{a.guidance}</p>}
            <div className="button-row">
              <button
                onClick={() =>
                  q.run(async () => {
                    const replacement = await window.studio.importAsset(a.kind);
                    if (replacement)
                      q.edit("Relink asset", (p) => {
                        const old = p.assets.find((v) => v.id === a.id)!;
                        Object.assign(old, {
                          ...replacement,
                          id: replacement.id,
                          source: a.source,
                          guidance: a.guidance,
                        });
                        if (p.music.asset === a.id)
                          p.music.asset = replacement.id;
                        for (const c of p.cues)
                          if (c.asset === a.id) c.asset = replacement.id;
                        for (const key of Object.keys(p.badgeAssets))
                          if (p.badgeAssets[key] === a.id)
                            p.badgeAssets[key] = replacement.id;
                        for (const f of formats)
                          if (p.layouts[f].image === a.id)
                            p.layouts[f].image = replacement.id;
                      });
                  })
                }
              >
                Relink…
              </button>
              <button
                onClick={() =>
                  q.edit("Remove asset", (p) => {
                    p.assets = p.assets.filter((v) => v.id !== a.id);
                    if (p.music.asset === a.id) p.music.asset = null;
                    p.cues = p.cues.filter((c) => c.asset !== a.id);
                    for (const key of Object.keys(p.badgeAssets))
                      if (p.badgeAssets[key] === a.id)
                        delete p.badgeAssets[key];
                    for (const f of formats)
                      if (p.layouts[f].image === a.id)
                        p.layouts[f].image = null;
                  })
                }
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </Section>
    </>
  );
}
