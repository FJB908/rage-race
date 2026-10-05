// CLOUD SAVE: Firebase anonymous account + Firestore backup of all progress, optional Google sign-in.
// Offline-first: localStorage stays the source the game reads; this module mirrors it. See docs/CLOUD.md.
// Loaded after game.js. Everything fails soft: without network the game is unchanged.
(function () {
    'use strict';
    const FIREBASE_CONFIG = {
        apiKey: 'AIzaSyDLJoXxu5AiMRdQRU9mB_7TZ6TPCbta2r8',
        authDomain: 'rage-race.firebaseapp.com',
        projectId: 'rage-race',
        storageBucket: 'rage-race.firebasestorage.app',
        messagingSenderId: '889174064806',
        appId: '1:889174064806:web:735614767e97b65cd3fe67',
        databaseURL: 'https://rage-race-default-rtdb.europe-west1.firebasedatabase.app',   // Realtime Database (live party races)
    };
    const SDK = 'https://www.gstatic.com/firebasejs/10.14.1/';
    const META_KEY = 'rr_cloud_meta';
    const PUSH_DELAY = 5000;
    const NUM_KEYS = ['rr_coins', 'rr_gems', 'rr_esc_best_score', 'rr_pk_best', 'rr_tag_best', 'rr_tag_wins', 'rr_arc_wins'];     // higher is better, merged with max
    const TIME_KEY = 'rr_pk_best_time';                                              // lower is better, 0 = none
    const DIM_KEYS = ['rr_pk_levels_v1', 'rr_pk_levels_v2'];
    const FLAG_KEYS = ['rr_tutorial_done'];
    const MAX_FIELDS = ['xp', 'races', 'wins', 'passPoints', 'passPointsEarned', 'passEndClaimed', 'cosmeticPity', 'nameChanges'];

    /* ------------------------------------------------------------ local snapshot ---- */
    const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
    const lsSet = (k, v) => { try { if (v === null || v === undefined) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} };
    const parse = s => { try { return s ? JSON.parse(s) : null; } catch (e) { return null; } };
    const getMeta = () => Object.assign({ uid:'', synced:0, localTs:0, dirty:false, force:false }, parse(lsGet(META_KEY)) || {});
    const setMeta = m => lsSet(META_KEY, JSON.stringify(m));

    function snapshot() {
        const d = { profile:parse(lsGet('rr_profile')), nums:{}, time:+lsGet(TIME_KEY) || 0, dims:{}, flags:{} };
        NUM_KEYS.forEach(k => { d.nums[k] = +lsGet(k) || 0; });
        DIM_KEYS.forEach(k => { const v = parse(lsGet(k)); if (v) d.dims[k] = v; });
        FLAG_KEYS.forEach(k => { if (lsGet(k) === '1') d.flags[k] = 1; });
        return { v:1, ts:getMeta().localTs, d };
    }
    // a profile nobody has played on (the game creates one with the name "Player" on first start): it must never beat a real save
    function blank(p) {
        return !p || (!num(p.xp) && !num(p.races) && !num(p.passPointsEarned) && (p.owned || []).filter(x => x !== 'classic' && x !== 'none').length === 0 && !num((p.rk || {}).matches) && !num((p.gt || {}).runs));
    }
    function pristine(s) {
        return blank(s.d.profile) && !Object.values(s.d.nums).some(Boolean) && !s.d.time && !Object.keys(s.d.dims).length;
    }
    function applySnapshot(s) {
        lsSet('rr_profile', s.d.profile ? JSON.stringify(s.d.profile) : null);
        NUM_KEYS.forEach(k => lsSet(k, String(s.d.nums[k] || 0)));
        lsSet(TIME_KEY, s.d.time ? String(s.d.time) : null);
        DIM_KEYS.forEach(k => lsSet(k, s.d.dims[k] ? JSON.stringify(s.d.dims[k]) : null));
        FLAG_KEYS.forEach(k => lsSet(k, s.d.flags[k] ? '1' : null));
    }

    /* ----------------------------------------------------------------- merging ---- */
    const union = (a, b) => Array.from(new Set([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]));
    const num = v => Number.isFinite(+v) ? +v : 0;
    const rkScore = r => r ? num(r.season) * 1e6 + num(r.matches) : -1;
    function mergeRk(a, b) {
        if (!a || !b) return a || b;
        const win = rkScore(a) >= rkScore(b) ? a : b, lose = win === a ? b : a, out = Object.assign({}, lose, win);
        const bySeason = new Map();
        [...(a.seasons || []), ...(b.seasons || [])].forEach(e => { const o = bySeason.get(e.s); if (!o || num(e.m) > num(o.m)) bySeason.set(e.s, e); });
        out.seasons = Array.from(bySeason.values()).sort((x, y) => y.s - x.s).slice(0, 12);
        out.claimed = num(a.season) === num(b.season) ? union(a.claimed, b.claimed) : (win.claimed || []);
        out.lastPlayed = Math.max(num(a.lastPlayed), num(b.lastPlayed));
        out.matches = Math.max(num(a.matches), num(b.matches)); out.wins = Math.max(num(a.wins), num(b.wins));
        return out;
    }
    function mergeMiss(a, b) {                   // same day: best progress, claims stick; otherwise the later day wins
        if (!a || !b) return a || b;
        if (a.day !== b.day) return String(a.day) > String(b.day) ? a : b;
        const out = JSON.parse(JSON.stringify(a)); out.bonus = !!(a.bonus || b.bonus);
        (b.list || []).forEach(m => { const x = out.list.find(y => y.id === m.id); if (x) { x.n = Math.max(num(x.n), num(m.n)); x.claimed = !!(x.claimed || m.claimed); } });
        return out;
    }
    function mergeWeekly(a, b) {
        if (!a || !b) return a || b;
        if (a.wk !== b.wk) return String(a.wk) > String(b.wk) ? a : b;
        return a.id === b.id ? Object.assign({}, a, { n: Math.max(num(a.n), num(b.n)), claimed: !!(a.claimed || b.claimed) }) : a;
    }
    function mergeProfile(a, b, aNewer) {
        if (!a || !b) return a || b;
        const nw = aNewer ? a : b, od = aNewer ? b : a, o = Object.assign({}, od, nw);   // newer wins: name, equipped, unknown fields
        const dflt = n => !n || n === 'Player';                                            // never let the default name replace a chosen one
        if (dflt(o.name) && !dflt(od.name)) o.name = od.name;
        MAX_FIELDS.forEach(k => { o[k] = Math.max(num(a[k]), num(b[k])); });
        o.passClaimed = union(a.passClaimed, b.passClaimed); o.lvClaimed = union(a.lvClaimed, b.lvClaimed); o.rageClaimed = union(a.rageClaimed, b.rageClaimed); o.setsClaimed = union(a.setsClaimed, b.setsClaimed); o.missions = mergeMiss(a.missions, b.missions); o.weekly = mergeWeekly(a.weekly, b.weekly); o.rage = !!(a.rage || b.rage); o.emotes = union(a.emotes, b.emotes); o.owned = union(a.owned, b.owned);
        o.lootGrants = Object.assign({}, od.lootGrants, nw.lootGrants);          // ids that were already granted: never grant twice
        { const done = Object.assign({}, a.lootGrants, b.lootGrants); o.pendingDrops = Object.assign({}, od.pendingDrops, nw.pendingDrops); for (const id in o.pendingDrops) if (done[id]) delete o.pendingDrops[id]; }   // chests not opened yet are kept from both sides
        const ga = a.gt || {}, gb = b.gt || {}; o.gt = Object.assign({}, od.gt, nw.gt);
        ['runs', 'wins', 'best', 'keys'].forEach(k => { o.gt[k] = Math.max(num(ga[k]), num(gb[k])); });
        o.gt.crowned = !!(ga.crowned || gb.crowned);
        const sa = a.streak || {}, sb = b.streak || {};
        o.streak = String(sa.last || '') > String(sb.last || '') || (sa.last === sb.last && num(sa.n) >= num(sb.n)) ? sa : sb;
        o.rk = mergeRk(a.rk, b.rk);
        return o;
    }
    function mergeDim(a, b) {
        if (!a || !b) return a || b;
        const n = Math.max((a.stars || []).length, (b.stars || []).length), out = Object.assign({}, a, b), stars = [], best = [];
        for (let i = 0; i < n; i++) {
            stars.push(Math.max(num((a.stars || [])[i]), num((b.stars || [])[i])));
            const x = num((a.best || [])[i]), y = num((b.best || [])[i]);
            best.push(x && y ? Math.min(x, y) : (x || y));
        }
        out.stars = stars; out.best = best;
        const sk = []; for (let i = 0; i < n; i++) sk.push(!!(((a.skipped || [])[i]) || ((b.skipped || [])[i]))); out.skipped = sk; return out;
    }
    function merge(a, b) {                       // a, b: snapshots; the result keeps the best of both
        const aNewer = a.ts >= b.ts, pNewer = blank(a.d.profile) ? false : blank(b.d.profile) ? true : aNewer, out = { v:1, ts:Math.max(a.ts, b.ts), d:{ nums:{}, dims:{}, flags:{} } };
        out.d.profile = mergeProfile(a.d.profile, b.d.profile, pNewer);
        NUM_KEYS.forEach(k => { out.d.nums[k] = Math.max(num(a.d.nums[k]), num(b.d.nums[k])); });
        const ta = num(a.d.time), tb = num(b.d.time); out.d.time = ta && tb ? Math.min(ta, tb) : (ta || tb);
        DIM_KEYS.forEach(k => { const m = mergeDim(a.d.dims[k], b.d.dims[k]); if (m) out.d.dims[k] = m; });
        FLAG_KEYS.forEach(k => { if (a.d.flags[k] || b.d.flags[k]) out.d.flags[k] = 1; });
        return out;
    }

    /* ------------------------------------------------------------------- state ---- */
    const C = { status:'off', email:'', anon:true, last:0, listeners:[] };
    let fb = null, user = null, ready = false, busy = false, timer = 0, reloadWait = 0;
    const emit = (status) => { if (status) C.status = status; C.listeners.forEach(f => { try { f(C); } catch (e) {} }); };

    function touch() {                           // called by saveProg / store / dimSave after a local change
        const m = getMeta(); m.dirty = true; m.localTs = Date.now(); setMeta(m);
        if (ready) { clearTimeout(timer); timer = setTimeout(push, PUSH_DELAY); }
        if (window.Social) Social.touch();
    }

    async function loadSdk() {
        const [app, auth, fs] = await Promise.all([import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js'), import(SDK + 'firebase-firestore.js')]);
        const a = app.initializeApp(FIREBASE_CONFIG);
        fb = { app, auth, fs, a, au:auth.getAuth(a), db:fs.getFirestore(a) };
    }
    const docRef = () => fb.fs.doc(fb.db, 'users', user.uid);

    async function write(snap, meta) {
        const p = snap.d.profile || {}, rk = p.rk || {};
        const ts = Date.now(); snap.ts = ts;
        await fb.fs.setDoc(docRef(), { v:1, ts, blob:JSON.stringify(snap), name:String(p.name || 'Player').slice(0, 16), xp:num(p.xp), mmr:num(rk.mmr), rp:num(rk.rp), season:num(rk.season), updatedAt:fb.fs.serverTimestamp() });
        meta.uid = user.uid; meta.synced = ts; meta.localTs = ts; meta.dirty = false; meta.force = false; setMeta(meta);
        C.last = ts;
    }

    async function reconcile() {
        const meta = getMeta(), local = snapshot();
        const rs = await fb.fs.getDoc(docRef());
        if (!rs.exists()) {
            if (!pristine(local)) await write(local, meta);
            else { meta.uid = user.uid; setMeta(meta); }
            return false;
        }
        const rd = rs.data(), remote = parse(rd.blob);
        if (!remote || !remote.d) { if (!pristine(local)) await write(local, meta); return false; }
        // Another account than the one this phone last synced with (you signed in to a different one): take ITS save exactly as it is.
        // Mixing the previous account in is what used to leave you with the old name, loadout and cosmetics. A copy of what was on the phone is kept just in case.
        if (meta.uid && meta.uid !== user.uid) {
            if (!pristine(local)) lsSet('rr_prev_account', JSON.stringify({ uid:meta.uid, at:Date.now(), snap:local }));
            applySnapshot(remote);
            if (!blank(remote.d.profile)) { lsSet('rr_onboarded', '1'); lsSet('rr_acct_choice', 'google'); }
            meta.uid = user.uid; meta.synced = rd.ts; meta.localTs = remote.ts; meta.dirty = false; meta.force = false; setMeta(meta); C.last = rd.ts;
            return true;
        }
        if (meta.force) { await write(local, meta); return false; }                  // a reset on this device wins
        if (meta.uid === user.uid && meta.synced === rd.ts) {                         // cloud unchanged since our last sync
            if (meta.dirty) await write(local, meta);
            return false;
        }
        const merged = pristine(local) ? remote : merge(local, remote);
        if (pristine(local) && merged.d.profile && local.d.profile && local.d.profile.name && local.d.profile.name !== 'Player' && (!merged.d.profile.name || merged.d.profile.name === 'Player')) merged.d.profile.name = local.d.profile.name;
        const changed = JSON.stringify(merged.d) !== JSON.stringify(local.d);
        if (changed) applySnapshot(merged);
        const needPush = JSON.stringify(merged.d) !== JSON.stringify(remote.d);
        meta.uid = user.uid;
        if (needPush) await write(merged, meta); else { meta.synced = rd.ts; meta.localTs = remote.ts; meta.dirty = false; setMeta(meta); C.last = rd.ts; }
        return changed;
    }

    function reloadWhenIdle() {                  // memory still holds the old values: restart from the menu once
        clearInterval(reloadWait);
        let tries = 0;
        reloadWait = setInterval(() => {
            const idle = typeof state !== 'undefined' && state === 'menu';
            if (idle || ++tries > 600) {
                clearInterval(reloadWait);
                let n = 0; try { n = +sessionStorage.getItem('rr_cloud_reload') || 0; sessionStorage.setItem('rr_cloud_reload', String(n + 1)); } catch (e) {}
                if (idle && n < 2) location.reload();
            }
        }, 1000);
    }

    async function sync() {
        if (!user || busy) return;
        busy = true; emit('syncing');
        try {
            const changed = await reconcile();
            ready = true; emit('ok');
            if (changed) { try { toast('Cloud progress loaded'); } catch (e) {} reloadWhenIdle(); }
            else if (getMeta().dirty) timer = setTimeout(push, PUSH_DELAY);
        } catch (e) { emit(navigator.onLine === false ? 'offline' : 'error'); C.error = String(e && e.code || e); }
        busy = false;
    }
    async function push() {
        if (!ready || !user || busy || deleting) return;
        const meta = getMeta(); if (!meta.dirty && !meta.force) return;
        busy = true; emit('syncing');
        try {
            if (!meta.force) {
                const rs = await fb.fs.getDoc(docRef());
                if (rs.exists() && rs.data().ts !== meta.synced) { busy = false; ready = false; return sync(); }   // changed elsewhere: merge first
            }
            await write(snapshot(), meta); emit('ok');
        } catch (e) { emit(navigator.onLine === false ? 'offline' : 'error'); C.error = String(e && e.code || e); }
        busy = false;
    }

    /* --------------------------------------------------------------- public API ---- */
    // Inside the Android app the web pop-up cannot work (it redirects to a blank page), so Google sign-in is done natively
    // (plugin @capacitor-firebase/authentication, see docs/ANDROID.md) and the resulting token is handed to the web SDK.
    const nativeApp = () => { const c = window.Capacitor; return !!(c && c.isNativePlatform && c.isNativePlatform()); };
    async function nativeGoogleCredential() {
        const FA = window.Capacitor.Plugins && window.Capacitor.Plugins.FirebaseAuthentication;
        if (!FA) throw new Error('native-auth-missing');
        let r;
        try { r = await FA.signInWithGoogle({ skipNativeAuth: true, useCredentialManager: false }); }       // the classic Google account picker: more forgiving than the newer Credential Manager
        catch (e) { if (/cancel/i.test(String(e && (e.message || e.code || e)))) throw e; r = await FA.signInWithGoogle({ skipNativeAuth: true }); }
        const idToken = r && r.credential && r.credential.idToken;
        if (!idToken) throw new Error('no-token');
        return fb.auth.GoogleAuthProvider.credential(idToken);
    }
    async function signInGoogle() {
        if (!fb || !user) throw new Error('not-ready');
        const provider = new fb.auth.GoogleAuthProvider();
        let nativeCred = null;
        try {
            if (!user.isAnonymous) return;
            if (nativeApp()) { nativeCred = await nativeGoogleCredential(); await fb.auth.linkWithCredential(user, nativeCred); }
            else await fb.auth.linkWithPopup(user, provider);                      // keeps this account and its data
        } catch (e) {
            if (e && e.code === 'auth/credential-already-in-use') {                // this Google account already has a save: switch to it and merge
                const cred = nativeCred || e.credential || fb.auth.GoogleAuthProvider.credentialFromError(e);
                if (!cred) throw e;
                ready = false; await fb.auth.signInWithCredential(fb.au, cred); return;
            }
            throw e;
        }
        user = fb.au.currentUser; C.email = user.email || ''; C.anon = false; emit('ok'); ready = true; touch(); push();
    }
    // Delete the account for good (Google Play requires this): the cloud save, the public profile, friendships, the sign-in itself, then this device.
    let deleting = false;
    async function deleteAccount() {
        if (!fb || !user) throw new Error('not-ready');
        deleting = true; clearTimeout(timer); ready = false;
        const f = fb.fs, uid = user.uid;
        try {
            if (!user.isAnonymous) {                                               // a recent sign-in is needed to delete a real account
                try { if (nativeApp()) await fb.auth.reauthenticateWithCredential(user, await nativeGoogleCredential()); else await fb.auth.reauthenticateWithPopup(user, new fb.auth.GoogleAuthProvider()); } catch (e) { deleting = false; throw e; }
            }
            try { const q = f.query(f.collection(fb.db, 'friendships'), f.where('members', 'array-contains', uid)); const snap = await f.getDocs(q); await Promise.all(snap.docs.map(d => f.deleteDoc(d.ref))); } catch (e) {}
            await Promise.all(['users', 'profiles', 'ranked'].map(c => f.deleteDoc(f.doc(fb.db, c, uid)).catch(() => {})));
            await fb.auth.deleteUser(user);
        } catch (e) { deleting = false; throw e; }
        const keys = []; try { for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i)); } catch (e) {}
        keys.filter(k => k && k.startsWith('rr_')).forEach(k => { try { localStorage.removeItem(k); } catch (e) {} });
        location.reload();
    }
    // Callable Cloud Functions (europe-west1). The SDK is only loaded when something calls one.
    let fnMod = null, fnApi = null;
    async function call(name, data) {
        if (!fb || !user) throw new Error('not-ready');
        if (!fnMod) { fnMod = await import(SDK + 'firebase-functions.js'); fnApi = fnMod.getFunctions(fb.a, 'europe-west1'); }
        return (await fnMod.httpsCallable(fnApi, name)(data)).data;
    }
    // Sign out: everything must be in the cloud first, then this phone is cleared so the next account never inherits it.
    const KEEP_KEYS = ['rr_mute', 'rr_sfxvol', 'rr_musvol', 'rr_music', 'rr_haptics'];
    async function signOut() {
        if (!fb || !user) throw new Error('not-ready');
        if (user.isAnonymous) throw new Error('anonymous');
        const m = getMeta();
        if (m.dirty || m.force) { clearTimeout(timer); ready = true; await push(); if (getMeta().dirty) throw new Error('sync-failed'); }
        const keys = []; try { for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i)); } catch (e) {}
        keys.filter(k => k && k.startsWith('rr_') && !KEEP_KEYS.includes(k)).forEach(k => lsSet(k, null));
        await fb.auth.signOut(fb.au);
        location.reload();
    }
    function afterReset() {                      // Settings > Reset: the empty state must replace the cloud copy too
        const m = getMeta(); m.force = true; m.dirty = true; m.localTs = Date.now(); setMeta(m);
        if (ready) push();
    }

    async function boot() {
        try {
            await loadSdk();
            fb.auth.onAuthStateChanged(fb.au, u => {
                if (!u) { fb.auth.signInAnonymously(fb.au).catch(e => { emit('error'); C.error = String(e.code || e); }); return; }
                user = u; C.email = u.email || ''; C.anon = u.isAnonymous; ready = false; sync();
            });
        } catch (e) { emit('offline'); }
    }

    Object.assign(C, {
        config: FIREBASE_CONFIG, sdk: SDK,
        touch, afterReset, signOut, deleteAccount, call, api: () => (fb && user) ? { fb, user } : null, signInGoogle, sync: () => { ready = false; return sync(); },
        on: f => C.listeners.push(f),
        _merge:merge, _snapshot:snapshot,
        _test:{ reconcile:(fbMock, u) => { fb = fbMock; user = u; return reconcile(); } },      // unit tests only
    });
    window.Cloud = C;
    document.addEventListener('visibilitychange', () => { if (document.hidden) { clearTimeout(timer); push(); } });
    window.addEventListener('online', () => { if (user) { ready = false; sync(); } });
    boot();
})();
