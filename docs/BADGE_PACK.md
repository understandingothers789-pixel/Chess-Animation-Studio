# Local badge packs

Choose Scene → Badge artwork → Import badge pack manifest. A manifest has this shape:

```json
{"version":1,"source":"Creator or source URL","guidance":"Usage guidance supplied with these files","badges":{"book":"book.png","brilliant":"brilliant.png","best":"best.svg"}}
```

Supported names are book, brilliant, best, good, inaccuracy, mistake, blunder and custom. Paths must be relative and resolve inside the manifest's directory, including through symlinks. Images are local assets capped at 256 MB; manifests are capped at 64 KB. Source and guidance are retained. No official Chess.com art is bundled or licensing permission inferred from a sample manifest.
