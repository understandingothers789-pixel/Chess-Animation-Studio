import * as T from "three";
import type { Project } from "../../core/project";
import { xy } from "../../core/chess";
import { annotationOpacity, type Annotation } from "../../core/annotations";
import type { RenderFrame } from "../engine/frame";
export class AnnotationSystem {
  private project?: Project;
  private shapes: { mesh: T.Mesh; a: Annotation }[] = [];
  private canvas = document.createElement("canvas");
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
      const opacity = annotationOpacity(a, c.time);
      mesh.visible = opacity > 0;
      (mesh.material as T.MeshBasicMaterial).opacity = opacity;
      mesh.scale.setScalar(
        a.entrance === "pop"
          ? Math.max(
              0.01,
              Math.min(1, (c.time - a.start) / Math.max(0.001, a.fade)),
            )
          : 1,
      );
    }
  }
  post(c: RenderFrame) {
    const text = (c.p.annotations ?? []).filter(
      (a) =>
        (a.kind === "text" || a.kind === "caption") &&
        annotationOpacity(a, c.time) > 0,
    );
    if (!text.length) return;
    if (this.canvas.width !== c.w || this.canvas.height !== c.h) {
      this.canvas.width = c.w;
      this.canvas.height = c.h;
    }
    const ctx = this.canvas.getContext("2d")!;
    ctx.clearRect(0, 0, c.w, c.h);
    for (const a of text) {
      ctx.save();
      ctx.globalAlpha = annotationOpacity(a, c.time);
      const size = (a.size * c.w) / 1920;
      ctx.font = `600 ${size}px ${a.font}`;
      ctx.textAlign = a.align;
      ctx.textBaseline = "middle";
      const lines = a.text.split("\n"),
        width = Math.max(...lines.map((l) => ctx.measureText(l).width)),
        height = lines.length * size * 1.3,
        x = a.x * c.w,
        y = a.y * c.h,
        left =
          x -
          (a.align === "center" ? width / 2 : a.align === "right" ? width : 0);
      if (a.entrance === "pop") {
        const scale = Math.max(
          0.01,
          Math.min(1, (c.time - a.start) / Math.max(0.001, a.fade)),
        );
        ctx.translate(x, y);
        ctx.scale(scale, scale);
        ctx.translate(-x, -y);
      }
      ctx.fillStyle = a.background;
      ctx.fillRect(
        left - size * 0.4,
        y - height / 2 - size * 0.25,
        width + size * 0.8,
        height + size * 0.5,
      );
      if (a.shadow) {
        ctx.shadowColor = "#000000";
        ctx.shadowBlur = size * 0.2;
      }
      ctx.fillStyle = a.color;
      ctx.strokeStyle = "#08120b";
      ctx.lineWidth = size * 0.08;
      lines.forEach((line, i) => {
        const ly = y + (i - (lines.length - 1) / 2) * size * 1.3;
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
  dispose() {
    this.clear();
    this.texture.dispose();
    this.plane.geometry.dispose();
    this.plane.material.dispose();
  }
}
