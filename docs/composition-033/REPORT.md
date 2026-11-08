# 0.2.33 — Visual composition and storyboard transitions

## A. Executive summary

Direct text selection uses the actual renderer's visible geometry, including animated entrance scaling. Multiple text layers share the existing annotation model and one synchronized inspector. Dragging, width resizing, keyboard nudging, duplication and stacking use the established history system. Incoming cross-dissolve and fade-through-black transitions blend completed frames without changing the chess game, shot durations or soundtrack.

## B. Git verification

Initial development HEAD: `17cc0866ff426dce6ac4e6f88a8f74226ad13efa`. Branch: `architecture/effect-compositor`. Startup working tree was clean and remote HEAD matched. No branches, tags, releases, merges, resets or force pushes were created. Final source, remote verification and protected references are recorded below after validation.

## C–F. Visual selection, manipulation, layers and captions

`AnnotationSystem.bounds` exposes the same rectangles used for text rendering and hit testing. `Scene.textGeometry()` normalizes those bounds into output coordinates; `TextComposition` draws editor-only targets inside the same transformed preview container. Pointer deltas are divided by that container's transformed client rectangle, so zoom, pan, device pixel ratio and preview resizing use one coordinate mapping. DOM ordering follows renderer ordering; later text wins overlaps.

Click any visible text to select it. Drag its body to move it; drag its right-side handle to change wrapping width. Font size and scale remain independent. Alt bypasses snapping; arrows nudge by 0.5% of frame, Alt by 0.1%, Shift by 2%. Center and configured safe-area anchor snapping use a 1.2% tolerance. Each pointer gesture begins and ends one history transaction, including cancellation or lost capture.

The shot inspector lists all text layers and edits the selected annotation. Add text/caption, duplicate, delete and change stacking there. Common caption layout remains in `CaptionControls`; wrapping, readable auto-sizing, presets and overflow warnings retain the existing shared engine. Source and shot-local ownership remain separate. Clicking inherited source text or the outgoing image of a transition explains why it is read-only in the current shot; edit its owner or add local text.

Selection targets and handles exist only in the editor DOM. PNG, presentation and MP4 rendering do not receive those controls. Existing board picking, annotations, panning, fullscreen and context menus retain their paths. Text context menus reuse the existing framework and add horizontal centering and position reset.

## G–I. Transition architecture and parity

`transitionSchema` stores incoming type, duration and linear/smooth easing on each shot. Cut/zero duration is the default. The first shot has no incoming controls and ignores any transition retained after reordering. Duration must fit within the destination shot; shot resizing clamps it.

`transitionAt()` is the authoritative output-time calculation. A transition occupies the beginning of its destination shot without overlap subtraction. The outgoing shot is frozen at its final instant (`boundary − 0.0000001s`); the incoming shot advances normally. Consecutive transitions do not recursively blend earlier transitions. Positions are evaluated through the existing legal storyboard projection, never interpolated between unrelated boards.

`Scene.render()` invokes the existing full render graph twice only inside a transition. `TransitionSystem` copies the two completed default-framebuffer images to reusable framebuffer textures and composites one screen quad using the same WebGL renderer. This retains existing bloom/framebuffer assumptions. Captures are decoded from sRGB, blended in linear light, and encoded once. Cross-dissolve mixes both images; fade-through-black reaches black halfway through its interval. Targets resize/dispose with the scene. A direct seek needs no previous frame history.

All callers—preview, fullscreen, presentation, thumbnail, PNG and export—use `Scene.render()`. The inspector offers type/duration/easing and a bounded Preview transition action. Shot cards identify configured transitions.

## J. Audio correctness

Transitions do not modify the source/output clock mapping. Continuous music, offsets, beats, per-shot ducking and mapped chess cues retain their existing paths. Pure tests compare duck envelopes and audio events with/without visual transitions. Real export fixtures include a ducked shot and verify decoded AAC remains audible across cuts. The dedicated ducking suite separately measures its gain envelope and independent capture cues.

## K. Reviewed visual evidence

Actual application screenshots are stored here: selected layers, dragging, resizing, safe guides, narrow workspace, transition controls and midpoints, landscape, square at preview zoom, fullscreen and 150% UI scale. The two standalone midpoint PNGs come from the actual shared compositor, not mockups. Captures were reviewed for selection alignment, wrapping, readable controls and clipping. Physical Windows/GPU appearance is not inferred from Linux SwiftShader captures.

## L–N. Tests, encoded output and performance

Validation results and measured values are finalized below. `npm run test:composition` runs real UI interactions followed by shared-compositor → VideoJob → H.264/AAC checks, including decoded video comparison. Synthetic compositions use legal sample moves, a title, legal hold, reordered highlights, multiple captions, transitions, music and ducking. Export cases cover landscape/vertical and 24/30/60 FPS. Existing suites cover repeated shots, arrows/circles, other formats, cancellation and source correctness.

