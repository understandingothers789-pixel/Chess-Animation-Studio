# Architecture and project format

## Responsibilities

| Location | Responsibility |
| --- | --- |
| `src/core/model.ts` | Versioned, bounded Zod project schema; defaults; application version |
| `src/core/chess.ts` | chess.js legality, selected PGN lines, stable subjects, pre/post snapshots |
| `src/core/timeline.ts` | Pure exact-time evaluation, normalized curves, cameras, highlights, particles |
| `src/renderer/` | Three.js WebGL scene, original illustrated extrusions, output viewport composition |
| `src/ui/` | React editor, grouped undo/redo, playback, Web Audio, background audio analysis |
| `electron/files.ts` | Atomic storage, relative asset paths, portable collection, original sound synthesis |
| `electron/analysis.ts` | Serialized Masters requests and caching; bounded local UCI process; cancellation |
| `electron/export.ts` | Bounded raw-frame stream, encoder probes, FFmpeg audio graph, cleanup and finalization |
| `electron/main.ts` | Native dialogs, settings, secure token storage, rotating logs, IPC, output windows |
| `electron/preload.ts`, `src/bridge.ts` | Narrow typed API with context isolation and sandboxed renderer |

No service process, browser automation, online renderer, account system, or external video editor is part of application runtime. Electron render windows use the installed GPU by default. Linux test commands opt into SwiftShader; that proves renderer operation, not AMD hardware performance.

## Thin pieces

Each piece has an original vector silhouette. Three.js extrudes that silhouette by 0.05 board units with a small bevel. Front/back surfaces use a procedural canvas illustration; side faces have a separate solid material. Transparent silhouette regions contain no geometry. The resting face is in the board plane. Reversing a piece reveals a mirrored illustration; these are thin illustrated solids, not sculpted Staunton models. Stable pivots are at square centers. Text badges are separate camera/position-aware layers.

## Time and state

The project stores legal UCI/SAN moves separately from effects. A piece ID derives from the initial FEN and initial square. A move ID hashes its complete legal prefix, including the starting FEN. Matching imports retain IDs/effects; changing the prefix deliberately invalidates later IDs. Promotion retains the pawn’s identity. Castling adds a coordinated rook motion; en passant identifies the off-destination captured pawn.

A move segment is delay + duration + trailing hold. Landing occurs at `departure + duration * landingPhase`. Fine-control time is normalized inside the duration, independent of absolute project time. Later segments shift when duration/delay/hold changes. Cues can be absolute or relative to a move’s landing. Beats live in absolute project time; automatic arrangement writes explicit duration/delay settings. A `landingBeat` records an explicit binding, and marker/music edits refit bindings in legal order; impossible bindings are released, never reordered.

Frame evaluation is a pure function of project, format and time. Precomputed legal snapshots restore all subjects, then only the active move’s poses are evaluated. Camera targets interpolate from prior targets. Position/rotation/scale/opacity reset at a move’s end to prevent illegal resting states or accumulated error. Seeded particles use time equations, with no mutable simulation. Preview, clean presentation and export instantiate the same renderer/evaluator. Playback uses a monotonic wall-clock origin; seeking stops/reschedules Web Audio at the new timeline position.

The four output types share effects/game/audio and have independent layout and per-move camera overrides. Square-in-vertical uses a square scissored render viewport within the portrait frame, with background and ambient passes outside it; it is not a stretched square export.

## MP4 path

1. Capture/validate the project and all referenced assets; check disk space and encoders.
2. Probe advertised hardware encoders with an actual tiny encode. Fall back to libx264.
3. Create an isolated hidden render window. Await bitmap decoding.
4. Render frame `n` at `start + n / 60` through the same scene as preview.
5. Read top-down RGBA and send a single frame through an acknowledged IPC call. FFmpeg stdin backpressure prevents a raw-frame backlog.
6. Close video encoding, then mix trimmed/offset/faded music, original generated sounds and custom cues with FFmpeg. Encode AAC, copy the H.264 stream, and write fast-start MP4.
7. Rename the finished file into place only after successful completion. Cancellation aborts encoding/mixing, destroys the render window and removes temporary files. Existing destination files remain intact on failure/cancellation.

Export duration rounds up to a whole video frame. Audio is trimmed to that duration. Final holds are evaluated as legal resting states. Audio decoding/filtering happens in FFmpeg; video memory does not scale with the duration. Imported preview audio is decoded into Web Audio buffers (256 MB source-file cap and a one-hour music cap); this is not a streaming music editor.

## `.castudio` schema, version 1

The file is UTF-8 JSON with `kind: "chess-animation-studio"`, `schemaVersion: 1`, and an app version. It includes starting FEN, raw PGN and selectable SAN lines, selected line, stable moves and their effects/analysis, style/defaults, per-format layouts/cameras, normalized keys, badge overrides and local-pack references, snow seed, music settings/waveform, beats, sound library/cues, asset references/source/guidance, output settings and locally saved move presets. Empty versioned `scenes` extension slots reserve a later scene boundary. This release rejects nonempty scene data and unsupported schema versions clearly rather than silently dropping them.

Tokens, tool paths, recent projects and caches live in OS-local app data, never inside project files. Loaded relative paths resolve against the project directory; saving calculates relative paths for the destination. The editor uses absolute resolved references internally, so Save As does not break asset lookup or undo. Portable collection copies assets to a selected folder without overwriting pre-existing assets/projects.

Writes use a same-directory unique temporary file, file flush, close and rename. Autosave uses the same procedure in user data; closing with dirty edits flushes a recovery snapshot before allowing quit. Asset availability/fingerprints are checked periodically, on relink/reload, and before export. Missing previews are cleared; errors do not destroy the project. Logs rotate at 1 MB with two retained generations.

## Development scope

Tasks already run in isolated checkouts: use the existing repository, not an extra Git worktree unless explicitly requested. No application credentials are necessary for core development. Runtime FFmpeg and optional Stockfish are external tools; their version/license choices are intentionally separate from JS dependencies. Keep renderer-independent math/rules in core and test new effects with exact timestamp evaluation, backward seeks and practical video output. Later intros/cutaways should add a versioned scene evaluator and seamless handoff, not chained playback-only timers.
