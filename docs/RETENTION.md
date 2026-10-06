# Making Rage Race stick: what to add besides fast races and cosmetics

## The diagnosis
Today the loop is: race, chest, cosmetic. That is a good first hour. After that a player has no *next goal*, no *appointment*, nobody who *notices* them and nothing to *get better at*
that is visible. Games that people keep for years give them four things:

| Need | Question the player asks | Rage Race today |
|---|---|---|
| A goal that is near | "What am I working towards this week?" | Pass, missions, streak: yes, but all are "collect" goals |
| An appointment | "Why open the game at 19:00 today?" | Daily streak only. No event, no deadline, no notification |
| Someone who notices | "Who sees that I did something good?" | Party / friends exist, but nothing is shared or compared |
| Mastery | "Am I getting better, and can I prove it?" | Win/loss only. No times to beat, no records, no replays |

Every idea below is aimed at one of those four. Effort is relative to what exists (Firebase + Cloud Functions, roster bots, seeded track generator, party, pass, missions).

## Ranked by impact for the effort

### 1. Daily Track (appointment + mastery) - best first build
One seeded track per day, the same for everyone (like Wordle: everybody plays the same thing, so everybody talks about it).
- Unlimited tries, best time counts. Result screen: "Your time 41.2 s, top 18% today, friends: Sam 39.8 s".
- Leaderboard: friends first, then global top 100, with bots as placeholder filler so it never looks empty.
- Rewards by percentile (top 50% / 10% / 1%) as a chest, plus a **daily streak of finishing it**.
- Cost: the track is already generated from a seed (`matchSeed`). Needs a Firestore collection per day and a Cloud Function that accepts a time.
  Cheating: start with a soft leaderboard (friends + "verified" top 100 via replay check later, see 11).

### 2. Weekly League (weekly loop + a near goal)
30 players (real ones where possible, bots from the roster otherwise) compete for league points earned in *any* mode over the week.
Top 10 are promoted, bottom 5 drop. Bronze, Silver, Gold ... Crown. Promotion gives a chest and a profile frame.
- Different from Ranked on purpose: Ranked is pure skill over a season, League is "play this week, get rewarded" and resets every Monday.
- Duolingo-style: a visible rank *during the week* ("you are 4th, 120 points ahead of 5th") is the strongest reason to play one more race.

### 3. Local notifications (the missing appointment)
Capacitor LocalNotifications, opt-in after the first win, max 1 a day:
- "Your streak ends in 3 hours", "Daily Track is live", "Sam beat your time", "Your chest is ready", "League ends tonight, you are 2nd".
- This is cheap and usually the single biggest day-7 and day-30 retention lever.

### 4. Chest slots with timers (a reason to come back every few hours)
3 slots. A race win puts a chest in a slot, it opens by itself after 1 to 4 hours (or instantly for gems). Now the player *has* something waiting.
Pairs with notification 3. The gem sink already exists (skip timer).

### 5. Wishlist goal (turns coins into a plan)
Pin one shop item as "my goal": a progress bar on the home screen ("Crown trail 62%"). Every race now moves a bar toward something the player picked.
Tiny to build, and it fixes "I have coins but no reason to play".

### 6. First-week journey (day-1 to day-7 retention)
A visible 7-step path for new players (win a race, use 3 items, finish the Daily Track, invite a friend, reach level 5 ...) ending with a guaranteed epic cosmetic on day 7.
Teaches the game, creates a promise to return, and gives a natural place to ask for notifications and the Google login.

### 7. Crews (social obligation, the strongest long term anchor)
A crew of up to 20 friends. Weekly crew goal ("together 300 races") fills a shared chest; crew leaderboard against other crews.
People stay for the people. Needs Firestore + a function for membership; party and friends are the foundation.

### 8. Ghost duels and track codes (cheap social)
- Share a result as a challenge: "Beat my 41.2 s on track K7F-29". The friend races my ghost (a translucent cube replaying my jumps) on the same seed.
- Works asynchronously, so it does not need both players online. Also a natural invite loop for new players.

### 9. Weekly Mutators (variety without new art)
One rule change per week, e.g. low gravity, double items, mirrored track, everything slippery, "only bombs", tiny platforms.
Limited reward track for the event. Cheap because it is a few constants; makes the same game feel new every Monday.

### 10. Titles, achievements and a stats card (identity + mastery)
Achievements with a title shown under the name ("Rocket Pilot", "Untouchable", "Crown x10"), a profile stats card (longest jump, best streak, wins per mode, fastest summit)
and **mastery tracks per power-up** (use the cannon 200 times, get a cannon trail). Something to be proud of that cosmetics cannot be bought.

### 11. Replays and highlight share (mastery + free marketing)
Record the jump inputs (tiny) and replay them: "Watch my finish", auto-clip of the best moment (a cannon shot past the leader, a last-second win), share as a short video/gif.
Replay data also lets the server *verify* Daily Track times (re-simulate the inputs), which solves cheating for 1.

### 12. Track editor with share codes (long term, biggest upside)
Build Race already places pieces. Let players build a whole short track, publish it with a code and have a "featured tracks" list. User generated content is what keeps
Geometry Dash and Mario Maker alive years later. Needs moderation (name filter, report) and a physics-safe validator (the track must be finishable).

### 13. Your cube as a character (emotional anchor, fits the mysterious look)
The cube already has moods. Give it a *bond level* that grows when you play, with small visible reactions: it looks up when you come back after a day, wears a glow aura at higher bond,
shows a different idle glance. No new art, only behaviour, and it makes the cube feel like *yours*.

## Recommended order
1. **Now (1 to 2 weeks):** 5 Wishlist goal, 6 First-week journey, 3 Local notifications, 10 Titles/achievements (first part).
2. **Next:** 1 Daily Track (soft leaderboard), 2 Weekly League, 4 Chest slots.
3. **Then:** 8 Ghost duels, 9 Weekly Mutators, 7 Crews.
4. **Long term:** 11 Replays (also fixes cheating), 12 Track editor, 13 Cube bond.

## What I would *not* do
- Power that can only be bought: it kills ranked and makes the free players leave. Keep gems for cosmetics, time-skips and convenience.
- Pure FOMO shops that vanish in hours. Weekly events with an obvious end date and a fair free track are enough.
- More modes before more reasons to return. There are already 8 modes; the gap is the loop *around* them.
