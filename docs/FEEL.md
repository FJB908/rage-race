# Feel: what a jump and a landing do

Everything here is the *sensation*; none of it changes the physics, the bots or the balance. Code: `landOn`, `landFeel` and the squash loop in `game.js`, the sounds in `src/audio/sfx.js`.

- **Wind-up**: while you pull back the cube sinks (up to 16%) and the spring releases into the launch stretch. At full pull there is one small tick (sound + haptic).
- **Squash is a spring**: a landing squashes, springs back a touch past normal and settles (about 0.3 s) instead of easing in a straight line.
- **A landing has a weight**: three recorded variants (light, normal, heavy) by impact speed, a lighter or heavier haptic, and a small directed camera dip that settles (no random shaking for a normal landing; only a very hard one still shakes a little).
- **The ledge gives**: up to 4.5 px under a landing, then springs back (drawn only; whoever stands on it goes with it).
- **Perfect landing**: within the middle quarter of a ledge (at least 9 px each side): a thin gold ring, a few sparks, a small bell that climbs the pentatonic scale with the streak (five steps), a crisp squash. Three in a row and the cube's glow turns gold. Any other landing ends the streak. Race, Levels and the Tower only. No text on screen.
- **Edge**: landing with the centre almost on the edge makes the cube wobble a little.
- **Photo finish**: when you and another player are both within about 380 px of the line and within 170 px of each other, the last moment runs at 42% speed for half a second (once per race, never in a party).

The three landing sounds and the five bells are baked into `src/audio/bank` (`node tools/bake-audio.js sfx`).

# The finish (Arena Race): `src/ui/finish.js`, `finish.css`

- **Finish moment** (you are through, the others still race). No window and no question: your place in big letters in the same style as the place in the corner (which hides meanwhile), your time, and everybody who finishes after you slides in under it (`2ND  Mila  +0.84`, minus when they were faster than you). The camera follows whoever is closest to the line (the watch arrows stay). Two actions: **RESULTS** and **AGAIN** (your rewards are paid first).
- **RESULTS fast-forwards the rest of the race** (as many simulation steps per frame as fit in about 9 ms, at most 75 simulated seconds) with a small "FAST FORWARD" label. The finish times follow the simulation clock, so the results are always complete and real: no "DNF" rows, and the result is the same as when you wait. It only exists while the others are local bots (`canFastForward()` in game.js): in a live party, and once Arena Race runs on a server (`window.ARENA_ONLINE = true`), it cannot be sped up and RESULTS simply leaves the race.
- **Results**: the arena you raced in is painted behind it (dimmed so numbers stay readable on a bright sky), your place is the headline (gold, silver, bronze, red), then the margin ("Won by 0.84 s"), the victory stand, and only what is new: the trophies with the road to the next arena (and the arena name when you reach a new one), the rewards that are not in the chest (zeroes are left out), a plain line for the unlock goal, and the chest itself (a tap opens it). RACE AGAIN is the one button; MAIN MENU is plain text.
- Not used for Build Race, the Gauntlet, Escape or Boom Tag: they end in their own way.

## Performance rules (what made it lag, so it stays fixed)
- **Build Race placing phase** has its own full-screen canvas. The world canvas behind it is not drawn at all (`bdCover` in `loop`), the placing canvas follows the game's quality steps (`dprCap`, at most 1.5), and the self-tuning in `adaptQuality` now also runs in the placing phase (it used to run only in `playing`, so a slow phone never stepped down there).
- **No `backdrop-filter` over the game** (Build Race panels, the emote button): blurring a moving canvas costs every frame.
- **Chest opening**: while the opening is fully faded in the screens behind it are `visibility:hidden` (`body.lb-open`) and the home sky stops animating. Particles are pre-painted sprites (glow dot, four-point spark, glossy confetti chip) stamped with `drawImage`; sparks and glows are drawn additively. Only the box that was drawn last frame is cleared, and the layer thins itself out (`density`) when frames run slow.
