# Creator workspace engineering report

Repository: understandingothers789-pixel/Chess-Animation-Studio. Development branch: `architecture/effect-compositor`.

Initial HEAD: `8c4d6b67c9d48c9e9b1093b8406ebfd9dc2de21d`. Initial protected `studio-main`: `9e2eccc56e228fee5b526c9fc097316400c2ab08`. Final references and validation results are recorded below after execution.

## Implemented behavior

The workspace has three independent splitters: settings width, inspector width, and timeline height. Pointer capture isolates dragging; arrow keys adjust a focused splitter by ten pixels. Panel bounds are constrained. Settings, inspector, and timeline visibility are independent. Editing, Preview, Effects, and Timeline presets apply useful layouts. Dimensions, visibility, compact navigation, scale, active category, and active preset persist in application-local preferences rather than project data. UI scales are 100, 110, 125, and 150 percent.

Preview magnification supports fit, percentage buttons, custom 25–400% values, Ctrl-wheel zoom, middle-button drag, and explicit pan mode. These transform the editor viewport; they never edit project cameras. Center, thirds, safe-margin, and approximate Shorts safe-area overlays are editor-only. Fullscreen preview and full-resolution current-frame PNG capture are available in the toolbar.

The visual preset browser provides animated SVG motion summaries, descriptions, search, favorites, recent choices, custom preset duplication, rename, and deletion. Selecting a preset auditions it through the existing composition renderer using a temporary project copy. Application is explicit, with the affected count for the active move, checked group, or every move. Favorites and recents are personal preferences; custom animation definitions remain project data.

Move clips have keyboard-accessible duration handles. Pointer resizing snaps to 0.05s unless Alt is held, clamps duration to 0.2–30s, and ripples following moves using the existing sequential model. Track visibility, timeline fit, zoom, frame stepping, move selection and multiselection remain available. Annotation intervals are visible on a dedicated track. There is one primary transport scrubber plus direct timeline seeking.

The curve editor displays samples from the same `curve()` evaluator used by rendering, including per-segment easing. Points can be added, dragged, deleted, nudged, copied/pasted as a channel, and edited with numerical controls. Values remain normalized to move duration. Explicit begin/end transactions make a continuous curve or duration drag one undo operation. The history implementation commits synchronously through a project ref, avoiding side effects inside React state updater callbacks.

Annotations are validated project data: arrows, square circles, multiline text, and captions. They include absolute start/end, fades, opacity, entrance/exit choices, styling, and positioning. Arrows use two square clicks; circles use one. Selected text can be positioned with Alt-click. Board shapes are rendered in board coordinates and follow camera transforms. Text is rendered in a dedicated compositor overlay. Scrubbing and native export use the same absolute-time evaluation. An annotation interval must have end > start; unsupported or malformed project data is rejected by schema validation. No historical migration framework was added.

The export dialog supplies landscape, Shorts, square, and square-in-vertical presets, full/half/custom output sizes, 24/30/60 FPS, whole-composition, active-move, and custom ranges. Native requests validate timestamps, even dimensions, aspect ratio and FPS before launching a job. PNG capture uses composition resolution and excludes viewport guides and magnification. Existing atomic export completion, cancellation, audio mixing and cleanup are retained.

## Architecture

`src/ui/panels/` splits the former 2,000-line settings module into category components, shared types and rainbow controls. `Panels.tsx` is now an export facade. `workspace/`, `preview/`, `presets/`, `keyframes/`, `annotations/` and `export/` and `transport/` contain the new specialized editors. Keyframe controls and export UI were extracted from the large inspector and app components. Existing effect controls, scoped resets, enable indicators and settings search remain available. `core/annotations.ts` owns validated annotation data and time evaluation; `AnnotationSystem` owns board meshes and caption textures, registers compositor passes, and disposes resources. `core/exportOptions.ts` validates native export options.

The current project schema adds `annotations`; saves include all authoring data. Preferences and viewport transforms do not enter the serialized project. Existing schema validation remains the source of truth. No project version migration was needed to add the validated field.

No extra thumbnail WebGL contexts are created. SVG thumbnail animations are inexpensive schematic summaries; the large composition preview shows the actual renderer output. Zoom/pan/resizing retain the existing Scene instance. Annotation meshes are rebuilt on immutable project changes and disposed before replacement. No benchmark speedup claims are made.

## Shortcuts

Space plays/pauses; Left/Right select moves; Shift+Left/Right step one 60-FPS editor frame; F fits the preview; Ctrl/Cmd+K focuses settings search; Ctrl/Cmd+S saves; Ctrl/Cmd+Z undoes; Shift+Ctrl/Cmd+Z redoes. Splitters and clip handles support arrow keys. Curve points support arrow keys and Delete. Input fields retain their normal text-entry behavior.

## Known limits and scope

