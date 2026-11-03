# 0.2.23 editor usability refinement

Repository: `understandingothers789-pixel/Chess-Animation-Studio`; branch: `architecture/effect-compositor`. Initial commit: `dc34fbf9ae3524e921b8ad5156b1ef15f61f3558`. Protected `studio-main` at startup: `9e2eccc56e228fee5b526c9fc097316400c2ab08`.

## Timeline first

The former options-menu-like dots are replaced by a right-edge grip with a horizontal resize cursor, distinct hover/focus treatment, and the tooltip **Drag to change move duration.** Selection is a button and resizing is a separate sibling slider, eliminating nested interactive controls. A three-pixel movement threshold prevents clicking the grip from editing duration or creating history. Dragging displays a floating SAN/duration label, moves following clips, snaps to 0.05s, and supports Alt bypass. Arrow keys resize, Alt+arrows make finer edits, and Escape/pointer cancellation restores the starting duration. One continuous drag remains one undo transaction.

The default scale increases from 18 to 52 pixels per second so move names can be read. Clip labels truncate before the grip and full SAN/preset/duration appear in the tooltip. Selection has a strong outline and leading stripe; multiselection uses dashed borders; dragging uses an amber boundary. Camera and effect rows identify the same selection. Track heights and labels align, the playhead has a contrasting stem/head, and accent beats have stronger weight. Timeline navigation, view controls and editing behavior are separate groups. This remains a sequential timeline, with horizontal zoom/scroll for long games and vertical track scrolling when the panel is short.

## Typography and controls

`styles/tokens.css` centralizes title, body, label, metadata, ink, surface, accent, focus and control-height values. Common former 7–10px labels use an 11px metadata token; regular labels use 13px, headings 18px. Tokens multiply through the existing UI-scale preference. Numeric fields are wider and 30px high, values stay aligned, and labels can wrap without pushing their numeric controls offscreen. Compact navigation truncates labels with full-name title tooltips; narrow mode keeps accessible icon names. The inspector selection explanation is shorter and its precise controls remain available.

Obsolete timeline rules were removed from both old stylesheets and replaced with one owned `timeline/timeline.css`, rather than another layer of contradictory timeline overrides. No UI framework was added.

## Preview space

Header height drops from 77px to 56px; preview padding and transport spacing are reduced. Fit continues to derive the largest undistorted composition from the actual host width/height on the existing render loop, so it reacts to panel sizes, output format and workspace changes without recreating WebGL. Fit now preserves the user's guides while resetting magnification and pan. Preview controls group magnification, navigation, guides and output; percentage shortcuts share a selector. Status indicates fit, zoom, panning and guides.

Fullscreen preview includes Play/Pause and an explicit exit button. Preview workspace can return to the preceding custom editing layout. Viewport changes remain local UI state and do not change exported framing, project cameras or keyframes. Rendering, chess, audio, encoding and project schemas were not modified.

## Images reviewed

[Before: 0.2.22 editing](../creator-workspace/workspace-editing.png) · [Before: vertical](../creator-workspace/shorts-preview.png).

[Selected timeline](selected-timeline.png) · [Resize hover](resize-hover.png) · [Live duration](resize-drag.png) · [Alt bypass](resize-unsnapped.png) · [Vertical](vertical.png) · [Landscape](landscape.png) · [Fullscreen](fullscreen.png) · [Editing](workspace-editing.png) · [Preview workspace](workspace-preview.png) · [Effects workspace](workspace-effects.png) · [Timeline workspace](workspace-timeline.png) · [Camera inspector](camera-inspector.png) · [1100×768](1100x768.png) · [1440×900](1440x900.png) · [1920×1080](1920x1080.png).

Screenshots were inspected for actual clip affordances, selection distinction, vertical composition size, toolbar wrapping and inspector alignment. All requested resolutions (1100×768, 1280×720, 1440×900, 1650×900, 1920×1080 and 2560×1440), all four scales and all four workspaces are exercised by the focused browser check. No performance speedup is claimed.

## Scope and limits

At very short durations clips still require zooming for comfortable pointer targets; keyboard adjustment remains available. Vertical compositions necessarily leave horizontal letterbox space in a wide editor. Long timelines scroll horizontally; short timeline panels scroll tracks vertically. Browser-native title tooltips are not rasterized into screenshots. Fullscreen playback uses the existing transport state. Windows confirmation is recorded only after its packaged checks pass.

## Commits and validation

- [5fe5746](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/commit/5fe5746): timeline interaction and typography foundation.
- [6ced7ba](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/commit/6ced7ba): preview, controls and workspace refinements.

Validation results and final Git verification follow after the checks complete.

## Responsive review and fixes

Visual review at 150% and 1100×768 revealed that a wrapped toolbar could consume the timeline. At narrow container widths, Navigation, View and Behavior now use labeled popovers with keyboard access, Escape dismissal and outside-click dismissal. Track space is reserved. Preview numeric and guide controls use text-relative widths so the zoom value remains readable. Playback metadata truncates safely rather than colliding with playback buttons.

