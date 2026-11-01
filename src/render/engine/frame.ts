import { evaluate, shortsFraming } from "../../core/timeline";
import { buildGame, type Game } from "../../core/chess";
import type { Project, Format } from "../../core/project";
export function evaluateRenderFrame(
  p: Project,
  time: number,
  w: number,
  h: number,
  format: Format = p.format,
  game: Game = buildGame(p),
) {
  if (!Number.isFinite(time) || time < 0)
    throw RangeError("Invalid render time");
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1)
    throw RangeError("Invalid render dimensions");
  const bg = p.layouts[format];
  const e = evaluate(p, time, game, format);
  const fx = p.boardFX;
  const gameFraming =
    p.moves[e.index]?.effect.cameras[format]?.mode === "game" && time >= p.lead;
  const short = format === "vertical" && (p.shorts.enabled || gameFraming);
  let boardLevel = 0;
  if (fx.intro && fx.introPreset !== "still" && time < p.lead) {
    const u = Math.min(1, time / Math.min(p.lead, fx.introDuration)),
      k = u * u * (3 - 2 * u);
    if (fx.introPreset === "board-level") {
      const rise = Math.min(1, Math.max(0, (u - 0.3) / 0.7));
      boardLevel = 1 - rise * rise * (3 - 2 * rise);
      e.camera.tilt += 82 * boardLevel;
    }
    if (fx.introPreset !== "turn")
      e.camera.zoom = fx.introZoom + (e.camera.zoom - fx.introZoom) * k;
    if (fx.introPreset !== "zoom" && fx.introPreset !== "board-level")
      e.camera.rotation += fx.introTurn * (1 - k);
  }
  const shimmer = fx.enabled
    ? 1 +
      fx.shimmer *
        (0.55 * Math.sin(time * fx.shimmerSpeed * 6.283) +
          0.3 * Math.sin(time * fx.shimmerSpeed * 10.17) +
          0.15 * Math.sin(time * fx.shimmerSpeed * 17.33))
    : 1;

  const square = format === "square-in-vertical",
    crop = short
      ? shortsFraming(
          p,
          e.camera,
          w,
          h,
          (e.jam?.envelope ?? 0) * (e.jam?.settings.focus ?? 0),
        )
      : null,
    viewH = crop
      ? gameFraming
        ? Math.min(h, Math.round((w * 7) / 8))
        : crop.viewH
      : square
        ? w
        : h,
    viewY = crop
      ? gameFraming
        ? Math.round((h - viewH) * (1 - p.shorts.position))
        : crop.viewY
      : square
        ? Math.round((h - w) / 2 + (bg.y * w) / 8)
        : 0;
  if (gameFraming && crop) {
    crop.halfX = ((p.gameViewWidth / 2) * 1.45) / Math.max(0.1, e.camera.zoom);
    crop.halfY = (crop.halfX * viewH) / w;
    crop.x = e.camera.x;
    crop.y = e.camera.y;
  }

  const sign = p.style.orientation === "white" ? 1 : -1;
  return {
    p,
    e,
    time,
    w,
    h,
    format,
    game,
    short,
    square,
    crop,
    viewH,
    viewY,
    sign,
    boardLevel,
    shimmer,
  };
}
export type RenderFrame = ReturnType<typeof evaluateRenderFrame>;
