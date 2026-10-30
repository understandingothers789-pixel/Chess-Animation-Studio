import * as THREE from "three";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";

// Original silhouettes, drawn for this application; no chess-site artwork.
export const SILHOUETTES: Record<string, string> = {
  p: "M 24 86 L 24 78 Q 24 73 32 71 L 38 49 C 18 37 29 15 50 15 C 71 15 82 37 62 49 L 68 71 Q 76 73 76 78 L 76 86 Z",
  r: "M 20 86 L 20 77 L 29 71 L 34 37 L 24 37 L 20 16 L 33 16 L 33 26 L 43 26 L 43 16 L 57 16 L 57 26 L 67 26 L 67 16 L 80 16 L 76 37 L 66 37 L 71 71 L 80 77 L 80 86 Z",
  n: "M 20 86 L 20 77 L 30 70 Q 29 57 40 49 L 27 53 L 18 43 L 38 23 L 48 15 L 52 25 Q 76 28 76 56 L 70 72 L 80 78 L 80 86 Z",
  b: "M 23 86 L 23 77 L 34 72 L 39 54 Q 20 43 35 28 L 50 10 L 65 28 Q 80 43 61 54 L 66 72 L 77 77 L 77 86 Z",
  q: "M 18 86 L 18 77 L 29 71 L 22 35 L 14 22 L 29 27 L 35 14 L 44 28 L 50 9 L 56 28 L 65 14 L 71 27 L 86 22 L 78 35 L 71 71 L 82 77 L 82 86 Z",
  k: "M 22 86 L 22 77 L 33 71 L 38 49 Q 22 43 28 32 Q 33 25 43 30 L 44 23 L 36 23 L 36 14 L 44 14 L 44 7 L 56 7 L 56 14 L 64 14 L 64 23 L 56 23 L 57 30 Q 67 25 72 32 Q 78 43 62 49 L 67 71 L 78 77 L 78 86 Z",
};
const DETAILS: Record<string, string[]> = {
  p: ["M 38 51 Q 50 56 62 51", "M 32 72 L 68 72"],
  r: ["M 34 38 L 66 38", "M 38 44 L 62 44", "M 30 72 L 70 72"],
  n: ["M 38 36 L 43 33", "M 35 61 Q 50 51 52 39", "M 31 72 L 70 72"],
  b: ["M 52 23 L 42 39", "M 39 54 Q 50 58 61 54", "M 34 72 L 66 72"],
  q: ["M 26 39 Q 50 45 74 39", "M 31 67 L 69 67", "M 29 72 L 71 72"],
  k: ["M 39 49 Q 50 53 61 49", "M 37 63 L 63 63", "M 33 72 L 67 72"],
};
export function pieceMesh(type: string, color: string): THREE.Group {
  const group = new THREE.Group(),
    white = color === "w";
  const fill = white ? "#f5f0df" : "#263545",
    stroke = white ? "#3a4950" : "#e7ddc6";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="${SILHOUETTES[type]}" fill="${fill}"/></svg>`;
  const paths = new SVGLoader().parse(svg).paths;
  const shapes = paths.flatMap((p) => SVGLoader.createShapes(p));
  const geo = new THREE.ExtrudeGeometry(shapes, {
    depth: 5,
    bevelEnabled: true,
    bevelSize: 0.7,
    bevelThickness: 0.6,
    bevelSegments: 1,
    steps: 1,
    curveSegments: 16,
  });
  // Normalize UVs to the full illustration, retaining the cut-out silhouette.
  const pos = geo.attributes.position,
    uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++)
    uv.setXY(i, pos.getX(i) / 100, 1 - pos.getY(i) / 100);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(5.12, 5.12);
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, 100, 100);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = stroke;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke(new Path2D(SILHOUETTES[type]));
  for (const path of DETAILS[type]) ctx.stroke(new Path2D(path));
  if (type === "n") {
    ctx.fillStyle = stroke;
    ctx.beginPath();
    ctx.arc(48, 33, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const face = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    side: THREE.DoubleSide,
  });
  const edge = new THREE.MeshStandardMaterial({
    color: white ? "#c5b89e" : "#10222c",
    roughness: 0.65,
    metalness: 0.25,
    transparent: true,
  });
  const mesh = new THREE.Mesh(geo, [face, edge]);
  mesh.scale.set(0.0105, -0.0105, 0.0105);
  mesh.position.set(-0.525, 0.525, -0.025);
  group.add(mesh);
  group.userData.materials = [face, edge];
  return group;
}
