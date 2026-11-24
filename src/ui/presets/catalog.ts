import type { Preset } from "../../core/project";
export const presetLabels: Record<Preset, string> = {
  slide: "Clean slide",
  soft: "Soft landing",
  spin: "Thin-edge spin",
  somersault: "Piece flip",
  flip: "Capture flip",
  sway: "Slow sway",
  "sway-half": "Half sway",
  hop: "Soft hop",
  dramatic: "Dramatic landing",
  capture: "Capture impact",
  finale: "Final move boom",
};

export const presetDescriptions: Record<Preset, string> = {
  slide:
    "Slides directly to the destination square with an even, smooth start and finish.",
  soft: "Moves out quickly, then slows down gently as it reaches the destination.",
  spin: "Turns once around its vertical image axis, showing its side as it travels.",
  somersault:
    "Hops and makes a full cartwheel in the plane of the board before settling upright.",
  flip: "Flips edge-on with a quick start and finish, slowing through the middle of the turn.",
  sway: "Rocks back and forth while moving, then settles upright.",
  "sway-half": "Leans to one side and returns upright in one gentle sway.",
  hop: "Rises off the board in a high arc before settling on the destination square.",
  dramatic: "Combines a full turn, a low hop, and a slower arrival.",
  capture:
    "Emphasizes the moment of contact, with a size and glow pulse in the full preset.",
  finale:
    "Hops into the final square, with an impact pulse and a beat-driven spotlight in the full preset.",
};
