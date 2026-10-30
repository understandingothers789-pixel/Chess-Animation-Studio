# Build Chess Animation Studio

## 1. Product goal

Build a Windows desktop application for making polished chess animations for
YouTube videos and Shorts.

The working name is **Chess Animation Studio**.

I want to import a chess game or position, press Play, and see an attractive
animated presentation immediately. Then I want to edit it move by move until
the piece movement, camera, highlights, music, and dramatic moments look right.

This is a chess-specific animation editor. Its main subject is the board and
what happens on or around it. It should give me much more control than an
ordinary chess GUI, while being easier to use for chess than a general video
editor.

The central workflow is:

1. Import or enter a chess game or variation.
2. Get a polished first draft from a style preset.
3. Play and inspect the animation.
4. Select moves and refine their effects.
5. Import music and align important moments with its beats.
6. Optionally add an intro or a cinematic cutaway.
7. Preview the finished composition in each output format.
8. Export an MP4 with synchronized music and sounds.
9. Optionally use a clean presentation window with OBS.

This is a separate project from my existing chess analysis application and my
chess frame capture/contact sheet application. Do not modify those projects
unless I explicitly request integration. Do not assume you have their code,
credentials, or conversation history.

This document is the consolidated product brief. Read it completely before
choosing the architecture.

## 2. What matters most

Prioritize these qualities:

- The application actually works, including direct video export.
- The first draft looks polished.
- Editing an individual move is simple.
- Fine control is available when a preset is insufficient.
- The editor stays responsive.
- Seeking and export reproduce the same animation.
- Windows installation and launching are straightforward.
- The project can grow to include new effects from future video references.

I expect to do substantial manual work on important moves. Automation should
give me a useful starting point and reduce repetitive work. It should not
prevent me from overriding its choices.

Do not stop after creating a mockup, a static board, an architecture document,
or a set of controls that do not affect the preview.

Keep the application local. I am initially its only user. Do not build
accounts, subscriptions, collaboration, or cloud project storage.

## 3. Target system and output

Primary platform: Windows.

My computer:
- AMD Ryzen 7 9800X3D.
- 32 GB RAM.
- AMD Radeon RX 9070 XT.

Support these output compositions:

1. **Landscape:** 1920 × 1080, 60 FPS.
2. **Vertical:** 1080 × 1920, 60 FPS.
3. **Square:** 1080 × 1080, 60 FPS.
4. **Square presentation inside vertical video:** a square board composition
   positioned within a 1080 × 1920 canvas, with configurable space above and
   below it.

For the fourth option, the unused space can be black, a chosen background,
subtle particles, or another designed treatment. Do not assume black bars are
required.

A genuine square export and a square composition within a vertical export are
different output options.

Do not assume how YouTube Shorts, Instagram, or TikTok will display each format.
Document current platform behavior when it affects export guidance.

One project should share its game, effects, and music timing across formats,
while allowing separate framing and layout for landscape, vertical, and square.

Direct MP4 export with music is required for the first usable release. I may
finish the exported video in DaVinci Resolve. The OBS presentation window is
also useful, but it does not replace MP4 export.

Display a visible app version and increment it meaningfully for updated builds.

## 4. Development and architecture

Inspect the repository first. If it is empty, initialize the application.

Choose a practical Windows desktop architecture that can support:

- A responsive editor.
- GPU rendering.
- Illustrated pieces with thin visible edges during 3D turns.
- Camera motion.
- Layered effects and particles.
- Accurate timeline seeking.
- Synchronized audio.
- Deterministic video-frame rendering.
- Future cinematic scenes and media attachments.

Electron, TypeScript, React, and a suitable GPU renderer such as Three.js are
reasonable starting choices. You may choose another stack if it has a concrete
advantage for this product.

Resolve whether the renderer can handle the required thin piece turns,
composition layers, seeking, and deterministic export before building a large
editor around it.

Separate these responsibilities:

- Chess rules and game state.
- Project data.
- Timeline and animation evaluation.
- Scene rendering.
- Editor controls.
- Audio analysis and playback.
- Opening and engine analysis.
- Video export.

Keep the design understandable. Avoid unnecessary frameworks and service
processes.

Core editing and rendering must work offline. The opening database may require
network access, but network failure must not prevent editing, playback, or
export.

The app must not depend on Alight Motion, Blender, a paid subscription, browser
automation, or cloud rendering.

Make routine implementation decisions and continue working. Ask me only when a
missing answer materially changes the product.

