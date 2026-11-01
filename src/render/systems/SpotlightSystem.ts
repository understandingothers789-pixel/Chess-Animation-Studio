import * as T from "three";
import type { RenderFrame } from "../engine/frame";
import { Resources, radialTexture, makePoints } from "../engine/resources";
export class SpotlightSystem {
  private resources = new Resources();
  private jamTile: T.Mesh;
  private jamGlow: T.Mesh;
  private jamRing: T.Mesh;
  private jamSparkles: T.Points;
  private jamPost: T.Mesh;
  private jamPostScene = new T.Scene();
  private jamFrame: T.FramebufferTexture | null = null;
  private jamFrameSize = "";
  private radial = radialTexture();
  private backgroundCamera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  constructor(
    private root: T.Group,
    private renderer: T.WebGLRenderer,
    private camera: T.OrthographicCamera,
  ) {
    this.backgroundCamera.position.z = 2;
    this.jamTile = new T.Mesh(
      new T.PlaneGeometry(1, 1),
      new T.MeshBasicMaterial({
        color: "#34f6e6",
        transparent: true,
        depthWrite: false,
      }),
    );
    this.jamGlow = new T.Mesh(
      new T.PlaneGeometry(2, 2),
      new T.MeshBasicMaterial({
        map: this.radial,
        color: "#34f6e6",
        transparent: true,
        depthWrite: false,
        blending: T.AdditiveBlending,
      }),
    );
    this.jamRing = new T.Mesh(
      new T.RingGeometry(0.58, 0.605, 96),
      new T.MeshBasicMaterial({
        color: "#34f6e6",
        transparent: true,
        depthWrite: false,
        side: T.DoubleSide,
        blending: T.AdditiveBlending,
      }),
    );
    this.root.add(this.jamTile, this.jamGlow, this.jamRing);
    this.jamPost = new T.Mesh(
      new T.PlaneGeometry(2, 2),
      new T.ShaderMaterial({
        depthTest: false,
        depthWrite: false,
        uniforms: {
          frame: { value: null },
          low: { value: new T.Vector2() },
          high: { value: new T.Vector2(1, 1) },
          focus: { value: new T.Vector2(0.5, 0.5) },
          blur: { value: 0 },
          flash: { value: 0 },
          gray: { value: 0 },
          accent: { value: new T.Color("#34f6e6") },
          vignette: { value: 0 },
        },
        vertexShader:
          "varying vec2 v;void main(){v=uv;gl_Position=vec4(position.xy,0.,1.);}",
        fragmentShader: `varying vec2 v;uniform sampler2D frame;uniform vec2 low;uniform vec2 high;uniform vec2 focus;uniform float blur;uniform float flash;uniform float gray;uniform float vignette;uniform vec3 accent;
        void main(){vec4 base=texture2D(frame,v);if(any(lessThan(v,low))||any(greaterThan(v,high))){gl_FragColor=base;return;}
          vec3 c=vec3(0.); for(int i=0;i<5;i++){vec2 q=clamp(v+(v-focus)*blur*(float(i)/4.-.5),low,high);c+=texture2D(frame,q).rgb*.2;}
          float sat=(max(c.r,max(c.g,c.b))-min(c.r,min(c.g,c.b)))/max(.001,max(c.r,max(c.g,c.b)));float matchHue=1.-smoothstep(.15,.5,length(normalize(c+vec3(.001))-normalize(accent+vec3(.001))));c=mix(c,vec3(dot(c,vec3(.299,.587,.114))),gray*(1.-matchHue*sat));vec2 local=(v-focus)/(high-low);c*=1.-vignette*smoothstep(.12,.7,length(local));c=mix(c,vec3(1.),flash);gl_FragColor=vec4(c,base.a);
        }`,
      }),
    );
    this.jamPost.frustumCulled = false;
    this.jamPostScene.add(this.jamPost);
    this.jamSparkles = makePoints(128);
    this.jamSparkles.frustumCulled = false;
    this.jamSparkles.renderOrder = 26;
    this.root.add(this.jamSparkles);
    for (const m of [
      this.jamTile,
      this.jamGlow,
      this.jamRing,
      this.jamSparkles,
      this.jamPost,
    ]) {
      this.resources.own(m.geometry);
      this.resources.own(m.material as T.Material);
    }
    this.resources.own(this.radial);
  }
  update(c: RenderFrame) {
    const { e, viewH } = c;
    const j = e.jam;
    this.jamTile.visible =
      !!j && j.envelope > 0.001 && j.settings.colorStrength > 0;
    this.jamGlow.visible = this.jamRing.visible =
      !!j && j.envelope > 0.001 && j.settings.glow > 0;
    this.jamSparkles.visible =
      !!j && j.envelope > 0.001 && j.settings.particles > 0;
    if (j) {
      const amount = j.envelope * j.settings.glow;
      this.jamTile.position.set(j.x, j.y, 0.014);
      const tile = this.jamTile.material as T.MeshBasicMaterial;
      tile.color.set(j.color);
      tile.opacity = Math.min(
        0.85,
        j.envelope * j.settings.colorStrength * (0.9 + 1.3 * j.pulse),
      );
      this.jamGlow.position.set(j.x, j.y, 0.031);
      this.jamGlow.scale.setScalar(1.1 + 0.45 * j.pulse);
      const gm = this.jamGlow.material as T.MeshBasicMaterial;
      gm.color.set(j.color).multiplyScalar(amount);
      gm.opacity = 0.15 + 0.65 * j.pulse;
      this.jamRing.position.set(j.x, j.y, 0.035);
      this.jamRing.scale.setScalar(1 + 0.65 * (1 - j.pulse));
      const rm = this.jamRing.material as T.MeshBasicMaterial;
      rm.color.set(j.color);
      rm.opacity = Math.min(1, amount * (0.2 + 0.8 * j.pulse));
      const geo = this.jamSparkles.geometry,
        pos = geo.attributes.position,
        alpha = geo.attributes.alpha,
        size = geo.attributes.size;
      const age = Number.isFinite(j.since) ? j.since : 0,
        life = Math.max(0.05, Math.min(0.5, j.interval * 0.8)),
        progress = Math.min(1, age / life);
      for (let i = 0; i < j.settings.particles; i++) {
        const seed = i * 2.39996 + j.beat * 1.73,
          radius = 0.3 + progress * (0.7 + (i % 7) * 0.08);
        pos.setXYZ(
          i,
          j.x + Math.cos(seed) * radius,
          j.y + Math.sin(seed) * radius,
          0.04,
        );
        alpha.setX(
          i,
          Number.isFinite(j.since)
            ? j.envelope * (1 - progress) * (0.3 + (i % 5) * 0.12)
            : 0,
        );
        size.setX(i, 0.022 + (i % 5) * 0.01);
      }
      geo.setDrawRange(0, j.settings.particles);
      pos.needsUpdate = alpha.needsUpdate = size.needsUpdate = true;
      const sm = this.jamSparkles.material as T.ShaderMaterial;
      sm.uniforms.color.value.set("#e9fff9");
      sm.uniforms.pixels.value = viewH / (this.camera.top - this.camera.bottom);
      sm.uniforms.softness.value = 0.5;
    }
  }
  post(c: RenderFrame) {
    const { e, w, h, viewH, viewY, sign } = c;
    const j = e.jam;
    if (
      j &&
      j.envelope > 0.001 &&
      (j.settings.blur ||
        j.settings.flash ||
        j.settings.desaturate ||
        j.settings.vignette)
    ) {
      if (this.jamFrameSize !== `${w}x${h}`) {
        this.jamFrame?.dispose();
        this.jamFrame = new T.FramebufferTexture(w, h);
        this.jamFrame.minFilter = this.jamFrame.magFilter = T.LinearFilter;
        this.jamFrameSize = `${w}x${h}`;
      }
      this.renderer.setViewport(0, 0, w, h);
      // Copy display RGB after the normal render; this avoids changing the existing color pipeline.
      this.renderer.copyFramebufferToTexture(this.jamFrame!);
      const pm = this.jamPost.material as T.ShaderMaterial;
      pm.uniforms.frame.value = this.jamFrame;
      pm.uniforms.low.value.set(0, viewY / h);
      pm.uniforms.high.value.set(1, (viewY + viewH) / h);
      const focus = new T.Vector3(j.x * sign, j.y * sign, 0.08).project(
        this.camera,
      );
      pm.uniforms.focus.value.set(
        focus.x * 0.5 + 0.5,
        viewY / h + ((focus.y * 0.5 + 0.5) * viewH) / h,
      );
      pm.uniforms.blur.value = j.settings.blur * j.pulse * j.envelope * 0.045;
      pm.uniforms.flash.value =
        j.settings.flash * j.pulse * j.pulse * j.envelope;
      pm.uniforms.gray.value = j.settings.desaturate * j.envelope;
      pm.uniforms.accent.value.set(j.color).convertLinearToSRGB();
      pm.uniforms.vignette.value = j.settings.vignette * j.envelope;
      this.renderer.clearDepth();
      this.renderer.render(this.jamPostScene, this.backgroundCamera);
    }
  }
  dispose() {
    this.jamFrame?.dispose();
    this.resources.dispose();
  }
}
