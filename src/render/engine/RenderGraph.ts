import { composePasses, type PassDescriptor } from "../effectCompositor";
import {
  RuntimeResources,
  type ResourceKey,
  type ResourceUse,
} from "./RuntimeResources";
export interface Pass<C> extends PassDescriptor {
  /** Named resources: producers are scheduled before consumers. */
  inputs?: readonly string[];
  outputs?: readonly string[];
  /** Typed runtime data; legacy inputs/outputs remain ordering-only. */
  requires?: readonly ResourceUse[];
  provides?: readonly ResourceKey<unknown>[];
  initialize?: () => void;
  resize?: (width: number, height: number) => void;
  dispose?: () => void;
  active?: (context: C) => boolean;
  render: (context: C, resources: RuntimeResources) => void;
}
/** Compiles structural dependencies once; activation remains absolute-time based. */
export class RenderGraph<C> {
  private readonly ordered: readonly Pass<C>[];
  private dead = false;
  private resources = new RuntimeResources();
  private width = 0;
  private height = 0;
  constructor(passes: readonly Pass<C>[]) {
    const producers = new Map<string, string>();
    for (const p of passes)
      for (const output of p.outputs ?? []) {
        if (producers.has(output))
          throw Error(`Multiple producers for ${output}`);
        producers.set(output, p.id);
      }
    const runtimeProducers = new Map<ResourceKey<unknown>, string>();
    const names = new Set<string>();
    for (const p of passes)
      for (const key of p.provides ?? []) {
        if (runtimeProducers.has(key) || names.has(key.name))
          throw Error(`Multiple producers for ${key.name}`);
        runtimeProducers.set(key, p.id);
        names.add(key.name);
      }
    const linked = passes.map((p) => ({
      ...p,
      after: [
        ...(p.after ?? []),
        ...(p.requires ?? []).flatMap((use) => {
          const producer = runtimeProducers.get(use.key);
          if (!producer && !use.optional && !use.fallback)
            throw Error(
              `Pass ${p.id}: missing producer for required resource ${use.key.name}`,
            );
          return producer ? [producer] : [];
        }),
        ...(p.inputs ?? []).map((input) => {
          const producer = producers.get(input);
          if (!producer) throw Error(`Pass ${p.id}: missing input ${input}`);
          return producer;
        }),
      ],
    }));
    // Validate every node, even if disabled or outside its interval.
    composePasses(0, linked);
    const descriptors = linked.map((p) => ({
      ...p,
      enabled: true,
      start: undefined,
      end: undefined,
    }));
    const byId = new Map(linked.map((p) => [p.id, p]));
    this.ordered = composePasses(0, descriptors).map((p) => byId.get(p.id)!);
    const initialized: Pass<C>[] = [];
    try {
      for (const p of this.ordered) {
        initialized.push(p);
        p.initialize?.();
      }
    } catch (error) {
      const errors: unknown[] = [];
      for (const p of initialized.reverse())
        try {
          p.dispose?.();
        } catch (cleanup) {
          errors.push(cleanup);
        }
      if (errors.length)
        throw new AggregateError(
          [error, ...errors],
          "Render graph initialization failed; cleanup also failed",
          { cause: error },
        );
      throw error;
    }
  }
  render(
    time: number,
    context: C,
    width: number,
    height: number,
    scope?: unknown,
  ) {
    if (this.dead) throw Error("Render graph is disposed");
    if (!Number.isFinite(time) || time < 0)
      throw RangeError("Invalid render time");
    if (
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width < 1 ||
      height < 1
    )
      throw RangeError("Invalid render dimensions");
    if (width !== this.width || height !== this.height) {
      // Invalidate first: after partial failure even reverting to the old size
      // must retry every hook, rather than accepting partially resized state.
      this.width = this.height = 0;
      for (const p of this.ordered)
        try {
          p.resize?.(width, height);
        } catch (error) {
          throw new Error(`Resize pass "${p.id}" failed`, { cause: error });
        }
      this.width = width;
      this.height = height;
    }
    this.resources.begin(scope);
    let failure: unknown;
    let failed = false;
    try {
      for (const p of this.ordered) {
        if (
          p.enabled === false ||
          time < (p.start ?? -Infinity) ||
          time >= (p.end ?? Infinity) ||
          p.active?.(context) === false
        )
          continue;
        try {
          this.resources.enter(p.id, p.requires ?? [], p.provides ?? []);
          p.render(context, this.resources);
        } catch (error) {
          throw new Error(
            `Render pass "${p.id}" failed: ${error instanceof Error ? error.message : String(error)}`,
            { cause: error },
          );
        }
      }
    } catch (error) {
      failure = error;
      failed = true;
    }
    try {
      this.resources.finish(!failed);
    } catch (error) {
      if (failed)
        throw new AggregateError(
          [failure, error],
          "Render and resource cleanup failed",
          { cause: failure },
        );
      throw error;
    }
    if (failed) throw failure;
  }
  invalidateResource(key?: ResourceKey<unknown>) {
    if (this.dead) throw Error("Render graph is disposed");
    this.resources.invalidate(key);
  }
  dispose() {
    if (this.dead) return;
    this.dead = true;
    const errors: unknown[] = [];
    for (const p of [...this.ordered].reverse())
      try {
        p.dispose?.();
      } catch (e) {
        errors.push(e);
      }
    try {
      this.resources.dispose();
    } catch (error) {
      errors.push(error);
    }
    if (errors.length)
      throw new AggregateError(errors, "Render graph cleanup failed");
  }
  get passIds() {
    return this.ordered.map((p) => p.id);
  }
}
