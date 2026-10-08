# Power-ups

Items come out of the item boxes in races (not in the Gauntlet). The code of the two newest lives in `src/items/powerups.js` (`window.PU`); `game.js` only has small hooks.

| Item | What it does | Who gets it |
|---|---|---|
| **Cannon** | You turn into a standing cannon (also when used in mid-air: it falls, lands, then deploys). Drag to aim (about +-22 degrees), release to fire at full power, roughly 1400+ px up the track. A dotted preview shows the arc and where you land (off-screen targets show an arrow with the progress gained). Fires itself after 9 s. | Only far behind the leader (gap over 650 px); most likely in last place |
| **Double jump** | For 7 s you can jump once more in mid-air (one per flight, drag and release). A cloud puffs under you; a small cloud under your feet shows that an extra jump is ready. Everyone sees both (party races: `dj` event + sample fields). | Everyone, a bit more when behind |
| **Stun bomb** | Replaces the Wind (which is no longer handed out). Using the item drops the bomb right where you are; it stays hanging there for 10 s with a faint red danger zone (a thin dashed rim and a light tint, a bit stronger when somebody is inside). Everyone who flies or lands inside is dazed for 1 s: no jumping, momentum halved, stars around the head. Each player is hit once per bomb, then immune for about 2 s. You are safe in your own zone until you have left it once. A shield blocks it. Bots drop it when someone is about to pass their spot. Party races: a `bomb` event (position) and the `zp` sample field. | The odds the Wind had (more when behind) |
| **Super bounce** | Now shows a coiled spring under the player that squashes on every rebound. Visible to all players. | unchanged |

Party races: the 10 Hz samples carry `cn` (cannon state, 3 = in flight), `ca` (aim), `dj` and `du`; clouds travel as events.
Bots: they fire the cannon at the best reachable platform (scan of the angle range) and use the extra jump to rescue a miss.

The Magnet was built and tried and then removed again. Item odds: shield is no longer the favourite of whoever is in front, and the same item rarely comes twice in a row.

## Rocket (updated)
The rocket now always launches you at its full speed (2350, up from 1650), whether you stand, fall or are already rising. It does not add on top of a jump. Climb is about 1100 px (about twice as high as before; a falling player used to get only ~110 px). You cannot be knocked off course for the first half second.

## Changes (latest)
- Double jump lasts 5 s (was 7). The stun bomb explodes after 3.5 s (was 6).
- Earthquake: a player still standing on a warned platform now falls with it (it no longer stays up).

---

# PROPOSAL v2 (not built yet): a fairness review of every power-up, and a smaller, better list

First proposal had 16 new power-ups. After going through all of them (the 11 that exist and the 16 new ones) several were weak or unfair, so this version drops 9 of them and rebuilds the pool around the 10 that hold up. Nothing here is built yet. Numbers are estimates from the game constants, not measured: a **ledge (LE)** is about 150 px and about 1 second of racing (a good bot climbs 180 px/s), a normal jump reaches at most 423 px (about 3 ledges), a Rocket climbs 1,150 px (about 7 LE), the Cannon 1,400 px (about 9 LE), a stun is 1 s, an Earthquake drops a standing player 340 px (2.3 LE).

## How a power-up is judged
1. **Is it worth something?** Value in LE for the owner, or cost in LE for the victim. Boosts for the back of the pack may be worth up to about +8 LE; anything the leader can roll must stay under about +3 LE; an attack should cost its victim 1.5 to 4 LE.
2. **Can it fail on timing?** An attack aimed at a *ledge* is unreliable, because the leader is on a ledge for about a second and then gone. Attacks must aim at a *player* (Chain, Lightning, Snowball) or at the whole top of the field (Earthquake), never at one ledge.
3. **Does it help somebody it should not?** A zone or effect that also helps the rivals nearby (Updraft, Moon Bubble) is out; an effect that also hurts the players *behind* you (the Gust today) is wrong.
4. **Is there an answer?** Every strong effect has one: Shield, Mirror, Safety Net, or simply moving away.
5. **Does the leader get the good stuff?** Odds follow rank: strong boosts and attacks go to the back, defence a bit more to the front.

## Review of the 11 that exist
| Power-up | Worth | Verdict |
|---|---|---|
| Rocket | +7 LE, back of the pack | fair, keep |
| Cannon | +9 LE, only 650 px or more behind | fair, keep |
| UFO | +2 to +6 LE (the gap to the next player), far behind only | fair, keep |
| Double Jump | +2 LE (it fixes a miss, sometimes one jump higher), everybody | fair, keep |
| Giant | +1 to +2 LE and it bumps people away; varies a lot | fine, but the odds are the same for the leader: lower them for the front |
| Super Bounce | +3 to +5 LE but chaotic (you cannot rest on a ledge for 5 s) | too good for the leader: today the front gets it more than the back. Flip the odds, and it is a training wheel that leaves early |
| Shield | +0.5 LE on average (only when somebody attacks) | weak when there are no attacks in the pool. Make its odds depend on the attacks in the pool |
| Gust | -1 to -2 LE per victim | **unfair as built**: it also shakes the players *behind* you. Change it so that it only hits players ahead of you |
| Stun Bomb | -1 to -2 LE per hit, 3.5 s fuse, you can walk out | fair, keep (it is a mine, dodgeable and visible) |
| Chain | -2 LE (jumps at 80%, gravity 125% for 5.5 s) on the leader | fair, keep |
| Earthquake | -3 to -5 LE for everybody above the average | the strongest attack; fair because it is telegraphed, blocked by a Shield, and only likely at the back |

