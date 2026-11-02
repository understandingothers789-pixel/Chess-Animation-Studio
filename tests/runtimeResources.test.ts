import { expect, it } from "vitest";
import { RenderGraph, type Pass } from "../src/render/engine/RenderGraph";
import { resource } from "../src/render/engine/RuntimeResources";
it("validates producers, cycles and required values without changing legacy ordering-only inputs", () => {
  const key = resource<number>("value");
  const consumer: Pass<null> = {
    id: "consumer",
    stage: "board",
    requires: [{ key }],
    render() {},
  };
  expect(() => new RenderGraph([consumer])).toThrow(/missing producer/);
  const producer: Pass<null> = {
    id: "producer",
    stage: "board",
    provides: [key],
    enabled: false,
    render() {},
  };
  const graph = new RenderGraph([producer, consumer]);
  expect(() => graph.render(0, null, 1, 1)).toThrow(/consumer/);
  expect(
    () => new RenderGraph([producer, { ...producer, id: "duplicate" }]),
  ).toThrow(/Multiple producers/);
  expect(
    () => new RenderGraph([{ ...producer, after: ["consumer"] }, consumer]),
  ).toThrow(/Cycle/);
});
it("handles inactive optional values and borrowed fallbacks", () => {
  const key = resource<number>("optional");
  let optional: unknown = 1,
    fallback: unknown;
  const graph = new RenderGraph([
    {
      id: "producer",
      stage: "board",
      provides: [key],
      enabled: false,
      render() {},
    },
    {
      id: "optional",
      stage: "post",
      requires: [{ key, optional: true }],
      render(_, r) {
        optional = r.read(key);
      },
    },
    {
      id: "fallback",
      stage: "post",
      requires: [{ key, fallback: () => 42 }],
      render(_, r) {
        fallback = r.read(key);
      },
    },
  ]);
  graph.render(0, null, 1, 1);
  expect(optional).toBeUndefined();
  expect(fallback).toBe(42);
});
it("expires frame values, releases failed productions and preserves explicit graph values transactionally", () => {
  const frame = resource<number>("frame"),
    persistent = resource<number>("persistent", "graph");
  const released: string[] = [],
    values: unknown[] = [];
  let fail = false;
  const graph = new RenderGraph<number>([
    {
      id: "producer",
      stage: "board",
      provides: [frame, persistent],
      active: (t) => t !== 3,
      render(t, r) {
        r.publish(frame, t, () => released.push(`frame${t}`));
        r.publish(persistent, t, () => released.push(`graph${t}`));
        if (fail) throw Error("production");
      },
    },
    {
      id: "consumer",
      stage: "post",
      requires: [{ key: frame, optional: true }, { key: persistent }],
      render(_, r) {
        values.push([r.read(frame), r.read(persistent)]);
      },
    },
  ]);
  graph.render(2, 2, 1, 1);
  fail = true;
  expect(() => graph.render(1, 1, 1, 1)).toThrow(/producer/);
  fail = false;
  graph.render(3, 3, 1, 1);
  graph.render(0, 0, 1, 1);
  graph.dispose();
  graph.dispose();
  expect(values).toEqual([
    [2, 2],
    [undefined, 2],
    [0, 0],
  ]);
  expect(released.sort()).toEqual(
    ["frame0", "frame1", "frame2", "graph0", "graph1", "graph2"].sort(),
  );
});
it("releases every resource and pass even if release callbacks throw", () => {
  const a = resource<number>("a"),
    b = resource<number>("b");
  const released: string[] = [];
  const graph = new RenderGraph([
    {
      id: "p",
      stage: "board",
      provides: [a, b],
      render(_, r) {
        r.publish(a, 1, () => {
          released.push("a");
        });
        r.publish(b, 2, () => {
          released.push("b");
          throw Error("release");
        });
      },
      dispose() {
        released.push("pass");
        throw Error("pass cleanup");
      },
    },
  ]);
  expect(() => graph.render(0, null, 1, 1)).toThrow(/resource cleanup/);
  expect(() => graph.dispose()).toThrow(/cleanup/);
  graph.dispose();
  expect(released).toEqual(["b", "a", "pass"]);
});

