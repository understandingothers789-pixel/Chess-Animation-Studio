# Project review — November 15, 2026

Chess Animation Studio is a local Electron application for turning legal chess games into edited, animated videos. The review covered the project schema and chess/storyboard mapping, editor state and composition controls, renderer and resource lifecycle, music timing, desktop file/export services, and existing validation scripts. It is an architecture and workflow review, not an exhaustive security audit or a physical GPU benchmark.

## Architecture and capabilities

| Area | Current implementation | Assessment |
| --- | --- | --- |
| Project model | `src/core/project.ts`, Zod schemas, stable annotation and shot IDs | Strong validation boundary. The schema is large and connects many features; changes need persistence checks. |
| Chess and timing | `chess.ts`, compiled source timeline, `storyboard.ts` | Source game order stays legal while storyboard shots can repeat or reorder moments. Separate source/output clocks are an important design strength. |
| Editing | React panels, resizable workspaces, contextual menus, `useProject()` history | Broad authoring capability. `App.tsx` carries substantial orchestration responsibility; extracting services gradually would make future changes easier to reason about. |
| Visual composition | Shared measured caption geometry, safe areas, wrapping, direct selection, drag and resize | Geometry is reused rather than estimated with CSS. Inherited ownership and managing temporarily unwanted or fixed layers were the clearest workflow gaps. |
| Storytelling | Move ranges, legal holds, titles, templates, transitions | Builds on source evaluation instead of manufacturing intermediate chess states. Incoming transitions preserve shot durations. |
| Rendering | Three.js `Scene`, dependency-ordered render graph and owned runtime resources | Preview, presentation and export use the same frame evaluation. Whole-frame transitions use reusable captures. Cost increases during dual-frame rendering; physical GPU performance remains a separate validation concern. |
| Audio | Shared output/source timing, waveform, beat markers, gain automation and per-shot ducking | Existing continuous soundtrack and cue mapping should remain authoritative. Avoid introducing another audio clock. |
| Export | `VideoJob`, deterministic frame requests, FFmpeg H.264/AAC, cancellation and temporary files | Encoded-output tests provide stronger evidence than process exit codes alone. Hardware/platform coverage still depends on the relevant runner or machine. |
| Desktop and storage | Role-checked IPC, validated project reads, atomic writes, relative asset references, collection, recovery | Useful separation between renderer UI and privileged desktop operations. Portable projects and crash recovery are established features worth preserving. |
| Analysis/import | PGN and audio workers, optional local Stockfish and remote opening statistics | Core editing remains useful without optional analysis services. Dependency availability needs explicit reporting in test results. |
| Validation/delivery | Vitest, browser workflows, deterministic frame checks, decoded video/audio, packaged Windows CI | Extensive coverage. Browser assertions must wait for rendered geometry after history/viewport changes. Existing downloads must identify the source they actually package. |

## Five improvements and implementation decisions

| # | Improvement | Benefit | Status |
| --- | --- | --- | --- |
| 1 | Localize inherited text in a selected shot | Reuse a source explanation without changing the game or displaying two copies | Implemented |
| 2 | Nondestructive layer visibility | Temporarily remove text from preview/export without deleting it or losing its opacity/style | Implemented |
| 3 | Canvas movement and resize locks | Keep established captions in place while selecting and editing other layers | Implemented |
| 4 | Group selection, alignment and distribution | Arrange several text layers consistently and move them with one history transaction | Implemented in 0.2.34; ownership-aware selection and measured geometry |
| 5 | Profile and reduce large-project edit work | Improve long-session responsiveness by measuring full-project cloning/serialization and annotation resource rebuilding | Implemented in 0.2.34; measured annotation snapshot optimization and shape-resource reuse |

The first three were implemented in the initial review. The subsequent 0.2.34 work completes the remaining two, with measured geometry, ownership-aware selection and an isolated annotation update path. See its linked report for validation and measurement limits.

## Delivered behavior

