# 0.2.33 — Visual composition and storyboard transitions

## A. Executive summary

Direct text selection uses the actual renderer's visible geometry, including animated entrance scaling. Multiple text layers share the existing annotation model and one synchronized inspector. Dragging, width resizing, keyboard nudging, duplication and stacking use the established history system. Incoming cross-dissolve and fade-through-black transitions blend completed frames without changing the chess game, shot durations or soundtrack.

## B. Git verification

Initial development HEAD: `17cc0866ff426dce6ac4e6f88a8f74226ad13efa`. Branch: `architecture/effect-compositor`. Startup working tree was clean and remote HEAD matched. No branches, tags, releases, merges, resets or force pushes were created. Final source, remote verification and protected references are recorded below after validation.

## C–F. Visual selection, manipulation, layers and captions

`AnnotationSystem.bounds` exposes the same rectangles used for text rendering and hit testing. `Scene.textGeometry()` normalizes those bounds into output coordinates; `TextComposition` draws editor-only targets inside the same transformed preview container. Pointer deltas are divided by that container's transformed client rectangle, so zoom, pan, device pixel ratio and preview resizing use one coordinate mapping. DOM ordering follows renderer ordering; later text wins overlaps.

Click any visible text to select it. Drag its body to move it; drag its right-side handle to change wrapping width. Font size and scale remain independent. Alt bypasses snapping; arrows nudge by 0.5% of frame, Alt by 0.1%, Shift by 2%. Center and configured safe-area anchor snapping use a 1.2% tolerance. Each pointer gesture begins and ends one history transaction, including cancellation or lost capture.

The shot inspector lists all text layers and edits the selected annotation. Add text/caption, duplicate, delete and change stacking there. Common caption layout remains in `CaptionControls`; wrapping, readable auto-sizing, presets and overflow warnings retain the existing shared engine. Source and shot-local ownership remain separate. Clicking inherited source text or the outgoing image of a transition explains why it is read-only in the current shot; edit its owner or add local text.

Selection targets and handles exist only in the editor DOM. PNG, presentation and MP4 rendering do not receive those controls. Existing board picking, annotations, panning, fullscreen and context menus retain their paths. Text context menus reuse the existing framework and add horizontal centering and position reset.

## G–I. Transition architecture and parity

`transitionSchema` stores incoming type, duration and linear/smooth easing on each shot. Cut/zero duration is the default. The first shot has no incoming controls and ignores any transition retained after reordering. Duration must fit within the destination shot; shot resizing clamps it.

`transitionAt()` is the authoritative output-time calculation. A transition occupies the beginning of its destination shot without overlap subtraction. The outgoing shot is frozen at its final instant (`boundary − 0.0000001s`); the incoming shot advances normally. Consecutive transitions do not recursively blend earlier transitions. Positions are evaluated through the existing legal storyboard projection, never interpolated between unrelated boards.

`Scene.render()` invokes the existing full render graph twice only inside a transition. `TransitionSystem` copies the two completed default-framebuffer images to reusable framebuffer textures and composites one screen quad using the same WebGL renderer. This retains existing bloom/framebuffer assumptions. Captures are decoded from sRGB, blended in linear light, and encoded once. Cross-dissolve mixes both images; fade-through-black reaches black halfway through its interval. Targets resize/dispose with the scene. A direct seek needs no previous frame history.

All callers—preview, fullscreen, presentation, thumbnail, PNG and export—use `Scene.render()`. The inspector offers type/duration/easing and a bounded Preview transition action. Shot cards identify configured transitions.

## J. Audio correctness

Transitions do not modify the source/output clock mapping. Continuous music, offsets, beats, per-shot ducking and mapped chess cues retain their existing paths. Pure tests compare duck envelopes and audio events with/without visual transitions. Real export fixtures include a ducked shot and verify decoded AAC remains audible across cuts. The dedicated ducking suite separately measures its gain envelope and independent capture cues.

## K. Reviewed visual evidence

Actual application screenshots are stored here: selected layers, dragging, resizing, safe guides, narrow workspace, transition controls and midpoints, landscape, square at preview zoom, fullscreen and 150% UI scale. The two standalone midpoint PNGs come from the actual shared compositor, not mockups. Captures were reviewed for selection alignment, wrapping, readable controls and clipping. Physical Windows/GPU appearance is not inferred from Linux SwiftShader captures.

## L–N. Tests, encoded output and performance

Validation results and measured values are finalized below. `npm run test:composition` runs real UI interactions followed by shared-compositor → VideoJob → H.264/AAC checks, including decoded video comparison. Synthetic compositions use legal sample moves, a title, legal hold, reordered highlights, multiple captions, transitions, music and ducking. Export cases cover landscape/vertical and 24/30/60 FPS. Existing suites cover repeated shots, arrows/circles, other formats, cancellation and source correctness.

Independent midpoint analysis compares cross-dissolve pixels against an sRGB decode → linear blend → sRGB encode reference. Seeking out of order must produce identical uncompressed bytes. Fade midpoint must be black. Lossy decoded frames use the existing justified error tolerance. Resource allocation is lazy; no second WebGL context is introduced and ordinary cuts do not render twice. Measurements use software rendering and are not physical GPU performance claims.

## O. Known limitations

Text is selected one layer at a time; simultaneous group selection is not implemented. Resizing changes horizontal wrapping width, not a freely scalable graphic or box height. Inherited/outgoing text is read-only in the current shot and has no automatic clone command. No transition audio crossfade is applied; continuous music and ducking follow output time. The previous image intentionally holds its final state. Full-frame dual rendering costs more during transitions; very large outputs need two additional RGBA framebuffer copies. Social safe areas remain configurable approximations. Native hardware microphone/GPU testing is outside the automated checks.

## P. Five next improvements

1. Group text selection, alignment and distribution.
2. Explicit clone-to-shot action for inherited annotations.
3. Keyframed text transforms and reusable multi-layer templates.
4. Transition thumbnails and optional audio crossfades with explicit policies.
5. Physical GPU performance profiling at 1080p/4K across supported systems.

## Q–R. Windows download and final status

The previously validated 0.2.32 artifact was rechecked and its missing README entry restored. The 0.2.33 download will be advertised only after the existing workflow and expanded packaged validation pass. Final validation results follow in the completion record.
