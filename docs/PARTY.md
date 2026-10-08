# Party (play with friends)

- **UI:** `src/ui/party.js` + `party.css`: the home screen shows you and up to 3 party members, a plus invites friends, tapping a member opens a small sheet (leader can remove, you can leave).
- **Network:** `src/social/social.js` (Firestore for party, members and invites; Realtime Database for live positions). Switch with `PARTY_ENABLED`.
- **Needs:** published `firestore.rules` and `database.rules.json`, and a signed-in (Google) account. Without them the plus explains what is missing.
- **Quick race:** the leader presses PLAY, everyone races the same seeded track at the same moment. Slots not filled by party members are bots.
- **Gauntlet:** the leader plays; members appear as stand-ins until Gauntlet runs on a game server.
- **Rewards:** a race with only lobby members (4 of 4) pays nothing (`partyMatch.noRewards`).
- **Next with a server:** authoritative rooms, matchmaking that fills parties with strangers, reconnect, ready checks, party chat/emotes.

## Party = private lobby, not the arena
- **The arena belongs to the solo player.** As soon as someone else is in your party (`Party.active()`), the home leaves arena mode: no arena world, island, drifting air or trophy row. The home looks like every other mode (the glow of the mode behind you, a small ledge), and your friends stand next to you on it. Leave the party and the arena world comes back.
- **The race** is a private lobby with bots: Playground rules and look, bots fill the free slots, nothing from the arenas (no arena power-up pool, no arena ledge rules).
- **Trophies**: a party race pays none (`Trophies.record` is skipped when `partyMatch` is set), so friends can never pull each other up or down the arena ladder and the arena stays about your own climb. A party of 4 pays nothing at all (see Rewards above).
- **Why**: arena gameplay is tuned to your trophy level (rules, bots, power-ups); mixing different levels in one match would be unfair, and showing an arena you are not playing is confusing. With the server later: Arena Race = matchmaking by trophies (no fast-forward, `ARENA_ONLINE`), party = a room you own.
