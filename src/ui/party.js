// PARTY on the home screen: your friends stand next to you (up to 4), a plus invites more, the leader starts the match.
// The data and the network live in src/social/social.js (Firestore + Realtime Database); this file is only the home UI and the PLAY rules.
// Quick race: the leader starts a synced race for everyone. Gauntlet: the leader plays and the members join as stand-ins until Gauntlet runs on a game server.
// A race with ONLY lobby members (4 of 4) pays no rewards. See docs/PARTY.md.
(function () {
    'use strict';
    const MAX = 4, $ = id => document.getElementById(id);
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
    const row = $('pt-row'), stage = row && row.parentNode;
    if (!row) return;
    const S = () => (window.Social && Social.state) || { party:null, members:[], invites:[], uid:'' };
    const sheet = { el:null, kind:'' };
    const invited = new Set();
    const SIZE = { 1:150, 2:116, 3:80, 4:72 };                  // visible character width per party size; the canvas is bigger so crowns and wings never crop

    function members() {                                        // you first, then the others in join order
        const s = S(), list = s.party ? s.members.filter(m => m.uid !== s.uid) : [];
        const me = { uid:s.uid || 'me', name:(prog().name || 'You'), lvl:levelInfo(prog().xp).lvl, look:window.myLook ? myLook() : {}, me:true, host:!s.party || s.party.host === s.uid };
        return [me].concat(list.map(m => Object.assign({ host:s.party && s.party.host === m.uid }, m))).slice(0, MAX);
    }
    const inParty = () => members().length > 1;
    // the mode the party plays: the leader's choice (Quick race or Gauntlet), stored on the party so everyone sees it
    const myMode = () => { const m = prog().lastMode; return m === 'gauntlet' ? 'gauntlet' : (!m || m === 'race') ? 'race' : 'other'; };
    const mode = () => { const s = S(); return (s.party && s.party.host !== s.uid && s.party.mode) ? s.party.mode : myMode(); };
    function setMode(m) {
        if (!isHost()) { toast('Only the party leader picks the mode'); return; }
        const q = prog(); q.lastMode = m; saveProg(q); refreshMenu(); render(); syncMode();
    }
    function syncMode() { const s = S(); if (s.party && s.party.host === s.uid && s.party.mode !== myMode() && myMode() !== 'other' && window.Social) { s.party.mode = myMode(); Social.setMode(myMode()); } }
    const isHost = () => { const s = S(); return !s.party || s.party.host === s.uid; };

    function paint(cv, look) {
        const key = JSON.stringify(look); if (cv._lk === key) return; cv._lk = key;
        const W = cv.width, base = W * 0.86;
        try { renderLook(cv, look, { scale:.22 * base / W, cy:((W - base) / 2 + .62 * base) / W }); } catch (e) {}
    }
    let sig = '';
    function render() {
        const list = members(), n = list.length, w = SIZE[n] || 72, s = S();
        const hero = $('m-hero');
        const key = JSON.stringify([mode(), n, list.map(m => [m.uid, m.name, m.host, m.lvl]), !!s.party, s.invites.map(i => i.id)]);
        stage.style.setProperty('--pw', w + 'px'); stage.style.setProperty('--n', n); stage.classList.toggle('party', n > 1);
        if (key !== sig) {
            sig = key;
            const keep = hero; row.innerHTML = '';
            list.forEach((m, i) => {
                const slot = document.createElement('div'); slot.className = 'pt-slot' + (m.me ? ' me' : ''); slot.dataset.i = i;
                let cv;
                if (m.me) cv = keep; else { cv = document.createElement('canvas'); cv.width = 280; cv.height = 280; cv.className = 'pt-c'; }
                slot.appendChild(cv);
                if (n > 1) slot.insertAdjacentHTML('beforeend', '<span class="pt-name">' + (m.host ? '<i class="pt-crown">&#9818;</i>' : '') + esc(m.me ? 'YOU' : m.name) + '</span><span class="pt-lv">' + (m.lvl ? 'LV ' + m.lvl : '') + '</span>');
                slot.insertAdjacentHTML('beforeend', '<span class="pt-sh"></span>');
                row.appendChild(slot);
            });
            if (n < MAX) { const b = document.createElement('button'); b.type = 'button'; b.className = 'pt-plus'; b.setAttribute('aria-label', 'Invite a friend'); b.innerHTML = '<span>+</span>'; row.appendChild(b); }
            $('pt-bar').hidden = !s.party || n < 2;
            if (!$('pt-bar').hidden) $('pt-bar').innerHTML = '<b>PARTY ' + n + '/' + MAX + '</b>' + ['race', 'gauntlet'].map(k => '<button type="button" class="pt-mode' + (mode() === k ? ' on' : '') + '" data-a="mode" data-m="' + k + '">' + (k === 'race' ? 'RACE' : 'GAUNTLET') + '</button>').join('') + '<button type="button" data-a="leave">LEAVE</button>';
            renderInvites();
        }
        row.querySelectorAll('.pt-slot').forEach(slot => { const m = list[+slot.dataset.i]; if (m && !m.me) paint(slot.querySelector('canvas'), m.look || {}); });
    }
    function renderInvites() {
        const s = S(), box = $('pt-inv'); if (!box) return;
        box.innerHTML = s.party ? '' : s.invites.map(i => '<div class="pt-invite"><span><b>' + esc(i.fromName) + '</b> invites you</span><button type="button" data-a="join" data-id="' + esc(i.id) + '">JOIN</button><button type="button" class="x" data-a="no" data-id="' + esc(i.id) + '">&times;</button></div>').join('');
    }

    /* ---------------------------------------------------------------- sheets ---- */
    function closeSheet() { if (sheet.el) { sheet.el.remove(); sheet.el = null; sheet.kind = ''; } }
    function openSheet(kind, html) {
        closeSheet();
        const el = document.createElement('div'); el.className = 'pt-sheet'; el.innerHTML = '<div class="pt-card"><button type="button" class="pt-close" data-a="close" aria-label="Close">&times;</button>' + html + '</div>';
        el.addEventListener('click', onSheet); document.body.appendChild(el); sheet.el = el; sheet.kind = kind;
        requestAnimationFrame(() => el.classList.add('in'));
        el.querySelectorAll('canvas[data-look]').forEach(cv => { try { renderLook(cv, JSON.parse(cv.dataset.look || '{}'), { scale:.27, cy:.68 }); } catch (e) {} });
    }
    function inviteSheet() {
        if (!window.Social || !Social.ready()) { openSheet('inv', '<h2>Play with friends</h2><p class="pt-p">Sign in with Google (Profile) and add friends with their friend code. Then invite them here.</p>'); return; }
        const s = S();
        if (!s.party) { Social.createParty(); }
        const fr = Social.friendList(), code = s.party ? s.party.code : '';
        openSheet('inv', '<h2>Invite friends</h2>' +
            (code ? '<div class="pt-code"><small>PARTY CODE</small><strong>' + esc(code) + '</strong><span><button type="button" data-a="copy">COPY</button><button type="button" data-a="share">SHARE</button></span></div>' : '<p class="pt-p">Making your party...</p>') +
            '<div class="pt-list">' + (fr.length ? fr.map(f => '<div class="pt-fr"><canvas width="80" height="80" data-look="' + esc(JSON.stringify(f.look)) + '"></canvas><span><b>' + esc(f.name) + '</b><small><i class="dot' + (f.online ? ' on' : '') + '"></i>' + (f.online ? 'Online' : 'Offline') + ' · Lv ' + f.lvl + '</small></span>' +
                (f.inParty ? '<em>In party</em>' : '<button type="button" data-a="invite" data-id="' + esc(f.uid) + '"' + (invited.has(f.uid) ? ' disabled>INVITED' : '>INVITE') + '</button>') + '</div>').join('') : '<p class="pt-p">No friends yet. Add them in the Friends tab with their friend code.</p>') + '</div>' +
            '<div class="pt-join"><input id="pt-code-in" maxlength="8" placeholder="Join with a party code" autocapitalize="characters" autocomplete="off"><button type="button" data-a="join-code">JOIN</button></div>');
    }
    function memberSheet(m) {
        const lead = isHost();
        openSheet('mem', '<div class="pt-mem"><canvas width="80" height="80" data-look="' + esc(JSON.stringify(m.look || {})) + '"></canvas><h2>' + esc(m.name) + '</h2><p class="pt-p">' + (m.lvl ? 'Level ' + m.lvl + ' · ' : '') + (m.host ? 'Party leader' : 'Party member') + '</p></div>' +
            (lead && !m.me && !m.host ? '<button type="button" class="pt-btn bad" data-a="kick" data-id="' + esc(m.uid) + '">REMOVE FROM PARTY</button>' : '') +
            (m.me ? '<button type="button" class="pt-btn bad" data-a="leave">' + (lead ? 'CLOSE PARTY' : 'LEAVE PARTY') + '</button>' : ''));
    }
    async function onSheet(e) {
        const t = e.target.closest('[data-a]'); if (!t) { if (e.target === sheet.el) closeSheet(); return; }
        const a = t.dataset.a, id = t.dataset.id, s = S();
        if (a === 'close') closeSheet();
        else if (a === 'invite') { invited.add(id); t.disabled = true; t.textContent = 'INVITED'; Social.invite(id); }
        else if (a === 'copy' && s.party) { try { await navigator.clipboard.writeText(s.party.code); toast('Code copied'); } catch (er) { toast(s.party.code); } }
        else if (a === 'share' && s.party) { const text = 'Join my Rage Race party: ' + s.party.code; if (navigator.share) navigator.share({ text }).catch(() => {}); else { try { await navigator.clipboard.writeText(text); toast('Copied'); } catch (er) {} } }
        else if (a === 'join-code') { const v = ($('pt-code-in') || {}).value; if (v) { if (s.party) await Social.leaveParty(); Social.joinParty(v); closeSheet(); } }
        else if (a === 'kick') { Social.kick(id); closeSheet(); }
        else if (a === 'leave') { Social.leaveParty(); closeSheet(); }
    }
    stage.addEventListener('click', e => {
        if (e.target.closest('.pt-plus')) { e.stopPropagation(); inviteSheet(); return; }
        const slot = e.target.closest('.pt-slot');
        if (slot && inParty()) { e.stopPropagation(); memberSheet(members()[+slot.dataset.i]); }
    }, true);
    $('pt-bar').addEventListener('click', e => { const a = e.target.dataset.a; if (a === 'leave') { if (window.Social) Social.leaveParty(); } else if (a === 'mode') setMode(e.target.dataset.m); });
    $('pt-inv').addEventListener('click', e => {
        const t = e.target.closest('[data-a]'); if (!t || !window.Social) return;
        const inv = S().invites.find(i => i.id === t.dataset.id); if (inv) Social.answerInvite(inv, t.dataset.a === 'join');
    });
    window.addEventListener('party-change', () => { render(); if (sheet.kind === 'inv') inviteSheet(); else if (sheet.kind === 'mem' && !inParty()) closeSheet(); });

    /* ------------------------------------------------------------ PLAY rules ---- */
    // Called by PLAY on the home screen. Returns true when the party took over.
    function intercept(mode) {
        if (!inParty()) return false;
        if (!isHost()) { toast('Waiting for the party leader to start'); return true; }
        if (mode === 'gauntlet') { window.gauntletParty = members().slice(1); return false; }
        if (mode === 'race' || !mode) { Social.startParty(); return true; }
        toast('Parties play Quick race and Gauntlet'); return true;
    }
    window.Party = { members, mode, setMode, intercept, render, active:inParty, standIns:() => (inParty() ? members().slice(1) : []) };
    render(); syncMode();
    setInterval(() => { if (!document.hidden) { render(); syncMode(); } }, 4000);          // your own look can change from the shop
})();
