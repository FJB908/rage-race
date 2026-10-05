# Power-ups

Items come out of the item boxes in races (not in the Gauntlet). The code of the three newest lives in `src/items/powerups.js` (`window.PU`); `game.js` only has small hooks.

| Item | What it does | Who gets it |
|---|---|---|
| **Cannon** | You turn into a standing cannon (also when used in mid-air: it falls, lands, then deploys). Drag to aim (about +-22 degrees), release to fire at full power, roughly 1400+ px up the track. A dotted preview shows the arc and where you land (off-screen targets show an arrow with the progress gained). Fires itself after 9 s. | Only far behind the leader (gap over 650 px); most likely in last place |
| **Double jump** | For 14 s you can jump once more in mid-air (one per flight, drag and release). A cloud puffs under you; a small cloud under your feet shows that an extra jump is ready. Everyone sees both (party races: `dj` event + sample fields). | Everyone, a bit more when behind |
| **Magnet** | For 14 s your next 3 jumps are pulled to the middle of the platform you aim at, and a little higher if you fall just short. The preview shows the corrected arc; in flight the last stretch is steered to the middle. Clear misses stay misses. Test: reaching the target height goes from 93/85/70/56% to 97/95/91/82% for increasingly sloppy aims, and it never made a good jump worse. | Everyone, a bit more for beginners and when behind |
| **Super bounce** | Now shows a coiled spring under the player that squashes on every rebound. Visible to all players. | unchanged |

Party races: the 10 Hz samples carry `cn` (cannon state, 3 = in flight), `ca` (aim), `dj`, `du` and `mg`; clouds travel as events.
Bots: they fire the cannon at the best reachable platform (scan of the angle range), use the extra jump to rescue a miss, and aim about 3x more accurately while a Magnet is active.