Preset thumbnails are schematic motion summaries rather than cached raster renders. Previewing a chosen preset in the main composition uses the actual renderer. Curve editing supports the existing engine's channels and easing modes; free Bezier tangents are not introduced. Camera X/Y, zoom, rotation and tilt channels are evaluated directly after the normal camera transition, so keyed values match the displayed curves. Clip dragging edits sequential duration rather than providing arbitrary free-position clips. Effect regions other than annotations and existing beat markers do not yet have independent trim handles. Text position uses Alt-click rather than draggable bounding boxes. Text wrapping is explicit multiline, not automatic. Personal presets are project-scoped. Settings search retains its existing DOM discovery mechanism. The main App and move-effect inspector remain substantial components despite the settings, export, and keyframe extractions. These are remaining parts of the broader overhaul, not claims of completion.

## Screenshots

Original design: [0.2.21 baseline](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/blob/8c4d6b67c9d48c9e9b1093b8406ebfd9dc2de21d/docs/redesign/game.png).

New images are generated by `scripts/creator-smoke.ts`: workspace-editing, workspace-preview, workspace-effects, workspace-timeline, collapsed-settings, collapsed-inspector, preset-browser, curve-editor, annotation-editor, landscape-preview, shorts-preview, export-dialog, narrow, and large. The default editing screenshot includes compact navigation; `compact-navigation.png` captures it separately.

## Validation

Final local results are recorded below. Windows downloads are not changed by this implementation; the existing 0.2.21 link continues to identify its previously validated build.

### Executed checks

| Check | Command | Result | Evidence / scope |
| --- | --- | --- | --- |
| Unit and service tests | `npm test` | 90 passed, 1 skipped | Includes annotation round trips, invalid ranges, deterministic fades, export validation and exact keyed camera evaluation. Local Stockfish integration skipped because its executable is unavailable. |
| Production build | `npm run build` | Passed | TypeScript, Vite and desktop bundles built for 0.2.22. Package and lockfile versions agree. |
| Native desktop | `npm run test:desktop` | Passed | Startup, artwork, tooltips, selection/reset behavior, IPC save/reopen, H.264/AAC at 24/30/60 FPS, caption compositor export, native output formats, cancellation cleanup, backward pixel reconstruction and presentation graphics recovery. |
| Existing browser regression | `npm run test:ui` | Passed | Settings search/reveal, scope, multiselection, preview restoration, navigation, intro editing and narrow layout. |
| Creator browser regression | `npm run test:creator` | Passed | Splitter keyboard/pointer drag, layouts, viewport/project isolation, PNG download, nondestructive presets and all-move application, one-step drag undo, captions, ranges/FPS, preference persistence, 900–1920px and every UI scale. |
| Standalone renderer | `npm run test:render -- creator` | Passed | 216 render requests, 168 unique fixtures; determinism, independent renderer parity, failed-frame recovery, context recovery, resource lifetime and cinematic effects checks. |
| Windows portable build | [GitHub Actions run](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/actions/runs/41563394960) | Running | Targets implementation commit `6c73c206cfdd988fbdf40e465ec8cf8d1e6db861`. No claim of Windows validation or a new downloadable artifact is made yet. |

### Representative images

[Editing](workspace-editing.png) · [Preview](workspace-preview.png) · [Effects](workspace-effects.png) · [Timeline](workspace-timeline.png) · [Presets](preset-browser.png) · [Curves](curve-editor.png) · [Annotations](annotation-editor.png) · [Shorts](shorts-preview.png) · [Export](export-dialog.png) · [Narrow](narrow.png) · [Large](large.png).

Screenshots were inspected, including the default workspace, actual caption render, preset browser, export dialog, and narrow layout. Narrow annotation buttons were changed to wrap; narrow compact navigation uses icons with title tooltips. The current timeline scrolls track labels and track content together vertically.

### Git verification

Implementation commits:

- [38fcd01 — creator workspace and annotations](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/commit/38fcd01)
- [ce3d5d7 — regression tests and screenshots](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/commit/ce3d5d7)
- [6c73c20 — transport extraction and scrolling refinements](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/commit/6c73c20)

Remote `architecture/effect-compositor` matched the local implementation HEAD after pushing. All protected branch references match the startup snapshot: `studio-main` = `9e2eccc56e228fee5b526c9fc097316400c2ab08`, `main` = `e4ce9a7c61c250c6e1f84707d643da5942ea4cf7`, `fresh-start` = `5030ba80ff8444b312d775257319b594bf9b3fba`, and `windows-download` = `6c185b473c2f4d855eb42517d1f8367d4edc8319`. No PR, merge, force push, release publication or cloud environment publication was performed.

Final status: **Implemented but partially unverified** while the Windows workflow is running. The limitations described above define the supported editor behavior; they are not represented as implemented advanced features.

### Observed performance

The standalone SwiftShader hardening fixture measured 60 frames at 270×480 in 195.3ms, with 59 resets totaling 2.0ms. Its cinematic fixture measured median render times of 795.7ms without bloom and 970.5ms with bloom at 1920×1080; at 3840×2160 those medians were 2784.1ms and 3612.3ms. Bloom targets occupied 16,588,800 bytes at 1080p and 66,355,200 bytes at 4K. These are synthetic software-renderer observations from this environment, not interactive editor FPS claims or hardware benchmarks. No before/after performance improvement is asserted.

The final source commit is `6c73c206cfdd988fbdf40e465ec8cf8d1e6db861`; the subsequent documentation/evidence commit contains the finished validation record and refreshed screenshots without changing application behavior.
