# Power-ups

Items come out of the item boxes in races (not in the Gauntlet). The code of the two newest lives in `src/items/powerups.js` (`window.PU`); `game.js` only has small hooks.

| Item | What it does | Who gets it |
|---|---|---|
| **Cannon** | You turn into a standing cannon (also when used in mid-air: it falls, lands, then deploys). Drag to aim (about +-22 degrees), release to fire at full power, roughly 1400+ px up the track. A dotted preview shows the arc and where you land (off-screen targets show an arrow with the progress gained). Fires itself after 9 s. | Only far behind the leader (gap over 650 px); most likely in last place |
| **Double jump** | For 7 s you can jump once more in mid-air (one per flight, drag and release). A cloud puffs under you; a small cloud under your feet shows that an extra jump is ready. Everyone sees both (party races: `dj` event + sample fields). | Everyone, a bit more when behind |
| **Super bounce** | Now shows a coiled spring under the player that squashes on every rebound. Visible to all players. | unchanged |

Party races: the 10 Hz samples carry `cn` (cannon state, 3 = in flight), `ca` (aim), `dj` and `du`; clouds travel as events.
Bots: they fire the cannon at the best reachable platform (scan of the angle range) and use the extra jump to rescue a miss.

The Magnet was built and tried and then removed again. Item odds: shield is no longer the favourite of whoever is in front, and the same item rarely comes twice in a row.
