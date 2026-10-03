// Trail effects engine. Loaded BEFORE game.js. A trail's `fx` is one layer object or an array of layers:
//   { life, rate, max, shape, colors[], colorMode:'age'|'seed'|'rainbow', size:[start,end], spread, drift:[vx,vy], vx, gravity,
//     spin, randRot, alpha, glow, twinkle, jitter, ribbon:{w, colors[], alpha} }
(function () {
    const TAU = Math.PI * 2;
    const hex2rgb = h => { if (typeof h !== 'string' || h[0] !== '#') return [255, 255, 255]; if (h.length === 4) h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3]; const n = parseInt(h.slice(1, 7), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
    const mixc = (cols, t) => { if (!cols || !cols.length) return [255, 255, 255]; if (cols.length === 1) return hex2rgb(cols[0]); const f = Math.min(.9999, Math.max(0, t)) * (cols.length - 1), i = Math.floor(f), k = f - i, a = hex2rgb(cols[i]), b = hex2rgb(cols[i + 1]); return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; };
    const rgb = a => 'rgb(' + (a[0] | 0) + ',' + (a[1] | 0) + ',' + (a[2] | 0) + ')';
    const fract = v => v - Math.floor(v);
    const layersOf = fx => !fx ? [] : Array.isArray(fx) ? fx : [fx];
    window.trailLife = trail => { const L = layersOf(trail && trail.fx); return L.length ? Math.max(...L.map(l => l.life || .5)) : .52; };
    window.trailRate = trail => { const L = layersOf(trail && trail.fx); return L.length ? Math.min(...L.map(l => l.rate || .035)) : .035; };
    window.trailMax = trail => { const L = layersOf(trail && trail.fx); return L.length ? Math.max(...L.map(l => l.max || 14)) : 14; };

    const STROKE = { ring: 1, snow: 1, bubble: 1 };
    const SHAPES = {
        circle(c, s) { c.arc(0, 0, s, 0, TAU); },
        square(c, s) { c.rect(-s, -s, s * 2, s * 2); },
        diamond(c, s) { c.moveTo(0, -s * 1.35); c.lineTo(s, 0); c.lineTo(0, s * 1.35); c.lineTo(-s, 0); c.closePath(); },
        star(c, s) { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? s * .45 : s * 1.2; i ? c.lineTo(Math.cos(a) * r, Math.sin(a) * r) : c.moveTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); },
        star4(c, s) { for (let i = 0; i < 8; i++) { const a = -Math.PI / 2 + i * Math.PI / 4, r = i % 2 ? s * .3 : s * 1.5; i ? c.lineTo(Math.cos(a) * r, Math.sin(a) * r) : c.moveTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); },
        heart(c, s) { c.moveTo(0, s * .95); c.bezierCurveTo(-s * 1.7, -s * .1, -s * .85, -s * 1.25, 0, -s * .45); c.bezierCurveTo(s * .85, -s * 1.25, s * 1.7, -s * .1, 0, s * .95); },
        bolt(c, s) { c.moveTo(s * .3, -s * 1.5); c.lineTo(-s * .8, s * .2); c.lineTo(-s * .05, s * .2); c.lineTo(-s * .4, s * 1.5); c.lineTo(s * .85, -s * .35); c.lineTo(s * .1, -s * .35); c.closePath(); },
        ring(c, s) { c.arc(0, 0, s, 0, TAU); },
        snow(c, s) { for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; c.moveTo(Math.cos(a) * s * 1.3, Math.sin(a) * s * 1.3); c.lineTo(-Math.cos(a) * s * 1.3, -Math.sin(a) * s * 1.3); } },
        leaf(c, s) { c.moveTo(0, -s * 1.5); c.quadraticCurveTo(s * 1.15, 0, 0, s * 1.5); c.quadraticCurveTo(-s * 1.15, 0, 0, -s * 1.5); },
        note(c, s) { c.ellipse(-s * .25, s * .8, s * .75, s * .55, -.4, 0, TAU); c.moveTo(s * .38, s * .6); c.lineTo(s * .38, -s * 1.5); c.lineTo(s * 1.15, -s * .7); c.lineTo(s * 1.15, -s * .1); c.lineTo(s * .62, -s * .6); c.lineTo(s * .62, s * .6); c.closePath(); },
        drop(c, s) { c.moveTo(0, -s * 1.5); c.bezierCurveTo(s * .25, -s * .7, s * 1.0, -s * .1, s * 1.0, s * .55); c.arc(0, s * .55, s, 0, Math.PI); c.bezierCurveTo(-s * 1.0, -s * .1, -s * .25, -s * .7, 0, -s * 1.5); },
        flame(c, s) { c.moveTo(0, -s * 1.8); c.bezierCurveTo(s * .3, -s * .8, s * 1.1, -s * .2, s * .95, s * .6); c.bezierCurveTo(s * .8, s * 1.3, -s * .8, s * 1.3, -s * .95, s * .6); c.bezierCurveTo(-s * 1.1, -s * .2, -s * .3, -s * .8, 0, -s * 1.8); },
        cross(c, s) { const w = s * .38; c.moveTo(-w, -s); c.lineTo(w, -s); c.lineTo(w, -w); c.lineTo(s, -w); c.lineTo(s, w); c.lineTo(w, w); c.lineTo(w, s); c.lineTo(-w, s); c.lineTo(-w, w); c.lineTo(-s, w); c.lineTo(-s, -w); c.lineTo(-w, -w); c.closePath(); },
        tri(c, s) { c.moveTo(0, -s * 1.2); c.lineTo(s * 1.05, s * .8); c.lineTo(-s * 1.05, s * .8); c.closePath(); },
        bubble(c, s) { c.arc(0, 0, s, 0, TAU); },
        coin(c, s) { c.ellipse(0, 0, s * .55, s, 0, 0, TAU); },
    };

    function drawLayer(c, fx, samples, pid) {
        const life = fx.life || .5, sz = fx.size || [6, 1.5], n = samples.length;
        if (fx.ribbon && n > 1) {
            const r = fx.ribbon; c.lineCap = 'round'; c.lineJoin = 'round';
            for (let i = 1; i < n; i++) {
                const a = samples[i - 1], b = samples[i], t = Math.min(1, b.age / life);
                c.globalAlpha = (r.alpha === undefined ? .55 : r.alpha) * (1 - t * t); c.strokeStyle = rgb(mixc(r.colors || fx.colors, t)); c.lineWidth = Math.max(.4, r.w * (1 - t * .9));
                const dy = r.dy || 0; c.beginPath(); c.moveTo(a.x, a.y + dy); c.lineTo(b.x, b.y + dy); c.stroke();
            }
        }
        if (!fx.shape) return;
        const draw = SHAPES[fx.shape] || SHAPES.circle, stroke = STROKE[fx.shape];
        for (let i = 0; i < n; i++) {
            const s = samples[i], t = Math.min(1, s.age / life); if (t >= 1) continue;
            const sd = s.s === undefined ? fract(i * .618 + pid * .37) : s.s, r2 = fract(sd * 7.13), age = s.age;
            const sp = fx.spread || 0, drift = fx.drift || [0, 0];
            let x = s.x + (sd - .5) * 2 * sp + drift[0] * age + (r2 - .5) * (fx.vx || 0) * age;
            let y = s.y + (r2 - .5) * 2 * sp + drift[1] * age + .5 * (fx.gravity || 0) * age * age;
            if (fx.jitter) x += ((Math.floor(age * 60 + sd * 10) % 3) - 1) * fx.jitter;
            let size = sz[0] + (sz[1] - sz[0]) * t; if (fx.twinkle) size *= .65 + .35 * Math.sin(age * 28 + sd * 20);
            if (size < .15) continue;
            const al = (fx.alpha === undefined ? .9 : fx.alpha) * (1 - t * t);
            const mode = fx.colorMode || 'age', cols = fx.colors || ['#fff'];
            const col = mode === 'rainbow' ? 'hsl(' + ((sd * 360 + age * 220) % 360 | 0) + ',92%,62%)' : mode === 'seed' ? cols[Math.floor(sd * cols.length) % cols.length] : rgb(mixc(cols, t));
            if (fx.glow) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = al * .2 * fx.glow; c.fillStyle = col; c.beginPath(); c.arc(x, y, size * (1.5 + fx.glow * .7), 0, TAU); c.fill(); c.restore(); }
            c.save(); c.translate(x, y); c.rotate((fx.spin || 0) * age + (fx.randRot ? sd * TAU : 0));
            c.globalAlpha = al; c.beginPath(); draw(c, size);
            if (stroke) { c.strokeStyle = col; c.lineWidth = Math.max(.6, size * (fx.shape === 'snow' ? .28 : .32)); c.lineCap = 'round'; c.stroke(); if (fx.shape === 'bubble') { c.beginPath(); c.arc(-size * .35, -size * .35, size * .22, 0, TAU); c.fillStyle = '#fff'; c.fill(); } }
            else { c.fillStyle = col; c.fill(); if (fx.shape === 'coin') { c.beginPath(); c.ellipse(0, 0, size * .3, size * .62, 0, 0, TAU); c.strokeStyle = 'rgba(120,70,0,.6)'; c.lineWidth = Math.max(.5, size * .14); c.stroke(); } }
            c.restore();
        }
    }
    // Draw a player's trail samples (world space) onto ctx.
    window.drawTrailFx = function (c, trail, samples, pid) {
        for (const L of layersOf(trail.fx)) drawLayer(c, L, samples, pid || 0);
        c.globalAlpha = 1;
    };
    // Animated/static preview on a small canvas. t = seconds into the loop.
    window.drawTrailPreview = function (cv, trail, t, zoom) {
        const c = cv.getContext('2d'), W = cv.width, H = cv.height; t = t === undefined ? 1.15 : t;
        c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, H);
        const life = trailLife(trail), rate = trailRate(trail), u = H / 120 * (zoom || 1);
        c.setTransform(u, 0, 0, u, 0, 0);
        const ww = W / u, hh = H / u, pathX = e => ww * .5 + Math.sin(e * 1.1 - 1.1) * ww * .34, pathY = e => hh * .5 + Math.sin(e * 2.6) * hh * .2;
        const samples = [], first = Math.max(0, t - life), k0 = Math.floor(first / rate);
        for (let k = k0; k * rate <= t; k++) { const e = k * rate; samples.push({ x:pathX(e), y:pathY(e), age:t - e, s:fract(Math.sin(k * 12.9898) * 43758.5453) }); }
        if (trail.fx) drawTrailFx(c, trail, samples, 1);
        else { c.fillStyle = trail.color || '#fff'; for (const s of samples) { c.globalAlpha = Math.max(0, 1 - s.age / .52) * .8; c.beginPath(); c.arc(s.x, s.y, 2 + (1 - s.age / .52) * 3.5, 0, TAU); c.fill(); } c.globalAlpha = 1; }
        const hx = pathX(t), hy = pathY(t); c.fillStyle = '#35e0c8'; c.strokeStyle = '#0d1017'; c.lineWidth = 2; c.beginPath(); c.roundRect ? c.roundRect(hx - 12, hy - 12, 24, 24, 4) : c.rect(hx - 12, hy - 12, 24, 24); c.fill(); c.stroke();
        c.fillStyle = '#0d1017'; c.beginPath(); c.arc(hx - 4, hy - 2, 2.4, 0, TAU); c.arc(hx + 4, hy - 2, 2.4, 0, TAU); c.fill();
    };
})();
