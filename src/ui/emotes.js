// EMOTES: quick reactions in a race. A few are free, the special ones cost gems. The look copies the position indicator (italic, tilted,
// vertical gradient, dark outline, glow). Loaded AFTER game.js.
(function () {
    'use strict';
    const GOLD = ['#fff4c2', '#ffcf3f', '#ff9838'], SILVER = ['#ffffff', '#d4dceb', '#8a95ab'], RED = ['#ffd6de', '#ff5470', '#b81f4a'], TEAL = ['#e9fffb', '#5eead4', '#0e8f7e'],
          PURPLE = ['#ece8ff', '#b3a9ff', '#5b46d6'], BLUE = ['#d6ecff', '#5eb4ff', '#1f5bd0'], ORANGE = ['#ffe2c6', '#ff9838', '#c2551e'], PINK = ['#ffe0f8', '#ff6fd8', '#a0128a'];
    const EMOTES = [
        { id: 'gg',    text: 'GG',          col: GOLD,   price: 0 },
        { id: 'gl',    text: 'GOOD LUCK',   col: TEAL,   price: 0 },
        { id: 'wp',    text: 'WELL PLAYED', col: SILVER, price: 0 },
        { id: 'oops',  text: 'OOPS',        col: ORANGE, price: 0 },
        { id: 'nice',  text: 'NICE ONE',    col: GOLD,   gems: 30, glyph: 'star' },
        { id: 'close', text: 'SO CLOSE',    col: BLUE,   gems: 30, glyph: 'bolt' },
        { id: 'rage',  text: 'RAGE!',       col: RED,    gems: 40, glyph: 'flame' },
        { id: 'wow',   text: 'WOW',         col: PINK,   gems: 40, glyph: 'burst' },
        { id: 'cool',  text: 'COOL',        col: BLUE,   gems: 40, glyph: 'snow' },
        { id: 'boom',  text: 'BOOM',        col: ORANGE, gems: 50, glyph: 'burst' },
        { id: 'king',  text: 'KING',        col: PURPLE, gems: 60, glyph: 'crown' },
    ];
    const BY = Object.fromEntries(EMOTES.map(e => [e.id, e]));
    const FAMILY = '"Bricolage Grotesque","Arial Rounded MT Bold","Segoe UI",system-ui,sans-serif';
    const COOLDOWN = 2500, LIFE = 2.3, MAX_SLOTS = 4;

    /* ----------------------------------------------------------- glyphs (canvas paths, centred on 0,0 in a 1x1 box) ---- */
    const GLYPH = {
        star(c, s) { c.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? s * .22 : s * .5, a = -Math.PI / 2 + i * Math.PI / 5; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); },
        bolt(c, s) { c.beginPath(); c.moveTo(s * .12, -s * .5); c.lineTo(-s * .3, s * .08); c.lineTo(-s * .02, s * .08); c.lineTo(-s * .14, s * .5); c.lineTo(s * .32, -s * .12); c.lineTo(s * .04, -s * .12); c.closePath(); },
        flame(c, s) { c.beginPath(); c.moveTo(0, -s * .52); c.bezierCurveTo(s * .1, -s * .25, s * .42, -s * .12, s * .38, s * .16); c.bezierCurveTo(s * .36, s * .38, s * .18, s * .5, 0, s * .5); c.bezierCurveTo(-s * .18, s * .5, -s * .38, s * .38, -s * .38, s * .12); c.bezierCurveTo(-s * .38, -s * .02, -s * .24, -s * .1, -s * .16, -s * .2); c.bezierCurveTo(-s * .12, -s * .06, -s * .06, -s * .02, -s * .02, -s * .02); c.bezierCurveTo(-s * .06, -s * .26, -s * .06, -s * .4, 0, -s * .52); c.closePath(); },
        burst(c, s) { c.beginPath(); for (let i = 0; i < 16; i++) { const r = i % 2 ? s * .26 : s * .52, a = i * Math.PI / 8; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); },
        snow(c, s) { c.beginPath(); for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; c.moveTo(Math.cos(a) * s * .5, Math.sin(a) * s * .5); c.lineTo(-Math.cos(a) * s * .5, -Math.sin(a) * s * .5); } },
        crown(c, s) { c.beginPath(); c.moveTo(-s * .5, s * .36); c.lineTo(-s * .5, -s * .22); c.lineTo(-s * .24, 0); c.lineTo(0, -s * .38); c.lineTo(s * .24, 0); c.lineTo(s * .5, -s * .22); c.lineTo(s * .5, s * .36); c.closePath(); },
    };

    /* ----------------------------------------------------------------------- in-world bubbles ---- */
    const active = [];     // { p, e, t0 }
    function say(p, id) {
        const e = BY[id]; if (!e || !p) return;
        for (let i = active.length - 1; i >= 0; i--) if (active[i].p === p) active.splice(i, 1);     // one bubble per player
        active.push({ p, e, t0: performance.now() });
    }
    function draw(ctx) {
        const now = performance.now();
        for (let i = active.length - 1; i >= 0; i--) {
            const a = active[i], age = (now - a.t0) / 1000;
            if (age > LIFE || !players.includes(a.p)) { active.splice(i, 1); continue; }
            const p = a.p, e = a.e, pop = age < .22 ? 1 + 1.6 * Math.pow(1 - age / .22, 2) * Math.sin(age / .22 * Math.PI * .5 + 1.2) * .4 : 1, fade = age > LIFE - .4 ? (LIFE - age) / .4 : 1;
            const hatLift = p.look && p.look.hat && p.look.hat !== 'none' ? 14 : 0, rise = Math.min(age, .5) * 26 + age * 5;
            const x = p.x, y = p.y - p.r - 46 - hatLift - rise, size = 17;
            ctx.save(); ctx.translate(x, y); ctx.scale(pop, pop); ctx.globalAlpha = Math.max(0, Math.min(1, fade)); ctx.transform(1, 0, -0.14, 1, 0, 0);
            ctx.font = 'italic 800 ' + size + 'px ' + FAMILY; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            const tw = ctx.measureText(e.text).width, gs = e.glyph ? size * 1.15 : 0, total = tw + (gs ? gs + 4 : 0), x0 = -total / 2;
            const g = ctx.createLinearGradient(0, -size / 2, 0, size / 2); g.addColorStop(0, e.col[0]); g.addColorStop(.48, e.col[1]); g.addColorStop(1, e.col[2]);
            ctx.shadowColor = e.col[1]; ctx.shadowBlur = 10;
            if (gs) {
                ctx.save(); ctx.translate(x0 + gs / 2, 0); GLYPH[e.glyph](ctx, gs);
                ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = '#0d1017'; ctx.stroke(); ctx.fillStyle = g; if (e.glyph !== 'snow') ctx.fill();
                if (e.glyph === 'snow') { ctx.lineWidth = 2.4; ctx.strokeStyle = e.col[0]; ctx.stroke(); }
                ctx.restore();
            }
            ctx.lineJoin = 'round'; ctx.lineWidth = 5; ctx.strokeStyle = '#0d1017'; ctx.strokeText(e.text, x0 + (gs ? gs + 4 : 0), 0);
            ctx.fillStyle = g; ctx.fillText(e.text, x0 + (gs ? gs + 4 : 0), 0);
            ctx.restore();
        }
    }

    /* ----------------------------------------------------------------------------- state ---- */
    const owned = () => prog().emotes;
    const loadout = () => prog().emoteLoadout.filter(id => BY[id] && owned().includes(id)).slice(0, MAX_SLOTS);
    function equip(id) {
        const p = prog(); if (!p.emotes.includes(id)) return false;
        const L = p.emoteLoadout.filter(x => BY[x]);
        if (L.includes(id)) { if (L.length > 1) L.splice(L.indexOf(id), 1); }                      // tap an equipped one to remove it (keep at least one)
        else { if (L.length >= MAX_SLOTS) L.shift(); L.push(id); }
        p.emoteLoadout = L; saveProg(p); return true;
    }
    function buy(id) {
        const e = BY[id], p = prog(); if (!e || p.emotes.includes(id) || !e.gems) return false;
        if (gemCount() < e.gems) return false;
        store('rr_gems', gemCount() - e.gems);
        const q = prog(); q.emotes.push(id); saveProg(q); equip(id);       // a new emote goes straight into the race slots (the oldest one makes room)
        return true;
    }

    /* ---------------------------------------------------------------- DOM chip (same look) ---- */
    function chipHTML(e) {
        const style = '--a:' + e.col[0] + ';--b:' + e.col[1] + ';--c:' + e.col[2];
        return '<span class="em-chip" style="' + style + '"><i class="em-gl" data-g="' + (e.glyph || '') + '"></i><b>' + e.text + '</b></span>';
    }
    function paintGlyphs(root) {
        root.querySelectorAll('.em-gl').forEach(el => {
            const g = el.dataset.g; if (!g) { el.remove(); return; }
            const cv = document.createElement('canvas'); cv.width = cv.height = 48; el.appendChild(cv);
            const c = cv.getContext('2d'), st = getComputedStyle(el.parentNode), a = st.getPropertyValue('--a'), b = st.getPropertyValue('--b'), cc = st.getPropertyValue('--c');
            c.translate(24, 24); GLYPH[g](c, 36); c.lineJoin = 'round'; c.lineWidth = 5; c.strokeStyle = '#0d1017'; c.stroke();
            const gr = c.createLinearGradient(0, -18, 0, 18); gr.addColorStop(0, a); gr.addColorStop(.5, b); gr.addColorStop(1, cc);
            if (g === 'snow') { c.lineWidth = 3; c.strokeStyle = a; c.stroke(); } else { c.fillStyle = gr; c.fill(); }
        });
    }

    /* ------------------------------------------------------------------------- race button ---- */
    const btn = document.createElement('button'); btn.id = 'emote-btn'; btn.type = 'button'; btn.hidden = true; btn.setAttribute('aria-label', 'Emotes');
    btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H11l-5 4v-4H4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="9" cy="10.5" r="1.1" fill="currentColor"/><circle cx="12.5" cy="10.5" r="1.1" fill="currentColor"/><circle cx="16" cy="10.5" r="1.1" fill="currentColor"/></svg>';
    const wheel = document.createElement('div'); wheel.id = 'emote-wheel'; wheel.hidden = true;
    document.body.appendChild(btn); document.body.appendChild(wheel);
    let lastSent = 0;
    function closeWheel() { wheel.hidden = true; btn.classList.remove('on'); }
    function openWheel() {
        wheel.innerHTML = loadout().map(id => '<button type="button" class="em-pick" data-id="' + id + '">' + chipHTML(BY[id]) + '</button>').join('');
        paintGlyphs(wheel); wheel.hidden = false; btn.classList.add('on');
    }
    btn.addEventListener('pointerdown', e => e.stopPropagation());
    btn.addEventListener('click', e => { e.stopPropagation(); wheel.hidden ? openWheel() : closeWheel(); });
    wheel.addEventListener('pointerdown', e => e.stopPropagation());
    wheel.addEventListener('click', e => {
        const b = e.target.closest('.em-pick'); if (!b) return;
        const now = performance.now(); if (now - lastSent < COOLDOWN) { closeWheel(); return; }
        lastSent = now; closeWheel();
        const me = players && players.find(p => p.local); if (me) say(me, b.dataset.id);
        btn.classList.add('cool'); setTimeout(() => btn.classList.remove('cool'), COOLDOWN);
    });
    // visibility + bots reacting
    const told = new WeakSet(); let lastStart = 0;
    setInterval(() => {
        const racing = typeof gameMode !== 'undefined' && gameMode === 'race' && (state === 'playing' || state === 'countdown');
        btn.hidden = !racing; if (!racing) closeWheel();
        if (!racing || !window.players) return;
        if (state === 'playing' && matchStart !== lastStart) {                      // a new race just started: someone wishes you luck
            lastStart = matchStart;
            if (Math.random() < 0.3) { const bot = players.filter(p => !p.local && !p.remote)[Math.floor(Math.random() * 3)]; if (bot) setTimeout(() => say(bot, 'gl'), 500 + Math.random() * 900); }
        }
        for (const p of players) if (p.finished && !p.local && !told.has(p)) { told.add(p); if (Math.random() < 0.35) setTimeout(() => say(p, Math.random() < 0.7 ? 'gg' : 'wp'), 500 + Math.random() * 1400); }
    }, 250);

    /* ------------------------------------------------------------------------------- shop ---- */
    function renderShop(grid) {
        const p = prog(), L = loadout();
        grid.innerHTML = '';
        const head = document.createElement('div'); head.className = 'em-head';
        head.innerHTML = '<b>In the race</b><span>' + L.length + ' / ' + MAX_SLOTS + '</span><small>Tap an emote you own to put it in or take it out</small>';
        grid.appendChild(head);
        const slots = document.createElement('div'); slots.className = 'em-slots';
        slots.innerHTML = L.map(id => chipHTML(BY[id])).join('') || '<small>Nothing equipped</small>';
        grid.appendChild(slots);
        let armed = null, armT = 0;
        for (const e of EMOTES) {
            const own = p.emotes.includes(e.id), eq = L.includes(e.id);
            const b = document.createElement('button'); b.type = 'button'; b.className = 'm-skin em-card' + (eq ? ' eq' : '');
            b.style.setProperty('--rc', e.gems ? '#ff8ae6' : '#9aa3b5');
            b.innerHTML = '<span class="em-pv">' + chipHTML(e) + '</span><b>' + e.text.charAt(0) + e.text.slice(1).toLowerCase() + '</b>' +
                '<span class="m-skin-f"><span class="buy-hint">Tap again</span><span class="' + (own ? (eq ? 'eqd' : 'own') : 'price') + '">' + (own ? (eq ? 'EQUIPPED' : 'OWNED') : icon('gem') + ' ' + e.gems) + '</span></span>';
            b.onclick = () => {
                if (own) { equip(e.id); SFX.play('item'); renderShop(grid); return; }
                if (gemCount() < e.gems) { b.classList.add('m-shake'); setTimeout(() => b.classList.remove('m-shake'), 400); SFX.play('fall'); return; }
                if (armed !== b) { grid.querySelectorAll('.arm').forEach(x => x.classList.remove('arm')); b.classList.add('arm'); armed = b; SFX.play('count'); clearTimeout(armT); armT = setTimeout(() => { b.classList.remove('arm'); armed = null; }, 2600); return; }
                buy(e.id); SFX.play('pickup'); refreshMenu(); renderShop(grid);
            };
            grid.appendChild(b);
        }
        paintGlyphs(grid);
    }

    window.Emotes = { EMOTES, BY, say, draw, equip, buy, renderShop, loadout };
})();
