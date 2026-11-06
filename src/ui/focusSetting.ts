/** Reveal a contextual setting without seeking or changing its value. */
export function focusSetting(
  root: Element | null,
  section?: string,
  label?: string,
) {
  if (!root) return;
  const details = section
    ? Array.from(
        root.querySelectorAll<HTMLDetailsElement>("details.section"),
      ).find((d) => d.querySelector("summary > span")?.textContent === section)
    : null;
  if (details) details.open = true;
  const scope = details ?? root;
  const inputs = Array.from(
    scope.querySelectorAll<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >("input:not(:disabled),select:not(:disabled),textarea:not(:disabled)"),
  );
  const target =
    (label
      ? inputs.find((e) => e.getAttribute("aria-label") === label)
      : undefined) ?? inputs.find((e) => e.getClientRects().length > 0);
  if (!target) {
    details?.scrollIntoView({ block: "nearest" });
    return;
  }
  for (
    let parent = target.parentElement;
    parent && root.contains(parent);
    parent = parent.parentElement
  )
    if (parent instanceof HTMLDetailsElement) parent.open = true;
  document
    .querySelectorAll("[data-context-target]")
    .forEach((e) => e.removeAttribute("data-context-target"));
  target.setAttribute("data-context-target", "true");
  (
    target.closest(".range-field,.select-field,.toggle-field") ?? target
  ).scrollIntoView({ block: "nearest" });
  target.focus({ preventScroll: true });
  if (
    target instanceof HTMLInputElement &&
    ["text", "number"].includes(target.type)
  )
    target.select();
}
