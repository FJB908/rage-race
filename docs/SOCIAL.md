# Friends and party (no game server)

`src/social/social.js` + `social.css`, rules in `firestore.rules`. Needs the cloud account (`cloud.js`), anonymous accounts work.

* **Friend code:** 8 characters derived from the account id (`codeFromUid`), shown as ABCD-EFGH. Each player publishes a public card to
  `profiles/{uid}` (name, look, level, rank, last seen); friend search is a query on `code`.
* **Friends:** one `friendships/{a_b}` document per pair (`pending` then `accepted`). Only the other person can accept. Online = seen in the last 6 minutes
  (the card is refreshed on start, on return to the app, and every 5 minutes, which keeps Firestore writes low).
* **Party:** `parties/{code}` (host, status, seed, token) with `members/{uid}` and `results/{uid}`. Invites are `invites/{friendUid}_{code}`.
  Host presses START: status `racing` + a random seed. Every member's phone sees the change and starts the same seeded track (3 roster
  bots as filler, no rubber band). On finish each phone writes its time; the party board lists times as they come in.
* **Live party races (Realtime Database):** `database.rules.json`, `Cloud.config.databaseURL`. The host picks a start moment on the database's clock
  (`.info/serverTimeOffset`); every phone starts the same seeded track so GO lands on that moment. Each phone simulates only its own player and sends
  x, y, vy, finish time, giant/shield/bounce/rocket timers and the platform it stands on 10 times a second to `rooms/{party}/{token}/p/{uid}`.
  Friends are `remote` players shown ~120 ms in the past with interpolation. They take part in bumps (giants dominate, stomping works): each phone
  resolves the bump for its own player against the friend's displayed position.
* **Shared bots:** the host picks the filler bots (roster) when starting and stores them in the party document. The phone with the lowest uid
  simulates them and publishes them under `p/bot_{id}`; the others show them as remote players. If a friend leaves, the lowest remaining uid takes over
  that player as a bot (and the bots again if their simulator leaves).
* **Events** (`rooms/.../ev`): item box pickups, and attacks that touch other players (wind, quake, chain). Every phone replays them; the effect on your own player
  runs locally. Self-only items (rocket, giant, shield, bounce) travel as the timers above. UFO carrying is only visible through the carried positions.
* **Not synced exactly:** moving and breaking platforms run locally (moving ones start together and are deterministic, so they stay close), the rolled item of a friend, and
  fine collision timing (lag up to ~150 ms). A server (Colyseus) would make everything exact later.
* **UI:** the pause/menu button is hidden in Ranked and live party races (`body.online-race`).
* **Time-only fallback:** positions are not streamed, so you do not see your friends on the track. That needs a game server (Colyseus, see roadmap).
  Times are comparable but not a real head-to-head: bots behave differently per phone.
* **Limits to know:** any signed-in player can read all public cards (names are public); friend request spam is possible (add rate limits with
  a Cloud Function later); ranked/rewards are not tied to party races.
