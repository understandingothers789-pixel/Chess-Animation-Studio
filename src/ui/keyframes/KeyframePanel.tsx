import { editableSamples } from "../../core/curveSamples";
import { useEffect, useMemo, useState } from "react";
import { clamp, moveChannelSampler, segments } from "../../core/timeline";
import { channels, type Channel, type Project } from "../../core/project";
import type { Edit } from "../state";
import { Section, Select, ScrubNumber } from "../controls";
import { settingHelp } from "../help";
import { CurveEditor } from "./CurveEditor";
export const channelNames: Record<Channel, string> = {
  travel: "Travel",
  x: "Piece X",
  y: "Piece Y",
  z: "Piece height",
  rx: "Piece rotation X",
  ry: "Piece rotation Y",
  rz: "Piece rotation Z",
  scale: "Piece scale",
  opacity: "Piece opacity",
  cameraX: "Camera X",
  cameraY: "Camera Y",
  cameraZoom: "Camera zoom",
  cameraRotation: "Camera roll",
  cameraTilt: "Camera tilt",
};

export function KeyframePanel({
  project,
  index,
  edit,
  seek,
  time,
  fps,
  requestedChannel,
}: {
  project: Project;
  index: number;
  edit: Edit;
  seek?: (time: number) => void;
  time: number;
  fps: number;
  requestedChannel?: { channel: Channel };
}) {
  const [channel, setChannel] = useState<Channel>("rz");
  useEffect(() => {
    if (requestedChannel) setChannel(requestedChannel.channel);
  }, [requestedChannel]);
  const move = project.moves[index];
  const segment = segments(project)[index];
  const sampleBase = useMemo(
    () => moveChannelSampler(project, index, channel, true),
    [project, index, channel],
  );
  const base = useMemo(
    () => Array.from({ length: 33 }, (_, i) => sampleBase(i / 32)),
    [sampleBase],
  );
  const at = clamp((time - segment.depart) / move.effect.duration);
  const keys = move.effect.keys[channel] ?? [];
  function addKey() {
    const sample = keys.length
      ? moveChannelSampler(project, index, channel, false)
      : sampleBase;
    const value = sample(at);
    edit("Key current value", (p) => {
      const e = p.moves[index].effect;
      const next =
        e.keys[channel] ??
        editableSamples(
          base,
          channel.startsWith("r") ||
            channel === "cameraRotation" ||
            channel === "cameraTilt"
            ? 0.25
            : 0.002,
        );
      const existing = next.find((key) => Math.abs(key.at - at) < 1e-6);
      if (existing) existing.value = value;
      else if (next.length < 64) next.push({ at, value, ease: "linear" });
      next.sort((a, b) => a.at - b.at);
      e.keys[channel] = next;
    });
  }
  return (
    <Section
      title="Keyframes · active move"
      onReset={() =>
        edit("Reset curve channels", (p) => {
          p.moves[index].effect.keys = {};
        })
      }
    >
      <p className="hint">
        Key times run from 0 to 1 within this move. The graph labels show
        seconds. Duration edits preserve the curve. Rotation values use degrees;
        positions use board squares.
      </p>
      <button
        onClick={() =>
          edit("Clear keys", (p) => {
            p.moves[index].effect.keys = {};
          })
        }
      >
        Clear keys for the active move
      </button>
      <Select
        label="Keyframe channel"
        value={channel}
        options={channels.map((key) => [key, channelNames[key]] as const)}
        onChange={setChannel}
      />
      {channel.startsWith("camera") && (
        <p className="hint">
          The dashed line uses {project.format} camera framing. Beat spotlight
          can add zoom, pan, and roll after this curve.
        </p>
      )}
      <p>
        Playhead {(at * move.effect.duration).toFixed(3)} s · frame{" "}
        {Math.round(time * fps)} ·{" "}
        {channel.includes("Rotation") ||
        channel.startsWith("r") ||
        channel === "cameraTilt"
          ? "degrees"
          : channel === "scale" ||
              channel === "cameraZoom" ||
              channel === "opacity" ||
              channel === "travel"
            ? "ratio"
            : "board squares"}
      </p>
      <CurveEditor
        project={project}
        index={index}
        channel={channel}
        seek={seek}
        edit={edit}
        base={base}
        label={channelNames[channel]}
        playhead={at}
      />
      {keys.length > 0 && (
        <details>
          <summary>Key list · {keys.length}</summary>
          {keys.map((k, i) => (
            <div className="key-row" key={i}>
              <button
                type="button"
                title="Seek to keyframe"
                onClick={() =>
                  seek?.(segment.depart + k.at * move.effect.duration)
                }
              >
                {(k.at * move.effect.duration).toFixed(3)} s · f
                {Math.round(
                  (segment.depart + k.at * move.effect.duration) * fps,
                )}
              </button>
              <ScrubNumber
                title={settingHelp(`Key ${i + 1} time`)}
                aria-description={settingHelp(`Key ${i + 1} time`)}
                aria-label={`Key ${i + 1} time`}
                min={0}
                max={move.effect.duration}
                step={1 / fps}
                value={k.at * move.effect.duration}
                onValueChange={(n) =>
                  edit("Key time", (p) => {
                    p.moves[index].effect.keys[channel]![i].at =
                      n / p.moves[index].effect.duration;
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
        </details>
      )}
      <p className="hint">
        {keys.length
          ? "The keyed curve overrides this channel. Reset this curve to restore preset motion."
          : "The dashed curve shows the preset. Your first key creates a reduced editable curve within 0.25° or 0.002 board units at sampled times."}
      </p>
      <button
        className="wide"
        disabled={
          keys.length >= 64 && !keys.some((key) => Math.abs(key.at - at) < 1e-6)
        }
        onClick={addKey}
      >
        Key current value at playhead
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
  );
}
