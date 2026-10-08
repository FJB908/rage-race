// CHEST DROP RATES: an honest list of what can come out of chests and how often (required by Google Play for loot boxes).
// Everything is computed from the same constants the game uses, so this screen can never drift from the real odds.
(function () {
    'use strict';
    const pct = x => (x * 100 >= 10 ? Math.round(x * 100) : Math.round(x * 1000) / 10) + '%';
    const COL = { common: '#35e0c8', rare: '#5b8def', epic: '#b3a9ff', mythic: '#ff4d7d', legendary: '#ffcf3f' };
    const NAME = { common: 'Common', rare: 'Rare', epic: 'Epic', mythic: 'Mythic', legendary: 'Legendary' };
    const rows = list => list.map(([c, label, v]) => '<div class="od-row" style="--c:' + (COL[c] || '#8b95a7') + '"><i></i>' + label + '<b>' + v + '</b></div>').join('');

    // what tier a chest ends up as: the same tapping rules as the chest screen (start tier, then upgrade or open on every tap)
    function tierOdds() {
        const T = ['common', 'rare', 'epic', 'mythic', 'legendary'], UP0 = 0.45, DECAY = 0.58, UPT = [1, 0.8, 0.26, 0.1], OPEN0 = 0.16, STEP = 0.12, N = 30000, out = { common: 0, rare: 0, epic: 0, mythic: 0, legendary: 0 };
        for (let i = 0; i < N; i++) {
            const r = Math.random(); let t = r < 0.01 ? 2 : r < 0.13 ? 1 : 0, n = 0;
            for (let g = 0; g < 40; g++, n++) { if (t < 4 && Math.random() < UP0 * UPT[t] * Math.pow(DECAY, n)) { t++; continue; } if (Math.random() < Math.min(1, OPEN0 + STEP * n)) break; }
            out[T[t]]++;
        }
        for (const k of T) out[k] /= N; return out;
    }
    function show() {
        if (document.getElementById('odds-root')) return;
        const o = tierOdds(), W = DROP_RARITY_WEIGHTS, T = ['common', 'rare', 'epic', 'mythic', 'legendary'];
        const root = document.createElement('div'); root.id = 'odds-root';
        const sum = t => Object.values(W[t]).reduce((a, b) => a + b, 0);
        const fin = { common: 0.02, rare: 0.05, epic: 0.1, mythic: 0.15, legendary: 0.22 }, gem = { epic: 0.012, mythic: 0.08, legendary: 0.22 };
        root.innerHTML = '<h2>Chest drop rates</h2><p class="od-sub">What can come out of the chests you win after matches. You never pay to open these chests. Odds are exact and come from the game itself.</p>' +
            '<div class="od-card"><h3>WHICH CHEST YOU OPEN</h3>' + rows(T.map(t => [t, NAME[t] + ' chest', pct(o[t])])) + '<p class="od-note">Every chest starts as Common (87%), Rare (12%) or Epic (1%). Each tap can upgrade it before it opens; the numbers above include that.</p></div>' +
            T.map(t => '<div class="od-card"><h3>' + NAME[t].toUpperCase() + ' CHEST</h3>' + rows([
                ['', 'Coins', t === 'legendary' ? '10,000-20,000' : 'x' + DROP_COIN_MULT[t]], ['', 'XP', 'x' + DROP_XP_MULT[t]],
                ['', 'A cosmetic you do not own yet', pct(DROP_COSMETIC_CHANCE[t])], ['', 'A finisher (if no cosmetic)', pct(fin[t])],
                ['', 'Gems (' + (t === 'legendary' ? '5-20' : t === 'mythic' ? '5-10' : '5') + ')', gem[t] ? pct(gem[t]) : 'never'],
            ].concat(['common', 'rare', 'epic', 'mythic', 'legendary'].map(r => [r, 'If a cosmetic drops: ' + NAME[r], pct(W[t][r] / sum(t))]))) + (t === 'legendary' ? '<p class="od-note">Legendary chests also give a coin booster (x2 for 3 matches) and have a 0.4% chance of a premium (gem) cosmetic.</p>' : '') + '</div>').join('') +
            '<div class="od-card"><h3>BAD LUCK PROTECTION</h3><p class="od-note" style="margin:0">Skins never come out of chests; they are only for sale in the shop. After 40 chests in a row without a cosmetic, the next chest is guaranteed to hold one (a hat, face or trail).</p></div>' +
            (window.GemCrate ? '<div class="od-card"><h3>GEM CHEST (100 GEMS)</h3>' + rows([['legendary', 'Legendary cosmetic', '12%'], ['mythic', 'Mythic cosmetic', '20%'], ['epic', 'Epic cosmetic', '40%'], ['rare', 'Rare cosmetic', '28%'], ['', 'A second cosmetic as well', '12%']]) + '<p class="od-note">A gem chest always holds one cosmetic you do not own yet, plus coins, XP, gems and boosters.</p></div>' : '') +
            '<button class="btn od-x" type="button">Close</button>';
        document.body.appendChild(root);
        const x = document.createElement('button'); x.type = 'button'; x.className = 'od-close'; x.setAttribute('aria-label', 'Close'); x.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>';
        root.appendChild(x); x.onclick = () => root.remove();
        root.querySelector('.od-x').onclick = () => root.remove();
    }
    window.Odds = { show };
})();
