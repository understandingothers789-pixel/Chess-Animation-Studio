# 0.2.32 — per-shot music ducking

Implemented the primary feature; optional multi-caption selection/resizing and transitions are deferred to respect the limited budget.

**Use:** select a storyboard shot → **Music ducking** → enable, choose music level, fade down and fade up. Defaults are disabled, 30%, 0.25s down and 0.4s up. Fade durations allow 0.01–5 seconds. Changes use existing Undo/Redo and project persistence.

**Behavior:** a shared piecewise-linear output-time envelope starts each transition at the actual current gain. Consecutive ducked shots transition directly between levels; very short shots interrupt ramps continuously. Recovery begins at the next shot boundary and continues for the previous shot's fade-up duration. If the video ends while ducked, the soundtrack ends with it. Reordering/duplication use each shot's own settings.

**Systems changed:** `project.ts` persists settings; `core/audio/ducking.ts` owns envelope compilation/evaluation and expression generation. Web Audio schedules a separate music-only gain node, including the correct initial gain after seeking. FFmpeg uses those same envelope points with its existing 256-sample automation blocks. The waveform displays the combined gain. Shot Inspector uses existing controls. Existing volume automation, music fades/mute and chess/effect buses remain independent.

**Validation:**

- `npm test`: **138 passed**, 25 files, no skips; includes short/consecutive/beginning/end ducks, disabled settings, reordered/duplicated shots, automation/fades/mute and preview seek scheduling.
- `npm run build`: TypeScript, Vite and desktop bundles passed.
- `npm run test:ducking`: decoded actual H.264/AAC at **24/30/60 FPS**, two independently configured ducked shots, automation/fades, seeking, mute, two repeated capture-sound occurrences and actual project-file roundtrip. Maximum measured music-amplitude error **0.00101**, tolerance 0.012. Audio-focused MP4s use inexpensive blank 64px video frames.
- UI test: enable/control display, gain edit, Undo/Redo, save/reopen, source move preservation and waveform alignment; zero page errors.
- [Decoded audio results](audio-validation.json).

Both screenshots were inspected: readable controls, aligned output ruler/gain curve and no overlaps in the existing dark green layout. [Inspector](inspector.png) · [Output gain curve](waveform.png).

**Git:** starting HEAD `d7e95542617355d750bd8d4de9d7573f570ab537`. Primary implementation committed as `69e6313`; final HEAD is reported after push verification. Work is confined to `architecture/effect-compositor`. Protected starting refs: `studio-main` `9e2eccc56e228fee5b526c9fc097316400c2ab08`; `main` `e4ce9a7c61c250c6e1f84707d643da5942ea4cf7`; `fresh-start` `5030ba80ff8444b312d775257319b594bf9b3fba`; `windows-download` `6c185b473c2f4d855eb42517d1f8367d4edc8319`.

**Windows:** [workflow 42412669529](https://github.com/understandingothers789-pixel/Chess-Animation-Studio/actions/runs/42412669529) was triggered for validated application source `35d0e9393e30ff8e87e3020dc1de57e828218586`. At report time its visual gate was still running; no 0.2.32 artifact is claimed as validated and no new download link is advertised. Waiting for optional Windows validation was curtailed to respect the stated limited usage budget. No public release is authorized.
