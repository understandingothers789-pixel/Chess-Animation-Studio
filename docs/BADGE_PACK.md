# Local badge packs

Use **Design → Local classification assets → Import local badge pack manifest** to import a folder of permitted artwork. The app does not download or redistribute an official Chess.com pack. A manifest can reference images from an independently obtained pack while preserving its source and accompanying usage guidance.

Place `pack.json` beside the images:

```json
{
  "kind": "chess-animation-badges",
  "schemaVersion": 1,
  "source": "The actual source URL or local provenance",
  "guidance": "Copy the actual usage guidance that accompanied your permitted download",
  "badges": {
    "book": "book.png",
    "brilliant": "brilliant.png",
    "best": "best.png",
    "good": "good.png",
    "mistake": "mistake.png",
    "blunder": "blunder.png"
  }
}
```

Use actual filenames. PNG/WebP/JPEG are supported; transparency is recommended. Files must stay inside the manifest folder, including after resolving symlinks. Absolute paths, network URLs, and escaping paths are rejected. You can include only the classifications you own/have permission to use. Existing original artwork fills any missing classifications.

Importing records resolved local asset references and source/guidance metadata in the project. Collect portable project copies those referenced images. Settings allows relinking, removing or editing provenance. Choose Restore original artwork for a particular classification to drop its override without losing other project data. Individual badge-image import is also supported. ZIP extraction and inferring a proprietary pack’s layout are not supported.
