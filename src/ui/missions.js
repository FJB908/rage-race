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

    // one call for every finished match, whoever it was against (bots now, other players when online): quick race, Ranked, party
    function race(place, finished) { event('race'); if (finished && place === 1) event('win'); if (finished && place <= 2) event('podium'); }

    function claimables(p) {
        const out = [];
        p.missions.list.forEach((m, i) => { const d = BY[m.id]; if (d && !m.claimed && m.n >= d.target) out.push({ t: 'm', i }); });
        const all = p.missions.list.every(m => m.claimed);
        if (all && !p.missions.bonus) out.push({ t: 'b' });
        const w = BY[p.weekly.id]; if (w && !p.weekly.claimed && p.weekly.n >= w.target) out.push({ t: 'w' });
        return out;
    }

    /* ----------------------------------------------------------------------- home icon ---- */
    function refreshHome() {
        const btn = document.getElementById('btn-missions'); if (!btn) return;
        const p = prog(); if (ensure(p)) saveProg(p);
        const done = p.missions.list.filter(m => m.claimed).length, ready = claimables(p).length;
        btn.title = done + ' / 3 missions done';
        [...btn.querySelectorAll('.mm-dots u')].forEach((u, i) => { const m = p.missions.list[i], d = m && BY[m.id]; u.className = m && m.claimed ? 'on' : (m && d && m.n >= d.target ? 'rdy' : ''); });
        btn.classList.toggle('ready', ready > 0);
        setBadge(btn, ready);
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

    const EV_ICON = { race: 'mode-race', win: 'crown', podium: 'crown', jump: 'arrow-up', item: 'xp', chest: 'drop-common', level: 'mode-levels', escape: 'mode-escape', ranked: 'mode-race', gtrun: 'crown' };
    const chestArt = (tier, id) => (window.LB_CHEST ? LB_CHEST(id, tier) : icon('drop-' + tier));
    function render() {
        const p = prog(); if (ensure(p)) saveProg(p);
        el.querySelector('#ms-reset').textContent = 'New missions in ' + hoursLeft() + ' h';
        const done = p.missions.list.filter(m => m.claimed).length, all = done === 3;
        // hero: the chest for finishing all three
        let h = '<div class="ms-hero' + (p.missions.bonus ? ' done' : all ? ' ready' : '') + '"><div class="ms-hero-chest" style="--c:#5b8def;--c2:#1f3f8f">' + chestArt('rare', 'mh') + '</div>' +
            '<div class="ms-hero-tx"><small>DAILY CHEST</small><b>' + (p.missions.bonus ? 'Opened today' : all ? 'Ready to open' : 'Finish all 3') + '</b><div class="ms-pips"><i class="' + (done > 0 ? 'on' : '') + '"></i><i class="' + (done > 1 ? 'on' : '') + '"></i><i class="' + (done > 2 ? 'on' : '') + '"></i></div></div>' +
            (p.missions.bonus ? '<span class="ms-ok">' + icon('check') + '</span>' : all ? '<button class="ms-go big" data-t="b" type="button">OPEN</button>' : '') + '</div>';
        h += '<h2 class="scr-h2">Today</h2><div class="ms-list">';
        p.missions.list.forEach((m, i) => {
            const d = BY[m.id], pct = Math.round(100 * m.n / d.target), ready = !m.claimed && m.n >= d.target;
            h += '<div class="ms-row' + (m.claimed ? ' done' : ready ? ' ready' : '') + '"><span class="ms-ic">' + icon(EV_ICON[d.ev] || 'star') + '</span><div class="ms-main"><b>' + d.text + '</b>' +
                '<div class="ms-bar"><i style="width:' + pct + '%"></i></div><small>' + Math.min(m.n, d.target).toLocaleString('en-US') + ' / ' + d.target.toLocaleString('en-US') + '</small></div>' +
                '<div class="ms-side"><div class="ms-rw">' + R('coin', d.coins) + R('pass', d.pass) + '</div>' +
                (m.claimed ? '<span class="ms-ok">' + icon('check') + '</span>' : ready ? '<button class="ms-go" data-t="m" data-i="' + i + '" type="button">CLAIM</button>' : '') + '</div></div>';
        });
        h += '</div>';
        const w = BY[p.weekly.id], wp = Math.round(100 * p.weekly.n / w.target), wr = !p.weekly.claimed && p.weekly.n >= w.target;
        h += '<h2 class="scr-h2">This week <em>' + daysLeft() + (daysLeft() === 1 ? ' day' : ' days') + ' left</em></h2>' +
            '<div class="ms-week' + (p.weekly.claimed ? ' done' : wr ? ' ready' : '') + '"><div class="ms-week-chest" style="--c:#b3a9ff;--c2:#4f3fc4">' + chestArt('epic', 'mw') + '</div>' +
            '<div class="ms-main"><b>' + w.text + '</b><div class="ms-bar"><i style="width:' + wp + '%"></i></div><small>' + Math.min(p.weekly.n, w.target).toLocaleString('en-US') + ' / ' + w.target.toLocaleString('en-US') + '</small>' +
            '<div class="ms-rw row">' + R('gem', WEEK_REWARD.gems) + R('coin', WEEK_REWARD.coins) + '</div></div>' +
            (p.weekly.claimed ? '<span class="ms-ok">' + icon('check') + '</span>' : wr ? '<button class="ms-go" data-t="w" type="button">CLAIM</button>' : '') + '</div>';
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

    { const mb = document.getElementById('btn-missions'); if (mb) mb.addEventListener('click', () => { SFX.play('count'); open(); }); }
    window.Missions = { event, race, open, refreshHome, state: () => { const p = prog(); ensure(p); return { missions: p.missions, weekly: p.weekly }; }, DAILY, WEEKLY };
    window.addEventListener('load', () => refreshHome());
    setTimeout(refreshHome, 0);
})();
