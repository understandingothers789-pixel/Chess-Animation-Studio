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
