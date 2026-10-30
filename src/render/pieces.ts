import * as T from "three";
import { contours } from "d3-contour";
export type PieceSet = "merida" | "cburnett";
type Artwork = { geometry: T.ExtrudeGeometry; texture: T.CanvasTexture };
const assets = new Map<string, Promise<Artwork>>();
export async function artwork(
  set: PieceSet,
  color: string,
  type: string,
): Promise<Artwork> {
  const key = set + color + type;
  if (!assets.has(key))
    assets.set(
      key,
      new Promise<Artwork>((resolve, reject) => {
        const image = new Image();
        image.onerror = () =>
          reject(Error(`Could not load ${key} piece artwork.`));
        image.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = canvas.height = 2048;
            const ctx = canvas.getContext("2d")!;
            ctx.drawImage(image, 0, 0, 2048, 2048);
            const mask = document.createElement("canvas");
            mask.width = mask.height = 256;
            const m = mask.getContext("2d", { willReadFrequently: true })!;
            m.drawImage(image, 0, 0, 256, 256);
            const pixels = m.getImageData(0, 0, 256, 256).data,
              alpha = Array.from(
                { length: 256 * 256 },
                (_, i) => pixels[i * 4 + 3] / 255,
              );
            const polygons = contours().size([256, 256]).thresholds([0.2])(
              alpha,
            )[0].coordinates;
            const shapes: T.Shape[] = [];
            for (const polygon of polygons) {
              const rings = polygon.map((r) =>
                r.map(
                  (v) =>
                    new T.Vector2(
                      (v[0] / 256 - 0.5) * 0.96,
                      (0.5 - v[1] / 256) * 0.96,
                    ),
                ),
              );
              if (rings[0].length < 4) continue;
              const shape = new T.Shape(rings[0]);
              for (const hole of rings.slice(1))
                shape.holes.push(new T.Path(hole));
              shapes.push(shape);
            }
            const geometry = new T.ExtrudeGeometry(shapes, {
              depth: 0.036,
              bevelEnabled: true,
              bevelSize: 0.0016,
              bevelThickness: 0.0015,
              bevelSegments: 1,
              steps: 1,
              curveSegments: 12,
            });
            const pos = geometry.attributes.position,
              uv = geometry.attributes.uv;
            for (let i = 0; i < pos.count; i++)
              uv.setXY(i, pos.getX(i) / 0.96 + 0.5, pos.getY(i) / 0.96 + 0.5);
            geometry.translate(0, 0, -0.018);
            const texture = new T.CanvasTexture(canvas);
            texture.colorSpace = T.SRGBColorSpace;
            texture.anisotropy = 8;
            resolve({ geometry, texture });
          } catch (e) {
            reject(e);
          }
        };
        image.src = new URL(
          `pieces/${set}/${color}${type.toUpperCase()}.svg`,
          document.baseURI,
        ).href;
      }),
    );
  return assets.get(key)!;
}
export async function preloadPieces() {
  await Promise.all(
    (["merida", "cburnett"] as const).flatMap((set) =>
      ["w", "b"].flatMap((c) =>
        "kqrbnp".split("").map((t) => artwork(set, c, t)),
      ),
    ),
  );
}
export async function createPiece(set: PieceSet, color: string, type: string) {
  const a = await artwork(set, color, type);
  const face = new T.MeshBasicMaterial({
    map: a.texture,
    transparent: true,
    alphaTest: 0.02,
    side: T.DoubleSide,
  });
  const edge = new T.MeshStandardMaterial({
    color: color === "w" ? "#c7c5bb" : "#292b2c",
    roughness: 0.7,
  });
  const mesh = new T.Mesh(a.geometry, [face, edge]);
  mesh.userData.materials = [face, edge];
  return mesh;
}
