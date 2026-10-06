// WIN METER: ten pieces on top of the mode card on the home screen. Every win (1st place, in any mode) fills one piece; every second piece holds a reward.
//   2 wins: common chest   4: rare chest   6: x2 XP booster   8: epic chest   10: legendary chest, then the meter starts again.
// Losses never take anything away. Tap the bar to collect what is ready. Profile field: wm = { n: wins in this round, got: [rewards already taken] }.
(function () {
    'use strict';
    const $ = id => document.getElementById(id), N = 10;
    const REW = { 2: { t: 'drop', tier: 'common' }, 4: { t: 'drop', tier: 'rare' }, 6: { t: 'boost', kind: 'xp', mult: 2, n: 3 }, 8: { t: 'drop', tier: 'epic' }, 10: { t: 'drop', tier: 'legendary' } };
    const TC = { common: '#35e0c8', rare: '#5b8def', epic: '#b3a9ff', mythic: '#ff4d7d', legendary: '#ffcf3f' };
    const get = () => { const p = prog(); return p.wm && typeof p.wm.n === 'number' ? p.wm : { n: 0, got: [] }; };
    const ready = () => { const w = get(); return Object.keys(REW).map(Number).filter(k => k <= w.n && !w.got.includes(k)); };
    const nameOf = r => r.t === 'drop' ? r.tier + ' chest' : 'x2 XP booster';

    function add() {                                                           // called once per win
        const p = prog(); const w = p.wm && typeof p.wm.n === 'number' ? p.wm : { n: 0, got: [] };
        if (w.n < N) w.n++; p.wm = w; saveProg(p);
        const r = REW[w.n]; if (r && typeof toast === 'function') setTimeout(() => toast('Win meter: ' + nameOf(r) + ' ready, tap the bar'), 1200);
    }
    let lastKey = '', shownN = null;
    function render() {
        const box = $('m-winbar'); if (!box) return;
        const w = get(), rd = ready(), key = w.n + '|' + w.got.join(',');
        if (key === lastKey) return; lastKey = key;
        const grow = shownN !== null && w.n > shownN ? w.n : 0; shownN = w.n;
        let h = '';
        for (let i = 1; i <= N; i++) {
            const r = REW[i], on = i <= w.n, got = w.got.includes(i), can = r && on && !got;
            const ic = r ? (r.t === 'drop' ? icon('drop-' + r.tier) : icon('xp')) : '';
            h += '<span class="wm-s' + (on ? ' on' : '') + (grow === i ? ' new' : '') + (r ? ' rw' : '') + (can ? ' can' : '') + (got ? ' got' : '') + '"' + (r ? ' style="--rc:' + (r.t === 'drop' ? TC[r.tier] : '#6cc4ff') + '"' : '') + '>' + (r ? '<b>' + ic + '</b>' : '') + '<i></i></span>';
        }
        box.innerHTML = h; box.classList.toggle('ready', rd.length > 0);
        box.setAttribute('aria-label', 'Win meter ' + w.n + ' of ' + N + (rd.length ? ', a reward is ready' : ''));
    }
    let busy = false;
    async function claim() {
        if (busy) return; const rd = ready();
        if (!rd.length) { const w = get(), next = Object.keys(REW).map(Number).find(k => k > w.n); if (typeof toast === 'function') toast(next ? 'Win ' + (next - w.n) + (next - w.n === 1 ? ' more race' : ' more races') + ' for a ' + nameOf(REW[next]) : 'Win the next race to start a new round'); return; }
        busy = true;
        try {
            for (const k of rd) {
                const p = prog(), w = p.wm; if (w.got.includes(k)) continue;
                w.got.push(k); if (k === N) { w.n = 0; w.got = []; } saveProg(p);          // mark first: a double tap never pays twice
                const r = REW[k];
                if (r.t === 'drop') { const drop = awardLootDrop(newLootId('winmeter'), { coins: 60, xp: 40, passPoints: 0 }, { tier: r.tier }); await new Promise(res => openLootbox(drop, { title: 'WIN REWARD', onDone: res })); }
                else await showRewardPops([Boost.pop(r)]);
                lastKey = ''; render(); refreshMenu();
            }
        } finally { busy = false; lastKey = ''; render(); }
    }
    const bar = $('m-winbar'); if (bar) bar.addEventListener('click', e => { e.stopPropagation(); if (window.SFX) SFX.play('count'); claim(); });
    setInterval(() => { if (!document.hidden) render(); }, 1500);
    window.WinMeter = { add, render, claim, ready, REW };
    render();
})();
