import { z } from "zod";

export const APP_VERSION = "0.1.3";
export const FORMATS = [
  "landscape",
  "vertical",
  "square",
  "square-in-vertical",
] as const;
export type Format = (typeof FORMATS)[number];
export const DIMENSIONS: Record<Format, [number, number]> = {
  landscape: [1920, 1080],
  vertical: [1080, 1920],
  square: [1080, 1080],
  "square-in-vertical": [1080, 1920],
};
const n = (min: number, max: number) => z.number().finite().min(min).max(max);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const text = z.string().max(10000);
export const easings = [
  "smooth",
  "soft-landing",
  "accelerate",
  "bounce",
  "overshoot",
  "linear",
] as const;
export type Easing = (typeof easings)[number];
export const presets = [
  "clean",
  "soft",
  "spin",
  "wiggle",
  "hop",
  "dramatic",
  "capture",
] as const;
export type Preset = (typeof presets)[number];
export const channels = [
  "travel",
  "positionX",
  "positionY",
  "positionZ",
  "rotationX",
  "rotationY",
  "rotationZ",
  "scale",
  "opacity",
  "cameraX",
  "cameraY",
  "zoom",
] as const;
export const KeySchema = z.object({
  t: n(0, 1),
  value: n(-100, 100),
  easing: z.enum(easings),
});
export type Keyframe = z.infer<typeof KeySchema>;
export const CameraSchema = z.object({
  mode: z.enum(["follow", "route", "full", "manual"]),
  x: n(-8, 8),
  y: n(-8, 8),
  zoom: n(0.6, 3),
  transition: n(0.05, 5),
  tilt: n(-25, 25),
  rotation: n(-30, 30),
  padding: n(0, 3),
});
export type CameraSettings = z.infer<typeof CameraSchema>;
export const BadgeSchema = z.object({
  manual: z.string().max(32).nullable(),
  size: n(0.2, 2),
  x: n(-3, 3),
  y: n(-3, 3),
  start: n(0, 1),
  end: n(0, 1),
  opacity: n(0, 1),
  glow: n(0, 2),
  ring: z.boolean(),
});
export const EffectSchema = z.object({
  preset: z.enum(presets),
  duration: n(0.15, 30),
  delay: n(0, 30),
  hold: n(0, 60),
  locked: z.boolean(),
  intensity: n(0, 2),
  easing: z.enum(easings),
  axis: z.enum(["x", "y", "z"]),
  rotation: n(-1440, 1440),
  wiggle: n(0, 45),
  frequency: n(1, 12),
  hop: n(0, 3),
  path: n(-3, 3),
  overshoot: n(0, 0.4),
  scale: n(1, 3),
  peak: n(0.1, 0.95),
  landing: n(0.2, 0.95),
  settle: n(0.05, 0.5),
  impact: n(0, 1),
  capturedAt: n(0, 1),
  expansion: n(0.02, 0.4),
  returnEase: z.enum(easings),
  glowColor: color,
  glow: n(0, 2),
  radius: n(0.3, 3),
  impactParticles: z.boolean(),
  highlights: z.boolean(),
  pathSquares: z.boolean(),
  trail: z.boolean(),
  sourceColor: color,
  destColor: color,
  pathColor: color,
  trailWidth: n(0.02, 0.6),
  opacity: n(0, 1),
  reveal: n(0, 0.8),
  fade: n(0.01, 1),
  persist: z.boolean(),
  badge: BadgeSchema,
  cameras: z.partialRecord(z.enum(FORMATS), CameraSchema),
  keys: z.partialRecord(z.enum(channels), z.array(KeySchema).max(100)),
  landingBeat: z.string().nullable(),
});
export type Effect = z.infer<typeof EffectSchema>;
export const AnalysisSchema = z.object({
  book: z
    .object({
      state: z.enum(["not-analyzed", "found", "not-found", "unavailable"]),
      games: z.number().nonnegative(),
      frequency: n(0, 1),
      source: text,
      message: text,
    })
    .optional(),
  engine: z
    .object({
      state: z.enum(["done", "unavailable"]),
      label: text,
      loss: z.number().nonnegative(),
      before: n(-100000, 100000),
      after: n(-100000, 100000),
      mate: z.number().nullable(),
      depth: z.number().nonnegative(),
      source: text,
      message: text,
    })
    .optional(),
});
export const MoveSchema = z.object({
  id: text,
  uci: z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/),
  san: text,
  effect: EffectSchema,
  analysis: AnalysisSchema,
});
export type ProjectMove = z.infer<typeof MoveSchema>;
export const AssetSchema = z.object({
  id: text,
  name: text,
  path: text,
  kind: z.enum(["audio", "image", "badge"]),
  source: text,
  guidance: text,
});
export type Asset = z.infer<typeof AssetSchema>;
export const BeatSchema = z.object({
  id: text,
  time: n(0, 86400),
  strong: z.boolean(),
  selected: z.boolean(),
  sourceTime: n(0, 86400).optional(),
  assetId: text.optional(),
});
export type Beat = z.infer<typeof BeatSchema>;
export const ProjectSchema = z.object({
  kind: z.literal("chess-animation-studio"),
  schemaVersion: z.literal(1),
  appVersion: text,
  id: text,
  title: z.string().max(200),
  startFen: text,
  rawPgn: z.string().max(2_000_000),
  lines: z
    .array(
      z.object({ name: text, sans: z.array(z.string().max(30)).max(5000) }),
    )
    .max(500),
  selectedLine: z.number().int().nonnegative(),
  moves: z.array(MoveSchema).max(5000),
  defaults: EffectSchema,
  style: z.object({
    pieceSet: z.enum(["lichess", "chesscom"]).default("lichess"),
    light: color,
    dark: color,
    background: color,
    accent: color,
    orientation: z.enum(["white", "black"]),
    coordinates: z.boolean(),
  }),
  output: z.enum(FORMATS),
  layouts: z.record(
    z.enum(FORMATS),
    z.object({
      zoom: n(0.6, 2),
      x: n(-3, 3),
      y: n(-5, 5),
      background: z.enum(["solid", "gradient", "particles", "image"]),
      image: z.string().nullable(),
    }),
  ),
  ambient: z.object({
    enabled: z.boolean(),
    seed: z.number().int(),
    density: n(0, 300),
    size: n(0.01, 0.15),
    opacity: n(0, 1),
    speed: n(0, 2),
    drift: n(-2, 2),
    direction: n(-180, 180),
    softness: n(0, 1),
    depth: n(0, 1),
    color,
    layer: z.enum(["over", "behind", "both"]),
  }),
  pulse: z.object({
    enabled: z.boolean(),
    color,
    intensity: n(0, 1),
    attack: n(0.01, 0.5),
    decay: n(0.05, 2),
    selection: z.enum(["all", "strong", "selected"]),
  }),
  music: z
    .object({
      assetId: text,
      offset: n(-3600, 86400),
      trimStart: n(0, 86400),
      trimEnd: n(0, 86400),
      volume: n(0, 2),
      muted: z.boolean(),
      fadeIn: n(0, 60),
      fadeOut: n(0, 60),
      duration: n(0, 86400),
      waveform: z.array(n(0, 1)).max(4000),
    })
    .nullable(),
  beats: z.array(BeatSchema).max(10000),
  assets: z.array(AssetSchema).max(500),
  cues: z
    .array(
      z.object({
        id: text,
        moveId: z.string().nullable(),
        time: n(-60, 86400),
        assetId: text,
        volume: n(0, 2),
        bus: z.enum(["chess", "dramatic"]),
      }),
    )
    .max(5000),
  sound: z.object({ enabled: z.boolean(), chess: n(0, 2), dramatic: n(0, 2) }),
  leadIn: n(0, 60),
  tailHold: n(0, 60),
  savedPresets: z
    .array(z.object({ name: z.string().max(80), effect: EffectSchema }))
    .max(200),
  analysisSettings: z.object({
    minGames: z.number().int().min(1).max(100000),
    frequency: n(0, 1),
    cutoff: z.number().int().min(1).max(100),
    depth: z.number().int().min(1).max(24),
    moveTime: n(100, 10000),
  }),
  badgePack: z.record(z.string().max(32), z.string()).default({}),
  // Reserved scene extension slots. No unimplemented scene is exposed in the editor.
  scenes: z
    .array(
      z.object({
        id: text,
        type: text,
        version: z.number().int().positive(),
        data: z.record(z.string(), z.unknown()),
      }),
    )
    .max(100),
});
export type Project = z.infer<typeof ProjectSchema>;
export const uid = () => crypto.randomUUID();
export const cameraDefault = (): CameraSettings => ({
  mode: "route",
  x: 0,
  y: 0,
  zoom: 1.12,
  transition: 0.65,
  tilt: 0,
  rotation: 0,
  padding: 0.5,
});
export function effectPreset(preset: Preset): Effect {
  const e: Effect = {
    preset,
    duration: 1.35,
    delay: 0,
    hold: 0.3,
    locked: false,
    intensity: 1,
    easing: "smooth",
    axis: "z",
    rotation: 0,
    wiggle: 0,
    frequency: 3,
    hop: 0,
    path: 0,
    overshoot: 0,
    scale: 1,
    peak: 0.65,
    landing: 0.76,
    settle: 0.22,
    impact: 0.76,
    capturedAt: 0.78,
    expansion: 0.06,
    returnEase: "soft-landing",
    glowColor: "#61ddff",
    glow: 0,
    radius: 1.3,
    impactParticles: false,
    highlights: true,
    pathSquares: true,
    trail: false,
    sourceColor: "#a2b5ff",
    destColor: "#6de8c1",
    pathColor: "#8cacf6",
    trailWidth: 0.12,
    opacity: 0.34,
    reveal: 0,
    fade: 0.3,
    persist: false,
    badge: {
      manual: null,
      size: 0.65,
      x: 0.38,
      y: 0.38,
      start: 0.6,
      end: 1,
      opacity: 1,
      glow: 0.5,
      ring: true,
    },
    cameras: {},
    keys: {},
    landingBeat: null,
  };
  if (preset === "soft") e.easing = "soft-landing";
  if (preset === "spin")
    Object.assign(e, { axis: "y", rotation: 360, scale: 1.1, hop: 0.25 });
  if (preset === "wiggle") Object.assign(e, { wiggle: 13, frequency: 3 });
  if (preset === "hop") Object.assign(e, { hop: 1, scale: 1.08 });
  if (preset === "dramatic")
    Object.assign(e, {
      duration: 2.2,
      rotation: 360,
      axis: "y",
      scale: 1.6,
      hop: 0.45,
      easing: "soft-landing",
      glow: 0.65,
      trail: true,
    });
  if (preset === "capture")
    Object.assign(e, {
      duration: 1.65,
      scale: 1.75,
      glow: 1,
      impactParticles: true,
      trail: true,
    });
  return e;
}
export function blankProject(): Project {
  return {
    kind: "chess-animation-studio",
    schemaVersion: 1,
    appVersion: APP_VERSION,
    id: uid(),
    title: "Untitled composition",
    startFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    rawPgn: "",
    lines: [{ name: "Main line", sans: [] }],
    selectedLine: 0,
    moves: [],
    defaults: effectPreset("clean"),
    style: {
      pieceSet: "lichess",
      light: "#ebecd0",
      dark: "#779556",
      background: "#101b22",
      accent: "#89ddbb",
      orientation: "white",
      coordinates: true,
    },
    output: "landscape",
    layouts: Object.fromEntries(
      FORMATS.map((f) => [
        f,
        { zoom: 1, x: 0, y: 0, background: "gradient", image: null },
      ]),
    ) as Project["layouts"],
    ambient: {
      enabled: true,
      seed: 1701,
      density: 65,
      size: 0.035,
      opacity: 0.35,
      speed: 0.23,
      drift: 0.17,
      direction: 0,
      softness: 0.8,
      depth: 0.5,
      color: "#ffffff",
      layer: "both",
    },
    pulse: {
      enabled: true,
      color: "#92d9d2",
      intensity: 0.2,
      attack: 0.04,
      decay: 0.3,
      selection: "strong",
    },
    music: null,
    beats: [],
    assets: [],
    cues: [],
    sound: { enabled: true, chess: 0.4, dramatic: 0.6 },
    leadIn: 0.6,
    tailHold: 1.2,
    savedPresets: [],
    analysisSettings: {
      minGames: 20,
      frequency: 0.005,
      cutoff: 24,
      depth: 14,
      moveTime: 600,
    },
    badgePack: {},
    scenes: [],
  };
}
export function parseProject(value: unknown): Project {
  const p = ProjectSchema.parse(value);
  if (p.selectedLine >= p.lines.length)
    throw new Error("The selected variation is missing.");
  if (new Set(p.moves.map((m) => m.id)).size !== p.moves.length)
    throw new Error("Duplicate move identities.");
  if (new Set(p.assets.map((a) => a.id)).size !== p.assets.length)
    throw new Error("Duplicate asset identities.");
  if (
    p.music &&
    (p.music.trimEnd <= p.music.trimStart || p.music.trimEnd > p.music.duration)
  )
    throw new Error(
      "Music trim must select a nonempty range inside the source duration.",
    );
  if (p.scenes.length)
    throw new Error(
      "This version cannot play cinematic scenes. Open this project in its original version.",
    );
  return p;
}
