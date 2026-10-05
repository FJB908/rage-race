# Cosmetic Designer

1. Start Live Server (VS Code "Go Live") and open `http://127.0.0.1:5500/tools/designer.html`.
2. Pick Skins / Hats / Faces / Trails, then **+ New** (or click a built-in to remix it).
3. Draw on the canvas: Rectangle, Ellipse, Polygon (click corners), Pen (freehand, auto-smoothed), or add a Stamp.
   - Select tool: drag to move, white squares resize/reshape, green dot rotates, circle on an edge adds a corner, double-click a corner deletes it.
   - "Mirror draw" creates the mirrored twin automatically (ears, horns, wings).
   - Layers: reorder, hide, copy, mirror, flip, gradient fill, outline, opacity, smooth curves. Skins get decal layers on top of the base pattern.
   - Shortcuts: Ctrl+Z / Ctrl+Y undo/redo, Ctrl+D copy, Delete, arrow keys nudge, Esc cancel.
4. **Save to project** (Chrome/Edge) writes `src/data/custom-cosmetics.js`. **Push to GitHub** commits it (needs a token under GitHub settings). Or commit in VS Code.
5. "Copy design JSON" / "Paste design JSON" shares a single design (for example into chat).
6. Reload the game: new items appear in the shop, drops and the pass.

## Generators (for bulk work)
`tools/gen_skins.py`, `gen_hats.py`, `gen_faces.py`, `gen_trails.py` regenerate the layered art. Run them from the project root, for example `python3 tools/gen_hats.py`. They write `src/data/skin-styles.js`, `accessory-styles.js`, `trail-styles.js` (restyles of built-ins) and the new items in `src/data/custom-cosmetics.js`. Note: they rewrite their own part of `custom-cosmetics.js`, so save designer work you want to keep as separate items first.

## Audio (`bake-audio.js`)
`node tools/bake-audio.js` renders every sound effect and music track from `src/audio/sfx.js` into ogg files in `src/audio/bank/` (needs playwright and ffmpeg).
The game only plays those recordings, so nothing is synthesised while you play. Run it again after changing a sound, a track or the playlists, and commit the files.
