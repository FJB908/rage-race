# Trophy Road

A visible progress number, like the trophies in Clash Royale and Brawl Stars. Code: `src/ui/trophies.js` (+ `trophies.css`), hooks in `rewardRace` (Arena Race, Boom Tag, Arcade), Escape and the Gauntlet. **Build Race stands apart from the arenas: it pays no trophies** (a win still fills the daily win meter, and its bots are picked by your trophy rating).

- **Points per result.** Four-player modes: 1st +30, 2nd +12, 3rd -8, 4th -20. A win streak adds +5 per extra win in a row (max +15). Gauntlet (32 players): 1st +45, top 3 +28, top 8 +14, top 16 +2, else -12.
- **Never unfair.** No losses below 40 trophies. The start of the highest arena you reached is a floor you cannot drop below.
- **Arenas (10).** Playground 0, Parking Lot 500, Rooftop 1,000, Harbour 1,750, Factory 2,500, Subway 3,500, Mountain 4,750, Space Station 6,250, Volcano 8,000, Summit 10,000 (see ARENAS.md for why they grow). Only four cosmetics on the whole road (Rooftop skin, Subway trail, Space Station hat, and the gem chest at the Summit); the other arena starts are chests and gems.
- **Road.** 40 milestones (a quick one at 15, then four per arena: start, 1/4, 1/2, 3/4). Arena starts give a cosmetic (rare to legendary) and the last one a gem chest; the rest rotate coins, chests, XP boosters and gems.
- **Home screen.** A chip under the character: count (rolls up or down after a match with a +/- pop), arena name, bar to the next arena, the next reward and a red number when rewards are waiting. Tap = the road.
- Profile fields: `tr`, `trTop`, `trStreak`, `trClaimed`. `rr_tr_shown` (localStorage) is the number the chip last showed, so it can roll to the new value.

## Rewards after a match and the win meter
- A win (1st place) pays coins, XP and pass points in the form of a chest. 2nd place earns 30 XP and 20 pass points, 3rd 15 XP and 10 pass points; 4th gets trophies only.
- Win meter (`src/ui/winmeter.js`): ten pieces on top of the mode card on the home screen. Every win fills one piece. Rewards are given automatically (chests open on their own on the home screen, no red dot, no tapping): 2 wins a common chest, 4 a rare chest, 6 a x2 XP booster, 8 an epic chest, 10 a legendary chest. The meter starts empty every day (device date) and stays full once complete, so it is a daily goal.
- Chests never hold skins (skins are shop only, from 3,500 coins). Duplicate cosmetics from the pass, levels, streak or trophy road refund 15% of the shop price.

## Opponents get better as you climb (replaces Ranked)
Ranked is gone. Your trophies set the strength of the bots in every placing mode:
- `Trophies.mmr()` maps trophies to the roster rating: 0 trophies ~ 1050 (clumsy bots), Harbour ~ 1260, Subway ~ 1450, Mountain ~ 1530, Volcano ~ 1660, Summit ~ 1700 (the curve is stretched with the arena sizes).
- `Trophies.matchMmr()` is the same rating, made kinder while the game is still helping you (beginners and after a few losses: `Gentle.ease()`, up to -220).
- Arena Race and Build Race pick 3 roster bots of that rating when the match is made (so the lobby shows the same names that race). Boom Tag, Arcade, Escape (+100) and the Gauntlet (+120, wide pool) use it too; parties use `Trophies.mmr()` for their bot fill.
- Existing Ranked players got trophies once: `min(4200, RP x 2.2)`.

## Screens (updated)
The long Trophy Road list is replaced by the Arenas screen (`src/ui/arenas.js`, see ARENAS.md): one arena per page with its four rewards. The home screen shows an arena banner (picture, name, trophies, progress to the next arena).
