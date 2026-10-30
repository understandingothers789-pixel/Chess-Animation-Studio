import { z } from "zod";
export const VERSION = "0.2.0";
export const formats = [
  "landscape",
  "vertical",
  "square",
  "square-in-vertical",
] as const;
export type Format = (typeof formats)[number];
export const sizes: Record<Format, [number, number]> = {
  landscape: [1920, 1080],
  vertical: [1080, 1920],
  square: [1080, 1080],
  "square-in-vertical": [1080, 1920],
};
export const presets = [
  "slide",
  "soft",
  "spin",
  "sway",
  "hop",
  "dramatic",
  "capture",
] as const;
export type Preset = (typeof presets)[number];
export const channels = [
  "travel",
  "x",
  "y",
  "z",
  "rx",
  "ry",
  "rz",
  "scale",
  "opacity",
  "cameraX",
  "cameraY",
  "cameraZoom",
] as const;
export type Channel = (typeof channels)[number];
export const badgeNames = [
  "book",
  "brilliant",
  "best",
  "good",
  "inaccuracy",
  "mistake",
  "blunder",
  "custom",
] as const;
const n = (lo: number, hi: number) => z.number().finite().min(lo).max(hi);
const color = z.string().regex(/^#[0-9a-f]{6}$/i);
const str = z.string().max(1000);
export const keySchema = z.object({
  at: n(0, 1),
  value: n(-10000, 10000),
  ease: z.enum(["smooth", "linear", "soft", "accelerate"]),
});
export type Key = z.infer<typeof keySchema>;
export const cameraSchema = z.object({
  mode: z.enum(["route", "follow", "manual", "full"]),
  x: n(-10, 10),
  y: n(-10, 10),
  zoom: n(0.6, 3),
  tilt: n(-25, 25),
  rotation: n(-35, 35),
  padding: n(0, 2),
  transition: n(0.05, 3),
});
export type Camera = z.infer<typeof cameraSchema>;
export function camera(): Camera {
  return {
    mode: "route",
    x: 0,
    y: 0,
    zoom: 1.12,
    tilt: 0,
    rotation: 0,
    padding: 0.5,
    transition: 0.65,
  };
}
export const effectSchema = z.object({
  preset: z.enum(presets),
  duration: n(0.2, 30),
  delay: n(0, 30),
  hold: n(0, 60),
  locked: z.boolean(),
  intensity: n(0, 2),
  easing: z.enum([
    "smooth",
    "linear",
    "soft",
    "accelerate",
    "bounce",
    "overshoot",
  ]),
  landing: n(0.25, 0.98),
  settle: n(0.01, 0.5),
  axis: z.enum(["x", "y", "z"]),
  rotation: n(-1440, 1440),
  sway: n(0, 45),
  cycles: n(1, 6).int(),
  hop: n(0, 3),
  path: n(-3, 3),
  overshoot: n(0, 0.3),
  scale: n(1, 3),
  peak: n(0.1, 0.95),
  capture: z.object({
    grow: n(1, 3),
    expansion: n(0.02, 0.5),
    returnTime: n(0.05, 0.8),
    exitAt: n(0, 1),
    exit: z.enum(["fade", "shrink", "drop"]),
    impact: n(0.2, 0.95),
    glow: n(0, 2),
    radius: n(0.3, 3),
    color,
    particles: z.boolean(),
  }),
  highlight: z.object({
    source: color,
    destination: color,
    path: color,
    showSource: z.boolean(),
    showDestination: z.boolean(),
    showPath: z.boolean(),
    trail: z.boolean(),
    width: n(0.02, 0.6),
    opacity: n(0, 1),
    glow: n(0, 1),
    reveal: n(0, 0.9),
    fade: n(0.02, 2),
    persist: z.boolean(),
  }),
  badge: z.object({
    manual: z.union([z.enum(badgeNames), z.literal("none"), z.null()]),
    text: z.string().max(12),
    size: n(0.2, 1.5),
    opacity: n(0, 1),
    offsetX: n(-2, 2),
    offsetY: n(-2, 2),
    start: n(0, 1),
    end: n(0, 3),
    glow: n(0, 1),
    ring: z.boolean(),
    entry: z.enum(["pop", "fade", "rise"]),
  }),
  cameras: z.partialRecord(z.enum(formats), cameraSchema),
  keys: z.partialRecord(z.enum(channels), z.array(keySchema).max(64)),
  landingBeat: z.string().max(100).nullable(),
});
export type Effect = z.infer<typeof effectSchema>;
export function effect(preset: Preset = "slide"): Effect {
  const e: Effect = {
    preset,
    duration: 1.45,
    delay: 0,
    hold: 0.25,
    locked: false,
    intensity: 1,
    easing: "smooth",
    landing: 0.82,
    settle: 0.18,
    axis: "z",
    rotation: 0,
    sway: 0,
    cycles: 1,
    hop: 0,
    path: 0,
    overshoot: 0,
    scale: 1,
    peak: 0.6,
    capture: {
      grow: 1.45,
      expansion: 0.12,
      returnTime: 0.28,
      exitAt: 0.76,
      exit: "fade",
      impact: 0.78,
      glow: 0.8,
      radius: 1.3,
      color: "#74e9dc",
      particles: true,
    },
    highlight: {
      source: "#a8a0f5",
      destination: "#a8a0f5",
      path: "#a8a0f5",
      showSource: true,
      showDestination: true,
      showPath: false,
      trail: false,
      width: 0.13,
      opacity: 0.38,
      glow: 0.2,
      reveal: 0,
      fade: 0.4,
      persist: false,
    },
    badge: {
      manual: null,
      text: "!",
      size: 0.52,
      opacity: 1,
      offsetX: 0.35,
      offsetY: 0.45,
      start: 0.75,
      end: 0.7,
      glow: 0.5,
      ring: true,
      entry: "pop",
    },
    cameras: {},
    keys: {},
    landingBeat: null,
  };
  if (preset === "soft") e.easing = "soft";
  if (preset === "spin")
    Object.assign(e, { rotation: 360, axis: "y", hop: 0.25, scale: 1.08 });
  if (preset === "sway")
    Object.assign(e, { duration: 2.2, sway: 24, landing: 0.88, settle: 0.12 });
  if (preset === "hop") Object.assign(e, { hop: 0.85, scale: 1.1 });
  if (preset === "dramatic")
    Object.assign(e, {
      duration: 2.25,
      rotation: 360,
      axis: "y",
      hop: 0.3,
      scale: 1.5,
      landing: 0.86,
    });
  if (preset === "capture") Object.assign(e, { duration: 1.8 });
  return e;
}
const assetSchema = z.object({
  id: str,
  name: str,
  kind: z.enum(["audio", "image"]),
  path: z.string().max(4096),
  source: z.string().max(3000),
  guidance: z.string().max(6000),
});
export type Asset = z.infer<typeof assetSchema>;
const analysisSchema = z.object({
  book: z
    .object({
      state: z.enum(["found", "not-found", "unavailable", "not-analyzed"]),
      games: n(0, 1e12),
      frequency: n(0, 1),
      message: str,
    })
    .optional(),
  engine: z
    .object({
      state: z.enum(["done", "unavailable"]),
      score: n(-1e6, 1e6),
      loss: n(0, 2e6),
      best: str,
      label: z.enum(["best", "good", "inaccuracy", "mistake", "blunder"]),
      depth: n(0, 100),
      message: str,
    })
    .optional(),
});
export const projectSchema = z.object({
  schema: z.literal(2),
  appVersion: str,
  id: str,
  title: z.string().max(200),
  fen: z.string().max(200),
  pgn: z.string().max(2e6),
  lines: z
    .array(z.object({ name: str, sans: z.array(z.string().max(30)).max(3000) }))
    .min(1)
    .max(200),
  line: n(0, 199).int(),
  moves: z
    .array(
      z.object({
        id: str,
        san: z.string().max(30),
        effect: effectSchema,
        analysis: analysisSchema,
      }),
    )
    .max(3000),
  defaults: effectSchema,
  style: z.object({
    pieceSet: z.enum(["cburnett", "merida"]),
    light: color,
    dark: color,
    rim: color,
    background: color,
    accent: color,
    orientation: z.enum(["white", "black"]),
    coordinates: z.boolean(),
  }),
  format: z.enum(formats),
  layouts: z.record(
    z.enum(formats),
    z.object({
      x: n(-3, 3),
      y: n(-4, 4),
      zoom: n(0.6, 1.5),
      background: z.enum(["solid", "gradient", "particles", "image"]),
      image: str.nullable(),
    }),
  ),
  ambient: z.object({
    enabled: z.boolean(),
    count: n(0, 400).int(),
    size: n(0.01, 0.12),
    opacity: n(0, 1),
    speed: n(0, 2),
    drift: n(0, 2),
    direction: n(-2, 2),
    depth: n(0, 2),
    softness: n(0.05, 1),
    color,
    seed: n(0, 1e6).int(),
    layer: z.enum(["over", "behind", "both"]),
  }),
  pulse: z.object({
    enabled: z.boolean(),
    color,
    intensity: n(0, 1),
    attack: n(0.01, 0.4),
    decay: n(0.05, 1),
    accentsOnly: z.boolean(),
  }),
  assets: z.array(assetSchema).max(150),
  badgeAssets: z.record(z.string(), str),
  music: z.object({
    sourceDuration: n(0, 3600),
    asset: str.nullable(),
    offset: n(-3600, 3600),
    trimStart: n(0, 3600),
    trimEnd: n(0, 3600),
    volume: n(0, 2),
    muted: z.boolean(),
    fadeIn: n(0, 30),
    fadeOut: n(0, 30),
  }),
  beats: z
    .array(
      z.object({
        id: str,
        time: n(0, 7200),
        accent: z.boolean(),
        enabled: z.boolean(),
        sourceTime: n(0, 7200).optional(),
      }),
    )
    .max(30000),
  waveform: z.array(n(0, 1)).max(3000),
  cues: z
    .array(
      z.object({
        id: str,
        asset: str.nullable(),
        move: str.nullable(),
        time: n(-30, 7200),
        volume: n(0, 2),
        kind: z.enum(["move", "capture", "custom"]),
        bus: z.enum(["chess", "effects"]),
      }),
    )
    .max(6000),
  audio: z.object({ chess: n(0, 2), effects: n(0, 2), automatic: z.boolean() }),
  presets: z
    .array(z.object({ name: z.string().max(100), effect: effectSchema }))
    .max(100),
  lead: n(0, 30),
  tail: n(0, 60),
  analysis: z.object({
    depth: n(4, 24).int(),
    milliseconds: n(100, 15000).int(),
    threads: n(1, 8).int(),
    hash: n(16, 512).int(),
    minGames: n(1, 1e6).int(),
    frequency: n(0, 1),
    cutoff: n(0, 80).int(),
  }),
  scenes: z.array(z.never()).max(0),
});
export type Project = z.infer<typeof projectSchema>;
export type Move = Project["moves"][number];
export const uid = () => crypto.randomUUID();
export function blank(): Project {
  return {
    schema: 2,
    appVersion: VERSION,
    id: uid(),
    title: "Untitled composition",
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    pgn: "",
    lines: [{ name: "Main line", sans: [] }],
    line: 0,
    moves: [],
    defaults: effect(),
    style: {
      pieceSet: "merida",
      light: "#eeeee9",
      dark: "#929992",
      rim: "#454f49",
      background: "#111918",
      accent: "#c6e59d",
      orientation: "white",
      coordinates: false,
    },
    format: "landscape",
    layouts: Object.fromEntries(
      formats.map((f) => [
        f,
        { x: 0, y: 0, zoom: 1, background: "gradient", image: null },
      ]),
    ) as Project["layouts"],
    ambient: {
      enabled: true,
      count: 55,
      size: 0.025,
      opacity: 0.28,
      speed: 0.18,
      drift: 0.3,
      direction: 0,
      depth: 0.5,
      softness: 0.5,
      color: "#ffffff",
      seed: 4729,
      layer: "both",
    },
    pulse: {
      enabled: false,
      color: "#aaa2fa",
      intensity: 0.25,
      attack: 0.05,
      decay: 0.22,
      accentsOnly: true,
    },
    assets: [],
    badgeAssets: {},
    music: {
      sourceDuration: 0,
      asset: null,
      offset: 0,
      trimStart: 0,
      trimEnd: 0,
      volume: 0.65,
      muted: false,
      fadeIn: 0.3,
      fadeOut: 1,
    },
    beats: [],
    waveform: [],
    cues: [],
    audio: { chess: 0.4, effects: 0.5, automatic: true },
    presets: [],
    lead: 0.5,
    tail: 1.5,
    analysis: {
      depth: 12,
      milliseconds: 1500,
      threads: 2,
      hash: 128,
      minGames: 20,
      frequency: 0.005,
      cutoff: 24,
    },
    scenes: [],
  };
}
export function parseProject(value: unknown): Project {
  const p = projectSchema.parse(value);
  if (p.line >= p.lines.length) throw Error("Selected variation is missing.");
  if (new Set(p.moves.map((m) => m.id)).size !== p.moves.length)
    throw Error("Duplicate move identities.");
  if (new Set(p.assets.map((a) => a.id)).size !== p.assets.length)
    throw Error("Duplicate asset identities.");
  if (p.music.trimEnd > 0 && p.music.trimEnd <= p.music.trimStart)
    throw Error("Music trim end must follow its start.");
  return p;
}
