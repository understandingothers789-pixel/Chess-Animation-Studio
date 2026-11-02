/** Tokens carry value types. Frame values expire after a draw; graph values survive
 * successful frames until replaced/disposed. External values are borrowed unless
 * a release callback is explicitly supplied to publish(). */
export interface ResourceKey<T> {
  readonly name: string;
  readonly lifetime: "frame" | "graph" | "project";
  readonly __type?: T;
}
export function resource<T>(
  name: string,
  lifetime: "frame" | "graph" | "project" = "frame",
): ResourceKey<T> {
  return Object.freeze({ name, lifetime });
}
export interface ResourceUse<T = unknown> {
  key: ResourceKey<T>;
  optional?: boolean;
  fallback?: () => T;
}
type Value = { value: unknown; release?: () => void; released?: boolean };
export class RuntimeResources {
  private values = new Map<ResourceKey<unknown>, Value>();
  private pending = new Map<ResourceKey<unknown>, Value>();
  private uses: readonly ResourceUse[] = [];
  private provides: readonly ResourceKey<unknown>[] = [];
  private pass = "";
  private scope: unknown;
  private active = false;
  private dead = false;
  private releasedObjects = new WeakSet<object>();
  private object(value: unknown): value is object {
    return (
      value !== null &&
      (typeof value === "object" || typeof value === "function")
    );
  }
  invalidate(key?: ResourceKey<unknown>) {
    if (this.dead || this.active)
      throw Error(
        "Resources cannot be invalidated during a frame or after disposal",
      );
    const removed: Value[] = [];
    for (const [token, value] of this.values)
      if (!key || token === key) {
        this.values.delete(token);
        removed.push(value);
      }
    this.release(removed);
  }
  begin(scope?: unknown) {
    if (this.dead || this.active)
      throw Error("Resources are disposed or a frame is already active");
    if (scope !== this.scope) {
      this.scope = scope;
      const obsolete: Value[] = [];
      for (const [key, value] of this.values)
        if (key.lifetime === "project") {
          this.values.delete(key);
          obsolete.push(value);
        }
      this.release(obsolete);
    }
    this.active = true;
  }
  enter(
    id: string,
    uses: readonly ResourceUse[],
    provides: readonly ResourceKey<unknown>[],
  ) {
    if (this.dead || !this.active) throw Error("No active resource frame");
    this.pass = id;
    this.uses = uses;
    this.provides = provides;
    for (const use of uses)
      if (
        !this.pending.has(use.key) &&
        !(use.key.lifetime !== "frame" && this.values.has(use.key)) &&
        !use.optional &&
        !use.fallback
      )
        throw Error(
          `Pass ${id}: required resource ${use.key.name} is unavailable (producer inactive or failed)`,
        );
  }
  read<T>(key: ResourceKey<T>): T | undefined {
    if (this.dead || !this.active) throw Error("No active resource frame");
    const use = this.uses.find((use) => use.key === key);
    if (!use)
      throw Error(`Pass ${this.pass}: undeclared resource read ${key.name}`);
    const value =
      this.pending.get(key) ??
      (key.lifetime !== "frame" ? this.values.get(key) : undefined);
    if (value) return value.value as T;
    if (use.fallback) return use.fallback() as T;
    if (use.optional) return undefined;
    throw Error(
      `Pass ${this.pass}: required resource ${key.name} is unavailable (producer inactive or failed)`,
    );
  }
  publish<T>(key: ResourceKey<T>, value: T, release?: () => void) {
    if (!this.active || this.dead) throw Error("No active resource frame");
    if (key.lifetime === "project" && this.scope === undefined)
      throw Error(`Resource ${key.name}: project scope required`);
    if (!this.provides.includes(key))
      throw Error(
        `Pass ${this.pass}: undeclared resource production ${key.name}`,
      );
    if (this.pending.has(key))
      throw Error(`Pass ${this.pass}: resource ${key.name} published twice`);
    if (this.object(value)) {
      if (release && this.releasedObjects.has(value))
        throw Error(
          `Resource ${key.name}: previously released object cannot be owned again`,
        );
      for (const [token, record] of [...this.values, ...this.pending])
        if (record.value === value) {
          if (token === key && record.release) {
            if (!release)
              throw Error(
                `Resource ${key.name}: cannot replace owned object with a borrow`,
              );
            this.pending.set(key, record);
            return;
          }
          if (release && record.release)
            throw Error(
              `Resource ${key.name}: object already owned by ${token.name}`,
            );
        }
    }
    this.pending.set(key, { value, release });
  }
  finish(success: boolean) {
    if (!this.active) throw Error("No active resource frame");
    this.active = false;
    const cleanup: Value[] = [];
    for (const [key, value] of this.pending) {
      if (success && key.lifetime !== "frame") {
        const old = this.values.get(key);
        if (old && old !== value) cleanup.push(old);
        this.values.set(key, value);
      } else if (this.values.get(key) !== value) cleanup.push(value);
    }
    this.pending.clear();
    this.uses = [];
    this.provides = [];
    try {
      this.release(cleanup);
    } catch (error) {
      throw Object.assign(
        new AggregateError(
          [error],
          `Runtime resource cleanup failed (${success ? "frame committed; no rollback" : "pending publications discarded"})`,
          { cause: error },
        ),
        { committed: success },
      );
    }
  }
  dispose() {
    if (this.dead) return;
    this.dead = true;
    this.active = false;
    const values = [...this.values.values(), ...this.pending.values()];
    this.values.clear();
    this.pending.clear();
    this.release(values);
  }
  private release(values: Value[]) {
    const errors: unknown[] = [];
    for (const value of values.reverse())
      try {
        if (value.released) continue;
        value.released = true;
        if (value.release && this.object(value.value))
          this.releasedObjects.add(value.value);
        value.release?.();
      } catch (error) {
        errors.push(error);
      }
    if (errors.length)
      throw new AggregateError(errors, "Runtime resource cleanup failed");
  }
}
