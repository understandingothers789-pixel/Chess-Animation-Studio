import { composePasses, type PassDescriptor } from "../effectCompositor";
export interface Pass<C> extends PassDescriptor {
  /** Named resources: producers are scheduled before consumers. */
  inputs?: readonly string[];
  outputs?: readonly string[];
  initialize?: () => void;
  resize?: (width: number, height: number) => void;
  dispose?: () => void;
  active?: (context: C) => boolean;
  render: (context: C) => void;
}
/** Compiles structural dependencies once; activation remains absolute-time based. */
export class RenderGraph<C> {
  private readonly ordered: readonly Pass<C>[];
  private dead = false;
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
    const linked = passes.map((p) => ({
      ...p,
      after: [
        ...(p.after ?? []),
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
      for (const p of initialized.reverse()) p.dispose?.();
      throw error;
    }
  }
  render(time: number, context: C, width: number, height: number) {
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
      for (const p of this.ordered) p.resize?.(width, height);
      this.width = width;
      this.height = height;
    }
    for (const p of this.ordered) {
      if (
        p.enabled === false ||
        time < (p.start ?? -Infinity) ||
        time >= (p.end ?? Infinity) ||
        p.active?.(context) === false
      )
        continue;
      try {
        p.render(context);
      } catch (error) {
        throw new Error(`Render pass "${p.id}" failed`, { cause: error });
      }
    }
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
    if (errors.length)
      throw new AggregateError(errors, "Render graph cleanup failed");
  }
  get passIds() {
    return this.ordered.map((p) => p.id);
  }
}
