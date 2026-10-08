// THE FINISH: what happens from the moment you cross the line until the results are on screen. Arena Race only (Build Race, the Gauntlet and the rest have their own end).
//   THE FINISH MOMENT  You are through and the others are still racing. No window: your place in big letters (the same look as the place in the corner), your time, and every
//                      player who finishes after you slides in under it ("2ND  Mila  +0.84"). The camera follows whoever is closest to the line. Two actions: RESULTS (the rest of the
//                      race is fast-forwarded, so the results are always complete and real, never a board full of "DNF") and AGAIN.
//   THE RESULTS        A backdrop painted from the arena you raced in, the place as the headline, the victory stand, then only what is new: the trophies (with the road to the next
//                      arena) and the rewards that are not in the chest. Nothing is shown twice and zeroes are left out.
// Loaded AFTER game.js, trophies.js and arenatheme.js. game.js calls: FinishMoment.show / add / hide, FinishMoment.headline / gains / backdrop.
(function () {
    'use strict';
    const $ = id => document.getElementById(id), num = n => Math.round(n).toLocaleString('en-US');
    const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const ORD = n => n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th');
    const sup = n => '<b>' + n + '</b><i>' + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th') + '</i>';
    let el = null, on = false, listed = 0, tmr = 0;

    /* ------------------------------------------------------------------ the finish moment ---- */
    function build() {
        if (el) return el;
        el = document.createElement('div'); el.id = 'fin-moment';
        el.innerHTML = '<div class="fm-head"><div class="fm-place place"></div><div class="fm-time"></div></div><ol class="fm-list"></ol>' +
            '<div class="fm-ff"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6l7 6-7 6zM13 6l7 6-7 6z" fill="currentColor"/></svg><span>FAST FORWARD</span></div>' +
            '<div class="fm-actions"><button type="button" class="fm-again">AGAIN</button><button type="button" class="fm-go">RESULTS</button></div>';
        ($('hud') || document.body).appendChild(el);
        el.querySelector('.fm-go').addEventListener('click', e => { e.stopPropagation(); if (window.SFX) SFX.play('count'); skip(); });
        el.querySelector('.fm-again').addEventListener('click', e => { e.stopPropagation(); if (window.SFX) SFX.play('count'); hide(); restartRace(); });
        return el;
    }
    const finishers = () => players.filter(p => p.finished).sort((a, b) => a.finishTime - b.finishTime);
    function render(first) {
        const me = players.find(p => p.local); if (!me || !me.finished || !el) return;
        const fin = finishers(), place = fin.indexOf(me) + 1;
        const pl = el.querySelector('.fm-place'); pl.className = 'fm-place place p' + Math.min(4, place); pl.innerHTML = sup(place);
        el.querySelector('.fm-time').textContent = me.finishTime.toFixed(2) + ' s';
        const others = fin.filter(p => p !== me), box = el.querySelector('.fm-list');
        box.innerHTML = others.map((p, k) => {
            const n = fin.indexOf(p) + 1, d = p.finishTime - me.finishTime;
            return '<li class="fm-row p' + Math.min(4, n) + (k >= listed && !first ? ' new' : '') + '"><span class="fm-n">' + ORD(n).toUpperCase() + '</span><span class="fm-pip" style="background:' + esc(p.color) + '"></span><b>' + esc(p.name) + '</b><em class="' + (d < 0 ? 'dn' : 'up') + '">' + (d < 0 ? '-' : '+') + Math.abs(d).toFixed(2) + '</em></li>';
        }).join('');
        listed = others.length;
    }
    function show() {
        build(); on = true; listed = 0; el.classList.remove('ff', 'on'); document.body.classList.add('fin-moment'); render(true);
        void el.offsetWidth; el.classList.add('on');
    }
    function add() { if (on) render(false); }
    function hide() { on = false; document.body.classList.remove('fin-moment'); if (el) el.classList.remove('on', 'ff'); clearTimeout(tmr); }
    function skip() {
        if (!on) return;
        if (window.partyMatch || players.some(p => p.remote) || typeof startFastForward !== 'function') { hide(); giveUpToResults(); return; }       // a live party cannot be sped up
        el.classList.add('ff'); startFastForward();
    }

    /* ----------------------------------------------------------------------- the results ---- */
    // the arena you raced in, painted once behind the results (a calm picture: dark at the top and the bottom for the text and the buttons)
    function backdrop() {
        const cv = $('res-bg'); if (!cv) return;
        const i = window.ArenaTheme && ArenaTheme.on() ? ArenaTheme.index() : -1, scr = $('s-results');
        if (scr) scr.classList.toggle('light', i >= 0 && ArenaTheme.light());
        if (i < 0) { cv.style.display = 'none'; return; }
        const w = innerWidth, h = innerHeight, dpr = Math.min(1.5, window.devicePixelRatio || 1);
        cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.display = 'block';
        try { ArenaTheme.paintWorld(cv, i, w, h); } catch (e) { cv.style.display = 'none'; }
    }
    function headline(place) {
        const h = $('res-place'); if (!h) return;
        h.className = 'res-place place p' + Math.min(4, place); h.innerHTML = sup(place);
        h.style.animation = 'none'; void h.offsetWidth; h.style.animation = '';
    }
    function countUp(node, to, plus) {
        const t0 = performance.now() + 1500, dur = 800, run = t => {
            const k = Math.max(0, Math.min(1, (t - t0) / dur)), v = Math.round(to * (1 - Math.pow(1 - k, 3)));
            node.textContent = (plus && to > 0 ? '+' : '') + (to < 0 ? '-' : '') + num(Math.abs(v)); if (k < 1 && node.isConnected) requestAnimationFrame(run);
        };
        node.textContent = (plus && to > 0 ? '+' : '') + (to < 0 ? '-' : '') + '0'; requestAnimationFrame(run);
    }
    // what is new: the trophies and how the road to the next arena looks now, then the plain rewards (the winner's coins and XP are in the chest, so nothing is shown twice)
    function gains(rw, tl) {
        const box = $('res-gain'); if (!box) return;
        let h = '';
        if (rw && rw.noRewards) { box.innerHTML = '<p class="rg-note">Friendly match, no rewards</p>'; return; }
        if (tl && tl.delta && window.Trophies) {
            const A = Trophies.ARENAS, ai = Trophies.arenaOf(tl.tr), a = A[ai], nx = A[ai + 1], from = Math.max(0, tl.tr - tl.delta);
            let bar = '';
            if (nx) { const span = nx.at - a.at, f0 = Math.max(0, Math.min(1, (from - a.at) / span)), f1 = Math.max(0, Math.min(1, (tl.tr - a.at) / span)); bar = '<span class="rg-bar" style="--ac:' + a.c + ';--f0:' + f0 + ';--f1:' + f1 + '"><i></i></span><small>' + num(nx.at - tl.tr) + ' to ' + esc(nx.n) + '</small>'; }
            h += '<div class="rg-tr ' + (tl.delta > 0 ? 'up' : 'down') + '">' + icon('trophy') + '<b data-to="' + tl.delta + '">0</b>' + bar + '</div>';
            if (tl.newArena) h += '<div class="rg-new" style="--ac:' + a.c + '"><small>NEW ARENA</small><b>' + esc(a.n.toUpperCase()) + '</b></div>';
        }
        if (rw && rw.noDrop) {
            const chips = (rw.coins > 0 ? R('coin', rw.coins, { plus: true }) : '') + (rw.xp > 0 ? R('xp', rw.xp, { plus: true }) : '') + (rw.passPoints > 0 ? R('pass', rw.passPoints, { plus: true }) : '') + (window.rewardRace && rewardRace.keyEarned ? R('key', 1, { plus: true }) : '');
            if (chips) h += '<div class="rg-chips">' + chips + '</div>';
        }
        box.innerHTML = h;
        const b = box.querySelector('.rg-tr b'); if (b) countUp(b, +b.dataset.to, true);
        box.classList.remove('go'); void box.offsetWidth; box.classList.add('go');
    }

    window.FinishMoment = { show, add, hide, skip, isOn: () => on, headline, gains, backdrop };
})();
