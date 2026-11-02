# Rendering architecture hardening — implementation report

For subsequent resource validity, retry, context-loss and publication changes, see [Phase II validation](RENDER_PHASE2_VALIDATION.md).

## A. Repository state

Repository: `understandingothers789-pixel/Chess-Animation-Studio`.
Target: `architecture/effect-compositor`.
Starting HEAD: `2b624989c60d95a035ccc3ecf0d2b01a0f3bc623`.
The working tree was clean, `git fetch origin` completed before edits, and the remote branch matched the starting HEAD. No reset, merge, branch replacement or force push was used. Application version remains **0.2.16**; the already published binary is not replaced by these source changes.

Protected starting heads:

- `studio-main`: `9e2eccc56e228fee5b526c9fc097316400c2ab08`
- `main`: `e4ce9a7c61c250c6e1f84707d643da5942ea4cf7`
- `fresh-start`: `5030ba80ff8444b312d775257319b594bf9b3fba`

Final commit/push identity and protected-head verification are reported after the documentation commit in the execution response. The workflow in this push explicitly disables automatic public release publication.

## B. Architectural diagnosis

| Concern | Finding and disposition |
| --- | --- |
| Late world extensions | Confirmed: same-stage priority/declaration order could place appended board extensions after `world`. Fixed with a reserved world draw stage. |
| Named resources only order nodes | Confirmed intentional legacy behavior. Preserved it and added separate typed runtime resources with availability and lifetime checks. |
| Initialization cleanup throws | Confirmed: rollback stopped on first disposer error. Fixed exhaustive reverse cleanup with original cause and additional errors. |
| Scene/graph double cleanup | Confirmed overlapping rollback paths. Once-only core callbacks now prevent duplicate release, and Scene cleanup attempts all owners. |
| Resize failures | Width/height were already committed only after all hooks, but reverting after partial resize could skip repair. Fixed by invalidating dimensions before attempting hooks. |
| Renderer state | Viewport/scissor/root visibility already had partial restoration. Expanded restoration to target/face/mip, clear state and color/tone settings; reset Three.js cached depth/stencil state. Readback restores its temporary target change. |
| Failed asset retry | Confirmed in preview and presentation URL bookkeeping. Scene now owns explicit request states; hosts reconcile selections against those states. Superseded completions cannot commit. |
| Paused extension state | Confirmed: project identity alone missed external settings. Added explicit invalidation and retained the unchanged-frame optimization. |
| Duplicate timeline work | Confirmed: multiple segment arrays and a separate motion prefix sum. Frozen timing metadata now reused per immutable render project. |
| Overlay uploads | Confirmed while title pixels were already settled. Cache the actual title phase/alpha; retain full-resolution rasterization for genuinely changing pixels. |
| Shared artwork | Existing leases correctly share immutable resources between live scenes. Found a preparation continuation that could request more artwork after the last lease was released; it now stops immediately on disposal. Rejected promises are evicted for later retry. |
| Export reliability | Existing acknowledged RGBA writes and temporary final video were sound. Added startup-failure cleanup, stale-job guards, unexpected worker termination failure and startup-listener cleanup. |
| Release reporting | Confirmed publication errors were tolerated silently. Explicit manual publication only, visible failure, diagnostic summary, validated artifacts uploaded first. |

## C. Implemented changes

`effectCompositor.ts`, `engine/RenderGraph.ts` and `engine/RuntimeResources.ts` compile the pipeline once: **background → board → world → post → overlay**. Scene reserves `world`; ordinary world extensions use `board`. Explicit dependencies beat priority only within legal stage boundaries. Stable equal-priority ordering and legacy inactive ordering semantics remain intact.

Typed resource tokens distinguish required, optional and borrowed fallback values. Default frame values cannot leak into another timestamp. Explicit graph-lifetime tokens retain successful values across inactive frames; failed-frame replacements roll back. Reads/writes require declarations. Owned values carry release callbacks; every cleanup is attempted even after errors. No actual GPU resource ownership is implied by legacy string inputs such as `scene-color`.

`engine/Assets.ts` owns asynchronous textures. Same-URL concurrent/successful loads deduplicate; failed loads retry on the next explicit reconciliation. Failed replacement preserves the old valid texture. Removal, replacement and disposal invalidate outdated requests and release late values. `prepareAssets` is authoritative for export readiness. Preview and presentation do not interpret a requested URL as readiness.

