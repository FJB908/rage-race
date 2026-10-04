# Party (play with friends)

- **UI:** `src/ui/party.js` + `party.css`: the home screen shows you and up to 3 party members, a plus invites friends, tapping a member opens a small sheet (leader can remove, you can leave).
- **Network:** `src/social/social.js` (Firestore for party, members and invites; Realtime Database for live positions). Switch with `PARTY_ENABLED`.
- **Needs:** published `firestore.rules` and `database.rules.json`, and a signed-in (Google) account. Without them the plus explains what is missing.
- **Quick race:** the leader presses PLAY, everyone races the same seeded track at the same moment. Slots not filled by party members are bots.
- **Gauntlet:** the leader plays; members appear as stand-ins until Gauntlet runs on a game server.
- **Rewards:** a race with only lobby members (4 of 4) pays nothing (`partyMatch.noRewards`).
- **Next with a server:** authoritative rooms, matchmaking that fills parties with strangers, reconnect, ready checks, party chat/emotes.
