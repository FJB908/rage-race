# Arena themes (ideas only, nothing built yet)

The trophy count already puts every player in one of 10 arenas (see TROPHIES.md). Right now an arena is only a name and a place on the road. The idea: **an arena is a theme plus exactly one signature rule**, so that climbing feels like going somewhere new and not like a number going up.

## Principles
1. **One rule per arena, easy to read.** A player should understand it after one race, from what they see, not from a tooltip.
2. **It is the same for all four players.** Never an advantage for someone; no cosmetic or item gating.
3. **Telegraph everything.** A hazard shows what it will do 1 second before it does it (the quake already works like this).
4. **Cheap to draw.** The sky, the platform colours and the ambient effects are pre-rendered sprites or a few gradients; nothing new per frame. (Keep the zero-lag rule.)
5. **Each arena adds, never replaces.** Arena 7 has its own rule plus a milder version of the rules before it, so the game slowly gets richer.

## The ten arenas
| # | Arena | Look | Signature rule | How it plays |
|---|---|---|---|---|
| 1 | **Playground** (0) | bright sand and sky, soft shadows, toy-like blocks | none (the clean game) | wide platforms, no hazards: learn the jump |
| 2 | **Parking Lot** (150) | grey concrete, painted lines, yellow cones, a flickering street lamp | **Oil patches**: some platforms are slippery (you slide a little after landing) | landing needs a bit more care, a darker shiny platform tells you |
| 3 | **Rooftop** (400) | orange sunset skyline, antennas, water towers, pigeons | **Gusts**: every 10 s a gust pushes everyone sideways for 1.5 s (visible streaks first) | time your jumps between gusts; the side walls matter |
| 4 | **Harbour** (800) | blue night, cranes, crates, fog horn, water at the bottom | **Floating docks**: platforms bob up and down slowly | you aim at where the dock will be, not where it is |
| 5 | **Factory** (1300) | steel and amber, sparks, gears turning in the back | **Conveyor belts**: some platforms carry you left or right; **pistons** retract platforms on a beat | rhythm: a visible drum beat in the music sets the piston timing |
| 6 | **Subway** (1900) | green tiles, flickering lights, rails, wet floor | **Trains**: a warning light and a rumble, then a train crosses the track at one height and knocks anyone in its way | you check the light before you jump into a lane |
| 7 | **Mountain** (2600) | cold blue and white, snow, breath fog, wind | **Thin ice**: platforms crack and drop 1.2 s after you land | no standing still; every platform is a short rest |
| 8 | **Space Station** (3500) | dark with stars, glass and white panels, a slow planet in the back | **Low gravity bands**: horizontal bands where jumps float (longer air time, slower fall) | big jumps, but the landing is harder to judge |
| 9 | **Volcano** (4600) | black rock, red glow, ash falling | **Rising lava** from below, slowly (like Escape): stay above it | racing and surviving at the same time; the leader is safe, the last player is in danger |
| 10 | **Summit** (6000) | storm clouds, lightning, gold at the finish | **Lightning**: random platforms are marked, then struck (like the quake warning); plus mild gusts from arena 3 | the hardest read, and the prestige arena |

## How it fits in the game
- **Data**: one object per arena: `{ id, name, at, palette, sky layers, platform style, music, ambient, rule }`. The race builder (`generateTrack`) gets the arena and changes the platform mix; `update` applies the rule through a few multipliers (gravity, friction, wind, platform life, lava height). The trophy code already knows the arena index.
- **Which arena do I race in?** The one your trophies put you in. In a party: the lowest arena of the party, so nobody is thrown into rules they have never seen. Bots scale with the arena (the roster already has skill levels).
- **Unlock moment**: reaching a new arena plays a short full-screen reveal ("ARENA 4: Harbour", a 3 second preview of the rule, a chest), and the home screen takes on a hint of the new colours behind the character.
- **Home screen**: a very faint parallax silhouette of the arena behind the character (cached sprite, no cost). The trophy chip stays minimal.
- **Result screens and podium**: the podium stands in the arena (colour of the steps, the light).
- **Music**: one baked track per arena in the existing pipeline (same tempo family, different instrument colour). The Factory beat doubles as the piston timing.
- **Cosmetics**: every arena can have one themed trail or hat as a trophy-road reward (a traffic cone hat, a hard hat, an astronaut helmet, a lava trail). Keep it to a few; they should feel earned, not handed out.
- **Daily Track** (if built): picks a random arena rule each day.
- **Ranked/Gauntlet**: they keep their own tracks at first; later the Gauntlet stages could each borrow an arena rule.

## Order to build (cheapest first)
1. Colours only: sky, platforms and the home silhouette per arena (a day of work, no risk).
2. Rules that are only constants: oil (friction), thin ice (platform life), low gravity bands, gusts.
3. Rules with a hazard that needs a warning: trains, lightning, pistons, rising lava.
4. Arena music, the unlock reveal, the themed cosmetics.

## Risks
- Readability on a 320 px phone: telegraphs must be big and high contrast.
- A rule can make a bad match worse for the player who is already behind (lava, lightning). Keep hazards from targeting only the last player and let the leader meet the rule too.
- Players dropping to a lower arena: the floor of an arena stops that; show the rule clearly again when they come back.
