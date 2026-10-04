// BUILD RACE: a Chicken-Horse style mode. Four rounds. Every round each player places ONE piece on a short course (a helpful ledge, a spring,
// a sliding or icy or crumbling platform, or a trap: spikes), then everybody races it. You score for finishing and for catching rivals in
// your spikes, so you want a course that you can beat and the others cannot. Today the three rivals are bots; every rule is local to this file
// and works on a list of {name, color, look} players, so the same flow can run with real people later. Loaded AFTER game.js.
(function () {
    'use strict';
    const ROUNDS = 4, COURSE_H = 2300, RACE_LIMIT = 55, POINTS = [10, 7, 5, 3], TRAP_PTS = 2;
    const $ = id => document.getElementById(id);
    const sfx = (n, a) => { try { SFX.play(n, a); } catch (e) {} };
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const rr = (a, b) => a + Math.random() * (b - a);

    // piece catalogue. 'good' pieces help whoever uses them, the rest are annoying by design.
    const PIECES = {
        ledge:   { name: 'Ledge',   tip: 'A solid step',                        w: 112, type: 'normal', color: '#4ade80' },
        spring:  { name: 'Spring',  tip: 'Your next jump is extra strong',      w: 84,  type: 'boost',  color: '#35e0c8' },
        mover:   { name: 'Mover',   tip: 'Slides from side to side',            w: 92,  type: 'moving', color: '#7c6bff' },
        ice:     { name: 'Ice',     tip: 'Slippery: you keep sliding',          w: 112, type: 'ice',    color: '#cfe9ff' },
        crumble: { name: 'Crumble', tip: 'Breaks soon after you land',          w: 100, type: 'fragile', color: '#ff9838' },
        spikes:  { name: 'Spikes',  tip: 'Sends anyone who touches it back to the start', w: 80, type: 'spike', color: '#ff5470' },
    };
    const KEYS = Object.keys(PIECES);

    const ORIG = { f: FINISH_Y, t: TRACK };
    const B = { on: false, round: 0, scores: [0, 0, 0, 0], roster: null, phase: 'idle', raceT: 0, startedRace: false, pieces: [], hits: {}, zapT: [0, 0, 0, 0], lootId: '' };
    window.buildMatch = false;

    /* -------------------------------------------------------------------------------------- course ---- */
    function makeCourse(seed) {
        const r = pkRng(seed), pw = PLAY_W();
        FINISH_Y = START_Y - COURSE_H; TRACK = COURSE_H;
        platforms = []; itemBoxes = []; finishPlatform = null; ufos = [];
        platforms.push({ x: pw / 2, y: START_Y, w: pw, h: 40, type: 'normal', active: true, ground: true });
        let y = START_Y - 165, lastX = pw / 2, row = 0;
        while (y > FINISH_Y + 330) {
            const diff = 1 - (y - FINISH_Y) / TRACK;
            const gap = 128 + r() * 34 + diff * 38;
            const w = Math.max(84, 132 - diff * 38 + r() * 18);
            const roll = r(); let type = 'normal', speed = 0, range = 0;
            if (roll > 0.82) type = 'ice'; else if (roll > 0.68) { type = 'moving'; speed = 70 + r() * 40; range = 50 + r() * 50; }
            const half = w / 2; let x = lastX + (r() * 2 - 1) * (105 + diff * 25); x = Math.max(half + 6, Math.min(pw - half - 6, x));
            let baseX = x; if (type === 'moving') { baseX = Math.max(half + 6 + range, Math.min(pw - half - 6 - range, x)); x = baseX; }
            platforms.push({ x, y, w, h: 18, type, speed, dir: r() < 0.5 ? 1 : -1, active: true, breaking: false, breakT: 0, respawn: 0, baseX, range, boostReady: true, route: true });
            if (row > 0 && row % 7 === 0) { const fw = pw * (0.8 + r() * 0.1); platforms.push({ x: pw / 2, y: y - gap * 0.5, w: fw, h: 20, type: 'safety', active: true, breaking: false, breakT: 0, respawn: 0, baseX: pw / 2, range: 0, boostReady: true }); }
            lastX = x; y -= gap; row++;
        }
        platforms.push({ x: pw / 2, y: FINISH_Y + 180, w: pw * 0.7, h: 18, type: 'normal', active: true, breaking: false, breakT: 0, respawn: 0, baseX: pw / 2, range: 0, boostReady: true });
        platforms.push({ x: pw / 2, y: FINISH_Y, w: pw, h: 40, type: 'finish', active: true });
        finishPlatform = platforms.find(p => p.type === 'finish');
        for (const pc of B.pieces) platforms.push(pc);                  // pieces from earlier rounds stay
    }
    function resetDynamic() {
        for (const pl of platforms) { if (pl.ground) continue; pl.active = true; pl.breaking = false; pl.breakT = 0; pl.respawn = 0; if (pl.type === 'moving') { pl.x = pl.baseX; pl.dir = 1; } }
    }

    /* ------------------------------------------------------------------------------- placing pieces ---- */
    function pieceRect(kind, x, y) {
        const d = PIECES[kind], h = d.type === 'spike' ? 18 : 18, range = d.type === 'moving' ? 70 : 0;
        return { x0: x - d.w / 2 - range, x1: x + d.w / 2 + range, y0: y - h / 2 - 14, y1: y + h / 2 + 14 };
    }
    function validSpot(kind, x, y) {
        const pw = PLAY_W(), d = PIECES[kind], range = d.type === 'moving' ? 70 : 0, half = d.w / 2 + range;
        if (x < half + 6 || x > pw - half - 6) return false;
        if (y < FINISH_Y + 150 || y > START_Y - 120) return false;
        const a = pieceRect(kind, x, y);
        for (const pl of platforms) {
            if (pl.type === 'finish') continue;
            const range2 = pl.type === 'moving' ? (pl.range || 0) : 0;
            const b0 = pl.x - pl.w / 2 - range2 - (pl.type === 'moving' ? 0 : 0), b1 = pl.x + pl.w / 2 + range2;
            const bx0 = pl.type === 'moving' ? pl.baseX - pl.w / 2 - range2 : pl.x - pl.w / 2, bx1 = pl.type === 'moving' ? pl.baseX + pl.w / 2 + range2 : pl.x + pl.w / 2;
            const py0 = pl.y - pl.h / 2 - 14, py1 = pl.y + pl.h / 2 + 14;
            if (a.x0 < bx1 + 6 && a.x1 > bx0 - 6 && a.y0 < py1 && a.y1 > py0) return false;
        }
        return true;
    }
    function addPiece(kind, x, y, owner) {
        const d = PIECES[kind], range = d.type === 'moving' ? 70 : 0;
        const pc = { x, y, w: d.w, h: d.type === 'spike' ? 18 : 18, type: d.type, speed: d.type === 'moving' ? 80 : 0, dir: Math.random() < 0.5 ? 1 : -1, active: true, breaking: false, breakT: 0, respawn: 0,
                     baseX: x, range, boostReady: true, owner, piece: kind, born: performance.now() };
        platforms.push(pc); B.pieces.push(pc); return pc;
    }
    function drawCards() {                                          // three different pieces
        const bag = KEYS.slice().sort(() => Math.random() - 0.5), out = bag.slice(0, 3);
        if (!out.some(k => PIECES[k].type === 'normal' || PIECES[k].type === 'boost' || PIECES[k].type === 'moving')) out[0] = 'ledge';     // always one friendly option
        return out;
    }

    /* --------------------------------------------------------------------------------------- bots ---- */
    function botPlace(idx) {
        const p = players[idx], pers = B.roster[idx].pers, cards = drawCards();
        const rank = k => ({ trapper: ['spikes', 'crumble', 'ice', 'mover', 'ledge', 'spring'], helper: ['spring', 'ledge', 'mover', 'ice', 'crumble', 'spikes'], chaos: KEYS.slice().sort(() => Math.random() - 0.5) }[pers] || KEYS).indexOf(k);
        cards.sort((a, b) => rank(a) - rank(b));
        const kind = cards[0], route = platforms.filter(pl => pl.route && pl.y < START_Y - 300 && pl.y > FINISH_Y + 320);
        for (let tries = 0; tries < 90; tries++) {
            const base = route[Math.floor(Math.random() * route.length)]; if (!base) break;
            let x, y;
            if (kind === 'spikes') { x = base.x + rr(-70, 70); y = base.y - rr(55, 110); }
            else if (pers === 'helper') { x = base.x + rr(-80, 80); y = base.y - rr(55, 85); }
            else { x = base.x + rr(-110, 110); y = base.y - rr(40, 120); }
            x = Math.round(x / 4) * 4; y = Math.round(y / 4) * 4;
            if (validSpot(kind, x, y)) return { kind, x, y };
        }
        return null;
    }

    /* -------------------------------------------------------------------------------- overlay: DOM ---- */
    const root = document.createElement('div'); root.id = 'bd-root'; root.hidden = true;
    root.innerHTML = '<canvas id="bd-cv"></canvas>' +
        '<div class="bd-top"><button class="bd-x" id="bd-x" type="button" aria-label="Leave">' + icon('chev-l') + '</button><div class="bd-title"><small id="bd-round"></small><b id="bd-msg"></b></div></div>' +
        '<div class="bd-scores" id="bd-scores"></div>' +
        '<div class="bd-order" id="bd-order"></div>' +
        '<div class="bd-bottom" id="bd-bottom"></div>';
    document.body.appendChild(root);
    const cv = $('bd-cv'), cx = cv.getContext('2d');
    const hudChip = document.createElement('div'); hudChip.id = 'bd-hud'; hudChip.hidden = true; document.body.appendChild(hudChip);
    const panel = document.createElement('div'); panel.id = 'bd-panel'; panel.hidden = true; document.body.appendChild(panel);

    // view: fit the width, scroll vertically
    const view = { S: 0.85, ox: 0, camTop: 0, w: 0, h: 0 };
    function fit() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2); view.w = window.innerWidth; view.h = window.innerHeight;
        cv.width = Math.round(view.w * dpr); cv.height = Math.round(view.h * dpr); cx.setTransform(dpr, 0, 0, dpr, 0, 0);
        view.S = Math.min(1.05, (view.w - 70) / PLAY_W()); view.ox = (view.w - 34 - PLAY_W() * view.S) / 2;
    }
    const wx = x => view.ox + x * view.S, wy = y => (y - view.camTop) * view.S;
    const toWorld = (px, py) => ({ x: (px - view.ox) / view.S, y: py / view.S + view.camTop });
    const clampCam = () => { view.camTop = Math.max(FINISH_Y - 140, Math.min(START_Y + 60 - view.h / view.S, view.camTop)); };
    function centerOn(y) { view.camTop = y - view.h / view.S * 0.45; clampCam(); }

    function drawPiece(kind, x, y, alpha, ring) {
        const d = PIECES[kind], w = d.w * view.S, h = 18 * view.S;
        cx.save(); cx.globalAlpha = alpha === undefined ? 1 : alpha; cx.translate(wx(x), wy(y));
        if (d.type === 'spike') {
            cx.fillStyle = '#ff5470'; const n = Math.max(4, Math.round(d.w / 14)), tw = w / n;
            for (let i = 0; i < n; i++) { cx.beginPath(); cx.moveTo(-w / 2 + i * tw, h / 2); cx.lineTo(-w / 2 + (i + 0.5) * tw, -h * 0.9); cx.lineTo(-w / 2 + (i + 1) * tw, h / 2); cx.closePath(); cx.fill(); }
            cx.fillStyle = '#7a1230'; cx.fillRect(-w / 2, h / 2 - 3 * view.S, w, 4 * view.S);
        } else {
            cx.fillStyle = d.color; cx.beginPath(); cx.roundRect ? cx.roundRect(-w / 2, -h / 2, w, h, 5 * view.S) : cx.rect(-w / 2, -h / 2, w, h); cx.fill();
            if (d.type === 'moving') { cx.strokeStyle = 'rgba(124,107,255,.5)'; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(-w / 2 - 70 * view.S, 0); cx.lineTo(w / 2 + 70 * view.S, 0); cx.stroke(); }
            if (d.type === 'boost') { cx.fillStyle = '#0d1017'; cx.beginPath(); cx.moveTo(-6 * view.S, 3 * view.S); cx.lineTo(0, -4 * view.S); cx.lineTo(6 * view.S, 3 * view.S); cx.closePath(); cx.fill(); }
            if (d.type === 'fragile') { cx.strokeStyle = '#0d1017'; cx.lineWidth = 1.5; cx.beginPath(); cx.moveTo(-6 * view.S, -h / 2); cx.lineTo(0, 0); cx.lineTo(-4 * view.S, h / 2); cx.stroke(); }
        }
        if (ring) { cx.strokeStyle = ring; cx.lineWidth = 2.5; cx.beginPath(); cx.roundRect ? cx.roundRect(-w / 2 - 4, -h / 2 - 8 * view.S, w + 8, h + 12 * view.S, 7) : cx.rect(-w / 2 - 4, -h / 2 - 8 * view.S, w + 8, h + 12 * view.S); cx.stroke(); }
        cx.restore();
    }
    const ghost = { kind: null, x: 0, y: 0, ok: false, dragging: false };
    let raf = 0;
    function render() {
        raf = requestAnimationFrame(render); if (root.hidden) return;
        cx.clearRect(0, 0, view.w, view.h); cx.fillStyle = '#0d1017'; cx.fillRect(0, 0, view.w, view.h);
        // grid + height markers
        cx.strokeStyle = 'rgba(255,255,255,.04)'; cx.lineWidth = 1;
        for (let gy = Math.floor(view.camTop / 120) * 120; gy < view.camTop + view.h / view.S; gy += 120) { cx.beginPath(); cx.moveTo(wx(0), wy(gy)); cx.lineTo(wx(PLAY_W()), wy(gy)); cx.stroke(); }
        cx.strokeStyle = 'rgba(255,255,255,.14)'; cx.strokeRect(wx(0), wy(FINISH_Y - 140), PLAY_W() * view.S, (START_Y + 60 - FINISH_Y + 140) * view.S);
        const now = performance.now();
        for (const pl of platforms) {
            if (pl.piece) continue;
            const y = wy(pl.y); if (y < -40 || y > view.h + 40) continue;
            if (pl.type === 'finish') { cx.fillStyle = '#fff'; cx.fillRect(wx(0), y - 4, PLAY_W() * view.S, 8); cx.fillStyle = '#0d1017'; for (let i = 0; i < 22; i++) if (i % 2) cx.fillRect(wx(0) + i * PLAY_W() * view.S / 22, y - 4, PLAY_W() * view.S / 22, 4); cx.fillStyle = '#ffcf3f'; cx.font = '800 12px system-ui'; cx.textAlign = 'center'; cx.fillText('FINISH', wx(PLAY_W() / 2), y - 12); continue; }
            const col = PLAT[pl.type] || '#4ade80', w = pl.w * view.S, h = pl.h * view.S;
            cx.fillStyle = col; cx.globalAlpha = pl.ground ? 0.5 : 0.85; cx.beginPath(); cx.roundRect ? cx.roundRect(wx(pl.baseX !== undefined && pl.type === 'moving' ? pl.baseX : pl.x) - w / 2, y - h / 2, w, h, 4) : cx.rect(wx(pl.x) - w / 2, y - h / 2, w, h); cx.fill(); cx.globalAlpha = 1;
            if (pl.type === 'moving' && pl.range) { cx.strokeStyle = 'rgba(124,107,255,.35)'; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(wx(pl.baseX - pl.range) - w / 2, y); cx.lineTo(wx(pl.baseX + pl.range) + w / 2, y); cx.stroke(); }
        }
        for (const pc of B.pieces) {
            const y = wy(pc.y); if (y < -40 || y > view.h + 40) continue;
            const age = (now - pc.born) / 1000, pop = age < 0.45 ? 1 + Math.sin(Math.min(1, age / 0.45) * Math.PI) * 0.18 : 1;
            drawPiece(pc.piece, pc.x, pc.y, 1, PCOL[pc.owner] || '#fff');
            if (age < 1.2) { cx.save(); cx.globalAlpha = 1 - age / 1.2; cx.strokeStyle = PCOL[pc.owner]; cx.lineWidth = 3; cx.beginPath(); cx.arc(wx(pc.x), wy(pc.y), 18 + age * 50, 0, 7); cx.stroke(); cx.restore(); }
        }
        if (ghost.kind) {
            drawPiece(ghost.kind, ghost.x, ghost.y, 0.88, ghost.ok ? '#7ee787' : '#ff5470');
            if (!ghost.ok) { cx.fillStyle = '#ff5470'; cx.font = '800 11px system-ui'; cx.textAlign = 'center'; cx.fillText('NOT HERE', wx(ghost.x), wy(ghost.y) - 26); }
        }
        // start markers
        cx.fillStyle = '#35e0c8'; cx.font = '800 11px system-ui'; cx.textAlign = 'center'; cx.fillText('START', wx(PLAY_W() / 2), wy(START_Y) - 16);
        // mini map on the right
        const mx = view.w - 28, top = 120, bot = view.h - 190, k = (bot - top) / (START_Y - FINISH_Y + 200);
        cx.fillStyle = 'rgba(255,255,255,.06)'; cx.fillRect(mx - 8, top, 16, bot - top);
        for (const pl of platforms) { if (pl.ground || pl.type === 'finish') continue; const yy = top + (pl.y - (FINISH_Y - 100)) * k; cx.fillStyle = pl.piece ? PCOL[pl.owner] : 'rgba(255,255,255,.3)'; cx.fillRect(mx - 6, yy, 12, pl.piece ? 3 : 2); }
        cx.strokeStyle = '#fff'; cx.lineWidth = 1.5; cx.strokeRect(mx - 8, top + (view.camTop - (FINISH_Y - 100)) * k, 16, (view.h / view.S) * k);
    }

    /* ------------------------------------------------------------------------------------- input ---- */
    let drag = null, auto = 0;
    function updateGhost(px, py) {
        const w = toWorld(px, py - 74); ghost.x = Math.round(w.x / 4) * 4; ghost.y = Math.round(w.y / 4) * 4;
        const d = PIECES[ghost.kind], half = d.w / 2 + (d.type === 'moving' ? 70 : 0), pw = PLAY_W();
        ghost.x = Math.max(half + 6, Math.min(pw - half - 6, ghost.x));
        ghost.ok = validSpot(ghost.kind, ghost.x, ghost.y); refreshPlaceBtn();
    }
    cv.addEventListener('pointerdown', e => {
        if (root.hidden) return; cv.setPointerCapture && cv.setPointerCapture(e.pointerId);
        if (e.clientX > view.w - 48 && e.clientY > 110 && e.clientY < view.h - 180) { drag = { mini: true }; miniTo(e.clientY); return; }
        drag = { y0: e.clientY, cam0: view.camTop, ghost: !!ghost.kind };
        if (ghost.kind) updateGhost(e.clientX, e.clientY);
    });
    cv.addEventListener('pointermove', e => {
        if (!drag) return;
        if (drag.mini) { miniTo(e.clientY); return; }
        if (ghost.kind) { updateGhost(e.clientX, e.clientY); auto = e.clientY < 150 ? -1 : (e.clientY > view.h - 230 ? 1 : 0); }
        else { view.camTop = drag.cam0 - (e.clientY - drag.y0) / view.S; clampCam(); }
    });
    const endDrag = () => { drag = null; auto = 0; };
    cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);
    function miniTo(py) { const top = 120, bot = view.h - 190, f = Math.max(0, Math.min(1, (py - top) / (bot - top))); view.camTop = (FINISH_Y - 100) + f * (START_Y - FINISH_Y + 200) - view.h / view.S / 2; clampCam(); }
    setInterval(() => { if (auto && ghost.kind && !root.hidden) { view.camTop += auto * 14 / view.S * 1.2; clampCam(); } }, 30);

    /* ---------------------------------------------------------------------------------------- UI ---- */
    function names() { return B.roster.map(r => r.name); }
    function scoreChips(hl) { return B.roster.map((r, i) => '<span class="bd-chip' + (i === hl ? ' on' : '') + '" style="--pc:' + PCOL[i] + '"><i></i><b>' + (i === 0 ? 'YOU' : r.name.slice(0, 8)) + '</b><em>' + B.scores[i] + '</em></span>').join(''); }
    function setTop(msg) { $('bd-round').textContent = 'ROUND ' + B.round + ' / ' + ROUNDS; $('bd-msg').textContent = msg; $('bd-scores').innerHTML = scoreChips(-1); }
    function iconFor(kind) {
        const d = PIECES[kind];
        if (d.type === 'spike') return '<svg viewBox="0 0 64 40"><path d="M4 34 L14 8 L24 34 L34 8 L44 34 L54 8 L60 34 Z" fill="#ff5470"/><rect x="2" y="32" width="60" height="5" rx="2" fill="#7a1230"/></svg>';
        const extra = d.type === 'boost' ? '<path d="M24 24 L32 12 L40 24" fill="none" stroke="#0d1017" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>' : d.type === 'fragile' ? '<path d="M24 14 L32 24 L28 34" fill="none" stroke="#0d1017" stroke-width="3" stroke-linecap="round"/>' : d.type === 'moving' ? '<path d="M6 36 H58" stroke="rgba(124,107,255,.7)" stroke-width="3" stroke-linecap="round"/><path d="M10 30 l-6 6 l6 6 M54 30 l6 6 l-6 6" fill="none" stroke="#b3a9ff" stroke-width="3" stroke-linecap="round"/>' : '';
        return '<svg viewBox="0 0 64 44"><rect x="8" y="14" width="48" height="16" rx="6" fill="' + d.color + '"/>' + extra + '</svg>';
    }
    function placeRect() { const b = $('bd-place'); return b; }
    function refreshPlaceBtn() { const b = $('bd-place'); if (b) { b.disabled = !ghost.ok; b.classList.toggle('ready', ghost.ok); } }
    function humanPlace(cards) {
        return new Promise(res => {
            ghost.kind = null; const bot = $('bd-bottom');
            const showCards = () => {
                ghost.kind = null; setTop('Your turn: choose a piece');
                bot.innerHTML = '<div class="bd-cards">' + cards.map(k => '<button class="bd-card" type="button" data-k="' + k + '"><span class="bd-ic">' + iconFor(k) + '</span><b>' + PIECES[k].name + '</b><small>' + PIECES[k].tip + '</small></button>').join('') + '</div>';
                bot.querySelectorAll('.bd-card').forEach(b => b.onclick = () => pick(b.dataset.k));
            };
            const pick = kind => {
                sfx('select'); ghost.kind = kind; centerOn((START_Y + FINISH_Y) / 2 + 100);
                const mid = toWorld(view.w / 2 - 17, view.h * 0.45); ghost.x = Math.round(mid.x / 4) * 4; ghost.y = Math.round(mid.y / 4) * 4;
                const dd = PIECES[kind], half = dd.w / 2 + (dd.type === 'moving' ? 70 : 0);
                ghost.x = Math.max(half + 6, Math.min(PLAY_W() - half - 6, ghost.x));
                search: for (let r = 0; r <= 600; r += 12) for (let a = 0; a < (r ? 12 : 1); a++) {      // nearest free spot, spiralling out
                    const sx = Math.round((ghost.x + Math.cos(a * Math.PI / 6) * r) / 4) * 4, sy = Math.round((ghost.y + Math.sin(a * Math.PI / 6) * r) / 4) * 4;
                    if (validSpot(kind, sx, sy)) { ghost.x = sx; ghost.y = sy; break search; }
                }
                ghost.ok = validSpot(kind, ghost.x, ghost.y);
                setTop('Drag the ' + PIECES[kind].name.toLowerCase() + ' where you want it');
                bot.innerHTML = '<div class="bd-actions"><button class="btn ghost bd-back" id="bd-back" type="button">BACK</button><button class="btn bd-placebtn" id="bd-place" type="button">PLACE</button></div><p class="bd-tip">' + PIECES[kind].tip + '. Drag near the top or bottom edge to scroll.</p>';
                $('bd-back').onclick = () => { sfx('back'); showCards(); };
                $('bd-place').onclick = () => { if (!ghost.ok) { sfx('error'); return; } const k = ghost.kind, x = ghost.x, y = ghost.y; ghost.kind = null; bot.innerHTML = ''; res({ kind: k, x, y }); };
                refreshPlaceBtn();
            };
            // start centred on the part of the course with the most going on
            centerOn((START_Y + FINISH_Y) / 2 + 150); showCards();
        });
    }
    function orderStrip(order, cur) {
        $('bd-order').innerHTML = order.map((i, k) => '<span class="bd-o' + (k === cur ? ' on' : k < cur ? ' done' : '') + '" style="--pc:' + PCOL[i] + '"><i></i>' + (i === 0 ? 'YOU' : B.roster[i].name.slice(0, 7)) + '</span>').join('<u>›</u>');
    }

    /* --------------------------------------------------------------------------------- the flow ---- */
    async function buildPhase() {
        B.phase = 'build'; root.hidden = false; hudChip.hidden = true; document.body.classList.add('bd-building');
        state = 'build'; if (SFX.music) SFX.music.set('levels');
        fit(); resetDynamic();
        const order = [0, 1, 2, 3].sort((a, b) => B.scores[b] - B.scores[a] || Math.random() - 0.5);       // the leader places first, the last player places last
        for (let k = 0; k < order.length; k++) {
            const i = order[k]; orderStrip(order, k);
            if (i === 0) {
                const sp = await humanPlace(drawCards());
                addPiece(sp.kind, sp.x, sp.y, 0); sfx('equip');
            } else {
                setTop(B.roster[i].name + ' is placing...'); $('bd-bottom').innerHTML = '';
                await wait(900);
                const sp = botPlace(i);
                if (sp) { centerOn(sp.y); addPiece(sp.kind, sp.x, sp.y, i); sfx('pop'); $('bd-msg').textContent = B.roster[i].name + ' placed ' + PIECES[sp.kind].name.toUpperCase(); }
                await wait(1100);
            }
        }
        $('bd-order').innerHTML = ''; setTop('Get ready...'); await wait(900);
        root.hidden = true; document.body.classList.remove('bd-building');
        startRace();
    }
    function startRace() {
        B.phase = 'race'; B.raceT = 0; B.startedRace = false; B.hits = {}; B.hitFor = [new Set(), new Set(), new Set(), new Set()]; B.zapT = [0, 0, 0, 0]; B.trapPts = [0, 0, 0, 0];
        const keep = B.roster; initPlayers();
        players.forEach((p, i) => { if (i === 0) return; p.name = keep[i].name; p.look = keep[i].look; p.finisherId = keep[i].finisher; p.skill = keep[i].skill; p.botType = 'standard'; p.afk = false; });
        resetDynamic(); finishedCount = 0; botsDonePrompted = true; hudChip.hidden = false; renderHud();
        document.body.classList.add('build-race'); beginRound();
    }
    function renderHud() { hudChip.innerHTML = '<b>ROUND ' + B.round + '/' + ROUNDS + '</b>' + scoreChips(0) + '<span class="bd-t" id="bd-t"></span>'; }
    function zap(i, p) {
        B.zapT[i] = 0.9; sfx('stumble'); burst(p.x, p.y, '#ff5470', 22, 300); ring(p.x, p.y, '#ff5470', 70);
        if (p.local) { camShake = Math.max(camShake, 8); haptic([40, 30, 70]); }
        p.x = PLAY_W() / 2 + rr(-60, 60); p.y = START_Y - 20 - p.r; p.vx = 0; p.vy = 0; p.mode = 'air'; p.plat = null; p.charged = false; p.best = START_Y;
    }
    // called every sim step from update()
    function update(dt) {
        if (!B.on || B.phase !== 'race') return;
        if (state === 'playing') {
            B.startedRace = true; B.raceT += dt;
            const t = $('bd-t'); if (t) t.textContent = Math.max(0, Math.ceil(RACE_LIMIT - B.raceT)) + 's';
            const spikes = platforms.filter(pl => pl.type === 'spike' && pl.active);
            for (let i = 0; i < players.length; i++) {
                const p = players[i]; B.zapT[i] -= dt;
                if (p.finished || p.ufoHold || B.zapT[i] > 0) continue;
                for (const s of spikes) {
                    if (Math.abs(p.x - s.x) < s.w / 2 + p.r * 0.55 && Math.abs(p.y - s.y) < s.h / 2 + p.r * 0.75) {
                        zap(i, p);
                        if (s.owner !== i && !B.hitFor[s.owner].has(i)) { B.hitFor[s.owner].add(i); B.trapPts[s.owner] += TRAP_PTS; const col = PCOL[s.owner]; burst(p.x, p.y - 30, col, 12, 160); if (s.owner === 0) sfx('claim'); }
                        break;
                    }
                }
            }
            if (B.raceT > RACE_LIMIT) endRace();
        }
    }
    function checkEnd() { if (B.on && B.phase === 'race' && finishedCount >= 4) { state = 'finished'; setTimeout(endRace, 900); } }
    let ending = false;
    async function endRace() {
        if (!B.on || B.phase !== 'race' || ending) return; ending = true; B.phase = 'result'; state = 'finished'; dragging = false;
        document.body.classList.remove('build-race'); hudChip.hidden = true;
        const fin = players.filter(p => p.finished).sort((a, b) => a.finishTime - b.finishTime);
        const rows = players.map((p, i) => { const pl = fin.indexOf(p); const fp = pl >= 0 ? POINTS[pl] : 0; return { i, place: pl >= 0 ? pl + 1 : 0, fp, tp: B.trapPts[i], time: p.finished ? p.finishTime : 0 }; });
        rows.forEach(r => { B.scores[r.i] += r.fp + r.tp; });
        sfx(rows[0].place === 1 ? 'finish' : 'count');
        const last = B.round >= ROUNDS;
        panel.hidden = false; panel.className = 'bd-panel';
        panel.innerHTML = '<div class="bd-ph"><small>ROUND ' + B.round + ' / ' + ROUNDS + '</small><h2>' + (rows[0].place === 1 ? 'YOU WON THE ROUND' : rows[0].place ? 'YOU FINISHED ' + ['1ST', '2ND', '3RD', '4TH'][rows[0].place - 1] : 'YOU DID NOT FINISH') + '</h2></div><div class="bd-tbl">' +
            rows.slice().sort((a, b) => B.scores[b.i] - B.scores[a.i]).map(r => '<div class="bd-tr' + (r.i === 0 ? ' me' : '') + '" style="--pc:' + PCOL[r.i] + '"><i></i><b>' + (r.i === 0 ? 'YOU' : B.roster[r.i].name) + '</b><span>' + (r.place ? ['1st', '2nd', '3rd', '4th'][r.place - 1] : 'DNF') + ' +' + r.fp + (r.tp ? ' <em>trap +' + r.tp + '</em>' : '') + '</span><strong>' + B.scores[r.i] + '</strong></div>').join('') + '</div>' +
            '<button class="btn bd-next" id="bd-next" type="button">' + (last ? 'FINAL RESULT' : 'NEXT ROUND') + '</button>';
        $('bd-next').onclick = () => { sfx('select'); panel.hidden = true; ending = false; if (last) finalResult(); else { B.round++; buildPhase(); } };
    }
    function finalResult() {
        const order = [0, 1, 2, 3].sort((a, b) => B.scores[b] - B.scores[a]); const place = order.indexOf(0) + 1;
        const rw = rewardRace(place, true, B.lootId);
        sfx(place === 1 ? 'levelup' : 'finish');
        panel.hidden = false; panel.className = 'bd-panel fin';
        panel.innerHTML = '<div class="bd-ph"><small>BUILD RACE</small><h2>' + (place === 1 ? 'YOU WIN!' : ['', '', '3RD PLACE', '4TH PLACE'][place - 1] || '2ND PLACE') + '</h2></div><div class="bd-tbl">' +
            order.map((i, k) => '<div class="bd-tr' + (i === 0 ? ' me' : '') + '" style="--pc:' + PCOL[i] + '"><i></i><b>' + (i === 0 ? 'YOU' : B.roster[i].name) + '</b><span>' + ['1st', '2nd', '3rd', '4th'][k] + '</span><strong>' + B.scores[i] + '</strong></div>').join('') + '</div>' +
            '<div class="loot-drop" id="bd-loot"></div>' +
            '<div class="bd-rw">' + (rw.noDrop ? R('coin', rw.coins, { plus: true }) + R('xp', rw.xp, { plus: true }) + R('pass', rw.passPoints, { plus: true }) : '') + '</div>' +
            '<button class="btn bd-next" id="bd-again" type="button">PLAY AGAIN</button><button class="btn ghost" id="bd-menu" type="button" style="margin-top:10px">MAIN MENU</button>';
        if (!rw.noDrop) renderLootDrop('bd-loot', rw);
        $('bd-again').onclick = () => { panel.hidden = true; start(); };
        $('bd-menu').onclick = () => { panel.hidden = true; leave(true); };
    }

    /* ----------------------------------------------------------------------------------- lifecycle ---- */
    function begin() {                                     // called from startGame() once the lobby is done
        B.on = true; window.buildMatch = true; ending = false;
        gameMode = 'race'; esc = null; pk = null; lv = null; showScreen('');
        document.body.classList.remove('mode-escape', 'mode-parkour', 'mode-level');
        B.round = 1; B.scores = [0, 0, 0, 0]; B.pieces = []; B.lootId = newLootId('race');
        makeCourse(matchSeed);
        initPlayers();
        B.roster = players.map((p, i) => ({ name: p.name, look: p.look, finisher: p.look && p.look.finisher, skill: p.skill, pers: i === 0 ? 'you' : ['trapper', 'helper', 'chaos', 'trapper'][Math.floor(Math.random() * 4)] }));
        buildPhase();
    }
    function start() {
        window.buildQueued = true; startMatchmaking();
    }
    function leave(toMenu) {
        if (B.savedTrack === null) {}
        B.on = false; window.buildMatch = false; B.phase = 'idle'; root.hidden = true; panel.hidden = true; hudChip.hidden = true; ghost.kind = null; ending = false;
        document.body.classList.remove('bd-building', 'build-race');
        FINISH_Y = ORIG.f; TRACK = ORIG.t;
        if (toMenu) { state = 'menu'; gameMode = 'race'; hud.style.display = 'none'; refreshStartMeta(); showScreen('start'); }
    }
    $('bd-x').onclick = () => { openPrompt('LEAVE BUILD RACE?', 'Your progress in this match is lost.', [['Keep playing', () => {}], ['Leave', () => leave(true), true]]); };
    function open() {
        let seen = false; try { seen = localStorage.getItem('rr_build_seen') === '1'; } catch (e) {}
        if (seen) return start();
        panel.hidden = false; panel.className = 'bd-panel intro';
        panel.innerHTML = '<div class="bd-ph"><small>NEW MODE</small><h2>BUILD RACE</h2></div><ol class="bd-how"><li><b>1</b><span>Each round you place <em>one</em> piece on the course: a helper or a trap.</span></li><li><b>2</b><span>Then everyone races it. Finish first for the most points.</span></li><li><b>3</b><span>Spikes send rivals back to the start and score you <em>+2</em> per rival caught.</span></li></ol><button class="btn bd-next" id="bd-go" type="button">LET\'S BUILD</button><button class="btn ghost" id="bd-no" type="button" style="margin-top:10px">BACK</button>';
        $('bd-go').onclick = () => { try { localStorage.setItem('rr_build_seen', '1'); } catch (e) {} panel.hidden = true; start(); };
        $('bd-no').onclick = () => { panel.hidden = true; };
    }

    // bots keep out of spikes: does the jump arc cross one?
    function arcHitsSpike(p, vx, vy) {
        if (!B.on) return false; const g = playerG(p); const spikes = platforms.filter(pl => pl.type === 'spike');
        if (!spikes.length) return false;
        for (let t = 0.05; t < 1.6; t += 0.05) {
            const x = p.x + vx * t, y = p.y + vy * t + 0.5 * g * t * t;
            for (const s of spikes) if (Math.abs(x - s.x) < s.w / 2 + p.r + 4 && Math.abs(y - s.y) < s.h / 2 + p.r + 6) return true;
        }
        return false;
    }
    window.addEventListener('resize', () => { if (!root.hidden) fit(); });
    render();
    window.Build = { open, begin, update, checkEnd, leave, arcHitsSpike, state: B, PIECES };
})();
