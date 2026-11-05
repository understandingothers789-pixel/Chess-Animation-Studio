# Chess Animation Studio 0.2.28 — Contextual editing report

## A. Executive summary

Timeline editing now separates movement, camera, effects and timing. Counted chess-aware bulk actions, a compact selection toolbar, preview-board commands, and direct inspector navigation reduce repeated panel navigation. The dark green theme is preserved.

## B. Correctness fixes

- `preserveLockedTiming` is the authoritative rule used by history and selective paste. Locked moves retain duration, delay, hold, landing timing, beat association, and spotlight settings that affect automatic hold. Resize handles and applicable inspector/menu controls show disabled states. Unlocking restores editing.
- Typed clipboard categories are movement, camera, effects, timing and everything. Merged effects are schema-validated. Lock state stays independent; unrelated categories are preserved.
- Annotation duplicates receive a unique ID, a bounded time offset, and an additional position offset for text/captions. Styling and chess-square anchors are preserved. The new object is selected and its editor opens.
- Double-click beat creation is restricted to the music lane using its screen bounds, including pointer-capture cases. Beat dragging and creation use the timeline snap increment; Alt bypasses it.
- Right-click selection preserves an existing group when the target belongs to it. Context selection and inspector navigation preserve the playhead. Ordinary left-click selection retains its seek behavior.
- Ctrl/Cmd+Shift+Z handles uppercase keyboard events correctly. Menu edits use one history transaction, including bulk changes.

## C. Context-menu architecture

`src/core/editing.ts` owns settings partitions, validation, lock preservation and chess grouping. Typed factories in `src/ui/commands/` build movement/camera/effect, annotation, music, header and background actions. `TimelineMenu` supplies checked/disabled states, grouping, icons, destructive styling, secondary panels, portal placement, scaling and keyboard behavior.

Shift+F10 or the Context Menu key opens a focused timeline object's menu. Up/Down/Home/End navigate; Enter activates; Right opens a secondary panel; Left or Back returns to its parent; Escape closes. Focus returns to the invoker, with a visible-track fallback when the invoker is hidden. Menus reposition within the window and also work inside fullscreen preview.

Move menus provide preview, inspector/preset navigation, mathematically consistent percentage speed changes, selective copy/paste, scoped application, timing lock, and movement reset. Camera and effect commands preserve unrelated settings. Track-header menus contain view/settings actions rather than clip mutations. Background menus provide fit, snapping, reset and track visibility.

## D. Smart bulk editing

Choose **Apply source settings to…**, choose a settings category, then a counted target group. Groups include the current move, selected moves, all moves, pawns, knights, bishops, rooks, queens, kings, captures, checks, checkmates, promotions and castling. Empty groups are disabled.

Groups come from replaying the legal game through chess.js, not SAN text heuristics. Timing-related operations preserve locked targets and report their count. A bulk operation creates one undo entry. Camera configuration targets the active output format; Everything explicitly copies all formats.

## E. Chessboard interactions

Right-click a preview square for an arrow-origin mode, square/circle highlight, text callout, FEN copy, or current-frame capture. These actions reuse the existing annotation and PNG infrastructure. Escape cancels arrow drawing. Board FEN reflects the last landed legal position during an in-flight animation.

Picking intersects the transformed geometric board plane. This corrects the mesh-picking miss found in a tilted black-orientation test. Projection/round-trip tests verify 504 in-frame square centers across both orientations, landscape/vertical formats, camera rotation/tilt, and CSS zoom/pan.

## F. Selection and navigation

The compact selection bar exposes the current selection count, preview, presets and editing/apply menus. Multi-selection scope remains visible in the inspector. Contextual navigation reveals hidden panels, activates the relevant tab, expands the requested section and scrolls to it. View preferences remain independent of project history.

## G. Reviewed screenshots

Actual browser captures were inspected for clipping, contrast, scope, menu length, alignment and scale. View commands were removed from clip menus after review. Secondary panels remain within the same bounded menu, rather than using hover flyouts.

| Example | Screenshot |
| --- | --- |
| Move menu | [Move](move-menu.png) |
| Speed and locked controls | [Speed](speed-menu.png) |
| Selective copy | [Copy](copy-menu.png) |
| Unavailable selective paste | [Paste](paste-menu.png) |
| Multi-selection and compact toolbar | [Selection](multi-selection.png) |
| Counted chess-aware targets | [Bulk targets](bulk-menu.png) |
| Camera | [Camera](camera-menu.png) |
| Effects | [Effects](effects-menu.png) |
| Annotation | [Annotation](annotation-menu.png) |
| Music track header | [Music](music-menu.png) |
| Beat marker | [Beat](beat-menu.png) |
| Preview square | [Board](board-menu.png) |
| Fullscreen preview menu | [Fullscreen](fullscreen-board-menu.png) |
| Window edge submenu | [Corner](corner-submenu.png) |
| Small window | [Narrow](small-window.png) |
| Track header at 150% | [1100px / 150%](view-1100-150.png) |
| Medium window at 150% | [1440px / 150%](view-1440-150.png) |
| Large window at 150% | [2560px / 150%](view-2560-150.png) |

