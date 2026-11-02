import { expect, it } from "vitest";
import { Assets } from "../src/render/engine/Assets";
function fixture() {
  const pending: {
    url: string;
    resolve: (v: { dispose(): void }) => void;
    reject: (e: Error) => void;
  }[] = [];
  let invalidations = 0;
  const values = new Map<string, { dispose(): void }>();
  const assets = new Assets(
    values,
    (url) =>
      new Promise((resolve, reject) => pending.push({ url, resolve, reject })),
    () => invalidations++,
  );
  return { assets, values, pending, count: () => invalidations };
}
it("deduplicates loading/ready URLs, retries failures and preserves the last valid replacement", async () => {
  const f = fixture();
  let released = 0;
  const a = f.assets.set("a", "one");
  expect(f.assets.set("a", "one")).toBe(a);
  await Promise.resolve();
  f.pending[0].resolve({
    dispose() {
      released++;
    },
  });
  await a;
  expect(f.assets.state("a")?.state).toBe("ready");
  await f.assets.set("a", "one");
  expect(f.pending).toHaveLength(1);
  const bad = f.assets.set("a", "two");
  await Promise.resolve();
  f.pending[1].reject(Error("bad"));
  await expect(bad).rejects.toThrow("bad");
  expect(f.assets.state("a")?.state).toBe("failed");
  expect(f.values.has("a")).toBe(true);
  const retry = f.assets.set("a", "two");
  await Promise.resolve();
  f.pending[2].resolve({
    dispose() {
      released++;
    },
  });
  await retry;
  expect(released).toBe(1);
  expect(f.count()).toBe(2);
  await f.assets.prepare({ a: "two" });
  f.assets.dispose();
  f.assets.dispose();
  expect(released).toBe(2);
});
it("discards out-of-order completions and removal/disposal during loading", async () => {
  const f = fixture();
  let released = 0;
  const value = () => ({
    dispose() {
      released++;
    },
  });
  const a = f.assets.set("a", "one"),
    b = f.assets.set("a", "two");
  await Promise.resolve();
  f.pending[1].resolve(value());
  await b;
  f.pending[0].resolve(value());
  await a;
  expect(f.assets.state("a")?.url).toBe("two");
  expect(released).toBe(1);
  const c = f.assets.set("a", "three");
  f.assets.remove("a");
  await Promise.resolve();
  f.pending[2].resolve(value());
  await c;
  expect(f.values.size).toBe(0);
  expect(released).toBe(3);
  const d = f.assets.set("a", "four");
  await Promise.resolve();
  f.assets.dispose();
  f.pending[3].resolve(value());
  await d;
  expect(released).toBe(4);
  await expect(f.assets.prepare({ a: "four" })).rejects.toThrow(/disposed/);
});
it("rejects export preparation when expected assets fail or change", async () => {
  const f = fixture();
  const prepare = f.assets.prepare({ a: "one" });
  await Promise.resolve();
  f.pending[0].reject(Error("load failed"));
  await expect(prepare).rejects.toThrow("load failed");
  const again = f.assets.prepare({ a: "one" });
  await Promise.resolve();
  f.assets.remove("a");
  f.pending[1].resolve({ dispose() {} });
  await expect(again).rejects.toThrow(/changed/);
});

it("ignores a superseded failure without poisoning the current request", async () => {
  const f = fixture(),
    old = f.assets.set("a", "old"),
    next = f.assets.set("a", "new");
  await Promise.resolve();
  f.pending[0].reject(Error("stale"));
  await old;
  f.pending[1].resolve({ dispose() {} });
  await next;
  expect(f.assets.state("a")?.state).toBe("ready");
  f.assets.dispose();
});
