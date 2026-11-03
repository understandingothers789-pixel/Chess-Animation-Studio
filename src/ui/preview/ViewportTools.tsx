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
  set,
  fit,
  png,
  full,
}: {
  view: Viewport;
  set: (p: Partial<Viewport>) => void;
  fit: () => void;
  png: () => void;
  full: () => void;
}) {
  return (
    <div className="viewport-tools" aria-label="Preview tools">
      <button onClick={fit}>Fit</button>
      <label>
        Zoom{" "}
        <input
          aria-label="Preview zoom" title="Magnify the editor viewport. This does not change the animation camera or export." aria-description="Magnify the editor viewport. This does not change the animation camera or export."
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
      {[0.5, 1, 2].map((z) => (
        <button key={z} onClick={() => set({ zoom: z })}>
          {z * 100}%
        </button>
      ))}
      <button aria-pressed={view.pan} onClick={() => set({ pan: !view.pan })}>
        Pan
      </button>
      <select
        aria-label="Preview guides" title="Show editor-only framing guides; guides are excluded from exports." aria-description="Show editor-only framing guides; guides are excluded from exports."
        value={view.guides}
        onChange={(e) => set({ guides: e.target.value })}
      >
        {["none", "center", "thirds", "safe", "shorts"].map((g) => (
          <option key={g} value={g}>
            {g === "none" ? "No guides" : g + " guides"}
          </option>
        ))}
      </select>
      <button onClick={full}>Full preview</button>
      <button onClick={png}>Save PNG</button>
    </div>
  );
}
