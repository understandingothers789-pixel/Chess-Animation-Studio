import * as T from "three";
import type { RenderFrame } from "../engine/frame";
import { enableCrumble } from "../pieces";
import { Resources } from "../engine/resources";
const vertex = `varying vec2 uv0; void main(){uv0=uv;gl_Position=vec4(position.xy,0.,1.);}`;
/** Selective, half-resolution spatial bloom. Owns all targets; no temporal history. */
export class BloomSystem {
  private resources = new Resources();
  private targets: T.WebGLRenderTarget[] = [];
  private masks = new Map<
    T.Material,
    { material: T.MeshBasicMaterial; release: () => void }
  >();
  private mask(source: T.Material) {
    let entry = this.masks.get(source);
    if (!entry) {
      const original = source as T.MeshBasicMaterial;
      const material = new T.MeshBasicMaterial({
        color: 0,
        map: original.map ?? null,
        alphaMap: original.alphaMap ?? null,
        alphaTest: Math.max(0.02, source.alphaTest),
        side: source.side,
        depthWrite: true,
      });
      enableCrumble(material);
      const release = () => {
        source.removeEventListener("dispose", release);
        material.dispose();
        this.masks.delete(source);
      };
      entry = { material, release };
      this.masks.set(source, entry);
      source.addEventListener("dispose", release);
    }
    entry.material.opacity = source.opacity;
    entry.material.userData.crumble.value = source.userData.crumble?.value ?? 0;
    return entry.material;
  }
  private frame?: T.FramebufferTexture;
  private width = 0;
  private height = 0;
  private screen = new T.Scene();
  private screenCamera = new T.Camera();
  private black = this.resources.own(
    new T.MeshBasicMaterial({ color: 0, side: T.DoubleSide }),
  );
  private filter = this.resources.own(
    new T.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      uniforms: {
        image: { value: null },
        direction: { value: new T.Vector2() },
        threshold: { value: 0 },
        softness: { value: 0.2 },
        extract: { value: false },
      },
      vertexShader: vertex,
      fragmentShader: `varying vec2 uv0; uniform sampler2D image; uniform vec2 direction; uniform float threshold,softness; uniform bool extract;
      vec3 sampleAt(vec2 uv){ vec3 c=texture2D(image,uv).rgb; if(!extract)return c;
        float b=max(c.r,max(c.g,c.b));float gate=smoothstep(threshold,threshold+max(.001,softness),b);return c*gate; }
      void main(){vec3 c=sampleAt(uv0)*.227027;
        c+=(sampleAt(uv0+direction*1.384615)+sampleAt(uv0-direction*1.384615))*.316216;
        c+=(sampleAt(uv0+direction*3.230769)+sampleAt(uv0-direction*3.230769))*.070270;
        gl_FragColor=vec4(c,1.);}`,
    }),
  );
  private composite = this.resources.own(
    new T.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      uniforms: {
        base: { value: null },
        glow: { value: null },
        intensity: { value: 0 },
      },
      vertexShader: vertex,
      fragmentShader: `varying vec2 uv0;uniform sampler2D base,glow;uniform float intensity;
      void main(){vec3 b=texture2D(base,uv0).rgb;vec3 g=texture2D(glow,uv0).rgb;
        g=vec3(1.)-exp(-g*intensity);gl_FragColor=vec4(b+(vec3(1.)-b)*g,1.);}`,
    }),
  );
  private quad = new T.Mesh(
    this.resources.own(new T.PlaneGeometry(2, 2)),
    this.filter,
  );
  constructor(
    private renderer: T.WebGLRenderer,
    private world: T.Scene,
    private camera: T.Camera,
  ) {
    this.quad.frustumCulled = false;
    this.screen.add(this.quad);
  }
  private releaseTargets() {
    for (const target of this.targets) target.dispose();
    this.targets = [];
    this.frame?.dispose();
    this.frame = undefined;
    this.width = this.height = 0;
  }
  render(c: RenderFrame) {
    const settings = c.p.bloom;
    if (!settings.enabled || settings.intensity === 0) {
      this.releaseTargets();
      return;
    }
    const r = this.renderer;
    if (this.width !== c.w || this.height !== c.h) {
      this.releaseTargets();
      const w = Math.max(1, Math.ceil(c.w / 2)),
        h = Math.max(1, Math.ceil(c.h / 2));
      this.targets = Array.from(
        { length: 3 },
        () => new T.WebGLRenderTarget(w, h, { depthBuffer: false }),
      );
      this.targets[0].depthBuffer = true;
      this.frame = new T.FramebufferTexture(c.w, c.h);
      this.width = c.w;
      this.height = c.h;
    }
    const [mask, a, b] = this.targets;
    const saved: Array<() => void> = [];
    const background = this.world.background;
    r.setViewport(0, 0, c.w, c.h);
    r.copyFramebufferToTexture(this.frame!);
    try {
      this.world.background = null;
      this.world.traverse((object) => {
        if (
          !(
            object instanceof T.Mesh ||
            object instanceof T.Points ||
            object instanceof T.Sprite
          )
        )
          return;
        const category = object.userData.bloom as
          | "pieces"
          | "captures"
          | "highlights"
          | undefined;
        if (category && settings[category]) return;
        if (
          object instanceof T.Mesh &&
          (object.userData.bloom === "pieces" ||
            (Array.isArray(object.material)
              ? object.material.every((m) => !m.transparent)
              : !object.material.transparent))
        ) {
          const material = object.material;
          saved.push(() => {
            object.material = material;
          });
          object.material = Array.isArray(material)
            ? material.map((m) => this.mask(m))
            : this.mask(material);
        } else {
          const visible = object.visible;
          saved.push(() => {
            object.visible = visible;
          });
          object.visible = false;
        }
      });
      r.setRenderTarget(mask);
      r.setClearColor(0, 1);
      r.setScissorTest(false);
      r.clear();
      r.setViewport(
        0,
        Math.round(c.viewY / 2),
        mask.width,
        Math.max(1, Math.round(c.viewH / 2)),
      );
      r.setScissor(
        0,
        Math.round(c.viewY / 2),
        mask.width,
        Math.max(1, Math.round(c.viewH / 2)),
      );
      r.setScissorTest(true);
      r.render(this.world, this.camera);
    } finally {
      for (const restore of saved.reverse()) restore();
      this.world.background = background;
      r.setScissorTest(false);
      r.setRenderTarget(null);
    }
    const u = this.filter.uniforms;
    u.threshold.value = settings.threshold;
    u.softness.value = settings.softness;
    this.quad.material = this.filter;
    u.image.value = mask.texture;
    u.extract.value = true;
    u.direction.value.set(settings.radius / mask.width, 0);
    r.setRenderTarget(a);
    r.render(this.screen, this.screenCamera);
    u.image.value = a.texture;
    u.extract.value = false;
    u.direction.value.set(0, settings.radius / mask.height);
    r.setRenderTarget(b);
    r.render(this.screen, this.screenCamera);
    this.quad.material = this.composite;
    this.composite.uniforms.base.value = this.frame;
    this.composite.uniforms.glow.value = b.texture;
    this.composite.uniforms.intensity.value = settings.intensity;
    r.setRenderTarget(null);
    r.setViewport(0, 0, c.w, c.h);
    r.render(this.screen, this.screenCamera);
  }
  dispose() {
    this.releaseTargets();
    for (const entry of [...this.masks.values()]) entry.release();
    this.resources.dispose();
    this.screen.clear();
  }
}
