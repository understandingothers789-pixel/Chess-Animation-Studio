# User guide

## Start with a game

The editor opens an animated Opera Game draft immediately. To include its original music and editable beat markers, use **Game → Open sample with original music**. Use **New** for a standard starting board.

In Game, paste PGN or FEN, or choose a local PGN/FEN file. Invalid input leaves the existing project intact. Variations are preserved as separate selectable lines; a PGN variation is never appended to the main line. Effects are preserved for moves whose entire legal prefix still matches. Paste import also offers explicit reassignment by ply or resetting effects; Undo restores the old game. Unmatched move-attached cues are ignored until reassigned/removed.

Click a piece and then a legal destination to create a board-entered variation. Enter at a stable legal position using Restart/Previous/Next/seek; select the promotion piece in Game. Promotion defaults to queen. Castling, en passant, underpromotion, checks and terminal positions use chess.js rules. Previous restores the earlier position; it does not reverse the animation.

## Shape a move

Select a move in the list or timeline. The preview, timeline, and inspector select it together. Space plays/pauses; arrows select previous/next moves. Restart returns to the initial position. The seek slider reconstructs the scene at an exact time.

Choose a style in **Styles**. Choose Selected move, Checked moves, or Entire line as the style scope; use the Game batch checkboxes to choose several moves. Motion controls set duration, turn axis/degrees, easing, hop, maximum size, delay, and hold. A Y or X turn reveals the thin edge; Z spins in the board plane. Partial rotations settle to a stable upright equivalent. The back is a mirrored view of the same illustration, with no rectangular backing.

**Fine control** provides normalized 0–1 keyframes. Position X/Y are board coordinates (square centers run −3.5 to 3.5), Z is elevation. Travel is progress along the chosen path; rotations are degrees. Scale, opacity, camera X/Y, and zoom also support keyframes. Each segment uses the destination keyframe’s easing. Piece position/orientation/opacity/scale return to their legal resting state at the move’s end. This prevents accumulating drift on replay or seeking. Duration edits preserve the normalized shape, shifting later moves and attached cues. Audio and absolute beat markers do not shift unless you edit them.

Copy/Paste in the inspector transfers effects. Reset restores project defaults. Refined presets are saved inside the project and can be reused on other moves. Ctrl+Z and Ctrl+Shift+Z undo/redo project changes.

Look controls separately configure route squares, continuous trails, capture glow/expansion, impact particles, and badges. Knights highlight only source/destination. Manual badges override analysis; choose Automatic to revert without discarding engine/book information. Badge artwork uses original alternatives unless you import a local image in Design. Source/guidance metadata is editable in Settings. A [local badge pack manifest](BADGE_PACK.md) can import several permitted images together.

## Camera and formats

Use the format selector to preview actual export boundaries. Landscape is 1920×1080, vertical 1080×1920, square 1080×1080; square-in-vertical exports 1080×1920 with a square render viewport inside it. Board geometry is never stretched.

Camera overrides in the inspector belong to the selected move **and current format**. Route includes source/destination with restrained default movement. Follow tracks the moving piece. Full shows the board; Manual exposes direct pan/zoom. Add tilt/rotation sparingly if readability matters.

Design provides independent layout zoom and framing per format. For square-in-vertical, Layout Y moves the square area up/down within the portrait canvas; the surrounding canvas uses the chosen background treatment. A solid `#000000` background gives black padding. Gradient, original particles, or a local image can be used instead. Snow placement can be over, behind, or both; random seeds reproduce the same particles after seeking/export. A scalar size is randomized from 0.5×–1.5×, with depth variation.

## Music, beats, and sound

Import a local WAV/MP3/OGG/M4A/FLAC in Music. Chromium decodes it and a worker estimates transient peaks. These are **likely beats, not guaranteed musical downbeats**. The waveform and markers are editable; double-click the audio track or use Add beat to insert one. Drag a marker, edit its numeric time, toggle an accent, or delete it. Auto-detected markers retain source times, so music offset/trim edits move those markers; hand-added markers remain at absolute project times.

Preview automatic timing for all/every second/every fourth/selected beats, play it, then Apply or Cancel. It preserves move order, respects timing locks and reasonable movement bounds, and aligns **landings**, not departures. Undo restores the arrangement. Use the inspector to anchor an individual landing to a marker. Moving an anchored marker refits duration/delay in legal order; impossible early/distant anchors are released rather than reordering moves. Manual music tempo remains unchanged. Fades/volume/mute/trim/offset affect preview and export.

The original synthesized move/capture sounds have independent chess/dramatic bus volumes. Import reusable sounds, name/preview them, and add cues at the playhead. Move cues store offsets from landing; absolute cues use project time. Multiple cues can be assigned per move, with per-cue timing/volume/bus. Effects can be disabled without disabling music. Imported assets must be available locally; relink missing files in Settings. The app checks for moved/deleted assets periodically and again before export.

## Analysis

Choose a trusted Stockfish executable in Settings. Analyze the selected move or entire line in Analysis; cancel when desired. The process uses 2 threads and 128 MB hash, configurable depth and per-search time limits, local caching, and background execution. Suggestions are not authoritative classifications; see [rules](SOURCES.md).

Masters lookups use the current official API with caching and serialized/throttled requests. Network/authentication failures produce Unavailable, distinct from Not found or Not analyzed. The app remains usable offline. If required, enter a Lichess token locally in Settings; Windows DPAPI through Electron safeStorage protects it. It never belongs in a project or repository. The Linux test environment has no configured token.

## Save, recover, and collect

Save/Save As write versioned `.castudio` JSON through a flushed temporary file and atomic rename. Asset paths on disk are relative where possible. Open Recent is in Settings. Editing is autosaved after 1.5 seconds of inactivity; closing with unsaved edits first flushes a recovery snapshot. Recovery is offered at the next launch. Saving clears recovery. One local recovery slot is retained, not a multi-project backup archive.

**Collect portable project** in Settings copies the project and assets to a folder you select without overwriting an existing project. For portable sharing, choose an empty folder and keep `assets/` together with `project.castudio`. Settings also supports relinking/removing individual assets and preserving their source/usage guidance.

## Export and OBS

Choose Export MP4, select format and encoder strategy, choose the output file, and wait. All production exports use 60 FPS, H.264/yuv420p video and 48 kHz AAC audio. Hardware mode probes AMD AMF, NVIDIA NVENC, and Intel QSV where advertised, **attempts a real tiny encode**, then falls back to libx264. No GPU encoder is assumed to exist. Export renders exact frame timestamps through the same evaluator/renderer as preview; it does not record your screen. One frame is sent with backpressure at a time. Memory does not grow with raw-video duration. FFmpeg errors include useful diagnostics; cancelling removes the temporary directory and never reports a partial file as successful. A running export uses its captured project state while you continue editing.

Present opens a clean borderless window controlled by the editor. F11 toggles fullscreen; Escape leaves fullscreen. In OBS, add a Window Capture source and select **Chess Animation Studio · Presentation**, then choose an appropriate canvas. Capture editor/system audio separately; the presentation window intentionally does not duplicate audio. This window contains no editor handles or controls. OBS capture and Resolve import require practical Windows verification before compatibility can be claimed.

Open logs folder in Settings for rotating local activity logs (1 MB each, three files). No ordinary per-frame or credential logging is used.
