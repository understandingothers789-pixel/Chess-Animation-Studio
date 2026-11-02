/** Tokens carry value types. Frame values expire after a draw; graph values survive
 * successful frames until replaced/disposed. External values are borrowed unless
 * a release callback is explicitly supplied to publish(). */
export interface ResourceKey<T> {
  readonly name: string;
  readonly lifetime: "frame" | "graph";
  readonly __type?: T;
}
export function resource<T>(
  name: string,
  lifetime: "frame" | "graph" = "frame",
): ResourceKey<T> {
  return Object.freeze({ name, lifetime });
}
export interface ResourceUse<T = unknown> {
  key: ResourceKey<T>;
  optional?: boolean;
  fallback?: () => T;
}
type Value = { value: unknown; release?: () => void };
export class RuntimeResources {
  private values = new Map<ResourceKey<unknown>, Value>();
  private pending = new Map<ResourceKey<unknown>, Value>();
  private uses: readonly ResourceUse[] = [];
  private provides: readonly ResourceKey<unknown>[] = [];
  private pass = "";
  begin() {
    this.pending = new Map();
  }
  enter(
    id: string,
    uses: readonly ResourceUse[],
    provides: readonly ResourceKey<unknown>[],
  ) {
    this.pass = id;
    this.uses = uses;
    this.provides = provides;
    for (const use of uses)
      if (
        !this.pending.has(use.key) &&
        !(use.key.lifetime === "graph" && this.values.has(use.key)) &&
        !use.optional &&
        !use.fallback
      )
        throw Error(
          `Pass ${id}: required resource ${use.key.name} is unavailable (producer inactive or failed)`,
        );
  }
  read<T>(key: ResourceKey<T>): T | undefined {
    const use = this.uses.find((use) => use.key === key);
    if (!use)
      throw Error(`Pass ${this.pass}: undeclared resource read ${key.name}`);
    const value =
      this.pending.get(key) ??
      (key.lifetime === "graph" ? this.values.get(key) : undefined);
    if (value) return value.value as T;
    if (use.fallback) return use.fallback() as T;
    if (use.optional) return undefined;
    throw Error(
      `Pass ${this.pass}: required resource ${key.name} is unavailable (producer inactive or failed)`,
    );
  }
  publish<T>(key: ResourceKey<T>, value: T, release?: () => void) {
    if (!this.provides.includes(key))
      throw Error(
        `Pass ${this.pass}: undeclared resource production ${key.name}`,
      );
    if (this.pending.has(key))
      throw Error(`Pass ${this.pass}: resource ${key.name} published twice`);
    this.pending.set(key, { value, release });
  }
  finish(success: boolean) {
    const cleanup: Value[] = [];
    for (const [key, value] of this.pending) {
      if (success && key.lifetime === "graph") {
        const old = this.values.get(key);
        if (old) cleanup.push(old);
        this.values.set(key, value);
      } else cleanup.push(value);
    }
    this.pending.clear();
    this.uses = [];
    this.provides = [];
    this.release(cleanup);
  }
  dispose() {
    const values = [...this.values.values(), ...this.pending.values()];
    this.values.clear();
    this.pending.clear();
    this.release(values);
  }
  private release(values: Value[]) {
    const errors: unknown[] = [];
    for (const value of values.reverse())
      try {
        value.release?.();
      } catch (error) {
        errors.push(error);
      }
    if (errors.length)
      throw new AggregateError(errors, "Runtime resource cleanup failed");
  }
}
