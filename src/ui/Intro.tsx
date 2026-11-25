import { useState } from "react";
import { introFilm } from "../core/introVideo";
import { blank, playerIntro, type Asset, type Project } from "../core/project";
import { settingHelp } from "./help";
import type { Edit } from "./state";
import { Section, Select, Range, Toggle } from "./controls";
export function IntroInspector({
  project: p,
  edit,
  images,
  missing,
  importPhoto,
  importVideo,
  videoImporting,
  previewIntro,
}: {
  project: Project;
  edit: Edit;
  images: Record<string, string>;
  missing: Set<string>;
  importPhoto: () => void;
  importVideo: (trim: NonNullable<Asset["videoTrim"]>) => void;
  videoImporting: boolean;
  previewIntro: () => void;
}) {
  const intro = p.playerIntro;
  const clip = p.squareIntro;
  const video = p.assets.find((item) => item.id === clip.asset);
  const [trimDraft, setTrimDraft] = useState<{
    project: string;
    asset: string | null;
    value: NonNullable<Asset["videoTrim"]>;
  }>();
  const trim =
    trimDraft?.project === p.id && trimDraft.asset === clip.asset
      ? trimDraft.value
      : (video?.videoTrim ?? { start: 0, x: 0.5, y: 0.5 });
  const setTrim = (value: NonNullable<Asset["videoTrim"]>) =>
    setTrimDraft({ project: p.id, asset: clip.asset, value });
  const prepared = clip.asset ? images[clip.asset] : undefined;
  const videoTime = clip.hold + clip.pullback;
  const minIntro = clip.asset ? videoTime + (intro.enabled ? 0.5 : 0) : 0.2;
  const squares = Array.from({ length: 64 }, (_, i) => {
    const square = "abcdefgh"[i % 8] + (8 - Math.floor(i / 8));
    return [square, square] as const;
  });
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
                if (enabled && clip.asset)
                  p.lead = Math.max(p.lead, videoTime + 2);
                else if (enabled && p.lead === 0) p.lead = 2;
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
                  if (clip.asset) p.lead = Math.max(p.lead, videoTime + 2);
                  else if (p.lead === 0) p.lead = 2;
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
          <label className="text-field">
            Player subtitle
            <input
              aria-label="Player subtitle"
              placeholder="Optional title or match details"
              value={intro.caption ?? ""}
              maxLength={80}
              onChange={(event) =>
                edit("Player subtitle", (draft) => {
                  draft.playerIntro.caption = event.target.value;
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
              ["spotlight", "Spotlight reveal"],
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
          <Range
            label="Player transition time"
            value={intro.fade ?? 0.45}
            min={0.1}
            max={1}
            step={0.05}
            unit="s"
            resetValue={0.45}
            onChange={(fade) =>
              edit("Player transition time", (draft) => {
                draft.playerIntro.fade = fade;
              })
            }
          />
          <p className="hint">
            A transparent PNG keeps the board visible around the player. Set the
            display time with Intro clip length.
          </p>
        </Section>
        <Section
          title="Video pullback"
          status={video?.name ?? (clip.asset ? "Missing video" : "Off")}
        >
          <div className="button-row">
            <button
              type="button"
              onClick={() => importVideo(trim)}
              disabled={videoImporting}
            >
              {videoImporting
                ? "Preparing video…"
                : clip.asset
                  ? "Replace intro video"
                  : "Import intro video"}
            </button>
            <button
              type="button"
              disabled={!clip.asset || !images[clip.asset]}
              onClick={previewIntro}
            >
              Preview video pullback
            </button>
            {clip.asset && (
              <button
                type="button"
                onClick={() =>
                  edit("Clear intro video", (draft) => {
                    draft.squareIntro.asset = null;
                  })
                }
              >
                Clear video
              </button>
            )}
          </div>
          <details
            className="intro-video-source"
            open={!clip.asset ? true : undefined}
          >
            <summary>Source in-point and crop</summary>
            <Range
              label="Video source start"
              value={trim.start}
              min={0}
              max={7200}
              step={0.05}
              unit="s"
              onChange={(start) => setTrim({ ...trim, start })}
            />
            <Range
              label="Video crop horizontal"
              value={trim.x * 100}
              min={0}
              max={100}
              unit="%"
              onChange={(x) => setTrim({ ...trim, x: x / 100 })}
            />
            <Range
              label="Video crop vertical"
              value={trim.y * 100}
              min={0}
              max={100}
              unit="%"
              onChange={(y) => setTrim({ ...trim, y: y / 100 })}
            />
            <p className="hint">
              Set these values, then import or replace the video. The crop
              preview shows the first frame of the prepared clip.
            </p>
          </details>
          {prepared && (
            <div
              className="intro-crop-preview"
              role="img"
              aria-label="Prepared video crop preview"
              style={{
                backgroundImage: `url("${prepared}")`,
                backgroundSize: `${introFilm.columns * 100}% ${introFilm.rows * 100}%`,
              }}
            />
          )}
          {clip.asset && (!video || missing.has(clip.asset)) && (
            <p className="danger">
              Relink the intro video in Files or import a replacement.
            </p>
          )}
          {clip.asset && (
            <>
              <Select
                label="Video square"
                value={clip.square}
                options={squares}
                onChange={(square) =>
                  edit("Video square", (draft) => {
                    draft.squareIntro.square = square;
                  })
                }
              />
              <Range
                label="Video close-up time"
                value={clip.hold}
                min={0}
                max={3}
                step={0.05}
                unit="s"
                onChange={(hold) =>
                  edit("Video close-up time", (draft) => {
                    draft.squareIntro.hold = hold;
                    draft.lead = Math.max(
                      draft.lead,
                      hold + clip.pullback + (intro.enabled ? 0.5 : 0),
                    );
                  })
                }
              />
              <Range
                label="Board pullback time"
                value={clip.pullback}
                min={0.25}
                max={3}
                step={0.05}
                unit="s"
                onChange={(pullback) =>
                  edit("Board pullback time", (draft) => {
                    draft.squareIntro.pullback = pullback;
                    draft.lead = Math.max(
                      draft.lead,
                      clip.hold + pullback + (intro.enabled ? 0.5 : 0),
                    );
                  })
                }
              />
            </>
          )}
          <p className="hint">
            Uses up to 3 seconds from the chosen in-point without audio and
            holds the final frame if needed. The video pulls back into the
            chosen square. An enabled player photo appears next.
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
              p.lead = Math.max(d.lead, minIntro);
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
            resetValue={Math.max(blank().lead, minIntro)}
            min={minIntro}
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
          {clip.asset && (
            <p className="hint">Video pullback uses its own camera move.</p>
          )}
          <p className="hint">
            Any time left after the animation holds the board still. Snow is
            configurable in Atmosphere → Snow particles.
          </p>
        </Section>
      </div>
    </aside>
  );
}