## 5. Chess rules and game input

Use a maintained chess rules library.

Support:

- Standard starting position.
- PGN file import.
- Pasting PGN text.
- FEN import.
- Entering legal moves on the board.
- Choosing a variation for animation.
- A readable editor move list.
- Selecting a move.
- Play, pause, restart, previous move, next move, and seeking.
- Board orientation from either side.
- Optional editor coordinates.

Correctly handle:

- Captures.
- Castling.
- En passant.
- Promotion.
- Check and checkmate.
- Terminal positions.

Keep legal chess state separate from animated appearance. A piece may grow,
turn, hop, pause in midair, or temporarily overlap a square without changing
the underlying rules.

Use stable identities for moves and pieces so effects, attachments, promotion,
and captures can remain bound to the correct subjects.

Coordinate castling animations for the king and rook.

Handle the captured pawn correctly during en passant.

Allow a promotion transformation or replacement effect.

Preserve PGN variations when practical. At minimum, make the selected line
clear and do not silently play variations as if they were consecutive moves.

Invalid PGN, FEN, or moves should produce clear errors without damaging the
current project.

## 6. Editor design

Create a polished desktop workspace with:

- A large composition preview.
- A move list.
- Playback controls.
- A chess-specific timeline.
- An inspector for the selected move or effect.
- A preset library.
- Project save and open controls.
- Output-format controls.
- Export controls.

Selecting a move should update the move list, timeline selection, preview, and
inspector together.

Keep common operations easy:

- Choose a preset.
- Adjust duration.
- Adjust rotation.
- Adjust easing.
- Adjust scale or hop.
- Change a landing beat.
- Add or change a badge.
- Adjust camera framing.
- Add a hold.
- Copy effects between moves.
- Apply a style to several moves.
- Reset a move to its defaults.
- Save edited settings as a reusable preset.

Use simple labels and controls first. Reveal finer settings when requested.

Provide sliders for broad adjustments and numeric fields for precision.

Include undo and redo.

Use inline validation and status messages for routine issues. Reserve modal
confirmation for actions that would discard work.

Every visible control should have a real effect. Hide unfinished features or
clearly mark them unavailable.

## 7. Simple editing and fine control

The editor needs two levels of control.

### Main controls

Allow me to choose an effect preset and adjust its most useful properties:

- Duration.
- Intensity.
- Rotation amount.
- Movement style.
- Maximum piece size.
- Hold time.
- Camera zoom.
- Highlight color.
- Landing beat.

### Fine control

Allow optional keyframes within an individual move for:

- Position.
- Rotation.
- Scale.
- Opacity, when relevant.
- Camera position and zoom, when relevant.

A dramatic move might:

1. Start traveling.
2. Begin rotating.
3. Grow slightly larger.
4. Slow down or briefly pause before its destination.
5. Finish a full rotation.
6. Land on a musical beat.
7. Settle upright at normal size.

A single “spin intensity” slider cannot express that sequence.

The fine controls should support keyframe time, value, and easing, while staying
focused on the selected chess move. Do not make me build every move from a
general-purpose animation timeline.

Allow a refined move to be saved as a reusable preset.

Use normalized timing within a move where helpful, so changing its overall
duration preserves the intended animation shape.

## 8. Piece appearance and movement

Use readable illustrated pieces that appear mostly flat while resting on the
board.

During an out-of-plane turn, the piece should reveal a **thin solid edge**.
It need not become a fully sculpted chess model.

Support both:

- In-plane rotation, like spinning an image.
- Out-of-plane rotation, which shows its edge and reverse face.

Choose a practical representation with a readable front, a defined reverse,
a thin edge, a stable pivot, and a clean silhouette. Transparent areas must not
turn into an obvious opaque rectangular card.

Document the initial reverse-face behavior, such as a mirrored illustration.

Pieces should finish moves in a stable resting orientation and at the correct
square. Replaying or seeking must not accumulate rotation or position errors.

Provide these movement presets:

- **Clean slide:** restrained smooth movement.
- **Fast start, soft landing:** quick departure and clear deceleration.
- **Spin:** adjustable partial or full rotation.
- **Wiggle:** restrained sway during travel, followed by settling.
- **Hop:** rise, travel, and landing with optional shadow.
- **Dramatic landing:** growth, slowdown, final turn, and settle.
- **Capture impact:** movement, impact emphasis, and optional sound.

Expose useful controls for:

