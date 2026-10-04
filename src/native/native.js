// NATIVE BRIDGE: only does anything inside the Android app (Capacitor). In a browser this file is a no-op.
//   - AdMob:   replaces the test ad screen with real interstitial + rewarded ads (Ads.setProvider)
//   - Billing: Google Play Billing for the gem packs (window.GEM_STORE, used by the shop)
//   - Back button: the Android back button pauses / goes back / minimises like a native app
// Fill in the ids in NATIVE_CFG (see docs/ANDROID.md). Everything below uses Google's TEST ids until `live` is true.
(function () {
    'use strict';
    const cap = window.Capacitor;
    if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return;
    document.documentElement.classList.add('native-app');

    const NATIVE_CFG = {
        live: false,                                                          // true = real ads (use your own ids below!)
        admob: {
            rewarded:     'ca-app-pub-3940256099942544/5224354917',           // Google test ids; replace with yours
            interstitial: 'ca-app-pub-3940256099942544/1033173712',
        },
        // Play Console in-app products (type: consumable). The product id must equal the pack id from src/data/gems.js
        products: ['g80', 'g500', 'g1100', 'g2400', 'g6500', 'g14000'],
    };
    const P = cap.Plugins || {};

    /* ------------------------------------------------------------------------------ AdMob ---- */
    const AdMob = P.AdMob;
    if (AdMob && window.Ads && Ads.setProvider) {
        let ready = null;
        const init = () => ready || (ready = (async () => {
            try {
                const info = await AdMob.requestConsentInfo();                                    // EU consent (GDPR) before the first ad
                if (info && info.isConsentFormAvailable && info.status === 'REQUIRED') await AdMob.showConsentForm();
            } catch (e) {}
            try { await AdMob.initialize({ initializeForTesting: !NATIVE_CFG.live }); } catch (e) {}
        })());
        const once = (event, fn) => new Promise(res => { let h; AdMob.addListener(event, a => { try { h && h.remove && h.remove(); } catch (e) {} res(fn ? fn(a) : a); }).then(x => { h = x; }); });
        window.Ads.setProvider({
            name: 'admob',
            async show(kind) {
                await init();
                try {
                    if (kind === 'rewarded') {
                        await AdMob.prepareRewardVideoAd({ adId: NATIVE_CFG.admob.rewarded, isTesting: !NATIVE_CFG.live });
                        let rewarded = false;
                        once('onRewardedVideoAdReward', () => { rewarded = true; });
                        const closed = once('onRewardedVideoAdDismissed');
                        await AdMob.showRewardVideoAd();
                        await closed;
                        for (let i = 0; i < 12 && !rewarded; i++) await new Promise(r => setTimeout(r, 150));      // the reward event can land just after the ad closes
                        return rewarded;
                    }
                    await AdMob.prepareInterstitial({ adId: NATIVE_CFG.admob.interstitial, isTesting: !NATIVE_CFG.live });
                    const closed = once('onInterstitialAdDismissed');
                    await AdMob.showInterstitial();
                    await closed;
                    return true;
                } catch (e) { return false; }
            },
        });
    }

    /* ------------------------------------------------------------------------------ Billing ---- */
    // cordova-plugin-purchase exposes the global CdvPurchase once the device is ready.
    const packs = () => (typeof GEM_PACKS !== 'undefined' ? GEM_PACKS : []);
    function setupBilling() {
        const CP = window.CdvPurchase; if (!CP || !CP.store) return;
        const { store, ProductType, Platform } = CP, GP = Platform.GOOGLE_PLAY, waiting = {};
        store.register(NATIVE_CFG.products.map(id => ({ id, type: ProductType.CONSUMABLE, platform: GP })));
        // TODO before a serious launch: verify purchases on your server (store.validator) so nobody can fake a purchase.
        store.when().approved(tx => {
            const id = tx.products[0] && tx.products[0].id, pack = packs().find(p => p.id === id);
            if (pack) { if (waiting[id]) { try { waiting[id](pack.gems); } catch (e) {} } else if (window.addGems) window.addGems(pack.gems); }      // shop callback grants them; a restored/late purchase is granted here
            delete waiting[id]; tx.finish();
        });
        store.initialize([GP]).then(() => {
            for (const pack of packs()) { const pr = store.get(pack.id, GP); const o = pr && pr.pricing; if (o && o.price) pack.price = o.price; }       // real, localised prices
        });
        window.GEM_STORE = {
            buy(pack, grant) {
                const pr = store.get(pack.id, GP), offer = pr && pr.getOffer();
                if (!offer) { try { toast('Store not ready yet'); } catch (e) {} return; }
                waiting[pack.id] = grant;
                store.order(offer).then(err => { if (err) { delete waiting[pack.id]; if (err.code !== CP.ErrorCode.PAYMENT_CANCELLED) { try { toast('Purchase failed'); } catch (e) {} } } });
            },
        };
    }
    document.addEventListener('deviceready', setupBilling, false);
    if (window.CdvPurchase) setupBilling();

    /* ------------------------------------------------------------------- Android back button ---- */
    const App = P.App;
    // The app leaves the screen (home button, another app, screen off): silence the music, and pause a race in progress.
    if (App && App.addListener) App.addListener('appStateChange', st => {
        if (!st || st.isActive) { try { if (window.SFX) SFX.unlock(); } catch (e) {} return; }
        try { if (window.SFX) SFX.suspend(); } catch (e) {}
        try { if (typeof state !== 'undefined' && (state === 'playing' || state === 'countdown')) { const b = document.getElementById('btn-pause'); if (b) b.click(); } } catch (e) {}
    });
    if (App && App.addListener) App.addListener('backButton', () => {
        const click = id => { const e = document.getElementById(id); if (e) e.click(); };
        if (window.lootboxOpen || document.getElementById('lootbox')) return;                // chest screens close themselves
        if (typeof state !== 'undefined' && (state === 'playing' || state === 'countdown')) return click('btn-pause');
        if (typeof state !== 'undefined' && state === 'paused') { const r = document.querySelector('#s-pause .btn, #pause .btn'); return r && r.click(); }
        const open = document.querySelector('#s-start .m-tab.on'), tab = open && open.dataset.tab;
        if (tab && tab !== 'home' && typeof menuTab === 'function') return menuTab('home');
        if (typeof state !== 'undefined' && state === 'menu' && tab === 'home') return App.minimizeApp && App.minimizeApp();
        const back = document.querySelector('.screen.active .pass-back, #set-close, #btn-pass-back'); if (back) back.click();
    });
})();
