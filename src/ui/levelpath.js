// THE LEVEL PATH: the Levels screen as one road that climbs, like the path in Duolingo (but going up, like the game).
//   Level 1 stands at the bottom, every level is a round stone on a winding road, your own cube stands on the level you play next (it hops up when you have passed one).
//   Done levels show their stars (three gold ones in an arc), the chest you win with 3 stars stands next to its level, locked levels are dark. Dimension II starts behind a gate
//   that opens at 28 stars. At the very top stands the Tower. No cards, no frames: the numbers sit on the stones, the names only on the level you play next.
// Data comes from game.js: DIMENSIONS, dimLoad, lvUnlocked, dimUnlocked, lvDropTier, lvStart, openParkour. Loaded AFTER game.js; openLevels() hands over to LevelPath.open().
(function () {
    'use strict';
    const $ = id => document.getElementById(id), num = n => Math.round(n).toLocaleString('en-US');
    const TC = { common: '#35e0c8', rare: '#5b8def', epic: '#b3a9ff', mythic: '#ff4d7d', legendary: '#ffcf3f' };
    const ROW = 132, GATE0 = 150, GATE1 = 196, TOWER = 330, TOP_PAD = 24, BOT_PAD = 70, SWING = 0.27;
    const THEME = [{ lo: '#090b12', hi: '#1d1745', glow: '#7c6bff', dust: '#cfc8ff' }, { lo: '#070c14', hi: '#0f2c52', glow: '#5ec8ff', dust: '#d8f1ff' }];

    const root = $('s-levels'); if (!root) return;
    root.classList.add('lvp');
    const shell = document.createElement('section'); shell.className = 'lvp-shell';
    shell.innerHTML = '<header class="lvp-top"><button class="pass-back" type="button" id="lvp-back" aria-label="Back">' + icon('chev-l') + '</button><h1>Levels</h1>' +
        '<button class="lvp-tower-btn" type="button" id="lvp-tower" aria-label="The Tower">' + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 21V9l-2-2V3h3v2h2V3h2v2h2V3h3v4l-2 2v12z" fill="currentColor"/></svg>' + '</button>' +
        '<div class="lvp-stars">' + icon('star') + '<b id="lvp-total">0</b></div></header><div class="lvp-scroll" id="lvp-scroll"><div class="lvp-world" id="lvp-world"></div></div>';
    root.appendChild(shell);
    const scroll = $('lvp-scroll'), world = $('lvp-world');
    let prev = null;                                                          // what the road looked like last time (to hop and pop what changed)

    const rng = s => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const hexRgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
    const shade = (h, k) => { const c = hexRgb(h); return 'rgb(' + c.map(v => Math.round(v * k)).join(',') + ')'; };
    const dims = () => DIMENSIONS.map((dm, di) => ({ dm, di })).filter(o => !o.dm.hidden);

    /* ------------------------------------------------------------------- the layout (all numbers, nothing measured) ---- */
    function layout(W) {
        const ds = dims(), items = [];                                         // bottom up: gate, ten levels, gate, ten levels, tower
        let y = BOT_PAD, k = 0;                                                 // y: distance from the bottom of the world
        const pos = [];
        ds.forEach((o, n) => {
            const gh = n === 0 ? GATE0 : GATE1; const gate = { kind: 'gate', di: o.di, n, from: y, h: gh }; items.push(gate); y += gh;
            o.dm.levels.forEach((L, i) => {
                const cy = y + ROW / 2, dx = Math.sin(k * 1.05 + 0.5) * W * SWING; k++;
                const nd = { kind: 'node', di: o.di, i, L, x: W / 2 + dx, yb: cy, zoneN: n }; items.push(nd); pos.push(nd); y += ROW;
            });
        });
        const tower = { kind: 'tower', from: y, h: TOWER }; items.push(tower); y += TOWER;
        const H = y + TOP_PAD;
        items.forEach(it => { if (it.kind === 'node') it.y = H - it.yb; else it.top = H - it.from - it.h; });
        return { W, H, items, nodes: pos, ds };
    }

    /* ------------------------------------------------------------------------ painting ---- */
    function paintZone(cv, w, h, th, nodes, seed, below) {
        const dpr = Math.min(1.5, window.devicePixelRatio || 1); cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
        const c = cv.getContext('2d'), r = rng(seed); c.setTransform(dpr, 0, 0, dpr, 0, 0);
        const g = c.createLinearGradient(0, h, 0, 0); if (below) { g.addColorStop(0, below.hi); g.addColorStop(Math.min(.3, 190 / h), th.lo); } else g.addColorStop(0, th.lo); g.addColorStop(1, th.hi); c.fillStyle = g; c.fillRect(0, 0, w, h);
        for (const nd of nodes) { const rg = c.createRadialGradient(nd.x, nd.zy, 6, nd.x, nd.zy, 130); const [R, G, B] = hexRgb(nd.L.color); rg.addColorStop(0, 'rgba(' + R + ',' + G + ',' + B + ',.16)'); rg.addColorStop(1, 'rgba(' + R + ',' + G + ',' + B + ',0)'); c.fillStyle = rg; c.fillRect(nd.x - 130, nd.zy - 130, 260, 260); }
        c.fillStyle = th.dust;                                                   // dust and stars
        for (let q = 0; q < 70; q++) { c.globalAlpha = .08 + r() * .3; const s = .6 + r() * 1.4; c.beginPath(); c.arc(r() * w, r() * h, s, 0, 6.3); c.fill(); }
        c.fillStyle = '#fff';                                                   // far-away ledges, the game's own shape, very faint, kept to the sides so the road stays clear
        for (let q = 0; q < 16; q++) { const lw = 46 + r() * 70, side = r() < .5 ? -1 : 1, x = side < 0 ? r() * (w * .22) : w - lw - r() * (w * .22); c.globalAlpha = .035 + r() * .05; c.beginPath(); c.roundRect ? c.roundRect(x, r() * h, lw, 9, 4.5) : c.rect(x, r() * h, lw, 9); c.fill(); }
        c.globalAlpha = 1;
    }
    function roadSVG(L) {                                                      // the road between the stones: a faint ribbon, lit up to the level you have reached
        const n = L.nodes, W = L.W, H = L.H; let defs = '', base = '', lit = '';
        for (let k = 0; k < n.length - 1; k++) {
            const a = n[k], b = n[k + 1], my = (a.y + b.y) / 2, d = 'M' + a.x.toFixed(1) + ' ' + a.y.toFixed(1) + 'C' + a.x.toFixed(1) + ' ' + my.toFixed(1) + ' ' + b.x.toFixed(1) + ' ' + my.toFixed(1) + ' ' + b.x.toFixed(1) + ' ' + b.y.toFixed(1);
            base += '<path d="' + d + '" class="rd-b"/><path d="' + d + '" class="rd-d"/>';
            if (a.reached && b.open) { defs += '<linearGradient id="rg' + k + '" gradientUnits="userSpaceOnUse" x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '"><stop offset="0" stop-color="' + a.L.color + '"/><stop offset="1" stop-color="' + b.L.color + '"/></linearGradient>'; lit += '<path d="' + d + '" class="rd-l" stroke="url(#rg' + k + ')"/>'; }
        }
        return '<svg class="lvp-road" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true"><defs>' + defs + '</defs>' + base + lit + '</svg>';
    }
    function towerSVG(open) {
        return '<svg viewBox="0 0 220 300" aria-hidden="true"><defs><linearGradient id="twB" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5b6488"/><stop offset=".55" stop-color="#3a4264"/><stop offset="1" stop-color="#262c47"/></linearGradient><linearGradient id="twT" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8d7bff"/><stop offset="1" stop-color="#4a3fb5"/></linearGradient>' +
            '<radialGradient id="twG" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#9f8bff" stop-opacity=".55"/><stop offset="1" stop-color="#9f8bff" stop-opacity="0"/></radialGradient></defs>' +
            '<circle cx="110" cy="70" r="120" fill="url(#twG)"/>' +
            '<g fill="#fff" opacity=".16"><ellipse cx="40" cy="236" rx="46" ry="12"/><ellipse cx="184" cy="214" rx="38" ry="10"/><ellipse cx="164" cy="268" rx="52" ry="12"/></g>' +
            '<path d="M82 300 L96 92 H124 L138 300Z" fill="url(#twB)"/><path d="M96 92 H124 L126 108 H94Z" fill="#6f78a0"/>' +
            '<path d="M88 84 H132 V96 H88Z" fill="#454e78"/><path d="M90 84 V70 H98 V78 H106 V70 H114 V78 H122 V70 H130 V84Z" fill="#454e78"/>' +
            '<path d="M100 70 L110 30 L120 70Z" fill="url(#twT)"/><path d="M110 30 V8" stroke="#cfc8ff" stroke-width="2.4" stroke-linecap="round"/><path d="M110 8 L128 14 L110 20Z" fill="#ffcf3f"/>' +
            '<g fill="' + (open ? '#ffe9a8' : '#7d86a8') + '"><rect x="106" y="118" width="8" height="18" rx="4"/><rect x="106" y="168" width="8" height="18" rx="4"/><rect x="106" y="218" width="8" height="18" rx="4"/></g>' +
            '<g stroke="#1b2038" stroke-width="1.4" opacity=".5" fill="none"><path d="M92 150 H128 M90 200 H130 M88 252 H132"/></g></svg>';
    }

    /* ---------------------------------------------------------------------- the world ---- */
    function currentOf(di) {                                                   // the level you play next: the first open one without stars (and not skipped)
        const dm = DIMENSIONS[di], d = dimLoad(dm); for (let i = 0; i < dm.levels.length; i++) if (lvUnlocked(d, i) && !d.stars[i] && !(d.skipped && d.skipped[i])) return i; return -1;
    }
    function render() {
        const W = Math.min(window.innerWidth || 400, 460), L = layout(W), total = dimTotalStars();
        $('lvp-total').textContent = total;
        const state = {}; let focus = null;                                    // focus: the node the scroll centres on
        const html = [];
        const zones = dims().map(o => ({ o, saves: dimLoad(o.dm), open: dimUnlocked(o.di) }));
        L.nodes.forEach(nd => {
            const z = zones[nd.zoneN], d = z.saves; nd.stars = d.stars[nd.i] || 0; nd.skipped = !!(d.skipped && d.skipped[nd.i]);
            nd.open = z.open && lvUnlocked(d, nd.i); nd.cur = nd.open && !nd.stars && !nd.skipped && currentOf(nd.di) === nd.i; nd.reached = nd.open && (nd.stars > 0 || nd.skipped);
            if (nd.cur && nd.di === curDim) focus = nd; (state[nd.di] = state[nd.di] || [])[nd.i] = nd.stars;
        });
        if (!focus) focus = L.nodes.find(n => n.cur) || [...L.nodes].reverse().find(n => n.open && n.di === curDim) || L.nodes[0];
        // painted backgrounds, one picture per dimension (the road, the stones and the text sit on top)
        zones.forEach((z, n) => {
            const gate = L.items.find(q => q.kind === 'gate' && q.n === n), up = L.items.find(q => q.kind === 'gate' && q.n === n + 1);        // a zone runs from the top of its own level 10 (below the next gate) down to the bottom of its gate
            const top = up ? up.top + up.h : 0, bot = n === 0 ? L.H : gate.top + gate.h, h = bot - top;
            z.zone = { top, h, n };
            html.push('<canvas class="lvp-bg" data-zone="' + n + '" style="top:' + top + 'px;height:' + h + 'px"></canvas>');
            L.nodes.filter(q => q.zoneN === n).forEach(q => { q.zy = q.y - top; });
        });
        html.push(roadSVG(L));
        // the gates
        L.items.filter(q => q.kind === 'gate').forEach(g => {
            const z = zones[g.n], lock = !z.open, th = THEME[Math.min(g.n, THEME.length - 1)];
            html.push('<div class="lvp-gate' + (lock ? ' lock' : '') + '" style="top:' + (g.top + 28) + 'px;--gc:' + th.glow + '"><small>DIMENSION</small><b>' + (g.n === 0 ? 'I' : g.n === 1 ? 'II' : g.n + 1) + '</b>' +
                (lock ? '<span class="lvp-need">' + icon('lock') + '<i>' + z.o.dm.unlockStars + '</i>' + icon('star') + '</span>' : '') + '</div>');
        });
        // the stones
        L.nodes.forEach((nd, idx) => {
            const c = nd.L.color, cls = 'lvp-node' + (nd.cur ? ' cur' : nd.reached ? ' done' : nd.open ? ' open' : ' lock') + (nd.skipped ? ' skipped' : '');
            const tc = TC[lvDropTier(nd.di, nd.i)], earned = nd.stars >= 3, side = nd.x < W / 2 ? 1 : -1;
            const stars = nd.reached && !nd.skipped ? '<span class="lvp-st">' + [0, 1, 2].map(k => '<i class="' + (k < nd.stars ? 'on' : '') + (prev && prev[nd.di] && (prev[nd.di][nd.i] || 0) <= k && k < nd.stars ? ' pop' : '') + '">' + icon('star') + '</i>').join('') + '</span>' : '';
            html.push('<button type="button" class="' + cls + '" data-di="' + nd.di + '" data-i="' + nd.i + '" style="left:' + nd.x.toFixed(1) + 'px;top:' + nd.y.toFixed(1) + 'px;--c:' + c + ';--c2:' + shade(c, .55) + '" aria-label="Level ' + (nd.i + 1) + '">' +
                '<span class="lvp-face">' + (nd.open ? '<b>' + (nd.i + 1) + '</b>' : icon('lock')) + '</span>' + stars + (nd.cur ? '<span class="lvp-name">' + nd.L.name + '</span>' : '') + '</button>');
            html.push('<span class="lvp-chest' + (earned ? ' earned' : '') + (nd.open ? '' : ' lock') + '" style="left:' + (nd.x + side * 70).toFixed(1) + 'px;top:' + (nd.y - 2).toFixed(1) + 'px;--ic:' + tc + '">' + icon('drop-' + lvDropTier(nd.di, nd.i)) + '</span>');
        });
        // you
        html.push('<div class="lvp-me" id="lvp-me" style="left:' + focus.x.toFixed(1) + 'px;top:' + (focus.y - 36).toFixed(1) + 'px"><canvas width="140" height="140"></canvas></div>');
        // the tower
        const tw = L.items.find(q => q.kind === 'tower'), save = typeof pkLoadSave === 'function' ? pkLoadSave() : null, bt = load('rr_pk_best_time', 0), bm = load('rr_pk_best', 0);
        const meta = save ? 'Saved ' + (save.m || 0) + ' m' : bt ? 'Best ' + pkFmtTime(bt) : bm ? 'Best ' + bm + ' m' : '1000 m';
        html.push('<button type="button" class="lvp-tower" id="lvp-tw" style="top:' + tw.top + 'px;height:' + tw.h + 'px">' + towerSVG(true) + '<span><b>THE TOWER</b><small>' + meta + '</small></span></button>');

        world.style.width = L.W + 'px'; world.style.height = L.H + 'px'; world.innerHTML = html.join('');
        world.querySelectorAll('canvas.lvp-bg').forEach(cv => { const n = +cv.dataset.zone, z = zones[n].zone; paintZone(cv, L.W, z.h, THEME[Math.min(n, THEME.length - 1)], L.nodes.filter(q => q.zoneN === n), 90 + n * 17, n > 0 ? THEME[Math.min(n - 1, THEME.length - 1)] : null); });
        try { renderLook($('lvp-me').querySelector('canvas'), myLook(), { scale: .36, cy: .6 }); } catch (e) {}
        world.querySelectorAll('.lvp-node').forEach(b => b.addEventListener('click', () => {
            const di = +b.dataset.di, i = +b.dataset.i;
            if (b.classList.contains('lock')) { if (window.SFX) SFX.play('error'); b.animate([{ transform: 'translate(-50%,-50%)' }, { transform: 'translate(calc(-50% - 6px),-50%)' }, { transform: 'translate(calc(-50% + 6px),-50%)' }, { transform: 'translate(-50%,-50%)' }], { duration: 260 }); return; }
            if (window.SFX) SFX.play('tap'); curDim = di; lvStart(i);
        }));
        $('lvp-tw').addEventListener('click', () => { if (window.SFX) SFX.play('tap'); openParkour(); });
        L.focus = focus; L.zones = zones; return L;
    }
    // the hop: when you have passed a level since last time, your cube starts on the old stone and jumps up to the new one
    function hop(L) {
        const me = $('lvp-me'), f = L.focus; if (!me || !f || !prev || prev.cur === undefined || prev.curDim !== f.di) return;
        const was = L.nodes.find(q => q.di === f.di && q.i === prev.cur); if (!was || was === f) return;
        const ox = was.x - f.x, oy = was.y - f.y;
        me.animate([{ transform: 'translate(' + ox + 'px,' + oy + 'px)' }, { transform: 'translate(' + ox * .5 + 'px,' + (oy * .5 - 80) + 'px)', offset: .5 }, { transform: 'translate(0,0)' }], { duration: 950, delay: 450, easing: 'cubic-bezier(.4,0,.3,1)', fill: 'backwards' });
        setTimeout(() => { if (window.SFX) SFX.play('jump', .7); }, 450); setTimeout(() => { if (window.SFX) SFX.play('land', 1); }, 1380);
    }
    function open() {
        const L = render(); showScreen('levels');
        setTimeout(() => {                                                      // measured now that the screen is visible
            const f = L.focus; scroll.scrollTop = Math.max(0, f.y - scroll.clientHeight * .6);
            hop(L);
            prev = { cur: f.cur ? f.i : undefined, curDim: f.di }; L.nodes.forEach(nd => { (prev[nd.di] = prev[nd.di] || [])[nd.i] = nd.stars; });
        }, 60);
    }
    $('lvp-back').addEventListener('click', () => { refreshStartMeta(); showScreen('start'); });
    $('lvp-tower').addEventListener('click', () => { if (window.SFX) SFX.play('tap'); openParkour(); });
    window.LevelPath = { open, render };
})();
