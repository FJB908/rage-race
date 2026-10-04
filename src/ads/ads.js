// ADS: interstitials at calm moments and opt-in rewarded ads. See docs/ADS.md.
// The web build uses a TEST provider (a fake ad screen). On Android, swap in AdMob with Ads.setProvider({ show }).
// show(kind) must resolve true when the ad was watched to the end ('rewarded') or shown ('interstitial').
(function () {
    'use strict';
    const CFG = {
        graceRaces: 4,                 // no interstitials for brand-new players
        everyMatches: 3,               // at most one interstitial per this many finished matches...
        minGapMs: 4 * 60 * 1000,       // ...and never more often than this
        coin:  { amount: 500, perDay: 5, cooldownMs: 5 * 60 * 1000 },     // wait this long before the next 500-coin video
        drop:  { perDay: 3, cooldownMs: 10 * 60 * 1000 },
    };
    const today = () => new Date().toISOString().slice(0, 10);
    const st = () => {
        const p = prog(), a = p.ads = Object.assign({ day:'', coin:0, drop:0, last:0, since:0, lastCoin:0, lastDrop:0 }, p.ads || {});
        if (a.v !== 2) { a.v = 2; a.coin = 0; a.drop = 0; a.last = a.lastCoin = a.lastDrop = 0; }   // one-time reset of the ad counters (testing)
        if (a.day !== today()) { a.day = today(); a.coin = 0; a.drop = 0; }
        return { p, a };
    };
    const A = { cfg: CFG, busy: false };

    /* ------------------------------------------------------- test provider ---- */
    function testProvider() {
        return {
            name: 'test',
            show(kind) {
                return new Promise(resolve => {
                    const rewarded = kind === 'rewarded', secs = rewarded ? 5 : 3;
                    const el = document.createElement('div'); el.className = 'ad-test';
                    el.innerHTML = '<div class="ad-box"><small>TEST AD</small><b>Your ad plays here</b><span class="ad-bar"><i></i></span></div>' +
                        '<button type="button" class="ad-x" disabled>' + (rewarded ? secs + '' : 'Skip in ' + secs) + '</button>';
                    document.body.appendChild(el);
                    const bar = el.querySelector('.ad-bar i'), x = el.querySelector('.ad-x');
                    let left = secs, done = false;
                    requestAnimationFrame(() => { bar.style.transition = 'width ' + secs + 's linear'; bar.style.width = '100%'; });
                    const finish = ok => { if (done) return; done = true; clearInterval(t); el.remove(); resolve(ok); };
                    const t = setInterval(() => {
                        left--;
                        if (left > 0) x.textContent = rewarded ? String(left) : 'Skip in ' + left;
                        else { x.disabled = false; x.textContent = rewarded ? 'CLAIM REWARD' : 'CLOSE'; x.classList.add('go'); clearInterval(t); }
                    }, 1000);
                    x.onclick = () => finish(true);
                    if (rewarded) {                       // a way out that forfeits the reward
                        const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'ad-cancel'; cancel.textContent = 'Close and lose reward';
                        cancel.onclick = () => finish(false); el.appendChild(cancel);
                    }
                });
            },
        };
    }
    let provider = testProvider();
    A.setProvider = p => { provider = p; };

    /* ------------------------------------------------------------ rewarded ---- */
    A.left = kind => { const { a } = st(); return Math.max(0, CFG[kind].perDay - a[kind]); };
    const lastKey = kind => kind === 'coin' ? 'lastCoin' : 'lastDrop';
    A.wait = kind => { const { a } = st(); return Math.max(0, Math.ceil((a[lastKey(kind)] + CFG[kind].cooldownMs - Date.now()) / 1000)); };
    const mmss = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    async function watch(kind) {
        if (A.busy) return false;
        if (A.left(kind) <= 0) { toast('No more ads today'); return false; }
        if (A.wait(kind) > 0) { toast('Next ad in ' + mmss(A.wait(kind))); return false; }
        A.busy = true;
        let ok = false;
        try { ok = await provider.show('rewarded'); } catch (e) { ok = false; }
        A.busy = false;
        if (!ok) { toast('Ad not finished, no reward'); return false; }
        const { p, a } = st(); a[kind]++; a.last = a[lastKey(kind)] = Date.now(); saveProg(p);
        return true;
    }
    A.watchCoins = async function () {
        if (!await watch('coin')) return false;
        addCoins(CFG.coin.amount); SFX.play('coin'); refreshMenu(); A.refreshHome(); toast('+' + CFG.coin.amount + ' coins');
        return true;
    };
    A.watchDrop = async function () {
        if (!await watch('drop')) return false;
        const r = Math.random(), tier = r < 0.04 ? 'epic' : r < 0.3 ? 'rare' : 'common';
        const drop = awardLootDrop('ad:' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), { coins: 40, xp: 20, passPoints: 0 }, { tier });
        openLootbox(drop, { onDone: () => { refreshMenu(); } });
        return true;
    };
    // small button on the home screen: watch a video for 500 coins
    A.refreshHome = function () {
        const b = document.getElementById('btn-ad-home'); if (!b) return;
        const left = A.left('coin'), w = A.wait('coin'); b.hidden = left <= 0;
        b.disabled = w > 0; b.classList.toggle('cool', w > 0);
        const num = b.querySelector('b'); if (num) num.textContent = w > 0 ? mmss(w) : '+' + CFG.coin.amount;
        setBadge(b, 0);                       // the green FREE tag is the notice here; a number would cover the amount
        A.refreshShop();
    };
    // how many video rewards can be claimed right now (shop nav badge + "FREE" tag on the Gems pill)
    A.ready = () => ['coin', 'drop'].reduce((n, k) => n + (A.left(k) > 0 && A.wait(k) <= 0 ? A.left(k) : 0), 0);
    A.refreshShop = function () {
        const n = A.ready(), pill = document.querySelector('.m-pill[data-cat="resources"]');
        if (pill) { let f = pill.querySelector(':scope > .pill-free'); if (n && !f) { f = document.createElement('i'); f.className = 'pill-free'; f.textContent = 'FREE'; pill.appendChild(f); } else if (!n && f) f.remove(); }
        if (typeof refreshShopBadge === 'function') refreshShopBadge();
    };
    A.renderShop = function (box) {
        const sec = document.createElement('div'); sec.className = 'ad-row';
        const hd = document.createElement('div'); hd.className = 'ad-head'; hd.textContent = 'FREE REWARDS - WATCH A VIDEO';
        const mk = (kind, art, label, fn) => {
            const left = A.left(kind), w = A.wait(kind), b = document.createElement('button'); b.type = 'button'; b.className = 'ad-chip'; b.dataset.kind = kind;
            b.disabled = left <= 0 || w > 0; b.classList.toggle('cool', w > 0 && left > 0);
            b.innerHTML = '<span class="ad-art">' + art + icon('video', 'ad-play') + (left > 0 ? '<i class="ad-free">FREE</i>' : '') + '</span><b class="ad-lbl">' + (left <= 0 ? 'Done' : w > 0 ? mmss(w) : label) + '</b><small>' + left + ' left today</small>';
            b.onclick = async () => { b.disabled = true; await fn(); renderResourceShop(); };
            return b;
        };
        A.refreshHome();
        sec.appendChild(mk('coin', icon('coin'), '+' + CFG.coin.amount, A.watchCoins));
        sec.appendChild(mk('drop', icon('drop-common'), 'Free chest', A.watchDrop));
        box.prepend(sec); box.prepend(hd);
    };

    /* -------------------------------------------------------- interstitial ---- */
    // Shown only when you arrive at the main menu after playing: never during a match, a result, a reward or the tutorial.
    let prev = 'menu', playedMs = 0, since = 0, tick = 0;
    function eligible() {
        const { p, a } = st();
        if (p.noAds || A.busy || document.getElementById('lootbox') || localStorage.getItem('rr_tutorial_done') !== '1') return false;   // not before the tutorial is done
        if (p.races < CFG.graceRaces || a.since < CFG.everyMatches || Date.now() - a.last < CFG.minGapMs) return false;
        return state === 'menu';
    }
    async function maybeInterstitial(tries) {
        if (!eligible()) { if (tries < 4) setTimeout(() => maybeInterstitial(tries + 1), 1200); return; }
        A.busy = true; let ok = false;
        try { ok = await provider.show('interstitial'); } catch (e) {}
        A.busy = false;
        const { p, a } = st(); a.since = 0; if (ok) a.last = Date.now(); saveProg(p);
    }
    setInterval(() => {
        if (typeof state === 'undefined') return;
        const now = state, playing = now === 'playing' || now === 'countdown';
        if (playing) playedMs += 500;
        if (prev !== 'menu' && now === 'menu') {
            if (playedMs >= 15000) { const { p, a } = st(); a.since++; saveProg(p); setTimeout(() => maybeInterstitial(0), 900); }
            playedMs = 0;
        }
        prev = now;
    }, 500);

    A.debug = { st, eligible, maybeInterstitial, setSince: n => { const { p, a } = st(); a.since = n; saveProg(p); } };
    const hb = document.getElementById('btn-ad-home');
    if (hb) hb.addEventListener('click', async e => { e.stopPropagation(); hb.disabled = true; await A.watchCoins(); hb.disabled = false; A.refreshHome(); });
    window.Ads = A; A.refreshHome();
    // live countdown on the home button and the shop cards
    setInterval(() => {
        A.refreshHome();
        document.querySelectorAll('.ad-chip').forEach(b => {
            const kind = b.dataset.kind, left = A.left(kind), w = A.wait(kind), lb = b.querySelector('.ad-lbl');
            b.disabled = left <= 0 || w > 0; b.classList.toggle('cool', w > 0 && left > 0);
            if (lb) lb.textContent = left <= 0 ? 'Done' : w > 0 ? mmss(w) : (kind === 'coin' ? '+' + CFG.coin.amount : 'Free chest');
        });
    }, 1000);
})();
