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
