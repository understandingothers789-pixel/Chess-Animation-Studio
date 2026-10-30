# Archived executable comparison

The portable-v0.1.0 tag's four archive parts were downloaded read-only and assembled. The archive SHA-256 matched the original recorded value:
`85085c139e482fe19e1523d762ef56ce33d1b7d081326bfe876efa2362f7c266`.

Its executable was compared with the executable in the locally preserved 0.1.4 archive. A user screenshot shows an app labeled 0.1.0 running from the corresponding portable-folder layout, and later launches were blocked. The user-machine executable hashes were not collected, so these artifacts are reference binaries, not proof of the exact files executed on that PC.

- Archived 0.1.0 EXE SHA-256: `e3a8cc6f1ee61dca35c63f53ef34a90c942490240d7f138469467f1ef258a447`.
- Inspected 0.1.4 EXE SHA-256: `b297b1fa3a82560379a9ad96af9c3b83f0212261f810dce652d4ac6ee48f7392`.
- Both files are 210,896,896 bytes.
- Both PE certificate-table directory entries are zero: neither contains an embedded Authenticode signature.
- All inspected PE sections match byte-for-byte except `.rsrc`, the resources section. In particular `.text`, `.rdata`, `.data`, `.pdata` and relocation sections match.

The full per-section hashes are in OLD_BINARY_COMPARISON.json. This identifies a binary-resource difference, not the reason for Windows' trust decision. The observed user CodeIntegrity events 3033/3077 named the EXE and its signing-policy failure, not a PNG/SVG asset. Do not infer that removing artwork or changing a launcher fixes that policy.

The fresh packager copies Electron's official runtime unchanged and verifies byte equality before shipping. Application code/data live in ordinary resources/app files, and application version/provenance are recorded in the app and BUILD.json. Native Windows signature inspection reports the actual runtime's status; preserving upstream bytes is not a signing claim or Smart App Control guarantee.
