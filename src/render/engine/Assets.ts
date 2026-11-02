export type AssetState = "loading" | "retrying" | "ready" | "failed";
export interface AssetRetry {
  retries?: number;
  delayMs?: number;
  retryable?: (error: unknown) => boolean;
}
type Entry = {
  url: string;
  state: AssetState;
  promise: Promise<void>;
  error?: unknown;
  cleanupError?: unknown;
  cancel?: () => void;
};
/** Owns successful values. Requests and bounded backoff share one deduplicated promise. */
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
    return (
      e && {
        url: e.url,
        state: e.state,
        error: e.error,
        cleanupError: e.cleanupError,
      }
    );
  }
  set(id: string, url: string, retry: AssetRetry = {}): Promise<void> {
    if (this.dead) return Promise.reject(Error("Assets are disposed"));
    const previous = this.entries.get(id);
    if (previous?.url === url && previous.state !== "failed")
      return previous.promise;
    previous?.cancel?.();
    const entry: Entry = { url, state: "loading", promise: Promise.resolve() };
    this.entries.set(id, entry);
    const current = () => !this.dead && this.entries.get(id) === entry;
    const attempts = Number.isFinite(retry.retries ?? 0)
      ? Math.max(0, Math.min(5, Math.floor(retry.retries ?? 0)))
      : 0;
    entry.promise = Promise.resolve().then(async () => {
      for (let attempt = 0; current(); attempt++) {
        entry.state = "loading";
        let value: T;
        try {
          value = await this.load(url);
        } catch (error) {
          if (!current()) return;
          entry.error = error;
          if (
            attempt >= attempts ||
            url.startsWith("data:") ||
            retry.retryable?.(error) === false
          ) {
            entry.state = "failed";
            throw error;
          }
          entry.state = "retrying";
          await new Promise<void>((resolve) => {
            const timer = setTimeout(
              resolve,
              Math.max(1, retry.delayMs ?? 250) * 2 ** attempt,
            );
            entry.cancel = () => {
              clearTimeout(timer);
              resolve();
            };
          });
          entry.cancel = undefined;
          continue;
        }
        if (!current()) {
          value.dispose();
          return;
        }
        const old = this.values.get(id);
        this.values.set(id, value);
        entry.state = "ready";
        entry.error = undefined;
        this.invalidate();
        // Assignment is committed. Irreversible cleanup failure must not turn a
        // ready texture into a rejected load or schedule a duplicate download.
        if (old !== value)
          try {
            old?.dispose();
          } catch (error) {
            entry.cleanupError = error;
          }
        return;
      }
    });
    return entry.promise;
  }
  remove(id: string) {
    this.entries.get(id)?.cancel?.();
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
    for (const entry of this.entries.values()) entry.cancel?.();
    this.entries.clear();
    const values = [...new Set(this.values.values())];
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
