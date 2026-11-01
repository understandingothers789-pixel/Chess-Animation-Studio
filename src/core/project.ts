import { z } from "zod";
export const VERSION = "0.2.14";
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
  "flip",
  "sway",
  "sway-half",
  "hop",
  "dramatic",
  "capture",
  "finale",
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
export const rainbowDefaults = {
  enabled: false,
  duration: 12,
  colors: ["#80262c", "#805020", "#707020", "#206040", "#203f80", "#602b70"],
  active: [true, true, true, true, true, true],
};
const rainbowSchema = z
  .object({
    enabled: z.boolean(),
    duration: n(1, 120),
    colors: z.array(color).length(6),
    active: z.array(z.boolean()).length(6),
  })
  .default(rainbowDefaults);
const str = z.string().max(1000);
export const keySchema = z.object({
  at: n(0, 1),
  value: n(-10000, 10000),
  ease: z.enum(["smooth", "linear", "soft", "accelerate"]),
});
export type Key = z.infer<typeof keySchema>;
export const cameraSchema = z.object({
  mode: z.enum(["route", "follow", "manual", "full", "game"]),
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
export const moveLightDefaults = {
  enabled: false,
  color: "#ff3030",
  strength: 0.28,
  flicker: 0.22,
  speed: 3.5,
  fadeIn: 0.12,
  fadeOut: 0.25,
  hold: 0.15,
  highlights: true,
};
export const beatSpotlightDefaults = {
  enabled: false,
  rhythm: "alternate" as "alternate" | "punch",
  duration: 2.4,
  clock: "auto" as "auto" | "bpm",
  bpm: 140,
  offset: 0,
  zoom: 0.85,
  roll: 10,
  shake: 0.055,
  focus: 1,
  primary: "#34f6e6",
  secondary: "#f6d64b",
  colorEvery: 4,
  colorStrength: 0.23,
  glow: 0.75,
  particles: 64,
  blur: 0.35,
  flash: 0.2,
  desaturate: 0.65,
  vignette: 0.4,
};
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
  cycles: n(0.5, 6),
  hop: n(0, 3),
  path: n(-3, 3),
  overshoot: n(0, 0.3),
  scale: n(1, 3),
  peak: n(0.1, 0.95),
  jam: z
    .object({
      enabled: z.boolean(),
      rhythm: z.enum(["alternate", "punch"]).default("alternate"),
      duration: n(0.6, 8),
      clock: z.enum(["auto", "bpm"]),
      bpm: n(40, 300),
      offset: n(-1, 1),
      zoom: n(0, 2),
      roll: n(0, 30),
      shake: n(0, 0.4),
      focus: n(0, 1),
      primary: color,
      secondary: color,
      colorEvery: n(1, 8).int(),
      colorStrength: n(0, 0.75),
      glow: n(0, 1.5),
      particles: n(0, 128).int(),
      blur: n(0, 1),
      flash: n(0, 0.65),
      desaturate: n(0, 1),
      vignette: n(0, 0.8),
    })
    .default(() => ({ ...beatSpotlightDefaults })),
  light: z
    .object({
      enabled: z.boolean(),
      color,
      strength: n(0, 0.65),
      flicker: n(0, 0.8),
      speed: n(0.2, 10),
      fadeIn: n(0, 2),
      fadeOut: n(0, 2),
      hold: n(0, 2),
      highlights: z.boolean(),
    })
    .default(() => ({ ...moveLightDefaults })),
  capture: z.object({
    grow: n(1, 3),
    expansion: n(0.02, 0.5),
    returnTime: n(0.05, 0.8),
    exitAt: n(0, 1),
    exit: z.enum(["dust", "fade", "shrink", "drop"]),
    dustDuration: n(0.15, 1.5).default(0.7),
    dustAmount: n(16, 256).int().default(128),
    dustSpread: n(0.1, 2).default(0.85),
    dustSize: n(0.015, 0.15).default(0.055),
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
    byMover: z.boolean().default(true),
    whiteColor: color.default("#FFA878"),
    blackColor: color.default("#FFE04C"),
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
    jam: { ...beatSpotlightDefaults },
    light: { ...moveLightDefaults },
    capture: {
      grow: 1.45,
      expansion: 0.12,
      returnTime: 0.28,
      exitAt: 0.76,
      exit: "dust",
      dustDuration: 0.7,
      dustAmount: 128,
      dustSpread: 0.85,
      dustSize: 0.055,
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
      byMover: true,
      whiteColor: "#FFA878",
      blackColor: "#FFE04C",
      showSource: true,
      showDestination: true,
      showPath: true,
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
  if (preset === "flip")
    Object.assign(e, {
      duration: 1.7,
      rotation: 360,
      axis: "y",
      hop: 0.4,
      scale: 1.12,
      landing: 0.88,
      settle: 0.12,
    });
  if (preset === "sway")
    Object.assign(e, { duration: 2.2, sway: 24, landing: 0.88, settle: 0.12 });
  if (preset === "sway-half")
    Object.assign(e, {
      duration: 1.6,
      sway: 24,
      cycles: 0.5,
      landing: 0.88,
      settle: 0.12,
    });
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
  if (preset === "finale") {
    Object.assign(e, { duration: 2.2, hold: 0.8, hop: 0.5, scale: 1.55 });
    Object.assign(e.capture, {
      grow: 1.9,
      glow: 1.4,
      impact: 0.84,
      color: "#f6d64b",
    });
    Object.assign(e.jam, {
      enabled: true,
      rhythm: "punch",
      duration: 2.4,
      zoom: 1.2,
      glow: 1,
      particles: 112,
      flash: 0.38,
      primary: "#f6d64b",
      secondary: "#34f6e6",
    });
  }
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
        autoPreset: z.enum(["flip", "finale"]).optional(),
        analysis: analysisSchema,
      }),
    )
    .max(3000),
  defaults: effectSchema,
  style: z.object({
    pieceSet: z.enum(["cburnett", "merida", "neo"]),
    light: color,
    dark: color,
    rim: color,
    background: color,
    accent: color,
    orientation: z.enum(["white", "black"]),
    coordinates: z.boolean(),
  }),
  boardFX: z
    .object({
      enabled: z.boolean(),
      shimmer: n(0, 0.2),
      shimmerSpeed: n(0.05, 5),
      intro: z.boolean(),
      introPreset: z
        .enum(["zoom-turn", "zoom", "turn", "still", "board-level"])
        .default("zoom-turn"),
      introDuration: n(0.2, 8),
      introZoom: n(0.2, 1),
      introTurn: n(-90, 90),
      beatClock: z.boolean(),
      bpm: n(20, 240),
      beatColor: color,
      lightingColor: color.optional(),
      rimColor: color.optional(),
      sweepColor: color.optional(),
      vignetteColor: color.optional(),
      beatStrength: n(0, 1),
      beatDecay: n(0.05, 2),
      rim: n(0, 0.5),
      rimSpeed: n(0.05, 3),
      sweep: n(0, 0.3),
      sweepSpeed: n(0.05, 3),
      vignette: n(0, 0.5),
      vignetteSpeed: n(0.05, 3),
    })
    .default({
      enabled: true,
      shimmer: 0.035,
      shimmerSpeed: 0.7,
      intro: true,
      introPreset: "zoom-turn",
      introDuration: 2,
      introZoom: 0.55,
      introTurn: 45,
      beatClock: false,
      bpm: 100,
      beatColor: "#aaa2fa",
      beatStrength: 0.25,
      beatDecay: 0.3,
      rim: 0.12,
      rimSpeed: 0.3,
      sweep: 0.06,
      sweepSpeed: 0.12,
      vignette: 0.08,
      vignetteSpeed: 0.2,
    }),
  shorts: z
    .object({
      enabled: z.boolean(),
      width: n(4, 8),
      tracking: n(0, 1).default(0.35),
      height: n(0.55, 1),
      position: n(0, 1),
      follow: z.boolean(),
      barColor: color,
    })
    .default({
      enabled: false,
      width: 6,
      tracking: 0.35,
      height: 0.72,
      position: 0.5,
      follow: true,
      barColor: "#000000",
    }),
  gameViewWidth: n(3, 16).default(8),
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
    rainbow: rainbowSchema,
    insideBoard: z.boolean().default(true),
    enabled: z.boolean(),
    count: n(0, 400).int(),
    size: n(0.01, 0.35),
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
    rainbow: rainbowSchema,
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
    volumePoints: z
      .array(z.object({ time: n(0, 7200), value: n(0, 2) }))
      .max(1000)
      .default([]),
    muted: z.boolean(),
    fadeIn: n(0, 30),
    fadeOut: n(0, 30),
  }),
  evalBar: z.boolean().default(false),
  introTitle: z.object({ enabled: z.boolean(), text: z.string().max(120), piece: z.enum(["pawn", "knight", "bishop", "rook", "queen", "king"]).default("knight") }).default({ enabled: false, text: "CHESS STORY", piece: "knight" }),
  reviewColors: z
    .object({
      enabled: z.boolean(),
      book: color,
      brilliant: color,
      best: color,
      good: color,
      inaccuracy: color,
      mistake: color,
      blunder: color,
    })
    .default({
      enabled: true,
      book: "#FFA878",
      brilliant: "#44D9D6",
      best: "#83CE60",
      good: "#83CE60",
      inaccuracy: "#F3D253",
      mistake: "#F49A4A",
      blunder: "#E63336",
    }),
  beatsLocked: z.boolean().default(false),
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
  audio: z.object({ chess: n(0, 2), effects: n(0, 2), automatic: z.boolean(), knightHorse: z.boolean().default(false) }),
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
      light: "#EDD6B0",
      dark: "#B88762",
      rim: "#454f49",
      background: "#111918",
      accent: "#c6e59d",
      orientation: "white",
      coordinates: false,
    },
    boardFX: {
      enabled: true,
      shimmer: 0.035,
      shimmerSpeed: 0.7,
      intro: true,
      introPreset: "zoom-turn",
      introDuration: 2,
      introZoom: 0.55,
      introTurn: 45,
      beatClock: false,
      bpm: 100,
      beatColor: "#aaa2fa",
      beatStrength: 0.25,
      beatDecay: 0.3,
      rim: 0.12,
      rimSpeed: 0.3,
      sweep: 0.06,
      sweepSpeed: 0.12,
      vignette: 0.08,
      vignetteSpeed: 0.2,
    },
    shorts: {
      enabled: false,
      width: 6,
      tracking: 0.35,
      height: 0.72,
      position: 0.5,
      follow: true,
      barColor: "#000000",
    },
    gameViewWidth: 8,
    format: "landscape",
    layouts: Object.fromEntries(
      formats.map((f) => [
        f,
        { x: 0, y: 0, zoom: 1, background: "gradient", image: null },
      ]),
    ) as Project["layouts"],
    ambient: {
      rainbow: structuredClone(rainbowDefaults),
      insideBoard: true,
      enabled: true,
      count: 100,
      size: 0.065,
      opacity: 0.55,
      speed: 0.18,
      drift: 0.3,
      direction: 0,
      depth: 0.5,
      softness: 0.5,
      color: "#ffffff",
      seed: 4729,
      layer: "over",
    },
    pulse: {
      rainbow: structuredClone(rainbowDefaults),
      enabled: false,
      color: "#aaa2fa",
      intensity: 0.25,
      attack: 0.05,
      decay: 0.22,
      accentsOnly: false,
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
      volumePoints: [],
      muted: false,
      fadeIn: 0.3,
      fadeOut: 1,
    },
    evalBar: false,
    introTitle: { enabled: false, text: "CHESS STORY", piece: "knight" },
    reviewColors: {
      enabled: true,
      book: "#FFA878",
      brilliant: "#44D9D6",
      best: "#83CE60",
      good: "#83CE60",
      inaccuracy: "#F3D253",
      mistake: "#F49A4A",
      blunder: "#E63336",
    },
    beatsLocked: false,
    beats: [],
    waveform: [],
    cues: [],
    audio: { chess: 0.4, effects: 0.5, automatic: true, knightHorse: false },
    presets: [],
    lead: 2,
    tail: 1.5,
    analysis: {
      depth: 6,
      milliseconds: 1500,
      threads: 2,
      hash: 128,
      minGames: 20,
      frequency: 0.005,
      cutoff: 8,
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
