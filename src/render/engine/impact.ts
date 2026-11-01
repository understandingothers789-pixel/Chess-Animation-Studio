import type { Project } from "../../core/project";
import type { Game } from "../../core/chess";
import { segments } from "../../core/timeline";
/** Capture contact drives every accent from one absolute-time event. */
export function captureImpact(p: Project, game: Game, time: number) {
  let x = 0,
    y = 0,
    light = 0,
    color = "#ffffff";
  const sequence = segments(p);
  for (let i = 0; i < game.steps.length; i++) {
    if (!game.steps[i].capturedId) continue;
    const effect = p.moves[i].effect,
      settings = effect.capture;
    if (!settings.cameraShake && !settings.impactLight) continue;
    const age = time - sequence[i].depart - effect.duration * settings.impact;
    if (age < 0 || age >= 0.35) continue;
    const envelope = Math.exp(-age * 14) * (1 - age / 0.35);
    const seed = i * 2.399963;
    x += Math.sin(age * 105 + seed) * envelope * settings.cameraShake * 0.1;
    y += Math.sin(age * 133 + seed) * envelope * settings.cameraShake * 0.075;
    const strength = envelope * settings.impactLight * 0.3;
    if (strength > light) {
      light = strength;
      color = settings.color;
    }
  }
  return { x, y, light, color };
}
