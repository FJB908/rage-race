// Fullscreen supply-drop opening. Classic script, loaded AFTER game.js (uses its globals at call time).
//   openLootbox(drop, { title, onDone })
// drop = { coins, xp, passPoints, cosmetic|null, tier? }  — rewards are already granted; this only reveals them.
(function () {
    const TIERS = {
        common:    { name:'SUPPLY DROP',    charge:1.3 },
        rare:      { name:'RARE DROP',      charge:1.8 },
        epic:      { name:'EPIC DROP',      charge:2.3 },
        legendary: { name:'LEGENDARY DROP', charge:3.0 },
    };
    const TIER_COLOR = { common:'#35e0c8', rare:'#5b8def', epic:'#b3a9ff', legendary:'#ffcf3f' };
    const CHEST_SVG = (
        '<svg viewBox="0 0 200 170" aria-hidden="true"><defs>' +
        '<linearGradient id="lbBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a3142"/><stop offset="1" stop-color="#151a26"/></linearGradient>' +
        '<linearGradient id="lbLid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a4258"/><stop offset="1" stop-color="#232a3b"/></linearGradient>' +
        '<radialGradient id="lbGlow"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="var(--c)"/><stop offset="1" stop-color="var(--c)" stop-opacity="0"/></radialGradient></defs>' +
        '<ellipse cx="100" cy="160" rx="82" ry="8" fill="#000" opacity=".35"/>' +
        '<ellipse class="lb-inner" cx="100" cy="76" rx="70" ry="38" fill="url(#lbGlow)"/>' +
        '<rect x="22" y="74" width="156" height="82" rx="10" fill="url(#lbBody)" stroke="#0d1017" stroke-width="3"/>' +
        '<rect x="62" y="74" width="14" height="82" fill="var(--c2)"/><rect x="124" y="74" width="14" height="82" fill="var(--c2)"/>' +
        '<rect x="22" y="140" width="156" height="16" rx="6" fill="#0d1017" opacity=".35"/>' +
        '<rect class="lb-leak" x="24" y="70" width="152" height="8" rx="3" fill="var(--c)"/>' +
        '<g class="lb-lid"><path d="M18 76 V58 Q18 26 100 26 Q182 26 182 58 V76 Z" fill="url(#lbLid)" stroke="#0d1017" stroke-width="3"/>' +
        '<rect x="62" y="30" width="14" height="46" fill="var(--c2)"/><rect x="124" y="30" width="14" height="46" fill="var(--c2)"/>' +
        '<path d="M34 54 Q60 38 100 38" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="5" stroke-linecap="round"/>' +
        '<rect x="86" y="62" width="28" height="26" rx="6" fill="var(--c)" stroke="#0d1017" stroke-width="3"/><circle cx="100" cy="73" r="4" fill="#0d1017"/><rect x="98" y="73" width="4" height="9" rx="2" fill="#0d1017"/></g></svg>'
    );
    const sfx = (n, a) => { try { SFX.play(n, a); } catch (e) {} };
    const buzz = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

    function slotOf(item) {
        for (const k of ['skin', 'hat', 'face', 'trail']) if (COS_BY[k].some(i => i.id === item.id)) return k;
        return 'skin';
    }

    window.openLootbox = function (drop, opts) {
        opts = opts || {};
        if (document.getElementById('lootbox')) return;
        const cos = drop.cosmetic || null;
        const tier = TIERS[drop.tier] ? drop.tier : (cos ? cos.rarity : 'common');
        const T = TIERS[tier], color = TIER_COLOR[tier];
        let skipped = false, closed = false, raf = 0, shake = 0;
        const sleep = ms => skipped ? Promise.resolve() : wait(ms);

        const el = document.createElement('div');
        el.id = 'lootbox'; el.className = 'lb tier-' + tier;
        el.innerHTML = '<div class="lb-rays"></div><canvas class="lb-fx"></canvas><div class="lb-flash"></div>' +
            '<div class="lb-stage"><div class="lb-title">' + (opts.title || T.name) + '</div><div class="lb-chest">' + CHEST_SVG + '</div><div class="lb-hint">TAP THE CRATE TO OPEN</div></div>' +
            '<div class="lb-rewards"></div><button class="lb-skip" type="button">SKIP</button><button class="lb-btn" type="button">COLLECT</button>';
        document.body.appendChild(el);
        const $ = s => el.querySelector(s);
        const chest = $('.lb-chest'), stage = $('.lb-stage'), rewards = $('.lb-rewards'), flash = $('.lb-flash'), btn = $('.lb-btn'), skipBtn = $('.lb-skip');

        // ---- particles (one small canvas loop, only while open) ----
        const cv = $('.lb-fx'), g = cv.getContext('2d'), parts = [];
        let W = 0, H = 0;
        const fit = () => { const d = Math.min(window.devicePixelRatio || 1, 1.5); W = innerWidth; H = innerHeight; cv.width = W * d; cv.height = H * d; g.setTransform(d, 0, 0, d, 0, 0); };
        fit(); addEventListener('resize', fit);
        function emit(n, o) {
            for (let i = 0; i < n && parts.length < 260; i++) {
                const a = o.dir !== undefined ? o.dir + (Math.random() - .5) * o.spread : Math.random() * 6.283, s = o.speed * (.35 + Math.random() * .65);
                parts.push({ x:o.x, y:o.y, vx:Math.cos(a) * s, vy:Math.sin(a) * s, life:1, decay:.5 + Math.random() * .8, size:o.size * (.5 + Math.random()), g:o.g === undefined ? 900 : o.g, c:o.colors[i % o.colors.length], rot:Math.random() * 6, vr:(Math.random() - .5) * 12 });
            }
        }
        let lastT = performance.now();
        (function tick(t) {
            if (closed) return;
            const dt = Math.min(.05, (t - lastT) / 1000); lastT = t;
            g.clearRect(0, 0, W, H);
            let k = 0;
            for (const p of parts) {
                p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.life -= p.decay * dt;
                if (p.life <= 0) continue;
                parts[k++] = p;
                g.globalAlpha = Math.min(1, p.life * 1.6); g.fillStyle = p.c;
                g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * .6); g.restore();
            }
            parts.length = k; g.globalAlpha = 1;
            raf = requestAnimationFrame(tick);
        })(lastT);
        const chestPos = () => { const r = chest.getBoundingClientRect(); return { x:r.left + r.width / 2, y:r.top + r.height * .42 }; };
        const palette = [color, '#fff', '#ffcf3f', color, '#35e0c8'];
        const doShake = () => { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); };
        const doFlash = () => { flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go'); };

        function close() {
            if (closed) return; closed = true; cancelAnimationFrame(raf); removeEventListener('resize', fit);
            el.classList.remove('in');
            setTimeout(() => { el.remove(); if (opts.onDone) opts.onDone(); }, 350);
        }

        // ---- reveal helpers ----
        function addCard(label, value, c) {
            const d = document.createElement('div'); d.className = 'lb-card'; d.style.setProperty('--cc', c);
            d.innerHTML = '<small>' + label + '</small><b>+0</b>'; rewards.appendChild(d);
            void d.offsetWidth; d.classList.add('show');
            const b = d.querySelector('b'), steps = skipped ? 1 : 22; let i = 0;
            return new Promise(res => {
                const iv = setInterval(() => {
                    i++; b.textContent = '+' + Math.round(value * (1 - Math.pow(1 - i / steps, 3))).toLocaleString();
                    if (i % 3 === 0) sfx('coin');
                    if (i >= steps) { clearInterval(iv); res(); }
                }, 38);
            });
        }
        async function revealItem() {
            const slot = slotOf(cos), rc = RARITY[cos.rarity].color, big = cos.rarity === 'legendary' || cos.rarity === 'epic';
            el.style.setProperty('--c', rc);
            rewards.innerHTML = '';
            const head = document.createElement('div'); head.className = 'lb-head';
            head.textContent = RARITY[cos.rarity].label.toUpperCase() + '!'; rewards.appendChild(head);
            const it = document.createElement('div'); it.className = 'lb-item'; it.style.setProperty('--ic', rc);
            it.innerHTML = '<canvas width="400" height="400"></canvas><div class="rar">' + RARITY[cos.rarity].label.toUpperCase() + '</div><div class="nm">' + esc(cos.name) + '</div><div class="cat">' + slot.toUpperCase() + '</div><span class="new">NEW</span>' +
                (slot === 'trail' ? '<div style="display:flex;justify-content:center;margin-top:10px"><span class="trail-sample trail-' + cos.style + '" style="--trail-color:' + cos.color + '"><i></i><i></i><i></i></span></div>' : '');
            rewards.appendChild(it);
            try { renderLook(it.querySelector('canvas'), Object.assign(myLook(), { [slot]:cos.id }), { scale:.3, cy:.6 }); } catch (e) {}
            await sleep(350);
            doFlash(); doShake(); buzz(big ? [30, 40, 60] : 40); sfx('finish'); if (big) sfx('boost');
            el.classList.add('burst'); head.classList.add('show'); void it.offsetWidth; it.classList.add('show');
            emit(big ? 110 : 60, { x:W / 2, y:H * .45, speed:620, size:10, colors:[rc, '#fff', rc, '#ffcf3f'], g:500 });
            await sleep(900);
        }

        // ---- main sequence ----
        async function sequence() {
            el.classList.remove('ready'); el.classList.add('charging');
            const steps = Math.round(T.charge * 10);
            for (let i = 1; i <= steps && !skipped; i++) {
                const c = i / steps; el.style.setProperty('--charge', c.toFixed(2));
                if (i % 3 === 0) { sfx('count'); buzz(12 + c * 25); const p = chestPos(); emit(5, { x:p.x, y:p.y, speed:260, size:7, colors:[color, '#fff'], g:300 }); }
                await sleep(100);
            }
            el.classList.remove('charging'); el.style.setProperty('--charge', 1);
            doFlash(); doShake(); buzz([40, 30, 80]); sfx('shatter'); sfx('boost'); sfx('finish');
            el.classList.add('burst');
            const p = chestPos();
            emit(120, { x:p.x, y:p.y, dir:-Math.PI / 2, spread:2.4, speed:760, size:11, colors:palette, g:1100 });
            await sleep(1000);
            stage.classList.add('away');
            skipBtn.classList.add('show');
            await sleep(450);
            const head = document.createElement('div'); head.className = 'lb-head'; head.textContent = 'REWARDS'; rewards.appendChild(head);
            void head.offsetWidth; head.classList.add('show'); await sleep(250);
            if (drop.coins) await addCard('COINS', drop.coins, '#ffcf3f');
            if (drop.xp) await addCard('XP', drop.xp, '#35e0c8');
            if (drop.passPoints) await addCard('PASS POINTS', drop.passPoints, '#b3a9ff');
            await sleep(700);
            if (cos) { skipBtn.classList.remove('show'); await revealItem(); }
            skipBtn.classList.remove('show');
            btn.classList.add('show');
        }

        let started = false;
        const begin = () => { if (started || !el.classList.contains('ready')) return; started = true; sfx('count'); sequence(); };
        chest.addEventListener('pointerdown', begin);
        btn.addEventListener('click', () => { sfx('count'); close(); });
        skipBtn.addEventListener('click', () => { skipped = true; skipBtn.classList.remove('show'); });

        requestAnimationFrame(() => el.classList.add('in'));
        setTimeout(() => {
            const p = chestPos(); doShake(); buzz(35); sfx('land');
            emit(26, { x:p.x, y:p.y + chest.offsetHeight * .38, dir:-Math.PI / 2, spread:2.8, speed:300, size:7, colors:['#8b95a7', color], g:700 });
            el.classList.add('ready');
        }, 900);
    };
})();
