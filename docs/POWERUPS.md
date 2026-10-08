# Power-ups

Items come out of the item boxes in races (not in the Gauntlet). The code of the two newest lives in `src/items/powerups.js` (`window.PU`); `game.js` only has small hooks.

| Item | What it does | Who gets it |
|---|---|---|
| **Cannon** | You turn into a standing cannon (also when used in mid-air: it falls, lands, then deploys). Drag to aim (about +-22 degrees), release to fire at full power, roughly 1400+ px up the track. A dotted preview shows the arc and where you land (off-screen targets show an arrow with the progress gained). Fires itself after 9 s. | Only far behind the leader (gap over 650 px); most likely in last place |
| **Double jump** | For 7 s you can jump once more in mid-air (one per flight, drag and release). A cloud puffs under you; a small cloud under your feet shows that an extra jump is ready. Everyone sees both (party races: `dj` event + sample fields). | Everyone, a bit more when behind |
| **Stun bomb** | Replaces the Wind (which is no longer handed out). Using the item drops the bomb right where you are; it stays hanging there for 10 s with a faint red danger zone (a thin dashed rim and a light tint, a bit stronger when somebody is inside). Everyone who flies or lands inside is dazed for 1 s: no jumping, momentum halved, stars around the head. Each player is hit once per bomb, then immune for about 2 s. You are safe in your own zone until you have left it once. A shield blocks it. Bots drop it when someone is about to pass their spot. Party races: a `bomb` event (position) and the `zp` sample field. | The odds the Wind had (more when behind) |
| **Super bounce** | Now shows a coiled spring under the player that squashes on every rebound. Visible to all players. | unchanged |

Party races: the 10 Hz samples carry `cn` (cannon state, 3 = in flight), `ca` (aim), `dj` and `du`; clouds travel as events.
Bots: they fire the cannon at the best reachable platform (scan of the angle range) and use the extra jump to rescue a miss.

The Magnet was built and tried and then removed again. Item odds: shield is no longer the favourite of whoever is in front, and the same item rarely comes twice in a row.

## Rocket (updated)
The rocket now always launches you at its full speed (2350, up from 1650), whether you stand, fall or are already rising. It does not add on top of a jump. Climb is about 1100 px (about twice as high as before; a falling player used to get only ~110 px). You cannot be knocked off course for the first half second.

## Changes (latest)
- Double jump lasts 5 s (was 7). The stun bomb explodes after 3.5 s (was 6).
- Earthquake: a player still standing on a warned platform now falls with it (it no longer stays up).

---

# PROPOSAL (not built yet): power-ups per arena, 16 new ones

Today there are 11 power-ups and the pool only grows (4 -> 11), with two leaving at the very top. The idea below: **every arena brings 2 or 3 new power-ups, most of the previous arena stays, and a few leave**. The pool stays between 7 and 9, so it never becomes a pile. Every new power-up fits the theme of its arena.

## The rules of the design
1. **Roles.** Every pool has boosts (progress), safety (the training wheels), attacks (aimed at the leader or at the pack) and, higher up, big comeback tools. The training wheels (Super Bounce, Giant, Parachute, Lifebuoy, Shield) leave one by one, so the top arenas are about reading jumps, not about being carried.
2. **Attacks aim up, never down.** Like today: an attack needs somebody ahead of you and the odds grow the further you are behind. The leader never gets a comeback item and is the target of most attacks, so most attacks pay off only for the ones behind.
3. **Everything telegraphs** (ring, shadow, sound) at least 0.8 s before it hurts, and a **Shield blocks every attack** (the Mirror reflects it).
4. **Readable on a phone**: one picture, one colour, one sound per power-up; the effect is on the player or on a clear area, never a full-screen blind.
5. **Bots and friends**: every power-up needs a rule for the bots and an event for party races (`Social.emitItem`). The ones that touch other players (Oil, Conveyor, Train, Snowball, Rockslide, Swap, Lightning, Anchor, Mirror) are the ones that need the most care.

