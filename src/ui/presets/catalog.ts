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
  spin: "Sweeps across the board while turning once around its vertical axis to reveal the piece edge.",
  somersault:
    "Lifts off, snaps through a full cartwheel at the top of its arc, and lands upright.",
  flip: "Turns edge-on and lands upright. The full preset triggers capture dust, light, and a short camera kick at contact.",
  sway: "Rocks back and forth while moving, then settles upright.",
  "sway-half": "Leans to one side and returns upright in one gentle sway.",
  hop: "Rises off the board in a high arc before settling on the destination square.",
  dramatic:
    "Sweeps into a full turn and settles to normal size. The full preset adds a short rebound.",
  capture:
    "Highlights contact with a size pulse, glow, and brief camera kick in the full preset.",
  finale:
    "Hops into the final square. The full preset starts the spotlight at landing, then swells with the beat.",
};
