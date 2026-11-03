# Redesign validation

Implementation head: `596ddfeefbb04b3e00e570075eb2e60b05980a2b`; final documentation commit follows it.

Source baseline: `ead2febb2599fcd6e2fc62ac0b5bdbeed15bd4b7`, fetched from `architecture/effect-compositor` before editing. All changes were made on that branch. The original loaded `work` branch and `studio-main` were not edited.

## Environment

Linux, Node 24.19.0, Chromium 154.0.8037.57 / SwiftShader, Electron 39.8.10. Dependencies were installed from the lockfile using the session proxy. Electron installation used `ELECTRON_GET_USE_PROXY=1`, with writable caches under `/tmp`. FFmpeg is `/usr/bin/ffmpeg`. Stockfish and Xvfb were extracted into `/tmp/chess-tools`; no host package installation or application version change was needed.

## Results

| Check | Command | Result |
| --- | --- | --- |
| Production build | `npm run build` | Pass: TypeScript, Vite and Electron compilation. |
| Unit/services | `STOCKFISH_PATH=/tmp/chess-tools/usr/games/stockfish npm test` | Pass: **83 tests in 13 files**, no skips. Includes the original 80 tests and three audition-window tests. |
| UI | `npm run test:ui` | Pass: nine tiles/3×3 geometry; project and setting preservation; mixed values and actual selection counts; batch editing and Ctrl-unchecking the active move; effect status; tab persistence; preview restores both paused and playing states; search opens/focuses real controls; keyboard navigation; intro shortcut; 1100×768 layout and timeline header bounds. |
| Fetched-baseline rendering | `npm run test:render -- before` in a temporary archive of the starting commit | Pass: **216 requests, 168 unique fixtures**, lifecycle/context recovery, independent-renderer/readback parity and bloom checks. All 168 hashes exactly match `docs/render-phase3/fixture-hashes.json`. |
| Candidate rendering | `RENDER_PORT=5178 npm run test:render -- after` | Pass: **216 requests, 168 unique fixtures**; all 168 exactly match the fetched baseline and preserved Phase III hashes. Bloom example PNG is byte-identical. |
| Cinematic goldens | `node --import tsx scripts/cinematic-visual.ts` | Pass: **40/40 committed cinematic/bloom golden hashes unchanged**, all four formats, resize/backward-seek and independent export equality. Normal comparison mode; no golden updates. |
| Native desktop | `STOCKFISH_PATH=/tmp/chess-tools/usr/games/stockfish DISPLAY=:100 npm run test:desktop` | Pass: Linux Electron editing/tooltips; intro and multi-selection; undo/reset; artwork and backward seeks; native save/open; bloom H.264/AAC at 60 FPS; native vertical/square/square-in-vertical exports; cancellation cleanup; move-light/spotlight/dust reconstruction; clean presentation and exact-pixel context-loss recovery. No renderer errors. |
| Repository hygiene | `git diff --check` | Pass. No renderer, core model/schema, export service, golden reference or version changes. |

Reference and candidate fixture servers use different ports, so each browser reads the intended source tree. The final candidate is compared both to the fetched baseline and to the preserved historical hash manifest. Desktop readback checks wait for animation frames; action timeouts allow software WebGL startup rather than assuming native GPU speed.

## Screenshot review

Reviewed the nine-category contact sheet, individual Board/Effects views, selected capture inspector, intro and 1100×768 view. Fixed inherited CSS that put tile icons beside labels, status chips that squeezed section titles, and timeline controls wrapping into tracks at narrow widths. The final UI regression includes a timeline-header bounds assertion.

Exact zero-tolerance pixel-comparison counts are recorded in `pixel-comparison.json`.

Images live beside this file; `README.md` links every category and shows the before/after pair. Category captures use default sample settings. Inspector/narrow captures show deliberately edited board colors and a selected capture from the workflow test.

## Remaining limits

- Search covers controls currently mounted by their existing conditional UI. Effect-dependent controls become searchable when their conditional controls are available. Search never enables effects or changes project settings implicitly.
- The existing minimum application width is 1100 pixels. The inspected narrower view is 1100×768.
- Native tests here run Linux Electron with software WebGL. A physical Windows/GPU run was not available in this workspace.

This branch is packaged as version 0.2.21. The Windows validation workflow uploads an Actions artifact; release publication remains disabled.
