import * as T from "three";
import type { RenderFrame } from "../engine/frame";
import { Resources, makePoints } from "../engine/resources";
import { xy } from "../../core/chess";
/** Analytic drag integral: repeatable at any seek position, with zero integration state. */
export function cinematicParticle(
  index: number,
  age: number,
  spread: number,
  kind: number,
) {
  const seed = (index + 1) * 12.9898 + kind * 78.233;
  const random = (n: number) => {
    const v = Math.sin(seed + n * 37.719) * 43758.5453;
    return v - Math.floor(v);
  };
  const angle = random(0) * Math.PI * 2,
    drag = kind === 2 ? 3 : kind === 1 ? 1.4 : 0.8;
  const travel =
    ((1 - Math.exp(-drag * age)) / drag) * spread * (0.7 + random(1) * 2);
  return {
    x: Math.cos(angle) * travel,
    y: Math.sin(angle) * travel,
    z: Math.max(
      0.025,
      (kind === 2 ? 0.15 : 0.4) * age +
        random(2) * age * 0.9 -
        (kind === 1 ? 0.7 : 0.12) * age * age,
    ),
    rotation: random(3) * Math.PI,
  };
}
/** Lazy, bounded world-space batches. Historical capture rendering is untouched. */
export class CinematicCaptureSystem {
  private resources?: Resources;
  private group = new T.Group();
  private points: T.Points[] = [];
  private rings?: T.InstancedMesh;
  constructor(
    private root: T.Group,
    private camera: T.OrthographicCamera,
    private meshes: ReadonlyMap<string, T.Mesh>,
  ) {}
  private initialize() {
    const resources = (this.resources = new Resources());
    for (let kind = 0; kind < 3; kind++) {
      const points = makePoints(1536);
      points.userData.bloom = "captures";
      points.frustumCulled = false;
      points.geometry.setAttribute(
        "tint",
        new T.Float32BufferAttribute(new Float32Array(1536 * 3), 3),
      );
      const mat = points.material as T.ShaderMaterial;
      mat.vertexShader =
        "attribute vec3 tint;varying vec3 vTint;" +
        mat.vertexShader.replace("a=alpha;", "a=alpha;vTint=tint;");
      mat.fragmentShader =
        "varying vec3 vTint;" +
        mat.fragmentShader.replace("vec4(color,", "vec4(vTint,");
      if (kind === 1)
        mat.fragmentShader = mat.fragmentShader.replace(
          "length(gl_PointCoord-.5)*2.",
          "max(abs(gl_PointCoord.x-.5),abs(gl_PointCoord.y-.5))*2.",
        );
      mat.depthTest = true;
      mat.blending = kind === 0 ? T.AdditiveBlending : T.NormalBlending;
      points.renderOrder = 26 + kind;
      this.group.add(points);
      this.points.push(points);
      resources.own(points.geometry);
      resources.own(mat);
    }
    const geometry = resources.own(new T.RingGeometry(0.85, 1, 64));
    const material = resources.own(
      new T.MeshBasicMaterial({
        transparent: true,
        blending: T.AdditiveBlending,
        depthWrite: false,
        side: T.DoubleSide,
      }),
    );
    this.rings = new T.InstancedMesh(geometry, material, 32);
    this.rings.frustumCulled = false;
    this.rings.userData.bloom = "captures";
    resources.own(this.rings);
    this.group.add(this.rings);
    this.root.add(this.group);
  }
  update(c: RenderFrame) {
    const settings = c.p.cinematic;
    if (!settings.enabled || settings.intensity === 0) {
      this.dispose();
      return;
    }
    if (!this.resources) this.initialize();
    const counts = [0, 0, 0];
    let rings = 0;
    const transform = new T.Object3D(),
      color = new T.Color(settings.color);
    for (let j = Math.min(c.e.index, c.game.steps.length - 1); j >= 0; j--) {
      const segment = c.timeline.segments[j],
        step = c.game.steps[j];
      if (c.time - segment.finish > 3) break;
      const age =
        c.time -
        segment.depart -
        c.p.moves[j].effect.duration * c.p.moves[j].effect.capture.impact;
      if (!step.capturedId || age < 0 || age >= settings.duration) continue;
      const victim = step.before.find((v) => v.id === step.capturedId)!;
      const [x, y] = xy(victim.square),
        fade = Math.pow(1 - age / settings.duration, 2);
      const samples = this.meshes.get(
        `template-${c.p.style.pieceSet}-${victim.color}-${victim.type}`,
      )?.userData.dustSamples as { color: number[] }[] | undefined;
      for (let kind = 0; kind < 3; kind++) {
        if (![settings.sparks, settings.fragments, settings.dust][kind])
          continue;
        const g = this.points[kind].geometry;
        for (
          let i = 0;
          i < Math.ceil(settings.amount / 3) && counts[kind] < 1536;
          i++
        ) {
          const index = counts[kind]++,
            a = cinematicParticle(i + j * 263, age, settings.spread, kind);
          g.attributes.position.setXYZ(index, x + a.x, y + a.y, 0.12 + a.z);
          g.attributes.alpha.setX(
            index,
            Math.min(1, settings.intensity) * fade * (kind === 2 ? 0.4 : 1),
          );
          g.attributes.size.setX(
            index,
            settings.size *
              (kind === 0 ? 0.5 : kind === 2 ? 2 : 1) *
              (kind === 2 ? 1 + age : 1),
          );
          const tint =
            kind === 0
              ? color
              : samples?.[(i * 17 + j) % samples.length]?.color;
          if (tint instanceof T.Color)
            g.attributes.tint.setXYZ(index, tint.r, tint.g, tint.b);
          else if (tint)
            g.attributes.tint.setXYZ(
              index,
              ...(tint as [number, number, number]),
            );
          else g.attributes.tint.setXYZ(index, 0.6, 0.55, 0.5);
        }
      }
      if (settings.shockwaves && rings < 32) {
        transform.position.set(x, y, 0.035);
        transform.scale.setScalar(
          0.15 + (age / settings.duration) * settings.spread * 2,
        );
        transform.updateMatrix();
        this.rings!.setMatrixAt(rings, transform.matrix);
        this.rings!.setColorAt(
          rings,
          color.clone().multiplyScalar(fade * settings.intensity),
        );
        rings++;
      }
    }
    this.points.forEach((points, i) => {
      points.geometry.setDrawRange(0, counts[i]);
      for (const a of Object.values(points.geometry.attributes))
        a.needsUpdate = true;
      (points.material as T.ShaderMaterial).uniforms.pixels.value =
        c.viewH / (this.camera.top - this.camera.bottom);
    });
    this.rings!.count = rings;
    this.rings!.instanceMatrix.needsUpdate = true;
    if (this.rings!.instanceColor) this.rings!.instanceColor.needsUpdate = true;
    (this.rings!.material as T.MeshBasicMaterial).opacity = 0.45;
  }
  dispose() {
    this.root.remove(this.group);
    this.group.clear();
    this.resources?.dispose();
    this.resources = undefined;
    this.points = [];
    this.rings = undefined;
  }
}
