import { useState } from "react";
import { channels, type Channel, type Project } from "../../core/project";
import type { Edit } from "../state";
import { Section, Select, ScrubNumber } from "../controls";
import { settingHelp } from "../help";
import { CurveEditor } from "./CurveEditor";
export function KeyframePanel({
  project,
  index,
  edit,
  seek,
}: {
  project: Project;
  index: number;
  edit: Edit;
  seek?: (time: number) => void;
}) {
  const [channel, setChannel] = useState<Channel>("rz");
  const move = project.moves[index];
  return (
    <Section
      title="Normalized keyframes"
      onReset={() =>
        edit("Reset curve channels", (p) => {
          p.moves[index].effect.keys = {};
        })
      }
    >
      <p className="hint">
        Key times run from 0 to 1 within this move. Duration edits preserve the
        curve. Rotation values use degrees; positions use board squares.
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
        options={channels}
        onChange={setChannel}
      />
      <CurveEditor
        project={project}
        index={index}
        channel={channel}
        seek={seek}
        edit={edit}
      />
      {(move.effect.keys[channel] ?? []).map((k, i) => (
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
  );
}
