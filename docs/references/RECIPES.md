# Reference recipes

## Slow sway

Evidence: user-supplied contact-sheet sequence in the conversation, with frames at approximately 1.516, 1.766, 2.016, 2.281, 2.531 and 2.766 elapsed seconds; additional frames at 3.016 and 3.250. These are elapsed capture labels, not a measured source-video animation curve. User reports a slow lean one way then the other, satisfying rather than rapidly wiggling. Visible stills show broad in-plane leans and changing camera framing. Exact pivots, easing and cycle timing are unknown.

Implementation: one eased normalized cycle, +24° at 25%, −24° at 75%, upright endpoints, default duration 2.2s. This is a chosen starting recipe, not an exact measured reproduction. Angle, cycle count, duration and keys are editable. Acceptance: smooth reversals, no rapid travel-easing burst, upright finish and exact backward-seek reconstruction.

## Capture growth and glow

Evidence: description of a pawn expanding and glowing cyan during capture; exact timing not established by the still. Implementation: configurable expansion window, peak, return window, glow/radius, captured-piece exit and optional impact particles. Badge art, path highlights and audio are independently editable. Acceptance: captured identity disappears correctly and the capturer returns to legal size/orientation.

## Later portal and character cutaway

Evidence: user descriptions of a hinged square, successive board layers, a rook with face/prop actions and synchronized sound. Implementation deferred until core delivery is established; no nonfunctional controls are exposed. Future recipes must record source links, frames, direct observations, inferences, unknowns, controls, acceptance criteria and usage guidance.
