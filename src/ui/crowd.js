// THE GAUNTLET CROWD: on the home screen, while the Gauntlet is the selected mode, 32 little characters cheer on a grandstand behind your player (the Gauntlet is a 32 player race, so this is the field watching).
// Everybody wears a random look (skins, hats, faces, costumes: the same pool as the bots). They hop, wave their arms, some hold a pennant, now and then the stadium wave runs through the stands, and cameras flash.
// Cost: two canvases. The stands are painted once; the crowd canvas redraws about 30 times a second (32 small sprite stamps + a few arms) and only while it can be seen. It thins itself out on a slow phone.
// Loaded AFTER game.js. game.js calls Crowd.sync() from refreshMenu().
(function () {
    'use strict';
    const GOLD = '#ffcf3f', H = 250, SP = 72;                     // canvas height in css px, sprite size in px
    const ROWS = [{ n: 11, size: 31, floor: 100 }, { n: 11, size: 35, floor: 162 }, { n: 10, size: 39, floor: 224 }];      // back to front: 32 people, one for every runner of the Gauntlet
    const BUNT = [GOLD, '#ffffff', '#35e0c8', '#ff8ae6', '#b3a9ff'];
    const reduce = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
    const rnd = (a, b) => a + Math.random() * (b - a);
    let wrap = null, cvS, cvD, cvB, gS, gD, W = 0, dpr = 1, members = [], pending = [], raf = 0, last = 0, t = 0, lite = false, slowN = 0, shown = false, plain = null;
    let paused = false, nextWave = 3, waveAt = -99, flashes = [], conf = [], nextFlash = 1, wasOn = false;

    /* ------------------------------------------------------------------ dom ---- */
    function ensure() {
        if (wrap) return true;
        const stage = document.querySelector('#s-start .m-stage'); if (!stage) return false;
        wrap = document.createElement('div'); wrap.className = 'm-crowd'; wrap.setAttribute('aria-hidden', 'true');
        cvS = document.createElement('canvas'); cvD = document.createElement('canvas'); cvB = document.createElement('canvas'); wrap.appendChild(cvS); wrap.appendChild(cvD); wrap.appendChild(cvB);
        stage.insertBefore(wrap, stage.firstChild); gS = cvS.getContext('2d'); gD = cvD.getContext('2d');
        addEventListener('resize', () => { if (shown) place(true); });
        return true;
    }
    // the bottom of the stands meets the ledge of the player, whatever the height of the screen is
    function place(force) {
        const isle = document.querySelector('#s-start .m-isle'); if (!wrap || !isle || !isle.offsetHeight) return;
        wrap.style.top = Math.round(isle.offsetTop + isle.offsetHeight - 40 + 8 - H) + 'px';
        const w = Math.round(innerWidth);
        if (force || w !== W) {
            W = w; dpr = Math.min(1.25, window.devicePixelRatio || 1);
            for (const c of [cvS, cvD, cvB]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); c.style.width = W + 'px'; c.style.height = H + 'px'; }
            layout(); paintStands(); paintBarrier();
        }
    }

    /* ------------------------------------------------------------ the stands ---- */
    function paintStands() {
        const g = gS; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
        let gr = g.createLinearGradient(0, 0, 0, ROWS[0].floor); gr.addColorStop(0, 'rgba(14,18,28,0)'); gr.addColorStop(.5, 'rgba(14,18,28,.78)'); gr.addColorStop(1, 'rgba(18,23,35,.96)');
        g.fillStyle = gr; g.fillRect(0, 0, W, ROWS[0].floor + 2);
        for (const side of [0, 1]) {                                                               // two floodlight banks high on the back wall
            const x = side ? W - 34 : 10; g.fillStyle = '#1b2231'; g.fillRect(x, 16, 24, 30); g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(x, 16, 24, 2);
            for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) { const px = x + 4 + c * 5.4, py = 23 + r * 8, gl = g.createRadialGradient(px, py, 0, px, py, 6); gl.addColorStop(0, '#fff'); gl.addColorStop(.35, 'rgba(255,230,160,.8)'); gl.addColorStop(1, 'rgba(255,207,63,0)'); g.fillStyle = gl; g.fillRect(px - 6, py - 6, 12, 12); }
        }
        g.globalCompositeOperation = 'lighter';                                                    // two soft floodlight beams, painted once
        for (const side of [0, 1]) { g.save(); g.translate(side ? W - 22 : 22, 30); g.rotate(side ? -.3 : .3); const bl = g.createLinearGradient(0, 0, 0, 200); bl.addColorStop(0, 'rgba(255,236,170,.2)'); bl.addColorStop(1, 'rgba(255,236,170,0)'); g.fillStyle = bl; g.beginPath(); g.moveTo(-3, 0); g.lineTo(3, 0); g.lineTo(38, 200); g.lineTo(-38, 200); g.closePath(); g.fill(); g.restore(); }
        g.globalCompositeOperation = 'source-over';
        const y0 = 40, sag = 9, n = Math.max(10, Math.round(W / 30));                              // bunting along the top of the wall
        g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1.2; g.beginPath(); for (let i = 0; i <= 40; i++) { const x = W * i / 40, y = y0 + Math.sin(Math.PI * i / 40) * sag; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
        for (let i = 0; i < n; i++) { const k = (i + .5) / n, x = W * k, y = y0 + Math.sin(Math.PI * k) * sag; g.fillStyle = BUNT[i % BUNT.length]; g.globalAlpha = .9; g.beginPath(); g.moveTo(x - 6, y); g.lineTo(x + 6, y); g.lineTo(x, y + 13); g.closePath(); g.fill(); g.globalAlpha = 1; }
        ROWS.forEach((r, i) => {                                                                    // each row: a floor with a bright edge, and the riser under it
            const top = r.floor, rh = (ROWS[i + 1] ? ROWS[i + 1].floor : H) - top + 2;
            gr = g.createLinearGradient(0, top, 0, top + rh); gr.addColorStop(0, '#222c40'); gr.addColorStop(.12, '#161d2c'); gr.addColorStop(1, '#0d111a');
            g.fillStyle = gr; g.fillRect(0, top, W, rh);
            g.fillStyle = 'rgba(255,207,63,.5)'; g.fillRect(0, top, W, 1.5); g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(0, top + 1.5, W, 1);
            g.fillStyle = 'rgba(255,255,255,.035)'; const step = W / r.n; for (let c = 1; c < r.n; c++) g.fillRect(Math.round(c * step) - .5, top + 4, 1, rh - 6);
        });
        g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(5, ROWS[0].floor - 6, 2, H); g.fillRect(W - 7, ROWS[0].floor - 6, 2, H);      // railings at both ends
        fadeTop(g);
    }
    // the top of the stands melts into the sky (done in the pictures themselves, a CSS mask over a moving canvas would be re-painted every frame)
    function fadeTop(g) {
        const f = g.createLinearGradient(0, 0, 0, 86); f.addColorStop(0, 'rgba(0,0,0,1)'); f.addColorStop(1, 'rgba(0,0,0,0)');
        g.save(); g.globalCompositeOperation = 'destination-out'; g.fillStyle = f; g.fillRect(0, 0, W, 86); g.restore();
    }
    // the hoarding in front of the first row (drawn above the people, so their feet are hidden behind it)
    function paintBarrier() {
        const bh = H - (ROWS[ROWS.length - 1].floor + 1), g = cvB.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
        const y = H - bh, gr = g.createLinearGradient(0, y, 0, H); gr.addColorStop(0, '#2a3348'); gr.addColorStop(.2, '#171d2b'); gr.addColorStop(1, '#0b0e16'); g.fillStyle = gr; g.fillRect(0, y, W, bh);
        g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(0, y, W, 1.5); g.fillStyle = GOLD; g.globalAlpha = .55; g.fillRect(0, H - 2, W, 2); g.globalAlpha = 1;
        g.clearRect(0, y + 4, W, 3); LED.y = y + 4;                                                // a slot where the running light of the people canvas shows through
    }
    const LED = { y: 0 };

    /* ----------------------------------------------------------- the people ---- */
    function layout() {
        let idx = 0;
        ROWS.forEach((r, ri) => {
            const step = (W - 24) / r.n;
            for (let c = 0; c < r.n; c++) { const m = members[idx++]; if (!m) continue; m.row = ri; m.x = 12 + step * (c + .5) + m.jx * step; m.floor = r.floor + 3; m.size = r.size * m.sc; }
        });
    }
    function newLook() {
        const l = randomBotLook();
        const skins = SKINS.filter(i => i.id !== 'none' && !i.exclusive);
        return { skin: l.skin || (Math.random() < .12 ? null : skins[(Math.random() * skins.length) | 0].id), hat: l.hat, face: l.face, trail: 'none', costume: Math.random() < .86 ? 'none' : l.costume };
    }
    function measurePlain() {                                                                      // where the plain cube sits inside a sprite: every person is placed by its bottom edge
        if (plain) return plain;
        const cv = document.createElement('canvas'); cv.width = cv.height = SP; renderLook(cv, { skin: null, hat: 'none', face: 'none', trail: 'none', costume: 'none' }, { scale: .2, cy: .72, nofit: true });
        const d = cv.getContext('2d').getImageData(0, 0, SP, SP).data; let x0 = SP, x1 = 0, y0 = SP, y1 = 0;
        for (let y = 0; y < SP; y++) for (let x = 0; x < SP; x++) if (d[(y * SP + x) * 4 + 3] > 140) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        return (plain = { w: Math.max(8, x1 - x0), h: Math.max(8, y1 - y0), bottom: y1, cx: (x0 + x1) / 2 });
    }
    function makeSprite(look) {
        const cv = document.createElement('canvas'); cv.width = cv.height = SP;
        renderLook(cv, look, { scale: look.costume && look.costume !== 'none' ? .17 : .2, cy: .72, nofit: true });
        let col = '#2a9d8f';                                                                       // the arms: the colour of the body, a bit darker
        try { const p = cv.getContext('2d').getImageData(Math.round(plain.cx - plain.w * .32), plain.bottom - Math.round(plain.h * .18), 1, 1).data; if (p[3] > 200) col = 'rgb(' + (p[0] * .8 | 0) + ',' + (p[1] * .8 | 0) + ',' + (p[2] * .8 | 0) + ')'; } catch (e) {}
        return { cv, col };
    }
    // a new crowd each time the Gauntlet is picked; the people come in a few at a time (each pops in), so the home never stalls
    function seed() {
        members = []; measurePlain();
        const total = ROWS.reduce((a, r) => a + r.n, 0);
        for (let i = 0; i < total; i++) members.push({ spr: null, col: '#2a9d8f', look: newLook(), jx: rnd(-.12, .12), sc: rnd(.94, 1.06), ph: rnd(0, 6.28), hz: rnd(1.4, 2.2), kind: Math.random() < .14 ? 2 : Math.random() < .35 ? 1 : 0, fc: BUNT[(Math.random() * BUNT.length) | 0], born: 0, x: 0, floor: 0, size: 40, row: 0 });
        pending = members.slice().sort(() => Math.random() - .5); layout();
    }
    function build() {
        for (let i = 0; i < 3 && pending.length; i++) { const m = pending.pop(); try { const s = makeSprite(m.look); m.spr = s.cv; m.col = s.col; } catch (e) { m.spr = null; } m.born = t; }
    }

    /* ------------------------------------------------------------ the picture ---- */
    function flag(g, x, y, ch, ph, col) {
        const L = ch * 1.0; g.save(); g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - L); g.stroke();
        g.fillStyle = col; g.beginPath(); g.moveTo(x, y - L); for (let i = 1; i <= 5; i++) g.lineTo(x + i * ch * .1, y - L + ch * .1 + Math.sin(ph * 1.3 - i * .9) * ch * .045 * (i * .4)); g.lineTo(x, y - L + ch * .3); g.closePath(); g.fill(); g.restore();
    }
    function star(g, x, y, r, a) {
        const gl = g.createRadialGradient(x, y, 0, x, y, r); gl.addColorStop(0, 'rgba(255,255,255,' + a + ')'); gl.addColorStop(.3, 'rgba(255,240,190,' + a * .5 + ')'); gl.addColorStop(1, 'rgba(255,207,63,0)');
        g.fillStyle = gl; g.fillRect(x - r, y - r, r * 2, r * 2); g.fillStyle = 'rgba(255,255,255,' + a + ')'; g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r * .12, y - r * .12); g.lineTo(x + r, y); g.lineTo(x + r * .12, y + r * .12); g.lineTo(x, y + r); g.lineTo(x - r * .12, y + r * .12); g.lineTo(x - r, y); g.lineTo(x - r * .12, y - r * .12); g.closePath(); g.fill();
    }
    function draw(dt) {
        const g = gD; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
        if (t > nextWave) { waveAt = t; nextWave = t + rnd(8, 12); }                                // the stadium wave runs from left to right
        const wx = (t - waveAt) * W / 2.4 - W * .1, exc = .55 + .3 * Math.sin(t * .6);
        for (const m of members) {
            if (!m.spr) continue;
            const e = 1 - Math.pow(1 - Math.min(1, (t - m.born) / .35), 3), w = Math.exp(-Math.pow((m.x - wx) / (W * .13), 2));
            const amp = m.size * (.1 + .2 * exc) + m.size * .5 * w, ph = t * m.hz * Math.PI * 2 + m.ph, s = Math.sin(ph), hop = Math.max(0, s) * amp * e, air = hop / Math.max(1, amp);
            const sy = (1 - .09 * (1 - air) * (s < 0 ? 1 : .4)) * (1 + .05 * air), sx = Math.min(1.07, 2 - sy);
            const ds = m.size / plain.w, cubeH = plain.h * ds, cubeW = m.size, base = m.floor - hop;
            if (w > .5 && !lite && Math.random() < .05 && conf.length < 36) conf.push({ x: m.x + rnd(-8, 8), y: base - cubeH - 6, vx: rnd(-30, 30), vy: rnd(-110, -40), r: rnd(0, 6), vr: rnd(-8, 8), c: BUNT[(Math.random() * BUNT.length) | 0], l: 1 });
            g.save(); g.translate(m.x + Math.sin(ph * .5) * 1.4 * (.5 + exc), base); g.scale(sx * e, sy * e);      // no rotation: a rotated image is the slow path of a canvas, a sway and a squash look as lively
            const armY = -cubeH * .5, lift = (m.kind === 1 ? Math.sin(ph * 2) * .1 : Math.sin(ph * 2 + 1)) * cubeH * .2, up = cubeH * (.42 + .22 * w) + lift;
            g.strokeStyle = m.col; g.fillStyle = m.col; g.lineCap = 'round'; g.lineWidth = Math.max(3, cubeH * .13);
            for (const sd of [-1, 1]) {                                                            // arms behind the body: a stalk and a hand
                const u = m.kind === 1 || sd < 0 ? up : cubeH * (.28 + .16 * Math.sin(ph * 2 + 2.4)), hx = sd * cubeW * .66, hy = armY - u;
                g.beginPath(); g.moveTo(sd * cubeW * .42, armY); g.lineTo(hx, hy); g.stroke(); g.beginPath(); g.arc(hx, hy, Math.max(2.4, cubeH * .09), 0, 7); g.fill();
                if (m.kind === 2 && sd < 0) flag(g, hx, hy, cubeH, ph, m.fc);
            }
            g.drawImage(m.spr, -plain.cx * ds, -plain.bottom * ds, SP * ds, SP * ds);
            g.restore();
        }
        if (conf.length) {                                                                         // confetti from the wave
            for (let i = conf.length - 1; i >= 0; i--) { const p = conf[i]; p.vy += 190 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt; p.l -= dt * .7; if (p.l <= 0) { conf.splice(i, 1); continue; } g.save(); g.globalAlpha = Math.min(1, p.l * 2); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.fillRect(-2.5, -1.5, 5, 3); g.restore(); }
        }
        const n = 22, gap = W / n; g.fillStyle = GOLD;                                              // the running light in the hoarding
        for (let i = 0; i < n; i++) { const k = Math.max(0, Math.sin(t * 3.2 - i * .55)); g.globalAlpha = .25 + .75 * k * k; g.fillRect(i * gap + 2, LED.y, gap - 4, 3); } g.globalAlpha = 1;
        if (!lite) {                                                                               // cameras flash in the stands
            if ((nextFlash -= dt) < 0) { const m = members[(Math.random() * members.length) | 0]; if (m && m.spr) flashes.push({ x: m.x + rnd(-6, 6), y: m.floor - m.size * rnd(.3, 1.1), t0: t }); nextFlash = rnd(.12, .5); }
            g.globalCompositeOperation = 'lighter';
            for (let i = flashes.length - 1; i >= 0; i--) { const f = flashes[i], a = 1 - (t - f.t0) / .3; if (a <= 0) { flashes.splice(i, 1); continue; } star(g, f.x, f.y, 6 + 10 * a, a); }
            g.globalCompositeOperation = 'source-over';
        }
    }

    /* ------------------------------------------------------------------ loop ---- */
    function active() {
        if (!shown || !wrap || document.hidden || !wrap.offsetParent) return false;
        const s = document.getElementById('s-start'); if (!s || !s.classList.contains('gauntlet-mode') || document.body.classList.contains('lb-open')) return false;
        const tab = document.querySelector('#m-body .m-tab.on'); return !!tab && tab.dataset.tab === 'home';
    }
    function tick(ts) {
        raf = 0; if (paused || !active()) return;
        raf = requestAnimationFrame(tick);
        if (ts - last < (lite ? 60 : 38)) return;                                                   // about 25 frames a second is plenty for a crowd
        const dt = Math.min(.1, (ts - last) / 1000); last = ts; t += dt;
        const t0 = performance.now(); build(); draw(dt); const spent = performance.now() - t0;
        if (spent > 7) { if (++slowN > 25) lite = true; } else if (slowN > 0) slowN--;               // on a slow phone: no flashes or confetti, 16 frames a second
    }
    function kick() { if (!raf && active()) { last = 0; raf = requestAnimationFrame(tick); } }
    setInterval(() => { if (!shown) return; if (active()) { place(false); kick(); } }, 600);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });

    function sync() {
        const s = document.getElementById('s-start'), on = !!(s && s.classList.contains('gauntlet-mode'));
        if (!on) { shown = false; wasOn = false; return; }
        if (!ensure()) return;
        shown = true; place(true);
        if (!wasOn) { wasOn = true; t = 0; nextWave = 3; conf = []; flashes = []; seed(); }
        if (reduce()) { while (pending.length) build(); t = 2; draw(.03); return; }
        kick();
    }
    window.Crowd = { sync, pause: v => { paused = !!v; } };
})();
