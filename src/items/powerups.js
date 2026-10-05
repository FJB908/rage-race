// POWER-UPS: Cannon and Double jump, plus the spring under a Super Bounce player. Classic script, loaded AFTER game.js (it uses game.js globals at call time).
// game.js calls into window.PU from a handful of hooks (item roll, activate, tick, input, draw); party races sync the state through the 10 Hz samples (PU.sample / PU.apply).
//  CANNON  : you turn into a standing cannon (also when used in mid-air: it falls, lands, then deploys). Aim with a drag, release to fire at full power, very far up the track.
//  DOUBLE  : for 7 s you can jump once more in mid-air (one extra jump per flight). A cloud puffs under you; everybody sees it.
(function () {
    'use strict';
    const CANNON_TIME = 9, CANNON_V = 2750, CANNON_ANG = 0.38;          // seconds before it fires itself, launch speed (normal max is 1425), widest angle off vertical (about 22 degrees)
    const DJ_TIME = 7, DJ_POW = 0.94;                                  // seconds the double jump lasts, power of the extra jump relative to a normal one
    const clouds = [];
    const sc = a => Math.max(-CANNON_ANG, Math.min(CANNON_ANG, a));
    const angOf = (dx, dy) => Math.atan2(dx, -dy);                      // 0 = straight up, negative = left
    const cannonVel = a => ({ vx: Math.sin(a) * CANNON_V, vy: -Math.cos(a) * CANNON_V });
    const local = () => players && players[0];
    const HINT0 = typeof hintEl !== 'undefined' ? hintEl.innerHTML : '';
    function hint(p, text) { if (!p.local || typeof hintEl === 'undefined') return; hintEl.textContent = text; hintEl.style.display = 'block'; hintEl.style.opacity = 1; hintTimer = 3.5; }
    const live = p => window.partyMatch && partyMatch.live && (p.local || p.hostedBot);

    /* ------------------------------------------------------------------ flight prediction ---- */
    // Same integration as the game (gravity, side walls, swept platform landings, ceilings, finish line). Returns where a jump from p with (vx, vy) lands.
    function predict(p, vx, vy, o) {
        o = o || {};
        const g = playerG(p), pw = PLAY_W(), r = p.r, maxT = o.maxT || 3.6, SK = SUPPORT_K;
        const fin = platforms.find(pl => pl.type === 'finish');
        const near = platforms.filter(pl => pl.active && pl.type !== 'spike' && pl.type !== 'finish' && pl.y > p.y - 2800 && pl.y < p.y + 900);
        const ceils = o.pass ? [] : near.filter(pl => pl.ceiling && !pl.ceilingBroken);
        let x = p.x, y = p.y, t = 0, i = 0, apex = { x, y }; const pts = o.pts ? [] : null;
        while (t < maxT) {
            const py = y;
            vy += g * SIM_DT; if (vy > 2600) vy = 2600; x += vx * SIM_DT; y += vy * SIM_DT; t += SIM_DT; i++;
            if (x < r) { x = r; vx *= -0.45; } else if (x > pw - r) { x = pw - r; vx *= -0.45; }
            if (y < apex.y) apex = { x, y };
            if (pts) pts.push({ x, y });
            if (fin && y + r <= fin.y + fin.h / 2 && x + r > fin.x - fin.w / 2 - 40 && x - r < fin.x + fin.w / 2 + 40) return { pts, apex, land: { finish: true, x, y, t } };
            if (vy < 0) {
                for (const pl of ceils) { const bottom = pl.y + pl.h / 2; if (py - r >= bottom - 2 && y - r <= bottom && x + r > pl.x - pl.w / 2 && x - r < pl.x + pl.w / 2) return { pts, apex, land: null, blocked: pl }; }
            } else {
                for (const pl of near) {
                    const top = pl.y - pl.h / 2;
                    if (py + r <= top + 2 && y + r >= top) { const px = predictPlatX(pl, t); if (Math.abs(x - px) < pl.w / 2 + SK * r) return { pts, apex, land: { pl, x, y: top - r, t, off: x - px } }; }
                }
            }
            if (y > START_Y + 80) break;
        }
        return { pts, apex, land: null };
    }

    /* ------------------------------------------------------------------------------ CANNON ---- */
    function cannonPlan(p) {                                              // the angle whose flight lands somewhere good (high, wide, safe, middle of the platform)
        let best = null;
        for (let a = -CANNON_ANG; a <= CANNON_ANG + 1e-6; a += 0.012) {
            const v = cannonVel(a), pr = predict(p, v.vx, v.vy, { pass: true, maxT: 4.2 }), L = pr.land;
            if (!L) continue;
            let s;
            if (L.finish) s = 6000;
            else {
                const pl = L.pl; if (pl === p.plat) continue;
                s = p.y - L.y;
                if (pl.type === 'fragile') s -= 160; else if (pl.type === 'moving') s -= 130; else if (pl.type === 'ice') s -= 110; else if (pl.type === 'boost') s += 60;
                s -= Math.abs(L.off) * 2.5; s += Math.min(pl.w, 170) * 0.6;
            }
            if (!best || s > best.s) best = { a, s, L };
        }
        return best;
    }
    function deployFx(p) {
        const k = p.r / BASE_R, y = p.y + p.r;
        ring(p.x, y, ITEMS.cannon.color, 60 * k, true); burst(p.x, y, '#c9d1e3', 10, 150);
        p.squash = 0.8;
        if (p.local) { camShake = Math.max(camShake, 4); haptic([14, 20, 22]); SFX.play('cannon'); }
    }
    function cannonFire(p, a) {
        a = sc(a); const v = cannonVel(a), k = p.r / BASE_R;
        const tipX = p.x + Math.sin(a) * p.r * 2.7, tipY = p.y - Math.cos(a) * p.r * 2.7;
        p.cannon = 0; p.cannonT = 0; p.vx = v.vx; p.vy = v.vy; p.mode = 'air'; p.plat = null; p.squash = 1.5; p.cannonFly = 4; p.charged = false; p.idleT = 0;
        muzzleFx(tipX, tipY, k);
        if (p.local) { camShake = Math.max(camShake, 12); haptic([20, 20, 70]); SFX.play('cannonfire'); }
    }
    function trailFx(p, dt) {                                                // a fiery, smoky tail behind a cannon shot
        const n = Math.max(1, Math.round(dt * 120));
        for (let i = 0; i < n; i++) {
            const hot = Math.random() < 0.55;
            particles.push({ x: p.x + rnd(-5, 5), y: p.y + p.r + rnd(0, 14), vx: rnd(-40, 40), vy: rnd(80, 260), life: 1, decay: hot ? rnd(2.4, 3.6) : rnd(1.1, 1.8), color: hot ? (Math.random() < 0.5 ? '#ffcf3f' : '#ff7a3d') : 'rgba(190,198,216,0.5)', size: hot ? rnd(2.4, 4.8) : rnd(6, 12) });
        }
    }
    function muzzleFx(x, y, k) {
        burst(x, y, '#ffcf3f', 22, 420); burst(x, y, '#ff7a3d', 16, 300); burst(x, y, '#ffffff', 8, 520);
        ring(x, y, '#ffcf3f', 86 * k); ring(x, y, '#ff9f43', 54 * k);
        for (let i = 0; i < 9; i++) particles.push({ x: x + rnd(-8, 8), y: y + rnd(-8, 8), vx: rnd(-90, 90), vy: rnd(-60, 120), life: 1, decay: rnd(0.9, 1.5), color: 'rgba(196,204,222,0.55)', size: rnd(6, 13) });
    }

    /* ---------------------------------------------------------------------------- DOUBLE JUMP ---- */
    function airAim(p) { return !!p && p.djT > 0 && !p.djUsed && p.mode === 'air' && !p.ufoHold && !p.cannon && !p.finished; }
    function spawnCloud(x, y) {
        clouds.push({ x, y, t: 0, seed: Math.random() * 6 });
        for (let i = 0; i < 10; i++) particles.push({ x: x + rnd(-16, 16), y: y + rnd(-4, 8), vx: rnd(-90, 90), vy: rnd(10, 90), life: 1, decay: rnd(1.4, 2.2), color: i % 3 ? '#ffffff' : '#9fe8ff', size: rnd(1.6, 3.2) });
    }
    function airJumpVel(p, vx, vy) {                                      // the extra jump itself: your drag, a touch weaker than the first jump
        p.vx = vx; p.vy = vy; p.djUsed = true; p.squash = 1.3; p.charged = false;
        if (p.windT > 0) p.vx += p.windDir * WIND_AIM_ERR * rnd(0.5, 1);
        capUpwardVelocity(p);
        spawnCloud(p.x, p.y + p.r * 0.9);
        if (live(p) && window.Social && Social.emitDJ) Social.emitDJ(p);
        if (p.local) { haptic([10, 16, 18]); camShake = Math.max(camShake, 2); SFX.play('cloud'); }
    }
    function airJump(p, dx, dy) {
        const m = playerPowMul(p, true) * DJ_POW;
        airJumpVel(p, dx * POWER * m, dy * POWER * m);
    }
    function botRescue(p) {                                               // a bot that just missed uses its extra jump on the way down
        if (p.remote || p.local || !(p.djT > 0) || p.djUsed || p.mode !== 'air' || p.ufoHold || p.cannon) return;
        if (p.airT < 0.3 || p.vy < 120) return;
        const tgt = p.aimPl, top = tgt ? tgt.y - tgt.h / 2 - p.r : p.y;
        const pr = predict(p, p.vx, p.vy, { maxT: 2.6 });
        if (pr.land && (pr.land.finish || (pr.land.pl && pr.land.y <= top + 70 && pr.land.pl.y <= p.y + 30))) return;      // it is going to land fine
        const maxV = playerMaxV(p, true) * DJ_POW, g = playerG(p);
        let best = null;
        for (const pl of platforms) {
            if (!pl.active || pl.type === 'spike' || pl.y >= p.y - 10 || pl.y < p.y - 520) continue;
            const halfW = pl.w / 2, margin = Math.min(halfW * 0.55, p.r + 14), landY = pl.y - pl.h / 2 - p.r, tx = Math.max(pl.x - halfW + margin, Math.min(pl.x + halfW - margin, p.x));
            const sol = solveJump(tx - p.x, landY - p.y, maxV, g, 0.9); if (!sol) continue;
            let s = (p.y - pl.y) * 0.9 - Math.abs(tx - p.x) * 0.4 + Math.min(pl.w, 200) * 0.4;
            if (pl.type === 'fragile') s -= 40; else if (pl.type === 'moving') s -= 35; else if (pl.type === 'ice') s -= 50; else if (pl.type === 'boost') s += 70;
            if (!best || s > best.s) best = { s, sol, pl };
        }
        if (!best) return;
        const sk = (BOT_BASE.aimX * p.skill) * 0.7;
        p.aimPl = best.pl;
        airJumpVel(p, best.sol.vx + rnd(-1, 1) * sk, best.sol.vy + rnd(-1, 1) * BOT_BASE.aimY * p.skill * 0.7);
    }

    /* ------------------------------------------------------------------------------ the rest ---- */
    function activate(p, it) {
        const k = p.r / BASE_R;
        if (it === 'cannon') {
            if (p.chainT > 0) releaseChain(p);
            p.quakePending = 0; p.cannon = p.mode === 'idle' ? 2 : 1; p.cannonT = CANNON_TIME; p.cannonAim = 0; p.cannonThink = rnd(0.7, 1.3); p.charged = false;
            hint(p, 'DRAG TO AIM THE CANNON, RELEASE TO FIRE');
            if (p.cannon === 2) deployFx(p); else { ring(p.x, p.y, ITEMS.cannon.color, 70 * k); burst(p.x, p.y, ITEMS.cannon.color, 14, 220); if (p.local) SFX.play('cannon'); }
            return true;
        }
        if (it === 'dj') {
            p.djT = DJ_TIME; p.djUsed = false; hint(p, 'JUMP AGAIN IN MID-AIR: DRAG AND RELEASE');
            ring(p.x, p.y, ITEMS.dj.color, 64 * k); burst(p.x, p.y, ITEMS.dj.color, 14, 200);
            return true;
        }
        return false;
    }
    function tick(p, dt) {
        if (p.spring > 0) p.spring = Math.max(0, p.spring - dt * 5.5);
        if (p.cannonFly > 0 && p.remote) p.cannonFly -= dt;
        if (p.cannonFly > 0 && p.vy < -200) trailFx(p, dt);
        if (p.remote) return;
        if (p.mode === 'air') p.airT = (p.airT || 0) + dt; else { p.airT = 0; p.cannonFly = 0; }
        if (p.cannonFly > 0) p.cannonFly -= dt;
        if (p.cannon) {
            p.cannonT -= dt;
            if (p.cannon === 1 && p.mode === 'idle') { p.cannon = 2; p.cannonThink = rnd(0.7, 1.3); deployFx(p); }
            else if (p.cannon === 2 && p.mode !== 'idle') p.cannon = 1;
            if (p.cannon === 2) {
                if (p.local) { if (dragging) { const dx = sx - cx, dy = sy - cy; if (Math.hypot(dx, dy) > 14) p.cannonAim = sc(angOf(dx, dy)); } }
                else {
                    p.cannonThink -= dt;
                    if (p.cannonThink <= 0) { const pl = cannonPlan(p); cannonFire(p, (pl ? pl.a : 0) + rnd(-1, 1) * 0.01 * p.skill); }
                }
            }
            if (p.cannon && p.cannonT <= 0) {
                if (p.cannon === 2) { const pl = cannonPlan(p); cannonFire(p, pl ? pl.a : 0); }
                else { p.cannon = 0; burst(p.x, p.y, ITEMS.cannon.color, 10, 160); }                  // never landed: the cannon is lost
            }
        }
        if (p.djT > 0) { p.djT -= dt; if (p.djT <= 0) { p.djT = 0; } if (p.mode === 'idle') p.djUsed = false; else if (!p.local) botRescue(p); }
    }
    // Pointer: may this player start a drag now? Normal jumps from a platform, and the extra jump while Double Jump is ready.
    function canAim(p) { return !!p && !p.finished && (p.mode === 'idle' || airAim(p)); }
    // The drag was released. Returns true when it was handled here (cannon shot, extra jump); false means: do the normal launch.
    function onRelease(p, dx, dy) {
        if (p.cannon === 2) { cannonFire(p, angOf(dx, dy)); return true; }
        if (p.cannon === 1) return true;                                     // still falling: nothing to aim yet
        if (p.mode === 'air' && airAim(p)) { airJump(p, dx, dy); return true; }
        return false;
    }
    function slotTap(p) {                                                    // tapping the item slot while the cannon is ready fires it
        if (p && p.cannon === 2) { cannonFire(p, p.cannonAim || 0); return true; }
        return false;
    }
    // aim preview. Returns true when it drew the whole thing.
    function preview(c, lp, dx, dy) {
        const d = Math.hypot(dx, dy);
        if (lp.cannon === 1) return true;
        if (lp.cannon === 2) {
            const a = sc(angOf(dx, dy)), v = cannonVel(a), pr = predict(lp, v.vx, v.vy, { pass: true, pts: true, maxT: 4.2 });
            dots(c, pr.pts, ITEMS.cannon.color, 0.9); landMark(c, pr.land, ITEMS.cannon.color);
            return true;
        }
        return false;
    }
    function dots(c, pts, col, a0) {                                         // an evenly dotted arc (dot spacing follows the path, not the speed), fading out
        if (!pts || pts.length < 2) return;
        c.save(); c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = col; c.lineWidth = 4.2; c.setLineDash([0.1, 11]);
        const n = pts.length, parts = 5;
        for (let k = 0; k < parts; k++) {
            const i0 = Math.floor(n * k / parts), i1 = Math.min(n, Math.floor(n * (k + 1) / parts) + 1);
            c.globalAlpha = Math.max(0.2, a0 - k * 0.17); c.beginPath();
            for (let i = i0; i < i1; i++) i === i0 ? c.moveTo(pts[i].x, pts[i].y) : c.lineTo(pts[i].x, pts[i].y);
            c.stroke();
        }
        c.restore();
    }
    function landMark(c, L, col) {                                           // where it will land: a ring on the platform, or (off the top of the screen) an arrow with the progress it gains
        if (!L || L.finish) return;
        const pl = L.pl, t = performance.now() / 1000, y = pl.y - pl.h / 2, lp = local();
        c.save(); c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 2.6;
        if (y < cameraY + 34) {
            const gain = Math.max(0, Math.round((lp.y - L.y) / TRACK * 100)), ax = Math.max(24, Math.min(PLAY_W() - 24, L.x)), ay = cameraY + 50 + 3 * Math.sin(t * 8);
            c.globalAlpha = 0.9; c.beginPath(); c.moveTo(ax, ay - 12); c.lineTo(ax + 10, ay + 2); c.lineTo(ax + 3.5, ay + 2); c.lineTo(ax + 3.5, ay + 14); c.lineTo(ax - 3.5, ay + 14); c.lineTo(ax - 3.5, ay + 2); c.lineTo(ax - 10, ay + 2); c.closePath(); c.fill();
            c.font = '800 12px Space Grotesk'; c.textAlign = 'center'; c.fillStyle = '#0d1017'; c.globalAlpha = 1;
            c.strokeStyle = '#0d1017'; c.lineWidth = 3; c.strokeText('+' + gain + '%', ax, ay + 30); c.fillStyle = col; c.fillText('+' + gain + '%', ax, ay + 30);
        } else {
            c.globalAlpha = 0.55 + 0.3 * Math.sin(t * 8);
            c.beginPath(); c.ellipse(L.x, y, 17, 5.5, 0, 0, 7); c.stroke();
            c.globalAlpha = 0.18; c.beginPath(); c.ellipse(L.x, y, 17, 5.5, 0, 0, 7); c.fill();
        }
        c.restore();
    }
    function reset() { clouds.length = 0; if (typeof hintEl !== 'undefined' && HINT0) hintEl.innerHTML = HINT0; }
    function update(dt) {
        for (let i = clouds.length - 1; i >= 0; i--) { clouds[i].t += dt; if (clouds[i].t > 0.85) clouds.splice(i, 1); }
    }

    /* --------------------------------------------------------------------------------- drawing ---- */
    function mix(h, to, t) {
        const n = parseInt((h || '#35e0c8').replace('#', ''), 16), r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255, T = to === 'w' ? 255 : 0;
        return 'rgb(' + Math.round(r + (T - r) * t) + ',' + Math.round(g + (T - g) * t) + ',' + Math.round(b + (T - b) * t) + ')';
    }
    function puff(c, x, y, r, a) {
        const g = c.createRadialGradient(x - r * 0.25, y - r * 0.3, r * 0.1, x, y, r);
        g.addColorStop(0, 'rgba(255,255,255,' + a + ')'); g.addColorStop(0.7, 'rgba(236,246,255,' + a * 0.95 + ')'); g.addColorStop(1, 'rgba(176,205,232,' + a * 0.9 + ')');
        c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
    }
    function drawCloud(c, cl) {
        const k = Math.min(1, cl.t / 0.85), e = 1 - Math.pow(1 - k, 3), a = Math.max(0, 1 - Math.pow(k, 2.2));
        const sp = [[-19, 2, 9], [-9, -3, 12], [3, -5, 13], [15, -2, 11], [22, 3, 8], [-2, 4, 11]];
        c.save(); c.translate(cl.x, cl.y + 8 * e); c.scale(0.7 + 0.55 * e, 0.62 + 0.4 * e);
        for (const s of sp) puff(c, s[0] * (0.7 + 0.5 * e), s[1], s[2] * (0.75 + 0.35 * e), a);
        c.restore();
    }
    function drawWorld(c) {
        for (const cl of clouds) drawCloud(c, cl);
    }
    // under the player's feet (called before the body is drawn)
    function drawSpring(c, p, t) {
        if (!(p.bounceT > 0) || p.finished) return;
        const k = p.r / BASE_R, comp = p.spring || 0, ext = 1 - comp;
        const len = (13 + 20 * ext) * k, top = p.y + p.r * 0.7, bot = top + len, w = (8.5 + 2.5 * comp) * k;
        const sway = p.mode === 'air' ? Math.sin(t * 14 + p.id) * 1.6 * ext * k : 0;
        const col = ITEMS.bounce.color, turns = 5;
        c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
        c.fillStyle = 'rgba(0,0,0,0.22)'; c.beginPath(); c.ellipse(p.x, bot + 2 * k, w + 5 * k, 2.6 * k, 0, 0, 7); c.fill();
        c.beginPath();
        for (let i = 0; i <= turns * 2; i++) { const f = i / (turns * 2), x = p.x + (i === 0 || i === turns * 2 ? 0 : (i % 2 ? -w : w)) + sway * f, y = top + len * f; i ? c.lineTo(x, y) : c.moveTo(x, y); }
        c.strokeStyle = '#0d1017'; c.lineWidth = 5.6 * k; c.stroke();
        c.strokeStyle = '#cfd8e8'; c.lineWidth = 3.4 * k; c.stroke();
        c.strokeStyle = col; c.lineWidth = 1.5 * k; c.globalAlpha = 0.9; c.stroke(); c.globalAlpha = 1;
        c.fillStyle = '#0d1017'; roundRect(p.x - w - 4 * k + sway, bot - 1.5 * k, (w + 4 * k) * 2, 5.2 * k, 2.4 * k); c.fill();
        c.fillStyle = col; roundRect(p.x - w - 2.6 * k + sway, bot - 0.6 * k, (w + 2.6 * k) * 2, 3 * k, 1.6 * k); c.fill();
        c.restore();
    }
    function drawCannon(c, p, t) {
        const s = p.r * 1.3, k = s / BASE_R, col = p.color || '#35e0c8', ready = p.cannon === 2;
        const a = ready ? (p.cannonAim || 0) : Math.sin(t * 3 + (p.id || 0)) * 0.06;
        c.save(); c.translate(0, -p.r * 0.3); c.lineJoin = 'round'; c.lineCap = 'round';
        // wheels: big, on both sides, so the carriage reads as a cannon at a glance
        for (const sd of [-1, 1]) {
            c.save(); c.translate(sd * s * 1.12, s * 0.5);
            c.fillStyle = '#2a2f40'; c.strokeStyle = '#0d1017'; c.lineWidth = 2.2 * k; c.beginPath(); c.arc(0, 0, s * 0.62, 0, 7); c.fill(); c.stroke();
            c.strokeStyle = '#b9c3d8'; c.lineWidth = 1.6 * k; c.beginPath(); c.arc(0, 0, s * 0.5, 0, 7); c.stroke();
            c.strokeStyle = 'rgba(185,195,216,0.7)'; c.lineWidth = 1.5 * k;
            for (let i = 0; i < 4; i++) { const an = i * Math.PI / 4 + (p.x + p.y) * 0.025; c.beginPath(); c.moveTo(Math.cos(an) * s * 0.5, Math.sin(an) * s * 0.5); c.lineTo(-Math.cos(an) * s * 0.5, -Math.sin(an) * s * 0.5); c.stroke(); }
            c.fillStyle = col; c.beginPath(); c.arc(0, 0, s * 0.16, 0, 7); c.fill(); c.strokeStyle = '#0d1017'; c.lineWidth = 1.4 * k; c.stroke();
            c.restore();
        }
        // carriage: a dark base plate with a coloured edge
        const cg = c.createLinearGradient(0, s * 0.1, 0, s * 1.05); cg.addColorStop(0, '#4b5575'); cg.addColorStop(1, '#1c2234');
        c.fillStyle = cg; roundRect(-s * 1.15, s * 0.22, s * 2.3, s * 0.8, 6 * k); c.fill();
        c.strokeStyle = '#0d1017'; c.lineWidth = 2.2 * k; roundRect(-s * 1.15, s * 0.22, s * 2.3, s * 0.8, 6 * k); c.stroke();
        c.strokeStyle = col; c.lineWidth = 2.2 * k; c.beginPath(); c.moveTo(-s * 0.95, s * 0.86); c.lineTo(s * 0.95, s * 0.86); c.stroke();
        // barrel: a straight steel tube with a coloured band and a flared lip at the muzzle
        c.save(); c.translate(0, s * 0.3); c.rotate(a);
        const L = s * 2.6, w = s * 0.86;
        const bg = c.createLinearGradient(-w, 0, w, 0); bg.addColorStop(0, '#1f2638'); bg.addColorStop(0.3, '#7381a6'); bg.addColorStop(0.55, '#4e5a7d'); bg.addColorStop(1, '#171d2d');
        c.fillStyle = bg; c.beginPath(); c.moveTo(-w, s * 0.1); c.lineTo(-w, -L); c.lineTo(w, -L); c.lineTo(w, s * 0.1); c.quadraticCurveTo(0, s * 0.5, -w, s * 0.1); c.closePath(); c.fill();
        c.strokeStyle = '#0d1017'; c.lineWidth = 2.3 * k; c.stroke();
        c.fillStyle = col; for (const f of [0.28, 0.66]) { c.fillRect(-w - 0.6 * k, -L * f - 2.2 * k, w * 2 + 1.2 * k, 4.4 * k); }
        c.strokeStyle = '#0d1017'; c.lineWidth = 1.4 * k; for (const f of [0.28, 0.66]) { c.strokeRect(-w - 0.6 * k, -L * f - 2.2 * k, w * 2 + 1.2 * k, 4.4 * k); }
        c.strokeStyle = 'rgba(255,255,255,0.4)'; c.lineWidth = 1.8 * k; c.beginPath(); c.moveTo(-w * 0.5, -s * 0.1); c.lineTo(-w * 0.5, -L * 0.94); c.stroke();
        // the lip
        c.fillStyle = col; roundRect(-w - 3.4 * k, -L - 5 * k, (w + 3.4 * k) * 2, 9 * k, 3.5 * k); c.fill();
        c.strokeStyle = '#0d1017'; c.lineWidth = 2 * k; roundRect(-w - 3.4 * k, -L - 5 * k, (w + 3.4 * k) * 2, 9 * k, 3.5 * k); c.stroke();
        c.fillStyle = '#0d1017'; c.beginPath(); c.ellipse(0, -L - 0.5 * k, w * 0.86, 2.5 * k, 0, 0, 7); c.fill();
        if (ready) { c.globalAlpha = 0.55 + 0.4 * Math.sin(t * 9); c.fillStyle = ITEMS.cannon.color; c.beginPath(); c.ellipse(0, -L - 0.5 * k, w * 0.62, 1.7 * k, 0, 0, 7); c.fill(); c.globalAlpha = 1; }
        // your eyes
        c.fillStyle = '#e8eefc'; const ey = -L * 0.47; c.beginPath(); c.arc(-4.4 * k, ey, 3 * k, 0, 7); c.arc(4.4 * k, ey, 3 * k, 0, 7); c.fill();
        c.fillStyle = '#0d1017'; c.beginPath(); c.arc(-4.4 * k, ey + 0.4 * k, 1.6 * k, 0, 7); c.arc(4.4 * k, ey + 0.4 * k, 1.6 * k, 0, 7); c.fill();
        c.restore();
        c.restore();
    }
    // a small cloud under your feet while an extra jump is ready (everyone can see who still has one)
    function drawReady(c, p, t) {
        const k = p.r / BASE_R, y = p.y + p.r + 9 * k, a = 0.5 + 0.2 * Math.sin(t * 6 + p.id);
        c.save(); c.translate(p.x, y); c.scale(0.55 * k, 0.5 * k);
        for (const s of [[-12, 1, 7], [-3, -3, 9], [8, -1, 8], [15, 2, 5.5]]) puff(c, s[0], s[1], s[2], a);
        c.restore();
    }
    // returns true when the cube should NOT be drawn (a cannon stands there instead)
    function drawBody(c, p, t) { if (p.cannon > 0) { drawCannon(c, p, t); return true; } return false; }
    function drawOver(c, p, t) {                                          // after the player: auras, timer ring of the cannon
        if (p.cannon > 0) {
            const py = p.y - p.r * 4.4, f = Math.max(0, p.cannonT / CANNON_TIME);
            c.save(); c.lineWidth = 2.4; c.strokeStyle = 'rgba(255,255,255,0.18)'; c.beginPath(); c.arc(p.x, py, 6, 0, 7); c.stroke();
            c.strokeStyle = ITEMS.cannon.color; c.shadowBlur = 8; c.shadowColor = ITEMS.cannon.color; c.beginPath(); c.arc(p.x, py, 6, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); c.stroke(); c.restore();
        }
    }
    function drawUnder(c, p, t) { drawSpring(c, p, t); if (p.djT > 0 && !p.djUsed && p.mode === 'air' && !p.finished) drawReady(c, p, t); }

    /* ------------------------------------------------------------------------------ item slot ---- */
    function hud(p) {
        if (p.cannon > 0) return { icon: 'cannon', badge: p.cannon === 2 ? 'GO' : '', prog: p.cannonT / CANNON_TIME, col: ITEMS.cannon.color };
        if (p.djT > 0) return { icon: 'dj', badge: p.djUsed ? '0x' : '1x', prog: p.djT / DJ_TIME, col: ITEMS.dj.color };
        return null;
    }

    /* -------------------------------------------------------------------------- party sync ---- */
    const r1 = n => Math.round(n * 10) / 10;
    function sample(p) { return { cn: p.cannon || (p.cannonFly > 0 ? 3 : 0), ca: Math.round((p.cannonAim || 0) * 100) / 100, dj: r1(Math.max(0, p.djT || 0)), du: p.djUsed ? 1 : 0 }; }
    function parse(v) { return { cn: v.cn || 0, ca: v.ca || 0, dj: v.dj || 0, du: v.du || 0 }; }
    function apply(p, b, prevVy, vy) {                                     // a friend's phone says how their power-ups look right now
        const was = p.cannon || 0;
        const cn = b.cn || 0; p.cannon = cn === 3 ? 0 : cn; p.cannonAim = b.ca || 0; p.cannonT = p.cannon ? CANNON_TIME * 0.5 : 0; if (cn === 3) p.cannonFly = 0.4;
        p.djT = b.dj || 0; p.djUsed = !!b.du;
        if (was === 2 && !p.cannon) muzzleFx(p.x + Math.sin(p.cannonAim || 0) * p.r * 2.7, p.y - Math.cos(p.cannonAim || 0) * p.r * 2.7, p.r / BASE_R);
        if (p.bounceT > 0 && prevVy > 150 && vy < -150) p.spring = 1;       // a rebound: the spring squashes
    }

    window.PU = { activate, tick, update, reset, canAim, airAim, onRelease, slotTap, preview, drawWorld, drawUnder, drawBody, drawOver, hud, sample, parse, apply, cloud: spawnCloud, predict, cannonPlan, cannonFire, CANNON_TIME, DJ_TIME };
})();
