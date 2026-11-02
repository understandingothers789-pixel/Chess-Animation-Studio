import { useState } from "react";
export function SettingsSearch({
  navigate,
  selectIntro,
}: {
  navigate: (category: string) => void;
  selectIntro: () => void;
}) {
  const [query, setQuery] = useState("");
  const controls = query.trim()
    ? Array.from(
        document.querySelectorAll<HTMLElement>(
          ".library-content [aria-label], .inspector-content [aria-label]",
        ),
      ).filter(
        (el) =>
          el.matches("input, select, textarea") &&
          !el.getAttribute("aria-label")?.endsWith(" value") &&
          el
            .getAttribute("aria-label")
            ?.toLowerCase()
            .includes(query.trim().toLowerCase()),
      )
    : [];
  const results = controls
    .filter(
      (el, i) =>
        controls.findIndex(
          (other) =>
            other.getAttribute("aria-label") ===
              el.getAttribute("aria-label") &&
            other.closest("[data-category], [data-inspector-tab]") ===
              el.closest("[data-category], [data-inspector-tab]"),
        ) === i,
    )
    .slice(0, 24);
  function reveal(el: HTMLElement) {
    const category =
      el.closest<HTMLElement>("[data-category]")?.dataset.category;
    const tab = el.closest<HTMLElement>("[data-inspector-tab]")?.dataset
      .inspectorTab;
    if (category) navigate(category);
    else if (tab) {
      document
        .querySelector<HTMLButtonElement>(
          `.inspector .tabs button[data-tab="${tab}"]`,
        )
        ?.click();
      document.querySelector<HTMLButtonElement>("[data-return-move]")?.click();
    } else selectIntro();
    setQuery("");
    requestAnimationFrame(() => {
      let parent = el.parentElement;
      while (parent) {
        if (parent instanceof HTMLDetailsElement) parent.open = true;
        parent = parent.parentElement;
      }
      el.scrollIntoView({ block: "center" });
      el.focus({ preventScroll: true });
      el.classList.add("search-target");
      setTimeout(() => el.classList.remove("search-target"), 2000);
    });
  }
  return (
    <div className="settings-search">
      <input
        aria-label="Search settings"
        title="Search all composition and move settings"
        aria-description="Type a setting name and choose a result to reveal its control."
        placeholder="Search settings…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setQuery("");
          if (e.key === "Enter" && results[0]) {
            e.preventDefault();
            reveal(results[0]);
          }
        }}
      />
      {query && (
        <div className="search-results" aria-label="Settings results">
          {results.length ? (
            results.map((el, i) => (
              <button key={i} onClick={() => reveal(el)}>
                <span>{el.getAttribute("aria-label")}</span>
                <small>
                  {el.closest<HTMLElement>("[data-category]")?.dataset
                    .category ??
                    (el.closest<HTMLElement>("[data-inspector-tab]")?.dataset
                      .inspectorTab
                      ? "Selected moves"
                      : "Intro clip")}
                </small>
              </button>
            ))
          ) : (
            <p>
              No matching settings. Some controls appear after enabling their
              effect.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
