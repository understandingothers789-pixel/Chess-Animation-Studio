# Chess Animation Studio 0.2.31 — finishing engineering report

## A. Executive summary

This release adds measured automatic caption wrapping, configurable safe areas, five typography presets, editor guides and direct caption placement. The storyboard now offers a time-scaled waveform with music offset, source trims, fades, gain automation, output beat editing and shot-end synchronization. Production checks distinguish errors from warnings and locate affected shots.

The established storyboard, render graph and audio engines are retained. Optional transitions and per-shot music routing are deferred.

**All required local suites and the final Windows workflow passed.** The validated portable artifact is linked in section Q and the README. A public GitHub release was not published.

## B. Git verification

Starting branch: `architecture/effect-compositor`; starting HEAD: `d2d8352acd687159e36ede78c277aa90ca2f5323`. Startup fetch completed and the working tree was clean.

Protected starting references:

| Branch | SHA |
|---|---|
| studio-main | 9e2eccc56e228fee5b526c9fc097316400c2ab08 |
| main | e4ce9a7c61c250c6e1f84707d643da5942ea4cf7 |
| fresh-start | 5030ba80ff8444b312d775257319b594bf9b3fba |
| windows-download | 6c185b473c2f4d855eb42517d1f8367d4edc8319 |

Final application source: [`4e45bbb05d201bf0a7e78215b8f47b37ee958065`](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/commit/4e45bbb05d201bf0a7e78215b8f47b37ee958065). Local and remote implementation HEAD were verified equal after push. Documentation completion follows validation without changing application source.

Incremental commits: [83cad18](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/commit/83cad18dca0c19e7f5e261ddaf2705cf701bb4db) (layout), [d5b8881](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/commit/d5b8881b8011e1bdfa52f950c9556c19f531c6f9) (caption controls), [597910b](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/commit/597910be45c6ddbef3c136bf117c932112dab099) (waveform/checks), [c5e73ff](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/commit/c5e73ff20f609c0ffa556af184090c94d628ab7b) (shared controls/guides), [4a8d368](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/commit/4a8d368721cc9b84af051ddc13bedcbc85cce266) (SVG/save fixes), [ce6c5c7](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/commit/ce6c5c7091c8090cb2bae23fb0f70347a24cf10d) (release tests), [4e45bbb](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/commit/4e45bbb05d201bf0a7e78215b8f47b37ee958065) (decoded automation parity).

Implementation commits are incremental on the required branch. No public release is authorized. All four protected references were rechecked after implementation and remained identical to the starting SHAs. The final documentation push is verified separately from the immutable validated application commit.

## C. Caption architecture

`src/core/captions/layout.ts` separates layout from drawing. It accepts a measurement callback, making the layout independently testable while the real renderer supplies Canvas `measureText` with the actual font, size and weight.

Wrapping preserves explicit paragraphs, measures words, and splits oversized tokens with `Intl.Segmenter` grapheme boundaries. It retains all text. It reduces size only to the configured minimum; remaining maximum-line, width or height violations set an explicit overflow flag. No ellipsis or silent truncation is applied.

The result contains lines, font size, line height, actual padded bounds, safe rectangle and draw anchors. A caller-owned cache retains up to 256 layout results and keys all geometry inputs. Color and opacity changes reuse geometry. Annotation fields are schema validated and persist through the existing project serializer.

## D. Safe areas

All four actual formats are supported, including the vertical format's separate Shorts camera mode. Presets are Standard, Lower third, Upper caption, Centered title and Social-safe. Custom top/bottom/left/right margins and maximum width use frame fractions. Font sizes use reference pixels on the 1080px short side, preserving readability when aspect ratio changes.

The social preset reserves additional top, bottom and right space. It is an **approximation**, configurable by the creator, and is not a guarantee about any platform or device interface. Safe areas constrain screen-space caption blocks and do not move the board camera. They do not guarantee that a caption avoids every chess piece; placement remains adjustable.

## E. Rendering integration

