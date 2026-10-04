# Ads

`src/ads/ads.js` (+ `ads.css`). The web build runs a TEST provider (a fake ad screen). Real ads need the Android build: use AdMob
(Capacitor plugin `@capacitor-community/admob`) and call `Ads.setProvider({ show(kind){ ... return Promise<boolean> } })` once at start.
`show('rewarded')` must resolve `true` only when the reward was earned; `show('interstitial')` resolves `true` when it was shown.

* **Interstitial:** only on arrival at the main menu after a played match (at least 15 s of play). Never in a match, in a reward or
  loot screen, or before the tutorial is done. Rules in `CFG`: not for the first 4 races, at most one per 3 finished matches, and at least
  4 minutes apart. `prog().noAds` switches them off (for a future "remove ads" purchase).
* **Rewarded:** Shop > Coins & Gems. +500 coins (5 per day) and a free supply drop (3 per day, mostly common, sometimes rare/epic),
  20 s cooldown. Counters are in `prog().ads` and reset every day.
* **Before launch:** the daily caps and the reward are enforced on the phone. With the server step, verify rewarded ads with AdMob
  server-side verification so a modified client cannot claim them. Add a consent form (Google UMP) for EU players and fill in
  the Play Console "Data safety" section.
