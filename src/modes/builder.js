// BUILD RACE: a Chicken-Horse style mode. Four rounds on a SHORT course. The course itself is made of FOUNDATION blocks (stone, indestructible).
// Every round each player places ONE piece: a helper (ledge, spring, mover), a twist (ice, blink), a trap (crumble, spikes, saw) or a tool
// (ceiling: seals the underside of a platform, comes back every round; bomb: blows pieces away, never foundation). Then everybody races it.
// You score for finishing and for catching rivals in your traps, so you want a course that you can beat and the others cannot.
// Today the three rivals are bots; every rule is local to this file and works on a list of {name, color, look} players, so the same flow
// can run with real people later. Loaded AFTER game.js.
(function () {
    'use strict';
    const ROUNDS = 4, COURSE_H = 1500, RACE_LIMIT = 55, POINTS = [10, 7, 5, 3], TRAP_PTS = 2, BOMB_R = 105;
    const TURN_MS = 15000, READY_MS = 12000;          // time to place a piece / time to press READY between rounds
    const $ = id => document.getElementById(id);
    const sfx = (n, a) => { try { SFX.play(n, a); } catch (e) {} };
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const rr = (a, b) => a + Math.random() * (b - a);
    const ORD = ['1st', '2nd', '3rd', '4th'];

    // piece catalogue. tag: help / twist / trap / tool
    const TAGS = { help: ['HELP', '#4ade80'], twist: ['TWIST', '#ffcf3f'], trap: ['TRAP', '#ff5470'], tool: ['TOOL', '#9d8cff'] };
    const PIECES = {
        ledge:   { name: 'Ledge',   tag: 'help',  tip: 'A solid step',                              w: 112, h: 18, type: 'normal',  color: '#4ade80' },
        spring:  { name: 'Spring',  tag: 'help',  tip: 'Your next jump is extra strong',            w: 84,  h: 18, type: 'boost',   color: '#35e0c8' },
        mover:   { name: 'Mover',   tag: 'help',  tip: 'Slides from side to side',                  w: 92,  h: 18, type: 'moving',  color: '#7c6bff', range: 70 },
        ice:     { name: 'Ice',     tag: 'twist', tip: 'Slippery: you keep sliding',                w: 112, h: 18, type: 'ice',     color: '#cfe9ff' },
        blink:   { name: 'Blink',   tag: 'twist', tip: 'Vanishes every few seconds',                w: 104, h: 18, type: 'normal',  color: '#e8d27a' },
        crumble: { name: 'Crumble', tag: 'trap',  tip: 'Breaks soon after you land',                w: 100, h: 18, type: 'fragile', color: '#ff9838' },
        spikes:  { name: 'Spikes',  tag: 'trap',  tip: 'Sends anyone who touches it back to start', w: 80,  h: 18, type: 'spike',   color: '#ff5470' },
        saw:     { name: 'Saw',     tag: 'trap',  tip: 'A saw blade that slides back and forth',    w: 40,  h: 40, type: 'spike',   color: '#ff5470', range: 80 },
        ceiling: { name: 'Ceiling', tag: 'tool',  tip: 'Seals the underside of a platform. Every round',   special: true, color: '#8b95a7' },
        bomb:    { name: 'Bomb',    tag: 'tool',  tip: 'Blows away nearby pieces. Foundation is safe',     special: true, color: '#ffb238' },
    };
    const KEYS = Object.keys(PIECES);
    const rangeOf = k => PIECES[k].range || 0;

    const ORIG = { f: FINISH_Y, t: TRACK };
    const B = { on: false, round: 0, scores: [0, 0, 0, 0], prevRank: [0, 1, 2, 3], roster: null, phase: 'idle', raceT: 0, startedRace: false, pieces: [], placed: [], cur: -1, fx: [], movers: [], stuck: [null, null, null, null], bestY: [0, 0, 0, 0], parts: [], fuse: null, shake: 0, flash: 0, lastT: 0, turnEnd: 0, ready: [false, false, false, false], idc: 1, zapT: [0, 0, 0, 0], lootId: '', specStarted: false };
    window.buildMatch = false;

    /* -------------------------------------------------------------------------------------- course ---- */
    const flat = (x, y, w, type, extra) => Object.assign({ x, y, w, h: 18, type: type || 'normal', speed: 0, dir: 1, active: true, breaking: false, breakT: 0, respawn: 0, baseX: x, range: 0, boostReady: true, foundation: true, id: B.idc++ }, extra || {});
    function makeCourse(seed) {
        const r = pkRng(seed), pw = PLAY_W();
        FINISH_Y = START_Y - COURSE_H; TRACK = COURSE_H;
        platforms = []; itemBoxes = []; finishPlatform = null; ufos = [];
        B.idc = 1; platforms.push({ x: pw / 2, y: START_Y, w: pw, h: 40, type: 'normal', active: true, ground: true, foundation: true, id: B.idc++ });
        let y = START_Y - 215, lastX = pw / 2;
        while (y > FINISH_Y + 330) {                                    // few foundation blocks, far apart: the rest is up to the players
            const diff = 1 - (y - FINISH_Y) / TRACK;
            const gap = 225 + r() * 55 + diff * 20;
            const w = Math.max(80, 118 - diff * 26 + r() * 14);
            const roll = r(); let type = 'normal', speed = 0, range = 0;
            if (roll > 0.8) type = 'ice'; else if (roll > 0.6) { type = 'moving'; speed = 80 + r() * 40; range = 50 + r() * 45; }
            const half = w / 2; let x = lastX + (r() < 0.5 ? -1 : 1) * (90 + r() * 90); x = Math.max(half + 6, Math.min(pw - half - 6, x));
            let baseX = x; if (type === 'moving') { baseX = Math.max(half + 6 + range, Math.min(pw - half - 6 - range, x)); x = baseX; }
            platforms.push(flat(x, y, w, type, { speed, dir: r() < 0.5 ? 1 : -1, baseX, range, route: true, w }));
            lastX = x; y -= gap;
        }
        platforms.push(flat(pw / 2, FINISH_Y + 190, pw * 0.5, 'normal', { route: false }));
        platforms.push({ x: pw / 2, y: FINISH_Y, w: pw, h: 40, type: 'finish', active: true });
        finishPlatform = platforms.find(p => p.type === 'finish');
        for (const pc of B.pieces) platforms.push(pc);
    }
    function resetDynamic() {
        for (const pl of platforms) {
            if (pl.ground) continue;
            pl.active = true; pl.breaking = false; pl.breakT = 0; pl.respawn = 0;
            if (pl.type === 'moving') { pl.x = pl.baseX; pl.dir = 1; }
            if (pl.piece === 'saw') pl.x = pl.baseX;
            if (pl.piece === 'blink') pl.blinkT = 1.4 + (pl.owner || 0) * 0.35;
            if (pl.hadCeiling) { pl.ceiling = true; pl.ceilingBroken = false; }              // the ceiling comes back every round
        }
    }

    /* ------------------------------------------------------------------------------- placing pieces ---- */
    function pieceRect(kind, x, y) {
        const d = PIECES[kind], rg = rangeOf(kind);
        return { x0: x - d.w / 2 - rg, x1: x + d.w / 2 + rg, y0: y - d.h / 2 - 14, y1: y + d.h / 2 + 14 };
    }
    const baseOf = pl => pl.baseX !== undefined ? pl.baseX : pl.x;
    function freeSpot(kind, x, y) {
        const pw = PLAY_W(), d = PIECES[kind], half = d.w / 2 + rangeOf(kind);
        if (x < half + 6 || x > pw - half - 6) return false;
        if (y < FINISH_Y + 150 || y > START_Y - 120) return false;
        const a = pieceRect(kind, x, y);
        for (const pl of platforms) {
            if (pl.type === 'finish') continue;
            const rg = pl.range || 0, bx0 = baseOf(pl) - pl.w / 2 - rg, bx1 = baseOf(pl) + pl.w / 2 + rg;
            const py0 = pl.y - pl.h / 2 - 14, py1 = pl.y + pl.h / 2 + 14;
            if (a.x0 < bx1 + 6 && a.x1 > bx0 - 6 && a.y0 < py1 && a.y1 > py0) return false;
        }
        return true;
    }
    // everything a bomb at (x,y) would remove: pieces, and ceilings glued under platforms
    function bombHits(x, y) {
        const out = [];
        for (const pc of B.pieces) if (Math.hypot(pc.x - x, pc.y - y) < BOMB_R + pc.w * 0.3) out.push({ kind: 'piece', pl: pc });
        for (const pl of platforms) if (pl.hadCeiling && Math.hypot(pl.x - x, pl.y + 12 - y) < BOMB_R + pl.w * 0.25) out.push({ kind: 'ceil', pl });
        return out;
    }
    // platform a ceiling would snap under, near (x,y)
    function ceilTarget(x, y) {
        let best = null, bd = 1e9;
        for (const pl of platforms) {
            if (pl.ground || pl.type === 'finish' || pl.type === 'spike' || pl.hadCeiling || pl.w < 70) continue;
            if (pl.y < FINISH_Y + 120) continue;
            const d = Math.hypot(pl.x - x, (pl.y + 14) - y);
            if (d < bd && d < 150) { bd = d; best = pl; }
        }
        return best;
    }
    // one entry point for the human ghost and for bots: where does this piece end up, and is it allowed?
    function spotInfo(kind, x, y) {
        const d = PIECES[kind];
        if (kind === 'bomb') { const hits = bombHits(x, y); return { ok: hits.length > 0, x, y, hits, why: hits.length ? '' : 'NOTHING TO BLAST' }; }
        if (kind === 'ceiling') { const t = ceilTarget(x, y); return t ? { ok: true, x: t.x, y: t.y + t.h / 2 + 9, target: t } : { ok: false, x, y, why: 'MOVE UNDER A PLATFORM' }; }
        const pw = PLAY_W(), half = d.w / 2 + rangeOf(kind);
        x = Math.max(half + 6, Math.min(pw - half - 6, x));
        return { ok: freeSpot(kind, x, y), x, y, why: 'NOT HERE' };
    }
    function addPiece(kind, x, y, owner) {
        const d = PIECES[kind], rg = rangeOf(kind);
        const pc = { x, y, w: d.w, h: d.h, type: d.type, speed: d.type === 'moving' ? 80 : 0, dir: Math.random() < 0.5 ? 1 : -1, active: true, breaking: false, breakT: 0, respawn: 0,
                     baseX: x, range: kind === 'saw' ? rg : (d.type === 'moving' ? rg : 0), boostReady: true, owner, piece: kind, born: performance.now(), phase: Math.random() * 6, id: B.idc++ };
        if (kind === 'blink') pc.blinkT = 1.4 + owner * 0.35;
        platforms.push(pc); B.pieces.push(pc); return pc;
    }
    function explode(x, y, hits) {
        B.fx.push({ x, y, t: performance.now(), kind: 'boom' });
        for (const h of hits) {
            if (h.kind === 'ceil') { h.pl.hadCeiling = false; h.pl.ceiling = false; h.pl.ceilingBroken = false; B.fx.push({ x: h.pl.x, y: h.pl.y + 12, t: performance.now(), kind: 'puff' }); }
            else { platforms = platforms.filter(p => p !== h.pl); B.pieces = B.pieces.filter(p => p !== h.pl); B.fx.push({ x: h.pl.x, y: h.pl.y, t: performance.now(), kind: 'puff' }); }
        }
    }
    // the bomb: a short lit fuse, then a real explosion: fireball, debris from every piece it takes, smoke, shockwave, screen shake and flash
    async function detonate(sp, owner) {
        const x = sp.x, y = sp.y; await camTo(y, 280); if (!B.on) return;
        B.fuse = { x, y, t0: performance.now() };
        for (let k = 0; k < 3; k++) { sfx('count'); await wait(260); if (!B.on) { B.fuse = null; return; } }
        B.fuse = null;
        const hits = bombHits(x, y);
        const now = performance.now(), S = 1;
        B.fx.push({ x, y, t: now, kind: 'fire' });
        for (let k = 0; k < 46; k++) { const a = Math.random() * 7, v = rr(160, 620); B.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, life: rr(0.5, 1.1), max: 1.1, col: ['#ffcf3f', '#ffb238', '#ff7a2e', '#fff3b0'][k % 4], size: rr(2, 5), g: 600, spark: true }); }
        for (let k = 0; k < 16; k++) { const a = Math.random() * 7; B.parts.push({ x: x + Math.cos(a) * 20, y: y + Math.sin(a) * 20, vx: Math.cos(a) * rr(20, 110), vy: Math.sin(a) * rr(20, 110) - 60, life: rr(0.9, 1.6), max: 1.6, col: '#8a93a6', size: rr(14, 30), g: -40, smoke: true }); }
        for (const h of hits) {
            const pl = h.pl, col = h.kind === 'ceil' ? '#6b7488' : (PIECES[pl.piece] ? PIECES[pl.piece].color : '#8b95a7'), cx0 = pl.x, cy0 = h.kind === 'ceil' ? pl.y + 12 : pl.y, w0 = h.kind === 'ceil' ? pl.w : pl.w;
            for (let k = 0; k < 14; k++) { const ang = Math.atan2(cy0 - y, cx0 - x) + rr(-1.1, 1.1), v = rr(260, 700); B.parts.push({ x: cx0 + rr(-w0 / 2, w0 / 2), y: cy0 + rr(-8, 8), vx: Math.cos(ang) * v, vy: Math.sin(ang) * v - 260, life: rr(0.8, 1.5), max: 1.5, col, size: rr(5, 11), g: 1500, rot: Math.random() * 6, vr: rr(-12, 12), chunk: true }); }
        }
        B.shake = 16; B.flash = 1; sfx('shatter'); sfx('knock'); try { haptic([60, 30, 90]); } catch (e) {}
        explode(x, y, hits);
        await wait(900);
    }
    function apply(sp, owner) {
        if (sp.kind === 'bomb') { explode(sp.x, sp.y, sp.hits || bombHits(sp.x, sp.y)); return; }
        if (sp.kind === 'ceiling') { const t = (sp.targetId && platforms.find(p => p.id === sp.targetId)) || sp.target || ceilTarget(sp.x, sp.y); if (t) { t.hadCeiling = true; t.ceiling = true; t.ceilingBroken = false; t.ceilOwner = owner; B.fx.push({ x: t.x, y: t.y + 12, t: performance.now(), kind: 'puff' }); } return; }
        addPiece(sp.kind, sp.x, sp.y, owner);
    }
    function drawCards() {                                          // four different pieces: always something friendly, a bomb only when it has a target
        const canBomb = B.pieces.length > 0 || platforms.some(p => p.hadCeiling);
        const pool = KEYS.filter(k => k !== 'bomb' || canBomb);
        const bag = pool.slice().sort(() => Math.random() - 0.5), out = bag.slice(0, 4);
        if (!out.some(k => PIECES[k].tag === 'help')) out[0] = ['ledge', 'spring', 'mover'][Math.floor(Math.random() * 3)];
        return Array.from(new Set(out));
    }

    /* --------------------------------------------------------------------------------------- bots ---- */
    const RANK = {
        trapper: ['spikes', 'saw', 'ceiling', 'crumble', 'blink', 'bomb', 'ice', 'mover', 'ledge', 'spring'],
        helper:  ['spring', 'ledge', 'bomb', 'mover', 'ice', 'blink', 'crumble', 'saw', 'spikes', 'ceiling'],
    };
    function botTry(idx, kind, pers) {
        const route = platforms.filter(pl => pl.route && pl.y < START_Y - 280 && pl.y > FINISH_Y + 300);
        if (kind === 'bomb') {
            const bad = B.pieces.filter(p => PIECES[p.piece].tag === 'trap' && p.owner !== idx), good = B.pieces.filter(p => PIECES[p.piece].tag === 'help' && p.owner !== idx);
            const ceil = platforms.filter(p => p.hadCeiling && p.ceilOwner !== idx);
            const list = pers === 'helper' ? bad.concat(pers === 'helper' ? ceil : []) : good.concat(ceil.length && Math.random() < 0.4 ? ceil : []);
            if (!list.length) return null;
            const t = list[Math.floor(Math.random() * list.length)], hy = t.piece ? t.y : t.y + 12;
            const hits = bombHits(t.x, hy);
            // never blow up the bot's own pieces if it can be avoided
            if (hits.some(h => h.kind === 'piece' && h.pl.owner === idx) && Math.random() < 0.7) return null;
            return { kind, x: t.x, y: hy, hits };
        }
        if (kind === 'ceiling') {
            const cand = route.filter(pl => !pl.hadCeiling && pl.type !== 'moving'); if (!cand.length) return null;
            const t = cand[Math.floor(Math.random() * cand.length)]; return { kind, x: t.x, y: t.y + 18, target: t };
        }
        for (let tries = 0; tries < 90; tries++) {
            const base = route[Math.floor(Math.random() * route.length)]; if (!base) break;
            let x, y;
            if (kind === 'spikes' || kind === 'saw') { x = base.x + rr(-70, 70); y = base.y - rr(55, 110); }
            else if (pers === 'helper') { x = base.x + rr(-80, 80); y = base.y - rr(55, 85); }
            else { x = base.x + rr(-110, 110); y = base.y - rr(40, 120); }
            x = Math.round(x / 4) * 4; y = Math.round(y / 4) * 4;
            const info = spotInfo(kind, x, y);
            if (info.ok) return { kind, x: info.x, y: info.y };
        }
        return null;
    }
    function botPlace(idx, given) {
        const pers = B.roster[idx].pers, cards = (given || drawCards()).slice();
        const order = pers === 'chaos' ? KEYS.slice().sort(() => Math.random() - 0.5) : RANK[pers] || KEYS;
        cards.sort((a, b) => order.indexOf(a) - order.indexOf(b));
        for (const k of cards) { const sp = botTry(idx, k, pers); if (sp) return sp; }
        return botTry(idx, 'ledge', pers);
    }

    /* -------------------------------------------------------------------------------- overlay: DOM ---- */
    const root = document.createElement('div'); root.id = 'bd-root'; root.hidden = true;
    root.innerHTML = '<canvas id="bd-cv"></canvas>' +
        '<div class="bd-top"><button class="bd-x" id="bd-x" type="button" aria-label="Leave">' + icon('chev-l') + '</button><div class="bd-title"><small id="bd-round"></small><b id="bd-msg"></b></div><div class="bd-turn" id="bd-turn" hidden></div></div>' +
        '<div class="bd-tiles" id="bd-tiles"></div>' +
        '<div class="bd-bottom" id="bd-bottom"></div>';
    document.body.appendChild(root);
    const cv = $('bd-cv'), cx = cv.getContext('2d');
    const hudChip = document.createElement('div'); hudChip.id = 'bd-hud'; hudChip.hidden = true; document.body.appendChild(hudChip);
    const panel = document.createElement('div'); panel.id = 'bd-panel'; panel.hidden = true; document.body.appendChild(panel);

    const view = { S: 0.85, ox: 0, camTop: 0, w: 0, h: 0 };
    function fit() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2); view.w = window.innerWidth; view.h = window.innerHeight;
        cv.width = Math.round(view.w * dpr); cv.height = Math.round(view.h * dpr); cx.setTransform(dpr, 0, 0, dpr, 0, 0);
        view.S = Math.min(1.05, (view.w - 70) / PLAY_W()); view.ox = (view.w - 34 - PLAY_W() * view.S) / 2;
    }
    const wx = x => view.ox + x * view.S, wy = y => (y - view.camTop) * view.S;
    const toWorld = (px, py) => ({ x: (px - view.ox) / view.S, y: py / view.S + view.camTop });
    const clampCam = () => { view.camTop = Math.max(FINISH_Y - 160, Math.min(START_Y + 60 - view.h / view.S, view.camTop)); };
    function centerOn(y) { view.camTop = y - view.h / view.S * 0.45; clampCam(); }
    const rrect = (x, y, w, h, r) => { cx.beginPath(); cx.roundRect ? cx.roundRect(x, y, w, h, r) : cx.rect(x, y, w, h); };

    function stoneBlock(x, y, w, h, S, col) {                        // foundation: grey stone with bolts
        rrect(x - w / 2, y - h / 2, w, h, 4 * S); cx.fillStyle = col || '#5a667e'; cx.fill();
        cx.fillStyle = 'rgba(255,255,255,.18)'; cx.fillRect(x - w / 2 + 3, y - h / 2 + 1.5, w - 6, 2.5 * S);
        cx.fillStyle = 'rgba(0,0,0,.22)'; cx.fillRect(x - w / 2 + 3, y + h / 2 - 4 * S, w - 6, 2.5 * S);
        cx.fillStyle = '#2b3345'; for (const sx of [-1, 1]) { cx.beginPath(); cx.arc(x + sx * (w / 2 - 6 * S), y, 1.8 * S, 0, 7); cx.fill(); }
    }
    function sawPath(r, teeth, rot) {
        cx.beginPath();
        for (let i = 0; i < teeth * 2; i++) { const a = rot + i * Math.PI / teeth, rad = i % 2 ? r * 0.72 : r; cx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); }
        cx.closePath();
    }
    function drawPiece(kind, x, y, alpha, ring) {
        const d = PIECES[kind], S = view.S, w = (d.w || 60) * S, h = (d.h || 18) * S, t = performance.now() / 1000;
        cx.save(); cx.globalAlpha = alpha === undefined ? 1 : alpha; cx.translate(wx(x), wy(y));
        if (kind === 'spikes') {
            cx.fillStyle = '#ff5470'; const n = Math.max(4, Math.round(d.w / 14)), tw = w / n;
            for (let i = 0; i < n; i++) { cx.beginPath(); cx.moveTo(-w / 2 + i * tw, h / 2); cx.lineTo(-w / 2 + (i + 0.5) * tw, -h * 0.9); cx.lineTo(-w / 2 + (i + 1) * tw, h / 2); cx.closePath(); cx.fill(); }
            cx.fillStyle = '#7a1230'; cx.fillRect(-w / 2, h / 2 - 3 * S, w, 4 * S);
        } else if (kind === 'saw') {
            const rg = d.range * S; cx.strokeStyle = 'rgba(255,84,112,.35)'; cx.lineWidth = 2; cx.setLineDash([5, 5]); cx.beginPath(); cx.moveTo(-rg, 0); cx.lineTo(rg, 0); cx.stroke(); cx.setLineDash([]);
            sawPath(w / 2, 9, t * 6); cx.fillStyle = '#ff5470'; cx.fill(); cx.beginPath(); cx.arc(0, 0, w * 0.18, 0, 7); cx.fillStyle = '#7a1230'; cx.fill();
        } else if (kind === 'ceiling') {
            cx.fillStyle = '#6b7488'; cx.fillRect(-45 * S, -4 * S, 90 * S, 9 * S); cx.fillStyle = '#ffb238'; for (let i = -3; i <= 3; i++) { cx.beginPath(); cx.arc(i * 12 * S, 0, 1.8 * S, 0, 7); cx.fill(); }
        } else if (kind === 'bomb') {
            cx.beginPath(); cx.arc(0, 0, BOMB_R * S, 0, 7); cx.fillStyle = 'rgba(255,178,56,.1)'; cx.fill(); cx.strokeStyle = 'rgba(255,178,56,.7)'; cx.lineWidth = 2; cx.setLineDash([7, 6]); cx.stroke(); cx.setLineDash([]);
            cx.fillStyle = '#20242f'; cx.beginPath(); cx.arc(0, 2 * S, 12 * S, 0, 7); cx.fill(); cx.fillStyle = 'rgba(255,255,255,.25)'; cx.beginPath(); cx.arc(-4 * S, -2 * S, 3 * S, 0, 7); cx.fill();
            cx.strokeStyle = '#c9a36a'; cx.lineWidth = 2.5; cx.beginPath(); cx.moveTo(4 * S, -8 * S); cx.quadraticCurveTo(10 * S, -16 * S, 15 * S, -12 * S); cx.stroke();
            cx.fillStyle = (Math.floor(t * 8) % 2) ? '#ffcf3f' : '#ff5470'; cx.beginPath(); cx.arc(15 * S, -12 * S, 3 * S, 0, 7); cx.fill();
        } else {
            if (d.type === 'moving') { cx.strokeStyle = 'rgba(124,107,255,.5)'; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(-w / 2 - 70 * S, 0); cx.lineTo(w / 2 + 70 * S, 0); cx.stroke(); }
            rrect(-w / 2, -h / 2, w, h, 5 * S); cx.fillStyle = d.color; cx.fill();
            if (d.type === 'boost') { cx.fillStyle = '#0d1017'; cx.beginPath(); cx.moveTo(-6 * S, 3 * S); cx.lineTo(0, -4 * S); cx.lineTo(6 * S, 3 * S); cx.closePath(); cx.fill(); }
            if (d.type === 'fragile') { cx.strokeStyle = '#0d1017'; cx.lineWidth = 1.5; cx.beginPath(); cx.moveTo(-6 * S, -h / 2); cx.lineTo(0, 0); cx.lineTo(-4 * S, h / 2); cx.stroke(); }
            if (kind === 'blink') { cx.strokeStyle = '#0d1017'; cx.lineWidth = 2; cx.setLineDash([5 * S, 4 * S]); cx.beginPath(); cx.moveTo(-w / 2 + 6 * S, 0); cx.lineTo(w / 2 - 6 * S, 0); cx.stroke(); cx.setLineDash([]); }
        }
        if (ring) { const rw = kind === 'saw' ? w + 8 : (d.special ? 0 : w + 8); if (rw) { cx.strokeStyle = ring; cx.lineWidth = 2.5; rrect(-rw / 2, -h / 2 - 8 * S, rw, h + 12 * S, 7); cx.stroke(); } }
        cx.restore();
    }
    const ghost = { kind: null, x: 0, y: 0, ok: false, why: '', target: null, hits: [], touched: true };
    let raf = 0;
    function render() {
        raf = requestAnimationFrame(render); if (root.hidden) return;
        const S = view.S, now = performance.now();
        const dtp = Math.min(0.05, (now - (B.lastT || now)) / 1000); B.lastT = now;
        cx.clearRect(0, 0, view.w, view.h); cx.fillStyle = '#0d1017'; cx.fillRect(0, 0, view.w, view.h);
        cx.save(); if (B.shake > 0.3) { cx.translate((Math.random() - 0.5) * B.shake, (Math.random() - 0.5) * B.shake); B.shake *= Math.pow(0.002, dtp); } else B.shake = 0;
        cx.strokeStyle = 'rgba(255,255,255,.04)'; cx.lineWidth = 1;
        for (let gy = Math.floor(view.camTop / 120) * 120; gy < view.camTop + view.h / S; gy += 120) { cx.beginPath(); cx.moveTo(wx(0), wy(gy)); cx.lineTo(wx(PLAY_W()), wy(gy)); cx.stroke(); }
        cx.strokeStyle = 'rgba(255,255,255,.14)'; cx.strokeRect(wx(0), wy(FINISH_Y - 140), PLAY_W() * S, (START_Y + 60 - FINISH_Y + 140) * S);
        for (const pl of platforms) {
            if (pl.piece) continue;
            const y = wy(pl.y); if (y < -40 || y > view.h + 40) continue;
            if (pl.type === 'finish') { cx.fillStyle = '#fff'; cx.fillRect(wx(0), y - 4, PLAY_W() * S, 8); cx.fillStyle = '#0d1017'; for (let i = 0; i < 22; i++) if (i % 2) cx.fillRect(wx(0) + i * PLAY_W() * S / 22, y - 4, PLAY_W() * S / 22, 4); cx.fillStyle = '#ffcf3f'; cx.font = '800 12px system-ui'; cx.textAlign = 'center'; cx.fillText('FINISH', wx(PLAY_W() / 2), y - 12); continue; }
            const bx = baseOf(pl), rg = pl.range || 0;
            if (pl.type === 'moving' && rg) { cx.strokeStyle = 'rgba(124,107,255,.35)'; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(wx(bx - rg) - pl.w * S / 2, y); cx.lineTo(wx(bx + rg) + pl.w * S / 2, y); cx.stroke(); }
            cx.globalAlpha = pl.ground ? 0.55 : 1;
            stoneBlock(wx(bx), y, pl.w * S, pl.h * S, S, pl.type === 'ice' ? '#7d93b4' : pl.type === 'moving' ? '#6a6598' : '#5a667e');
            cx.globalAlpha = 1;
        }
        for (const pl of platforms) if (pl.hadCeiling) {                     // ceilings glued under a platform (foundation or piece)
            const y = wy(pl.y + pl.h / 2), x = wx(baseOf(pl)), w = pl.w * S; if (y < -30 || y > view.h + 30) continue;
            cx.fillStyle = '#3c4354'; cx.beginPath(); cx.moveTo(x - w / 2, y); for (let i = 0; i <= 8; i++) cx.lineTo(x - w / 2 + (i / 8) * w, y + (i % 2 ? 11 : 5) * S); cx.lineTo(x + w / 2, y); cx.closePath(); cx.fill();
            cx.fillStyle = '#ffb238'; for (let i = 1; i < 6; i++) { cx.beginPath(); cx.arc(x - w / 2 + (i / 6) * w, y + 3 * S, 1.4 * S, 0, 7); cx.fill(); }
        }
        for (const pc of B.pieces) {
            const y = wy(pc.y); if (y < -40 || y > view.h + 40) continue;
            const age = (now - pc.born) / 1000;
            drawPiece(pc.piece, pc.piece === 'saw' ? pc.baseX : pc.x, pc.y, 1, PCOL[pc.owner] || '#fff');
            if (age < 1.2) { cx.save(); cx.globalAlpha = 1 - age / 1.2; cx.strokeStyle = PCOL[pc.owner]; cx.lineWidth = 3; cx.beginPath(); cx.arc(wx(pc.x), wy(pc.y), 18 + age * 50, 0, 7); cx.stroke(); cx.restore(); }
        }
        for (const m of B.movers) {                                          // a rival is dragging a piece: show the piece, their name and their finger
            drawPiece(m.kind, m.x, m.y, 0.95, m.kind === 'ceiling' || m.kind === 'bomb' ? null : (m.fin ? '#7ee787' : PCOL[m.owner]));
            const sx = wx(m.x), sy = wy(m.y), pulse = 1 + Math.sin(now / 120) * 0.12;
            cx.save(); cx.fillStyle = 'rgba(255,255,255,.28)'; cx.strokeStyle = 'rgba(255,255,255,.7)'; cx.lineWidth = 2; cx.beginPath(); cx.arc(sx, sy + 74, 17 * pulse, 0, 7); cx.fill(); cx.stroke();
            cx.strokeStyle = 'rgba(255,255,255,.25)'; cx.setLineDash([3, 4]); cx.beginPath(); cx.moveTo(sx, sy + 16); cx.lineTo(sx, sy + 56); cx.stroke(); cx.setLineDash([]);
            cx.font = '800 11px system-ui'; cx.textAlign = 'center'; const tw = cx.measureText(m.name).width + 14; cx.fillStyle = PCOL[m.owner]; rrect(sx - tw / 2, sy - 44, tw, 18, 9); cx.fill(); cx.fillStyle = '#10131b'; cx.fillText(m.name, sx, sy - 31); cx.restore();
        }
        B.fx = B.fx.filter(f => now - f.t < 900);
        for (const f of B.fx) {                                              // explosion / dust rings
            if (f.kind === 'fire') continue;
            const a = (now - f.t) / 900; cx.save(); cx.globalAlpha = 1 - a; cx.strokeStyle = f.kind === 'boom' ? '#ffb238' : '#cfd6e4'; cx.lineWidth = f.kind === 'boom' ? 5 : 3;
            cx.beginPath(); cx.arc(wx(f.x), wy(f.y), (f.kind === 'boom' ? BOMB_R : 36) * S * (0.35 + a * 0.9), 0, 7); cx.stroke();
            if (f.kind === 'boom') { cx.fillStyle = 'rgba(255,178,56,' + (0.3 * (1 - a)) + ')'; cx.fill(); } cx.restore();
        }
        if (ghost.kind) {
            const pk = ghost.kind;
            if (pk === 'bomb') for (const h of ghost.hits) { cx.strokeStyle = '#ff5470'; cx.lineWidth = 3; const hx = wx(h.pl.x), hy = wy(h.kind === 'ceil' ? h.pl.y + 12 : h.pl.y); cx.beginPath(); cx.arc(hx, hy, 24 * S, 0, 7); cx.stroke(); }
            if (pk === 'ceiling' && ghost.target) { const t = ghost.target, y = wy(t.y + t.h / 2), x = wx(baseOf(t)), w = t.w * S; cx.fillStyle = 'rgba(126,231,135,.55)'; cx.fillRect(x - w / 2, y, w, 10 * S); cx.strokeStyle = '#7ee787'; cx.lineWidth = 2; cx.strokeRect(x - w / 2, y, w, 10 * S); }
            else if (pk !== 'ceiling') drawPiece(pk, ghost.x, ghost.y, 0.9, pk === 'bomb' ? null : (ghost.ok ? '#7ee787' : '#ff5470'));
            if (!ghost.touched && ghost.kind) {                                  // first time: show where to grab
                const sx = wx(ghost.x), sy = wy(ghost.y), pulse = 1 + Math.sin(now / 160) * 0.18;
                cx.save(); cx.fillStyle = 'rgba(255,255,255,.3)'; cx.strokeStyle = '#fff'; cx.lineWidth = 2; cx.beginPath(); cx.arc(sx, sy + 74, 18 * pulse, 0, 7); cx.fill(); cx.stroke();
                cx.fillStyle = '#fff'; cx.font = '900 12px system-ui'; cx.textAlign = 'center'; cx.fillText('DRAG ANYWHERE', sx, sy + 112); cx.restore();
            }
            if (!ghost.ok && ghost.why) { cx.fillStyle = '#ff5470'; cx.font = '800 11px system-ui'; cx.textAlign = 'center'; cx.fillText(ghost.why, wx(ghost.x), wy(ghost.y) - 30); }
        }
        if (B.fuse) {                                                        // lit bomb: flashes faster and faster, with a countdown
            const f = B.fuse, age = (now - f.t0) / 780, x = wx(f.x), y = wy(f.y), flick = Math.floor(now / (130 - age * 70)) % 2;
            cx.save(); cx.translate(x, y); const sc = 1 + age * 0.45 + Math.sin(now / 55) * 0.05; cx.scale(sc, sc);
            cx.fillStyle = flick ? '#ff5470' : '#20242f'; cx.beginPath(); cx.arc(0, 2 * S, 14 * S, 0, 7); cx.fill();
            cx.strokeStyle = '#c9a36a'; cx.lineWidth = 3; cx.beginPath(); cx.moveTo(5 * S, -10 * S); cx.quadraticCurveTo(12 * S, -20 * S, 18 * S, -15 * S); cx.stroke();
            cx.fillStyle = '#ffcf3f'; for (let k = 0; k < 4; k++) { cx.beginPath(); cx.arc(18 * S + rr(-4, 4), -15 * S + rr(-4, 4), rr(1.5, 3.5), 0, 7); cx.fill(); }
            cx.restore(); cx.fillStyle = '#fff'; cx.font = '900 22px system-ui'; cx.textAlign = 'center'; cx.fillText(String(Math.max(1, 3 - Math.floor(age * 3.2))), x, y - 34 * S);
        }
        for (const q of B.parts) {                                          // sparks, debris chunks, smoke
            q.vy += (q.g || 0) * dtp; q.x += q.vx * dtp; q.y += q.vy * dtp; q.life -= dtp; if (q.rot !== undefined) q.rot += q.vr * dtp;
            const a = Math.max(0, q.life / q.max); cx.save(); cx.globalAlpha = q.smoke ? a * 0.45 : Math.min(1, a * 1.6); cx.translate(wx(q.x), wy(q.y));
            if (q.smoke) { cx.fillStyle = q.col; cx.beginPath(); cx.arc(0, 0, q.size * S * (1.6 - a), 0, 7); cx.fill(); }
            else if (q.chunk) { cx.rotate(q.rot); cx.fillStyle = q.col; cx.fillRect(-q.size / 2, -q.size / 3, q.size, q.size * 0.66); }
            else { cx.fillStyle = q.col; cx.beginPath(); cx.arc(0, 0, q.size * a + 0.5, 0, 7); cx.fill(); }
            cx.restore();
        }
        B.parts = B.parts.filter(q => q.life > 0);
        for (const f of B.fx) if (f.kind === 'fire') {                       // fireball
            const a = (now - f.t) / 520; if (a >= 1) continue;
            const r0 = BOMB_R * S * (0.25 + a * 0.95), gr = cx.createRadialGradient(wx(f.x), wy(f.y), 0, wx(f.x), wy(f.y), r0);
            gr.addColorStop(0, 'rgba(255,248,200,' + (0.95 * (1 - a)) + ')'); gr.addColorStop(0.45, 'rgba(255,150,40,' + (0.7 * (1 - a)) + ')'); gr.addColorStop(1, 'rgba(255,60,20,0)');
            cx.fillStyle = gr; cx.beginPath(); cx.arc(wx(f.x), wy(f.y), r0, 0, 7); cx.fill();
        }
        if (B.phase === 'build') {                                           // furthest point of everybody who did not finish last round
            const lines = B.stuck.map((y, i) => y === null ? null : { y, i }).filter(Boolean).sort((a, b2) => a.y - b2.y);
            lines.forEach((l, k) => {
                const y = wy(l.y); if (y < -20 || y > view.h + 20) return;
                cx.save(); cx.strokeStyle = PCOL[l.i]; cx.globalAlpha = 0.85; cx.lineWidth = 2; cx.setLineDash([9, 6]); cx.beginPath(); cx.moveTo(wx(0), y); cx.lineTo(wx(PLAY_W()), y); cx.stroke(); cx.setLineDash([]);
                const label = (l.i === 0 ? 'YOU' : B.roster[l.i].name.slice(0, 9)) + (k === 0 ? ' · FURTHEST' : ' · STUCK HERE'), tw = cx.measureText(label).width;
                cx.font = '900 10px system-ui'; const w = cx.measureText(label).width + 14; cx.globalAlpha = 1; cx.fillStyle = PCOL[l.i]; rrect(wx(PLAY_W()) - w - 4, y - 18, w, 17, 8); cx.fill(); cx.fillStyle = '#10131b'; cx.textAlign = 'right'; cx.fillText(label, wx(PLAY_W()) - 11, y - 6);
                cx.restore();
            });
        }
        cx.fillStyle = '#35e0c8'; cx.font = '800 11px system-ui'; cx.textAlign = 'center'; cx.fillText('START', wx(PLAY_W() / 2), wy(START_Y) - 16);
        cx.restore();
        if (B.flash > 0.02) { cx.fillStyle = 'rgba(255,244,214,' + (B.flash * 0.6) + ')'; cx.fillRect(0, 0, view.w, view.h); B.flash *= Math.pow(0.0005, dtp); }
        const mx = view.w - 28, top = 150, bot = view.h - 190, k = (bot - top) / (START_Y - FINISH_Y + 200);
        cx.fillStyle = 'rgba(255,255,255,.06)'; cx.fillRect(mx - 8, top, 16, bot - top);
        if (B.phase === 'build') B.stuck.forEach((sy, i) => { if (sy === null) return; cx.fillStyle = PCOL[i]; cx.fillRect(mx - 10, top + (sy - (FINISH_Y - 100)) * k, 20, 3); });
        for (const pl of platforms) { if (pl.ground || pl.type === 'finish') continue; const yy = top + (pl.y - (FINISH_Y - 100)) * k; cx.fillStyle = pl.piece ? PCOL[pl.owner] : 'rgba(255,255,255,.3)'; cx.fillRect(mx - 6, yy, 12, pl.piece ? 3 : 2); }
        cx.strokeStyle = '#fff'; cx.lineWidth = 1.5; cx.strokeRect(mx - 8, top + (view.camTop - (FINISH_Y - 100)) * k, 16, (view.h / S) * k);
    }

    /* ------------------------------------------------------------------------------------- input ---- */
    let drag = null, auto = 0;
    function setGhost(info) { ghost.x = info.x; ghost.y = info.y; ghost.ok = info.ok; ghost.why = info.why || ''; ghost.target = info.target || null; ghost.hits = info.hits || []; refreshPlaceBtn(); }
    function updateGhost(px, py) {
        ghost.touched = true; const w = toWorld(px, py - 74); setGhost(spotInfo(ghost.kind, Math.round(w.x / 4) * 4, Math.round(w.y / 4) * 4));
    }
    cv.addEventListener('pointerdown', e => {
        if (root.hidden) return; cv.setPointerCapture && cv.setPointerCapture(e.pointerId);
        if (e.clientX > view.w - 48 && e.clientY > 140 && e.clientY < view.h - 180) { drag = { mini: true }; miniTo(e.clientY); return; }
        drag = { y0: e.clientY, cam0: view.camTop, ghost: !!ghost.kind };
        if (ghost.kind) updateGhost(e.clientX, e.clientY);
    });
    cv.addEventListener('pointermove', e => {
        if (!drag) return;
        if (drag.mini) { miniTo(e.clientY); return; }
        if (ghost.kind) { updateGhost(e.clientX, e.clientY); auto = e.clientY < 170 ? -1 : (e.clientY > view.h - 230 ? 1 : 0); }
        else { view.camTop = drag.cam0 - (e.clientY - drag.y0) / view.S; clampCam(); }
    });
    const endDrag = () => { drag = null; auto = 0; };
    cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);
    function miniTo(py) { const top = 150, bot = view.h - 190, f = Math.max(0, Math.min(1, (py - top) / (bot - top))); view.camTop = (FINISH_Y - 100) + f * (START_Y - FINISH_Y + 200) - view.h / view.S / 2; clampCam(); }
    setInterval(() => { if (auto && ghost.kind && !root.hidden) { view.camTop += auto * 14 / view.S * 1.2; clampCam(); } }, 30);

    /* ---------------------------------------------------------------------------------------- UI ---- */
    const shortName = (i, n) => i === 0 ? 'YOU' : (B.roster[i].name || '').slice(0, 9);
    // one standings strip, used while building (turn order) and while racing (live positions)
    function tileHTML(i, o) {
        return '<div class="bd-tile' + (i === 0 ? ' me' : '') + (o.cls ? ' ' + o.cls : '') + '" style="--pc:' + PCOL[i] + '"><div class="bd-t1"><em>' + (o.rank || '') + '</em><b>' + shortName(i) + '</b></div>' +
            '<div class="bd-t2"><strong>' + B.scores[i] + '</strong><small>' + (o.sub || '') + '</small></div><i class="bd-bar"><u style="width:' + Math.round((o.prog || 0) * 100) + '%"></u></i></div>';
    }
    function setTop(msg) { $('bd-round').textContent = 'ROUND ' + B.round + ' OF ' + ROUNDS; $('bd-msg').textContent = msg; }
    function buildTiles(order, cur) {
        $('bd-tiles').innerHTML = order.map((i, k) => {
            const done = k < cur, now = k === cur;
            return tileHTML(i, { rank: k + 1, cls: now ? 'on' : done ? 'done' : '', sub: now ? 'PLACING' : done ? 'PLACED' : 'WAITING', prog: done ? 1 : 0 });
        }).join('');
    }
    function iconFor(kind) {
        const d = PIECES[kind];
        const plat = (col, extra) => '<svg viewBox="0 0 64 44"><rect x="8" y="14" width="48" height="16" rx="6" fill="' + col + '"/>' + (extra || '') + '</svg>';
        switch (kind) {
            case 'spikes': return '<svg viewBox="0 0 64 40"><path d="M4 34 L14 8 L24 34 L34 8 L44 34 L54 8 L60 34 Z" fill="#ff5470"/><rect x="2" y="32" width="60" height="5" rx="2" fill="#7a1230"/></svg>';
            case 'saw': return '<svg viewBox="0 0 64 44"><path d="M6 36 H58" stroke="rgba(255,84,112,.5)" stroke-width="3" stroke-linecap="round" stroke-dasharray="5 5"/><circle cx="32" cy="20" r="14" fill="#ff5470"/><circle cx="32" cy="20" r="5" fill="#7a1230"/><path d="M32 4 V10 M32 30 V36 M16 20 H22 M42 20 H48 M21 9 l4 4 M43 31 l-4 -4 M43 9 l-4 4 M21 31 l4 -4" stroke="#ff5470" stroke-width="3" stroke-linecap="round"/></svg>';
            case 'ceiling': return '<svg viewBox="0 0 64 44"><rect x="8" y="8" width="48" height="12" rx="5" fill="#4ade80"/><path d="M8 20 L14 32 L20 22 L26 34 L32 22 L38 34 L44 22 L50 32 L56 20 Z" fill="#6b7488"/><circle cx="20" cy="23" r="1.8" fill="#ffb238"/><circle cx="32" cy="24" r="1.8" fill="#ffb238"/><circle cx="44" cy="23" r="1.8" fill="#ffb238"/></svg>';
            case 'bomb': return '<svg viewBox="0 0 64 44"><circle cx="30" cy="26" r="14" fill="#20242f" stroke="#454d62" stroke-width="2"/><circle cx="25" cy="21" r="4" fill="rgba(255,255,255,.22)"/><path d="M38 14 Q46 4 53 9" fill="none" stroke="#c9a36a" stroke-width="3" stroke-linecap="round"/><circle cx="53" cy="9" r="4" fill="#ffb238"/></svg>';
            case 'blink': return plat(d.color, '<path d="M14 22 H50" stroke="#0d1017" stroke-width="3" stroke-dasharray="6 5" stroke-linecap="round"/>');
            case 'spring': return plat(d.color, '<path d="M24 24 L32 12 L40 24" fill="none" stroke="#0d1017" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>');
            case 'crumble': return plat(d.color, '<path d="M24 14 L32 24 L28 34" fill="none" stroke="#0d1017" stroke-width="3" stroke-linecap="round"/>');
            case 'mover': return plat(d.color, '<path d="M6 36 H58" stroke="rgba(124,107,255,.7)" stroke-width="3" stroke-linecap="round"/><path d="M10 30 l-6 6 l6 6 M54 30 l6 6 l-6 6" fill="none" stroke="#b3a9ff" stroke-width="3" stroke-linecap="round"/>');
            default: return plat(d.color);
        }
    }
    function refreshPlaceBtn() { const b = $('bd-place'); if (b) { b.disabled = !ghost.ok; b.classList.toggle('ready', ghost.ok); b.textContent = ghost.ok ? (ghost.kind === 'bomb' ? 'DROP IT' : 'PLACE IT HERE') : (ghost.why || 'NOT HERE'); } }
    const hintRow = (a, b2) => '<div class="bd-hintrow">' + a + (b2 || '') + '</div>';
    const step = (n, t) => '<span class="bd-hint"><b>' + n + '</b>' + t + '</span>';

    /* ----------------------------------------------------------------- network seam ----
       Everything a player does in a turn is one small message, so the same flow can run with real people:
         {t:'turn',  idx, cards, deadline}      host -> everyone: whose turn, which 4 pieces, until when
         {t:'place', idx, sp:{kind,x,y,targetId}} that player -> everyone: where the piece goes
         {t:'ready', idx}                       that player -> everyone: ready for the next round
       Build.net.out = fn(msg) sends; Build.net.receive(msg) feeds messages in. Players with ctrl 'remote' are waited for (with a timeout),
       players with ctrl 'bot' are played here, 'local' is the person holding this phone. */
    const net = { out: null, waiters: {},
        send(m) { try { if (net.out) net.out(m); } catch (e) {} },
        receive(m) {
            if (!m || !B.on) return;
            if (m.t === 'ready') { B.ready[m.idx] = true; renderReady(); return; }
            const k = m.t + ':' + m.idx, w = net.waiters[k]; if (w) { delete net.waiters[k]; w(m); }
        },
        wait(t, idx, ms) { return new Promise(res => { const k = t + ':' + idx; net.waiters[k] = res; setTimeout(() => { if (net.waiters[k] === res) { delete net.waiters[k]; res(null); } }, ms); }); },
    };
    const wire = sp => sp && { kind: sp.kind, x: sp.x, y: sp.y, targetId: sp.target ? sp.target.id : sp.targetId };

    function autoPlace(cards) {                                      // when somebody runs out of time
        for (const k of cards.slice().sort(() => Math.random() - 0.5)) { const sp = botTry(0, k, 'helper'); if (sp) return sp; }
        return botTry(0, 'ledge', 'helper');
    }
    function humanPlace(cards, deadline) {
        return new Promise(res => {
            ghost.kind = null; const bot = $('bd-bottom'); let done = false;
            const finish = sp => { if (done) return; done = true; clearTimeout(to); B.cancelTurn = null; ghost.kind = null; bot.innerHTML = ''; res(sp); };
            const to = setTimeout(() => {                                   // time's up: your piece goes where the ghost is, or somewhere sensible
                sfx('error'); const sp = (ghost.kind && ghost.ok) ? { kind: ghost.kind, x: ghost.x, y: ghost.y, target: ghost.target } : autoPlace(cards);
                setTop("Time's up! Placed for you"); finish(sp);
            }, Math.max(0, deadline - Date.now()));
            B.cancelTurn = () => finish(null);
            const timeBar = '<div class="bd-timebar"><u id="bd-tb"></u></div>';
            const showCards = () => {
                ghost.kind = null; setTop('Your turn: pick a piece');
                bot.innerHTML = timeBar + hintRow('<span class="bd-hint big"><b>&#9660;</b>TAP A PIECE TO PICK IT</span>') + '<div class="bd-cards">' + cards.map(k => { const d = PIECES[k], tg = TAGS[d.tag]; return '<button class="bd-card" type="button" data-k="' + k + '" style="--tc:' + tg[1] + '"><span class="bd-ic">' + iconFor(k) + '</span><span class="bd-ct"><b>' + d.name + '</b><em>' + tg[0] + '</em><small>' + d.tip + '</small></span></button>'; }).join('') + '</div>';
                bot.querySelectorAll('.bd-card').forEach(b => b.onclick = () => pick(b.dataset.k));
            };
            const pick = kind => {
                sfx('select'); ghost.kind = kind; ghost.touched = false; centerOn((START_Y + FINISH_Y) / 2 + 60);
                const mid = toWorld(view.w / 2 - 17, view.h * 0.45); let gx = Math.round(mid.x / 4) * 4, gy = Math.round(mid.y / 4) * 4, found = null;
                if (kind === 'bomb') { const t = B.pieces[B.pieces.length - 1] || platforms.find(p => p.hadCeiling); if (t) { gx = t.x; gy = t.y; } }
                search: for (let r = 0; r <= 640; r += 12) for (let a = 0; a < (r ? 12 : 1); a++) {       // nearest free spot, spiralling out
                    const sx = Math.round((gx + Math.cos(a * Math.PI / 6) * r) / 4) * 4, sy = Math.round((gy + Math.sin(a * Math.PI / 6) * r) / 4) * 4, info = spotInfo(kind, sx, sy);
                    if (info.ok) { found = info; break search; }
                }
                setGhost(found || spotInfo(kind, gx, gy));
                setTop(kind === 'bomb' ? 'Drop it on pieces' : kind === 'ceiling' ? 'Put it under a platform' : 'Drag it into place');
                bot.innerHTML = timeBar + hintRow(step(1, kind === 'bomb' ? 'DRAG THE BOMB' : 'DRAG THE PIECE'), step(2, 'TAP THE BUTTON')) + '<div class="bd-actions"><button class="btn ghost bd-back" id="bd-back" type="button">BACK</button><button class="btn bd-placebtn" id="bd-place" type="button">PLACE IT HERE</button></div><p class="bd-tip">' + PIECES[kind].tip + '</p>';
                $('bd-back').onclick = () => { sfx('back'); showCards(); };
                $('bd-place').onclick = () => { if (!ghost.ok) { sfx('error'); return; } finish({ kind: ghost.kind, x: ghost.x, y: ghost.y, target: ghost.target }); };
                refreshPlaceBtn();
            };
            centerOn((START_Y + FINISH_Y) / 2 + 60); showCards();
        });
    }

    /* tiny animation helpers: bots really pick up their piece, hover over the wrong spot, then drop it */
    const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    function tween(ms, fn) {
        return new Promise(res => { const t0 = performance.now(); const tick = () => { if (!B.on) return res(); const t = Math.min(1, (performance.now() - t0) / ms); fn(ease(t)); t < 1 ? requestAnimationFrame(tick) : res(); }; tick(); });
    }
    async function camTo(y, ms) { const a = view.camTop, tgt = Math.max(FINISH_Y - 160, Math.min(START_Y + 60 - view.h / view.S, y - view.h / view.S * 0.45)); await tween(ms, t => { view.camTop = a + (tgt - a) * t; }); }
    async function botTurn(i, cards) {
        const name = B.roster[i].name, sn = name.slice(0, 9); setTop(sn + ' is thinking...'); $('bd-bottom').innerHTML = hintRow('<span class="bd-hint"><b>&hellip;</b>' + name + ' IS CHOOSING</span>');
        await wait(rr(600, 1200)); if (!B.on) return null;
        const sp = botPlace(i, cards); if (!sp) return null;
        setTop(sn + ' picks ' + PIECES[sp.kind].name.toUpperCase());
        await camTo(sp.y, 500); if (!B.on) return null;
        const pw = PLAY_W(), cl = x => Math.max(50, Math.min(pw - 50, x)), side = Math.random() < 0.5 ? -1 : 1;
        const p0 = { x: cl(sp.x + side * rr(120, 200)), y: sp.y - rr(220, 320) }, p1 = { x: cl(sp.x + rr(-130, 130)), y: sp.y + rr(-120, -50) };
        const m = { kind: sp.kind, x: p0.x, y: p0.y, owner: i, name: name.slice(0, 12), fin: false }; B.movers = [m]; sfx('select');
        await tween(650, t => { m.x = p0.x + (p1.x - p0.x) * t; m.y = p0.y + (p1.y - p0.y) * t; });
        await wait(rr(150, 380));
        await tween(520, t => { m.x = p1.x + (sp.x - p1.x) * t; m.y = p1.y + (sp.y - p1.y) * t; });
        m.fin = true; await wait(300); B.movers = [];
        return sp;
    }

    async function takeTurn(i, order, k) {
        const r = B.roster[i], cards = drawCards(), deadline = Date.now() + TURN_MS; B.turnEnd = deadline; B.cur = i;
        buildTiles(order, k); net.send({ t: 'turn', idx: i, cards, deadline });
        let sp = null;
        if (r.ctrl === 'local') sp = await humanPlace(cards, deadline);
        else if (r.ctrl === 'remote') {
            setTop(r.name.slice(0, 9) + ' is placing...'); $('bd-bottom').innerHTML = hintRow('<span class="bd-hint"><b>&hellip;</b>WAITING FOR ' + r.name.toUpperCase() + '</span>');
            const m = await net.wait('place', i, TURN_MS + 1500); sp = m ? m.sp : autoPlace(cards);
        } else sp = await botTurn(i, cards);
        if (!B.on) return;
        if (r.ctrl !== 'remote') net.send({ t: 'place', idx: i, sp: wire(sp) });
        if (!sp) return;
        if (i !== 0) { centerOn(sp.y); }
        $('bd-msg').textContent = (i === 0 ? 'You' : r.name.slice(0, 9)) + (sp.kind === 'bomb' ? ' dropped a BOMB' : ' placed ' + PIECES[sp.kind].name.toUpperCase());
        B.placed.push({ owner: i, kind: sp.kind });
        if (sp.kind === 'bomb') { B.placed.pop(); await detonate(sp, i); B.placed.push({ owner: i, kind: sp.kind }); }
        else { apply(sp, i); sfx(i === 0 ? 'equip' : 'pop'); await wait(650); }
    }

    /* --------------------------------------------------------------------------------- the flow ---- */
    async function buildPhase() {
        B.phase = 'build'; root.hidden = false; hudChip.hidden = true; document.body.classList.add('bd-building'); B.placed = []; B.movers = [];
        state = 'build'; if (SFX.music) SFX.music.set('levels');
        fit(); resetDynamic();
        const order = [0, 1, 2, 3].sort((a, b) => B.scores[b] - B.scores[a] || Math.random() - 0.5);       // the leader places first, the last player places last
        for (let k = 0; k < order.length; k++) { await takeTurn(order[k], order, k); if (!B.on) return; }
        buildTiles(order, 4); setTop('Get ready...'); $('bd-bottom').innerHTML = ''; B.turnEnd = 0; await wait(900); if (!B.on) return;
        root.hidden = true; document.body.classList.remove('bd-building');
        startRace();
    }
    // header clock + time bar for whoever's turn it is
    setInterval(() => {
        const t = $('bd-turn'); if (!t) return;
        if (B.on && B.phase === 'build' && !root.hidden && B.turnEnd) {
            const left = Math.max(0, B.turnEnd - Date.now()), s = Math.ceil(left / 1000);
            t.hidden = false; t.textContent = s + 's'; t.classList.toggle('low', s <= 5);
            const tb = $('bd-tb'); if (tb) { tb.style.width = (left / TURN_MS * 100) + '%'; tb.classList.toggle('low', s <= 5); }
        } else t.hidden = true;
    }, 200);
    function startRace() {
        B.phase = 'race'; B.raceT = 0; B.startedRace = false; B.bestY = [START_Y, START_Y, START_Y, START_Y]; B.specStarted = false; B.hitFor = [new Set(), new Set(), new Set(), new Set()]; B.zapT = [0, 0, 0, 0]; B.trapPts = [0, 0, 0, 0];
        const keep = B.roster; initPlayers();
        players.forEach((p, i) => { if (i === 0) return; p.name = keep[i].name; p.look = keep[i].look; p.finisherId = keep[i].finisher; p.skill = keep[i].skill; p.botType = 'standard'; p.afk = false; });
        resetDynamic(); finishedCount = 0; botsDonePrompted = true; hudChip.hidden = false; paintHud(true);
        document.body.classList.add('build-race'); beginRound();
    }
    // live standings: finished players first (by time), then by height reached
    const prog = p => p.finished ? 1 : Math.max(0, Math.min(0.99, (START_Y - p.y) / (START_Y - FINISH_Y)));
    function paintHud(force) {
        if (hudChip.hidden && !force) return;
        const left = Math.max(0, Math.ceil(RACE_LIMIT - B.raceT)), timeTxt = '0:' + String(left).padStart(2, '0');
        const rank = players.map((p, i) => ({ i, p })).sort((a, b) => (a.p.finished && b.p.finished) ? a.p.finishTime - b.p.finishTime : a.p.finished ? -1 : b.p.finished ? 1 : a.p.y - b.p.y);
        const html = '<div class="bd-clock' + (left <= 10 && B.startedRace ? ' low' : '') + '"><small>ROUND ' + B.round + ' OF ' + ROUNDS + '</small><strong>' + timeTxt + '</strong></div>' +
            '<div class="bd-strip">' + rank.map((r, k) => tileHTML(r.i, { rank: k + 1, cls: r.p.finished ? 'fin' : '', sub: r.p.finished ? 'DONE ' + r.p.finishTime.toFixed(1) + 's' : 'RACING', prog: prog(r.p) })).join('') + '</div>';
        if (hudChip._h !== html) { hudChip.innerHTML = html; hudChip._h = html; }
    }
    setInterval(() => { if (!hudChip.hidden && B.on) paintHud(); }, 120);
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
            for (let i = 0; i < players.length; i++) if (!players[i].finished && players[i].y < B.bestY[i]) B.bestY[i] = players[i].y;
            for (const pl of platforms) {                                           // saws slide, blink platforms flicker out
                if (pl.piece === 'saw') pl.x = pl.baseX + Math.sin(B.raceT * 1.9 + pl.phase) * pl.range;
                else if (pl.piece === 'blink' && pl.active) { pl.blinkT -= dt; if (pl.blinkT <= 0) { pl.active = false; pl.respawn = 1.5; pl.blinkT = 2.3; for (const p of players) if (p.plat === pl) { p.mode = 'air'; p.plat = null; } } }
            }
            const spikes = platforms.filter(pl => pl.type === 'spike' && pl.active);
            for (let i = 0; i < players.length; i++) {
                const p = players[i]; B.zapT[i] -= dt;
                if (p.finished || p.ufoHold || B.zapT[i] > 0) continue;
                for (const s of spikes) {
                    if (Math.abs(p.x - s.x) < s.w / 2 + p.r * 0.55 && Math.abs(p.y - s.y) < s.h / 2 + p.r * 0.75) {
                        zap(i, p);
                        if (s.owner !== i && !B.hitFor[s.owner].has(i)) { B.hitFor[s.owner].add(i); B.trapPts[s.owner] += TRAP_PTS; burst(p.x, p.y - 30, PCOL[s.owner], 12, 160); if (s.owner === 0) sfx('claim'); }
                        break;
                    }
                }
            }
            if (players[0].finished && !B.specStarted) {                           // you're through: drag the screen or follow the others
                B.specStarted = true;
                if (players.some(p => !p.finished) && typeof startSpectate === 'function') startSpectate();
            }
            if (B.raceT > RACE_LIMIT) endRace();
        }
    }
    function checkEnd() { if (B.on && B.phase === 'race' && finishedCount >= 4) { state = 'finished'; setTimeout(endRace, 900); } }
    let ending = false;
    const rankOf = () => [0, 1, 2, 3].sort((a, b) => B.scores[b] - B.scores[a] || a - b);
    async function endRace() {
        if (!B.on || B.phase !== 'race' || ending) return; ending = true; B.phase = 'result'; state = 'finished'; dragging = false;
        if (typeof stopSpectate === 'function') stopSpectate();
        document.body.classList.remove('build-race'); hudChip.hidden = true;
        B.stuck = players.map((p, i) => (!p.finished && B.bestY[i] < START_Y - 60) ? B.bestY[i] : null);      // where each player who did not finish got stuck
        const before = rankOf();
        const fin = players.filter(p => p.finished).sort((a, b) => a.finishTime - b.finishTime);
        const rows = players.map((p, i) => { const pl = fin.indexOf(p); return { i, place: pl >= 0 ? pl + 1 : 0, fp: pl >= 0 ? POINTS[pl] : 0, tp: B.trapPts[i], time: p.finished ? p.finishTime : 0, old: B.scores[i] }; });
        rows.forEach(r => { B.scores[r.i] += r.fp + r.tp; });
        const after = rankOf();
        rows.forEach(r => { r.rank = after.indexOf(r.i); r.moved = before.indexOf(r.i) - r.rank; });
        const me = rows[0];
        sfx(me.place === 1 ? 'finish' : 'count');
        const last = B.round >= ROUNDS;
        rows.sort((a, b) => (a.place || 9) - (b.place || 9) || b.tp - a.tp);
        panel.hidden = false; panel.className = 'bd-panel';
        const head = me.place === 1 ? 'YOU WON THE ROUND' : me.place ? 'YOU FINISHED ' + ORD[me.place - 1].toUpperCase() : 'NO FINISH THIS ROUND';
        panel.innerHTML = '<div class="bd-ph"><small>ROUND ' + B.round + ' OF ' + ROUNDS + ' RESULT</small><h2>' + head + '</h2><p>' + (me.fp + me.tp ? 'You earned <b>+' + (me.fp + me.tp) + '</b> points' : 'No points this round') + (me.tp ? ' (traps +' + me.tp + ')' : '') + '</p></div>' +
            '<div class="bd-cols"><span>RACE</span><span>PLAYER</span><span>GAIN</span><span>TOTAL</span></div><div class="bd-rows">' +
            rows.map(r => '<div class="bd-rr' + (r.i === 0 ? ' me' : '') + '" style="--pc:' + PCOL[r.i] + '"><span class="bd-pl' + (r.place === 1 ? ' g' : '') + '">' + (r.place || '-') + '</span>' +
                '<div class="bd-who"><b>' + (r.i === 0 ? 'YOU' : B.roster[r.i].name) + '</b><small>' + (r.place ? r.time.toFixed(1) + 's' : 'did not finish') + (r.tp ? ' &middot; <em>caught ' + (r.tp / TRAP_PTS) + '</em>' : '') + '</small></div>' +
                '<div class="bd-gain' + (r.fp + r.tp ? '' : ' z') + '">+' + (r.fp + r.tp) + '</div><div class="bd-tot"><strong>' + B.scores[r.i] + '</strong><i class="' + (r.moved > 0 ? 'up' : r.moved < 0 ? 'dn' : '') + '">' + (r.moved > 0 ? '&#9650;' + r.moved : r.moved < 0 ? '&#9660;' + (-r.moved) : '') + '</i></div></div>').join('') + '</div>' +
            '<p class="bd-lead">' + (last ? 'That was the last round' : 'Leader places first next round: ' + (after[0] === 0 ? 'you' : B.roster[after[0]].name)) + '</p>' +
            '<div class="bd-ready" id="bd-ready"></div>' +
            '<button class="btn bd-next ready-btn" id="bd-next" type="button">READY</button>';
        const go = await readyPhase(last);
        if (!go) return;
        panel.hidden = true; ending = false; if (last) finalResult(); else { B.round++; buildPhase(); }
    }
    // between rounds: everybody presses READY (bots after a moment, remote players by message), or the timer runs out and the next round starts anyway
    function renderReady() {
        const el = $('bd-ready'); if (!el) return;
        el.innerHTML = B.roster.map((r, i) => '<span class="bd-rd' + (B.ready[i] ? ' on' : '') + '" style="--pc:' + PCOL[i] + '"><i></i>' + (i === 0 ? 'YOU' : r.name.slice(0, 8)) + '<em>' + (B.ready[i] ? 'READY' : '...') + '</em></span>').join('');
    }
    function readyPhase(last) {
        B.ready = [false, false, false, false];
        B.roster.forEach((r, i) => { if (r.ctrl === 'bot') setTimeout(() => { if (B.on && B.phase === 'result') { B.ready[i] = true; renderReady(); sfx('pop'); } }, rr(1200, READY_MS - 3500)); });
        const end = Date.now() + READY_MS; renderReady();
        return new Promise(res => {
            const btn = $('bd-next');
            btn.onclick = () => { if (B.ready[0]) return; B.ready[0] = true; net.send({ t: 'ready', idx: 0 }); sfx('select'); renderReady(); };
            const iv = setInterval(() => {
                if (!B.on || B.phase !== 'result') { clearInterval(iv); res(false); return; }
                const left = Math.max(0, Math.ceil((end - Date.now()) / 1000)), all = B.ready.every(Boolean);
                const b2 = $('bd-next'); if (b2) { b2.textContent = B.ready[0] ? 'WAITING FOR OTHERS ' + left + 's' : 'READY  ' + left + 's'; b2.classList.toggle('waiting', B.ready[0]); }
                if (all || left <= 0) { clearInterval(iv); if (all) sfx('count'); setTimeout(() => res(true), all ? 500 : 0); }
            }, 200);
        });
    }
    function finalResult() {
        const order = rankOf(); const place = order.indexOf(0) + 1;
        const rw = rewardRace(place, true, B.lootId);
        sfx(place === 1 ? 'levelup' : 'finish');
        panel.hidden = false; panel.className = 'bd-panel fin';
        const en = order.map(i => ({ name:B.roster[i].name, look:B.roster[i].look || {}, color:PCOL[i], me:i === 0, sub:B.scores[i] + ' pts' }));
        const pod = window.Podium ? Podium.html(en, place > 3 ? { extra:en[place - 1], extraRank:place } : {}) : '';
        panel.innerHTML = '<div class="bd-ph"><small>BUILD RACE &middot; FINAL</small><h2>' + (place === 1 ? 'YOU WIN!' : place === 2 ? '2ND PLACE' : place === 3 ? '3RD PLACE' : '4TH PLACE') + '</h2></div>' +
            pod +
            '<div class="bd-rows sm">' + order.map((i, k) => '<div class="bd-rr' + (i === 0 ? ' me' : '') + '" style="--pc:' + PCOL[i] + '"><span class="bd-pl' + (k === 0 ? ' g' : '') + '">' + (k + 1) + '</span><div class="bd-who"><b>' + (i === 0 ? 'YOU' : B.roster[i].name) + '</b></div><div class="bd-tot"><strong>' + B.scores[i] + '</strong><i>pts</i></div></div>').join('') + '</div>' +
            '<div class="loot-drop" id="bd-loot"></div>' +
            '<div class="bd-rw">' + (rw.noDrop ? R('coin', rw.coins, { plus: true }) + R('xp', rw.xp, { plus: true }) + R('pass', rw.passPoints, { plus: true }) : '') + '</div>' +
            '<button class="btn bd-next" id="bd-again" type="button">PLAY AGAIN</button><button class="btn ghost" id="bd-menu" type="button" style="margin-top:10px">MAIN MENU</button>';
        if (window.Podium) setTimeout(() => Podium.start(panel), 60);
        if (!rw.noDrop) renderLootDrop('bd-loot', rw);
        $('bd-again').onclick = () => { panel.hidden = true; start(); };
        $('bd-menu').onclick = () => { panel.hidden = true; leave(true); };
    }

    /* ----------------------------------------------------------------------------------- lifecycle ---- */
    function begin() {                                     // called from startGame() once the lobby is done
        B.on = true; window.buildMatch = true; ending = false;
        gameMode = 'race'; esc = null; pk = null; lv = null; showScreen('');
        document.body.classList.remove('mode-escape', 'mode-parkour', 'mode-level');
        B.round = 1; B.scores = [0, 0, 0, 0]; B.pieces = []; B.fx = []; B.stuck = [null, null, null, null]; B.lootId = newLootId('race');
        makeCourse(matchSeed);
        initPlayers();
        B.roster = players.map((p, i) => ({ name: p.name, look: p.look, finisher: p.look && p.look.finisher, skill: p.skill, pers: i === 0 ? 'you' : ['trapper', 'helper', 'chaos', 'trapper'][Math.floor(Math.random() * 4)], ctrl: i === 0 ? 'local' : (api.remote.includes(i) ? 'remote' : 'bot') }));
        buildPhase();
    }
    function start() { window.buildQueued = true; startMatchmaking(); }
    function leave(toMenu) {
        B.on = false; window.buildMatch = false; B.phase = 'idle'; B.movers = []; B.stuck = [null, null, null, null]; net.waiters = {}; if (B.cancelTurn) B.cancelTurn(); root.hidden = true; panel.hidden = true; hudChip.hidden = true; ghost.kind = null; ending = false;
        document.body.classList.remove('bd-building', 'build-race');
        FINISH_Y = ORIG.f; TRACK = ORIG.t;
        if (toMenu) { state = 'menu'; gameMode = 'race'; hud.style.display = 'none'; refreshStartMeta(); showScreen('start'); }
    }
    $('bd-x').onclick = () => { openPrompt('LEAVE BUILD RACE?', 'Your progress in this match is lost.', [['Keep playing', () => {}], ['Leave', () => leave(true), true]]); };
    function open() {
        let seen = false; try { seen = localStorage.getItem('rr_build_seen2') === '1'; } catch (e) {}
        if (seen) return start();
        panel.hidden = false; panel.className = 'bd-panel intro';
        panel.innerHTML = '<div class="bd-ph"><small>BUILD RACE</small><h2>BUILD IT, THEN BEAT IT</h2></div><ol class="bd-how">' +
            '<li><b>1</b><span>The course is made of <em>stone foundation</em>. Nobody can remove it.</span></li>' +
            '<li><b>2</b><span>Each round you place <em>one piece</em>: a helper, a trap, a ceiling, or a bomb that clears pieces.</span></li>' +
            '<li><b>3</b><span>Then everyone races. Finish first for the most points, and <em>+2</em> for every rival your traps catch.</span></li></ol>' +
            '<button class="btn bd-next" id="bd-go" type="button">LET\'S BUILD</button><button class="btn ghost" id="bd-no" type="button" style="margin-top:10px">BACK</button>';
        $('bd-go').onclick = () => { try { localStorage.setItem('rr_build_seen2', '1'); } catch (e) {} panel.hidden = true; start(); };
        $('bd-no').onclick = () => { panel.hidden = true; };
    }

    // bots keep out of spikes and saws: does the jump arc cross one?
    function arcHitsSpike(p, vx, vy) {
        if (!B.on) return false; const g = playerG(p); const spikes = platforms.filter(pl => pl.type === 'spike');
        if (!spikes.length) return false;
        for (let t = 0.05; t < 1.6; t += 0.05) {
            const x = p.x + vx * t, y = p.y + vy * t + 0.5 * g * t * t;
            for (const s of spikes) if (Math.abs(x - baseOf(s)) < s.w / 2 + (s.range || 0) + p.r + 4 && Math.abs(y - s.y) < s.h / 2 + p.r + 6) return true;
        }
        return false;
    }
    // drawing hooks called from game.js while rendering platforms (context is already translated to the platform centre)
    function drawSaw(c, pl) {
        const r = pl.w / 2, t = performance.now() / 1000 * 7 + pl.phase;
        c.shadowBlur = 12; c.shadowColor = '#ff5470'; c.fillStyle = '#ff5470'; c.beginPath();
        for (let i = 0; i < 18; i++) { const a = t + i * Math.PI / 9, rad = i % 2 ? r * 0.72 : r; c.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); }
        c.closePath(); c.fill(); c.shadowBlur = 0; c.fillStyle = '#7a1230'; c.beginPath(); c.arc(0, 0, r * 0.34, 0, 7); c.fill();
        if (pl.owner !== undefined) { c.fillStyle = PCOL[pl.owner]; c.beginPath(); c.arc(0, 0, r * 0.14, 0, 7); c.fill(); }
        return true;
    }
    function drawOverlay(c, pl) {
        const w = pl.w, h = pl.h;
        if (pl.foundation && !pl.ground && pl.type === 'normal') { c.fillStyle = '#5a667e'; c.beginPath(); c.roundRect ? c.roundRect(-w / 2, -h / 2, w, h, 5) : c.rect(-w / 2, -h / 2, w, h); c.fill(); c.fillStyle = 'rgba(255,255,255,.2)'; c.fillRect(-w / 2 + 3, -h / 2 + 1.5, w - 6, 3); c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(-w / 2 + 3, h / 2 - 4, w - 6, 3); }
        if (pl.foundation && !pl.ground) { c.fillStyle = '#2b3345'; for (const s of [-1, 1]) { c.beginPath(); c.arc(s * (w / 2 - 7), 0, 2, 0, 7); c.fill(); } }
        if (pl.blinkT !== undefined && pl.piece === 'blink') {
            const k = pl.blinkT < 0.8 ? (Math.floor(performance.now() / 90) % 2 ? 0.75 : 0) : 0;
            c.fillStyle = 'rgba(255,255,255,' + k + ')'; c.beginPath(); c.roundRect ? c.roundRect(-w / 2, -h / 2, w, h, 5) : c.rect(-w / 2, -h / 2, w, h); c.fill();
            c.strokeStyle = '#0d1017'; c.lineWidth = 2; c.setLineDash([5, 4]); c.beginPath(); c.moveTo(-w / 2 + 6, 0); c.lineTo(w / 2 - 6, 0); c.stroke(); c.setLineDash([]);
        }
    }
    window.addEventListener('resize', () => { if (!root.hidden) fit(); });
    render();
    const api = window.Build = { open, begin, update, checkEnd, leave, arcHitsSpike, drawSaw, drawOverlay, state: B, PIECES, spotInfo, apply, bombHits, detonate, net, remote: [] };     // api.remote: seats played by other people (set before begin)
})();
