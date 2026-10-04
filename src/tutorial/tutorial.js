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
        { x:200, gap:172, w:118, type:'normal' },
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
        { hint:'none', text:'Good. A boost ledge is coming' },
        { hint:'none', text:'Land on the boost ledge to charge your jump' },
        { hint:'pull', text:'Pull hard for the big gap' },
    ];
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
            platforms.push(b); needsBoost = s.type === 'boost'; prev = b;
        }
        platforms.push({ x:pw / 2, y:prev.y - 150, w:pw, h:40, type:'finish', active:true, quakeWarn:0, quakeDown:0 });
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
    function show(stepIdx) {
        if (stepIdx === shownStep) return; shownStep = stepIdx;
        const s = stepIdx < 0 ? null : LESSONS[stepIdx];
        if (!s) { root.hidden = true; return; }
        root.hidden = false; textEl.textContent = s.text;
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
            lvStart(0);
            document.body.classList.add('mode-tutorial');
        },
        // called every frame from updateLevel while the tutorial runs
        update(lp) {
            if (!active || !lp) return;
            if (state === 'countdown') { show(0); return; }
            if (state !== 'playing') { return; }
            if (lp.mode === 'air' && !lp.plat) { root.hidden = true; shownStep = -2; return; }
            const k = platforms.indexOf(lp.plat);                      // 0 = the ground
            show(k >= 0 && k < LESSONS.length ? k : -1);
        },
        finish(p) {
            active = false; root.hidden = true; document.body.classList.remove('mode-tutorial');
            const first = !isDone();
            try { localStorage.setItem(DONE_KEY, '1'); } catch (e) {}
            const R_ = TUTORIAL_CONFIG.reward || { coins:150, xp:60 };
            setTimeout(async () => {
                hud.style.display = 'none'; state = 'menu'; gameMode = 'race'; curDim = 0; lv = null;
                document.body.classList.remove('mode-escape', 'mode-parkour', 'mode-level');
                if (first) { addCoins(R_.coins); addXp(R_.xp); }
                refreshStartMeta(); showScreen('start');
                if (first) await showRewardPops([{ type:'coin', n:R_.coins }, { type:'xp', n:R_.xp }]);
                refreshMenu();
            }, 900);
        },
        stop() { active = false; root.hidden = true; document.body.classList.remove('mode-tutorial'); },
    };

    // settings button
    const btn = document.getElementById('set-tutorial');
    if (btn) btn.addEventListener('click', () => { Tutorial.start(); });

    // optional auto-start for brand-new players (off until launch)
    window.addEventListener('load', () => { try { if (TUTORIAL_CONFIG.autoStart && !isDone() && prog().races === 0) setTimeout(() => Tutorial.start(), 600); } catch (e) {} });
})();