## The 16 new power-ups
| # | Power-up | Arena | Role | What it does | Build effort |
|---|---|---|---|---|---|
| 1 | **Nitro** | Parking Lot | boost | Your next 2 jumps are 30% stronger (a glowing trail behind you) | easy |
| 2 | **Oil Slick** | Parking Lot | trap | Spills oil on the ledge the leader stands on for 8 s: anybody who lands there slides twice as far as on ice | easy-medium |
| 3 | **Parachute** | Rooftop | safety | 6 s of slow, soft falling (a small canopy); jumps stay the same | easy |
| 4 | **Updraft** | Rooftop | zone | A rising column of air where you stand for 8 s (visible streaks): everybody inside floats up, rivals too | medium |
| 5 | **Anchor** | Harbour | attack | The leader is weighed down for 5 s: jumps 35% weaker, falls faster. Blocked by a Shield | easy-medium |
| 6 | **Lifebuoy** | Harbour | safety | For 12 s, the next time you fall past a ledge a ring catches you and floats you back to the ledge you jumped from | medium |
| 7 | **Conveyor** | Factory | trap | The ledge the leader stands on becomes a belt for 8 s (arrows): whoever is on it is carried sideways | medium |
| 8 | **Train** | Subway | attack | A warning light, then a train sweeps across the full width at the height of the leader and stuns everybody it touches (you too if you are there) | hard |
| 9 | **Grip** | Mountain | safety | 10 s with no sliding on ice, oil or belts, and rock-solid landings | easy |
| 10 | **Snowball** | Mountain | attack | A snowball flies up to the nearest rival ahead: frozen for 1 s, slowed for 3 s | medium-hard |
| 11 | **Moon Bubble** | Space Station | zone | A low-gravity bubble where you stand for 8 s: everybody inside jumps 40% higher and falls slowly | medium |
| 12 | **Jetpack** | Space Station | boost | 3 extra air jumps for 8 s (the big brother of the Double Jump) | easy |
| 13 | **Swap** | Volcano | comeback | You swap places with the rival directly above you (flash on both); only when you are in the back half | medium |
| 14 | **Rockslide** | Volcano | attack | Three shadows appear in the leader's column; 1 s later rocks fall and stun on a hit | hard |
| 15 | **Lightning** | Summit | attack | Marks the leader (ring and thunder) and strikes after 1 s: a stun of 1.2 s. Replaces the Earthquake | easy-medium |
| 16 | **Mirror** | Summit | safety | For 6 s the next attack aimed at you is thrown back at the player who sent it. Replaces the Shield | medium |

The 11 that exist stay as they are (Super Bounce, Rocket, Giant, Shield, Double Jump, Gust, Stun Bomb, Chain, Earthquake, UFO, Cannon).

## The pool per arena (what is new, what leaves)
| # | Arena | New | Leaves | In play | The pool |
|---|---|---|---|---|---|
| 1 | Playground | Super Bounce, Rocket, Giant, Shield | - | 4 | Bounce, Rocket, Giant, Shield |
| 2 | Parking Lot | Double Jump, **Nitro**, **Oil Slick** | - | 7 | + Double Jump, Nitro, Oil |
| 3 | Rooftop | Gust, **Parachute**, **Updraft** | Giant, Nitro | 8 | Bounce, Rocket, Shield, Double Jump, Oil, Gust, Parachute, Updraft |
| 4 | Harbour | Stun Bomb, **Anchor**, **Lifebuoy** | Super Bounce, Updraft | 9 | Rocket, Shield, Double Jump, Oil, Gust, Parachute, Bomb, Anchor, Lifebuoy |
| 5 | Factory | Chain, **Conveyor** | Oil, Gust, Parachute | 8 | Rocket, Shield, Double Jump, Bomb, Anchor, Lifebuoy, Chain, Conveyor |
| 6 | Subway | Earthquake, **Train** | Conveyor | 9 | Rocket, Shield, Double Jump, Bomb, Anchor, Lifebuoy, Chain, Earthquake, Train |
| 7 | Mountain | UFO, **Snowball**, **Grip** | Train, Lifebuoy, Chain | 9 | Rocket, Shield, Double Jump, Bomb, Anchor, Earthquake, UFO, Snowball, Grip |
| 8 | Space Station | Cannon, **Moon Bubble**, **Jetpack** | Double Jump, Grip, Anchor | 9 | Rocket, Shield, Bomb, Earthquake, UFO, Snowball, Cannon, Moon Bubble, Jetpack |
| 9 | Volcano | **Swap**, **Rockslide** | Moon Bubble, Snowball | 9 | Rocket, Shield, Bomb, Earthquake, UFO, Cannon, Jetpack, Swap, Rockslide |
| 10 | Summit | **Lightning**, **Mirror** | Shield, Earthquake | 9 | Rocket, Bomb, UFO, Cannon, Jetpack, Swap, Rockslide, Lightning, Mirror |

Bold = new power-ups from the list above. Every arena has 2 or 3 new ones and loses 1 to 3. Arena 3 keeps five of the seven from arena 2 and swaps out two, which is the shape you described.

## Who gets what (odds follow the rank, like today)
- **Neutral (everybody, a bit more for the back)**: Nitro, Parachute, Lifebuoy, Grip, Jetpack, Updraft, Moon Bubble.
- **Only when somebody is ahead, growing towards last place**: Oil, Conveyor, Anchor, Train, Snowball, Rockslide, Lightning (Lightning only from 3rd place down).
- **Comeback (far behind only)**: Swap, UFO, Cannon.
- **Leader-friendly**: Mirror (a bit more likely when you lead, since you are the target).

## Rejected ideas
Magnet (built, tried and removed), Fog or any blinding effect (not fair on a small screen), a banana dropped behind you (it helps the leader), a Black Hole (unreadable), a Jetpack you hold (clashes with the drag-to-jump input).

## Suggested build order
1. **Cheap, self only**: Nitro, Parachute, Jetpack, Grip, Lifebuoy.
2. **Simple effects on other players** (they reuse the stun / wind timers): Anchor, Lightning, Mirror.
3. **Platform and zone effects**: Oil Slick, Conveyor, Updraft, Moon Bubble.
4. **Moving things with telegraphs**: Snowball, Swap, Train, Rockslide.
Each step also needs: an icon (the item slot and the roulette wheel), a sound from the existing bank, the themed look, a bot rule, a party event and a line in the Arenas screen.
