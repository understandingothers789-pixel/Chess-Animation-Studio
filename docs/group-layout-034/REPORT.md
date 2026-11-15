# Chess Animation Studio 0.2.34 — group layout and editing performance

## Delivered

The two remaining recommendations from the project review are implemented: group selection/alignment/distribution, and measured reductions in annotation editing work. This version also includes the earlier local-caption, visibility and canvas-lock features.

Shift/Ctrl/Command-click visible local text in the preview or layer list to build a selection. Drag any selected text to move the group; arrow keys nudge it, Alt gives finer steps and Shift larger steps. Escape or an empty canvas click clears selection. Inspector settings edit the primary layer. Group width scaling is intentionally not offered; wrapping-width handles remain individual controls.

The preview toolbar aligns measured left/right/top/bottom edges or horizontal/vertical centers within the selection. Three or more layers can be distributed with equal visible gaps while retaining the outer bounds. These calculations use the renderer's actual layout rectangles and alignment anchors, not CSS font estimates. They work in normalized output coordinates through preview transforms.

Group movement uses one common delta constrained by every member's safe margins. During group selection, single-layer guide crosshairs and Alt-click placement cannot move only the primary member. Guide dragging also uses scoped annotation updates. Layout commands reject destinations outside a member's safe area or distribution with insufficient space. Hidden, locked, missing, inherited and currently invisible layers block the operation as a whole; they are not silently omitted. Selection is editor state scoped to the source/shot, not a second layer storage format. Gestures and layout commands use the established history transaction and restore the complete group in one Undo.

## Performance changes and measurements

Canvas annotation gestures and group actions now copy only the current annotation list. They borrow the unchanged game, audio, assets and unrelated shots from immutable project snapshots. Each history entry retains its own modified annotation list. Generic project edits still use the established full-project path; timing-lock and automatic preset rules remain there because annotation gestures cannot edit moves.

The benchmark uses a legal 400-move game, 100 shots and 20 target layers. For 100 edits, a standalone full-project clone/comparison baseline took **1,039.005 ms** and the annotation-only path took **13.140 ms** on this machine. The baseline omits the generic editor's per-move timing/preset work, so it is not a complete prior UI trace. These results measure snapshot preparation, not rendering FPS, end-to-end drag latency or a universal speedup. The benchmark script is reproducible with `node --import tsx scripts/annotation-benchmark.ts`.

The annotation renderer now reuses arrow/circle meshes when only text or timing/visibility changes. Geometry identity includes shape kind, source/destination squares and stroke width; changed or removed geometry is disposed. Color changes update the existing material. A browser resource test confirms that a text edit retains both shape meshes, a width change replaces only its arrow, the circle remains the same object and the old geometry is disposed exactly once. Shape ordering follows the current annotation order.

## Verification

- `STOCKFISH_PATH=/workspace/Chess-Animation-Studio/work/stockfish/usr/games/stockfish npm test`: **158 tests passed**, 29 files, no skips.
- `npm run build`: TypeScript, Vite and desktop build passed.
- `COMPOSITION_EVIDENCE_DIR=work/group-ui node --import tsx scripts/composition-ui-smoke.ts`: complete composition suite passed, including new selection, measured alignment, equal-gap distribution, shared dragging/nudging, single-step Undo, deselection, existing caption controls, ownership, persistence, transforms, fullscreen and UI scaling.
- `STORY_TEST_PORT=5196 node --import tsx scripts/storyboard-render-smoke.ts --composition`: six real decoded MP4 cases passed (landscape/vertical at 24/30/60 FPS), plus audio, project roundtrip and cancellation. Maximum decoded mean pixel error: **4.317037/255**. Sequential/direct and out-of-order RGB differences: **0**. Independent linear-light dissolve error: **0.125084/255**. Fade midpoint maximum RGB: **0**. Transition textures remain lazy and reused.
- `DISPLAY=:108 STOCKFISH_PATH=/workspace/Chess-Animation-Studio/work/stockfish/usr/games/stockfish npm run test:desktop`: passed native Electron save/reopen, preview, 24/30/60 FPS export, native 1080-square/vertical output, cancellation, presentation, context recovery and storyboard workflows.
- An additional source-mode browser smoke passed group alignment, common dragging and one-step Undo while preserving shot authoring and the source game.

The first browser run was interrupted by a development-server reload while source/version files were being changed. A complete rerun against frozen source passed; assertions were retained.

## Windows and Git

Core implementation: `a530a1b2eef3ae1f434bac80191c408d1a7c648b`. Final source/build commit: `7a42263f10a616c50086b6a585775ecc6cab692f` (also prevents single-layer guide/Alt-click controls from moving only part of a group). Work remains on `architecture/effect-compositor`. Version is 0.2.34; no public release, new development branch or PR is created. Both jobs in [workflow 43750586089](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/actions/runs/43750586089) passed: the Linux visual regression gate and Windows portable build/validation. Windows compilation, unit/service tests, runtime signature, packaged-app editing, native save/open, preview/rendering, MP4 export, context recovery and cancellation passed. Release publication was skipped.

**[Download Windows 0.2.34 (x64)](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/actions/runs/43750586089/artifacts/14176469371)** — GitHub sign-in required, approximately 186 MiB; artifact expires February 13, 2027. GitHub artifact SHA-256: `e11e44c5219473d2410f037b32dd2d1e340199e1fd8e6d402896fb177e4e9cda`. Artifact source matches final implementation `7a42263f10a616c50086b6a585775ecc6cab692f`. This is automated Windows runner validation, not a physical GPU benchmark on the owner's PC.

All four protected remote branch references matched their starting values. The README/report commit is a documentation-only descendant of the validated source; final local/remote equality is checked after pushing it. Both remaining recommendations are complete and the validated package includes all five improvements.


Reviewed application captures: [shot group alignment](group-align.png), [source group](source-group.png). Machine-readable [snapshot benchmark](benchmark.json).

`node --import tsx scripts/finishing-ui-smoke.ts` also passed caption presets, guide drag Undo/Redo, waveform, beat editing, fades, automation, persistence and responsive views.
