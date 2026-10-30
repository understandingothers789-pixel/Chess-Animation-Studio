# Analysis, assets, and export guidance

Checked October 29, 2026 (America/Chicago). Network results are observations from the build environment, not a promise that the service has the same availability everywhere.

## Lichess Masters

Official specification: [Masters endpoint](https://github.com/lichess-org/api/blob/master/doc/specs/tags/openingexplorer/masters.yaml), within [Lichess API](https://lichess.org/api).

The current specification points to **https://explorer.lichess.org/masters** and declares `OAuth2: []`. The historical `explorer.lichess.ovh` host and the current official host both returned HTTP 401 for an unauthenticated request in this environment. The implementation uses the current host. This conclusion follows the current source and observed requests; it does not assume a token just because an old project used one.

Requests contain the position FEN, up to 100 returned moves, and no top-game payload. A move is suggested as book only if its game count meets the configured minimum (default 20) **and** its frequency among all games from the position meets the configured minimum (default 0.5%), before the configured ply cutoff (default 24). Returned statistics are cached for seven days; requests are serialized with a one-second delay between uncached calls, a timeout, cancellation and explicit HTTP errors. Not found is different from service/auth unavailable and from not analyzed. Engine suggestions remain independent. A valid authenticated live response has **not** been verified here.

Only the optional locally entered token is sent as a Bearer credential to the fixed official endpoint. On Windows, Electron safeStorage uses DPAPI. There is no token in the repository, prompt, example project or logs. The Linux fallback `basic_text` storage is explicitly refused. Never copy credentials into asset guidance or project metadata.

## Local engine labels

Stockfish provides UCI evaluations, not Chess.com classifications. The app runs the selected executable in a background process (no shell), with 2 threads and 128 MB hash. Per search, depth and move-time limits both apply. Search results are cached locally by executable identity, FEN, played move and limits. Cancellation stops the engine.

At the position before the move, compare the unrestricted best search with a search restricted to the played UCI move. Both scores use **the mover’s perspective** at that same root. Loss is `max(0, bestScore - playedScore)` in centipawns. Mate scores are ordered as signed `100000 - 100 * abs(mateDistance)` for loss calculation, with the original signed mate distance retained for display. Terminal positions can still be edited/rendered without analysis; there are no invented moves after termination.

| Result | Label |
| --- | --- |
| Played move equals returned best move | best |
| Otherwise loss < 35 cp | good |
| 35–89 cp | inaccuracy |
| 90–179 cp | mistake |
| ≥180 cp | blunder |

These are documented **application heuristics** at finite search limits. Different depths/time/hardware can change them. Brilliant is manual, not a claim to reproduce another service’s algorithm. A cached result may be reused; changing the executable version or limits requires a distinct cache identity. Book information and engine information are both retained even when one badge is displayed. Manual badges always override both, and Automatic reverts that display choice.

## Original and optional assets

The procedural badge artwork, icon, generated sounds, and synthesized sample music are original to this project. The Cburnett and shaded Merida piece SVGs come from Nocturne Chess and carry GPL-2.0-or-later terms; see `docs/piece-licenses` for attribution and license texts. The Opera Game move score is historical game data.

[Chess.com brand resources](https://www.chess.com/article/view/chess-com-brand-resources) was supplied in the product brief. The page returned HTTP 403 to the build environment, so current downloadable pack terms could not be inspected. **No official pack was downloaded or redistributed.** Local PNG/WebP/JPEG imports can replace classification artwork. Preserve its source and any accompanying guidance in the asset metadata; verify current official terms yourself before redistributing a pack. Functional original alternatives remain available offline.

The supplied brief describes reference screenshots/video behaviors, but the actual frames/clips were not attached to this coding task. Preset timings and curves are original approximations based on that description, not measurements from stills. No Alight Motion project or paid pack is needed. See [recipes](references/INITIAL_RECIPES.md).

## Video formats and platforms

Official [YouTube three-minute Shorts guidance](https://support.google.com/youtube/answer/15424877) currently says that, for standard channels, square or vertical videos up to three minutes uploaded on/after October 15, 2024 are categorized as Shorts. It suggests a wider aspect ratio such as 16:9 to keep a video long-form. The same page describes special cases for music partners and Content ID; consult the live guidance for your channel and music rights.

That categorization **does not establish** how any particular phone/feed/player crops or pads a video. A 1080×1080 export is square; a square composition inside 1080×1920 is a portrait video. Neither receives a promise of identical platform presentation. This app makes no claim about current Instagram/TikTok display behavior. Preview uploads on each intended platform and keep important pieces/badges away from player overlays.

## FFmpeg and Stockfish binaries

[FFmpeg legal guidance](https://ffmpeg.org/legal.html) says most FFmpeg code is LGPL 2.1-or-later, but optional GPL components change obligations for that build; its checklist specifically discusses libx264 as a GPL library. FFmpeg also documents codec patent considerations separately from copyright licensing. No standalone FFmpeg encoding executable is bundled by this app. Electron includes Chromium multimedia components and their accompanying notices. The user selects an independently obtained local executable. Any future bundling must review the **exact binary’s build configuration, licenses, corresponding source/distribution obligations and applicable codec terms** first.

Stockfish is GPLv3, distributed separately through its [official download page](https://stockfishchess.org/download/). No engine binary or NNUE network is bundled here. Preserve that distribution’s notices/source availability when distributing it separately or considering future bundling. The JS dependency notices and Electron/Chromium notices are separate from these external executables.
