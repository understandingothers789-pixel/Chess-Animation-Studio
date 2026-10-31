# Fresh implementation history

## 0.2.11

Improves editor organization with a numbered workflow, contextual panel guidance, clearer section cards, board/framing controls first in Scene, and selected-move guidance that identifies Beat spotlight in Look. Moves the settings report into Files.

Adds live music volume changes, timeline volume points for preview/export, a shareable project settings report, beat-marker locking and preservation of Scene/Music controls when importing another track. New compositions and pulse resets use all enabled beats instead of accents only.

## 0.2.10

Adds optional playhead snapping to move clip boundaries, with Alt to bypass snapping while seeking. Fits and centers the board across the available width in standard 9:16 Vertical output, and keeps the default camera settled through the intro into the first move.

## 0.2.9

All 26 core/service tests and native Windows packaged editing, dust/light/spotlight, presentation and all export-format checks passed. The published ZIP was independently downloaded and its checksum, archive CRCs, version and source manifest verified.

Adds a configurable beat spotlight transition after selected moves: alternating in/out or per-beat punch zoom, piece focus, rocking/shake, expanding glow/ring, sparkles, alternating color pulses, radial zoom blur, brightness accents and selective desaturation/vignette. Uses corrected music markers or a BPM grid, automatically reserves a reversible hold, preserves motion presets and supports reset/tooltips.

Adds optional per-move colored light washes with restrained flicker, a one-click red look, highlight color matching, selectable-move editing, fade/hold controls, numeric/group resets and tooltips. Uses deterministic time evaluation and leaves Shorts bars and badge artwork untinted. Built-in motion-preset changes preserve the light settings.

Makes captured-piece dust the default exit for new move presets and the Opera sample. Adds cell-based silhouette erosion and artwork-colored fragments, bounded particle tails that survive move boundaries, en passant positioning, adjustable duration/amount/spread/size, reset controls and tooltips. Existing explicit exit choices remain valid.

Adds a cropped 9:16 Shorts view based on the eight reference frames across four sheets. Includes adjustable board width, window height/position, bar color and action-tracking strength, plus reset and tooltips. Shares framing across preview, presentation and export and preserves older projects with the new mode off. [Windows portable download](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/releases/download/studio-v0.2.9/Chess-Animation-Studio-0.2.9-Windows-Portable.zip).

## 0.2.8

[Windows portable download](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/releases/download/studio-v0.2.8/Chess-Animation-Studio-0.2.8-Windows-Portable.zip). Saves the requested brown/beige default board palette: dark #B88762, light #EDD6B0. Adds explanatory hover tooltips and accessible descriptions to every setting input across the editor, including numeric ranges. Existing saved board colors remain intact; new compositions and board-style reset use the new palette. All 16 tests and native Windows palette/tooltip, editing and export checks passed; published ZIP integrity was independently verified.

## 0.2.7

[Windows portable download](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/releases/download/studio-v0.2.7/Chess-Animation-Studio-0.2.7-Windows-Portable.zip). Replaces the knight logo with a cyan frame, coral play symbol and cream spark. Updates editor branding, favicon and running window icon. Adds undoable group resets across effect controls, with individual resets for snow, board-effect and move-motion numeric settings. Selected moves reset to their own preset defaults, preserving unrelated settings. All 16 tests and native Windows logo/reset/Undo and export checks passed; published ZIP integrity and bundled logo assets were independently verified.

## 0.2.6

[Windows portable download](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/releases/download/studio-v0.2.6/Chess-Animation-Studio-0.2.6-Windows-Portable.zip). Adds a selectable Intro clip with four openers and editable timing/framing. Fixes inspector presets, motion, camera, appearance and Paste to affect every selected move. Snow defaults to inside the board with an optional full-scene toggle; count, size, speed and transparency controls appear first in Scene, and flake sizes follow board zoom. The guide links a free 101 BPM funk track with attribution and import instructions. All 16 tests and native Windows packaged editing/export checks passed; published ZIP integrity was independently verified.

## 0.2.5

[Windows portable download](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/releases/download/studio-v0.2.5/Chess-Animation-Studio-0.2.5-Windows-Portable.zip). Adds a configurable zoom-and-turn intro, first-move Slow sway, subtle always-lit shimmer, BPM-driven dark-square color pulses, breathing rim light, traveling light sweep and vignette breathing. Amounts, speeds, colors and intro timing are editable in Scene. Exact-time effects remain consistent when seeking and exporting. Existing move edits and custom defaults are preserved. Fifteen tests and native Windows packaged launch/export checks passed; the published ZIP checksum and archive CRCs were independently verified.

## 0.2.4

[Windows portable download](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/releases/download/studio-v0.2.4/Chess-Animation-Studio-0.2.4-Windows-Portable.zip). Fixes snow culling and visibility, expands editable particle size, adds one-sided Half sway, Explorer-style Ctrl/Shift selection, and an explicit apply-to-all/import-default action. Includes all 12 Neo reference pieces with smooth contour reconstruction. Neo is not claimed pixel-identical to recovered high-resolution originals. Reduces artwork memory and preserves badges/cameras during batch actions. Fourteen tests and native Windows packaged checks passed; published ZIP integrity was independently verified.

## 0.2.3

[Windows portable download](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/releases/download/studio-v0.2.3/Chess-Animation-Studio-0.2.3-Windows-Portable.zip). Native Windows build with 13 passing core/service tests and successful packaged-app checks from a fresh ZIP extraction in a path with spaces. Includes Nocturne vector pieces with solid edges, slow sway, per-move editing/keyframes/cameras, audio/beat editing, analysis, recovery, presentation and direct MP4 export. Separates fresh app data from the previous implementation; serializes final recovery writes; cleans up engine wait listeners; identifies the correct presentation renderer in validation. Publishes a permanent versioned release ZIP, checksum and signature-status evidence. The application remains unsigned and Smart App Control approval is not guaranteed.

## 0.2.2 candidate

Not published as a portable download. Launch and exports passed, but a presentation-window selector in the validation harness timed out. The corrected selection is included in 0.2.3.

## 0.2.1

[Windows artifact](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/actions/runs/41019103040/artifacts/12961316388). Corrected image/audio asset separation, sample music playback checks, new-project save paths, restored-file cache refreshes, inline reusable preset names, live presentation state, ribbon widths and badge glow. Native tests and packaged checks passed. The optional Release upload failed on an empty signature-evidence file; the workflow artifact remained available.

## 0.2.0 checkpoint

[Windows artifact](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/actions/runs/41017597591/artifacts/12960905632). First fresh implementation with native Windows packaging and packaged desktop/export checks. Superseded by the stability fixes above.

Earlier 0.1.x source and downloads remain preserved on their original branches and tags.
