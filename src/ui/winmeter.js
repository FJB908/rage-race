// WIN METER: ten pieces on top of the mode card on the home screen. Every win (1st place, in any mode) fills one piece; every second piece holds a reward.
//   2 wins: common chest   4: rare chest   6: x2 XP booster   8: epic chest   10: legendary chest, then the meter starts again with the next win.
// Losses never take anything away. Rewards are given automatically (chests open on their own on the home screen); the bar only shows progress. Profile field: wm = { n: wins in this round, got: [rewards already taken] }.
(function () {
    'use strict';
    const $ = id => document.getElementById(id), N = 10;
    const REW = { 2: { t: 'drop', tier: 'common' }, 4: { t: 'drop', tier: 'rare' }, 6: { t: 'boost', kind: 'xp', mult: 2, n: 3 }, 8: { t: 'drop', tier: 'epic' }, 10: { t: 'drop', tier: 'legendary' } };
    const TC = { common: '#35e0c8', rare: '#5b8def', epic: '#b3a9ff', mythic: '#ff4d7d', legendary: '#ffcf3f' };
    const get = () => { const p = prog(); return p.wm && typeof p.wm.n === 'number' ? p.wm : { n: 0, got: [] }; };
    const nameOf = r => r.t === 'drop' ? r.tier + ' chest' : 'x2 XP booster';

    function add() {                                                           // called once per win; rewards are paid out right here, like a chest after a race
        const p = prog(); let w = p.wm && typeof p.wm.n === 'number' ? p.wm : { n: 0, got: [] };
        if (w.n >= N) w = { n: 0, got: [] };                                   // a finished round starts over with the next win
        w.n++; const r = REW[w.n];
        if (r) w.got.push(w.n);                                                // marked before paying: never paid twice
        p.wm = w; saveProg(p);
        if (!r) return;
        if (r.t === 'drop') awardLootDrop(newLootId('winmeter'), { coins: 60, xp: 40, passPoints: 0 }, { tier: r.tier });   // pending chest: opens by itself on the home screen
        else Boost.grant(r.kind, r.mult, r.n);
        if (typeof toast === 'function') setTimeout(() => toast('Win meter: ' + nameOf(r)), 1200);
    }
    let lastKey = '', shownN = null;
    function render() {
        const box = $('m-winbar'); if (!box) return;
        const w = get(), key = w.n + '|' + w.got.join(',');
        if (key === lastKey) return; lastKey = key;
        const grow = shownN !== null && w.n > shownN ? w.n : 0; shownN = w.n;
        let h = '';
        for (let i = 1; i <= N; i++) {
            const r = REW[i], on = i <= w.n, got = w.got.includes(i), can = false;
            const ic = r ? (r.t === 'drop' ? icon('drop-' + r.tier) : icon('xp')) : '';
            h += '<span class="wm-s' + (on ? ' on' : '') + (grow === i ? ' new' : '') + (r ? ' rw' : '') + (can ? ' can' : '') + (got ? ' got' : '') + '"' + (r ? ' style="--rc:' + (r.t === 'drop' ? TC[r.tier] : '#6cc4ff') + '"' : '') + '>' + (r ? '<b>' + ic + '</b>' : '') + '<i></i></span>';
        }
        box.innerHTML = h;
        box.setAttribute('aria-label', 'Win meter ' + w.n + ' of ' + N + '');
    }
    function hint() {                                                          // tapping the bar only tells you what is next
        const w = get(), next = Object.keys(REW).map(Number).find(k => k > w.n);
        if (typeof toast === 'function') toast(next ? 'Win ' + (next - w.n) + (next - w.n === 1 ? ' more race' : ' more races') + ' for a ' + nameOf(REW[next]) : 'Win the next race to start a new round');
    }
    const bar = $('m-winbar'); if (bar) bar.addEventListener('click', e => { e.stopPropagation(); hint(); });
    setInterval(() => { if (!document.hidden) render(); }, 1500);
    window.WinMeter = { add, render, REW };
    render();
})();
