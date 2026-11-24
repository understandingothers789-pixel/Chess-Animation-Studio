import { blank, playerIntro, type Project } from "../core/project";
import { settingHelp } from "./help";
import type { Edit } from "./state";
import { Section, Select, Range, Toggle } from "./controls";
export function IntroInspector({
  project: p,
  edit,
  images,
  missing,
  importPhoto,
  previewIntro,
}: {
  project: Project;
  edit: Edit;
  images: Record<string, string>;
  missing: Set<string>;
  importPhoto: () => void;
  previewIntro: () => void;
}) {
  const intro = p.playerIntro;
  const photos = p.assets.filter((asset) => asset.kind === "image");
  const photo = photos.find((asset) => asset.id === intro.asset);
  const lostPhoto = !!intro.asset && (!photo || missing.has(intro.asset));
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
      <div className="inspector-content">
        <Section title="Player intro" status={intro.enabled ? "On" : "Off"}>
          <Toggle
            label="Show player intro"
            checked={intro.enabled}
            onChange={(enabled) =>
              edit("Player intro", (p) => {
                p.playerIntro.enabled = enabled;
                if (enabled && p.lead === 0) p.lead = 2;
              })
            }
          />
          <div className="button-row">
            <button type="button" onClick={importPhoto}>
              Import player photo
            </button>
            <button
              type="button"
              disabled={
                !intro.enabled ||
                !intro.asset ||
                !images[intro.asset] ||
                lostPhoto ||
                !p.lead
              }
              onClick={previewIntro}
            >
              Preview player intro
            </button>
          </div>
          <Select
            label="Player photo"
            value={intro.asset ?? ""}
            options={[
              ["", "None"],
              ...(intro.asset && !photo
                ? [[intro.asset, "Missing image"] as const]
                : []),
              ...photos.map((asset) => [asset.id, asset.name] as const),
            ]}
            onChange={(id) =>
              edit("Player photo", (p) => {
                p.playerIntro.asset = id || null;
                if (id) {
                  p.playerIntro.enabled = true;
                  if (p.lead === 0) p.lead = 2;
                }
              })
            }
          />
          {lostPhoto && (
            <p className="hint">Relink the player photo in Files.</p>
          )}
          {intro.asset && images[intro.asset] && (
            <img
              className="player-intro-image"
              src={images[intro.asset]}
              alt="Player photo preview"
            />
          )}
          <label className="text-field" title={settingHelp("Player name")}>
            Player name
            <input
              aria-label="Player name"
              aria-description={settingHelp("Player name")}
              value={intro.name}
              maxLength={80}
              onChange={(event) =>
                edit("Player name", (p) => {
                  p.playerIntro.name = event.target.value;
                })
              }
            />
          </label>
          <Select
            label="Player transition"
            value={intro.transition}
            options={[
              ["rise", "Fade and rise"],
              ["zoom", "Gentle zoom"],
              ["fade", "Crossfade"],
            ]}
            onChange={(transition) =>
              edit("Player transition", (p) => {
                p.playerIntro.transition = transition;
              })
            }
          />
          <Range
            label="Player photo size"
            value={intro.size * 100}
            min={18}
            max={72}
            unit="%"
            step={1}
            resetValue={playerIntro().size * 100}
            onChange={(value) =>
              edit("Player photo size", (p) => {
                p.playerIntro.size = value / 100;
              })
            }
          />
          <p className="hint">
            A transparent PNG keeps the board visible around the player. Set the
            display time with Intro clip length.
          </p>
        </Section>
        <Section title="Animated title">
          <Toggle
            label="Show animated title"
            checked={p.introTitle.enabled}
            onChange={(v) =>
              edit("Intro title", (p) => {
                p.introTitle.enabled = v;
              })
            }
          />
          <Select
            label="Attacking piece"
            value={p.introTitle.piece}
            options={[
              ["pawn", "Pawn"],
              ["knight", "Knight"],
              ["bishop", "Bishop"],
              ["rook", "Rook"],
              ["queen", "Queen"],
              ["king", "King"],
            ]}
            onChange={(v) =>
              edit("Intro attacking piece", (p) => {
                p.introTitle.piece = v;
              })
            }
          />
          <label>
            Intro text
            <input
              aria-label="Intro text"
              title="Text displayed during the animated intro."
              aria-description="Text displayed during the animated intro."
              value={p.introTitle.text}
              maxLength={120}
              onChange={(e) =>
                edit("Intro text", (p) => {
                  p.introTitle.text = e.target.value;
                })
              }
            />
          </label>
        </Section>
        <Section
          title="Opener"
          onReset={() =>
            edit("Reset opener", (p) => {
              const d = blank();
              p.lead = d.lead;
              for (const k of [
                "intro",
                "introPreset",
                "introDuration",
                "introZoom",
                "introTurn",
              ] as const)
                (p.boardFX as any)[k] = d.boardFX[k];
            })
          }
        >
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
              ["board-level", "Board-level fly-in"],
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
            resetValue={blank().lead}
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
            resetValue={blank().boardFX.introDuration}
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
            resetValue={blank().boardFX.introZoom}
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
            resetValue={blank().boardFX.introTurn}
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
            configurable in Atmosphere → Snow particles.
          </p>
        </Section>
      </div>
    </aside>
  );
}
