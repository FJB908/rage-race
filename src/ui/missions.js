// MISSIONS: 3 daily missions (all three give a chest) and one weekly goal (a big chest). Progress is counted by Missions.event(name, n) calls from the game.
// State lives in prog(): missions { day, list:[{id,n,claimed}], bonus } and weekly { wk, id, n, claimed }. Loaded AFTER game.js.
(function () {
    'use strict';
    const pad = n => (n < 10 ? '0' : '') + n;
    const dstr = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    const now = () => window.__todayOverride ? new Date(window.__todayOverride + 'T12:00:00') : new Date();
    const today = () => dstr(now());
    const monday = () => { const d = now(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return dstr(d); };
    const gtOk = () => { try { return levelInfo(prog().xp).lvl >= 5; } catch (e) { return false; } };

    // ev = the event that counts it; kind add = add n, max = keep the best value; fam = only one mission per family a day
    const DAILY = [
        { id: 'race3',   fam: 'race',  ev: 'race',    kind: 'add', target: 3,   text: 'Finish 3 races',            coins: 200, pass: 30 },
        { id: 'win1',    fam: 'race',  ev: 'win',     kind: 'add', target: 1,   text: 'Win a race',                coins: 250, pass: 40 },
        { id: 'podium2', fam: 'race',  ev: 'podium',  kind: 'add', target: 2,   text: 'Finish top 2 twice',        coins: 220, pass: 35 },
        { id: 'jump60',  fam: 'jump',  ev: 'jump',    kind: 'add', target: 60,  text: 'Jump 60 times',             coins: 150, pass: 25 },
        { id: 'jump150', fam: 'jump',  ev: 'jump',    kind: 'add', target: 150, text: 'Jump 150 times',            coins: 260, pass: 35 },
        { id: 'items3',  fam: 'item',  ev: 'item',    kind: 'add', target: 3,   text: 'Use 3 items',               coins: 150, pass: 25 },
        { id: 'chest2',  fam: 'chest', ev: 'chest',   kind: 'add', target: 2,   text: 'Open 2 chests',             coins: 200, pass: 30 },
        { id: 'lv2',     fam: 'level', ev: 'level',   kind: 'add', target: 2,   text: 'Complete 2 levels',         coins: 250, pass: 35 },
        { id: 'esc300',  fam: 'esc',   ev: 'escape',  kind: 'max', target: 300, text: 'Score 300 in Escape',       coins: 200, pass: 30 },
        { id: 'esc700',  fam: 'esc',   ev: 'escape',  kind: 'max', target: 700, text: 'Score 700 in Escape',       coins: 300, pass: 40 },
        { id: 'rk1',     fam: 'rk',    ev: 'ranked',  kind: 'add', target: 1,   text: 'Play a Ranked match',       coins: 250, pass: 35 },
        { id: 'gt1',     fam: 'gt',    ev: 'gtrun',   kind: 'add', target: 1,   text: 'Play the Gauntlet',         coins: 300, pass: 40, ok: gtOk },
    ];
    const WEEKLY = [
        { id: 'w_win10',   ev: 'win',    kind: 'add', target: 10,  text: 'Win 10 races' },
        { id: 'w_race25',  ev: 'race',   kind: 'add', target: 25,  text: 'Finish 25 races' },
        { id: 'w_lv10',    ev: 'level',  kind: 'add', target: 10,  text: 'Complete 10 levels' },
        { id: 'w_chest12', ev: 'chest',  kind: 'add', target: 12,  text: 'Open 12 chests' },
        { id: 'w_pod12',   ev: 'podium', kind: 'add', target: 12,  text: 'Finish top 2, 12 times' },
        { id: 'w_jump900', ev: 'jump',   kind: 'add', target: 900, text: 'Jump 900 times' },
    ];
    const WEEK_REWARD = { gems: 25, coins: 1500 };
    const BY = Object.fromEntries(DAILY.concat(WEEKLY).map(m => [m.id, m]));

    function seeded(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return () => { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; h = (h ^ (h >>> 13)) >>> 0; return h / 4294967296; }; }

    // make sure the stored state belongs to today / this week (rolls it over when it does not)
    function ensure(p) {
        let changed = false; const day = today(), wk = monday();
        if (!p.missions || p.missions.day !== day) {
            const rnd = seeded('d' + day), pool = DAILY.filter(m => !m.ok || m.ok()), fams = new Set(), list = [];
            for (let guard = 0; list.length < 3 && guard < 60; guard++) { const m = pool[Math.floor(rnd() * pool.length)]; if (fams.has(m.fam)) continue; fams.add(m.fam); list.push({ id: m.id, n: 0, claimed: false }); }
            p.missions = { day, list, bonus: false }; changed = true;
        }
        if (!p.weekly || p.weekly.wk !== wk) {
            const rnd = seeded('w' + wk), m = WEEKLY[Math.floor(rnd() * WEEKLY.length)];
            p.weekly = { wk, id: m.id, n: 0, claimed: false }; changed = true;
        }
        return changed;
    }
    let jumps = 0;
    function apply(p, ev, n) {
        let changed = false;
        const hit = (m, def) => { if (!def || def.ev !== ev || m.claimed) return; const before = m.n; m.n = Math.min(def.target, def.kind === 'max' ? Math.max(m.n, n) : m.n + n); if (m.n !== before) changed = true; };
        for (const m of p.missions.list) hit(m, BY[m.id]);
        hit(p.weekly, BY[p.weekly.id]);
        return changed;
    }
    function event(ev, n) {
        n = n === undefined ? 1 : n;
        if (ev === 'jump') { jumps += n; if (jumps < 10) return; n = jumps; jumps = 0; }
        else if (jumps) { const j = jumps; jumps = 0; const p0 = prog(); ensure(p0); if (apply(p0, 'jump', j)) saveProg(p0); }
        try {
            const p = prog(); const rolled = ensure(p);
            if (apply(p, ev, n) || rolled) { saveProg(p); refreshHome(); }
        } catch (e) {}
    }
    const flush = () => { if (jumps) event('flush', 0); };
    addEventListener('pagehide', flush); document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });

    function claimables(p) {
        const out = [];
        p.missions.list.forEach((m, i) => { const d = BY[m.id]; if (d && !m.claimed && m.n >= d.target) out.push({ t: 'm', i }); });
        const all = p.missions.list.every(m => m.claimed);
        if (all && !p.missions.bonus) out.push({ t: 'b' });
        const w = BY[p.weekly.id]; if (w && !p.weekly.claimed && p.weekly.n >= w.target) out.push({ t: 'w' });
        return out;
    }

    /* ----------------------------------------------------------------------- home row ---- */
    let row = null;
    function mountRow() {
        if (row) return;
        const anchor = document.querySelector('.m-stage'); if (!anchor) return;
        row = document.createElement('button'); row.type = 'button'; row.className = 'm-miss'; row.id = 'btn-missions';
        row.innerHTML = '<span class="mm-ico">' + icon('check') + '</span><span class="mm-copy"><b>Missions</b><small id="mm-sub"></small></span><i class="mm-dots"><u></u><u></u><u></u></i>';
        anchor.parentNode.insertBefore(row, anchor);
        row.addEventListener('click', () => { SFX.play('count'); open(); });
    }
    function refreshHome() {
        mountRow(); if (!row) return;
        const p = prog(); if (ensure(p)) saveProg(p);
        const done = p.missions.list.filter(m => m.claimed).length, ready = claimables(p).length;
        row.querySelector('#mm-sub').textContent = done === 3 ? 'All done today' : done + ' / 3 done today';
        [...row.querySelectorAll('.mm-dots u')].forEach((u, i) => { const m = p.missions.list[i], d = m && BY[m.id]; u.className = m && m.claimed ? 'on' : (m && d && m.n >= d.target ? 'rdy' : ''); });
        setBadge(row, ready);
    }

    /* -------------------------------------------------------------------------- screen ---- */
    const el = document.createElement('div');
    el.id = 's-missions'; el.className = 'screen scr scr-miss'; el.style.cssText = 'display:none;opacity:0';
    el.innerHTML = '<section class="scr-shell"><header class="scr-head"><button class="pass-back" type="button" id="ms-back" aria-label="Back">' + icon('chev-l') + '</button><div class="scr-title"><span class="scr-eye" id="ms-reset"></span><h1>Missions</h1></div></header>' +
        '<div class="scr-body" id="ms-body"></div><footer class="scr-foot"><button class="scr-main" type="button" id="ms-claim"></button></footer></section>';
    document.body.appendChild(el); S.missions = el;
    const body = el.querySelector('#ms-body'), claimBtn = el.querySelector('#ms-claim');
    const hoursLeft = () => { const d = now(); const end = new Date(d); end.setHours(24, 0, 0, 0); return Math.max(1, Math.ceil((end - d) / 3600000)); };
    const daysLeft = () => { const d = now(); const dow = (d.getDay() + 6) % 7; return 7 - dow; };

    function render() {
        const p = prog(); if (ensure(p)) saveProg(p);
        el.querySelector('#ms-reset').textContent = 'New missions in ' + hoursLeft() + ' h';
        let h = '<h2 class="scr-h2">Today</h2><div class="ms-list">';
        p.missions.list.forEach((m, i) => {
            const d = BY[m.id], pct = Math.round(100 * m.n / d.target), ready = !m.claimed && m.n >= d.target;
            h += '<div class="ms-row' + (m.claimed ? ' done' : ready ? ' ready' : '') + '"><div class="ms-main"><b>' + d.text + '</b>' +
                '<div class="ms-bar"><i style="width:' + pct + '%"></i></div><small>' + Math.min(m.n, d.target).toLocaleString('en-US') + ' / ' + d.target.toLocaleString('en-US') + '</small></div>' +
                '<div class="ms-rw">' + R('coin', d.coins) + R('pass', d.pass) + '</div>' +
                (m.claimed ? '<span class="ms-ok">' + icon('check') + '</span>' : ready ? '<button class="ms-go" data-t="m" data-i="' + i + '" type="button">CLAIM</button>' : '<span class="ms-wait"></span>') + '</div>';
        });
        const all = p.missions.list.every(m => m.claimed);
        h += '<div class="ms-row bonus' + (p.missions.bonus ? ' done' : all ? ' ready' : '') + '"><div class="ms-main"><b>All 3 done</b><small>Bonus chest</small></div><div class="ms-rw"><span class="ms-chest">' + icon('drop-rare') + '</span></div>' +
            (p.missions.bonus ? '<span class="ms-ok">' + icon('check') + '</span>' : all ? '<button class="ms-go" data-t="b" type="button">OPEN</button>' : '<span class="ms-wait"></span>') + '</div></div>';
        const w = BY[p.weekly.id], wp = Math.round(100 * p.weekly.n / w.target), wr = !p.weekly.claimed && p.weekly.n >= w.target;
        h += '<h2 class="scr-h2">This week <em>' + daysLeft() + (daysLeft() === 1 ? ' day' : ' days') + ' left</em></h2>' +
            '<div class="ms-row weekly' + (p.weekly.claimed ? ' done' : wr ? ' ready' : '') + '"><div class="ms-main"><b>' + w.text + '</b><div class="ms-bar"><i style="width:' + wp + '%"></i></div><small>' + Math.min(p.weekly.n, w.target).toLocaleString('en-US') + ' / ' + w.target.toLocaleString('en-US') + '</small></div>' +
            '<div class="ms-rw">' + R('gem', WEEK_REWARD.gems) + '<span class="ms-chest">' + icon('drop-epic') + '</span></div>' +
            (p.weekly.claimed ? '<span class="ms-ok">' + icon('check') + '</span>' : wr ? '<button class="ms-go" data-t="w" type="button">CLAIM</button>' : '<span class="ms-wait"></span>') + '</div>';
        body.innerHTML = h;
        body.querySelectorAll('.ms-go').forEach(b => b.onclick = () => claim([{ t: b.dataset.t, i: +b.dataset.i }]));
        const n = claimables(p).length;
        claimBtn.disabled = !n; claimBtn.classList.toggle('ready', !!n);
        claimBtn.innerHTML = n ? 'CLAIM ALL <b>' + n + '</b>' : '<span>' + icon('check') + '</span> NOTHING TO CLAIM';
    }
    let busy = false;
    async function grant(c) {
        const p = prog(); ensure(p);
        if (c.t === 'm') {
            const m = p.missions.list[c.i], d = m && BY[m.id]; if (!m || m.claimed || m.n < d.target) return;
            m.claimed = true; p.passPoints += d.pass; p.passPointsEarned += d.pass; saveProg(p); addCoins(d.coins);
            await showRewardPops([{ type: 'coin', n: d.coins }, { type: 'pass', n: d.pass }]);
        } else if (c.t === 'b') {
            if (p.missions.bonus || !p.missions.list.every(m => m.claimed)) return;
            p.missions.bonus = true; saveProg(p);
            const drop = awardLootDrop('mission:' + p.missions.day, { coins: 200, xp: 100, passPoints: 0 }, { tier: 'rare' });
            await new Promise(res => openLootbox(drop, { title: 'MISSION CHEST', onDone: res }));
        } else if (c.t === 'w') {
            const w = BY[p.weekly.id]; if (p.weekly.claimed || p.weekly.n < w.target) return;
            p.weekly.claimed = true; saveProg(p); addGems(WEEK_REWARD.gems); addCoins(WEEK_REWARD.coins);
            const drop = awardLootDrop('weekly:' + p.weekly.wk, { coins: 300, xp: 200, passPoints: 0 }, { tier: 'epic' });
            await showRewardPops([{ type: 'gem', n: WEEK_REWARD.gems }, { type: 'coin', n: WEEK_REWARD.coins }]);
            await new Promise(res => openLootbox(drop, { title: 'WEEKLY CHEST', onDone: res }));
        }
    }
    async function claim(list) {
        if (busy) return; busy = true;
        try {
            let todo = list;
            while (todo.length) {
                for (const c of todo) { await grant(c); refreshMenu(); render(); }
                todo = list.length > 1 ? claimables(prog()).filter(c => c.t === 'b') : [];       // claiming all three unlocks the bonus chest
            }
        } finally { busy = false; refreshHome(); }
    }
    claimBtn.addEventListener('click', () => { if (!claimBtn.disabled) claim(claimables(prog())); });
    el.querySelector('#ms-back').addEventListener('click', () => showScreen('start'));
    function open() { flush(); render(); showScreen('missions'); }

    window.Missions = { event, open, refreshHome, state: () => { const p = prog(); ensure(p); return { missions: p.missions, weekly: p.weekly }; }, DAILY, WEEKLY };
    window.addEventListener('load', () => refreshHome());
    setTimeout(refreshHome, 0);
})();
