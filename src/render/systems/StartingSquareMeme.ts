import * as T from "three";
import { xy } from "../../core/chess";
import { introFilm, squareVideoFrame } from "../../core/introVideo";
import { ease, memeWindow } from "../../core/timeline";
import type { RenderFrame } from "../engine/frame";

export class StartingSquareMeme {
  private readonly tile = new T.Mesh(
    new T.PlaneGeometry(1, 1),
    new T.MeshBasicMaterial({ transparent: true, depthWrite: false }),
  );
  private readonly uv = this.tile.geometry.attributes.uv;
  private readonly fullUV = this.uv.array.slice();
  private cropKey = "";

  constructor(
    private root: T.Group,
    private assets: ReadonlyMap<string, T.Texture>,
  ) {
    this.tile.visible = false;
    this.tile.renderOrder = 24;
    this.root.add(this.tile);
  }

  private crop(left: number, bottom: number, width: number, height: number) {
    const key = `${left}:${bottom}:${width}:${height}`;
    if (key === this.cropKey) return;
    this.cropKey = key;
    for (let i = 0; i < this.uv.count; i++)
      this.uv.setXY(
        i,
        left + this.fullUV[i * 2] * width,
        bottom + this.fullUV[i * 2 + 1] * height,
      );
    this.uv.needsUpdate = true;
  }

  update(frame: RenderFrame) {
    this.tile.visible = false;
    if (frame.titleCard) return;
    const opener =
      frame.mode === "source" && squareVideoFrame(frame.p, frame.time);
    if (opener) {
      const texture = this.assets.get(opener.asset);
      if (!texture) return;
      const { columns, rows, cell } = introFilm;
      const inset = 0.5 / cell;
      this.crop(
        (opener.column + inset) / columns,
        1 - (opener.row + 1 - inset) / rows,
        (1 - 2 * inset) / columns,
        (1 - 2 * inset) / rows,
      );
      this.show(texture, opener.square, opener.opacity, frame.sign, false);
      return;
    }

    const meme = frame.e.preMoveMeme;
    const texture = meme && this.assets.get(meme.asset);
    const effect = frame.e.effect;
    const settings = effect?.preMoveMeme;
    if (!meme || !texture || !effect || !settings) return;
    const { width, height } = texture.image;
    const zoom = settings.zoom ?? 1;
    const w = Math.min(1, height / width) / zoom;
    const h = Math.min(1, width / height) / zoom;
    this.crop(
      (1 - w) * (settings.x ?? 0.5),
      (1 - h) * (1 - (settings.y ?? 0.5)),
      w,
      h,
    );
    const window = memeWindow(effect, frame.timeline.segments[frame.e.index]);
    const fade = Math.min(settings.fade ?? 0, settings.duration / 3);
    const opacity =
      fade && window
        ? ease(
            Math.min(frame.time - window.start, window.end - frame.time) / fade,
          )
        : 1;
    this.show(texture, meme.square, opacity, frame.sign, !fade);
    return fade ? undefined : meme.pieceId;
  }

  private show(
    texture: T.Texture,
    square: string,
    opacity: number,
    sign: number,
    depthTest: boolean,
  ) {
    const { material } = this.tile;
    if (material.map !== texture) {
      material.map = texture;
      material.needsUpdate = true;
    }
    material.opacity = opacity;
    material.depthTest = depthTest;
    const [x, y] = xy(square);
    this.tile.position.set(x, y, 0.045);
    this.tile.rotation.z = sign < 0 ? Math.PI : 0;
    this.tile.visible = opacity > 0;
  }

  dispose() {
    this.root.remove(this.tile);
    this.tile.geometry.dispose();
    this.tile.material.dispose();
  }
}