`AnnotationSystem` calls the shared layout for the existing overlay pass. Source, storyboard, presentation, PNG, thumbnails and MP4 all use this renderer. Board arrows/circles retain their existing coordinates. Text hit bounds use the same block geometry, including entrance scaling.

The existing texture disposal/reallocation on resolution changes remains intact. Geometry caching does not introduce a second renderer or raster cache. Animated fades still redraw the overlay. Guides and the placement crosshair live only in the editor DOM; output renderers do not read them.

## F. Waveform system

`StoryboardWaveform` reuses the soundtrack's existing worker-generated, normalized RMS envelope. It does not display decorative random bars. `waveformBins` aggregates the existing envelope for the visible source interval without decoding audio again. React memoization reuses bins when gain or beats change.

Waveform, shot cells, ruler, playhead, output beats and gain curve share one output-time scale and scroll container. Zoom starts fitted to the viewport. Source timestamps use `musicAt`, including trim start and output offset. Rendering uses one SVG path, not one DOM element per audio sample. Beat/shot handles are filtered to the viewport; the 30,000px canvas width is bounded.

The retained envelope has at most 1,600 bins. Consequently long songs have a coarse visual waveform; precise edits use timestamps and beat analysis rather than assuming sample-level waveform detail.

## G. Audio editing

The green music region moves the output offset. Edge handles trim the source interval. Gold handles edit fade durations. Numeric controls remain in Soundtrack & output beats. Invalid source trims are clamped during editing and rejected by production checks when received as project data.

Storyboard editing pauses playback to keep structural timing edits precise; resume to audition changes. Full-game preview retains its existing smoothed master-gain updates. Live rescheduling of a playing storyboard during structural audio edits is not added.

Volume points have output timestamps and gain values from 0 to 2. Points can be added, dragged, numerically adjusted, deleted or reset. The gold curve shows effective gain, including automation, fades and mute, rather than simply drawing an unrelated decorative curve. Duplicate timestamps deterministically use the latest point in both preview and export.

Output beats can be added, dragged, nudged, deleted, disabled and accented. Numeric timing remains available. Snapping uses enabled beats and shot boundaries, with Alt bypass. Previous/next beat navigation does not enter project history. Align shot end resizes the selected shot to the nearest valid enabled beat, respecting duration constraints.

Music entirely outside output is reported as a warning. Muted, unused music settings do not block export.

Source detected beats remain distinct from manually edited storyboard output beats. The existing explicit detected-beat copy operation remains available.

## H. Audio/export parity

The waveform and output scheduling use shared music source mapping and endpoint calculations. The FFmpeg automation/fade expression moved into `src/core/audio/timing.ts`; preview and export use the same normalized automation points. Web Audio continues to use scheduled fade gain nodes and the existing smoothed automation updates.

An additional decoded-audio test exposed coarse FFmpeg gain evaluation: WAV decoder blocks produced updates about 85ms apart. The exporter now splits automation input into 256-sample blocks (about 5.3ms at 48kHz), without padding the final block. It also disables automatic gain amplification on the existing final peak limiter. This preserves unity gain below the limiter threshold; strongly overloaded output mixes are still limited deliberately.

The reference comparison's maximum absolute RMS deviation improved from 0.0257 to 0.0016. A separate generated source changes from 220Hz to 660Hz at ten seconds: decoded output confirms that a ten-second trim selects the 660Hz section, starts after a two-second delay, follows automation/fades, matches a seeked excerpt, and becomes silent when muted. See [audio validation](audio-validation.json) and the reproducible [audio check](audio-check.mjs).

Continuous music remains on output time through reordered/nonconsecutive shots. Existing mapped chess cues and their cut-boundary clipping are retained. This release does not add time stretching or a second audio mixer.

## I. Storyboard usability

The music editor expands from a clearly labeled summary next to the output sequence. It stays collapsed initially to preserve shot-card and preview space. Expanded content scrolls within the timeline, and shot cards retain a minimum usable height. Precise caption controls are shared by the shot inspector and annotation editor, with advanced controls in expandable sections.