`Scene.invalidate()` and the factory service invalidate external extension settings without disabling paused caching. Cache entries are written only after successful draws. Invalidations raised during a frame remain pending for the next draw. Renderer restoration and default-framebuffer readback support failure recovery. Core and asset disposal continue even if another cleanup fails.

`compileTimeline` uses WeakMap project identities and frozen timing arrays. Render-frame evaluation, capture contact effects and motion highlights reuse the timing. Mutable authoring tools retain uncached `segments()`/ordinary `evaluate()` behavior. No schema migration, animation seed, chess reconstruction, UI layout or separate export renderer was introduced.

`desktop/main.ts` keeps late startup/finish work tied to the original job. Cancellation clears references before destroying workers, and old failures cannot clean a newer job. Startup cancellation/failure cleans directories created across asynchronous waits. The native write acknowledgment, frame index checks, FFmpeg settings and final complete-video rename remain intact.

See [actual API examples and ownership contracts](EFFECT_COMPOSITOR.md) for world and screen effects, resource use, asset retries and invalidation. The TypeScript examples were compiled against the implementation.

## D. Tests and validation

Environment: Linux x64, host reports AMD EPYC 9V74 and five logical CPUs; Node **24.19.0**, Electron **39.8.10**, system Chromium/SwiftShader, Xvfb `:99`, FFmpeg/ffprobe, local Stockfish. Native Windows and a physical GPU are unavailable on this host.

| Command/check | Outcome |
| --- | --- |
| `git fetch origin` | Passed; clean target branch matched remote before changes. |
| `npm ci` | Passed with pinned lockfile; no dependency/version changes. |
| Baseline `npm run build` / `npm test` | Passed; 41 tests. |
| `npm run test:render -- hardening-baseline` | Passed; 216 requests, 168 distinct fixtures. |
| Final `npm run build` | Passed; TypeScript, Vite and Electron bundles. |
| Final `npm test` | Passed; **60 tests in eight files**, including real FFmpeg/Stockfish service checks. |
| `npm run test:render -- final` | Passed; 216 requests/168 fixtures, extension visuals, renderer recovery, assets/cache/readback and lifecycle checks. |
| `DISPLAY=:99 STOCKFISH_PATH=/workspace/tools/usr/games/stockfish npm run test:desktop` | Passed; editing, tooltips, save/open, exact-time H.264/AAC, all four formats, cancellation, light/spotlight/dust replay and presentation. |
| `.../.venv/bin/python scripts/compare-render-fixtures.py test-results/render-hardening-baseline test-results/render-final` | Passed; 168 byte-exact matches, zero tolerated differences. Python environment supplies Pillow only. |
| `node --import tsx scripts/timeline-benchmark.ts` | Completed; [measurements](render-hardening/timeline-benchmark.json). |
| `node --import tsx scripts/overlay-benchmark.ts` | Completed; [measurements](render-hardening/overlay-benchmark.json). Temporary baseline source removed in `finally`. |
| `npx tsc --noEmit` with extracted documentation examples | Passed; temporary example modules removed. |
| Workflow YAML + publication-condition inspection | Passed; manual input defaults false, no publication `continue-on-error`, original pins/checksum/smoke checks retained. |
| `git diff --check` | Passed. |
| Native Windows workflow/public release | Not run manually; source push may trigger build validation. No public release authorized or published by this task. |

An initial ordinary-sandbox service run failed with `spawnSync ffmpeg EPERM`; rerunning the suite in the supported execution context passed. Loopback browser and desktop checks also require that context. No assertions were relaxed to accommodate the sandbox.

New graph tests cover phase boundaries, priority/dependencies, missing/optional/fallback/persistent data, duplicate producers, cycles, missing production, undeclared access, rollback cleanup errors, disposal and resize failure/recovery. Asset tests use injected deferred loaders: success, retries, failed replacement, duplicate requests, stale failures, out-of-order success, removal/disposal, and failed/changed export preparation. Timeline tests compare cached/uncached evaluation for captures, castling, en passant and 300-ply games; promotion remains covered by browser fixtures.

The real WebGL hardening helper starts a hidden red object and makes it visible in a board extension, proving first-frame visibility. It changes the same paused frame through explicit invalidation, checks identical-input reuse, project/asset invalidation, injected post failure recovery, target/readback restoration, and repeated paired renderer creation/disposal. It also abandons a renderer during preparation and continues with later renderers. Existing regression checks enforce independent renderer/RGBA parity, deterministic seeking and stable warmed GPU resource counts.

