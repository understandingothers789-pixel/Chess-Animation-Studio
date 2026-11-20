import { effectSchema, type Project } from "../../core/project";
import { settingsKinds } from "../../core/editing";
type Saved = Project["presets"][number];
export function personalPresets(): Saved[] {
  try {
    const data: unknown = JSON.parse(
      localStorage.getItem("studio.personalPresets") ?? "[]",
    );
    if (!Array.isArray(data)) return [];
    return data.slice(0, 100).flatMap((v) => {
      const parsed = effectSchema.safeParse(v?.effect);
      return parsed.success &&
        typeof v.name === "string" &&
        v.name.length <= 100 &&
        typeof v.id === "string" &&
        (v.kind === undefined || settingsKinds.includes(v.kind))
        ? [{ id: v.id, name: v.name, kind: v.kind, effect: parsed.data }]
        : [];
    });
  } catch {
    return [];
  }
}
export function storePersonalPreset(preset: Saved) {
  const saved = personalPresets().filter((v) => v.name !== preset.name);
  localStorage.setItem(
    "studio.personalPresets",
    JSON.stringify([...saved, preset].slice(-100)),
  );
}