- Duration and delay.
- Rotation axis, amount, and direction.
- Wiggle amplitude and frequency.
- Hop height.
- Travel path.
- Overshoot.
- Scale peak and its timing.
- Landing and settling duration.
- Easing.

Include understandable easing presets such as smooth, quick start with soft
landing, slow start with fast finish, controlled bounce, and controlled
overshoot.

## 9. Capture growth and glow effect

Include a reusable capture preset inspired by the supplied reference.

When one piece captures another, the capturing piece may:

1. Arrive at the destination.
2. Expand suddenly, as though engulfing the captured piece.
3. Emit a colored glow or light pulse.
4. Make the captured piece disappear or play its own exit animation.
5. Return to normal size and settle.

Allow controls for:

- Maximum size.
- Expansion speed.
- Glow color and strength.
- Glow radius.
- Impact timing.
- Captured-piece disappearance timing.
- Return duration.
- Return easing.
- Optional particles.
- Impact sound.
- Optional landing on a musical beat.

Keep it usable as an ordinary move preset. It should not require a cinematic
cutaway.

The supplied screenshot shows a bright pawn and cyan glow. The expansion and
settling behavior come from my description of the video; do not claim to have
measured their exact timing from that still.

## 10. Highlights, trails, and board color

Support both:

- Colored squares along a move’s route.
- A continuous graphical trail beneath or behind the moving piece.

Allow either or both.

For sliding pieces such as bishops and rooks, support source, destination, and
intermediate squares.

For knights, default to source and destination squares. Do not imply the knight
occupies intermediate squares.

Handle pawns and castling sensibly.

Controls should include:

- Source color.
- Destination color.
- Path color.
- Trail width.
- Opacity.
- Glow.
- Reveal timing.
- Fade timing.
- Persist until next move or fade after landing.

The color scheme must be configurable. One possible style uses different colors
for each side. Do not hard-code green as “good” or red as “bad.”

Keep move highlights distinct from badge colors, beat-driven board colors, and
editor-only selection outlines.

The board should also support optional music-driven color pulses. A desired
style keeps light squares mostly stable while dark squares subtly change color
or brightness on selected beats.

Provide pulse color, intensity, attack, decay, beat selection, and a disable
switch. Preserve readable pieces and move highlights when effects overlap.

## 11. Camera behavior

The default camera should follow the action.

It may show only part of the board, sometimes roughly half, if that makes the
move clearer and more cinematic.

Support automatic suggestions based on:

- Moving piece.
- Source and destination.
- Captured piece.
- Important badge.
- A manually chosen focus target.

Allow controls for:

- Pan.
- Zoom.
- Framing padding.
- Transition duration.
- Easing.
- Optional slight tilt.
- Optional rotation.
- Return to full board.
- Per-move overrides.

Provide options such as “follow moving piece” and “include source and
destination.”

Transitions should use smooth acceleration and deceleration rather than
abrupt jumps or constant linear motion.

Allow me to adjust or disable automatic framing per move.

Save separate camera framing for landscape, vertical, and square output.

The same move timing and effects should remain shared across formats.

## 12. Subtle snow and atmosphere

The polished default should include small, faint white snow or dust particles.

Particles must be able to appear over the board, behind it, or in both places.
An opaque board must not hide the entire effect.

Controls:

- Density.
- Size range.
- Opacity.
- Speed.
- Drift.
- Direction.
- Softness.
- Color.
- Depth variation.
- Layer placement.
- Random seed.

Use a restrained default that does not obscure pieces.

Evaluate particles deterministically: the same project and timeline time should
produce the same result in preview and export, including after seeking.

Keep ambient snow separate from move-impact particles.

## 13. Music, beats, and sound

Allow me to import a local song.

Support:

- Audio playback synchronized with the timeline.
- A waveform.
- Volume and mute.
- Start offset.
- Trimming or selecting a music range.
- Fade-in and fade-out.
- Beat markers.

Detect likely beats automatically, but allow me to correct the results by
adding, deleting, and moving markers.

Where practical, distinguish ordinary beats from stronger accents.

Allow alignment to:

- Every beat.
- Every second or fourth beat.
- Only selected markers.
- A chosen strong beat for an important move.

Prioritize the **piece landing on the beat**.

A proposed automatic arrangement may adjust departure time, movement duration,
holds, and easing. It must preserve legal move order and respect reasonable
minimum and maximum durations.

Do not make a move absurdly fast merely to hit the nearest beat.

