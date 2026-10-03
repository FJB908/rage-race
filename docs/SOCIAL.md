# Friends and party (no game server)

`src/social/social.js` + `social.css`, rules in `firestore.rules`. Needs the cloud account (`cloud.js`), anonymous accounts work.

* **Friend code:** 8 characters derived from the account id (`codeFromUid`), shown as ABCD-EFGH. Each player publishes a public card to
  `profiles/{uid}` (name, look, level, rank, last seen); friend search is a query on `code`.
* **Friends:** one `friendships/{a_b}` document per pair (`pending` then `accepted`). Only the other person can accept. Online = seen in the last 6 minutes
  (the card is refreshed on start, on return to the app, and every 5 minutes, which keeps Firestore writes low).
* **Party:** `parties/{code}` (host, status, seed, token) with `members/{uid}` and `results/{uid}`. Invites are `invites/{friendUid}_{code}`.
  Host presses START: status `racing` + a random seed. Every member's phone sees the change and starts the same seeded track (3 roster
  bots as filler, no rubber band). On finish each phone writes its time; the party board lists times as they come in.
* **Live party races (Realtime Database):** `database.rules.json`, `Cloud.config.databaseURL`. The host picks a start moment on the database's clock (`.info/serverTimeOffset`),
  every phone starts the same seeded track so that GO lands on that moment, and sends x/y/vy 10 times a second to `rooms/{party}/{token}/{uid}`. Friends'
  slots become `remote` players (no physics, no bumping), shown ~150 ms in the past with interpolation. A friend who leaves is counted as finished last.
  Without a database URL or if it fails, the time-only board below is used.
  Not synced: power-ups, hits and moving/breaking platforms (they run locally on each phone).
* **Time-only fallback:** positions are not streamed, so you do not see your friends on the track. That needs a game server (Colyseus, see roadmap).
  Times are comparable but not a real head-to-head: bots behave differently per phone.
* **Limits to know:** any signed-in player can read all public cards (names are public); friend request spam is possible (add rate limits with
  a Cloud Function later); ranked/rewards are not tied to party races.
