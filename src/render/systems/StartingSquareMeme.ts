import * as T from "three";
import { xy } from "../../core/chess";
import type { RenderFrame } from "../engine/frame";

export class StartingSquareMeme {
  private readonly tile = new T.Mesh(
    new T.PlaneGeometry(1, 1),
    new T.MeshBasicMaterial({ transparent: true, depthWrite: false }),
  );
  private readonly uv = this.tile.geometry.attributes.uv;
  private readonly fullUV = this.uv.array.slice();

  constructor(
    private root: T.Group,
    private assets: ReadonlyMap<string, T.Texture>,
  ) {
    this.tile.visible = false;
    this.tile.renderOrder = 24;
    this.root.add(this.tile);
  }

  update(frame: RenderFrame) {
    const meme = frame.e.preMoveMeme;
    const texture = meme && this.assets.get(meme.asset);
    this.tile.visible = !!texture && !frame.titleCard;
    if (!meme || !texture || frame.titleCard) return;

    const material = this.tile.material;
    if (material.map !== texture) {
      material.map = texture;
      material.needsUpdate = true;
      const { width, height } = texture.image;
      // Center-crop on the tile without changing the shared asset texture.
      const x = Math.min(1, height / width);
      const y = Math.min(1, width / height);
      for (let i = 0; i < this.uv.count; i++)
        this.uv.setXY(
          i,
          0.5 + (this.fullUV[2 * i] - 0.5) * x,
          0.5 + (this.fullUV[2 * i + 1] - 0.5) * y,
        );
      this.uv.needsUpdate = true;
    }
    const [x, y] = xy(meme.square);
    this.tile.position.set(x, y, 0.045);
    this.tile.rotation.z = frame.sign < 0 ? Math.PI : 0;
    return meme.pieceId;
  }

  dispose() {
    this.root.remove(this.tile);
    this.tile.geometry.dispose();
    this.tile.material.dispose();
  }
}
