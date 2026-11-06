# Chess Animation Studio 0.2.29 — Hover flyouts and contextual editing

## A. Executive summary

Right-facing submenu arrows now open real adjacent hover flyouts. Parents stay visible and highlighted, and both mouse and keyboard navigation work across multiple levels. Exact Edit commands reveal and focus their intended controls. A compact bulk panel identifies the source, category, target count and timing locks before applying. Preview menus distinguish squares, visible annotations and unused background, while viewing commands keep playback running. The dark green identity and existing rendering/audio architecture are preserved.

## B. Hover submenu behavior

- Hover opens a child after 125 ms; clicking and Right Arrow also open it. Hovering does not steal keyboard focus.
- A directional pointer-intent triangle delays sibling switching up to 300 ms while moving toward a child. A 320 ms hierarchy-leave delay bridges small gaps. Fast/slow diagonal and horizontal transitions, minor pointer jitter, submenu switching and hierarchy retention are tested.
- Multiple menu levels remain visible where their combined scaled widths fit. Menus normally open right, open left near the right edge, and shift within the viewport as necessary. Height is constrained with scrolling. At constrained widths, leading levels give way to a Back-based fallback; the compact title retains source context.
- Window resize, fullscreen changes, workspace class/style changes and observed menu-size changes trigger placement updates. Pointer samples stay in refs rather than causing a React render for each movement. Listeners, observers and timers are cleaned up.
- The existing typed command factories are retained. Internal identities use command IDs or stable tree addresses, never labels. Parent ARIA expanded/controls attributes identify their child panels.
- Up/Down/Home/End skip disabled commands; Right/Enter open a child; Left returns focus to its parent; Escape closes the whole hierarchy. A submenu containing only disabled commands can receive focus, allowing Left to work. Closing restores its invoker when available.

## C. Inspector improvements

Contextual focus runs after the destination panel/tab has committed. Exact-duration commands display the selected count when they target multiple moves. The relevant section opens; the whole setting field scrolls into view; the input receives focus and a brief highlight without changing its value or seeking.

| Command | Destination |
| --- | --- |
| Edit movement & timing | Movement → Move preset |
| Set exact duration | Movement → Duration numeric input |
| Edit camera | Active output format → Camera framing |
| Edit move effects | Capture impact → Capture camera shake |
| Edit badge | Move badge → Badge override |
| Edit beat spotlight | Beat spotlight transition → Enabled control |
| Edit annotation | Selected text input or shape width |
| Music volume / trim | Music → Volume / Source trim start |
| Dark-square pulse | Music → Pulse dark squares |
| Knight horse sound | Music → Horse sound volume |

Right-click multi-selection and playhead preservation remain covered by regression checks.

## D. Bulk editing

Quick flyouts remain available, with source-specific labels such as **Apply e4’s settings to…** and **Paste to Bxc6**. **Bulk edit from e4…** opens a compact dialog with one explicit Apply button. Changing category or group does not edit the project.

The panel shows source move number/SAN, settings category, target group/count, timing-locked count and active camera format where relevant. Categories remain Movement, Camera, Effects, Timing and Everything. Groups remain This move, Selected moves, All moves, each piece type, captures, checks, checkmates, promotions and castling. Matching still uses legal chess replay, not SAN heuristics. Empty groups are unavailable.

The panel and quick actions share `applyMoveSettings`; each operation is one history transaction. Timing locks remain authoritative, including spotlight settings that alter automatic hold. Camera configuration targets the active output format; Everything includes all formats.

## E. Preview improvements

Opening a context menu no longer pauses playback. Fit, guides, FEN and frame capture work while playback continues. Annotation edits pause when chosen and reuse the existing annotation commands and editor. Board-square commands still create anchored arrows/circles or text.

Background actions include Fit, reset editor zoom/pan, guides, PNG capture, FEN copy and fullscreen. They do not change project cameras. Hit testing distinguishes text/caption bounds and actual visible arrow/circle geometry before falling back to a board square or background. Text bounds come from the existing rendered text layout; shapes use their rendered geometry. This adds picking support without changing rendering output.

FEN copying now returns the position **after** the last landed move; the previous lookup used each game step's pre-move FEN. Clipboard success appears only after its promise resolves; rejection produces failure feedback. PNG capture snapshots one evaluated output-resolution frame and reports download initiation or an exception. The browser/OS controls the final destination.

