// BOOSTERS: "x2 coins for N matches" and "x2 chest contents for N chests". Rewards in the pass, level rewards and daily calendar can hold them.
// Stored in prog().boost = { coin:[{mult,left}], chest:[{mult,left}], used:[ids] }. Loaded BEFORE pass.js (functions use game globals at call time).
(function () {
    'use strict';
    const KINDS = { coin:{ name:'COINS', color:'#ffcf3f', unit:'match', plural:'matches' }, chest:{ name:'CHEST REWARDS', color:'#35e0c8', unit:'chest', plural:'chests' } };
    const st = p => { const b = p.boost = Object.assign({ coin:[], chest:[], used:[] }, p.boost || {}); return b; };
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
        // Chest contents multiplier (>= 1) for one chest id.
        // Only chests earned by playing count (race, escape, gauntlet, levels, ranked, tower). Chests from the pass, daily calendar,
        // level rewards or videos are left alone and do not use a charge.
        chest(id) { return /^(race|escape|gauntlet|level|party|rk|tower):/.test(String(id)) ? (use('chest', 1, id) || 1) : 1; },
        art(r, big) {
            const k = KINDS[r.kind];
            return '<span class="bo-art bo-' + r.kind + (big ? ' big' : '') + '" style="--bc:' + k.color + '">' + icon(r.kind === 'coin' ? 'coin' : 'drop') + '<b>x' + r.mult + '</b></span>';
        },
        label(r) { const k = KINDS[r.kind]; return '<span class="pz-lbl">x' + r.mult + ' ' + k.name + '</span><small class="bo-sub">' + r.n + ' ' + (r.n === 1 ? k.unit : k.plural) + (r.kind === 'chest' ? ' · from matches' : '') + '</small>'; },
        short(r) { const k = KINDS[r.kind]; return 'x' + r.mult + ' ' + k.name.toLowerCase() + ' · ' + r.n + ' ' + (r.n === 1 ? k.unit : k.plural); },
        // a reward row for showRewardPops
        pop(r) { B.grant(r.kind, r.mult, r.n); return { type:'boost', kind:r.kind, mult:r.mult, n:r.n }; },
        refreshHome() {
            const el = document.getElementById('m-boosts'); if (!el) return;
            const parts = [];
            for (const kind of ['coin', 'chest']) {
                const a = B.active(kind); if (!a) continue;
                parts.push('<span class="bo-pill" style="--bc:' + KINDS[kind].color + '">' + icon(kind === 'coin' ? 'coin' : 'drop') + '<b>x' + a.mult + '</b><small>' + a.total + (kind === 'coin' ? '' : '') + '</small></span>');
            }
            el.innerHTML = parts.join(''); el.hidden = !parts.length;
        },
    };

    function use(kind, n, id) {
        const p = prog(), b = st(p), key = kind + ':' + id;
        const hit = b.used.find(u => u.k === key);
        if (hit) return kind === 'coin' ? Math.round(n * hit.m) : hit.m;
        const e = best(b[kind]);
        if (!e) return kind === 'coin' ? n : 1;
        const m = e.mult; e.left--; b[kind] = b[kind].filter(x => x.left > 0);
        b.used.push({ k:key, m }); if (b.used.length > 30) b.used.shift();
        saveProg(p);
        try { B.refreshHome(); } catch (er) {}
        return kind === 'coin' ? Math.round(n * m) : m;
    }
    window.Boost = B;
})();
