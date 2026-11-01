import * as T from "three";
import type { RenderFrame } from "../engine/frame";
import { Resources } from "../engine/resources";
import type { Project } from "../../core/project";
import { badge, clamp, moveHold } from "../../core/timeline";
export class MotionSystem {
  private resources = new Resources();
  private paths: T.Mesh[] = [];
  private trail: T.Mesh;
  constructor(private root: T.Group) {
    for (let i = 0; i < 64; i++) {
      const m = new T.Mesh(
        new T.PlaneGeometry(0.99, 0.99),
        new T.MeshBasicMaterial({ transparent: true, depthWrite: false }),
      );
      m.position.z = 0.012;
      m.visible = false;
      this.paths.push(m);
      this.root.add(m);
    }
    this.trail = new T.Mesh(
      new T.BufferGeometry(),
      new T.MeshBasicMaterial({
        transparent: true,
        depthWrite: false,
        side: T.DoubleSide,
      }),
    );
    this.root.add(this.trail);
    for (const m of [...this.paths, this.trail]) {
      this.resources.own(m.geometry);
      this.resources.own(m.material as T.Material);
    }
  }
  update(c: RenderFrame) {
    const { p, e, time, game } = c;
    for (const m of this.paths) m.visible = false;
    if (e.effect) {
      const hl = e.effect.highlight;
      const step = game?.steps[e.index];
      const mover = step?.before.find((v) => v.id === step.pieceId);
      const rating = step ? badge(step.move) : null;
      const ratingColor =
        p.reviewColors.enabled &&
        rating &&
        rating !== "custom" &&
        rating in p.reviewColors
          ? p.reviewColors[
              rating as keyof Omit<Project["reviewColors"], "enabled">
            ]
          : null;
      const sideColor = hl.byMover
        ? mover?.color === "w"
          ? hl.whiteColor
          : hl.blackColor
        : null;
      const fade = hl.persist
        ? 1
        : clamp(1 - (time - segmentsFinish(p, e.index)) / hl.fade);
      const reveal = clamp((e.u - hl.reveal) / 0.12);
      for (const s of e.path) {
        const isFrom = s === e.source,
          isTo = s === e.destination;
        if (
          !(
            (isFrom && hl.showSource) ||
            (isTo && hl.showDestination) ||
            (!isFrom && !isTo && hl.showPath)
          )
        )
          continue;
        const i = (Number(s[1]) - 1) * 8 + s.charCodeAt(0) - 97,
          m = this.paths[i];
        m.visible = true;
        m.scale.set(1, 1, 1);
        m.position.x = s.charCodeAt(0) - 97 - 3.5;
        m.position.y = Number(s[1]) - 1 - 3.5;
        const mat = m.material as T.MeshBasicMaterial;
        mat.color.set(
          e.jam && e.jam.envelope > 0.001
            ? e.jam.color
            : e.effect.light.enabled &&
                e.effect.light.highlights &&
                e.light.strength > 0
              ? e.effect.light.color
              : !isFrom && ratingColor
                ? ratingColor
                : sideColor
                  ? sideColor
                  : isFrom
                    ? hl.source
                    : isTo
                      ? hl.destination
                      : hl.path,
        );
        mat.opacity = hl.opacity * fade * reveal;
        mat.color.multiplyScalar(1 + hl.glow * 0.3);
      }
      // Knights jump rather than pass through squares. Show two soft, inset
      // accents along the long side of the L without implying captures there.
      const piece = step?.before.find((v) => v.id === step.pieceId);
      if (hl.showPath && piece?.type === "n" && e.source && e.destination) {
        const fx = e.source.charCodeAt(0) - 97,
          fy = Number(e.source[1]) - 1;
        const tx = e.destination.charCodeAt(0) - 97,
          ty = Number(e.destination[1]) - 1;
        const dx = tx - fx,
          dy = ty - fy;
        const accents =
          Math.abs(dx) === 2
            ? [
                [fx + Math.sign(dx), fy],
                [fx + Math.sign(dx), ty],
              ]
            : [
                [fx, fy + Math.sign(dy)],
                [tx, fy + Math.sign(dy)],
              ];
        for (const [x, y] of accents) {
          const m = this.paths[y * 8 + x];
          m.visible = true;
          m.position.set(x - 3.5, y - 3.5, m.position.z);
          m.scale.set(0.58, 0.58, 1);
          const mat = m.material as T.MeshBasicMaterial;
          mat.color
            .set(ratingColor ?? sideColor ?? hl.path)
            .multiplyScalar(1 + hl.glow * 0.3);
          mat.opacity = hl.opacity * fade * reveal * 0.35;
        }
      }
    }
    this.trail.visible = e.trail.length > 1;
    // Timeline trails currently have 22 samples. Grow only when an extension needs more.
    const count = e.trail.length;
    let positions = this.trail.geometry.getAttribute("position") as
      | T.BufferAttribute
      | undefined;
    if (!positions || positions.count < count * 2) {
      const capacity = Math.max(
        32,
        2 ** Math.ceil(Math.log2(Math.max(1, count))),
      );
      if (positions) this.trail.geometry.dispose();
      positions = new T.BufferAttribute(new Float32Array(capacity * 6), 3);
      positions.setUsage(T.DynamicDrawUsage);
      this.trail.geometry.setAttribute("position", positions);
      const indices: number[] = [];
      for (let i = 1; i < capacity; i++) {
        const j = i * 2;
        indices.push(j - 2, j - 1, j, j - 1, j + 1, j);
      }
      this.trail.geometry.setIndex(indices);
    }
    const ribbon = positions.array as Float32Array;
    e.trail.forEach(([x, y], i) => {
      const prev = e.trail[Math.max(0, i - 1)],
        next = e.trail[Math.min(e.trail.length - 1, i + 1)],
        dx = next[0] - prev[0],
        dy = next[1] - prev[1],
        len = Math.hypot(dx, dy) || 1,
        width =
          (e.effect?.highlight.width ?? 0.13) *
          (0.2 + (0.8 * i) / Math.max(1, e.trail.length - 1));
      ribbon.set(
        [
          x - (dy / len) * width,
          y + (dx / len) * width,
          0.025,
          x + (dy / len) * width,
          y - (dx / len) * width,
          0.025,
        ],
        i * 6,
      );
    });
    positions.needsUpdate = true;
    this.trail.geometry.setDrawRange(0, Math.max(0, count - 1) * 6);
    this.trail.frustumCulled = false;
    const tm = this.trail.material as T.MeshBasicMaterial;
    tm.color.set(e.effect?.highlight.path ?? "#b1a6ef");
    tm.opacity = e.effect?.highlight.opacity ?? 0;
  }

  dispose() {
    this.resources.dispose();
  }
}

function segmentsFinish(p: Project, i: number) {
  let t = p.lead;
  for (let j = 0; j <= i; j++)
    t +=
      p.moves[j].effect.delay +
      p.moves[j].effect.duration +
      (j < i ? moveHold(p.moves[j].effect) : 0);
  return t;
}
