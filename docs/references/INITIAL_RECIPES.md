# Initial reference recipes

Source links from the product brief: https://www.youtube.com/watch?v=wDOUOIrNX9Q and https://www.youtube.com/watch?v=Y2-Z-fYFkr0. Their shared project files were not inspected. No video frames/clips were attached in this coding task, and no frame timestamps or exact source settings are known. The authoritative description is [PRODUCT_BRIEF.md](../PRODUCT_BRIEF.md).

## Thin illustrated turn

User reports flat illustrated pieces turning out of plane and sometimes completing a full rotation. No supplied still sequence was measured. Implementation: original extruded cut-out silhouettes, procedural illustrations on both faces, solid thin side material, deterministic axis/degrees/easing/settle controls and optional normalized rotation keys. Acceptance: the edge is visible near 90°, the reverse at 180°, the correct piece finishes at its destination, and repeated/backward seeks reproduce the same frame. This is implemented; its timing is an original preset, not recovered video timing. Artwork is original MIT.

## Capture growth and cyan glow

User reports a capturing piece arriving, suddenly expanding/engulfing the captured piece, glowing, then settling. The brief describes a bright pawn and cyan still; that still itself was not available to inspect here. Implementation: separate arrival, growth peak, expansion window, captured-piece exit phase, radius/color/strength pulse, size return easing and optional seeded radial impact particles. Landing can be beat aligned. Acceptance: captured subject—including an en passant pawn—disappears correctly, the attacker returns to normal at the correct square, and seeking/export agree. Implemented with original parameter values; expansion speed and sound synchronization were not measured from a reference.

## Restrained snow and follow camera

User reports faint white particles over the board and action-following framing. Implementation: seeded time-evaluated particles in front/behind, restrained route framing by default, optional direct follow/manual/format-specific camera keys. Acceptance: pieces remain readable, an opaque board does not hide all particles, and camera/particles reconstruct after backward seeking. Implemented; exact reference trajectories and density remain unknown.

## Hinged portal, cinematic rook and reload action — deferred

User describes an inward-swinging board panel, travel through successive board layers, and an animated rook with face, pose, prop and timed reload/sliding/click sounds. These are later features, not implemented controls. No exact camera path, attachment geometry, sound timing or licensed creator media is available. Reserve versioned scene extensions and a deterministic handoff to legal board state; later implementation must add dedicated scenes, local media references, attachment/action layers and synchronized cues. Acceptance must include a seamless correct-position return and the same result on seek/export. Do not claim a static rook reproduces the reported animation. Use original or permitted assets and sounds, not an extracted creator pack.
