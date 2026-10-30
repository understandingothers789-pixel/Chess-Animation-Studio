import type { Project } from "../core/project";
import type { Edit } from "./state";
import { Section, Select, Range, Toggle } from "./controls";
export function IntroInspector({
  project: p,
  edit,
}: {
  project: Project;
  edit: Edit;
}) {
  return (
    <aside className="inspector">
      <div className="inspector-title">
        <span className="eyebrow">INTRO CLIP</span>
        <h2>Opening board</h2>
        <p className="hint">
          This clip fills the time before the first move. Choose another opener
          here.
        </p>
      </div>
      <Section title="Opener">
        <Toggle
          label="Animate intro"
          checked={p.boardFX.intro}
          onChange={(v) =>
            edit("Intro enabled", (p) => {
              p.boardFX.intro = v;
            })
          }
        />
        <Select
          label="Opener preset"
          value={p.boardFX.introPreset}
          options={[
            ["zoom-turn", "Zoom & turn"],
            ["zoom", "Gentle zoom"],
            ["turn", "Board turn"],
            ["still", "Still board"],
          ]}
          onChange={(v) =>
            edit("Opener preset", (p) => {
              p.boardFX.introPreset = v;
              p.boardFX.intro = true;
            })
          }
        />
        <Range
          label="Intro clip length"
          value={p.lead}
          min={0.2}
          max={8}
          step={0.1}
          unit="s"
          onChange={(v) =>
            edit("Intro length", (p) => {
              p.lead = v;
              p.boardFX.introDuration = Math.min(v, p.boardFX.introDuration);
            })
          }
        />
        <Range
          label="Opener animation length"
          value={p.boardFX.introDuration}
          min={0.2}
          max={8}
          step={0.1}
          unit="s"
          onChange={(v) =>
            edit("Opener duration", (p) => {
              p.boardFX.introDuration = v;
              p.lead = Math.max(p.lead, v);
            })
          }
        />
        <Range
          label="Opener starting size"
          value={p.boardFX.introZoom}
          min={0.2}
          max={1}
          onChange={(v) =>
            edit("Opener zoom", (p) => {
              p.boardFX.introZoom = v;
            })
          }
        />
        <Range
          label="Opener turn"
          value={p.boardFX.introTurn}
          min={-90}
          max={90}
          step={1}
          unit="°"
          onChange={(v) =>
            edit("Opener turn", (p) => {
              p.boardFX.introTurn = v;
            })
          }
        />
        <p className="hint">
          Any time left after the animation holds the board still. Snow is
          configurable in Scene → Snow particles.
        </p>
      </Section>
    </aside>
  );
}
