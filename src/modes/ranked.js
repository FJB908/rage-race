// RANKED: a seasonal 4-player Race ladder. Loaded AFTER roster.js and game.js. See docs/RANKED.md.
//
// Two numbers: a hidden MMR (decides who you meet, moves with every result) and the visible Rank Points (RP). The rank
// follows your MMR, so you cannot stay in a rank you do not play at. Opponents are roster bots with a real skill level;
// the match provider is one function (providerFindMatch), so real players can replace the bots later without touching the rest.
(function () {
    'use strict';
    const B = BotRoster, T = B.TIERS;
    const $ = id => document.getElementById(id);

    /* ------------------------------------------------------------------ config ---- */
    const EPOCH = Date.UTC(2026, 9, 1), SEASON_DAYS = 30;
    const RK_UNLOCK_RACES = 0;                    // Quick matches needed before Ranked opens (0 while testing, 3 at launch)
    const PLACEMENTS = 5;
    const DAILY_DROPS = 5;                        // winning places a supply drop in the first 5 wins per day (bots-only season)
    const PLACE_REWARD = { coins:[70, 45, 30, 15], xp:[70, 50, 35, 20], pass:[55, 40, 28, 18] };
    // Season rewards: claim each the first time you reach the rank this season.
    const SEASON_REWARDS = [
        null,
        { coins:150 },
        { coins:300, drop:'rare' },
        { coins:500, drop:'epic' },
        { coins:800, gems:10, drop:'epic' },
        { coins:1200, gems:20, drop:'legendary' },
        { coins:2000, gems:50, drop:'legendary', item:'p-infinity' },
    ];

    const seasonNow = () => Math.max(0, Math.floor((Date.now() - EPOCH) / (SEASON_DAYS * 864e5)));
    const daysLeft = () => Math.max(1, Math.ceil(((seasonNow() + 1) * SEASON_DAYS * 864e5 - (Date.now() - EPOCH)) / 864e5));
    const today = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const ord = n => n + ((n % 100 >= 11 && n % 100 <= 13) ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10 < 4 ? n % 10 : 0]);

    /* --------------------------------------------------------------- the emblem ---- */
    // A shield per rank: more chevrons, then mountains, then a crown. tier -1 = unranked.
    let uid = 0;
    function emblem(tier, size, opts) {
        const id = 'rke' + (++uid), un = tier < 0, t = T[Math.max(0, tier)];
        const c1 = un ? '#4a5266' : t.c1, c2 = un ? '#242a38' : t.c2;
        const dark = '#0d1017', white = '#ffffff';
        let glyph = '';
        const chev = y => '<path d="M31 ' + y + ' L50 ' + (y - 15) + ' L69 ' + y + '" fill="none" stroke="' + dark + '" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><path d="M31 ' + y + ' L50 ' + (y - 15) + ' L69 ' + y + '" fill="none" stroke="' + white + '" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>';
        const peak = (a, b, c, fill) => '<polygon points="' + a + ' ' + b + ' ' + c + '" fill="' + fill + '" stroke="' + dark + '" stroke-width="3.5" stroke-linejoin="round"/>';
        if (un) glyph = '<text x="50" y="72" text-anchor="middle" font-family="Bricolage Grotesque,Arial Rounded MT Bold,system-ui,sans-serif" font-weight="800" font-size="46" fill="#8b95a7" stroke="' + dark + '" stroke-width="3" paint-order="stroke">?</text>';
        else if (tier === 0) glyph = chev(66);
        else if (tier === 1) glyph = chev(56) + chev(74);
        else if (tier === 2) glyph = chev(46) + chev(62) + chev(78);
        else if (tier === 3) glyph = peak('22,80', '50,34', '78,80', white) + '<polygon points="50,34 62,56 50,50 38,56" fill="' + c1 + '" opacity=".9"/>';
        else if (tier === 4) glyph = peak('22,82', '50,40', '78,82', white) + '<polygon points="50,40 62,60 50,54 38,60" fill="' + c1 + '" opacity=".9"/><path d="M50 18 L53.2 25.3 L61 26 L55 31 L56.8 38.5 L50 34.6 L43.2 38.5 L45 31 L39 26 L46.8 25.3 Z" fill="#fff4c2" stroke="' + dark + '" stroke-width="2.6" stroke-linejoin="round"/>';
        else if (tier === 5) glyph = peak('16,82', '38,46', '60,82', white) + peak('40,82', '64,38', '86,82', '#ffe6ea') + '<path d="M50 14 L60 26 L50 40 L40 26 Z" fill="' + c1 + '" stroke="' + dark + '" stroke-width="3" stroke-linejoin="round"/>';
        else glyph = '<path d="M24 74 L20 42 L36 54 L50 30 L64 54 L80 42 L76 74 Z" fill="url(#' + id + 'g)" stroke="' + dark + '" stroke-width="4" stroke-linejoin="round"/><rect x="24" y="74" width="52" height="9" rx="3" fill="#ffd25a" stroke="' + dark + '" stroke-width="3.5"/><circle cx="50" cy="38" r="4" fill="#ff5470" stroke="' + dark + '" stroke-width="2"/><circle cx="20" cy="42" r="3.4" fill="#5eead4" stroke="' + dark + '" stroke-width="2"/><circle cx="80" cy="42" r="3.4" fill="#c4baff" stroke="' + dark + '" stroke-width="2"/>';
        const wings = (!un && tier >= 3) ? '<path d="M8 30 L-8 22 L-2 40 L-12 40 L-2 56 L-10 62 L8 66 Z" fill="' + c2 + '" stroke="' + dark + '" stroke-width="3.5" stroke-linejoin="round"/><path d="M92 30 L108 22 L102 40 L112 40 L102 56 L110 62 L92 66 Z" fill="' + c2 + '" stroke="' + dark + '" stroke-width="3.5" stroke-linejoin="round"/>' : '';
        return '<svg class="rk-emb' + (opts && opts.cls ? ' ' + opts.cls : '') + '" viewBox="-14 -2 128 118" width="' + size + '" height="' + (size * 118 / 128).toFixed(1) + '" aria-hidden="true"><defs>' +
            '<linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + c1 + '"/><stop offset="1" stop-color="' + c2 + '"/></linearGradient>' +
            '<linearGradient id="' + id + 'g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0a8"/><stop offset=".5" stop-color="#ffc83a"/><stop offset="1" stop-color="#c47a10"/></linearGradient></defs>' +
            '<ellipse cx="50" cy="112" rx="34" ry="3.4" fill="#000" opacity=".35"/>' + wings +
            '<path d="M50 3 L92 17 V58 C92 82 70 100 50 108 C30 100 8 82 8 58 V17 Z" fill="' + dark + '"/>' +
            '<path d="M50 7 L88 19.500 V57 C88 79 68 95.500 50 103 C32 95.500 12 79 12 57 V19.500 Z" fill="url(#' + id + ')"/>' +
            '<path d="M50 7 L88 19.500 V36 C70 28 30 28 12 36 V19.500 Z" fill="#fff" opacity=".22"/>' +
            '<path d="M50 7 L88 19.500 V57 C88 79 68 95.500 50 103 C32 95.500 12 79 12 57 V19.500 Z" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="2"/>' + glyph + '</svg>';
    }

    /* -------------------------------------------------------------------- state ---- */
    function withRk(fn) { const p = prog(); const r = fn(p.rk, p); saveProg(p); return r; }
    // Season history lives in the account record (prog().rk.seasons, newest first, max 12 entries):
    //   { s:seasonIndex, mmr:end-of-season MMR, rp, tier:best tier reached, m:matches that season }
    // A new season starts from a weighted average of the last seasons (recent and well-played ones count more),
    // pulled towards the middle, and pulled a bit further for every season you did not play at all.
    const HIST_MAX = 12, SEASON_AGE = 0.65, IDLE_DECAY = 0.85;
    function carryMmr(seasons, now, idle) {
        let sum = 0, wsum = 0;
        for (const e of seasons) {
            const w = Math.pow(SEASON_AGE, Math.max(0, now - 1 - e.s)) * Math.min(1, 0.4 + e.m / 12);
            sum += e.mmr * w; wsum += w;
        }
        const avg = wsum ? sum / wsum : 1100;
        return Math.round(1100 + (avg - 1100) * 0.55 * Math.pow(IDLE_DECAY, idle));
    }
    function ensureSeason() {
        const p = prog(), r = p.rk, now = seasonNow();
        if (r.season === now) return;
        // old test accounts have no per-season count: treat all their matches as the season that just ended
        const played = r.sm || (r.matches > 0 && !r.seasons.length ? r.matches : 0);
        if (played > 0) {
            r.seasons.unshift({ s:r.season, mmr:r.mmr, rp:r.rp, tier:B.rankOf(r.peak).tier, m:played });
            r.seasons.length = Math.min(r.seasons.length, HIST_MAX);
            r.lastPlayed = r.season;
        }
        if (r.seasons.length) {
            const idle = Math.max(0, now - 1 - Math.max(r.lastPlayed, r.seasons[0].s));   // whole seasons skipped
            r.mmr = carryMmr(r.seasons, now, idle);
            r.placed = Math.max(0, Math.min(r.placed, PLACEMENTS - 2 - Math.min(2, idle >> 1)));   // long away: more re-placement
            r.rp = B.mmrToRp(r.mmr); r.peak = r.rp; r.protect = 0; r.streak = 0; r.claimed = [];
        }
        r.sm = 0; r.season = now; saveProg(p);
    }
    function rkState() {
        ensureSeason();
        const r = prog().rk, placed = r.placed >= PLACEMENTS, rank = placed ? B.rankOf(r.rp) : null;
        return { rk:r, placed, rank, tier:placed ? rank.tier : -1, peakRank:placed ? B.rankOf(r.peak) : null, left:PLACEMENTS - r.placed };
    }
    function claimable() {
        const s = rkState(); if (!s.placed) return [];
        const out = [], top = B.rankOf(s.rk.peak).tier, season = seasonNow();
        for (let i = 1; i <= top; i++) if (!s.rk.claimed.includes(season + ':' + i)) out.push(i);
        return out;
    }

    /* ------------------------------------------------------------ result maths ---- */
    function applyResult(order, place, forfeit) {
        const before = rkState(), r0 = before.rk;
        const ratings = order.map(o => o.mmr), placing = !before.placed;
        const k = placing ? 56 : 28;
        let dm = Math.round(B.eloDelta(ratings, place, k));
        if (forfeit) dm = Math.min(dm, -12);
        let rpd = 0, promo = null, demo = null;
        const out = withRk((rk, p) => {
            rk.mmr = clamp(rk.mmr + dm, 400, 2900);
            rk.matches++; rk.sm++; rk.lastPlayed = seasonNow(); if (place === 1) { rk.wins++; rk.streak++; } else if (place >= 3) rk.streak = 0;
            const wasRank = before.placed ? B.rankOf(rk.rp) : null;
            if (placing) {
                rk.placed++;
                if (rk.placed >= PLACEMENTS) { rk.rp = B.mmrToRp(rk.mmr); rk.peak = Math.max(rk.peak, rk.rp); rk.protect = 2; }
            } else {
                const target = B.mmrToRp(rk.mmr);
                rpd = Math.round(dm * B.RP_SCALE * 0.5 + 0.12 * (target - rk.rp)) + (place === 1 ? Math.min(6, Math.max(0, rk.streak - 2) * 3) : 0);
                rpd = clamp(rpd, -24, 34);
                if (forfeit) rpd = Math.min(rpd, -16);
                const floor = wasRank ? wasRank.tier * B.RP_PER_TIER : 0;
                let next = Math.max(0, rk.rp + rpd);
                if (rpd < 0 && rk.protect > 0) next = Math.max(next, floor);       // freshly promoted: shielded from a demotion
                rpd = next - rk.rp; rk.rp = next; rk.peak = Math.max(rk.peak, rk.rp);
                if (rk.protect > 0) rk.protect--;
            }
            rk.hist.unshift({ place, d:rpd, t:Date.now() }); rk.hist.length = Math.min(rk.hist.length, 20);
            const nowRank = rk.placed >= PLACEMENTS ? B.rankOf(rk.rp) : null;
            if (nowRank && !wasRank) promo = { first:true, to:nowRank };
            else if (nowRank && wasRank && nowRank.tier > wasRank.tier) { promo = { to:nowRank, from:wasRank }; rk.protect = 2; }
            else if (nowRank && wasRank && nowRank.tier < wasRank.tier) demo = { to:nowRank, from:wasRank };
            return { mmr:rk.mmr };
        });
        B.settleBots(order);
        return { before, after:rkState(), dm, rpd, promo, demo, placing, place };
    }

    /* ---------------------------------------------------------- the match flow ---- */
    let cur = null;                                // the match in progress
    // The ONLY place that knows opponents are bots. Swap this for a server call and the rest of Ranked stays as it is.
    function providerFindMatch() {
        const s = rkState();
        // one a little above, one around, one a little below: a fair, slightly varied lobby
        const mmr = s.rk.mmr, a = B.pick(1, { mmr:mmr + 90, spread:70 }), exclude = a.map(b => b.id);
        const b = B.pick(1, { mmr, spread:60, exclude }); exclude.push(...b.map(x => x.id));
        const c = B.pick(1, { mmr:mmr - 90, spread:70, exclude });
        return shuffle([...a, ...b, ...c]);
    }
    function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

    function startMatch(chosen) {
        window.rankedMatch = true; window.RACE_BAND = 0; window.matchBots = chosen;
        matchLootId = newLootId('rk'); matchSeed = (Math.random() * 4294967296) >>> 0; matchHumanSlot = 0; matchBotNames = chosen.map(b => b.name);
        cur = { id:matchLootId, chosen, done:false, t0:Date.now() };
        withRk(rk => { rk.pending = { id:cur.id, t:Date.now() }; });      // closing the app mid-match counts as a loss
        hide($('rk-queue')); hide($('rk-hub')); hide($('rk-result'));
        startGame();
        clearInterval(cur.watch);
        cur.watch = setInterval(() => { if (cur && !cur.done && state === 'playing' && Date.now() - matchStart > 330000) finishMatch(4, true); }, 4000);   // nobody can stall a match forever
    }
    
    function orderNow(place, forfeit) {
        const lp = players[0], rest = players.slice(1).map((p, i) => ({ p, b:cur.chosen[i] }));
        rest.sort((x, y) => (x.p.finished && y.p.finished) ? x.p.finishTime - y.p.finishTime : x.p.finished ? -1 : y.p.finished ? 1 : x.p.y - y.p.y);
        const list = rest.map(o => ({ id:o.b.id, mmr:o.b.mmr, name:o.b.name, look:o.b.look }));
        const me = { id:'me', mmr:prog().rk.mmr, name:prog().name, look:myLook() };
        list.splice(Math.min(place - 1, list.length), 0, me);
        return list;
    }

    function finishMatch(place, forfeit, silent) {
        if (!cur || cur.done) return;
        cur.done = true; clearInterval(cur.watch);
        withRk(rk => { delete rk.pending; });
        const order = orderNow(place, forfeit);
        const res = applyResult(order, place, forfeit);
        clearMatchFlags();
        if (silent) { toast(forfeit ? 'Match forfeited: ' + res.rpd + ' RP' : ''); return; }
        state = 'finished';
        hud.style.display = 'none'; showFinishMenu(false);
        renderResult(res, order);
    }
    function clearMatchFlags() { window.rankedMatch = false; window.RACE_BAND = undefined; window.matchBots = null; }

    window.Ranked = {
        emblem, seasonNow, state:rkState, claimable, daysLeft,
        open:openHub, refreshHome,
        onLocalFinish(place) {
            if (!cur || cur.done) return;
            showFinishMenu(false);
            cur.localPlace = place;
            setTimeout(() => { if (cur && !cur.done) finishMatch(place, false); }, 1300);
        },
        forfeit(silent) { if (cur && !cur.done) finishMatch(4, true, true); else clearMatchFlags(); },
        pauseMenu() {
            openPrompt('PAUSED', 'Leaving a ranked match counts as a loss.', [
                ['Resume', resumeRace],
                ['Settings', () => openSettings('pause'), true],
                ['Forfeit match', () => { showScreen(''); state = 'playing'; quitToMenu(); }, true],
            ]);
        },
        debug:{ providerFindMatch, applyResult, startMatch, finishMatch, cur:() => cur },
    };

    /* ------------------------------------------------------------------- screens ---- */
    const root = document.createElement('div');
    root.id = 'rk-root';
    root.innerHTML = '<div class="rk-screen" id="rk-hub"></div><div class="rk-screen" id="rk-queue"></div><div class="rk-screen" id="rk-result"></div><div class="rk-promo" id="rk-promo"></div>';
    document.body.appendChild(root);
    function show(el) { el.style.display = 'flex'; void el.offsetWidth; el.classList.add('vis'); }
    function hide(el) { el.classList.remove('vis'); setTimeout(() => { if (!el.classList.contains('vis')) el.style.display = 'none'; }, 320); }

    const placeCol = ['#ffcf3f', '#d4dceb', '#ff9838', '#5b6578'];
    function openHub() {
        if (prog().races < RK_UNLOCK_RACES) { toast('Play ' + RK_UNLOCK_RACES + ' Quick matches to unlock Ranked'); return; }
        renderHub(); show($('rk-hub')); refreshHome();
    }
    function barFor(s) {
        if (!s.placed) return { fill:s.rk.placed / PLACEMENTS * 100, from:'PLACEMENT MATCHES', to:s.rk.placed + ' / ' + PLACEMENTS };
        const r = s.rank;
        if (r.tier >= 6) return { fill:100, from:'CROWN', to:r.rp + ' RP' };
        const next = B.rankOf(r.rp + (r.span - r.into));
        return { fill:r.into / r.span * 100, from:r.rp + ' RP', to:'NEXT  ' + next.label };
    }
    function renderHub() {
        const s = rkState(), r = s.rk, bar = barFor(s), can = claimable();
        const hist = r.hist.slice(0, 5).map(h => '<span class="rk-h" style="--hc:' + placeCol[h.place - 1] + '"><b>' + h.place + '</b>' + (s.placed && h.d ? '<small>' + (h.d > 0 ? '+' : '') + h.d + '</small>' : '') + '</span>').join('') || '<span class="rk-empty">No matches yet</span>';
        const tierNodes = T.map((t, i) => {
            if (!i) return '';
            const rw = SEASON_REWARDS[i], got = r.claimed.includes(seasonNow() + ':' + i), reach = s.placed && B.rankOf(r.peak).tier >= i;
            const bits = [rw.coins ? R('coin', rw.coins) : '', rw.gems ? R('gem', rw.gems) : '', rw.drop ? '<span class="rk-dropchip" style="--ic:' + ({ rare:'#5b8def', epic:'#b3a9ff', legendary:'#ffcf3f' })[rw.drop] + '">' + icon('drop') + '</span>' : '', rw.item ? '<span class="rk-itemchip">' + icon('star') + '</span>' : ''].join('');
            return '<div class="rk-node' + (got ? ' got' : reach ? ' ready' : '') + '" data-t="' + i + '">' + emblem(i, 46) + '<b>' + t.name + '</b><div class="rk-rw">' + bits + '</div>' +
                (got ? '<span class="rk-state">' + icon('check') + '</span>' : reach ? '<button class="rk-claim" type="button" data-claim="' + i + '">CLAIM</button>' : '<span class="rk-state lock">' + icon('lock') + '</span>') + '</div>';
        }).join('');
        $('rk-hub').innerHTML =
            '<div class="rk-top"><button class="rk-back" type="button" id="rk-back" aria-label="Back">' + icon('chev-l') + '</button><div class="rk-season"><b>SEASON ' + (seasonNow() + 1) + '</b><span>' + daysLeft() + ' days left</span></div></div>' +
            '<div class="rk-scroll">' +
              '<div class="rk-hero" style="--tc:' + (s.placed ? T[s.tier].c1 : '#8b95a7') + '">' + emblem(s.tier, 150, { cls:'rk-float' }) +
                '<h1>' + (s.placed ? s.rank.label : 'UNRANKED') + '</h1>' +
                '<p>' + (s.placed ? 'Rank points <b>' + r.rp + '</b>' + (s.peakRank && s.peakRank.tier > s.rank.tier ? ' · Peak ' + s.peakRank.name : '') + (r.seasons.length ? ' · Last season ' + B.rankOf(r.seasons[0].rp).label : '') : s.left + ' placement ' + (s.left === 1 ? 'match' : 'matches') + ' to reveal your rank') + '</p>' +
                '<div class="rk-bar"><div class="rk-bar-top"><span>' + bar.from + '</span><span>' + bar.to + '</span></div><div class="rk-track"><i style="width:' + bar.fill + '%"></i>' + (s.placed ? '' : [1, 2, 3, 4].map(n => '<u style="left:' + (n * 20) + '%"></u>').join('')) + '</div></div>' +
              '</div>' +
              '<h2 class="rk-h2">LAST MATCHES</h2><div class="rk-hist">' + hist + '</div>' +
              '<div class="rk-stats"><div><small>MATCHES</small><b>' + r.matches + '</b></div><div><small>WIN RATE</small><b>' + (r.matches ? Math.round(100 * r.wins / r.matches) + '%' : '--') + '</b></div><div><small>STREAK</small><b>' + r.streak + '</b></div></div>' +
              '<h2 class="rk-h2">SEASON REWARDS' + (can.length ? ' <i class="rk-n">' + can.length + '</i>' : '') + '</h2><div class="rk-track-rw">' + tierNodes + '</div>' +
              '<h2 class="rk-h2">LEADERBOARD</h2><div class="rk-board" id="rk-board"></div>' +
            '</div>' +
            '<div class="rk-cta"><button class="rk-go" type="button" id="rk-find"><span>FIND MATCH</span></button></div>';
        $('rk-back').onclick = () => hide($('rk-hub'));
        $('rk-find').onclick = findMatch;
        $('rk-hub').querySelectorAll('[data-claim]').forEach(b => b.onclick = () => claim(+b.dataset.claim));
        renderBoard();
    }
    function renderBoard() {
        const s = rkState(), all = B.all().map(b => ({ name:b.name, mmr:b.mmr })), me = { name:prog().name, mmr:s.rk.mmr, me:true };
        all.push(me); all.sort((a, b) => b.mmr - a.mmr);
        const pos = all.indexOf(me) + 1, rows = [];
        const row = (e, i) => { const rk = B.rankOf(B.mmrToRp(e.mmr)); return '<div class="rk-row' + (e.me ? ' me' : '') + '"><span class="rk-pos">' + (i + 1) + '</span>' + emblem(s.placed || !e.me ? rk.tier : -1, 26) + '<span class="rk-nm">' + (e.me ? 'You' : e.name) + '</span><span class="rk-pts">' + (e.me && !s.placed ? '--' : B.mmrToRp(e.mmr) + ' RP') + '</span></div>'; };
        all.slice(0, 8).forEach((e, i) => rows.push(row(e, i)));
        if (pos > 8) { rows.push('<div class="rk-gap">...</div>'); rows.push(row(me, pos - 1)); }
        $('rk-board').innerHTML = rows.join('') + '<p class="rk-fine">Ranked is in a test season with practice opponents. Real players come later.</p>';
    }

    async function claim(t) {
        const season = seasonNow(), id = season + ':' + t, rw = SEASON_REWARDS[t];
        if (!rw || prog().rk.claimed.includes(id)) return;
        withRk(rk => { rk.claimed.push(id); });
        const list = [];
        if (rw.gems) { addGems(rw.gems); list.push({ type:'gem', n:rw.gems }); }
        if (rw.item) { const it = [...SKINS, ...HATS, ...FACES, ...TRAILS].find(i => i.id === rw.item); if (it) { const p = prog(); if (!p.owned.includes(it.id)) { p.owned.push(it.id); saveProg(p); list.push({ type:'item', item:it }); } else { addCoins(400); list.push({ type:'coin', n:400 }); } } }
        refreshMenu(); renderHub(); refreshHome();
        if (rw.drop) {
            const drop = awardLootDrop('rkseason:' + id, { coins:rw.coins, xp:60, passPoints:0 }, { tier:rw.drop });
            if (list.length) await showRewardPops(list);
            await new Promise(res => openLootbox(drop, { title:T[t].name.toUpperCase() + ' REWARD', onDone:res }));
        } else { addCoins(rw.coins); list.unshift({ type:'coin', n:rw.coins }); await showRewardPops(list); }
        refreshMenu(); renderHub(); refreshHome();
    }

    /* --------------------------------------------------------------- the queue ---- */
    function findMatch() {
        if (cur && !cur.done) return;
        const chosen = providerFindMatch(), s = rkState(), me = s.placed ? s.rank : null;
        const slot = (b, i) => {
            if (!b) return '<div class="rk-slot"><span class="rk-spin"></span><b>Searching...</b><small>&nbsp;</small></div>';
            const rk = B.rankOf(B.mmrToRp(b.mmr));
            return '<div class="rk-slot on" style="--tc:' + T[rk.tier].c1 + '">' + emblem(rk.tier, 44) + '<b>' + b.name + '</b><small>' + rk.label + ' · Lv ' + b.level + '</small></div>';
        };
        const draw = n => {
            $('rk-queue').innerHTML = '<div class="rk-q-in"><small class="rk-q-k">RANKED RACE</small><h2>FINDING OPPONENTS</h2>' +
                '<div class="rk-slots"><div class="rk-slot on me" style="--tc:' + (me ? T[me.tier].c1 : '#8b95a7') + '">' + emblem(s.tier, 44) + '<b>You</b><small>' + (me ? me.label : 'Placement ' + (s.rk.placed + 1) + '/' + PLACEMENTS) + '</small></div>' +
                chosen.map((b, i) => slot(i < n ? b : null, i)).join('') + '</div>' +
                '<p class="rk-q-sub">' + (n >= 3 ? 'Lobby ready' : 'Matching your level...') + '</p></div>';
        };
        $('rk-queue').classList.remove('vs'); draw(0); show($('rk-queue')); hide($('rk-hub'));
        [700, 1500, 2200].forEach((ms, i) => setTimeout(() => { draw(i + 1); SFX.play('count'); }, ms));
        setTimeout(() => { SFX.play('go'); showVs(chosen, s); }, 3000);
        setTimeout(() => startMatch(chosen), 4400);
    }
    function showVs(chosen, s) {
        const avg = Math.round(chosen.reduce((a, b) => a + b.mmr, 0) / chosen.length), rk = B.rankOf(B.mmrToRp(avg));
        const el = $('rk-queue').querySelector('.rk-q-sub');
        if (el) el.innerHTML = 'Average opponent <b style="color:' + T[rk.tier].c1 + '">' + rk.label + '</b>';
        $('rk-queue').classList.add('vs');
    }

    /* -------------------------------------------------------------------- result ---- */
    function renderResult(res, order) {
        const place = res.place, s = res.after, r = s.rk, tierCol = s.placed ? T[s.tier].c1 : '#8b95a7';
        const pc = placeCol[place - 1];
        // rewards (granted once)
        const id = 'rkm:' + (cur ? cur.id : Date.now()), p0 = prog();
        const coins = PLACE_REWARD.coins[place - 1], xp = PLACE_REWARD.xp[place - 1], pass = PLACE_REWARD.pass[place - 1];
        let drop = null;
        if (!p0.lootGrants[id] && !p0.pendingDrops[id]) {
            const day = today(); const q = prog(); if (q.rk.dropDay !== day) { q.rk.dropDay = day; q.rk.dropN = 0; }
            const canDrop = place === 1 && q.rk.dropN < DAILY_DROPS;
            if (canDrop) { q.rk.dropN++; q.races++; saveProg(q); drop = awardLootDrop(id, { coins, xp, passPoints:pass }, { tier:'rare' }); }
            else { q.xp += xp; q.passPoints += pass; q.passPointsEarned += pass; q.races++; q.lootGrants[id] = { id, tier:'common', coins, xp, passPoints:pass, cosmetic:null, noDrop:true }; saveProg(q); store('rr_coins', load('rr_coins', 0) + coins); }
        }
        refreshMenu();
        const rows = order.map((o, i) => {
            const rk = B.rankOf(B.mmrToRp(o.mmr)), me = o.id === 'me';
            return '<div class="rk-res-row' + (me ? ' me' : '') + '"><span class="rk-pos" style="color:' + placeCol[i] + '">' + (i + 1) + '</span>' + emblem(me && !s.placed ? -1 : rk.tier, 26) + '<span class="rk-nm">' + (me ? 'You' : o.name) + '</span></div>';
        }).join('');
        const rp = res.placing ? '' : '<div class="rk-delta ' + (res.rpd >= 0 ? 'up' : 'down') + '"><b>' + (res.rpd > 0 ? '+' : '') + res.rpd + '</b><span>RP</span></div>';
        const pl = res.placing ? '<div class="rk-delta"><b>' + s.rk.placed + ' / ' + PLACEMENTS + '</b><span>PLACEMENT</span></div>' : '';
        const bar = barFor(s), from = res.placing ? 0 : barFill(res.before);
        $('rk-result').style.setProperty('--pc', pc);
        $('rk-result').innerHTML =
            '<div class="rk-scroll res"><div class="rk-res-hero"><small>' + (place === 1 ? 'VICTORY' : 'RANKED RACE') + '</small><h1>' + ord(place) + '</h1></div>' +
            '<div class="rk-res-card" style="--tc:' + tierCol + '">' + emblem(s.tier, 74) + '<div class="rk-res-info"><b>' + (s.placed ? s.rank.label : 'UNRANKED') + '</b>' + rp + pl +
              '<div class="rk-track small"><i id="rk-res-fill" style="width:' + from + '%"></i></div></div></div>' +
            (res.demo ? '<p class="rk-note down">Demoted to ' + res.demo.to.label + '</p>' : '') +
            (res.promo && res.promo.first ? '<p class="rk-note up">Rank revealed: ' + res.promo.to.label + '</p>' : res.promo ? '<p class="rk-note up">Promoted to ' + res.promo.to.label + '</p>' : '') +
            '<div class="rk-res-list">' + rows + '</div>' +
            '<div class="rk-rewards">' + (drop ? '<div class="loot-drop" id="rk-loot"></div>' : '<div class="rk-chips">' + R('coin', coins, { plus:true }) + R('xp', xp, { plus:true }) + R('pass', pass, { plus:true }) + '</div>') + '</div></div>' +
            '<div class="rk-cta two"><button class="rk-go" type="button" id="rk-again"><span>PLAY AGAIN</span></button><button class="rk-go ghost" type="button" id="rk-home"><span>BACK</span></button></div>';
        show($('rk-result'));
        if (drop) renderLootDrop('rk-loot', drop);
        setTimeout(() => { const f = $('rk-res-fill'); if (f) f.style.width = (res.placing ? barFill(s) : barFill(s)) + '%'; }, 450);
        if (place === 1) SFX.play('finish'); else if (place === 4) SFX.play('fail');
        if (res.promo) setTimeout(() => promoCard(res.promo), 1300);
        $('rk-again').onclick = () => { hide($('rk-result')); leave(); setTimeout(findMatch, 80); };
        $('rk-home').onclick = () => { hide($('rk-result')); leave(); setTimeout(openHub, 80); };
    }
    function barFill(s) { const b = barFor(s); return b.fill; }
    function leave() { state = 'menu'; gameMode = 'race'; hud.style.display = 'none'; refreshStartMeta(); showScreen('start'); }

    function promoCard(promo) {
        const el = $('rk-promo'), t = promo.to;
        el.style.setProperty('--tc', T[t.tier].c1);
        el.innerHTML = '<div class="rk-promo-in"><div class="rk-rays"></div><small>' + (promo.first ? 'YOUR RANK' : 'PROMOTED') + '</small>' + emblem(t.tier, 190, { cls:'rk-pop' }) + '<h2>' + t.label + '</h2><button class="rk-go" type="button" id="rk-promo-ok"><span>CONTINUE</span></button></div>';
        show(el); SFX.play('finish'); haptic([40, 40, 40, 40, 120]);
        $('rk-promo-ok').onclick = () => hide(el);
    }

    /* --------------------------------------------------------------- home bits ---- */
    function refreshHome() {
        const s = rkState(), card = $('btn-ranked');
        if (!card) return;
        const ico = card.querySelector('.mc-ico');
        ico.innerHTML = emblem(s.tier, 34);
        const sub = $('p-rk-sub');
        if (sub) sub.textContent = s.placed ? s.rank.label + ' · ' + s.rk.rp + ' RP' : 'Placement ' + Math.min(s.rk.placed + 1, PLACEMENTS) + ' / ' + PLACEMENTS;
        const can = claimable().length;
        setBadge(card, can);
    }

    // test hooks
    Ranked.debug.setMmr = m => withRk(rk => { rk.mmr = m; rk.rp = B.mmrToRp(m); rk.placed = PLACEMENTS; rk.peak = rk.rp; });
    Ranked.debug.claim = claim; Ranked.debug.promo = promoCard;
    // a match that was never finished (app closed, tab killed) is settled as a loss the next time the game opens
    (function settlePending() {
        const p = prog(); if (!p.rk.pending) return;
        const a = B.pick(3, { mmr:p.rk.mmr, spread:80 }), order = [...a.map(b => ({ id:b.id, mmr:b.mmr })), { id:'me', mmr:p.rk.mmr }];
        withRk(rk => { delete rk.pending; });
        const res = applyResult(order, 4, true);
        setTimeout(() => { try { toast('Unfinished ranked match counted as a loss'); } catch (e) {} }, 1500);
    })();
    ensureSeason(); refreshHome();
})();
