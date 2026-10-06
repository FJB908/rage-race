# Trophy Road

A visible progress number, like the trophies in Clash Royale and Brawl Stars. Code: `src/ui/trophies.js` (+ `trophies.css`), hooks in `rewardRace` (Quick play, Build Race, Boom Tag, Arcade), Escape, Ranked and the Gauntlet.

- **Points per result.** Four-player modes: 1st +30, 2nd +12, 3rd -8, 4th -20. A win streak adds +5 per extra win in a row (max +15). Gauntlet (32 players): 1st +45, top 3 +28, top 8 +14, top 16 +2, else -12.
- **Never unfair.** No losses below 40 trophies. The start of the highest arena you reached is a floor you cannot drop below.
- **Arenas (10).** Playground 0, Parking Lot 150, Rooftop 400, Harbour 800, Factory 1300, Subway 1900, Mountain 2600, Space Station 3500, Volcano 4600, Summit 6000. Only four cosmetics on the whole road (Rooftop skin, Subway trail, Space Station hat, and the gem chest at the Summit); the other arena starts are chests and gems.
- **Road.** 40 milestones (a quick one at 15, then four per arena: start, 1/4, 1/2, 3/4). Arena starts give a cosmetic (rare to legendary) and the last one a gem chest; the rest rotate coins, chests, XP boosters and gems.
- **Home screen.** A chip under the character: count (rolls up or down after a match with a +/- pop), arena name, bar to the next arena, the next reward and a red number when rewards are waiting. Tap = the road.
- Profile fields: `tr`, `trTop`, `trStreak`, `trClaimed`. `rr_tr_shown` (localStorage) is the number the chip last showed, so it can roll to the new value.

## Rewards after a match and the win meter
- Only a win (1st place) pays coins, XP and pass points, in the form of a chest. 2nd to 4th get trophies and nothing else (the result screen shows no reward line).
- Win meter (`src/ui/winmeter.js`): ten pieces on top of the mode card on the home screen. Every win fills one piece. Rewards: 2 wins a common chest, 4 a rare chest, 6 a x2 XP booster, 8 an epic chest, 10 a legendary chest, then it starts again. Tap the bar to collect.
