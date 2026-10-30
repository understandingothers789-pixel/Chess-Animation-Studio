# Sources and licensing

Piece SVGs were copied from the user's Nocturne Chess repository without artwork edits:
https://github.com/understandingothers789-pixel/nocturne-chess

Cburnett: Colin M. L. Burnett, GPL-2.0-or-later. Shaded Merida (Nibbler appearance): Armando Hernandez Marroquin, shaded artwork Felix Kling, GPL-2.0-or-later; Nocturne includes editable Lichess Merida sources and notices. See docs/licenses for preserved notices and license text. Filename case is normalized for loading. The original vector sources are distributed in public/pieces. The application is GPL-3.0-or-later; this does not imply official affiliation with Lichess, Nibbler or Chess.com.

The badge illustrations, generated chess cues and original synthesized Opera study music are created for this implementation. Source for the music is scripts/sample.ts; source for the cues is desktop/files.ts. The Opera Game score is historical game data.

Lichess Masters endpoint and authentication reference:
https://raw.githubusercontent.com/lichess-org/api/master/doc/specs/tags/openingexplorer/masters.yaml
The checked spec identifies https://explorer.lichess.org and OAuth2. The app accepts an optional locally encrypted token and reports HTTP authentication failures as unavailable. Raw results are cached seven days and uncached requests are serialized at least one second apart. Thresholds are applied after caching. Authentication success is not claimed without a valid authorized token.

Stockfish: https://stockfishchess.org/download/ . Engine executable and network files are not bundled. UCI limits are bounded to 1–8 threads and 16–512 MB hash. Best and played move scores are searched from the same root/mover perspective; mate scores map to signed (100000 − distance × 100). Labels: exact best UCI move → best; otherwise loss <35 cp good, <90 inaccuracy, <180 mistake, else blunder. Brilliant is manual. These are app rules, not Chess.com's proprietary classification algorithm.

FFmpeg download/legal information: https://ffmpeg.org/download.html and https://ffmpeg.org/legal.html . No standalone FFmpeg encoder is distributed. Users choose their own build; libx264 and other enabled codecs affect that build's licensing. Electron's included multimedia components retain upstream notices.

Official Chess.com asset resource article: https://www.chess.com/article/view/chess-com-brand-resources . Import support is provided for user-supplied local badge packs; unrestricted redistribution permission is not assumed.

Video references from the product brief: https://www.youtube.com/watch?v=wDOUOIrNX9Q and https://www.youtube.com/watch?v=Y2-Z-fYFkr0 . No Alight Motion project or creator media is bundled. The renderer's recipes are interpretations, not recovered source settings.

YouTube format guidance: https://support.google.com/youtube/answer/15424877 . Square/vertical eligibility and duration affect Shorts classification; do not assume that square exports and square content within a vertical canvas display identically. No claims are made about Instagram/TikTok cropping or native OBS/Resolve compatibility without practical checks.

Runtime third-party packages and their actual installed license files are collected in THIRD_PARTY.md. Electron's LICENSE and Chromium notice files remain alongside the runtime in portable packages.