Allow preview before applying automatic timing, preserve manually locked timing,
and make the operation undoable.

Keep original music tempo unchanged initially.

Support optional move, landing, capture, and dramatic effect sounds. Provide
separate volume controls for music, ordinary chess sounds, and dramatic sounds.

Allow me to import and reuse my own sound files.

Use appropriately licensed default sounds.

## 14. Move classifications and badges

Suggest badges automatically while allowing manual overrides.

Use:

- Lichess Masters opening data for opening-book suggestions.
- Local Stockfish analysis for move-quality suggestions.
- My manual choices as the final override.

### Opening-book suggestions

Check the current Lichess Masters explorer API and its authentication
requirements. Do not assume a token is required.

I have used a token for related work, but I should enter any needed token
locally. Never put a token in the prompt, source code, project file, logs, or
public repository.

Store secrets using an appropriate Windows facility.

Support caching, request throttling, offline behavior, and clear failures.

Use a configurable minimum game count, optional frequency threshold, and
opening cutoff. One rare historical occurrence should not necessarily label a
move “book.”

Distinguish “not found,” “service unavailable,” and “not analyzed.”

### Stockfish suggestions

Run Stockfish locally in a background process.

Provide configurable analysis limits, progress, cancellation, caching, and
reasonable resource usage.

Normalize evaluations consistently and handle mate scores and terminal
positions.

Define and document the app’s rules for labels such as best, good,
inaccuracy, mistake, and blunder.

Stockfish does not directly supply Chess.com classifications. Treat
“brilliant” as a separately documented heuristic or a manual choice. Do not
claim that the app exactly reproduces Chess.com’s analysis.

A move may be known to the opening database and also receive a strong engine
evaluation. Preserve the underlying information even when one badge is shown.

Manual overrides always take priority and can be reverted.

Engine and opening analysis must not be required to edit or export.

### Badge appearance

Support book, brilliant, best, good, mistake, blunder, and other relevant
classification badges, plus custom text or symbols.

Provide position, offset, size, timing, entry and exit animation, opacity,
glow, and optional expanding ring.

Keep badges correctly anchored when pieces or the camera move.

## 15. Chess.com assets

I prefer the official Chess.com move-classification appearance where permitted.

The official resource article supplied for this project is:

https://www.chess.com/article/view/chess-com-brand-resources

The article says it wants to make it easy for creators to use Chess.com’s brand
in their content and includes Move Classifications resources.

Support importing the official assets as a **local asset pack**, preserving the
source and any accompanying usage guidance.

Do not assume the article grants unrestricted permission to redistribute the
files inside a public app repository.

Check the actual download guidance before bundling anything.

Provide functional alternative assets so the editor works without the official
pack.

Do not make resolving asset licensing a blocker for implementing the editor.

## 16. Timeline, seeking, and project behavior

Organize the timeline around chess moves and a few supporting tracks:

- Moves.
- Camera.
- Highlights and badges.
- Ambient and impact effects.
- Audio and beat markers.
- Intro scenes.
- Later cutaways and attachments.

Distinguish:

- Move-relative time.
- Absolute project time.
- Beat-anchored time.

Changing a move’s duration should preserve its internal animation shape where
appropriate and keep move-related effects attached to it.

Document how later events shift when timing changes.

Keep audio in its chosen place unless the user explicitly changes it.

Make automatic timing edits undoable.

Forward playback is the priority.

The Previous button may instantly restore the earlier chess position.
Elaborate reverse animations are not required.

Seeking backward or forward must still reconstruct the correct board, pieces,
camera, badges, particles, attachments, scene, and audio position.

The scene at a given timeline time must not depend on whether playback reached
that time naturally or through seeking.

Avoid relying entirely on chained timers that work only during continuous
forward playback.

## 17. Square compositions and format-specific layouts

Provide a genuine square 1080 × 1080 composition.

Also provide a 1080 × 1920 composition containing a square chess area. Let me
choose whether that square sits in the center, higher, or lower in the frame.

Allow the space around it to use:

- Black.
- Solid color.
- Gradient.
- Subtle snow or particles.
- Imported background image.
- Another supported visual treatment.

Preview the actual export boundaries in the editor.

Allow composition-specific camera overrides and layout choices while sharing
the underlying game and effect sequence.

Do not stretch the board to fill an incompatible aspect ratio.

Keep pieces and badges within a safe visible area when possible.

