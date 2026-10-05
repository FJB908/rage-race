// BOOSTERS: "x2 coins for N matches" and "x2 XP for N matches". Rewards in the pass, level rewards and daily calendar can hold them.
// Stored in prog().boost = { coin:[{mult,left}], xp:[{mult,left}], used:[ids] }. (The old chest booster was turned into an XP booster: stored ones are converted.) Loaded BEFORE pass.js (functions use game globals at call time).
(function () {
    'use strict';
    const KINDS = { coin:{ name:'COINS', color:'#ffcf3f', unit:'match', plural:'matches' }, xp:{ name:'XP', color:'#6cc4ff', unit:'match', plural:'matches' } };
    const st = p => {
        const b = p.boost = Object.assign({ coin:[], xp:[], used:[] }, p.boost || {});
        if (Array.isArray(b.chest) && b.chest.length) { b.chest.forEach(e => { const x = b.xp.find(y => y.mult === e.mult); if (x) x.left += e.left; else b.xp.push({ mult:e.mult, left:e.left }); }); }
        delete b.chest;
        return b;
    };
    const best = list => list.filter(e => e.left > 0).sort((a, b) => b.mult - a.mult)[0] || null;

    const B = {
        KINDS,
        // r = { t:'boost', kind:'coin'|'chest', mult, n }
        grant(kind, mult, n) {
            const p = prog(), b = st(p), e = b[kind].find(x => x.mult === mult);
            if (e) e.left += n; else b[kind].push({ mult, left:n });
            saveProg(p);
        },
        active(kind) { const e = best(st(prog())[kind]); return e ? { mult:e.mult, left:e.left, total:st(prog())[kind].reduce((s, x) => s + x.left, 0) } : null; },
        // Match coins: multiplies n by the best active booster. One match id uses one charge, however often it is asked.
        coins(n, id) { return use('coin', n, id); },
        // Match XP: multiplies n by the best active XP booster (one charge per match id).
        xp(n, id) { return use('xp', n, id); },
        // (the chest booster is gone)
        announce,
        art(r, big) {
            const k = KINDS[r.kind];
            return '<span class="bo-art bo-' + r.kind + (big ? ' big' : '') + '" style="--bc:' + k.color + '">' + icon(r.kind === 'coin' ? 'coin' : 'xp') + '<b>x' + r.mult + '</b></span>';
        },
        label(r) { const k = KINDS[r.kind]; return '<span class="pz-lbl">x' + r.mult + ' ' + k.name + '</span><small class="bo-sub">' + r.n + ' ' + (r.n === 1 ? k.unit : k.plural) + '</small>'; },
        short(r) { const k = KINDS[r.kind]; return 'x' + r.mult + ' ' + k.name.toLowerCase() + ' · ' + r.n + ' ' + (r.n === 1 ? k.unit : k.plural); },
        // a reward row for showRewardPops
        pop(r) { B.grant(r.kind, r.mult, r.n); return { type:'boost', kind:r.kind, mult:r.mult, n:r.n }; },
        // A small round chip in the corner of the PLAY button for each active multiplier (coin x2, chest x2). Tap it for the details.
        refreshHome() {
            const el = document.getElementById('m-boosts'); if (!el) return;
            const parts = [];
            for (const kind of ['coin', 'xp']) {
                const a = B.active(kind); if (!a) continue;
                const k = KINDS[kind];
                parts.push('<button type="button" class="bo-chip" data-kind="' + kind + '" style="--bc:' + k.color + '" aria-label="' + (kind === 'coin' ? 'Coin' : 'XP') + ' booster x' + a.mult + '">' + icon(kind === 'coin' ? 'coin' : 'xp') + '<b>' + a.mult + 'x</b></button>');
            }
            el.innerHTML = parts.join(''); el.hidden = !parts.length;
            if (!parts.length) { const t = document.querySelector('.bo-tip'); if (t) t.remove(); }
        },
        tip(kind) {
            const a = B.active(kind), wrap = document.querySelector('.m-playwrap'); if (!a || !wrap) return;
            const old = document.querySelector('.bo-tip'); if (old) { const same = old.dataset.kind === kind; old.remove(); if (same) return; }
            const k = KINDS[kind], unit = a.total === 1 ? k.unit : k.plural, t = document.createElement('div');
            t.className = 'bo-tip'; t.dataset.kind = kind; t.style.setProperty('--bc', k.color);
            t.innerHTML = '<b>' + (kind === 'coin' ? 'Coins' : 'XP') + ' x' + a.mult + '</b><small>' + a.total + ' ' + unit + ' left' + (kind === 'coin' ? ' · for the coins of a match' : ' · for the XP of a match') + '</small>';
            wrap.appendChild(t); clearTimeout(B._tt); B._tt = setTimeout(() => t.remove(), 3600);
        },
    };

    function announce() {}                                                  // (the big banner is gone: the chip on the home screen and the amounts say enough)
    function use(kind, n, id) {
        const p = prog(), b = st(p), key = kind + ':' + id;
        const hit = b.used.find(u => u.k === key);
        if (hit) return Math.round(n * hit.m);
        const e = best(b[kind]);
        if (!e) return n;
        const m = e.mult; e.left--; b[kind] = b[kind].filter(x => x.left > 0); const leftNow = b[kind].reduce((s, x) => s + x.left, 0);
        setTimeout(() => announce(kind, m, leftNow), 0);
        b.used.push({ k:key, m }); if (b.used.length > 30) b.used.shift();
        saveProg(p);
        try { B.refreshHome(); } catch (er) {}
        return Math.round(n * m);
    }
    document.addEventListener('click', e => {
        const c = e.target.closest && e.target.closest('.bo-chip');
        if (c) { e.stopPropagation(); B.tip(c.dataset.kind); return; }
        const t = document.querySelector('.bo-tip'); if (t) t.remove();
    });
    window.Boost = B;
})();