Caption presets retain text and timing. Their browser shows a typography/placement sample before Apply. Caption guide controls are in the preview toolbar. The crosshair supports direct dragging, snapping and keyboard positioning. Continuous drags use the existing history transaction API for one Undo entry.

## J. Production checks

`productionChecks` validates output range/dimensions/FPS, storyboard references, caption timing/geometry, soundtrack presence/trim and output beat bounds. Layout and readability issues are warnings; they do not disable export. Structural output and required audio errors prevent export. Shot warnings offer Open shot.

`requiredAssetIds` scopes dependency checks to output audio, the selected format's background and custom badge mappings. Unreferenced library assets do not block export. Badge mappings remain conservative even when a mapped badge is not visible in the selected shots. All required filesystem reads still pass the existing path authorization and file validation; only required image assets are sent to the export worker.

## K. Visual evidence

Screenshots are actual running Chromium captures, not mockups. All 19 views were reviewed in contact sheets, with full-size inspection of caption, waveform, production-check, narrow and 150% views. Review found and corrected a guide button covering the video and source-timeline CSS moving SVG beat handles off-screen. The responsive gallery was refreshed at a nonzero caption timestamp so a legitimate fade-at-zero frame would not hide the caption in the evidence.

Narrow layouts retain scrolling controls and a rendered preview. Full preview and panel toggles remain available when editing a vertical composition in a small window. At 150% the labels wrap and the timeline scrolls instead of overlapping the preview.

- [short caption](01-short-caption.png)
- [wrapped vertical](02-wrapped-vertical.png)
- [landscape](03-landscape.png)
- [square](04-square.png)
- [guides enabled](05-guides-enabled.png)
- [guides disabled](06-guides-disabled.png)
- [caption inspector](07-caption-inspector.png)
- [preset browser](08-preset-browser.png)
- [waveform](09-waveform.png)
- [beat edit](10-beat-edit.png)
- [trim fades](11-trim-fades.png)
- [automation](12-automation.png)
- [storyboard](13-storyboard.png)
- [production checks](14-production-checks.png)
- [export dialog](15-export-dialog.png)
- [narrow](16-narrow.png)
- [desktop](17-desktop.png)
- [square in vertical](18-square-in-vertical.png)
- [scale150](19-scale150.png)

## L. Automated testing

Baseline: `npm test` passed 124 tests; `npm run build` passed.

Current focused suite: `npm test` passed 134 tests, including caption geometry, Unicode/manual breaks, all format sizes/alignments, waveform aggregation, generated beat timing, gain mapping, production severities and asset dependencies.

Existing storyboard UI and 12 H.264/AAC format/FPS cases passed. Timeline interactions passed with 504 transformed board-square picks. `npm run test:creator` passed saved layouts, presets, editing scopes, curve/clip Undo, caption/export controls and 900–1920px layouts. `npm run test:ui` passed all nine settings tiles, scope, navigation, search and preview restoration checks. `npm run test:render -- final` passed **216 render requests / 168 unique fixtures**, including context reconstruction and 1080p/4K SwiftShader measurements. The complete native Electron desktop suite passed again after the final audio fix: launch, vectors, hover panels, controls, relative-asset save/reopen, 60 FPS H.264/AAC, 24/30 FPS captions, native-size formats, cancellation, deterministic lighting/spotlight/dust seeking, presentation/context recovery, storyboard caption/waveform/beat presence, save/reopen and export. `npm run test:finishing` passed again on final application source, including the additional decoded RMS/frequency/seek/mute tests. The final GitHub visual gate passed, including reference hashes and cinematic goldens. Windows build, unit/service tests, portable packaging, runtime signature check, actual packaged application/export validation and artifact upload all passed. The public-release step was skipped.

The local command comparing reference hashes reported ENOENT because no local reference checkout had been generated. It is not counted as a passing local comparison. The final CI visual gate regenerated the prescribed reference worktrees and passed the reference hash and cinematic comparisons.