## 18. Intro scenes and the hinged board portal

Support optional intro scenes before the first chess move.

The desired reference is a chessboard portal or tunnel opening.

The reference appears to begin close to a chess square or an image/video inside
one. A square or panel then **swings inward like a hinged door**, revealing
depth. The camera travels through the opening, passing successive board-like
layers, and arrives at the playable chessboard.

The intro should have a seamless handoff into the actual starting position and
camera view. There should be no visible jump when the game begins.

Support an editable preset with controls for:

- Starting close-up.
- Starting square or embedded image/video.
- Door hinge side.
- Opening direction.
- Opening angle.
- Door timing and easing.
- Camera travel direction.
- Travel speed and easing.
- Number and spacing of board layers.
- Camera rotation.
- Particles.
- Optional motion blur.
- Music-beat alignment.
- Final board position and framing.

A simpler reusable intro framework should be considered early in the
architecture. The elaborate portal preset can be implemented after the first
release if necessary.

Do not claim the exact camera path can be recovered from the supplied stills.

Support imported media in the intro when the feature is implemented, without
bundling a creator’s video or likeness by default.

## 19. Cinematic cutaways

A later version should support short scenes that temporarily leave the normal
overhead board presentation.

A cutaway may show a piece as a character in a staged environment. It may use
a low camera angle, dramatic background, lighting, props, facial features,
particles, and synchronized sound.

The desired workflow:

1. Select a chess move or capture.
2. Insert a cutaway before, during, or after it.
3. Choose a subject piece.
4. Pick a scene preset.
5. Customize appearance, prop, camera, timing, and sound.
6. Transition back to the correct chess position.

Keep chess state consistent across the cutaway.

Support entering and leaving with a cut, zoom, or other deliberate transition.

The supplied rook reference is **animated**, not merely a still rook. It has
eyes, a mouth, changing pose, a prop, and a short action.

Plan for:

- Layered face and prop elements.
- Adjustable attachment points.
- Simple character actions.
- Imported animated clips later.
- Camera and lighting controls.
- Timed particles and effects.

A fully sculpted character system is not required.

The cutaway can use a board-like floor while being visually disconnected from
the ordinary top-down board scene.

## 20. Props, attachments, and animated actions

Plan for props and images attached to any piece.

A prop or meme may appear:

- On the piece.
- Next to it.
- Inside its square.
- Across part of a neighboring square.
- At a fixed point in the composition.

Do not clip every prop to its chess square.

Support controls for position, size, rotation, opacity, layer order, duration,
entry and exit, and anchoring behavior.

A prop may follow the piece’s position while remaining upright, or inherit
both position and rotation.

Later examples:

- A sword attached to a piece during a capture.
- Glowing red eyes on a knight.
- A short slash graphic.
- A meme next to a piece.
- A face or mouth added to a rook.
- A timed reaction image.

### Reload action

Include a later reusable short reload action, suitable for a rook holding a
stylized prop.

A basic version can use a small number of animated layers and a sequence of
original sound cues, such as a sliding sound and metallic clicks.

Controls should include:

- Overall duration.
- Prop position.
- Pivot and movement.
- Timing of each action stage.
- Sound cue timing.
- Sound volume.
- Replacement sound files.

An original shotgun-style reload sound is acceptable. Do not assume we need
the exact sound used in the reference video.

A more elaborate version can add moving hands, facial expression changes, and
prop perspective.

This is a later feature. It should not delay core chess playback and MP4
export.

## 21. Sound library

Provide a local sound library for reusable effect sounds.

Allow me to:

- Import a sound.
- Give it a clear name.
- Preview it.
- Assign it to a move, capture, cutaway, or action.
- Place multiple cues within one short action.
- Adjust timing and volume.
- Replace or remove a cue.

Keep source information where known.

Do not ship copyrighted music or a reference creator’s sound files without
appropriate permission.

## 22. OBS presentation window

Provide a clean window using the same composition as the editor preview.

It should:

- Exclude editor controls.
- Respect the chosen aspect ratio.
- Support fullscreen or borderless presentation where practical.
- Be controlled by the editor.
- Be easy to select as an OBS window source.

Editor handles, hover states, selection boxes, and debug information must not
appear in that output.

Keep preview and presentation playback synchronized.

Provide short instructions for capturing the window in OBS.

## 23. Direct MP4 export

Direct export is part of the first usable release.

Support:

