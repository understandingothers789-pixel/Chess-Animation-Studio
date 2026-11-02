export type AssetState = "loading" | "ready" | "failed";
type Entry = {
  url: string;
  state: AssetState;
  promise: Promise<void>;
  error?: unknown;
};
/** Owns successful values; superseded requests may finish but cannot commit. */
export class Assets<T extends { dispose(): void }> {
  private entries = new Map<string, Entry>();
  private dead = false;
  constructor(
    readonly values: Map<string, T>,
    private load: (url: string) => Promise<T>,
    private invalidate: () => void,
  ) {}
  state(id: string) {
    const e = this.entries.get(id);
    return e && { url: e.url, state: e.state, error: e.error };
  }
  set(id: string, url: string): Promise<void> {
    if (this.dead) return Promise.reject(Error("Assets are disposed"));
    const previous = this.entries.get(id);
    if (previous?.url === url && previous.state !== "failed")
      return previous.promise;
    const entry: Entry = { url, state: "loading", promise: Promise.resolve() };
    this.entries.set(id, entry);
    entry.promise = Promise.resolve()
      .then(() => this.load(url))
      .then(
        (value) => {
          if (this.dead || this.entries.get(id) !== entry) {
            value.dispose();
            return;
          }
          const old = this.values.get(id);
          this.values.set(id, value);
          entry.state = "ready";
          this.invalidate();
          old?.dispose();
        },
        (error) => {
          if (this.entries.get(id) === entry && !this.dead) {
            entry.state = "failed";
            entry.error = error;
            throw error;
          }
        },
      );
    return entry.promise;
  }
  remove(id: string) {
    this.entries.delete(id);
    const old = this.values.get(id);
    this.values.delete(id);
    this.invalidate();
    old?.dispose();
  }
  async prepare(urls: Record<string, string>) {
    await Promise.all(
      Object.entries(urls).map(([id, url]) => this.set(id, url)),
    );
    for (const [id, url] of Object.entries(urls))
      if (
        this.dead ||
        this.entries.get(id)?.state !== "ready" ||
        this.entries.get(id)?.url !== url
      )
        throw Error(`Asset ${id} changed during preparation`);
  }
  dispose() {
    if (this.dead) return;
    this.dead = true;
    this.entries.clear();
    const values = [...this.values.values()];
    this.values.clear();
    const errors: unknown[] = [];
    for (const value of values)
      try {
        value.dispose();
      } catch (error) {
        errors.push(error);
      }
    if (errors.length) throw new AggregateError(errors, "Asset cleanup failed");
  }
}
