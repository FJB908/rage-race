// GENTLE START: new players get an easier, simpler, kinder game that grows with them.
//  - ease():   0..1, how much help the game gives right now. High for your first races and after a few losses in a row (it fades as you win).
//              It widens platforms, shrinks gaps, removes crumbling/icy ledges and makes the bots clumsier and slower.
//  - locks:    modes and menu blocks open up with your level, so the first screens show only Play.
//  - titles:   every level range has a name (shown next to your name); levelling up shows a celebration that says what just opened.
// Loaded BEFORE game.js (it only calls prog() lazily). See docs/GENTLE.md.
(function () {
    'use strict';
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const LOCKS = { parkour:3, build:3, escape:3, gauntlet:3 };            // mode -> race WINS needed (Arena Race, Build Race etc. all count)
    const OPENS = { 3: ['Daily rewards', 'Missions', 'Rage pass'] };                  // level -> what it opens (shown on level-up)
    const WIN_OPENS = { 3: ['Levels', 'Build Race', 'Escape', 'Gauntlet'] };      // wins -> modes that open
    const TITLES = [[1, 'Rookie'], [2, 'Hopper'], [3, 'Bouncer'], [5, 'Climber'], [8, 'Daredevil'], [12, 'Sky Runner'], [16, 'Stunt Pro'], [20, 'Rage Racer'], [26, 'Legend'], [35, 'Mythic']];
    const lvlOf = () => { try { return levelInfo(prog().xp).lvl; } catch (e) { return 1; } };
    const title = lvl => { let t = TITLES[0][1]; for (const [l, n] of TITLES) if (lvl >= l) t = n; return t; };
    // ADAPTIVE DIFFICULTY: `dda` (0..1) is how much help you get, and it follows your results so the bots end up just beatable:
    // wins make the next race a bit harder, 3rd/4th place make it clearly kinder. It settles where you win about half your Arena Races.
    // Your first 3 races are never below 60% help (the game does not carry you: arenas open the ledge types and power-ups one at a time instead, see ARENAS.md).
    const START_HELP = 0.8, FIRST_RACES_FLOOR = 0.6;
    const DDA_STEP = { 1:-0.07, 2:0, 3:0.10, 4:0.16, 5:0.16 };       // place (5 = did not finish) -> change
    function ease() {
        let p; try { p = prog(); } catch (e) { return 0; }
        if (window.partyMatch) return 0;                                             // fair matches stay fair
        const dda = p.dda === undefined ? START_HELP : clamp(p.dda, 0.04, 1.4);
        return (p.races || 0) < 3 ? Math.max(dda, FIRST_RACES_FLOOR) : dda;
    }
    function record(place, finished) {
        const p = prog(); const cur = p.dda === undefined ? START_HELP : p.dda;
        p.dda = clamp(cur + (DDA_STEP[finished ? Math.min(place, 4) : 5] || 0), 0.04, 1.4); saveProg(p);
    }
    const winsOf = () => { try { return prog().wins || 0; } catch (e) { return 0; } };
    const unlocked = mode => winsOf() >= (LOCKS[mode] || 0);
    const shopReady = () => { try { const p = prog(); return (p.races || 0) >= 3 && (p.wins || 0) >= 1; } catch (e) { return true; } };      // shop and ad nudges wait until you have played a bit and won once
    window.Gentle = { ease, shopReady, record, LOCKS, OPENS, WIN_OPENS, winsOf, TITLES, lvlOf, title, unlocked, simple: () => lvlOf() < 3 };
})();
