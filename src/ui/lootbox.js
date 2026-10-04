// Fullscreen supply-drop opening. Classic script, loaded AFTER game.js (uses its globals at call time).
//   openLootbox(drop, { title, onDone(finalDrop) })   interactive: tap the crate to shake it; each tap may level its rarity up or open it
//   showRewardPops(list, { head })                    just the reveal (icon + amount pops), list = [{type:'coin'|'xp'|'pass', n} | {type:'item', item}]
// drop = pending drop {id, pending:true, tier, base} (resolved with resolveDrop when it opens) or an already resolved drop.
(function () {
    const TIERS = ['common', 'rare', 'epic', 'legendary'];
    const TIER_NAME = { common:'CHEST', rare:'RARE CHEST', epic:'EPIC CHEST', legendary:'LEGENDARY CHEST' };
    const TIER_COLOR = { common:'#35e0c8', rare:'#5b8def', epic:'#b3a9ff', legendary:'#ffcf3f' };
    // Tap odds: the level-up chance shrinks with every tap, the open chance grows, so a drop always opens within a handful of taps.
    const UP0 = 0.45, UP_DECAY = 0.58, UP_TIER = [1, 0.8, 0.16], OPEN0 = 0.16, OPEN_STEP = 0.12;
    // The supply crate: a heavy steel cube like the players themselves. Glowing tier-coloured bands, the climbing chevrons on the front,
    // a jewel lock, and a light that leaks through the seam. `uid` keeps gradient ids unique when several crates are on screen.
    // Rarer crates get more detail, not just another colour: common is plain steel with a stud, rare adds a jewel and rivets,
    // epic adds corner caps, runes and a cut gem, legendary adds a gold rim, a crown on the lid and light rays.
    const buildChest = (uid, tier) => {
        const T = { common:0, rare:1, epic:2, legendary:3 }[tier] || 0, k = uid || '';
        const dark = '#0b0e16';
        const rays = '';                              // no light rays behind any chest (legendary used to have them)
        const crown = T === 3 ? '<path d="M46 42 L54 14 L76 34 L100 6 L124 34 L146 14 L154 42 Z" fill="var(--c)" stroke="' + dark + '" stroke-width="3" stroke-linejoin="round"/><g fill="#fff"><circle cx="54" cy="15" r="3.4"/><circle cx="100" cy="7" r="4"/><circle cx="146" cy="15" r="3.4"/></g>' : '';
        const rivets = T >= 1 ? '<g fill="' + dark + '" opacity=".75"><circle cx="54" cy="98" r="2.6"/><circle cx="54" cy="152" r="2.6"/><circle cx="146" cy="98" r="2.6"/><circle cx="146" cy="152" r="2.6"/><circle cx="30" cy="62" r="3"/><circle cx="170" cy="62" r="3"/></g>' : '';
        const caps = T >= 2 ? '<path d="M24 108 V100 Q24 88 36 88 H44 M176 108 V100 Q176 88 164 88 H156 M24 146 V154 Q24 166 36 166 H44 M176 146 V154 Q176 166 164 166 H156" fill="none" stroke="var(--c)" stroke-width="5" stroke-linecap="round"/>' +
            '<g stroke="#fff" stroke-opacity=".7" stroke-width="2" stroke-linecap="round"><path d="M54 110 V122 M54 130 V138"/><path d="M146 110 V122 M146 130 V138"/></g>' : '';
        const rim = T === 3 ? '<rect x="22" y="86" width="156" height="80" rx="18" fill="none" stroke="var(--c)" stroke-opacity=".85" stroke-width="2.2"/>' : '';
        const lidRim = T === 3 ? '<rect x="16" y="38" width="168" height="52" rx="22" fill="none" stroke="var(--c)" stroke-opacity=".85" stroke-width="2.2"/>' : '';
        const lock = T === 0 ? '<rect x="80" y="54" width="40" height="30" rx="11" fill="' + dark + '" opacity=".6"/><circle cx="100" cy="69" r="7" fill="#5c6a8c" stroke="' + dark + '" stroke-width="2.5"/><circle cx="98" cy="67" r="2" fill="#fff" opacity=".6"/>'
            : T === 1 ? '<rect x="80" y="54" width="40" height="30" rx="11" fill="' + dark + '" opacity=".7"/><circle cx="100" cy="68" r="11" fill="url(#lbGem' + k + ')" stroke="' + dark + '" stroke-width="2.5"/><circle cx="96" cy="64" r="3" fill="#fff" opacity=".9"/>'
            : '<rect x="76" y="50" width="48" height="36" rx="13" fill="' + dark + '" opacity=".75"/><path d="M100 53 L115 68 L100 83 L85 68 Z" fill="url(#lbGem' + k + ')" stroke="' + (T === 3 ? '#fff' : dark) + '" stroke-opacity="' + (T === 3 ? '.7' : '1') + '" stroke-width="2.6" stroke-linejoin="round"/><path d="M92 64 L100 58 L104 62" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="2.4" stroke-linecap="round"/>';
        const sparks = '<g class="lb-sparks" fill="#fff"><path class="sp s1" d="M20 40 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2z"/><path class="sp s2" d="M180 30 l1.6 5 5 1.6 -5 1.6 -1.6 5 -1.6 -5 -5 -1.6 5 -1.6z"/><path class="sp s3" d="M186 110 l1.4 4 4 1.4 -4 1.4 -1.4 4 -1.4 -4 -4 -1.4 4 -1.4z"/>' + (T >= 2 ? '<path class="sp s2" d="M12 120 l1.4 4 4 1.4 -4 1.4 -1.4 4 -1.4 -4 -4 -1.4 4 -1.4z"/>' : '') + (T === 3 ? '<path class="sp s1" d="M150 4 l1.6 5 5 1.6 -5 1.6 -1.6 5 -1.6 -5 -5 -1.6 5 -1.6z"/><path class="sp s3" d="M40 6 l1.4 4 4 1.4 -4 1.4 -1.4 4 -1.4 -4 -4 -1.4 4 -1.4z"/>' : '') + '</g>';
        return (
        '<svg viewBox="0 0 200 180" aria-hidden="true"><defs>' +
        '<linearGradient id="lbBody' + k + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#46526f"/><stop offset=".45" stop-color="#2a3350"/><stop offset="1" stop-color="#151a2b"/></linearGradient>' +
        '<linearGradient id="lbLid' + k + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6b7ba3"/><stop offset=".5" stop-color="#43506f"/><stop offset="1" stop-color="#2b3550"/></linearGradient>' +
        '<linearGradient id="lbBand' + k + '" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="var(--c2)"/><stop offset=".5" stop-color="var(--c)"/><stop offset="1" stop-color="var(--c2)"/></linearGradient>' +
        '<radialGradient id="lbGem' + k + '" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="var(--c)"/><stop offset="1" stop-color="var(--c2)"/></radialGradient>' +
        '<radialGradient id="lbGlow' + k + '"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="var(--c)"/><stop offset="1" stop-color="var(--c)" stop-opacity="0"/></radialGradient>' +
        '<linearGradient id="lbShine' + k + '" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
        '<clipPath id="lbClip' + k + '"><rect x="22" y="86" width="156" height="80" rx="18"/><rect x="16" y="38" width="168" height="52" rx="22"/></clipPath></defs>' +
        rays +
        '<ellipse cx="100" cy="170" rx="80" ry="7" fill="#000" opacity=".4"/>' +
        '<ellipse class="lb-inner" cx="100" cy="76" rx="70" ry="38" fill="url(#lbGlow' + k + ')"/>' +
        '<rect x="22" y="86" width="156" height="80" rx="18" fill="url(#lbBody' + k + ')" stroke="' + dark + '" stroke-width="3.5"/>' + rim +
        '<path d="M30 100 Q30 90 40 90 H160 Q170 90 170 100" fill="none" stroke="#fff" stroke-opacity=".14" stroke-width="3" stroke-linecap="round"/>' +
        '<rect x="22" y="146" width="156" height="20" rx="12" fill="' + dark + '" opacity=".4"/>' +
        '<rect x="46" y="86" width="16" height="76" fill="url(#lbBand' + k + ')" stroke="' + dark + '" stroke-width="2.5"/><rect x="138" y="86" width="16" height="76" fill="url(#lbBand' + k + ')" stroke="' + dark + '" stroke-width="2.5"/>' +
        caps + rivets +
        '<path d="M76 134 L100 110 L124 134 M76 150 L100 126 L124 150" fill="none" stroke="' + dark + '" stroke-width="15" stroke-linecap="round" stroke-linejoin="round" transform="translate(0 -4)"/>' +
        '<path d="M76 134 L100 110 L124 134 M76 150 L100 126 L124 150" fill="none" stroke="var(--c)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" transform="translate(0 -4)"/>' +
        '<path d="M80 130 L100 110 L120 130" fill="none" stroke="#fff" stroke-opacity=".65" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" transform="translate(0 -7)"/>' +
        '<rect class="lb-leak" x="26" y="82" width="148" height="8" rx="4" fill="var(--c)"/>' +
        '<g class="lb-lid">' + crown + '<rect x="16" y="38" width="168" height="52" rx="22" fill="url(#lbLid' + k + ')" stroke="' + dark + '" stroke-width="3.5"/>' + lidRim +
        '<path d="M32 54 Q46 44 86 44" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="5" stroke-linecap="round"/>' +
        '<rect x="46" y="38" width="16" height="52" fill="url(#lbBand' + k + ')" stroke="' + dark + '" stroke-width="2.5"/><rect x="138" y="38" width="16" height="52" fill="url(#lbBand' + k + ')" stroke="' + dark + '" stroke-width="2.5"/>' +
        '<rect x="20" y="76" width="160" height="8" rx="4" fill="var(--c)" opacity=".9"/>' + lock +
        (T === 0 ? '<g fill="' + dark + '" opacity=".6"><circle cx="30" cy="62" r="3"/><circle cx="170" cy="62" r="3"/></g>' : '') + '</g>' +
        '<g clip-path="url(#lbClip' + k + ')"><rect class="lb-shine" x="-70" y="30" width="46" height="150" fill="url(#lbShine' + k + ')" transform="skewX(-18)"/></g>' + sparks + '</svg>'
        );
    };
    // The gem chest: a faceted crystal case with spikes on the lid, a prism jewel and gems orbiting it. Nothing else looks like it.
    const buildGemChest = uid => {
        const k = uid || '', D = '#2a0c3a';
        const spikes = [[44, 62, 26, 66, 50, 18], [66, 58, 56, 52, 82, 10], [100, 56, 84, 52, 116, 2], [134, 58, 118, 52, 144, 10], [156, 62, 150, 66, 170, 18]];
        const orbit = [0, 120, 240].map((a, i) => '<g transform="rotate(' + a + ' 100 100)"><path class="gem-o" style="animation-delay:-' + i * .9 + 's" d="M100 6 L108 16 L100 28 L92 16 Z" fill="' + ['#ffd6f7', '#c9f0ff', '#e3d6ff'][i] + '" stroke="' + D + '" stroke-width="2" stroke-linejoin="round"/></g>').join('');
        return (
        '<svg viewBox="0 0 200 180" aria-hidden="true"><defs>' +
        '<linearGradient id="gcB' + k + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff9ae8"/><stop offset=".45" stop-color="#9a5cf0"/><stop offset="1" stop-color="#3b1a8c"/></linearGradient>' +
        '<linearGradient id="gcL' + k + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd6f7"/><stop offset=".5" stop-color="#c58cff"/><stop offset="1" stop-color="#6a3fd0"/></linearGradient>' +
        '<linearGradient id="gcS' + k + '" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#7d4cf0"/><stop offset="1" stop-color="#d8f4ff"/></linearGradient>' +
        '<linearGradient id="gcR' + k + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff6fd8"/><stop offset=".33" stop-color="#ffe45e"/><stop offset=".66" stop-color="#5eead4"/><stop offset="1" stop-color="#7c6bff"/></linearGradient>' +
        '<radialGradient id="gcG' + k + '"><stop offset="0" stop-color="#fff"/><stop offset=".4" stop-color="#ff8ae6"/><stop offset="1" stop-color="#ff8ae6" stop-opacity="0"/></radialGradient>' +
        '<linearGradient id="lbShine' + k + '" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".7"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
        '<clipPath id="lbClip' + k + '"><rect x="22" y="86" width="156" height="80" rx="20"/><rect x="16" y="46" width="168" height="48" rx="22"/></clipPath></defs>' +
        '<ellipse class="gc-aura" cx="100" cy="96" rx="96" ry="70" fill="url(#gcG' + k + ')" opacity=".45"/>' +
        '<ellipse cx="100" cy="170" rx="80" ry="7" fill="#000" opacity=".4"/>' +
        '<ellipse class="lb-inner" cx="100" cy="80" rx="70" ry="38" fill="url(#gcG' + k + ')"/>' +
        '<rect x="22" y="86" width="156" height="80" rx="20" fill="url(#gcB' + k + ')" stroke="' + D + '" stroke-width="3.5"/>' +
        '<g fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="1.6" stroke-linejoin="round"><path d="M22 126 L100 86 L178 126 M22 126 L100 166 L178 126 M62 106 L62 146 M138 106 L138 146 M100 86 L100 166"/></g>' +
        '<path d="M30 100 Q30 90 42 90 H158 Q170 90 170 100" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="3" stroke-linecap="round"/>' +
        '<rect x="22" y="150" width="156" height="16" rx="10" fill="' + D + '" opacity=".3"/>' +
        '<path d="M100 104 L128 132 L100 160 L72 132 Z" fill="url(#gcR' + k + ')" stroke="' + D + '" stroke-width="3" stroke-linejoin="round"/><path d="M100 104 L100 160 M72 132 L128 132" stroke="#fff" stroke-opacity=".5" stroke-width="1.6"/><path d="M84 124 L100 110" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-opacity=".9"/>' +
        '<rect class="lb-leak" x="26" y="84" width="148" height="9" rx="4.5" fill="#fff"/>' +
        '<g class="lb-lid">' + spikes.map((s, i) => '<path d="M' + (s[0] - 14) + ' 62 L' + s[4] + ' ' + (s[5] + 14) + ' L' + s[0] + ' ' + s[3] + ' L' + (s[0] + 14) + ' 62 Z" transform="translate(0 ' + (i === 2 ? -4 : 0) + ')" fill="url(#gcS' + k + ')" stroke="' + D + '" stroke-width="3" stroke-linejoin="round"/>').join('') +
        '<rect x="16" y="46" width="168" height="48" rx="22" fill="url(#gcL' + k + ')" stroke="' + D + '" stroke-width="3.5"/>' +
        '<g fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1.6"><path d="M16 70 L100 46 L184 70 M60 46 L60 94 M140 46 L140 94"/></g>' +
        '<path d="M32 62 Q48 52 90 52" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="5" stroke-linecap="round"/>' +
        '<rect x="20" y="82" width="160" height="8" rx="4" fill="#fff" opacity=".8"/>' +
        '<path d="M100 56 L116 72 L100 88 L84 72 Z" fill="url(#gcR' + k + ')" stroke="' + D + '" stroke-width="3" stroke-linejoin="round"/><circle cx="95" cy="66" r="3" fill="#fff"/></g>' +
        '<g clip-path="url(#lbClip' + k + ')"><rect class="lb-shine" x="-70" y="30" width="46" height="150" fill="url(#lbShine' + k + ')" transform="skewX(-18)"/></g>' +
        '<g class="gem-orbit">' + orbit + '</g>' +
        '<g class="lb-sparks" fill="#fff"><path class="sp s1" d="M20 40 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2z"/><path class="sp s2" d="M182 36 l1.6 5 5 1.6 -5 1.6 -1.6 5 -1.6 -5 -5 -1.6 5 -1.6z"/><path class="sp s3" d="M10 120 l1.4 4 4 1.4 -4 1.4 -1.4 4 -1.4 -4 -4 -1.4 4 -1.4z"/><path class="sp s2" d="M188 124 l1.4 4 4 1.4 -4 1.4 -1.4 4 -1.4 -4 -4 -1.4 4 -1.4z"/></g></svg>'
        );
    };
    window.LB_GEMCHEST = buildGemChest;
    const CHEST_SVG = buildChest('', 'common');
    window.LB_CHEST = buildChest;
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
        // iOS Safari zooms the page on a quick second tap or a pinch; tapping the crate repeatedly must never do that
        let lastEnd = 0;
        el.addEventListener('touchend', e => { const n = Date.now(); if (n - lastEnd < 450) e.preventDefault(); lastEnd = n; }, { passive:false });
        el.addEventListener('touchstart', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive:false });
        ['gesturestart', 'gesturechange', 'dblclick'].forEach(t => el.addEventListener(t, e => e.preventDefault()));
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
            const d = document.createElement('div'); d.className = 'lb-pop pop-' + kind; d.innerHTML = icon(kind) + '<b>+0</b>' + (final.boost > 1 && kind !== 'gem' ? '<i class="bx">x' + final.boost + '</i>' : ''); row.appendChild(d); void d.offsetWidth; d.classList.add('show');
            sfx('item'); const r = d.getBoundingClientRect(); o.emit(10, { x:r.left + 28, y:r.top + 28, speed:260, size:7, colors:kind === 'coin' ? ['#ffcf3f', '#fff3b0'] : kind === 'xp' ? ['#6cc4ff', '#bfe9ff'] : kind === 'gem' ? ['#ff6fd8', '#ffe0f8'] : ['#b3a9ff', '#e4defd'], g:500 });
            await countUp(d.querySelector('b'), n, skipped); await sleep(160);
        }
        if ((final.boosts || []).length) {
            o.el.classList.add('dense');
            const brow = document.createElement('div'); brow.className = 'lb-row lb-boosts'; pops.appendChild(brow);
            for (const bo of final.boosts) {
                const d = document.createElement('div'); d.className = 'lb-pop pop-boost'; d.innerHTML = Boost.art(bo) + '<b>' + Boost.short(bo) + '</b>'; brow.appendChild(d); void d.offsetWidth; d.classList.add('show');
                sfx('item'); await sleep(380);
            }
        }
        if (final.boost > 1) { const d = document.createElement('div'); d.className = 'lb-pop pop-boost'; d.innerHTML = '<b style="color:#35e0c8">CHEST BOOSTER x' + final.boost + '</b>'; row.appendChild(d); void d.offsetWidth; d.classList.add('show'); await sleep(300); }
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
        if (final.finisher) await revealFinisher(o, final.finisher, sleep);
    }

    // a finisher found in a chest: a looping preview of the effect instead of a character
    async function revealFinisher(o, fin, sleep) {
        await sleep(350);
        const f = (window.Finishers && Finishers.BY[fin.id]) || fin, rc = RARITY[f.rarity].color, big = f.rarity === 'legendary' || f.rarity === 'epic';
        o.el.style.setProperty('--c', rc);
        const it = document.createElement('div'); it.className = 'lb-itempop lb-fin'; it.style.setProperty('--ic', rc);
        it.innerHTML = '<i class="glow"></i><canvas width="600" height="440"></canvas><div class="rar">FINISHER</div><div class="nm">' + esc(f.name) + '</div><span class="new">NEW</span>';
        o.$('.lb-pops').appendChild(it);
        try { Finishers.mount(it.querySelector('canvas'), f, { span: (f.pv || 340) * 0.85, oy: .82, hold: .6 }); } catch (e) {}
        void it.offsetWidth; o.flash(); o.shake(); buzz(big ? [30, 40, 60] : 40); sfx('finish'); if (big) sfx('boost');
        o.el.classList.add('burst'); it.classList.add('show');
        o.emit(big ? 110 : 60, { x:o.W / 2, y:o.H * .5, speed:620, size:10, colors:[rc, '#fff', rc, '#ffcf3f'], g:500 });
        await sleep(700);
    }
    function addEquipFin(o, f) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'lb-equip'; b.innerHTML = 'EQUIP NOW';
        o.el.appendChild(b); void b.offsetWidth; b.classList.add('show');
        b.onclick = () => {
            const q = prog(); q.finisher = f.id; saveProg(q); sfx('item'); buzz(25);
            b.classList.add('done'); b.disabled = true; b.innerHTML = icon('check') + ' EQUIPPED';
            try { refreshMenu(); } catch (e) {}
        };
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
            const final = { coins:0, xp:0, passPoints:0, gems:0, cosmetic:null, finisher:null, boosts:[] };
            for (const r of list) { if (r.type === 'coin') final.coins += r.n; else if (r.type === 'xp') final.xp += r.n; else if (r.type === 'pass') final.passPoints += r.n; else if (r.type === 'gem') final.gems += r.n; else if (r.type === 'boost') final.boosts.push(r); else if (r.type === 'item') final.cosmetic = r.item; }
            o.el.classList.add('burst'); o.flash(); sfx('finish');
            revealRewards(o, final, () => skipped).then(() => { btn.classList.add('show'); if (final.cosmetic) addEquip(o, final.cosmetic); else if (final.finisher) addEquipFin(o, Finishers.BY[final.finisher.id] || final.finisher); });
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
            '<div class="lb-stage"><div class="lb-title"></div><div class="lb-chest">' + (opts.variant === 'gem' ? buildGemChest('og') : buildChest('o', tier)) + '<div class="lb-ring"></div></div>' +
            '<div class="lb-pips">' + TIERS.map(() => '<i></i>').join('') + '</div><div class="lb-hint">TAP</div></div>');
        if (window.Boost && drop.pending) {                 // a chest booster that will apply to this chest is shown before you open it
            const a = Boost.active('chest');
            if (a && Boost.appliesToChest(drop.id)) { const bdg = document.createElement('div'); bdg.className = 'lb-boostbadge'; bdg.innerHTML = Boost.art({ kind: 'chest', mult: a.mult }) + '<span><b>CHEST BOOSTER</b><small>x' + a.mult + ' rewards · ' + a.total + ' left</small></span>'; o.el.appendChild(bdg); }
        }
        const el = o.el, chest = o.$('.lb-chest'), stage = o.$('.lb-stage'), title = o.$('.lb-title'), pips = [...el.querySelectorAll('.lb-pips i')], btn = o.$('.lb-btn'), skipBtn = o.$('.lb-skip');
        let taps = 0, busy = true, opened = false, skipped = false;
        const chestPos = () => { const r = chest.getBoundingClientRect(); return { x:r.left + r.width / 2, y:r.top + r.height * .42 }; };
        const upChance = n => tier === 'legendary' ? 0 : UP0 * UP_TIER[TIERS.indexOf(tier)] * Math.pow(UP_DECAY, n);
        const paint = () => {
            TIERS.forEach(t => el.classList.remove('tier-' + t)); el.classList.add('tier-' + tier);
            if (opts.variant !== 'gem' && chest.dataset.tier !== tier) { chest.dataset.tier = tier; const old = chest.querySelector('svg'); if (old) old.outerHTML = buildChest('o', tier); }   // rarer crate = more detail
            title.textContent = opts.variant === 'gem' ? 'GEM CHEST' : TIER_NAME[tier]; if (opts.variant === 'gem') el.classList.add('variant-gem');
            pips.forEach((p, i) => { p.className = i <= TIERS.indexOf(tier) ? 'on' : ''; p.style.setProperty('--pc', TIER_COLOR[TIERS[i]]); });
        };
        paint();

        async function open() {
            opened = true; busy = true;
            const final = pending ? (resolveDrop(drop.id, tier) || drop) : drop;
            const ft = final.tier || tier; if (ft !== tier) { tier = ft; paint(); }
            { const sm = el.querySelector('.lb-boostbadge small'); if (sm && final.boost > 1) { const a = Boost.active('chest'); sm.textContent = 'x' + final.boost + ' applied · ' + (a ? a.total : 0) + ' left'; } }
            el.classList.remove('ready', 'tapped'); o.flash(); o.shake(); buzz([40, 30, 80]); sfx('open');
            el.classList.add('burst'); el.style.setProperty('--charge', 1);
            const p = chestPos(); o.emit(120, { x:p.x, y:p.y, dir:-Math.PI / 2, spread:2.4, speed:760, size:11, colors:[TIER_COLOR[tier], '#fff', '#ffcf3f', '#35e0c8'], g:1100 });
            await wait(skipped ? 100 : 850);
            stage.classList.add('away'); skipBtn.classList.add('show'); await wait(skipped ? 50 : 350);
            await revealRewards(o, final, () => skipped);
            skipBtn.classList.remove('show'); btn.classList.add('show'); if (final.cosmetic) addEquip(o, final.cosmetic); else if (final.finisher) addEquipFin(o, Finishers.BY[final.finisher.id] || final.finisher);
            btn.onclick = () => { sfx('count'); o.close(() => { if (opts.onDone) opts.onDone(final); }); };
        }
        // Taps count the moment they land: four fingers at once are four taps (they are batched into one animation)
        let queued = 0, draining = false;
        async function tap(k) { try { await tapInner(k || 1); } catch (e) { if (!opened) busy = false; } }      // an error mid-animation must never leave the crate stuck
        async function drain() {
            if (draining) return; draining = true;
            try {
                await wait(18);                                       // fingers that land together are batched
                while (queued > 0 && !opened) {
                    if (busy) { await wait(30); continue; }
                    const k = Math.min(queued, 12); queued -= k; await tap(k);
                }
            } finally { draining = false; queued = opened ? 0 : queued; }
        }
        async function tapInner(k) {
            if (busy || opened) return; busy = true;
            let up = false, openNow = false;
            const n0 = taps;
            for (let i = 0; i < k && !openNow; i++) {
                const n = taps++;
                if (tier !== 'legendary' && !opts.fixed && Math.random() < upChance(n)) { tier = TIERS[TIERS.indexOf(tier) + 1]; up = true; continue; }
                if (Math.random() < Math.min(1, OPEN0 + OPEN_STEP * n)) openNow = true;
            }
            const n = Math.max(0, taps - 1);
            el.style.setProperty('--amp', Math.min(1.8, .7 + n * .25).toFixed(2));
            chest.classList.remove('tap'); void chest.offsetWidth; chest.classList.add('tap');
            el.style.setProperty('--charge', Math.min(.9, .12 + n * .12).toFixed(2));
            sfx('knock', n); buzz(18 + n * 6);
            const p = chestPos(); o.emit(5 + Math.min(k, 6) * 2, { x:p.x, y:p.y, speed:240, size:6, colors:[TIER_COLOR[tier], '#fff'], g:300 });
            await wait(openNow || k > 1 ? 160 : 300); chest.classList.remove('tap');
            if (up) {
                paint();
                o.flash(); o.shake(); buzz([30, 30, 50]); sfx('tierup');
                const ring = o.$('.lb-ring'); ring.classList.remove('go'); void ring.offsetWidth; ring.classList.add('go');
                const q = chestPos(); o.emit(60, { x:q.x, y:q.y, speed:520, size:9, colors:[TIER_COLOR[tier], '#fff'], g:300 });
                title.classList.remove('pop'); void title.offsetWidth; title.classList.add('pop');
                if (!openNow) { await wait(420); busy = false; return; }
            }
            if (openNow) { await open(); return; }
            busy = false;
        }
        chest.addEventListener('pointerdown', () => { if (opened) return; queued++; drain(); });
        skipBtn.onclick = () => { skipped = true; skipBtn.classList.remove('show'); };
        setTimeout(() => { const p = chestPos(); o.shake(); buzz(35); sfx('land'); o.emit(26, { x:p.x, y:p.y + chest.offsetHeight * .38, dir:-Math.PI / 2, spread:2.8, speed:300, size:7, colors:['#8b95a7', TIER_COLOR[tier]], g:700 }); el.classList.add('ready'); busy = false; }, 900);
    };
})();