- MP4.
- H.264 where available.
- 60 FPS.
- Landscape, vertical, and square output.
- Square composition inside vertical output.
- Imported music.
- Sound effects.
- Progress.
- Cancellation.
- Output-folder selection.
- Clear errors.

Render frames from exact timeline timestamps using the same animation
evaluation as preview.

Do not implement export by screen-recording the desktop.

Use bounded memory. Do not retain an entire video’s raw frames in RAM.

Use FFmpeg or another reliable encoding approach.

Detect hardware encoding availability rather than assuming it exists. Provide
a reliable software fallback.

Account for:

- Audio start offset.
- Audio mixing.
- Sound cues.
- End-of-project holds.
- Audio trimming.
- Accurate duration.
- Video and audio synchronization.

Cancellation should stop the work, clean temporary files, and preserve the
project. A partial file must not be reported as a successful export.

Handle missing encoders, insufficient disk space, and unsupported assets
clearly.

An image-sequence export is useful as a fallback or diagnostic option, but is
not completion of the MP4 requirement.

Check actual codec and binary redistribution terms before bundling FFmpeg.

Verify the output’s resolution, frame rate, duration, and audio. Do not claim
DaVinci Resolve or OBS compatibility without practical testing where
accessible.

## 24. Project files and recovery

Use a documented, versioned project format.

Save:

- Starting FEN.
- Move sequence and selected variation.
- Stable move and piece identities.
- Project style defaults.
- Per-move settings.
- Fine-tuning keyframes.
- Camera settings for each format.
- Highlights and badges.
- Book and engine suggestions with source information.
- Manual overrides.
- Particle seeds.
- Music and beat markers.
- Sound cues.
- Intro scenes.
- Later cutaways and attachments.
- Output settings.
- Asset references.

Support:

- New project.
- Open.
- Save.
- Save As.
- Recent projects.
- Autosave.
- Recovery after interruption.

Use safe project writes.

Prefer relative asset references and offer a way to collect external assets
into a portable project folder.

Keep tokens and other secrets out of project files.

Handle missing or moved assets gracefully and provide relinking.

Changing the PGN may invalidate move-specific effects. Detect this and offer a
clear way to preserve or reassign what can still be matched.

## 25. Logs and reliability

Add a rotating local activity log with an easy “Open logs” command.

Log useful events:

- App version and startup.
- Project open and save.
- Import errors.
- Missing assets.
- Book-service and engine failures.
- Renderer errors.
- Export settings and failures.

Do not log every rendered frame during ordinary operation.

Never log credentials.

Keep long-running engine analysis, audio analysis, imports, and export from
freezing the UI.

An invalid asset or effect should not crash the entire application.

Do not leave stale previews after a file has been deleted or moved.

## 26. Reference recipes and future direction

I will bring YouTube links, screenshots, contact sheets, video clips, and
descriptions of effects I like.

Store a compact, human-readable **reference recipe** for each studied effect
so future work does not depend on the entire chat history.

Each recipe should include:

- Name.
- Source link.
- Supporting file paths.
- Frame numbers and timestamps.
- Whether timestamps are video time or elapsed capture time.
- What is directly visible.
- What I report from watching the video.
- What is inferred.
- What remains unknown.
- Intended effect.
- Proposed adjustable controls.
- Implementation idea.
- Acceptance criteria.
- Asset source and known usage guidance.

Distinguish observations from guesses.

Sparse stills cannot establish exact rotation speed, motion path, easing, or
music synchronization.

If I provide a reference in several messages, wait until I say the sequence
is complete before finalizing its recipe.

Large batches may fail in a chat processing step. Work with smaller focused
sequences instead of requiring an entire video’s frames in one message.

Turn useful recipes into reusable presets and effects.

When comparing an implementation with a reference, say what was reproduced,
what remains approximate, and what additional evidence would improve it.

## 27. Existing references

Two different ZaveeCHESS editing-pack videos were identified in supplied HTML:

- https://www.youtube.com/watch?v=wDOUOIrNX9Q
- https://www.youtube.com/watch?v=Y2-Z-fYFkr0

Their descriptions discuss Alight Motion projects and editing elements such
as scenes, arrows, tiles, and analysis graphics.

The shared project contents have not been inspected. I could not access them
through the app after encountering a payment prompt.

Do not make Alight Motion or access to those projects a dependency.

Other supplied frames and descriptions show or report:

