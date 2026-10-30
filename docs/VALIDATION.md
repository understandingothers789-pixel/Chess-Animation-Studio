# Validation and scope

## Release 0.2.4 update checks

- Local build and 14 core/service tests passed, including the one-sided 0.5-cycle sway.
- Actual Electron UI checks passed for Ctrl-click toggling, Shift ranges, Ctrl+Shift extension, applying Half sway to all moves and the import default, Neo rendering, and visible snow that responds to size/opacity controls. The screenshot in docs/images/neo-snow-024.png was visually inspected.
- Neo uses the actual 140px source PNGs plus smoothed grayscale contour reconstruction, not a claim of pixel-identical recovered high-resolution artwork.
- Native Windows run https://github.com/understandingothers789-pixel/Chess-Animation-Studio/actions/runs/41025980866 passed all 14 core/service tests and the packaged desktop/export checks from a fresh extraction in a path with spaces.
- Release source: `518f3d79ab6fc5efa3fd2adf6a3d940313f0d425`. The published 0.2.4 ZIP was downloaded again and verified against SHA-256 `d0b06d630d35743e66aa6e4adcca6c445b8904eaa43a4ce5d9050aef909bfe00`; every archive CRC passed and all 12 Neo reference files were present.
- The first internal candidate exceeded the Windows software-renderer export time budget. Reducing artwork texture memory from 2048px to 1024px (still above the enlarged piece pixel size at supported output resolutions) and accommodating slower CI rendering let the full native checks complete. No earlier 0.2.4 portable release was published or overwritten.
- Apply-to-all preserves existing per-move badge and camera settings. The visible project default applies to subsequent imports and board input; it is not an application-wide preference across unrelated new projects.

## Release 0.2.3 — verified native Windows build

- Source commit: `807239a8c0e7af334e3f0deb629ce9ae6480a943`, clean checkout.
- Native run: https://github.com/understandingothers789-pixel/Chess-Animation-Studio/actions/runs/41020652349 — completed successfully.
- Environment: Windows x64 hosted runner, Node 24.19.0, official Electron 39.8.10.
- All **13** core/service tests passed on Windows, including a pinned real Stockfish 17.1 query and a measured FFmpeg AAC trim/offset pulse check.
- The packaged ZIP was freshly extracted to **Portable launch with spaces**. The actual extracted EXE launched; the sample/music opened, both vector sets rendered, backward seeks matched pixels, save/open preserved relative assets, H.264/AAC 640×360 video exported at 60 FPS, and native-sized 1080×1920 / 1080×1080 / square-in-vertical exports passed. Cancellation cleaned partial files; the clean presentation window loaded without editor controls. No renderer exceptions were recorded.
- The official runtime executable matched its source bytes: SHA-256 `9ba4530b08adeae75c13324a95b0fc8e87c5aa2889cfdc894474f8684b9f6c59`. Native signature inspection reported **NotSigned**. This is not a trusted-signature or Smart App Control approval claim.
- Release: https://github.com/understandingothers789-pixel/Chess-Animation-Studio/releases/tag/studio-v0.2.3 . The published ZIP was downloaded again and checked independently: every CRC passed, BUILD.json matched the version/source/clean state, EXE bytes matched the recorded runtime hash, and both SVG sets were included.
- Published ZIP SHA-256: `1754d9dd3e392bbbc9f940825f85c33cf9dfac6be7a1e2c9f8b958764709982c` (138,931,185 bytes). Server Content-Disposition supplies `Chess-Animation-Studio-0.2.3-Windows-Portable.zip`.
- Validation evidence: https://github.com/understandingothers789-pixel/Chess-Animation-Studio/actions/runs/41020652349/artifacts/12961677737 . Workflow artifacts require GitHub login and expire after 90 days. The separate release asset is the persistent download.

The earlier 0.2.2 candidate passed launch and exports but was withheld after its presentation check selected the wrong renderer window. The final harness finds the presentation output URL explicitly. The 0.2.1 checkpoint passed native checks but its optional Release upload failed on an empty signature-evidence file; 0.2.3 records that evidence directly in the native workflow and its Release upload succeeded. No previously published binary was replaced.

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
- Pause/restart playback after soundtrack, cue or timing edits to reschedule already queued WebAudio events. Export always evaluates the saved settings.
- One recovery slot is retained; it is not a backup history. A hard kill during export may leave a .chess-studio-export directory, while normal cancellation removes it.
- Project schema 2 is a fresh format; old schema-1 projects require manual PGN/asset reimport rather than an unverified conversion.
- Portal intros, cutaways, character faces/props, slash/reload presets and animated-media attachments are deferred. No unsupported controls are shown for them.
- The export process uses bounded raw-frame IPC copies and prioritizes determinism; no real-time export-speed guarantee is made. Hardware encoders are probed and software fallback remains available.
- FFmpeg and Stockfish executables are selected locally and not distributed. Native workflow validation installs separate tools temporarily.
