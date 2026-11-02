import { expect, it, vi } from "vitest";
const { scenes } = vi.hoisted(() => ({ scenes: [] as any[] }));
vi.mock("../src/render/Scene", () => ({
  Scene: class {
    ready: Promise<void>;
    resolve!: () => void;
    dispose = vi.fn();
    prepareAssets = vi.fn(async () => {});
    constructor() {
      this.ready = new Promise((resolve) => (this.resolve = resolve));
      scenes.push(this);
    }
  },
}));
import { GraphicsSession } from "../src/render/GraphicsSession";
it("ignores abandoned scene readiness and disposes replacement exactly once", async () => {
  vi.stubGlobal("document", { createElement: () => ({}) });
  const host = { replaceChildren: vi.fn() } as unknown as HTMLElement;
  const session = new GraphicsSession();
  const abandoned = session.reload(host, {}),
    a = scenes.at(-1);
  const replacement = session.reload(host, { image: "url" }),
    b = scenes.at(-1);
  a.resolve();
  expect(await abandoned).toBeUndefined();
  expect(a.dispose).toHaveBeenCalledTimes(1);
  b.resolve();
  expect(await replacement).toBe(b);
  expect(b.prepareAssets).toHaveBeenCalledWith({ image: "url" });
  session.dispose();
  session.dispose();
  expect(b.dispose).toHaveBeenCalledTimes(1);
  vi.unstubAllGlobals();
});