- Subtle white particles over the board.
- Pieces that turn and sometimes make a full rotation.
- A tilted pawn during movement.
- Camera framing that changes with the action.
- Glowing classification badges.
- Colored move highlights.
- A pawn that grows and glows during a capture.
- A board panel opening like a door.
- A camera traveling through successive board layers.
- A cinematic rook with a face and animated prop.
- Music-synchronized moves.

The stills do not establish the exact animation curves or sound timing.

Use them as creative and functional references, not as evidence of the
creator’s source code or exact settings.

## 28. First release versus later features

### First usable release must include

- A working Windows desktop editor.
- PGN and FEN input.
- Correct chess playback and seeking.
- A polished first-draft style.
- Thin illustrated pieces that can turn in 3D.
- Move presets and focused fine-tuning.
- Easing, rotation, scale, holds, and landing controls.
- Action-following camera with overrides.
- Landscape, vertical, and square compositions.
- Square presentation within vertical output.
- Subtle snow.
- Colored path squares and trails.
- Badges and manual overrides.
- Lichess Masters book suggestions.
- Local Stockfish suggestions with documented rules.
- Music import, beat detection, manual correction, and landing alignment.
- Optional move and capture sounds.
- Save/open, undo/redo, autosave, and recovery.
- Clean OBS presentation.
- Direct MP4 export with synchronized audio.
- Visible version and useful logs.

Opening and engine analysis must degrade gracefully when unavailable.

### Plan for later versions

- The elaborate hinged board portal intro.
- Additional cinematic intro presets.
- Cutaway scenes.
- Meme and prop attachments.
- Layered facial animation.
- Red-eye, slash, and reload presets.
- Imported animated clips.
- More advanced motion paths and curve editing.

Preserve room for later scenes in the project and rendering design.

Do not expose a later feature as though it already works.

Do not silently remove a first-release requirement and claim the release is
complete.

## 29. Implementation milestones

Use milestones that each leave the app runnable.

### A. Technical foundation

Prove:

- A board renders.
- A thin illustrated piece visibly turns.
- Seeking reconstructs the scene.
- Rendering a frame at an exact timeline time works.
- A short MP4 with synchronized audio can be produced.

Resolve architectural problems before building a large editor UI.

### B. Chess playback and project storage

Build the chess rules integration, PGN/FEN input, move list, playback,
seeking, basic timeline, and project save/open.

### C. Animation editing

Add presets, move inspector, fine-tuning keyframes, camera movement,
highlights, snow, badges, and undo/redo.

### D. Analysis

Add Lichess Masters suggestions, Stockfish suggestions, classification rules,
manual overrides, asset-pack support, and clear analysis status.

### E. Music and composition

Add waveform, beat detection, marker editing, landing alignment, square color
pulses, sounds, output-format layouts, and the OBS window.

### F. Export and release quality

Complete MP4 export, audio mixing, cancellation, recovery, Windows packaging,
sample project, documentation, and practical validation.

### G. Later cinematic features

Build the portal intro, cutaways, attachments, expressive character actions,
slash effects, and reload action as reusable scene components.

Do not stop at a plan or first milestone if implementation can continue.

## 30. Validation and sample project

Use meaningful tests and practical preview/export checks.

Cover:

- Captures, castling, en passant, and promotion.
- Terminal positions.
- Repeated playback.
- Backward seeking.
- Changing move duration.
- Badge overrides.
- Book and engine failures.
- Audio offsets.
- Beat-marker correction.
- Particle determinism.
- Missing assets.
- Save and reopen.
- Export cancellation.
- Video and audio synchronization.
- Framing in all output formats.

Create a sample project demonstrating:

1. A PGN loads.
2. The default animation plays.
3. One move slides cleanly.
4. Another reveals the piece’s thin edge during a full turn.
5. A dramatic move grows, slows, and lands on a beat.
6. A capture grows and glows, then returns to normal size.
7. Camera framing follows the action.
8. Snow remains subtle.
9. Path squares and a trail can each be enabled.
10. A badge appears at the right time.
11. Manual overrides survive reanalysis.
12. Beat markers can be corrected.
13. Dark squares pulse while light squares remain stable.
14. Seeking recreates the same scene.
15. The project survives saving and reopening.
16. Each format has appropriate framing.
17. MP4 export plays with synchronized audio.
18. The clean presentation window contains no editor UI.

When later cinematic features are implemented, add a sample showing the hinged
portal, a cutaway, and a short prop action.

Report what was actually tested. Do not infer Windows, OBS, GPU encoder, or
DaVinci Resolve compatibility from code inspection alone.

