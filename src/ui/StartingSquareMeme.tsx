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
}: {
  project: Project;
  index: number;
  targets: Project["moves"];
  edit: Edit;
  images: Record<string, string>;
  run: (job: () => Promise<unknown>) => void;
  seek?: (time: number) => void;
  segment: Parameters<typeof memeWindow>[1];
}) {
  const move = project.moves[index];
  const active = (targets.find((m) => m.id === move.id) ?? targets[0]).effect;
  const meme = active.preMoveMeme;
  const preview = memeWindow(move.effect, segment);
  const assets = project.assets.filter((a) => a.kind === "image");
  const asset = assets.find((a) => a.id === meme?.asset);
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
        asset: id,
        duration:
          fx.preMoveMeme?.duration ??
          (fx.locked
            ? Math.min(fx.delay, memeTiming.default)
            : memeTiming.default),
      };
  };

  return (
    <Section
      title="Starting-square meme"
      status={
        mixed ? "Mixed" : (asset?.name ?? (meme ? "Image missing" : "Off"))
      }
      open={false}
    >
      <div className="button-row">
        <button
          type="button"
          disabled={targets.every((m) => !canAdd(m.effect))}
          onClick={() =>
            run(async () => {
              const image = await window.studio.importAsset("image");
              if (!image) return;
              edit("Import starting-square meme", (draft) => {
                if (draft.id !== project.id) return;
                const eligible = group(draft).filter((m) => canAdd(m.effect));
                if (!eligible.length) return;
                const existing = draft.assets.find(
                  (a) => a.kind === image.kind && a.path === image.path,
                );
                if (!existing) draft.assets.push(image);
                for (const m of eligible)
                  setImage(m.effect, (existing ?? image).id);
              });
            })
          }
        >
          Import meme image
        </button>
        {preview && seek && (
          <button
            type="button"
            onClick={() => seek((preview.start + preview.end) / 2)}
          >
            Preview meme on board
          </button>
        )}
      </div>
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
      {meme && images[meme.asset] && (
        <img
          className="starting-square-meme-image"
          src={images[meme.asset]}
          alt="Meme preview cropped to a square"
        />
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
      <p className="hint">
        Fills the moving piece’s square until departure. A longer meme adds time
        before the move. On a timing lock, the meme fits the time already
        reserved.
      </p>
    </Section>
  );
}
