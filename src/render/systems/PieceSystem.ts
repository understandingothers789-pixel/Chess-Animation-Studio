import { createSculptedPiece, sculptedGeometry } from "../sculptedPieces";
import { defaultPieceEdgeDepth } from "../../core/project";
import type { Game } from "../../core/chess";
import {
  createPiece,
  preloadPieces,
  retainPieceAssets,
  enableCrumble,
  type PieceSet,
} from "../pieces";
import * as T from "three";
import type { RenderFrame } from "../engine/frame";
import { Resources, radialTexture } from "../engine/resources";
export class PieceSystem {
  private resources = new Resources();
  readonly meshes = new Map<string, T.Mesh>();
  private shadows = new Map<string, T.Mesh>();
  readonly ready: Promise<void>;
  private dead = false;
  private lastGame?: Game;
  private lastSet?: string;
  private up = new T.Vector3();
  private inverseRotation = new T.Quaternion();
  private releaseArtwork = retainPieceAssets();
  private radial = radialTexture();
  constructor(private root: T.Group) {
    this.resources.own(this.radial);
    this.ready = this.prepare();
  }
  update(c: RenderFrame, hiddenPiece?: string) {
    const { p, e, sign, game } = c;
    const set = p.style.pieceSet;
    const sculpted = set === "sculpted";
    const depth = p.style.pieceEdgeDepth ?? defaultPieceEdgeDepth;
    if (sculpted && !this.meshes.has("template-sculpted-w-k")) {
      for (const type of "kqrbnp") {
        const geometry = this.resources.own(sculptedGeometry(type));
        for (const color of ["w", "b"]) {
          this.meshes.set(
            `template-sculpted-${color}-${type}`,
            createSculptedPiece(geometry, color),
          );
        }
      }
    }
    if (this.lastGame !== game || this.lastSet !== set) {
      this.prune(game, set);
      this.lastGame = game;
      this.lastSet = set;
    }
    for (const [k, m] of this.meshes)
      if (!k.startsWith("template-")) m.visible = false;
    for (const m of this.shadows.values()) m.visible = false;
    for (const v of e.pieces) {
      if (v.id === hiddenPiece) continue;
      const key = `${p.style.pieceSet}-${v.id}-${v.type}`;
      let m = this.meshes.get(key);
      if (!m) {
        const template = this.meshes.get(
          `template-${p.style.pieceSet}-${v.color}-${v.type}`,
        );
        if (!template) continue;
        m = template.clone();
        m.material = (template.material as T.Material[]).map((x) => {
          const mat = x.clone();
          enableCrumble(mat);
          return mat;
        });
        m.userData.bloom = "pieces";
        this.meshes.set(key, m);
        this.root.add(m);
      }
      m.visible = v.opacity > 0.001 && (v.crumble ?? 0) < 1;
      for (const mat of m.material as T.Material[])
        mat.userData.crumble.value = v.crumble ?? 0;
      m.position.set(v.x, v.y, 0.08 + v.z);
      m.rotation.set(v.rx, v.ry, v.rz + (sign < 0 ? Math.PI : 0));
      m.scale.setScalar(v.scale);
      if (
        sculpted ||
        (p.style.solidPieceSides !== false && depth > 0 && (v.rx || v.ry))
      ) {
        // Raise the rotated model by its extent beneath the centre so the
        // flip stays above the board, including at quarter turns.
        const up = this.up
          .set(0, 0, 1)
          .applyQuaternion(this.inverseRotation.copy(m.quaternion).invert());
        // Keep the illustrated face at its original size while the side
        // walls smoothly deepen as the piece tilts away from the board.
        const tilt = Math.max(0, 1 - up.z * up.z);
        if (!sculpted) m.scale.z *= 1 + 6 * tilt * depth;
        if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
        const bounds = m.geometry.boundingBox!;
        const lowest =
          up.x * (up.x < 0 ? bounds.max.x : bounds.min.x) * m.scale.x +
          up.y * (up.y < 0 ? bounds.max.y : bounds.min.y) * m.scale.y +
          up.z * (up.z < 0 ? bounds.max.z : bounds.min.z) * m.scale.z;
        m.position.z =
          v.z + (sculpted ? 0.035 - lowest : Math.max(0.08, 0.035 - lowest));
      }
      for (const mat of m.material as T.Material[]) {
        mat.opacity = v.opacity;
        mat.transparent = true;
      }
      let shadow = this.shadows.get(v.id);
      if (!shadow) {
        shadow = new T.Mesh(
          new T.PlaneGeometry(1.05, 0.75),
          new T.MeshBasicMaterial({
            map: this.radial,
            color: "#111916",
            transparent: true,
            depthWrite: false,
          }),
        );
        this.shadows.set(v.id, shadow);
        this.root.add(shadow);
      }
      shadow.visible = m.visible;
      shadow.position.set(v.x + 0.035, v.y - 0.04, 0.021);
      shadow.scale.setScalar(v.scale * (1 + v.z * 0.12));
      (shadow.material as T.MeshBasicMaterial).opacity =
        (0.2 * v.opacity) / (1 + v.z);
    }
  }
  private prune(game: Game, set: string) {
    const keys = new Set<string>(),
      ids = new Set<string>();
    for (const pieces of [
      game.initial,
      ...game.steps.map((step) => step.after),
    ])
      for (const piece of pieces) {
        keys.add(`${set}-${piece.id}-${piece.type}`);
        ids.add(piece.id);
      }
    for (const [key, mesh] of this.meshes)
      if (!key.startsWith("template-") && !keys.has(key)) {
        this.root.remove(mesh);
        for (const material of mesh.material as T.Material[])
          material.dispose();
        this.meshes.delete(key);
      }
    for (const [id, shadow] of this.shadows)
      if (!ids.has(id)) {
        this.root.remove(shadow);
        shadow.geometry.dispose();
        (shadow.material as T.Material).dispose();
        this.shadows.delete(id);
      }
  }
  private async prepare() {
    await preloadPieces();
    if (this.dead) return;
    for (const set of ["merida", "cburnett", "neo"] as PieceSet[])
      for (const color of ["w", "b"])
        for (const type of "kqrbnp") {
          if (this.dead) return;
          const m = await createPiece(set, color, type);
          if (this.dead) {
            for (const mat of m.material as T.Material[]) mat.dispose();
            return;
          }
          this.meshes.set(`template-${set}-${color}-${type}`, m);
        }
  }

  dispose() {
    if (this.dead) return;
    this.dead = true;
    this.releaseArtwork();
    for (const m of this.meshes.values()) {
      for (const mat of m.material as T.Material[]) mat.dispose();
    }
    for (const shadow of this.shadows.values()) {
      shadow.geometry.dispose();
      (shadow.material as T.Material).dispose();
    }
    this.resources.dispose();
  }
}
