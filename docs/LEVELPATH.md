# The level path (`src/ui/levelpath.js`, `levelpath.css`)

The Levels screen is one road that climbs, like the path in Duolingo but going up like the game: Level 1 at the bottom, the Tower at the very top.

- **Stones**: every level is a round stone in the colour of the level, with its number on it. A finished level has its stars (three gold ones in an arc over the stone, the missing ones dark). A locked level is a dark stone with a lock. The name of a level is only written under the level you play next.
- **You**: your own cube stands on the level you play next (the first open level without stars) and a ring pulses around that stone. When you come back after passing a level the cube hops from the old stone to the new one and the new stars pop in.
- **Chests**: the chest you win with 3 stars stands beside its level in the colour of its rarity (dim while the level is locked, faded once you have earned it).
- **The road** between the stones is a faint ribbon with a dotted line; the part you have walked is lit in the colours of the levels.
- **Dimensions**: Dimension I at the bottom, Dimension II above it behind a gate that shows the stars it needs (28) until it opens. Each dimension has its own painted sky (a dark violet one and an icy blue one) with faint far-away ledges and drifting dust. The Tower stands on top of both; the small tower button in the header goes straight to it. The star counter in the header is the total, which is what opens Dimension II.
- Tapping a stone starts the level (a locked stone shakes). No windows, no boxes.

`openLevels()` in `game.js` hands over to `LevelPath.open()`; the old grid is still in `openLevels` as a fallback and is never reached while the module is loaded.
