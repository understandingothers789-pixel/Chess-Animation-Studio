# User guide

Extract the portable ZIP and open Chess Animation Studio.exe. The application works locally. Configure FFmpeg in Files before exporting; Stockfish is optional. Online opening lookups are optional and can fail without preventing editing or export.

## First composition

Open **Opera Game with original music**. Space plays/pauses, the transport slider seeks, and the timeline selects moves. Click a move in Game to edit its effect. Selecting a move seeks to its departure; play or scrub through it to inspect the animation.

Styles applies presets to the selected move, checked moves or all moves. Slow sway makes one broad lean each way over 2.2 seconds by default. Spin exposes a real 0.036-square-thick edge. The reverse is the mirrored physical back of the illustration. Intensity changes movement/growth effects; exact settings are in the Motion inspector.

Use Camera for per-format framing. Route includes the endpoints, Follow tracks the moving piece, Manual gives explicit pan/zoom, and Full returns to the board. Look controls highlights, ribbon trails and badges. Keys uses normalized 0–1 move time; positions are board-square units, rotations degrees, scale a multiplier. A key overrides its channel's preset evaluation. At the move's end the legal position, size and upright orientation are restored.

Give a refined effect a preset name in Motion, then save it. Copy/Paste copies effects between moves. Undo/redo covers project edits. Changing overall move duration preserves normalized key times and shifts subsequent moves. Music offsets remain fixed unless edited.

## Import and legal input

Paste PGN or FEN in Game, or choose a local file. Variations remain separate selectable lines; raw PGN is retained. Matching legal prefixes retain effects when that option is enabled. Effects specific to an inactive branch are not independently archived. Imports are validated in a worker and do not replace the project on error.

At a displayed chess position, click a movable piece and then a legal destination. The status bar lists its legal destinations. Legal input creates a new variation. Use the promotion selector before entering a promotion. Before the first move, the starting position is editable; during a move, legal input uses the preceding completed position.

## Audio and beats

Import a music file in Music and wait for decoding. Pause/restart playback after changing soundtrack, cue or timing settings so queued audio is rescheduled. Analyze waveform & likely beats finds first-channel transients, not authoritative BPM/downbeats. Drag beat markers on the waveform or edit their numeric times, accents and enabled state. Double-click the timeline to add a marker; arrow keys move a focused marker by 0.01 seconds.

Source-timed markers follow source trim and project offset edits. Corrections update their source-time anchor. Preview timing arrangement shows how many moves can land on usable markers while respecting locks and 0.5–5 second duration limits. Apply is one undoable edit; Cancel preserves the project. A move may also choose a specific enabled landing marker. If it is unreachable within the limits, it is left unmatched.

Import local sound effects, select one, preview it, and assign it to a move landing. Cue offsets are relative to that landing; volume and sound bus remain adjustable. Music, chess sounds and effect sounds have separate volume controls. Automatic chess cues use original synthesized sounds.

## Formats and atmosphere

Choose Landscape, Vertical, Square or Square in vertical. Camera settings and composition layout are stored per format, while moves and music remain shared. Square in vertical uses a square viewport within the vertical canvas. Layout Y moves it up or down. Background images retain their aspect ratio through cropping. Light/dark square colors remain independent, and beat pulses affect only dark squares.

## Analysis and assets

Choose Stockfish in Files before engine analysis. Analyze the selected, checked, or all moves. Book suggestions require enough Masters games and configured frequency; a service failure is labeled unavailable rather than not-found. Some deployments of Masters require a bearer token; enter it locally if needed. Windows credential encryption protects it; it is never part of the project.

Manual badges override suggestions without deleting the book/engine data. Built-in badge art is original. Import a local image or version-1 badge manifest for alternate artwork; source and guidance are preserved. See BADGE_PACK.md.

Missing files are shown in Files and in the status bar. Relink replaces references across music, sounds, badges and layouts. Removed or changed files invalidate preview/audio caches. Collect assets into portable project writes a new project folder with copied assets and relative paths.

## Saving, recovery and presentation

Save/Save as writes a versioned .castudio file using a flushed temporary file and rename. Autosave writes one recovery snapshot after a short idle period and at close. A recovery banner lets you adopt or dismiss it on next launch. This is recovery, not a multi-version backup history.

