import * as T from "three";
import type { RenderFrame } from "../engine/frame";
import { Resources, radialTexture, makePoints } from "../engine/resources";
import type { Project } from "../../core/project";
import { captureDustParticle } from "../../core/timeline";
export class CaptureSystem {
  private resources = new Resources();
  private halo: T.Mesh;
  private bursts: T.Points;
  private captureDust: T.Points;
  private radial = radialTexture();
  constructor(
    private root: T.Group,
    private camera: T.OrthographicCamera,
    private meshes: ReadonlyMap<string, T.Mesh>,
  ) {
    this.halo = new T.Mesh(
      new T.PlaneGeometry(2, 2),
      new T.MeshBasicMaterial({
        map: this.radial,
        transparent: true,
        depthWrite: false,
        blending: T.AdditiveBlending,
      }),
    );
    this.root.add(this.halo);
    this.bursts = makePoints(36);
    this.bursts.frustumCulled = false;
    this.root.add(this.bursts);
    this.captureDust = makePoints(2048);
    this.captureDust.geometry.setAttribute(
      "color",
      new T.Float32BufferAttribute(new Float32Array(2048 * 3), 3),
    );
    const dustMat = this.captureDust.material as T.ShaderMaterial;
    dustMat.vertexShader = dustMat.vertexShader
      .replace(
        "varying float a;",
        "attribute vec3 color; varying vec3 dustColor; varying float a;",
      )
      .replace("a=alpha;", "a=alpha; dustColor=color;");
    dustMat.fragmentShader = dustMat.fragmentShader
      .replace("uniform vec3 color;", "varying vec3 dustColor;")
      .replace("vec4(color,", "vec4(pow(dustColor,vec3(1.0/2.2)),");
    dustMat.depthTest = true;
    this.captureDust.renderOrder = 25;
    this.captureDust.frustumCulled = false;
    this.root.add(this.captureDust);
    for (const m of [this.halo, this.bursts, this.captureDust]) {
      this.resources.own(m.geometry);
      this.resources.own(m.material as T.Material);
    }
    this.resources.own(this.radial);
  }
  update(c: RenderFrame) {
    const { p, e, square, viewH, sign } = c;
    const active =
      e.pieces.find((v) => v.moving) ??
      e.pieces.find((v) => v.square === e.destination);
    this.halo.visible = e.glow > 0.001 && !!active;
    if (active) {
      this.halo.position.set(active.x, active.y, 0.04);
      this.halo.scale.setScalar(e.effect?.capture.radius ?? 1);
      const m = this.halo.material as T.MeshBasicMaterial;
      m.color.set(e.effect?.capture.color ?? "#72dce0");
      m.opacity = e.glow * 0.6;
    }
    const bp = this.bursts.geometry.attributes.position,
      ba = this.bursts.geometry.attributes.alpha,
      bs = this.bursts.geometry.attributes.size;
    for (let i = 0; i < 36; i++) {
      const t = Math.max(0, e.u - (e.effect?.capture.impact ?? 1)),
        angle = i * 2.39996,
        r = t * (1 + (i % 5)) * 3;
      bp.setXYZ(
        i,
        (active?.x ?? 0) + Math.cos(angle) * r,
        (active?.y ?? 0) + Math.sin(angle) * r,
        0.4,
      );
      ba.setX(i, e.effect?.capture.particles ? e.impact * 0.4 : 0);
      bs.setX(i, 0.035);
    }
    bp.needsUpdate = ba.needsUpdate = bs.needsUpdate = true;
    (this.bursts.material as T.ShaderMaterial).uniforms.color.value.set(
      e.effect?.capture.color ?? "#ffffff",
    );
    (this.bursts.material as T.ShaderMaterial).uniforms.pixels.value =
      viewH / 9;
    const dg = this.captureDust.geometry,
      dp = dg.attributes.position,
      da = dg.attributes.alpha,
      ds = dg.attributes.size,
      dc = dg.attributes.color;
    let dustIndex = 0;
    for (const event of e.dust) {
      const template = this.meshes.get(
        `template-${p.style.pieceSet}-${event.color}-${event.type}`,
      );
      const samples = template?.userData.dustSamples as
        | { x: number; y: number; color: number[] }[]
        | undefined;
      if (!samples?.length) continue;
      for (let i = 0; i < event.amount && dustIndex < 2048; i++, dustIndex++) {
        const sample =
          samples[
            (Math.floor((i * samples.length) / event.amount) + event.seed) %
              samples.length
          ];
        const a = captureDustParticle(i, event, {
          x: sample.x * sign,
          y: sample.y * sign,
        });
        dp.setXYZ(dustIndex, a.x, a.y, a.z);
        da.setX(dustIndex, a.alpha);
        ds.setX(dustIndex, a.size);
        dc.setXYZ(dustIndex, sample.color[0], sample.color[1], sample.color[2]);
      }
    }
    this.captureDust.geometry.setDrawRange(0, dustIndex);
    dp.needsUpdate = da.needsUpdate = ds.needsUpdate = dc.needsUpdate = true;
    (this.captureDust.material as T.ShaderMaterial).uniforms.softness.value =
      0.35;
    (this.captureDust.material as T.ShaderMaterial).uniforms.pixels.value =
      viewH / (this.camera.top - this.camera.bottom);
  }

  dispose() {
    this.resources.dispose();
  }
}
