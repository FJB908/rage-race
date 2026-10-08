// ARENA THEMES: every arena of the trophy road has its own sky, far-away props, drifting air, platform colour and flavour for the power-ups.
// Classic script, loaded AFTER game.js and trophies.js. Quick play and Build Race use the arena your trophies put you in; a party match always uses
// the Playground so every friend sees the same thing. It is only a look: no rule changes (see docs/ARENAS.md for the rules that may come later).
//   - sky: a vertical gradient that shifts from "low" (start) to "high" (finish) as you climb
//   - far props: a few seeded silhouettes that move at a quarter of the camera speed (parallax), at most ~14 on screen
//   - air: up to 26 drifting specks (dust, snow, ash, sparks, rain, stars...)
//   - plat: the colour of the normal platforms (the special ones keep their meaning colours)
//   - items: names and colours of the Stun Bomb and the Earthquake, and a bias that makes some power-ups a bit more common here
(function () {
    'use strict';
    const PLAT0 = Object.assign({}, PLAT), ITEMS0 = JSON.parse(JSON.stringify(ITEMS));
    const T = [
        { name: 'Playground',    sky: [['#2b78c9', '#8fd0ff'], ['#1f5fae', '#6fb8f2']], plat: '#4ade80', prop: ['block', 'cloud', 'balloon'], pc: '#ffffff', air: ['dust', '#ffffff', 0.5], grid: 'rgba(255,255,255,0.10)',
          items: {}, bias: {} },
        { name: 'Parking Lot',   sky: [['#171a22', '#343a49'], ['#0f1218', '#202633']], plat: '#f2c230', prop: ['cone', 'lamp', 'car'], pc: '#0b0d12', air: ['dust', '#c9d1e3', 0.35], grid: 'rgba(255,255,255,0.045)',
          items: { bomb: ['CAR ALARM!', '#ffd400'], quake: ['POTHOLE!', '#ff9838'] }, bias: { bomb: 1.3 } },
        { name: 'Rooftop',       sky: [['#6a2f5a', '#ff9a5c'], ['#2b1d4a', '#c8527a']], plat: '#d8b98a', prop: ['building', 'antenna', 'tower'], pc: '#1b1226', air: ['dust', '#ffd9b0', 0.4], grid: 'rgba(255,255,255,0.05)',
          items: { bomb: ['FIREWORK!', '#ff7a3d'], quake: ['ROOF CAVE-IN!', '#ff5470'] }, bias: { dj: 1.4 } },
        { name: 'Harbour',       sky: [['#0a2038', '#1c5a85'], ['#07121f', '#123a5c']], plat: '#b98a5a', prop: ['crane', 'crate', 'lighthouse'], pc: '#050d17', air: ['rain', '#9fd2ff', 0.28], grid: 'rgba(160,210,255,0.05)',
          items: { bomb: ['DEPTH CHARGE!', '#35b6ff'], quake: ['TIDAL WAVE!', '#4aa8ff'] }, bias: { bounce: 1.4 } },
        { name: 'Factory',       sky: [['#1a1411', '#4a3320'], ['#100c0a', '#2c1e14']], plat: '#b8c0d0', prop: ['chimney', 'gear', 'pipe'], pc: '#0c0907', air: ['spark', '#ffb02e', 0.8], grid: 'rgba(255,176,46,0.05)',
          items: { bomb: ['STEAM BLAST!', '#ffb02e'], quake: ['PISTON SLAM!', '#ff7a3d'] }, bias: { chain: 1.4 } },
        { name: 'Subway',        sky: [['#0c1f1d', '#1d4a43'], ['#071312', '#13302c']], plat: '#a5d86a', prop: ['pillar', 'hanglamp', 'sign'], pc: '#04100f', air: ['dust', '#a8f0d8', 0.3], grid: 'rgba(120,255,214,0.05)',
          items: { bomb: ['SHORT CIRCUIT!', '#b5ff5e'], quake: ['TRAIN RUMBLE!', '#ff5470'] }, bias: { shield: 1.3, bomb: 1.15 } },
        { name: 'Mountain',      sky: [['#274a7a', '#b9d9f2'], ['#1b3560', '#8db6dd']], plat: '#8aa0b8', prop: ['peak', 'peak', 'cloud'], pc: '#dbe9f7', air: ['snow', '#ffffff', 0.7], grid: 'rgba(255,255,255,0.10)',
          items: { bomb: ['SNOWBALL!', '#bfe6ff'], quake: ['AVALANCHE!', '#e8f6ff'] }, bias: { giant: 1.4 } },
        { name: 'Space Station', sky: [['#04040d', '#14133a'], ['#020207', '#0b0a24']], plat: '#d6d9e8', prop: ['planet', 'panel', 'sat'], pc: '#2a2d55', air: ['star', '#ffffff', 0.9], grid: 'rgba(179,169,255,0.05)',
          items: { bomb: ['ION BURST!', '#9f8bff'], quake: ['METEOR!', '#b3a9ff'] }, bias: { dj: 1.6, bounce: 1.2 } },
        { name: 'Volcano',       sky: [['#1a0707', '#6a1d10'], ['#0e0303', '#3f0f08']], plat: '#a1887f', prop: ['volcano', 'rock', 'volcano'], pc: '#0a0202', air: ['ash', '#ff8a5c', 0.6], grid: 'rgba(255,90,40,0.06)',
          items: { bomb: ['LAVA BOMB!', '#ff5a1f'], quake: ['ERUPTION!', '#ff3b1d'] }, bias: { rocket: 1.5, quake: 1.3 } },
        { name: 'Summit',        sky: [['#10131f', '#343a5c'], ['#07080f', '#1d2140']], plat: '#ffcf3f', prop: ['storm', 'storm', 'peak'], pc: '#0a0c16', air: ['rain', '#cfd8ff', 0.4], grid: 'rgba(255,224,120,0.05)',
          items: { bomb: ['THUNDER!', '#ffe45e'], quake: ['LIGHTNING STRIKE!', '#ffe45e'] }, bias: { cannon: 1.5, quake: 1.2 } },
    ];
    let cur = null, idx = -1, props = [], air = [], lastT = 0, flash = 0, flashAt = 0, tagEl = null;

    const hex = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
    const mixc = (a, b, k) => { const A = hex(a), B = hex(b); return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(',') + ')'; };
    const rng = s => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };

    function restore() {
        Object.assign(PLAT, PLAT0);
        for (const k in ITEMS0) { ITEMS[k].name = ITEMS0[k].name; ITEMS[k].color = ITEMS0[k].color; }
    }
    // choose the arena for this race (a party match shares the Playground)
    function pick(seed) {
        let i = 0;
        if (!window.partyMatch && window.Trophies) { try { i = Trophies.arenaOf(prog().tr || 0); } catch (e) { i = 0; } }
        set(i, seed || 1);
    }
    function set(i, seed) {
        restore(); idx = Math.max(0, Math.min(T.length - 1, i)); cur = T[idx];
        PLAT.normal = cur.plat;
        for (const k in cur.items) { ITEMS[k].name = cur.items[k][0]; ITEMS[k].color = cur.items[k][1]; }
        const r = rng((seed | 0) + idx * 97), n = 26; props = [];
        for (let a = 0; a < n; a++) props.push({ d: a * 170 + r() * 90, x: r(), s: 0.7 + r() * 0.7, k: cur.prop[Math.floor(r() * cur.prop.length)], f: r() });
        air = []; const cnt = 26; for (let a = 0; a < cnt; a++) air.push({ x: r(), y: r(), s: 0.5 + r(), v: 0.4 + r() * 0.8 });
        flash = 0; flashAt = 3 + r() * 5; lastT = 0;
        banner(cur.name, idx);
    }
    function clear() { restore(); cur = null; idx = -1; if (tagEl) tagEl.classList.remove('on'); }
    function banner(name, i) {
        if (!tagEl) { tagEl = document.createElement('div'); tagEl.id = 'arena-tag'; document.body.appendChild(tagEl); }
        tagEl.innerHTML = '<small>ARENA ' + (i + 1) + '</small><b>' + name.toUpperCase() + '</b>';
        tagEl.classList.remove('on'); void tagEl.offsetWidth; tagEl.classList.add('on');
        clearTimeout(banner._t); banner._t = setTimeout(() => tagEl && tagEl.classList.remove('on'), 3200);
    }
    const on = () => !!cur;

    /* ------------------------------------------------------------------------------ props ---- */
    const poly = (c, pts) => { c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.fill(); };
    const rr = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); c.fill(); };
    const PR = {
        block(c, s, t) { const cols = ['#ff6b6b', '#ffd166', '#4ecdc4']; for (let i = 0; i < 3; i++) { c.fillStyle = cols[i]; rr(c, -30 + i * 6 + (i % 2) * 8, -i * 30, 54, 30, 6); } },
        cloud(c, s) { c.fillStyle = 'rgba(255,255,255,0.8)'; for (const q of [[-30, 0, 20], [-8, -12, 26], [18, -2, 22], [40, 4, 16]]) { c.beginPath(); c.arc(q[0], q[1], q[2], 0, 7); c.fill(); } },
        balloon(c, s, t, p) { c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 60); c.stroke(); c.fillStyle = ['#ff6b6b', '#ffd166', '#b3a9ff'][Math.floor(p.f * 3)]; c.beginPath(); c.ellipse(0, -4, 20, 26, 0, 0, 7); c.fill(); },
        cone(c) { c.fillStyle = '#ff7a2d'; poly(c, [[-18, 0], [-5, -52], [5, -52], [18, 0]]); c.fillStyle = '#fff'; c.fillRect(-12, -22, 24, 7); c.fillStyle = '#111'; c.fillRect(-22, 0, 44, 6); },
        lamp(c, s, t, p) { c.fillStyle = '#10131a'; c.fillRect(-3, -150, 6, 150); c.fillRect(-3, -150, 34, 5); const fl = (Math.sin(t * 9 + p.f * 20) > -0.7) ? 1 : 0.25; c.fillStyle = 'rgba(255,224,150,' + 0.9 * fl + ')'; c.fillRect(22, -146, 14, 6); c.fillStyle = 'rgba(255,224,150,' + 0.12 * fl + ')'; poly(c, [[22, -140], [36, -140], [64, 0], [-6, 0]]); },
        car(c) { c.fillStyle = '#0b0d12'; rr(c, -48, -26, 96, 24, 8); rr(c, -26, -46, 52, 26, 10); c.fillStyle = '#1b2230'; c.beginPath(); c.arc(-28, 0, 10, 0, 7); c.arc(28, 0, 10, 0, 7); c.fill(); },
        building(c, s, t, p) { const w = 70 + p.f * 40, h = 140 + p.f * 120; c.fillRect(-w / 2, -h, w, h); c.fillStyle = 'rgba(255,200,120,0.65)'; for (let y = -h + 14; y < -10; y += 22) for (let x = -w / 2 + 8; x < w / 2 - 10; x += 18) if (((x * 7 + y * 13) | 0) % 3) c.fillRect(x, y, 8, 10); },
        antenna(c, s, t) { c.fillRect(-2, -170, 4, 170); c.fillRect(-18, -140, 36, 3); c.fillRect(-12, -110, 24, 3); c.fillStyle = (Math.sin(t * 3) > 0) ? '#ff4d4d' : '#5a1a1a'; c.beginPath(); c.arc(0, -172, 4, 0, 7); c.fill(); },
        tower(c) { c.fillRect(-26, -70, 52, 46); poly(c, [[-30, -70], [0, -96], [30, -70]]); c.fillRect(-22, -24, 4, 24); c.fillRect(18, -24, 4, 24); },
        crane(c) { c.fillRect(-4, -220, 8, 220); c.fillRect(-90, -222, 190, 8); c.fillRect(70, -214, 3, 60); c.fillRect(-90, -214, 3, 24); c.fillStyle = 'rgba(255,160,60,0.8)'; c.fillRect(66, -156, 12, 8); },
        crate(c) { c.fillRect(-34, -36, 68, 36); c.fillRect(-22, -72, 52, 36); c.strokeStyle = 'rgba(120,180,230,0.25)'; c.lineWidth = 2; c.strokeRect(-34, -36, 68, 36); },
        lighthouse(c, s, t) { poly(c, [[-18, 0], [-10, -120], [10, -120], [18, 0]]); c.fillRect(-14, -136, 28, 16); c.fillStyle = 'rgba(255,240,170,0.85)'; c.fillRect(-9, -134, 18, 12); c.fillStyle = 'rgba(255,240,170,' + (0.1 + 0.08 * Math.sin(t * 2)) + ')'; poly(c, [[9, -128], [260, -170], [260, -90]]); },
        chimney(c, s, t, p) { c.fillRect(-16, -200, 32, 200); c.fillStyle = 'rgba(255,255,255,0.1)'; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(Math.sin(t * 0.6 + i + p.f * 9) * 10 + i * 6, -214 - i * 26, 14 + i * 5, 0, 7); c.fill(); } },
        gear(c, s, t, p) { c.save(); c.rotate(t * 0.4 * (p.f > 0.5 ? 1 : -1)); const R = 46; c.beginPath(); for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12, r = i % 2 ? R : R * 0.82; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fill(); c.fillStyle = 'rgba(0,0,0,0.4)'; c.beginPath(); c.arc(0, 0, 14, 0, 7); c.fill(); c.restore(); },
        pipe(c) { c.fillRect(-60, -16, 120, 16); c.fillRect(-60, -90, 14, 90); c.fillRect(46, -16, 14, -60); },
        pillar(c) { c.fillRect(-14, -200, 28, 200); c.fillStyle = 'rgba(120,255,214,0.12)'; c.fillRect(-14, -200, 5, 200); },
        hanglamp(c, s, t, p) { c.fillRect(-1.5, -140, 3, 100); const fl = Math.sin(t * 7 + p.f * 30) > -0.8 ? 1 : 0.3; c.fillStyle = 'rgba(190,255,230,' + 0.9 * fl + ')'; rr(c, -18, -40, 36, 8, 4); c.fillStyle = 'rgba(190,255,230,' + 0.1 * fl + ')'; poly(c, [[-18, -32], [18, -32], [40, 60], [-40, 60]]); },
        sign(c) { c.fillRect(-40, -60, 80, 30); c.fillStyle = 'rgba(190,255,230,0.55)'; c.fillRect(-34, -54, 68, 18); },
        peak(c, s, t, p) { const h = 120 + p.f * 90; poly(c, [[-70, 0], [0, -h], [70, 0]]); c.fillStyle = 'rgba(255,255,255,0.85)'; poly(c, [[-22, -h * 0.72], [0, -h], [22, -h * 0.72], [8, -h * 0.64], [-4, -h * 0.74]]); },
        planet(c, s, t, p) { const g = c.createRadialGradient(-14, -14, 6, 0, 0, 56); g.addColorStop(0, '#6b6fd0'); g.addColorStop(1, '#1d1f55'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 54, 0, 7); c.fill(); c.strokeStyle = 'rgba(190,180,255,0.4)'; c.lineWidth = 5; c.beginPath(); c.ellipse(0, 0, 86, 16, -0.3, 0, 7); c.stroke(); },
        panel(c, s, t) { c.fillStyle = 'rgba(210,220,255,0.18)'; c.fillRect(-60, -40, 120, 80); c.fillStyle = 'rgba(210,220,255,0.35)'; c.fillRect(-60, -2, 120, 4); c.fillRect(-2, -40, 4, 80); },
        sat(c, s, t) { c.rotate(Math.sin(t * 0.3) * 0.2); c.fillStyle = 'rgba(210,220,255,0.35)'; c.fillRect(-12, -10, 24, 20); c.fillStyle = 'rgba(120,150,255,0.45)'; c.fillRect(-54, -6, 38, 12); c.fillRect(16, -6, 38, 12); },
        volcano(c, s, t, p) { poly(c, [[-120, 0], [-26, -130], [26, -130], [120, 0]]); const g = c.createLinearGradient(0, -134, 0, -100); g.addColorStop(0, 'rgba(255,110,40,0.95)'); g.addColorStop(1, 'rgba(255,110,40,0)'); c.fillStyle = g; c.fillRect(-26, -134, 52, 34); c.fillStyle = 'rgba(255,110,40,' + (0.12 + 0.06 * Math.sin(t * 3 + p.f * 9)) + ')'; c.beginPath(); c.arc(0, -134, 62, 0, 7); c.fill(); },
        rock(c) { poly(c, [[-40, 0], [-30, -34], [-6, -52], [24, -36], [42, 0]]); },
        storm(c, s, t, p) { c.fillStyle = 'rgba(60,66,100,0.9)'; for (const q of [[-50, 0, 30], [-14, -18, 40], [30, -4, 34], [64, 6, 24]]) { c.beginPath(); c.arc(q[0], q[1], q[2], 0, 7); c.fill(); } },
    };
    const VIEW_F = 0.25;
    function drawSky(c, W, H, camY) {
        if (!cur) return;
        const now = performance.now() / 1000, dt = Math.min(0.05, lastT ? now - lastT : 0); lastT = now;
        const prog_ = Math.max(0, Math.min(1, (START_Y - camY) / Math.max(1, TRACK)));
        const a = cur.sky[0], b = cur.sky[1], g = c.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, mixc(a[0], b[0], prog_)); g.addColorStop(1, mixc(a[1], b[1], prog_));
        c.fillStyle = g; c.fillRect(0, 0, W, H);
        // far props (parallax): a prop at depth d sits at screen y = base - d + climbed * VIEW_F
        const climbed = (START_Y - VH * 0.62) - camY, base = H * 0.96;
        c.fillStyle = cur.pc;
        for (const p of props) {
            const y = base - p.d + climbed * VIEW_F; if (y < -240 || y > H + 80) continue;
            c.save(); c.translate(W * (0.08 + p.x * 0.84), y); c.scale(p.s, p.s); c.fillStyle = cur.pc; c.globalAlpha = 0.78;
            PR[p.k](c, p.s, now, p); c.restore();
        }
        // air: a few specks that drift (the kind depends on the arena)
        const kind = cur.air[0], col = cur.air[1], dens = cur.air[2]; c.fillStyle = col; c.strokeStyle = col;
        for (let i = 0; i < air.length; i++) {
            const q = air[i]; if (i / air.length > dens + 0.15) break;
            if (kind === 'snow') { q.y += dt * 0.07 * q.v; q.x += Math.sin(now + i) * dt * 0.01; }
            else if (kind === 'rain') q.y += dt * 1.3 * q.v;
            else if (kind === 'ash') { q.y += dt * 0.05 * q.v; q.x += dt * 0.02; }
            else if (kind === 'spark') q.y -= dt * 0.18 * q.v;
            else if (kind === 'star') { /* fixed, twinkling */ }
            else { q.y -= dt * 0.02 * q.v; q.x += dt * 0.012; }
            if (q.y > 1.02) q.y = -0.02; if (q.y < -0.02) q.y = 1.02; if (q.x > 1.02) q.x = -0.02; if (q.x < -0.02) q.x = 1.02;
            const x = q.x * W, y = q.y * H;
            if (kind === 'rain') { c.globalAlpha = 0.35; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 3, y + 14 * q.s); c.stroke(); }
            else if (kind === 'star') { c.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(now * (0.6 + q.v) + i)); c.fillRect(x, y, 1.6 * q.s, 1.6 * q.s); }
            else { c.globalAlpha = kind === 'spark' ? 0.9 : 0.55; c.beginPath(); c.arc(x, y, (kind === 'snow' ? 2.2 : kind === 'spark' ? 1.5 : 1.8) * q.s, 0, 7); c.fill(); }
        }
        c.globalAlpha = 1;
        if (idx === 9) {                                                   // Summit: a cosmetic lightning flash now and then (it never touches the platforms)
            flashAt -= dt; if (flashAt <= 0) { flash = 1; flashAt = 4 + Math.random() * 7; }
            if (flash > 0) { c.fillStyle = 'rgba(255,255,230,' + 0.22 * flash + ')'; c.fillRect(0, 0, W, H); flash -= dt * 3.2; }
        }
    }
    function bias(w) { if (!cur) return; for (const k in cur.bias) if (w[k] > 0) w[k] *= cur.bias[k]; }
    window.ArenaTheme = { pick, set, clear, on, drawSky, bias, grid: () => cur ? cur.grid : null, index: () => idx, THEMES: T };
})();