Present opens a clean companion window controlled by the editor. F11 toggles fullscreen and Escape exits fullscreen. In OBS add a Window Capture source, choose the presentation window and set your canvas to the same aspect ratio. Practical OBS capture and Resolve import still require validation on your machine.

## Export

Choose Export MP4, select a range and output path, then render. Frames are evaluated at exact timestamps at 60 FPS; the last frame count rounds upward for a partial frame. FFmpeg writes H.264 yuv420p with AAC audio. Auto encoding probes actual hardware encoder execution and falls back to libx264. Cancellation stops the worker and encoder, removes temporary files, and preserves the project and any previous destination file. A hard process kill can leave a temporary export folder beside the destination.

## Local data location

The fresh implementation uses `%APPDATA%\ChessAnimationStudio-Fresh` on Windows. Settings, one recovery snapshot, encrypted optional credentials, caches and rotating logs are stored there. It does not reuse or overwrite the older implementation's recovery/settings directory. Project files remain wherever you save them.

## Updates in 0.2.4

Half sway is a one-sided lean and smooth return to upright; Slow sway still leans both ways. Set Sway cycles to 0.5 for the one-sided form. Click moves normally to select one, Ctrl-click to toggle, Shift-click for a contiguous range, or Ctrl+Shift-click to extend the selection. The move list and timeline support the same modifiers. Checked moves are the batch selection used in Styles.

After refining an action, open Styles and choose **Apply selected action to all moves & default** to use it throughout the composition and as the default on subsequent imports/board input. The separate import-default action leaves existing moves alone. Both edits are undoable.

In Scene → Snow & atmosphere, enable Ambient particles, then adjust **Particle size**, **Particle speed**, and **Particle opacity** (lower means more transparent). Count, drift, direction, softness, color, depth and over/behind layering are also editable. Existing saved projects retain their values; increase size/opacity if a saved project's snow is too subtle.

Scene → Board & pieces → Piece artwork includes **Neo**. It uses a smoothed contour reconstruction from the actual 140px Neo reference PNGs. This produces sharper scalable edges but does not recover missing original detail or guarantee pixel-identical high-resolution replicas.

## Board atmosphere and intro (0.2.5)

Open **Scene → Board atmosphere & intro**. Board effects is the master switch. Lighting shimmer changes brightness gently without blackouts; adjust its amount, speed and tint. Breathing rim light, traveling light sweep and vignette breathing each have independent strength, speed and color controls. Zero strength disables an individual effect.

Enable Zoom-and-turn intro to animate from a smaller, rotated board into the normal framing before the first move. Intro lead-in sets when moves begin; Intro duration sets the animation length, extending the lead-in if needed. Starting size and turn degrees set the initial framing (default 55% and 45°). A longer lead-in than duration holds the completed framing.

Enable Dark-square tempo pulses to pulse dark squares with a configurable BPM, color, strength and decay. This is a regular tempo clock; the existing Music marker pulses can still follow corrected soundtrack markers. Match the BPM to your track or use the marker controls for irregular timing.

New games use Slow sway for the first move when the project motion default is Clean slide. Existing edited moves and custom project defaults are preserved. Intro and atmosphere are evaluated at the exact playhead time in preview, presentation and export.

Five additional board-effect ideas were considered: breathing rim light, traveling light sweep, vignette breathing, destination ripples and corner-light accents. The first three are included in 0.2.5; the latter two are ideas for later versions.

## Intro clip and selection editing (0.2.6)

Click **Intro** at the beginning of the MOVES track, before e4. The right inspector offers **Zoom & turn**, **Gentle zoom**, **Board turn** and **Still board**. Edit the clip length, animation length, initial size and turn there. A longer clip than animation holds the completed framing. The clip shifts the start of the game; it is not a chess move.

Ctrl-click toggles individual moves; Shift-click selects a range; Ctrl+Shift extends it. The inspector shows the selection count. Changing **Move preset**, duration, sway or other Motion settings applies to every selected move. Camera and Look field edits and Paste also apply to the selection. Unchanged settings stay individual to each move. Editing individual keyframe points uses the active move; Clear keys applies to the selection.

## Snow controls (0.2.6)

