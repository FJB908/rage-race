// THE ARENAS SCREEN: one road that climbs, like the game. At the bottom the Playground, at the top the Summit; your own marker stands on it.
// Along the road, in order of trophies: the power-ups that arrive (NEW) or leave (LEAVES) at a trophy count, and the trophy rewards. Every arena starts at a painted gate.
// No boxes or frames: icons and names sit directly on the road, with room around them. Almost no text: a trophy number, an icon and a name.
// Tap a power-up for one line about it, tap a ready reward to claim it.
// Loaded AFTER trophies.js and arenatheme.js. Opened from the arena title on the home screen: Trophies.open() -> Arenas.open().
(function () {
    'use strict';
    const $ = id => document.getElementById(id), num = n => Math.round(n).toLocaleString('en-US');
    const TH = () => ArenaTheme.THEMES, AR = () => Trophies.ARENAS;
    let busy = false, meRow = null, tick = 0;

    const el = document.createElement('div');
    el.id = 's-trophy'; el.className = 'screen arenas-screen'; el.style.cssText = 'display:none;opacity:0';
    el.innerHTML =
        '<section class="tp-shell"><header class="tp-top"><button class="pass-back" type="button" id="tp-back" aria-label="Back">' + icon('chev-l') + '</button>' +
        '<h1 class="tp-title">Arenas</h1><button type="button" class="tp-all" id="tp-all" hidden></button><div class="tp-tr-pill">' + icon('trophy') + '<b id="tp-tr">0</b></div></header>' +
        '<div class="tp-scroll" id="tp-scroll"><div class="tp-road" id="tp-road"><i class="tp-line"></i><i class="tp-fill"></i></div></div>' +
        '<button type="button" class="tp-me-btn" id="tp-me-btn" hidden></button></section>';
    document.body.appendChild(el); S.trophy = el;
    const scroll = $('tp-scroll'), road = $('tp-road');

    /* ----------------------------------------------------------------------------- the data ---- */
    // every stop on the road: {at, kind: 'new' | 'gone' | 'reward', ...}
    function stops() {
        const ev = [];
        Trophies.road().forEach(m => ev.push({ at: m.at, kind: 'reward', o: 1, m }));
        ArenaTheme.UNLOCKS.forEach(u => { (u.add || []).forEach(k => ev.push({ at: u.at, kind: 'new', o: 0, k })); (u.remove || []).forEach(k => ev.push({ at: u.at, kind: 'gone', o: 0, k })); });
        ev.sort((a, b) => a.at - b.at || a.o - b.o);
        const out = [];                                                         // power-ups that arrive (or leave) at the same trophy count share one stop
        for (const e of ev) {
            const last = out[out.length - 1];
            if (e.kind !== 'reward' && last && last.kind === e.kind && last.at === e.at) last.ks.push(e.k);
            else out.push(e.kind === 'reward' ? e : { at: e.at, kind: e.kind, ks: [e.k] });
        }
        return out;
    }
    const icoOf = k => (typeof ICON_SVG !== 'undefined' && ICON_SVG[k]) || '';

    /* ------------------------------------------------------------------------------ the rows ---- */
    function stop(cls, at, content) {
        const d = document.createElement('div'); d.className = 'tp-row ' + cls;
        d.innerHTML = '<span class="tp-n">' + num(at) + '</span><i class="tp-dot"></i><div class="tp-c">' + content + '</div>';
        return d;
    }
    function rowItems(e, tr) {
        const cls = 'pu ' + e.kind + (e.at <= tr ? ' reached' : '') + (e.ks.length > 1 ? ' many' : '');
        const d = stop(cls, e.at, e.ks.map(k => '<span class="tp-it" data-k="' + k + '" style="--pc:' + (ArenaTheme.COLORS[k] || '#9aa4b6') + '">' + icoOf(k) + '<span class="tp-lab"><b>' + ArenaTheme.INFO[k][0] + '</b><i>' + (e.kind === 'gone' ? 'LEAVES' : 'NEW') + '</i></span></span>').join(''));
        d.querySelectorAll('.tp-it').forEach(it => { it.onclick = () => { const info = ArenaTheme.INFO[it.dataset.k]; if (window.SFX) SFX.play('tap'); toast(e.kind === 'gone' ? info[0] + ' leaves the power-ups' : info[0] + ': ' + info[1]); }; });
        return d;
    }
    // the icon already says what it is, so the label is only what the icon cannot say: an amount, a booster, a cosmetic's name (never "Coins", "Gems" or "Chest")
    function labelOf(r) {
        if (r.t === 'coin') return '<b>' + num(r.n) + '</b>'; if (r.t === 'gem') return '<b>' + r.n + '</b>';
        if (r.t === 'drop' || r.t === 'gemchest') return '';
        return Trophies.name(r).replace(/<small>.*?<\/small>/, '');
    }
    function rowReward(e, tr, done) {
        const m = e.m, claimed = done.includes(m.id), ready = !claimed && m.at <= tr;
        const d = stop('rw' + (claimed ? ' claimed' : ready ? ' ready' : e.at <= tr ? ' reached' : '') + (m.big ? ' big' : ''), m.at,
            '<span class="tp-art">' + Trophies.art(m.r, m.id) + '</span><span class="tp-lab">' + labelOf(m.r) + (ready ? '<em>CLAIM</em>' : claimed ? '<i class="got">Collected</i>' : '') + '</span>');
        d.style.setProperty('--rc', Trophies.color(m.r));
        if (ready) { d.setAttribute('role', 'button'); d.onclick = () => claim([m.id]); }
        const c = d.querySelector('canvas');
        if (c) { const look = Object.assign({ skin: 'classic', hat: 'none', face: 'none', trail: 'none' }, { [m.r.cat]: m.r.id }); if (m.r.cat === 'trail') { c.width = 200; c.height = 100; try { drawTrailPreview(c, Trophies.itemOf(m.r), undefined, 1.5); } catch (er) {} } else { try { renderLook(c, look, { scale: .26, cy: .6 }); } catch (er) {} } }
        return d;
    }
    // a player on the road: their face sits ON the line, as the dot (you are bigger and glow; a friend is smaller and has a name)
    function rowPerson(cls, tr, look, name) {
        const d = document.createElement('div'); d.className = 'tp-row ' + cls;
        d.innerHTML = '<span class="tp-n">' + num(tr) + '</span><span class="tp-av"><canvas width="112" height="112"></canvas></span><div class="tp-c">' + (name ? '<span class="tp-lab"><b></b></span>' : '') + '</div>';
        if (name) d.querySelector('b').textContent = name;
        try { renderLook(d.querySelector('canvas'), look, { scale: .36, cy: .58 }); } catch (e) {}
        return d;
    }
    const rowMe = tr => rowPerson('me', tr, myLook());
    function friends() {                                                            // friends that have a trophy count, from the social list
        try { return (window.Social && Social.friendList ? Social.friendList() : []).filter(f => typeof f.tr === 'number').map(f => ({ tr: f.tr, look: f.look, name: f.name })); } catch (e) { return []; }
    }
    function gate(i, tr) {
        const th = TH()[i], A = AR()[i], here = Trophies.arenaOf(tr) === i, state = here ? 'here' : tr >= A.at ? 'done' : 'lock';
        const g = document.createElement('div'); g.className = 'tp-gate ' + state; g.style.setProperty('--ac', th.c);
        const cv = document.createElement('canvas'); cv.width = 588; cv.height = 180; g.appendChild(cv);
        try { ArenaTheme.paintScene(cv, i, 392, 120, { prog: .15 + i * .02, props: .7, alpha: 1.4, mist: .1, horizon: .86, scale: .9 }); } catch (e) {}
        const t = document.createElement('div'); t.className = 'tp-gt';
        t.innerHTML = '<span class="tp-gk">ARENA ' + (i + 1) + '</span><b>' + th.name + '</b><span class="tp-gn">' + (state === 'lock' ? icon('lock') : icon('trophy')) + num(A.at) + '</span>';
        g.appendChild(t);
        return g;
    }

    /* ------------------------------------------------------------------------------- render ---- */
    function render() {
        const p = prog(), tr = p.tr || 0, done = p.trClaimed || [], cur = Trophies.arenaOf(tr), all = stops(), cl = Trophies.claimable(), fr = friends();
        $('tp-tr').textContent = num(tr);
        const ab = $('tp-all'); ab.hidden = !cl.length; ab.textContent = 'CLAIM ' + cl.length;
        for (const n of [...road.children]) if (!n.classList.contains('tp-line') && !n.classList.contains('tp-fill')) n.remove();
        meRow = null;
        for (let i = TH().length - 1; i >= 0; i--) {
            const zone = document.createElement('section'); zone.className = 'tp-zone' + (i === cur ? ' cur' : ''); zone.dataset.arena = i;
            const th = TH()[i]; zone.style.setProperty('--ac', th.c); zone.style.setProperty('--s1', th.sky[0][0]); zone.style.setProperty('--s2', th.sky[0][1]);
            const list = all.filter(e => Trophies.arenaOf(e.at) === i).map(e => ({ at: e.at, o: 1, e }));
            if (i === cur) list.push({ at: tr, o: 2, me: true });                  // you, and friends, stand between the stops at their own trophy count
            fr.filter(f => Trophies.arenaOf(f.tr) === i).forEach(f => list.push({ at: f.tr, o: 1.5, f }));
            list.sort((a, b) => b.at - a.at || b.o - a.o);                          // from the top of the arena down to its gate; a person stands above a stop with the same number
            for (const x of list) {
                if (x.me) { meRow = rowMe(tr); zone.appendChild(meRow); }
                else if (x.f) zone.appendChild(rowPerson('fr', x.f.tr, x.f.look, x.f.name));
                else zone.appendChild(x.e.kind === 'reward' ? rowReward(x.e, tr, done) : rowItems(x.e, tr));
            }
            zone.appendChild(gate(i, tr));
            road.appendChild(zone);
        }
        layout();
    }
    function layout() {                                                           // the coloured part of the line, from the bottom up to you
        if (!meRow) return;
        const rr = road.getBoundingClientRect(), mr = meRow.getBoundingClientRect();
        road.style.setProperty('--fill', Math.max(0, road.scrollHeight - (mr.top - rr.top + mr.height / 2)) + 'px');
        meBtn();
    }
    function meBtn() {                                                            // the "back to me" button shows while your marker is off screen, pointing the way
        const b = $('tp-me-btn'); if (!meRow) { b.hidden = true; return; }
        const sr = scroll.getBoundingClientRect(), mr = meRow.getBoundingClientRect(), above = mr.bottom < sr.top + 20, below = mr.top > sr.bottom - 20;
        b.hidden = !(above || below); if (b.hidden) return;
        b.classList.toggle('up', above); if (b._tr !== (prog().tr || 0)) { b._tr = prog().tr || 0; b.innerHTML = icon('chev-l') + '<span>' + num(b._tr) + '</span>'; }
    }
    scroll.addEventListener('scroll', () => { if (!tick) tick = requestAnimationFrame(() => { tick = 0; meBtn(); }); }, { passive: true });
    function goToMe(smooth) { if (!meRow) return; const rr = road.getBoundingClientRect(), mr = meRow.getBoundingClientRect(); scroll.scrollTo({ top: Math.max(0, mr.top - rr.top - scroll.clientHeight * .5 + mr.height / 2), behavior: smooth ? 'smooth' : 'auto' }); }
    async function claim(ids) {
        if (busy) return; busy = true;
        try { await Trophies.claim(ids); } finally { busy = false; render(); }
    }
    $('tp-all').onclick = () => claim(Trophies.claimable().map(m => m.id));
    $('tp-back').onclick = () => showScreen('start');
    $('tp-me-btn').onclick = () => goToMe(true);

    window.Arenas = {
        render,
        open(i) {
            render(); showScreen('trophy');
            setTimeout(() => {
                layout();                                                         // measured now that the screen is visible
                if (typeof i === 'number') { const z = road.querySelector('.tp-zone[data-arena="' + i + '"]'); if (z) { const rr = road.getBoundingClientRect(), zr = z.getBoundingClientRect(); scroll.scrollTop = Math.max(0, zr.top - rr.top - 10); return; } }
                goToMe(false);
            }, 80);
        },
    };
})();