The minimum-duration test also exposed overlap between the selection button's padding and the grip. Both are now flex siblings with separate allocated widths; selecting the minimum-duration move is explicitly tested without forcing the pointer through an obstruction.

[150% at 1100×768](scale150-1100.png) · [150% at 1920×1080](scale150-1920.png) · [Narrow View popover](timeline-view-popover.png) · [Compact navigation](creator/compact-navigation.png).

## Executed checks

| Command | Result | Scope |
| --- | --- | --- |
| `npm test` | 90 passed, 1 skipped | Existing core/service tests. Local Stockfish integration skipped because its executable is unavailable. |
| `npm run build` | Passed | Latest production TypeScript, Vite and desktop bundles for 0.2.23. |
| `npm run test:ui` | Passed, including repeat after responsive fixes | Settings, selection scopes, search/reveal, navigation, intro controls and narrow header layout. |
| `npm run test:creator` | Passed, including repeat after responsive fixes | Presets, clip and keyframe drag undo, workspace persistence, annotations, PNG download, export choices and UI scaling. |
| `node --import tsx scripts/refinement-smoke.ts` | Passed after correcting issues found by the test and visual review | Independent resize/selection, no-op clicks, minimum-duration selection, keyboard adjustments, snap and Alt bypass, live feedback, one-step undo, full-sequence timeline Fit, fullscreen playback, guide-preserving Fit, popover access, readable zoom fields and at least 50px of track space. All 96 requested resolution/scale/workspace combinations fit correctly. Full project data is unchanged after view/layout operations and undo. |
| `npm run test:desktop` | Passed | Native startup, save/reopen, exports at 24/30/60 FPS, aspect ratios, cancellation cleanup, backward reconstruction and presentation recovery. |
| `npm run test:render -- refinement` | Passed | 216 render requests, 168 unique fixtures; determinism, resource lifetime, independent renderers and cinematic recovery checks. No renderer changes were necessary. |

The standalone software-renderer measurements are diagnostic fixtures, not UI FPS measurements or a claimed speedup. The UI retains one existing Scene instance during zoom, panel resizing and workspace changes.

## Major files

- `src/ui/timeline/MoveClip.tsx`: independent selection and transactional duration grip.
- `src/ui/Timeline.tsx`, `timeline/ControlGroup.tsx`, `timeline/timeline.css`: readable sequence, grouped controls, responsive popovers and consolidated styles.
- `src/ui/styles/tokens.css`, `style.css`, `workspace/workspace.css`: typography tokens, consistent controls, reduced chrome and removal of obsolete timeline overrides.
- `src/ui/Preview.tsx`, `preview/ViewportTools.tsx`: grouped viewport controls, guide-preserving Fit and fullscreen playback.
- `src/ui/workspace/Workspace.tsx`: return from Preview to the preceding editing layout.
- `src/ui/Inspector.tsx`, `App.tsx`: shorter selection guidance and preview playback integration.
- `scripts/refinement-smoke.ts`: focused interaction and responsive validation. Existing browser scripts store their new screenshots separately from the 0.2.22 baseline.

Windows verification and Git references are recorded below. No public release is authorized or published by this workflow.

## Windows and final verification

[Windows validation run 41594622951](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/actions/runs/41594622951) passed the visual comparison, Windows build and unit/service tests, portable packaging, runtime signature step, and packaged application checks (including save/reopen, export, cancellation and recovery). The public-release publication step was skipped.

[Download validated 0.2.23 Windows portable](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/actions/runs/41594622951/artifacts/13212610939), 158 MB, retained for 90 days; GitHub sign-in is required. Artifact SHA-256: `6be421ae663efc7330bb9cdde2b762c1f785f7f785f55f57220aee570ac61ddf`.

The validated application source is [be2ad74c2a2faada4921f58e8ca4592b868c984d](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/commit/be2ad74c2a2faada4921f58e8ca4592b868c984d). Subsequent changes contain tests, screenshots, this report and the README download entry; application source and package versions remain identical to that validated build.

Additional implementation commits: [f8ba3db](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/commit/f8ba3db), [a3e6401](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/commit/a3e6401), [3293cce](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/commit/3293cce), and [be2ad74](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/commit/be2ad74). [f9ef4a6](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/commit/f9ef4a6) records the new validation suite and initial evidence. The final documentation/evidence commit updates the final reviewed screenshots and results.

All implementation was committed and pushed exclusively to `architecture/effect-compositor`. Protected branch references match startup: `studio-main` = `9e2eccc56e228fee5b526c9fc097316400c2ab08`, `main` = `e4ce9a7c61c250c6e1f84707d643da5942ea4cf7`, `fresh-start` = `5030ba80ff8444b312d775257319b594bf9b3fba`, `windows-download` = `6c185b473c2f4d855eb42517d1f8367d4edc8319`. No branch merge, force push, public release or cloud environment publication was performed.

Status: **Implemented and validated**, with the space and zoom limitations documented above. Final local/remote HEAD verification accompanies the final delivery.