**Inherited text:** Shot settings now lists inherited source captions with a **Make local copy** action. The copy retains the storyboard's already mapped timing, fades, geometry and appearance. A provenance ID suppresses only the matching inherited rendering while the local copy exists. Other inherited annotations remain available. Editing or hiding a copy never changes source annotations. Deleting the copy restores inheritance. The operation uses the normal history transaction and survives save/reopen. It rejects missing sources and full annotation lists. The compiler cache is invalidated when the draft is localized so the newly committed projection is immediately correct.

**Visibility:** The selected text inspector has **Show in preview and export**. A persisted `hidden` flag controls the existing annotation-opacity evaluator, which is used by rendering and hit testing. Hiding does not overwrite opacity or remove content. Hidden text does not produce production warnings for an output in which it is absent. The layer remains listed and can be shown again.

**Canvas locks:** The selected text inspector has **Lock canvas movement and resizing**. Locked layers remain visible and selectable. Body dragging, resize handles, keyboard nudging, guide crosshairs and Alt-click placement cannot reposition them. Canvas context-menu position commands are disabled. Inspector controls remain editable; this is explicitly a canvas manipulation lock, not an immutable-project permission system. It does not alter exported pixels.

The existing annotation schema stores these flags and provenance. No second layer store, audio system or renderer was introduced. Optional schema fields preserve existing project reads.

## Validation

The completion record below lists commands and observed outcomes. New unit tests cover move-range and hold localization, mapped timing, independent source ownership, suppression/restoration, project roundtrip, missing sources, capacity limits, visibility and render-independent locks. The composition browser suite exercises localization and Undo, changed canvas pixels when hiding, preserved source data, locked drag/resize/keyboard behavior, and the established multi-caption and transition workflows.

## Limits

The subsequent [0.2.34 implementation](group-layout-034/REPORT.md) adds group transforms and measured editing/resource optimizations. A canvas lock intentionally permits deliberate inspector edits. Localization currently targets inherited text/captions; board arrows and circles keep their existing ownership workflow. New source code does not imply that an earlier Windows artifact contains these changes. Windows CI is triggered by the source push and must be assessed separately before calling a new package validated.

## Completion record

- `STOCKFISH_PATH=/workspace/Chess-Animation-Studio/work/stockfish/usr/games/stockfish npm test`: **153 passed, no skips**, across 28 files.
- `npm run build`: TypeScript, Vite and desktop build passed.
- `COMPOSITION_EVIDENCE_DIR=work/overview-ui node --import tsx scripts/composition-ui-smoke.ts`: passed the new workflows plus existing multi-layer editing, Undo/Redo, persistence, formats, fullscreen and 150% scale; zero page errors.
- `STORY_TEST_PORT=5196 node --import tsx scripts/storyboard-render-smoke.ts --composition`: six decoded H.264/AAC cases passed (landscape/vertical, 24/30/60 FPS); maximum mean pixel error **4.317037/255**. Sequential/direct and out-of-order RGB differences were zero; linear-light dissolve error was **0.125084/255** and fade midpoint maximum RGB was zero. Transition textures were allocated lazily and reused.
- Measured compilation: **8.289337 ms** cold and **0.697282 ms** for 10,000 cached calls. These are local checks, not a claim of improving runtime performance.
- Actual screenshots reviewed: [localized caption](project-review-2026-11-15/local-copy.png), [locked layer](project-review-2026-11-15/locked-layer.png).

The initial browser test tried a button inside a collapsed section and timed out. The test now opens the section as a user would; the complete rerun passed without weakening assertions.

Implementation commit: `c480100` on `architecture/effect-compositor`, starting from `955994d`. Documentation and tooltips follow in a separate commit. Only that development branch is pushed; protected branch references are checked after the final push. No release or PR was created. Subsequent 0.2.34 packaged Windows validation passed; its verified download and measurements are in the [group layout and performance report](group-layout-034/REPORT.md).
