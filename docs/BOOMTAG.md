# Boom Tag

Replaces Escape in the menu (the Escape code is still in `game.js`, just not reachable).

- **Rules:** 4 players, one screen, one bomb with a shared fuse (16 s with 4 players, 13 s with 3, 10 s with 2). Crash into someone to pass the bomb;
  whoever holds it at 0 explodes and is out. Survivors are re-spread over the platforms and a new bomb is handed out. Last one standing wins.
- **Details:** after a pass the previous holder is immune for 1.3 s; the holder jumps 16% harder; power-ups spawn every 6-9 s:
  SHIELD (5 s, cannot be tagged), LEAP (next jump is boosted), ZAP (stuns the bomb holder for 2 s, or the nearest rival if you hold the bomb).
- **Code:** `src/modes/tag.js` (arena, rules, bot AI, HUD, results) + `tag.css`. Hooks in `game.js` are `gameMode === 'tag'`: update, fixed camera,
  draw layers, pause / quit / restart, `playerPowMul`, `launchPlayer` (stun) and the bot skip (`p.noAI`).
- **Rewards:** `rewardRace(place, true, lootId)` (winner earns a chest), plus +20 coins per extra win in a row (max +100). Best streak / wins are kept in
  `rr_tag_best` and `rr_tag_wins`. Missions: play, win, pass the bomb 8 times.
- **Balance:** `Tag.debug.auto(true)` lets the local player play with the bot brain; 80 headless matches gave wins of roughly 31 / 20 / 29 / 20 % by slot
  (no slot dominates), ~46 s per match, ~16 passes per match, no stuck match.
- **Later (server):** the same rules fit a room per party; the bomb holder, fuse and pass events are the only shared state.
