// FINISHERS: the effect that plays when YOU cross the finish line. Bought with coins or gems, one equipped at a time. Loaded AFTER game.js.
(function () {
    'use strict';
    const R_ = (a, b) => a + Math.random() * (b - a);
    const PAL = ['#ff5470', '#ffcf3f', '#35e0c8', '#5b8def', '#b3a9ff', '#ff9838', '#ff8ae6'];
    const pick = a => a[Math.floor(Math.random() * a.length)];
    const later = (fn, ms) => setTimeout(() => { try { fn(); } catch (e) {} }, ms);
    function pt(x, y, vx, vy, color, size, decay) {
        const q = particlePool.length ? particlePool.pop() : {};
        q.x = x; q.y = y; q.vx = vx; q.vy = vy; q.life = 1; q.decay = decay; q.color = color; q.size = size; particles.push(q);
    }
    const sfx = n => { try { SFX.play(n); } catch (e) {} };

    const FINISHERS = [
        { id: 'f-none',      name: 'None',       rarity: 'common',    price: 0 },
        { id: 'f-confetti',  name: 'Confetti',   rarity: 'common',    price: 300,
          play(p) { sfx('shatter'); for (let i = 0; i < 4; i++) later(() => { for (let k = 0; k < 16; k++) pt(p.x, p.y - 20, R_(-260, 260), R_(-520, -180), pick(PAL), R_(3, 6), R_(.5, 1)); }, i * 130); } },
        { id: 'f-fireworks', name: 'Fireworks',  rarity: 'rare',      price: 800,
          play(p) { for (let i = 0; i < 6; i++) later(() => { const x = p.x + R_(-90, 90), y = p.y - R_(60, 220), c = pick(PAL); sfx(i % 2 ? 'boost' : 'shatter'); ring(x, y, c, 70); burst(x, y, c, 22, 300); burst(x, y, '#ffffff', 8, 200); }, i * 230); } },
        { id: 'f-shockwave', name: 'Shockwave',  rarity: 'rare',      price: 900,
          play(p) { camShake = Math.max(camShake, 9); sfx('boost'); [0, 130, 260].forEach((t, i) => later(() => { ring(p.x, p.y, i === 1 ? '#35e0c8' : '#ffffff', 150 + i * 40); burst(p.x, p.y, '#ffffff', 14, 380); }, t)); } },
        { id: 'f-sakura',    name: 'Petal storm', rarity: 'epic',     price: 1800,
          play(p) { sfx('item'); for (let i = 0; i < 26; i++) later(() => pt(p.x + R_(-130, 130), p.y - R_(220, 320), R_(-40, 40), R_(30, 90), pick(['#ffb8d6', '#ff8ab8', '#ffe0ee']), R_(4, 7), R_(.28, .5)), i * 70); } },
        { id: 'f-goldrain',  name: 'Gold rain',  rarity: 'epic',      price: 2000,
          play(p) { sfx('coin'); ring(p.x, p.y, '#ffcf3f', 120); for (let i = 0; i < 30; i++) later(() => { pt(p.x + R_(-120, 120), p.y - R_(240, 340), R_(-20, 20), R_(60, 160), pick(['#ffcf3f', '#fff4c2', '#ff9838']), R_(4, 8), R_(.3, .5)); if (i % 5 === 0) sfx('coin'); }, i * 60); } },
        { id: 'f-lightning', name: 'Lightning',  rarity: 'epic',      price: 2200,
          play(p) { camShake = Math.max(camShake, 12); sfx('boost'); const fl = document.createElement('div'); fl.style.cssText = 'position:fixed;inset:0;background:#cfe6ff;z-index:40;pointer-events:none;opacity:.8;transition:opacity .35s'; document.body.appendChild(fl); later(() => { fl.style.opacity = 0; }, 40); later(() => fl.remove(), 450);
                  for (let i = 0; i < 18; i++) later(() => pt(p.x + R_(-6, 6), p.y - i * 22, R_(-60, 60), R_(-80, 20), pick(['#ffffff', '#9fd0ff', '#5eb4ff']), R_(3, 6), R_(.9, 1.6)), i * 14);
                  ring(p.x, p.y, '#9fd0ff', 130); later(() => { ring(p.x, p.y, '#ffffff', 90); burst(p.x, p.y, '#cfe6ff', 24, 420); }, 160); } },
        { id: 'f-rocket',    name: 'Rocket',     rarity: 'legendary', price: 4000,
          play(p) { sfx('rocket'); for (let i = 0; i < 28; i++) later(() => { const y = p.y - i * 16; pt(p.x + R_(-5, 5), y + 24, R_(-40, 40), R_(80, 200), pick(['#fff4c2', '#ffcf3f', '#ff7a3d']), R_(3, 6), R_(1.1, 1.8)); }, i * 14);
                  later(() => { sfx('shatter'); camShake = Math.max(camShake, 10); const y = p.y - 28 * 16; for (let k = 0; k < 4; k++) later(() => { const c = pick(PAL); ring(p.x, y, c, 110 + k * 25); burst(p.x, y, c, 20, 340); }, k * 120); }, 420); } },
        { id: 'f-supernova', name: 'Supernova',  rarity: 'legendary', gemPrice: 450, premium: true,
          play(p) { camShake = Math.max(camShake, 16); sfx('boost'); sfx('finish'); [0, 90, 180, 270].forEach((t, i) => later(() => { ring(p.x, p.y, i % 2 ? '#ffcf3f' : '#ffffff', 170 + i * 45); }, t));
                  for (let i = 0; i < 70; i++) { const a = i / 70 * Math.PI * 2, s = R_(220, 640); pt(p.x, p.y, Math.cos(a) * s, Math.sin(a) * s, i % 3 ? '#ffcf3f' : '#ffffff', R_(3, 6), R_(.5, .9)); } } },
    ];
    const BY = Object.fromEntries(FINISHERS.map(f => [f.id, f]));

    function play(p) {
        const f = BY[prog().finisher]; if (!f || !f.play) return;
        f.play(p);
    }

    /* ------------------------------------------------------------------ shop previews ---- */
    function preview(cv, f) {
        const c = cv.getContext('2d'), w = cv.width, h = cv.height; c.clearRect(0, 0, w, h);
        const col = { 'f-confetti': PAL, 'f-fireworks': PAL, 'f-shockwave': ['#fff', '#35e0c8'], 'f-sakura': ['#ffb8d6', '#ff8ab8'], 'f-goldrain': ['#ffcf3f', '#fff4c2'], 'f-lightning': ['#9fd0ff', '#fff'], 'f-rocket': ['#ffcf3f', '#ff7a3d'], 'f-supernova': ['#ffcf3f', '#fff'] }[f.id];
        let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
        c.translate(w / 2, h / 2); c.lineCap = 'round';
        if (!col) { c.strokeStyle = '#566074'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 14, 0, 7); c.moveTo(-10, 10); c.lineTo(10, -10); c.stroke(); return; }
        if (f.id === 'f-confetti') for (let i = 0; i < 26; i++) { c.save(); c.translate((rnd() - .5) * w * .8, (rnd() - .5) * h * .8); c.rotate(rnd() * 6); c.fillStyle = col[i % col.length]; c.fillRect(-3, -2, 7, 4); c.restore(); }
        else if (f.id === 'f-fireworks') for (const [x, y, k] of [[-28, -6, 0], [22, 8, 1], [0, -14, 2]]) { c.strokeStyle = col[k * 2 % col.length]; c.lineWidth = 2.4; for (let a = 0; a < 12; a++) { const r = a * Math.PI / 6; c.beginPath(); c.moveTo(x + Math.cos(r) * 5, y + Math.sin(r) * 5); c.lineTo(x + Math.cos(r) * 13, y + Math.sin(r) * 13); c.stroke(); } }
        else if (f.id === 'f-shockwave') for (let i = 1; i <= 3; i++) { c.strokeStyle = col[i % 2]; c.globalAlpha = 1 - i * .22; c.lineWidth = 3; c.beginPath(); c.ellipse(0, 0, i * 15, i * 8, 0, 0, 7); c.stroke(); }
        else if (f.id === 'f-sakura' || f.id === 'f-goldrain') for (let i = 0; i < 18; i++) { c.fillStyle = col[i % 2]; c.beginPath(); c.ellipse((rnd() - .5) * w * .8, (rnd() - .5) * h * .8, f.id === 'f-goldrain' ? 3.4 : 4.4, f.id === 'f-goldrain' ? 3.4 : 2.4, rnd() * 3, 0, 7); c.fill(); }
        else if (f.id === 'f-lightning') { c.strokeStyle = col[0]; c.lineWidth = 4; c.beginPath(); c.moveTo(6, -h / 2 + 4); c.lineTo(-8, -6); c.lineTo(4, -4); c.lineTo(-10, h / 2 - 4); c.stroke(); c.strokeStyle = '#fff'; c.lineWidth = 1.6; c.stroke(); }
        else if (f.id === 'f-rocket') { for (let i = 0; i < 9; i++) { c.fillStyle = col[i % 2]; c.beginPath(); c.arc((rnd() - .5) * 6, h / 2 - 6 - i * 8, 3 - i * .2, 0, 7); c.fill(); } c.strokeStyle = '#ffcf3f'; c.lineWidth = 2.4; for (let a = 0; a < 8; a++) { const r = a * Math.PI / 4; c.beginPath(); c.moveTo(Math.cos(r) * 5, -h / 2 + 12 + Math.sin(r) * 5); c.lineTo(Math.cos(r) * 11, -h / 2 + 12 + Math.sin(r) * 11); c.stroke(); } }
        else if (f.id === 'f-supernova') { for (let i = 1; i <= 2; i++) { c.strokeStyle = col[i - 1]; c.lineWidth = 2.6; c.beginPath(); c.arc(0, 0, i * 12, 0, 7); c.stroke(); } for (let a = 0; a < 20; a++) { const r = a * Math.PI / 10, l = 18 + (a % 2) * 12; c.strokeStyle = col[a % 2]; c.lineWidth = 2; c.beginPath(); c.moveTo(Math.cos(r) * 28, Math.sin(r) * 28); c.lineTo(Math.cos(r) * (28 + l * .5), Math.sin(r) * (28 + l * .5)); c.stroke(); } }
    }

    function renderShop(grid) {
        const p = prog(); grid.innerHTML = '';
        const head = document.createElement('div'); head.className = 'em-head';
        head.innerHTML = '<b>Finishers</b><small>Plays when you cross the finish line</small>'; grid.appendChild(head);
        const RANK = { common: 0, rare: 1, epic: 2, legendary: 3 };
        const list = FINISHERS.slice().sort((a, b) => (p.owned.includes(b.id) || b.price === 0) - (p.owned.includes(a.id) || a.price === 0) || RANK[a.rarity] - RANK[b.rarity] || (a.price || a.gemPrice) - (b.price || b.gemPrice));
        let armed = null, armT = 0;
        for (const f of list) {
            const own = f.price === 0 || p.owned.includes(f.id), eq = (p.finisher || 'f-none') === f.id;
            const b = document.createElement('button'); b.type = 'button'; b.className = 'm-skin fn-card' + (eq ? ' eq' : '') + (f.premium ? ' prem' : '');
            b.style.setProperty('--rc', RARITY[f.rarity].color);
            b.innerHTML = '<span class="m-skin-pv"><canvas width="160" height="100" class="fn-pv"></canvas></span><b>' + f.name + '</b>' +
                '<span class="m-skin-f"><span class="buy-hint">Tap again</span><span class="' + (own ? (eq ? 'eqd' : 'own') : 'price') + '">' + (own ? (eq ? 'EQUIPPED' : 'OWNED') : f.premium ? icon('gem') + ' ' + f.gemPrice : icon('coin') + ' ' + f.price.toLocaleString('en-US')) + '</span></span>';
            preview(b.querySelector('canvas'), f);
            b.onclick = () => {
                if (own) { const q = prog(); q.finisher = eq ? 'f-none' : f.id; saveProg(q); SFX.play('item'); renderShop(grid); return; }
                const afford = f.premium ? gemCount() >= f.gemPrice : load('rr_coins', 0) >= f.price;
                if (!afford) { b.classList.add('m-shake'); setTimeout(() => b.classList.remove('m-shake'), 400); SFX.play('fall'); return; }
                if (armed !== b) { grid.querySelectorAll('.arm').forEach(x => x.classList.remove('arm')); b.classList.add('arm'); armed = b; SFX.play('count'); clearTimeout(armT); armT = setTimeout(() => { b.classList.remove('arm'); armed = null; }, 2600); return; }
                if (f.premium) store('rr_gems', gemCount() - f.gemPrice); else store('rr_coins', load('rr_coins', 0) - f.price);
                const q = prog(); q.owned.push(f.id); q.finisher = f.id; saveProg(q); SFX.play('pickup'); refreshMenu(); renderShop(grid);
            };
            grid.appendChild(b);
        }
    }
    window.Finishers = { FINISHERS, BY, play, renderShop };
})();
