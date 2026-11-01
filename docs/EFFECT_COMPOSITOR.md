# Deterministic effect compositor migration

The new `src/render/effectCompositor.ts` defines ordered, time-addressable
render passes. It rejects duplicate IDs and invalid intervals, preserves
declaration order for equal priorities, and uses no wall-clock or previous-frame
state.

## Integrated now

`src/render/Scene.ts` dispatches the existing spotlight post-processing and
information overlay through the compositor, preserving their original drawing
implementations and the order **post → overlay**. Unit tests cover ordering,
time boundaries, and duplicate rejection.

## Remaining migration

The existing background, board, moving pieces, capture dust, lighting and
atmosphere are still drawn in the legacy scene pass. They are tightly coupled
to camera, scissor, particle and shader setup and must be extracted into
stage-specific methods before a complete compositor owns the full frame.
The new compositor is a foundation and partial integration, not yet a full
replacement of the old rendering architecture.

Before merging, run `npm test`, `npm run build`, and packaged desktop/export
smoke tests. Compare pixel output across landscape, Shorts cropped, vertical
and square-in-vertical, including seeks backwards and beat spotlight holds.
These checks have **not** been run by the assistant.
