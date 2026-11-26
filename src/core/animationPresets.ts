import { effect, type Preset } from "./project";

/** Presets selected in the editor. Automatic and saved game motions keep their authored settings. */
export function animationPreset(preset: Preset) {
  const result = effect(preset);
  switch (preset) {
    case "spin":
      Object.assign(result, { hop: 0.36, path: 0.15, settle: 0.16 });
      break;
    case "somersault":
      Object.assign(result, {
        duration: 1.32,
        hop: 0.68,
        path: 0.16,
        turnSpan: 0.74,
      });
      break;
    case "flip":
      Object.assign(result, { duration: 1.36, hop: 0.56, path: 0.17 });
      Object.assign(result.capture, {
        exitAt: result.landing,
        impact: result.landing,
        cameraShake: 0.23,
        impactLight: 0.48,
        dustDuration: 0.58,
      });
      break;
    case "dramatic":
      Object.assign(result, {
        duration: 1.78,
        hop: 0.48,
        path: 0.21,
        scale: 1.24,
        sizeReturn: 0.65,
      });
      Object.assign(result.after, {
        kind: "rebound",
        duration: 0.32,
        strength: 0.22,
      });
      break;
    case "capture":
      Object.assign(result.capture, {
        exitAt: result.landing,
        impact: result.landing,
        cameraShake: 0.16,
        impactLight: 0.34,
      });
      break;
    case "finale":
      Object.assign(result, { duration: 1.65, hop: 0.62 });
      Object.assign(result.capture, {
        exitAt: result.landing,
        impact: result.landing,
        glow: 1.08,
      });
      Object.assign(result.jam, {
        start: "landing",
        rhythm: "swell",
        duration: 1.7,
        offset: Math.min(0.12, result.duration * result.landing),
        zoom: 0.72,
        glow: 0.76,
        shake: 0.025,
        roll: 5,
        flash: 0.14,
      });
      break;
  }
  return result;
}
