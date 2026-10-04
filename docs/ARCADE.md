# Arcade

A hub with random one-screen minigames for four players (you + bots, or you + your party: party members replace bots through `Party.standIns()`).
SPIN picks a random game, or tap a card to pick one. After a game: NEXT MINIGAME (spins again), PLAY AGAIN or MAIN MENU.

| Game | Rules |
|---|---|
| Boom Tag (`tag.js`, see BOOMTAG.md) | pass the bomb, the holder explodes when the fuse ends, last one standing wins |
| Giant Slayer | one player is a giant with a 5-segment life bar; challengers stomp its head, the giant squashes them (2 lives each). 55 s |
| Crown Hill | the glowing platform scores 1 point/s while you are alone on it (28 to win, 50 s); it moves every 10 s; stomps knock rivals off |
| Coin Rush | collect coins (golden = 3) for 40 s, most coins wins |
| Sinking Ship | platforms flash and crumble one by one, there is no floor; last one standing wins |

**Code:** `src/modes/arcade.js` (hub, shared loop/HUD/results/bot kit, one object per game: `setup / start / update / ai / chips / done / finish / draw`)
+ `arcade.css`. `gameMode === 'arcade'` (or `'tag'`) is handled in `game.js` through `isArena()` / `arenaMod()`. Adding a game = adding one object to `GAMES`
and its id to `ORDER`. Rewards: `rewardRace(place, true, lootId)`. Missions: play 2 / win one Arcade game.
**Online later:** every game only needs its players, its timers and its few events (hits, pickups, eliminations) to be shared.
**Balance:** `Arcade.debug.begin(id); Arcade.debug.auto(true)` plays the local player with the bot brain; run the loop `update(1/60)` for headless sims.
