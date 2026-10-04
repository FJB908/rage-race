// THE GAUNTLET: a 32-player, 3-stage elimination climb. Self-contained; loaded AFTER game.js.
//
//   Stage 1  STAMPEDE    32 -> 16   race to the line, first 16 across move on
//   Stage 2  HAZARD RUN  16 -> 6    narrower ledges, a wall of static rises from below
//   Stage 3  CROWN DUEL  6 -> 1     short, harsh, fast wall; first to the crown wins
//
// It reuses the real race physics, items and bots. game.js only carries a few small hooks
// (gameMode === 'gauntlet'); everything else lives here. See docs/GAUNTLET.md.
(function () {
    'use strict';

    /* ------------------------------------------------------------------ config ---- */
    const GT_W = 470;                         // the Gauntlet arena is wider than a normal race (356)
    const FIELD = 32;
    const FULL_DRAW = 4;                      // bots re-drawn layer by layer every frame (nearest to you); the rest use cached pictures
    window.GT_SPRITE = { w:128, h:128, half:25.6, cy:79.36 };   // cached look pictures: body half-size and where its centre sits (px)
    window.GT_BAND = 0.5;                     // how strongly bots rubber-band to YOU (a normal race: 1); set per stage

    const STAGES = [   // bg = the stage's floor tint
        { id:'stampede', name:'STAMPEDE', color:'#35e0c8', bg:'#0c1a1f', field:32, need:16, height:9000, deck:true, band:.55,
          blurb:'Race to the line. The first 16 across move on.',
          gap:118, gapGrow:55, gapMax:222, w0:150, wShrink:42, wMin:104, skillMul:1,
          lanes:row => (row % 3 === 1 ? 2 : 3), boxEvery:3, safetyEvery:11, timeout:170,
          types:d => [['boost', .11 + d*.03], ['fragile', .12 + d*.09], ['moving', .20 + d*.10], ['ice', .12 + d*.05]] },
        { id:'hazard', name:'HAZARD RUN', color:'#b3a9ff', bg:'#130f27', field:16, need:6, height:7000, deck:false, band:.4,
          blurb:'Narrower ledges and tougher jumps. The first 6 across move on.',
          gap:122, gapGrow:60, gapMax:222, w0:122, wShrink:38, wMin:82, skillMul:.95,
          lanes:row => (row % 4 === 3 ? 1 : 2), boxEvery:4, safetyEvery:16, timeout:150,
          types:d => [['boost', .09 + d*.03], ['fragile', .17 + d*.10], ['moving', .24 + d*.10], ['ice', .15 + d*.06]] },
        { id:'duel', name:'CROWN DUEL', color:'#ffcf3f', bg:'#1b140a', field:6, need:1, height:7500, deck:false, band:.25,
          blurb:'No wall, no mercy needed: the first to the crown wins.',
          gap:124, gapGrow:55, gapMax:212, w0:104, wShrink:30, wMin:72, skillMul:.9,
          lanes:row => (row % 5 === 4 ? 1 : 2), boxEvery:2, safetyEvery:0, timeout:150,
          types:d => [['boost', .08 + d*.03], ['fragile', .18 + d*.10], ['moving', .26 + d*.10], ['ice', .16 + d*.06]] },
    ];

    const ENTRY = { coins:0,   // 0 while testing (was 500)
         wagers:[{ stake:1000, mult:1.5 }, { stake:2500, mult:2.5 }, { stake:5000, mult:4 }] };
    // index = how far you got: 0 out in stage 1, 1 out in stage 2, 2 out in the Duel, 3 crown
    const PRIZES = [
        { coins:120, xp:45,  pass:35,  tier:null },
        { coins:260, xp:90,  pass:60,  tier:'rare' },
        { coins:450, xp:150, pass:100, tier:'epic' },
        { coins:700, xp:220, pass:160, tier:'legendary' },
    ];
    const TIER_COLOR = { common:'#35e0c8', rare:'#5b8def', epic:'#b3a9ff', legendary:'#ffcf3f' };
    const TIERS = ['common', 'rare', 'epic', 'legendary'];

    /* ------------------------------------------------------------------- state ---- */
    let gt = null;                            // the run in progress (null otherwise)
    let gtPrevQ = 0;
    const GT = window.Gauntlet = { debug:{ auto:false, fast:false, queue:[], log:[] } };

    const $ = id => document.getElementById(id);
    const pk_ = () => prog().gt;
    function coins() { return load('rr_coins', 0); }
    function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
    const ord = n => n + ((n % 100 >= 11 && n % 100 <= 13) ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10 < 4 ? n % 10 : 0]);

    /* ---------------------------------------------------------------- overlay DOM ---- */
    const root = document.createElement('div');
    root.id = 'gt-root';
    root.innerHTML =
        '<div class="gt-screen" id="gt-entry"></div>' +
        '<div class="gt-screen" id="gt-result"></div>' +
        '<div class="gt-stagecard" id="gt-stagecard"></div>' +
        '<div class="gt-banner" id="gt-banner"></div>' +
        '<div class="gt-out" id="gt-out"></div>' +
        '<div class="gt-crownwin" id="gt-crownwin"></div>';
    document.body.appendChild(root);

    const hudEl = document.createElement('div');
    hudEl.id = 'gt-hud';
    hudEl.innerHTML =
        '<div class="gt-row">' +
          '<div class="gt-chip stage"><b id="gt-stage-n">STAGE 1</b><span id="gt-stage-name">STAMPEDE</span></div>' +
          '<div class="gt-chip alive">' + icon('users') + '<b id="gt-alive">32</b></div>' +
        '</div>' +
        '<div class="gt-spots" id="gt-spots"><div class="gt-spots-txt"><b id="gt-spots-n">0</b><span id="gt-spots-of"> / 16</span><em id="gt-spots-lbl">QUALIFIED</em></div></div>';
    $('hud').appendChild(hudEl);
    const rewardsBtn = document.createElement('button');
    rewardsBtn.id = 'gt-rewards-btn'; rewardsBtn.type = 'button';
    rewardsBtn.innerHTML = icon('drop') + '<span>REWARDS</span>';
    $('hud').appendChild(rewardsBtn);

    function show(el) { el.style.display = 'flex'; void el.offsetWidth; el.classList.add('vis'); }
    function hide(el) { el.classList.remove('vis'); setTimeout(() => { if (!el.classList.contains('vis')) el.style.display = 'none'; }, 320); }

    /* ------------------------------------------------------------ entry screen ---- */
    let sel = { type:'coins', wager:0 };      // wager = index into ENTRY.wagers

    function costOf(s) {
        if (s.type === 'wager') return { coins:ENTRY.wagers[s.wager].stake };
        return { coins:ENTRY.coins };
    }
    function canAfford(s) {
        const c = costOf(s);
        return coins() >= c.coins;
    }

    function renderEntry() {
        const g = pk_(), bal = coins();
        const wg = ENTRY.wagers[sel.wager];
        const afford = canAfford(sel);
        const opt = (type, cls, inner) => '<button class="gt-opt ' + cls + (sel.type === type ? ' on' : '') + '" type="button" data-type="' + type + '">' + inner + '</button>';
        const node = (n, label, i) => '<div class="gt-node s' + i + '"><b>' + n + '</b><small>' + label + '</small></div>';
        const prize = (i, title, body, tierKey) => '<div class="gt-prize"><span class="gt-pico" style="--ic:' + (TIER_COLOR[tierKey] || '#8b95a7') + '">' + (i === 3 ? icon('crown') : (tierKey ? icon('drop-' + tierKey) : icon('coin'))) + '</span><span class="gt-ptxt"><b>' + title + '</b><small>' + body + '</small></span></div>';
        const ctaLabel = (costOf(sel).coins ? icon('coin') + '<b>' + costOf(sel).coins.toLocaleString('en-US') + '</b>' : '<b>FREE</b>');
        $('gt-entry').innerHTML =
            '<div class="gt-top"><button class="gt-back" type="button" id="gt-back" aria-label="Back">' + icon('chev-l') + '</button>' +
              '<div class="gt-wallet"><span class="gt-w coin">' + icon('coin') + '<b>' + bal.toLocaleString('en-US') + '</b></span></div></div>' +
            '<div class="gt-scroll">' +
              '<div class="gt-hero"><div class="gt-crown">' + icon('crown') + '</div><h1>GAUNTLET</h1>' +
                '<p>' + FIELD + ' players, 3 stages, 1 crown</p>' +
                (g.crowned ? '<div class="gt-holder">' + icon('crown') + '<span>YOU HOLD THE CROWN. DEFEND IT.</span></div>' : '') + '</div>' +
              '<div class="gt-ladder">' + node(32, 'Stampede', 0) + '<i></i>' + node(16, 'Hazard Run', 1) + '<i></i>' + node(6, 'Crown Duel', 2) + '<i></i>' +
                '<div class="gt-node s3"><b>' + icon('crown') + '</b><small>Crown</small></div></div>' +
              '<h2 class="gt-h2">Prizes</h2>' +
              '<div class="gt-prizes">' +
                prize(0, 'Out in Stampede', R('coin', PRIZES[0].coins) + R('xp', PRIZES[0].xp), null) +
                prize(1, 'Out in Hazard Run', 'Rare chest', 'rare') +
                prize(2, 'Out in Crown Duel', 'Epic chest', 'epic') +
                prize(3, 'Win the crown', 'Legendary chest', 'legendary') +
              '</div>' +
              '<h2 class="gt-h2">Entry</h2>' +
              '<div class="gt-opts">' +
                opt('coins', 'coin', '<span class="gt-oi">' + icon('coin') + '</span><span class="gt-ot"><b>' + (ENTRY.coins || 'Free') + '</b><small>' + (ENTRY.coins ? 'Open to everyone' : 'Free while we test') + '</small></span>') +
                opt('wager', 'wager', '<span class="gt-oi">' + icon('coin') + icon('coin') + '</span><span class="gt-ot"><b>Wager</b><small>Bigger stake, bigger coin prizes</small></span>') +
              '</div>' +
              (sel.type === 'wager'
                ? '<div class="gt-wager">' + ENTRY.wagers.map((w, i) => '<button type="button" class="gt-stake' + (i === sel.wager ? ' on' : '') + '" data-w="' + i + '">' + icon('coin') + '<b>' + w.stake.toLocaleString('en-US') + '</b><small>x' + w.mult + '</small></button>').join('') +
                  '</div><p class="gt-fine">The wager bonus (x' + wg.mult + ' on the coin prizes) is paid on top of your chest. Reach the Crown Duel and your stake comes back.' + (wg.stake >= 5000 ? ' Biggest stake: your chest starts one tier higher.' : '') + '</p>'
                : '') +
            '</div>' +
            '<div class="gt-cta"><button class="gt-go' + (afford ? '' : ' no') + '" type="button" id="gt-go">' + (afford ? '<span>ENTER</span>' + ctaLabel : '<span>' + 'NOT ENOUGH COINS' + '</span>') + '</button></div>';
        $('gt-back').onclick = closeEntry;
        $('gt-entry').querySelectorAll('.gt-opt').forEach(b => b.onclick = () => { sel.type = b.dataset.type; SFX.play('count'); renderEntry(); });
        $('gt-entry').querySelectorAll('.gt-stake').forEach(b => b.onclick = () => { sel.wager = +b.dataset.w; SFX.play('count'); renderEntry(); });
        $('gt-go').onclick = tryStart;
        if (sel.type === 'wager') { const w = $('gt-entry').querySelector('.gt-wager'), sc = $('gt-entry').querySelector('.gt-scroll'); if (w && sc) sc.scrollTop = sc.scrollHeight; }
    }

    const UNLOCK_LEVEL = 5;                       // the Gauntlet opens at player level 5
    const unlocked = () => levelInfo(prog().xp).lvl >= UNLOCK_LEVEL;
    function openEntry() {
        if (!unlocked()) { toast('Gauntlet unlocks at level ' + UNLOCK_LEVEL); return; }
        const g = pk_();
        GT._entered = true;
        renderEntry();
        show($('gt-entry'));
    }
    function closeEntry() { hide($('gt-entry')); }

    function tryStart() {
        if (!canAfford(sel)) { toast('Not enough coins'); SFX.play('fail'); return; }
        const p = prog(), c = costOf(sel);
        store('rr_coins', coins() - c.coins);
        saveProg(p);
        startRun({ type:sel.type, stake:sel.type === 'wager' ? c.coins : 0, mult:sel.type === 'wager' ? ENTRY.wagers[sel.wager].mult : 1, bump:sel.type === 'wager' && ENTRY.wagers[sel.wager].stake >= 5000 });
    }

    /* ----------------------------------------------------------------- the run ---- */
    function startRun(entry) {
        hide($('gt-entry')); hide($('gt-result'));
        showScreen('');
        gameMode = 'gauntlet'; esc = null; pk = null; lv = null;
        document.body.classList.remove('mode-escape', 'mode-parkour', 'mode-level');
        document.body.classList.add('mode-gauntlet');
        gtPrevQ = qLevel;
        if (qLevel < 2) { qLevel = 2; dprCap = QUALITY_STEPS[2].dpr; glowK = QUALITY_STEPS[2].glow; }   // 32 players: start two quality steps down (1x pixels, no glow)
        WORLD_W = GT_W; resize();
        hitStop = 0; spectating = false; showFinishMenu(false);

        const g = pk_();
        const field = [];
        const lp = makePlayer({ id:0, name:'YOU', local:true, color:skinColor(), x:GT_W / 2, y:START_Y - 32, look:myLook(), skill:1 });
        lp.baseSkill = 1; lp.crowned = !!g.crowned;
        field.push(lp);
        // the 31 rivals are roster bots around your level (a wide pool: some weak, some very good)
        const centre = Math.max(1200, prog().rk.mmr + 120);
        const crew = BotRoster.pick(FIELD - 1, { mmr:centre, spread:240 });
        (window.gauntletParty || []).forEach((m, k) => { if (crew[k]) crew[k] = Object.assign({}, crew[k], { name:m.name, look:Object.assign({ skin:'classic', hat:'none', face:'none', trail:'none' }, m.look || {}) }); });   // party members stand in until Gauntlet runs online
        const top = crew.reduce((best, b) => (!best || b.mmr > best.mmr) ? b : best, null);
        crew.forEach((rb, k) => {
            const i = k + 1, b = makePlayer({ id:i, name:rb.name, local:false, color:skinById(rb.look.skin).color,
                x:GT_W / 2, y:START_Y - 32, look:rb.look, skill:1 });
            BotRoster.applyTo([b], [rb], { color:true });
            b.champ = !g.crowned && rb === top;                   // the strongest rival is the defending champion
            field.push(b);
        });
        gt = { entry, field, alive:field.slice(), stage:-1, out:[], qualified:[], winner:null, t:0, phase:'idle',
               localOutStage:-1, watching:false, lootId:newLootId('gauntlet'), banner:'', wall:null, st:null, spotsKey:'' };
        beginStage(0);
    }

    function beginStage(i) {
        window.GT_BAND = STAGES[i].band; window.GT_BG = STAGES[i].bg;
        gt.stage = i; gt.st = STAGES[i]; gt.t = 0; gt.qualified = []; gt.winner = null; gt.wall = null; gt.outBase = gt.out.length; if (!gt.places) gt.places = [];
        gt.phase = 'card'; gt.watching = false;
        const st = gt.st;
        buildTrack(st);
        // who plays this stage: the survivors, shuffled across the start line
        const crew = gt.alive.slice();
        const local = crew.find(p => p.local);
        const order = shuffle(crew.slice());
        players = [];
        if (local) players.push(local);
        for (const p of order) if (!p.local) players.push(p);
        placeField(order, st);
        if (st.wall) gt.wall = { y:st.wall.y0, t:0, speed:st.wall.v0 };
        hud.style.display = 'block';
        rewardsBtn.style.display = 'none';
        hudStage(); updateHud();
        setState('gtbreak');
        cameraY = START_Y - VH * 0.62; prevCam = cameraY;
        const run = () => {
            if (!gt || gt.phase !== 'card') return;
            hide($('gt-stagecard')); gt.phase = 'play'; lastPlace = 0;
            if (GT.debug.fast) { particles = []; shots = []; shockwaves = []; shardParticles = []; state = 'playing'; return; }   // QA: no countdown
            beginRound();
        };
        if (GT.debug.fast) { run(); return; }
        showStageCard(st, i, run);
    }
    function setState(s) { state = s; dragging = false; }

    function placeField(order, st) {
        const n = order.length, pw = PLAY_W();
        const ground = platforms[0], deck = platforms.find(pl => pl.deck);
        const groundCount = deck ? Math.ceil(n / 2) : n;
        const slots = [];
        const make = (count, plat) => { const gap = (pw - 44) / Math.max(count, 1); for (let k = 0; k < count; k++) slots.push({ plat, x:(count <= 8 ? pw / (count + 1) * (k + 1) : 22 + gap * (k + 0.5)) }); };
        make(groundCount, ground);
        if (deck) make(n - groundCount, deck);
        const all = shuffle(slots.slice());
        const crew = players.slice();
        crew.forEach((p, idx) => {
            const slot = all[idx];
            const f = makePlayer({ id:p.id, name:p.name, local:p.local, color:p.color, x:slot.x, y:slot.plat.y - slot.plat.h / 2 - 12, botType:p.botType,
                afk:false, look:p.look, skill:(p.baseSkill || 1) * (p.local ? 1 : st.skillMul), thinkT:rnd(0.25, 1.1) });
            f.plat = slot.plat; f.baseSkill = p.baseSkill; f.champ = p.champ; f.crowned = p.crowned;
            if (deck && slot.plat === ground) f.charged = true;          // the lower pack starts with a boosted first jump
            Object.assign(p, f);
            p.gone = false; p.out = false; p._lod = false; p._off = false; p._px = undefined; p._py = undefined;
        });
    }

    /* ---------------------------------------------------------- track generator ---- */
    function mk(x, y, w, type, extra) {
        return Object.assign({ x, y, w, h:18, type, speed:0, dir:1, active:true, breaking:false, breakT:0, respawn:0, baseX:x, range:0, boostReady:true, quakeWarn:0, quakeDown:0 }, extra || {});
    }
    function pickType(st, d) {
        const w = st.types(d); let tot = 0; for (const e of w) tot += e[1];
        let r = Math.random(); if (r > tot) return 'normal';
        for (const [t, p] of w) { r -= p; if (r <= 0) return t; }
        return 'normal';
    }
    function buildTrack(st) {
        const pw = PLAY_W(), top = START_Y - st.height;
        platforms = []; itemBoxes = []; finishPlatform = null; ufos = []; shots = [];
        const ground = mk(pw / 2, START_Y, pw, 'normal', { h:40, ground:true });
        platforms.push(ground);
        let prev = [ground], y = START_Y - 170;
        if (st.deck) { const deck = mk(pw / 2, START_Y - 112, pw * 0.94, 'normal', { deck:true }); platforms.push(deck); prev = [deck]; y = deck.y - 160; }
        let row = 0;
        while (y > top + 300) {
            const d = (START_Y - y) / st.height;
            const gap = Math.min(st.gapMax, st.gap + rnd(0, 45) + d * st.gapGrow);
            const lanes = st.lanes(row), cur = [];
            for (let k = 0; k < lanes; k++) {
                let type = pickType(st, d);
                let width = Math.max(st.wMin, st.w0 - d * st.wShrink + rnd(0, 22));
                if (type === 'boost') width = Math.max(width, 74);
                let x = (k + 0.5) / lanes * pw + rnd(-0.34, 0.34) * pw / lanes;
                const maxShift = 118 + d * 42;
                let near = prev[0]; for (const q of prev) if (Math.abs(q.x - x) < Math.abs(near.x - x)) near = q;
                if (Math.abs(x - near.x) > maxShift) x = near.x + Math.sign(x - near.x) * maxShift * rnd(0.72, 0.98);
                const half = width / 2;
                const last = cur[cur.length - 1];
                if (last) x = Math.max(x, last.x + (last.w + width) / 2 + 18);       // lanes never overlap
                x = Math.max(half + 6, Math.min(pw - half - 6, x));
                if (last && x < last.x + (last.w + width) / 2 + 12) continue;         // no room: this lane stays empty
                const extra = {};
                let bx = x;
                if (type === 'moving') {
                    const range = rnd(46, 118);
                    bx = Math.max(half + 6 + range, Math.min(pw - half - 6 - range, x));
                    Object.assign(extra, { speed:rnd(58, 118) + d * 64, dir:Math.random() < 0.5 ? 1 : -1, range });
                    x = bx;
                }
                const pl = mk(x, y + rnd(-14, 14), width, type, extra); pl.baseX = bx;
                cur.push(pl); platforms.push(pl);
            }
            if (!cur.length) { const pl = mk(pw / 2, y, st.w0, 'normal'); cur.push(pl); platforms.push(pl); }
            // a sliding ledge may only sweep the space it owns: clamp its range so it never overlaps a neighbour in its row
            for (let k = 0; k < cur.length; k++) {
                const a = cur[k]; if (a.type !== 'moving') continue;
                const left = k ? cur[k - 1].x + cur[k - 1].w / 2 + (cur[k - 1].type === 'moving' ? cur[k - 1].range : 0) : 4;
                const right = k < cur.length - 1 ? cur[k + 1].x - cur[k + 1].w / 2 - 12 : pw - 4;
                const room = Math.min(a.x - a.w / 2 - left - 12, right - (a.x + a.w / 2));
                a.range = Math.min(a.range, Math.floor(room));
                if (a.range < 24) { a.type = 'normal'; a.range = 0; a.speed = 0; }
                a.baseX = a.x;
            }
            if (cur.every(p => p.type === 'fragile' || p.type === 'ice')) cur[Math.floor(cur.length / 2)].type = 'normal';
            if (st.boxEvery && row % st.boxEvery === 1) {
                const stable = cur.filter(p => p.type !== 'moving');
                const picks = shuffle(stable.slice()).slice(0, st.id === 'stampede' ? 2 : 1);
                for (const p of picks) itemBoxes.push(makeBox(p.x, p.y - 53, Math.random() < 0.25));
            }
            if (st.safetyEvery && row > 0 && row % st.safetyEvery === 0) {
                const fw = pw * rnd(0.78, 0.9), fx = pw / 2 + rnd(-1, 1) * (pw - fw) / 4;
                platforms.push(mk(fx, y - gap * 0.5, fw, 'safety', { h:20 }));
                for (const f of [-0.28, 0.28]) itemBoxes.push(makeBox(fx + f * fw, y - gap * 0.5 - 54, false));
            }
            prev = cur; y -= gap; row++;
        }
        platforms.push(mk(pw / 2, top + 190, pw * 0.78, 'normal'));
        platforms.push(mk(pw / 2, top, pw, 'finish', { h:40 }));
        gt.topY = top;
    }

    /* ------------------------------------------------------------- update loop ---- */
    function alivePlayers() { const a = []; for (const p of players) if (!p.gone) a.push(p); return a; }
    function localP() { return players.find(p => p.local); }

    window.updateGauntlet = function (dt) {
        if (!gt || gt.phase !== 'play') return;
        gt.t += dt;
        const lp = localP();
        gt.hudT = (gt.hudT || 0) - dt;
        if (GT.debug.auto && lp && !lp.gone && lp.mode === 'idle') updateBot(lp, dt);

        const st = gt.st;
        if (gt.wall) updateWall(dt);

        // time limit: whoever is highest moves on
        if (gt.t > st.timeout) { timeoutStage(); return; }
        if (gt.hudT <= 0) { gt.hudT = 0.2; updateHud(); }
    };

    function updateWall(dt) {
        const st = gt.st, w = gt.wall, cfg = st.wall;
        w.t += dt;
        let speed = cfg.v0 + (cfg.v1 - cfg.v0) * Math.min(1, w.t / cfg.ramp);   // a steady climb that picks up: no leash, the pack decides who is too slow
        if (w.t < 1.2) speed *= w.t / 1.2;
        w.speed = speed; w.y -= speed * dt;

        const dying = [];
        for (const p of players) {
            if (p.gone) continue;
            if (p.y + p.r * 0.5 > w.y) {
                if (consumeShield(p)) {
                    p.mode = 'air'; p.plat = null; p.vy = -1800; p.vx *= 0.5;
                    if (p.local) camShake = Math.max(camShake, 10);
                    ring(p.x, p.y, ITEMS.shield.color, 90);
                } else dying.push(p);
            }
        }
        if (!dying.length) return;
        // never wipe the last climber(s): the highest one is pulled clear
        let aliveN = 0; for (const p of players) if (!p.gone) aliveN++;
        const mustSurvive = gt.stage === 2 || gt.qualified.length === 0;
        if (mustSurvive && aliveN - dying.length < 1) {
            dying.sort((a, b) => a.y - b.y); const saved = dying.shift();
            saved.mode = 'air'; saved.plat = null; saved.vy = -1800; ring(saved.x, saved.y, '#fff', 80);
        }
        dying.sort((a, b) => b.y - a.y);
        for (const p of dying) { eliminate(p, 'wall'); gt.wallDeaths = (gt.wallDeaths || 0) + 1; }
        checkStageEnd();
    }

    /* --------------------------------------------------- qualify / eliminate ---- */
    window.gtFinish = function (p) {
        if (!gt || gt.phase !== 'play' || p.gone) return;
        p.finished = true; p.gone = true; p.finishTime = gt.t; p.vx = p.vy = 0;
        gt.qualified.push(p);
        burst(p.x, p.y, p.color, 26, 280); ring(p.x, p.y, gt.st.color, 90);
        if (p.local) {
            SFX.play('finish'); haptic([30, 40, 30, 40, 80]); camShake = Math.max(camShake, 7);
            for (const c of ['#ffcf3f', '#ffffff', gt.st.color]) burst(p.x, p.y, c, 14, 340);
            if (gt.stage < 2) banner('check', 'QUALIFIED', '#7ee787');
        } else if (gt.stage === 2 && !gt.winner) SFX.play('count');
        if (gt.stage === 2 && !gt.winner) gt.winner = p;
        spotsPulse();
        checkStageEnd();
    };

    function eliminate(p, why) {
        if (p.gone) return;
        p.finished = true; p.gone = true; p.out = true; p.vx = p.vy = 0;
        gt.out.push(p);
        burst(p.x, p.y, '#ff5470', why === 'wall' ? 26 : 14, 260); ring(p.x, p.y, '#ff5470', why === 'wall' ? 80 : 50);
        if (p.local) {
            gt.localOutStage = gt.stage; haptic([60, 40, 90]); SFX.play('fail'); camShake = Math.max(camShake, 9);
            if (why === 'wall') showOut();
        }
    }

    function checkStageEnd() {
        if (!gt || gt.phase !== 'play') return;
        const st = gt.st;
        if (gt.stage === 2) {
            if (gt.winner) return endStage();
            const al = alivePlayers();
            if (al.length <= 1) { if (al.length === 1) gt.winner = al[0]; return endStage(); }
            return;
        }
        if (gt.qualified.length >= st.need || alivePlayers().length === 0) endStage();
    }

    function timeoutStage() {
        // someone is stuck forever: the highest climbers take the remaining spots
        const al = alivePlayers().sort((a, b) => a.y - b.y);
        if (gt.stage === 2) { gt.winner = al[0] || gt.winner; return endStage(); }
        for (const p of al) { if (gt.qualified.length >= gt.st.need) break; p.finished = true; p.gone = true; gt.qualified.push(p); }
        endStage();
    }

    function endStage() {
        if (gt.phase !== 'play') return;
        gt.phase = 'cut'; setState('gtbreak');
        hide($('gt-out'));
        GT.debug.log.push({ stage:gt.stage, t:+gt.t.toFixed(1), q:gt.qualified.length, left:alivePlayers().length, outSoFar:gt.out.length, wall:gt.wall ? Math.round(START_Y - gt.wall.y) : 0, wallDeaths:gt.wallDeaths || 0, qt:gt.qualified.map(p => +p.finishTime.toFixed(0)), localQ:gt.qualified.some(p => p.local) });
        gt.wallDeaths = 0;
        // everyone still on the course is cut, lowest first
        const rest = alivePlayers().sort((a, b) => b.y - a.y);
        for (const p of rest) { p.finished = true; p.gone = true; p.out = true; gt.out.push(p); if (p.local) gt.localOutStage = gt.stage; }
        const lp = localP();
        const st = gt.st;
        if (lp) {                                                          // where the local player ended in THIS stage
            let pl = null;
            if (gt.winner === lp) pl = 1;
            else if (gt.qualified.includes(lp)) pl = gt.qualified.indexOf(lp) + 1;
            else if (gt.out.includes(lp)) pl = Math.max(2, st.field - (gt.out.indexOf(lp) - gt.outBase));
            if (pl) gt.places[gt.stage] = pl;
        }
        gt.alive = gt.stage === 2 ? [] : gt.qualified.slice();
        if (gt.stage === 2) {
            const w = gt.winner;
            if (w) { burst(w.x, w.y, '#ffcf3f', 60, 420); ring(w.x, w.y, '#ffcf3f', 150); }
            if (w) {
                // the game freezes for 2 s on the crown, then the winner is shown for 3 s, then the rewards
                SFX.play('finish'); if (w.local) haptic([40, 40, 40, 40, 120]);
                after(2000, () => crownSpotlight(w));
                return after(5200, () => finishRun());
            }
            return after(1100, () => finishRun());
        }
        if (lp && gt.qualified.includes(lp)) {
            if (!GT.debug.fast) banner('check', gt.stage === 0 ? 'STAGE CLEARED' : 'THROUGH TO THE DUEL', '#7ee787');
            after(1500, () => beginStage(gt.stage + 1));
        } else after(900, () => finishRun());
    }
    function after(ms, fn) { if (GT.debug.fast) { GT.debug.queue.push(fn); return; } setTimeout(() => { if (gt) fn(); }, ms); }

    /* ------------------------------------------------------------- camera / draw ---- */
    window.gtCamTarget = function () {
        const lp = players[0];
        if (!lp || !gt) return lp;
        if (!lp.gone) return lp;
        let best = null;
        for (const p of players) if (!p.gone && (!best || p.y < best.y)) best = p;
        if (!best) for (const p of players) if (p.finished && !p.out && (!best || p.finishTime < best.finishTime)) best = p;
        return best || lp;
    };

    const vis = [];
    window.gtPrepareDraw = function (vt, vb) {
        vis.length = 0;
        const lpY = players[0] ? players[0].y : cameraY, mid = cameraY + VH * 0.5, full = qLevel >= 2 ? 1 : qLevel === 1 ? FULL_DRAW - 1 : FULL_DRAW;
        for (const p of players) {
            p._off = p.y + 520 < vt || p.y - 520 > vb;
            p._lod = false; p._noName = Math.abs(p.y - lpY) > 230;
            if (p.gone || p.local) continue;
            if (p.y + p.r < vt || p.y - p.r > vb) continue;
            p._k = Math.abs(p.y - mid) - (p._wasFull ? 70 : 0);
            vis.push(p);
        }
        if (vis.length > full) {
            vis.sort((a, b) => a._k - b._k);
            let budget = 3, names = 0;                                          // at most 3 picture refreshes a frame
            for (let i = 0; i < vis.length; i++) {
                const p = vis[i];
                p._lod = i >= full; p._wasFull = i < full;
                if (!p._noName) { if (names < 5) names++; else p._noName = true; }   // at most 5 name tags
                if (p._lod) budget -= refreshSprite(p, budget);
            }
        } else for (const p of vis) p._wasFull = true;
    };

    // A cached picture of a bot's whole look. Re-painted a few times a second so animated cosmetics still move a little.
    function refreshSprite(p, budget) {
        if (!p._spr) { p._spr = document.createElement('canvas'); p._spr.width = GT_SPRITE.w; p._spr.height = GT_SPRITE.h; p._sprAge = 99; }
        p._sprAge++;
        if (p._sprAge < 14 + (p.id % 7) * 2 || budget <= 0) return 0;
        p._sprAge = 0;
        renderLook(p._spr, p.look, { scale:GT_SPRITE.half / GT_SPRITE.w, cy:GT_SPRITE.cy / GT_SPRITE.h });
        return 1;
    }

    // The "sky" is just the floor colour, tinted per stage (set in beginStage), plus a few drifting motes.
    // (A full-screen gradient or stretched bitmap every frame was the single biggest fixed cost on software canvases.)
    window.gtDrawSky = function () {
        const st = gt && gt.st; if (!st) return;
        const w = SCREEN_PW(), t = performance.now() / 1000, off = (cameraY * 0.12) % 140;
        ctx.fillStyle = st.color + '26';
        for (let i = 0; i < 12; i++) {
            const x = ((i * 97.3 + 31) % 100) / 100 * w;
            const y = ((i * 61.7) % 140 + off + t * 6 * ((i % 3) + 1)) % (CH + 40) - 20;
            ctx.fillRect(x, y, 2, 2 + (i % 3));
        }
    };

    function crownPath(x, y, s) {
        ctx.beginPath();
        ctx.moveTo(x - s, y + s * 0.55); ctx.lineTo(x - s * 1.05, y - s * 0.45); ctx.lineTo(x - s * 0.5, y + s * 0.05);
        ctx.lineTo(x, y - s * 0.7); ctx.lineTo(x + s * 0.5, y + s * 0.05); ctx.lineTo(x + s * 1.05, y - s * 0.45); ctx.lineTo(x + s, y + s * 0.55);
        ctx.closePath();
    }
    function drawCrown(x, y, s) {
        crownPath(x, y, s);
        const g = ctx.createLinearGradient(0, y - s * 0.7, 0, y + s * 0.55);
        g.addColorStop(0, '#fff0a8'); g.addColorStop(0.5, '#ffc83a'); g.addColorStop(1, '#c47a10');
        ctx.fillStyle = g; ctx.fill();
        ctx.lineWidth = Math.max(1, s * 0.12); ctx.strokeStyle = '#6b3d00'; ctx.lineJoin = 'round'; ctx.stroke();
        ctx.fillStyle = '#ff5470'; ctx.beginPath(); ctx.arc(x, y + s * 0.18, s * 0.14, 0, 7); ctx.fill();
    }

    window.gtDrawWorldBack = function (vt, vb) {
        if (!gt || !gt.st) return;
        const st = gt.st, pw = PLAY_W(), fy = gt.topY;
        // the finish arch
        if (fy > vt - 260 && fy < vb + 60) {
            const t = performance.now() / 1000;
            ctx.save();
            const g = ctx.createLinearGradient(0, fy - 260, 0, fy);
            g.addColorStop(0, st.color + '00'); g.addColorStop(1, st.color + '40');
            ctx.fillStyle = g; ctx.fillRect(0, fy - 260, pw, 260);
            ctx.fillStyle = st.color; ctx.globalAlpha = 0.9;
            ctx.fillRect(8, fy - 200, 7, 200); ctx.fillRect(pw - 15, fy - 200, 7, 200);
            ctx.fillRect(8, fy - 206, pw - 16, 10);
            ctx.globalAlpha = 1;
            // the players who made it stand in the box above the finish, in the order they crossed
            const qn = gt.qualified.length;
            if (qn && gt.stage < 2) {
                const step = Math.min(31, (pw - 40) / Math.max(1, st.need - 1));
                for (let i = 0; i < qn; i++) {
                    const p = gt.qualified[i], x = 24 + i * step, y = fy - 20 - 30;
                    if (p.local) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; roundRect(x - 16, y - 1, 32, 32, 8); ctx.stroke(); }
                    ctx.drawImage(slotFace(p), x - 15, y, 30, 30);
                }
            }
            if (gt.stage === 2) {
                ctx.shadowBlur = 24; ctx.shadowColor = '#ffcf3f';
                drawCrown(pw / 2, fy - 118 + Math.sin(t * 2.4) * 5, 44);
                ctx.shadowBlur = 0;
            }
            ctx.restore();
        }
    };

    window.gtDrawWorldFront = function (vt, vb) {
        if (!gt) return;
        // crowns on the holders
        for (const p of players) {
            if (p.gone || !(p.crowned || p.champ)) continue;
            if (p.y < vt || p.y > vb) continue;
            const lift = (p.look && p.look.hat && p.look.hat !== 'none') ? 24 : 12;
            drawCrown(p.x, p.y - p.r - lift - 4, 6.5);
        }
        if (!gt.wall) return;
        const top = gt.wall.y;
        if (top > cameraY + VH + 220) return;
        const t = performance.now() / 1000, pw = PLAY_W(), bottom = cameraY + VH + 60;
        const final = gt.stage === 2;
        const c1 = final ? '#ff5470' : '#b3a9ff', c2 = final ? '#b81f4a' : '#5b46d6', c3 = final ? '#4a0c22' : '#1b1250', c4 = final ? '#14060c' : '#0a0722';
        const haze = ctx.createLinearGradient(0, top - 150, 0, top);
        haze.addColorStop(0, c1 + '00'); haze.addColorStop(1, c1 + '38');
        ctx.fillStyle = haze; ctx.fillRect(0, top - 150, pw, 168);
        const wave = x => top + Math.sin(x * 0.045 + t * 3.1) * 4.5 + Math.sin(x * 0.013 - t * 1.6) * 7;
        ctx.beginPath(); ctx.moveTo(0, bottom);
        for (let x = 0; x < pw; x += 8) ctx.lineTo(x, wave(x));
        ctx.lineTo(pw, wave(pw)); ctx.lineTo(pw, bottom); ctx.closePath();
        const body = ctx.createLinearGradient(0, top - 10, 0, top + 260);
        body.addColorStop(0, c1); body.addColorStop(0.08, c2); body.addColorStop(0.35, c3); body.addColorStop(1, c4);
        ctx.fillStyle = body; ctx.fill();
        ctx.save();
        ctx.shadowBlur = 20; ctx.shadowColor = c1;
        ctx.strokeStyle = final ? '#ffb3c1' : '#e4defe'; ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let x = 0; x < pw; x += 8) { const y = wave(x); if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
        ctx.lineTo(pw, wave(pw)); ctx.stroke();
        ctx.restore();
        // static: a few glitch bars riding the surface
        ctx.fillStyle = c1;
        for (let i = 0; i < 5; i++) {
            const gx = ((Math.floor(t * 7) * 53 + i * 91) % pw), gy = top + 10 + ((i * 37 + Math.floor(t * 9) * 17) % 90);
            ctx.globalAlpha = 0.25; ctx.fillRect(gx, gy, 26 + (i % 3) * 18, 2);
        }
        ctx.globalAlpha = 1;
    };

    window.gtDrawOverlay = function () {
        if (!gt) return;
        const lp = players[0], w = SCREEN_PW(), t = performance.now() / 1000;
        if (gt.wall && lp && !lp.gone) {
            const gap = gt.wall.y - (lp.y + lp.r), danger = Math.max(0, Math.min(1, 1 - gap / 460));
            if (danger > 0) {
                const pulse = danger > 0.6 ? 0.75 + 0.25 * Math.sin(t * 9) : 1, col = gt.stage === 2 ? '255,84,112' : '124,107,255';
                const g = ctx.createLinearGradient(0, CH, 0, CH * 0.45);
                g.addColorStop(0, 'rgba(' + col + ',' + (0.42 * danger * pulse) + ')'); g.addColorStop(1, 'rgba(' + col + ',0)');
                ctx.fillStyle = g; ctx.fillRect(0, CH * 0.45, w, CH * 0.55);
            }
        }
        // spots closing: a thin red heartbeat at the top while you are not through and 2 or fewer remain
        if (lp && !lp.gone && gt.stage < 2 && gt.st.need - gt.qualified.length <= 2 && gt.phase === 'play') {
            const a = 0.16 + 0.12 * Math.abs(Math.sin(t * 5));
            const g = ctx.createLinearGradient(0, 0, 0, 90);
            g.addColorStop(0, 'rgba(255,84,112,' + a + ')'); g.addColorStop(1, 'rgba(255,84,112,0)');
            ctx.fillStyle = g; ctx.fillRect(0, 0, w, 90);
        }
    };

    window.gtDrawGauge = function () {
        const x0 = CW - SIDEBAR;
        ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(x0, 0, SIDEBAR, CH);
        ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0, CH); ctx.stroke();
        if (!gt || !gt.st) return;
        const st = gt.st, cx = x0 + SIDEBAR / 2, top = 26, bot = CH - 16, span = bot - top;
        ctx.fillStyle = 'rgba(255,255,255,0.30)'; ctx.font = '800 8px Space Grotesk'; ctx.textAlign = 'center';
        ctx.fillText('TOP', cx, 14);
        ctx.fillStyle = 'rgba(255,255,255,0.06)'; roundRect(cx - 4, top, 8, span, 4); ctx.fill();
        if (gt.wall) {
            const f = Math.max(0, Math.min(1, (START_Y - gt.wall.y) / st.height));
            const fy = bot - span * f;
            if (fy < bot) {
                const g = ctx.createLinearGradient(0, fy, 0, bot);
                g.addColorStop(0, gt.stage === 2 ? '#ff5470' : '#b3a9ff'); g.addColorStop(1, gt.stage === 2 ? '#4a0c22' : '#1b1250');
                ctx.fillStyle = g; roundRect(cx - 4, fy, 8, bot - fy, 4); ctx.fill();
            }
        }
        const lp = players[0];
        for (const p of players) {
            if (p.gone || p === lp) continue;
            const f = Math.max(0, Math.min(1, (START_Y - p.y) / st.height));
            ctx.beginPath(); ctx.arc(cx, bot - span * f, 3.2, 0, 7); ctx.fillStyle = p.color; ctx.globalAlpha = 0.9; ctx.fill();
        }
        ctx.globalAlpha = 1;
        if (lp && !lp.gone) {
            const f = Math.max(0, Math.min(1, (START_Y - lp.y) / st.height));
            ctx.beginPath(); ctx.arc(cx, bot - span * f, 7, 0, 7); ctx.fillStyle = lp.color; ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
        }
    };

    /* ------------------------------------------------------------------- HUD ---- */
    let hudKey = '';
    function hudStage() {
        const st = gt.st;
        $('gt-stage-n').textContent = 'STAGE ' + (gt.stage + 1);
        $('gt-stage-name').textContent = st.name;
        $('gt-stage-n').style.color = st.color;
        hudEl.style.setProperty('--sc', st.color);
        hudKey = '';
        $('gt-spots').classList.toggle('duel', gt.stage === 2);
    }
    function updateHud() {
        const st = gt.st, lp = localP();
        let on = 0, ahead = 0;
        for (const p of players) if (!p.gone) { on++; if (lp && p !== lp && p.y < lp.y) ahead++; }
        const q = gt.qualified.length;
        const key = on + ':' + q + ':' + (lp && lp.gone ? 1 : 0) + ':' + (lp && !lp.gone ? ahead : '');
        if (key === hudKey) return;
        hudKey = key;
        $('gt-alive').textContent = on;
        $('gt-spots-n').textContent = gt.stage < 2 ? q : on;
        $('gt-spots-of').textContent = gt.stage < 2 ? ' / ' + st.need : '';
        $('gt-spots-lbl').textContent = gt.stage < 2 ? 'QUALIFIED' : 'LEFT. FIRST TO THE CROWN';
        // your live place among everyone still in the stage (qualified players count as ahead)
        if (lp && !lp.gone) {
            const place = q + ahead + 1, safe = gt.stage === 2 ? place <= 1 : place <= st.need;
            posNum.textContent = place;
            document.getElementById('pos-suf').textContent = place % 100 >= 11 && place % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][place % 10 < 4 ? place % 10 : 0];
            document.getElementById('pos-pill').className = 'place ' + (safe ? 'p1' : 'p4');
        }
    }
    // A small picture of a player's look (used for the qualified row above the finish line).
    function slotFace(p) {
        if (!p._mini) { p._mini = document.createElement('canvas'); p._mini.width = p._mini.height = 44; renderLook(p._mini, p.look, { scale:.27, cy:.62 }); }
        return p._mini;
    }
    function spotsPulse() { const e = $('gt-spots'); e.classList.remove('pulse'); void e.offsetWidth; e.classList.add('pulse'); }

    function banner(ico, text, color) {
        const b = $('gt-banner');
        b.style.display = 'flex';
        b.innerHTML = '<span style="color:' + color + '">' + icon(ico) + '<b>' + text + '</b></span>';
        b.classList.remove('go'); void b.offsetWidth; b.classList.add('go');
    }

    // Whoever takes the crown fills the screen with it on.
    function crownSpotlight(w) {
        if (GT.debug.fast) return;
        const el = $('gt-crownwin');
        const cv = document.createElement('canvas'); cv.width = cv.height = 260;
        renderLook(cv, w.look, { scale:.2, cy:.62 });
        el.innerHTML = '<div class="gt-cw-in"><div class="gt-cw-rays"></div><div class="gt-cw-av"><span class="gt-cw-crown">' + icon('crown') + '</span></div>' +
            '<small>' + (w.local ? 'YOU TOOK THE' : 'TAKES THE') + '</small><h2>CROWN</h2><b>' + (w.local ? 'YOU' : w.name) + '</b></div>';
        el.querySelector('.gt-cw-av').prepend(cv);
        show(el); setTimeout(() => hide(el), 3000);
    }

    function showStageCard(st, i, done) {
        const c = $('gt-stagecard');
        const ladder = STAGES.map((s, k) => '<i class="' + (k < i ? 'done' : k === i ? 'now' : '') + '"></i>').join('');
        c.style.setProperty('--sc', st.color);
        c.innerHTML = '<div class="gt-sc-in"><small>STAGE ' + (i + 1) + ' / 3</small><h2>' + st.name + '</h2>' +
            '<div class="gt-sc-cut">' + icon('users') + '<b>' + st.field + '</b><span class="arr">' + icon('arrow-up') + '</span><b>' + (i === 2 ? 'CROWN' : st.need) + '</b></div>' +
            '<p>' + st.blurb + '</p><div class="gt-sc-steps">' + ladder + '</div></div>';
        show(c); SFX.play('count');
        setTimeout(done, 1900);
    }

    /* -------------------------------------------------- eliminated mid-stage ---- */
    function showOut() {
        const lp = localP(), o = $('gt-out');
        const rank = placeOf(lp) ;
        o.innerHTML = '<div class="gt-out-in"><div class="gt-out-k">ELIMINATED</div><h3>Stage ' + (gt.stage + 1) + ' · ' + gt.st.name + '</h3>' +
            '<p>Caught by the wall. You placed <b>' + ord(rank) + '</b> of ' + FIELD + '.</p>' +
            '<button class="gt-btn" type="button" id="gt-out-rw">' + icon('drop') + '<span>REWARDS</span></button>' +
            '<button class="gt-btn ghost" type="button" id="gt-out-watch"><span>WATCH THE STAGE</span></button></div>';
        show(o);
        $('gt-out-rw').onclick = () => { hide(o); skipToResults(); };
        $('gt-out-watch').onclick = () => { hide(o); gt.watching = true; rewardsBtn.style.display = 'flex'; };
    }
    rewardsBtn.addEventListener('click', e => { e.stopPropagation(); skipToResults(); });
    function skipToResults() {
        if (!gt || gt.phase === 'done') return;
        gt.phase = 'cut'; setState('gtbreak'); finishRun();
    }

    /* ------------------------------------------------------ final placement ---- */
    function placeOf(p) {
        // winner first; everyone else by order of leaving (the first to go is last). Players still on the course count as ahead.
        if (gt.winner === p) return 1;
        const i = gt.out.indexOf(p);
        return i < 0 ? FIELD : Math.max(2, FIELD - i);
    }

    /* ---------------------------------------------------------------- rewards ---- */
    function reachedStage() {
        const lp = players.find(p => p.local) || gt.field[0];
        if (gt.winner === lp) return 3;
        return Math.max(0, Math.min(2, gt.localOutStage < 0 ? gt.stage : gt.localOutStage));
    }

    function finishRun() {
        if (!gt || gt.phase === 'done') return;
        gt.phase = 'done'; setState('gtbreak');
        hud.style.display = 'none'; rewardsBtn.style.display = 'none';
        hide($('gt-out')); hide($('gt-banner')); hide($('gt-stagecard'));
        const lp = gt.field[0];
        if (!lp.out && gt.winner !== lp) { lp.out = true; if (!gt.out.includes(lp)) gt.out.push(lp); }
        const reached = reachedStage(), win = reached === 3;
        const place = placeOf(lp);
        const pr = PRIZES[reached], e = gt.entry;
        const bc = n => window.Boost ? Boost.coins(n, gt.lootId) : n;                                                       // coin booster
        const coinBase = bc(pr.coins);                                                                                       // the chest's own coins
        const wagerCoins = e.mult > 1 ? Math.max(0, bc(Math.round(pr.coins * e.mult)) - coinBase) : 0;                      // extra from the wager, paid straight away
        const refund = e.stake && reached >= 2 ? e.stake : 0;
        let tier = pr.tier;
        if (tier && e.bump) tier = TIERS[Math.min(3, TIERS.indexOf(tier) + 1)];
        // grant once (the run id makes this safe if it is reached twice)
        const p = prog(), id = gt.lootId;
        let drop = null;
        if (!p.lootGrants[id] && !p.pendingDrops[id]) {
            if (window.Missions) { Missions.event('gtrun'); if (win) Missions.event('win'); }
            const g = p.gt; g.runs++; if (win) g.wins++; g.best = Math.max(g.best, reached);
            g.crowned = win;                                              // the crown is yours until someone takes it
            saveProg(p);
            if (refund) store('rr_coins', coins() + refund);
            if (wagerCoins) store('rr_coins', coins() + wagerCoins);
            if (tier) drop = awardLootDrop(id, { coins:coinBase, xp:pr.xp, passPoints:pr.pass }, { tier });
            else {
                const q = prog(); q.xp += pr.xp; q.passPoints += pr.pass; q.passPointsEarned += pr.pass;
                q.lootGrants[id] = { id, tier:'common', coins:coinBase, xp:pr.xp, passPoints:pr.pass, cosmetic:null, noDrop:true };
                saveProg(q); store('rr_coins', coins() + coinBase);
            }
        } else drop = p.pendingDrops[id] || p.lootGrants[id];
        if (!drop) drop = { noDrop:true, coins:coinBase, xp:pr.xp, passPoints:pr.pass };
        refreshMenu();
        renderResult({ reached, win, place, drop, tier, coinBase, wagerCoins, refund, pr, e, lootId:id });
    }

    function renderResult(r) {
        const names = STAGES.map(s => s.name);
        const accent = r.win ? '#ffcf3f' : r.reached === 2 ? '#b3a9ff' : r.reached === 1 ? '#5b8def' : '#ff5470';
        const steps = STAGES.map((s, k) => {
            const cls = r.reached > k || (r.win) ? 'ok' : r.reached === k ? 'out' : 'na';
            const pl = (gt.places && gt.places[k]) || (cls === 'out' ? r.place : 0);
            const num = pl ? '<em class="pl"><b>' + pl + '</b><u>' + ord(pl).replace(/^\d+/, '') + '</u></em>' : cls === 'ok' ? icon('check') : cls === 'out' ? '<em>X</em>' : icon('lock');
            return '<div class="gt-rs ' + cls + (pl ? ' has' : '') + '"><span>' + (cls === 'na' ? icon('lock') : num) + '</span><small>' + s.name + '</small></div>';
        }).join('<i></i>');
        const winner = gt.winner;
        $('gt-result').style.setProperty('--ac', accent);
        $('gt-result').innerHTML =
            '<div class="gt-scroll res">' +
              '<div class="gt-res-hero">' + (r.win ? '<div class="gt-crown big">' + icon('crown') + '</div>' : '') +
                '<small>' + (r.win ? 'GAUNTLET' : 'ELIMINATED IN') + '</small>' +
                '<h1>' + (r.win ? 'CROWN WINNER' : names[r.reached]) + '</h1>' +
                '<p>You placed <b>' + ord(r.place) + '</b> of ' + FIELD + (winner && !winner.local ? ' · Crown: ' + winner.name : '') + '</p></div>' +
              '<div class="gt-rsteps">' + steps + '</div>' +
              '<div class="gt-rewards">' +
                '<h2 class="gt-h2">' + (r.drop && !r.drop.noDrop ? 'Chest' : 'Rewards') + '</h2>' +
                (r.drop && !r.drop.noDrop ? '<div class="loot-drop" id="gt-loot"></div>' : '<div class="gt-chips">' + R('coin', r.coinBase, { plus:true }) + R('xp', r.pr.xp, { plus:true }) + R('pass', r.pr.pass, { plus:true }) + '</div>') +
                (r.e.stake ? '<div class="gt-wagerbox"><h2 class="gt-h2">Wager</h2>' +
                    (r.wagerCoins ? '<div class="gt-wrow win"><span>Wager bonus x' + r.e.mult + '</span><b>' + R('coin', r.wagerCoins, { plus:true }) + '</b></div>' : '') +
                    '<div class="gt-wrow ' + (r.refund ? 'ok' : 'lost') + '"><span>' + (r.refund ? 'Stake returned' : 'Stake lost') + '</span><b>' + (r.refund ? R('coin', r.e.stake, { plus:true }) : '<span class="gt-neg">-' + r.e.stake.toLocaleString('en-US') + '</span>') + '</b></div>' +
                    '<p class="gt-fine">Wager coins are paid on top of the chest.</p></div>' : '') +
              '</div>' +
            '</div>' +
            '<div class="gt-cta two"><button class="gt-go" type="button" id="gt-again"><span>PLAY AGAIN</span></button><button class="gt-go ghost" type="button" id="gt-menu"><span>MAIN MENU</span></button></div>';
        show($('gt-result'));
        if (r.drop && !r.drop.noDrop) renderLootDrop('gt-loot', r.drop);
        $('gt-again').onclick = () => { hide($('gt-result')); leave(true); setTimeout(openEntry, 60); };
        $('gt-menu').onclick = () => { hide($('gt-result')); leave(true); };
        if (r.win) SFX.play('finish'); else if (r.reached === 0) SFX.play('fail');
    }

    /* ---------------------------------------------------------------- leaving ---- */
    function leave(toMenu) {
        const wasPlaying = !!gt;
        gt = null;
        window.GT_BG = null;
        if (qLevel >= 1 && gtPrevQ < qLevel) { qLevel = gtPrevQ; dprCap = QUALITY_STEPS[qLevel].dpr; glowK = QUALITY_STEPS[qLevel].glow; }
        WORLD_W = 356; resize();
        document.body.classList.remove('mode-gauntlet');
        hud.style.display = 'none'; rewardsBtn.style.display = 'none';
        for (const id of ['gt-stagecard', 'gt-banner', 'gt-out', 'gt-crownwin']) { const e = $(id); e.classList.remove('vis'); e.style.display = 'none'; }
        if (wasPlaying) { state = 'menu'; gameMode = 'race'; dragging = false; }
        if (toMenu) { refreshStartMeta(); showScreen('start'); }
    }
    window.gtLeave = leave;
    window.gtForfeit = function () {
        if (!gt) return;
        const lp = localP();
        if (lp && !lp.gone) {
            // players lower down than you were going to be cut first, so they rank below you
            const below = alivePlayers().filter(q => !q.local && q.y > lp.y).sort((a, b) => b.y - a.y);
            for (const q of below) { q.finished = true; q.gone = true; q.out = true; gt.out.push(q); }
            eliminate(lp, 'forfeit'); gt.localOutStage = gt.stage;
        }
        gt.phase = 'cut'; finishRun();
    };
    window.gtPauseMenu = function () {
        openPrompt('PAUSED', 'Forfeiting ends your run with the prize for your current stage.', [
            ['Resume', resumeRace],
            ['Settings', () => openSettings('pause'), true],
            ['Forfeit run', () => { showScreen(''); state = 'playing'; gtForfeit(); }, true],
        ]);
    };

    /* ---------------------------------------------------------- menu entry points ---- */
    GT.open = openEntry;
    GT.refreshHome = function () {
        const g = prog().gt, el = $('m-gt-sub'), tag = $('m-gt-tag'), pcard = $('p-gt-sub');
        const lock = !unlocked(), card = $('btn-gauntlet'); if (card) card.classList.toggle('locked', lock);
        if (el) el.textContent = lock ? 'Unlocks at level ' + UNLOCK_LEVEL : g.crowned ? 'You hold the crown' : '32 players · 3 stages';
        if (tag) { tag.innerHTML = g.crowned ? icon('crown') : icon('users'); }
        if (pcard) pcard.textContent = lock ? 'Reach level ' + UNLOCK_LEVEL + ' to play' : '3 stages, 1 crown';
    };
    GT.refreshHome();

    // test hooks (used by the QA scripts, harmless in play)
    GT.debug.state = () => gt;
    GT.debug.start = (entry) => startRun(entry || { type:'coins', stake:0, mult:1, bump:false });
    GT.debug.stages = STAGES;
    GT.debug.prizes = PRIZES;
    GT.debug.placeOf = placeOf;
    GT.debug.crown = (p) => { show($('gt-crownwin')); crownSpotlight(p); };
    // QA: jump straight to a screen. kind 'card' = knocked out by the wall in stage `reached`; 'result' = run over at `reached` (3 = crown)
    GT.debug.force = function (reached, kind) {
        if (!gt) return;
        const lp = gt.field[0];
        gt.stage = Math.min(2, reached); gt.st = STAGES[gt.stage];
        if (kind === 'card') { gt.phase = 'play'; setState('playing'); eliminate(lp, 'wall'); return; }
        gt.phase = 'cut';
        if (reached === 3) gt.winner = lp; else gt.localOutStage = reached;
        finishRun();
    };
})();
