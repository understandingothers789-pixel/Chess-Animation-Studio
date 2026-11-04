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
      <Section
        title="Knight horse sound"
        status={p.audio.knightHorse ? "Enabled" : "Off"}
      >
        <Toggle
          label="Play horse sound on knight moves"
          checked={p.audio.knightHorse}
          onChange={(v) =>
            edit("Knight horse sound", (p) => {
              p.audio.knightHorse = v;
            })
          }
        />
        {(["knightVolume", "knightOffset", "knightDuration"] as const).map(
          (k) => (
            <Range
              key={k}
              label={
                {
                  knightVolume: "Horse sound volume",
                  knightOffset: "Start offset from landing",
                  knightDuration: "Horse sound length",
                }[k]
              }
              value={p.audio[k]}
              resetValue={blank().audio[k]}
              min={
                k === "knightOffset" ? -2 : k === "knightDuration" ? 0.05 : 0
              }
              max={k === "knightVolume" ? 2 : k === "knightOffset" ? 2 : 3}
              step={k === "knightVolume" ? 0.01 : 0.05}
              unit={k === "knightVolume" ? "" : "s"}
              onChange={(v) =>
                edit("Knight horse " + k, (p) => {
                  p.audio[k] = v;
                })
              }
            />
          ),
        )}
      </Section>
    </>
  );
}
