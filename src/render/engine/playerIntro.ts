import * as T from "three";
import { clamp, ease } from "../../core/timeline";
import type { RenderFrame } from "./frame";

export function playerIntroFrame(c: RenderFrame) {
  const settings = c.authoring.playerIntro;
  if (!settings?.asset || c.titleCard) return null;
  const shot = c.shot && c.authoring.storyboard.shots[c.shot.index];
  const end =
    c.mode === "source"
      ? settings.enabled
        ? c.p.lead
        : 0
      : shot?.kind === "position-hold" && shot.showPlayerIntro
        ? shot.duration
        : 0;
  const time = c.mode === "source" ? c.time : (c.shot?.localTime ?? 0);
  if (time >= end) return null;
  const fade = Math.min(0.45, end / 3);
  const entry = ease(time / fade);
  return {
    settings,
    asset: settings.asset,
    time,
    entry,
    opacity: entry * ease((end - time) / fade),
  };
}

export function drawPlayerIntro(
  ctx: CanvasRenderingContext2D,
  c: RenderFrame,
  camera: T.Camera,
  image: HTMLImageElement,
  frame: NonNullable<ReturnType<typeof playerIntroFrame>>,
) {
  const { settings, entry, opacity } = frame;
  const { w, h, viewH, viewY } = c;
  const unit = Math.min(w, viewH);
  const scale = settings.transition === "zoom" ? 0.76 + 0.24 * entry : 1;
  const box = unit * settings.size * scale;
  const fit = box / Math.max(image.naturalWidth, image.naturalHeight);
  const width = image.naturalWidth * fit;
  const height = image.naturalHeight * fit;
  const font = Math.max(10, unit * 0.045);
  const name = settings.name.trim();
  const center = new T.Vector3().project(camera);
  const top = h - viewY - viewH;
  const nameSpace = name ? font * 1.45 : 0;
  const x = clamp(((center.x + 1) * w) / 2, width / 2, w - width / 2);
  const rise = settings.transition === "rise" ? unit * 0.05 * (1 - entry) : 0;
  const y =
    clamp(
      top + ((1 - center.y) * viewH) / 2 + rise,
      top + (height + nameSpace) / 2,
      top + viewH - (height + nameSpace) / 2,
    ) -
    nameSpace / 2;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.shadowColor = "#000a";
  ctx.shadowBlur = unit * 0.02;
  ctx.shadowOffsetY = unit * 0.008;
  ctx.drawImage(image, x - width / 2, y - height / 2, width, height);
  if (name) {
    const labelY = y + height / 2 + font * 0.22;
    ctx.shadowBlur = unit * 0.01;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.lineJoin = "round";
    ctx.font = `bold ${font}px system-ui, sans-serif`;
    ctx.strokeStyle = "#151717";
    ctx.lineWidth = Math.max(2, font * 0.14);
    ctx.fillStyle = "#fff";
    const labelX = clamp(x, w * 0.12, w * 0.88);
    const maxWidth = Math.min(unit * 0.9, 2 * Math.min(labelX, w - labelX) - 8);
    ctx.strokeText(name, labelX, labelY, maxWidth);
    ctx.fillText(name, labelX, labelY, maxWidth);
  }
  ctx.restore();
}
