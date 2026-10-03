# Cloud save

Firebase project `rage-race` (Authentication + Firestore). Code: `src/cloud/cloud.js`, UI `src/cloud/account.js` + `cloud.css`,
rules `firestore.rules` (paste in Firestore > Rules > Publish).

* Every install gets an **anonymous account** on first start. Progress is mirrored to `users/{uid}` (one document, `blob` = JSON of
  `rr_profile`, coins, gems, best scores, level stars, tutorial flag) about 5 s after any change, and when the app goes to the background.
* localStorage stays the source the game reads. Offline play is unchanged; pending changes push when the network returns.
* **Google sign-in** (Profile tab) links the anonymous account, so the same uid survives. If that Google account already has a save
  (new phone), the two are **merged** and the page reloads once from the menu.
* Merge rules (`merge()`): numbers = max (best times = min of non-zero), lists/claims/owned = union, level stars = per-level max,
  Ranked = the record with the later season / more matches, season history = union by season, equipped items and name = most recent
  device. `lootGrants` are unioned so a drop is never granted twice.
* Sync state per device: `rr_cloud_meta` = `{ uid, synced, localTs, dirty, force }`. `synced` is the cloud timestamp we last saw; if the
  cloud has a different one, the next push merges first. Settings > Reset sets `force` so the empty state replaces the cloud copy.

## Known limits (fixed in the next step, server-side)
* Coins and gems merge by max, so spending on one phone can be undone by another. A server-side ledger fixes this.
* The client writes its own save, so a modified client can write any values. Ranked, rewards and purchases must move to Cloud Functions.
