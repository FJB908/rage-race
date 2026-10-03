// BOT ROSTER: a believable "player base" of named bots with a rating (MMR), a look and a play style.
// Used by Ranked (opponents near your level), the Gauntlet (its 31 rivals) and Escape (its 3 rivals), so strong
// players you meet in one mode are the same people you meet in the others. Loaded AFTER game.js.
//
// The bot's skill is NOT one number: it controls aim noise, thinking speed, the wait after landing, and how often it
// misjudges a route. MMR_TO_LEVEL is the calibration table that turns a rating into a skill level; it was measured with
// the headless simulator (see docs/RANKED.md), so a 200 point rating gap really means a bot that wins more often.
(function () {
    'use strict';

    /* ------------------------------------------------------------------ ranks ---- */
    // Tier colour, then the darker shade used for the emblem edge. Ground..Apex have three divisions, Crown has none.
    const TIERS = [
        { id:'ground', name:'Ground', c1:'#c3cada', c2:'#6b7489' },
        { id:'ledge',  name:'Ledge',  c1:'#5eead4', c2:'#0e8f7e' },
        { id:'ridge',  name:'Ridge',  c1:'#7fb0ff', c2:'#2a5fd0' },
        { id:'summit', name:'Summit', c1:'#c4baff', c2:'#5b46d6' },
        { id:'peak',   name:'Peak',   c1:'#ffb066', c2:'#d1560f' },
        { id:'apex',   name:'Apex',   c1:'#ff8aa0', c2:'#c21c4a' },
        { id:'crown',  name:'Crown',  c1:'#ffe27a', c2:'#d98a0a' },
    ];
    const RP_PER_DIV = 100, DIVS = 3, RP_PER_TIER = RP_PER_DIV * DIVS, CROWN_RP = RP_PER_TIER * 6;
    const MMR_FLOOR = 850, RP_SCALE = 2.12;                  // rating of 0 rank points, and rank points per rating point (Crown ~ rating 1700)
    const BOT_MIN = 850, BOT_MAX = 1740;                     // the range the roster lives in (the strongest bot level is about 1730)
    const mmrToRp = m => Math.max(0, Math.round((m - MMR_FLOOR) * RP_SCALE));
    function rankOf(rp) {
        rp = Math.max(0, rp);
        const tier = Math.min(6, Math.floor(rp / RP_PER_TIER));
        if (tier >= 6) return { tier:6, div:0, name:'Crown', label:'CROWN', into:rp - CROWN_RP, span:0, rp, base:CROWN_RP, t:TIERS[6] };
        const within = rp - tier * RP_PER_TIER, div = DIVS - Math.floor(within / RP_PER_DIV);          // 3 = lowest division
        const roman = ['', 'I', 'II', 'III'][div];
        return { tier, div, name:TIERS[tier].name, label:TIERS[tier].name.toUpperCase() + ' ' + roman, into:within % RP_PER_DIV, span:RP_PER_DIV, rp, base:tier * RP_PER_TIER, t:TIERS[tier] };
    }

    /* ------------------------------------------------------------ calibration ---- */
    // [mmr, level]. Measured with the headless simulator (docs/RANKED.md): 30 races of random 4-bot lobbies per level, Elo-fitted.
    // mmr = measured Elo + 250, so a 100 point gap means about 64% expected score for the stronger bot.
    let MMR_TO_LEVEL = [[877, 0], [942, 0.1], [974, 0.2], [1087, 0.3], [1159, 0.4], [1222, 0.5], [1341, 0.6], [1421, 0.7], [1537, 0.8], [1563, 0.9], [1630, 1.0], [1662, 1.1], [1702, 1.2], [1732, 1.3]];
    function levelOf(mmr) {
        const T = MMR_TO_LEVEL;
        if (mmr <= T[0][0]) return T[0][1];
        for (let i = 1; i < T.length; i++) if (mmr <= T[i][0]) { const a = T[i - 1], b = T[i], f = (mmr - a[0]) / (b[0] - a[0]); return a[1] + (b[1] - a[1]) * f; }
        return T[T.length - 1][1];
    }

    // Play styles: small tweaks on top of the level so two bots of the same rating don't feel identical.
    const PERSONAS = {
        steady:  { think:1,    aim:1,    mistake:1,   human:false },
        sprinter:{ think:0.84, aim:1.2,  mistake:1.1, human:false },     // fast, a little sloppy
        careful: { think:1.16, aim:0.82, mistake:0.6, human:false },     // slow, precise
        natural: { think:1,    aim:1,    mistake:1,   human:true  },     // the human-profile bot: hesitates, imperfect route choices
    };
    // level (0..1) + persona -> the knobs updateBot reads. Level 0.45 is the old "standard" bot.
    function paramsFor(level, personaId) {
        const P = PERSONAS[personaId] || PERSONAS.steady, L = Math.max(0, Math.min(1.5, level));
        const base = Math.min(1, L), elite = Math.max(0, L - 1);                 // 1..1.5 = the very best players
        return {
            skill:(L < 1 ? Math.max(0.2, 1.55 * Math.pow(1 - L, 0.77)) : Math.max(0.1, 0.2 - elite * 0.2)) * P.aim,   // aim noise multiplier, lower is better
            thinkScale:Math.max(0.45, 1.3 - 0.67 * L) * P.think,                // thinking time multiplier
            waitScale:Math.max(0.5, 1.25 - 0.55 * L),                           // wait after landing multiplier
            mistake:L < 1 ? 0.3 * Math.pow(1 - base, 1.6) * P.mistake : 0,      // chance to take the wrong-looking route
            botType:P.human ? 'human' : 'standard',
        };
    }

    /* --------------------------------------------------------------- the roster ---- */
    const SEED = 20261001, COUNT = 240, KEY = 'rr_rk_roster_v1';
    let bots = null, seasonKey = -1;
    const rng = seed => pkRng(seed >>> 0);
    function normal(r) { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

    // Higher rated bots own rarer cosmetics. Deterministic per bot, so a person always looks the same.
    const RAR = { common:0, rare:1, epic:2, legendary:3 };
    function weightedPick(arr, want, r) {
        let tot = 0; const w = arr.map(it => { const d = Math.abs((RAR[it.rarity] || 0) - want); const x = Math.exp(-d * 1.15) + (it.premium ? 0.05 * want : 0); tot += x; return x; });
        let x = r() * tot; for (let i = 0; i < arr.length; i++) { x -= w[i]; if (x <= 0) return arr[i]; }
        return arr[0];
    }
    function lookFor(mmr, r) {
        const t = Math.max(0, Math.min(1, (mmr - 850) / 900)), want = t * 3.1;
        const real = a => a.filter(i => i.id !== 'none' && !i.exclusive);
        return {
            skin: weightedPick(real(SKINS).length ? real(SKINS) : SKINS, want, r).id,
            hat: r() < 0.5 + t * 0.4 ? weightedPick(real(HATS), want, r).id : 'none',
            face: r() < 0.4 + t * 0.4 ? weightedPick(real(FACES), want, r).id : 'none',
            trail: r() < 0.3 + t * 0.5 ? weightedPick(real(TRAILS), want, r).id : 'none',
        };
    }
    function makeName(i, r, used) {
        const base = BOT_NAMES[Math.floor(r() * BOT_NAMES.length)], forms = [
            b => b, b => b + Math.floor(r() * 99), b => b.replace(/[._]/g, '') + (10 + Math.floor(r() * 89)), b => 'xX' + b.replace(/[._\d]+$/, '') + 'Xx',
            b => b.replace(/\d+$/, '') + '_' + (['gg', 'pro', 'tv', 'fr', 'zz', 'x', 'og'])[Math.floor(r() * 7)], b => b.split(/[._]/)[0] + '.' + (['r', 'k', 's', 'm', 'v'])[Math.floor(r() * 5)] + Math.floor(r() * 20),
        ];
        for (let k = 0; k < 20; k++) { const n = forms[Math.floor(r() * forms.length)](base).slice(0, 16); if (!used.has(n)) { used.add(n); return n; } }
        const n = base.slice(0, 11) + '_' + i; used.add(n); return n;
    }
    function build(season) {
        const r = rng(SEED + season * 7919), used = new Set(), list = [];
        const personas = ['steady', 'steady', 'steady', 'steady', 'sprinter', 'sprinter', 'careful', 'careful', 'natural', 'natural'];
        for (let i = 0; i < COUNT; i++) {
            const mmr = Math.round(Math.max(BOT_MIN, Math.min(BOT_MAX, 1230 + normal(r) * 175)));
            const br = rng(SEED + season * 7919 + i * 104729);
            list.push({ id:i, name:makeName(i, r, used), mmr, persona:personas[Math.floor(r() * personas.length)], level:1 + Math.floor(r() * 60), wins:0, games:0, look:lookFor(mmr, br) });
        }
        return list;
    }
    function season() { return window.Ranked ? Ranked.seasonNow() : 0; }
    function ensure() {
        const s = season();
        if (bots && seasonKey === s) return bots;
        bots = build(s); seasonKey = s;
        try {      // restore the drift (rating changes, records) of this season
            const saved = JSON.parse(localStorage.getItem(KEY));
            if (saved && saved.s === s && Array.isArray(saved.m) && saved.m.length === bots.length) bots.forEach((b, i) => { b.mmr = saved.m[i]; b.wins = saved.w[i] || 0; b.games = saved.g[i] || 0; });
        } catch (e) {}
        return bots;
    }
    function save() { try { localStorage.setItem(KEY, JSON.stringify({ s:seasonKey, m:bots.map(b => b.mmr), w:bots.map(b => b.wins), g:bots.map(b => b.games) })); } catch (e) {} }
    const shuffleIn = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

    // n distinct bots, weighted towards `mmr` (default: yours). spread = how wide the pool is (bigger = more strong AND weak ones).
    function pick(n, opts) {
        opts = opts || {};
        const all = ensure(), center = opts.mmr !== undefined ? opts.mmr : (prog().rk ? prog().rk.mmr : 1000), sigma = opts.spread || 200;
        const skip = new Set(opts.exclude || []), pool = all.filter(b => !skip.has(b.id));
        const w = pool.map(b => Math.exp(-Math.pow((b.mmr - center) / sigma, 2) / 2) + 1e-4);
        const out = [];
        for (let k = 0; k < n && pool.length; k++) {
            let tot = 0; for (let i = 0; i < pool.length; i++) tot += w[i];
            let x = Math.random() * tot, idx = 0; for (; idx < pool.length - 1; idx++) { x -= w[idx]; if (x <= 0) break; }
            out.push(pool[idx]); pool.splice(idx, 1); w.splice(idx, 1);
        }
        return out;
    }

    // Put roster bots into player objects (the race's `players[1..]`).
    function applyTo(list, chosen, opts) {
        opts = opts || {};
        list.forEach((p, i) => {
            const b = chosen[i]; if (!b) return;
            const pr = paramsFor(levelOf(b.mmr), b.persona);
            p.name = b.name; p.look = Object.assign({}, b.look);
            if (opts.color) p.color = skinById(b.look.skin).color;
            p.skill = pr.skill; p.baseSkill = pr.skill; p.thinkScale = pr.thinkScale; p.waitScale = pr.waitScale; p.mistake = pr.mistake;
            p.botType = pr.botType; p.afk = false; p.botId = b.id; p.botMmr = b.mmr; p.rkTier = rankOf(mmrToRp(b.mmr)).tier;
            p.rkColor = TIERS[p.rkTier].c1;
        });
    }

    // Elo update for a finished 4-player match. `order` = [{id: botId | 'me', mmr}], best first.
    function expected(i, list) { let e = 0; for (let j = 0; j < list.length; j++) if (j !== i) e += 1 / (1 + Math.pow(10, (list[j] - list[i]) / 400)); return e / (list.length - 1); }
    function eloDelta(ratings, place, k) { const s = (ratings.length - place) / (ratings.length - 1); return k * 2 * (s - expected(place - 1, ratings)); }
    function settleBots(order) {
        const all = ensure(), ratings = order.map(o => o.mmr);
        order.forEach((o, i) => {
            if (o.id === 'me') return;
            const b = all[o.id]; if (!b) return;
            b.mmr = Math.max(BOT_MIN, Math.min(BOT_MAX, Math.round(b.mmr + eloDelta(ratings, i + 1, 24)))); b.games++; if (i === 0) b.wins++;
        });
        save();
    }

    window.BotRoster = {
        TIERS, RP_PER_DIV, RP_PER_TIER, CROWN_RP, MMR_FLOOR, RP_SCALE, BOT_MIN, BOT_MAX, mmrToRp, rankOf, levelOf, paramsFor, PERSONAS,
        all:ensure, pick, applyTo, eloDelta, expected, settleBots, save,
        setCalibration(t) { MMR_TO_LEVEL = t; }, calibration:() => MMR_TO_LEVEL,
        rating:b => ({ rp:mmrToRp(b.mmr), rank:rankOf(mmrToRp(b.mmr)) }),
    };
})();