Export service regressions preserve an existing destination after asset/renderer failure or missing encoder; verify no Complete progress; check temporary directories are removed; and cancel during asynchronous startup. Existing desktop tests cover actual MP4 formats and cancellation. Native worker-crash and every OS-level timing interleaving are not exhaustively fault-injected.

Retained evidence: [unit output](render-hardening/unit-validation.txt), [desktop output](render-hardening/desktop-validation.txt), [browser output](render-hardening/browser-validation.txt), [pixel comparison](render-hardening/pixel-comparison.json).

## E. Visual compatibility

All **168** unique fixtures match the pre-hardening 0.2.16 renderer **byte for byte**. This improves no historical comparison against the earlier monolith; its original eight tolerated differences remain a separate historical result. This task adds no tolerated deviations. Repeated timestamps and independent renderers still require exact equality.

Coverage includes image backgrounds, titles/evaluation overlays, atmosphere, trails, spotlight, sample game, captures, castling, en passant, promotion and all four formats. The same-frame extension test intentionally changes pixels only in its isolated assertion; production regression fixtures retain their original appearance.

## F. Performance

Five alternating timing trials after warmup; median for 3,000 evaluations using one reconstructed chess game and identical seek sequence:

| Game | Uncached evaluation | Compiled metadata |
| --- | ---: | ---: |
| 4 plies | 20.08 ms | 18.86 ms |
| 60 plies | 37.77 ms | 13.89 ms |
| 300 plies | 117.55 ms | 20.79 ms |

This measures timeline evaluation, not full frame rendering or export throughput. The original evaluation computes segments twice; the compiled path reuses its segment array and also removes the separate motion prefix sum. Exact heap-allocation counts and process-memory changes were not profiled. Capture event scans remain linear.

At 1920×1080, 40 title/evaluation-overlay frames over a four-second intro generated **40 → 18** CanvasTexture update requests. Wall time in this single software-renderer sample was **60.6 → 24.8 ms**, without GPU fences. The trustworthy structural result is fewer repaint/upload requests; it is not a physical-GPU speedup or full-export benchmark. Truly animated frames still upload the full-resolution canvas.

## G. Remaining risks and limits

1. Native Windows/AMD/physical-GPU performance and fault behavior require the native workflow and device testing. No physical GPU/OBS/Resolve claim is made.
2. Runtime resource ownership is explicit: pass-owned values must be borrowed or have exactly one transfer callback. Registry typing cannot prevent an extension from transferring the same underlying GPU object twice. External WebGL and arbitrary scene mutations remain extension responsibilities.
3. Render project revisions must be immutable. Mutating a retained project in place violates the Scene and compiled timeline cache contract. Asset retries occur on explicit reconciliation; physical network cancellation and automatic timed retry/backoff are not implemented.
4. Export cancellation/startup and stale-handler guards have focused tests, but native renderer crash IPC and every final-rename timing interleaving are not exhaustively injected. The output rename occurs only after a fully encoded/mixed video exists; it is not a reversible partial-output operation.
5. Full-resolution title textures remain during changing animation; capture scans and several existing per-frame visual allocations remain. No render-target pool, quality tiers, bloom or GPU particles were added without profiling evidence.

## H. Commits

- `2c2c5c1` — legal draw phases, typed runtime resources, graph failure handling and regressions.
- `9e74222` — scene lifecycle/state recovery, asset races/retries, explicit invalidation and browser/asset tests.
- `1993c1c` — compiled timeline, stable title repaint cache and reproducible benchmark evidence.
- `b87823b` — native export startup/cancellation/termination isolation and failure tests.
- Final CI/documentation commit — explicit publication opt-in, visible publishing failures, architectural guide and this evidence report. Its SHA is reported after commit.

## I. Next steps

1. Run native Windows GPU fixtures and inject worker crashes during preparation, acknowledged writes and finalization.
2. Profile real 1080p/4K exports before splitting the remaining animated title texture or changing particle evaluation.
3. Introduce effect parameter revisions or immutable effect inputs for a larger extension ecosystem, retaining explicit invalidation for external assets.
4. Add cinematic effects through the documented board/post phases and typed resources; keep all visual motion absolute-time based.
5. If profiling supports it, compile capture-event indices and pool owned post targets with tests for failure and device/context loss.
