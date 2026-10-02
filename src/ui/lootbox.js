// Fullscreen supply-drop opening. Classic script, loaded AFTER game.js (uses its globals at call time).
//   openLootbox(drop, { title, onDone(finalDrop) })   interactive: tap the crate to shake it; each tap may level its rarity up or open it
//   showRewardPops(list, { head })                    just the reveal (icon + amount pops), list = [{type:'coin'|'xp'|'pass', n} | {type:'item', item}]
// drop = pending drop {id, pending:true, tier, base} (resolved with resolveDrop when it opens) or an already resolved drop.
(function () {
    const TIERS = ['common', 'rare', 'epic', 'legendary'];
    const TIER_NAME = { common:'SUPPLY DROP', rare:'RARE DROP', epic:'EPIC DROP', legendary:'LEGENDARY DROP' };
    const TIER_COLOR = { common:'#35e0c8', rare:'#5b8def', epic:'#b3a9ff', legendary:'#ffcf3f' };
    // Tap odds: the level-up chance shrinks with every tap, the open chance grows, so a drop always opens within a handful of taps.
    const UP0 = 0.5, UP_DECAY = 0.62, OPEN0 = 0.16, OPEN_STEP = 0.12;
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
    window.LB_CHEST_SVG = CHEST_SVG;
    const sfx = (n, a) => { try { SFX.play(n, a); } catch (e) {} };
    const buzz = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
    function slotOf(item) { for (const k of ['skin', 'hat', 'face', 'trail']) if (COS_BY[k].some(i => i.id === item.id)) return k; return 'skin'; }

    // Shared overlay + particle layer ------------------------------------------------------------
    function makeOverlay(tier, inner) {
        const el = document.createElement('div');
        el.id = 'lootbox'; el.className = 'lb tier-' + tier;
        el.innerHTML = '<div class="lb-rays"></div><canvas class="lb-fx"></canvas><div class="lb-flash"></div>' + inner + '<div class="lb-pops"></div><button class="lb-skip" type="button">SKIP</button><button class="lb-btn" type="button">COLLECT</button>';
        document.body.appendChild(el);
        const cv = el.querySelector('.lb-fx'), g = cv.getContext('2d'), parts = [];
        let W = 0, H = 0, raf = 0, closed = false;
        const fit = () => { const d = Math.min(window.devicePixelRatio || 1, 1.5); W = innerWidth; H = innerHeight; cv.width = W * d; cv.height = H * d; g.setTransform(d, 0, 0, d, 0, 0); };
        fit(); addEventListener('resize', fit);
        const api = {
            el, $: s => el.querySelector(s), get W() { return W; }, get H() { return H; }, get closed() { return closed; },
            emit(n, o) {
                for (let i = 0; i < n && parts.length < 260; i++) {
                    const a = o.dir !== undefined ? o.dir + (Math.random() - .5) * o.spread : Math.random() * 6.283, s = o.speed * (.35 + Math.random() * .65);
                    parts.push({ x:o.x, y:o.y, vx:Math.cos(a) * s, vy:Math.sin(a) * s, life:1, decay:.5 + Math.random() * .8, size:o.size * (.5 + Math.random()), g:o.g === undefined ? 900 : o.g, c:o.colors[i % o.colors.length], rot:Math.random() * 6, vr:(Math.random() - .5) * 12 });
                }
            },
            shake() { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); },
            flash() { const f = el.querySelector('.lb-flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); },
            close(cb) { if (closed) return; closed = true; cancelAnimationFrame(raf); removeEventListener('resize', fit); el.classList.remove('in'); setTimeout(() => { el.remove(); if (cb) cb(); }, 350); },
        };
        let lastT = performance.now();
        (function tick(t) {
            if (closed) return;
            const dt = Math.min(.05, (t - lastT) / 1000); lastT = t; g.clearRect(0, 0, W, H);
            let k = 0;
            for (const p of parts) {
                p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.life -= p.decay * dt;
                if (p.life <= 0) continue; parts[k++] = p;
                g.globalAlpha = Math.min(1, p.life * 1.6); g.fillStyle = p.c; g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * .6); g.restore();
            }
            parts.length = k; g.globalAlpha = 1; raf = requestAnimationFrame(tick);
        })(lastT);
        requestAnimationFrame(() => el.classList.add('in'));
        return api;
    }

    // Reward pops: an icon with an amount next to it (no windows) -------------------------------
    function countUp(node, value, skipped) {
        const steps = skipped() ? 1 : 22; let i = 0;
        return new Promise(res => { const iv = setInterval(() => { i++; node.textContent = '+' + Math.round(value * (1 - Math.pow(1 - i / steps, 3))).toLocaleString(); if (i % 4 === 0) sfx('coin'); if (i >= steps) { clearInterval(iv); res(); } }, 36); });
    }
    async function revealRewards(o, final, skipped) {
        const pops = o.$('.lb-pops'), sleep = ms => skipped() ? Promise.resolve() : wait(ms);
        const row = document.createElement('div'); row.className = 'lb-row'; pops.appendChild(row);
        for (const [kind, n] of [['coin', final.coins], ['xp', final.xp], ['pass', final.passPoints], ['gem', final.gems]]) {
            if (!n) continue;
            const d = document.createElement('div'); d.className = 'lb-pop pop-' + kind; d.innerHTML = icon(kind) + '<b>+0</b>'; row.appendChild(d); void d.offsetWidth; d.classList.add('show');
            sfx('item'); const r = d.getBoundingClientRect(); o.emit(10, { x:r.left + 28, y:r.top + 28, speed:260, size:7, colors:kind === 'coin' ? ['#ffcf3f', '#fff3b0'] : kind === 'xp' ? ['#6cc4ff', '#bfe9ff'] : kind === 'gem' ? ['#ff6fd8', '#ffe0f8'] : ['#b3a9ff', '#e4defd'], g:500 });
            await countUp(d.querySelector('b'), n, skipped); await sleep(160);
        }
        const cos = final.cosmetic;
        if (cos) {
            await sleep(350);
            const slot = slotOf(cos), rc = RARITY[cos.rarity].color, big = cos.rarity === 'legendary' || cos.rarity === 'epic';
            o.el.style.setProperty('--c', rc);
            const it = document.createElement('div'); it.className = 'lb-itempop'; it.style.setProperty('--ic', rc);
            it.innerHTML = '<i class="glow"></i><canvas width="440" height="440"></canvas><div class="rar">' + (cos.premium ? icon('gem') + ' PREMIUM' : RARITY[cos.rarity].label.toUpperCase()) + '</div><div class="nm">' + esc(cos.name) + '</div><span class="new">NEW</span>' +
                (slot === 'trail' ? '<canvas class="trp" width="320" height="100"></canvas>' : '');
            pops.appendChild(it);
            try { renderLook(it.querySelector('canvas'), Object.assign(myLook(), { [slot]:cos.id }), { scale:.3, cy:.6 }); } catch (e) {}
            if (slot === 'trail') try { drawTrailPreview(it.querySelector('canvas.trp'), cos); } catch (e) {}
            void it.offsetWidth; o.flash(); o.shake(); buzz(big ? [30, 40, 60] : 40); sfx('finish'); if (big) sfx('boost');
            o.el.classList.add('burst'); it.classList.add('show');
            o.emit(big ? 110 : 60, { x:o.W / 2, y:o.H * .5, speed:620, size:10, colors:[rc, '#fff', rc, '#ffcf3f'], g:500 });
            await sleep(700);
        }
    }

    // "Equip now" for a cosmetic you just got
    function addEquip(o, cos) {
        const slot = slotOf(cos), b = document.createElement('button');
        b.type = 'button'; b.className = 'lb-equip'; b.innerHTML = 'EQUIP NOW';
        o.el.appendChild(b); void b.offsetWidth; b.classList.add('show');
        b.onclick = () => {
            const q = prog(); q[slot] = cos.id; saveProg(q); sfx('item'); buzz(25);
            b.classList.add('done'); b.disabled = true; b.innerHTML = icon('check') + ' EQUIPPED';
            try { refreshMenu(); } catch (e) {}
        };
    }

    // Pop-only overlay (pass rewards etc.) -------------------------------------------------------
    window.showRewardPops = function (list, opts) {
        opts = opts || {};
        return new Promise(res => {
            if (document.getElementById('lootbox')) return res();
            const tier = opts.tier || 'common', o = makeOverlay(tier, '');
            let skipped = false; const btn = o.$('.lb-btn');
            const final = { coins:0, xp:0, passPoints:0, gems:0, cosmetic:null };
            for (const r of list) { if (r.type === 'coin') final.coins += r.n; else if (r.type === 'xp') final.xp += r.n; else if (r.type === 'pass') final.passPoints += r.n; else if (r.type === 'gem') final.gems += r.n; else if (r.type === 'item') final.cosmetic = r.item; }
            o.el.classList.add('burst'); o.flash(); sfx('finish');
            revealRewards(o, final, () => skipped).then(() => { btn.classList.add('show'); if (final.cosmetic) addEquip(o, final.cosmetic); });
            o.$('.lb-skip').onclick = () => { skipped = true; };
            btn.onclick = () => { sfx('count'); o.close(res); };
        });
    };

    // The interactive crate ----------------------------------------------------------------------
    window.openLootbox = function (drop, opts) {
        opts = opts || {};
        if (document.getElementById('lootbox')) return;
        let tier = TIERS.includes(drop.tier) ? drop.tier : 'common';
        const pending = !!drop.pending;
        const o = makeOverlay(tier,
            '<div class="lb-stage"><div class="lb-title"></div><div class="lb-chest">' + CHEST_SVG + '<div class="lb-ring"></div></div>' +
            '<div class="lb-pips">' + TIERS.map(() => '<i></i>').join('') + '</div><div class="lb-luck"><i></i></div><div class="lb-hint">TAP</div></div>');
        const el = o.el, chest = o.$('.lb-chest'), stage = o.$('.lb-stage'), title = o.$('.lb-title'), pips = [...el.querySelectorAll('.lb-pips i')], luck = o.$('.lb-luck i'), btn = o.$('.lb-btn'), skipBtn = o.$('.lb-skip');
        let taps = 0, busy = true, opened = false, skipped = false;
        const chestPos = () => { const r = chest.getBoundingClientRect(); return { x:r.left + r.width / 2, y:r.top + r.height * .42 }; };
        const upChance = () => tier === 'legendary' ? 0 : UP0 * Math.pow(UP_DECAY, taps);
        const paint = () => {
            TIERS.forEach(t => el.classList.remove('tier-' + t)); el.classList.add('tier-' + tier);
            title.textContent = TIER_NAME[tier];
            pips.forEach((p, i) => { p.className = i <= TIERS.indexOf(tier) ? 'on' : ''; p.style.setProperty('--pc', TIER_COLOR[TIERS[i]]); });
            luck.style.width = Math.round(upChance() / UP0 * 100) + '%'; luck.parentNode.style.opacity = tier === 'legendary' ? 0 : 1;
        };
        paint();

        async function open() {
            opened = true; busy = true;
            const final = pending ? (resolveDrop(drop.id, tier) || drop) : drop;
            const ft = final.tier || tier; if (ft !== tier) { tier = ft; paint(); }
            el.classList.remove('ready', 'tapped'); o.flash(); o.shake(); buzz([40, 30, 80]); sfx('shatter'); sfx('boost'); sfx('finish');
            el.classList.add('burst'); el.style.setProperty('--charge', 1);
            const p = chestPos(); o.emit(120, { x:p.x, y:p.y, dir:-Math.PI / 2, spread:2.4, speed:760, size:11, colors:[TIER_COLOR[tier], '#fff', '#ffcf3f', '#35e0c8'], g:1100 });
            await wait(skipped ? 100 : 850);
            stage.classList.add('away'); skipBtn.classList.add('show'); await wait(skipped ? 50 : 350);
            await revealRewards(o, final, () => skipped);
            skipBtn.classList.remove('show'); btn.classList.add('show'); if (final.cosmetic) addEquip(o, final.cosmetic);
            btn.onclick = () => { sfx('count'); o.close(() => { if (opts.onDone) opts.onDone(final); }); };
        }
        async function tap() {
            if (busy || opened) return; busy = true;
            const n = taps; taps++;
            el.style.setProperty('--amp', Math.min(1.8, .7 + n * .25).toFixed(2));
            chest.classList.remove('tap'); void chest.offsetWidth; chest.classList.add('tap');
            el.style.setProperty('--charge', Math.min(.9, .12 + n * .12).toFixed(2));
            sfx('count'); buzz(18 + n * 6);
            const p = chestPos(); o.emit(6, { x:p.x, y:p.y, speed:240, size:6, colors:[TIER_COLOR[tier], '#fff'], g:300 });
            await wait(300); chest.classList.remove('tap');
            const up = tier !== 'legendary' && Math.random() < UP0 * Math.pow(UP_DECAY, n);
            if (up) {
                tier = TIERS[TIERS.indexOf(tier) + 1]; paint();
                o.flash(); o.shake(); buzz([30, 30, 50]); sfx('boost'); sfx('finish');
                const ring = o.$('.lb-ring'); ring.classList.remove('go'); void ring.offsetWidth; ring.classList.add('go');
                const q = chestPos(); o.emit(60, { x:q.x, y:q.y, speed:520, size:9, colors:[TIER_COLOR[tier], '#fff'], g:300 });
                title.classList.remove('pop'); void title.offsetWidth; title.classList.add('pop');
                await wait(420); busy = false; return;
            }
            if (Math.random() < Math.min(1, OPEN0 + OPEN_STEP * n)) { await open(); return; }
            luck.style.width = Math.round(upChance() / UP0 * 100) + '%';
            busy = false;
        }
        chest.addEventListener('pointerdown', tap);
        skipBtn.onclick = () => { skipped = true; skipBtn.classList.remove('show'); };
        setTimeout(() => { const p = chestPos(); o.shake(); buzz(35); sfx('land'); o.emit(26, { x:p.x, y:p.y + chest.offsetHeight * .38, dir:-Math.PI / 2, spread:2.8, speed:300, size:7, colors:['#8b95a7', TIER_COLOR[tier]], g:700 }); el.classList.add('ready'); busy = false; }, 900);
    };
})();
