import { assetFilm } from "../core/introVideo";
import { useState } from "react";
import { memeTiming, type Effect, type Project } from "../core/project";
import { memeWindow } from "../core/timeline";
import { Range, Section, Select } from "./controls";
import type { Edit } from "./state";

export function StartingSquareMeme({
  project,
  index,
  targets,
  edit,
  images,
  run,
  seek,
  segment,
  standalone = false,
}: {
  project: Project;
  index: number;
  targets: Project["moves"];
  edit: Edit;
  images: Record<string, string>;
  run: (job: () => Promise<unknown>) => void;
  seek?: (time: number) => void;
  segment: Parameters<typeof memeWindow>[1];
  standalone?: boolean;
}) {
  const [trimDraft, setTrimDraft] = useState<{
    id: string;
    start: number;
    seconds: number;
  }>();
  const [preparing, setPreparing] = useState(false);
  const move = project.moves[index];
  const active = (targets.find((m) => m.id === move.id) ?? targets[0]).effect;
  const meme = active.preMoveMeme;
  const preview = memeWindow(move.effect, segment);
  const assets = project.assets.filter(
    (a) => a.kind === "image" || a.kind === "filmstrip",
  );
  const asset = assets.find((a) => a.id === meme?.asset);
  const animated = asset?.kind === "filmstrip" ? assetFilm(asset) : undefined;
  const mixed = targets.some(
    (m) => m.effect.preMoveMeme?.asset !== meme?.asset,
  );
  const canAdd = (fx: Effect) =>
    !fx.locked || !!fx.preMoveMeme || fx.delay >= memeTiming.min;
  const ids = new Set(targets.map((m) => m.id));
  const group = (p: Project) => p.moves.filter((m) => ids.has(m.id));
  const setImage = (fx: Effect, id: string) => {
    if (!id) fx.preMoveMeme = null;
    else if (canAdd(fx))
      fx.preMoveMeme = {
        ...fx.preMoveMeme,
        asset: id,
        duration:
          fx.preMoveMeme?.duration ??
          (fx.locked
            ? Math.min(fx.delay, memeTiming.default)
            : memeTiming.default),
      };
  };

  const crop = (field: "zoom" | "x" | "y" | "fade", value: number) =>
    edit("Meme " + field, (draft) => {
      for (const { effect } of group(draft))
        if (effect.preMoveMeme) effect.preMoveMeme[field] = value;
    });

  const trim =
    asset?.id === trimDraft?.id
      ? trimDraft
      : {
          id: asset?.id ?? "",
          start: asset?.videoTrim?.start ?? 0,
          seconds: asset?.videoTrim?.seconds ?? 2,
        };
  const prepareReaction = async () => {
    if (!asset?.videoSource || !trim) return;
    setPreparing(true);
    try {
      const replacement = await window.studio.retimeIntro(asset, {
        x: 0.5,
        y: 0.5,
        ...asset.videoTrim,
        start: trim.start,
        seconds: trim.seconds,
      });
      edit("Re-trim starting-square reaction", (draft) => {
        if (draft.id !== project.id || draft.line !== project.line) return;
        const moves = group(draft).filter(
          ({ effect }) => effect.preMoveMeme?.asset === asset.id,
        );
        if (!moves.length) return;
        if (draft.assets.length >= 150)
          throw Error("This project already has 150 local assets.");
        draft.assets.push(replacement);
        for (const { effect } of moves)
          effect.preMoveMeme!.asset = replacement.id;
      });
    } finally {
      setPreparing(false);
    }
  };
  const controls = (
    <>
      <div className="button-row">
        {(["image", "filmstrip"] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            autoFocus={standalone && kind === "image"}
            disabled={targets.every((m) => !canAdd(m.effect))}
            onClick={() =>
              run(async () => {
                if (
                  kind === "filmstrip" &&
                  !(await window.studio.settings()).ffmpeg
                ) {
                  const tools = await window.studio.tool("ffmpeg");
                  if (!tools.ffmpeg) return;
                }
                const image = await window.studio.importAsset(
                  kind,
                  kind === "filmstrip"
                    ? { start: 0, x: 0.5, y: 0.5, seconds: 2 }
                    : undefined,
                );
                if (!image) return;
                edit("Import starting-square meme", (draft) => {
                  if (draft.id !== project.id || draft.line !== project.line)
                    return;
                  const eligible = group(draft).filter((m) => canAdd(m.effect));
                  if (!eligible.length) return;
                  const existing = draft.assets.find(
                    (a) => a.kind === image.kind && a.path === image.path,
                  );
                  if (!existing && draft.assets.length >= 150)
                    throw Error("This project already has 150 local assets.");
                  if (!existing) draft.assets.push(image);
                  for (const m of eligible)
                    setImage(m.effect, (existing ?? image).id);
                });
              })
            }
          >
            {kind === "image" ? "Import meme image" : "Import GIF or video"}
          </button>
        ))}
        {preview && seek && (
          <button
            type="button"
            onClick={() => seek((preview.start + preview.end) / 2)}
          >
            Preview meme on board
          </button>
        )}
      </div>
      {animated && (
        <p className="hint">
          Animated reaction · {(animated.frames / animated.fps).toFixed(2)} s ·
          loops until the piece moves.
        </p>
      )}
      {animated && asset?.videoSource && trim && (
        <details>
          <summary>Trim reaction footage</summary>
          <Range
            label="Reaction source start"
            value={trim.start}
            min={0}
            max={Math.max(0, (asset.videoDuration ?? 7200) - 0.05)}
            step={0.05}
            unit="s"
            onChange={(start) => setTrimDraft({ ...trim, start })}
          />
          <Range
            label="Reaction footage length"
            value={trim.seconds}
            min={0.25}
            max={6}
            step={0.25}
            unit="s"
            onChange={(seconds) => setTrimDraft({ ...trim, seconds })}
          />
          <button disabled={preparing} onClick={() => run(prepareReaction)}>
            {preparing ? "Preparing reaction…" : "Apply reaction trim"}
          </button>
        </details>
      )}
      <Select
        label="Meme image"
        value={meme?.asset ?? ""}
        mixed={mixed}
        disabled={targets.every((m) => !canAdd(m.effect))}
        options={[
          ["", "None"],
          ...(meme && !asset
            ? [[meme.asset, "Missing image"] as [string, string]]
            : []),
          ...assets.map((a): [string, string] => [a.id, a.name]),
        ]}
        onChange={(id) =>
          edit("Choose starting-square meme", (draft) => {
            for (const m of group(draft)) setImage(m.effect, id);
          })
        }
      />
      {meme && !animated && images[meme.asset] && (
        <div className="starting-square-meme-image">
          <img
            src={images[meme.asset]}
            alt="Meme preview cropped to a square"
            style={{
              objectPosition: `${(meme.x ?? 0.5) * 100}% ${(meme.y ?? 0.5) * 100}%`,
              transformOrigin: `${(meme.x ?? 0.5) * 100}% ${(meme.y ?? 0.5) * 100}%`,
              transform: `scale(${meme.zoom ?? 1})`,
            }}
          />
        </div>
      )}
      {meme && !asset && (
        <p className="danger">
          Relink the meme image in Files or choose a replacement.
        </p>
      )}
      {meme && (
        <Range
          label="Meme duration"
          value={meme.duration}
          min={memeTiming.min}
          max={memeTiming.max}
          step={0.01}
          unit="s"
          disabled={targets.every((m) => m.effect.locked)}
          mixed={targets.some(
            (m) => m.effect.preMoveMeme?.duration !== meme.duration,
          )}
          onChange={(duration) =>
            edit("Starting-square meme duration", (draft) => {
              for (const { effect } of group(draft))
                if (effect.preMoveMeme && !effect.locked)
                  effect.preMoveMeme.duration = duration;
            })
          }
        />
      )}
      {meme && (
        <details className="meme-crop-settings">
          <summary>Crop and transition</summary>
          <Range
            label="Meme crop zoom"
            value={(meme.zoom ?? 1) * 100}
            min={100}
            max={300}
            step={1}
            unit="%"
            resetValue={100}
            onChange={(value) => crop("zoom", value / 100)}
          />
          <Range
            label="Meme crop horizontal"
            value={(meme.x ?? 0.5) * 100}
            min={0}
            max={100}
            step={1}
            unit="%"
            resetValue={50}
            onChange={(value) => crop("x", value / 100)}
          />
          <Range
            label="Meme crop vertical"
            value={(meme.y ?? 0.5) * 100}
            min={0}
            max={100}
            step={1}
            unit="%"
            resetValue={50}
            onChange={(value) => crop("y", value / 100)}
          />
          <Range
            label="Meme fade time"
            value={meme.fade ?? 0}
            min={0}
            max={0.25}
            step={0.01}
            unit="s"
            resetValue={0}
            onChange={(value) => crop("fade", value)}
          />
        </details>
      )}
      <p className="hint">
        Fills the moving piece’s square until departure. A longer meme adds time
        before the move. On a timing lock, the meme fits the time already
        reserved.
      </p>
      {targets.every((m) => !canAdd(m.effect)) && (
        <p className="hint">
          Unlock this move’s timing to make room for an image.
        </p>
      )}
    </>
  );
  return standalone ? (
    controls
  ) : (
    <Section
      title="Starting-square meme"
      status={
        mixed ? "Mixed" : (asset?.name ?? (meme ? "Image missing" : "Off"))
      }
      open={false}
    >
      {controls}
    </Section>
  );
}
