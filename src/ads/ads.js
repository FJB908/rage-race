// ADS: interstitials at calm moments and opt-in rewarded ads. See docs/ADS.md.
// The web build uses a TEST provider (a fake ad screen). On Android, swap in AdMob with Ads.setProvider({ show }).
// show(kind) must resolve true when the ad was watched to the end ('rewarded') or shown ('interstitial').
(function () {
    'use strict';
    const CFG = {
        graceRaces: 4,                 // no interstitials for brand-new players
        everyMatches: 3,               // at most one interstitial per this many finished matches...
        minGapMs: 4 * 60 * 1000,       // ...and never more often than this
        coin:  { amount: 500, perDay: 5 },
        drop:  { perDay: 3 },
        cooldownMs: 20 * 1000,         // between two rewarded ads
    };
    const today = () => new Date().toISOString().slice(0, 10);
    const st = () => {
        const p = prog(), a = p.ads = Object.assign({ day:'', coin:0, drop:0, last:0, since:0 }, p.ads || {});
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
    A.wait = () => { const { a } = st(); return Math.max(0, Math.ceil((a.last + CFG.cooldownMs - Date.now()) / 1000)); };
    async function watch(kind) {
        if (A.busy) return false;
        if (A.left(kind) <= 0) { toast('No more ads today'); return false; }
        if (A.wait() > 0) { toast('Next ad in ' + A.wait() + ' s'); return false; }
        A.busy = true;
        let ok = false;
        try { ok = await provider.show('rewarded'); } catch (e) { ok = false; }
        A.busy = false;
        if (!ok) { toast('Ad not finished, no reward'); return false; }
        const { p, a } = st(); a[kind]++; a.last = Date.now(); saveProg(p);
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
        const left = A.left('coin'); b.hidden = left <= 0;
        setBadge(b, left);
    };
    A.renderShop = function (box) {
        const sec = document.createElement('div'); sec.className = 'ad-sec';
        const mk = (kind, title, sub, fn) => {
            const left = A.left(kind), b = document.createElement('button'); b.type = 'button'; b.className = 'ad-card'; b.disabled = left <= 0;
            b.innerHTML = '<span class="ad-ic">' + (kind === 'coin' ? icon('coin') : icon('drop')) + '</span><span class="ad-tx"><b>' + title + '</b><small>' + sub + '</small></span>' +
                '<span class="ad-go">' + (left > 0 ? 'WATCH' : 'DONE') + '</span><em>' + left + ' left today</em>';
            b.onclick = async () => { b.disabled = true; await fn(); renderResourceShop(); };
            return b;
        };
        A.refreshHome();
        sec.appendChild(mk('coin', '+' + CFG.coin.amount + ' coins', 'Watch a short video', A.watchCoins));
        sec.appendChild(mk('drop', 'Free supply drop', 'Watch a short video', A.watchDrop));
        box.prepend(sec);
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
})();
