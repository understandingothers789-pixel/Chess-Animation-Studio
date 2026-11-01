import * as T from "three";
import type { RenderFrame } from "../engine/frame";
import { Resources } from "../engine/resources";
import type { Project } from "../../core/project";
import { cycleColor } from "../engine/colors";
export class BoardSystem {
  private resources = new Resources();
  private coordinates: boolean | undefined;
  readonly squares: T.Mesh[] = [];
  private labels: T.Sprite[] = [];
  private rim: T.Mesh;
  constructor(private root: T.Group) {
    this.rim = new T.Mesh(
      new T.BoxGeometry(8.22, 8.22, 0.11),
      new T.MeshStandardMaterial({ color: "#414b44", roughness: 0.75 }),
    );
    this.rim.position.z = -0.08;
    this.root.add(this.rim);
    for (let rank = 0; rank < 8; rank++)
      for (let file = 0; file < 8; file++) {
        const square = new T.Mesh(
          new T.PlaneGeometry(1, 1),
          new T.MeshBasicMaterial({
            stencilWrite: true,
            stencilRef: 1,
            stencilFunc: T.AlwaysStencilFunc,
            stencilZPass: T.ReplaceStencilOp,
          }),
        );
        square.position.set(file - 3.5, rank - 3.5, 0);
        square.userData.dark = (file + rank) % 2 === 0;
        this.root.add(square);
        this.squares.push(square);
      }
    this.resources.own(this.rim.geometry);
    this.resources.own(this.rim.material as T.Material);
    for (const m of this.squares) {
      this.resources.own(m.geometry);
      this.resources.own(m.material as T.Material);
    }
  }
  update(c: RenderFrame) {
    const { p, e, time, shimmer } = c;
    if (this.coordinates !== p.style.coordinates) {
      this.rebuildCoordinates(p);
      this.coordinates = p.style.coordinates;
    }
    const fx = p.boardFX;
    (this.rim.material as T.MeshStandardMaterial).color.set(p.style.rim);
    (this.rim.material as T.MeshStandardMaterial).emissive
      .set(fx.rimColor ?? p.style.accent)
      .multiplyScalar(
        fx.enabled
          ? fx.rim * (0.5 + 0.5 * Math.sin(time * fx.rimSpeed * 6.283))
          : 0,
      );
    for (const s of this.squares) {
      const m = s.material as T.MeshBasicMaterial;
      m.color.set(s.userData.dark ? p.style.dark : p.style.light);
      m.color.multiplyScalar(shimmer);
      if (e.jam && s.userData.dark)
        m.color.lerp(
          new T.Color(e.jam.color),
          e.jam.settings.colorStrength *
            e.jam.envelope *
            (0.2 + 0.8 * e.jam.pulse),
        );
      if (fx.enabled)
        m.color.lerp(
          new T.Color(fx.lightingColor ?? "#ffffff"),
          fx.shimmer * 0.12,
        );
      if (fx.enabled && fx.sweep) {
        const wave = Math.exp(
          -Math.pow(
            (s.position.x +
              s.position.y * 0.4 -
              (((time * fx.sweepSpeed * 12) % 20) - 10)) /
              1.8,
            2,
          ),
        );
        m.color.lerp(new T.Color(fx.sweepColor ?? "#ffffff"), wave * fx.sweep);
      }
      if (s.userData.dark && fx.enabled && fx.beatClock) {
        const beat = ((time * fx.bpm) / 60) % 1,
          level = Math.exp(((-beat * (60 / fx.bpm)) / fx.beatDecay) * 4);
        m.color.lerp(new T.Color(fx.beatColor), level * fx.beatStrength);
      }

      if (s.userData.dark)
        m.color.lerp(cycleColor(p.pulse.color, p.pulse.rainbow, time), e.pulse);
    }
  }
  private rebuildCoordinates(p: Project) {
    for (const s of this.labels) {
      this.root.remove(s);
      (s.material as T.SpriteMaterial).map?.dispose();
      s.material.dispose();
    }
    this.labels = [];
    if (!p.style.coordinates) return;
    for (let i = 0; i < 8; i++)
      for (const file of [true, false]) {
        const c = document.createElement("canvas");
        c.width = c.height = 64;
        const x = c.getContext("2d")!;
        x.font = "38px system-ui";
        x.fillStyle = "#d9dfd1";
        x.textAlign = "center";
        x.fillText(file ? String.fromCharCode(97 + i) : String(i + 1), 32, 45);
        const s = new T.Sprite(
          new T.SpriteMaterial({
            map: new T.CanvasTexture(c),
            depthTest: false,
          }),
        );
        s.scale.set(0.23, 0.23, 1);
        s.position.set(file ? i - 3.5 : -4.23, file ? -4.23 : i - 3.5, 0.15);
        this.labels.push(s);
        this.root.add(s);
      }
  }

  dispose() {
    for (const label of this.labels) {
      label.material.map?.dispose();
      label.material.dispose();
    }
    this.resources.dispose();
  }
}
