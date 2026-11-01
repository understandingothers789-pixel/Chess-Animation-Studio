import * as T from "three";
import type { RenderFrame } from "../engine/frame";
import { Resources, makePoints } from "../engine/resources";
import { particle } from "../../core/timeline";
import { cycleColor } from "../engine/colors";
export class AtmosphereSystem {
  private resources = new Resources();
  private snow: T.Points;
  constructor(
    private scene: T.Scene,
    private camera: T.OrthographicCamera,
  ) {
    this.snow = makePoints(400);
    this.snow.frustumCulled = false;
    this.scene.add(this.snow);
    this.resources.own(this.snow.geometry);
    this.resources.own(this.snow.material as T.Material);
  }
  update(c: RenderFrame) {
    const { p, time, viewH } = c;
    this.snow.visible = p.ambient.enabled && p.ambient.count > 0;
    if (!this.snow.visible) return;
    const positions = this.snow.geometry.attributes.position,
      alphas = this.snow.geometry.attributes.alpha,
      pointSizes = this.snow.geometry.attributes.size;
    for (let i = 0; i < 400; i++) {
      const a = particle(i, time, p.ambient);
      positions.setXYZ(
        i,
        a.x * (p.ambient.insideBoard ? 2 / 3 : 1),
        a.y * (p.ambient.insideBoard ? 2 / 3 : 1),
        p.ambient.layer === "behind"
          ? -1 - a.z
          : p.ambient.layer === "over"
            ? 0.3 + a.z
            : i % 2
              ? -0.8 - a.z
              : 0.3 + a.z,
      );
      alphas.setX(i, p.ambient.enabled && i < p.ambient.count ? a.alpha : 0);
      pointSizes.setX(i, a.size);
    }
    positions.needsUpdate = alphas.needsUpdate = pointSizes.needsUpdate = true;
    const sm = this.snow.material as T.ShaderMaterial;
    sm.stencilWrite = p.ambient.insideBoard;
    sm.stencilRef = 1;
    sm.stencilFunc = T.EqualStencilFunc;
    sm.stencilFail = sm.stencilZFail = sm.stencilZPass = T.KeepStencilOp;
    // Stencil clips every fragment, including the flake edges, to visible squares.
    this.snow.renderOrder = p.ambient.insideBoard ? 10 : 0;
    sm.uniforms.color.value.copy(
      cycleColor(p.ambient.color, p.ambient.rainbow, time),
    );
    sm.uniforms.softness.value = p.ambient.softness;
    sm.uniforms.pixels.value = viewH / (this.camera.top - this.camera.bottom);
  }

  dispose() {
    this.resources.dispose();
  }
}
