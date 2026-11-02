import { it, expect } from "vitest";
import { RenderGraph, type Pass } from "../src/render/engine/RenderGraph";
it("orders resource producers and runs only active nodes with reusable lifecycle", () => {
  const calls: string[] = [];
  const graph = new RenderGraph<number>([
    {
      id: "consumer",
      stage: "board",
      inputs: ["motion"],
      render: () => calls.push("consumer"),
      dispose: () => calls.push("dispose-consumer"),
    },
    {
      id: "producer",
      stage: "board",
      outputs: ["motion"],
      end: 2,
      initialize: () => calls.push("init"),
      resize: () => calls.push("resize"),
      render: () => calls.push("producer"),
      dispose: () => calls.push("dispose-producer"),
    },
  ]);
  graph.render(1, 1, 10, 10);
  graph.render(3, 3, 10, 10);
  graph.dispose();
  graph.dispose();
  expect(calls).toEqual([
    "init",
    "resize",
    "producer",
    "consumer",
    "consumer",
    "dispose-consumer",
    "dispose-producer",
  ]);
  expect(() => graph.render(1, 1, 10, 10)).toThrow(/disposed/);
});
it("rejects inactive cycles and unresolved resource inputs before initialization", () => {
  const render = () => {};
  expect(
    () =>
      new RenderGraph([
        { id: "a", stage: "board", enabled: false, after: ["b"], render },
        { id: "b", stage: "board", after: ["a"], render },
      ]),
  ).toThrow(/Cycle/);
  expect(
    () =>
      new RenderGraph([
        { id: "a", stage: "board", inputs: ["missing"], render },
      ]),
  ).toThrow(/missing input/);
});
it("cleans partially initialized passes and reports failing render nodes", () => {
  const calls: string[] = [];
  expect(
    () =>
      new RenderGraph([
        {
          id: "a",
          stage: "board",
          initialize: () => {
            throw Error("failed");
          },
          dispose: () => calls.push("disposed"),
          render: () => {},
        },
      ]),
  ).toThrow("failed");
  expect(calls).toEqual(["disposed"]);
  const graph = new RenderGraph([
    {
      id: "a",
      stage: "board",
      render: () => {
        throw Error("gpu");
      },
    },
  ]);
  expect(() => graph.render(0, {}, 10, 10)).toThrow('Render pass "a" failed');
  expect(() => graph.render(NaN, {}, 10, 10)).toThrow(/time/);
  expect(() => graph.render(0, {}, 0, 10)).toThrow(/dimensions/);
});

it("separates world setup, draw, post and overlays without changing equal-priority order", () => {
  const calls: string[] = [];
  const pass = (id: string, stage: Pass<null>["stage"], extra = {}) => ({
    id,
    stage,
    render: () => calls.push(id),
    ...extra,
  });
  const graph = new RenderGraph([
    pass("base", "board"),
    pass("world", "world"),
    pass("overlay", "overlay"),
    pass("post", "post"),
    pass("extension", "board"),
    pass("last", "board", { after: ["extension"], priority: -100 }),
  ]);
  graph.render(0, null, 10, 10);
  expect(calls).toEqual([
    "base",
    "extension",
    "last",
    "world",
    "post",
    "overlay",
  ]);
  expect(
    () =>
      new RenderGraph([
        pass("world", "world", { after: ["post"] }),
        pass("post", "post"),
      ]),
  ).toThrow(/stage order/);
});

it("continues rollback after cleanup errors and preserves the original initialization failure", () => {
  const calls: string[] = [],
    original = Error("initialization");
  let failure: AggregateError | undefined;
  try {
    new RenderGraph([
      {
        id: "a",
        stage: "board",
        render() {},
        dispose() {
          calls.push("a");
        },
      },
      {
        id: "b",
        stage: "board",
        render() {},
        initialize() {
          throw original;
        },
        dispose() {
          calls.push("b");
          throw Error("cleanup");
        },
      },
    ]);
  } catch (error) {
    failure = error as AggregateError;
  }
  expect(calls).toEqual(["b", "a"]);
  expect(failure?.cause).toBe(original);
  expect(failure?.errors).toHaveLength(2);
});

it("retries all resize hooks after partial failure, including when reverting dimensions", () => {
  const sizes: number[] = [];
  let fail = false;
  const graph = new RenderGraph([
    {
      id: "a",
      stage: "board",
      render() {},
      resize(w) {
        sizes.push(w);
      },
    },
    {
      id: "b",
      stage: "board",
      render() {},
      resize() {
        if (fail) throw Error("resize");
      },
    },
  ]);
  graph.render(0, {}, 10, 10);
  fail = true;
  expect(() => graph.render(0, {}, 20, 20)).toThrow(/Resize pass "b"/);
  fail = false;
  graph.render(0, {}, 10, 10);
  expect(sizes).toEqual([10, 20, 10]);
});