## Review of the 16 new ones from the first proposal
| Power-up | Verdict | Why |
|---|---|---|
| Nitro | **keep**, now defined | next 2 jumps launch 25% harder (56% higher): +2 to +4 LE for whoever aims well |
| Parachute | **drop** | slow falling is worth nothing here: there is no fall damage and you cannot steer, a slower fall only lasts longer |
| Updraft | **drop** | the column also lifts the rivals standing near you; the personal version is Moon Boots |
| Oil Slick | **drop** | it lands on the ledge the leader is standing on, and he leaves after a second: no effect |
| Conveyor | **drop** | same problem as the Oil Slick |
| Anchor | **drop** | a duplicate of the Chain, and at 65% jump power the jump height drops to 42%, which can strand somebody under a 220 px gap |
| Lifebuoy | **keep**, renamed Safety Net | catches your next fall: about +1.5 LE, a real safety item |
| Train | **drop** | the leader moves about 400 px/s, so a 1 s warning at one height misses almost always |
| Grip | **drop** | worth about 0.5 LE and only on ice |
| Snowball | **keep** | player-targeted, answerable, milder than a stun |
| Moon Bubble | **drop** | a zone that helps everybody inside; replaced by Moon Boots (personal) |
| Jetpack | **keep** | the upgrade of the Double Jump |
| Swap | **keep, with limits** | very strong (about 8 LE net swing), so only 3rd and 4th place, only against a player up to 600 px above, never against a Shield |
| Rockslide | **drop** | column-targeted like the Train, and hard to build |
| Lightning | **keep** | player-targeted, telegraphed (1 s), blocked by Shield and Mirror |
| Mirror | **keep** | the late-game answer to attacks; replaces the Shield |

## The new list: 10 power-ups
| Power-up | Arena | Role | What it does | Worth |
|---|---|---|---|---|
| **Nitro** | Parking Lot | boost | next 2 jumps launch 25% harder (flame trail), over after 2 jumps or 10 s | +2 to +4 LE |
| **Glider** | Rooftop | safety/skill | 6 s: drag sideways while you are in the air to steer (a paper glider). It rescues a bad jump | +2 to +3 LE (saves about one fall) |
| **Safety Net** | Harbour | safety | for 12 s the next fall of more than 2 ledges is caught: a ring floats you back to the ledge you left (once) | +1.5 LE |
| **Grapple** | Factory | boost | a hook shoots the best ledge above you (within 450 px) and pulls you onto it in 0.4 s: no aim, no miss | +2 LE |
| **Mirror** | Subway | defence | 6 s: the next attack aimed at you is thrown back at whoever sent it. Replaces the Shield | prevents 2 to 4 LE |
| **Snowball** | Mountain | attack | a homing ball flies to the nearest rival ahead (up to 900 px): 0.6 s freeze, then 4 s of jumps at 85% power. Blocked by Shield and Mirror | -1.5 to -2 LE |
| **Moon Boots** | Space Station | boost | 8 s of low gravity for you only: jumps go 1.8x as high, falls are slow; the dotted line shows the new arc | +3 LE |
| **Jetpack** | Space Station | boost | 3 extra air jumps within 8 s (the big brother of the Double Jump) | +3 to +5 LE |
| **Swap** | Volcano | comeback | swap places with the player directly above you (at most 600 px up): both are protected for 1 s | +4 LE for you, -4 for them |
| **Lightning** | Summit | attack | marks the leader (ring and thunder) and strikes after 1 s: stun 1.2 s. Replaces the Earthquake | -2 LE |

The 11 that exist stay: Super Bounce, Rocket, Giant, Shield, Double Jump, Gust, Stun Bomb, Chain, Earthquake, UFO, Cannon.

