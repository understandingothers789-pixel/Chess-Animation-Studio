import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

type Profile = readonly (readonly [radius: number, height: number])[];

// Profiles are drawn along Y so the figure reads upright in the overhead editor.
const base: Profile = [
  [0, -0.39],
  [0.21, -0.39],
  [0.25, -0.36],
  [0.25, -0.31],
  [0.22, -0.28],
  [0.22, -0.24],
  [0.17, -0.2],
];
const stem: Profile = [
  [0.135, -0.16],
  [0.104, -0.08],
  [0.077, 0.04],
  [0.082, 0.13],
  [0.132, 0.15],
  [0.144, 0.18],
  [0.105, 0.21],
];
const profiles: Record<string, Profile> = {
  p: [
    [0.115, -0.13],
    [0.077, 0],
    [0.076, 0.08],
    [0.124, 0.1],
    [0.125, 0.14],
    [0.075, 0.16],
    [0, 0.2],
  ],
  b: [...stem, [0.12, 0.24], [0.09, 0.33], [0.036, 0.4], [0, 0.42]],
  q: [...stem, [0.14, 0.25], [0.17, 0.3], [0.14, 0.32], [0, 0.32]],
  k: [...stem, [0.144, 0.25], [0.138, 0.29], [0.065, 0.32], [0, 0.33]],
  r: [
    [0.155, -0.15],
    [0.122, -0.04],
    [0.122, 0.16],
    [0.17, 0.19],
    [0.175, 0.28],
    [0.12, 0.28],
    [0.12, 0.236],
    [0, 0.236],
  ],
  n: [
    [0.16, -0.16],
    [0.153, -0.12],
    [0, -0.12],
  ],
};

function knightHead() {
  const shape = new T.Shape();
  shape.moveTo(-0.145, -0.15);
  shape.quadraticCurveTo(-0.04, -0.05, -0.025, 0.08);
  shape.quadraticCurveTo(-0.13, 0.0, -0.225, 0.065);
  shape.quadraticCurveTo(-0.24, 0.085, -0.215, 0.128);
  shape.lineTo(-0.089, 0.285);
  shape.lineTo(-0.065, 0.404);
  shape.lineTo(0.005, 0.328);
  shape.quadraticCurveTo(0.18, 0.292, 0.195, 0.075);
  shape.quadraticCurveTo(0.198, -0.04, 0.143, -0.15);
  shape.closePath();
  return new T.ExtrudeGeometry(shape, {
    depth: 0.16,
    bevelEnabled: true,
    bevelSize: 0.034,
    bevelThickness: 0.038,
    bevelSegments: 4,
    curveSegments: 10,
  }).translate(0, 0, -0.08);
}

export function sculptedGeometry(type: string) {
  const parts: T.BufferGeometry[] = [
    new T.LatheGeometry(
      [...base, ...profiles[type]].map(([r, y]) => new T.Vector2(r, y)),
      32,
    ),
  ];
  const sphere = (radius: number, x: number, y: number, z = 0) =>
    new T.SphereGeometry(radius, 16, 12).translate(x, y, z);
  if (type === "p") parts.push(sphere(0.118, 0, 0.235));
  if (type === "b") parts.push(sphere(0.038, 0, 0.411));
  if (type === "q") {
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      parts.push(
        sphere(0.034, 0.132 * Math.cos(angle), 0.338, 0.132 * Math.sin(angle)),
      );
    }
    parts.push(sphere(0.062, 0, 0.358));
  }
  if (type === "k") {
    parts.push(new T.BoxGeometry(0.045, 0.153, 0.055).translate(0, 0.368, 0));
    parts.push(new T.BoxGeometry(0.155, 0.045, 0.055).translate(0, 0.392, 0));
  }
  if (type === "r") {
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      parts.push(
        new T.BoxGeometry(0.096, 0.078, 0.069)
          .rotateY(-angle)
          .translate(0.137 * Math.cos(angle), 0.294, 0.137 * Math.sin(angle)),
      );
    }
  }
  if (type === "n") {
    parts.push(knightHead());
    // Subtle relief on both sides keeps the horse recognizable after a full flip.
    for (const sign of [-1, 1])
      parts.push(sphere(0.026, -0.095, 0.219, sign * 0.102));
  }
  const buffers = parts.map((part) =>
    part.index ? part.toNonIndexed() : part,
  );
  const geometry = mergeGeometries(buffers);
  for (const part of new Set([...parts, ...buffers])) part.dispose();
  if (!geometry) throw Error("Could not build the sculpted chess piece.");
  geometry.addGroup(0, geometry.attributes.position.count, 0);
  geometry.computeBoundingBox();
  return geometry;
}

export function createSculptedPiece(geometry: T.BufferGeometry, color: string) {
  const material = new T.MeshStandardMaterial({
    color: color === "w" ? "#cbdcec" : "#294354",
    metalness: 0.22,
    roughness: 0.38,
  });
  const mesh = new T.Mesh(geometry, [material]);
  const positions = geometry.attributes.position;
  const colorSample = material.color.toArray();
  const step = Math.max(1, Math.floor(positions.count / 144));
  mesh.userData.dustSamples = Array.from(
    { length: Math.floor(positions.count / step) },
    (_, index) => ({
      x: positions.getX(index * step),
      y: positions.getY(index * step),
      color: colorSample,
    }),
  );
  return mesh;
}
