# Server step: Ranked on Cloud Functions

Code: `functions/` (`rank.js` = the Ranked rules, `handlers.js` = the two calls, `index.js` = Firebase wrapper, `test.js` = tests, run with `node test.js`).
Rules: `firestore.rules` (`ranked/{uid}` is readable by its owner and writable by nobody but the server), `database.rules.json`.

## What the server does
* `rankedStart`: creates a match id on the server. The first call adopts the phone's old local record (capped at 1500 MMR).
* `rankedFinish`: the phone reports place, finish time and the opponents' ratings. The server checks the match is open, belongs to the caller, was not
  faster than a bot-free climb is possible (18 s), and that the lobby is inside the matchmaking window. It then applies the same maths as the phone
  (`rank.js`, verified equal over 120 random matches including season changes) and returns the new record. Limits: 30 results per hour, matches expire after 400 s.
* The phone adopts the server's record (`adoptServer` in ranked.js). Without a server answer it computes locally. Set `SERVER_REQUIRED = true` in ranked.js at launch.
* A match that was never finished (app closed) is settled as a forfeit on the server the next time the game opens.

## Still trusted to the phone (until the next server step)
Coins, gems, cosmetics and season-reward claims, and the ratings of the bot opponents. A real-player lobby is chosen by the server, so those ratings stop being client input then.

## Deploying (needs the Blaze plan)
Easiest from a phone: Google Cloud Shell (shell.cloud.google.com, free terminal in the browser):
```
git clone https://github.com/FJB908/test-app && cd test-app && git checkout <branch>
cd functions && npm install && node test.js && cd ..
firebase login --no-localhost
firebase deploy --only functions,firestore:rules,database --project rage-race
```
Alternative: the GitHub Action `Deploy Firebase` (Actions tab, run by hand). It needs the repository secret `FIREBASE_SERVICE_ACCOUNT` (JSON key of a service
account with the roles Firebase Admin, Cloud Functions Admin, Service Account User, Cloud Build Editor, Artifact Registry Writer, Service Usage Admin).
The workflow file must be on the default branch to show up in the Actions tab.