Open **Scene**: **Snow particles · amount & appearance** is now the first section. **Particle count** controls how many flakes appear (0–400). Adjust size, speed, opacity (lower is more transparent), drift and color there. **Inside board only** is on by default, including for older projects; turn it off for snow across the surrounding scene. The board mask clips the full flake, including its soft edges, and follows the board during intro, rotation and camera motion. Flake size follows the board zoom. Layer controls remain available; flakes behind an opaque board can be hidden by it.

## Free funk track for music testing

Try **“Funkorama” by Kevin MacLeod**, a 3:21 funk groove listed at **101 BPM** in the creator’s catalog.

- [Official track page and license](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100474).
- [Download the MP3 from the creator](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Funkorama.mp3).

The creator offers it under **Creative Commons Attribution 4.0**. It is free with credit, including commercial use; include this credit in your video description and note edits such as trimming:

> “Funkorama” Kevin MacLeod (incompetech.com)
> Licensed under Creative Commons: By Attribution 4.0 License
> https://creativecommons.org/licenses/by/4.0/

Download the MP3, then open **Music → + Import music → Analyze waveform & likely beats**. Play it, review/correct the suggested beat markers, and use the timing preview before applying alignment. For regular board color pulses, set **Scene → Board atmosphere & intro → Pulse BPM** to 101. The BPM clock starts at project time zero; music-marker pulses are preferable when you need the pulses to follow the track’s exact beat phase. No third-party track is bundled or automatically downloaded by the app.

## Resetting effects (0.2.7)

Use **Reset** beside an effect section’s heading to restore that group. Snow has a group Reset plus **↺** buttons beside each numeric setting, so you can restore particle size or count without changing the rest. Board-effect and move-motion numeric sliders also have individual reset buttons. Hover a reset button for its description.

Movement and timing restore the defaults for each selected move’s current preset. For example, Half sway resets to its own 1.6-second duration rather than changing to Clean slide. Resets apply to all selected moves and preserve settings in other groups. Camera reset affects the current output format; other formats keep their cameras. Use **Undo** to reverse a reset.

Reset is also available for the opener, capture impact, highlights/trails, badges, keyframes, board/piece appearance, composition, board atmosphere, dark-square pulses and music/audio settings. Music reset keeps the imported track; sound reset keeps the sound library. These controls change the project, not the source files.

The app’s new cyan-frame/coral-play logo replaces the knight in the header, favicon and running window icon. The official runtime executable is still copied unchanged; its embedded executable metadata is not resource-patched.

## Default board palette and tooltips (0.2.8)

The owner-specified brown/beige palette is now the app default: **dark squares #B88762** and **light squares #EDD6B0**. New compositions and **Scene → Board & pieces → Reset** use these exact base colors. Existing saved projects keep their own colors; you can enter the two colors individually to keep other style choices. Shimmer and beat pulses can temporarily tint the base colors during playback.

Hover a setting label or its input to read an explanation. Numeric controls also show their allowed range; the same help is supplied as an accessible description for assistive technology. Help covers all settings panels, the move inspector, keyframes, intro, timeline and export settings. Reset buttons have their own restoration tooltip.

## Unreleased development: cropped Shorts view

Choose **Output format → 9:16 Shorts · cropped board**, or enable **Scene → Shorts framing → Shorts crop**. It uses the vertical 1080×1920 output with a taller-than-square board window: enlarged pieces and cropped outer files, with clean bars above and below. It does not squeeze the full board into the portrait frame.

Adjust **Visible board width** (smaller means closer), **Shorts board height** (fraction of the portrait frame), **Shorts board position**, and **Shorts bar color**. **Follow action in Shorts** uses the existing smooth move-camera transitions; **Shorts tracking strength** controls how strongly they steer the crop. Turn following off for a centered crop. Layout X/Y and zoom still provide framing offsets; the camera is bounded to retain board content. Move camera zoom, tilt, roll and the chosen intro still apply.

Reset restores the Shorts group defaults. These controls have explanatory tooltips. Older saved projects load with Shorts disabled. The same crop renderer serves preview, presentation and export, and clicking in the surrounding bars does not enter board moves. Background images remain available in the other views; Shorts uses its dedicated bar color.

Reference: four user-uploaded sheets, each with a top and bottom frame (eight reference frames total), showing an enlarged partial board in a portrait video. This implements the board framing rather than the video's social-media overlays. This work is committed for a later release; **0.2.9 has not been published**.