Independent midpoint analysis compares cross-dissolve pixels against an sRGB decode → linear blend → sRGB encode reference. Seeking out of order must produce identical uncompressed bytes. Fade midpoint must be black. Lossy decoded frames use the existing justified error tolerance. Resource allocation is lazy; no second WebGL context is introduced and ordinary cuts do not render twice. Measurements use software rendering and are not physical GPU performance claims.

## O. Known limitations

Text is selected one layer at a time; simultaneous group selection is not implemented. Resizing changes horizontal wrapping width, not a freely scalable graphic or box height. Inherited/outgoing text is read-only in the current shot and has no automatic clone command. No transition audio crossfade is applied; continuous music and ducking follow output time. The previous image intentionally holds its final state. Full-frame dual rendering costs more during transitions; very large outputs need two additional RGBA framebuffer copies. Social safe areas remain configurable approximations. Native hardware microphone/GPU testing is outside the automated checks.

## P. Five next improvements

1. Group text selection, alignment and distribution.
2. Explicit clone-to-shot action for inherited annotations.
3. Keyframed text transforms and reusable multi-layer templates.
4. Transition thumbnails and optional audio crossfades with explicit policies.
5. Physical GPU performance profiling at 1080p/4K across supported systems.

## Q–R. Windows download and final status

The previously validated 0.2.32 artifact was rechecked and its missing README entry restored. The 0.2.33 download will be advertised only after the existing workflow and expanded packaged validation pass. Final validation results follow in the completion record.

## Completion record

Baseline: `npm test` passed 138 tests in 25 files. Updated unit suite: 146 tests in 27 files, no skips. Focused transition/ducking unit run: 9 passed. Production build and TypeScript compilation passed. Three additional geometry tests verify that center and safe-edge snapping use the visible box for left-, center- and right-aligned text.

| Command | Result |
| --- | --- |
| `npm test` | 146 passed |
| `npm run build` | TypeScript, Vite and desktop build passed |
| `node --import tsx scripts/storyboard-ui-smoke.ts` | Passed; captions, timing, save/reopen, templates, source preservation, no page errors |
| `npm run test:ui` | Passed |
| `npm run test:creator` | Passed |
| `npm run test:timeline` | Passed, including 504 transformed board-square picks |
| `npm run test:ducking` | Passed; 24/30/60 FPS decoded envelopes, seek, mute, independent repeated capture cues, persistence and inspector |
| `DISPLAY=:108 npm run test:desktop` | Passed on Linux Electron/SwiftShader; includes new direct text editing and persisted transitions, native export and cancellation |
| `node --import tsx scripts/storyboard-render-smoke.ts --composition` | Passed: six real MP4 cases, decoded frames/audio, project roundtrip, missing-reference rejection and cancellation cleanup |

Measured transition evidence: [frame validation](frame-validation.json), [encoded-output metrics](export-metrics.json). Uncompressed out-of-order seek difference: **0 bytes**. Independent linear-light dissolve mean error: **0.1251/255**. Fade midpoint maximum RGB: **0**. Maximum decoded H.264 mean absolute error: **4.3171/255**, below the existing tolerance of 14. Cold storyboard compilation: **33.22 ms**; 10,000 cached calls: **2.58 ms**. These local timings include contention from parallel validation and are not hardware GPU benchmarks. The finishing UI measured 1,000 caption layouts at **323.30 ms**, and 10,000 cached lookups at **37.60 ms**. Ducking gain error remained **0.0010034**.

Reviewed evidence: [selected layers](selected-layers.png), [dragging](dragging.png), [resizing and wrapping](resizing.png), [safe guides](safe-guides.png), [narrow workspace](narrow.png), [cross-dissolve with inspector/timeline](transition-dissolve.png), [fade-through-black](transition-black.png), [landscape](landscape.png), [150% scale](scale150.png), [rendered dissolve midpoint](dissolve-midpoint.png), [rendered black midpoint](fade-midpoint.png).

Validation follow-ups: the original CI run stopped during Playwright dependency installation on `ubuntu-latest`, before application checks. The runner is pinned to Ubuntu 24.04; the next run passed browser/dependency installation. New test-harness issues with an opening title's missing source, hidden duplicate format controls, and a malformed range value were corrected without weakening assertions. A TypeScript narrowing issue in failure-screenshot diagnostics was also corrected. The final completion record distinguishes CI results from local results.

`npm run test:finishing` passed all 16 encoded cases. Maximum decoded pixel error was **6.9057/255**. Rhythmic volume-automation RMS error was **0.0015738**; a 10-second source trim with a 2-second output offset measured **0.0004733** RMS error. Seek, source-frequency identification, mute and beat-aligned cuts passed.

The composition UI suite additionally passed topmost overlapping-layer selection, proof that editor handles do not alter canvas pixels, square framing at 150% preview zoom, fullscreen selection and 150% UI scaling. See [zoomed square](zoom-square.png) and [fullscreen](fullscreen.png).
