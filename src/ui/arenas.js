// THE ARENAS SCREEN: one arena per page. A big painted picture of the arena with its name and how far you are in it, the ten arenas as a strip you can tap,
// the power-ups that arrive or leave in that arena, and the four trophy rewards of that arena. It replaces the long Trophy Road list.
// Loaded AFTER trophies.js and arenatheme.js (it reads their data). Opened from the arena banner on the home screen: Trophies.open() -> Arenas.open().
(function () {
    'use strict';
    const $ = id => document.getElementById(id), num = n => Math.round(n).toLocaleString('en-US');
    const TH = () => window.ArenaTheme.THEMES, AR = () => Trophies.ARENAS;
    let page = 0, busy = false, art = null;

    const el = document.createElement('div');
    el.id = 's-trophy'; el.className = 'screen arenas-screen'; el.style.cssText = 'display:none;opacity:0';
    el.innerHTML =
        '<section class="ax-shell"><header class="ax-top"><button class="pass-back" type="button" id="ax-back" aria-label="Back">' + icon('chev-l') + '</button>' +
        '<h1 class="ax-title">Arenas</h1><div class="ax-tr">' + icon('trophy') + '<b id="ax-tr">0</b></div></header>' +
        '<div class="ax-scroll" id="ax-scroll">' +
        '<div class="ax-hero" id="ax-hero"><canvas id="ax-art"></canvas><div class="ax-shade"></div>' +
        '<button class="ax-nav prev" type="button" id="ax-prev" aria-label="Previous arena">' + icon('chev-l') + '</button><button class="ax-nav next" type="button" id="ax-next" aria-label="Next arena">' + icon('chev-l') + '</button>' +
        '<span class="ax-badge" id="ax-badge"></span>' +
        '<div class="ax-copy"><span class="ax-kick" id="ax-kick"></span><h2 class="ax-name" id="ax-name"></h2><p class="ax-tag" id="ax-tag"></p>' +
        '<div class="ax-prog"><i class="ax-bar"><u id="ax-fill"></u></i><span id="ax-ptxt"></span></div></div></div>' +
        '<div class="ax-strip" id="ax-strip"></div>' +
        '<section class="ax-sec"><div class="ax-sh"><h3>Power-ups</h3><span id="ax-pcount"></span></div><div id="ax-pu"></div></section>' +
        '<section class="ax-sec"><div class="ax-sh"><h3>Rewards</h3><button type="button" class="ax-all" id="ax-all" hidden></button></div><div class="ax-rw" id="ax-rw"></div></section>' +
        '</div></section>';
    document.body.appendChild(el); S.trophy = el;
    const cv = $('ax-art'), hero = $('ax-hero');

    /* ---------------------------------------------------------------------------- the page ---- */
    function state(i) {                                                      // where the player stands against arena i
        const tr = prog().tr || 0, A = AR()[i], next = AR()[i + 1], cur = Trophies.arenaOf(tr);
        return { tr, A, next, cur, here: i === cur, done: i < cur, locked: i > cur, from: A.at, to: next ? next.at : A.at + Trophies.SPAN_LAST };
    }
    function paintArt(i) {
        const w = hero.clientWidth, h = hero.clientHeight; if (w < 40 || h < 40) return;
        const dpr = Math.min(2, window.devicePixelRatio || 1), key = i + '|' + w + 'x' + h + '|' + dpr; if (cv._key === key) return; cv._key = key;
        cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.width = w + 'px'; cv.style.height = h + 'px';
        try { ArenaTheme.paintScene(cv, i, w, h, { prog: .12 + i * .02, props: .8, alpha: 1.45, mist: .1, horizon: .62 }); } catch (e) {}
    }
    function renderHero(i, dir) {
        const th = TH()[i], s = state(i);
        el.style.setProperty('--ac', th.c);
        $('ax-kick').textContent = 'ARENA ' + (i + 1) + ' OF ' + TH().length;
        $('ax-name').textContent = th.name; $('ax-tag').textContent = th.tag;
        const fill = $('ax-fill'), txt = $('ax-ptxt'), prog_ = $('ax-hero').querySelector('.ax-prog');
        if (s.here) { fill.style.width = Math.max(3, Math.min(100, 100 * (s.tr - s.from) / (s.to - s.from))).toFixed(1) + '%'; txt.innerHTML = s.next ? '<b>' + num(s.to - s.tr) + '</b> to ' + s.next.n : 'Top arena'; }
        else if (s.done) { fill.style.width = '100%'; txt.textContent = 'Reached'; }
        else { fill.style.width = '0%'; txt.innerHTML = '<b>' + num(s.from - s.tr) + '</b> trophies to go'; }
        $('ax-badge').className = 'ax-badge' + (s.here ? ' here' : s.done ? ' done' : ' lock'); $('ax-badge').innerHTML = s.here ? 'YOU ARE HERE' : s.done ? icon('check') + ' REACHED' : icon('lock') + ' ' + num(s.from) + ' TROPHIES';
        prog_.classList.toggle('dim', s.locked);
        if (dir) { hero.classList.remove('sl', 'sr'); void hero.offsetWidth; hero.classList.add(dir > 0 ? 'sl' : 'sr'); }
        paintArt(i);
        $('ax-prev').disabled = i <= 0; $('ax-next').disabled = i >= TH().length - 1;
    }
    function renderStrip(i) {
        const st = $('ax-strip'), cl = Trophies.claimable(); st.innerHTML = '';
        TH().forEach((th, a) => {
            const s = state(a), b = document.createElement('button'); b.type = 'button';
            b.className = 'ax-node' + (a === i ? ' sel' : '') + (s.here ? ' here' : s.done ? ' done' : ' lock'); b.style.setProperty('--nc', th.c);
            b.innerHTML = '<span>' + (a + 1) + '</span>' + (cl.some(m => m.arena === a) ? '<i class="ax-dot"></i>' : ''); b.setAttribute('aria-label', 'Arena ' + (a + 1) + ' ' + th.name);
            b.onclick = () => go(a); st.appendChild(b);
        });
    }
    const itemRow = (k, kind, i) => {                                       // kind: 'new' | 'gone'
        const info = ArenaTheme.INFO[k], th = TH()[i], themed = th.items[k] ? th.items[k][0] : '', svg = (typeof ICON_SVG !== 'undefined' && ICON_SVG[k]) || '';
        return '<div class="ax-pu ' + kind + '" style="--pc:' + (ITEMS0col(k) || '#9aa4b6') + '"><span class="ax-pi">' + svg + '</span><span class="ax-pt"><b>' + info[0] + (themed && kind === 'new' ? '<em>' + themed.replace('!', '') + '</em>' : '') + '</b><small>' + (kind === 'gone' ? 'Not in this arena any more' : info[1]) + '</small></span><span class="ax-tagc ' + kind + '">' + (kind === 'new' ? (i === 0 ? 'STARTER' : 'NEW') : 'GONE') + '</span></div>';
    };
    const BASECOL = { rocket: '#ff7a3d', giant: '#ffcf3f', bounce: '#35e0c8', chain: '#c9d1e3', quake: '#ff5470', shield: '#7ee787', wind: '#8fd6ff', ufo: '#7CFF6B', bomb: '#ff3d5a', cannon: '#ff9f43', dj: '#9fe8ff' };
    function ITEMS0col(k) { return BASECOL[k]; }
    function renderPowerups(i) {
        const d = ArenaTheme.diff(i), box = $('ax-pu');
        $('ax-pcount').textContent = d.pool.length + ' of ' + ArenaTheme.ORDER.length + ' in play';
        let h = '';
        if (d.add.length) h += '<div class="ax-pg">' + (i === 0 ? 'The starter set' : 'New in this arena') + '</div>' + d.add.map(k => itemRow(k, 'new', i)).join('');
        if (d.remove.length) h += '<div class="ax-pg">Leaves in this arena</div>' + d.remove.map(k => itemRow(k, 'gone', i)).join('');
        h += '<div class="ax-pg">All power-ups here</div><div class="ax-all-pu">' + ArenaTheme.ORDER.map(k => '<span class="' + (d.pool.includes(k) ? 'on' : 'off') + (d.add.includes(k) ? ' fresh' : '') + '" title="' + ArenaTheme.INFO[k][0] + '">' + ((typeof ICON_SVG !== 'undefined' && ICON_SVG[k]) || '') + '</span>').join('') + '</div>';
        const th = TH()[i], ren = Object.keys(th.items).filter(k => d.pool.includes(k)).map(k => ArenaTheme.INFO[k][0] + ' becomes <b>' + th.items[k][0].replace('!', '') + '</b>');
        if (ren.length) h += '<p class="ax-note">' + ren.join(' · ') + '</p>';
        box.innerHTML = h;
    }
    function renderRewards(i) {
        const p = prog(), tr = p.tr || 0, done = p.trClaimed || [], box = $('ax-rw'), road = Trophies.road().filter(m => m.arena === i), nm = Trophies.nextMilestone(), cl = Trophies.claimable();
        box.innerHTML = '';
        for (const m of road) {
            const claimed = done.includes(m.id), ready = !claimed && m.at <= tr, cur = nm && nm.id === m.id;
            const t = document.createElement(ready ? 'button' : 'div'); if (ready) t.type = 'button';
            t.className = 'ax-r' + (claimed ? ' claimed' : ready ? ' ready' : ' locked') + (cur ? ' next' : '') + (m.big ? ' big' : ''); t.style.setProperty('--rc', Trophies.color(m.r));
            t.innerHTML = '<span class="ax-ra">' + Trophies.art(m.r, m.id) + '</span><span class="ax-rn">' + Trophies.name(m.r) + '</span><span class="ax-rs">' + (claimed ? icon('check') + ' Collected' : ready ? 'TAP TO CLAIM' : icon('trophy') + ' ' + num(m.at)) + '</span>';
            if (ready) t.onclick = () => claim([m.id]);
            box.appendChild(t);
            const c = t.querySelector('canvas');
            if (c) { const look = Object.assign({ skin: 'classic', hat: 'none', face: 'none', trail: 'none' }, { [m.r.cat]: m.r.id }); if (m.r.cat === 'trail') { c.width = 200; c.height = 100; try { drawTrailPreview(c, Trophies.itemOf(m.r), undefined, 1.5); } catch (e) {} } else { try { renderLook(c, look, { scale: .26, cy: .6 }); } catch (e) {} } }
        }
        const all = $('ax-all'); all.hidden = !cl.length; all.textContent = 'CLAIM ALL (' + cl.length + ')';
    }
    function render() {
        $('ax-tr').textContent = num(prog().tr || 0);
        renderHero(page); renderStrip(page); renderPowerups(page); renderRewards(page);
    }
    function go(i, silent) {
        i = Math.max(0, Math.min(TH().length - 1, i)); if (i === page && !silent) return;
        const dir = i > page ? 1 : -1; page = i; if (window.SFX && !silent) SFX.play('tap');
        $('ax-tr').textContent = num(prog().tr || 0);
        renderHero(page, silent ? 0 : dir); renderStrip(page); renderPowerups(page); renderRewards(page);
        const sc = $('ax-scroll'); if (!silent && sc.scrollTop > hero.offsetHeight) sc.scrollTop = 0;
    }
    async function claim(ids) {
        if (busy) return; busy = true;
        try { await Trophies.claim(ids); } finally { busy = false; render(); }
    }
    // swipe on the picture: left = next arena, right = previous
    let sx = 0, sy = 0, sw = false;
    hero.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; sw = true; });
    hero.addEventListener('pointerup', e => { if (!sw) return; sw = false; const dx = e.clientX - sx, dy = e.clientY - sy; if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.4) go(page + (dx < 0 ? 1 : -1)); });
    hero.addEventListener('pointercancel', () => { sw = false; });
    $('ax-prev').onclick = () => go(page - 1); $('ax-next').onclick = () => go(page + 1);
    $('ax-all').onclick = () => claim(Trophies.claimable().map(m => m.id));
    $('ax-back').onclick = () => showScreen('start');

    window.Arenas = {
        render,
        open(i) {
            page = typeof i === 'number' ? i : Trophies.arenaOf(prog().tr || 0); cv._key = '';
            render(); showScreen('trophy');
            setTimeout(() => { cv._key = ''; paintArt(page); $('ax-scroll').scrollTop = 0; }, 90);
        },
    };
})();
