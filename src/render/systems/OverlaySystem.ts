import * as T from "three";
import type { RenderFrame } from "../engine/frame";
import { Resources, radialTexture } from "../engine/resources";
import type { Project } from "../../core/project";
import { badge, clamp } from "../../core/timeline";
const symbols: Record<string, string> = {
  book: "▤",
  brilliant: "!!",
  best: "★",
  good: "✓",
  inaccuracy: "?!",
  mistake: "?",
  blunder: "??",
};
export class OverlaySystem {
  private resources = new Resources();
  private badge: T.Sprite;
  private badgeGlow: T.Sprite;
  private badgeRing: T.Mesh;
  private badgeKey = "";
  private generated: T.Texture | null = null;
  private lastAsset: T.Texture | undefined;
  private radial = radialTexture();
  private overlayScene = new T.Scene();
  private overlayCanvas = document.createElement("canvas");
  private overlayTexture = new T.CanvasTexture(this.overlayCanvas);
  private backgroundCamera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  constructor(
    private root: T.Group,
    private renderer: T.WebGLRenderer,
    private assetTextures: Map<string, T.Texture>,
  ) {
    this.backgroundCamera.position.z = 2;
    this.badge = new T.Sprite(
      new T.SpriteMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.badge.renderOrder = 30;
    this.root.add(this.badge);
    this.badgeGlow = new T.Sprite(
      new T.SpriteMaterial({
        map: this.radial,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: T.AdditiveBlending,
        color: "#a6d797",
      }),
    );
    this.badgeGlow.renderOrder = 28;
    this.root.add(this.badgeGlow);
    this.badgeRing = new T.Mesh(
      new T.RingGeometry(0.4, 0.42, 64),
      new T.MeshBasicMaterial({
        transparent: true,
        side: T.DoubleSide,
        depthWrite: false,
        depthTest: false,
      }),
    );
    this.root.add(this.badgeRing);
    this.overlayScene.add(
      new T.Mesh(
        new T.PlaneGeometry(2, 2),
        new T.MeshBasicMaterial({
          map: this.overlayTexture,
          transparent: true,
          depthTest: false,
          depthWrite: false,
        }),
      ),
    );
    this.resources.tree(this.overlayScene);
    this.resources.own(this.overlayTexture);
    this.resources.own(this.radial);
    this.resources.own(this.badge.material);
    this.resources.own(this.badgeGlow.material);
    this.resources.own(this.badgeRing.geometry);
    this.resources.own(this.badgeRing.material as T.Material);
  }
  update(c: RenderFrame) {
    const {
      p,
      e,
      time,
      w,
      h,
      format,
      short,
      square,
      viewH,
      viewY,
      sign,
      boardLevel,
      shimmer,
      game,
    } = c;
    this.badge.visible = !!e.badge && !!e.badgePosition;
    this.badgeRing.visible = false;
    this.badgeGlow.visible = this.badge.visible;
    if (e.badge && e.badgePosition && e.effect) {
      const b = e.effect.badge,
        key = e.badge + b.text + (p.badgeAssets[e.badge] ?? "");
      const asset = this.assetTextures.get(p.badgeAssets[e.badge]);
      if (key !== this.badgeKey || asset !== this.lastAsset) {
        this.generated?.dispose();
        this.generated = null;
        this.lastAsset = asset;
        const mat = this.badge.material as T.SpriteMaterial;
        mat.map =
          asset ?? (this.generated = this.badgeTexture(e.badge, b.text));
        mat.needsUpdate = true;
        this.badgeKey = key;
      }
      const entry = clamp((e.u - b.start) / 0.12),
        entryScale = b.entry === "pop" ? 0.6 + 0.4 * easeLocal(entry) : 1;
      this.badge.position.set(
        e.badgePosition[0],
        e.badgePosition[1] + (b.entry === "rise" ? (1 - entry) * -0.25 : 0),
        0.45,
      );
      this.badge.scale.setScalar(b.size * entryScale);
      this.badgeGlow.position.copy(this.badge.position);
      this.badgeGlow.scale.setScalar(b.size * 2.5);
      (this.badgeGlow.material as T.SpriteMaterial).opacity =
        b.glow * b.opacity * 0.5;
      (this.badge.material as T.SpriteMaterial).opacity =
        b.opacity * (b.entry === "fade" ? entry : 1);
      if (b.ring) {
        this.badgeRing.visible = true;
        this.badgeRing.position.copy(this.badge.position);
        this.badgeRing.scale.setScalar(b.size * (1 + entry * 0.9));
        const m = this.badgeRing.material as T.MeshBasicMaterial;
        m.color.set(p.style.accent);
        m.opacity = (1 - entry) * b.opacity * 0.65;
      }
    }
  }
  private badgeTexture(kind: string, text: string) {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const x = c.getContext("2d")!;
    const colors: Record<string, string> = {
      book: "#9d9772",
      brilliant: "#54c8d8",
      best: "#96b56d",
      good: "#7aa180",
      inaccuracy: "#e7c36a",
      mistake: "#e79a5d",
      blunder: "#dd6d70",
    };
    x.shadowColor = colors[kind] ?? "#aa9ee4";
    x.shadowBlur = 20;
    x.fillStyle = colors[kind] ?? "#aa9ee4";
    x.beginPath();
    x.arc(128, 128, 99, 0, Math.PI * 2);
    x.fill();
    x.shadowBlur = 0;
    x.fillStyle = "#ffffff";
    x.font = "bold 112px system-ui";
    x.textAlign = "center";
    x.textBaseline = "middle";
    if (kind === "book") {
      x.strokeStyle = "#fff";
      x.lineWidth = 9;
      x.lineJoin = "round";
      x.beginPath();
      x.moveTo(128, 88);
      x.bezierCurveTo(108, 76, 84, 77, 65, 83);
      x.lineTo(65, 161);
      x.bezierCurveTo(88, 155, 109, 157, 128, 168);
      x.bezierCurveTo(147, 157, 168, 155, 191, 161);
      x.lineTo(191, 83);
      x.bezierCurveTo(172, 77, 148, 76, 128, 88);
      x.closePath();
      x.fill();
      x.stroke();
      x.strokeStyle = colors.book;
      x.lineWidth = 5;
      x.beginPath();
      x.moveTo(128, 88);
      x.lineTo(128, 168);
      x.stroke();
    } else if (kind === "best" || kind === "good") {
      x.beginPath();
      x.moveTo(76, 116);
      x.lineTo(102, 116);
      x.lineTo(115, 92);
      x.lineTo(123, 65);
      x.quadraticCurveTo(129, 52, 140, 62);
      x.quadraticCurveTo(148, 70, 142, 99);
      x.lineTo(176, 99);
      x.quadraticCurveTo(193, 99, 188, 116);
      x.lineTo(175, 160);
      x.quadraticCurveTo(171, 171, 158, 171);
      x.lineTo(102, 166);
      x.lineTo(76, 166);
      x.closePath();
      x.fill();
    } else
      x.fillText(kind === "custom" ? text : (symbols[kind] ?? kind), 128, 132);
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    return t;
  }

  post(c: RenderFrame) {
    const {
      p,
      e,
      time,
      w,
      h,
      format,
      short,
      square,
      viewH,
      viewY,
      sign,
      boardLevel,
      shimmer,
      game,
    } = c;
  }
  dispose() {
    this.generated?.dispose();

    this.resources.dispose();
  }
}

function easeLocal(t: number) {
  return t * t * (3 - 2 * t);
}
