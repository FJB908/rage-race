// TROPHY ROAD: the visible progress of a player, like the trophies in Clash Royale and Brawl Stars.
//   - A trophy count under your character on the home screen: it goes up when you place well and down when you do badly (with floors so it never feels unfair).
//   - Arenas: the count moves you through 10 arenas (Playground ... Summit). An arena is a safe floor: once you are in it, you cannot drop below its start.
//   - The Trophy Road: a list of milestones on the way, every one with a reward (coins, gems, chests, boosters, cosmetics, a gem chest).
// Trophies come from the placing modes: Arena Race, Boom Tag, Arcade, Escape and the Gauntlet (Build Race stands apart from the arenas and pays none; they replace the old Ranked mode, and they set how strong your opponents are). Levels and the Summit have their own stars.
// Loaded AFTER game.js and levelrewards.js. Profile fields: tr (trophies), trTop (highest arena index reached), trClaimed (milestones taken), trStreak (wins in a row).
(function () {
    'use strict';
    const $ = id => document.getElementById(id);
    const TC = { common:'#35e0c8', rare:'#5b8def', epic:'#b3a9ff', mythic:'#ff4d7d', legendary:'#ffcf3f' };
    const ARENAS = [
        { n:'Playground', at:0,    c:'#35e0c8' }, { n:'Parking Lot', at:500,  c:'#5bb8ff' }, { n:'Rooftop',  at:1000, c:'#ff9a5b' },
        { n:'Harbour',    at:1750, c:'#4fd3ff' }, { n:'Factory',     at:2500, c:'#ffb21f' }, { n:'Subway',   at:3500, c:'#7cf29c' },
        { n:'Mountain',   at:4750, c:'#b3a9ff' }, { n:'Space Station', at:6250, c:'#ff8ae6' }, { n:'Volcano', at:8000, c:'#ff6b4a' },
        { n:'Summit',     at:10000, c:'#ffcf3f' },
    ];                                  // the arenas get longer as you climb: 500, 500, 750, 750, 1,000, 1,250, 1,500, 1,750, 2,000 (a win is worth +30, an average race about +12)
    const SPAN_LAST = 3000;
    const OLD_AT = [0, 150, 400, 800, 1300, 1900, 2600, 3500, 4600, 6000], OLD_LAST = 2000;
    const PREV_AT = [0, 300, 750, 1350, 2100, 3000, 4100, 5400, 7000, 9000];                 // the table before the arenas were made bigger again
    const num = n => Math.round(n).toLocaleString('en-US');
    const arenaOf = tr => { let i = 0; for (let a = 0; a < ARENAS.length; a++) if (tr >= ARENAS[a].at) i = a; return i; };

    /* ------------------------------------------------------------------ the points ---- */
    // what a result is worth. Four-player modes: 1st +30, 2nd +12, 3rd -8, 4th -20. The Gauntlet has 32 players, so it pays by how far you got.
    const FOUR = [30, 12, -8, -20];
    function worth(mode, place) {
        if (mode === 'gauntlet') return place === 1 ? 45 : place <= 3 ? 28 : place <= 8 ? 14 : place <= 16 ? 2 : -12;
        return FOUR[Math.min(4, Math.max(1, place)) - 1];
    }
    let lastResult = null;
    // call once per finished match (the callers already guard against paying twice)
    function record(mode, place) {
        const p = prog(); p.tr = p.tr || 0; p.trTop = p.trTop || 0; p.trStreak = p.trStreak || 0;
        let d = worth(mode, place);
        if (place === 1) { p.trStreak++; if (p.trStreak > 1) d += Math.min(15, (p.trStreak - 1) * 5); } else p.trStreak = 0;     // a win streak adds up to +15
        const floor = ARENAS[p.trTop].at;
        if (d < 0) { if (p.tr < 40) d = 0; else d = Math.max(d, floor - p.tr); }                                                  // no losses at the very start, and never below the arena you reached
        const before = p.tr; p.tr = Math.max(0, p.tr + d);
        p.trTop = Math.max(p.trTop, arenaOf(p.tr));
        saveProg(p);
        if (place === 1 && window.WinMeter) WinMeter.add();                                  // every win fills a piece of the win meter on the home screen
        lastResult = { delta: p.tr - before, tr: p.tr, newArena: arenaOf(p.tr) > arenaOf(before) };
        return lastResult;
    }
    // DIFFICULTY FOLLOWS TROPHIES. The roster bots (src/modes/roster.js) have a rating; this maps your trophies onto that rating, so every placing mode
    // (Arena Race, Build Race, Boom Tag, Arcade, Escape, Gauntlet, parties; Build Race only borrows the rating for its bots) pits you against bots of about your level, and higher up the bots get better:
    //   0 trophies ~ 1050 (a clumsy bot), the Harbour ~ 1260, the Subway ~ 1450, the Mountain ~ 1530, the Volcano ~ 1660, the Summit (9000) ~ 1700 (the best players in the game).
    const TOP = ARENAS[ARENAS.length - 1].at, MK = TOP / 6000 * 2200;           // the curve is stretched with the arenas: the same arena always has about the same opponents
    const mmr = tr => { tr = tr === undefined ? (prog().tr || 0) : tr; return Math.round(1050 + 650 * (1 - Math.exp(-tr / MK)) / (1 - Math.exp(-TOP / MK))); };
    // the rating used to pick opponents right now: your trophy rating, made kinder while the game is still helping you (beginners, or after a few losses in a row)
    const matchMmr = () => { const e = window.Gentle ? Gentle.ease() : 0; return Math.max(850, mmr() - 220 * e); };
    // The old Ranked mode is gone: whoever had a rank starts with the matching trophies (once)
    (function migrate() {
        const p = prog(); if (p.trMig) return; p.trMig = 1;
        const rk = p.rk || {}; if ((rk.placed || 0) >= 5 && rk.rp > 0) { p.tr = Math.max(p.tr || 0, Math.min(4200, Math.round(rk.rp * 2.2))); p.trTop = Math.max(p.trTop || 0, arenaOf(p.tr)); }
        if (p.lastMode === 'ranked') p.lastMode = 'race';
        saveProg(p);
    })();
    // The arenas were made bigger: whoever had trophies keeps the same place inside the same arena (once)
    (function migrateArenas() {
        const p = prog(); if (p.trMig2) return; p.trMig2 = 1; p.trMig3 = 1;                      // this one maps straight into the current table
        const tr = p.tr || 0;
        if (tr > 0) {
            let i = 0; for (let a = 0; a < OLD_AT.length; a++) if (tr >= OLD_AT[a]) i = a;
            const oldNext = OLD_AT[i + 1] === undefined ? OLD_AT[i] + OLD_LAST : OLD_AT[i + 1], newNext = ARENAS[i + 1] ? ARENAS[i + 1].at : ARENAS[i].at + SPAN_LAST;
            p.tr = Math.round(ARENAS[i].at + (tr - OLD_AT[i]) / (oldNext - OLD_AT[i]) * (newNext - ARENAS[i].at));
            p.trTop = Math.max(p.trTop || 0, i);
            try { localStorage.removeItem('rr_tr_shown'); } catch (e) {}
        }
        saveProg(p);
    })();
    // The arenas were stretched once more (Parking Lot 500, Rooftop 1,000, Harbour 1,750, Factory 2,500, ...): again the same place inside the same arena (once)
    (function migrateBigger() {
        const p = prog(); if (p.trMig3) return; p.trMig3 = 1;
        const tr = p.tr || 0;
        if (tr > 0) {
            let i = 0; for (let a = 0; a < PREV_AT.length; a++) if (tr >= PREV_AT[a]) i = a;
            const oldNext = PREV_AT[i + 1] === undefined ? PREV_AT[i] + SPAN_LAST : PREV_AT[i + 1], newNext = ARENAS[i + 1] ? ARENAS[i + 1].at : ARENAS[i].at + SPAN_LAST;
            p.tr = Math.round(ARENAS[i].at + (tr - PREV_AT[i]) / (oldNext - PREV_AT[i]) * (newNext - ARENAS[i].at));
            p.trTop = Math.max(p.trTop || 0, i);
            try { localStorage.removeItem('rr_tr_shown'); } catch (e) {}
        }
        saveProg(p);
    })();
    // how wide the pool of possible opponents is: wide at the start (now and then a better or worse bot), tight at the top (everybody is good there)
    const spread = () => Math.round(150 - 60 * Math.min(1, (prog().tr || 0) / TOP));
    const last = () => { const r = lastResult; lastResult = null; return r; };           // the result of the match that just ended (read once)

    /* ------------------------------------------------------------------- the road ---- */
    // Milestones are generated from the arenas: 4 per arena (at the start, 1/4, 1/2 and 3/4 of the way), plus a first quick one at 15.
    // The arena start is the big one (a cosmetic / the gem chest), the others rotate coins, a chest, a booster or gems; everything grows with the arena.
    let ROAD = null;
    function itemPick(cat, rarity, seed) {
        const pool = (COS_BY[cat] || []).filter(i => i.rarity === rarity && i.price > 0 && !i.premium && !i.exclusive && !i.priceLock).sort((a, b) => a.price - b.price || (a.id < b.id ? -1 : 1));
        return pool.length ? pool[(seed * 7) % pool.length] : null;
    }
    function build() {
        if (ROAD) return ROAD; ROAD = [];
        const BIG = [null, ['chest', 'rare'], ['hat', 'rare'], ['chest', 'epic'], ['gem', 40], ['trail', 'epic'], ['chest', 'mythic'], ['hat', 'mythic'], ['chest', 'legendary'], ['gemchest']];      // only four cosmetics on the whole road (no skins); the other arena starts are chests and gems
        ARENAS.forEach((A, i) => {
            const next = ARENAS[i + 1] ? ARENAS[i + 1].at : A.at + SPAN_LAST, span = next - A.at;
            const coins = Math.round(100 * (1 + i * 0.9) / 50) * 50, tier = i < 2 ? 'common' : i < 4 ? 'rare' : i < 7 ? 'epic' : 'mythic';
            const steps = [
                i === 0 ? { at: 25, r: { t: 'coin', n: 100 } } : { at: A.at, big: true },
                { at: i === 0 ? 125 : Math.round(A.at + span * .25), r: { t: 'coin', n: coins } },
                { at: i === 0 ? 250 : Math.round(A.at + span * .5), r: { t: 'drop', tier } },
                { at: i === 0 ? 375 : Math.round(A.at + span * .75), r: i % 2 ? { t: 'gem', n: 10 + i * 4 } : { t: 'boost', kind: 'xp', mult: 2, n: 3 + Math.floor(i / 2) } },
            ];
            for (const s of steps) {
                let r = s.r;
                if (s.big) {
                    const b = BIG[i]; r = b[0] === 'gemchest' ? { t: 'gemchest' } : b[0] === 'chest' ? { t: 'drop', tier: b[1] } : b[0] === 'gem' ? { t: 'gem', n: b[1] } : null;
                    if (!r) { const it = itemPick(b[0], b[1], i); r = it ? { t: 'item', cat: b[0], id: it.id } : { t: 'drop', tier: 'epic' }; }
                }
                ROAD.push({ at: s.at, arena: i, big: !!s.big, r });
            }
        });
        ROAD.sort((a, b) => a.at - b.at); ROAD.forEach((m, i) => { m.id = i; });
        return ROAD;
    }
    const itemOf = r => COS_BY[r.cat].find(i => i.id === r.id);
    function claimable() { const p = prog(), tr = p.tr || 0, done = p.trClaimed || []; return build().filter(m => m.at <= tr && !done.includes(m.id)); }
    function nextMilestone() { const p = prog(), tr = p.tr || 0, done = p.trClaimed || []; return build().find(m => !done.includes(m.id) && m.at > tr) || null; }

    function color(r) { return r.t === 'drop' ? TC[r.tier] : r.t === 'boost' ? Boost.KINDS[r.kind].color : r.t === 'gem' || r.t === 'gemchest' ? '#ff8ae6' : r.t === 'item' ? RARITY[itemOf(r).rarity].color : '#ffcf3f'; }
    function art(r, id) {
        if (r.t === 'coin') return icon('coin'); if (r.t === 'gem') return icon('gem');
        if (r.t === 'drop') return '<span class="lr-crate" style="--ic:' + TC[r.tier] + '">' + icon('drop-' + r.tier) + '</span>';
        if (r.t === 'boost') return Boost.art(r);
        if (r.t === 'gemchest') return window.LB_GEMCHEST ? '<span class="lr-crate" style="--ic:#ff8ae6">' + LB_GEMCHEST('sk') + '</span>' : icon('gem');
        return '<canvas width="120" height="120" data-m="' + id + '"></canvas>';
    }
    function name(r) {
        if (r.t === 'coin') return '<b>' + num(r.n) + '</b><small>Coins</small>';
        if (r.t === 'gem') return '<b>' + r.n + '</b><small>Gems</small>';
        if (r.t === 'gemchest') return '<b style="color:#ff8ae6">GEM CHEST</b><small>A cosmetic plus loads of loot</small>';
        if (r.t === 'drop') return '<b style="color:' + TC[r.tier] + '">' + r.tier.toUpperCase() + '</b><small>Chest</small>';
        if (r.t === 'boost') return '<b style="color:' + color(r) + '">x' + r.mult + ' ' + Boost.KINDS[r.kind].name + '</b><small>' + r.n + ' ' + (r.n === 1 ? 'match' : 'matches') + '</small>';
        const it = itemOf(r); return '<b style="color:' + RARITY[it.rarity].color + '">' + it.name + '</b><small>' + RARITY[it.rarity].label + ' ' + ({ skin: 'skin', hat: 'headwear', face: 'face', trail: 'trail' }[r.cat]) + '</small>';
    }

    async function grant(id) {
        const m = build()[id], r = m.r, p = prog();
        if ((p.trClaimed || []).includes(id)) return;
        p.trClaimed = (p.trClaimed || []).concat(id); saveProg(p);                  // mark first: a double tap can never pay twice
        if (r.t === 'coin') { addCoins(r.n); await showRewardPops([{ type: 'coin', n: r.n }]); }
        else if (r.t === 'gem') { addGems(r.n); await showRewardPops([{ type: 'gem', n: r.n }]); }
        else if (r.t === 'boost') await showRewardPops([Boost.pop(r)]);
        else if (r.t === 'drop') { const drop = awardLootDrop(newLootId('trophy'), { coins: 60, xp: 40, passPoints: 0 }, { tier: r.tier }); await new Promise(res => openLootbox(drop, { title: 'TROPHY REWARD', onDone: res })); }
        else if (r.t === 'gemchest') { if (window.GemCrate) await GemCrate.give(); }
        else {
            const it = itemOf(r), q = prog();
            if (q.owned.includes(it.id)) { const back = dupeRefund(it); addCoins(back); await showRewardPops([{ type: 'coin', n: back }], { tier: it.rarity }); }
            else { q.owned.push(it.id); saveProg(q); await showRewardPops([{ type: 'item', item: it }], { tier: it.rarity }); }
        }
    }
    let busy = false;
    async function claim(ids) {
        if (busy) return; busy = true;
        try { for (const id of ids) { await grant(id); refreshMenu(); if (window.Arenas) Arenas.render(); } }
        finally { busy = false; refreshMenu(); if (window.Arenas) Arenas.render(); }
    }


    /* ------------------------------------------------------------ the home screen is a world ---- */
    // The arena you are in fills the whole background of the home screen (sky, sun or moon, far scenery, drifting air). Your player stands on a floating island that carries a few
    // pieces of the arena and bobs slowly. Above the island: "ARENA 4 / HARBOUR", the trophy count (it rolls up or down after a match) and a bar with what is left to the next arena.
    // Tap the title or the island to open the Arenas screen.
    const startEl = $('s-start'), stage = document.querySelector('.m-stage');
    const world = document.createElement('canvas'); world.id = 'm-world'; world.setAttribute('aria-hidden', 'true');
    const airCv = document.createElement('canvas'); airCv.id = 'm-air'; airCv.setAttribute('aria-hidden', 'true');
    if (startEl) { startEl.insertBefore(airCv, startEl.firstChild); startEl.insertBefore(world, startEl.firstChild); }
    const chip = document.createElement('button'); chip.type = 'button'; chip.id = 'm-trophy'; chip.className = 'm-trophy';
    chip.innerHTML = '<span class="ab-kick"></span><b class="ab-name"></b><span class="ab-prog"><span class="ab-cup"><span class="tc-cup">' + icon('trophy') + '<em class="tc-badge" hidden></em></span><b class="tc-n">0</b><span class="tc-d"></span></span><i class="tc-bar"><u></u></i><span class="ab-next"></span></span>';
    const row = $('pt-row'); if (row) row.insertAdjacentElement('beforebegin', chip);          // above the character
    const tools = document.createElement('div'); tools.className = 'm-tools'; chip.insertAdjacentElement('afterend', tools);      // under the title: the test switch and the hanger
    const hanger = document.querySelector('.m-stage .m-hanger'); if (hanger) tools.appendChild(hanger);
    const isle = document.createElement('div'), isleCv = document.createElement('canvas'); isle.className = 'm-isle'; isleCv.className = 'm-isle-art'; isleCv.setAttribute('aria-hidden', 'true');
    if (row) { tools.insertAdjacentElement('afterend', isle); isle.appendChild(isleCv); isle.appendChild(row); }
    chip.addEventListener('click', e => { e.stopPropagation(); if (window.SFX) SFX.play('count'); open(); });
    isleCv.addEventListener('click', () => { if (window.SFX) SFX.play('count'); open(); });
    let worldKey = '', isleKey = '', airList = [], airAi = -1, shown = null, anim = 0;
    const viewArena = ai => (window.ArenaTheme && ArenaTheme.testGet() >= 0) ? ArenaTheme.testGet() : ai;                // the test switch (arenatest.js) previews its arena
    function placeIsle(ih) { if (ih) { isleCv.style.top = 'auto'; isleCv.style.bottom = Math.round(40 - ih * .6) + 'px'; } }      // the island's top surface sits under the player's feet; measured from the bottom, so it is right the moment the home screen shows (no jump above the player)
    function paintWorld(ai) {
        if (!window.ArenaTheme || !startEl) return; ai = viewArena(ai);
        const w = startEl.clientWidth, h = startEl.clientHeight; if (w < 40 || h < 40) return;
        const dpr = Math.min(2, window.devicePixelRatio || 1), key = ai + '|' + w + 'x' + h + '|' + dpr;
        if (key !== worldKey) {
            worldKey = key; for (const c of [world, airCv]) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); c.style.width = w + 'px'; c.style.height = h + 'px'; }
            try { ArenaTheme.paintWorld(world, ai, w, h); } catch (e) {}
            if (airAi !== ai) { airAi = ai; airList = ArenaTheme.airMake(ai, 30); }
        }
        const iw = Math.min(380, w * .96), ih = Math.round(iw * 300 / 360), ikey = ai + '|' + Math.round(iw) + '|' + dpr;
        if (ikey !== isleKey) { isleKey = ikey; isleCv.width = Math.round(iw * dpr); isleCv.height = Math.round(ih * dpr); isleCv.style.width = iw + 'px'; isleCv.style.height = ih + 'px'; try { ArenaTheme.paintIsland(isleCv, ai, iw, ih); } catch (e) {} }
        placeIsle(ih);
    }
    window.addEventListener('arenatest', () => { worldKey = isleKey = ''; refresh(); });
    if (startEl && window.ResizeObserver) new ResizeObserver(() => { worldKey = isleKey = ''; paintWorld(arenaOf(prog().tr || 0)); }).observe(startEl);
    // the drifting air: a light loop that only runs while the home tab is on screen
    let airT = 0;
    function airLoop(now) {
        requestAnimationFrame(airLoop);
        if (document.hidden || now - airT < 42 || !window.ArenaTheme || airAi < 0 || (startEl && !startEl.classList.contains('arena-mode'))) return;          // the drifting air belongs to Arena Race only
        const dt = Math.min(.1, (now - airT) / 1000); airT = now;
        if (!startEl || startEl.style.display === 'none' || !document.querySelector('.m-tab[data-tab="home"].on')) return;
        const dpr = airCv.width / (parseFloat(airCv.style.width) || 1), c = airCv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
        c.clearRect(0, 0, airCv.width / dpr, airCv.height / dpr); ArenaTheme.airStep(c, airAi, airList, airCv.width / dpr, airCv.height / dpr, now / 1000, dt);
    }
    requestAnimationFrame(airLoop);
    function shownGet() { try { const v = localStorage.getItem('rr_tr_shown'); return v === null ? null : +v; } catch (e) { return null; } }
    function shownSet(v) { try { localStorage.setItem('rr_tr_shown', String(v)); } catch (e) {} }
    function paintChip(v) {
        const tr = v, ai = arenaOf(tr), A = ARENAS[ai], nxtA = ARENAS[ai + 1], cl = claimable().length;
        chip.style.setProperty('--ac', A.c);
        chip.querySelector('.tc-n').textContent = num(tr);
        const vi = viewArena(ai), test = vi !== ai;                                           // with the test switch on, the title names the arena you are previewing
        chip.querySelector('.ab-kick').textContent = 'ARENA ' + (vi + 1) + (test ? ' - TEST' : '');
        chip.querySelector('.ab-name').textContent = ARENAS[vi].n;
        if (test) chip.style.setProperty('--ac', ARENAS[vi].c);
        const from = A.at, to = nxtA ? nxtA.at : from + SPAN_LAST;
        chip.querySelector('.tc-bar u').style.width = Math.max(3, Math.min(100, 100 * (tr - from) / (to - from))).toFixed(1) + '%';
        chip.querySelector('.ab-next').textContent = nxtA ? num(nxtA.at - tr) + ' to ' + nxtA.n : 'Top arena';
        const bd = chip.querySelector('.tc-badge'); bd.hidden = !cl; bd.textContent = cl;
        paintWorld(ai);
        chip.setAttribute('aria-label', 'Arena ' + (ai + 1) + ', ' + A.n + ', ' + num(tr) + ' trophies' + (nxtA ? ', ' + num(nxtA.at - tr) + ' to ' + nxtA.n : '') + (cl ? ', ' + cl + ' rewards to claim' : ''));
    }
    function visible() { return chip.getClientRects().length > 0 && $('s-start') && $('s-start').style.display !== 'none'; }
    function refresh() {
        const tr = (prog().tr || 0);
        if (shown === null) shown = shownGet(); if (shown === null) shown = tr;
        if (anim) return;
        if (shown !== tr && visible()) {                                              // a match changed the count: roll the number, show the change
            const from = shown, to = tr, d = to - from, t0 = performance.now(), dur = Math.min(1400, 500 + Math.abs(d) * 22);
            const pop = chip.querySelector('.tc-d'); pop.textContent = (d > 0 ? '+' : '') + d; pop.className = 'tc-d ' + (d > 0 ? 'up' : 'down'); void pop.offsetWidth; pop.classList.add('go');
            if (window.SFX && d > 0) SFX.play('coin');
            const step = now => { const u = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - u, 3); paintChip(Math.round(from + d * e)); if (u < 1) anim = requestAnimationFrame(step); else { anim = 0; shown = to; shownSet(to); paintChip(to); } };
            anim = requestAnimationFrame(step); return;
        }
        shown = tr; shownSet(tr); paintChip(tr);
    }
    function open() { if (window.Arenas) Arenas.open(); }
    setInterval(() => { if (!document.hidden) refresh(); }, 1200);

    window.Trophies = { record, last, worth, mmr, matchMmr, spread, claimable, refresh, open, arenaOf, ARENAS, SPAN_LAST, road: build, nextMilestone, claim, art, name, color, itemOf };
    refresh();
})();
