// LIVING CHARACTERS: faces, polish and animation for the cube players.
//   CharFX   drawing helpers: body gloss, eyes + mouth with expressions (used in the race, the menu, the shop previews and the podium)
//   CharAnim animated characters on a canvas: idle breathing + blinking, a random face on every tap, a salto on a quick second tap,
//            win / cheer / lose moods for the podium and the result screens. One shared loop drives them all and sleeps when nothing is on screen.
// Loaded AFTER game.js (it uses renderLook, lookMetrics, rrPath) and before the modes that show a podium.
(function () {
    'use strict';
    const TAU = Math.PI * 2, INK = '#0d1017';
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const sstep = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
    const ease = { out: x => 1 - (1 - x) * (1 - x), inout: x => x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2 };
    const rnd = (a, b) => a + Math.random() * (b - a);

    /* ------------------------------------------------------------------------------ drawing ---- */
    function heart(c, x, y, r) {
        c.beginPath(); c.moveTo(x, y + r * .9);
        c.bezierCurveTo(x - r * 1.6, y - r * .1, x - r * .9, y - r * 1.3, x, y - r * .4);
        c.bezierCurveTo(x + r * .9, y - r * 1.3, x + r * 1.6, y - r * .1, x, y + r * .9); c.closePath();
    }
    function star(c, x, y, r, rot) {
        c.beginPath();
        for (let i = 0; i < 10; i++) { const a = rot + i * Math.PI / 5 - Math.PI / 2, q = i % 2 ? r * .46 : r; c[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * q, y + Math.sin(a) * q); }
        c.closePath();
    }
    // a soft light on the cube: bright top, darker bottom, a glow in the top-left corner and a thin rim, so it reads as a rounded toy instead of a flat square
    function gloss(c, s, k) {
        c.save(); rrPath(c, -s, -s, s * 2, s * 2, 4 * k); c.clip();
        const g = c.createLinearGradient(0, -s, 0, s);
        g.addColorStop(0, 'rgba(255,255,255,0.20)'); g.addColorStop(0.42, 'rgba(255,255,255,0.03)'); g.addColorStop(0.62, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.24)');
        c.fillStyle = g; c.fillRect(-s, -s, s * 2, s * 2);
        const h = c.createRadialGradient(-s * .45, -s * .55, 0, -s * .45, -s * .55, s * .95);
        h.addColorStop(0, 'rgba(255,255,255,0.26)'); h.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = h; c.fillRect(-s, -s, s * 2, s * 2);
        c.lineWidth = k * 1.1; c.strokeStyle = 'rgba(255,255,255,0.15)'; rrPath(c, -s + k * .9, -s + k * .9, s * 2 - k * 1.8, s * 2 - k * 1.8, 3.2 * k); c.stroke();
        c.restore();
    }
    function brow(c, k, x, y, side, kind) {                      // kind 1 = sad (inner end up), -1 = angry (inner end down)
        const inner = y - (kind > 0 ? 5.3 : 3.3) * k, outer = y - (kind > 0 ? 3.4 : 5.2) * k;
        c.strokeStyle = INK; c.lineWidth = 1.5 * k; c.lineCap = 'round'; c.beginPath();
        c.moveTo(x + side * 2.5 * k, outer); c.lineTo(x - side * 2.3 * k, inner); c.stroke();
    }
    function eye(c, k, side, e, t) {
        const x = side * 4 * k + (e.lx || 0) * k, y = -2 * k + (e.ly || 0) * k, bl = e.blink || 0;
        let m = e.eye || 'dot';
        if (m === 'wink') m = side < 0 ? 'dot' : 'happy';
        c.lineCap = 'round'; c.lineJoin = 'round';
        if (m === 'dot' || m === 'sad' || m === 'angry') {
            const r = (m === 'dot' ? 2.4 : 2.2) * k;
            c.fillStyle = INK; c.beginPath(); c.ellipse(x, y, r, Math.max(.25 * k, r * (1 - .9 * bl)), 0, 0, TAU); c.fill();
            if (bl < .45) { c.fillStyle = 'rgba(255,255,255,0.9)'; c.beginPath(); c.arc(x + .75 * k, y - .85 * k, .8 * k, 0, TAU); c.fill(); }
            if (m !== 'dot') brow(c, k, x, y, side, m === 'sad' ? 1 : -1);
        } else if (m === 'happy') {
            c.strokeStyle = INK; c.lineWidth = 1.8 * k; c.beginPath(); c.arc(x, y + 1.2 * k, 2.4 * k, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
        } else if (m === 'closed') {
            c.strokeStyle = INK; c.lineWidth = 1.6 * k; c.beginPath(); c.moveTo(x - 2.3 * k, y); c.quadraticCurveTo(x, y + 1.6 * k, x + 2.3 * k, y); c.stroke();
        } else if (m === 'wide') {
            c.fillStyle = '#fff'; c.strokeStyle = INK; c.lineWidth = 1 * k; c.beginPath(); c.arc(x, y, 3.5 * k, 0, TAU); c.fill(); c.stroke();
            c.fillStyle = INK; c.beginPath(); c.arc(x + (e.lx || 0) * .5 * k, y + (e.ly || 0) * .5 * k, 1.7 * k, 0, TAU); c.fill();
            c.fillStyle = '#fff'; c.beginPath(); c.arc(x + .6 * k, y - .7 * k, .65 * k, 0, TAU); c.fill();
        } else if (m === 'heart') {
            const r = 2.9 * k * (1 + .13 * Math.sin(t * 9));
            c.fillStyle = '#ff4f7b'; heart(c, x, y, r); c.fill(); c.strokeStyle = 'rgba(120,10,50,.55)'; c.lineWidth = .7 * k; c.stroke();
            c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.arc(x - r * .45, y - r * .35, r * .2, 0, TAU); c.fill();
        } else if (m === 'star') {
            c.fillStyle = '#ffd23f'; c.strokeStyle = 'rgba(120,70,0,.6)'; c.lineWidth = .7 * k; star(c, x, y, 3.4 * k, t * 2.2 * side); c.fill(); c.stroke();
        } else if (m === 'dizzy') {
            c.strokeStyle = INK; c.lineWidth = 1.05 * k; c.beginPath();
            const sp = t * 9 * -side;
            for (let i = 0; i <= 34; i++) { const u = i / 34, a = sp + u * TAU * 2.4, r = u * 2.7 * k; c[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r); }
            c.stroke();
        } else if (m === 'squint') {
            c.strokeStyle = INK; c.lineWidth = 1.7 * k; c.beginPath();
            c.moveTo(x - side * 2.2 * k, y - 1.7 * k); c.lineTo(x + side * 1.5 * k, y); c.lineTo(x - side * 2.2 * k, y + 1.7 * k); c.stroke();
        }
    }
    function mouth(c, k, e, t) {
        const m = e.mouth; if (!m || m === 'none') return;
        const y = 4.9 * k; c.lineCap = 'round'; c.lineJoin = 'round';
        if (m === 'smile') {
            c.strokeStyle = INK; c.lineWidth = 1.5 * k; c.beginPath(); c.arc(0, y - 1.5 * k, 3.1 * k, .18 * Math.PI, .82 * Math.PI); c.stroke();
        } else if (m === 'grin') {
            c.save(); c.beginPath(); c.moveTo(-4.2 * k, y - 1.8 * k); c.quadraticCurveTo(0, y + 5.2 * k, 4.2 * k, y - 1.8 * k); c.quadraticCurveTo(0, y - 2.9 * k, -4.2 * k, y - 1.8 * k); c.closePath();
            c.fillStyle = INK; c.fill(); c.clip();
            c.fillStyle = '#fff'; c.fillRect(-4.4 * k, y - 3 * k, 8.8 * k, 1.9 * k);
            c.fillStyle = '#ff7a98'; c.beginPath(); c.ellipse(0, y + 2.7 * k, 2.6 * k, 1.8 * k, 0, 0, TAU); c.fill(); c.restore();
        } else if (m === 'open') {
            const o = e.mo === undefined ? 1 : e.mo;
            c.fillStyle = INK; c.beginPath(); c.ellipse(0, y + .5 * k, 1.9 * k, 2.5 * k * o + .2 * k, 0, 0, TAU); c.fill();
            c.fillStyle = '#ff7a98'; c.beginPath(); c.ellipse(0, y + 1.5 * k, 1.1 * k, 1 * k * o, 0, 0, TAU); c.fill();
        } else if (m === 'tongue') {
            const l = .78 + .22 * Math.sin(t * 14);
            c.fillStyle = '#ff6f91'; c.strokeStyle = INK; c.lineWidth = .9 * k; c.beginPath();
            c.moveTo(.2 * k, y - .7 * k); c.lineTo(.2 * k, y + 2.2 * k * l); c.quadraticCurveTo(2.2 * k, y + 4.4 * k * l, 4.1 * k, y + 2.2 * k * l); c.lineTo(4.1 * k, y - .7 * k); c.closePath(); c.fill(); c.stroke();
            c.strokeStyle = 'rgba(120,20,50,.45)'; c.lineWidth = .6 * k; c.beginPath(); c.moveTo(2.2 * k, y + .2 * k); c.lineTo(2.2 * k, y + 2 * k * l); c.stroke();
            c.strokeStyle = INK; c.lineWidth = 1.5 * k; c.beginPath(); c.moveTo(-4 * k, y - 1.3 * k); c.quadraticCurveTo(0, y + 1.2 * k, 4.4 * k, y - .9 * k); c.stroke();
        } else if (m === 'frown') {
            c.strokeStyle = INK; c.lineWidth = 1.5 * k; c.beginPath(); c.arc(0, y + 3.3 * k, 3 * k, 1.18 * Math.PI, 1.82 * Math.PI); c.stroke();
        } else if (m === 'kiss') {
            c.fillStyle = '#ff7a98'; c.strokeStyle = INK; c.lineWidth = .9 * k; c.beginPath(); c.ellipse(0, y + .2 * k, 1.5 * k, 1.3 * k, 0, 0, TAU); c.fill(); c.stroke();
        } else if (m === 'wobble') {
            c.strokeStyle = INK; c.lineWidth = 1.4 * k; c.beginPath();
            for (let i = 0; i <= 16; i++) { const u = i / 16; c[i ? 'lineTo' : 'moveTo']((u - .5) * 8 * k, y + .6 * k + Math.sin(u * TAU * 2 + t * 10) * 1.1 * k); } c.stroke();
        }
    }
    // draws both eyes (and a mouth when asked) with the origin in the middle of the body
    function face(c, k, e, t) { eye(c, k, -1, e, t); eye(c, k, 1, e, t); mouth(c, k, e, t); }
    // what a racer's face shows right now: a blink now and then, dizzy when stunned, happy at the finish, wide eyed in a hard fall
    function raceFace(p, t, lx, ly) {
        const f = p._fx || (p._fx = { eye: 'dot', mouth: 'none', blink: 0, lx: 0, ly: 0, mo: 1 });
        const sd = p._blinkSeed === undefined ? (p._blinkSeed = Math.random() * 7) : p._blinkSeed, per = 3.2 + sd * .45, ph = ((t + sd) % per) / .13;
        f.blink = ph < 1 ? Math.sin(Math.PI * ph) : 0; f.lx = lx; f.ly = ly; f.mouth = 'none'; f.eye = 'dot';
        if (p.zapT > 0) { f.eye = 'dizzy'; f.mouth = 'wobble'; f.blink = 0; }
        else if (p.finished) { f.eye = 'happy'; f.mouth = 'smile'; }
        else if (p.mode === 'air' && p.vy > 950) { f.eye = 'wide'; f.mouth = 'open'; f.mo = clamp((p.vy - 950) / 600, .4, 1); f.blink = 0; }
        else if (p.mode === 'air' && p.vy < -1000) { f.mouth = 'smile'; }
        return f;
    }
    window.CharFX = { gloss, face, eye, mouth, heart, star, raceFace };

    /* -------------------------------------------------------------------------- the actors ---- */
    const FACES = [
        { eye: 'happy',  mouth: 'grin',   tilt: 0,    snd: 'chirp' },
        { eye: 'wink',   mouth: 'tongue', tilt: .13,  snd: 'squeak' },
        { eye: 'wide',   mouth: 'open',   tilt: 0,    snd: 'chirp', stretch: 1 },
        { eye: 'heart',  mouth: 'kiss',   tilt: 0,    snd: 'chirp', hearts: 1, sway: 1 },
        { eye: 'dizzy',  mouth: 'wobble', tilt: 0,    snd: 'squeak', wobble: 1 },
        { eye: 'squint', mouth: 'tongue', tilt: 0,    snd: 'squeak', shake: 1 },
    ];
    const actors = new Set(); let raf = 0, lastFace = -1;

    function Actor(cv, getLook, o) {
        this.cv = cv; this.getLook = getLook; this.o = o || {}; this.mood = this.o.mood || 'idle';
        this.t0 = performance.now() / 1000; this.act = null; this.parts = []; this.pokes = [];
        this.gaze = { x: 0, y: 0, tx: 0, ty: 0, next: 1 }; this.blinkAt = this.t0 + rnd(1.2, 3); this.lastDraw = 0; this.key = ''; this.vis = true; this.visAt = 0; this.moodT = this.t0;
        this.seed = Math.random() * 100; this.cycle = 0; this.dropT = 0;
    }
    Actor.prototype.setMood = function (m, delay) { this.mood = m; this.moodT = performance.now() / 1000 + (delay || 0); this.act = null; this.cycle = 0; this.parts.length = 0; wake(); };
    Actor.prototype.setLook = function (look) { const k = JSON.stringify(look); if (k !== this._lk) { this._lk = k; this.look = look; this.key = ''; } wake(); };
    Actor.prototype.sound = function (n, a) { if (this.o.sound && window.SFX) { try { SFX.play(n, a); } catch (e) {} } };
    Actor.prototype.start = function (kind, data) { this.act = Object.assign({ kind, t0: performance.now() / 1000 }, data || {}); wake(); };
    Actor.prototype.busy = function (t) { return !!this.act || this.mood !== 'idle' || this.parts.length > 0 || t < this.moodT; };
    // a tap on the character: one tap = a face, a quick second tap = a salto, then a double salto and a spin
    Actor.prototype.poke = function () {
        const now = performance.now() / 1000; this.pokes = this.pokes.filter(x => now - x < 1.05); this.pokes.push(now);
        if (this.act && (this.act.kind === 'flip' || this.act.kind === 'spin') && now - this.act.t0 < this.act.dur * .92) return;
        const n = this.pokes.length;
        if (typeof haptic === 'function') haptic(n === 1 ? 8 : [10, 20, 14]);
        if (n === 1) { let i; do { i = Math.floor(Math.random() * FACES.length); } while (i === lastFace); lastFace = i; this.start('face', { dur: 1.25, f: FACES[i] }); this.sound(FACES[i].snd, i); }
        else if (n === 2) { this.start('flip', { dur: 1, h: 1.6, turns: 1, dir: Math.random() < .5 ? 1 : -1 }); this.sound('flip'); }
        else if (n === 3) { this.start('flip', { dur: 1.3, h: 2.1, turns: 2, dir: Math.random() < .5 ? 1 : -1, dizzy: 1 }); this.sound('flip'); }
        else { this.start('spin', { dur: .95 }); this.sound('squeak'); this.pokes.length = 0; }
    };
    function wake() { if (!raf && actors.size) raf = requestAnimationFrame(loop); }

    // the body pose for one moment: offsets in half-body units, squash/stretch, rotation, plus the face
    function poseOf(a, t, P) {
        P.dx = 0; P.dy = 0; P.rot = 0; P.sx = 1; P.sy = 1; P.eye = 'dot'; P.mouth = 'none'; P.blink = 0; P.mo = 1; P.lx = a.gaze.x; P.ly = a.gaze.y; P.shadow = 1;
        const br = Math.sin((t - a.t0) * 2.3 + a.seed);                                            // breathing
        P.sy = 1 + .02 * br; P.sx = 1 - .014 * br;
        if (t >= a.blinkAt) { const u = (t - a.blinkAt) / .14; if (u < 1) P.blink = Math.sin(Math.PI * u); else a.blinkAt = t + rnd(2.2, 5.2) + (Math.random() < .25 ? -1.6 : 0); }
        if (t >= a.gaze.next) { a.gaze.tx = rnd(-1.4, 1.4); a.gaze.ty = rnd(-.7, .7); a.gaze.next = t + rnd(1.4, 3.6); }
        a.gaze.x += (a.gaze.tx - a.gaze.x) * .08; a.gaze.y += (a.gaze.ty - a.gaze.y) * .08;
        const m = a.mood, mt = t - a.moodT;
        if (m !== 'idle' && mt >= 0) MOODS[m](a, t, mt, P);
        if (a.act) {
            const u = (t - a.act.t0) / a.act.dur;
            if (u >= 1) { const k = a.act.kind, dz = a.act.dizzy; a.act = null; if (dz) a.start('face', { dur: 1.1, f: FACES[4] }); else if (k === 'flip' || k === 'spin') a.act = null; }
            else ACTS[a.act.kind](a, t, u, P);
        }
    }
    // overshoot-and-settle after a landing: 0 -> 1 over `u`, returns the squash amount (positive = flatter)
    const land = u => u < 0 ? 0 : Math.exp(-u * 5.5) * Math.cos(u * 14) * (1 - clamp(u, 0, 1) * .15);

    const ACTS = {
        face(a, t, u, P) {
            const f = a.act.f, dur = a.act.dur;
            // anticipation, hop, landing squash
            if (u < .1) { const q = u / .1; P.sy *= 1 - .15 * q; P.sx *= 1 + .12 * q; }
            else if (u < .42) { const q = (u - .1) / .32; P.dy = (f.stretch ? .35 : .62) * Math.sin(Math.PI * q); P.sy *= 1 + .12 * Math.sin(Math.PI * q) - .15 * (1 - q) * (1 - q); P.sx *= 1 - .08 * Math.sin(Math.PI * q); }
            else { const q = (u - .42) / .58, l = land(q * .9); P.sy *= 1 - .14 * l; P.sx *= 1 + .1 * l; }
            if (f.stretch) { const q = sstep((u - .1) / .1) * (1 - sstep((u - .8) / .18)); P.sy *= 1 + .12 * q; P.sx *= 1 - .07 * q; }
            P.rot = (f.tilt || 0) * Math.sin(Math.PI * clamp(u * 1.05, 0, 1)) + (f.sway ? .09 * Math.sin(u * 22) * (1 - u) : 0) + (f.wobble ? .12 * Math.sin(u * 40) * (1 - u) : 0);
            P.dx = f.shake ? .05 * Math.sin(u * 70) * (1 - u) : 0;
            const on = u > .06 && u < .88; if (on) { P.eye = f.eye; P.mouth = f.mouth; P.blink = 0; P.lx = P.ly = 0; }
            if (f.hearts && on && a.hc !== Math.floor(u * 9)) { a.hc = Math.floor(u * 9); a.emit('heart', P); }
            if (!f.hearts) a.hc = -1;
        },
        flip(a, t, u, P) {
            const A = a.act, h = A.h, dir = A.dir, T1 = .16, T2 = .8;
            if (u < T1) { const q = sstep(u / T1); P.sy *= 1 - .22 * q; P.sx *= 1 + .17 * q; P.eye = 'happy'; P.mouth = 'smile'; P.blink = 0; if (!A.pf && u > T1 * .8) { A.pf = 1; a.emit('puff', P); } }
            else if (u < T2) {
                const q = (u - T1) / (T2 - T1), air = 4 * q * (1 - q);
                P.dy = h * air; P.rot = dir * TAU * A.turns * ease.inout(q);
                const st = Math.sin(Math.PI * Math.min(1, q * 1.6)); P.sy *= 1 + .12 * st * (q < .5 ? 1 : 0); P.sx *= 1 - .08 * st * (q < .5 ? 1 : 0);
                P.eye = q > .86 ? 'happy' : 'wide'; P.mouth = q > .86 ? 'grin' : 'open'; P.blink = 0; P.lx = P.ly = 0; P.mo = .8; P.shadow = clamp(1 - air * .45, .4, 1);
            } else {
                const q = (u - T2) / (1 - T2), l = land(q); P.sy *= 1 - .24 * l; P.sx *= 1 + .18 * l; P.eye = 'happy'; P.mouth = 'grin'; P.blink = 0; P.lx = P.ly = 0;
                if (!A.pl) { A.pl = 1; a.emit('land', P); a.sound('land'); }
            }
        },
        spin(a, t, u, P) {
            const q = sstep(u);
            P.sx = Math.cos(q * TAU * 3) * (1 + .04 * Math.sin(q * 9)); if (Math.abs(P.sx) < .1) P.sx = (P.sx < 0 ? -1 : 1) * .1;
            P.dy = .5 * Math.sin(Math.PI * clamp(u * 1.1, 0, 1)); P.eye = 'wide'; P.mouth = 'open'; P.mo = .6; P.blink = 0;
            if (u > .78) { P.eye = 'dizzy'; P.mouth = 'wobble'; P.rot = .1 * Math.sin(u * 50) * (1 - u) * 4; }
        },
    };

    // moods: loops used on the podium and the result screens
    const MOODS = {
        win(a, t, mt, P) {                                                                      // jumping for joy: hop, hop, salto
            const cyc = 2.3, c = mt % cyc, n = Math.floor(mt / cyc), big = n % 2 === 1;
            P.eye = 'happy'; P.mouth = 'grin'; P.blink = 0; P.lx = P.ly = 0;
            const hop = (t0, t1, h) => { if (c >= t0 && c < t1) { const q = (c - t0) / (t1 - t0); P.dy = h * 4 * q * (1 - q); P.sy *= 1 + .14 * Math.sin(Math.PI * q); P.sx *= 1 - .09 * Math.sin(Math.PI * q); } else if (c >= t1 && c < t1 + .25) { const l = land((c - t1) / .25 * .9); P.sy *= 1 - .16 * l; P.sx *= 1 + .12 * l; } };
            if (c < .12) { const q = c / .12; P.sy *= 1 - .14 * q; P.sx *= 1 + .1 * q; }
            hop(.12, .62, .8); hop(.78, 1.28, .8);
            if (c >= 1.42) {
                const q = clamp((c - 1.42) / .72, 0, 1);
                if (c < 1.52) { P.sy *= 1 - .2 * ((c - 1.42) / .1); P.sx *= 1 + .15 * ((c - 1.42) / .1); }
                else if (q < 1) {
                    const w = (c - 1.52) / .62, air = 4 * clamp(w, 0, 1) * (1 - clamp(w, 0, 1));
                    P.dy = 1.6 * air; if (big) { P.rot = TAU * ease.inout(clamp(w, 0, 1)) * (n % 4 === 1 ? 1 : -1); P.eye = 'star'; } else { P.sx = Math.cos(clamp(w, 0, 1) * TAU * 2) || .05; if (Math.abs(P.sx) < .1) P.sx = .1; P.eye = 'star'; }
                } else { const l = land((c - 2.14) / .16 * .9); P.sy *= 1 - .2 * l; P.sx *= 1 + .15 * l; }
            }
            if (t - (a.confT || 0) > (mt < 3.5 ? .1 : .32)) { a.confT = t; a.emit('confetti', P); }
            if (c < .05 && a.lastCyc !== n) { a.lastCyc = n; a.sound('cheer'); }
        },
        cheer(a, t, mt, P) {                                                                    // second / third: happy little hops and a wink
            const cyc = 1.5, c = (mt + a.seed) % cyc;
            P.eye = c > .9 && c < 1.15 ? 'wink' : 'happy'; P.mouth = 'smile'; P.blink = 0; P.lx = P.ly = 0;
            if (c < .5) { const q = c / .5; P.dy = .45 * 4 * q * (1 - q); P.sy *= 1 + .1 * Math.sin(Math.PI * q); P.sx *= 1 - .06 * Math.sin(Math.PI * q); P.rot = .06 * Math.sin(q * Math.PI * 2); }
            else if (c < .68) { const l = land((c - .5) / .18 * .9); P.sy *= 1 - .12 * l; P.sx *= 1 + .08 * l; }
            if (a.o.confetti && t - (a.confT || 0) > .5) { a.confT = t; a.emit('confetti', P, 3); }
        },
        lose(a, t, mt, P) {                                                                     // slumped, a tear, a heavy sigh
            const ent = sstep(mt / .5), sig = (mt % 3.8) / 3.8;
            let sink = .13 * ent; if (sig > .5 && sig < .72) { const q = (sig - .5) / .22; sink += .07 * Math.sin(Math.PI * q); }
            P.sy *= 1 - sink; P.sx *= 1 + sink * .6; P.rot = (-.07 + .03 * Math.sin(mt * .9)) * ent; P.dx = -.02 * ent;
            P.eye = 'sad'; P.mouth = 'frown'; P.blink = (mt % 4.6) < .16 ? Math.sin(Math.PI * (mt % 4.6) / .16) : 0; P.lx = -.5; P.ly = 1.1; P.dy = -.04 * ent;
            if (mt > .5 && t - (a.tearT || 0) > .95) { a.tearT = t; a.emit('tear', P); }
            if (a.o.cloud) { if (t - (a.rainT || 0) > .09) { a.rainT = t; a.emit('rain', P); } }
            if (a.o.cloud && mt < .05) a.sound('sad');
        },
    };

    /* ---------------------------------------------------------------------- particles ---- */
    Actor.prototype.emit = function (kind, P, n) {
        const L = this.last; if (!L) return; const s = L.s, ps = this.parts, cx = L.cx + P.dx * s, cy = L.cy - P.dy * s;
        const add = o => { if (ps.length < 60) ps.push(Object.assign({ life: 1, t: 0, x: cx, y: cy, vx: 0, vy: 0, g: 0, r: 0, vr: 0, size: s * .2 }, o)); };
        if (kind === 'heart') add({ type: 'heart', x: cx + rnd(-.5, .5) * s, y: cy - s * 1.1, vy: -s * 1.3, vx: rnd(-.4, .4) * s, life: 1.1, size: s * rnd(.2, .32), col: '#ff5d8a' });
        else if (kind === 'confetti') for (let i = 0; i < (n || 2); i++) add({ type: 'conf', x: cx + rnd(-1.6, 1.6) * s, y: cy - s * rnd(1.4, 2.4), vx: rnd(-.5, .5) * s, vy: rnd(.1, .7) * s, g: s * .4, vr: rnd(-9, 9), r: rnd(0, 6), life: rnd(1.5, 2.3), size: s * rnd(.1, .17), col: ['#ffd23f', '#ff5d8a', '#4dd6ff', '#7cf29c', '#b78cff', '#ff9a3d'][Math.floor(Math.random() * 6)] });
        else if (kind === 'tear') add({ type: 'tear', x: cx - s * .52, y: cy - s * .05, vy: s * .15, g: s * 2.6, life: .9, size: s * .13, col: '#7fd2ff' });
        else if (kind === 'rain') add({ type: 'rain', x: cx + rnd(-1.1, 1.1) * s, y: cy - s * 1.65, vy: s * 3.2, life: .55, size: s * .1, col: '#8fc8ff' });
        else if (kind === 'puff' || kind === 'land') {
            for (let i = 0; i < (kind === 'land' ? 7 : 4); i++) { const d = i % 2 ? 1 : -1; add({ type: 'dust', x: cx + d * s * rnd(.6, 1), y: cy + s, vx: d * s * rnd(.5, 1.6), vy: -s * rnd(.1, .5), life: .5, size: s * rnd(.08, .15), col: 'rgba(255,255,255,0.32)' }); }
            if (kind === 'land') for (let i = 0; i < 5; i++) add({ type: 'star', x: cx + rnd(-1, 1) * s, y: cy + s * .6, vx: rnd(-1, 1) * s * 1.3, vy: -s * rnd(.8, 1.7), g: s * 3, life: .7, size: s * rnd(.12, .2), col: ['#ffd23f', '#fff4b8', '#7cf29c'][i % 3] });
        }
    };
    function drawParts(a, c, dt) {
        const ps = a.parts;
        for (let i = ps.length - 1; i >= 0; i--) {
            const p = ps[i]; p.t += dt; if (p.t >= p.life) { ps.splice(i, 1); continue; }
            p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
            const k = p.t / p.life, al = k > .6 ? 1 - (k - .6) / .4 : 1; c.globalAlpha = al;
            if (p.type === 'heart') { c.fillStyle = p.col; heart(c, p.x, p.y, p.size * (.7 + .3 * Math.min(1, p.t * 6))); c.fill(); }
            else if (p.type === 'conf') { c.save(); c.translate(p.x, p.y); c.rotate(p.r); c.scale(1, Math.cos(p.r * 1.7)); c.fillStyle = p.col; c.fillRect(-p.size, -p.size * .55, p.size * 2, p.size * 1.1); c.restore(); }
            else if (p.type === 'tear' || p.type === 'rain') { c.fillStyle = p.col; c.beginPath(); c.ellipse(p.x, p.y, p.size * .7, p.size * 1.25, 0, 0, TAU); c.fill(); }
            else if (p.type === 'dust') { c.fillStyle = p.col; c.beginPath(); c.arc(p.x, p.y, p.size * (1 + k), 0, TAU); c.fill(); }
            else if (p.type === 'star') { c.fillStyle = p.col; star(c, p.x, p.y, p.size * (1 - k * .4), p.r); c.fill(); }
        }
        c.globalAlpha = 1;
    }
    function drawCloud(c, x, y, s, t) {
        c.save(); c.translate(x, y + Math.sin(t * 1.6) * s * .05);
        c.fillStyle = '#5b6578'; c.strokeStyle = 'rgba(13,16,23,.6)'; c.lineWidth = s * .06;
        c.beginPath(); c.arc(-s * .55, 0, s * .42, Math.PI * .5, Math.PI * 1.5); c.arc(-s * .1, -s * .38, s * .52, Math.PI, 0); c.arc(s * .52, -s * .06, s * .44, Math.PI * 1.5, Math.PI * .5); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = 'rgba(255,255,255,.12)'; c.beginPath(); c.ellipse(-s * .15, -s * .55, s * .3, s * .1, -.2, 0, TAU); c.fill(); c.restore();
    }

    /* ------------------------------------------------------------------------- rendering ---- */
    const POSE = {};
    function sprites(a) {
        const look = a.look || (a.getLook && a.getLook()) || {}, key = JSON.stringify(look) + '|' + a.cv.width + '|' + (a.o.color || '');
        if (a.key === key && a.body) return;
        a.key = key; a.look = look; const cv = a.cv, mk = part => { const s = document.createElement('canvas'); s.width = cv.width; s.height = cv.height; renderLook(s, look, Object.assign({}, a.o.opts, { part, color: a.o.color })); return s; };
        a.body = mk('body'); a.top = mk('top');
        a.M = lookMetrics(cv, look, a.o.opts); a.cs = lookCostume(look);
    }
    function step(a, t, dt) {
        sprites(a); const c = a.cv.getContext('2d'), M = a.M, s = M.s, k = M.k, P = POSE;
        poseOf(a, t, P);
        c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, M.W, M.H);
        const fx = M.W / 2 + P.dx * s, feet = M.cy + s;                                          // squash and stretch hang from the feet, the salto turns about the middle
        a.last = { s, cx: M.W / 2, cy: M.cy, drop: 0 };
        if (a.o.cloud && a.mood === 'lose') drawCloud(c, M.W / 2, M.cy - s * 2.15, s * .95, t);
        // ground shadow: shrinks while the character is in the air
        const air = clamp(P.dy / 2, 0, 1); c.fillStyle = 'rgba(0,0,0,' + (.28 * (1 - air * .7)) + ')'; c.beginPath(); c.ellipse(M.W / 2, feet + s * .08, s * .95 * (1 - air * .35), s * .17 * (1 - air * .3), 0, 0, TAU); c.fill();
        c.save(); c.translate(fx, feet - P.dy * s); c.scale(P.sx, P.sy); c.translate(0, -s); c.rotate(P.rot);
        c.drawImage(a.body, -M.W / 2, -M.cy);
        if (!(a.cs && Costumes.eyes(c, s, k, a.cs, t, P.lx * k, P.ly * k))) face(c, k, P, t);
        c.drawImage(a.top, -M.W / 2, -M.cy);
        c.restore();
        drawParts(a, c, dt);
        if (a.o.onPose) a.o.onPose(P);
    }
    function visible(a, ts) {
        if (ts - a.visAt > 250) { a.visAt = ts; a.vis = a.cv.isConnected && a.cv.getClientRects().length > 0; }
        return a.vis;
    }
    let lastTs = 0;
    function loop(ts) {
        raf = 0; if (document.hidden || !actors.size) return;
        const t = ts / 1000, dt = Math.min(.05, (ts - (lastTs || ts)) / 1000); lastTs = ts; let any = false;
        for (const a of actors) {
            if (!a.cv.isConnected) { actors.delete(a); continue; }
            if (!visible(a, ts)) continue; any = true;
            const busy = a.busy(t);
            if (!busy && ts - a.lastDraw < 32) continue;                                        // quiet characters only need 30 fps
            a.lastDraw = ts; step(a, t, busy ? dt : Math.min(.05, dt * 2));
        }
        if (!actors.size) return;
        if (any) raf = requestAnimationFrame(loop); else { raf = 1; setTimeout(() => { raf = 0; lastTs = 0; wake(); }, 250); }      // nothing on screen: look again in a quarter of a second
    }
    document.addEventListener('visibilitychange', () => { lastTs = 0; wake(); });

    function actor(cv, getLook, o) {
        for (const a of actors) if (a.cv === cv) { a.getLook = getLook; if (o && o.mood) a.setMood(o.mood, o.delay); return a; }
        const a = new Actor(cv, getLook, o); if (o && o.delay) a.moodT += o.delay; actors.add(a); wake(); return a;
    }
    // the character on the home screen
    let hero = null;
    function setHero(look) {
        const cv = document.getElementById('m-hero'); if (!cv) return;
        const W = cv.width, base = 360, opts = { scale: 0.22 * base / W, cy: ((W - base) / 2 + 0.62 * base) / W };
        if (!hero || hero.cv !== cv) hero = actor(cv, null, { sound: true, opts });
        hero.setLook(look);
    }
    function poke() { if (hero) hero.poke(); }
    function init() {
        const stage = document.querySelector('#s-start .m-stage'); if (!stage) return;
        stage.addEventListener('click', e => {
            if (e.target.closest('button, a, input, .pt-plus, .pt-invite, #pt-bar')) return;
            if (e.defaultPrevented) return;
            const slot = e.target.closest('.pt-slot'); if (slot && !slot.classList.contains('me')) return;
            poke();
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
    window.CharAnim = { actor, setHero, poke, FACES };
})();
