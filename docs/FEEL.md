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
