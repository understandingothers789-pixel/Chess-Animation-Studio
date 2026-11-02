# Architecture hardening Phase II

## A. Repository state

Started on `architecture/effect-compositor` at `9b141b07c54c9e5aa8e132390a43ce63011b4220`. Fetch confirmed the clean branch matched origin, with no intervening source commits since the reviewed reference. The 0.2.17 tag was fetched for historical reference. No reset/merge/force push or protected branch change was performed. Version remains 0.2.17; no published binary is overwritten and no release is created. Final commit identities and remote verification are in the execution response.

## B. Findings

| Finding | Disposition |
| --- | --- |
| Persistent data crossing projects | Confirmed API risk, no built-in production passes currently use typed graph resources. Added explicit project-scoped values while retaining graph-wide reuse. |
| Ambiguous cleanup failure after commit | Confirmed. Defined commit-before-cleanup semantics and diagnostics; no impossible GPU rollback is promised. |
| Double disposal of aliased owned objects | Confirmed extension risk. Added identity-based guards, same-token reuse and at-most-once attempted release tracking. Wrapper aliases remain a caller responsibility. |
| Preview stuck after load failure | Confirmed. Bounded retry/backoff, final failure/manual Retry, deduplication, and retry cancellation implemented. |
| Old texture release throws after assignment | Confirmed inconsistent rejected promise/ready state. Successful assignment now resolves; cleanup diagnostics are separate and observable. |
| State reset overhead | Investigated and intentionally unchanged; measurements below do not justify removing protection. |
| Context loss | Confirmed missing app guard. Scene now rejects unsafe drawing/readback and preview offers fresh graphics construction. |
| Startup/worker identity safety | Prior fixes largely sound; sender identity is validated against the current worker before IPC dispatch. Retained those guards. Added generation-filtered progress and a cancellation check after acknowledged frame writes. |
| Cancellation during final rename | Confirmed irreversible race. Explicit commit boundary waits for rename outcome instead of reporting successful rollback. |
| Commit-name public release trigger | Confirmed. Removed it; publication requires successful explicitly opted-in workflow dispatch. |
| Version discrepancy | Already fixed at starting HEAD. VERSION imports package metadata, unit and desktop assertions remain; historical binary is untouched. |

## C. Architectural changes

- `RuntimeResources.ts`: frame/project/graph lifetimes; scope transitions; explicit invalidation; ownership checks; released-object protection; clear cleanup-failure state.
- `RenderGraph.ts` / `Scene.ts`: project identity passed through every draw; resource invalidation API; graphics loss guards before cache use and readback; disposal removes event listeners.
- `Assets.ts`: two-phase assignment/old cleanup semantics, observable cleanup errors, optional bounded retries and backoff cancellation. Preview/presentation opt into two retries; export still requires current-URL readiness.
- `Preview.tsx`: final-failure Retry images and Reload graphics actions; scene recreation preserves editor-owned state. Readiness callbacks cannot update an abandoned generation.
- `desktop/export.ts`: checks cancellation after acknowledged writes; final rename is an explicit non-reversible commit boundary. Failed finalization preserves the prior destination and cleans temporary files.
- `desktop/main.ts`: current-export generation gates progress, supplementing existing worker sender and active-job guards.
- `windows.yml`: only explicit opted-in manual dispatch publishes, after all build/package/desktop checks and artifact upload. Versions must be numeric x.y.z, release notes must exist, and an existing version tag is rejected visibly. Existing checksums, runtime pins and Windows smoke tests remain.

The [engine guide](EFFECT_COMPOSITOR.md) documents implemented APIs and ownership obligations. No cinematic effects, UI redesign, new project schema, encoder changes or separate export rendering path were introduced.

## D. Tests

Required baseline commands passed: `npm ci`, `npm run build`, `npm test` (61 tests), and `npm run test:render -- phase2-baseline` (216 requests/168 fixtures).

Final commands and retained outputs:

