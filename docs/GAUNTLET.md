# The Gauntlet

A separate mode with its own button (home banner and Play tab): **32 players, 3 stages, 1 crown.**
All code lives in `src/modes/gauntlet.js` and `src/modes/gauntlet.css`. `game.js` only carries a few small hooks
(search for `gauntlet` / `gt`), so the normal Race, Escape and Parkour are untouched.

## Flow

| Stage | Field | Rule | Track |
|---|---|---|---|
| 1 Stampede | 32 -> 16 | the first 16 across the line move on | 9000 px, 3 lanes, wide ledges, two start decks |
| 2 Hazard Run | 16 -> 6 | the first 6 across move on; a wall of static rises from below and eliminates anyone it catches | 7000 px, 2 lanes, narrower ledges |
| 3 Crown Duel | 6 -> 1 | first to the crown wins, or last one standing | 7500 px, harsh ledges, faster wall, item boxes everywhere |

The arena is wider than a normal race (470 instead of 356 world units) so 32 players have room.
Players who qualify or are eliminated are removed from the world (`p.gone`), so they never block or bump anyone.

Stage 1 start: 16 players stand on the ground and 16 on a deck 112 px higher. The lower pack starts with a charged
(boosted) first jump so neither group has an advantage.

## Entry

| Option | Cost | Notes |
|---|---|---|
| Coin entry | 500 coins | always available |
| Wager | 1000 / 2500 / 5000 coins | coin prizes x1.5 / x2.5 / x4. Reach the Crown Duel and the stake comes back. 5000 also starts the supply drop one tier higher |

## Prizes (`PRIZES` in gauntlet.js)

| You got to | Base prize | Supply drop starts at |
|---|---|---|
| out in Stampede | 120 coins, 45 XP, 35 pass | none (paid straight away) |
| out in Hazard Run | 260 coins, 90 XP, 60 pass | rare |
| out in Crown Duel | 450 coins, 150 XP, 100 pass | epic |
| crown | 700 coins, 220 XP, 160 pass | legendary |

The drop goes through the normal tap-to-open chest (`awardLootDrop` / `renderLootDrop`), so the tier multipliers, cosmetic
chances, gems and the EQUIP NOW button all work as everywhere else. The run id makes the grant idempotent.

Winning the crown sets `prog().gt.crowned`; a crown holder wears a gold crown in the next Gauntlet until they lose it.
Every run also has one bot "champion" wearing a crown: the strongest of the 31 rivals.

## Rivals

The 31 rivals come from the shared bot roster (`src/modes/roster.js`, see `docs/RANKED.md`): `BotRoster.pick(31, { mmr, spread:240 })`
with the centre at `max(1200, your ranked MMR + 120)`. Names, looks and play styles are the same as in Ranked and Escape, so a
bot you met on the ladder can show up here. The pool is wide on purpose: some rivals are weak, a few are very good.

## Tuning knobs

All in `STAGES` / `ENTRY` / `PRIZES` at the top of `gauntlet.js`:
`height`, `lanes`, `gap*`, `w0/wShrink/wMin`, `types` (platform mix), `wall` (start, speed ramp), `need`, `band`
(how strongly bots rubber-band to you: 1 = a normal race), `skillMul` (bot aim noise, lower = sharper), `timeout`.

## Performance

* Bots use the real bot AI; only the 12 nearest on-screen bots are drawn with full cosmetics (`FULL_DRAW`, fewer when the
  adaptive quality level drops). The rest draw a flat body with no hat, face, trail or name.
* Trails are not even simulated for bots that are off-screen or in the cheap draw mode.
* Particle bursts far off-screen are skipped in this mode.
* Removed players cost nothing (skipped in physics, bumps, draw).

## QA hooks

`Gauntlet.debug`: `fast` (skip cards and countdown), `auto` (the local player is played by the bot AI), `start()`,
`state()`, `log` (per-stage stats), `queue` (deferred stage transitions in fast mode: drain it between `update()` calls).
Headless balance sim: run `Gauntlet.debug.start()` with `fast`/`auto`, then loop `update(1/60)` and drain `queue`.
Measured with 30-40 autoplay runs (an average player): roughly 105-115 s of play per run (stage 1 ~76 s, stage 2 ~60 s, stage 3 ~30 s), the local autoplayer qualified stage 1 about 40-45% of the time with the old random bots.
With roster rivals (36 runs, fresh account): stage 1 qualified 33%, stage 2 42% of those, stage 3 won 0 of 5; about 140 s per run.
Frame cost (headless Chromium, no GPU): 60 fps flat with all 32 visible; with a 4x CPU slowdown about 27 fps even with every bot wearing premium cosmetics (a normal 4-player race holds 60 fps in the same test). The Gauntlet starts one adaptive-quality step down.

## The crowd on the home screen
- While the Gauntlet is the selected mode (`#s-start.gauntlet-mode`), `src/ui/crowd.js` + `crowd.css` put a grandstand behind your player with 32 little characters (one for every runner). Their looks come from `randomBotLook()` (skins, hats, faces, now and then a costume).
- They hop with a squash, wave their arms, some hold a pennant, the stadium wave runs through the stands every 8-12 s (with confetti), cameras flash, and a light runs along the hoarding. Everybody pops in when the mode is picked; a new crowd each time.
- Cost: the stands and the hoarding are painted once, the people canvas is redrawn about 25 times a second with 32 small sprite stamps (no rotated images: that is the slow path of a canvas). It only runs while the home tab is visible, and switches to a lite mode (no flashes or confetti, 16 fps) when drawing takes more than 7 ms. `Crowd.pause(true)` freezes it for tests.
