import { Scene } from "./Scene";
/** Owns one replaceable canvas/Scene. Project and transport stay with the caller. */
export class GraphicsSession {
  scene?: Scene;
  private generation = 0;
  async reload(host: HTMLElement, assets: Record<string, string>) {
    const generation = ++this.generation;
    this.scene?.dispose();
    this.scene = undefined;
    const canvas = document.createElement("canvas");
    host.replaceChildren(canvas);
    const scene = new Scene(canvas);
    this.scene = scene;
    try {
      await scene.ready;
      if (generation !== this.generation) return undefined;
      await scene.prepareAssets(assets);
      return generation === this.generation ? scene : undefined;
    } catch (error) {
      if (generation === this.generation) {
        scene.dispose();
        this.scene = undefined;
        throw error;
      }
    }
  }
  dispose() {
    this.generation++;
    this.scene?.dispose();
    this.scene = undefined;
  }
}
