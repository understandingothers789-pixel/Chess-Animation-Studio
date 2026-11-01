/** Explanations shared by hover tooltips and accessible control descriptions. */
const help: Record<string, string> = {
  "Capture camera shake":
    "Add a short, deterministic camera tremor at the capture impact phase. Zero disables it; range 0–1.",
  "Capture light pulse":
    "Add a brief light accent synchronized to capture impact. Zero disables it; range 0–1.",
  "Horse sound for knight moves":
    "Play a horse sound when a knight lands, in previews and exports.",
  "Show evaluation bar":
    "Display the latest available Stockfish evaluation on the left of the video.",
  "Show animated title":
    "Display the animated title during the intro, independently of the board opener.",
  "Attacking piece": "Choose the piece that launches the spear in the intro.",
  "Game close-up width (all moves)":
    "Set the visible width in board squares for every move using game close-up.",
  "Beat spotlight":
    "Hold on the moved piece after landing and play a beat-synced zoom-and-visual transition. Disabling removes its automatic extra hold.",
  "Spotlight beat source":
    "Use two or more enabled music markers within the spotlight window; otherwise use the BPM grid. BPM grid always uses the chosen tempo.",
  "Spotlight primary color":
    "Main color for the spotlight glow, board pulses and visual accents.",
  "Spotlight secondary color":
    "Alternate accent color after the chosen number of beats.",
  "Spotlight duration":
    "Seconds reserved after the move finishes for the spotlight. Music continues and later moves shift.",
  "Spotlight BPM":
    "Tempo of the fallback or forced BPM grid. Marker mode follows corrected project beat times instead.",
  "Spotlight beat offset":
    "Seconds from spotlight start to the first BPM hit. Negative values advance the grid. Music markers keep their own timing.",
  "Beat zoom rhythm":
    "Alternate a close and wider view on successive beats, or punch in on every beat and relax between hits.",
  "Beat zoom amount":
    "Amount of camera magnification between the close and wider beat poses. Zero disables zoom pumping.",
  "Beat camera rock":
    "Maximum added camera roll in degrees, alternating with the beats.",
  "Spotlight focus":
    "How strongly the camera centers on the moved piece during the spotlight.",
  "Beats per color":
    "Number of beats before switching between the primary and secondary accent colors.",
  "Beat color strength":
    "Amount of temporary board-square and wash tint on the beat. Saved board colors stay intact.",
  "Spotlight glow":
    "Strength of the halo and expanding ring behind the highlighted piece.",
  "Spotlight sparkles":
    "Number of small particles bursting outward from the spotlight on each beat. Zero disables them.",
  "Beat shake":
    "Small camera jolts on beat hits, in board-square units. Zero keeps the framing steady apart from zoom and roll.",
  "Beat zoom blur":
    "Strength of the radial zoom blur at beat hits. Zero keeps the picture sharp.",
  "Beat light flash":
    "Brief brightness lift on each beat. Zero removes the light flash.",
  "Spotlight desaturation":
    "Temporarily mute the board colors while the colored spotlight stands out.",
  "Spotlight vignette":
    "Darken the edges around the spotlight during the transition.",
  "Move light wash":
    "Tint the board and pieces during this move. Applies to the selected moves; disabled by default.",
  "Move light color":
    "Color of the move's lighting wash. Red is the starting look; any color can be chosen.",
  "Match move highlights":
    "Temporarily use the wash color for this move's square highlights without changing their saved colors.",
  "Move light strength":
    "Maximum opacity of the colored light wash. Lower values keep the original board colors more visible.",
  "Move light flicker":
    "Depth of the light variation. Zero gives steady lighting; higher values vary the wash while the board stays visible.",
  "Move flicker speed":
    "Base flicker frequency in cycles per second (Hz). A second gentle rhythm adds variation.",
  "Move light fade in":
    "Seconds used to bring the wash in after the piece starts moving.",
  "Move light hold":
    "Seconds to keep the wash after the piece finishes its move before fading it out.",
  "Move light fade out":
    "Seconds used to return from the colored wash to the normal board lighting.",
  "Dust duration":
    "Seconds for captured-piece fragments to disperse and fade, including a tail after the move ends.",
  "Dust amount":
    "Number of fragments sampled from the captured piece's silhouette and colors.",
  "Dust spread":
    "How far captured-piece fragments drift outward and downward before disappearing.",
  "Dust fragment size":
    "Size of the individual dust flecks. Their colors come from the captured artwork.",
  "Shorts tracking strength":
    "How strongly move cameras steer the crop. Lower values keep more board context; higher values move closer to the action.",
  "Shorts crop":
    "Use a 9:16 portrait close-up with the outer files cropped off and clean space above and below the board.",
  "Follow action in Shorts":
    "Smoothly reframe using each move's camera route. Turn off to keep the crop centered; layout offsets still apply.",
  "Visible board width":
    "Board squares visible across the crop at camera zoom 1. Lower values make the pieces larger and crop more files.",
  "Shorts board height":
    "Fraction of the portrait frame occupied by the board window. 0.72 leaves 28% for the surrounding bars.",
  "Shorts board position":
    "Vertical position of the board window: 0 is top, 0.5 is centered, 1 is bottom.",
  "Shorts bar color":
    "Solid color of the space above and below the cropped board. Defaults to black.",
  "Maximum depth":
    "Maximum Stockfish search depth per position; higher values can take longer.",
  Variation:
    "Choose the PGN line to edit; alternate lines keep their legal move order.",
  "Composition name": "Name shown in the editor and saved project.",
  "Project title": "Name shown in the editor and saved project.",
  "Game text":
    "Paste PGN for a game or FEN for a starting position, then import it.",
  "Preserve matching move effects":
    "Keep effects on the unchanged prefix when importing another game.",
  "Promote pawn to":
    "Choose the promotion piece for legal moves entered on the board.",
  "Apply style to":
    "Choose whether a style affects the active move, checked moves, or the whole game.",
  "Move preset":
    "Apply a motion preset to every selected move, preserving individual badges and cameras.",
  Duration:
    "Length of the selected move animation in seconds; later moves shift accordingly.",
  Intensity:
    "Scale the strength of the move animation. Zero removes its extra motion.",
  Easing:
    "Control how the animation accelerates and slows between its endpoints.",
  "Turn axis":
    "Choose the axis for piece rotation: x/y tip the piece; z turns it in the board plane.",
  Rotation: "Total piece turn in degrees during this move.",
  "Sway angle":
    "Maximum rocking angle in degrees. Larger values make the lean more pronounced.",
  "Sway cycles":
    "Number of rocking cycles. 0.5 makes a single lean and return; 1 rocks both ways.",
  "Hop height": "How far the moving piece lifts above the board.",
  "Maximum size":
    "Largest piece scale during the move. 1 keeps its normal size.",
  "Curved path":
    "Bend the move route to one side; negative values bend the other way.",
  Overshoot:
    "How far the piece travels past its destination before settling back.",
  "Departure delay": "Wait before the piece begins moving, in seconds.",
  "Hold after move":
    "Pause after this move before the next move begins, in seconds.",
  "Landing phase":
    "Fraction of the animation when the piece reaches its destination (0\u20131).",
  "Settle window": "Fraction of the animation used to settle after landing.",
  "Size peak phase":
    "Fraction of the animation when the piece reaches its maximum size.",
  "Lock timing":
    "Keep this move's timing fixed when automatically aligning landings to beats.",
  "Landing beat":
    "Choose a specific enabled beat marker for this move's landing alignment.",
  "Capture size": "Maximum growth of the capturing piece during the impact.",
  "Expansion window":
    "Fraction of the move spent growing toward the capture impact.",
  "Return window":
    "Fraction of the move used to return the capturing piece to normal size.",
  "Impact phase": "Fraction of the move when the capture burst and glow peak.",
  "Captured exit phase":
    "Fraction of the move when the captured piece starts disappearing.",
  "Glow strength": "Brightness of the capture glow; zero removes it.",
  "Glow radius": "Size of the capture glow around the impact square.",
  "Capture glow": "Color of the capture impact light.",
  "Captured piece exit":
    "Choose how the captured piece disappears from the board.",
  "Impact particles": "Show a short particle burst at a capture impact.",
  "Preset name":
    "Name the current effect before saving it as a reusable preset.",
  "Camera framing":
    "Frame the full board, follow the moving piece, include its route, or use manual framing.",
  "Pan X": "Move the camera framing horizontally in board-square units.",
  "Pan Y": "Move the camera framing vertically in board-square units.",
  "Camera zoom": "Magnify or shrink the board within this output format.",
  "Camera tilt":
    "Tilt the camera away from a straight overhead view, in degrees.",
  "Camera roll": "Rotate the board framing in the image plane, in degrees.",
  "Framing padding":
    "Extra space around the route when automatically framing a move.",
  "Camera transition":
    "Fraction of the move used to blend into this camera framing.",
  "Source square": "Highlight the square the piece leaves.",
  "Destination square": "Highlight the square the piece lands on.",
  "Route squares": "Highlight squares along the moving piece's route.",
  "Motion trail": "Draw a fading ribbon behind the moving piece.",
  "Persist after landing":
    "Keep the move's highlights visible after the piece lands.",
  "source color": "Color of the departure-square highlight.",
  "destination color": "Color of the landing-square highlight.",
  "path color": "Color of the route highlights and trail.",
  "Trail width": "Width of the ribbon drawn behind a moving piece.",
  "Highlight glow": "Strength of the light surrounding highlighted squares.",
  "Highlight opacity":
    "Visibility of the move highlights; lower is more transparent.",
  "Highlight reveal phase":
    "Fraction of the move when its highlights begin appearing.",
  "Highlight fade":
    "Time in seconds for nonpersistent highlights to disappear after the move.",
  "Badge override":
    "Choose a manual move badge or allow analysis to supply one.",
  "Custom badge text":
    "Optional short text shown instead of the badge symbol (up to 12 characters).",
  "Badge size": "Scale of the badge near the destination square.",
  "Badge opacity": "Visibility of the badge; lower is more transparent.",
  "Badge offset X":
    "Move the badge horizontally relative to the destination square.",
  "Badge offset Y":
    "Move the badge vertically relative to the destination square.",
  "Badge entry phase": "Fraction of the move when the badge starts appearing.",
  "Badge hold after move":
    "Extra time in seconds that the badge remains after the move.",
  "Badge glow": "Brightness of the halo behind the badge.",
  "Badge entry": "Choose how the badge animates into view.",
  "Expanding ring": "Show an expanding light ring when the badge appears.",
  "Keyframe channel":
    "Choose a motion channel: travel = route progress; x/y/z = piece offsets; rx/ry/rz = rotation in degrees; scale/opacity = size/visibility; cameraX/Y/Zoom = framing.",
  "Mute music":
    "Silence the soundtrack in preview and export without removing it.",
  "Lock beat markers":
    "Prevent accidental dragging, keyboard edits, adding, deleting or changing beat markers. Unlock to edit them again.",
  "Use different colors for White and Black":
    "Use separate highlight colors based on which side moves. Turn this off to choose source, destination and route colors separately.",
  "White move color": "Color for highlights on moves made by White.",
  "Black move color": "Color for highlights on moves made by Black.",
  "Music volume":
    "Soundtrack gain. 1 is its original level; values above 1 amplify it.",
  "Project start offset":
    "Project time in seconds when trimmed music starts; negative values start it earlier.",
  "Source trim start":
    "Skip this many seconds from the beginning of the imported music.",
  "Source trim end (0 = full)":
    "Stop at this source time in seconds. 0 uses the full source track.",
  "Fade in": "Seconds used to gradually raise music volume at its start.",
  "Fade out": "Seconds used to gradually lower music volume at its end.",
  "Use markers":
    "Choose which enabled beat markers are considered when proposing move timing.",
  "Enable beat":
    "Include this marker in beat alignment and marker-driven board pulses.",
  "Beat time":
    "Marker position in project seconds; moving it also corrects its source time when available.",
  "Beat accent":
    "Mark this beat as a strong accent for accent-only alignment and pulses.",
  "Automatic move & capture cues":
    "Generate the built-in move and capture sounds at piece landings.",
  "Chess sounds volume":
    "Gain of the chess-sound bus, including automatic move/capture cues.",
  "Effect sounds volume":
    "Gain of the effect-sound bus for assigned sound effects.",
  "Sound to assign":
    "Choose an imported audio asset to attach to a move landing.",
  "Cue offset":
    "Seconds before (negative) or after (positive) the assigned move's landing.",
  "Cue volume":
    "Gain of this individual sound cue before its bus volume is applied.",
  "Sound bus": "Route this cue through the chess or effect volume control.",
  "Inside board only":
    "Clip snow to the visible board. Turn off to allow flakes in the surrounding scene.",
  "Ambient particles":
    "Show the continuous snow effect in preview, presentation and export.",
  "Particle layer":
    "Place snow in front of pieces, behind the board, or split it between both layers.",
  "Particle count":
    "Number of snowflakes to draw (0\u2013400). Increase for denser snow.",
  "Particle size":
    "Base flake size. Larger values make the snow more prominent; size follows board zoom.",
  "Particle opacity":
    "Flake visibility from 0 to 1. Lower values make snow more transparent.",
  "Particle speed":
    "Speed at which snow moves down the board. 0 stops the falling motion.",
  "Particle drift": "Strength of the snow's gentle side-to-side motion.",
  "Particle direction":
    "Horizontal wind direction and speed. Negative values blow the other way.",
  "Particle depth": "Spread of snow in front of or behind the board plane.",
  "Particle softness":
    "Softness of each flake's edge; higher values produce a gentler fade.",
  "Particle seed":
    "Choose a repeatable snow pattern; the same seed and time give the same result.",
  "Particle color": "Tint of the ambient snowflakes.",
  "Piece artwork":
    "Choose the chess-piece artwork set used in preview and export.",
  "Light squares": "Base light-square color. The app default is beige #EDD6B0.",
  "Dark squares":
    "Base dark-square color. The app default is brown #B88762; pulses can temporarily tint it.",
  "Board rim": "Color of the narrow frame around the chessboard.",
  Background: "Base color of the space surrounding the board.",
  Accent:
    "Shared accent color for halos and rim light when they have no separate color override.",
  Orientation:
    "Choose whether White's or Black's side faces the bottom of the board.",
  "Board coordinates": "Show file letters and rank numbers around the board.",
  "Background treatment":
    "Choose a solid, gradient, particle or imported-image background for this output format.",
  "Layout X": "Horizontal placement of the board in the current output format.",
  "Layout Y": "Vertical placement of the board in the current output format.",
  "Layout zoom":
    "Base board size for the current output format, combined with move camera settings.",
  "Board effects":
    "Enable lighting shimmer, rim breathing, light sweep, vignette breathing and tempo pulses.",
  "Zoom-and-turn intro":
    "Enable the chosen board opener before the first move; choose its preset on the Intro clip.",
  "Intro lead-in":
    "Time in seconds before the first move. This is the length of the Intro clip.",
  "Animate intro":
    "Animate the board during the Intro clip; disabling this leaves a still opening hold.",
  "Opener preset":
    "Choose Zoom & turn, Gentle zoom, Board turn or Still board before the first move.",
  "Intro clip length":
    "Seconds before the first move. Any time left after the opener animation is a still hold.",
  "Opener animation length":
    "Seconds used for the opening animation; extending it also extends the Intro clip.",
  "Opener starting size":
    "Initial board zoom for a zooming opener. Smaller values start farther away.",
  "Opener turn":
    "Initial board turn in degrees. Negative values turn in the opposite direction.",
  "Dark-square tempo pulses":
    "Pulse dark-square colors at a regular BPM, independently of music beat markers.",
  "Lighting tint":
    "Tint blended into board squares by the subtle lighting effect.",
  "Rim light color": "Color of the breathing light around the board's rim.",
  "Sweep color": "Color of the traveling light passing across the board.",
  "Vignette color":
    "Color blended into the background edges by the breathing vignette.",
  "Tempo pulse color":
    "Color toward which dark squares move on regular tempo beats.",
  "Lighting shimmer":
    "Amount of gentle brightness variation. Even the maximum keeps the board lit.",
  "Shimmer speed": "How quickly the subtle lighting variation changes.",
  "Intro duration":
    "Seconds used by the opening animation; extending it extends the Intro clip if needed.",
  "Intro starting size":
    "Initial board zoom before the opener reaches normal framing.",
  "Intro turn degrees": "Initial rotation of a turning opener, in degrees.",
  "Pulse BPM":
    "Regular color-pulse tempo in beats per minute; this does not analyze or retime the music.",
  "Pulse strength": "How strongly regular tempo pulses tint the dark squares.",
  "Pulse decay":
    "Seconds used for a color pulse to fade back toward the base square color.",
  "Breathing rim light":
    "Strength of the slowly brightening and dimming rim light.",
  "Rim breathing speed": "How quickly the rim light brightens and dims.",
  "Light sweep strength":
    "Strength of the traveling wash of light over board squares.",
  "Light sweep speed": "How quickly the light sweep travels across the board.",
  "Vignette breathing":
    "Strength of the breathing tint at the background edges.",
  "Vignette speed": "How quickly the background-edge tint breathes.",
  "Pulse dark squares":
    "Pulse dark-square colors from enabled music beat markers.",
  "Accents only":
    "Use only beat markers marked as accents for marker-driven color pulses.",
  "Pulse color": "Tint applied to dark squares at enabled music beat markers.",
  "Pulse intensity": "Strength of the music-marker-driven dark-square tint.",
  "Pulse attack":
    "Seconds used to brighten toward a marker-driven color pulse.",
  "Badge to replace":
    "Choose the badge symbol whose artwork you want to replace with a local image.",
  Analyze:
    "Choose the active move, checked moves or whole game for analysis suggestions.",
  "Engine depth":
    "Maximum Stockfish search depth per position; higher values can take longer.",
  "Time per position":
    "Maximum engine search time per position, in milliseconds.",
  "Engine threads":
    "CPU threads allocated to Stockfish. Higher values use more processor capacity.",
  "Engine hash MB":
    "Memory in megabytes allocated to Stockfish's transposition table.",
  "Minimum Masters games":
    "Minimum number of database games needed before suggesting an opening-book badge.",
  "Minimum book frequency":
    "Minimum fraction of database games that played a move before it qualifies as book.",
  "Opening cutoff (plies)":
    "Stop considering book badges after this many half-moves.",
  "Video encoder":
    "Probe available hardware encoding or force software H.264; unavailable hardware falls back to software.",
  "Masters token":
    "Optional local credential for Masters database requests. Stored outside projects and logs.",
  "Asset name":
    "Display name of an imported asset; does not rename its source file.",
  "Output format":
    "Choose landscape, vertical, Shorts cropped-board, square or square-in-vertical framing for preview and export.",
  "Export start": "First project time to render, in seconds.",
  "Export end":
    "Last project time to render, in seconds; it must be later than Export start.",
  "Seek composition":
    "Scrub to an exact project time without changing move timings.",
  "Timeline zoom":
    "Change the timeline's horizontal scale; this does not change the video camera or duration.",
};
export function settingHelp(label: string): string {
  if (help[label]) return help[label];
  if (/^(Snow|Pulse) rainbow$/.test(label))
    return "Cycle smoothly through your chosen colors during the video; disable for a single color.";
  if (/^(Snow|Pulse) color cycle length$/.test(label))
    return "Seconds for one full cycle through the enabled colors.";
  if (/^(Snow|Pulse) color [1-6] enabled$/.test(label))
    return "Include this color in the cycle; disable it to skip the color.";
  if (/^(Snow|Pulse) color [1-6]$/.test(label))
    return "Choose this color for the cycle, including darker shades.";
  if (label === "Color moves by review")
    return "Color destination and route squares by their review badge; source squares retain the mover color.";
  if (
    /^Review (book|brilliant|best|good|inaccuracy|mistake|blunder) color$/.test(
      label,
    )
  )
    return "Color for destination and route squares with this review badge.";
  if (/^Check move /.test(label))
    return "Include this move in batch edits. Ctrl-click toggles moves; Shift-click selects a range.";
  if (/^Key \d+ time$/.test(label))
    return "Keyframe time as a fraction of this move, from 0 (start) to 1 (end).";
  if (/^Key \d+ value$/.test(label))
    return "Value of the selected motion channel at this keyframe.";
  if (/^Key \d+ easing$/.test(label))
    return "How this keyframe blends toward the next keyframe.";
  return "Adjust " + label.toLowerCase() + " for this composition.";
}
