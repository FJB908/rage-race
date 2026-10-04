# Gentle start

New players quit because the game was too hard and the menus too busy. This system (src/ui/gentle.js, gentle-ui.js, gentle.css) fixes that.

- **ease() 0..1** (`Gentle.ease()`): 1 for your first 3 races, fading to 0.12 over ~50 races, plus 0.22 for every loss in a row (3rd place or worse, max 0.66).
  Quick play only (never Ranked or party matches). It makes the track easier (platforms up to 60% wider, gaps 14% shorter, fewer crumbling/sliding/icy ledges),
  the bots clumsier and slower (their aim error scales with `skill`; the old "ease" accidentally made them sharper) and the odd afk bot more likely.
  The strong roster bot in Quick play only appears from race 12 on and never while you are struggling.
- **Locks (by race WINS, not level):** Levels, Build Race, Escape and Gauntlet open at 3 wins, Ranked at 5. Locked cards are dimmed with a "0/3 WINS" tag and a celebration shows when they open.
  Below level 3 the home hides the pass, missions, daily rewards and boosters (friends and party stay).
- **Onboarding (src/ui/onboard.js):** right after "NEW PLAYER": a close-up of your character, you type a name, then the tutorial starts by itself.
- **Personality:** level titles (Rookie, Hopper, Bouncer, Climber, Daredevil, Sky Runner, Stunt Pro, Rage Racer, Legend, Mythic) under your name and on the profile;
  a level-up celebration says what just opened.
- **Measured:** a proxy beginner (aim error x1.9, slow thinking) finished 4 of 30 races with ease 0 and 24 of 30 with ease 1 (won 11 of 30).
- Arcade and Boom Tag are parked: the code stays (`src/modes/arcade.js`, `tag.js`) but nothing in the menu reaches it. Escape is back.
