# Gentle start

New players quit because the game was too hard and the menus too busy. This system (src/ui/gentle.js, gentle-ui.js, gentle.css) fixes that.

- **Adaptive difficulty (`Gentle.ease()`, stored as `prog().dda`, 0.04..1.4):** how much help you get in Arena Race. It starts at 80% help and never drops below 60% in the first 3 races, and then follows your results:
  1st place -0.07, 2nd 0, 3rd +0.10, 4th or DNF +0.16 (`Gentle.record(place, finished)`, called from `rewardRace`). It settles where you win about half your races.
  Help = wider platforms (up to +30%, max 185 px), shorter gaps, fewer crumbling/sliding/icy ledges, clumsier and slower bots (their aim error scales with `skill`), the odd idle bot.
  Never in Ranked or party matches. The strong roster bot only appears when ease < 0.15 and from race 12.
  Measured with proxy players (race sims, 28 races each): aim error x1.2 -> 50% wins at ease 0.35; x1.8 -> 50% wins; x2.4 -> 50% wins at ease 1.3; x3.2 -> 25% (beyond help).
- **Locks (by race WINS, not level):** Levels, Build Race, Escape and Gauntlet open at 3 wins, Ranked at 5. Locked cards are dimmed with a "0/3 WINS" tag and a celebration shows when they open.
  Below level 3 the home hides the pass, missions, daily rewards and boosters (friends and party stay).
- **Onboarding (src/ui/onboard.js):** right after "NEW PLAYER": a close-up of your character, you type a name, then the tutorial starts by itself.
- **Personality:** level titles (Rookie, Hopper, Bouncer, Climber, Daredevil, Sky Runner, Stunt Pro, Rage Racer, Legend, Mythic) under your name and on the profile;
  a level-up celebration says what just opened.
- **Measured:** a proxy beginner (aim error x1.9, slow thinking) finished 4 of 30 races with ease 0 and 24 of 30 with ease 1 (won 11 of 30).
- Arcade and Boom Tag are parked: the code stays (`src/modes/arcade.js`, `tag.js`) but nothing in the menu reaches it. Escape is back.

## Calmer home, clearer locks, quicker rematch
- **One loud notice at a time** (`nudgeSync` in `game.js`): home badges are ranked (level reward, daily, missions, pass, shop, collection). The first one stays a red badge, the rest become small grey dots until it is dealt with. Players under 3 races only see dots.
- **Shop and ad nudges wait** (`Gentle.shopReady()`: 3 races and 1 win): no shop badge, no FREE tag and no home video pill before that.
- **Locks**: the nearest unlock shows "N WINS" in gold with a progress bar on the card, the rest show their total in grey. The results screen adds a line "N more wins to unlock 4 new modes" with a bar.
- **Results**: RACE AGAIN and MAIN MENU are always available. The winner's chest is an outlined OPEN CHEST tile (a skipped chest stays in the pending queue on the menu). RACE AGAIN uses a short lobby (about 1.3 s instead of 3.1 s).
