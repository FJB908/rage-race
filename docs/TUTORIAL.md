# Tutorial

The tutorial level lives in `src/tutorial/` (`tutorial.js`, `tutorial.css`) and is switched off for new players until launch.

- **Try it now:** Settings, then "Play tutorial". Or `Tutorial.start()` in the browser console.
- **Enable at launch:** in `src/tutorial/tutorial.js` set `TUTORIAL_CONFIG.autoStart = true`. It then starts by itself for a player with 0 races played, and gives a one-time reward (`TUTORIAL_CONFIG.reward`).
- **Change the lessons:** edit `PLAN` (platform positions and types) and `LESSONS` (the line shown while standing on platform k, which prepares the jump to platform k+1).
- **How it works:** it reuses the game's level mode through a hidden dimension, so physics are the real ones and it never shows up in the level list or the star count.
- **Reset:** clear `rr_tutorial_done` in localStorage to see the reward again.
