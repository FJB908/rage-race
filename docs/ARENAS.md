# Arena themes

**Built:** `src/modes/arenatheme.js` (look + power-up pool), `src/ui/arenas.js` (the Arenas screen) and the arena banner on the home screen (`src/ui/trophies.js`).

- **Look** (Arena Race only; a party match always uses the Playground, and **Build Race stands apart from the arenas**: no arena look, no arena power-up pool, no trophies): a sky that shifts while you climb, a big sun or moon (the Playground is the bright one: a lighter sky, a warm glowing sun, big soft clouds drifting past, now and then a small plane with a trail (every 24-50 s) and a slow hot-air balloon (every 50-90 s), in a race and on the home screen alike, clear colours, hardly any haze and a very light vignette, and its balloons are saturated yellow and pink), two layers of far-away scenery that move slowly (parallax), mist between the layers, drifting specks and a soft vignette. On a light sky (Playground, Mountain) the jump aim line is dark instead of white, so it never disappears into the background. The colours of the scenery are close to the sky, so it is clearly a background and never looks like something to stand on. Every piece of scenery is painted once into a small cached picture (all of them during the countdown, never in the middle of a race), and the still parts (sky, sun, haze, vignette) are cached pictures too; a frame is only a few `drawImage` calls (about 0.5 ms). Every balloon drifts at its own speed (slow ones and quick ones), and now and then a new one floats up from the bottom. The normal platforms get a colour that fits the arena; the special platforms (ice, moving, fragile, boost, safety) keep their meaning colours.
- **Only Arena Race shows the arena**: the painted world (no title: the trophy row is the only text), the drifting air, the island and the test button are only on the home screen while Arena Race is the selected mode. Every other mode has a calm home (the colour of the mode glows behind your player, who stands on a small ledge in that colour; Levels shows the level path instead, see LEVELPATH.md).
- **Home screen = a little world**: the arena you are in fills the whole background of the home tab (sky, sun or moon, far scenery, mist, drifting air). Your player stands on a **floating island** that carries a few pieces of the arena (a windmill and balloon in the Playground, a lamp, car and cones in the Parking Lot, a lighthouse and containers in the Harbour, a volcano and floating rocks in the Volcano, ...) and bobs slowly. Each island has its own material (grass, asphalt with parking lines, roof tiles, planks, riveted steel, subway tiles with a safety strip, snow, glowing hex panels, cracked basalt, gold) and its own underside (rock, wooden posts, pipes, a thruster flame, lava drips). Above it, no card: just `ARENA 4`, the arena name in big letters, the trophy count and a thin bar with what is left to the next arena. Tap the title or the island to open the Arenas screen. All of it is painted once (`ArenaTheme.paintWorld`, `paintIsland`); only the air specks and the island's bob (CSS) move.
- **Arenas screen = the Trophy Path** (tap the arena title or the island): one road that climbs like the game, the Playground at the bottom and the Summit at the top, and your own marker on it (a button brings you back when you scroll away). Along the road, in order of trophies: the power-ups that arrive (**NEW**) or leave (**LEAVES**) at a trophy count and the trophy rewards (tap a ready one to claim it, or CLAIM ALL at the top). Every arena starts at a painted gate with its name. Rewards show only what the icon cannot say (an amount, a booster, a cosmetic's name; never "Coins", "Gems" or "Chest"). **You are the dot**: your own face sits on the line at your trophy count, and accepted friends stand on the road at theirs (smaller, with their name; `Social.friendList()` now carries `tr`). No boxes or frames, almost no text: a trophy number, an icon and a name; tap a power-up for one line about it. Power-ups that arrive at the same trophy count share one stop. The data is `ArenaTheme.UNLOCKS` (trophies -> power-ups) plus `Trophies.road()` (the rewards).
- **Name**: the main mode is now called **Arena Race** (it used to be Quick play).

## Arena sizes and the new-player ramp
- **Trophies per arena** (start of each arena): Playground 0, Parking Lot 500, Rooftop 1,000, Harbour 1,750, Factory 2,500, Subway 3,500, Mountain 4,750, Space Station 6,250, Volcano 8,000, Summit 10,000. The arenas grow (500, 500, 750, 750, 1,000, 1,250, 1,500, 1,750, 2,000 trophies) because a win is worth +30 and an average race about +12, so the first arena lasts about 40 races, which is the time a new player needs to learn the six starter power-ups. The opponent curve stretches with the arenas (the same arena has the same opponents as before). Whoever already had trophies keeps the same place inside the same arena (a one-time conversion, `trMig3`).
- **Ledge types are met one at a time** (Arena Race): Playground has normal, boost and moving ledges; the Parking Lot adds crumbling ledges; the Rooftop adds ice; from the Harbour on there are sealed ledges (ceilings) too. A party race keeps the full mix.
- **Tips, not hand-holding**: the first time a power-up lands in your slot, or a crumbling / icy / moving / boost / sealed ledge is under your feet, one small card says what it is: the power-up's own icon (or a little drawing of the ledge) on the left, a label (NEW POWER-UP / NEW LEDGE), the name, one line, and a thin line along the bottom that runs out with the time (once per account, `src/ui/tips.js`, `tips.css`). The adaptive help is a bit smaller than before (it starts at 80% instead of 100% and never drops below 60% in the first three races).
- **Test switch**: the small TEST button next to the hanger on the home screen picks the arena Arena Race is played in (look, power-ups, ledges). It is temporary: delete `src/ui/arenatest.js`, `arenatest.css` and their tags in `index.html`.

## Power-ups unlock on trophies (Arena Race)
The pool you roll from depends on your **trophies** (it is not only per arena): a new power-up arrives at a trophy count and a few training wheels leave later. The Playground starts with a pool of four and has six by 300 trophies, so a new player does not see the same few every race. Parties keep the classic set (everything except the Gust). The Gust only hits players ahead of you. The table is `ArenaTheme.UNLOCKS` in `arenatheme.js`; the Arenas screen draws exactly that list.

| Trophies | Arena | Arrives | Leaves |
|---|---|---|---|
| 0 | Playground | Rocket, Super Bounce, Giant, Shield | - |
| 150 | Playground | Nitro | - |
| 300 | Playground | Double Jump | - |
| 600 | Parking Lot | Safety Net | - |
| 1,000 | Rooftop | Gust | - |
| 1,400 | Rooftop | - | Giant |
| 1,750 | Harbour | Stun Bomb | - |
| 2,350 | Harbour | - | Super Bounce |
| 2,500 | Factory | Chain | - |
| 3,000 | Factory | - | Nitro |
| 3,500 | Subway | Earthquake | - |
| 4,000 | Subway | - | Safety Net |
| 4,750 | Mountain | UFO | - |
| 6,250 | Space Station | Cannon | - |
| 7,250 | Space Station | Jetpack | Double Jump |

Planned (see POWERUPS.md, not built yet): Glider, Grapple, Mirror, Snowball, Swap and Lightning will be slotted into this table when they exist. Moon Boots was built, measured and dropped.

Each arena also renames and recolours the **Stun Bomb** and the **Earthquake** (Parking Lot: Car Alarm / Pothole, Rooftop: Firework / Roof Cave-In, Harbour: Depth Charge / Tidal Wave, Factory: Steam Blast / Piston Slam, Subway: Short Circuit / Train Rumble, Mountain: Snowball / Avalanche, Space Station: Ion Burst / Meteor, Volcano: Lava Bomb / Eruption, Summit: Thunder / Lightning Strike) and makes one or two power-ups a bit more common (Parking Lot: Stun Bomb x1.3, Rooftop: Double Jump x1.4, Harbour: Super Bounce x1.4, Factory: Chain x1.4, Subway: Shield x1.3 and Stun Bomb x1.15, Mountain: Giant x1.4, Space Station: Double Jump x1.6 and Super Bounce x1.2, Volcano: Rocket x1.5 and Earthquake x1.3, Summit: Cannon x1.5 and Earthquake x1.2). The names and odds are plain data at the top of `arenatheme.js`.

Not built yet: the signature rules below (oil, gusts, thin ice, ...), music per arena, the unlock reveal and the themed cosmetics.

Everything below is the original idea list.

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
| 2 | **Parking Lot** (500) | grey concrete, painted lines, yellow cones, a flickering street lamp | **Oil patches**: some platforms are slippery (you slide a little after landing) | landing needs a bit more care, a darker shiny platform tells you |
| 3 | **Rooftop** (1,000) | orange sunset skyline, antennas, water towers, pigeons | **Gusts**: every 10 s a gust pushes everyone sideways for 1.5 s (visible streaks first) | time your jumps between gusts; the side walls matter |
| 4 | **Harbour** (1,750) | blue night, cranes, crates, fog horn, water at the bottom | **Floating docks**: platforms bob up and down slowly | you aim at where the dock will be, not where it is |
| 5 | **Factory** (2,500) | steel and amber, sparks, gears turning in the back | **Conveyor belts**: some platforms carry you left or right; **pistons** retract platforms on a beat | rhythm: a visible drum beat in the music sets the piston timing |
| 6 | **Subway** (3,500) | green tiles, flickering lights, rails, wet floor | **Trains**: a warning light and a rumble, then a train crosses the track at one height and knocks anyone in its way | you check the light before you jump into a lane |
| 7 | **Mountain** (4,750) | cold blue and white, snow, breath fog, wind | **Thin ice**: platforms crack and drop 1.2 s after you land | no standing still; every platform is a short rest |
| 8 | **Space Station** (6,250) | dark with stars, glass and white panels, a slow planet in the back | **Low gravity bands**: horizontal bands where jumps float (longer air time, slower fall) | big jumps, but the landing is harder to judge |
| 9 | **Volcano** (8,000) | black rock, red glow, ash falling | **Rising lava** from below, slowly (like Escape): stay above it | racing and surviving at the same time; the leader is safe, the last player is in danger |
| 10 | **Summit** (10,000) | storm clouds, lightning, gold at the finish | **Lightning**: random platforms are marked, then struck (like the quake warning); plus mild gusts from arena 3 | the hardest read, and the prestige arena |

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