## F. UI refinements

Adjacent panels share compact spacing, borders, shadows, checked/disabled states and destructive styling. Active parents remain highlighted. Shortcut guidance now mentions submenu arrows. The selection toolbar contains Preview, Preset, direct Edit and More actions. The bulk panel follows UI scale, traps keyboard focus while open, and supports Cancel/Escape. Status feedback uses the existing status bar with polite live announcements.

## G. Reviewed screenshots

Actual browser captures are reviewed for clipping, readability, parent/child connection, overlap, placement, focus, disabled states and scale. The gallery covers the required contexts:

| Context | Capture |
| --- | --- |
| Root move menu | [Root](move-menu.png) |
| Hover Copy / parent and child | [Copy hover](hover-copy.png) |
| Paste flyout | [Paste](paste-menu.png) |
| Locked Speed flyout | [Speed](speed-menu.png) |
| Exact duration selection count | [Duration scope](duration-scope.png) |
| Three-level bulk flyout | [Bulk hierarchy](bulk-menu.png) |
| Left-opening flyout | [Right edge](flyout-top-right.png) |
| Right-opening flyout | [Left edge](flyout-top-left.png) |
| Bottom edge | [Bottom right](flyout-bottom-right.png) |
| Keyboard-focused submenu | [Keyboard](keyboard-flyout.png) |
| Compact bulk panel | [Bulk panel](bulk-panel.png) |
| Blank preview | [Background](blank-preview.png) |
| Board square | [Square](board-menu.png) |
| Fullscreen hierarchy | [Fullscreen](fullscreen-board-menu.png) |
| 150% UI scale | [1100px / 150%](flyout-1100-150.png) |
| Narrow fallback | [Compact](narrow-fallback.png) |
| Annotation commands | [Annotation](annotation-menu.png) |
| Multi-selection | [Selection](multi-selection.png) |

## H. Tests

Baseline at `e7f0997`: `npm test` (98 passed, one Stockfish-dependent skip), `npm run build` and `npm run test:timeline` passed.

Final local checks:

| Command | Result |
| --- | --- |
| `npm run build` | Passed TypeScript, Vite and desktop compilation |
| `npm test` | 102 passed, one Stockfish-dependent skip (103 total), 18 test files |
| `npm run test:timeline` | Passed all prior and new interaction/picking assertions |
| `npm run test:ui` | Passed settings, selection, focus/navigation, preview and narrow-layout regressions |
| `npm run test:creator` | Passed workspace, splitters, viewport isolation, PNG, presets, curves, captions and export options |
| `node docs/context-menu-029/review.mjs` | Passed horizontal pointer transitions and jitter in both directions, exact-duration selection count, and explicit keyboard focus |

CI visual/render gate: **passed** on source `467139e` in [run 42158103364](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/actions/runs/42158103364). This includes `npm run test:timeline`, `npm run test:render -- reference`, `npm run test:render -- final`, the reference/candidate `node --import tsx scripts/cinematic-visual.ts` runs, and `node scripts/compare-render-hashes.mjs` with the reference/final hash files. [Visual evidence](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/actions/runs/42158103364/artifacts/13476245466).

Windows validation: **passed**. The workflow ran `npm run build`, `npm test`, `node scripts/portable.mjs`, the runtime-signature check and `npm run test:desktop` against the freshly extracted portable application in a path containing spaces. Packaged hover flyouts, exact-duration focus and bulk-panel cancellation were exercised, together with startup, editing, save/reopen, preview, presentation recovery, export cancellation, H.264/AAC exports in all output formats and captions at 24/30 FPS. [Windows validation evidence](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/actions/runs/42158103364/artifacts/13476260944). Local native desktop checks were not run because this session has no display server. The Windows workflow uses a freshly extracted portable application and actual FFmpeg/Stockfish. Automated coverage retains all 0.2.28 assertions and adds real hover/switching, fast/slow diagonal motion, three-level menus, disabled-only keyboard navigation, exact control focus without edits, bulk-panel counts/locks/single Undo, clipboard delayed success/rejection, actual PNG download completion, viewing during playback, annotation targeting, open-menu resize, and narrow fallback keyboard return.

