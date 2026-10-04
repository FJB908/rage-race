// Tutorial level. Self-contained so it can be switched on when the game launches.
//
//   TUTORIAL_CONFIG.autoStart = false   // set true to start it automatically for brand-new players (0 races played)
//   Until then it is reachable from Settings > "Play tutorial", or from the console: Tutorial.start()
//
// It reuses the game's "level" mode through a hidden dimension, so the physics and platforms are the real ones.
// Loaded AFTER game.js.
(function () {
    window.TUTORIAL_CONFIG = window.TUTORIAL_CONFIG || { autoStart:false, reward:{ coins:150, xp:60 } };
    const DONE_KEY = 'rr_tutorial_done';
    const isDone = () => { try { return localStorage.getItem(DONE_KEY) === '1'; } catch (e) { return false; } };

    // ---- the level: hand-placed so every platform teaches exactly one thing -------------------
    // Each entry: x (centre), gap (vertical distance above the previous platform), w, type, and the lesson shown while standing on it.
    const PLAN = [
        { x:178, gap:170, w:150, type:'normal' },
        { x:92,  gap:178, w:120, type:'normal' },
        { x:200, gap:182, w:104, type:'moving' },
        { x:236, gap:178, w:140, type:'ice' },
        { x:128, gap:176, w:104, type:'fragile' },
        { x:200, gap:172, w:118, type:'normal', box:true },        // a power-up cube floats above this one
        { x:176, gap:170, w:150, type:'normal', ceiling:true },    // sealed underneath: jump up through it
        { x:170, gap:176, w:118, type:'boost' },
        { x:190, gap:352, w:156, type:'normal' },
    ];
    // Lesson shown while standing on platform k (0 = the ground): it prepares the jump to platform k+1.
    const LESSONS = [
        { hint:'pull', text:'Pull back and let go to jump' },
        { hint:'aim',  text:'Aim sideways to reach the next ledge' },
        { hint:'wait', text:'Wait for the moving ledge, then jump' },
        { hint:'none', text:'Ice ahead. It is slippery' },
        { hint:'none', text:'The next ledge crumbles. Keep moving' },
        { hint:'none', text:'Next: a glowing power-up cube. Fly into it!' },
        { hint:'none', text:'DYN' },                                            // item or sealed ledge, see dynText()
        { hint:'none', text:'Land on the boost ledge to charge your jump' },
        { hint:'pull', text:'Pull hard for the big gap' },
    ];
    let gotItem = false, usedItem = false;
    function dynText(lp) {
        if (lp.item && !usedItem) { gotItem = true; return 'Tap the item button (bottom left) to use it'; }
        if (gotItem && !usedItem) usedItem = true;
        const cp = platforms.find(pl => pl.tutCeiling);
        if (cp && cp.ceilingBroken) return 'Shattered! Now jump up and land on it';
        if (!gotItem) return 'Missed the cube? It comes back. Or jump on';
        return 'A sealed ledge! Jump up through it to shatter it';
    }
    function build() {
        const pw = PLAY_W();
        platforms = []; itemBoxes = []; finishPlatform = null;
        const ground = { x:pw / 2, y:START_Y, w:pw, h:40, type:'normal', active:true, ground:true, quakeWarn:0, quakeDown:0, range:0, baseX:pw / 2 };
        platforms.push(ground);
        let prev = ground, needsBoost = false;
        for (const s of PLAN) {
            const b = { x:s.x, y:prev.y - s.gap, w:s.w, h:18, type:s.type, speed:0, dir:1, active:true, breaking:false, breakT:0, respawn:0, baseX:s.x, range:0, boostReady:true, quakeWarn:0, quakeDown:0 };
            if (s.type === 'moving') { b.speed = 62; b.range = 56; b.baseX = s.x; }
            const mult = needsBoost ? BOOST_MULT : 1;
            let guard = 0; while (!lvPairOK(prev, b, mult) && guard++ < 60) { if (guard < 30) { b.x += (prev.x - b.x) * 0.2; b.baseX = b.x; } else b.y += 8; }
            if (s.ceiling) { b.ceiling = true; b.tutCeiling = true; }
            platforms.push(b); needsBoost = s.type === 'boost'; prev = b;
            if (s.box) itemBoxes.push(makeBox(b.x, b.y - 9 - 44, false));
        }
        platforms.push({ x:pw / 2, y:prev.y - 150, w:pw, h:40, type:'finish', active:true, quakeWarn:0, quakeDown:0 });
        gotItem = false; usedItem = false;
    }
    const LEVEL = { name:'Tutorial', color:'#35e0c8', seed:1, pattern:'', gap:[160, 170], width:[90, 100], shift:[0, 0], par3:90, par2:180, tutorial:true, build };
    DIMENSIONS.push({ key:'rr_tutorial_hidden', name:'Tutorial', unlockStars:Infinity, bg:'#0d1017', levels:[LEVEL], tutorial:true, hidden:true });

    // ---- coach overlay (gesture hand + one short line) ----------------------------------------
    const root = document.createElement('div');
    root.id = 'tut'; root.hidden = true;
    root.innerHTML = '<div class="tut-gesture"><svg class="tut-arrow" viewBox="0 0 60 60" aria-hidden="true"><path d="M30 52V10M14 26L30 10l16 16" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg><i class="tut-finger"></i></div><div class="tut-text"></div><div class="tut-dots"></div>';
    document.body.appendChild(root);
    const textEl = root.querySelector('.tut-text'), dotsEl = root.querySelector('.tut-dots'), gest = root.querySelector('.tut-gesture');
    let shownStep = -2, active = false;
    const GESTURE = { pull:{ dx:0, dy:62, ang:0 }, aim:{ dx:44, dy:56, ang:-38 }, wait:{ dx:0, dy:62, ang:0 } };
    let shownText = '';
    function show(stepIdx, dyn) {
        const text = stepIdx >= 0 && dyn ? dyn : (stepIdx >= 0 ? LESSONS[stepIdx].text : '');
        if (stepIdx === shownStep && text === shownText) return; shownStep = stepIdx; shownText = text;
        const s = stepIdx < 0 ? null : LESSONS[stepIdx];
        if (!s) { root.hidden = true; return; }
        root.hidden = false; textEl.textContent = text;
        dotsEl.innerHTML = LESSONS.map((_, i) => '<i class="' + (i < stepIdx ? 'done' : i === stepIdx ? 'now' : '') + '"></i>').join('');
        const g = GESTURE[s.hint]; gest.style.display = g ? '' : 'none';
        if (g) { gest.style.setProperty('--dx', g.dx + 'px'); gest.style.setProperty('--dy', g.dy + 'px'); gest.querySelector('.tut-arrow').style.transform = 'rotate(' + g.ang + 'deg)'; gest.classList.remove('go'); void gest.offsetWidth; gest.classList.add('go'); }
        textEl.classList.remove('pop'); void textEl.offsetWidth; textEl.classList.add('pop');
    }

    window.Tutorial = {
        get done() { return isDone(); },
        start() {
            curDim = DIMENSIONS.findIndex(d => d.tutorial); active = true; shownStep = -2;
            if (qLevel > 0) { qLevel = 0; dprCap = QUALITY_STEPS[0].dpr; glowK = QUALITY_STEPS[0].glow; resize(); }      // always the crisp look in the tutorial
            window.TUT_ITEM = 'giant';
            lvStart(0);
            document.body.classList.add('mode-tutorial');
        },
        // called every frame from updateLevel while the tutorial runs
        update(lp) {
            if (!active || !lp) return;
            if (state === 'countdown') { show(0, null); return; }
            if (state !== 'playing') { return; }
            if (lp.mode === 'air' && !lp.plat) { root.hidden = true; shownStep = -2; return; }
            const k = platforms.indexOf(lp.plat);                      // 0 = the ground
            show(k >= 0 && k < LESSONS.length ? k : -1, k >= 0 && k < LESSONS.length && LESSONS[k].text === 'DYN' ? dynText(lp) : null);
        },
        finish(p) {
            active = false; window.TUT_ITEM = null; root.hidden = true; document.body.classList.remove('mode-tutorial');
            const first = !isDone();
            try { localStorage.setItem(DONE_KEY, '1'); } catch (e) {}
            const R_ = TUTORIAL_CONFIG.reward || { coins:150, xp:60 };
            setTimeout(() => {
                hud.style.display = 'none'; state = 'menu'; gameMode = 'race'; curDim = 0; lv = null;
                document.body.classList.remove('mode-escape', 'mode-parkour', 'mode-level');
                refreshStartMeta(); showScreen('start'); refreshMenu();
                if (!first) return;
                // well done: a card that hands over the first chest
                const el = document.createElement('div'); el.id = 'tut-done';
                el.innerHTML = '<div class="td-card"><div class="td-ico">' + (window.LB_CHEST ? LB_CHEST('td', 'rare') : '') + '</div><small>TUTORIAL COMPLETE</small><h2>Well done!</h2><p>Here is your first chest. Open it to see what is inside.</p><button type="button">OPEN CHEST</button></div>';
                document.body.appendChild(el); requestAnimationFrame(() => el.classList.add('in'));
                try { SFX.play('finish'); } catch (e) {}
                el.querySelector('button').onclick = () => {
                    el.classList.remove('in'); setTimeout(() => el.remove(), 250);
                    const drop = awardLootDrop(newLootId('tutorial'), { coins:R_.coins, xp:R_.xp, passPoints:0 }, { tier:'rare' });
                    openLootbox(drop, { title:'YOUR FIRST CHEST', onDone:() => { refreshMenu(); } });
                };
            }, 900);
        },
        stop() { active = false; window.TUT_ITEM = null; root.hidden = true; document.body.classList.remove('mode-tutorial'); },
    };

    // settings button
    const btn = document.getElementById('set-tutorial');
    if (btn) btn.addEventListener('click', () => { Tutorial.start(); });

    // optional auto-start for brand-new players (off until launch)
    window.addEventListener('load', () => { try { if (TUTORIAL_CONFIG.autoStart && !isDone() && prog().races === 0) setTimeout(() => Tutorial.start(), 600); } catch (e) {} });
})();
