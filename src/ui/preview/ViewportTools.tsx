export type Viewport = {
  zoom: number;
  pan: boolean;
  guides: string;
  offset: { x: number; y: number };
};
export const initialViewport: Viewport = {
  zoom: 1,
  pan: false,
  guides: "none",
  offset: { x: 0, y: 0 },
};
export function ViewportTools({
  view,
  captionGuides,
  onCaptionGuides,
  set,
  fit,
  png,
  full,
  fullscreen = false,
  playing = false,
  toggle,
}: {
  captionGuides?: boolean;
  onCaptionGuides?: () => void;
  view: Viewport;
  set: (p: Partial<Viewport>) => void;
  fit: () => void;
  png: () => void;
  full: () => void;
  fullscreen?: boolean;
  playing?: boolean;
  toggle?: () => void;
}) {
  return (
    <div className="viewport-tools" aria-label="Preview tools">
      {onCaptionGuides && (
        <button aria-pressed={captionGuides} onClick={onCaptionGuides}>
          Caption guides
        </button>
      )}
      <div
        className="viewport-group"
        role="group"
        aria-label="Preview magnification"
      >
        <button
          title="Fit the entire composition to the available viewport (F)"
          onClick={fit}
        >
          Fit
        </button>
        <label>
          <span className="sr-only">Zoom</span>
          <input
            aria-label="Preview zoom"
            title="Editor magnification relative to Fit; exported camera framing is unchanged."
            aria-description="Editor magnification relative to Fit; exported camera framing is unchanged."
            type="number"
            min={25}
            max={400}
            step={25}
            value={Math.round(view.zoom * 100)}
            onChange={(e) =>
              set({ zoom: Math.max(0.25, Math.min(4, +e.target.value / 100)) })
            }
          />
          %
        </label>
        <select
          aria-label="Zoom preset"
          title="Choose editor magnification relative to Fit"
          aria-description="Choose editor magnification relative to Fit"
          value={[0.5, 1, 2].includes(view.zoom) ? view.zoom : ""}
          onChange={(e) => set({ zoom: +e.target.value })}
        >
          <option value="" disabled>
            Custom
          </option>
          {[0.5, 1, 2].map((z) => (
            <option key={z} value={z}>
              {z * 100}%
            </option>
          ))}
        </select>
      </div>
      <div
        className="viewport-group"
        role="group"
        aria-label="Preview navigation"
      >
        <button
          title="Drag to pan the editor viewport; middle-mouse dragging also pans"
          aria-pressed={view.pan}
          onClick={() => set({ pan: !view.pan })}
        >
          Pan
        </button>
        <button
          title="Reset editor zoom and pan while keeping guides"
          onClick={fit}
        >
          Reset view
        </button>
      </div>
      <select
        aria-label="Preview guides"
        title="Editor-only framing guides; excluded from exported images and videos"
        aria-description="Editor-only framing guides; excluded from exported images and videos"
        value={view.guides}
        onChange={(e) => set({ guides: e.target.value })}
      >
        {["none", "center", "thirds", "safe", "shorts"].map((g) => (
          <option key={g} value={g}>
            {g === "none" ? "No guides" : g + " guides"}
          </option>
        ))}
      </select>
      <div
        className="viewport-group viewport-output"
        role="group"
        aria-label="Preview output"
      >
        <button
          title="Enlarge the preview to fullscreen; Esc returns to the editor"
          onClick={full}
        >
          {fullscreen ? "Exit full preview" : "Full preview"}
        </button>
        <button
          title="Save the current composition frame at its full output resolution"
          onClick={png}
        >
          Save PNG
        </button>
        {fullscreen && (
          <button
            onClick={toggle}
            aria-label={playing ? "Pause preview" : "Play preview"}
          >
            {playing ? "Pause" : "Play"}
          </button>
        )}
      </div>
      <output className="viewport-status">
        {view.zoom === 1 ? "Fit" : `${Math.round(view.zoom * 100)}%`}
        {view.offset.x || view.offset.y ? " · panned" : ""}
        {view.guides !== "none" ? " · guides" : ""}
      </output>
    </div>
  );
}