it("rejects missing production and undeclared reads/writes with resource context", () => {
  const key = resource<number>("missing-value");
  const graph = new RenderGraph([
    { id: "producer", stage: "board", provides: [key], render() {} },
    { id: "consumer", stage: "post", requires: [{ key }], render() {} },
  ]);
  expect(() => graph.render(0, null, 1, 1)).toThrow(
    /required resource missing-value/,
  );
  for (const render of [
    (
      _: unknown,
      r: import("../src/render/engine/RuntimeResources").RuntimeResources,
    ) => r.read(key),
    (
      _: unknown,
      r: import("../src/render/engine/RuntimeResources").RuntimeResources,
    ) => r.publish(key, 1),
  ]) {
    const invalid = new RenderGraph([{ id: "invalid", stage: "post", render }]);
    expect(() => invalid.render(0, null, 1, 1)).toThrow(/undeclared resource/);
    invalid.dispose();
  }
  graph.dispose();
});

it("isolates project resources through A-B-A while graph resources survive and invalidation is explicit", () => {
  const local = resource<number>("local", "project"),
    shared = resource<number>("shared", "graph");
  const A = {},
    B = {},
    released: string[] = [],
    reads: unknown[] = [];
  const graph = new RenderGraph<boolean>([
    {
      id: "produce",
      stage: "board",
      active: (enabled) => enabled,
      provides: [local, shared],
      render(_, r) {
        r.publish(local, 1, () => released.push("local"));
        r.publish(shared, 2, () => released.push("shared"));
      },
    },
    {
      id: "read",
      stage: "post",
      requires: [
        { key: local, optional: true },
        { key: shared, optional: true },
      ],
      render(_, r) {
        reads.push([r.read(local), r.read(shared)]);
      },
    },
  ]);
  graph.render(2, true, 1, 1, A);
  graph.render(2, false, 1, 1, A);
  graph.render(0, false, 1, 1, A);
  graph.render(0, false, 1, 1, B);
  graph.render(0, false, 1, 1, A);
  expect(reads).toEqual([
    [1, 2],
    [1, 2],
    [1, 2],
    [undefined, 2],
    [undefined, 2],
  ]);
  graph.invalidateResource(shared);
  graph.render(0, false, 1, 1, A);
  expect(reads.at(-1)).toEqual([undefined, undefined]);
  graph.dispose();
  expect(released).toEqual(["local", "shared"]);
});
it("commits replacements before irreversible cleanup and never retries a throwing release", () => {
  const key = resource<object>("owned", "graph");
  const old = {},
    next = {};
  let releases = 0,
    publish = true,
    value = old;
  const reads: unknown[] = [];
  const graph = new RenderGraph([
    {
      id: "p",
      stage: "board",
      provides: [key],
      active: () => publish,
      render(_, r) {
        r.publish(key, value, () => {
          releases++;
          if (value === next && releases === 1) throw Error("old release");
        });
      },
    },
    {
      id: "c",
      stage: "post",
      requires: [{ key }],
      render(_, r) {
        reads.push(r.read(key));
      },
    },
  ]);
  graph.render(0, null, 1, 1);
  value = next;
  let failure: unknown;
  try {
    graph.render(1, null, 1, 1);
  } catch (error) {
    failure = error;
  }
  expect(failure).toMatchObject({ committed: true });
  publish = false;
  graph.render(0, null, 1, 1);
  expect(reads.at(-1)).toBe(next);
  graph.dispose();
  graph.dispose();
  expect(releases).toBe(2);
});
it("prevents double ownership and safely republishes the same owned object", () => {
  const a = resource<object>("a", "graph"),
    b = resource<object>("b", "graph"),
    object = {};
  let count = 0,
    duplicate = false;
  const graph = new RenderGraph([
    {
      id: "p",
      stage: "board",
      provides: [a, b],
      render(_, r) {
        r.publish(a, object, () => count++);
        if (duplicate) r.publish(b, object, () => count++);
      },
    },
  ]);
  graph.render(0, null, 1, 1);
  graph.render(1, null, 1, 1);
  expect(count).toBe(0);
  duplicate = true;
  expect(() => graph.render(2, null, 1, 1)).toThrow(/already owned/);
  expect(count).toBe(0);
  graph.dispose();
  expect(count).toBe(1);
});
