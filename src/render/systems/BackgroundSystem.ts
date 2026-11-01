import * as T from "three";
import type { RenderFrame } from "../engine/frame";
import { Resources } from "../engine/resources";
import type { Project } from "../../core/project";
export class BackgroundSystem {
  private resources = new Resources();
  private backgroundScene = new T.Scene();
  private backgroundCamera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  private background: T.Mesh;
  private image = new T.Mesh(
    new T.PlaneGeometry(2, 2),
    new T.MeshBasicMaterial(),
  );
  constructor(
    private renderer: T.WebGLRenderer,
    private assets: Map<string, T.Texture>,
  ) {
    this.backgroundCamera.position.z = 2;
    this.background = new T.Mesh(
      new T.PlaneGeometry(2, 2),
      new T.ShaderMaterial({
        uniforms: {
          top: { value: new T.Color("#223431") },
          vignette: { value: 0 },
          vignetteTint: { value: new T.Color("#080c0b") },
          bottom: { value: new T.Color("#101615") },
        },
        vertexShader:
          "varying vec2 v; void main(){v=uv;gl_Position=vec4(position,1.);}",
        fragmentShader:
          "varying vec2 v;uniform vec3 top;uniform vec3 bottom;uniform float vignette;uniform vec3 vignetteTint;void main(){vec3 c=mix(bottom,top,v.y*.7+.3);c*=1.-.22*length(v-.5);c=mix(c,vignetteTint,smoothstep(.15,.72,length(v-.5))*vignette);gl_FragColor=vec4(pow(c,vec3(1./2.2)),1.);}",
      }),
    );
    this.backgroundScene.add(this.background);
    this.image.visible = false;
    this.backgroundScene.add(this.image);
    this.resources.tree(this.backgroundScene);
  }
  update(c: RenderFrame) {
    const { p, time, w, h, format, short } = c;
    this.image.visible = false;
    const fx = p.boardFX;
    const bg = p.layouts[format],
      bgMat = this.background.material as T.ShaderMaterial;
    bgMat.uniforms.top.value
      .set(p.style.background)
      .multiplyScalar(bg.background === "solid" ? 1 : 1.5);
    bgMat.uniforms.bottom.value
      .set(p.style.background)
      .multiplyScalar(
        (bg.background === "solid" ? 1 : 0.7) *
          (1 -
            (fx.enabled
              ? fx.vignette *
                (0.5 + 0.5 * Math.sin(time * fx.vignetteSpeed * 6.283))
              : 0)),
      );
    if (fx.enabled)
      bgMat.uniforms.bottom.value.lerp(
        new T.Color(fx.vignetteColor ?? "#080c0b"),
        fx.vignette * (0.5 + 0.5 * Math.sin(time * fx.vignetteSpeed * 6.283)),
      );
    bgMat.uniforms.vignette.value = fx.enabled
      ? fx.vignette * (0.5 + 0.5 * Math.sin(time * fx.vignetteSpeed * 6.283))
      : 0;
    bgMat.uniforms.vignetteTint.value.set(fx.vignetteColor ?? "#080c0b");
    if (!short)
      this.renderer.render(this.backgroundScene, this.backgroundCamera);

    const image = bg.image ? this.assets.get(bg.image) : null;
    this.image.visible = !short && !!image && bg.background === "image";
    if (this.image.visible && image) {
      if (this.image.material.map !== image) {
        this.image.material.map = image;
        this.image.material.needsUpdate = true;
      }
      const aspect = image.image.width / image.image.height,
        out = w / h;
      this.image.scale.set(
        aspect > out ? aspect / out : 1,
        aspect > out ? 1 : out / aspect,
        1,
      );
      this.renderer.render(this.backgroundScene, this.backgroundCamera);
    }
  }

  dispose() {
    this.resources.dispose();
  }
}
