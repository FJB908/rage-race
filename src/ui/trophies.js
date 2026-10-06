// TROPHY ROAD: the visible progress of a player, like the trophies in Clash Royale and Brawl Stars.
//   - A trophy count under your character on the home screen: it goes up when you place well and down when you do badly (with floors so it never feels unfair).
//   - Arenas: the count moves you through 10 arenas (Rookie Yard ... Crown Summit). An arena is a safe floor: once you are in it, you cannot drop below its start.
//   - The Trophy Road: a list of milestones on the way, every one with a reward (coins, gems, chests, boosters, cosmetics, a gem chest).
// Trophies come from every placing mode: Quick play, Build Race, Boom Tag, Arcade, Escape, Ranked and the Gauntlet. Levels and the Summit have their own stars.
// Loaded AFTER game.js and levelrewards.js. Profile fields: tr (trophies), trTop (highest arena index reached), trClaimed (milestones taken), trStreak (wins in a row).
(function () {
    'use strict';
    const $ = id => document.getElementById(id);
    const TC = { common:'#35e0c8', rare:'#5b8def', epic:'#b3a9ff', mythic:'#ff4d7d', legendary:'#ffcf3f' };
    const ARENAS = [
        { n:'Rookie Yard',   at:0,    c:'#35e0c8' }, { n:'Neon Alley',    at:150,  c:'#ff5ad1' }, { n:'Sky Docks',     at:400,  c:'#5bb8ff' },
        { n:'Frost Peak',    at:800,  c:'#9fe8ff' }, { n:'Lava Works',    at:1300, c:'#ff7a3d' }, { n:'Cyber Core',    at:1900, c:'#7cf29c' },
        { n:'Void Station',  at:2600, c:'#a77bff' }, { n:'Crystal Spire', at:3500, c:'#ff8ae6' }, { n:'Storm Throne',  at:4600, c:'#ffe14a' },
        { n:'Crown Summit',  at:6000, c:'#ffcf3f' },
    ];
    const SPAN_LAST = 2000;
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
        lastResult = { delta: p.tr - before, tr: p.tr, newArena: arenaOf(p.tr) > arenaOf(before) };
        return lastResult;
    }
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
        const BIG = [null, ['skin', 'rare'], ['hat', 'rare'], ['trail', 'epic'], ['face', 'epic'], ['skin', 'epic'], ['hat', 'mythic'], ['trail', 'mythic'], ['face', 'legendary'], ['gemchest']];
        ARENAS.forEach((A, i) => {
            const next = ARENAS[i + 1] ? ARENAS[i + 1].at : A.at + SPAN_LAST, span = next - A.at;
            const coins = Math.round(100 * (1 + i * 0.9) / 50) * 50, tier = i < 2 ? 'common' : i < 4 ? 'rare' : i < 7 ? 'epic' : 'mythic';
            const steps = [
                i === 0 ? { at: 15, r: { t: 'coin', n: 100 } } : { at: A.at, big: true },
                { at: i === 0 ? 50 : Math.round(A.at + span * .25), r: { t: 'coin', n: coins } },
                { at: i === 0 ? 90 : Math.round(A.at + span * .5), r: { t: 'drop', tier } },
                { at: i === 0 ? 125 : Math.round(A.at + span * .75), r: i % 2 ? { t: 'gem', n: 10 + i * 4 } : { t: 'boost', kind: 'xp', mult: 2, n: 3 + Math.floor(i / 2) } },
            ];
            for (const s of steps) {
                let r = s.r;
                if (s.big) {
                    const b = BIG[i]; r = b[0] === 'gemchest' ? { t: 'gemchest' } : null;
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

    /* ---------------------------------------------------------------- the road screen ---- */
    const el = document.createElement('div');
    el.id = 's-trophy'; el.className = 'screen lvr-screen'; el.style.cssText = 'display:none;opacity:0';
    el.innerHTML =
        '<section class="lr-shell"><header class="lr-top"><button class="pass-back" type="button" id="tr-back" aria-label="Back">' + icon('chev-l') + '</button>' +
        '<div class="lr-title"><small>TROPHY ROAD</small><h1>Your trophies</h1></div></header>' +
        '<div class="lr-hero tr-hero"><div class="tr-cup">' + icon('trophy') + '</div><div class="lr-herotxt"><b id="tr-num">0</b><div class="tr-arena" id="tr-arena"></div><div class="lr-bar"><i id="tr-fill"></i></div><small id="tr-next"></small></div>' +
        '<button type="button" class="lr-all" id="tr-all" hidden>CLAIM ALL</button></div>' +
        '<p class="tr-how" id="tr-how"></p><div class="lr-list" id="tr-list"></div></section>';
    document.body.appendChild(el); S.trophy = el;
    const list = el.querySelector('#tr-list');

    function render() {
        const p = prog(), tr = p.tr || 0, ai = arenaOf(tr), A = ARENAS[ai], nxtA = ARENAS[ai + 1], done = p.trClaimed || [], nm = nextMilestone(), cl = claimable();
        el.style.setProperty('--ac', A.c);
        el.querySelector('#tr-num').textContent = num(tr);
        el.querySelector('#tr-arena').innerHTML = '<i style="background:' + A.c + '"></i>Arena ' + (ai + 1) + ' &middot; ' + A.n;
        const from = A.at, to = nxtA ? nxtA.at : from + SPAN_LAST;
        el.querySelector('#tr-fill').style.width = Math.min(100, 100 * (tr - from) / (to - from)).toFixed(1) + '%';
        el.querySelector('#tr-next').textContent = nxtA ? num(nxtA.at - tr) + ' trophies to ' + nxtA.n : 'The top arena: keep climbing';
        const all = el.querySelector('#tr-all'); all.hidden = !cl.length; all.innerHTML = 'CLAIM ALL <b>' + cl.length + '</b>';
        el.querySelector('#tr-how').textContent = 'Win races to gain trophies, lose them when you place 3rd or 4th. You can never drop below the start of your arena.';
        list.innerHTML = '';
        let lastArena = -1;
        for (const m of build()) {
            if (m.arena !== lastArena) {
                lastArena = m.arena; const a = ARENAS[m.arena], here = m.arena === ai, reached = tr >= a.at;
                const h = document.createElement('div'); h.className = 'tr-ah' + (here ? ' here' : '') + (reached ? '' : ' far'); h.style.setProperty('--ac', a.c);
                h.innerHTML = '<span>ARENA ' + (m.arena + 1) + '</span><b>' + a.n + '</b><em>' + num(a.at) + '</em>'; list.appendChild(h);
            }
            const claimed = done.includes(m.id), ready = !claimed && m.at <= tr, cur = nm && nm.id === m.id;
            const row = document.createElement('div');
            row.className = 'lr-row' + (claimed ? ' claimed' : ready ? ' ready' : ' locked') + (cur ? ' next' : '') + (m.big ? ' mile' : '');
            row.dataset.m = m.id; row.style.setProperty('--rc', color(m.r));
            row.innerHTML = '<div class="lr-node tr-node">' + (claimed ? icon('check') : '<span>' + num(m.at) + '</span>') + '</div>' +
                '<div class="lr-card"><div class="lr-art">' + art(m.r, m.id) + '</div><div class="lr-name">' + name(m.r) + '</div>' +
                (ready ? '<button type="button" class="lr-claim">CLAIM</button>' : claimed ? '<span class="lr-state">CLAIMED</span>' : '<span class="lr-state lock">' + icon('lock') + ' ' + num(m.at) + '</span>') + '</div>';
            if (ready) row.querySelector('.lr-claim').onclick = () => claim([m.id]);
            list.appendChild(row);
            const cv = row.querySelector('canvas');
            if (cv) { const look = Object.assign({ skin: 'classic', hat: 'none', face: 'none', trail: 'none' }, { [m.r.cat]: m.r.id }); if (m.r.cat === 'trail') { cv.width = 200; cv.height = 100; try { drawTrailPreview(cv, itemOf(m.r), undefined, 1.5); } catch (e) {} } else { try { renderLook(cv, look, { scale: .26, cy: .6 }); } catch (e) {} } }
        }
    }
    function scrollToCurrent() {
        const t = list.querySelector('.ready') || list.querySelector('.next') || list.lastElementChild;
        if (t) list.scrollTop = Math.max(0, t.offsetTop - list.clientHeight / 3);
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
            if (q.owned.includes(it.id)) { const back = { common: 100, rare: 400, epic: 1200, mythic: 2000, legendary: 3000 }[it.rarity] || 100; addCoins(back); await showRewardPops([{ type: 'coin', n: back }], { tier: it.rarity }); }
            else { q.owned.push(it.id); saveProg(q); await showRewardPops([{ type: 'item', item: it }], { tier: it.rarity }); }
        }
    }
    let busy = false;
    async function claim(ids) {
        if (busy) return; busy = true;
        try { for (const id of ids) { await grant(id); refreshMenu(); render(); } }
        finally { busy = false; refreshMenu(); render(); }
    }
    el.querySelector('#tr-all').onclick = () => claim(claimable().map(m => m.id));
    el.querySelector('#tr-back').onclick = () => showScreen('start');

    /* ------------------------------------------------------------ chip on the home screen ---- */
    // under the character: the trophy count (counts up or down after a match), the arena and the way to the next reward
    const chip = document.createElement('button'); chip.type = 'button'; chip.id = 'm-trophy'; chip.className = 'm-trophy';
    chip.innerHTML = '<span class="tc-cup">' + icon('trophy') + '</span><span class="tc-mid"><b class="tc-n">0</b><span class="tc-ar"></span><i class="tc-bar"><u></u></i></span><span class="tc-next"></span><span class="tc-d"></span>';
    const row = $('pt-row'); if (row) row.insertAdjacentElement('afterend', chip);
    chip.addEventListener('click', e => { e.stopPropagation(); if (window.SFX) SFX.play('count'); open(); });
    let shown = null, anim = 0;
    function shownGet() { try { const v = localStorage.getItem('rr_tr_shown'); return v === null ? null : +v; } catch (e) { return null; } }
    function shownSet(v) { try { localStorage.setItem('rr_tr_shown', String(v)); } catch (e) {} }
    function paintChip(v) {
        const p = prog(), tr = v, ai = arenaOf(tr), A = ARENAS[ai], nxtA = ARENAS[ai + 1], nm = nextMilestone(), cl = claimable().length;
        chip.style.setProperty('--ac', A.c); chip.classList.toggle('ready', cl > 0);
        chip.querySelector('.tc-n').textContent = num(tr);
        chip.querySelector('.tc-ar').textContent = 'Arena ' + (ai + 1) + ' · ' + A.n;
        const from = A.at, to = nxtA ? nxtA.at : from + SPAN_LAST;
        chip.querySelector('.tc-bar u').style.width = Math.max(2, Math.min(100, 100 * (tr - from) / (to - from))).toFixed(1) + '%';
        chip.querySelector('.tc-next').innerHTML = cl ? '<em>' + cl + '</em>' : nm ? '<small>' + num(nm.at) + '</small>' + (nm.r.t === 'coin' ? icon('coin') : nm.r.t === 'gem' ? icon('gem') : nm.r.t === 'drop' ? icon('drop-' + nm.r.tier) : icon('star')) : '';
        chip.setAttribute('aria-label', 'Trophies ' + num(tr) + ', ' + A.n + (cl ? ', ' + cl + ' rewards to claim' : ''));
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
    function open() { render(); showScreen('trophy'); setTimeout(scrollToCurrent, 90); }
    setInterval(() => { if (!document.hidden) refresh(); }, 1200);

    window.Trophies = { record, last, worth, claimable, refresh, open, arenaOf, ARENAS, road: build, nextMilestone };
    refresh();
})();
