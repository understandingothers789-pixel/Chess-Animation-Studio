# Chess Animation Studio 0.2.33 — November 13, 2026 validation

## A. Changes delivered

The fetched development branch already contained the requested 0.2.33 composition editor and transitions. This session audited that implementation, reproduced and corrected text-area resizing, and repeated validation. It did not recreate the existing editor or transition system.

Text resizing now starts from the configured wrapping width instead of the width of the current words. A wide box containing short text therefore no longer collapses on its first pointer movement. The renderer exposes both visible glyph bounds and the wrapping area; the editor displays both and places its resize handle at the actual area edge. Width gestures honor alignment, animated entrance scale and safe-width limits. An alternate reachable edge is used when the preferred edge falls outside the output frame, and that edge stays fixed for the gesture. Font size and text scale remain independent.

Clicking empty preview space now clears the shot inspector instead of showing the first caption's controls. Enter/Space selects a focused text layer. The UI regression suite covers these interactions, live resizing, and single-step Undo/Redo; evidence output can be redirected without overwriting tracked screenshots.

## B. Git verification

Only `architecture/effect-compositor` was edited and pushed. Initial HEAD was `de62080c74acdf6eaa78da78557db9a661b99b9b`; the initial working tree was clean. Final commits and remote verification are recorded in the completion record below. No branch merge, force push, history reset, new development branch, PR creation or public release was performed.

Protected remote references are compared against their startup values:

| Branch | Initial SHA |
| --- | --- |
| studio-main | 9e2eccc56e228fee5b526c9fc097316400c2ab08 |
| main | e4ce9a7c61c250c6e1f84707d643da5942ea4cf7 |
| fresh-start | 5030ba80ff8444b312d775257319b594bf9b3fba |
| windows-download | 6c185b473c2f4d855eb42517d1f8367d4edc8319 |

## C–F. Text selection, manipulation, layers and rendering

Caption layout measures text with Canvas font metrics. `AnnotationSystem` provides its rendered bounds, entrance scale, alignment anchor and wrapping edges; `Scene.textGeometry()` normalizes them into output coordinates. The editor lives in the transformed output container and divides pointer deltas by its client rectangle, preserving zoom, pan and pixel-density mapping. Later rendered text receives overlapping hits first. Selection borders, width guides and handles are editor DOM elements and never enter the exported canvas.

Dragging retains existing safe-area/center snapping, Alt bypass, keyboard nudging and history transactions. Resizing changes wrapping width while preserving words and font settings. The layer list and inspector share annotation IDs, with source-owned annotations explicitly read-only in a shot. Source game annotations and move order remain unchanged by shot editing. Multi-layer selection here means selecting any of several layers individually; simultaneous group transforms are not implemented.

## G–I. Transitions and preview/export parity

Cut remains the default. Incoming cross-dissolve and fade-through-black consume the beginning of the destination shot without changing shot duration or soundtrack timing. The outgoing shot is frozen immediately before the boundary; the incoming shot advances normally. No chess pieces are interpolated between unrelated positions and consecutive transitions do not recurse.

One authoritative evaluator and `Scene.render()` serve preview, fullscreen, presentation, PNG and MP4. During transitions only, the existing render graph produces two complete frames through one WebGL renderer. Reused framebuffer textures are blended in linear light and encoded to sRGB once. Direct seeking requires no previous frame.

Fresh shared-compositor checks verified sequential/direct parity, lazy allocation and reuse of the same transition textures. They measured **0 differing RGB bytes** after out-of-order seeks, **0.1250836/255** mean error against an independent linear-light dissolve calculation, and **0 maximum RGB** at the fade-through-black midpoint.

## J. Audio

The six composition exports retained continuous AAC, unchanged cue mapping and per-shot music ducking. The dedicated ducking suite passed decoded envelopes at 24/30/60 FPS, seek, mute, independent repeated capture cues, persistence, inspector controls and waveform checks. Its measured gain error was **0.001003406**. Visual transitions do not introduce an audio crossfade.

## K. Visual review

Actual application screenshots were generated and inspected for selected layers, dragging, wrapping-width resizing, short text in a wide area, safe guides, transitions, vertical and landscape formats, square at 150% preview zoom, fullscreen, narrow windows and 150% UI scale. The new [wrapping-width guide](revalidation-width-guide.png) and [short text in a wide area](revalidation-short-text.png) accompany this report. Machine-readable [frame checks](frame-validation.json) and [export metrics](revalidation-export-metrics.json) retain the measured results. In narrow windows the fitted preview becomes small; fullscreen and existing panel toggles provide editing space.

## L. Exact validation commands

Final command outcomes appear in the completion record. Commands used:

