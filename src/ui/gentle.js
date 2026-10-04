// GENTLE START: new players get an easier, simpler, kinder game that grows with them.
//  - ease():   0..1, how much help the game gives right now. High for your first races and after a few losses in a row (it fades as you win).
//              It widens platforms, shrinks gaps, removes crumbling/icy ledges and makes the bots clumsier and slower.
//  - locks:    modes and menu blocks open up with your level, so the first screens show only Play.
//  - titles:   every level range has a name (shown next to your name); levelling up shows a celebration that says what just opened.
// Loaded BEFORE game.js (it only calls prog() lazily). See docs/GENTLE.md.
(function () {
    'use strict';
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const LOCKS = { parkour:2, build:3, escape:4, gauntlet:5, ranked:6 };            // mode -> level
    const OPENS = {                                                                  // level -> what it opens (shown on level-up)
        2: ['Levels'], 3: ['Build Race', 'Daily rewards', 'Missions', 'Rage pass', 'Friends & parties'], 4: ['Escape'], 5: ['Gauntlet'], 6: ['Ranked'] };
    const TITLES = [[1, 'Rookie'], [2, 'Hopper'], [3, 'Bouncer'], [5, 'Climber'], [8, 'Daredevil'], [12, 'Sky Runner'], [16, 'Stunt Pro'], [20, 'Rage Racer'], [26, 'Legend'], [35, 'Mythic']];
    const lvlOf = () => { try { return levelInfo(prog().xp).lvl; } catch (e) { return 1; } };
    const title = lvl => { let t = TITLES[0][1]; for (const [l, n] of TITLES) if (lvl >= l) t = n; return t; };
    function ease() {
        let p; try { p = prog(); } catch (e) { return 0; }
        if (window.rankedMatch || window.partyMatch) return 0;                       // fair matches stay fair
        const races = p.races || 0;
        const base = races < 3 ? 1 : Math.max(0.12, 1 - (races - 3) / 60);          // 100% for 3 races, fading slowly over ~50 races, never fully gone in casual play
        const lose = clamp((p.loseStreak || 0) * 0.22, 0, 0.66);                      // 2 losses in a row: noticeably kinder
        return clamp(base + lose, 0, 1);
    }
    const unlocked = mode => lvlOf() >= (LOCKS[mode] || 1);
    window.Gentle = { ease, LOCKS, OPENS, TITLES, lvlOf, title, unlocked, simple: () => lvlOf() < 3 };
})();
