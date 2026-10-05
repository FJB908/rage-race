// LIVING CHARACTERS: polish and animation for the cube players.
// The cube is mysterious on purpose: two plain dark eyes (no white around them), no mouth. Every mood is therefore played with the eyes
// (their size, a drooping lid, a glance, a closed smile-arc, a wink) and with the body (a lean, a tilt, a hop, a slow nod), never with a mouth or a cartoon face.
//   CharFX   drawing helpers: body gloss and the eyes with expressions (race, menu, shop previews, podium)
//   CharAnim animated characters on a canvas: idle breathing, blinking and glancing; a small reaction on every tap, a salto on a quick second tap;
//            win / cheer / lose moods for the podium and the result screens. One shared loop drives them all and sleeps when nothing is on screen.
// Loaded AFTER game.js (it uses renderLook, lookMetrics, rrPath) and before the modes that show a podium.
(function () {
    'use strict';
    const TAU = Math.PI * 2, INK = '#0d1017';
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const sstep = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
    const ease = { inout: x => x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2 };
    const rnd = (a, b) => a + Math.random() * (b - a);

    /* ------------------------------------------------------------------------------ drawing ---- */
    // a small four-point glint (used for the winner's sparkle)
    function glint(c, x, y, r) {
        c.beginPath(); c.moveTo(x, y - r); c.quadraticCurveTo(x, y, x + r * .8, y); c.quadraticCurveTo(x, y, x, y + r); c.quadraticCurveTo(x, y, x - r * .8, y); c.quadraticCurveTo(x, y, x, y - r); c.closePath();
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
    // One eye. e: eye ('dot' | 'happy' | 'closed' | 'wink'), eh/ew size, eh2 height of the right eye, lid (0..1 of the top covered), tilt (+ droopy / - sly),
    // oy (eyes up/down), lx/ly (glance), blink (0..1). Always solid dark, nothing white.
    function eye(c, k, side, e) {
        const x = side * (4 + (e.sp || 0)) * k + (e.lx || 0) * k, y = (-2 + (e.oy || 0)) * k + (e.ly || 0) * k, bl = e.blink || 0;
        let m = e.eye || 'dot';
        if (m === 'wink') m = side < 0 ? 'dot' : 'happy';
        c.lineCap = 'round'; c.lineJoin = 'round';
        if (m === 'happy') {                                                  // eyes shut in a quiet smile: an arch
            c.strokeStyle = INK; c.lineWidth = 1.7 * k; c.beginPath(); c.arc(x, y + 1.1 * k, 2.3 * k, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); return;
        }
        if (m === 'closed') { c.strokeStyle = INK; c.lineWidth = 1.6 * k; c.beginPath(); c.moveTo(x - 2.2 * k, y + .2 * k); c.quadraticCurveTo(x, y + 1.3 * k, x + 2.2 * k, y + .2 * k); c.stroke(); return; }
        const hm = (side > 0 && e.eh2 !== undefined) ? e.eh2 : (e.eh === undefined ? 1 : e.eh);
        const rx = 2.4 * k * (e.ew === undefined ? 1 : e.ew), ry = Math.max(.3 * k, 2.4 * k * hm * (1 - .88 * bl)), lid = e.lid || 0;
        c.fillStyle = INK;
        if (lid > .01) {                                                      // a drooping (or sly) lid: cut the top off along a slanted line
            const tilt = (e.tilt || 0) * ry, base = -ry + 2 * ry * lid;       // tilt > 0: the outer corner sits lower (sad), < 0: the inner corner (sly)
            const yo = base + tilt, yi = base - tilt;
            c.save(); c.beginPath(); c.moveTo(x + side * 3 * k, y + (yo)); c.lineTo(x - side * 3 * k, y + (yi)); c.lineTo(x - side * 3 * k, y + 4 * k); c.lineTo(x + side * 3 * k, y + 4 * k); c.closePath(); c.clip();
            c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill(); c.restore();
        } else { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill(); }
    }
    function face(c, k, e) { eye(c, k, -1, e); eye(c, k, 1, e); }
    // what a racer's eyes show right now: a blink now and then, dazed when stunned, a quiet smile at the finish, wide in a hard fall, narrowed when shot upward
    function raceFace(p, t, lx, ly) {
        const f = p._fx || (p._fx = { eye: 'dot', blink: 0, lx: 0, ly: 0, eh: 1, ew: 1, lid: 0, tilt: 0, oy: 0 });
        const sd = p._blinkSeed === undefined ? (p._blinkSeed = Math.random() * 7) : p._blinkSeed, per = 3.2 + sd * .45, ph = ((t + sd) % per) / .13;
        f.blink = ph < 1 ? Math.sin(Math.PI * ph) : 0; f.lx = lx; f.ly = ly; f.eye = 'dot'; f.eh = 1; f.ew = 1; f.lid = 0; f.tilt = 0; f.oy = 0;
        if (p.zapT > 0) { f.blink = 0; f.lx = Math.sin(t * 13) * 1.5; f.ly = Math.cos(t * 13) * 1; f.eh = .85; }
        else if (p.finished) { f.eye = 'happy'; }
        else if (p.mode === 'air' && p.vy > 950) { f.eh = 1.3; f.ew = 1.08; f.blink = 0; }
        else if (p.mode === 'air' && p.vy < -1000) { f.lid = .3; f.tilt = -.5; f.blink = 0; }
        return f;
    }
    window.CharFX = { gloss, face, eye, glint, raceFace };

    /* -------------------------------------------------------------------------- the actors ---- */
    // The little reactions on a tap. `body` shapes the motion, the rest is the look of the eyes.
    const EYES = {
        calm: {}, soft: { eh: .55, ew: 1.06 }, wide: { eh: 1.3, ew: 1.08 }, curious: { eh: 1.14, eh2: .74 }, sleepy: { lid: .5 }, shy: { eh: .8, ly: 1.3, lx: -1.4 },
        sly: { lid: .42, tilt: -.4 }, sad: { lid: .38, tilt: .95, oy: .9, ly: .8 }, happy: { eye: 'happy' }, wink: { eye: 'wink' },
    };
    const FACES = [
        { id: 'look',   dur: 1.9 },                                    // a slow look to the right, then to the left, then back at you
        { id: 'wink',   dur: 1.15, eyes: 'wink', snd: 'chirp' },
        { id: 'curious', dur: 1.4, eyes: 'curious', snd: 'chirp' },
        { id: 'content', dur: 1.5, eyes: 'happy' },
        { id: 'surprise', dur: 1.05, eyes: 'wide', snd: 'chirp' },
        { id: 'nod',    dur: 1.25, eyes: 'soft', snd: 'tap' },
        { id: 'shy',    dur: 1.7, eyes: 'shy' },
        { id: 'sly',    dur: 1.5, eyes: 'sly' },
    ];
    const actors = new Set(); let raf = 0, lastFace = -1;

    function Actor(cv, getLook, o) {
        this.cv = cv; this.getLook = getLook; this.o = o || {}; this.mood = this.o.mood || 'idle';
        this.t0 = performance.now() / 1000; this.act = null; this.parts = []; this.pokes = [];
        this.gaze = { x: 0, y: 0, tx: 0, ty: 0, next: 1 }; this.blinkAt = this.t0 + rnd(1.2, 3); this.lastDraw = 0; this.key = ''; this.vis = true; this.visAt = 0; this.moodT = this.t0;
        this.seed = Math.random() * 100; this.idleAt = this.t0 + rnd(7, 12);
    }
    Actor.prototype.setMood = function (m, delay) { this.mood = m; this.moodT = performance.now() / 1000 + (delay || 0); this.act = null; this.parts.length = 0; wake(); };
    Actor.prototype.setLook = function (look) { const k = JSON.stringify(look); if (k !== this._lk) { this._lk = k; this.look = look; this.key = ''; } wake(); };
    Actor.prototype.sound = function (n, a) { if (this.o.sound && window.SFX) { try { SFX.play(n, a); } catch (e) {} } };
    Actor.prototype.start = function (kind, data) { this.act = Object.assign({ kind, t0: performance.now() / 1000 }, data || {}); wake(); };
    Actor.prototype.busy = function (t) { return !!this.act || this.mood !== 'idle' || this.parts.length > 0 || t < this.moodT; };
    Actor.prototype.react = function (i, quiet) { const f = FACES[i]; this.start('face', { dur: f.dur, f, i }); if (!quiet && f.snd) this.sound(f.snd, i); };
    // a tap on the character: one tap = a small reaction, a quick second tap = a salto, then a slow twirl, then a double salto
    Actor.prototype.poke = function () {
        const now = performance.now() / 1000; this.pokes = this.pokes.filter(x => now - x < 1.1); this.pokes.push(now);
        if (this.act && (this.act.kind === 'flip' || this.act.kind === 'twirl') && now - this.act.t0 < this.act.dur * .9) return;
        const n = this.pokes.length;
        if (typeof haptic === 'function') haptic(n === 1 ? 7 : [8, 18, 12]);
        if (n === 1) { let i; do { i = Math.floor(Math.random() * FACES.length); } while (i === lastFace); lastFace = i; this.react(i); }
        else if (n === 2) { this.start('flip', { dur: 1.05, h: 1.25, turns: 1, dir: Math.random() < .5 ? 1 : -1 }); this.sound('flip'); }
        else if (n === 3) { this.start('twirl', { dur: 1.25 }); this.sound('whoosh'); }
        else { this.start('flip', { dur: 1.35, h: 1.8, turns: 2, dir: Math.random() < .5 ? 1 : -1 }); this.sound('flip'); this.pokes.length = 0; }
    };
    function wake() { if (!raf && actors.size) raf = requestAnimationFrame(loop); }

    // the body pose for one moment: offsets in half-body units, squash/stretch, rotation, plus the eyes
    function poseOf(a, t, P) {
        P.dx = 0; P.dy = 0; P.rot = 0; P.sx = 1; P.sy = 1; P.blink = 0; P.lx = a.gaze.x; P.ly = a.gaze.y;
        P.eye = 'dot'; P.eh = 1; P.eh2 = undefined; P.ew = 1; P.lid = 0; P.tilt = 0; P.oy = 0; P.sp = 0;
        const br = Math.sin((t - a.t0) * 2.1 + a.seed);                                            // breathing
        P.sy = 1 + .018 * br; P.sx = 1 - .012 * br;
        if (t >= a.blinkAt) { const u = (t - a.blinkAt) / .15; if (u < 1) P.blink = Math.sin(Math.PI * u); else a.blinkAt = t + rnd(2.4, 5.4) + (Math.random() < .2 ? -1.8 : 0); }
        if (t >= a.gaze.next) { a.gaze.tx = rnd(-1.3, 1.3); a.gaze.ty = rnd(-.6, .6); a.gaze.next = t + rnd(1.6, 4); }
        a.gaze.x += (a.gaze.tx - a.gaze.x) * .07; a.gaze.y += (a.gaze.ty - a.gaze.y) * .07;
        const m = a.mood, mt = t - a.moodT;
        if (m !== 'idle' && mt >= 0) MOODS[m](a, t, mt, P);
        else if (!a.act && a.o.sound && t > a.idleAt) { a.idleAt = t + rnd(9, 15); a.react(Math.random() < .5 ? 0 : 6, true); }       // now and then the menu character looks around or turns shy by itself
        if (a.act) {
            const u = (t - a.act.t0) / a.act.dur;
            if (u >= 1) a.act = null; else ACTS[a.act.kind](a, t, u, P);
        }
    }
    // overshoot-and-settle after a landing: 1 at the touch-down, fading to 0
    const land = u => u < 0 ? 0 : Math.exp(-u * 5.5) * Math.cos(u * 12) * (1 - clamp(u, 0, 1) * .15);
    const setEyes = (P, name) => { const e = EYES[name]; if (!e) return; for (const k in e) P[k] = e[k]; };

    const ACTS = {
        face(a, t, u, P) {
            const f = a.act.f, id = f.id; let on = true;
            if (id === 'look') {
                const g = u < .3 ? sstep(u / .3) * 1.7 : u < .62 ? 1.7 - sstep((u - .3) / .32) * 3.4 : -1.7 + sstep((u - .62) / .3) * 1.7;
                P.lx = g; P.ly = .1; P.rot = g * .035; P.dx = g * .025; on = false;
            } else if (id === 'wink') {
                P.rot = .085 * Math.sin(Math.PI * clamp(u * 1.1, 0, 1)); P.dy = .22 * Math.sin(Math.PI * clamp((u - .05) / .5, 0, 1));
                on = u > .12 && u < .75;
            } else if (id === 'curious') {
                const q = sstep(u / .25) * (1 - sstep((u - .78) / .22)); P.rot = .13 * q; P.sy *= 1 + .05 * q; P.sx *= 1 - .03 * q; P.lx = .8 * q; P.ly = -.4 * q;
                on = u > .1 && u < .85;
            } else if (id === 'content') {
                const q = sstep(u / .15) * (1 - sstep((u - .82) / .18)); P.sy *= 1 + .028 * Math.sin(u * 30) * q; P.sx *= 1 - .02 * Math.sin(u * 30) * q; P.rot = .04 * Math.sin(u * 11) * q;
                on = u > .08 && u < .88;
            } else if (id === 'surprise') {
                if (u < .12) { P.sy *= 1 - .1 * (u / .12); P.sx *= 1 + .07 * (u / .12); }
                else if (u < .4) { const q = (u - .12) / .28; P.dy = .5 * Math.sin(Math.PI * q); P.sy *= 1 + .08 * Math.sin(Math.PI * q); P.sx *= 1 - .05 * Math.sin(Math.PI * q); }
                else { const l = land((u - .4) / .6 * .9); P.sy *= 1 - .1 * l; P.sx *= 1 + .07 * l; }
                on = u > .08 && u < .8;
            } else if (id === 'nod') {
                const d = Math.pow(Math.max(0, Math.sin(u * TAU * 2 * (1 - .0))), 2) * (u < .85 ? 1 : 0); P.sy *= 1 - .055 * d; P.sx *= 1 + .035 * d; P.rot = .03 * d; P.ly = .6 * d;
                on = u < .9;
            } else if (id === 'shy') {
                const away = sstep(u / .22) * (1 - sstep((u - .62) / .25)), back = sstep((u - .6) / .2) * (1 - sstep((u - .9) / .1));
                P.rot = -.075 * away; P.dx = -.05 * away; P.lx = -1.5 * away + .6 * back; P.ly = 1.2 * away - .3 * back; P.sy *= 1 - .03 * away; on = u < .95;
            } else if (id === 'sly') {
                const q = sstep(u / .2) * (1 - sstep((u - .8) / .2)); P.rot = -.05 * q; P.lx = (u < .55 ? 1.5 : -1.2) * q; P.sy *= 1 - .02 * q; on = u > .06 && u < .92;
            }
            if (on) setEyes(P, f.eyes), P.blink = 0;
        },
        flip(a, t, u, P) {
            const A = a.act, h = A.h, dir = A.dir, T1 = .17, T2 = .8;
            if (u < T1) { const q = sstep(u / T1); P.sy *= 1 - .2 * q; P.sx *= 1 + .14 * q; P.lid = .25 * q; P.tilt = -.5; if (!A.pf && u > T1 * .8) { A.pf = 1; a.emit('puff', P); } }
            else if (u < T2) {
                const q = (u - T1) / (T2 - T1), air = 4 * q * (1 - q);
                P.dy = h * air; P.rot = dir * TAU * A.turns * ease.inout(q);
                const st = q < .45 ? Math.sin(Math.PI * q / .45) : 0; P.sy *= 1 + .1 * st; P.sx *= 1 - .06 * st;
                P.eh = 1.2; P.ew = 1.06; P.blink = 0;
            } else {
                const q = (u - T2) / (1 - T2), l = land(q); P.sy *= 1 - .22 * l; P.sx *= 1 + .15 * l; if (q < .8) P.eye = 'happy';
                if (!A.pl) { A.pl = 1; a.emit('land', P); a.sound('land'); }
            }
        },
        twirl(a, t, u, P) {                                                                      // one slow turn on the spot, like a turn of the head and body
            const q = sstep(u), ang = q * TAU;
            P.sx = Math.cos(ang); if (Math.abs(P.sx) < .12) P.sx = (P.sx < 0 ? -1 : 1) * .12;
            P.dy = .3 * Math.sin(Math.PI * clamp(u * 1.05, 0, 1)); P.sy *= 1 + .03 * Math.sin(Math.PI * u);
            if (u > .8) { P.eye = 'happy'; P.blink = 0; }
        },
    };

    // moods: loops used on the podium and the result screens
    const MOODS = {
        win(a, t, mt, P) {                                                                      // proud: two calm hops, now and then one graceful salto
            const cyc = 3.2, c = mt % cyc, n = Math.floor(mt / cyc), big = n % 2 === 1;
            const hop = (t0, t1, h) => { if (c >= t0 && c < t1) { const q = (c - t0) / (t1 - t0); P.dy = h * 4 * q * (1 - q); P.sy *= 1 + .1 * Math.sin(Math.PI * q); P.sx *= 1 - .06 * Math.sin(Math.PI * q); P.eye = 'happy'; P.blink = 0; } else if (c >= t1 && c < t1 + .3) { const l = land((c - t1) / .3 * .9); P.sy *= 1 - .13 * l; P.sx *= 1 + .09 * l; P.eye = 'happy'; P.blink = 0; } };
            if (c > .1 && c < .22) { const q = (c - .1) / .12; P.sy *= 1 - .12 * q; P.sx *= 1 + .08 * q; }
            hop(.22, .82, .62);
            if (big) {
                if (c > 1.2 && c < 1.36) { const q = (c - 1.2) / .16; P.sy *= 1 - .16 * q; P.sx *= 1 + .11 * q; }
                else if (c >= 1.36 && c < 2.2) { const w = (c - 1.36) / .84, air = 4 * w * (1 - w); P.dy = 1.2 * air; P.rot = TAU * ease.inout(w) * (n % 4 === 1 ? 1 : -1); P.eh = 1.15; }
                else if (c >= 2.2 && c < 2.55) { const l = land((c - 2.2) / .35 * .9); P.sy *= 1 - .16 * l; P.sx *= 1 + .11 * l; P.eye = 'happy'; P.blink = 0; }
            } else hop(1.1, 1.65, .36);
            if (!(P.eye === 'happy')) { P.lx = 0; P.ly = 0; }
            if (t - (a.glintT || 0) > .55) { a.glintT = t; a.emit('glint', P); }
            if (c < .05 && a.lastCyc !== n) { a.lastCyc = n; a.sound('cheer'); }
        },
        cheer(a, t, mt, P) {                                                                    // second / third: a slow content bounce, a wink now and then
            const cyc = 2.4, c = (mt + a.seed) % cyc;
            P.eye = (c > 1.5 && c < 1.8) ? 'wink' : (c < .7 ? 'happy' : 'dot'); P.blink = c < .7 ? 0 : P.blink;
            if (c < .6) { const q = c / .6; P.dy = .32 * 4 * q * (1 - q); P.sy *= 1 + .07 * Math.sin(Math.PI * q); P.sx *= 1 - .04 * Math.sin(Math.PI * q); }
            else if (c < .85) { const l = land((c - .6) / .25 * .9); P.sy *= 1 - .09 * l; P.sx *= 1 + .06 * l; }
            if (c > 1.5 && c < 1.8) P.rot = .06;
        },
        lose(a, t, mt, P) {                                                                     // slumped, a tear, a heavy sigh
            const ent = sstep(mt / .6), sig = (mt % 4) / 4;
            let sink = .12 * ent; if (sig > .5 && sig < .74) { const q = (sig - .5) / .24; sink += .06 * Math.sin(Math.PI * q); }
            P.sy *= 1 - sink; P.sx *= 1 + sink * .6; P.rot = (-.06 + .025 * Math.sin(mt * .8)) * ent; P.dx = -.02 * ent; P.dy = -.03 * ent;
            P.lid = .38 * ent; P.tilt = .95; P.oy = .9 * ent; P.ly = .8 * ent; P.lx = -.5 * ent; P.eh = 1; P.blink = (mt % 4.8) < .16 ? Math.sin(Math.PI * (mt % 4.8) / .16) : 0;
            if (mt > .6 && t - (a.tearT || 0) > 1.1) { a.tearT = t; a.emit('tear', P); }
            if (a.o.cloud && t - (a.rainT || 0) > .1) { a.rainT = t; a.emit('rain', P); }
            if (a.o.cloud && mt < .05) a.sound('sad');
        },
    };

    /* ---------------------------------------------------------------------- particles ---- */
    Actor.prototype.emit = function (kind, P) {
        const L = this.last; if (!L) return; const s = L.s, ps = this.parts, cx = L.cx + P.dx * s, cy = L.cy - P.dy * s;
        const add = o => { if (ps.length < 40) ps.push(Object.assign({ life: 1, t: 0, x: cx, y: cy, vx: 0, vy: 0, g: 0, size: s * .2 }, o)); };
        if (kind === 'glint') add({ type: 'glint', x: cx + rnd(-1.5, 1.5) * s, y: cy - s * rnd(.2, 1.9), vy: -s * .25, life: rnd(.9, 1.4), size: s * rnd(.13, .22), col: Math.random() < .5 ? '#ffe9a6' : '#ffffff' });
        else if (kind === 'tear') add({ type: 'tear', x: cx - s * .5, y: cy - s * .02, vy: s * .15, g: s * 2.6, life: .9, size: s * .12, col: '#7fd2ff' });
        else if (kind === 'rain') add({ type: 'rain', x: cx + rnd(-1.1, 1.1) * s, y: cy - s * 1.65, vy: s * 3.2, life: .55, size: s * .1, col: '#8fc8ff' });
        else if (kind === 'puff' || kind === 'land') for (let i = 0; i < (kind === 'land' ? 5 : 3); i++) { const d = i % 2 ? 1 : -1; add({ type: 'dust', x: cx + d * s * rnd(.6, 1), y: cy + s, vx: d * s * rnd(.4, 1.1), vy: -s * rnd(.05, .3), life: .5, size: s * rnd(.07, .13), col: 'rgba(255,255,255,0.22)' }); }
    };
    function drawParts(a, c, dt) {
        const ps = a.parts;
        for (let i = ps.length - 1; i >= 0; i--) {
            const p = ps[i]; p.t += dt; if (p.t >= p.life) { ps.splice(i, 1); continue; }
            p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
            const k = p.t / p.life; c.globalAlpha = Math.sin(Math.PI * Math.min(1, k * 1.0)) * (p.type === 'glint' ? 1 : 1) * (p.type === 'glint' ? 1 : (k > .6 ? 1 - (k - .6) / .4 : 1));
            if (p.type === 'glint') { c.fillStyle = p.col; glint(c, p.x, p.y, p.size * (.5 + .5 * Math.sin(Math.PI * k))); c.fill(); }
            else if (p.type === 'tear' || p.type === 'rain') { c.fillStyle = p.col; c.beginPath(); c.ellipse(p.x, p.y, p.size * .7, p.size * 1.25, 0, 0, TAU); c.fill(); }
            else if (p.type === 'dust') { c.fillStyle = p.col; c.beginPath(); c.arc(p.x, p.y, p.size * (1 + k), 0, TAU); c.fill(); }
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
        a.last = { s, cx: M.W / 2, cy: M.cy };
        if (a.o.cloud && a.mood === 'lose') drawCloud(c, M.W / 2, M.cy - s * 2.15, s * .95, t);
        const air = clamp(P.dy / 1.6, 0, 1); c.fillStyle = 'rgba(0,0,0,' + (.28 * (1 - air * .7)) + ')'; c.beginPath(); c.ellipse(M.W / 2, feet + s * .08, s * .95 * (1 - air * .35), s * .17 * (1 - air * .3), 0, 0, TAU); c.fill();
        c.save(); c.translate(fx, feet - P.dy * s); c.scale(P.sx, P.sy); c.translate(0, -s); c.rotate(P.rot);
        c.drawImage(a.body, -M.W / 2, -M.cy);
        if (!(a.cs && Costumes.eyes(c, s, k, a.cs, t, P.lx * k, P.ly * k))) face(c, k, P);
        c.drawImage(a.top, -M.W / 2, -M.cy);
        c.restore();
        drawParts(a, c, dt);
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
