// COSTUMES: full-body outfits drawn on top of the player (a fourth cosmetic slot next to skin / hat / face / trail).
// Each costume is code, not a picture: it can draw behind the body (wings, flames, aura), replace the body itself (fur, scales, armour,
// jelly), replace the eyes and draw in front (horns, sparks, drips). Everything animates from the clock `t` (seconds).
// Classic script, loaded AFTER game.js (uses rrPath / outline / PCOL-style globals at call time).
(function () {
    'use strict';
    const TAU = Math.PI * 2;
    const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
    const star = (c, x, y, r) => { c.beginPath(); c.moveTo(x, y - r * 2); c.lineTo(x + r * 0.5, y - r * 0.5); c.lineTo(x + r * 2, y); c.lineTo(x + r * 0.5, y + r * 0.5); c.lineTo(x, y + r * 2); c.lineTo(x - r * 0.5, y + r * 0.5); c.lineTo(x - r * 2, y); c.lineTo(x - r * 0.5, y - r * 0.5); c.closePath(); c.fill(); };
    const glow = (c, x, y, r, col, a) => { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col.replace('A', a)); g.addColorStop(1, col.replace('A', 0)); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); };
    // a point on the edge of the body square, parameter u in 0..1 going round, with the outward normal and the tangent
    const perim = (u, s) => { const side = Math.floor(u * 4) % 4, f = u * 4 - Math.floor(u * 4); return [[-s + 2 * s * f, -s, 0, -1, 1, 0], [s, -s + 2 * s * f, 1, 0, 0, 1], [s - 2 * s * f, s, 0, 1, -1, 0], [-s, s - 2 * s * f, -1, 0, 0, -1]][side]; };
    const bodyPath = (c, s, k) => rrPath(c, -s, -s, s * 2, s * 2, 4 * k);
    const flame = (c, x, y, w, h, sway, c0, c1, c2) => {                       // one teardrop flame pointing up from (x,y)
        const g = c.createLinearGradient(0, y, 0, y - h); g.addColorStop(0, c0); g.addColorStop(0.55, c1); g.addColorStop(1, c2);
        c.fillStyle = g; c.beginPath(); c.moveTo(x - w, y); c.bezierCurveTo(x - w * 1.1, y - h * 0.45, x - w * 0.3 + sway, y - h * 0.7, x + sway * 1.4, y - h);
        c.bezierCurveTo(x + w * 0.3 + sway, y - h * 0.7, x + w * 1.1, y - h * 0.45, x + w, y); c.closePath(); c.fill();
    };
    const eyesAt = (c, k, lx, ly, fn) => { for (const sx of [-1, 1]) { c.save(); c.translate(sx * 4 * k + lx, -2 * k + ly); fn(sx); c.restore(); } };

    const DEFS = {
        /* ------------------------------------------------------------------------------ SLIME KING */
        slime: {
            body(c, s, k, t) {
                const N = 44; c.beginPath();
                for (let i = 0; i <= N; i++) {
                    const a = i / N * TAU, cx = Math.cos(a), sy = Math.sin(a), r = 1 + 0.05 * Math.sin(a * 3 + t * 3) + 0.035 * Math.sin(a * 5 - t * 4.3);
                    const x = Math.sign(cx) * Math.pow(Math.abs(cx), 0.34) * s * r, y = Math.sign(sy) * Math.pow(Math.abs(sy), 0.34) * s * r;
                    i ? c.lineTo(x, y) : c.moveTo(x, y);
                }
                c.closePath();
                const g = c.createRadialGradient(-s * 0.35, -s * 0.4, s * 0.1, 0, 0, s * 1.35); g.addColorStop(0, '#d8ff9a'); g.addColorStop(0.45, '#52d94f'); g.addColorStop(1, '#0c7a3a');
                c.globalAlpha = 0.95; c.fillStyle = g; c.fill(); c.globalAlpha = 1;
                c.save(); c.clip();
                c.fillStyle = 'rgba(255,255,255,0.28)';                                         // bubbles floating up inside
                for (let i = 0; i < 5; i++) { const p = (t * 0.22 + i * 0.21) % 1, bx = (hash(i + 3) * 1.4 - 0.7) * s + Math.sin(t * 2 + i) * 1.5 * k, by = s * 0.9 - p * s * 1.9, br = (0.9 + hash(i) * 1.4) * k; c.beginPath(); c.arc(bx, by, br, 0, TAU); c.fill(); c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 0.5 * k; c.stroke(); }
                c.restore();
                c.fillStyle = 'rgba(255,255,255,0.55)'; c.beginPath(); c.ellipse(-s * 0.45, -s * 0.62, s * 0.3, s * 0.13, -0.5, 0, TAU); c.fill();      // wet highlight
                c.fillStyle = 'rgba(255,255,255,0.8)'; c.beginPath(); c.arc(-s * 0.72, -s * 0.28, 1.1 * k, 0, TAU); c.fill();
                return true;
            },
            front(c, s, k, t) {
                for (let i = 0; i < 3; i++) {                                                   // drips hanging off the bottom
                    const x = (-0.55 + i * 0.55) * s, L = (2.5 + 2.6 * (0.5 + 0.5 * Math.sin(t * 1.6 + i * 2.1))) * k;
                    c.fillStyle = '#3fc74e'; c.beginPath(); c.moveTo(x - 1.7 * k, s - 0.5 * k); c.quadraticCurveTo(x - 1.2 * k, s + L, x, s + L + 1.4 * k); c.quadraticCurveTo(x + 1.2 * k, s + L, x + 1.7 * k, s - 0.5 * k); c.closePath(); c.fill();
                    c.fillStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.arc(x - 0.5 * k, s + L * 0.55, 0.5 * k, 0, TAU); c.fill();
                }
                const top = -s, gg = c.createLinearGradient(0, top - 9 * k, 0, top); gg.addColorStop(0, '#fff2a8'); gg.addColorStop(1, '#e0a01c');       // a little gold crown sitting in the goo
                c.fillStyle = gg; c.beginPath(); c.moveTo(-6 * k, top + 0.5 * k); c.lineTo(-6.5 * k, top - 6 * k); c.lineTo(-3 * k, top - 3 * k); c.lineTo(0, top - 8 * k); c.lineTo(3 * k, top - 3 * k); c.lineTo(6.5 * k, top - 6 * k); c.lineTo(6 * k, top + 0.5 * k); c.closePath(); c.fill(); outline(c, k, 0.8);
                c.fillStyle = '#ff4a6e'; c.beginPath(); c.arc(0, top - 2 * k, 1.1 * k, 0, TAU); c.fill();
            },
        },
        /* ----------------------------------------------------------------------------------- YETI */
        yeti: {
            body(c, s, k, t) {
                const N = 40;
                for (let pass = 0; pass < 3; pass++) for (let i = 0; i < N; i++) {                // three layers of long shaggy fur around the edge
                    const u = (i + pass * 0.33) / N, [px, py, nx, ny, tx, ty] = perim(u, s), len = (0.55 - pass * 0.14) * s * (0.75 + 0.5 * hash(i * 3 + pass * 40)), sw = Math.sin(t * 2.1 + i * 0.8 + pass) * 0.16 * s;
                    c.fillStyle = pass === 0 ? '#9fc3dc' : pass === 1 ? '#cfe4f3' : '#ffffff';
                    c.beginPath(); c.moveTo(px - tx * 3 * k, py - ty * 3 * k); c.quadraticCurveTo(px + nx * len * 0.55 + tx * sw * 0.4 - tx * 1.2 * k, py + ny * len * 0.55 + ty * sw * 0.4 - ty * 1.2 * k, px + nx * len + tx * sw, py + ny * len + ty * sw);
                    c.quadraticCurveTo(px + nx * len * 0.5 + tx * 2.6 * k, py + ny * len * 0.5 + ty * 2.6 * k, px + tx * 3 * k, py + ty * 3 * k); c.closePath(); c.fill();
                }
                bodyPath(c, s, k); const g = c.createLinearGradient(-s, -s, s, s); g.addColorStop(0, '#f4fbff'); g.addColorStop(0.55, '#c3dcee'); g.addColorStop(1, '#84aecb'); c.fillStyle = g; c.fill();
                c.save(); bodyPath(c, s, k); c.clip(); c.strokeStyle = 'rgba(90,135,170,0.6)'; c.lineWidth = 1 * k; c.lineCap = 'round';
                for (let i = 0; i < 26; i++) { const x = (hash(i) * 2 - 1) * s, y = (hash(i + 9) * 2 - 1) * s, sw = Math.sin(t * 1.4 + i) * 0.6 * k; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + sw, y + 2.2 * k, x + 1.4 * k + sw, y + 4.4 * k); c.stroke(); }
                c.restore(); return true;
            },
            front(c, s, k, t) {
                c.strokeStyle = '#4f7090'; c.lineWidth = 3 * k; c.lineCap = 'round';                                   // heavy angry brow
                c.beginPath(); c.moveTo(-8.6 * k, -7 * k); c.lineTo(-1.2 * k, -4.6 * k); c.moveTo(8.6 * k, -7 * k); c.lineTo(1.2 * k, -4.6 * k); c.stroke();
                c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(-3.6 * k, 3 * k); c.lineTo(-2.4 * k, 7 * k); c.lineTo(-1.2 * k, 3 * k); c.moveTo(1.2 * k, 3 * k); c.lineTo(2.4 * k, 7 * k); c.lineTo(3.6 * k, 3 * k); c.fill(); outline(c, k, 0.6);
                for (let i = 0; i < 10; i++) {                                                                         // snow swirling around
                    const a = t * (0.6 + hash(i) * 0.5) + i * 0.7, r = s * (1.55 + hash(i + 4) * 0.55), x = Math.cos(a) * r, y = Math.sin(a * 1.3) * r * 0.8;
                    c.globalAlpha = 0.5 + 0.5 * Math.sin(t * 3 + i); c.fillStyle = '#eaf6ff'; c.beginPath(); c.arc(x, y, (0.8 + hash(i + 8)) * k, 0, TAU); c.fill();
                }
                c.globalAlpha = 1;
            },
        },
        /* ------------------------------------------------------------------------------- SHADOW WRAITH */
        wraith: {
            back(c, s, k, t) {
                glow(c, 0, 0, s * 2.1, 'rgba(150,80,255,A)', 0.28 + 0.1 * Math.sin(t * 2));
                for (let i = 0; i < 7; i++) {                                                  // smoke trailing off the bottom
                    const x0 = (-0.75 + i * 0.25) * s, ph = t * 1.6 + i * 1.3, len = s * (1.2 + 0.6 * hash(i + 2)), sw = Math.sin(ph) * 0.35 * s;
                    const g = c.createLinearGradient(0, s * 0.6, 0, s * 0.6 + len); g.addColorStop(0, 'rgba(70,20,130,0.85)'); g.addColorStop(1, 'rgba(70,20,130,0)');
                    c.fillStyle = g; c.beginPath(); c.moveTo(x0 - 2.6 * k, s * 0.6); c.bezierCurveTo(x0 - 3 * k + sw * 0.4, s * 0.6 + len * 0.4, x0 + sw, s * 0.6 + len * 0.7, x0 + sw * 1.4, s * 0.6 + len);
                    c.bezierCurveTo(x0 + sw + 3 * k, s * 0.6 + len * 0.6, x0 + 3 * k, s * 0.6 + len * 0.3, x0 + 2.6 * k, s * 0.6); c.closePath(); c.fill();
                }
            },
            body(c, s, k, t) {
                bodyPath(c, s, k); const g = c.createLinearGradient(0, -s, 0, s); g.addColorStop(0, '#321456'); g.addColorStop(1, '#0a0418'); c.fillStyle = g; c.shadowBlur = 18 * k; c.shadowColor = 'rgba(190,110,255,1)'; c.fill(); c.shadowBlur = 0; c.strokeStyle = 'rgba(200,140,255,0.85)'; c.lineWidth = 1.6 * k; c.stroke();
                c.save(); bodyPath(c, s, k); c.clip(); c.lineCap = 'round';
                for (let i = 0; i < 4; i++) { c.strokeStyle = 'rgba(190,130,255,' + (0.4 + 0.12 * i) + ')'; c.lineWidth = (1.6 + i * 0.6) * k; c.beginPath(); c.arc(Math.sin(t * 0.7 + i) * s * 0.3, Math.cos(t * 0.6 + i * 2) * s * 0.3, s * (0.5 + i * 0.28), t * 0.9 + i * 1.7, t * 0.9 + i * 1.7 + 2.1); c.stroke(); }
                c.restore(); return true;
            },
            eyes(c, s, k, t, lx, ly) {
                eyesAt(c, k, lx, ly, sx => { c.shadowBlur = 10 * k; c.shadowColor = '#c89bff'; c.fillStyle = '#f2e6ff'; c.beginPath(); c.moveTo(-3.2 * k * sx * -1, -1.6 * k); c.quadraticCurveTo(0, -2.6 * k, 3.2 * k * sx, 0.8 * k); c.quadraticCurveTo(0, 1.2 * k, -3.2 * k * sx * -1, -1.6 * k); c.fill(); c.shadowBlur = 0; });
                return true;
            },
            front(c, s, k, t) {
                for (let i = 0; i < 3; i++) flame(c, (-4 + i * 4) * k, -s + 0.5 * k, 2.2 * k, (6 + 3 * Math.sin(t * 4 + i * 2)) * k, Math.sin(t * 3 + i) * 1.5 * k, 'rgba(120,50,220,0.9)', 'rgba(170,110,255,0.7)', 'rgba(220,190,255,0)');
            },
        },
        /* ------------------------------------------------------------------------------- THUNDER GOD */
        thunder: {
            back(c, s, k, t) {
                glow(c, 0, 0, s * 2.3, 'rgba(70,200,255,A)', 0.34 + 0.16 * Math.sin(t * 9));
                const seed = Math.floor(t * 11);
                for (let j = 0; j < 5; j++) {
                    const a = hash(seed * 7 + j) * TAU, L = s * (1.0 + hash(seed * 3 + j) * 0.9); let x = Math.cos(a) * s * 1.05, y = Math.sin(a) * s * 1.05; const pts = [[x, y]];
                    for (let q = 1; q <= 6; q++) { const f = q / 6, nx = Math.cos(a) * (s * 1.05 + L * f) + (hash(seed * 11 + j * 5 + q) - 0.5) * 3.2 * k, ny = Math.sin(a) * (s * 1.05 + L * f) + (hash(seed * 13 + j * 7 + q) - 0.5) * 3.2 * k; pts.push([nx, ny]); }
                    c.lineJoin = 'round'; c.lineCap = 'round';
                    // every bolt fades out towards its tip (segment by segment) instead of ending in a hard edge
                    for (const [w, col, sb] of [[3.2, 'rgba(60,190,255,0.55)', 10], [1.1, '#ffffff', 0]]) {
                        c.lineWidth = w * k; c.strokeStyle = col; c.shadowBlur = sb * k; c.shadowColor = '#4fd3ff';
                        for (let q = 1; q < pts.length; q++) { c.globalAlpha = Math.pow(Math.max(0, 1 - (q - 0.5) / 6.2), 1.5); c.beginPath(); c.moveTo(pts[q - 1][0], pts[q - 1][1]); c.lineTo(pts[q][0], pts[q][1]); c.stroke(); }
                    }
                    c.globalAlpha = 1; c.shadowBlur = 0;
                }
            },
            body(c, s, k, t) {
                bodyPath(c, s, k); const g = c.createRadialGradient(0, 0, 1, 0, 0, s * 1.5); g.addColorStop(0, '#f4fdff'); g.addColorStop(0.45, '#45d2ff'); g.addColorStop(1, '#1060d0'); c.shadowBlur = 16 * k; c.shadowColor = '#4fd3ff'; c.fillStyle = g; c.fill(); c.shadowBlur = 0;
                c.save(); bodyPath(c, s, k); c.clip(); const seed = Math.floor(t * 6); c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 0.9 * k; c.lineJoin = 'round';
                for (let j = 0; j < 3; j++) { c.beginPath(); let x = (hash(seed + j) * 2 - 1) * s, y = -s; c.moveTo(x, y); for (let q = 0; q < 5; q++) { x += (hash(seed * 5 + j * 9 + q) - 0.5) * 7 * k; y += s * 0.42; c.lineTo(x, y); } c.stroke(); }
                c.restore(); return true;
            },
            eyes(c, s, k, t, lx, ly) {
                eyesAt(c, k, lx, ly, sx => { c.shadowBlur = 8 * k; c.shadowColor = '#ffffff'; c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(-3 * k, -2 * k); c.lineTo(3 * k, -1 * k * sx); c.lineTo(3 * k, 2 * k); c.lineTo(-3 * k, 1.4 * k); c.closePath(); c.fill(); c.shadowBlur = 0; });
                return true;
            },
            front(c, s, k, t) {
                const seed = Math.floor(t * 9), top = -s; c.lineJoin = 'round'; c.lineCap = 'round';
                for (let i = -1; i <= 1; i++) {                                                  // a crown of little bolts
                    const bx = i * 6 * k, h = (i === 0 ? 11 : 7.5) * k; c.strokeStyle = '#fff6a8'; c.lineWidth = 1.8 * k; c.shadowBlur = 8 * k; c.shadowColor = '#ffe14a';
                    c.beginPath(); c.moveTo(bx, top + 0.5 * k); c.lineTo(bx - 2 * k + (hash(seed + i) - 0.5) * 2 * k, top - h * 0.35); c.lineTo(bx + 2 * k, top - h * 0.55); c.lineTo(bx - 0.5 * k, top - h); c.stroke(); c.shadowBlur = 0;
                }
                c.fillStyle = '#ffffff'; for (let i = 0; i < 6; i++) { const a = hash(seed * 2 + i) * TAU, r = s * (1.2 + hash(seed + i * 3) * 0.5); c.globalAlpha = 0.9; c.fillRect(Math.cos(a) * r, Math.sin(a) * r, 1.4 * k, 1.4 * k); }
                c.globalAlpha = 1;
            },
        },
        /* ------------------------------------------------------------------------------ INFERNO KNIGHT */
        inferno: {
            back(c, s, k, t) {
                glow(c, 0, -s * 0.2, s * 2.3, 'rgba(255,120,30,A)', 0.3 + 0.1 * Math.sin(t * 7));
                const tongues = 9;
                for (let i = 0; i < tongues; i++) {
                    const u = i / (tongues - 1), x = (-1 + 2 * u) * s * 1.05, fl = 0.75 + 0.25 * Math.sin(t * 9 + i * 1.9), h = (i === 4 ? 2.1 : 1.35 + 0.5 * hash(i)) * s * fl;
                    const y = i === 0 || i === tongues - 1 ? s * 0.1 : -s * 0.55;
                    flame(c, x, y, 0.34 * s, h, Math.sin(t * 5 + i) * 0.18 * s, '#ff3b1d', '#ff8a1f', 'rgba(255,200,60,0)');
                    flame(c, x, y, 0.2 * s, h * 0.68, Math.sin(t * 6 + i * 1.3) * 0.12 * s, '#ffd24a', '#ffe99a', 'rgba(255,255,220,0)');
                }
            },
            body(c, s, k, t) {
                bodyPath(c, s, k); const g = c.createLinearGradient(-s, -s, s, s); g.addColorStop(0, '#59627a'); g.addColorStop(0.5, '#262b38'); g.addColorStop(1, '#101319'); c.fillStyle = g; c.fill();
                c.save(); bodyPath(c, s, k); c.clip();
                c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 1.1 * k; c.beginPath(); c.moveTo(-s, s * 0.15); c.lineTo(s, s * 0.15); c.moveTo(-s, s * 0.58); c.lineTo(s, s * 0.58); c.moveTo(0, s * 0.15); c.lineTo(0, s); c.stroke();
                c.strokeStyle = 'rgba(255,255,255,0.12)'; c.beginPath(); c.moveTo(-s, s * 0.15 + 1.2 * k); c.lineTo(s, s * 0.15 + 1.2 * k); c.stroke();
                const pul = 0.6 + 0.4 * Math.sin(t * 4); c.lineJoin = 'round'; c.shadowBlur = 8 * k; c.shadowColor = '#ff7a1f';          // lava cracks
                for (const pts of [[[-s, s * 0.35], [-s * 0.55, s * 0.22], [-s * 0.4, s * 0.5], [-s * 0.05, s * 0.4]], [[s, s * 0.7], [s * 0.6, s * 0.62], [s * 0.45, s * 0.9]], [[s * 0.2, -s], [s * 0.1, -s * 0.6], [s * 0.45, -s * 0.4]]]) {
                    c.strokeStyle = 'rgba(255,' + Math.round(130 + 80 * pul) + ',40,' + (0.7 + 0.3 * pul) + ')'; c.lineWidth = 1.7 * k; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke();
                }
                c.shadowBlur = 0; c.fillStyle = '#7b8498'; for (const [x, y] of [[-s * 0.8, s * 0.8], [s * 0.8, s * 0.8], [-s * 0.8, -s * 0.8], [s * 0.8, -s * 0.8]]) { c.beginPath(); c.arc(x, y, 0.9 * k, 0, TAU); c.fill(); }
                c.restore(); return true;
            },
            eyes(c, s, k, t, lx, ly) {
                c.fillStyle = '#0a0b10'; c.fillRect(-s * 0.78, -4.4 * k + ly * 0.4, s * 1.56, 5.4 * k);
                const pul = 0.7 + 0.3 * Math.sin(t * 5); c.shadowBlur = 10 * k; c.shadowColor = '#ff7a1f'; c.fillStyle = 'rgba(255,' + Math.round(150 + 90 * pul) + ',50,1)';
                for (const sx of [-1, 1]) c.fillRect(sx * 4 * k + lx - 2.8 * k, -2.6 * k + ly * 0.6, 5.6 * k, 1.9 * k);
                c.shadowBlur = 0; return true;
            },
            front(c, s, k, t) {
                const top = -s;
                for (const sx of [-1, 1]) {                                                   // horns with glowing tips
                    c.fillStyle = '#2b2f3a'; c.beginPath(); c.moveTo(sx * 5 * k, top + 1 * k); c.quadraticCurveTo(sx * 12 * k, top - 1 * k, sx * 11 * k, top - 10 * k); c.quadraticCurveTo(sx * 8 * k, top - 4 * k, sx * 2.5 * k, top - 1 * k); c.closePath(); c.fill(); outline(c, k, 0.9);
                    c.fillStyle = '#ff8a2a'; c.shadowBlur = 8 * k; c.shadowColor = '#ff7a1f'; c.beginPath(); c.moveTo(sx * 10.2 * k, top - 7 * k); c.lineTo(sx * 11 * k, top - 10 * k); c.lineTo(sx * 8.6 * k, top - 5.4 * k); c.closePath(); c.fill(); c.shadowBlur = 0;
                    c.fillStyle = '#3a4050'; c.beginPath(); c.moveTo(sx * s * 0.82, -s * 0.7); c.lineTo(sx * s * 1.4, -s * 1.15); c.lineTo(sx * s * 1.05, -s * 0.35); c.closePath(); c.fill(); outline(c, k, 0.8);   // shoulder spikes
                }
                for (let i = 0; i < 8; i++) {                                                  // embers drifting up
                    const p = (t * 0.45 + hash(i) * 3) % 1, x = (hash(i + 5) * 2 - 1) * s * 1.2 + Math.sin(t * 2 + i) * 2 * k, y = s * 0.6 - p * s * 3;
                    c.globalAlpha = 1 - p; c.fillStyle = i % 2 ? '#ffb347' : '#ff6a1f'; c.beginPath(); c.arc(x, y, (1 - p) * 1.3 * k + 0.3 * k, 0, TAU); c.fill();
                }
                c.globalAlpha = 1;
            },
        },
        /* ------------------------------------------------------------------------------ NEBULA CLOAK */
        nebula: {
            back(c, s, k, t) {
                glow(c, 0, 0, s * 2.4, 'rgba(190,90,255,A)', 0.36 + 0.1 * Math.sin(t * 1.5)); glow(c, s * 0.5, s * 0.4, s * 1.8, 'rgba(60,160,255,A)', 0.2);
                const tilt = -0.35; c.save(); c.rotate(tilt);                                      // orbit ring (back half)
                c.strokeStyle = 'rgba(210,170,255,0.5)'; c.lineWidth = 1.1 * k; c.beginPath(); c.ellipse(0, 0, s * 1.75, s * 0.52, 0, Math.PI, TAU); c.stroke();
                for (let i = 0; i < 3; i++) { const a = t * 0.9 + i * 2.09; if (Math.sin(a) < 0) { const x = Math.cos(a) * s * 1.75, y = Math.sin(a) * s * 0.52; glow(c, x, y, 4.5 * k, ['rgba(255,140,200,A)', 'rgba(120,220,255,A)', 'rgba(255,230,140,A)'][i], 0.9); c.fillStyle = ['#ff8cc8', '#78dcff', '#ffe68c'][i]; c.beginPath(); c.arc(x, y, (1.1 + 0.4 * i) * k, 0, TAU); c.fill(); } }
                c.restore();
            },
            body(c, s, k, t) {
                bodyPath(c, s, k); const g = c.createRadialGradient(0, 0, 1, 0, 0, s * 1.5); g.addColorStop(0, '#5a2aa0'); g.addColorStop(0.55, '#24104f'); g.addColorStop(1, '#0a0522'); c.fillStyle = g; c.fill();
                c.save(); bodyPath(c, s, k); c.clip();
                for (let arm = 0; arm < 2; arm++) for (let i = 0; i < 38; i++) {                    // a spiral galaxy turning slowly
                    const f = i / 38, a = f * 5.2 + arm * Math.PI + t * 0.35, r = f * s * 1.25; c.globalAlpha = 0.25 + 0.55 * (1 - f);
                    c.fillStyle = arm ? '#ff9ad8' : '#8fd8ff'; c.beginPath(); c.arc(Math.cos(a) * r, Math.sin(a) * r, (0.6 + (1 - f) * 1.3) * k, 0, TAU); c.fill();
                }
                for (let i = 0; i < 16; i++) { c.globalAlpha = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * 3 + i * 2.3)); c.fillStyle = '#fff'; c.fillRect((hash(i + 20) * 2 - 1) * s, (hash(i + 40) * 2 - 1) * s, 0.8 * k, 0.8 * k); }
                c.globalAlpha = 1; c.restore(); return true;
            },
            front(c, s, k, t) {
                c.save(); c.rotate(-0.35);                                                      // orbit (front half) and the orbs passing in front
                c.strokeStyle = 'rgba(230,200,255,0.8)'; c.lineWidth = 1.2 * k; c.beginPath(); c.ellipse(0, 0, s * 1.75, s * 0.52, 0, 0, Math.PI); c.stroke();
                for (let i = 0; i < 3; i++) { const a = t * 0.9 + i * 2.09; if (Math.sin(a) >= 0) { const x = Math.cos(a) * s * 1.75, y = Math.sin(a) * s * 0.52; glow(c, x, y, 5 * k, ['rgba(255,140,200,A)', 'rgba(120,220,255,A)', 'rgba(255,230,140,A)'][i], 0.95); c.fillStyle = ['#ff8cc8', '#78dcff', '#ffe68c'][i]; c.beginPath(); c.arc(x, y, (1.1 + 0.4 * i) * k, 0, TAU); c.fill(); } }
                c.restore();
                c.fillStyle = '#fff'; for (let i = 0; i < 4; i++) { const tw = 0.5 + 0.5 * Math.sin(t * 4 + i * 1.7); c.globalAlpha = tw; star(c, (hash(i + 60) * 2 - 1) * s * 1.5, (hash(i + 70) * 2 - 1) * s * 1.4, (0.6 + tw) * k); }
                c.globalAlpha = 1;
            },
        },
        /* ------------------------------------------------------------------------------ GOLDEN TITAN */
        titan: {
            back(c, s, k, t) {
                glow(c, 0, 0, s * 2.2, 'rgba(255,205,70,A)', 0.3 + 0.08 * Math.sin(t * 2));
                const hy = -s - 8 * k + Math.sin(t * 2) * 0.8 * k;                              // floating halo
                c.strokeStyle = '#c98c14'; c.lineWidth = 3 * k; c.beginPath(); c.ellipse(0, hy, s * 0.8, 2.4 * k, 0, 0, TAU); c.stroke();
                c.shadowBlur = 10 * k; c.shadowColor = '#ffe27a'; c.strokeStyle = '#fff1a0'; c.lineWidth = 1.7 * k; c.beginPath(); c.ellipse(0, hy, s * 0.8, 2.4 * k, 0, 0, TAU); c.stroke(); c.shadowBlur = 0;
            },
            body(c, s, k, t) {
                bodyPath(c, s, k); const g = c.createLinearGradient(-s, -s, s * 0.7, s); g.addColorStop(0, '#fff6c0'); g.addColorStop(0.3, '#f4bc22'); g.addColorStop(0.55, '#fff0a0'); g.addColorStop(1, '#a8680c'); c.fillStyle = g; c.fill();
                c.save(); bodyPath(c, s, k); c.clip();
                c.strokeStyle = 'rgba(130,80,6,0.7)'; c.lineWidth = 1.1 * k; rrPath(c, -s * 0.78, -s * 0.78, s * 1.56, s * 1.56, 3 * k); c.stroke();           // engraved panel
                c.beginPath(); c.moveTo(-s * 0.5, s * 0.45); c.lineTo(0, s * 0.1); c.lineTo(s * 0.5, s * 0.45); c.moveTo(-s * 0.5, s * 0.75); c.lineTo(0, s * 0.4); c.lineTo(s * 0.5, s * 0.75); c.stroke();
                const sx = -s * 1.6 + ((t * 0.5) % 1.7) * s * 2.3, sg = c.createLinearGradient(sx - 5 * k, 0, sx + 5 * k, 0); sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,0.85)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
                c.fillStyle = sg; c.save(); c.transform(1, 0, -0.35, 1, 0, 0); c.fillRect(sx - 7 * k, -s, 14 * k, s * 2); c.restore();
                c.restore(); return true;
            },
            eyes(c, s, k, t, lx, ly) {
                eyesAt(c, k, lx, ly, sx => { c.shadowBlur = 8 * k; c.shadowColor = '#fff7c0'; c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(0, -2.8 * k); c.lineTo(2.6 * k, 0); c.lineTo(0, 2.8 * k); c.lineTo(-2.6 * k, 0); c.closePath(); c.fill(); c.shadowBlur = 0; });
                return true;
            },
            front(c, s, k, t) {
                for (const sx of [-1, 1]) {                                                    // shoulder plates
                    const g = c.createLinearGradient(0, -s, 0, -s * 0.2); g.addColorStop(0, '#fff2a8'); g.addColorStop(1, '#c98c14'); c.fillStyle = g;
                    rrPath(c, sx > 0 ? s * 0.8 : -s * 1.5, -s * 1.02, s * 0.7, s * 0.7, 3 * k); c.fill(); outline(c, k, 0.9);
                    c.fillStyle = 'rgba(255,255,255,0.55)'; c.fillRect((sx > 0 ? s * 0.88 : -s * 1.42), -s * 0.96, s * 0.45, 0.9 * k);
                }
                c.fillStyle = '#fffbe0'; for (let i = 0; i < 6; i++) { const tw = 0.5 + 0.5 * Math.sin(t * 4.5 + i * 2.1); c.globalAlpha = tw; star(c, (hash(i + 90) * 2 - 1) * s * 1.6, (hash(i + 99) * 2 - 1) * s * 1.5, (0.5 + 1.2 * tw) * k); }
                c.globalAlpha = 1;
            },
        },
        /* ------------------------------------------------------------------------------------ DRAGON */
        dragon: {
            back(c, s, k, t) {
                const flap = Math.sin(t * 3.4) * 0.38;
                for (const sx of [-1, 1]) {
                    c.save(); c.translate(sx * s * 0.85, -s * 0.2); c.scale(sx, 1); c.rotate(-0.55 + flap);
                    const fingers = [[1.95 * s, -0.95], [1.75 * s, -0.35], [1.3 * s, 0.25]];            // three wing fingers
                    const tips = fingers.map(([L, a]) => [Math.cos(a) * L, Math.sin(a) * L]);
                    const wg = c.createLinearGradient(0, 0, s * 2, 0); wg.addColorStop(0, '#9d1030'); wg.addColorStop(1, '#4a0818');
                    c.fillStyle = wg; c.beginPath(); c.moveTo(0, 0); c.lineTo(tips[0][0], tips[0][1]);
                    c.quadraticCurveTo((tips[0][0] + tips[1][0]) / 2 - s * 0.1, (tips[0][1] + tips[1][1]) / 2 + s * 0.3, tips[1][0], tips[1][1]);
                    c.quadraticCurveTo((tips[1][0] + tips[2][0]) / 2 - s * 0.1, (tips[1][1] + tips[2][1]) / 2 + s * 0.3, tips[2][0], tips[2][1]);
                    c.lineTo(0, s * 0.35); c.closePath(); c.fill();
                    c.strokeStyle = '#e8d9b0'; c.lineWidth = 1.5 * k; c.lineCap = 'round'; c.beginPath(); for (const p of tips) { c.moveTo(0, 0); c.lineTo(p[0], p[1]); } c.stroke();
                    c.restore();
                }
            },
            body(c, s, k, t) {
                bodyPath(c, s, k); const g = c.createLinearGradient(0, -s, 0, s); g.addColorStop(0, '#3fae5a'); g.addColorStop(0.6, '#1d7a3f'); g.addColorStop(1, '#0d4426'); c.fillStyle = g; c.fill();
                c.save(); bodyPath(c, s, k); c.clip(); c.strokeStyle = 'rgba(180,255,190,0.28)'; c.lineWidth = 0.8 * k;
                for (let row = 0; row < 6; row++) for (let col = -3; col < 4; col++) { const x = col * 5 * k + (row % 2) * 2.5 * k, y = -s + 2 * k + row * 4.6 * k; c.beginPath(); c.arc(x, y, 2.5 * k, 0, Math.PI); c.stroke(); }
                const bg = c.createLinearGradient(0, s * 0.2, 0, s); bg.addColorStop(0, 'rgba(255,230,140,0)'); bg.addColorStop(1, 'rgba(255,230,140,0.55)'); c.fillStyle = bg; c.fillRect(-s, s * 0.2, s * 2, s);
                c.restore(); return true;
            },
            eyes(c, s, k, t, lx, ly) {
                eyesAt(c, k, lx, ly, sx => { c.shadowBlur = 6 * k; c.shadowColor = '#ffe14a'; c.fillStyle = '#ffd92a'; c.beginPath(); c.ellipse(0, 0, 3 * k, 3.1 * k, 0, 0, TAU); c.fill(); c.shadowBlur = 0; c.fillStyle = '#120a02'; c.beginPath(); c.ellipse(0, 0, 0.9 * k, 2.8 * k, 0, 0, TAU); c.fill(); });
                return true;
            },
            front(c, s, k, t) {
                const top = -s;
                for (const sx of [-1, 1]) { c.fillStyle = '#efe3c0'; c.beginPath(); c.moveTo(sx * 4 * k, top + 1 * k); c.quadraticCurveTo(sx * 9 * k, top - 2 * k, sx * 8 * k, top - 9 * k); c.quadraticCurveTo(sx * 6 * k, top - 3 * k, sx * 1.8 * k, top - 0.5 * k); c.closePath(); c.fill(); outline(c, k, 0.8); }
                c.fillStyle = '#d9304a'; for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(i * 2.6 * k - 1.3 * k, top + 0.5 * k); c.lineTo(i * 2.6 * k, top - (i === 0 ? 5 : 3.4) * k); c.lineTo(i * 2.6 * k + 1.3 * k, top + 0.5 * k); c.closePath(); c.fill(); }
            },
        },
        /* ------------------------------------------------------------------------------ RAINBOW PHOENIX */
        phoenix: {
            back(c, s, k, t) {
                const hue = t * 70, flap = Math.sin(t * 2.8) * 0.2;
                glow(c, 0, -s * 0.2, s * 2.5, 'hsla(' + Math.round(hue % 360) + ',100%,60%,A)', 0.3);
                for (const sx of [-1, 1]) for (let i = 0; i < 7; i++) {                          // wings made of feathers of fire
                    const a = -2.0 + i * 0.3 + flap, L = s * (2.5 - Math.abs(i - 2.5) * 0.18), hh = (hue + i * 22) % 360;
                    c.save(); c.translate(sx * s * 0.7, -s * 0.15); c.scale(sx, 1); c.rotate(a + 0.35);
                    const g = c.createLinearGradient(0, 0, L, 0); g.addColorStop(0, 'hsla(' + hh + ',100%,62%,0.95)'); g.addColorStop(0.7, 'hsla(' + ((hh + 40) % 360) + ',100%,58%,0.8)'); g.addColorStop(1, 'hsla(' + ((hh + 80) % 360) + ',100%,70%,0)');
                    c.fillStyle = g; c.beginPath(); c.moveTo(0, -1.4 * k); c.quadraticCurveTo(L * 0.55, -4.2 * k, L, 0); c.quadraticCurveTo(L * 0.55, 4.2 * k, 0, 1.4 * k); c.closePath(); c.fill(); c.restore();
                }
                for (let i = 0; i < 5; i++) {                                                  // long tail feathers
                    const a = Math.PI / 2 + (i - 2) * 0.28 + Math.sin(t * 2 + i) * 0.08, L = s * (2.2 - Math.abs(i - 2) * 0.35), hh = (hue + 120 + i * 25) % 360;
                    c.save(); c.translate(0, s * 0.5); c.rotate(a);
                    const g = c.createLinearGradient(0, 0, L, 0); g.addColorStop(0, 'hsla(' + hh + ',100%,60%,0.95)'); g.addColorStop(1, 'hsla(' + ((hh + 60) % 360) + ',100%,70%,0)');
                    c.fillStyle = g; c.beginPath(); c.moveTo(0, -1.8 * k); c.quadraticCurveTo(L * 0.6, -3.6 * k, L, 0); c.quadraticCurveTo(L * 0.6, 3.6 * k, 0, 1.8 * k); c.closePath(); c.fill(); c.restore();
                }
            },
            body(c, s, k, t) {
                const h = (t * 70) % 360; bodyPath(c, s, k); const g = c.createLinearGradient(0, -s, 0, s); g.addColorStop(0, 'hsl(' + Math.round((h + 50) % 360) + ',100%,65%)'); g.addColorStop(1, 'hsl(' + Math.round(h) + ',100%,52%)');
                c.shadowBlur = 14 * k; c.shadowColor = 'hsl(' + Math.round(h) + ',100%,60%)'; c.fillStyle = g; c.fill(); c.shadowBlur = 0;
                c.save(); bodyPath(c, s, k); c.clip(); c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 1.2 * k; c.lineCap = 'round';
                for (let i = 0; i < 5; i++) { const y = -s * 0.6 + i * s * 0.38; c.beginPath(); for (let x = -s; x <= s; x += 2 * k) { const yy = y + Math.sin(x / (3 * k) + t * 4 + i) * 1.4 * k; x === -s ? c.moveTo(x, yy) : c.lineTo(x, yy); } c.stroke(); }
                c.restore(); return true;
            },
            eyes(c, s, k, t, lx, ly) {
                eyesAt(c, k, lx, ly, sx => { c.fillStyle = '#2a0a00'; c.beginPath(); c.ellipse(0, 0, 2.6 * k, 2.9 * k, 0, 0, TAU); c.fill(); c.fillStyle = '#ffe27a'; c.beginPath(); c.arc(0, 0.2 * k, 1.5 * k, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(-0.7 * k, -0.8 * k, 0.7 * k, 0, TAU); c.fill(); });
                return true;
            },
            front(c, s, k, t) {
                const top = -s, hue = t * 70;
                for (let i = 0; i < 5; i++) {                                                  // crest
                    const a = (i - 2) * 0.32, L = (i === 2 ? 13 : 9.5 - Math.abs(i - 2) * 1.4) * k, hh = (hue + i * 30) % 360, sw = Math.sin(t * 5 + i) * 1.2 * k;
                    c.save(); c.translate(0, top + 1 * k); c.rotate(a); const g = c.createLinearGradient(0, 0, 0, -L); g.addColorStop(0, 'hsl(' + hh + ',100%,60%)'); g.addColorStop(1, 'hsla(' + ((hh + 60) % 360) + ',100%,75%,0.2)');
                    c.fillStyle = g; c.beginPath(); c.moveTo(-1.8 * k, 0); c.quadraticCurveTo(-1.2 * k + sw, -L * 0.6, sw * 1.6, -L); c.quadraticCurveTo(1.2 * k + sw, -L * 0.6, 1.8 * k, 0); c.closePath(); c.fill(); c.restore();
                }
                for (let i = 0; i < 10; i++) { const p = (t * 0.6 + hash(i) * 2) % 1, x = (hash(i + 7) * 2 - 1) * s * 1.4, y = s * 0.5 - p * s * 3; c.globalAlpha = 1 - p; c.fillStyle = 'hsl(' + Math.round((hue + i * 36) % 360) + ',100%,68%)'; c.beginPath(); c.arc(x, y, (1 - p) * 1.4 * k + 0.3 * k, 0, TAU); c.fill(); }
                c.globalAlpha = 1;
            },
        },
    };

    // the catalogue shown in the shop (gems for most; two can be bought with a lot of coins)
    const COSTUMES = [
        { id: 'none',    name: 'None',           price: 0,     rarity: 'common' },
        { id: 'slime',   name: 'Slime King',     premium: true, gemPrice: 400,  price: 0, rarity: 'rare' },
        { id: 'yeti',    name: 'Yeti',           premium: true, gemPrice: 600,  price: 0, rarity: 'epic' },
        { id: 'wraith',  name: 'Shadow Wraith',  price: 30000, rarity: 'mythic' },
        { id: 'thunder', name: 'Thunder God',    premium: true, gemPrice: 1000, price: 0, rarity: 'mythic' },
        { id: 'inferno', name: 'Inferno Knight', premium: true, gemPrice: 1300, price: 0, rarity: 'legendary' },
        { id: 'nebula',  name: 'Nebula Cloak',   premium: true, gemPrice: 1600, price: 0, rarity: 'mythic' },
        { id: 'titan',   name: 'Golden Titan',   price: 80000, rarity: 'legendary' },
        { id: 'dragon',  name: 'Dragon',         premium: true, gemPrice: 2000, price: 0, rarity: 'legendary' },
        { id: 'phoenix', name: 'Rainbow Phoenix', premium: true, gemPrice: 2800, price: 0, rarity: 'legendary' },
    ];
    COSTUMES.forEach(c => { if (c.price > 0 && !c.premium) c.price = Math.round(c.price * 1.5 / 1000) * 1000; });
    const BY = Object.fromEntries(COSTUMES.map(c => [c.id, c]));
    const has = id => !!(id && id !== 'none' && DEFS[id]);
    const run = (part, c, s, k, id, t, a, b) => { const d = DEFS[id]; if (!d || !d[part]) return false; c.save(); try { const r = d[part](c, s, k, t || 0, a, b); c.restore(); return r !== false; } catch (e) { c.restore(); return false; } };
    window.Costumes = {
        COSTUMES, BY, has,
        back: (c, s, k, id, t) => has(id) && run('back', c, s, k, id, t),
        body: (c, s, k, id, t) => has(id) && run('body', c, s, k, id, t),
        eyes: (c, s, k, id, t, lx, ly) => has(id) && run('eyes', c, s, k, id, t, lx, ly),
        front: (c, s, k, id, t) => has(id) && run('front', c, s, k, id, t),
    };
    if (typeof COS_BY !== 'undefined') COS_BY.costume = COSTUMES;
    try { if (typeof refreshMenu === 'function') refreshMenu(); } catch (e) {}      // the menu was drawn before this file loaded: draw the equipped costume now
})();
