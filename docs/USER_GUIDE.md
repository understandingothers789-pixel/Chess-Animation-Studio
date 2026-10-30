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
