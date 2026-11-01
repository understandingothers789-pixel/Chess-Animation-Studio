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
  private releaseArtwork = retainPieceAssets();
  private radial = radialTexture();
  constructor(private root: T.Group) {
    this.resources.own(this.radial);
    this.ready = this.prepare();
  }
  update(c: RenderFrame) {
    const { p, e, sign, game } = c;
    if (this.lastGame !== game) {
      this.prune(game, p.style.pieceSet);
      this.lastGame = game;
    }
    for (const [k, m] of this.meshes)
      if (!k.startsWith("template-")) m.visible = false;
    for (const m of this.shadows.values()) m.visible = false;
    for (const v of e.pieces) {
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
        this.meshes.set(key, m);
        this.root.add(m);
      }
      m.visible = v.opacity > 0.001 && (v.crumble ?? 0) < 1;
      for (const mat of m.material as T.Material[])
        mat.userData.crumble.value = v.crumble ?? 0;
      m.position.set(v.x, v.y, 0.08 + v.z);
      m.rotation.set(v.rx, v.ry, v.rz + (sign < 0 ? Math.PI : 0));
      m.scale.setScalar(v.scale);
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
    for (const set of ["merida", "cburnett", "neo"] as PieceSet[])
      for (const color of ["w", "b"])
        for (const type of "kqrbnp") {
          const m = await createPiece(set, color, type);
          if (this.dead) {
            for (const mat of m.material as T.Material[]) mat.dispose();
            continue;
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