## H. Tests

Baseline on 0.2.27: `npm test` (92 passed, one Stockfish-dependent skip), `npm run build`, and `npm run test:timeline` passed.

Finished local checks:

| Command | Result |
| --- | --- |
| `npm run build` | Passed |
| `npm test` | 98 passed, one Stockfish-dependent skip (99 total) |
| `npm run test:ui` | Passed |
| `npm run test:creator` | Passed |
| `npm run test:timeline` | Passed: locks, targeting, group preservation, selective paste, bulk undo, annotation edits, beat region restriction, keyboard/parent focus, fullscreen, board create/undo/redo, 504 square picks |

The timeline suite checks 1100×768, 1280×720, 1440×900, 1650×900, 1920×1080 and 2560×1440 at 100%, 110%, 125% and 150% scale. It also checks a smaller 1024×768 window. Browser startup/navigation waits were aligned with the slower software-rendered environment; functional assertions were retained.

CI render gate: **passed** on source `821d333`, including `npm run test:timeline`, `npm run test:render -- reference`, `npm run test:render -- final`, cinematic reference/candidate checks and `node scripts/compare-render-hashes.mjs`. [Visual evidence](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/actions/runs/41995926175/artifacts/13400043671).

Packaged Windows results: **passed**, including `npm run build`, `npm test`, `node scripts/portable.mjs`, the runtime-signature check, and `npm run test:desktop` against a freshly extracted portable ZIP in a path with spaces. Native checks cover packaged launch, editing, save/open, graphics recovery, presentation, export cancellation and H.264/AAC exports in landscape, vertical, square and square-in-vertical formats, plus captions at 24/30 FPS. [Windows validation evidence](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/actions/runs/41995926175/artifacts/13400553493). Local desktop validation requires a display server; native packaged validation was performed on the Windows runner.

## I. Git verification

- Starting HEAD: `570bbab5894723daadc54c40e63eac88612aedf2`.
- Finished executable source: `821d33382a3a163319bf1c8e4a48e9461e7db6f5`.
- Working branch: `architecture/effect-compositor`; no new development branch, merge, force-push or PR was created.
- Source commits: [f929d4f](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/commit/f929d4f), [1e0db05](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/commit/1e0db05), [47abb7b](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/commit/47abb7b), [34675a7](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/commit/34675a7), [4df23d2](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/commit/4df23d2).
- Validation refinements: [e694ff4](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/commit/e694ff4) exposes bounded failure diagnostics; [557d5e0](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/commit/557d5e0) synchronizes edge-menu checks and scopes slider keyboard input; [c986b80](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/commit/c986b80) guards stale command targets and waits for fullscreen geometry; [821d333](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/commit/821d333) reports preserved spotlight timing in visual bulk operations.
- Remote source HEAD was verified equal to the source commit above. The subsequent documentation/gallery/link commit and final remote HEAD are reported in chat.

Protected refs were verified unchanged against startup:

| Branch | SHA |
| --- | --- |
| `studio-main` | `9e2eccc56e228fee5b526c9fc097316400c2ab08` |
| `main` | `e4ce9a7c61c250c6e1f84707d643da5942ea4cf7` |
| `fresh-start` | `5030ba80ff8444b312d775257319b594bf9b3fba` |
| `windows-download` | `6c185b473c2f4d855eb42517d1f8367d4edc8319` |

## J. Windows download

**[Download 0.2.28 for Windows (x64)](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/actions/runs/41995926175/artifacts/13400663006).** The [complete workflow](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/actions/runs/41995926175) succeeded for source `821d33382a3a163319bf1c8e4a48e9461e7db6f5`. The versioned portable artifact is 159 MB. Its GitHub-reported artifact SHA-256 is `10c5c272ad617c33a66f7c6e1880888ea4df34d2ac58f75ef17a00e5cd3f1859`.

Extract all files and open **Chess Animation Studio.exe**. Workflow artifacts require signing in to GitHub and are retained for 90 days. The README follows the existing download-entry convention and preserves previous versions. No public release was published.

## K. Limitations and deliberate choices

- Secondary menus use in-place panels with Back/Left-arrow navigation rather than hover flyouts.
- The optional command palette is deferred.
- Camera configurations are per output format, while existing camera keyframe channels remain shared by the project model.
- FEN is a discrete legal position, not an interpolated mid-move arrangement.
- The local Stockfish-dependent test is skipped when that engine is unavailable; Windows CI provides the engine.

## L. Five follow-up recommendations

1. Searchable command palette using these command factories.
2. User-configurable keyboard bindings.
3. Named workspace and track-layout presets.
4. Pinned favorite commands in the selection bar.
5. Hover thumbnails and scrub previews for long games.
