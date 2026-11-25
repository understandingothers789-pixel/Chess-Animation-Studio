import { useEffect, useRef, useState } from "react";
import type { PlaybackMode } from "../core/project";

export function SettingsSearch({
  mode,
  focusRequest,
  navigate,
  revealInspector,
  selectIntro,
}: {
  mode: PlaybackMode;
  focusRequest: number;
  navigate: (category: string) => void;
  revealInspector: (tab?: string) => void;
  selectIntro: () => void;
}) {
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const choices = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focusRequest) input.current?.focus();
  }, [focusRequest]);
  const source = mode === "source";
  const settings = source
    ? ".library-content [aria-label], .inspector-content [aria-label]"
    : ".storyboard-workspace .library [aria-label], .shot-inspector [aria-label]";
  const selector = `${settings}, .composition-bar [aria-label]`;
  const search = query.trim().toLowerCase();
  const seen = new Set<string>();
  const results = search
    ? Array.from(document.querySelectorAll<HTMLElement>(selector))
        .flatMap((el) => {
          const label = el.getAttribute("aria-label") ?? "";
          if (
            !el.matches("input, select, textarea") ||
            label.endsWith(" value") ||
            !label.toLowerCase().includes(search) ||
            el === input.current
          )
            return [];
          const category =
            el.closest<HTMLElement>("[data-category]")?.dataset.category;
          const tab = el.closest<HTMLElement>("[data-inspector-tab]")?.dataset
            .inspectorTab;
          const inShot = !!el.closest(".shot-inspector");
          const inComposition = !!el.closest(".composition-bar");
          const location =
            category ??
            (inComposition
              ? "Above the preview"
              : tab
                ? `Move · ${tab}`
                : source
                  ? "Intro clip"
                  : inShot
                    ? "Shot settings"
                    : "Storyboard");
          const key = label + " / " + location;
          if (seen.has(key)) return [];
          seen.add(key);
          return [
            { el, label, category, tab, inShot, inComposition, location, key },
          ];
        })
        .slice(0, 24)
    : [];

  function reveal({
    el,
    category,
    tab,
    inShot,
    inComposition,
  }: (typeof results)[number]) {
    if (category) navigate(category);
    else if (tab || inShot) revealInspector(tab);
    else if (source && !inComposition) selectIntro();
    setQuery("");
    requestAnimationFrame(() => {
      if (!el.isConnected) return;
      for (let parent = el.parentElement; parent; parent = parent.parentElement)
        if (parent instanceof HTMLDetailsElement) parent.open = true;
      el.scrollIntoView({ block: "center", inline: "nearest" });
      el.focus({ preventScroll: true });
      el.classList.add("search-target");
      setTimeout(() => el.classList.remove("search-target"), 2000);
    });
  }

  return (
    <div
      className="settings-search"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setQuery("");
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setQuery("");
          input.current?.focus();
          return;
        }
        if (!["ArrowDown", "ArrowUp"].includes(e.key) || !results.length)
          return;
        const buttons = Array.from(
          choices.current?.querySelectorAll("button") ?? [],
        );
        const index = buttons.indexOf(
          document.activeElement as HTMLButtonElement,
        );
        const target =
          index < 0
            ? e.key === "ArrowDown"
              ? 0
              : buttons.length - 1
            : index + (e.key === "ArrowDown" ? 1 : -1);
        e.preventDefault();
        if (target < 0 || target >= buttons.length) input.current?.focus();
        else buttons[target].focus();
      }}
    >
      <input
        ref={input}
        aria-label="Search settings"
        title={
          source
            ? "Search composition and move settings"
            : "Search storyboard and selected shot settings"
        }
        aria-description="Find a control by name. Use the arrow keys to move through results and Enter to open one."
        placeholder={
          source ? "Search settings…" : "Search storyboard settings…"
        }
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && results[0]) {
            e.preventDefault();
            reveal(results[0]);
          }
        }}
      />
      {search && (
        <div
          ref={choices}
          className="search-results"
          aria-label="Settings results"
        >
          {results.length ? (
            results.map((result) => (
              <button
                type="button"
                key={result.key}
                onClick={() => reveal(result)}
              >
                <span>{result.label}</span>
                <small>{result.location}</small>
              </button>
            ))
          ) : (
            <p>
              No matching settings. Some controls appear after you turn on their
              effect.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
