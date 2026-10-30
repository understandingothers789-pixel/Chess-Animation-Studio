# Validation and scope

## Release 0.2.1

The final native Windows workflow result and download identifiers are recorded here after the release run. Compilation and Linux checks alone do not establish a successful Windows launch or Smart App Control approval.

## Completed local checks

- TypeScript compile and production Vite/esbuild build.
- 13 core/service tests: special chess moves, promotion identity, terminal games, PGN variations and stable prefixes, deterministic backward seeking, normalized keys, per-format camera, slow-sway endpoints/peaks, marker trim/offset behavior, constrained landing alignment, transient detection, atomic relative-path saves, badge provenance/path safety, cached Masters thresholds/cutoff/unavailability, a real local Stockfish query, FFmpeg export/cancellation, and measured AAC pulse timing after music trim/offset.
- Actual Electron desktop workflow on Linux/Xvfb/SwiftShader: sample opens, both vector sets render, repeated backward seeks give identical pixels, native IPC save/open preserves assets, H.264/AAC 640×360 export at 60 FPS, native-sized vertical/square/square-in-vertical short exports, export cancellation cleanup, clean presentation window, and no renderer exceptions.
- Additional actual editor checks: sample audio decodes and schedules for playback; reusable preset saves; a new project cannot overwrite a previous file through a stale native path; deleted/restored audio invalidates caches and reloads; a fresh process offers autosave recovery. Screenshots were visually inspected for readable artwork and the solid edge during a turn.

## Earlier native checkpoint

GitHub Actions run 41017597591 built 0.2.0 on Windows and passed its packaged desktop/export smoke checks. This is evidence for that checkpoint only; 0.2.1 includes further fixes and gets its own native run. The 0.2.0 artifact remains available at https://github.com/understandingothers789-pixel/Chess-Animation-Studio/actions/runs/41017597591/artifacts/12960905632 until GitHub retention expires.

The official Electron 39.8.10 runtime executable was recorded as **NotSigned** by native Windows Authenticode inspection. The portable process verifies byte equality with that upstream runtime, avoiding executable resource modification. This does not give the app a trusted signature or prove Smart App Control acceptance. No policy, execution-protection, or download-metadata changes are performed.

## Practical limits

- Smart App Control on the user's PC, AMD hardware encoding, physical audio output, OBS capture and DaVinci Resolve import require that machine and have not been verified here. CI launch is not a policy-approval guarantee.
- An unauthenticated live request to the current Masters endpoint returned HTTP 401. Failure/caching/threshold behavior is checked; successful authenticated access needs a user-authorized token. Tokens are entered locally and never included in project files.
- Beat detection is first-channel transient analysis, not authoritative BPM/downbeat inference. Automatic timing is a proposed arrangement; review marker corrections and apply alignment again when desired.
- PGN raw text and SAN variations are preserved. Only the current line's effect map is stored; effects unique to a different inactive branch are not separately archived. Full PGN annotation/comment editing is not implemented.
- Keyframes use numeric times/values and easing, not a graphical Bezier curve editor. Very large games and one-hour decoded audio may consume substantial memory; imports and assets have explicit bounds.
- One recovery slot is retained; it is not a backup history. A hard kill during export may leave a .chess-studio-export directory, while normal cancellation removes it.
- Project schema 2 is a fresh format; old schema-1 projects require manual PGN/asset reimport rather than an unverified conversion.
- Portal intros, cutaways, character faces/props, slash/reload presets and animated-media attachments are deferred. No unsupported controls are shown for them.
- The export process uses bounded raw-frame IPC copies and prioritizes determinism; no real-time export-speed guarantee is made. Hardware encoders are probed and software fallback remains available.
- FFmpeg and Stockfish executables are selected locally and not distributed. Native workflow validation installs separate tools temporarily.