Initial test corrections: a silence assertion originally ignored a 12ms analysis window straddling the signal boundary; it now checks a genuinely silent interval and separately tests exact peak-bin aggregation. UI automation selectors were corrected to the actual Output format control. Beat handles at the output origin exposed unscoped `.beat` CSS; namespaced waveform classes and pointer/focus selection corrected it. The persistence test exposed Ctrl+S being ignored in focused inputs; Save now works there and captures the exact snapshot being written. The decoded automation check initially failed and led to the actual FFmpeg scheduling fix described above. No test was disabled or assertion weakened to conceal these failures.

Exact successful local commands:

| Command | Result |
|---|---|
| `npm test` | 134 passed, 24 files, no skips |
| `npm run build` | TypeScript, Vite and desktop bundles passed |
| `npm run test:timeline` | 504 square picks plus editing/menu/keyboard checks passed |
| `npm run test:storyboard` | Existing UI and 12 actual encoded format/FPS cases passed |
| `npm run test:finishing` | Finishing UI, 16 actual MP4 cases and decoded audio parity passed |
| `npm run test:creator` | Creator layouts, scopes, presets, Undo, export and scale checks passed |
| `npm run test:ui` | Settings/navigation/preview regression passed |
| `npm run test:render -- final` | 216 requests, 168 unique fixtures passed |
| `DISPLAY=:107 npm run test:desktop` | Final-source native Electron suite passed |
| `npm run benchmark:storyboard` | 200 shots: cold 80.93ms; 10,000 resolves 12.09ms; edit compile 2.13ms |
| `node --import tsx scripts/finishing-benchmark.ts` | Measured waveform results linked below |
| `node docs/finishing-031/gallery.mjs` | Nonzero-time responsive gallery refreshed |

Raw evidence: [unit log](unit-tests.txt), [finishing log](finishing-tests.txt), [native log](native-linux.txt), [render regression log](render-regression.txt).

## M. Export validation

The real compositor/VideoJob test renders each frame, encodes H.264/AAC, decodes output, compares RGB with the uncompressed reference, and checks frame count, dimensions, FPS and continuous audio at cuts. The first 12-case pass had maximum mean absolute RGB error **7.2372/255**, below the existing 14/255 tolerance. The expanded finishing pass includes 16 actual MP4s: 12 format/FPS combinations plus a legal Fool’s Mate puzzle with thinking hold/reveal/arrow, repeated highlights, caption stress and rhythmic automation. Its pre-final-audio pass had maximum RGB error **6.9057/255**. The final-source rerun passed all 16 cases with the same maximum RGB error, **6.9057/255**. Test videos are deliberately short and small for exhaustive decoding; native checks additionally exercise full output dimensions.

At 24 FPS, a 1.2-second request produces `ceil(1.2 × 24) = 29` frames (1.2083 seconds); this is the justified rounding to a whole frame. At 30 and 60 FPS the fixture is exactly 1.2 seconds.

Audio tests decode fade envelopes, compare seeked excerpts with full-output audio, verify delayed-track silence and reject a missing required soundtrack. Texture resizing compares a reused compositor with a fresh one. Cancellation and temporary cleanup use the existing real export test paths.

Self-contained projects and representative MP4s (very short computational fixtures, not editorially paced examples):

| Scenario | Project | Actual MP4 |
|---|---|---|
| Legal puzzle/hold/reveal | [Project](fixtures/puzzle-challenge.castudio) | [MP4](fixtures/puzzle-challenge.mp4) |
| Repeated highlights | [Project](fixtures/repeated-highlights.castudio) | [MP4](fixtures/repeated-highlights.mp4) |
| Caption stress | [Project](fixtures/caption-stress.castudio) | [MP4](fixtures/caption-stress.mp4) |
| Rhythmic automation | [Project](fixtures/audio-synchronization.castudio) | [MP4](fixtures/audio-synchronization.mp4) |
| Format comparison | [Project](fixtures/format-comparison.castudio) | [MP4](fixtures/format-comparison.mp4) |

