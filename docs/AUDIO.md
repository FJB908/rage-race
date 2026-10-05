# Audio

- **Recorded, not synthesised.** `src/audio/sfx.js` still holds the sound design (instruments, effects, tracks), but `tools/bake-audio.js` renders all of it once into `src/audio/bank/` (`sfx.ogg` + `sfx.json` for the effects, `music-<track>.ogg` per song). At run time the game only plays those files: one buffer-source per sound, no oscillators, filters or offline rendering while you play. That is what keeps it from crackling on a busy phone.
- **Fallback.** If the files cannot be loaded, the old live synthesis takes over (never the normal path).
- **Decoding** happens once, after the first tap, with the device's own sample rate, off the main thread.
- **Playlists** (`LISTS`): every mode has 1-3 songs (menu 3, race 3, escape 2, gauntlet 2, levels 2, results 1). The next song is queued on the audio clock right after the current one ends, so the music changes inside a long race and between races. The menu rests 4-11 s between songs.
- **Stingers** (`SFX.sting(kind)`): `lead` (you take the lead, ducks the music), `win`, `place`, `lose` (the music stops for the fanfare, then the results song starts), `qualify`, `elim` (duck only), `gtwin` (Gauntlet win).
- Rebuild: `node tools/bake-audio.js` (about a minute), then commit `src/audio/bank/`.
