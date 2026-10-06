// BOOM TAG: pass the bomb. Four players on one screen, one bomb with a shared fuse. Crash into someone to hand it over, never be
// the one holding it when it blows. Last one standing wins. Quick rounds, nowhere to hide, and the fuse gets shorter as the field thins.
//
//   Flow:  ready (GO) -> live (fuse burns, bomb changes hands) -> boom (the holder explodes) -> next (survivors are re-spread) -> ... -> over
//   Physics, platforms, jumping and the aim preview are the real game; this file adds the arena, the bomb rules, bot AI that hunts and flees,
//   pickups (shield / leap / zap), the HUD and the results. Loaded AFTER game.js. See docs/BOOMTAG.md.
(function () {
    'use strict';
    const $ = id => document.getElementById(id);
    const FUSE = { 4:16, 3:13, 2:10 };                // seconds on the fuse by players left
    const IMMUNE = 1.3, COOLDOWN = 0.35, STUN = 2, SHIELD = 5;
    const TIPKEY = 'rr_tag_seen';
    const PICKS = {
        shield: { col:'#5eb4ff', label:'SHIELD' },
        leap:   { col:'#ffcf3f', label:'LEAP' },
        zap:    { col:'#b3a9ff', label:'ZAP' },
    };
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const lsNum = k => { try { return +localStorage.getItem(k) || 0; } catch (e) { return 0; } };
    const lsSet = (k, v) => { try { localStorage.setItem(k, String(v)); } catch (e) {} if (window.Cloud) Cloud.touch(); };
    let tg = null;

    /* ------------------------------------------------------------------------ arena ---- */
    function mk(x, y, w, type, extra) {
        return Object.assign({ x, y, w, h:18, type, speed:0, dir:1, active:true, breaking:false, breakT:0, respawn:0, baseX:x, range:0, boostReady:true, quakeWarn:0, quakeDown:0 }, extra || {});
    }
    function buildArena() {
        const pw = PLAY_W();
        platforms = []; itemBoxes = []; finishPlatform = null; ufos = []; shots = [];
        platforms.push({ x:pw / 2, y:START_Y, w:pw, h:40, type:'normal', active:true, ground:true, quakeWarn:0, quakeDown:0 });
        const room = VH - 90 - 262;
        const tiers = clamp(Math.round(room / 150), 2, 5), gap = Math.min(172, room / tiers);
        let fragile = 0, boost = 0, lastPat = -1;
        for (let k = 1; k <= tiers; k++) {
            const y = START_Y - gap * k;
            let pat; do { pat = Math.floor(Math.random() * 3); } while (pat === lastPat && Math.random() < 0.8); lastPat = pat;
            const xs = pat === 0 ? [0.25 + rnd(-0.04, 0.04), 0.75 + rnd(-0.04, 0.04)]
                     : pat === 1 ? [0.5 + rnd(-0.1, 0.1)]
                     : [0.17 + rnd(-0.02, 0.03), 0.5 + rnd(-0.04, 0.04), 0.83 - rnd(-0.03, 0.02)];
            const w = pat === 0 ? 112 : pat === 1 ? 168 : 78;
            for (const fx of xs) {
                let type = 'normal'; const r = Math.random();
                if (r < 0.14) type = 'moving'; else if (r < 0.22) type = 'ice'; else if (r < 0.28 && fragile < 1) { type = 'fragile'; fragile++; } else if (r < 0.36 && boost < 1) { type = 'boost'; boost++; }
                const x = fx * pw;
                platforms.push(mk(x, y + rnd(-6, 6), w, type, type === 'moving' ? { speed:46, range:54, dir:Math.random() < 0.5 ? -1 : 1 } : null));
            }
        }
    }
    const standPoint = pl => ({ x:pl.x, y:pl.y - pl.h / 2 - 12 });
    function place(p, pl, dx) {
        p.plat = pl; p.mode = 'idle'; p.vx = 0; p.vy = 0;
        p.x = clamp(pl.x + (dx || 0), p.r, PLAY_W() - p.r); p.y = pl.y - pl.h / 2 - p.r;
    }
    // spread the survivors over the platforms as far apart as possible (greedy farthest point)
    function spread(list) {
        const spots = shuffle(platforms.filter(pl => pl.active && pl.type !== 'fragile')); const used = [];
        for (const p of shuffle(list.slice())) {
            let best = null, bd = -1;
            for (const pl of spots) {
                let d = 1e9; for (const u of used) d = Math.min(d, Math.hypot(u.x - pl.x, (u.y - pl.y) * 0.8));
                if (!used.length) d = Math.random() * 100;
                if (used.some(u => u === pl)) continue;
                if (d > bd) { bd = d; best = pl; }
            }
            if (!best) best = platforms[0];
            used.push(best); place(p, best, best.ground ? rnd(-90, 90) : 0);
            burst(p.x, p.y, '#ffffff', 10, 160); ring(p.x, p.y, p.color, 40);
        }
    }

    /* ------------------------------------------------------------------------ start / leave ---- */
    function open() {
        let seen = false; try { seen = localStorage.getItem(TIPKEY) === '1'; } catch (e) {}
        if (seen) { start(); return; }
        const root = ensureRoot(), tip = $('tg-tip'); tip.classList.add('vis'); root.classList.add('tipping');
        $('tg-tip-go').onclick = () => { try { localStorage.setItem(TIPKEY, '1'); } catch (e) {} tip.classList.remove('vis'); root.classList.remove('tipping'); start(); };
        $('tg-tip-x').onclick = () => { tip.classList.remove('vis'); root.classList.remove('tipping'); };
    }
    function start() {
        ensureRoot();
        hideResult(); $('tg-root').classList.remove('over'); { const u = $('tg-hud').querySelector('.tg-bomb use'); if (u) u.setAttribute('href', '#ico-mode-tag'); const cp = $('tg-cap'); if (cp) cp.style.display = 'none'; } $('tg-banner').className = 'tg-banner';
        gameMode = 'tag'; esc = null; pk = null; lv = null; ufos = []; window.rankedMatch = false; window.partyMatch = null;
        document.body.classList.remove('mode-escape', 'mode-parkour', 'mode-level', 'mode-gauntlet'); document.body.classList.add('mode-tag');
        showScreen('');
        WORLD_W = 356; resize();
        buildArena();
        matchHumanSlot = 0; matchBotNames = [];
        initPlayers();
        if (window.BotRoster) BotRoster.applyTo(players.slice(1), BotRoster.pick(3, { mmr:(window.Trophies ? Trophies.matchMmr() : 1100), spread:180 }));
        const party = (window.Party && Party.active && Party.active()) ? Party.standIns() : [];
        party.forEach((m, k) => { const b = players[k + 1]; if (b) { b.name = m.name; b.look = Object.assign({ skin:'classic', hat:'none', face:'none', trail:'none' }, m.look || {}); b.color = skinById(b.look.skin).color; } });
        for (const p of players) { p.noAI = true; p.out = false; p.bomb = false; p.tagImmune = 0; p.canPass = 0; p.stunT = 0; p.passes = 0; p.thinkT = rnd(0.5, 1.1); p.gone = false; p._off = false; }
        tg = { phase:'ready', t:0, round:0, fuse:0, fuseMax:1, carrier:null, order:[], pops:[], picks:[], pickT:5, pt:0, lootId:newLootId('tag'), local:players[0], passes:0, rewarded:false,
               overT:0, tickAt:99, sparkT:0, localOutShown:false, skipping:false };
        window.TG_BG = '#10131b';
        spread(players);
        hud.style.display = 'block'; $('tg-root').classList.add('playing');
        beginRound();
        cameraY = START_Y - (VH - 92); prevCam = cameraY;
        hudBuild(true);
    }
    function leave(toMenu) {
        if (!tg && gameMode !== 'tag') return;
        const root = $('tg-root'); if (root) { root.classList.remove('playing', 'tipping', 'over'); hideResult(); }
        tg = null; window.TG_BG = null;
        document.body.classList.remove('mode-tag');
        gameMode = 'race'; state = 'menu'; dragging = false; hud.style.display = 'none';
        for (const p of players) { p.noAI = false; p.out = false; p.bomb = false; p.finished = false; p._off = false; p.gone = false; p.stunT = 0; }
        try { stopSpectate(); } catch (e) {}
        if (toMenu) { if (window.Arcade) Arcade.endSession(); refreshStartMeta(); showScreen('start'); }
    }
    function restart() { leave(false); setTimeout(start, 30); }

    /* ------------------------------------------------------------------------ rounds ---- */
    const alive = () => players.filter(p => !p.out);
    const carrierOf = () => players.find(p => p.bomb && !p.out) || null;
    function startRound() {
        const list = alive();
        tg.round++;
        const n = list.length; tg.fuseMax = tg.fuse = FUSE[n] || 10;
        tg.phase = 'live'; tg.tickAt = 99; tg.freezeT = 0;
        for (const p of players) { p.bomb = false; p.tagImmune = 0; p.canPass = 0; p.stunT = 0; }
        const c = list[Math.floor(Math.random() * list.length)];
        c.bomb = true; c.canPass = 0.9; tg.carrier = c;
        pop(c.x, c.y - 44, 'BOMB!', '#ff7a3d', true);
        SFX.play('count'); burst(c.x, c.y, '#ff7a3d', 20, 260); ring(c.x, c.y, '#ff7a3d', 70);
        banner(tg.round === 1 ? 'PASS THE BOMB' : n === 2 ? 'FINAL DUEL' : 'ROUND ' + tg.round, '#ffb347', 1.3);
        hudBuild(true);
    }
    function pass(c, q) {
        c.bomb = false; q.bomb = true; tg.carrier = q;
        c.tagImmune = IMMUNE; q.canPass = COOLDOWN; q.stunT = 0;
        c.passes++; if (c.local) { tg.passes++; if (window.Missions) Missions.event('tagpass', 1); }
        const mx = (c.x + q.x) / 2, my = (c.y + q.y) / 2;
        burst(mx, my, '#ff9838', 24, 320); burst(mx, my, '#ffffff', 10, 220); ring(mx, my, '#ff7a3d', 80);
        pop(q.x, q.y - 46, q.local ? 'YOU HAVE IT!' : 'TAGGED!', q.local ? '#ff5470' : '#ffcf3f', true);
        SFX.play('knock', 2);
        if (c.local || q.local) { camShake = Math.max(camShake, 8); haptic(q.local ? [40, 30, 70] : 25); }
        // the hit shoves them apart a little so a pass is clearly visible
        const s = q.x >= c.x ? 1 : -1; q.vx += s * 140; c.vx -= s * 140;
        hudBuild(false);
    }
    function explode(c) {
        const left = alive().length;
        c.out = true; c.finished = true; c._off = true; c.bomb = false; c.place = left; c.round = tg.round; tg.order.push(c);
        for (const q of alive()) { const dx = q.x - c.x, dy = q.y - c.y, d = Math.hypot(dx, dy); if (d < 150) { q.mode = 'air'; q.plat = null; q.vx += (dx >= 0 ? 1 : -1) * (180 - d); q.vy = Math.min(q.vy, -420 + d); } }
        burst(c.x, c.y, '#ff9838', 60, 560); burst(c.x, c.y, '#ffe27a', 36, 420); burst(c.x, c.y, '#ff4d3d', 30, 300);
        ring(c.x, c.y, '#ffd25a', 190); ring(c.x, c.y, '#ff5a2a', 120);
        pop(c.x, c.y - 30, 'BOOM!', '#ff5a2a', true);
        SFX.play('boom'); camShake = Math.max(camShake, c.local ? 22 : 12); haptic(c.local ? [60, 40, 120] : 30);
        tg.hit = 0.18; tg.carrier = null;
        tg.phase = 'boom'; tg.pt = c.local ? 1.5 : 1.2;
        if (c.local) { banner('YOU BLEW UP', '#ff5470', 1.8); tg.localOutShown = true; $('tg-skip').classList.add('vis'); }
        hudBuild(true);
    }
    function afterBoom() {
        const list = alive();
        if (list.length <= 1) { finish(list[0] || null); return; }
        tg.phase = 'next'; tg.pt = 1.6;
        spread(list);
        for (const p of list) { p.mode = 'idle'; p.vx = 0; }
        banner(list.length === 2 ? 'FINAL DUEL' : list.length + ' LEFT', '#ffffff', 1.4);
    }
    function finish(winner) {
        tg.phase = 'over'; tg.overT = 1.1; tg.winner = winner;
        if (winner) { winner.place = 1; winner.round = tg.round; tg.order.push(winner); }
        $('tg-skip').classList.remove('vis');
        if (winner) { pop(winner.x, winner.y - 40, winner.local ? 'LAST ONE STANDING!' : 'WINNER', '#ffcf3f', true); burst(winner.x, winner.y, '#ffcf3f', 50, 420); ring(winner.x, winner.y, '#ffcf3f', 140); SFX.play('finish'); if (winner.local) haptic([30, 40, 30, 40, 80]); }
        banner(winner && winner.local ? 'YOU WIN' : 'MATCH OVER', winner && winner.local ? '#ffcf3f' : '#ffffff', 2);
        // rewards (once)
        if (!tg.rewarded) {
            tg.rewarded = true;
            const me = tg.local, pl = me.place || 4;
            const rw = rewardRace(pl, true, tg.lootId);
            let streak = lsNum('rr_tag_streak'); const wins = lsNum('rr_tag_wins');
            if (pl === 1) { streak++; lsSet('rr_tag_wins', wins + 1); if (streak > lsNum('rr_tag_best')) lsSet('rr_tag_best', streak); } else streak = 0;
            lsSet('rr_tag_streak', streak);
            let bonus = 0; if (pl === 1 && streak > 1) { bonus = 20 * Math.min(streak - 1, 5); addCoins(bonus); }
            tg.result = { place:pl, rw, streak, bonus };
            if (window.Missions) { Missions.event('tagplay', 1); if (pl === 1) Missions.event('tagwin', 1); }
            refreshMenu();
        }
    }

    /* ------------------------------------------------------------------------ pickups ---- */
    function spawnPick() {
        if (tg.picks.length >= 2) return;
        const types = Object.keys(PICKS), cands = platforms.filter(pl => pl.active && !pl.ground && pl.type !== 'fragile' && !tg.picks.some(k => k.pl === pl));
        if (!cands.length) return;
        const pl = cands[Math.floor(Math.random() * cands.length)], type = types[Math.floor(Math.random() * types.length)];
        tg.picks.push({ pl, off:rnd(-pl.w * 0.25, pl.w * 0.25), type, age:0 });
    }
    const pickPos = k => ({ x:k.pl.x + k.off, y:k.pl.y - k.pl.h / 2 - 14 });
    function takePick(p, k) {
        const P = PICKS[k.type];
        tg.picks.splice(tg.picks.indexOf(k), 1);
        const pos = pickPos(k); burst(pos.x, pos.y, P.col, 18, 260); ring(pos.x, pos.y, P.col, 60);
        SFX.play(k.type === 'shield' ? 'shield' : k.type === 'zap' ? 'chain' : 'boost');
        if (k.type === 'shield') { p.shieldT = SHIELD; pop(p.x, p.y - 38, 'SHIELD', P.col); }
        else if (k.type === 'leap') { p.charged = true; pop(p.x, p.y - 38, 'LEAP', P.col); }
        else {
            const c = tg.carrier; let target = null;
            if (p.bomb) { let bd = 1e9; for (const q of alive()) if (q !== p && !(q.shieldT > 0)) { const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < bd) { bd = d; target = q; } } }
            else if (c && c !== p) target = c;
            pop(p.x, p.y - 38, 'ZAP', P.col);
            if (target) { target.stunT = STUN; target.vx = 0; ring(target.x, target.y, P.col, 70); burst(target.x, target.y, P.col, 20, 280); pop(target.x, target.y - 38, 'STUNNED', P.col); }
        }
        if (p.local) haptic(18);
    }

    /* ------------------------------------------------------------------------ bot brain ---- */
    function solveHit(p, tx, ty, maxV) {                // the quickest arc from p through the point (tx, ty)
        const g = playerG(p);
        for (let t = 0.2; t <= 1.15; t += 0.02) {
            const vx = (tx - p.x) / t, vy = (ty - p.y - 0.5 * g * t * t - 0.5 * g * SIM_DT * t) / t;
            if (Math.hypot(vx, vy) <= maxV) return { vx, vy, t };
        }
        return null;
    }
    function fire(p, vx, vy) {
        const mult = playerPowMul(p, false) || 1;
        let dx = vx / (POWER * mult), dy = vy / (POWER * mult); const d = Math.hypot(dx, dy);
        if (d > MAX_DRAG) { dx = dx / d * MAX_DRAG; dy = dy / d * MAX_DRAG; }
        launchPlayer(p, dx, dy);
    }
    function reachList(p, spots) {                        // every platform p can land on from where it stands, with the arc to get there
        const out = [], maxV = playerMaxV(p, false) * 0.96, g = playerG(p);
        for (const pl of platforms) {
            if (!pl.active || pl === p.plat) continue;
            const px = predictPlatX(pl, 0.7), half = Math.max(6, pl.w / 2 - 14);
            for (const f of [-1, 0, 1]) {
                const lx = clamp(px + f * half, p.r + 6, PLAY_W() - p.r - 6), ly = pl.y - pl.h / 2 - p.r;
                const sol = solveJump(lx - p.x, ly - p.y, maxV, g, 0.9);
                if (sol) out.push({ pl, lx, ly, sol });
            }
        }
        return out;
    }
    function think(p, dt) {
        if (p.mode !== 'idle' || !p.plat || p.stunT > 0 || p.finished) return;
        p.thinkT -= dt; if (p.thinkT > 0) return;
        const skill = clamp(p.skill || 1, 0.7, 1.25), car = tg.carrier;
        const err = 0.022 + (1.2 - skill) * 0.08;
        if (p.bomb) {                                          // HUNT
            if (p.charge) return;
            p.thinkT = rnd(0.3, 0.6) / skill;
            if (p.canPass > 0.2) { p.thinkT = 0.2; return; }
            let tgt = null, bs = 1e9;
            for (const q of alive()) { if (q === p || q.tagImmune > 0 || q.shieldT > 0) continue; const d = Math.hypot(q.x - p.x, q.y - p.y) + (q.mode === 'air' ? 120 : 0); if (d < bs) { bs = d; tgt = q; } }
            if (!tgt) { p.thinkT = 0.3; return; }
            const maxV = playerMaxV(p, false) * 0.97;
            const sol = solveHit(p, tgt.x + tgt.vx * 0.05, tgt.y, maxV);
            if (sol && Math.random() < 0.9) {                   // wind-up first: a crouch and a dotted line everyone can see (and dodge)
                p.charge = { tgt, t:rnd(0.5, 0.62), err };
                if (!tgt.local && tgt.mode === 'idle') tgt.thinkT = Math.min(tgt.thinkT, rnd(0.12, 0.3) / clamp(tgt.skill || 1, 0.7, 1.25));
                return;
            }
            // too far: hop to the platform that brings us closest
            const here = Math.hypot(tgt.x - p.x, tgt.y - p.y); let best = null, bc = here - 30;
            for (const r of reachList(p)) { const d = Math.hypot(tgt.x - r.lx, tgt.y - r.ly) + r.sol.t * 20; if (d < bc) { bc = d; best = r; } }
            if (best) fire(p, best.sol.vx * (1 + rnd(-err, err)), best.sol.vy * (1 + rnd(-err, err)));
            else if (sol) fire(p, sol.vx, sol.vy);
            return;
        }
        // RUN
        p.thinkT = rnd(0.35, 0.8) / skill;
        if (!car) return;
        const d = Math.hypot(car.x - p.x, car.y - p.y);
        const danger = d < 270 || (car.mode === 'air' && d < 380);
        if (!danger) {
            if (Math.random() < 0.35 && tg.picks.length) {      // grab a power-up while it is quiet
                const k = tg.picks[Math.floor(Math.random() * tg.picks.length)], pos = pickPos(k);
                let best = null, bd = 1e9; for (const r of reachList(p)) { if (r.pl !== k.pl) continue; const dd = Math.abs(r.lx - pos.x); if (dd < bd) { bd = dd; best = r; } }
                if (best && Math.hypot(car.x - best.lx, car.y - best.ly) > 180) fire(p, best.sol.vx, best.sol.vy);
            } else if (Math.random() < 0.08) {
                const rs = reachList(p); if (rs.length) { const r = rs[Math.floor(Math.random() * rs.length)]; if (Math.hypot(car.x - r.lx, car.y - r.ly) > 220) fire(p, r.sol.vx, r.sol.vy); }
            }
            return;
        }
        if (Math.random() < (1.2 - skill) * 0.3) return;        // a late reaction
        let best = null, bs = -1e9;
        for (const r of reachList(p)) {
            let s = Math.min(Math.hypot(car.x - r.lx, (car.y - r.ly) * 0.85), 360) - r.sol.t * 40;
            if (r.pl.type === 'fragile') s -= 70; else if (r.pl.type === 'ice') s -= 18; else if (r.pl.type === 'moving') s -= 8;
            if (r.lx < 40 || r.lx > PLAY_W() - 40) s -= 14;
            for (const k of tg.picks) if (k.pl === r.pl) s += 36;
            s += rnd(-12, 12) * (1.25 - skill);
            if (s > bs) { bs = s; best = r; }
        }
        if (best && bs > Math.min(d, 360) - 10 + 14) fire(p, best.sol.vx * (1 + rnd(-err, err)), best.sol.vy * (1 + rnd(-err, err)));
    }

    /* ------------------------------------------------------------------------ per-frame ---- */
    function update(dt) {
        if (!tg) return;
        tg.t += dt;
        if (tg.hit > 0) tg.hit -= dt;
        for (let i = tg.pops.length - 1; i >= 0; i--) { tg.pops[i].t += dt; if (tg.pops[i].t > tg.pops[i].life) tg.pops.splice(i, 1); }
        for (const p of players) {                              // a bot that is winding up a shot
            const ch = p.charge; if (!ch) continue;
            if (p.out || !p.bomb || p.mode !== 'idle' || p.stunT > 0 || ch.tgt.out || ch.tgt.tagImmune > 0 || ch.tgt.shieldT > 0 || tg.phase !== 'live') { p.charge = null; continue; }
            ch.t -= dt; p.squash = Math.min(p.squash, 0.8 + 0.06 * Math.sin(tg.t * 42));
            ch.sol = solveHit(p, ch.tgt.x, ch.tgt.y, playerMaxV(p, false) * 0.97);
            if (!ch.sol) { p.charge = null; continue; }
            if (ch.t <= 0) { p.charge = null; fire(p, ch.sol.vx * (1 + rnd(-ch.err, ch.err)), ch.sol.vy * (1 + rnd(-ch.err, ch.err))); }
        }
        for (const p of players) { if (p.tagImmune > 0) p.tagImmune -= dt; if (p.canPass > 0) p.canPass -= dt; if (p.stunT > 0) p.stunT -= dt; }
        if (tg.phase === 'ready') { startRound(); return; }
        if (tg.phase === 'boom') { tg.pt -= dt; if (tg.pt <= 0) afterBoom(); updatePicks(dt, false); return; }
        if (tg.phase === 'next') { tg.pt -= dt; if (tg.pt <= 0) startRound(); return; }
        if (tg.phase === 'over') {
            tg.overT -= dt; if (tg.overT <= 0 && !tg.resultShown) showResult();
            return;
        }
        // LIVE
        tg.fuse -= dt;
        const c = tg.carrier;
        const sec = Math.ceil(tg.fuse);
        if (tg.fuse < 6 && sec < tg.tickAt) { tg.tickAt = sec; SFX.play('tick', clamp(1 - tg.fuse / 6, 0, 1)); }
        window.TG_BG = mixBg(clamp(1 - tg.fuse / tg.fuseMax, 0, 1));
        for (const p of players) if (!p.out && (!p.local || tg.autoLocal)) think(p, dt);
        updatePicks(dt, true);
        if (c && c.canPass <= 0) {
            for (const q of alive()) {
                if (q === c || q.tagImmune > 0 || q.shieldT > 0) continue;
                const rs = c.r + q.r + 3;
                if ((q.x - c.x) * (q.x - c.x) + (q.y - c.y) * (q.y - c.y) < rs * rs) { pass(c, q); break; }
            }
        }
        if (c && c.bomb && Math.floor(tg.t * 14) !== tg.sparkT) { tg.sparkT = Math.floor(tg.t * 14); burst(c.x + 8, c.y - c.r - 22, '#ffb347', 1, 90); }
        if (tg.fuse <= 0 && tg.carrier) explode(tg.carrier);
        hudTick();
    }
    function updatePicks(dt, live) {
        if (live) { tg.pickT -= dt; if (tg.pickT <= 0) { tg.pickT = rnd(6, 9); spawnPick(); } }
        for (const k of tg.picks.slice()) {
            k.age += dt; const pos = pickPos(k);
            if (!live) continue;
            for (const p of alive()) { if (Math.abs(p.x - pos.x) < 22 && Math.abs(p.y - pos.y) < 30) { takePick(p, k); break; } }
            if (k.age > 14 && tg.picks.includes(k)) tg.picks.splice(tg.picks.indexOf(k), 1);
        }
    }
    const mixBg = k => { const a = [16, 19, 27], b = [44, 14, 20], m = a.map((v, i) => Math.round(v + (b[i] - v) * k)); return 'rgb(' + m.join(',') + ')'; };

    /* ------------------------------------------------------------------------ drawing ---- */
    function pop(x, y, text, col, big) { tg.pops.push({ x, y, text, col, t:0, life:big ? 1.4 : 1.1, big:!!big }); }
    function drawBomb(ctx, x, y, left, t) {
        const r = 11, urgent = left < 5;
        ctx.save(); ctx.translate(x, y);
        const k = urgent ? 1 + 0.14 * Math.sin(t * (11 + (5 - left) * 3)) : 1 + 0.04 * Math.sin(t * 6); ctx.scale(k, k);
        const g = ctx.createRadialGradient(-3.5, -4, 1, 0, 0, r + 1); g.addColorStop(0, '#6a7690'); g.addColorStop(0.4, '#1d2331'); g.addColorStop(1, '#06080d');
        ctx.fillStyle = g; ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#8892a6'; ctx.fillRect(-4, -r - 3, 8, 5); ctx.strokeRect(-4, -r - 3, 8, 5);
        ctx.strokeStyle = '#d8b06a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -r - 2); ctx.quadraticCurveTo(6, -r - 10, 11, -r - 7); ctx.stroke();
        const fl = 0.6 + 0.4 * Math.sin(t * 40), sr = 3.5 + fl * 2.5;
        ctx.save(); ctx.translate(11, -r - 7); ctx.rotate(t * 9);
        ctx.fillStyle = '#ffe27a'; ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? sr * 0.45 : sr; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ff7a2e'; ctx.beginPath(); ctx.arc(0, 0, sr * 0.45, 0, 7); ctx.fill(); ctx.restore();
        ctx.fillStyle = left < 4 ? '#ff5470' : '#ffd25a'; ctx.font = '900 12px "Bricolage Grotesque",system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(Math.max(0, Math.ceil(left))), 0, 1);
        ctx.restore();
    }
    function drawPick(ctx, k, t) {
        const pos = pickPos(k), P = PICKS[k.type], bob = Math.sin(t * 3 + k.off) * 3, fade = k.age > 12 ? 0.4 + 0.6 * Math.abs(Math.sin(t * 10)) : 1;
        ctx.save(); ctx.translate(pos.x, pos.y + bob); ctx.globalAlpha = fade;
        const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 22); g.addColorStop(0, P.col + 'cc'); g.addColorStop(1, P.col + '00');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 22, 0, 7); ctx.fill();
        ctx.fillStyle = '#0d1017'; ctx.strokeStyle = P.col; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(0, 0, 11, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = P.col; ctx.strokeStyle = P.col; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.beginPath();
        if (k.type === 'shield') { ctx.moveTo(0, -6); ctx.lineTo(5.5, -3.5); ctx.lineTo(4.5, 3); ctx.lineTo(0, 7); ctx.lineTo(-4.5, 3); ctx.lineTo(-5.5, -3.5); ctx.closePath(); ctx.fill(); }
        else if (k.type === 'leap') { ctx.moveTo(-5, 3); ctx.lineTo(0, -5); ctx.lineTo(5, 3); ctx.moveTo(-5, 7); ctx.lineTo(0, -1); ctx.lineTo(5, 7); ctx.stroke(); }
        else { ctx.moveTo(2, -7); ctx.lineTo(-4, 1); ctx.lineTo(0, 1); ctx.lineTo(-2, 7); ctx.lineTo(5, -2); ctx.lineTo(1, -2); ctx.closePath(); ctx.fill(); }
        ctx.restore();
    }
    function drawFront(ctx) {
        if (!tg) return;
        const t = performance.now() / 1000;
        for (const k of tg.picks) drawPick(ctx, k, t);
        for (const p of players) {                              // the wind-up line of a bot that is about to launch
            if (!p.charge || !p.charge.sol) continue;
            const s = p.charge.sol, g = playerG(p); let x = p.x, y = p.y, vx = s.vx, vy = s.vy;
            ctx.save(); ctx.fillStyle = 'rgba(255,110,60,.85)';
            for (let i = 0; i < 20; i++) { for (let k = 0; k < 2; k++) { vy += g * SIM_DT; x += vx * SIM_DT; y += vy * SIM_DT; } ctx.globalAlpha = 0.9 - i * 0.03; ctx.beginPath(); ctx.arc(x, y, 2.6, 0, 7); ctx.fill(); }
            ctx.restore();
        }
        for (const p of players) {
            if (p.out) continue;
            if (p.bomb && tg.phase === 'live') {
                // danger aura + fuse ring + the bomb itself
                const urgent = tg.fuse < 5, a = urgent ? 0.5 + 0.3 * Math.sin(t * 14) : 0.38;
                ctx.save(); ctx.translate(p.x, p.y); ctx.globalCompositeOperation = 'lighter';
                const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 44); g.addColorStop(0, 'rgba(255,110,40,' + a + ')'); g.addColorStop(1, 'rgba(255,60,30,0)');
                ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 44, 0, 7); ctx.fill(); ctx.globalCompositeOperation = 'source-over';
                const f = clamp(tg.fuse / tg.fuseMax, 0, 1);
                ctx.lineWidth = 3.2; ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.arc(0, 0, 26, 0, 7); ctx.stroke();
                ctx.strokeStyle = f > 0.4 ? '#ffcf3f' : '#ff5470'; ctx.beginPath(); ctx.arc(0, 0, 26, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f); ctx.stroke();
                ctx.restore();
                const hat = p.look && p.look.hat && p.look.hat !== 'none' ? 14 : 0;
                drawBomb(ctx, p.x, p.y - p.r - 26 - hat, tg.fuse, t);
            }
            if (p.stunT > 0) {                                 // frozen: an icy shell and drifting flakes
                ctx.save(); ctx.translate(p.x, p.y); ctx.globalAlpha = 0.55 + 0.2 * Math.sin(t * 12);
                ctx.fillStyle = 'rgba(160,215,255,.55)'; ctx.strokeStyle = '#e6f6ff'; ctx.lineWidth = 2; ctx.beginPath();
                if (ctx.roundRect) ctx.roundRect(-p.r - 3, -p.r - 3, p.r * 2 + 6, p.r * 2 + 6, 6); else ctx.rect(-p.r - 3, -p.r - 3, p.r * 2 + 6, p.r * 2 + 6);
                ctx.fill(); ctx.stroke(); ctx.restore();
            }
            if (p.tagImmune > 0 && !p.bomb) {                  // just passed it on: a blinking ring while they cannot be tagged back
                ctx.save(); ctx.translate(p.x, p.y); ctx.globalAlpha = 0.5 * Math.min(1, p.tagImmune); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.6; ctx.setLineDash([4, 5]); ctx.lineDashOffset = -t * 30;
                ctx.beginPath(); ctx.arc(0, 0, p.r + 9, 0, 7); ctx.stroke(); ctx.restore();
            }
        }
        if (tg.local && !tg.local.out) drawYouArrow(ctx, tg.local, tg.local.bomb && tg.phase === 'live' ? 34 : 0);
        for (const o of tg.pops) {
            const k = o.t / o.life, rise = 26 * (1 - Math.pow(1 - Math.min(1, o.t * 3), 2)) + o.t * 14, sc = o.t < 0.14 ? 1 + 0.6 * (1 - o.t / 0.14) : 1, size = o.big ? 22 : 15;
            ctx.save(); ctx.translate(o.x, o.y - rise); ctx.scale(sc, sc); ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1; ctx.transform(1, 0, -0.14, 1, 0, 0);
            ctx.font = 'italic 900 ' + size + 'px "Bricolage Grotesque","Segoe UI",system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.lineJoin = 'round'; ctx.lineWidth = 5; ctx.strokeStyle = '#0d1017'; ctx.strokeText(o.text, 0, 0);
            ctx.shadowColor = o.col; ctx.shadowBlur = 10; ctx.fillStyle = o.col; ctx.fillText(o.text, 0, 0); ctx.restore();
        }
    }
    function drawOverlay(ctx, W, H) {                          // screen space: the closer the blast, the redder the edges
        if (!tg) return;
        let a = 0;
        if (tg.phase === 'live' && tg.fuse < 6) a = (1 - tg.fuse / 6) * (0.28 + 0.12 * Math.sin(performance.now() / 1000 * (8 + (6 - tg.fuse) * 3)));
        if (tg.hit > 0) a = Math.max(a, tg.hit / 0.18 * 0.7);
        if (a <= 0.01) return;
        const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.72);
        g.addColorStop(0, 'rgba(255,60,30,0)'); g.addColorStop(1, 'rgba(255,50,30,' + Math.min(0.85, a) + ')');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }

    /* ------------------------------------------------------------------------ DOM: HUD, banner, results ---- */
    function ensureRoot() {
        let root = $('tg-root'); if (root) return root;
        root = document.createElement('div'); root.id = 'tg-root';
        root.innerHTML =
            '<div class="tg-hud" id="tg-hud"><div class="tg-fuse"><svg viewBox="0 0 64 64" class="tg-bomb" aria-hidden="true"><use href="#ico-mode-tag"/></svg><div class="tg-bar"><i id="tg-fill"></i></div><b id="tg-sec">0</b></div><div class="tg-cap" id="tg-cap" style="display:none"></div><div class="tg-chips" id="tg-chips"></div></div>' +
            '<div class="tg-banner" id="tg-banner"></div>' +
            '<button class="tg-skip" id="tg-skip" type="button">SKIP TO RESULT</button>' +
            '<div class="tg-tip" id="tg-tip"><div class="tg-tip-card"><button class="tg-tip-x" id="tg-tip-x" type="button" aria-label="Close">&times;</button>' +
                '<div class="tg-tip-ico"><svg viewBox="0 0 64 64" aria-hidden="true"><use href="#ico-mode-tag"/></svg></div><h2>Boom Tag</h2>' +
                '<ul><li><b>One bomb, one fuse.</b> Whoever holds it when it blows is out.</li><li><b>Crash into someone</b> to hand it over. Aim like always: drag and let go.</li><li><b>Grab power-ups:</b> shield, leap and zap.</li><li><b>Last one standing wins.</b></li></ul>' +
                '<button class="tg-go" id="tg-tip-go" type="button">LET\'S GO</button></div></div>' +
            '<div class="tg-result" id="tg-result"></div>';
        document.body.appendChild(root);
        $('tg-skip').onclick = () => skip();
        return root;
    }
    let chipsKey = '';
    function hudBuild(force) {
        if (!tg) return;
        const ch = $('tg-chips'); if (!ch) return;
        const key = players.map(p => (p.out ? 'x' : p.bomb ? 'b' : 'o') + p.id).join('') + tg.round;
        if (!force && key === chipsKey) return; chipsKey = key;
        ch.innerHTML = players.map(p => '<span class="tg-chip' + (p.out ? ' out' : '') + (p.bomb ? ' bomb' : '') + (p.local ? ' me' : '') + '"><i style="background:' + p.color + '"></i><em>' + (p.local ? 'YOU' : escH(p.name)) + '</em>' + (p.bomb ? '<svg viewBox="0 0 64 64" aria-hidden="true"><use href="#ico-mode-tag"/></svg>' : '') + '</span>').join('');
    }
    function hudTick() {
        const f = $('tg-fill'), s = $('tg-sec'); if (!f || !tg) return;
        const k = clamp(tg.fuse / tg.fuseMax, 0, 1); f.style.transform = 'scaleX(' + k.toFixed(3) + ')';
        const root = $('tg-hud'); root.classList.toggle('hot', tg.fuse < 5);
        s.textContent = Math.max(0, tg.fuse).toFixed(1);
    }
    const escH = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
    let bannerT = 0;
    function banner(text, col, secs) {
        const b = $('tg-banner'); if (!b) return;
        b.textContent = text; b.style.setProperty('--c', col); b.className = 'tg-banner'; void b.offsetWidth; b.className = 'tg-banner show';
        clearTimeout(bannerT); bannerT = setTimeout(() => { b.className = 'tg-banner'; }, (secs || 1.3) * 1000);
    }
    function hideResult() { const r = $('tg-result'); if (r) { r.classList.remove('vis'); r.innerHTML = ''; } const sk = $('tg-skip'); if (sk) sk.classList.remove('vis'); }
    function podTg(standings, pl, sub) {
        if (!window.Podium) return '';
        const en = standings.map(p => ({ name:p.name, look:p.look || {}, color:p.color, me:!!p.local, sub:sub(p) }));
        return Podium.html(en, pl > 3 ? { extra:en[pl - 1], extraRank:pl } : {});
    }
    function showResult() {
        tg.resultShown = true; $('tg-skip').classList.remove('vis'); $('tg-root').classList.add('over');
        const R_ = tg.result || { place:4, rw:{}, streak:0, bonus:0 }, me = tg.local, pl = R_.place;
        const standings = players.slice().sort((a, b) => (a.place || 9) - (b.place || 9));
        const title = pl === 1 ? 'LAST ONE STANDING' : pl === 2 ? 'SO CLOSE' : pl === 3 ? 'BLOWN UP' : 'FIRST TO BLOW';
        const rw = R_.rw || {};
        const chips = rw.noDrop && (rw.coins || rw.xp || rw.passPoints) ? (R('coin', rw.coins, { plus:true }) + R('xp', rw.xp, { plus:true }) + R('pass', rw.passPoints, { plus:true })) : '';
        const best = lsNum('rr_tag_best');
        $('tg-result').innerHTML = '<div class="tg-rc"><div class="tg-rtop' + (pl === 1 ? ' win' : '') + '"><small>BOOM TAG</small><h1>' + title + '</h1><p>' + (tg.passes ? 'You passed the bomb ' + tg.passes + (tg.passes === 1 ? ' time' : ' times') : 'You never passed the bomb') + '</p></div>' + podTg(standings, pl, p => p.place === 1 ? 'Survived' : 'Round ' + (p.round || '')) +
            '<div class="tg-rows">' + standings.map(p => '<div class="tg-row' + (p.local ? ' me' : '') + '"><b>' + (p.place || '') + '</b><i style="background:' + p.color + '"></i><span>' + (p.local ? 'YOU' : escH(p.name)) + '</span><em>' + (p.place === 1 ? 'Survived' : 'Round ' + (p.round || '')) + '</em></div>').join('') + '</div>' +
            '<div class="tg-rew">' + chips + (R_.bonus ? '<span class="tg-bonus">' + R('coin', R_.bonus, { plus:true }) + '<small>streak bonus</small></span>' : '') + '</div>' +
            '<div class="tg-streak' + (R_.streak > 1 ? ' hot' : '') + '"><b>' + R_.streak + '</b><span>' + (R_.streak ? 'win streak' : 'win streak: start one') + '</span><em>best ' + best + '</em></div>' +
            (pl === 1 ? '<p class="tg-note">A chest is waiting on the home screen</p>' : '') +
            (window.Arcade && Arcade.session() ? '<button class="tg-go" id="tg-next" type="button">NEXT MINIGAME</button><button class="tg-ghost" id="tg-again" type="button">PLAY AGAIN</button>' : '<button class="tg-go" id="tg-again" type="button">PLAY AGAIN</button>') + '<button class="tg-ghost" id="tg-menu" type="button">MAIN MENU</button></div>';
        $('tg-result').classList.add('vis'); if (window.Podium) setTimeout(() => Podium.start($('tg-result')), 60);
        $('tg-again').onclick = () => restart();
        if ($('tg-next')) $('tg-next').onclick = () => { leave(false); Arcade.next(); };
        $('tg-menu').onclick = () => leave(true);
    }
    // the player is out: let the others finish at once
    function skip() {
        if (!tg || tg.phase === 'over') return;
        tg.skipping = true; let n = 0;
        while (tg && tg.phase !== 'over' && n++ < 6000) update(1 / 60);       // the whole world, a few seconds of play in a blink
        if (tg) { tg.overT = 0; update(0.01); }
    }
    function pauseMenu() {
        openPrompt('PAUSED', 'Boom Tag', [['Resume', resumeRace], ['Settings', () => openSettings('pause'), true], ['Leave match', () => { state = 'playing'; showScreen(''); leave(true); }, true]]);
    }

    window.Tag = { ui:{ ensureRoot, banner, hideResult }, open, start, restart, leave, update, drawFront, drawOverlay, pauseMenu, skip, state:() => tg,
        debug:{ get tg() { return tg; }, auto(on) { if (tg) tg.autoLocal = on !== false; }, players:() => players, fire, think } };
})();