- `npm run build`: passed, TypeScript/Vite/Electron bundles.
- `npm test`: passed, **71 tests in nine files**.
- `npm run test:render -- final`: passed, 216 requests/168 fixtures, independent renderer/RGBA parity, same-frame effects, renderer-state recovery, project/asset invalidation, shared leases, and actual `WEBGL_lose_context` simulation.
- `DISPLAY=:99 STOCKFISH_PATH=/workspace/tools/usr/games/stockfish npm run test:desktop`: passed, editing/save/open, version assertions, all four exact-time MP4 formats, cancellation, dust/lighting/spotlight replay, presentation.
- `/workspace/chess-shorts-analyzer/.venv/bin/python scripts/compare-render-fixtures.py test-results/render-phase2-baseline test-results/render-final`: passed; Pillow is supplied by that existing Python environment.
- `node --import tsx scripts/timeline-benchmark.ts`: completed; raw measurements retained.
- YAML BaseLoader parsing/manual-condition assertion and `git diff --check`: passed.

New coverage includes A→B→A project transitions with inactive producers, reusable graph values, same-time/backward reads, invalidation, throwing obsolete cleanup with subsequent recovery, same-object replacement/double ownership, bounded retry success/exhaustion/manual retry, obsolete timer cancellation, replacement disposal errors, delayed acknowledged writes after cancellation, final-rename cancellation, destination preservation and strict manual publication.

Two initial asset tests assumed an obsolete request would always enter the loader. The new implementation skips requests superseded before their first microtask. Tests now explicitly start the first loader before replacing/removing it, preserving the actual in-flight race assertions; the corrected suite passes without unhandled rejections.

Environment: Linux x64, Node 24.19.0, Electron 39.8.10, Chromium SwiftShader, Xvfb :99, local FFmpeg/ffprobe and Stockfish. No native Windows or physical GPU run is claimed. Source pushes may trigger Windows build validation, never public publication.

## E. Visual compatibility

All 168 distinct Phase II fixtures are byte-identical to the starting 0.2.17 source baseline, with no tolerated deviations. Repeated timestamps and independent renderer images/readbacks remain exact. Coverage includes captures, castling, promotion, en passant, backgrounds, titles, snow/trails/spotlight and all four formats. Simulated context loss is isolated from fixture production; later new renderer instances still render correctly.

## F. Measurements

Five alternating trials after warmup, median milliseconds for 3,000 evaluations:

| Plies | Uncached | Compiled |
| --- | ---: | ---: |
| 4 | 19.73 | 19.78 |
| 60 | 30.21 | 16.68 |
| 300 | 103.86 | 29.14 |

These reproduce the retained compiled-timeline benefit for longer games, not a new Phase II optimization. Short-game differences are noise. Overlay rendering was unchanged; no new overlay-performance claim is made.

A 270×480 SwiftShader sequence issued 60 frame requests (59 actual resets because one frame was cached). Instrumentation recorded 0.8 ms inside resetState and 108 ms for the sequence's JavaScript/render submission work. No GPU fences were used; this is not GPU completion time, export throughput or a physical-device result. resetState remains intact. Existing warmed resource-count stability and repeated scene ownership tests remain active; process heap and native driver memory were not profiled.

## G. Remaining risks, ordered

1. Real GPU driver/Electron graphics-process recovery is unverified. The supported app recovery action reconstructs Scene after context loss; context creation can still fail and require retry. Partially throwing core-system constructors have not been comprehensively fault-injected.
2. Physical ownership hidden behind wrappers cannot be proven. Borrowers must respect owner lifetime; registry safeguards cover direct object identity. A throwing GPU release is marked attempted and never retried automatically because its actual side effects are unknowable.
3. Cancellation cannot reverse the final atomic rename once initiated. A late cancellation waits and may return after successful completion; earlier accepted cancellations cannot report Complete. Native crash IPC and every OS-level interleaving are not exhaustively injected.
4. Immutable project identity remains the validity/cache contract. Automatic image retry is intentionally finite; arbitrary loader events cannot reliably distinguish every permanent file/blob failure, so final manual retry remains necessary.
5. Benchmark conclusions are limited to Linux/SwiftShader. No large GPU performance changes were made, and no full-resolution hardware export-throughput claim is offered.

## H. Cinematic readiness

World/post/overlay boundaries, typed resource declarations, project validity and explicit ownership provide a foundation for selective glow, improved captures, advanced lighting, layered atmosphere and screen compositing. Bloom needs deliberate render-target ownership, resizing and device tests. GPU particles need deterministic seeded absolute-time evaluation and buffer lifecycle tests. Motion blur needs explicit subframe sampling/history validity across seeks and project changes; project-scoped resources help but do not implement temporal sampling. These effects were not added in this phase.
