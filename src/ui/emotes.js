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
        { id: 'oops',  text: 'OOPS',        col: ORANGE, price: 0, fx: 'wobble' },
        { id: 'nice',  text: 'NICE ONE',    col: GOLD,   gems: 30, fx: 'pulse' },
        { id: 'close', text: 'SO CLOSE',    col: BLUE,   gems: 30, fx: 'shake', amp: 1.3 },
        { id: 'rage',  text: 'RAGE!',       col: RED,    gems: 40, fx: 'shake', amp: 3, big: 1.25, heat: true },
        { id: 'wow',   text: 'WOW',         col: PINK,   gems: 40, fx: 'jelly', big: 1.2 },
        { id: 'cool',  text: 'COOL',        col: BLUE,   gems: 40, fx: 'shine', frost: true },
        { id: 'boom',  text: 'BOOM',        col: ORANGE, gems: 50, fx: 'boom', big: 1.3 },
        { id: 'king',  text: 'KING',        col: PURPLE, gems: 60, fx: 'shine', sparkle: true, big: 1.2 },
    ];
    const BY = Object.fromEntries(EMOTES.map(e => [e.id, e]));
    const FAMILY = '"Bricolage Grotesque","Arial Rounded MT Bold","Segoe UI",system-ui,sans-serif';
    const COOLDOWN = 2500, LIFE = 2.3, MAX_SLOTS = 4;

    /* ----------------------------------------------------------------------- in-world bubbles ---- */
    const active = [];     // { p, e, t0 }
    function say(p, id) {
        const e = BY[id]; if (!e || !p) return;
        for (let i = active.length - 1; i >= 0; i--) if (active[i].p === p) active.splice(i, 1);     // one bubble per player
        active.push({ p, e, t0: performance.now() });
        if (e.fx === 'boom' && typeof burst === 'function') { burst(p.x, p.y - p.r - 40, e.col[1], 16, 260); ring(p.x, p.y - p.r - 40, e.col[0], 60); }
        if (e.heat && typeof burst === 'function') burst(p.x, p.y - p.r - 30, '#ff7a3d', 10, 160);
    }
    function draw(ctx) {
        const now = performance.now();
        for (let i = active.length - 1; i >= 0; i--) {
            const a = active[i], t = (now - a.t0) / 1000;
            if (t > LIFE || !players.includes(a.p)) { active.splice(i, 1); continue; }
            const p = a.p, e = a.e, fade = t > LIFE - .4 ? (LIFE - t) / .4 : 1;
            const hatLift = p.look && p.look.hat && p.look.hat !== 'none' ? 14 : 0, rise = Math.min(t, .5) * 26 + t * 5;
            let sx = 1, sy = 1, dx = 0, dy = 0;
            const pop = t < .22 ? 1 + 0.5 * Math.pow(1 - t / .22, 2) : 1; sx = sy = pop;
            if (e.fx === 'pulse') { const k = 1 + .07 * Math.sin(t * 14); sx *= k; sy *= k; }
            else if (e.fx === 'shake') { dx = Math.sin(t * 70) * (e.amp || 2) * Math.min(1, t * 6) * Math.max(0, 1 - t / 1.6); dy = Math.cos(t * 83) * (e.amp || 2) * .4 * Math.max(0, 1 - t / 1.6); }
            else if (e.fx === 'jelly') { const k = .16 * Math.sin(t * 18) * Math.exp(-t * 1.4); sx *= 1 + k; sy *= 1 - k; }
            else if (e.fx === 'wobble') { dy = Math.sin(t * 16) * 2.2 * Math.exp(-t * 1.6); }
            else if (e.fx === 'boom') { const k = t < .3 ? 1 + 1.3 * Math.pow(1 - t / .3, 2) : 1; sx = sy = k; dx = Math.sin(t * 90) * 2 * Math.max(0, 1 - t / .5); }
            const size = 17 * (e.big || 1), x = p.x + dx, y = p.y - p.r - 46 - hatLift - rise + dy;
            ctx.save(); ctx.translate(x, y); ctx.scale(sx, sy); ctx.globalAlpha = Math.max(0, Math.min(1, fade)); ctx.transform(1, 0, -0.14, 1, 0, 0);
            ctx.font = 'italic 800 ' + size + 'px ' + FAMILY; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            const tw = ctx.measureText(e.text).width;
            const g = ctx.createLinearGradient(0, -size / 2, 0, size / 2); g.addColorStop(0, e.col[0]); g.addColorStop(.48, e.col[1]); g.addColorStop(1, e.col[2]);
            ctx.shadowColor = e.col[1]; ctx.shadowBlur = e.heat ? 12 + 8 * Math.sin(t * 22) : 10;
            ctx.lineJoin = 'round'; ctx.lineWidth = 5; ctx.strokeStyle = '#0d1017'; ctx.strokeText(e.text, 0, 0);
            ctx.fillStyle = g; ctx.fillText(e.text, 0, 0);
            ctx.shadowBlur = 0;
            if (e.fx === 'shine') {                                   // a bright band glides across the letters
                const ph = ((t * .9) % 1.4) - .2, cx0 = -tw / 2 + ph * tw * 1.4 - tw * .2, sg = ctx.createLinearGradient(cx0 - size * .8, -size, cx0 + size * .8, size);
                sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(.5, 'rgba(255,255,255,.95)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = sg; ctx.fillText(e.text, 0, 0);
            }
            if (e.sparkle) {                                          // small four-point sparks twinkling around the word
                ctx.fillStyle = '#fff';
                for (let k = 0; k < 4; k++) { const ph = (t * 1.6 + k * .27) % 1, px = (-.5 + ((k * .37 + .1) % 1)) * tw, py = (k % 2 ? -1 : 1) * size * .75, r = Math.sin(ph * Math.PI) * 4.2; if (r > .3) { ctx.beginPath(); ctx.moveTo(px, py - r); ctx.lineTo(px + r * .3, py - r * .3); ctx.lineTo(px + r, py); ctx.lineTo(px + r * .3, py + r * .3); ctx.lineTo(px, py + r); ctx.lineTo(px - r * .3, py + r * .3); ctx.lineTo(px - r, py); ctx.lineTo(px - r * .3, py - r * .3); ctx.closePath(); ctx.fill(); } }
            }
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
        return '<span class="em-chip fx-' + (e.fx || 'none') + '" style="' + style + '"><b>' + e.text + '</b></span>';
    }
    const paintGlyphs = () => {};

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
