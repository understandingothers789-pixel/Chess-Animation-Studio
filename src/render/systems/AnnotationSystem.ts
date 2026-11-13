import * as T from "three";
import type { Project } from "../../core/project";
import { xy } from "../../core/chess";
import { annotationOpacity, type Annotation } from "../../core/annotations";
import type { RenderFrame } from "../engine/frame";
import { captionCache } from "../../core/captions/layout";
export class AnnotationSystem {
  private project?: Project;
  private textBounds: {
    id: string;
    left: number;
    top: number;
    right: number;
    bottom: number;
    areaLeft: number;
    areaRight: number;
    scale: number;
  }[] = [];
  private shapes: { mesh: T.Mesh; a: Annotation }[] = [];
  private canvas = document.createElement("canvas");
  private layout = captionCache((text, size, font, weight) => {
    const ctx = this.canvas.getContext("2d")!;
    ctx.font = `${weight} ${size}px ${font}`;
    return ctx.measureText(text).width;
  });
  private texture = new T.CanvasTexture(this.canvas);
  private overlay = new T.Scene();
  private camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  private plane = new T.Mesh(
    new T.PlaneGeometry(2, 2),
    new T.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    }),
  );
  constructor(
    private root: T.Group,
    private renderer: T.WebGLRenderer,
  ) {
    this.camera.position.z = 2;
    this.overlay.add(this.plane);
  }
  private clear() {
    for (const { mesh } of this.shapes) {
      this.root.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as T.Material).dispose();
    }
    this.shapes = [];
  }
  update(c: RenderFrame) {
    if (this.project !== c.p) {
      this.clear();
      this.project = c.p;
      for (const a of c.p.annotations ?? []) {
        if (a.kind === "text" || a.kind === "caption") continue;
        const [x, y] = xy(a.from),
          [tx, ty] = xy(a.to);
        let geometry: T.BufferGeometry;
        if (a.kind === "circle")
          geometry = new T.RingGeometry(0.43, 0.43 + a.width, 64);
        else {
          const length = Math.hypot(tx - x, ty - y);
          const shape = new T.Shape();
          const w = a.width;
          shape.moveTo(0, -w);
          shape.lineTo(Math.max(0, length - 0.35), -w);
          shape.lineTo(Math.max(0, length - 0.35), -w * 3);
          shape.lineTo(length, 0);
          shape.lineTo(Math.max(0, length - 0.35), w * 3);
          shape.lineTo(Math.max(0, length - 0.35), w);
          shape.lineTo(0, w);
          shape.closePath();
          geometry = new T.ShapeGeometry(shape);
        }
        const mesh = new T.Mesh(
          geometry,
          new T.MeshBasicMaterial({
            color: a.color,
            transparent: true,
            depthTest: false,
            depthWrite: false,
            side: T.DoubleSide,
          }),
        );
        mesh.position.set(x, y, 0.8);
        if (a.kind === "arrow") mesh.rotation.z = Math.atan2(ty - y, tx - x);
        mesh.renderOrder = 45;
        this.root.add(mesh);
        this.shapes.push({ mesh, a });
      }
    }
    for (const { mesh, a } of this.shapes) {
      const opacity = annotationOpacity(a, c.annotationTime);
      mesh.visible = opacity > 0;
      (mesh.material as T.MeshBasicMaterial).opacity = opacity;
      mesh.scale.setScalar(
        a.entrance === "pop"
          ? Math.max(
              0.01,
              Math.min(
                1,
                (c.annotationTime - a.start) / Math.max(0.001, a.fade),
              ),
            )
          : 1,
      );
    }
  }
  post(c: RenderFrame) {
    this.textBounds = [];
    const text = (c.p.annotations ?? []).filter(
      (a) =>
        (a.kind === "text" || a.kind === "caption") &&
        annotationOpacity(a, c.annotationTime) > 0,
    );
    if (!text.length) return;
    if (this.canvas.width !== c.w || this.canvas.height !== c.h) {
      // WebGL texture storage is immutable after allocation. Preview/thumbnail/PNG
      // resizes must reallocate it, or stale caption pixels survive the resize.
      this.texture.dispose();
      this.canvas.width = c.w;
      this.canvas.height = c.h;
    }
    const ctx = this.canvas.getContext("2d")!;
    ctx.clearRect(0, 0, c.w, c.h);
    for (const a of text) {
      ctx.save();
      ctx.globalAlpha = annotationOpacity(a, c.annotationTime);
      const layout = this.layout(a, c.w, c.h, c.format),
        { lines, x, y } = layout,
        size = layout.fontSize,
        width = layout.bounds.width,
        height = layout.bounds.height,
        left = layout.bounds.x;
      ctx.font = `${a.layout.weight} ${size}px ${a.font}`;
      ctx.textAlign = a.align;
      ctx.textBaseline = "middle";
      const pop =
        a.entrance === "pop"
          ? Math.max(
              0.01,
              Math.min(
                1,
                (c.annotationTime - a.start) / Math.max(0.001, a.fade),
              ),
            )
          : 1;
      this.textBounds.push({
        id: a.id,
        left: x + (left - x) * pop,
        right: x + (left + width - x) * pop,
        top: y - (height / 2) * pop,
        bottom: y + (height / 2) * pop,
        areaLeft: x + (layout.area.left - x) * pop,
        areaRight: x + (layout.area.right - x) * pop,
        scale: pop,
      });
      if (a.entrance === "pop") {
        const scale = Math.max(
          0.01,
          Math.min(1, (c.annotationTime - a.start) / Math.max(0.001, a.fade)),
        );
        ctx.translate(x, y);
        ctx.scale(scale, scale);
        ctx.translate(-x, -y);
      }
      ctx.fillStyle = a.background;
      ctx.fillRect(left, y - height / 2, width, height);
      if (a.shadow) {
        ctx.shadowColor = "#000000";
        ctx.shadowBlur = size * 0.2;
      }
      ctx.fillStyle = a.color;
      ctx.strokeStyle = "#08120b";
      ctx.lineWidth = size * 0.08;
      lines.forEach((line, i) => {
        const ly = y + (i - (lines.length - 1) / 2) * layout.lineHeight;
        if (a.outline) ctx.strokeText(line, x, ly);
        ctx.fillText(line, x, ly);
      });
      ctx.restore();
    }
    this.texture.needsUpdate = true;
    this.renderer.setViewport(0, 0, c.w, c.h);
    this.renderer.clearDepth();
    this.renderer.render(this.overlay, this.camera);
  }
  get bounds() {
    return this.textBounds;
  }
  /** Hit-test the visible geometry/text already used by the render passes. */
  pick(px: number, py: number, ray?: T.Raycaster) {
    const text = [...this.textBounds]
      .reverse()
      .find(
        (b) => px >= b.left && px <= b.right && py >= b.top && py <= b.bottom,
      );
    if (text) return text.id;
    if (ray)
      for (const { mesh, a } of [...this.shapes].reverse())
        if (mesh.visible && ray.intersectObject(mesh).length) return a.id;
    return null;
  }
  dispose() {
    this.clear();
    this.texture.dispose();
    this.plane.geometry.dispose();
    this.plane.material.dispose();
  }
}
