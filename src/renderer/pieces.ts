import * as THREE from "three";

type PieceSet = "lichess" | "chesscom";
const textures = new Map<string, THREE.Texture>();
const loading = new Map<string, Promise<THREE.Texture>>();
function texture(set: PieceSet, type: string, color: string): Promise<THREE.Texture> {
  const key = `${set}-${color}${type}`;
  let pending = loading.get(key);
  if (!pending) {
    const name = set === "lichess" ? `${color}${type.toUpperCase()}.svg` : `${color}${type}.png`;
    const url = new URL(`pieces/${set}/${name}`, document.baseURI).href;
    pending = new THREE.TextureLoader().loadAsync(url).then((t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      textures.set(key, t);
      return t;
    });
    loading.set(key, pending);
  }
  return pending;
}
export async function loadPieceTextures(set: PieceSet) {
  await Promise.all(["w", "b"].flatMap((c) => ["k", "q", "r", "b", "n", "p"].map((t) => texture(set, t, c))));
}
export function pieceMesh(type: string, color: string, set: PieceSet): THREE.Group {
  const group = new THREE.Group();
  const face = new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false });
  const key = `${set}-${color}${type}`;
  const cached = textures.get(key);
  if (cached) face.map = cached;
  else void texture(set, type, color).then((t) => { face.map = t; face.needsUpdate = true; });
  group.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), face));
  group.userData.materials = [face];
  return group;
}