```sh
ELECTRON_GET_USE_PROXY=1 npm ci
npm run build
STOCKFISH_PATH=/workspace/Chess-Animation-Studio/work/stockfish/usr/games/stockfish npm test
COMPOSITION_EVIDENCE_DIR=work/composition-audit node --import tsx scripts/composition-ui-smoke.ts
node --import tsx scripts/storyboard-render-smoke.ts --composition
npm run test:ducking
DISPLAY=:108 npm run test:desktop
npm run test:timeline
npm run test:ui
npm run test:creator
node --import tsx scripts/storyboard-ui-smoke.ts
```

Dependencies needed for local Stockfish and a virtual X server were extracted from official Debian packages under `work/`; no system packages or reusable environment configuration were changed. The GitHub connector was used for Actions status and artifact verification because direct CLI API access was blocked by the environment network policy.

## M. Encoded output

Six actual H.264/AAC files passed decoding at landscape/vertical × 24/30/60 FPS (160×90 and 90×160 test outputs). Native desktop checks additionally verified 1080×1080 and 1080×1920 exports at 60 FPS, and 640×360 exports at 24/30/60 FPS. Fixtures included a title, legal position hold, nonconsecutive move ranges, multiple captions, all three transition types, arrows/circles, continuous music and a ducked shot. Maximum decoded video mean absolute error was **4.317037/255**, below the established tolerance of 14. Project roundtrip, missing-asset rejection, late soundtrack silence, fades and cancellation cleanup also passed. Success was based on decoded frames/audio, not merely FFmpeg exit status.

## N. Performance

Fresh measured storyboard compilation was **7.064521 ms**; 10,000 cached calls took **0.767636 ms**. These are local software-rendering validation measurements, not hardware GPU performance claims. Ordinary cuts still render once; transitions reuse two capture textures. No new WebGL context was added by this work.

## O–P. Limitations and next improvements

Inherited source text remains read-only in a shot, with an explanation and an explicit source-editing route. Horizontal resizing controls wrapping width; free height resizing and simultaneous multi-selection are outside this version. Dashed wrapping guides may extend outside the output when an anchor is near an edge; an in-frame handle remains reachable. Physical Windows hardware/GPU validation is not inferred from automated runners.

Five valuable next improvements are group alignment/distribution, clone-source-text-to-shot, reusable multi-layer templates, transition thumbnails with explicit optional audio crossfades, and 1080p/4K physical GPU profiling.

## Q–R. Windows delivery and final status

The existing 0.2.33 Windows artifact was independently verified as unexpired and tied to successful packaged-app checks. A new Windows workflow was triggered by the source push. Its final result, validated source, download URL and artifact digest are recorded below; no release publication is authorized or requested.

## Completion record

Implementation and validation commits pushed during this session:

- `26a232a` — wrapping-area geometry, resize correction, empty selection and keyboard selection.
- `1058121` — safe-width limits and waiting for rendered geometry in UI tests.
- `3dd16c3` — reachable resize edges and alignment-aware anchor behavior.
- `b3235f0` — arrow/circle export fixture, sequential parity and texture reuse assertions.

Local final checks: 149 unit/service tests passed with no skips; TypeScript/Vite/desktop build passed; composition UI, creator UI, general UI, storyboard UI, timeline/menu suite (504 transformed board picks), decoded composition exports and ducking passed. The earlier menu viewport attempt timed out under concurrent software-rendering tests; the repeat passed without application or assertion changes. The first CI attempt (`43483711973`) exposed a test using stale handle geometry immediately after Redo. The render-settling fix is included in `1058121` and subsequent commits; the corrected suite passed locally.

The final local native Electron run also passed: save/reopen, direct text editing, transitions, exact-time H.264/AAC, native-sized vertical/square exports, presentation recovery and cancellation. All four protected remote references matched the startup values after source pushes.

Validated source/test HEAD: `b3235f085bf1eda4130c95343ed723e0d2ba5114`. The report/evidence commit is a documentation-only descendant; final local/remote equality is checked after that push.

**Windows status at handoff:** [latest workflow 43485614040](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/actions/runs/43485614040) is still running its Linux visual gate. The earlier corrected build at `1058121` passed that gate and reached packaged Windows testing. The latest Windows package is therefore **not yet verified**, and no new download URL is invented.

The previously validated [0.2.33 Windows artifact](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/actions/runs/42527895715/artifacts/13636552632) remains available (GitHub sign-in required). Its source is `6bea5e518ca65d2f7f91e78157bddefdb59f3d8c`, so it does **not** include this session's fixes. Artifact SHA-256: `62a180deabecb604f64649b8653a15db13878959924ad7c6eabbee7e794389ea`. Artifact existence, unexpired status and successful packaged Windows validation were independently rechecked through the GitHub connector.

**Final status:** P0/P1 functionality, the new resize fixes, production build, 149 tests, browser workflows, native Linux Electron, decoded MP4/audio, project persistence, screenshots and source pushes are complete. Fresh Windows validation/download delivery remains pending. No public release or stable-branch changes were performed.
