// ARENA THEMES: every arena of the trophy road has its own look and its own power-up pool.
// Classic script, loaded AFTER game.js and trophies.js. Arena Race and Build Race use the arena your trophies put you in; a party match always looks like the
// Playground and keeps the full classic power-up set so every friend sees (and gets) the same. Other modes are not touched.
//
// LOOK (a background, never an obstacle): a sky gradient that shifts while you climb, a big sun or moon, two layers of far-away scenery that move slowly
// (parallax), mist between the layers, a few drifting specks and a soft vignette. Scenery uses colours very close to the sky so it never looks like something
// you can stand on. Every piece of scenery is painted once into a small cached picture; a frame only does a handful of drawImage calls.
//
// POWER-UPS: the pool grows with the arenas (see POOL below and docs/ARENAS.md), a few leave again at the top, and each arena renames and recolours the Stun
// Bomb and the Earthquake and makes one or two power-ups a bit more common. The same data feeds the Arenas screen (src/ui/arenas.js).
(function () {
    'use strict';
    const PLAT0 = Object.assign({}, PLAT), ITEMS0 = JSON.parse(JSON.stringify(ITEMS));
    const TAU = Math.PI * 2;

    /* ------------------------------------------------------------------------ the ten arenas ---- */
    const T = [
        { name: 'Playground', tag: 'Learn the jump', c: '#35e0c8', sky: [['#3b8ee3', '#a9defc'], ['#2a73cf', '#86c9f5']], orb: { x: .78, y: .16, r: 46, c: '#fff6c9' },
          far: '#8fcbf3', mid: '#7ab9ec', lit: '#ffffff', acc: '#ffd166', cloud: '#ffffff', mist: '#d4f0ff', ground: '#7fd18a',
          kinds: { far: ['cloud', 'rainbow', 'cloud'], mid: ['balloon', 'kite', 'windmill', 'cloud'] },
          plat: '#4ade80', air: ['dust', '#ffffff', 0.5], grid: 'rgba(255,255,255,0.10)', items: {}, bias: {} },
        { name: 'Parking Lot', tag: 'Painted lines, flickering lamps', c: '#5bb8ff', sky: [['#151925', '#39405a'], ['#0e111a', '#262c40']], orb: null,
          far: '#2e3549', mid: '#292f43', lit: '#ffe6a8', acc: '#ffd400', mist: '#4d5676', ground: '#232838',
          kinds: { far: ['pillar', 'psign', 'pillar'], mid: ['lamp', 'car', 'cone', 'lamp'] },
          plat: '#f2c230', air: ['dust', '#c9d1e3', 0.35], grid: 'rgba(255,255,255,0.045)', items: { bomb: ['CAR ALARM!', '#ffd400'], quake: ['POTHOLE!', '#ff9838'] }, bias: { bomb: 1.3 } },
        { name: 'Rooftop', tag: 'Sunset over the skyline', c: '#ff9a5b', sky: [['#4d2a63', '#ff9b6e'], ['#241a4d', '#c64f7e']], orb: { x: .3, y: .6, r: 64, c: '#ffe3b0' },
          far: '#b0507a', mid: '#8e406d', lit: '#ffd9a2', acc: '#ff6b6b', mist: '#ffb08a', ground: '#6b2f5e',
          kinds: { far: ['skyline', 'birds', 'skyline'], mid: ['building', 'antenna', 'tank', 'building'] },
          plat: '#d8b98a', air: ['dust', '#ffd9b0', 0.4], grid: 'rgba(255,255,255,0.05)', items: { bomb: ['FIREWORK!', '#ff7a3d'], quake: ['ROOF CAVE-IN!', '#ff5470'] }, bias: { dj: 1.4 } },
        { name: 'Harbour', tag: 'Cranes, crates and a foghorn', c: '#4fd3ff', sky: [['#0a2340', '#2c76a3'], ['#06121f', '#143f63']], orb: { x: .8, y: .17, r: 34, c: '#eaf4ff' },
          far: '#1f5078', mid: '#18435f', lit: '#ffd27a', acc: '#e0793f', mist: '#3f88b5', ground: '#10304a',
          kinds: { far: ['ship', 'lighthouse', 'crane'], mid: ['containers', 'crane', 'containers', 'lighthouse'] },
          plat: '#b98a5a', air: ['rain', '#9fd2ff', 0.28], grid: 'rgba(160,210,255,0.05)', items: { bomb: ['DEPTH CHARGE!', '#35b6ff'], quake: ['TIDAL WAVE!', '#4aa8ff'] }, bias: { bounce: 1.4 } },
        { name: 'Factory', tag: 'Steel, steam and sparks', c: '#ffb21f', sky: [['#2a1c12', '#7a5128'], ['#150e09', '#3f2a17']], orb: null,
          far: '#58391f', mid: '#4a311b', lit: '#ffb02e', acc: '#ff7a2d', mist: '#aa7439', ground: '#2b1c10',
          kinds: { far: ['chimney', 'pipes', 'chimney'], mid: ['gear', 'furnace', 'tank', 'gear', 'pipes'] },
          plat: '#b8c0d0', air: ['spark', '#ffb02e', 0.8], grid: 'rgba(255,176,46,0.05)', items: { bomb: ['STEAM BLAST!', '#ffb02e'], quake: ['PISTON SLAM!', '#ff7a3d'] }, bias: { chain: 1.4 } },
        { name: 'Subway', tag: 'The last train is never late', c: '#7cf29c', sky: [['#0c2623', '#2b6a62'], ['#06130f', '#16413b']], orb: null,
          far: '#22534b', mid: '#1c443e', lit: '#c7fbe9', acc: '#a5d86a', mist: '#41968a', ground: '#102925',
          kinds: { far: ['arch', 'tilepillar', 'arch'], mid: ['hanglamp', 'roundel', 'tilepillar', 'hanglamp'] },
          plat: '#a5d86a', air: ['dust', '#a8f0d8', 0.3], grid: 'rgba(120,255,214,0.05)', items: { bomb: ['SHORT CIRCUIT!', '#b5ff5e'], quake: ['TRAIN RUMBLE!', '#ff5470'] }, bias: { shield: 1.3, bomb: 1.15 } },
        { name: 'Mountain', tag: 'Thin air, thick snow', c: '#b3a9ff', sky: [['#2f5f9c', '#d4e9f9'], ['#1f4478', '#9bc3e6']], orb: { x: .2, y: .2, r: 40, c: '#fffbe0' },
          far: '#a9c9e6', mid: '#86abd0', lit: '#ffffff', acc: '#ffffff', cloud: '#f4faff', mist: '#eaf5ff', ground: '#c9dcef',
          kinds: { far: ['ridge', 'peak', 'cloud'], mid: ['peak', 'pines', 'cloud', 'pines'] },
          plat: '#8aa0b8', air: ['snow', '#ffffff', 0.7], grid: 'rgba(255,255,255,0.10)', items: { bomb: ['SNOWBALL!', '#bfe6ff'], quake: ['AVALANCHE!', '#e8f6ff'] }, bias: { giant: 1.4 } },
        { name: 'Space Station', tag: 'Stars in every direction', c: '#ff8ae6', sky: [['#04040e', '#1b1b52'], ['#020208', '#0c0b2b']], orb: null,
          far: '#2e316f', mid: '#262962', lit: '#d6dbff', acc: '#9f8bff', mist: '#3b3b8e', ground: null,
          kinds: { far: ['nebula', 'planet', 'nebula'], mid: ['station', 'sat', 'asteroid', 'planet'] },
          plat: '#d6d9e8', air: ['star', '#ffffff', 0.9], grid: 'rgba(179,169,255,0.05)', items: { bomb: ['ION BURST!', '#9f8bff'], quake: ['METEOR!', '#b3a9ff'] }, bias: { dj: 1.6, bounce: 1.2 } },
        { name: 'Volcano', tag: 'Ash, embers and glowing rock', c: '#ff6b4a', sky: [['#1e0806', '#8a2a13'], ['#0e0302', '#44100a']], orb: null,
          far: '#55190f', mid: '#44120b', lit: '#ff7a3d', acc: '#ff4a1f', mist: '#c4492a', ground: '#2a0c08',
          kinds: { far: ['volcano', 'plume', 'volcano'], mid: ['volcano', 'rockfloat', 'plume', 'rockfloat'] },
          plat: '#a1887f', air: ['ash', '#ff8a5c', 0.6], grid: 'rgba(255,90,40,0.06)', items: { bomb: ['LAVA BOMB!', '#ff5a1f'], quake: ['ERUPTION!', '#ff3b1d'] }, bias: { rocket: 1.5, quake: 1.3 } },
        { name: 'Summit', tag: 'Above the storm', c: '#ffcf3f', sky: [['#0e1226', '#3e4778'], ['#070813', '#1d2244']], orb: { x: .76, y: .14, r: 30, c: '#f2f0ff' },
          far: '#2e3663', mid: '#262d56', lit: '#ffe58a', acc: '#ffcf3f', cloud: '#4a5385', mist: '#535f9f', ground: '#181c38',
          kinds: { far: ['storm', 'crag', 'bolt'], mid: ['crag', 'storm', 'bolt', 'crag'] },
          plat: '#ffcf3f', air: ['rain', '#cfd8ff', 0.4], grid: 'rgba(255,224,120,0.05)', items: { bomb: ['THUNDER!', '#ffe45e'], quake: ['LIGHTNING STRIKE!', '#ffe45e'] }, bias: { cannon: 1.5, quake: 1.2 } },
    ];

    /* ------------------------------------------------------------------- power-up pool per arena ---- */
    // The pool is cumulative: an arena has everything the arenas before it added, minus what has left. Arena Race and Build Race only (parties keep the classic set).
    // `wind` is the Gust: it was out of the game and comes back from the Rooftop on.
    const POOL = [
        { add: ['bounce', 'rocket', 'giant', 'shield'], remove: [] },       // 1 Playground: the four easy ones
        { add: ['dj'], remove: [] },                                        // 2 Parking Lot
        { add: ['wind'], remove: [] },                                      // 3 Rooftop
        { add: ['bomb'], remove: [] },                                      // 4 Harbour
        { add: ['chain'], remove: [] },                                     // 5 Factory
        { add: ['quake'], remove: [] },                                     // 6 Subway
        { add: ['ufo'], remove: [] },                                       // 7 Mountain
        { add: ['cannon'], remove: [] },                                    // 8 Space Station
        { add: [], remove: ['bounce'] },                                    // 9 Volcano: the springy helper is gone, you have to read the jump yourself
        { add: [], remove: ['giant'] },                                     // 10 Summit: no more training wheels
    ];
    const ORDER = ['bounce', 'rocket', 'giant', 'shield', 'dj', 'wind', 'bomb', 'chain', 'quake', 'ufo', 'cannon'];
    const INFO = {
        bounce: ['Super Bounce', 'Springs you up and keeps you bouncy for a few seconds'], rocket: ['Rocket', 'Blasts you far up the course'],
        giant: ['Giant', 'Grow huge: bigger jumps, hard to push around'], shield: ['Shield', 'Blocks every attack for a few seconds'],
        dj: ['Double Jump', 'One extra jump in mid air'], wind: ['Gust', 'A crosswind for everyone else: their aim goes shaky'],
        bomb: ['Stun Bomb', 'A danger zone that stuns everyone left inside'], chain: ['Chain', 'Hooks the leader and drags them back'],
        quake: ['Earthquake', 'Shakes the platforms of whoever is ahead'], ufo: ['UFO', 'Carries you up to the player above'],
        cannon: ['Cannon', 'Aim it and fire yourself across the course'],
    };
    const poolOf = i => { const s = new Set(); for (let a = 0; a <= i; a++) { POOL[a].add.forEach(k => s.add(k)); POOL[a].remove.forEach(k => s.delete(k)); } return ORDER.filter(k => s.has(k)); };
    const PARTY_POOL = ORDER.filter(k => k !== 'wind');

    /* ------------------------------------------------------------------------------- colours ---- */
    const hex = h => { if (h[0] !== '#') return h.match(/[\d.]+/g).slice(0, 3).map(Number); const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };      // '#rrggbb' or 'rgb(r,g,b)'
    const mixc = (a, b, k) => { const A = hex(a), B = hex(b); return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(',') + ')'; };
    const rng = s => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const lg = (c, x0, y0, x1, y1, st) => { const g = c.createLinearGradient(x0, y0, x1, y1); st.forEach(s => g.addColorStop(s[0], s[1])); return g; };
    const rg = (c, x, y, r0, r1, st) => { const g = c.createRadialGradient(x, y, r0, x, y, r1); st.forEach(s => g.addColorStop(s[0], s[1])); return g; };
    const poly = (c, pts) => { c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.fill(); };
    const rrect = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); c.fill(); };
    const disc = (c, x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); };

    /* ------------------------------------------------------------------------ the scenery ---- */
    // Every painter draws around (0,0) = the middle of its base, upwards is negative y. P: col (body), dk (shade), lt (light edge), lit (lamps, windows), acc, cl (cloud), v (0|1 variant).
    // K[kind] = { w, h, float: hangs in the sky instead of standing on the ground, rot: spins (rad/s), draw, glow: an extra picture drawn with a pulse }.
    const K = {
        cloud: { w: 230, h: 90, float: 1, draw(c, P) { c.fillStyle = lg(c, 0, -80, 0, 0, [[0, P.cl], [1, mixc(P.cl, P.col, .45)]]); for (const q of [[-62, -22, 26], [-30, -42, 36], [10, -50, 40], [52, -34, 32], [84, -20, 22], [0, -22, 34]]) disc(c, q[0], q[1], q[2]); rrect(c, -90, -24, 190, 24, 12); } },
        balloon: { w: 70, h: 150, float: 1, draw(c, P) { const col = [P.acc, '#ff7a8a', '#9fe8ff'][P.v ? 1 : 0]; c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(0, -4); c.quadraticCurveTo(-8, -30, 0, -58); c.stroke(); c.fillStyle = rg(c, -9, -92, 4, 38, [[0, mixc(col, '#fff', .45)], [1, col]]); c.beginPath(); c.ellipse(0, -90, 26, 32, 0, 0, TAU); c.fill(); poly(c, [[-5, -58], [5, -58], [0, -63]]); } },
        kite: { w: 90, h: 150, float: 1, draw(c, P) { c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, -60); c.bezierCurveTo(-20, -30, 20, -14, 0, 0); c.stroke(); c.fillStyle = P.acc; poly(c, [[0, -140], [28, -100], [0, -62], [-28, -100]]); c.fillStyle = 'rgba(255,255,255,.35)'; poly(c, [[0, -140], [28, -100], [0, -100]]); c.strokeStyle = P.lt; c.lineWidth = 3; c.beginPath(); c.moveTo(0, -62); c.quadraticCurveTo(14, -48, 8, -36); c.quadraticCurveTo(-4, -26, 6, -16); c.stroke(); } },
        windmill: { w: 170, h: 190, draw(c, P) { c.fillStyle = lg(c, -20, 0, 20, 0, [[0, P.lt], [1, P.dk]]); poly(c, [[-22, 0], [-10, -110], [10, -110], [22, 0]]); c.fillStyle = P.dk; poly(c, [[-16, -108], [0, -128], [16, -108]]); c.save(); c.translate(0, -108); c.rotate(.35 + P.v * .5); c.fillStyle = P.lt; for (let i = 0; i < 4; i++) { c.rotate(Math.PI / 2); rrect(c, -4, -70, 8, 70, 3); rrect(c, 4, -70, 18, 30, 3); } c.restore(); c.fillStyle = P.dk; disc(c, 0, -108, 6); } },
        rainbow: { w: 400, h: 200, float: 1, draw(c, P) { const cols = ['#ff6b6b', '#ffb454', '#ffe27a', '#7ee08f', '#6bb7ff', '#a98bff']; c.lineWidth = 11; for (let i = 0; i < cols.length; i++) { c.strokeStyle = cols[i]; c.globalAlpha = .55; c.beginPath(); c.arc(0, -4, 180 - i * 11, Math.PI, 0); c.stroke(); } c.globalAlpha = 1; } },
        lamp: { w: 160, h: 230, draw(c, P) { c.fillStyle = P.dk; rrect(c, -5, -200, 10, 200, 3); rrect(c, -16, -10, 32, 10, 3); c.save(); c.translate(0, -200); c.rotate(-.06); rrect(c, 0, -5, 52, 8, 4); c.fillStyle = P.col; rrect(c, 40, -3, 30, 11, 5); c.restore(); c.fillStyle = mixc(P.lit, P.col, .3); rrect(c, 44, -192, 22, 6, 3); },
                glow(c, P) { c.fillStyle = lg(c, 0, -196, 0, 0, [[0, 'rgba(255,230,168,.34)'], [1, 'rgba(255,230,168,0)']]); poly(c, [[44, -194], [66, -194], [112, 0], [0, 0]]); c.fillStyle = rg(c, 55, -194, 2, 34, [[0, 'rgba(255,240,200,.9)'], [1, 'rgba(255,230,168,0)']]); disc(c, 55, -194, 34); } },
        car: { w: 190, h: 70, draw(c, P) { c.fillStyle = lg(c, 0, -58, 0, 0, [[0, P.lt], [1, P.dk]]); c.beginPath(); c.moveTo(-84, -12); c.lineTo(-80, -30); c.quadraticCurveTo(-50, -34, -38, -52); c.lineTo(30, -52); c.quadraticCurveTo(50, -34, 78, -30); c.lineTo(86, -14); c.lineTo(86, -8); c.lineTo(-84, -8); c.closePath(); c.fill(); c.fillStyle = mixc(P.dk, '#000', .3); c.beginPath(); c.moveTo(-30, -46); c.lineTo(-16, -46); c.lineTo(-16, -32); c.lineTo(-42, -32); c.closePath(); c.fill(); c.beginPath(); c.moveTo(-6, -46); c.lineTo(26, -46); c.quadraticCurveTo(40, -36, 48, -32); c.lineTo(-6, -32); c.closePath(); c.fill(); c.fillStyle = '#10131c'; disc(c, -48, -8, 14); disc(c, 52, -8, 14); c.fillStyle = P.lt; disc(c, -48, -8, 6); disc(c, 52, -8, 6); c.fillStyle = mixc(P.lit, P.col, .35); rrect(c, 80, -26, 8, 7, 3); } },
        pillar: { w: 150, h: 270, draw(c, P) { c.fillStyle = lg(c, -26, 0, 26, 0, [[0, P.dk], [.35, P.lt], [1, P.dk]]); c.fillRect(-26, -260, 52, 260); c.fillStyle = P.dk; c.fillRect(-60, -270, 120, 18); c.fillStyle = P.acc; c.globalAlpha = .4; for (let i = 0; i < 4; i++) poly(c, [[-26 + i * 14, 0], [-26 + i * 14 + 8, 0], [-26 + i * 14 + 22, -26], [-26 + i * 14 + 14, -26]]); c.globalAlpha = 1; c.fillStyle = mixc(P.lt, '#fff', .3); c.globalAlpha = .5; rrect(c, -14, -170, 28, 18, 3); c.globalAlpha = 1; } },
        psign: { w: 100, h: 170, draw(c, P) { c.fillStyle = P.dk; c.fillRect(-4, -130, 8, 130); c.fillStyle = mixc('#3a7bd5', P.col, .5); disc(c, 0, -146, 30); c.fillStyle = P.lt; c.font = '800 38px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('P', 0, -145); } },
        cone: { w: 50, h: 60, draw(c, P) { c.fillStyle = mixc('#ff7a2d', P.col, .55); poly(c, [[-18, 0], [-5, -50], [5, -50], [18, 0]]); c.fillStyle = mixc('#ffffff', P.col, .5); poly(c, [[-11, -26], [11, -26], [8.5, -35], [-8.5, -35]]); c.fillStyle = P.dk; rrect(c, -22, -6, 44, 6, 2); } },
        building: { w: 170, h: 280, draw(c, P) { const w = 90 + P.v * 40, h = 170 + P.v * 90; c.fillStyle = lg(c, -w / 2, 0, w / 2, 0, [[0, P.lt], [.3, P.col], [1, P.dk]]); c.fillRect(-w / 2, -h, w, h); c.fillStyle = P.dk; c.fillRect(-w / 2 - 4, -h - 6, w + 8, 8); c.fillRect(-w / 2 + 10, -h - 22, 16, 18); if (P.v) c.fillRect(w / 2 - 34, -h - 36, 6, 30); for (let y = -h + 20, r = 0; y < -22; y += 24, r++) for (let x = -w / 2 + 12, q = 0; x < w / 2 - 14; x += 20, q++) { c.fillStyle = ((q * 5 + r * 3 + P.v * 2) % 7 < 3) ? P.lit : mixc(P.col, '#000', .45); c.globalAlpha = ((q * 5 + r * 3 + P.v * 2) % 7 < 3) ? .7 : .55; c.fillRect(x, y, 10, 13); } c.globalAlpha = 1; } },
        skyline: { w: 480, h: 230, draw(c, P) { c.fillStyle = lg(c, 0, -230, 0, 0, [[0, P.lt], [1, P.col]]); let x = -230; const r = rng(P.v * 77 + 5); while (x < 220) { const w = 34 + r() * 40, h = 70 + r() * 150; c.fillRect(x, -h, w, h); if (r() > .6) c.fillRect(x + w / 2 - 2, -h - 22, 4, 22); x += w + 2; } c.fillStyle = P.lit; c.globalAlpha = .5; const r2 = rng(P.v * 31 + 9); for (let i = 0; i < 40; i++) c.fillRect(-224 + r2() * 440, -14 - r2() * 150, 4, 6); c.globalAlpha = 1; } },
        antenna: { w: 110, h: 250, draw(c, P) { c.fillStyle = P.dk; c.fillRect(-3, -230, 6, 230); c.fillRect(-26, -190, 52, 4); c.fillRect(-18, -158, 36, 4); c.fillRect(-10, -126, 20, 3); poly(c, [[-18, 0], [-3, -80], [3, -80], [18, 0]]); c.strokeStyle = P.dk; c.lineWidth = 2; c.beginPath(); c.moveTo(-26, -188); c.lineTo(-3, -230); c.lineTo(26, -188); c.stroke(); },
                glow(c, P) { c.fillStyle = rg(c, 0, -232, 1, 26, [[0, 'rgba(255,90,90,.95)'], [1, 'rgba(255,90,90,0)']]); disc(c, 0, -232, 26); } },
        tank: { w: 130, h: 160, draw(c, P) { c.fillStyle = P.dk; c.fillRect(-34, -64, 6, 64); c.fillRect(28, -64, 6, 64); c.strokeStyle = P.dk; c.lineWidth = 3; c.beginPath(); c.moveTo(-31, -10); c.lineTo(31, -56); c.moveTo(31, -10); c.lineTo(-31, -56); c.stroke(); c.fillStyle = lg(c, -42, 0, 42, 0, [[0, P.lt], [.5, P.col], [1, P.dk]]); rrect(c, -42, -126, 84, 66, 8); c.fillStyle = P.dk; poly(c, [[-46, -124], [0, -150], [46, -124]]); c.fillStyle = P.lit; c.globalAlpha = .35; c.fillRect(-30, -104, 60, 5); c.globalAlpha = 1; } },
        birds: { w: 200, h: 90, float: 1, draw(c, P) { c.strokeStyle = mixc(P.col, '#000', .35); c.lineWidth = 3; c.lineCap = 'round'; for (const q of [[-60, -50, 1], [-10, -66, 1.2], [44, -44, .9], [88, -62, 1.1], [14, -24, .8]]) { c.beginPath(); c.moveTo(q[0] - 14 * q[2], q[1] + 5 * q[2]); c.quadraticCurveTo(q[0] - 7 * q[2], q[1] - 8 * q[2], q[0], q[1]); c.quadraticCurveTo(q[0] + 7 * q[2], q[1] - 8 * q[2], q[0] + 14 * q[2], q[1] + 5 * q[2]); c.stroke(); } } },
        crane: { w: 360, h: 300, draw(c, P) { c.fillStyle = P.dk; c.fillRect(-60, -240, 10, 240); c.fillRect(50, -240, 10, 240); c.strokeStyle = P.dk; c.lineWidth = 3; c.beginPath(); for (let y = -230; y < -10; y += 46) { c.moveTo(-55, y); c.lineTo(55, y - 46); c.moveTo(55, y); c.lineTo(-55, y - 46); } c.stroke(); c.fillStyle = lg(c, 0, -276, 0, -240, [[0, P.lt], [1, P.col]]); c.fillRect(-170, -262, 330, 18); c.fillRect(-60, -276, 120, 14); c.strokeStyle = P.dk; c.lineWidth = 2; c.beginPath(); c.moveTo(-60, -276); c.lineTo(-170, -262); c.moveTo(60, -276); c.lineTo(160, -262); c.stroke(); c.beginPath(); c.moveTo(120, -244); c.lineTo(120, -150); c.stroke(); c.fillStyle = mixc(P.acc, P.col, .5); rrect(c, 108, -154, 24, 16, 3); } },
        containers: { w: 220, h: 130, draw(c, P) { const cols = [mixc(P.acc, P.col, .6), mixc('#4aa0d6', P.col, .55), mixc('#7ec27a', P.col, .65), mixc('#d9c06a', P.col, .6)]; let k = P.v * 2; const row = (n, y, x0) => { for (let i = 0; i < n; i++) { c.fillStyle = cols[(k++) % 4]; c.fillRect(x0 + i * 62, y, 58, 36); c.fillStyle = 'rgba(0,0,0,.2)'; for (let j = 1; j < 6; j++) c.fillRect(x0 + i * 62 + j * 9, y, 2, 36); } }; row(3, -36, -92); row(2, -74, -62); row(1, -112, -30); } },
        lighthouse: { w: 330, h: 230, draw(c, P) { c.fillStyle = lg(c, -26, 0, 26, 0, [[0, P.lt], [1, P.dk]]); poly(c, [[-28, 0], [-16, -150], [16, -150], [28, 0]]); c.fillStyle = mixc(P.acc, P.col, .45); for (let i = 0; i < 3; i++) poly(c, [[-26 + i * 3.5, -26 - i * 44], [26 - i * 3.5, -26 - i * 44], [24 - i * 3.5, -48 - i * 44], [-24 + i * 3.5, -48 - i * 44]]); c.fillStyle = P.dk; rrect(c, -24, -160, 48, 10, 3); c.fillStyle = mixc(P.lit, P.col, .3); rrect(c, -14, -186, 28, 28, 5); poly(c, [[-20, -186], [0, -210], [20, -186]]); },
                glow(c, P) { c.fillStyle = lg(c, 0, 0, 150, 0, [[0, 'rgba(255,226,150,.5)'], [1, 'rgba(255,226,150,0)']]); c.save(); c.translate(0, -172); poly(c, [[0, -4], [150, -34], [150, 30], [0, 4]]); c.restore(); c.fillStyle = rg(c, 0, -172, 1, 30, [[0, 'rgba(255,236,170,.9)'], [1, 'rgba(255,226,150,0)']]); disc(c, 0, -172, 30); } },
        ship: { w: 330, h: 120, draw(c, P) { c.fillStyle = lg(c, 0, -30, 0, 0, [[0, P.lt], [1, P.dk]]); c.beginPath(); c.moveTo(-150, -34); c.lineTo(140, -34); c.lineTo(112, 0); c.lineTo(-120, 0); c.closePath(); c.fill(); c.fillStyle = P.col; c.fillRect(-60, -64, 110, 30); c.fillRect(-30, -90, 50, 26); c.fillStyle = P.dk; c.fillRect(30, -104, 14, 40); c.fillStyle = P.lit; c.globalAlpha = .6; for (let i = 0; i < 6; i++) c.fillRect(-52 + i * 17, -54, 8, 8); c.globalAlpha = 1; } },
        chimney: { w: 170, h: 330, draw(c, P) { c.fillStyle = lg(c, -22, 0, 22, 0, [[0, P.lt], [.4, P.col], [1, P.dk]]); poly(c, [[-26, 0], [-16, -280], [16, -280], [26, 0]]); c.fillStyle = mixc(P.acc, P.col, .6); for (let i = 0; i < 3; i++) c.fillRect(-18 + i * 0.5, -250 + i * 8 - 0, 36 - i, 10); c.fillStyle = P.dk; rrect(c, -22, -292, 44, 14, 3); c.fillStyle = 'rgba(255,255,255,.07)'; for (let i = 0; i < 5; i++) disc(c, 10 + i * 8 + (i % 2) * 6, -306 - i * 6, 18 + i * 6); } },
        gear: { w: 190, h: 190, rot: .25, draw(c, P) { const R = 78; c.translate(0, -95); c.fillStyle = lg(c, -R, -R, R, R, [[0, P.lt], [1, P.dk]]); c.beginPath(); for (let i = 0; i < 28; i++) { const a = i * TAU / 28, r = i % 2 ? R * .86 : R; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); c.lineTo(Math.cos(a + TAU / 56) * r, Math.sin(a + TAU / 56) * r); } c.closePath(); c.fill(); c.fillStyle = mixc(P.col, '#000', .4); disc(c, 0, 0, R * .5); c.fillStyle = P.col; for (let i = 0; i < 6; i++) { c.save(); c.rotate(i * TAU / 6); rrect(c, -5, -R * .5, 10, R * .36, 3); c.restore(); } c.fillStyle = P.lt; disc(c, 0, 0, 14); } },
        pipes: { w: 280, h: 190, draw(c, P) { c.fillStyle = lg(c, 0, -30, 0, 0, [[0, P.lt], [1, P.dk]]); c.fillRect(-130, -34, 260, 22); c.fillRect(-130, -112, 18, 100); c.fillRect(112, -170, 18, 160); c.fillRect(-130, -112, 120, 16); c.fillStyle = P.dk; for (const x of [-100, -40, 20, 80]) c.fillRect(x, -38, 8, 30); c.fillStyle = mixc(P.acc, P.col, .55); disc(c, 121, -176, 8); c.fillStyle = 'rgba(255,255,255,.08)'; for (let i = 0; i < 4; i++) disc(c, 124 + i * 4, -194 - i * 16, 10 + i * 5); } },
        furnace: { w: 200, h: 170, draw(c, P) { c.fillStyle = lg(c, 0, -130, 0, 0, [[0, P.lt], [1, P.dk]]); c.fillRect(-80, -120, 160, 120); c.fillStyle = P.dk; c.fillRect(-90, -130, 180, 14); c.fillStyle = P.lit; c.globalAlpha = .75; for (const x of [-56, -12, 32]) { rrect(c, x, -92, 30, 40, 4); } c.globalAlpha = 1; c.fillStyle = P.dk; c.fillRect(-70, -164, 20, 40); c.fillRect(40, -150, 16, 28); },
                glow(c, P) { c.fillStyle = rg(c, 0, -70, 1, 90, [[0, 'rgba(255,170,60,.45)'], [1, 'rgba(255,170,60,0)']]); disc(c, 0, -70, 90); } },
        arch: { w: 340, h: 300, draw(c, P) { for (let i = 0; i < 4; i++) { c.strokeStyle = i % 2 ? P.dk : P.lt; c.lineWidth = 16 - i * 2; c.beginPath(); c.arc(0, -10, 130 - i * 28, Math.PI, 0); c.lineTo(130 - i * 28, 0); c.moveTo(-(130 - i * 28), 0); c.lineTo(-(130 - i * 28), -10); c.stroke(); } c.fillStyle = mixc(P.col, '#000', .55); c.beginPath(); c.arc(0, -10, 44, Math.PI, 0); c.lineTo(44, 0); c.lineTo(-44, 0); c.closePath(); c.fill(); },
                glow(c, P) { c.strokeStyle = 'rgba(199,251,233,.45)'; c.lineWidth = 4; c.beginPath(); c.arc(0, -10, 143, Math.PI, 0); c.stroke(); c.beginPath(); c.arc(0, -10, 59, Math.PI, 0); c.stroke(); } },
        tilepillar: { w: 110, h: 300, draw(c, P) { c.fillStyle = lg(c, -34, 0, 34, 0, [[0, P.dk], [.4, P.lt], [1, P.dk]]); c.fillRect(-34, -290, 68, 290); c.strokeStyle = 'rgba(0,0,0,.22)'; c.lineWidth = 1.5; for (let y = -290; y < 0; y += 26) { c.beginPath(); c.moveTo(-34, y); c.lineTo(34, y); c.stroke(); } for (const x of [-12, 12]) { c.beginPath(); c.moveTo(x, -290); c.lineTo(x, 0); c.stroke(); } c.fillStyle = P.dk; c.fillRect(-42, -300, 84, 16); c.fillStyle = P.acc; c.globalAlpha = .35; c.fillRect(-34, -40, 68, 8); c.globalAlpha = 1; } },
        hanglamp: { w: 120, h: 200, draw(c, P) { c.fillStyle = P.dk; c.fillRect(-1.5, -200, 3, 140); poly(c, [[-26, -52], [26, -52], [18, -66], [-18, -66]]); c.fillStyle = mixc(P.lit, P.col, .35); rrect(c, -22, -52, 44, 8, 3); },
                glow(c, P) { c.fillStyle = lg(c, 0, -48, 0, 90, [[0, 'rgba(199,251,233,.34)'], [1, 'rgba(199,251,233,0)']]); poly(c, [[-22, -46], [22, -46], [58, 90], [-58, 90]]); } },
        roundel: { w: 130, h: 190, draw(c, P) { c.fillStyle = P.dk; c.fillRect(-4, -110, 8, 110); c.strokeStyle = mixc(P.acc, P.col, .45); c.lineWidth = 11; c.beginPath(); c.arc(0, -150, 36, 0, TAU); c.stroke(); c.fillStyle = mixc('#3a7bd5', P.col, .5); rrect(c, -50, -158, 100, 16, 4); c.fillStyle = P.lit; c.globalAlpha = .55; c.fillRect(-28, -153, 56, 6); c.globalAlpha = 1; } },
        peak: { w: 360, h: 270, draw(c, P) { const h = 190 + P.v * 70, w = 150 + P.v * 20; c.fillStyle = lg(c, -w, 0, w, 0, [[0, P.lt], [.5, P.col], [.5, P.dk], [1, P.dk]]); poly(c, [[-w, 0], [-18, -h], [8, -h + 10], [w, 0]]); c.fillStyle = 'rgba(255,255,255,.88)'; poly(c, [[-18, -h], [8, -h + 10], [34, -h * .66], [18, -h * .7], [8, -h * .6], [-6, -h * .72], [-26, -h * .63], [-40, -h * .66]]); c.fillStyle = 'rgba(255,255,255,.18)'; poly(c, [[-w, 0], [-18, -h], [-30, -h * .4], [-60, 0]]); } },
        pines: { w: 210, h: 140, draw(c, P) { const tri = (x, h, w) => { c.fillStyle = lg(c, x - w, 0, x + w, 0, [[0, P.lt], [1, P.dk]]); for (let i = 0; i < 3; i++) poly(c, [[x - w + i * 3, -h * i / 3 * .55], [x, -h * (i + 1) / 3 * .62 - h * .38], [x + w - i * 3, -h * i / 3 * .55]]); }; tri(-60, 110, 26); tri(-10, 130, 30); tri(46, 100, 24); tri(86, 76, 18); c.fillStyle = 'rgba(255,255,255,.55)'; for (const x of [-60, -10, 46]) poly(c, [[x - 10, -60], [x, -92], [x + 10, -60]]); } },
        ridge: { w: 520, h: 190, draw(c, P) { c.fillStyle = lg(c, 0, -190, 0, 0, [[0, P.lt], [1, P.col]]); c.beginPath(); c.moveTo(-250, 0); const r = rng(P.v * 13 + 3); let x = -250; while (x < 250) { const hh = 50 + r() * 120; c.lineTo(x + 20, -hh); c.lineTo(x + 46, -hh * .6); x += 56; } c.lineTo(250, 0); c.closePath(); c.fill(); c.fillStyle = 'rgba(255,255,255,.4)'; c.globalAlpha = .6; for (let i = 0; i < 5; i++) poly(c, [[-210 + i * 100, -90 - r() * 40], [-196 + i * 100, -130], [-180 + i * 100, -92]]); c.globalAlpha = 1; } },
        planet: { w: 300, h: 260, float: 1, draw(c, P) { c.translate(0, -130); const R = 74 + P.v * 10; c.fillStyle = rg(c, -R * .4, -R * .4, 4, R * 1.2, [[0, mixc(P.col, '#fff', .35)], [.6, P.col], [1, P.dk]]); disc(c, 0, 0, R); c.save(); c.beginPath(); c.arc(0, 0, R, 0, TAU); c.clip(); c.fillStyle = 'rgba(255,255,255,.12)'; for (let i = 0; i < 4; i++) c.fillRect(-R, -R * .6 + i * R * .36, R * 2, R * .12); c.restore(); c.strokeStyle = 'rgba(214,219,255,.4)'; c.lineWidth = 9; c.beginPath(); c.ellipse(0, 6, R * 1.55, R * .34, -.28, Math.PI * 1.02, Math.PI * 1.98); c.stroke(); c.strokeStyle = 'rgba(214,219,255,.25)'; c.lineWidth = 4; c.beginPath(); c.ellipse(0, 6, R * 1.7, R * .4, -.28, Math.PI * 1.02, Math.PI * 1.98); c.stroke(); c.strokeStyle = 'rgba(214,219,255,.4)'; c.lineWidth = 9; c.beginPath(); c.ellipse(0, 6, R * 1.55, R * .34, -.28, 0, Math.PI); c.stroke(); } },
        nebula: { w: 420, h: 320, float: 1, draw(c, P) { const cols = [[P.acc, .2, -90, -190, 130], ['#ff8ae6', .14, 70, -150, 110], ['#6bb7ff', .14, -20, -110, 120]]; for (const q of cols) { c.fillStyle = rg(c, q[2], q[3], 4, q[4], [[0, mixc(q[0], P.col, .2).replace('rgb', 'rgba').replace(')', ',' + q[1] * 1.6 + ')')], [1, 'rgba(0,0,0,0)']]); disc(c, q[2], q[3], q[4]); } c.fillStyle = 'rgba(255,255,255,.7)'; const r = rng(P.v * 41 + 7); for (let i = 0; i < 26; i++) { c.globalAlpha = .3 + r() * .6; c.fillRect(-190 + r() * 380, -300 + r() * 280, 1.6, 1.6); } c.globalAlpha = 1; } },
        sat: { w: 200, h: 110, float: 1, draw(c, P) { c.translate(0, -55); c.rotate(-.18); c.fillStyle = lg(c, 0, -14, 0, 14, [[0, P.lt], [1, P.dk]]); rrect(c, -16, -14, 32, 28, 4); c.fillStyle = mixc('#4d6bd6', P.col, .45); for (const s of [-1, 1]) { rrect(c, s * 20 - (s < 0 ? 56 : 0), -10, 56, 20, 2); c.fillStyle = 'rgba(255,255,255,.18)'; for (let i = 1; i < 4; i++) c.fillRect(s * 20 - (s < 0 ? 56 : 0) + i * 14, -10, 1.5, 20); c.fillStyle = mixc('#4d6bd6', P.col, .45); } c.fillStyle = P.dk; c.fillRect(-1, -28, 2, 14); disc(c, 0, -30, 3.5); } },
        station: { w: 360, h: 130, float: 1, draw(c, P) { c.translate(0, -65); c.fillStyle = lg(c, 0, -10, 0, 10, [[0, P.lt], [1, P.dk]]); rrect(c, -150, -4, 300, 8, 3); rrect(c, -26, -22, 52, 44, 8); c.fillStyle = mixc('#4d6bd6', P.col, .4); for (const x of [-130, -78, 50, 102]) { rrect(c, x, -52, 36, 30, 2); rrect(c, x, 22, 36, 30, 2); } c.fillStyle = P.lit; c.globalAlpha = .6; for (let i = 0; i < 3; i++) c.fillRect(-16 + i * 12, -6, 7, 8); c.globalAlpha = 1; } },
        asteroid: { w: 130, h: 100, float: 1, draw(c, P) { c.translate(0, -48); c.fillStyle = rg(c, -14, -14, 4, 52, [[0, P.lt], [1, P.dk]]); poly(c, [[-40, 6], [-28, -26], [-4, -38], [26, -28], [42, -2], [30, 28], [-6, 38], [-34, 26]]); c.fillStyle = 'rgba(0,0,0,.2)'; disc(c, -10, -6, 8); disc(c, 16, 12, 6); disc(c, 8, -20, 4); } },
        volcano: { w: 440, h: 300, draw(c, P) { c.fillStyle = lg(c, -200, 0, 200, 0, [[0, P.lt], [.5, P.col], [1, P.dk]]); poly(c, [[-210, 0], [-44, -200], [44, -200], [210, 0]]); c.fillStyle = mixc(P.dk, '#000', .3); poly(c, [[-52, -196], [52, -196], [40, -186], [-40, -186]]); c.strokeStyle = P.lit; c.globalAlpha = .6; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(-10, -190); c.quadraticCurveTo(-30, -130, -14, -80); c.quadraticCurveTo(-4, -40, -26, 0); c.stroke(); c.beginPath(); c.moveTo(24, -190); c.quadraticCurveTo(40, -120, 56, -64); c.stroke(); c.globalAlpha = 1; c.fillStyle = 'rgba(255,255,255,.07)'; for (let i = 0; i < 5; i++) disc(c, 8 + i * 10, -214 - i * 18, 18 + i * 7); },
                glow(c, P) { c.fillStyle = rg(c, 0, -196, 2, 120, [[0, 'rgba(255,120,50,.5)'], [1, 'rgba(255,120,50,0)']]); disc(c, 0, -196, 120); } },
        rockfloat: { w: 150, h: 110, float: 1, draw(c, P) { c.translate(0, -55); c.fillStyle = lg(c, 0, -40, 0, 40, [[0, P.lt], [1, P.dk]]); poly(c, [[-56, 4], [-36, -30], [0, -40], [38, -26], [60, 4], [30, 34], [-8, 44], [-40, 28]]); c.strokeStyle = P.lit; c.globalAlpha = .65; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(-20, -30); c.lineTo(-8, -6); c.lineTo(-26, 16); c.moveTo(18, -26); c.lineTo(28, 2); c.stroke(); c.globalAlpha = 1; } },
        plume: { w: 200, h: 280, float: 1, draw(c, P) { for (let i = 0; i < 9; i++) { const k = i / 8; c.fillStyle = mixc(P.col, P.lit, .06 + .1 * (1 - k)).replace('rgb', 'rgba').replace(')', ',' + (.55 - k * .25) + ')'); disc(c, Math.sin(i * 1.7 + P.v * 3) * 16 + k * 20, -20 - k * 220, 20 + k * 36); } } },
        storm: { w: 420, h: 200, float: 1, draw(c, P) { c.fillStyle = lg(c, 0, -190, 0, 0, [[0, mixc(P.cl, '#fff', .12)], [1, mixc(P.cl, '#000', .35)]]); for (const q of [[-130, -38, 46], [-76, -78, 56], [-6, -104, 64], [64, -80, 58], [124, -44, 48], [8, -42, 60]]) disc(c, q[0], q[1], q[2]); rrect(c, -170, -50, 340, 50, 24); },
                glow(c, P) { c.fillStyle = rg(c, 0, -80, 2, 150, [[0, 'rgba(255,229,138,.38)'], [1, 'rgba(255,229,138,0)']]); disc(c, 0, -80, 150); } },
        crag: { w: 380, h: 300, draw(c, P) { c.fillStyle = lg(c, -170, 0, 170, 0, [[0, P.lt], [.5, P.col], [1, P.dk]]); poly(c, [[-180, 0], [-120, -120], [-90, -90], [-40, -230 - P.v * 30], [0, -150], [40, -200], [90, -110], [120, -150], [180, 0]]); c.fillStyle = 'rgba(255,255,255,.14)'; poly(c, [[-40, -230 - P.v * 30], [0, -150], [-12, -120], [-62, -150]]); c.fillStyle = P.acc; c.globalAlpha = .25; poly(c, [[-40, -230 - P.v * 30], [-30, -214 - P.v * 30], [-50, -214 - P.v * 30]]); c.globalAlpha = 1; } },
        bolt: { w: 140, h: 260, float: 1, draw() {}, glow(c, P) { c.strokeStyle = 'rgba(255,240,170,.95)'; c.lineWidth = 5; c.lineJoin = 'round'; c.beginPath(); c.moveTo(10, -250); c.lineTo(-14, -176); c.lineTo(10, -160); c.lineTo(-18, -86); c.lineTo(4, -70); c.lineTo(-22, 0); c.stroke(); c.strokeStyle = 'rgba(255,229,138,.3)'; c.lineWidth = 14; c.stroke(); } },
    };
    // sprite cache: one small canvas per (arena, kind, layer, variant[, glow]). The far layer is painted at a lower resolution on purpose: it comes out soft, like distance.
    const cache = new Map(), dprNow = () => Math.min(2, window.devicePixelRatio || 1);
    function sprite(idx, kind, layer, v, glow) {
        const key = idx + '|' + kind + '|' + layer + '|' + v + (glow ? 'g' : ''); let s = cache.get(key); if (s) return s;
        const def = K[kind], th = T[idx], pad = 8, S = dprNow() * (layer === 'far' ? 0.55 : 0.85), W = def.w + pad * 2, H = def.h + pad * 2, cv = document.createElement('canvas');
        cv.width = Math.ceil(W * S); cv.height = Math.ceil(H * S); const c = cv.getContext('2d'); c.scale(S, S); c.translate(W / 2, H - pad);
        const col = layer === 'far' ? th.far : th.mid, P = { col, dk: mixc(col, '#000000', .3), lt: mixc(col, '#ffffff', .17), lit: th.lit, acc: th.acc, cl: th.cloud || '#ffffff', v, far: layer === 'far' };
        c.lineJoin = 'round';
        try { if (glow) def.glow && def.glow(c, P); else def.draw(c, P); } catch (e) {}
        s = { cv, w: W, h: H, ox: W / 2, oy: H - pad, def }; cache.set(key, s); return s;
    }
    function put(c, s, x, y, k, a, spin) {
        c.globalAlpha = a;
        if (spin) { const mid = s.def.h / 2; c.save(); c.translate(x, y - mid * k); c.rotate(spin); c.drawImage(s.cv, -s.ox * k, -(s.oy - mid) * k, s.w * k, s.h * k); c.restore(); }          // spinning pieces (gears) turn around their middle
        else c.drawImage(s.cv, x - s.ox * k, y - s.oy * k, s.w * k, s.h * k);
    }

    /* --------------------------------------------------------------- the live race background ---- */
    let rulesNow = null, cur = null, idx = -1, far = [], mid = [], air = [], lastT = 0, flash = 0, flashAt = 0, tagEl = null, poolSet = null, vig = null;
    function restore() { Object.assign(PLAT, PLAT0); for (const k in ITEMS0) { ITEMS[k].name = ITEMS0[k].name; ITEMS[k].color = ITEMS0[k].color; } }
    // choose the arena for this race: your trophies decide; a party match shares the Playground and the classic power-ups
    function pick(seed) {
        let i = 0, party = !!window.partyMatch;
        if (!party && window.Trophies) { try { i = Trophies.arenaOf(prog().tr || 0); } catch (e) { i = 0; } }
        const t = testGet(); if (!party && t >= 0) i = t;                      // the test switch on the home screen (src/ui/arenatest.js) overrides the arena
        set(i, seed || 1, { party });
    }
    function testGet() { try { const v = localStorage.getItem('rr_arena_test'); return v === null || v === '' ? -1 : Math.max(-1, Math.min(T.length - 1, +v)); } catch (e) { return -1; } }
    function testSet(i) { try { if (i < 0) localStorage.removeItem('rr_arena_test'); else localStorage.setItem('rr_arena_test', String(i)); } catch (e) {} window.dispatchEvent(new Event('arenatest')); }
    function layer(th, kinds, spacing, depthMax, r) {
        const out = []; for (let d = 40 + r() * 80; d < depthMax; d += spacing * (0.75 + r() * 0.5)) { const k = kinds[Math.floor(r() * kinds.length)]; out.push({ d, x: .06 + r() * .88, k, v: r() > .5 ? 1 : 0, s: .8 + r() * .4, up: K[k].float ? r() * 140 : 0 }); }
        return out;
    }
    function set(i, seed, o) {
        restore(); idx = Math.max(0, Math.min(T.length - 1, i)); cur = T[idx];
        PLAT.normal = cur.plat;
        for (const k in cur.items) { ITEMS[k].name = cur.items[k][0]; ITEMS[k].color = cur.items[k][1]; }
        poolSet = new Set(o && o.party ? PARTY_POOL : poolOf(idx));
        rulesNow = o && o.party ? null : { types: new Set(LEDGES.slice(0, LEDGE_COUNT[Math.min(idx, LEDGE_COUNT.length - 1)])), ceilings: idx >= CEILINGS_FROM };
        const r = rng((seed | 0) + idx * 97), L = Math.max(9000, typeof TRACK === 'number' ? TRACK : 9000);
        far = layer(cur, cur.kinds.far, 330, L * 0.09 + 1300, r); mid = layer(cur, cur.kinds.mid, 240, L * 0.2 + 1300, r);
        air = []; for (let a = 0; a < 26; a++) air.push({ x: r(), y: r(), s: .5 + r(), v: .4 + r() * .8 });
        flash = 0; flashAt = 3 + r() * 5; lastT = 0;
        banner(cur.name, idx);
    }
    function clear() { restore(); cur = null; idx = -1; poolSet = null; rulesNow = null; if (tagEl) tagEl.classList.remove('on'); }
    function banner(name, i) {
        if (!tagEl) { tagEl = document.createElement('div'); tagEl.id = 'arena-tag'; document.body.appendChild(tagEl); }
        tagEl.innerHTML = '<small>ARENA ' + (i + 1) + '</small><b>' + name.toUpperCase() + '</b>';
        tagEl.classList.remove('on'); void tagEl.offsetWidth; tagEl.classList.add('on');
        clearTimeout(banner._t); banner._t = setTimeout(() => tagEl && tagEl.classList.remove('on'), 3200);
    }
    const on = () => !!cur;
    function skyFill(c, W, H, th, p) { const a = th.sky[0], b = th.sky[1]; c.fillStyle = lg(c, 0, 0, 0, H, [[0, mixc(a[0], b[0], p)], [1, mixc(a[1], b[1], p)]]); c.fillRect(0, 0, W, H); }
    function orbDraw(c, W, H, th, k) {
        const o = th.orb; if (!o) return; const x = o.x * W, y = o.y * H, R = o.r * (k || 1);
        c.fillStyle = rg(c, x, y, R * .5, R * 4.2, [[0, mixc(o.c, '#ffffff', 0).replace('rgb', 'rgba').replace(')', ',.3)')], [1, 'rgba(255,255,255,0)']]); c.fillRect(x - R * 4.2, y - R * 4.2, R * 8.4, R * 8.4);
        c.fillStyle = o.c; c.globalAlpha = .92; disc(c, x, y, R); c.globalAlpha = 1;
    }
    function mistFill(c, W, H, th, y0, y1, a) { c.fillStyle = lg(c, 0, y0, 0, y1, [[0, mixc(th.mist, th.mist, 0).replace('rgb', 'rgba').replace(')', ',0)')], [1, mixc(th.mist, th.mist, 0).replace('rgb', 'rgba').replace(')', ',' + a + ')')]]); c.fillRect(0, y0, W, y1 - y0); }
    function vignette(c, W, H) {
        if (!vig) { vig = document.createElement('canvas'); vig.width = vig.height = 128; const x = vig.getContext('2d'); x.fillStyle = rg(x, 64, 64, 30, 90, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.34)']]); x.fillRect(0, 0, 128, 128); }
        c.drawImage(vig, 0, 0, W, H);
    }
    function drawLayer(c, list, name, W, H, base, climbed, f, alpha, kScale, now, th) {
        for (const p of list) {
            const s = sprite(idx, p.k, name, p.v), k = p.s * kScale, y = base - p.d + climbed * f - p.up;
            if (y < 0 || y - s.h * k > H) continue;
            const x = W * p.x, def = s.def;
            put(c, s, x, y, k, alpha, def.rot ? now * def.rot * (p.v ? 1 : -1) : 0);
            if (def.glow) { const g = sprite(idx, p.k, name, p.v, true); c.globalCompositeOperation = 'lighter'; put(c, g, x, y, k, alpha * (.55 + .45 * Math.sin(now * (p.k === 'antenna' ? 3.2 : 5) + p.d * .01)), 0); c.globalCompositeOperation = 'source-over'; }
        }
        c.globalAlpha = 1;
    }
    function drawSky(c, W, H, camY) {
        if (!cur) return;
        const now = performance.now() / 1000, dt = Math.min(0.05, lastT ? now - lastT : 0); lastT = now;
        const prog_ = Math.max(0, Math.min(1, (START_Y - camY) / Math.max(1, TRACK)));
        c.save();
        skyFill(c, W, H, cur, prog_); orbDraw(c, W, H, cur);
        const climbed = (START_Y - VH * 0.62) - camY, base = H * 0.99;
        drawLayer(c, far, 'far', W, H, base, climbed, 0.09, 0.5, 1.2, now, cur);
        mistFill(c, W, H, cur, H * 0.2, H, 0.3);
        drawLayer(c, mid, 'mid', W, H, base, climbed, 0.2, 0.62, 0.92, now, cur);
        mistFill(c, W, H, cur, H * 0.5, H, 0.26);
        // a few drifting specks
        const kind = cur.air[0], col = cur.air[1], dens = cur.air[2]; c.fillStyle = col; c.strokeStyle = col;
        for (let i = 0; i < air.length; i++) {
            const q = air[i]; if (i / air.length > dens + 0.15) break;
            if (kind === 'snow') { q.y += dt * 0.07 * q.v; q.x += Math.sin(now + i) * dt * 0.01; }
            else if (kind === 'rain') q.y += dt * 1.3 * q.v;
            else if (kind === 'ash') { q.y += dt * 0.05 * q.v; q.x += dt * 0.02; }
            else if (kind === 'spark') q.y -= dt * 0.18 * q.v;
            else if (kind === 'star') { /* fixed, twinkling */ }
            else { q.y -= dt * 0.02 * q.v; q.x += dt * 0.012; }
            if (q.y > 1.02) q.y = -0.02; if (q.y < -0.02) q.y = 1.02; if (q.x > 1.02) q.x = -0.02; if (q.x < -0.02) q.x = 1.02;
            const x = q.x * W, y = q.y * H;
            if (kind === 'rain') { c.globalAlpha = 0.3; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 3, y + 14 * q.s); c.stroke(); }
            else if (kind === 'star') { c.globalAlpha = 0.3 + 0.6 * Math.abs(Math.sin(now * (0.6 + q.v) + i)); c.fillRect(x, y, 1.6 * q.s, 1.6 * q.s); }
            else { c.globalAlpha = kind === 'spark' ? 0.85 : 0.5; disc(c, x, y, (kind === 'snow' ? 2.2 : kind === 'spark' ? 1.5 : 1.8) * q.s); }
        }
        c.globalAlpha = 1;
        if (idx === 9) {                                                   // Summit: a cosmetic lightning flash now and then (it never touches the platforms)
            flashAt -= dt; if (flashAt <= 0) { flash = 1; flashAt = 4 + Math.random() * 7; }
            if (flash > 0) { c.fillStyle = 'rgba(255,255,230,' + 0.2 * flash + ')'; c.fillRect(0, 0, W, H); flash -= dt * 3.2; }
        }
        vignette(c, W, H);
        c.restore();
    }

    /* ------------------------------------------------------------- a still picture of an arena ---- */
    // for the home screen and the Arenas screen: `cv` is the target canvas (already sized in device pixels), w/h are its CSS size.
    // opts: { prog: sky position 0..1, ground: draw a ground strip, props: how much scenery (0..1) }
    function paintScene(cv, i, w, h, opts) {
        const th = T[i], o = opts || {}, dpr = cv.width / w, c = cv.getContext('2d'), r = rng(1234 + i * 71);
        c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
        const keep = idx; idx = i;                                            // sprite() reads the current arena index for its cache key
        try {
            skyFill(c, w, h, th, o.prog === undefined ? 0.15 : o.prog); orbDraw(c, w, h, th, Math.min(1, h / 520));
            const horizon = h * (o.horizon || (th.ground ? 0.8 : 1.05));
            const place = (list, name, a, scale, n) => {
                for (let q = 0; q < n; q++) {
                    const k = list[q % list.length], def = K[k], s = sprite(i, k, name, q % 2), kk = Math.min(scale * h / def.h, 1.5) * (.85 + r() * .3), x = w * ((q + .5) / n + (r() - .5) * .18);
                    const y = def.float ? h * (.22 + r() * .34) + def.h * kk * .5 : horizon + (name === 'mid' ? h * .07 : 0);
                    put(c, s, x, y, kk, a, def.rot ? (q + 1) * .7 : 0);
                    if (def.glow) { const g = sprite(i, k, name, q % 2, true); c.globalCompositeOperation = 'lighter'; put(c, g, x, y, kk, a * .8, 0); c.globalCompositeOperation = 'source-over'; }
                }
            };
            const dens = o.props === undefined ? 1 : o.props;
            const al = o.alpha || 1, mi = o.mist === undefined ? 1 : o.mist * 4;                // alpha: more punch for the big picture; mist: how much haze
            place(th.kinds.far, 'far', Math.min(1, .7 * al), .36, Math.max(2, Math.round(3 * dens)));
            mistFill(c, w, h, th, h * .35, h, .25 * mi);
            place(th.kinds.mid, 'mid', Math.min(1, .88 * al), .3, Math.max(2, Math.round(3 * dens)));
            if (th.ground && o.ground !== false) { c.fillStyle = lg(c, 0, horizon, 0, h, [[0, th.ground], [1, mixc(th.ground, '#000', .35)]]); c.fillRect(0, horizon + h * .06, w, h); c.fillStyle = lg(c, 0, horizon + h * .02, 0, horizon + h * .1, [[0, 'rgba(255,255,255,.1)'], [1, 'rgba(255,255,255,0)']]); c.fillRect(0, horizon + h * .06, w, h * .06); }
            mistFill(c, w, h, th, h * .55, h, .18 * mi);
            vignette(c, w, h);
        } finally { idx = keep; }
        c.setTransform(1, 0, 0, 1, 0, 0);
    }

    /* ------------------------------------------------------------------------------ power-ups ---- */
    // called by the item roll: removes what the arena does not have, switches the Gust on where it exists, and shifts a few odds
    function shape(w, f, others) {
        if (!cur || !poolSet) return;
        for (const k in w) if (!poolSet.has(k)) w[k] = 0;
        if (poolSet.has('wind')) w.wind = others ? 0.10 + 0.12 * f : 0;
        for (const k in cur.bias) if (w[k] > 0) w[k] *= cur.bias[k];
    }
    // WHICH LEDGES: new players meet the ledge types one at a time (a party race and the other modes keep the full mix).
    //   Playground: normal, boost, moving ledges.  Parking Lot: + crumbling.  Rooftop: + ice.  From the Harbour on: sealed ledges (ceilings) too.
    const LEDGES = ['boost', 'moving', 'fragile', 'ice'], LEDGE_COUNT = [2, 3, 4, 4], CEILINGS_FROM = 3;
    const rules = () => rulesNow;
    const diff = i => ({ add: POOL[i].add.slice(), remove: POOL[i].remove.slice(), pool: poolOf(i) });
    window.ArenaTheme = { pick, set, clear, on, drawSky, shape, paintScene, rules, testGet, testSet, grid: () => cur ? cur.grid : null, index: () => idx, THEMES: T, POOL, INFO, ORDER, poolOf, diff,
        name: i => T[i].name, color: i => T[i].c };
})();
