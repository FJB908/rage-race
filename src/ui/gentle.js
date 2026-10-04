// GENTLE START: new players get an easier, simpler, kinder game that grows with them.
//  - ease():   0..1, how much help the game gives right now. High for your first races and after a few losses in a row (it fades as you win).
//              It widens platforms, shrinks gaps, removes crumbling/icy ledges and makes the bots clumsier and slower.
//  - locks:    modes and menu blocks open up with your level, so the first screens show only Play.
//  - titles:   every level range has a name (shown next to your name); levelling up shows a celebration that says what just opened.
// Loaded BEFORE game.js (it only calls prog() lazily). See docs/GENTLE.md.
(function () {
    'use strict';
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const LOCKS = { parkour:3, build:3, escape:3, gauntlet:3, ranked:5 };            // mode -> race WINS needed (Quick play, Build Race etc. all count)
    const OPENS = { 3: ['Daily rewards', 'Missions', 'Rage pass'] };                  // level -> what it opens (shown on level-up)
    const WIN_OPENS = { 3: ['Levels', 'Build Race', 'Escape', 'Gauntlet'], 5: ['Ranked'] };      // wins -> modes that open
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
    const winsOf = () => { try { return prog().wins || 0; } catch (e) { return 0; } };
    const unlocked = mode => winsOf() >= (LOCKS[mode] || 0);
    window.Gentle = { ease, LOCKS, OPENS, WIN_OPENS, winsOf, TITLES, lvlOf, title, unlocked, simple: () => lvlOf() < 3 };
})();
