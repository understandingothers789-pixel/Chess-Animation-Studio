/** Stable, time-addressable ordering for renderer passes. */
export const PASS_ORDER = ["background", "board", "post", "overlay"] as const;
export type RenderPass = (typeof PASS_ORDER)[number];
export interface PassDescriptor {
  id: string;
  stage: RenderPass;
  enabled?: boolean;
  start?: number;
  end?: number;
  priority?: number;
}
export function composePasses(time: number, passes: readonly PassDescriptor[]): PassDescriptor[] {
  if (!Number.isFinite(time)) throw new RangeError("Non-finite render time");
  const seen = new Set<string>();
  return passes
    .map((pass, index) => ({ pass, index }))
    .filter(({ pass }) => {
      if (!pass.id || seen.has(pass.id)) throw new Error("Duplicate or empty render pass ID: " + pass.id);
      seen.add(pass.id);
      if (!PASS_ORDER.includes(pass.stage)) throw new Error("Unknown render pass stage");
      if ((pass.start ?? -Infinity) > (pass.end ?? Infinity)) throw new RangeError("Invalid render pass interval");
      return pass.enabled !== false && time >= (pass.start ?? -Infinity) && time < (pass.end ?? Infinity);
    })
    .sort((a, b) =>
      PASS_ORDER.indexOf(a.pass.stage) - PASS_ORDER.indexOf(b.pass.stage) ||
      (a.pass.priority ?? 0) - (b.pass.priority ?? 0) ||
      a.index - b.index
    )
    .map(({ pass }) => pass);
}
/** Dispatches a deterministic plan without taking ownership of WebGL state. */
export function executePasses(
  time: number,
  passes: readonly PassDescriptor[],
  draw: (pass: PassDescriptor) => void,
): void {
  for (const pass of composePasses(time, passes)) draw(pass);
}
