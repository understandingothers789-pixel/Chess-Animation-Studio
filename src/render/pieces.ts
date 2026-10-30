import * as T from "three";
import { contours } from "d3-contour";
export type PieceSet = "merida" | "cburnett" | "neo";
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
            canvas.width = canvas.height = 1024;
            const ctx = canvas.getContext("2d")!;
            ctx.drawImage(image, 0, 0, 1024, 1024);
            if (set === "neo") {
              const source = document.createElement("canvas");
              source.width = source.height = 140;
              const sc = source.getContext("2d", { willReadFrequently: true })!;
              sc.drawImage(image, 0, 0, 140, 140);
              const rgba = sc.getImageData(0, 0, 140, 140).data;
              ctx.clearRect(0, 0, 1024, 1024);
              ctx.save();
              ctx.scale(1024 / 140, 1024 / 140);
              const layers: [number, string][] = [
                [256, "#fafafa"],
                [244, "#e9e9e9"],
                [215, "#cccccc"],
                [170, "#999999"],
                [125, "#777775"],
                [98, "#595957"],
                [75, "#494947"],
                [55, "#333333"],
              ];
              for (const [threshold, fill] of layers) {
                const values = Array.from({ length: 140 * 140 }, (_, i) =>
                  rgba[i * 4 + 3] > 80 &&
                  (rgba[i * 4] + rgba[i * 4 + 1] + rgba[i * 4 + 2]) / 3 <
                    threshold
                    ? 1
                    : 0,
                );
                const polygons = contours().size([140, 140]).thresholds([0.5])(
                  values,
                )[0].coordinates;
                ctx.beginPath();
                for (const polygon of polygons)
                  for (const ring of polygon) {
                    if (ring.length < 4) continue;
                    const start = ring[0],
                      last = ring[ring.length - 2];
                    ctx.moveTo(
                      (last[0] + start[0]) / 2,
                      (last[1] + start[1]) / 2,
                    );
                    for (let j = 0; j < ring.length - 1; j++) {
                      const v = ring[j],
                        next = ring[(j + 1) % (ring.length - 1)];
                      ctx.quadraticCurveTo(
                        v[0],
                        v[1],
                        (v[0] + next[0]) / 2,
                        (v[1] + next[1]) / 2,
                      );
                    }
                    ctx.closePath();
                  }
                ctx.fillStyle = fill;
                ctx.fill("evenodd");
              }
              ctx.restore();
            }

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
          `pieces/${set}/${color}${type.toUpperCase()}.${set === "neo" ? "png" : "svg"}`,
          document.baseURI,
        ).href;
      }),
    );
  return assets.get(key)!;
}
export async function preloadPieces() {
  await Promise.all(
    (["merida", "cburnett", "neo"] as const).flatMap((set) =>
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
