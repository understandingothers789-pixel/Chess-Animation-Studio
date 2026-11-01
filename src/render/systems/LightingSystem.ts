import * as T from "three";
import type { RenderFrame } from "../engine/frame";
import { Resources } from "../engine/resources";
import type { Project } from "../../core/project";
export class LightingSystem {
  private resources = new Resources();
  readonly moveLight: T.Mesh;
  constructor(private scene: T.Scene) {
    this.moveLight = new T.Mesh(
      new T.PlaneGeometry(2, 2),
      new T.ShaderMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          tint: { value: new T.Color("#ff3030") },
          strength: { value: 0 },
        },
        vertexShader:
          "varying vec2 uvLight; void main(){uvLight=uv;gl_Position=vec4(position.xy,0.,1.);}",
        fragmentShader:
          "varying vec2 uvLight;uniform vec3 tint;uniform float strength;void main(){float edge=smoothstep(.1,.7,length(uvLight-.5));gl_FragColor=vec4(pow(tint,vec3(1./2.2)),strength*(.85+.15*edge));}",
      }),
    );
    this.moveLight.frustumCulled = false;
    this.moveLight.renderOrder = 27; // tint the board/pieces while badges remain readable
    this.scene.add(this.moveLight);
    const light = new T.DirectionalLight("#ffffff", 2.2);
    light.position.set(-5, 8, 18);
    this.scene.add(light, new T.AmbientLight("#ffffff", 1.4));
    this.resources.own(this.moveLight.geometry);
    this.resources.own(this.moveLight.material as T.Material);
  }
  update(c: RenderFrame) {
    const { e } = c;
    const lm = this.moveLight.material as T.ShaderMaterial;
    lm.uniforms.tint.value.set(e.light.color);
    lm.uniforms.strength.value = e.light.strength;
    this.moveLight.visible = e.light.strength > 0.0001;
  }

  dispose() {
    this.resources.dispose();
  }
}
