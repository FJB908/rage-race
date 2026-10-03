# Ranked

A seasonal ladder on the 4-player Race. Code: `src/modes/roster.js` (bots, ranks), `src/modes/ranked.js` + `ranked.css` (screens, maths).
Opponents are bots from a shared roster for now; the real-player swap point is `providerFindMatch()` in ranked.js.

## Ranks

Seven ranks, thematic to a climbing game: **Ground, Ledge, Ridge, Summit, Peak, Apex, Crown**. Ground to Apex have three
divisions (III, II, I) of 100 rank points (RP); Crown starts at 1800 RP and has no divisions.

Two numbers:

* **MMR** (hidden) decides who you meet and is updated with an Elo formula for four players (expected score = the average
  expected result against each opponent, actual score = 1, 2/3, 1/3, 0 for places 1 to 4).
* **RP** (visible) moves by about the same amount, plus a pull towards `mmrToRp(MMR)` (12% of the gap), so your rank slowly
  settles where your results say you belong. Limits: +34 / -24 per match, up to +6 bonus for a win streak of 3 or more.

`mmrToRp(m) = max(0, (m - 850) * 2.12)`. The first **5 placement matches** use a bigger K (56 instead of 28) and reveal your rank.
After a promotion to a new rank you are shielded from demotion for 2 matches. Leaving or closing the app mid-match counts as a loss.

A match ends the moment YOU cross the finish line (nobody behind you can overtake), so the place is final and no waiting is needed.

## Season

30 days (`EPOCH` in ranked.js, season 1 starts 2026-10-01). At the end: MMR is pulled 45% towards 1100, two placement matches
again, rewards reset. Each rank gives a one-time reward per season (coins, a supply drop, gems, and at Crown an item); the
Play-tab card shows a red number when something can be claimed.

## Rules that make it fair

* No rubber band: bots never slow down for you (`window.RACE_BAND = 0`), and no easy-start for new players.
* Same track for all four (seeded), no AFK bots, no sprint-after-you-finish.
* Winning a match places a rare supply drop for the first 5 wins per day (a bots-only season must not be farmable).
* `RK_UNLOCK_RACES` (0 while testing) sets how many Quick matches are needed before Ranked opens. Use 3 at launch.

## The roster (shared with Gauntlet and Escape)

240 named bots per season (deterministic from the season, rating drift saved in `rr_rk_roster_v1`). Each has a rating, a
look (better ratings own rarer cosmetics) and a play style: steady, sprinter (fast but sloppy), careful (slow, precise),
natural (the human-profile bot that hesitates). Their rating becomes four real behaviours (`BotRoster.paramsFor`):

| knob | meaning |
|---|---|
| `skill` | aim noise, lower is better |
| `thinkScale` | how long they think before a jump |
| `waitScale` | wait after landing |
| `mistake` | chance to take the wrong-looking route |

The Gauntlet's 31 rivals and Escape's 3 rivals come from the same roster, centred a little above your rating, so a name you
see in Ranked can show up there and the strongest rival in a Gauntlet is its "defending champion". Quick match is unchanged.

## Calibration (measured, not guessed)

`MMR_TO_LEVEL` in roster.js was fitted with the headless simulator: races with random 4-bot lobbies from a level grid, an Elo
fit over thousands of races (4 parallel workers, fake clock, rubber band off). Strength rises steadily from level 0 to about 1.3
(span roughly 860 Elo) and flattens after that: the physics of the climb limit how fast even a perfect bot can go. A level 1.3
bot wins about 38% of the time against a field of mixed levels, a level 0.2 bot about 2%.
Re-run it after changing bot code: see "Re-calibrating" below.

## Re-calibrating

In a page with the game loaded: `window.rankedMatch = true; RACE_BAND = 0;` then for each race call `generateLevel(seed)`,
`initPlayers()`, set each player `local=false`, set `skill/thinkScale/waitScale/mistake` from `BotRoster.paramsFor(level)`,
replace `Date.now` with a fake clock advancing 1000/60 per step, and loop `update(1/60)` until `finishedCount >= 4`.
Fit Elo on the finishing order, then rewrite `MMR_TO_LEVEL` as `[elo + 250, level]` pairs.

## Screens

Play-tab card (rank emblem, rank or placement progress, red number for rewards) → hub (emblem, RP bar, last five results,
stats, season reward track with claim buttons, leaderboard) → matchmaking (opponents appear one by one with their rank, then
the average rank) → race → result (place, RP change with an animated bar, scoreboard, rewards or a supply drop, promotion
screen). Emblems are generated SVG (`Ranked.emblem(tier, size)`): chevrons, then mountains, then a crown, with wings from Summit up.

## Going multiplayer later

Everything calls `providerFindMatch()` for opponents and `applyResult()` for the outcome. With a server: the server picks
the lobby and computes the result from the finish order; the client only displays. Never trust the phone for RP.
