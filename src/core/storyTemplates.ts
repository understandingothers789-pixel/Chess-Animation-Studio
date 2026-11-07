import type { Project, StoryboardShot } from "./project";
import { shotFromMove, titleShot, shotCaption } from "./storyboard";
import { moveGroups } from "./editing";
export const storyTemplates = [
  "Puzzle Challenge",
  "Opening Trap",
  "Combination",
  "Game Highlights",
  "Checkmate Reveal",
] as const;
export type StoryTemplate = (typeof storyTemplates)[number];
export function createStoryTemplate(
  p: Project,
  template: StoryTemplate,
  ids: string[],
): StoryboardShot[] {
  const valid = ids.filter((id) => p.moves.some((m) => m.id === id));
  if (!valid.length)
    throw Error("Choose at least one source move for this template.");
  const anchor = valid[0],
    last = valid.at(-1)!;
  const hold = (
    id: string,
    position: "before" | "after",
    text: string,
    duration = 3,
  ) => {
    const s = shotFromMove(p, id, "position-hold", position);
    s.duration = duration;
    s.name = text;
    s.annotations = [shotCaption(p, text, duration)];
    return s;
  };
  const move = (id: string, name?: string) => {
    const s = shotFromMove(p, id);
    if (name) s.name = name;
    return s;
  };
  if (template === "Puzzle Challenge")
    return [
      hold(anchor, "before", "Can you find the move?", 2.5),
      hold(anchor, "before", "Your turn to think", 4),
      move(anchor, "The reveal"),
      hold(anchor, "after", "Explain the idea", 3),
    ];
  if (template === "Checkmate Reveal") {
    const mate = valid.find((id) => moveGroups(p).Checkmates.includes(id));
    if (!mate)
      throw Error("Choose a checkmate move. No checkmate is selected.");
    return [
      hold(mate, "before", "Find checkmate", 3),
      move(mate, "Checkmate"),
      hold(mate, "after", "Checkmate", 3),
    ];
  }
  if (template === "Game Highlights")
    return [
      titleShot(p, p.title, 2.5),
      ...valid.slice(0, 12).map((id) => move(id)),
      hold(last, "after", "Final position", 3),
    ];
  if (template === "Opening Trap") {
    if (valid.length < 2)
      throw Error(
        "Choose at least two source moves for the setup and continuation.",
      );
    return [
      titleShot(p, "A closer look at the opening", 2.5),
      hold(anchor, "before", "The setup", 3),
      move(anchor),
      hold(last, "before", "What happens next?", 3),
      ...valid.slice(1).map((id) => move(id)),
      hold(last, "after", "Add your lesson here", 3),
    ];
  }
  return [
    hold(anchor, "before", "Study the position", 3),
    ...valid.map((id) => move(id)),
    hold(last, "after", "Explain the continuation", 4),
  ];
}
