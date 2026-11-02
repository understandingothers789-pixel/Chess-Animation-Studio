# Reviewed cinematic goldens

The 40 PNGs cover Subtle/Cinematic/Epic at three capture ages in all four output formats, plus bloom-only cases with piece glow deselected. They were explicitly generated and visually reviewed with Linux Chromium 154/SwiftShader. Normal checks never write this directory.

Run `node --import tsx scripts/cinematic-visual.ts`. It writes candidate PNGs to `test-results/phase4-candidate` and fails on any hash difference. Review those images alongside these references; never approve merely to make CI green.

To propose an intentional update, run `APPROVE_CINEMATIC_GOLDENS=phase4-reviewed node --import tsx scripts/cinematic-visual.ts`, inspect every changed image and the code responsible, and commit the reviewed PNG/hash changes with the rendering/test code. Then update `source-ref` in a separate commit to that immutable reviewed source commit. Explain the intended visual difference in the commit/PR. Do not point `source-ref` at current branch HEAD automatically.

CI renders the immutable `source-ref` snapshot in a separate temporary worktree using the same pinned Chromium as the candidate, then compares exact PNG hashes. Its explicit reference-generation command changes only the temporary worktree; it never updates the candidate checkout's committed baselines. This avoids accepting browser-version differences as rendering changes. Historical 168 fixtures remain independently checked against the immutable Phase II source.
