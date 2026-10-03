# Friends and party (no game server)

`src/social/social.js` + `social.css`, rules in `firestore.rules`. Needs the cloud account (`cloud.js`), anonymous accounts work.

* **Friend code:** 8 characters derived from the account id (`codeFromUid`), shown as ABCD-EFGH. Each player publishes a public card to
  `profiles/{uid}` (name, look, level, rank, last seen); friend search is a query on `code`.
* **Friends:** one `friendships/{a_b}` document per pair (`pending` then `accepted`). Only the other person can accept. Online = seen in the last 6 minutes
  (the card is refreshed on start, on return to the app, and every 5 minutes, which keeps Firestore writes low).
* **Party:** `parties/{code}` (host, status, seed, token) with `members/{uid}` and `results/{uid}`. Invites are `invites/{friendUid}_{code}`.
  Host presses START: status `racing` + a random seed. Every member's phone sees the change and starts the same seeded track (3 roster
  bots as filler, no rubber band). On finish each phone writes its time; the party board lists times as they come in.
* **Not live:** positions are not streamed, so you do not see your friends on the track. That needs a game server (Colyseus, see roadmap).
  Times are comparable but not a real head-to-head: bots behave differently per phone.
* **Limits to know:** any signed-in player can read all public cards (names are public); friend request spam is possible (add rate limits with
  a Cloud Function later); ranked/rewards are not tied to party races.
