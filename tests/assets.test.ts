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
  const a = f.assets.set("a", "one");
  await Promise.resolve();
  const b = f.assets.set("a", "two");
  await Promise.resolve();
  f.pending[1].resolve(value());
  await b;
  f.pending[0].resolve(value());
  await a;
  expect(f.assets.state("a")?.url).toBe("two");
  expect(released).toBe(1);
  const c = f.assets.set("a", "three");
  await Promise.resolve();
  f.assets.remove("a");
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
    old = f.assets.set("a", "old");
  await Promise.resolve();
  const next = f.assets.set("a", "new");
  await Promise.resolve();
  f.pending[0].reject(Error("stale"));
  await old;
  f.pending[1].resolve({ dispose() {} });
  await next;
  expect(f.assets.state("a")?.state).toBe("ready");
  f.assets.dispose();
});

it("retries transient failures within a bound and deduplicates backoff", async () => {
  const { vi } = await import("vitest");
  vi.useFakeTimers();
  try {
    let calls = 0;
    const assets = new Assets(
      new Map(),
      async () => {
        if (++calls < 3) throw Error("temporary");
        return { dispose() {} };
      },
      () => {},
    );
    const promise = assets.set("a", "https://example.test/a", {
      retries: 2,
      delayMs: 10,
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(assets.state("a")?.state).toBe("retrying");
    expect(assets.set("a", "https://example.test/a")).toBe(promise);
    await vi.advanceTimersByTimeAsync(30);
    await promise;
    expect(calls).toBe(3);
    expect(assets.state("a")?.state).toBe("ready");
    assets.dispose();
  } finally {
    vi.useRealTimers();
  }
});
it("cancels obsolete retries on replacement and disposal, and never retries permanent data errors", async () => {
  const { vi } = await import("vitest");
  vi.useFakeTimers();
  try {
    const calls: string[] = [];
    const assets = new Assets(
      new Map(),
      async (url) => {
        calls.push(url);
        throw Error("bad");
      },
      () => {},
    );
    const old = assets.set("a", "https://old.test", { retries: 2 });
    await vi.advanceTimersByTimeAsync(0);
    const next = assets.set("a", "data:invalid", { retries: 2 });
    const rejected = expect(next).rejects.toThrow("bad");
    await vi.advanceTimersByTimeAsync(1000);
    await old;
    await rejected;
    const last = assets.set("a", "https://last.test", { retries: 2 });
    await vi.advanceTimersByTimeAsync(0);
    assets.dispose();
    await vi.advanceTimersByTimeAsync(2000);
    await last;
    expect(calls).toEqual([
      "https://old.test",
      "data:invalid",
      "https://last.test",
    ]);
  } finally {
    vi.useRealTimers();
  }
});
it("keeps ready state and promise consistent when disposing the old texture throws", async () => {
  let count = 0;
  const assets = new Assets(
    new Map(),
    async () => ({
      dispose() {
        if (++count === 1) throw Error("cleanup");
      },
    }),
    () => {},
  );
  await assets.set("a", "first");
  await assets.set("a", "second");
  expect(assets.state("a")).toMatchObject({
    state: "ready",
    cleanupError: expect.any(Error),
  });
  await assets.prepare({ a: "second" });
  assets.dispose();
  expect(count).toBe(2);
});

it("ends automatic retry after the configured budget and allows explicit manual retry", async () => {
  const { vi } = await import("vitest");
  vi.useFakeTimers();
  try {
    let calls = 0,
      fail = true;
    const assets = new Assets(
      new Map(),
      async () => {
        calls++;
        if (fail) throw Error("persistent");
        return { dispose() {} };
      },
      () => {},
    );
    const request = assets.set("a", "https://failed.test", {
      retries: 2,
      delayMs: 1,
    });
    const rejected = expect(request).rejects.toThrow("persistent");
    await vi.advanceTimersByTimeAsync(10000);
    await rejected;
    expect(calls).toBe(3);
    expect(assets.state("a")?.state).toBe("failed");
    fail = false;
    await assets.set("a", "https://failed.test");
    expect(calls).toBe(4);
    assets.dispose();
  } finally {
    vi.useRealTimers();
  }
});
