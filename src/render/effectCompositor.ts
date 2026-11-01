/** Deterministic, time-addressable effect graph for rendering and export. */
export const PASS_ORDER = ["background", "board", "post", "overlay"] as const;
export type RenderPass = (typeof PASS_ORDER)[number];
export interface PassDescriptor {
  id: string;
  stage: RenderPass;
  enabled?: boolean;
  start?: number;
  end?: number;
  priority?: number;
  /** Pass IDs that must execute before this pass. */
  after?: readonly string[];
  /** Pass IDs that must execute after this pass. */
  before?: readonly string[];
}
export function composePasses(time: number, passes: readonly PassDescriptor[]): PassDescriptor[] {
  if (!Number.isFinite(time)) throw new RangeError("Non-finite render time");
  const ids = new Map<string, number>();
  passes.forEach((pass, index) => {
    if (!pass.id || ids.has(pass.id)) throw new Error("Duplicate or empty render pass ID: " + pass.id);
    ids.set(pass.id, index);
    if (!PASS_ORDER.includes(pass.stage)) throw new Error("Unknown render pass stage: " + pass.stage);
    if (pass.start !== undefined && !Number.isFinite(pass.start)) throw new RangeError("Invalid start for " + pass.id);
    if (pass.end !== undefined && !Number.isFinite(pass.end)) throw new RangeError("Invalid end for " + pass.id);
    if ((pass.start ?? -Infinity) > (pass.end ?? Infinity)) throw new RangeError("Invalid interval for " + pass.id);
    if (pass.priority !== undefined && !Number.isFinite(pass.priority)) throw new RangeError("Invalid priority for " + pass.id);
  });
  const active = passes.filter(pass =>
    pass.enabled !== false && time >= (pass.start ?? -Infinity) && time < (pass.end ?? Infinity));
  const byId = new Map(active.map(pass => [pass.id, pass]));
  const outgoing = new Map(active.map(pass => [pass.id, new Set<string>()]));
  const indegree = new Map(active.map(pass => [pass.id, 0]));
  const link = (from: string, to: string) => {
    if (!ids.has(from) || !ids.has(to)) throw new Error("Unknown render dependency: " + from + " -> " + to);
    // Dependencies on inactive effects do not prevent an active effect from rendering.
    if (!byId.has(from) || !byId.has(to)) return;
    if (!outgoing.get(from)!.has(to)) {
      outgoing.get(from)!.add(to);
      indegree.set(to, indegree.get(to)! + 1);
    }
  };
  for (const pass of passes) {
    for (const dependency of pass.after ?? []) link(dependency, pass.id);
    for (const dependency of pass.before ?? []) link(pass.id, dependency);
  }
  // Preserve stage ordering even when priorities or dependencies are present.
  for (const a of active) for (const b of active) {
    if (PASS_ORDER.indexOf(a.stage) < PASS_ORDER.indexOf(b.stage)) link(a.id, b.id);
  }
  const compare = (a: PassDescriptor, b: PassDescriptor) =>
    PASS_ORDER.indexOf(a.stage) - PASS_ORDER.indexOf(b.stage) ||
    (a.priority ?? 0) - (b.priority ?? 0) ||
    ids.get(a.id)! - ids.get(b.id)!;
  const ready = active.filter(pass => indegree.get(pass.id) === 0).sort(compare);
  const ordered: PassDescriptor[] = [];
  while (ready.length) {
    const pass = ready.shift()!;
    ordered.push(pass);
    for (const target of outgoing.get(pass.id)!) {
      indegree.set(target, indegree.get(target)! - 1);
      if (indegree.get(target) === 0) {
        ready.push(byId.get(target)!);
        ready.sort(compare);
      }
    }
  }
  if (ordered.length !== active.length) throw new Error("Cycle or conflicting stage order in render effect graph");
  return ordered;
}
export function executePasses(
  time: number,
  passes: readonly PassDescriptor[],
  draw: (pass: PassDescriptor) => void,
): void {
  for (const pass of composePasses(time, passes)) draw(pass);
}
