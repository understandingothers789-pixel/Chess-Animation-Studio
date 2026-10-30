# Validation and remaining release work · 0.1.0

This is a working local Electron implementation tested on Linux. A Windows package is a build artifact, not proof that it has launched or passed these checks on Windows. No environment configuration was republished and no repository changes were pushed.

## Passed in the build environment

- `npm run build`: TypeScript checking, Vite production build, bundled main/preload. Vite reports nonfatal annotation warnings from Zod; these do not disable checks.
- `npm test`: **18 passed, zero failed, zero skipped** with local Stockfish and FFmpeg available. This includes captures, coordinated castling, en passant, promotion identity, checkmate/terminal positions, PGN variations/invalid input, stable IDs, normalized timing, backward reconstruction, deterministic particles, independent format cameras, badge overrides/round trips, beat correction/locks, service failures, atomic project writes, portable asset collection, pack boundaries, and cancellation cleanup.
- A real FFmpeg audio test: a source pulse at 0.5 s, trimmed from 0.2 s and placed with a 0.4 s project offset, is audible at the expected **0.7 s** in the encoded MP4 and absent in earlier/later sampled ranges. This checks actual decoded AAC output, not only a filter string.
- `npm run test:desktop`: actual Electron windows with Three.js WebGL through SwiftShader on Xvfb. Controls change rendered pixels; backward seeking and Undo restore identical pixels. Imported sample music is decoded and scheduled for playback. Waveform, manual beat edits, timing preview/cancel, local Stockfish and manual badge priority work. Native dialog choices are scripted during tests; the actual IPC/storage paths execute.
- The desktop suite saves/reopens a project with relative assets and overrides, enters a legal move by clicking the GPU board, cancels an active export without leaving a partial output, opens a control-free presentation window, and restores autosave after a new app launch. No renderer exceptions or CSP violations remain in the passing run.
- Actual H.264/yuv420p + AAC MP4s probed at **60 FPS** in all four production sizes: 1920×1080, 1080×1920, 1080×1080, and square-in-vertical 1080×1920. These format smoke clips are 0.3 seconds from an active move; a separate six-second 640×360 animation proves sustained exact-time frame output with music and sounds. Output bounds and the thin-edge turn were visually inspected.
- Full 33-ply Opera Game: **3445 frames, 1920×1080, 60 FPS, 57.416667 seconds with AAC audio**, decoded completely with FFmpeg and checked with ffprobe. The timeline rounds up to a whole frame. An initial helper assumed 3444 frames; that assertion was corrected to the documented ceiling rule and the resulting file was independently verified by `scripts/verify-demo.ts`.
- `npm run test:assets`: deleting an opened audio asset is detected and its cached preview cleared; a local badge pack is imported through the desktop flow with preserved provenance/usage guidance.
- `npm run test:dev`: Vite startup, nonce-protected React refresh, preload bridge and live WebGL preview work.
- `npm audit --omit=dev`: zero reported runtime dependency advisories at the time checked. This is not an application security audit.

Runner outputs are under ignored `test-results/`: screenshots, MP4s, ffprobe JSON and a desktop summary. A virtual-display reconnect interrupted earlier runs; stale test-owned temporary files were removed and the suite completed afresh. Passed outcomes above refer to completed runs, not interrupted attempts.

## Packaging

A Windows x64 portable application archive is produced under `release/` and is checked for archive integrity and required application/sample files. Extract the entire archive and run `Chess Animation Studio.exe`; Node.js is not required for the prebuilt app. The JS/source package and original sample assets are included, with Chromium/component notices.

NSIS installer creation was attempted from Linux. A locally installed, checksum-verified Wine runtime reached the helper stage, but the available WoW64 setup could not execute NSIS’s 32-bit uninstaller-generation stub. No complete NSIS installer is supplied; the partial helper was removed. The documented native Windows `npm run package:win` command remains available, and a successful native installer build/install/uninstall is still required before claiming installer readiness. This does not block the portable application archive.

## Unverified target-system checks

- Native Windows install/launch, window capture, GPU rendering and driver behavior on the requested Ryzen/Radeon system.
- AMD AMF/NVIDIA/Intel hardware encoder availability and reliable full-size output on that machine. Runtime probes and libx264 fallback are implemented; Linux validation used software encoding.
- Windows DPAPI token round trip and a successful authenticated Masters lookup. The official endpoint currently declares OAuth2 and unauthenticated requests here returned 401. Failure/offline behavior and thresholds are implemented/tested; no credential was supplied or requested in chat.
- OBS capture and DaVinci Resolve import. Standard H.264/AAC files were probed and decoded locally, but those applications were not available for practical testing.
- The full source/terms of an official Chess.com asset download: the provided page returned 403. No official assets are redistributed. Original alternatives and local pack import work.
- Long sessions, hundreds of imports, extreme imported media sizes, unusual audio codecs, multi-monitor scaling and very large games need further target-system testing.

## Current limits and unfinished work

- Beat finding estimates transient onsets from the first audio channel; it does not infer reliable BPM/meter/downbeats. Manual correction and preview-before-apply are essential for difficult music. Preview audio is buffered in memory, with a 256 MB source-file limit and a one-hour music limit.
- The project preserves raw PGN and selectable SAN variations. Effects are attached to the selected line; matching prefixes survive a switch/import. Inactive branch-specific effect archives and complete PGN comment/NAG annotation editing are not implemented. Import provides matching/reset/reassign-by-ply choices; unmatched move cues remain inert until reassigned or removed.
- Keyframe editing is numeric and move-focused, with easing presets. Graphical Bézier curve editing, advanced paths, motion blur and a sculpted character system are not implemented.
- Only one autosave recovery slot is retained. This is recovery, not a versioned backup system. Hard process termination during export can leave a `.castudio-export-*` folder beside the intended output; normal cancellation cleans it automatically. Remove a stale folder only after no export is running. No incomplete MP4 is reported as successful.
- Frame streaming currently copies RGBA through IPC and prioritizes determinism over fastest-possible export. No real-time export speed or native GPU performance is claimed.
- The elaborate hinged portal, additional intros, cinematic cutaways, props/memes, faces, red eyes, slash/reload actions and animated media clips are **not implemented**. Their versioned scene boundary and reference recipes are documented; there are no working-looking controls for them.
- No automatic updater or code-signing certificate is configured. Windows release testing/signing and installer validation remain release work.

The first usable release must not be called fully verified until its Windows and external-application acceptance checks are completed. The implementation does not integrate with either of the user’s separate chess applications.