The generated audio is included beside the projects, using relative asset paths. [The longer UI composition](synthetic.castudio) uses the included generated rhythmic soundtrack. All are test fixtures; caption-stress intentionally produces an overflow warning.

## N. Performance

Ten-minute generated audio, 8kHz, 19,200,000 input bytes: analysis **38.62ms**; retained envelope **12,800 bytes**; 1,000 viewport aggregations **104.36ms** total; process RSS **117,366,784 bytes**, including Node and input storage. These are observed CPU timings, not physical GPU playback benchmarks. Reproduce with `node --import tsx scripts/finishing-benchmark.ts`.

The browser measured 1,000 uncached caption layouts in 216.7–379.4ms and 10,000 cached queries in 9.4–31.8ms across local runs. These are totals under varying software-renderer load, not a cross-machine benchmark. The latest exact values are in [performance.json](performance.json). Envelope bytes count numeric payload rather than total JavaScript allocator overhead.

Caption measured-layout/cache timings are generated by the browser interaction suite. No physical GPU, driver or microphone performance claim is made.

## O. Known limitations

Optional composited transitions, per-shot soundtrack policies, automation copy/paste and source sample-level waveform zoom are deferred. Social safe areas are approximations. The guide targets the current shot's first screen-space text annotation. Safe placement does not automatically detect piece occlusion. Custom badge asset dependencies are conservative. System fonts can have different glyph metrics between operating systems; each machine's preview/export uses one shared layout engine.

## P. Five future recommendations

1. A multiresolution peak pyramid for sample-level zoom on long songs.
2. Explicit per-shot music ducking using the existing output clock.
3. Caption selection and area-resize handles for multiple simultaneous text blocks.
4. Optional embedded, licensed fonts for consistent cross-machine typography.
5. Whole-frame cut/fade/dissolve transitions with matching output-time tests.

## Q. Windows download

**[Download 0.2.31 for Windows (x64)](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/actions/runs/42408035807/artifacts/13588214583)** — 173 MB. Requires GitHub sign-in; retained 90 days.

- [Successful workflow](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/actions/runs/42408035807)
- Validated application source: `4e45bbb05d201bf0a7e78215b8f47b37ee958065`
- GitHub artifact SHA-256: `a30b2463ef23d555b9dc1cc87f09661548c585762f0497169ab750607b03b4f3`
- Artifact name: `Chess-Animation-Studio-0.2.31-Windows-Portable`
- [Fresh metadata verification](ci-validation.json)

Both the visual and Windows packaged jobs succeeded. Windows extracted the portable ZIP into a path containing spaces and exercised the actual application. Artifact identity/version/digest were verified from fresh successful run metadata; no anonymous binary download is claimed. The packaged build source is the application commit above; subsequent documentation commits do not change that binary. The README preserves every earlier download and uses its existing bold versioned-link convention. No tag or public release was created.

## R. Final status

**Fully implemented and verified:** shared measured caption layout, configurable safe areas, typography presets, editor-only guides and positioning, persistence/Undo, real waveform rendering, offset/trim/fade editing, volume automation, output beat editing and shot-end synchronization, production checks, dependency scoping, continuous music and shared compositor output. All 134 local unit tests, relevant UI/render/native suites, 16 decoded MP4 cases, additional decoded audio checks, final CI reference comparisons and packaged Windows checks passed.

**Implemented with practical limits:** the existing 1,600-bin envelope is coarse on long audio; storyboard edits pause playback; preset browsing previews typography/placement without temporarily rendering a whole new scene; custom badge dependencies are conservative. These limits are described above.

**Deferred optional work:** transitions, per-shot music routing, automation copy/paste and sample-level waveform zoom. None is advertised as complete.

**Unverified outside automated infrastructure:** physical GPU/driver performance, every system-font combination, and platform-specific social overlay positions. Guides are configurable approximations.

**Blocked:** none. Changes are confined to `architecture/effect-compositor`; protected branch SHAs remain unchanged. The final documentation HEAD is reported with the completion message after push verification.