The viewport matrix is 1100×768, 1280×720, 1440×900, 1650×900, 1920×1080 and 2560×1440 × 100%, 110%, 125%, 150%. A separate 700px case exercises compact fallback. Edge/corner invocation uses explicit MouseEvents followed by real pointer hover; the physical bottom-right camera menu is also exercised. Picking retains 504 transformed square checks and adds rendered annotation checks across orientations, formats, tilt, CSS zoom and pan.

## I. Git verification

- Starting HEAD: `e7f09976d01f83603dba14d6d211e6374acf15ba`.
- Branch: `architecture/effect-compositor`; no new development branch, reset, merge, force-push or PR.
- Final executable source: [`467139efd41519480a8775809dd682a0adada02b`](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/commit/467139efd41519480a8775809dd682a0adada02b).
- Source was pushed directly to the experimental branch. Remote source equality and all four protected refs were verified against startup; final verification is repeated after the documentation push. The final documentation-only commit/remote HEAD is also reported in the final response.

| Commit | Change |
| --- | --- |
| [de9fb2aa2687dcb5c8f97986e8dc2e1438e59f06](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/commit/de9fb2aa2687dcb5c8f97986e8dc2e1438e59f06) | feat: replace secondary panels with pointer-safe hover flyouts |
| [c8631b5918d10d27ad84617613983411cc06eab9](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/commit/c8631b5918d10d27ad84617613983411cc06eab9) | feat: focus contextual controls and clarify bulk and preview editing |
| [9f4ee4a959b655a918b5792cf15df567b21521e4](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/commit/9f4ee4a959b655a918b5792cf15df567b21521e4) | fix: harden flyout accessibility, scaling and edge regressions |
| [9555ba56ec1df4f3bb7152bfaf5f2dabe46b6e33](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/commit/9555ba56ec1df4f3bb7152bfaf5f2dabe46b6e33) | fix: clarify duration selection scope and bulk feedback |
| [b51c647782f984272fda33f94e1fc3ce09056088](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/commit/b51c647782f984272fda33f94e1fc3ce09056088) | test: await resized menu geometry and cover horizontal flyout paths |
| [467139efd41519480a8775809dd682a0adada02b](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/commit/467139efd41519480a8775809dd682a0adada02b) | fix: close inactive flyouts during keyboard navigation |

Protected refs recorded at startup:

| Branch | SHA |
| --- | --- |
| studio-main | `9e2eccc56e228fee5b526c9fc097316400c2ab08` |
| main | `e4ce9a7c61c250c6e1f84707d643da5942ea4cf7` |
| fresh-start | `5030ba80ff8444b312d775257319b594bf9b3fba` |
| windows-download | `6c185b473c2f4d855eb42517d1f8367d4edc8319` |

## J. Windows download

**[Download 0.2.29 for Windows (x64)](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/actions/runs/42158103364/artifacts/13476046551).** [Workflow 42158103364](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/actions/runs/42158103364) succeeded for source `467139efd41519480a8775809dd682a0adada02b`. The portable artifact is 163 MB. GitHub-reported artifact SHA-256: `86c9ee333f1bd75d54fe8d73fef88b22998b7a3966caa95d61b0f3b437e6ab43`.

Extract all files and open **Chess Animation Studio.exe**. GitHub Actions artifacts require signing in and are retained for 90 days. The README follows the prior versioned download convention and keeps earlier entries. The workflow's public-release step was skipped; no public release was published.

## K. Known limitations

- Narrow layouts intentionally use compact Back navigation when simultaneous panels cannot fit.
- Hover delay is fixed at 125 ms; optional favorites, recent commands, search and the command palette are deferred.
- PNG feedback confirms download initiation; browser/OS download UI controls final placement and can cancel it.
- FEN is the last landed legal position, not an interpolated animation state.
- Existing camera keyframe channels remain shared across formats; per-format camera configurations remain separate.
- The local Stockfish-dependent check is skipped without the engine. Native Windows checks use the workflow's pinned engine and FFmpeg; the portable application does not bundle them.

## L. Five next recommendations

1. Searchable command palette backed by the existing command factories.
2. User-configurable shortcuts and hover delay.
3. Pinned favorite contextual commands.
4. Named workspace and track-layout presets.
5. A small recent-command list with visible scope descriptions.
