// SOCIAL: friend codes, friend list, party lobby and same-track party races, all on Firestore (no game server).
// Needs cloud.js (Firebase handles). See docs/SOCIAL.md. Race positions are NOT streamed: everyone races the same seeded track
// at the same moment and the party board compares finish times. Live races need a game server later.
(function () {
    'use strict';
    const $ = id => document.getElementById(id);
    const ALPHA = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    const ONLINE_MS = 6 * 60 * 1000, INVITE_MS = 30 * 60 * 1000, PARTY_MAX = 4;
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
    const root = $('soc-root');
    if (!root) return;

    function fnv(str, seed) { let h = seed >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
    function codeFromUid(uid) {                     // stable 8-character friend code, shown as ABCD-EFGH
        let a = fnv(uid, 2166136261), b = fnv(uid, 0x9747b28c), out = '';
        for (let i = 0; i < 6; i++) { out += ALPHA[a & 31]; a >>>= 5; }
        for (let i = 0; i < 2; i++) { out += ALPHA[b & 31]; b >>>= 5; }
        return out;
    }
    const pretty = c => c.slice(0, 4) + '-' + c.slice(4);
    const clean = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

    const S = { api:null, uid:'', code:'', friends:new Map(), profiles:new Map(), invites:[], party:null, members:[], results:[], unsubs:[], partyUnsubs:[], lastToken:0, msg:'' };
    let lastPub = '';

    /* ---------------------------------------------------------------- helpers ---- */
    const fs = () => S.api.fb.fs, db = () => S.api.fb.db;
    const col = (...p) => fs().collection(db(), ...p), dref = (...p) => fs().doc(db(), ...p);
    function myLook() { const l = myLook_(); return { skin:l.skin, hat:l.hat, face:l.face, trail:l.trail }; }
    const myLook_ = () => window.myLook ? window.myLook() : prog();
    function publicProfile() {
        const p = prog(), L = levelInfo(p.xp), rk = (window.Ranked && Ranked.state) ? Ranked.state() : null;
        return { name:String(p.name || 'Player').slice(0, 16), code:S.code, look:myLook(), lvl:L.lvl, rk:rk && rk.placed ? rk.rank.label : '', tier:rk && rk.placed ? rk.rank.tier : -1 };
    }
    async function publish(force) {
        if (!S.api) return;
        const pp = publicProfile(), j = JSON.stringify(pp);
        if (!force && j === lastPub && Date.now() - (publish.t || 0) < 5 * 60 * 1000) return;
        lastPub = j; publish.t = Date.now();
        try { await fs().setDoc(dref('profiles', S.uid), Object.assign({}, pp, { seen:Date.now() })); } catch (e) { S.msg = 'Could not reach the server'; }
    }
    const fid = (a, b) => [a, b].sort().join('_');
    const say = m => { try { toast(m); } catch (e) {} };

    /* ------------------------------------------------------------ data loading ---- */
    async function loadProfile(uid, fresh) {
        const c = S.profiles.get(uid);
        if (c && !fresh && Date.now() - c.at < 60000) return c.d;
        try { const s = await fs().getDoc(dref('profiles', uid)); const d = s.exists() ? s.data() : { name:'Player', look:{}, lvl:1 }; S.profiles.set(uid, { d, at:Date.now() }); return d; }
        catch (e) { return c ? c.d : { name:'Player', look:{}, lvl:1 }; }
    }
    function stopAll() { S.unsubs.forEach(f => { try { f(); } catch (e) {} }); S.unsubs = []; stopParty(); }
    function startListeners() {
        stopAll();
        const f = fs();
        S.unsubs.push(f.onSnapshot(f.query(col('friendships'), f.where('members', 'array-contains', S.uid)), snap => {
            S.friends = new Map();
            snap.forEach(d => { const x = d.data(), other = x.members.find(m => m !== S.uid); if (other) S.friends.set(other, { fid:d.id, status:x.status, requester:x.requester }); });
            Promise.all([...S.friends.keys()].map(u => loadProfile(u))).then(render);
            render();
        }, () => {}));
        S.unsubs.push(f.onSnapshot(f.query(col('invites'), f.where('to', '==', S.uid)), snap => {
            S.invites = []; snap.forEach(d => { const x = d.data(); if (Date.now() - x.t < INVITE_MS) S.invites.push(Object.assign({ id:d.id }, x)); else f.deleteDoc(d.ref || dref('invites', d.id)).catch(() => {}); });
            render();
        }, () => {}));
    }

    /* ------------------------------------------------------------------ friends ---- */
    async function addByCode(raw) {
        const code = clean(raw);
        if (code.length !== 8) { say('Friend codes have 8 characters'); return; }
        if (code === S.code) { say('That is your own code'); return; }
        try {
            const f = fs(), q = await f.getDocs(f.query(col('profiles'), f.where('code', '==', code), f.limit(1)));
            if (q.empty) { say('No player with that code'); return; }
            const other = q.docs[0].id, id = fid(S.uid, other), cur = await f.getDoc(dref('friendships', id));
            if (cur.exists()) {
                const x = cur.data();
                if (x.status === 'accepted') { say('Already friends'); return; }
                if (x.requester === other) { await f.updateDoc(dref('friendships', id), { status:'accepted' }); say('Friend added'); return; }
                say('Request already sent'); return;
            }
            await f.setDoc(dref('friendships', id), { members:[S.uid, other].sort(), requester:S.uid, status:'pending', t:Date.now() });
            say('Request sent');
        } catch (e) { say('Could not add friend'); }
    }
    const answer = (id, ok) => (ok ? fs().updateDoc(dref('friendships', id), { status:'accepted' }) : fs().deleteDoc(dref('friendships', id))).catch(() => say('Failed, try again'));

    /* -------------------------------------------------------------------- party ---- */
    function stopParty() { S.partyUnsubs.forEach(f => { try { f(); } catch (e) {} }); S.partyUnsubs = []; S.party = null; S.members = []; S.results = []; }
    function watchParty(code) {
        const f = fs(); stopParty(); loadRt().catch(() => {});
        S.party = { code, host:'', status:'lobby', token:0, seed:0 };
        S.partyUnsubs.push(f.onSnapshot(dref('parties', code), snap => {
            if (!snap.exists()) { if (S.party) { say('Party closed'); stopParty(); closeBoard(); render(); } return; }
            const d = snap.data(); S.party = Object.assign({ code }, d);
            if (d.status === 'racing' && d.token && d.token !== S.lastToken && Date.now() - d.token < 60000 && !window.partyMatch) { S.lastToken = d.token; startRace(d); }
            if (d.status === 'lobby' && $('soc-board') && S.boardDone) closeBoard();
            render();
        }, () => {}));
        S.partyUnsubs.push(f.onSnapshot(col('parties', code, 'members'), snap => {
            S.members = []; snap.forEach(d => S.members.push(Object.assign({ uid:d.id }, d.data()))); S.members.sort((a, b) => a.joined - b.joined);
            if (S.party && S.members.length && !S.members.some(m => m.uid === S.uid)) { say('You were removed from the party'); stopParty(); render(); return; }
            render(); renderBoard();
        }, () => {}));
        S.partyUnsubs.push(f.onSnapshot(col('parties', code, 'results'), snap => {
            S.results = []; snap.forEach(d => S.results.push(Object.assign({ uid:d.id }, d.data()))); renderBoard();
        }, () => {}));
    }
    const memberDoc = () => Object.assign({ name:publicProfile().name, look:myLook(), joined:Date.now() });
    async function createParty() {
        if (S.party) return;
        const f = fs(); let code = '';
        for (let i = 0; i < 5; i++) { code = ''; for (let k = 0; k < 5; k++) code += ALPHA[Math.floor(Math.random() * 32)]; if (!(await f.getDoc(dref('parties', code))).exists()) break; }
        try {
            await f.setDoc(dref('parties', code), { host:S.uid, status:'lobby', seed:0, token:0, created:Date.now() });
            await f.setDoc(dref('parties', code, 'members', S.uid), memberDoc());
            watchParty(code);
        } catch (e) { say('Could not create a party'); }
    }
    async function joinParty(raw) {
        const code = clean(raw);
        if (code.length !== 5) { say('Party codes have 5 characters'); return; }
        const f = fs();
        try {
            const s = await f.getDoc(dref('parties', code));
            if (!s.exists() || s.data().status !== 'lobby') { say('Party not found or already racing'); return; }
            const m = await f.getDocs(col('parties', code, 'members'));
            if (m.size >= PARTY_MAX && !m.docs.some(d => d.id === S.uid)) { say('Party is full'); return; }
            await f.setDoc(dref('parties', code, 'members', S.uid), memberDoc());
            watchParty(code);
        } catch (e) { say('Could not join'); }
    }
    async function leaveParty() {
        const p = S.party; if (!p) return; const f = fs();
        try {
            if (p.host === S.uid) await f.deleteDoc(dref('parties', p.code)); else await f.deleteDoc(dref('parties', p.code, 'members', S.uid));
        } catch (e) {}
        stopParty(); closeBoard(); render();
    }
    async function invite(uid) {
        const p = S.party; if (!p) return;
        try { await fs().setDoc(dref('invites', uid + '_' + p.code), { from:S.uid, fromName:publicProfile().name, to:uid, code:p.code, t:Date.now() }); say('Invite sent'); } catch (e) { say('Could not invite'); }
    }
    async function kick(uid) { try { await fs().deleteDoc(dref('parties', S.party.code, 'members', uid)); } catch (e) {} }
    async function startParty() {
        const p = S.party; if (!p || p.host !== S.uid) return;
        const rt = await loadRt().catch(() => null);
        const startAt = rt ? Date.now() + rt.offset + 5000 : 0;                 // shared start moment on the Realtime Database clock
        try { await fs().updateDoc(dref('parties', p.code), { status:'racing', seed:(Math.random() * 4294967296) >>> 0, token:Date.now(), startAt, live:!!rt }); } catch (e) { say('Could not start'); }
    }

    /* --------------------------------------------------- live positions (Realtime Database) ---- */
    let RT = null, LIVE = null;
    async function loadRt() {
        if (RT) return RT;
        const m = await import(Cloud.sdk + 'firebase-database.js'), url = Cloud.config.databaseURL;
        const db = url ? m.getDatabase(S.api.fb.a, url) : m.getDatabase(S.api.fb.a);
        const r = { m, db, offset:0 };
        m.onValue(m.ref(db, '.info/serverTimeOffset'), s => { r.offset = s.val() || 0; });
        RT = r; return r;
    }
    function liveStart(d) {                          // after startGame(): turn friends' slots into remote players, start sending
        const rt = RT, m = rt.m, base = 'rooms/' + S.party.code + '/' + d.token + '/';
        const others = S.members.filter(x => x.uid !== S.uid).slice(0, 3);
        LIVE = { base, subs:[], timer:0, remotes:[], t0:Date.now() };
        others.forEach((mem, k) => {
            const p = players[k + 1]; if (!p) return;
            const look = Object.assign({ skin:'classic', hat:'none', face:'none', trail:'none' }, mem.look || {});
            p.remote = true; p.uid = mem.uid; p.name = mem.name; p.look = look; p.afk = false; p.botType = null;
            p.color = skinById(look.skin).color; p.samples = []; p.rkColor = null;
            LIVE.remotes.push(p);
            LIVE.subs.push(m.onValue(m.ref(rt.db, base + mem.uid), snap => {
                const v = snap.val();
                if (!v) { if (Date.now() - LIVE.t0 > 4000) p.left = true; return; }
                p.left = false; p.samples.push({ t:performance.now(), x:v.x, y:v.y, vy:v.vy || 0, f:v.f || 0 });
                if (p.samples.length > 20) p.samples.shift();
            }));
        });
        const mine = m.ref(rt.db, base + S.uid);
        try { m.onDisconnect(mine).remove(); } catch (e) {}
        LIVE.timer = setInterval(() => {
            const me = players[0]; if (!me) return;
            m.set(mine, { x:Math.round(me.x * 10) / 10, y:Math.round(me.y * 10) / 10, vy:Math.round(me.vy), f:me.finished ? me.finishTime : 0 }).catch(() => {});
            if (state === 'menu') liveStop();
        }, 100);
    }
    function liveStop() {
        if (!LIVE) return;
        clearInterval(LIVE.timer); LIVE.subs.forEach(f => { try { f(); } catch (e) {} });
        try { RT.m.remove(RT.m.ref(RT.db, LIVE.base + S.uid)); } catch (e) {}
        LIVE = null; window.partyMatch = null; window.RACE_BAND = undefined; window.matchBots = null;
        if (S.party && S.party.host === S.uid) fs().updateDoc(dref('parties', S.party.code), { status:'lobby' }).catch(() => {});
    }
    function stepRemote(p, dt) {                     // smooth the friend's 10 Hz samples, shown about 150 ms in the past
        if (p.finished) return;
        const s = p.samples;
        if (p.left && !p.finished) { p.finished = true; p.finishTime = 9999; finishedCount++; return; }
        if (!s || !s.length) return;
        const t = performance.now() - 150;
        let a = s[0], b = s[s.length - 1];
        for (let i = s.length - 1; i > 0; i--) if (s[i - 1].t <= t) { a = s[i - 1]; b = s[i]; break; }
        const k = b.t > a.t ? Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t))) : 1, px = p.x, py = p.y;
        p.x = a.x + (b.x - a.x) * k; p.y = a.y + (b.y - a.y) * k;
        p.vx = dt > 0 ? (p.x - px) / dt : 0; p.vy = dt > 0 ? (p.y - py) / dt : 0;
        p.mode = Math.abs(p.vy) > 40 ? 'air' : 'idle';
        if (p.y < p.best) p.best = p.y;
        const last = s[s.length - 1];
        if (last.f > 0 && !p.finished) { p.finished = true; p.finishTime = last.f; finishedCount++; p.x = last.x; p.y = last.y; if (typeof burst === 'function') burst(p.x, p.y, p.color, 24, 240); checkEnd(); }
    }

    /* ------------------------------------------------------------------- racing ---- */
    function startRace(d) {
        if (typeof state !== 'undefined' && state !== 'menu') return;
        S.boardDone = false;
        window.partyMatch = { code:S.party.code, token:d.token, seed:d.seed, n:S.members.length, live:!!(d.live && RT) };
        window.rankedMatch = false; window.RACE_BAND = 0;
        window.matchBots = window.BotRoster ? BotRoster.pick(3, { mmr:Math.max(1000, prog().rk.mmr), spread:160 }) : null;
        matchSeed = d.seed; matchLootId = newLootId('party'); matchBotNames = window.matchBots ? window.matchBots.map(b => b.name) : matchBotNames; matchHumanSlot = 0;
        const live = window.partyMatch.live, wait = live ? d.startAt - (Date.now() + RT.offset) - 2400 : 0;   // the game's countdown takes 2.4 s to GO
        const go = () => {
            if (typeof state !== 'undefined' && state !== 'menu') { window.partyMatch = null; return; }
            startGame(); if (live) liveStart(d);
        };
        if (wait > 0) { say('Race starts in ' + Math.ceil((wait + 2400) / 1000) + ' s'); setTimeout(go, wait); } else go();
    }
    async function onFinish(time, place) {                          // called by game.js when YOU cross the line
        const m = window.partyMatch; if (!m || !S.party) return;
        try { await fs().setDoc(dref('parties', m.code, 'results', S.uid), { token:m.token, time:+time.toFixed(2), place }); } catch (e) {}
        if (!m.live) setTimeout(openBoard, 1400);          // without live positions the party board replaces the normal results
    }
    function openBoard() {
        if ($('soc-board')) return;
        const el = document.createElement('div'); el.id = 'soc-board';
        el.innerHTML = '<div class="sb-card"><h2>Party race</h2><p>Same track, same start. Times update as friends finish.</p><div id="sb-rows"></div><button type="button" id="sb-done">DONE</button></div>';
        document.body.appendChild(el);
        $('sb-done').onclick = () => { closeBoard(); S.boardDone = true; window.partyMatch = null; window.RACE_BAND = undefined; window.matchBots = null; quitToMenu();
            if (S.party && S.party.host === S.uid) fs().updateDoc(dref('parties', S.party.code), { status:'lobby' }).catch(() => {}); };
        renderBoard();
    }
    function closeBoard() { const e = $('soc-board'); if (e) e.remove(); }
    function renderBoard() {
        const rows = $('sb-rows'); if (!rows || !S.party) return;
        const tok = S.party.token, list = S.members.map(m => ({ m, r:S.results.find(r => r.uid === m.uid && r.token === tok) }));
        list.sort((a, b) => (a.r && b.r) ? a.r.time - b.r.time : a.r ? -1 : b.r ? 1 : 0);
        rows.innerHTML = list.map((o, i) => '<div class="sb-row' + (o.m.uid === S.uid ? ' me' : '') + '"><b>' + (o.r ? (i + 1) : '') + '</b><span>' + esc(o.m.name) + '</span><em>' + (o.r ? o.r.time.toFixed(2) + ' s' : 'racing...') + '</em></div>').join('');
    }

    /* ------------------------------------------------------------------ rendering ---- */
    function avatar(look) { return '<canvas class="so-av" width="80" height="80" data-look="' + esc(JSON.stringify(look || {})) + '"></canvas>'; }
    function paintAvatars(scope) {
        scope.querySelectorAll('canvas.so-av').forEach(cv => { try { renderLook(cv, JSON.parse(cv.dataset.look || '{}'), { scale:0.27, cy:0.68 }); } catch (e) {} });
    }
    const online = d => d && d.seen && Date.now() - d.seen < ONLINE_MS;
    function render() {
        if (!S.api) return;
        const cardCode = $('soc-code');
        cardCode.innerHTML = '<small>YOUR FRIEND CODE</small><strong>' + pretty(S.code) + '</strong><span><button type="button" data-a="copy">COPY</button><button type="button" data-a="share">SHARE</button></span>';

        const inv = $('soc-inv');
        inv.innerHTML = S.invites.map(i => '<div class="so-banner"><span><b>' + esc(i.fromName) + '</b> invited you to a party</span><button type="button" data-a="join-inv" data-id="' + esc(i.id) + '" data-code="' + esc(i.code) + '">JOIN</button><button type="button" class="ghost" data-a="del-inv" data-id="' + esc(i.id) + '">X</button></div>').join('');

        const req = [...S.friends].filter(([, v]) => v.status === 'pending' && v.requester !== S.uid);
        $('soc-req').innerHTML = req.length ? '<h2 class="m-h2">REQUESTS</h2>' + req.map(([u, v]) => { const d = (S.profiles.get(u) || {}).d || {}; return '<div class="so-row">' + avatar(d.look) + '<span class="so-n"><b>' + esc(d.name || 'Player') + '</b><small>Lv ' + (d.lvl || 1) + '</small></span><button type="button" data-a="ok" data-id="' + v.fid + '">ACCEPT</button><button type="button" class="ghost" data-a="no" data-id="' + v.fid + '">X</button></div>'; }).join('') : '';

        const P = S.party, host = P && P.host === S.uid;
        let pc;
        if (!P) pc = '<div class="so-party-h"><b>Party</b></div><p class="so-p">Make a party and share the code. Everyone races the same track at the same time and compares times.</p><button type="button" class="so-big" data-a="create">CREATE PARTY</button>';
        else {
            const slots = [];
            for (let i = 0; i < PARTY_MAX; i++) {
                const m = S.members[i];
                slots.push(m ? '<div class="so-slot">' + avatar(m.look) + '<strong>' + esc(m.name) + '</strong><small>' + (m.uid === P.host ? 'HOST' : (host ? '<a data-a="kick" data-id="' + m.uid + '">REMOVE</a>' : '')) + '</small></div>' : '<div class="so-slot empty">Invite</div>');
            }
            pc = '<div class="so-party-h"><b>Your party</b><span>' + S.members.length + ' / ' + PARTY_MAX + '</span></div><div class="so-slots">' + slots.join('') + '</div>' +
                '<div class="so-pcode"><span>Party code</span><strong>' + esc(P.code) + '</strong></div>' +
                (host ? '<button type="button" class="so-big" data-a="start">START RACE</button>' : '<div class="so-wait">Waiting for the host to start</div>') +
                '<button type="button" class="so-link" data-a="leave">' + (host ? 'Close party' : 'Leave party') + '</button>';
        }
        $('soc-party').innerHTML = pc;

        const acc = [...S.friends].filter(([, v]) => v.status === 'accepted');
        const pend = [...S.friends].filter(([, v]) => v.status === 'pending' && v.requester === S.uid);
        acc.sort((a, b) => (online((S.profiles.get(b[0]) || {}).d) ? 1 : 0) - (online((S.profiles.get(a[0]) || {}).d) ? 1 : 0));
        $('soc-list').innerHTML = '<h2 class="m-h2">FRIENDS ' + acc.length + '</h2>' + (acc.length ? acc.map(([u, v]) => {
            const d = (S.profiles.get(u) || {}).d || {}, on = online(d), inParty = S.members.some(m => m.uid === u);
            return '<div class="so-row">' + avatar(d.look) + '<span class="so-n"><b><i class="dot' + (on ? ' on' : '') + '"></i>' + esc(d.name || 'Player') + '</b><small>Lv ' + (d.lvl || 1) + (d.rk ? ' · ' + esc(d.rk) : '') + '</small></span>' +
                (P && !inParty ? '<button type="button" data-a="invite" data-id="' + u + '">INVITE</button>' : '') + '<button type="button" class="ghost" data-a="rm" data-id="' + v.fid + '" title="Remove">...</button></div>';
        }).join('') : '<p class="so-p">No friends yet. Share your code or enter a friend\'s code above.</p>') +
            (pend.length ? '<p class="so-p">' + pend.length + ' request' + (pend.length > 1 ? 's' : '') + ' waiting for an answer</p>' : '');
        paintAvatars(root);
    }

    root.addEventListener('click', async e => {
        const t = e.target.closest('[data-a]'); if (!t || !S.api) return;
        const a = t.dataset.a, id = t.dataset.id;
        if (a === 'copy') { try { await navigator.clipboard.writeText(S.code); say('Code copied'); } catch (er) { say(pretty(S.code)); } }
        else if (a === 'share') { const text = 'Add me in Rage Race: ' + pretty(S.code); if (navigator.share) navigator.share({ text }).catch(() => {}); else { try { await navigator.clipboard.writeText(text); say('Copied'); } catch (er) {} } }
        else if (a === 'ok') answer(id, true); else if (a === 'no') answer(id, false);
        else if (a === 'create') createParty();
        else if (a === 'leave') leaveParty();
        else if (a === 'start') startParty();
        else if (a === 'invite') invite(id);
        else if (a === 'kick') kick(id);
        else if (a === 'join-inv') { await fs().deleteDoc(dref('invites', id)).catch(() => {}); joinParty(t.dataset.code); }
        else if (a === 'del-inv') fs().deleteDoc(dref('invites', id)).catch(() => {});
        else if (a === 'rm') { if (t.dataset.sure) answer(id, false); else { t.dataset.sure = '1'; t.textContent = 'REMOVE?'; setTimeout(() => { t.dataset.sure = ''; t.textContent = '...'; }, 2500); } }
    });
    $('soc-add-go').onclick = () => { const i = $('soc-add'); addByCode(i.value).then(() => { i.value = ''; }); };
    $('soc-join-go').onclick = () => { const i = $('soc-join'); joinParty(i.value).then(() => { i.value = ''; }); };

    /* ------------------------------------------------------------------ lifecycle ---- */
    function ensure() {
        const api = window.Cloud && Cloud.api && Cloud.api();
        const uid = api && api.user && api.user.uid;
        if (!uid) { root.classList.add('off'); $('soc-status').textContent = (window.Cloud && Cloud.status === 'offline') ? 'Offline. Friends need an internet connection.' : 'Connecting...'; return; }
        root.classList.remove('off');
        if (S.uid !== uid) { S.api = api; S.uid = uid; S.code = codeFromUid(uid); startListeners(); publish(true); }
        else S.api = api;
        $('soc-status').textContent = '';
    }
    setInterval(ensure, 1500);
    setInterval(() => { if (S.api && !document.hidden) { publish(); S.friends.forEach((v, u) => loadProfile(u, true).then(() => render())); } }, 5 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && S.api) publish(true); });
    ensure();

    window.Social = { stepRemote, touch:() => { clearTimeout(window.Social._t); window.Social._t = setTimeout(() => publish(), 20000); }, onPartyFinish:onFinish, state:S, codeFromUid };
})();