## 31. Delivery

Provide:

- Working source code.
- Straightforward Windows installation and launch instructions.
- A visible version number.
- A sample project.
- Original or appropriately licensed default assets.
- Clear third-party asset and dependency information.
- A short user guide.
- A reference-recipe template.
- Validation results.
- Known limitations.
- An honest list of unfinished requirements.

The intended result is a practical editor that starts with an attractive chess
animation, lets me refine individual moves precisely, exports finished videos,
and can grow into cinematic scenes inspired by future references.
## 31A. Repeatable Windows builds and delivery requirements

These requirements clarify Windows delivery and apply to every future change.

### A runnable app is part of delivery

- Build the Windows portable app for me. Do not require me to install Node.js, npm, Git, compilers, or run a source build.
- My preference is an unsigned portable app. Do not assume I want to obtain a signing certificate or disable Windows protections. Explain any platform restriction that prevents this preference from working.
- Use a documented, repeatable packaging process with pinned dependencies. Record the source commit, application version, Electron/runtime version, build environment, packaging configuration, and SHA-256 checksums for each artifact.
- Prefer a native Windows build environment for Windows release artifacts. A successful Linux cross-build is not evidence that the executable launches on Windows.
- Keep the last known-working download available unchanged. Record exactly which artifact the user successfully ran; do not infer this solely from an ambiguous version label or screenshot. If the exact build is uncertain, state that uncertainty.

### Version numbers, downloads, and change history

- Every new distributable must receive a new version number. Keep the application UI, executable metadata, package version, archive name, and release notes consistent.
- The filename supplied by the actual download server must contain the version, for example `Chess-Animation-Studio-0.1.8-Windows-Portable.zip`. Verify the downloaded filename; version text in a hyperlink alone is insufficient.
- Provide a direct, version-specific GitHub download. Preserve previous version links and never replace an existing version with different bytes.
- Follow Nocturne Chess's README presentation: consecutive entries beginning with **Download VERSION for Windows**, followed immediately by a clear description of that version's changes, actual validation, and relevant limitations. Keep the latest entry first.
- Use `main` for source and at most one maintained download branch if needed. Reuse that branch and preserve versions using tags or immutable artifacts; do not create a branch per build.

### Portable launcher and release verification

- Keep the portable launcher and packaging structure stable unless a demonstrated defect requires changing them. Keep launcher/build scripts in source control; do not depend on ad hoc scripts stored only in a temporary workspace.
- Make the build-to-download process reproducible with one documented command or workflow. Include all runtime files and assets, plus required notices.
- If GitHub's normal file-size limits require split files, provide a launcher that assembles them using absolute paths, verifies the complete artifact checksum, extracts it, and launches the correct executable. Handle missing parts, corrupt downloads, spaces in paths, and repeat launches with clear errors.
- Prefer ordinary versioned release assets or workflow artifacts where supported. If upload authentication fails, report the precise failure and use an agreed distribution method; do not silently proliferate branches or change the user's launch procedure.
- Before publishing, verify archive integrity and packaged runtime assets. When Windows execution is available, launch the packaged app from a fresh extraction, including a path containing spaces, and exercise the changed feature. Report exactly which checks ran and on which platform.
- Do not call a release "working on Windows" based on compilation, archive checks, Linux tests, or the user's successful launch of an older build.

### Diagnose blocked launches before changing the app

- An archive that verifies and extracts successfully has passed those stages. An Application Control failure at executable launch is a separate issue.
- Use the exact Windows error and CodeIntegrity event details to identify the blocked file and policy. Do not blame PNG/SVG assets, animation changes, ZIP layout, or the launcher without supporting evidence.
- Compare a blocked artifact with the exact known-working artifact: executable hash and signature, runtime version, executable resource edits, dependencies, packaging flags, and launch procedure. Document material differences before proposing another build.
- Do not repeatedly repackage unchanged unsigned executables and imply this will solve a signing-policy block. Do not remove requested features as a speculative fix.
- Do not strip download security metadata, modify application-control policies, or disable security features as part of the launcher or build process.
- Explain that unsigned software cannot be guaranteed to pass Smart App Control or other Windows policies. If compliance requires signing or another deployment route, explain the constraint honestly rather than promising a packaging-only fix.
- If the user chooses to change Windows security settings, explain the actual consequences first, including any restrictions on re-enabling the setting. Never make that choice for them.
