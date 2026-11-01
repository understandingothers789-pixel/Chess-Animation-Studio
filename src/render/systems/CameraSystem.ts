import * as T from "three";
import type { RenderFrame } from "../engine/frame";
import { Resources } from "../engine/resources";
export class CameraSystem {
  private resources = new Resources();
  readonly camera = new T.OrthographicCamera();
  constructor(private root: T.Group) {}
  update(c: RenderFrame) {
    const { p, e, time, w, format, short, square, viewH, sign, boardLevel } = c;
    this.root.rotation.z = p.style.orientation === "white" ? 0 : Math.PI;
    const bg = p.layouts[format],
      crop = c.crop,
      gameFraming =
        p.moves[e.index]?.effect.cameras[format]?.mode === "game" &&
        time >= p.lead;
    const aspect = w / viewH,
      half =
        (format === "vertical" && !short ? 4.11 : 4.65) /
        Math.max(0.1, e.camera.zoom * bg.zoom);
    const gameHalfX =
      ((p.gameViewWidth / 2) * 1.45) / Math.max(0.1, e.camera.zoom);
    const gameHalfY = gameHalfX / aspect;
    this.camera.left = -(
      crop?.halfX ?? (gameFraming ? gameHalfX : half * Math.max(1, aspect))
    );
    this.camera.right =
      crop?.halfX ?? (gameFraming ? gameHalfX : half * Math.max(1, aspect));
    this.camera.top =
      crop?.halfY ?? (gameFraming ? gameHalfY : half * Math.max(1, 1 / aspect));
    this.camera.bottom = -(
      crop?.halfY ?? (gameFraming ? gameHalfY : half * Math.max(1, 1 / aspect))
    );
    this.camera.near = 0.1;
    this.camera.far = 100;
    const x = (crop ? crop.x : e.camera.x + bg.x) * sign,
      y = (crop ? crop.y : e.camera.y + (square ? 0 : bg.y)) * sign,
      tilt = (e.camera.tilt * Math.PI) / 180;
    this.camera.position.set(x, y + Math.sin(tilt) * 25, Math.cos(tilt) * 25);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(x, y, 0);
    this.camera.rotateZ((e.camera.rotation * Math.PI) / 180);
    this.camera.updateProjectionMatrix();
    if (boardLevel > 0) {
      // Match the perspective projection to the orthographic camera at the board center.
      const near = this.camera.near,
        distance = 25;
      const perspective = new T.Matrix4()
        .makePerspective(
          (this.camera.left * near) / distance,
          (this.camera.right * near) / distance,
          (this.camera.top * near) / distance,
          (this.camera.bottom * near) / distance,
          near,
          this.camera.far,
        )
        .multiplyScalar(distance);
      const current = this.camera.projectionMatrix.elements,
        target = perspective.elements;
      for (let i = 0; i < 16; i++)
        current[i] += (target[i] - current[i]) * boardLevel;
      this.camera.projectionMatrixInverse
        .copy(this.camera.projectionMatrix)
        .invert();
    }
  }

  dispose() {
    this.resources.dispose();
  }
}
