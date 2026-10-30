import * as THREE from "three";

type PieceSet = "lichess" | "chesscom";
const textures = new Map<string, THREE.Texture>();
const loading = new Map<string, Promise<THREE.Texture>>();
function texture(
  set: PieceSet,
  type: string,
  color: string,
): Promise<THREE.Texture> {
  const key = `${set}-${color}${type}`;
  let pending = loading.get(key);
  if (!pending) {
    const name = `${color}${type.toUpperCase()}.svg`;
    const url = new URL(
      `pieces/${set === "chesscom" ? "nibbler" : set}/${name}`,
      document.baseURI,
    ).href;
    pending = new Promise<THREE.Texture>((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1024;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(image, 0, 0, 1024, 1024);
        const t = new THREE.CanvasTexture(canvas);
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 4;
        textures.set(key, t);
        resolve(t);
      };
      image.onerror = () =>
        reject(new Error(`Could not load piece image: ${url}`));
      image.src = url;
    });
    loading.set(key, pending);
  }
  return pending;
}
export async function loadPieceTextures(set: PieceSet) {
  await Promise.all(
    ["w", "b"].flatMap((c) =>
      ["k", "q", "r", "b", "n", "p"].map((t) => texture(set, t, c)),
    ),
  );
}
export function pieceMesh(
  type: string,
  color: string,
  set: PieceSet,
): THREE.Group {
  const group = new THREE.Group();
  const face = new THREE.MeshBasicMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const key = `${set}-${color}${type}`;
  const cached = textures.get(key);
  if (cached) face.map = cached;
  else
    void texture(set, type, color).then((t) => {
      face.map = t;
      face.needsUpdate = true;
    });
  group.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), face));
  group.userData.materials = [face];
  return group;
}
