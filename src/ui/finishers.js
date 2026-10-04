// FINISHERS: the effect that plays when YOU cross the finish line. Bought with coins or gems, or found in chests. One equipped at a time.
// Every finisher is a small recipe (fx) for a tiny particle engine (makeSim). The same recipe runs in the race (world space, drawn by game.js),
// in the shop cards and in the chest reveal (looping previews), so what you see is what you get. Loaded AFTER game.js.
(function () {
    'use strict';
    const TAU = Math.PI * 2;
    const R_ = (a, b) => a + Math.random() * (b - a);
    const pick = a => a[Math.floor(Math.random() * a.length)];
    const PAL = ['#ff5470', '#ffcf3f', '#35e0c8', '#5b8def', '#b3a9ff', '#ff9838', '#ff8ae6'];

    /* =========================================================================== particle engine ==== */
    function makeSim(io) {
        io = io || {};
        const s = { parts: [], rings: [], bolts: [], beams: [], pillars: [], flares: [], crowns: [], timers: [], t: 0 };
        s.sfx = n => { if (io.sfx) try { io.sfx(n); } catch (e) {} };
        s.shake = n => { if (io.shake) io.shake(n); };
        s.flash = (c, a) => { if (io.flash) io.flash(c, a); };
        s.add = o => {
            if (s.parts.length > 760) return null;
            const q = Object.assign({ x: 0, y: 0, vx: 0, vy: 0, g: 0, drag: 0, life: 0, max: 1, size: 3, col: '#fff', shape: 'dot', rot: 0, spin: 0, tw: 0, tws: 0, add: true, shrink: 0, glow: 0, alpha: 1 }, o);
            s.parts.push(q); return q;
        };
        s.at = (ms, fn) => { s.timers.push({ t: ms / 1000, fn }); };
        s.ring = (x, y, col, max, dur, flat, lw) => { s.rings.push({ x, y, col, max, dur: dur || .6, flat: !!flat, lw: lw || 5, life: 0 }); };
        s.pillar = (x, y, w, h, col, dur) => { s.pillars.push({ x, y, w, h, col, dur: dur || .8, life: 0 }); };
        s.flare = (x, y, max, col, dur) => { s.flares.push({ x, y, max, col, dur: dur || .8, life: 0 }); };
        s.empty = () => !s.parts.length && !s.rings.length && !s.bolts.length && !s.beams.length && !s.pillars.length && !s.flares.length && !s.crowns.length && !s.timers.length;
        s.clear = () => { s.parts.length = s.rings.length = s.bolts.length = s.beams.length = s.pillars.length = s.flares.length = s.crowns.length = s.timers.length = 0; };

        s.update = dt => {
            s.t += dt;
            for (let i = s.timers.length - 1; i >= 0; i--) { const tm = s.timers[i]; tm.t -= dt; if (tm.t <= 0) { s.timers.splice(i, 1); try { tm.fn(); } catch (e) {} } }
            let k = 0;
            for (const q of s.parts) {
                q.life += dt; if (q.life >= q.max) continue;
                if (q.polar) { const o = q.polar; o.a += o.da * dt; o.r += o.dr * dt; q.x = o.cx + Math.cos(o.a) * o.r; q.y = o.cy + Math.sin(o.a) * o.r * o.tilt; }
                else {
                    if (q.drag) { const d = Math.max(0, 1 - q.drag * dt); q.vx *= d; q.vy *= d; }
                    q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt;
                    if (q.sway) q.x += Math.sin(q.life * q.sway.f + q.sway.p) * q.sway.a * dt;
                    if (q.ground !== undefined && q.y > q.ground && q.vy > 0 && q.bounce > 0) { q.y = q.ground; q.vy *= -.45; q.vx *= .7; q.bounce--; if (q.onHit) { const f = q.onHit; q.onHit = null; f(q); } }
                }
                q.rot += q.spin * dt; q.tw += q.tws * dt;
                if (q.trail) { const tr = q.trail; tr.acc += dt; while (tr.acc >= tr.every) { tr.acc -= tr.every; s.add({ x: q.x, y: q.y, vx: R_(-14, 14), vy: R_(-14, 14), max: tr.life, size: tr.size, col: tr.col, shrink: 1, drag: 2 }); } }
                s.parts[k++] = q;
            }
            s.parts.length = k;
            for (const arr of [s.rings, s.bolts, s.beams, s.pillars, s.flares, s.crowns]) {
                let j = 0; for (const o of arr) { o.life += dt; if (o.life < o.dur) arr[j++] = o; } arr.length = j;
            }
        };

        s.draw = ctx => {
            ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            let cur = ''; const op = v => { if (v !== cur) { ctx.globalCompositeOperation = v; cur = v; } };
            // light pillars
            for (const o of s.pillars) {
                const u = o.life / o.dur, a = (1 - u) * (1 - u); op('lighter'); ctx.globalAlpha = a;
                const g = ctx.createLinearGradient(0, o.y - o.h, 0, o.y); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, o.col);
                ctx.fillStyle = g; const w = o.w * (.6 + .4 * Math.min(1, u * 4)); ctx.fillRect(o.x - w / 2, o.y - o.h, w, o.h);
                ctx.globalAlpha = a * .7; ctx.fillStyle = '#fff'; ctx.fillRect(o.x - w * .12, o.y - o.h * .8, w * .24, o.h * .8);
            }
            // flares: soft glow + 8 spikes
            for (const o of s.flares) {
                const u = o.life / o.dur, e = 1 - Math.pow(1 - Math.min(1, u * 1.6), 3), sz = o.max * e, a = 1 - u; op('lighter');
                const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, sz * .9); g.addColorStop(0, '#fff'); g.addColorStop(.25, o.col); g.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.globalAlpha = a * .9; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(o.x, o.y, sz * .9, 0, TAU); ctx.fill();
                ctx.globalAlpha = a; ctx.fillStyle = '#fff';
                for (let i = 0; i < 8; i++) {
                    const ang = i * TAU / 8 + u * .6, len = sz * (i % 2 ? .75 : 1.25), wd = sz * .045 * (1 - u);
                    ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(ang); ctx.beginPath(); ctx.moveTo(0, -wd); ctx.lineTo(len, 0); ctx.lineTo(0, wd); ctx.closePath(); ctx.fill(); ctx.restore();
                }
            }
            // rings
            for (const o of s.rings) {
                const u = o.life / o.dur, r = o.max * (1 - Math.pow(1 - u, 3)); op('lighter');
                ctx.globalAlpha = Math.max(0, 1 - u); ctx.strokeStyle = o.col; ctx.lineWidth = Math.max(.6, o.lw * (1 - u * .75));
                ctx.beginPath(); if (o.flat) ctx.ellipse(o.x, o.y, r, r * .26, 0, 0, TAU); else ctx.arc(o.x, o.y, r, 0, TAU); ctx.stroke();
            }
            // lightning
            for (const o of s.bolts) {
                const u = o.life / o.dur, a = (1 - u) * (Math.random() < .25 ? .55 : 1); op('lighter');
                for (const [w, col, al] of [[10, o.col, .22], [4.5, o.col, .7], [1.8, '#ffffff', 1]]) {
                    ctx.strokeStyle = col; ctx.lineWidth = w * (1 - u * .4);
                    for (let pi = 0; pi < o.paths.length; pi++) {
                        const pts = o.paths[pi]; ctx.globalAlpha = a * al * (pi ? .7 : 1); ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
                        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
                    }
                }
            }
            // sweeping laser beams
            for (const o of s.beams) {
                const u = o.life / o.dur, a = Math.sin(Math.min(1, u * 1.2) * Math.PI) ** .6, ang = o.a + Math.sin(o.life * o.spd) * o.sweep; op('lighter');
                const ex = o.x + Math.cos(ang) * o.len, ey = o.y + Math.sin(ang) * o.len;
                for (const [w, col, al] of [[12, o.col, .2], [5, o.col, .7], [1.6, '#fff', 1]]) { ctx.globalAlpha = a * al; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(ex, ey); ctx.stroke(); }
                ctx.globalAlpha = a; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, ey, 4, 0, TAU); ctx.fill();
            }
            // the royal crown
            for (const o of s.crowns) drawCrown(ctx, o, op);
            // particles
            for (const q of s.parts) {
                const u = q.life / q.max, a = Math.max(0, Math.min(1, (q.max - q.life) / (q.max * .4))) * q.alpha, sz = Math.max(.2, q.size * (1 - q.shrink * u));
                op(q.add ? 'lighter' : 'source-over'); ctx.globalAlpha = a;
                const col = q.cols ? q.cols[Math.min(q.cols.length - 1, Math.floor(u * q.cols.length))] : q.col;
                ctx.fillStyle = col; ctx.strokeStyle = col;
                switch (q.shape) {
                    case 'spark': ctx.lineWidth = sz; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - q.vx * .05, q.y - q.vy * .05); ctx.stroke(); break;
                    case 'conf': ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.scale(1, Math.cos(q.tw)); ctx.fillRect(-sz, -sz * .55, sz * 2, sz * 1.1); ctx.restore(); break;
                    case 'petal': ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.scale(.45 + .55 * Math.abs(Math.cos(q.tw)), 1);
                        ctx.beginPath(); ctx.moveTo(0, -sz * 1.5); ctx.bezierCurveTo(sz * 1.3, -sz * .9, sz * 1.1, sz * 1.1, 0, sz * 1.5); ctx.bezierCurveTo(-sz * 1.1, sz * 1.1, -sz * 1.3, -sz * .9, 0, -sz * 1.5); ctx.fill(); ctx.restore(); break;
                    case 'coin': { const w = Math.abs(Math.cos(q.tw)) * sz + .6; ctx.save(); ctx.translate(q.x, q.y);
                        ctx.fillStyle = '#ffcf3f'; ctx.beginPath(); ctx.ellipse(0, 0, w, sz, 0, 0, TAU); ctx.fill();
                        ctx.strokeStyle = '#b8651a'; ctx.lineWidth = Math.max(1, sz * .22); ctx.stroke();
                        ctx.fillStyle = '#fff4c2'; ctx.beginPath(); ctx.ellipse(-w * .25, -sz * .25, w * .3, sz * .38, 0, 0, TAU); ctx.fill(); ctx.restore(); break; }
                    case 'star': ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.beginPath();
                        for (let i = 0; i < 8; i++) { const r = i % 2 ? sz * .32 : sz * 1.3, an = i * TAU / 8; ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r); } ctx.closePath(); ctx.fill(); ctx.restore(); break;
                    case 'shard': ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.beginPath(); ctx.moveTo(0, -sz * 2.2); ctx.lineTo(sz * .7, 0); ctx.lineTo(0, sz * 2.2); ctx.lineTo(-sz * .7, 0); ctx.closePath(); ctx.fill();
                        ctx.globalAlpha = a * .7; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(0, -sz * 2.2); ctx.lineTo(sz * .7, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill(); ctx.restore(); break;
                    case 'rocket': ctx.save(); ctx.translate(q.x, q.y); op('source-over'); ctx.fillStyle = '#ff5470'; ctx.beginPath(); ctx.moveTo(-9, 10); ctx.lineTo(-17, 22); ctx.lineTo(-9, 18); ctx.closePath(); ctx.moveTo(9, 10); ctx.lineTo(17, 22); ctx.lineTo(9, 18); ctx.closePath(); ctx.fill();
                        ctx.fillStyle = '#f2f5fa'; ctx.beginPath(); ctx.moveTo(0, -26); ctx.bezierCurveTo(12, -12, 10, 8, 8, 20); ctx.lineTo(-8, 20); ctx.bezierCurveTo(-10, 8, -12, -12, 0, -26); ctx.fill();
                        ctx.fillStyle = '#ff5470'; ctx.beginPath(); ctx.moveTo(0, -26); ctx.bezierCurveTo(6, -20, 8, -14, 9, -10); ctx.lineTo(-9, -10); ctx.bezierCurveTo(-8, -14, -6, -20, 0, -26); ctx.fill();
                        ctx.fillStyle = '#5eb4ff'; ctx.beginPath(); ctx.arc(0, 0, 4.6, 0, TAU); ctx.fill(); ctx.strokeStyle = '#2b3550'; ctx.lineWidth = 1.4; ctx.stroke();
                        op('lighter'); ctx.fillStyle = '#ffcf3f'; ctx.beginPath(); ctx.moveTo(-6, 20); ctx.lineTo(0, 20 + 22 + Math.random() * 10); ctx.lineTo(6, 20); ctx.fill(); ctx.restore(); break;
                    default:
                        if (q.glow) { ctx.globalAlpha = a * .22; ctx.beginPath(); ctx.arc(q.x, q.y, sz * 3, 0, TAU); ctx.fill(); ctx.globalAlpha = a; }
                        ctx.beginPath(); ctx.arc(q.x, q.y, sz, 0, TAU); ctx.fill();
                }
            }
            ctx.restore();
        };
        return s;
    }

    function drawCrown(ctx, o, op) {
        const u = o.life / o.dur, grow = u < .22 ? 1 - Math.pow(1 - u / .22, 3) * (1 - 1.18) : (u < .34 ? 1.18 - (u - .22) / .12 * .18 : 1), a = u > .8 ? (1 - u) / .2 : 1;
        const cx = o.x, cy = o.y - Math.min(1, u * 3) * 14;
        op('lighter'); ctx.globalAlpha = a * .5; ctx.fillStyle = '#ffcf3f';
        for (let i = 0; i < 12; i++) { ctx.save(); ctx.translate(cx, cy); ctx.rotate(i * TAU / 12 + o.life * .8); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(150 * grow, -9); ctx.lineTo(150 * grow, 9); ctx.closePath(); ctx.fill(); ctx.restore(); }
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 90 * grow); g.addColorStop(0, 'rgba(255,240,170,.9)'); g.addColorStop(1, 'rgba(255,207,63,0)'); ctx.globalAlpha = a * .8; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 90 * grow, 0, TAU); ctx.fill();
        op('source-over'); ctx.globalAlpha = a; ctx.save(); ctx.translate(cx, cy); ctx.scale(grow, grow);
        const gold = ctx.createLinearGradient(0, -34, 0, 22); gold.addColorStop(0, '#fff4c2'); gold.addColorStop(.45, '#ffcf3f'); gold.addColorStop(1, '#b8651a');
        ctx.fillStyle = gold; ctx.strokeStyle = '#6b3a0a'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-34, 20); ctx.lineTo(-38, -20); ctx.lineTo(-19, -4); ctx.lineTo(0, -32); ctx.lineTo(19, -4); ctx.lineTo(38, -20); ctx.lineTo(34, 20); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ff5470'; ctx.beginPath(); ctx.arc(0, 4, 6, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#5eb4ff'; for (const x of [-21, 21]) { ctx.beginPath(); ctx.arc(x, 10, 4.2, 0, TAU); ctx.fill(); ctx.stroke(); }
        ctx.fillStyle = '#fff4c2'; for (const [x, y] of [[-38, -20], [0, -32], [38, -20]]) { ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.fill(); ctx.stroke(); }
        ctx.restore();
    }

    /* =========================================================================== effect recipes ==== */
    const lightningPath = (x1, y1, x2, y2, disp) => {
        let pts = [[x1, y1], [x2, y2]], d = disp;
        for (let it = 0; it < 5; it++) {
            const np = [];
            for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; np.push(a, [(a[0] + b[0]) / 2 + R_(-d, d), (a[1] + b[1]) / 2 + R_(-d * .35, d * .35)]); }
            np.push(pts[pts.length - 1]); pts = np; d *= .55;
        }
        return pts;
    };
    function strike(s, x, p, gy, topY) {
        const main = lightningPath(x + R_(-50, 50), topY, x, gy, 90), paths = [main];
        for (let b = 0; b < 3; b++) { const o = main[Math.floor(R_(main.length * .25, main.length * .8))], dir = Math.random() < .5 ? -1 : 1; paths.push(lightningPath(o[0], o[1], o[0] + dir * R_(50, 130), o[1] + R_(70, 170), 40)); }
        s.bolts.push({ paths, col: '#7cc8ff', life: 0, dur: .42 });
        s.ring(x, gy, '#cfe6ff', 150, .5, true, 6); s.ring(x, gy, '#ffffff', 90, .35, false, 4);
        for (let i = 0; i < 26; i++) s.add({ x, y: gy - 4, vx: R_(-420, 420), vy: R_(-520, -60), g: 900, drag: .6, max: R_(.4, .9), size: R_(1.5, 3), col: pick(['#ffffff', '#9fd0ff', '#5eb4ff']), shape: 'spark' });
        s.pillar(x, gy, 70, 520, 'rgba(120,190,255,.9)', .5);
    }
    function launch(s, x, y, tx, ty, col, kind) {
        s.sfx('boost'); const T = .5;
        s.add({ x, y, vx: (tx - x) / T, vy: (ty - y) / T, max: T, size: 2.6, col: '#fff4c2', glow: 1, trail: { acc: 0, every: .016, life: .4, size: 2.2, col: '#ffcf3f' } });
        s.at(T * 1000, () => explode(s, tx, ty, col, kind));
    }
    function explode(s, x, y, col, kind) {
        s.sfx('shatter'); s.ring(x, y, col, 80, .5);
        const n = kind === 'willow' ? 44 : 52;
        for (let i = 0; i < n; i++) {
            const a = i / n * TAU + R_(-.05, .05), sp = kind === 'ring' ? 300 : R_(110, 390), w = kind === 'willow';
            s.add({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: w ? 170 : 230, drag: w ? 1.1 : 1.6, max: w ? R_(1.5, 2.1) : R_(.9, 1.4), size: 2.4, col: w ? '#ffcf3f' : col, glow: 1,
                trail: { acc: 0, every: .028, life: w ? .65 : .3, size: 1.8, col: w ? '#ffb347' : col } });
        }
        for (let i = 0; i < 12; i++) s.add({ x, y, vx: R_(-150, 150), vy: R_(-150, 150), g: 120, drag: 1.2, max: R_(.6, 1.1), size: 1.8, col: '#ffffff', shape: 'star' });
    }

    const FINISHERS = [
        { id: 'f-none', name: 'None', rarity: 'common', price: 0 },

        { id: 'f-confetti', pv: 300, name: 'Confetti', rarity: 'common', price: 300,
          fx(s, p) {
              s.sfx('shatter'); s.shake(4);
              [0, 170, 340].forEach(t => s.at(t, () => {
                  for (const side of [-1, 1]) {
                      const cx = p.x + side * 84, cy = p.y + 8;
                      s.add({ x: cx, y: cy, size: 18, max: .22, col: '#ffffff', shrink: 1 });
                      for (let k = 0; k < 26; k++) {
                          const a = -Math.PI / 2 + (-side) * R_(.1, .8), sp = R_(380, 850);
                          s.add({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 900, drag: 1.3, max: R_(1.7, 2.6), size: R_(2.6, 4.3), col: pick(PAL), shape: 'conf', spin: R_(-10, 10), tws: R_(8, 17), add: false });
                      }
                  }
              }));
          } },

        { id: 'f-fireworks', pv: 380, name: 'Fireworks', rarity: 'rare', price: 800,
          fx(s, p) { ['peony', 'ring', 'willow', 'peony', 'ring'].forEach((kd, i) => s.at(i * 270, () => launch(s, p.x + R_(-30, 30), p.y, p.x + R_(-130, 130), p.y - R_(150, 300), pick(PAL), kd))); } },

        { id: 'f-shockwave', pv: 330, name: 'Shockwave', rarity: 'rare', price: 900,
          fx(s, p) {
              const gy = p.y + (p.r || 14); s.sfx('boost'); s.shake(12); s.flash('#ffffff', .35);
              [0, 110, 230, 360].forEach((t, i) => s.at(t, () => s.ring(p.x, gy, i % 2 ? '#35e0c8' : '#ffffff', 240 + i * 70, .8, true, 7 - i)));
              s.ring(p.x, p.y, '#ffffff', 120, .5, false, 5);
              for (let i = 0; i < 34; i++) s.add({ x: p.x, y: gy - R_(0, 6), vx: (i % 2 ? 1 : -1) * R_(200, 720), vy: R_(-30, 10), drag: 2.2, max: R_(.4, .8), size: R_(1.6, 3), col: i % 3 ? '#ffffff' : '#35e0c8', shape: 'spark' });
              for (let i = 0; i < 22; i++) s.add({ x: p.x + R_(-30, 30), y: gy, vx: R_(-170, 170), vy: R_(-140, -30), g: -20, drag: 1.4, max: R_(.7, 1.2), size: R_(8, 15), col: '#b8c2d6', add: false, alpha: .35, shrink: -.6 });
          } },

        { id: 'f-frost', pv: 340, name: 'Frost burst', rarity: 'rare', price: 1100,
          fx(s, p) {
              s.sfx('shatter'); s.flash('#bfe9ff', .28); s.ring(p.x, p.y, '#bfe9ff', 170, .7); s.ring(p.x, p.y, '#ffffff', 100, .45, false, 3);
              for (let i = 0; i < 9; i++) s.add({ x: p.x + R_(-40, 40), y: p.y + R_(-30, 20), size: R_(26, 44), max: R_(.9, 1.4), col: '#cfeaff', add: false, alpha: .16, shrink: -.9, vy: -R_(10, 40) });
              for (let i = 0; i < 44; i++) { const a = R_(0, TAU), sp = R_(150, 540); s.add({ x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, g: 280, drag: 1, max: R_(.9, 1.6), size: R_(3.5, 7), col: pick(['#e6f7ff', '#9fd8ff', '#5eb4ff']), shape: 'shard', rot: R_(0, TAU), spin: R_(-9, 9) }); }
              for (let i = 0; i < 40; i++) s.at(i * 45, () => s.add({ x: p.x + R_(-180, 180), y: p.y - R_(200, 310), vx: R_(-20, 20), vy: R_(40, 110), max: R_(2, 3), size: R_(1.8, 3.4), col: '#ffffff', glow: 1, sway: { a: 34, f: 3, p: R_(0, 6) } }));
          } },

        { id: 'f-neon', pv: 420, name: 'Laser show', rarity: 'rare', price: 1300,
          fx(s, p) {
              s.sfx('boost'); const cols = ['#ff2bd6', '#35e0ff', '#7cff4d', '#ffe14a', '#b36bff', '#ff5470'];
              for (let i = 0; i < 6; i++) s.beams.push({ x: p.x, y: p.y - 4, a: -Math.PI / 2 + (i - 2.5) * .34, sweep: .5, spd: (i % 2 ? 1 : -1) * R_(5, 8), len: 560, life: 0, dur: 1.7, col: cols[i] });
              [0, 160, 320].forEach((t, i) => s.at(t, () => { s.ring(p.x, p.y, cols[i * 2], 130 + i * 40, .6, false, 4); s.ring(p.x, p.y + 14, cols[i * 2 + 1], 220 + i * 40, .7, true, 4); }));
              for (let i = 0; i < 40; i++) s.at(i * 35, () => s.add({ x: p.x + R_(-40, 40), y: p.y - R_(0, 60), vx: R_(-140, 140), vy: -R_(140, 340), g: 200, max: R_(.8, 1.4), size: R_(1.8, 3), col: pick(cols), glow: 1 }));
          } },

        { id: 'f-sakura', pv: 360, name: 'Petal storm', rarity: 'epic', price: 1800,
          fx(s, p) {
              s.sfx('item');
              for (let i = 0; i < 28; i++) { const a = R_(-Math.PI, 0), sp = R_(120, 380); s.add({ x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 60, drag: 1.5, max: R_(1.8, 2.8), size: R_(3.5, 6), col: pick(['#ffb8d6', '#ff8ab8', '#ffe0ee']), shape: 'petal', rot: R_(0, TAU), spin: R_(-4, 4), tws: R_(3, 7), add: false, sway: { a: 55, f: 3.2, p: R_(0, 6) } }); }
              for (let i = 0; i < 46; i++) s.at(i * 45, () => s.add({ x: p.x + R_(-170, 170), y: p.y - R_(230, 330), vx: R_(-30, 30), vy: R_(50, 110), max: R_(2.6, 3.6), size: R_(3.5, 6.5), col: pick(['#ffb8d6', '#ff8ab8', '#ffe0ee', '#fff']), shape: 'petal', rot: R_(0, TAU), spin: R_(-3, 3), tws: R_(2, 6), add: false, sway: { a: 70, f: 2.6, p: R_(0, 6) } }));
              s.ring(p.x, p.y, '#ffb8d6', 120, .6);
          } },

        { id: 'f-goldrain', pv: 360, name: 'Gold rain', rarity: 'epic', price: 2000,
          fx(s, p) {
              const gy = p.y + (p.r || 14); s.sfx('coin'); s.ring(p.x, p.y, '#ffcf3f', 130, .6); s.pillar(p.x, gy, 90, 420, 'rgba(255,207,63,.8)', 1.3);
              for (let i = 0; i < 38; i++) s.at(i * 48, () => {
                  s.add({ x: p.x + R_(-150, 150), y: p.y - R_(260, 340), vx: R_(-20, 20), vy: R_(40, 140), g: 760, max: 3, size: R_(5, 8), col: '#ffcf3f', shape: 'coin', tws: R_(8, 15), add: false, ground: gy, bounce: 1,
                      onHit: q => { for (let k = 0; k < 4; k++) s.add({ x: q.x, y: q.y, vx: R_(-110, 110), vy: -R_(80, 220), g: 700, max: R_(.3, .6), size: 1.8, col: '#fff4c2', shape: 'spark' }); } });
                  if (i % 6 === 0) s.sfx('coin');
              });
          } },

        { id: 'f-lightning', pv: 480, name: 'Lightning', rarity: 'epic', price: 2200,
          fx(s, p) {
              const gy = p.y + (p.r || 14); s.sfx('boost'); s.shake(13); s.flash('#cfe6ff', .75);
              strike(s, p.x, p, gy, p.y - 560);
              s.at(150, () => { s.sfx('shatter'); s.flash('#ffffff', .5); strike(s, p.x + R_(-90, 90), p, gy, p.y - 560); });
              s.at(330, () => { s.shake(9); strike(s, p.x + R_(-40, 40), p, gy, p.y - 560); });
          } },

        { id: 'f-inferno', pv: 330, name: 'Inferno', rarity: 'epic', price: 2300,
          fx(s, p) {
              const gy = p.y + (p.r || 14); s.sfx('rocket'); s.shake(6); s.ring(p.x, gy, '#ff7a3d', 200, .8, true, 7); s.pillar(p.x, gy, 80, 300, 'rgba(255,120,40,.9)', 1.5);
              for (let i = 0; i < 52; i++) s.at(i * 30, () => {
                  for (let k = 0; k < 3; k++) s.add({ x: p.x + R_(-16, 16), y: gy - 2, vx: R_(-34, 34), vy: -R_(180, 400), g: -80, max: R_(.55, 1), size: R_(10, 20), shrink: .9, cols: ['#fff2a8', '#ffb12e', '#ff5a1f', '#a02012'], alpha: .75 });
                  s.add({ x: p.x + R_(-20, 20), y: gy - 6, vx: R_(-70, 70), vy: -R_(160, 420), max: R_(.8, 1.6), size: R_(1.4, 2.4), col: '#ffd27a', glow: 1, sway: { a: 40, f: 5, p: R_(0, 6) } });
              });
          } },

        { id: 'f-rocket', pv: 480, name: 'Rocket', rarity: 'legendary', price: 4000,
          fx(s, p) {
              const gy = p.y + (p.r || 14); s.sfx('rocket'); s.shake(5);
              for (let i = 0; i < 14; i++) s.add({ x: p.x + R_(-20, 20), y: gy, vx: R_(-110, 110), vy: -R_(10, 90), max: R_(.7, 1.3), size: R_(8, 15), col: '#b8c2d6', add: false, alpha: .4, shrink: -.8 });
              const T = .85; s.add({ x: p.x, y: p.y - 4, vx: 0, vy: -200, g: -650, max: T, size: 1, shape: 'rocket', trail: { acc: 0, every: .012, life: .55, size: 4, col: '#ffcf3f' } });
              s.add({ x: p.x, y: p.y - 4, vx: 0, vy: -200, g: -650, max: T, size: 1, shape: 'dot', col: 'rgba(0,0,0,0)', trail: { acc: 0, every: .02, life: .8, size: 5, col: '#ff7a3d' } });
              s.at(T * 1000, () => {
                  const y = p.y - (200 * T + .5 * 650 * T * T); s.sfx('shatter'); s.sfx('finish'); s.shake(11); s.flash('#fff4c2', .4); s.flare(p.x, y, 190, '#ffcf3f', .8);
                  [0, 110, 230].forEach((t, k) => s.at(t, () => s.ring(p.x, y, pick(PAL), 120 + k * 50, .7)));
                  for (let i = 0; i < 64; i++) { const a = i / 64 * TAU, sp = R_(120, 430); s.add({ x: p.x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 200, drag: 1.5, max: R_(1.1, 1.8), size: R_(3, 6), col: pick(PAL), shape: 'star', spin: R_(-8, 8), trail: { acc: 0, every: .035, life: .3, size: 1.8, col: '#ffcf3f' } }); }
              });
          } },

        { id: 'f-galaxy', pv: 330, name: 'Galaxy', rarity: 'legendary', price: 4500,
          fx(s, p) {
              s.sfx('boost'); s.flash('#b3a9ff', .3); s.flare(p.x, p.y, 120, '#b3a9ff', 1.4); s.ring(p.x, p.y, '#b3a9ff', 190, 1, true, 5);
              const cols = ['#ffffff', '#b3a9ff', '#7c6bff', '#ff8ae6', '#5eb4ff'];
              for (let arm = 0; arm < 3; arm++) for (let i = 0; i < 40; i++) s.at(i * 22, () => s.add({ max: R_(1.4, 2.2), size: R_(1.6, 3.4), col: pick(cols), glow: 1, shape: Math.random() < .2 ? 'star' : 'dot',
                  polar: { cx: p.x, cy: p.y - 20, a: arm * TAU / 3 + i * .09, r: 8, da: 2.8 - i * .02, dr: 90 + i * 2.4, tilt: .55 } }));
              for (let i = 0; i < 26; i++) s.at(i * 40, () => s.add({ x: p.x + R_(-170, 170), y: p.y + R_(-170, 60), size: R_(1, 2.2), max: R_(.5, 1), col: '#ffffff', glow: 1, vx: 0, vy: -10 }));
          } },

        { id: 'f-supernova', pv: 380, name: 'Supernova', rarity: 'legendary', gemPrice: 450, premium: true,
          fx(s, p) {
              s.sfx('boost'); s.sfx('finish'); s.shake(18); s.flash('#ffffff', .85); s.flare(p.x, p.y, 300, '#ffcf3f', 1.1);
              [0, 90, 180, 270].forEach((t, i) => s.at(t, () => s.ring(p.x, p.y, i % 2 ? '#ffcf3f' : '#ffffff', 180 + i * 55, .9, false, 6 - i)));
              s.at(200, () => s.flare(p.x, p.y, 220, '#ff9838', .8));
              for (let i = 0; i < 80; i++) { const a = i / 80 * TAU + R_(-.03, .03), sp = R_(220, 700); s.add({ x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 1.4, max: R_(.6, 1.1), size: R_(2, 4), col: i % 3 ? '#ffcf3f' : '#ffffff', shape: i % 2 ? 'spark' : 'dot', glow: 1 }); }
              for (let i = 0; i < 18; i++) s.add({ x: p.x, y: p.y, vx: R_(-300, 300), vy: R_(-300, 300), g: 160, drag: 1, max: R_(1, 1.6), size: R_(3, 5), col: '#fff4c2', shape: 'star', spin: R_(-6, 6) });
          } },

        { id: 'f-royal', pv: 330, name: 'Royal', rarity: 'legendary', gemPrice: 600, premium: true,
          fx(s, p) {
              s.sfx('finish'); s.shake(6); s.flash('#fff4c2', .35); s.ring(p.x, p.y, '#ffcf3f', 150, .8);
              s.crowns.push({ x: p.x, y: p.y - 86, life: 0, dur: 2.6 });
              for (let i = 0; i < 56; i++) s.at(i * 38, () => s.add({ x: p.x + R_(-170, 170), y: p.y - R_(240, 330), vx: R_(-30, 30), vy: R_(60, 150), g: 120, max: R_(2, 3), size: R_(2.6, 4.2), col: pick(['#ffcf3f', '#fff4c2', '#ff9838']), shape: i % 5 ? 'conf' : 'star', spin: R_(-6, 6), tws: R_(6, 13), add: false, sway: { a: 40, f: 3, p: R_(0, 6) } }));
              for (let i = 0; i < 36; i++) s.at(250 + i * 50, () => { const a = R_(0, TAU), r = R_(30, 100); s.add({ x: p.x + Math.cos(a) * r, y: p.y - 86 + Math.sin(a) * r * .7, size: R_(3, 6), max: R_(.5, .9), shape: 'star', col: '#fff4c2', spin: 4, shrink: 1 }); });
          } },
    ];
    const BY = Object.fromEntries(FINISHERS.map(f => [f.id, f]));

    /* =========================================================================== in the race ==== */
    let live = null, lastT = 0, flashEl = null;
    function flashOverlay(col, a) {
        if (!flashEl) { flashEl = document.createElement('div'); flashEl.style.cssText = 'position:fixed;inset:0;z-index:40;pointer-events:none;opacity:0'; document.body.appendChild(flashEl); }
        flashEl.style.transition = 'none'; flashEl.style.background = col; flashEl.style.opacity = a; void flashEl.offsetWidth;
        flashEl.style.transition = 'opacity .5s ease-out'; flashEl.style.opacity = 0;
    }
    function play(p) {
        const f = BY[prog().finisher]; if (!f || !f.fx) return;
        if (!live) live = makeSim({ sfx: n => SFX.play(n), shake: n => { camShake = Math.max(camShake, n); }, flash: flashOverlay });
        lastT = 0; f.fx(live, { x: p.x, y: p.y, r: p.r || 14 });
    }
    function draw(ctx) {
        if (!live || live.empty()) return;
        const now = performance.now(), dt = Math.min(.05, lastT ? (now - lastT) / 1000 : .016); lastT = now;
        live.update(dt); live.draw(ctx);
    }
    function clear() { if (live) live.clear(); }

    /* =========================================================================== looping previews ==== */
    const mounts = new Set(); let raf = 0, prevT = 0;
    function cube(c, S) {
        const g = c.createLinearGradient(0, -S, 0, S); g.addColorStop(0, '#6ff0dc'); g.addColorStop(1, '#1fb8a3');
        c.fillStyle = g; c.strokeStyle = '#0b4a42'; c.lineWidth = 2; c.beginPath();
        const r = S * .3, x0 = -S, y0 = -S, w = S * 2;                       // rounded square by hand (older phones have no roundRect)
        c.moveTo(x0 + r, y0); c.arcTo(x0 + w, y0, x0 + w, y0 + w, r); c.arcTo(x0 + w, y0 + w, x0, y0 + w, r); c.arcTo(x0, y0 + w, x0, y0, r); c.arcTo(x0, y0, x0 + w, y0, r); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = '#0d1017'; for (const x of [-S * .42, S * .42]) { c.beginPath(); c.arc(x, -S * .1, S * .17, 0, TAU); c.fill(); }
    }
    function step(m, dt) {
        const cv = m.cv, w = cv.width, h = cv.height, c = m.ctx, k = h / (m.span || 430), S = 14;
        if (!m.sim) {
            if ((m.idle -= dt) > 0) { if (!m.still) { prime(m); m.still = true; } return; } else if (m.f.fx) { m.sim = makeSim({}); m.f.fx(m.sim, { x: 0, y: 0, r: S }); m.age = 0; m.still = false; }
        }
        if (m.sim) { m.sim.update(dt); m.age += dt; if (m.age > .3 && m.sim.empty()) { m.sim = null; m.idle = m.hold || .9; } }
        c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, w, h);
        c.translate(w / 2, h * (m.oy || .8)); c.scale(k, k);
        if (!m.f.fx) { c.strokeStyle = '#566074'; c.lineWidth = 3 / k * 1.2; c.beginPath(); c.arc(0, -40, 26, 0, TAU); c.moveTo(-18, -22); c.lineTo(18, -58); c.stroke(); }
        cube(c, S);
        if (m.sim) m.sim.draw(c);
    }
    function tick(t) {
        raf = 0; const dt = Math.min(.05, prevT ? (t - prevT) / 1000 : .016); prevT = t;
        for (const m of mounts) {
            if (!m.cv.isConnected) { mounts.delete(m); continue; }
            const r = m.cv.getBoundingClientRect(); if (!r.width || r.bottom < 0 || r.top > innerHeight) continue;
            try { step(m, dt); } catch (e) { m.sim = null; m.idle = 1; }
        }
        if (mounts.size) raf = requestAnimationFrame(tick); else prevT = 0;
    }
    // a first still frame straight away, so a card is never empty (and something shows even if the animation cannot run)
    function prime(m) {
        const cv = m.cv, w = cv.width, h = cv.height, c = m.ctx, k = h / (m.span || 430);
        try {
            c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, w, h); c.translate(w / 2, h * (m.oy || .8)); c.scale(k, k);
            cube(c, 14);
            if (m.f.fx) {
                const s = makeSim({}); m.f.fx(s, { x: 0, y: 0, r: 14 });
                let t = 0, until = m.f.still || .5; while (t < until) { s.update(1 / 30); t += 1 / 30; }
                s.draw(c);
            } else { c.strokeStyle = '#566074'; c.lineWidth = 4; c.beginPath(); c.arc(0, -40, 26, 0, TAU); c.moveTo(-18, -22); c.lineTo(18, -58); c.stroke(); }
        } catch (e) {
            try { c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, w, h); c.fillStyle = RARITY[m.f.rarity].color; c.globalAlpha = .9; c.beginPath(); c.arc(w / 2, h / 2, h * .22, 0, TAU); c.fill(); c.globalAlpha = 1; c.fillStyle = '#0d1017'; c.font = '900 ' + Math.round(h * .26) + 'px system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(m.f.name[0], w / 2, h / 2 + 2); } catch (e2) {}
        }
    }
    function mount(cv, f, opts) {
        const m = Object.assign({ cv, f, ctx: cv.getContext('2d'), sim: null, idle: Math.random() * .15, age: 0, hold: .35 }, opts || {});
        prime(m);
        mounts.add(m); if (!raf) raf = requestAnimationFrame(tick); return m;
    }

    /* =========================================================================== shop ==== */
    function renderShop(grid) {
        const p = prog(); grid.innerHTML = '';
        const head = document.createElement('div'); head.className = 'em-head';
        head.innerHTML = '<b>Finishers</b>'; grid.appendChild(head);
        const RANK = { common: 0, rare: 1, epic: 2, legendary: 3 };
        const isOwn = f => f.price === 0 || p.owned.includes(f.id);
        const grp = f => f.premium ? 0 : isOwn(f) ? 1 : 2;      // gem finishers first, then what you own, then what is for sale
        const list = FINISHERS.slice().sort((a, b) => grp(a) - grp(b) || (grp(a) === 1 ? ((a.price === 0 ? 0 : 1) - (b.price === 0 ? 0 : 1)) || p.owned.indexOf(b.id) - p.owned.indexOf(a.id) : RANK[a.rarity] - RANK[b.rarity] || (a.price || a.gemPrice) - (b.price || b.gemPrice)));
        let armed = null, armT = 0;
        for (const f of list) {
            const own = isOwn(f), eq = (p.finisher || 'f-none') === f.id;
            const b = document.createElement('button'); b.type = 'button'; b.className = 'm-skin fn-card' + (eq ? ' eq' : '') + (f.premium ? ' prem' : '') + (f.rarity === 'legendary' ? ' leg' : '');
            b.style.setProperty('--rc', RARITY[f.rarity].color);
            b.innerHTML = '<span class="m-skin-pv"><canvas width="460" height="336" class="fn-pv"></canvas></span><b>' + f.name + '</b>' +
                '<span class="m-skin-f"><span class="buy-hint">Tap again</span><span class="' + (own ? (eq ? 'eqd' : 'own') : 'price') + '">' + (own ? (eq ? 'EQUIPPED' : 'OWNED') : f.premium ? icon('gem') + ' ' + f.gemPrice : icon('coin') + ' ' + f.price.toLocaleString('en-US')) + '</span></span>';
            mount(b.querySelector('canvas'), f, { span: f.pv || 340, oy: .84 });
            b.onclick = () => {
                if (own) { const q = prog(); q.finisher = eq ? 'f-none' : f.id; saveProg(q); SFX.play('item'); renderShop(grid); return; }
                const afford = f.premium ? gemCount() >= f.gemPrice : load('rr_coins', 0) >= f.price;
                if (!afford) { b.classList.add('m-shake'); setTimeout(() => b.classList.remove('m-shake'), 400); SFX.play('fall'); if (f.premium) { toast('You need ' + f.gemPrice + ' gems'); setTimeout(goGemShop, 450); } return; }
                if (armed !== b) { grid.querySelectorAll('.arm').forEach(x => x.classList.remove('arm')); b.classList.add('arm'); armed = b; SFX.play('count'); clearTimeout(armT); armT = setTimeout(() => { b.classList.remove('arm'); armed = null; }, 2600); return; }
                if (f.premium) store('rr_gems', gemCount() - f.gemPrice); else store('rr_coins', load('rr_coins', 0) - f.price);
                const q = prog(); q.owned.push(f.id); q.finisher = f.id; saveProg(q); SFX.play('pickup'); refreshMenu(); renderShop(grid);
            };
            grid.appendChild(b);
        }
    }
    window.Finishers = { FINISHERS, BY, play, draw, clear, mount, renderShop, makeSim };
})();
