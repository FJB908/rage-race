// ARCADE: random one-screen minigames for up to four players (you + bots, or you + your party). Boom Tag lives in tag.js; the rest are here:
//   GIANT SLAYER  one player is a giant with a life bar; three small ones stomp it while it squashes them
//   CROWN HILL    a glowing platform scores points while you are alone on it; it moves every few seconds
//   COIN RUSH     grab the most coins before the clock runs out; golden ones are worth three
//   SINKING SHIP  platforms crumble one by one; last one standing wins
// Every game is a plain object (setup / start / update / ai / finish) driven by the same loop, HUD and results, and takes its players from the
// normal player list, so a party member simply replaces a bot. Loaded AFTER tag.js. See docs/ARCADE.md.
(function () {
    'use strict';
    const $ = id => document.getElementById(id);
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const escH = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
    const lsNum = k => { try { return +localStorage.getItem(k) || 0; } catch (e) { return 0; } };
    const lsSet = (k, v) => { try { localStorage.setItem(k, String(v)); } catch (e) {} if (window.Cloud) Cloud.touch(); };
    let ar = null, G = null, session = false, lastId = '', spinTimer = 0;

    /* ----------------------------------------------------------------------------- shared arena + bot kit ---- */
    function mk(x, y, w, type, extra) {
        return Object.assign({ x, y, w, h:18, type, speed:0, dir:1, active:true, breaking:false, breakT:0, respawn:0, baseX:x, range:0, boostReady:true, quakeWarn:0, quakeDown:0 }, extra || {});
    }
    function buildArena(o) {
        o = o || {}; const pw = PLAY_W();
        platforms = []; itemBoxes = []; finishPlatform = null; ufos = []; shots = [];
        if (o.split) { for (let i = 0; i < 3; i++) platforms.push(mk(pw * (0.17 + i * 0.33), START_Y, 104, 'normal', { h:30 })); }
        else platforms.push({ x:pw / 2, y:START_Y, w:pw, h:40, type:'normal', active:true, ground:true, quakeWarn:0, quakeDown:0 });
        const room = VH - 90 - 262, tiers = clamp(Math.round(room / 150), 2, 5), gap = Math.min(172, room / tiers); let lastPat = -1;
        for (let k = 1; k <= tiers; k++) {
            const y = START_Y - gap * k; let pat; do { pat = Math.floor(Math.random() * 3); } while (pat === lastPat && Math.random() < 0.8); lastPat = pat;
            const xs = pat === 0 ? [0.25 + rnd(-0.04, 0.04), 0.75 + rnd(-0.04, 0.04)] : pat === 1 ? [0.5 + rnd(-0.1, 0.1)] : [0.17 + rnd(-0.02, 0.03), 0.5 + rnd(-0.04, 0.04), 0.83 - rnd(-0.03, 0.02)];
            const w = (pat === 0 ? 112 : pat === 1 ? 168 : 78) * (o.wide || 1);
            for (const fx of xs) {
                let type = 'normal';
                if (o.specials && Math.random() < 0.16) type = Math.random() < 0.5 ? 'moving' : 'ice';
                platforms.push(mk(fx * pw, y + rnd(-6, 6), w, type, type === 'moving' ? { speed:46, range:54, dir:Math.random() < 0.5 ? -1 : 1 } : null));
            }
        }
    }
    function place(p, pl, dx) { p.plat = pl; p.mode = 'idle'; p.vx = 0; p.vy = 0; p.x = clamp(pl.x + (dx || 0), p.r, PLAY_W() - p.r); p.y = pl.y - pl.h / 2 - p.r; }
    function spread(list, only) {
        const spots = shuffle(platforms.filter(pl => pl.active && (!only || only(pl)))); const used = [];
        for (const p of shuffle(list.slice())) {
            let best = null, bd = -1;
            for (const pl of spots) { if (used.includes(pl)) continue; let d = 1e9; for (const u of used) d = Math.min(d, Math.hypot(u.x - pl.x, (u.y - pl.y) * 0.8)); if (!used.length) d = Math.random() * 100; if (d > bd) { bd = d; best = pl; } }
            if (!best) best = spots[0] || platforms[0];
            used.push(best); place(p, best, best.ground ? rnd(-80, 80) : 0);
        }
    }
    function solveHit(p, tx, ty, maxV, minArrive) {
        const g = playerG(p);
        for (let t = 0.2; t <= 1.2; t += 0.02) {
            const vx = (tx - p.x) / t, vy = (ty - p.y - 0.5 * g * t * t - 0.5 * g * SIM_DT * t) / t;
            if (Math.hypot(vx, vy) > maxV) continue;
            if (minArrive !== undefined && vy + g * t < minArrive) continue;
            return { vx, vy, t };
        }
        return null;
    }
    function fire(p, vx, vy) {
        const mult = playerPowMul(p, false) || 1; let dx = vx / (POWER * mult), dy = vy / (POWER * mult); const d = Math.hypot(dx, dy);
        if (d > MAX_DRAG) { dx = dx / d * MAX_DRAG; dy = dy / d * MAX_DRAG; }
        launchPlayer(p, dx, dy);
    }
    function reachList(p, same) {
        const out = [], maxV = playerMaxV(p, false) * 0.96, g = playerG(p);
        for (const pl of platforms) {
            if (!pl.active || (pl === p.plat && !same)) continue;
            const px = predictPlatX(pl, 0.7), half = Math.max(6, pl.w / 2 - 14);
            for (const f of [-1, -0.5, 0, 0.5, 1]) {
                const lx = clamp(px + f * half, p.r + 6, PLAY_W() - p.r - 6), ly = pl.y - pl.h / 2 - p.r;
                if (pl === p.plat && Math.abs(lx - p.x) < 24) continue;
                const sol = solveJump(lx - p.x, ly - p.y, maxV, g, 0.9);
                if (sol) out.push({ pl, lx, ly, sol });
            }
        }
        return out;
    }
    const err = p => 0.02 + (1.2 - clamp(p.skill || 1, 0.7, 1.25)) * 0.07;
    function go(p, r) { const e = err(p); fire(p, r.sol.vx * (1 + rnd(-e, e)), r.sol.vy * (1 + rnd(-e, e))); }
    // jump to the platform spot closest to a point
    function hopToward(p, tx, ty, margin) {
        let best = null, bc = Math.hypot(tx - p.x, ty - p.y) - (margin === undefined ? 30 : margin);
        for (const r of reachList(p)) { const d = Math.hypot(tx - r.lx, ty - r.ly) + r.sol.t * 20; if (d < bc) { bc = d; best = r; } }
        if (best) { go(p, best); return true; } return false;
    }
    function strike(p, tx, ty, minArrive) {                 // a direct arc through (tx, ty), arriving from above when asked
        const sol = solveHit(p, tx, ty, playerMaxV(p, false) * 0.97, minArrive); if (!sol) return false;
        const e = err(p); fire(p, sol.vx * (1 + rnd(-e, e)), sol.vy * (1 + rnd(-e, e))); return true;
    }
    const alive = () => players.filter(p => !p.out);
    function eliminate(p, label) {
        if (p.out) return; p.out = true; p.finished = true; p._off = true; p.round = Math.round(ar.t); p.why = label || ''; ar.order.push(p);
        burst(p.x, p.y, p.color, 30, 380); burst(p.x, p.y, '#ffffff', 14, 260); ring(p.x, p.y, p.color, 100); SFX.play('shatter');
        if (p.local) { camShake = Math.max(camShake, 14); haptic([50, 40, 90]); }
    }
    function pop(x, y, text, col, big) { ar.pops.push({ x, y, text, col, t:0, life:big ? 1.4 : 1.0, big:!!big }); }
    const banner = (t, c, s) => Tag.ui.banner(t, c, s);

    /* ----------------------------------------------------------------------------- minigames ---- */
    // GIANT SLAYER -------------------------------------------------------------------------------------------------
    const giant = {
        id:'giant', name:'Giant Slayer', line:'One giant, three challengers: stomp its head 5 times before it squashes you.', icon:'ar-giant', col:'#ff6f91', time:55, bg:'#171220', arena:{ wide:1.1 },
        setup() {
            const g = players[Math.floor(Math.random() * players.length)]; ar.giant = g; g.r = 34; g.hp = 5; g.hpMax = 5; g.bigBoss = true; g.hitCd = 0; g.hearts = 0;
            for (const p of players) if (p !== g) { p.hearts = 2; p.guard = 0; p.hitCd = 0; }
            const smalls = players.filter(p => p !== g); place(g, platforms[0], 0); spread(smalls, pl => !pl.ground);
            ar.cap = 'STOMP THE GIANT 5 TIMES';
        },
        start() { banner(ar.giant.local ? 'YOU ARE THE GIANT' : 'TAKE DOWN THE GIANT', ar.giant.local ? '#ff6f91' : '#ffb347', 1.6); ar.giant.vx = 0; },
        update(dt) {
            const g = ar.giant;
            for (const p of players) { p._pvy = p._lastVy === undefined ? p.vy : p._lastVy; if (p.hitCd > 0) p.hitCd -= dt; if (p.guard > 0) p.guard -= dt; }
            for (const s of alive()) {
                if (s === g || g.out) continue;
                const dx = s.x - g.x, dy = s.y - g.y, rs = g.r + s.r;
                if (dx * dx + dy * dy > (rs + 9) * (rs + 9)) continue;
                if (s._pvy > 90 && s.y < g.y - g.r * 0.2 && s.hitCd <= 0) {                 // a challenger lands on the giant's head
                    s.hitCd = 0.8; g.hp--; g.stunT = 0.5; s.vy = -720; s.mode = 'air'; s.plat = null; s.vx = (dx >= 0 ? 1 : -1) * 140;
                    burst(g.x, g.y - g.r, '#ffcf3f', 24, 360); ring(g.x, g.y - g.r, '#ffffff', 90); pop(g.x, g.y - g.r - 24, g.hp > 0 ? '-1' : 'DOWN!', '#ff6f91', true);
                    SFX.play('knock', 3); camShake = Math.max(camShake, 11); if (s.local || g.local) haptic([40, 30, 60]); s.hits = (s.hits || 0) + 1;
                } else if (g._pvy > 150 && g.y < s.y - s.r * 0.1 && g.hitCd <= 0 && !(s.guard > 0) && !(s.shieldT > 0)) {   // the giant lands on a challenger
                    g.hitCd = 0.7; s.hearts--; s.guard = 1.4; s.stunT = 0.9; s.vy = -520; s.vx = (dx >= 0 ? 1 : -1) * 280; s.mode = 'air'; s.plat = null; g.vy = -430;
                    burst(s.x, s.y, '#ff5470', 24, 320); ring(s.x, s.y, '#ff5470', 80); pop(s.x, s.y - 30, s.hearts > 0 ? 'OUCH' : 'SQUASHED', '#ff5470', true);
                    SFX.play('stumble'); camShake = Math.max(camShake, 10); if (s.local) haptic([50, 30, 80]);
                    if (s.hearts <= 0) eliminate(s, 'squashed');
                }
            }
            for (const p of players) p._lastVy = p.vy;
            if (g.hp <= 0 && !ar.over) { ar.winner = 'smalls'; ar.over = true; eliminate(g, 'defeated'); }
            else if (!ar.over && alive().filter(p => p !== g).length === 0) { ar.winner = 'giant'; ar.over = true; }
        },
        ai(p, dt) {
            if (p.mode !== 'idle' || !p.plat || p.stunT > 0 || p.finished) return;
            p.thinkT -= dt; if (p.thinkT > 0) return;
            const g = ar.giant, skill = clamp(p.skill || 1, 0.7, 1.25); p.thinkT = (p === g ? rnd(0.22, 0.5) : rnd(0.35, 0.75)) / skill;
            if (p === g) {
                let tgt = null, bd = 1e9;
                for (const s of alive()) { if (s === g || s.guard > 0) continue; const d = Math.hypot(s.x - g.x, s.y - g.y); if (d < bd) { bd = d; tgt = s; } }
                if (!tgt) return;
                const tx = tgt.x, ty = tgt.y - tgt.r - g.r + 4;
                if (strike(g, tx, ty, 140)) return;
                if (!hopToward(g, tx, ty - 40, 40)) { const rs = reachList(g); if (rs.length) go(g, rs[Math.floor(Math.random() * rs.length)]); }
                return;
            }
            // challenger
            const danger = g.mode === 'air' && g.vy > 0 && g.y < p.y + 20 && Math.abs(g.x - p.x) < 120 || (g.mode === 'idle' && Math.hypot(g.x - p.x, g.y - p.y) < 90 && g.y >= p.y - 10);
            if (danger && Math.random() > (1.2 - skill) * 0.35) {
                let best = null, bs = -1e9; for (const r of reachList(p)) { const s = Math.abs(r.lx - g.x) + Math.abs(r.ly - g.y) * 0.4 - r.sol.t * 30; if (s > bs) { bs = s; best = r; } }
                if (best) go(p, best); return;
            }
            if (p.y < g.y - g.r - 24) { if (strike(p, g.x, g.y - g.r - p.r * 0.4, 200)) return; }
            // get above the giant
            let best = null, bs = 1e9;
            for (const r of reachList(p)) { if (r.ly > g.y - g.r - 20 && r.pl !== p.plat) continue; const s = Math.abs(r.lx - g.x) + r.sol.t * 40 + Math.max(0, r.ly - (g.y - 120)) * 0.2; if (s < bs) { bs = s; best = r; } }
            if (best && Math.abs(best.lx - g.x) < Math.abs(p.x - g.x) + 60) go(p, best);
        },
        chips() { return players.map(p => p === ar.giant ? { p, label:'GIANT', pips:[Math.max(0, p.hp), p.hpMax], red:true, out:p.out } : { p, pips:[Math.max(0, p.hearts), 2], out:p.out }); },
        done() { return ar.over; },
        finish() {
            const g = ar.giant, sm = players.filter(p => p !== g);
            if (ar.winner === 'smalls') { g.place = 4; sm.forEach(s => { s.place = s.out ? 2 : 1; }); ar.note = 'The giant fell!'; }
            else { g.place = 1; sm.forEach(s => { s.place = s.out ? 3 : 2; }); ar.note = alive().filter(p => p !== g).length ? 'The giant survived' : 'The giant squashed everyone'; }
            for (const p of players) p.line = p === g ? (g.hp <= 0 ? 'Giant, defeated' : 'Giant, ' + g.hp + ' hp left') : (p.out ? 'Squashed' : (p.hits ? p.hits + ' stomp' + (p.hits > 1 ? 's' : '') : 'Survived'));
        },
        draw(ctx, t) {
            const g = ar.giant; if (g.out) return;
            ctx.save(); ctx.translate(g.x, g.y); ctx.globalCompositeOperation = 'lighter';
            const a = 0.22 + 0.08 * Math.sin(t * 5), gr = ctx.createRadialGradient(0, 0, 8, 0, 0, g.r * 2.2); gr.addColorStop(0, 'rgba(255,90,120,' + a + ')'); gr.addColorStop(1, 'rgba(255,90,120,0)');
            ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, g.r * 2.2, 0, 7); ctx.fill(); ctx.restore();
            // its life bar
            const w = 74, x = g.x - w / 2, y = g.y - g.r - 34 - (g.look && g.look.hat && g.look.hat !== 'none' ? 18 : 0) - (g.local ? 26 : 0);
            ctx.save(); ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(x - 2, y - 2, w + 4, 12);
            const seg = w / g.hpMax; for (let i = 0; i < g.hpMax; i++) { ctx.fillStyle = i < g.hp ? '#ff5470' : 'rgba(255,255,255,.14)'; ctx.fillRect(x + i * seg + 1, y, seg - 2, 8); }
            ctx.restore();
        },
    };

    // CROWN HILL ---------------------------------------------------------------------------------------------------
    const HILL_GOAL = 28;
    const hill = {
        id:'hill', name:'Crown Hill', line:'Stay alone on the glowing platform to score. Stomp rivals off it!', icon:'crown', col:'#ffcf3f', time:50, bg:'#16151d', arena:{ specials:true },
        setup() { ar.score = {}; players.forEach(p => { ar.score[p.id] = 0; }); spread(players); moveHill(true); ar.hillT = 10; ar.cap = 'FIRST TO ' + HILL_GOAL + ' POINTS'; },
        start() { banner('KING OF THE HILL', '#ffcf3f', 1.5); },
        update(dt) {
            ar.hillT -= dt; if (ar.hillT <= 0) { moveHill(false); ar.hillT = 10; }
            const on = alive().filter(p => p.mode === 'idle' && p.plat === ar.hill);
            ar.holder = on.length === 1 ? on[0] : null; ar.contested = on.length > 1;
            if (ar.holder) { ar.score[ar.holder.id] += dt; if (Math.floor(ar.score[ar.holder.id]) !== ar.holder._lastPt) { ar.holder._lastPt = Math.floor(ar.score[ar.holder.id]); if (ar.holder.local) SFX.play('tick', 0.2); } }
            if (players.some(p => ar.score[p.id] >= HILL_GOAL)) ar.over = true;
        },
        ai(p, dt) {
            if (p.mode !== 'idle' || !p.plat || p.stunT > 0 || p.finished) return;
            p.thinkT -= dt; if (p.thinkT > 0) return;
            const skill = clamp(p.skill || 1, 0.7, 1.25); p.thinkT = rnd(0.35, 0.8) / skill; const h = ar.hill;
            const others = alive().filter(q => q !== p && q.mode === 'idle' && q.plat === h);
            if (p.plat === h) {
                if (others.length) { const q = others[0]; if (q.y >= p.y - 8 || !strike(p, q.x, q.y - q.r - p.r * 0.5, 160)) { /* wait for a chance */ } }
                return;
            }
            const spot = h; let best = null, bd = 1e9;
            for (const r of reachList(p)) { if (r.pl !== spot) continue; const d = Math.abs(r.lx - spot.x) + (others.length ? Math.abs(r.lx - others[0].x) * -0.3 : 0); if (d < bd) { bd = d; best = r; } }
            if (best) { go(p, best); return; }
            if (others.length && Math.random() < 0.5 && p.y < h.y - 10 && strike(p, others[0].x, others[0].y - others[0].r - p.r * 0.5, 160)) return;
            hopToward(p, spot.x, spot.y - 14, 20);
        },
        chips() { return players.map(p => ({ p, val:Math.floor(ar.score[p.id]), out:false, crown:ar.holder === p })); },
        done() { return ar.over; },
        finish() { rankByScore(s => ar.score[s.id], v => Math.floor(v) + ' pts'); ar.note = 'Most hill time wins'; },
        draw(ctx, t) {
            const h = ar.hill; if (!h || !h.active) return;
            ctx.save(); ctx.translate(h.x, h.y); ctx.globalCompositeOperation = 'lighter';
            const a = 0.32 + 0.12 * Math.sin(t * 4), gr = ctx.createLinearGradient(0, -80, 0, 6); gr.addColorStop(0, 'rgba(255,207,63,0)'); gr.addColorStop(1, 'rgba(255,207,63,' + a + ')');
            ctx.fillStyle = gr; ctx.fillRect(-h.w / 2 - 4, -80, h.w + 8, 86); ctx.restore();
            ctx.save(); ctx.translate(h.x, h.y - 42 + Math.sin(t * 3) * 3); drawCrown(0, 0, 8); ctx.restore();
            if (ar.holder) {                                     // a ring that fills toward the next point
                const p = ar.holder, f = ar.score[p.id] % 1; ctx.save(); ctx.translate(p.x, p.y); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.arc(0, 0, 24, 0, 7); ctx.stroke();
                ctx.strokeStyle = '#ffcf3f'; ctx.beginPath(); ctx.arc(0, 0, 24, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); ctx.stroke(); ctx.restore();
            } else if (ar.contested) { ctx.save(); ctx.translate(h.x, h.y - 84); ctx.font = '900 11px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#ff7a8f'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.strokeText('CONTESTED', 0, 0); ctx.fillText('CONTESTED', 0, 0); ctx.restore(); }
        },
    };
    function moveHill(first) {
        const c = platforms.filter(pl => pl.active && !pl.ground && pl !== ar.hill && pl.type !== 'fragile');
        const next = c[Math.floor(Math.random() * c.length)] || platforms[1]; ar.hill = next;
        if (!first) { pop(next.x, next.y - 70, 'NEW HILL', '#ffcf3f', true); SFX.play('count'); ring(next.x, next.y, '#ffcf3f', 120); }
    }
    function rankByScore(get, fmt) {
        const sorted = players.slice().sort((a, b) => get(b) - get(a)); let place = 0, prev = null;
        sorted.forEach((p, i) => { if (prev === null || get(p) < prev - 1e-9) place = i + 1; p.place = place; prev = get(p); p.line = fmt(get(p)); });
    }

    // COIN RUSH ----------------------------------------------------------------------------------------------------
    const coins = {
        id:'coins', name:'Coin Rush', line:'Grab the most coins before time runs out. Golden coins are worth three.', icon:'coin', col:'#ffd25a', time:40, bg:'#15171f', arena:{ specials:true },
        setup() { ar.score = {}; players.forEach(p => { ar.score[p.id] = 0; }); ar.coins = []; ar.spawnT = 0; spread(players); for (let i = 0; i < 4; i++) spawnCoin(); ar.cap = 'MOST COINS WINS'; },
        start() { banner('COIN RUSH', '#ffd25a', 1.4); },
        update(dt) {
            ar.spawnT -= dt; if (ar.spawnT <= 0 && ar.coins.length < 5) { spawnCoin(); ar.spawnT = rnd(0.5, 1.2); }
            for (const c of ar.coins.slice()) {
                c.age += dt; const pos = coinPos(c);
                for (const p of alive()) {
                    if (Math.abs(p.x - pos.x) < 21 + (c.val > 1 ? 3 : 0) && Math.abs(p.y - pos.y) < 30) {
                        ar.score[p.id] += c.val; ar.coins.splice(ar.coins.indexOf(c), 1); burst(pos.x, pos.y, c.val > 1 ? '#ffcf3f' : '#ffe27a', 14, 240); ring(pos.x, pos.y, '#ffcf3f', 44);
                        pop(pos.x, pos.y - 16, '+' + c.val, c.val > 1 ? '#ffcf3f' : '#fff3b0', c.val > 1); if (p.local) { SFX.play('coin'); haptic(12); } break;
                    }
                }
                if (c.age > 11 && ar.coins.includes(c)) ar.coins.splice(ar.coins.indexOf(c), 1);
            }
        },
        ai(p, dt) {
            if (p.mode !== 'idle' || !p.plat || p.stunT > 0 || p.finished) return;
            p.thinkT -= dt; if (p.thinkT > 0) return;
            const skill = clamp(p.skill || 1, 0.7, 1.25); p.thinkT = rnd(0.3, 0.65) / skill;
            let best = null, bs = -1e9; const rl = reachList(p, true);
            for (const c of ar.coins) {
                const pos = coinPos(c);
                for (const r of rl) { if (r.pl !== c.pl) continue; const d = Math.abs(r.lx - pos.x); if (d > 26) continue; const s = c.val * 40 - r.sol.t * 30 - d - Math.hypot(pos.x - p.x, pos.y - p.y) * 0.06; if (s > bs) { bs = s; best = r; } }
            }
            if (best) { const c = ar.coins.find(c0 => c0.pl === best.pl); const pos = c ? coinPos(c) : { x:best.lx }; const e = err(p); const sol = solveJump(clamp(pos.x, p.r + 6, PLAY_W() - p.r - 6) - p.x, best.ly - p.y, playerMaxV(p, false) * 0.96, playerG(p), 0.9) || best.sol; fire(p, sol.vx * (1 + rnd(-e, e)), sol.vy * (1 + rnd(-e, e))); }
            else if (ar.coins.length) { const c = ar.coins[Math.floor(Math.random() * ar.coins.length)], pos = coinPos(c); hopToward(p, pos.x, pos.y, 10); }
        },
        chips() { return players.map(p => ({ p, val:ar.score[p.id], out:false })); },
        done() { return false; },
        finish() { rankByScore(s => ar.score[s.id], v => v + ' coins'); ar.note = 'Most coins wins'; },
        draw(ctx, t) {
            for (const c of ar.coins) {
                const pos = coinPos(c), bob = Math.sin(t * 4 + c.off) * 2.5, sc = c.val > 1 ? 1.35 : 1, fade = c.age > 9 ? 0.4 + 0.6 * Math.abs(Math.sin(t * 12)) : 1, squeeze = Math.abs(Math.cos(t * 3 + c.off)) * 0.7 + 0.3;
                ctx.save(); ctx.translate(pos.x, pos.y + bob); ctx.globalAlpha = fade;
                const gl = ctx.createRadialGradient(0, 0, 2, 0, 0, 20 * sc); gl.addColorStop(0, c.val > 1 ? 'rgba(255,207,63,.8)' : 'rgba(255,226,122,.5)'); gl.addColorStop(1, 'rgba(255,207,63,0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, 0, 20 * sc, 0, 7); ctx.fill();
                ctx.scale(squeeze, 1); ctx.fillStyle = c.val > 1 ? '#ffcf3f' : '#ffd25a'; ctx.strokeStyle = '#8a5a00'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 9 * sc, 0, 7); ctx.fill(); ctx.stroke();
                ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(0, 0, 5.6 * sc, -2.6, -0.8); ctx.stroke(); ctx.restore();
            }
        },
    };
    const coinPos = c => ({ x:c.pl.x + c.off, y:c.pl.y - c.pl.h / 2 - 16 });
    function spawnCoin() {
        const cand = platforms.filter(pl => pl.active && pl.type !== 'fragile' && !ar.coins.some(c => c.pl === pl)); if (!cand.length) return;
        const pl = cand[Math.floor(Math.random() * cand.length)];
        ar.coins.push({ pl, off:rnd(-pl.w * 0.3, pl.w * 0.3), val:Math.random() < 0.16 ? 3 : 1, age:0 });
    }

    // SINKING SHIP -------------------------------------------------------------------------------------------------
    const sink = {
        id:'sink', name:'Sinking Ship', line:'Platforms crumble one by one. Keep jumping, be the last one standing!', icon:'ar-sink', col:'#5eb4ff', time:75, bg:'#101620', arena:{ split:true },
        setup() { window.ARC_NOFLOOR = true; ar.sinkT = 3.6; ar.sinkGap = 3.0; ar.sunk = 0; spread(players); ar.cap = 'LAST ONE STANDING WINS'; },
        start() { banner('KEEP MOVING', '#5eb4ff', 1.4); },
        update(dt) {
            for (const pl of platforms) if (!pl.active && pl.sink) pl.respawn = 1e9;
            ar.sinkT -= dt;
            if (ar.sinkT <= 0) {
                const live = platforms.filter(pl => pl.active && !pl.breaking);
                if (live.length > 0) {
                    const occupied = live.filter(pl => players.some(p => !p.out && p.plat === pl)), pool = occupied.length && Math.random() < 0.3 ? occupied : live;
                    const pl = pool[Math.floor(Math.random() * pool.length)]; pl.breaking = true; pl.breakT = 1.2; pl.sink = true; ar.sunk++;
                }
                ar.sinkGap = Math.max(1.0, ar.sinkGap - 0.1); ar.sinkT = ar.sinkGap;
            }
            for (const p of alive()) if (p.y > START_Y + 140) { eliminate(p, 'fell'); if (p.local) banner('YOU FELL', '#ff5470', 1.4); }
            if (alive().length <= 1) ar.over = true;
        },
        ai(p, dt) {
            if (p.mode !== 'idle' || !p.plat || p.stunT > 0 || p.finished) return;
            p.thinkT -= dt; if (p.thinkT > 0) return;
            const skill = clamp(p.skill || 1, 0.7, 1.25); p.thinkT = rnd(0.2, 0.55) / skill;
            const here = p.plat, warn = here.breaking || !here.active;
            if (!warn && Math.random() > 0.12) return;
            let best = null, bs = -1e9;
            for (const r of reachList(p)) {
                if (r.pl.breaking || !r.pl.active) continue;
                let s = -r.sol.t * 30; for (const q of alive()) if (q !== p && q.plat === r.pl) s -= 25;
                s += r.pl.w * 0.08 + rnd(-8, 8); if (s > bs) { bs = s; best = r; }
            }
            if (!best && warn) { const rl = reachList(p); if (rl.length) best = rl[Math.floor(Math.random() * rl.length)]; }
            if (best) go(p, best);
        },
        chips() { return players.map(p => ({ p, out:p.out })); },
        done() { return ar.over; },
        finish() {
            const rest = alive(); rest.forEach(p => { p.place = 1; p.line = 'Survived'; });
            ar.order.forEach((p, i) => { p.place = players.length - i; p.line = 'Fell at ' + p.round + 's'; });
            ar.note = rest.length === 1 ? rest[0].name + ' stayed dry' : 'Time!';
        },
        draw() {},
    };
    const GAMES = { tag:{ id:'tag', name:'Boom Tag', line:'Pass the bomb. Do not be holding it when it blows!', icon:'mode-tag', col:'#ff7a3d' }, giant, hill, coins, sink };
    const ORDER = ['tag', 'giant', 'hill', 'coins', 'sink'];

    /* ----------------------------------------------------------------------------- runtime ---- */
    function begin(id) {
        const T = Tag.ui; T.ensureRoot(); T.hideResult(); $('tg-root').classList.remove('over', 'tipping'); lastId = id;
        G = GAMES[id];
        gameMode = 'arcade'; esc = null; pk = null; lv = null; ufos = []; window.rankedMatch = false; window.partyMatch = null;
        if (window.ArenaTheme) ArenaTheme.clear();                // arena looks are for Arena Race and Build Race only
        document.body.classList.remove('mode-escape', 'mode-parkour', 'mode-level', 'mode-gauntlet'); document.body.classList.add('mode-tag');
        showScreen(''); WORLD_W = 356; resize();
        buildArena(G.arena);
        matchHumanSlot = 0; matchBotNames = []; initPlayers();
        if (window.BotRoster) BotRoster.applyTo(players.slice(1), BotRoster.pick(3, { mmr:(window.Trophies ? Trophies.matchMmr() : 1100), spread:180 }));
        const party = (window.Party && Party.active && Party.active()) ? Party.standIns() : [];
        party.forEach((m, k) => { const b = players[k + 1]; if (b) { b.name = m.name; b.look = Object.assign({ skin:'classic', hat:'none', face:'none', trail:'none' }, m.look || {}); b.color = skinById(b.look.skin).color; } });
        for (const p of players) { p.bigBoss = false; p.noAI = true; p.out = false; p.stunT = 0; p.thinkT = rnd(0.5, 1.1); p.gone = false; p._off = false; p.finished = false; p.bomb = false; p.place = 0; p.line = ''; p._lastVy = undefined; p._lastPt = undefined; }
        window.ARC_NOFLOOR = false;
        ar = { id, phase:'ready', t:0, timeMax:G.time, timeLeft:G.time, pops:[], order:[], rewarded:false, lootId:newLootId('arc'), over:false, overT:0, cap:'', autoLocal:false, resultShown:false };
        window.TG_BG = G.bg;
        G.setup();
        hud.style.display = 'block'; $('tg-root').classList.add('playing');
        $('tg-hud').querySelector('.tg-bomb use').setAttribute('href', '#ico-' + G.icon);
        $('tg-cap').textContent = ar.cap; $('tg-cap').style.display = '';
        beginRound(); cameraY = START_Y - (VH - 92); prevCam = cameraY; chipKey = '';
        hudChips(); hudTick();
    }
    function start(id) {
        session = true; lastId = id; { const h = $('ar-hub'); if (h) h.classList.remove('vis'); }
        if (id === 'tag') { Tag.open(); return; }
        begin(id);
    }
    function update(dt) {
        if (!ar) return;
        ar.t += dt;
        for (let i = ar.pops.length - 1; i >= 0; i--) { ar.pops[i].t += dt; if (ar.pops[i].t > ar.pops[i].life) ar.pops.splice(i, 1); }
        for (const p of players) if (p.stunT > 0) p.stunT -= dt;
        if (ar.phase === 'ready') { ar.phase = 'live'; G.start(); return; }
        if (ar.phase === 'over') { ar.overT -= dt; if (ar.overT <= 0 && !ar.resultShown) showResult(); return; }
        ar.timeLeft -= dt;
        G.update(dt);
        for (const p of players) if (!p.out && (!p.local || ar.autoLocal)) G.ai(p, dt);
        if (ar.timeLeft <= 5 && Math.ceil(ar.timeLeft) < (ar.tickAt || 99)) { ar.tickAt = Math.ceil(ar.timeLeft); SFX.play('tick', 0.4); }
        if (G.done() || ar.timeLeft <= 0) end();
        hudTick(); hudChips();
    }
    function end() {
        if (ar.phase === 'over') return;
        ar.phase = 'over'; ar.overT = 1.1; G.finish();
        const me = players[0], pl = me.place || 4;
        banner(pl === 1 ? 'YOU WIN' : 'GAME OVER', pl === 1 ? '#ffcf3f' : '#ffffff', 2);
        SFX.play(pl === 1 ? 'finish' : 'fail'); if (pl === 1) haptic([30, 40, 30, 40, 80]);
        const winner = players.find(p => p.place === 1); if (winner) { burst(winner.x, winner.y, '#ffcf3f', 40, 380); ring(winner.x, winner.y, '#ffcf3f', 120); }
        if (!ar.rewarded) {
            ar.rewarded = true;
            const rw = rewardRace(pl, true, ar.lootId);
            if (pl === 1) lsSet('rr_arc_wins', lsNum('rr_arc_wins') + 1);
            if (window.Missions) { Missions.event('arplay', 1); if (pl === 1) Missions.event('arwin', 1); }
            ar.result = { place:pl, rw }; refreshMenu();
        }
    }
    function podAr(standings, pl) {
        if (!window.Podium) return '';
        const en = standings.map(p => ({ name:p.name, look:p.look || {}, color:p.color, me:!!p.local, sub:p.line || '' }));
        return Podium.html(en, pl > 3 ? { extra:en[pl - 1], extraRank:pl } : {});
    }
    function showResult() {
        ar.resultShown = true; $('tg-root').classList.add('over');
        const R_ = ar.result || { place:4, rw:{} }, pl = R_.place, rw = R_.rw || {};
        const standings = players.slice().sort((a, b) => (a.place || 9) - (b.place || 9));
        const title = pl === 1 ? 'YOU WIN' : pl === 2 ? 'SO CLOSE' : 'BETTER LUCK NEXT TIME';
        const chips = rw.noDrop && (rw.coins || rw.xp || rw.passPoints) ? (R('coin', rw.coins, { plus:true }) + R('xp', rw.xp, { plus:true }) + R('pass', rw.passPoints, { plus:true })) : '';
        $('tg-result').innerHTML = '<div class="tg-rc"><div class="tg-rtop' + (pl === 1 ? ' win' : '') + '"><small>' + escH(G.name.toUpperCase()) + '</small><h1>' + title + '</h1><p>' + escH(ar.note || '') + '</p></div>' + podAr(standings, pl) +
            '<div class="tg-rows">' + standings.map(p => '<div class="tg-row' + (p.local ? ' me' : '') + '"><b>' + (p.place || '') + '</b><i style="background:' + p.color + '"></i><span>' + (p.local ? 'YOU' : escH(p.name)) + '</span><em>' + escH(p.line || '') + '</em></div>').join('') + '</div>' +
            '<div class="tg-rew">' + chips + '</div>' + (pl === 1 ? '<p class="tg-note">A chest is waiting on the home screen</p>' : '') +
            '<button class="tg-go" id="ar-next" type="button">NEXT MINIGAME</button><button class="tg-ghost" id="ar-again" type="button">PLAY AGAIN</button><button class="tg-ghost" id="ar-menu" type="button">MAIN MENU</button></div>';
        $('tg-result').classList.add('vis'); if (window.Podium) setTimeout(() => Podium.start($('tg-result')), 60);
        $('ar-next').onclick = () => { leave(false); next(); };
        $('ar-again').onclick = () => restart();
        $('ar-menu').onclick = () => leave(true);
    }
    function skipNow() { if (!ar) return; let n = 0; while (ar && ar.phase !== 'over' && n++ < 6000) update(1 / 60); if (ar) { ar.overT = 0; update(0.01); } }

    /* ---------------------------------------------------------------------------- hud / draw ---- */
    let chipKey = '';
    function hudChips() {
        const list = G.chips(); const key = JSON.stringify(list.map(c => [c.p.id, c.val, c.pips, c.out, c.crown]));
        if (key === chipKey) return; chipKey = key;
        $('tg-chips').innerHTML = list.map(c => '<span class="tg-chip' + (c.out ? ' out' : '') + (c.p.local ? ' me' : '') + (c.red ? ' bomb' : '') + '"><i style="background:' + c.p.color + '"></i><em>' + (c.p.local ? 'YOU' : escH(c.label ? c.label : c.p.name)) + '</em>' +
            (c.val !== undefined ? '<b class="tg-val">' + c.val + '</b>' : '') + (c.pips ? '<u class="tg-pips">' + Array.from({ length:c.pips[1] }, (_, i) => '<s class="' + (i < c.pips[0] ? 'on' : '') + '"></s>').join('') + '</u>' : '') + '</span>').join('');
    }
    function hudTick() {
        const f = $('tg-fill'), s = $('tg-sec'); if (!f) return; const k = clamp(ar.timeLeft / ar.timeMax, 0, 1);
        f.style.transform = 'scaleX(' + k.toFixed(3) + ')'; $('tg-hud').classList.toggle('hot', ar.timeLeft < 8); s.textContent = Math.max(0, Math.ceil(ar.timeLeft)) + 's';
    }
    function drawFront(ctx) {
        if (!ar) return; const t = performance.now() / 1000;
        G.draw(ctx, t);
        for (const o of ar.pops) {
            const k = o.t / o.life, rise = 26 * (1 - Math.pow(1 - Math.min(1, o.t * 3), 2)) + o.t * 14, sc = o.t < 0.14 ? 1 + 0.6 * (1 - o.t / 0.14) : 1, size = o.big ? 22 : 15;
            ctx.save(); ctx.translate(o.x, o.y - rise); ctx.scale(sc, sc); ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1; ctx.transform(1, 0, -0.14, 1, 0, 0);
            ctx.font = 'italic 900 ' + size + 'px "Bricolage Grotesque","Segoe UI",system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.lineWidth = 5; ctx.strokeStyle = '#0d1017'; ctx.strokeText(o.text, 0, 0);
            ctx.shadowColor = o.col; ctx.shadowBlur = 10; ctx.fillStyle = o.col; ctx.fillText(o.text, 0, 0); ctx.restore();
        }
        for (const p of players) if (p.stunT > 0 && !p.out) {
            ctx.save(); ctx.translate(p.x, p.y); ctx.globalAlpha = 0.5 + 0.2 * Math.sin(t * 12); ctx.fillStyle = 'rgba(160,215,255,.5)'; ctx.strokeStyle = '#e6f6ff'; ctx.lineWidth = 2; ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(-p.r - 3, -p.r - 3, p.r * 2 + 6, p.r * 2 + 6, 6); else ctx.rect(-p.r - 3, -p.r - 3, p.r * 2 + 6, p.r * 2 + 6); ctx.fill(); ctx.stroke(); ctx.restore();
        }
        const me = players[0]; if (me && !me.out) drawYouArrow(ctx, me, (G === giant && me === ar.giant) ? 22 : 0);
    }
    function drawOverlay(ctx, W, H) {
        if (!ar || ar.phase !== 'live' || ar.timeLeft > 6) return;
        const a = (1 - ar.timeLeft / 6) * (0.18 + 0.08 * Math.sin(performance.now() / 120)), g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.72);
        g.addColorStop(0, 'rgba(255,200,60,0)'); g.addColorStop(1, 'rgba(255,170,40,' + a + ')'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    function leave(toMenu) {
        const root = $('tg-root'); if (root) { root.classList.remove('playing', 'tipping', 'over'); Tag.ui.hideResult(); }
        const wasArcade = gameMode === 'arcade'; ar = null; G = null; window.TG_BG = null; window.ARC_NOFLOOR = false;
        const cap = $('tg-cap'); if (cap) cap.style.display = 'none';
        if (!wasArcade) return;
        document.body.classList.remove('mode-tag'); gameMode = 'race'; state = 'menu'; dragging = false; hud.style.display = 'none';
        for (const p of players) { p.noAI = false; p.out = false; p.finished = false; p._off = false; p.gone = false; p.stunT = 0; p.r = 12; }
        try { stopSpectate(); } catch (e) {}
        if (toMenu) { session = false; refreshStartMeta(); showScreen('start'); }
    }
    function restart() { const id = lastId; leave(false); setTimeout(() => begin(id), 30); }
    function pauseMenu() { openPrompt('PAUSED', G ? G.name : 'Arcade', [['Resume', resumeRace], ['Settings', () => openSettings('pause'), true], ['Leave match', () => { state = 'playing'; showScreen(''); leave(true); }, true]]); }

    /* ------------------------------------------------------------------------------ hub ---- */
    function ensureHub() {
        let h = $('ar-hub'); if (h) return h;
        h = document.createElement('div'); h.id = 'ar-hub';
        h.innerHTML = '<div class="ar-top"><button type="button" class="ar-back" id="ar-back" aria-label="Back">&lsaquo;</button><div class="ar-title"><small>RANDOM PARTY GAMES</small><h1>Arcade</h1></div><div class="ar-wins" id="ar-wins"></div></div>' +
            '<div class="ar-scroll"><button type="button" class="ar-spin" id="ar-spin"><span class="ar-spin-ico"><svg viewBox="0 0 64 64"><use href="#ico-mode-arcade"/></svg></span><span class="ar-spin-t"><b>SPIN</b><small>A random minigame, for you and three rivals</small></span></button>' +
            '<h2 class="ar-h">OR PICK ONE</h2><div class="ar-grid" id="ar-grid"></div></div>' +
            '<div class="ar-reel" id="ar-reel"><div class="ar-reel-in"><small id="ar-reel-k">NEXT UP</small><div class="ar-reel-ico" id="ar-reel-ico"></div><b id="ar-reel-n">...</b><p id="ar-reel-l"></p></div></div>';
        document.body.appendChild(h);
        $('ar-back').onclick = () => close();
        $('ar-spin').onclick = () => spin();
        $('ar-grid').innerHTML = ORDER.map(id => { const g = GAMES[id]; return '<button type="button" class="ar-card" data-g="' + id + '" style="--c:' + g.col + '"><span class="ar-ci"><svg viewBox="0 0 64 64"><use href="#ico-' + g.icon + '"/></svg></span><b>' + escH(g.name) + '</b><small>' + escH(g.line) + '</small></button>'; }).join('');
        $('ar-grid').onclick = e => { const c = e.target.closest('[data-g]'); if (c) announce(c.dataset.g, false); };
        return h;
    }
    function open() { const h = ensureHub(); $('ar-wins').innerHTML = lsNum('rr_arc_wins') ? '<b>' + lsNum('rr_arc_wins') + '</b><small>wins</small>' : ''; h.classList.add('vis'); }
    function close() { const h = $('ar-hub'); if (h) h.classList.remove('vis'); clearTimeout(spinTimer); const r = $('ar-reel'); if (r) r.classList.remove('vis'); }
    function spin() {
        const ids = ORDER.filter(id => id !== lastId), pick = ids[Math.floor(Math.random() * ids.length)];
        const reel = $('ar-reel'), n = $('ar-reel-n'), k = $('ar-reel-k'), l = $('ar-reel-l'), ic = $('ar-reel-ico');
        reel.classList.add('vis'); reel.classList.remove('lock'); k.textContent = 'SPINNING'; l.textContent = ''; let i = 0, delay = 60; clearTimeout(spinTimer);
        const tick = () => {
            const id = ORDER[i % ORDER.length]; const g = GAMES[id]; n.textContent = g.name; ic.innerHTML = '<svg viewBox="0 0 64 64"><use href="#ico-' + g.icon + '"/></svg>'; ic.style.setProperty('--c', g.col); SFX.play('tap'); i++;
            if (i > 14 && id === pick) { announce(pick, true); return; }
            if (i > 8) delay += 22; spinTimer = setTimeout(tick, delay);
        };
        tick();
    }
    function announce(id, fromSpin) {
        const g = GAMES[id], reel = $('ar-reel'); reel.classList.add('vis', 'lock');
        $('ar-reel-k').textContent = 'NEXT UP'; $('ar-reel-n').textContent = g.name; $('ar-reel-l').textContent = g.line;
        const ic = $('ar-reel-ico'); ic.innerHTML = '<svg viewBox="0 0 64 64"><use href="#ico-' + g.icon + '"/></svg>'; ic.style.setProperty('--c', g.col); SFX.play('open');
        clearTimeout(spinTimer); spinTimer = setTimeout(() => { reel.classList.remove('vis', 'lock'); close(); start(id); }, fromSpin ? 1700 : 1500);
    }
    function next() { const h = ensureHub(); h.classList.add('vis'); spin(); }

    window.Arcade = { endSession:() => { session = false; }, open, close, start, next, spin, update, drawFront, drawOverlay, leave, restart, pauseMenu, skip:skipNow, session:() => session, state:() => ar,
        debug:{ get ar() { return ar; }, begin, auto(on) { if (ar) ar.autoLocal = on !== false; }, GAMES, ORDER } };
})();
