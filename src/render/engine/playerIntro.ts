import * as T from "three";
import { clamp, ease } from "../../core/timeline";
import { squareVideoEnd } from "../../core/introVideo";
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
  const start = c.mode === "source" ? squareVideoEnd(c.p) : 0;
  if (time >= end || time < start) return null;
  const fade = Math.min(settings.fade ?? 0.45, (end - start) / 3);
  const entry = ease((time - start) / fade);
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
  const spotlight = settings.transition === "spotlight";
  const scale =
    settings.transition === "zoom" || spotlight ? 0.82 + 0.18 * entry : 1;
  const box = unit * settings.size * scale;
  const fit = box / Math.max(image.naturalWidth, image.naturalHeight);
  const width = image.naturalWidth * fit;
  const height = image.naturalHeight * fit;
  const font = Math.max(10, unit * 0.045);
  const name = settings.name.trim();
  const caption = settings.caption?.trim();
  const center = new T.Vector3().project(camera);
  const top = h - viewY - viewH;
  const nameSpace = (name ? font * 1.45 : 0) + (caption ? font : 0);
  const x = clamp(((center.x + 1) * w) / 2, width / 2, w - width / 2);
  const rise =
    settings.transition === "rise" || spotlight ? unit * 0.05 * (1 - entry) : 0;
  const y =
    clamp(
      top + ((1 - center.y) * viewH) / 2 + rise,
      top + (height + nameSpace) / 2,
      top + viewH - (height + nameSpace) / 2,
    ) -
    nameSpace / 2;

  ctx.save();
  ctx.globalAlpha = opacity;
  if (spotlight) {
    const glow = ctx.createRadialGradient(x, y, box * 0.05, x, y, box * 0.82);
    glow.addColorStop(0, "#c3e9cc77");
    glow.addColorStop(0.5, "#88caa335");
    glow.addColorStop(1, "#88caa300");
    ctx.fillStyle = glow;
    ctx.fillRect(0, top, w, viewH);
  }
  ctx.shadowColor = "#000a";
  ctx.shadowBlur = unit * 0.02;
  ctx.shadowOffsetY = unit * 0.008;
  ctx.drawImage(image, x - width / 2, y - height / 2, width, height);
  if (name || caption) {
    const labelY = y + height / 2 + font * 0.24;
    const labelX = clamp(x, w * 0.12, w * 0.88);
    const maxWidth = Math.max(
      font,
      Math.min(unit * 0.85, 2 * Math.min(labelX, w - labelX) - 10),
    );
    ctx.shadowBlur = unit * 0.014;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(2, font * 0.15);
    ctx.strokeStyle = "#101715";
    if (name) {
      ctx.font = `bold ${font}px system-ui, sans-serif`;
      ctx.fillStyle = "#fff";
      ctx.strokeText(name, labelX, labelY, maxWidth);
      ctx.fillText(name, labelX, labelY, maxWidth);
    }
    if (caption) {
      const captionY = labelY + (name ? font * 1.24 : 0);
      ctx.font = `600 ${font * 0.57}px system-ui, sans-serif`;
      ctx.fillStyle = "#f1db9d";
      ctx.strokeText(caption, labelX, captionY, maxWidth);
      ctx.fillText(caption, labelX, captionY, maxWidth);
    }
  }
  ctx.restore();
}