## The pool per arena
| # | Arena | New | Leaves | In play |
|---|---|---|---|---|
| 1 | Playground | Super Bounce, Rocket, Giant, Shield | - | 4 |
| 2 | Parking Lot | Double Jump, **Nitro** | - | 6 |
| 3 | Rooftop | Gust, **Glider** | Giant | 7 |
| 4 | Harbour | Stun Bomb, **Safety Net** | Super Bounce | 8 |
| 5 | Factory | Chain, **Grapple** | Nitro, Gust | 8 |
| 6 | Subway | Earthquake, **Mirror** | Glider, Safety Net, Shield | 7 |
| 7 | Mountain | UFO, **Snowball** | Grapple | 8 |
| 8 | Space Station | Cannon, **Moon Boots**, **Jetpack** | Double Jump, Chain | 9 |
| 9 | Volcano | **Swap**, Gust (comes back as the ash storm) | Snowball, Moon Boots | 9 |
| 10 | Summit | **Lightning** | Earthquake | 9 |

Arena 3 keeps five of the six from arena 2 and swaps one for two new ones. Every arena has 2 or 3 new ones except the Summit, which is the only one with a single new one (the finale is about mastering what you already know). The training wheels leave in order: Super Bounce (4), Giant (3), Glider and Safety Net and Shield (6).

## Odds that change
- **Super Bounce**: more likely at the back (was more likely at the front). **Giant**: less likely at the front.
- **Gust**: only hits players ahead of you.
- **Shield**: its odds scale with the number of attacks in the pool, so it is rare in the first arenas where almost nothing attacks.
- **Swap**: only from 3rd place down. **Lightning**: only from 3rd place down. **Snowball**: only when somebody is ahead within 900 px.
- Neutral: Nitro, Glider, Safety Net, Grapple, Moon Boots, Jetpack (the front gets them 20% less often). Mirror is slightly more likely at the front.

## Build order
1. Odds changes and the Gust fix (a few lines each).
2. **Cheap, self only**: Nitro, Safety Net, Moon Boots, Jetpack.
3. **Player-targeted**: Lightning, Mirror, Snowball.
4. **Needs new movement**: Glider (steering in the air), Grapple (a hook to a ledge), Swap.
Each also needs an icon, a sound from the existing bank, the themed look, a bot rule, a party event and a line in the Arenas screen. It would also be worth measuring all of them with a headless simulation (many races with and without each item) before the numbers are final.

## Built since: Nitro, Safety Net, Jetpack (and what the measurements said)
`src/items/powerups.js` now also holds **Nitro** (next 2 jumps launch 25% harder, 10 s), **Safety Net** (20 s: a fall of more than about 2.5 ledges below the ledge you last stood on throws you back up so that you land on it again) and **Jetpack** (3 extra air jumps in total within 8 s). They only come out of the item boxes in Arena Race and Build Race, from the trophy counts in the table of ARENAS.md; parties and other modes never roll them.

To check the numbers I ran a headless simulation: a bot in 3rd place gets one item in a 4 bot race, and I measure how far it climbs in the next 18 s, against the same race without the item (36 races each, seeded). 1 ledge is about 150 px. The error of one average is about 150 px, so differences below about 300 px are noise.

| Item | Climb vs nothing | Verdict |
|---|---|---|
| Cannon | +1,437 px (+9.6 ledges) | the biggest, only far behind: fine |
| Jetpack (3 charges in total) | +869 px (+5.8) | as strong as a Rocket: odds mostly at the back, nearly never at the front |
| Rocket | +783 px (+5.2) | fine |
| Super Bounce | +721 px (+4.8) | **as strong as a Rocket**, yet it used to be MORE likely at the front: fixed (now like the Rocket, mostly at the back) |
| Giant | +507 px (+3.4) | odds no longer flat: a bit more at the back |
| Double Jump | +466 px (+3.1) | fine, even for everybody |
| Nitro | +47 px (about 0) | bots use it as nothing; a human who pulls harder can skip a ledge. Treated as a small helper (a bit more likely at the front) |
| Safety Net | -38 px (about 0) | it caught a fall in 14 of 36 races; a safety item, not a boost |
| Moon Boots (built, then dropped) | about -490 px (-3.3) | a longer hang time makes every jump slower: it hurt instead of helped |
| Jetpack with 3 jumps *per flight* (first try) | +1,489 px (+10) | far too strong: now 3 charges in total |

Planned and still not built: Glider, Grapple, Mirror, Snowball, Swap, Lightning.

## How the next power-up is chosen (spread)
The odds come from your place in the race, the trophy pool and the per-arena boosts. On top of that the **last three power-ups you got count against you**: the newest one is rolled at 12% of its normal odds, the one before at 35%, the one before that at 60% (`rollItem`, `p.itemHist`). So you cycle through the pool instead of seeing the same few. Measured with the Playground pool: the same power-up twice in a row 2 to 6% of the time (it was 12%), and 3.3 to 3.7 different ones in every four.

## A shield wins every bump
While your shield is up nobody without a shield can move you: not by running into you, not when you stand still and get hit, not in the air (`resolveBumps` in game.js). The other player gives way completely (a standing player is shoved aside, an airborne one is pushed out of the overlap). Two shields, or none, meet as before. Landing on the head of a standing player with a shield still just bounces you off.
