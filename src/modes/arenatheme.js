// ARENA THEMES: every arena of the trophy road has its own look and its own power-up pool.
// Classic script, loaded AFTER game.js and trophies.js. Arena Race uses the arena your trophies put you in (Build Race has no arena); a party match always looks like the
// Playground and keeps the full classic power-up set so every friend sees (and gets) the same. Other modes are not touched.
//
// LOOK (a background, never an obstacle): a sky gradient that shifts while you climb, a big sun or moon, two layers of far-away scenery that move slowly
// (parallax), mist between the layers, a few drifting specks and a soft vignette. Scenery uses colours very close to the sky so it never looks like something
// you can stand on. Every piece of scenery is painted once into a small cached picture; a frame only does a handful of drawImage calls.
//
// POWER-UPS: the pool follows your trophies (see UNLOCKS below and docs/ARENAS.md), a few leave again later, and each arena renames and recolours the Stun
// Bomb and the Earthquake and makes one or two power-ups a bit more common. The same data feeds the Arenas screen (src/ui/arenas.js).
(function () {
    'use strict';
    const PLAT0 = Object.assign({}, PLAT), ITEMS0 = JSON.parse(JSON.stringify(ITEMS));
    const TAU = Math.PI * 2;

    /* ------------------------------------------------------------------------ the ten arenas ---- */
    const T = [
        { name: 'Playground', tag: 'Learn the jump', c: '#35e0c8', bright: true, light: true, sky: [['#2f94f4', '#c4ecff'], ['#2380e2', '#98d6ff']], orb: { x: .78, y: .16, r: 48, c: '#fff4b8' },
          far: '#a8dbff', mid: '#8ecbff', lit: '#ffffff', acc: '#ffd23f', cloud: '#ffffff', mist: '#eaf7ff', ground: '#7fd18a',
          kinds: { far: ['cloud', 'cloud'], mid: ['kite', 'cloud', 'kite', 'cloud'] },
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
        { name: 'Mountain', tag: 'Thin air, thick snow', c: '#b3a9ff', light: true, sky: [['#2f5f9c', '#d4e9f9'], ['#1f4478', '#9bc3e6']], orb: { x: .2, y: .2, r: 40, c: '#fffbe0' },
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

    /* ----------------------------------------------------------------- power-ups unlock on trophies ---- */
    // The power-ups you can roll depend on your TROPHIES (not only on the arena): a new one arrives at a trophy count, and a few training wheels leave again later.
    // The Arenas screen draws exactly this list as the road. Arena Race only (Build Race stands apart from the arenas); a party keeps the classic set (everything except the Gust).
    // `wind` is the Gust: it was out of the game and comes back from the Rooftop on.
    // Planned, not built yet (they will be slotted in here when they exist): Glider 1200, Grapple 3000, Mirror 4000 (Shield leaves), Snowball 5500, Swap 8800, Lightning 9700 (Earthquake leaves).
    const UNLOCKS = [
        { at: 0,    add: ['rocket', 'bounce', 'giant', 'shield'] },       // Playground: four simple ones (the Shield stops the Giant's bump)
        { at: 150,  add: ['nitro'] },
        { at: 300,  add: ['dj'] },
        { at: 600,  add: ['net'] },                                       // Parking Lot (starts at 500)
        { at: 1000, add: ['wind'] },                                      // Rooftop: the first attack
        { at: 1400, remove: ['giant'] },
        { at: 1750, add: ['bomb'] },                                      // Harbour
        { at: 2350, remove: ['bounce'] },                                 // the springy helper goes: you read the jump yourself
        { at: 2500, add: ['chain'] },                                     // Factory
        { at: 3000, remove: ['nitro'] },
        { at: 3500, add: ['quake'] },                                     // Subway
        { at: 4000, remove: ['net'] },                                    // the last safety item goes
        { at: 4750, add: ['ufo'] },                                       // Mountain
        { at: 6250, add: ['cannon'] },                                    // Space Station
        { at: 7250, add: ['jet'], remove: ['dj'] },                       // the Jetpack is the big brother of the Double Jump
    ];
    const ORDER = ['bounce', 'rocket', 'giant', 'shield', 'dj', 'wind', 'bomb', 'chain', 'quake', 'ufo', 'cannon', 'nitro', 'net', 'jet'];
    const INFO = {
        bounce: ['Super Bounce', 'Springs you up and keeps you bouncy for a few seconds'], rocket: ['Rocket', 'Blasts you far up the course'],
        giant: ['Giant', 'Grow huge: bigger jumps, hard to push around'], shield: ['Shield', 'Blocks every attack for a few seconds'],
        dj: ['Double Jump', 'One extra jump in mid air'], wind: ['Gust', 'A crosswind for everyone ahead of you: their aim goes shaky'],
        bomb: ['Stun Bomb', 'A danger zone that stuns everyone left inside'], chain: ['Chain', 'Hooks the leader and drags them back'],
        quake: ['Earthquake', 'Shakes the platforms of whoever is ahead'], ufo: ['UFO', 'Carries you up to the player above'],
        cannon: ['Cannon', 'Aim it and fire yourself across the course'],
        nitro: ['Nitro', 'Your next 2 jumps launch 25% harder'], net: ['Safety Net', 'A big fall bounces you back to your ledge'],
        jet: ['Jetpack', 'Three extra jumps in mid air (3 charges, 8 seconds)'],
    };
    const COLORS = { rocket: '#ff7a3d', giant: '#ffcf3f', bounce: '#35e0c8', chain: '#c9d1e3', quake: '#ff5470', shield: '#7ee787', wind: '#8fd6ff', ufo: '#7CFF6B', bomb: '#ff3d5a', cannon: '#ff9f43', dj: '#9fe8ff', nitro: '#ff9f1c', net: '#4cc9f0', jet: '#ff6b6b' };
    const poolAt = tr => { const s = new Set(); for (const u of UNLOCKS) if (u.at <= tr) { (u.add || []).forEach(k => s.add(k)); (u.remove || []).forEach(k => s.delete(k)); } return ORDER.filter(k => s.has(k)); };
    const arenaEnd = i => (window.Trophies && Trophies.ARENAS[i + 1]) ? Trophies.ARENAS[i + 1].at - 1 : 1e9;         // the last trophy of arena i
    const poolOfArena = i => poolAt(arenaEnd(i));                                                                      // everything an arena has by its end (the test switch uses it)
    const PARTY_POOL = ['bounce', 'rocket', 'giant', 'shield', 'dj', 'bomb', 'chain', 'quake', 'ufo', 'cannon'];           // the classic set: no Gust, none of the newer ones

    /* ------------------------------------------------------------------------------- colours ---- */
    const hex = h => { if (h[0] !== '#') return h.match(/[\d.]+/g).slice(0, 3).map(Number); if (h.length === 4) h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3]; const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };      // '#rrggbb', '#rgb' or 'rgb(r,g,b)'
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
        // a little propeller plane (v mirrors it) and a hot-air balloon: they only drift through the Playground's sky
        plane: { w: 130, h: 54, float: 1, draw(c, P) { if (P.v) c.scale(-1, 1); c.translate(0, -26);
            c.fillStyle = '#e9eef7'; c.beginPath(); c.ellipse(0, 0, 44, 12, 0, 0, TAU); c.fill();                                           // body
            c.fillStyle = '#ff5d6c'; c.beginPath(); c.moveTo(-44, -2); c.quadraticCurveTo(-58, -10, -56, -22); c.lineTo(-40, -8); c.closePath(); c.fill();   // tail fin
            c.fillStyle = '#c9d3e6'; c.beginPath(); c.moveTo(-36, 2); c.lineTo(-52, 8); c.lineTo(-30, 6); c.closePath(); c.fill();
            c.fillStyle = '#ff5d6c'; c.fillRect(-30, 3, 62, 3);                                                                           // stripe
            c.fillStyle = '#9fd8ff'; c.beginPath(); c.ellipse(14, -5, 11, 5.5, 0, Math.PI, 0); c.fill();                                   // cockpit
            c.fillStyle = '#dfe6f3'; c.beginPath(); c.moveTo(-6, 4); c.lineTo(10, 4); c.lineTo(-4, 20); c.lineTo(-16, 20); c.closePath(); c.fill();   // wing
            c.fillStyle = '#7c8aa6'; c.fillRect(44, -3, 5, 6); c.fillStyle = 'rgba(60,70,90,.55)'; c.beginPath(); c.ellipse(50, 0, 3, 17, 0, 0, TAU); c.fill(); } },
        hotair: { w: 74, h: 118, float: 1, draw(c, P) { c.translate(0, -8);
            c.strokeStyle = 'rgba(70,50,30,.7)'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(-14, -42); c.lineTo(-7, -14); c.moveTo(14, -42); c.lineTo(7, -14); c.stroke();    // ropes
            c.fillStyle = '#a9743f'; rrect(c, -9, -14, 18, 12, 3);                                                                          // basket
            const cols = ['#ff6b6b', '#ffd23f', '#4cc9f0', '#ffd23f', '#ff6b6b'];
            for (let q = 0; q < 5; q++) { const x0 = -30 + q * 12, x1 = x0 + 12; c.fillStyle = cols[q]; c.beginPath(); c.moveTo(0, -112 + (q === 2 ? 0 : 3)); c.bezierCurveTo(x0 * 1.5, -100, x0 * 1.1, -60, x0 * .5, -42); c.lineTo(x1 * .5, -42); c.bezierCurveTo(x1 * 1.1, -60, x1 * 1.5, -100, 0, -112); c.closePath(); c.fill(); }
            c.fillStyle = 'rgba(255,255,255,.22)'; c.beginPath(); c.ellipse(-12, -78, 6, 22, .25, 0, TAU); c.fill(); } },
        balloon: { w: 70, h: 150, float: 1, draw(c, P) { const col = P.v ? '#ff5f7a' : '#ffc928'; c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(0, -4); c.quadraticCurveTo(-8, -30, 0, -58); c.stroke(); c.fillStyle = rg(c, -9, -92, 4, 38, [[0, mixc(col, '#fff', .55)], [1, col]]); c.beginPath(); c.ellipse(0, -90, 26, 32, 0, 0, TAU); c.fill(); poly(c, [[-5, -58], [5, -58], [0, -63]]); c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(-9, -103, 6, 10, -.5, 0, TAU); c.fill(); } },
        kite: { w: 90, h: 150, float: 1, draw(c, P) { c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, -60); c.bezierCurveTo(-20, -30, 20, -14, 0, 0); c.stroke(); c.fillStyle = P.acc; poly(c, [[0, -140], [28, -100], [0, -62], [-28, -100]]); c.fillStyle = 'rgba(255,255,255,.35)'; poly(c, [[0, -140], [28, -100], [0, -100]]); c.strokeStyle = P.lt; c.lineWidth = 3; c.beginPath(); c.moveTo(0, -62); c.quadraticCurveTo(14, -48, 8, -36); c.quadraticCurveTo(-4, -26, 6, -16); c.stroke(); } },
        windmill: { w: 170, h: 190, draw(c, P) { c.fillStyle = lg(c, -20, 0, 20, 0, [[0, P.lt], [1, P.dk]]); poly(c, [[-22, 0], [-10, -110], [10, -110], [22, 0]]); c.fillStyle = P.dk; poly(c, [[-16, -108], [0, -128], [16, -108]]); c.save(); c.translate(0, -108); c.rotate(.35 + P.v * .5); c.fillStyle = P.lt; for (let i = 0; i < 4; i++) { c.rotate(Math.PI / 2); rrect(c, -4, -70, 8, 70, 3); rrect(c, 4, -70, 18, 30, 3); } c.restore(); c.fillStyle = P.dk; disc(c, 0, -108, 6); } },
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
        chimney: { w: 170, h: 330, draw(c, P) { c.fillStyle = lg(c, -22, 0, 22, 0, [[0, P.lt], [.4, P.col], [1, P.dk]]); poly(c, [[-26, 0], [-16, -280], [16, -280], [26, 0]]); c.fillStyle = mixc(P.acc, P.col, .6); for (let i = 0; i < 3; i++) c.fillRect(-18 + i * 0.5, -250 + i * 8 - 0, 36 - i, 10); c.fillStyle = P.dk; rrect(c, -22, -292, 44, 14, 3); for (let i = 0; i < 5; i++) { const sx = 10 + i * 8 + (i % 2) * 6, sy = -306 - i * 6, sr = 20 + i * 7; c.fillStyle = rg(c, sx, sy, 1, sr, [[0, 'rgba(255,255,255,.12)'], [1, 'rgba(255,255,255,0)']]); disc(c, sx, sy, sr); } } },
        gear: { w: 190, h: 190, rot: .25, draw(c, P) { const R = 78; c.translate(0, -95); c.fillStyle = lg(c, -R, -R, R, R, [[0, P.lt], [1, P.dk]]); c.beginPath(); for (let i = 0; i < 28; i++) { const a = i * TAU / 28, r = i % 2 ? R * .86 : R; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); c.lineTo(Math.cos(a + TAU / 56) * r, Math.sin(a + TAU / 56) * r); } c.closePath(); c.fill(); c.fillStyle = mixc(P.col, '#000', .4); disc(c, 0, 0, R * .5); c.fillStyle = P.col; for (let i = 0; i < 6; i++) { c.save(); c.rotate(i * TAU / 6); rrect(c, -5, -R * .5, 10, R * .36, 3); c.restore(); } c.fillStyle = P.lt; disc(c, 0, 0, 14); } },
        pipes: { w: 280, h: 190, draw(c, P) { c.fillStyle = lg(c, 0, -30, 0, 0, [[0, P.lt], [1, P.dk]]); c.fillRect(-130, -34, 260, 22); c.fillRect(-130, -112, 18, 100); c.fillRect(112, -170, 18, 160); c.fillRect(-130, -112, 120, 16); c.fillStyle = P.dk; for (const x of [-100, -40, 20, 80]) c.fillRect(x, -38, 8, 30); c.fillStyle = mixc(P.acc, P.col, .55); disc(c, 121, -176, 8); for (let i = 0; i < 4; i++) { const sx = 124 + i * 4, sy = -194 - i * 16, sr = 12 + i * 6; c.fillStyle = rg(c, sx, sy, 1, sr, [[0, 'rgba(255,255,255,.14)'], [1, 'rgba(255,255,255,0)']]); disc(c, sx, sy, sr); } } },
        furnace: { w: 200, h: 170, draw(c, P) { c.fillStyle = lg(c, 0, -130, 0, 0, [[0, P.lt], [1, P.dk]]); c.fillRect(-80, -120, 160, 120); c.fillStyle = P.dk; c.fillRect(-90, -130, 180, 14); c.fillStyle = P.lit; c.globalAlpha = .75; for (const x of [-56, -12, 32]) { rrect(c, x, -92, 30, 40, 4); } c.globalAlpha = 1; c.fillStyle = P.dk; c.fillRect(-70, -164, 20, 40); c.fillRect(40, -150, 16, 28); },
                glow(c, P) { c.fillStyle = rg(c, 0, -70, 1, 90, [[0, 'rgba(255,170,60,.45)'], [1, 'rgba(255,170,60,0)']]); disc(c, 0, -70, 90); } },
        arch: { w: 340, h: 300, draw(c, P) { for (let i = 0; i < 4; i++) { c.strokeStyle = i % 2 ? P.dk : P.lt; c.lineWidth = 16 - i * 2; c.beginPath(); c.arc(0, -10, 130 - i * 28, Math.PI, 0); c.lineTo(130 - i * 28, 0); c.moveTo(-(130 - i * 28), 0); c.lineTo(-(130 - i * 28), -10); c.stroke(); } c.fillStyle = mixc(P.col, '#000', .55); c.beginPath(); c.arc(0, -10, 44, Math.PI, 0); c.lineTo(44, 0); c.lineTo(-44, 0); c.closePath(); c.fill(); },
                glow(c, P) { c.strokeStyle = 'rgba(199,251,233,.45)'; c.lineWidth = 4; c.beginPath(); c.arc(0, -10, 143, Math.PI, 0); c.stroke(); c.beginPath(); c.arc(0, -10, 59, Math.PI, 0); c.stroke(); } },
        tilepillar: { w: 110, h: 300, draw(c, P) { c.fillStyle = lg(c, -34, 0, 34, 0, [[0, P.dk], [.4, P.lt], [1, P.dk]]); c.fillRect(-34, -290, 68, 290); c.strokeStyle = 'rgba(0,0,0,.22)'; c.lineWidth = 1.5; for (let y = -290; y < 0; y += 26) { c.beginPath(); c.moveTo(-34, y); c.lineTo(34, y); c.stroke(); } for (const x of [-12, 12]) { c.beginPath(); c.moveTo(x, -290); c.lineTo(x, 0); c.stroke(); } c.fillStyle = P.dk; c.fillRect(-42, -300, 84, 16); c.fillStyle = P.acc; c.globalAlpha = .35; c.fillRect(-34, -40, 68, 8); c.globalAlpha = 1; } },
        hanglamp: { w: 120, h: 230, draw(c, P) { c.fillStyle = P.dk; c.fillRect(-1.5, -230, 3, 160); poly(c, [[-26, -66], [26, -66], [18, -80], [-18, -80]]); c.fillStyle = mixc(P.lit, P.col, .25); rrect(c, -22, -66, 44, 8, 3); },
                glow(c, P) { const L = hex(P.lit), a = 'rgba(' + L[0] + ',' + L[1] + ',' + L[2] + ','; c.fillStyle = lg(c, 0, -60, 0, 0, [[0, a + '.36)'], [1, a + '0)']]); poly(c, [[-22, -60], [22, -60], [56, 0], [-56, 0]]); c.fillStyle = rg(c, 0, -62, 1, 30, [[0, a + '.85)'], [1, a + '0)']]); disc(c, 0, -62, 30); } },
        hangsign: { w: 130, h: 200, draw(c, P) { c.strokeStyle = P.dk; c.lineWidth = 2.4; c.beginPath(); c.moveTo(-34, -200); c.lineTo(-34, -92); c.moveTo(34, -200); c.lineTo(34, -92); c.stroke(); c.fillStyle = mixc('#2f6fd0', P.col, .4); rrect(c, -50, -96, 100, 74, 8); c.strokeStyle = mixc('#ffffff', P.col, .35); c.lineWidth = 3; c.strokeRect(-44, -90, 88, 62); c.fillStyle = mixc('#ffffff', P.col, .15); c.font = '800 54px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('P', 0, -58); } },
        roundel: { w: 130, h: 190, draw(c, P) { c.fillStyle = P.dk; c.fillRect(-4, -110, 8, 110); c.strokeStyle = mixc(P.acc, P.col, .45); c.lineWidth = 11; c.beginPath(); c.arc(0, -150, 36, 0, TAU); c.stroke(); c.fillStyle = mixc('#3a7bd5', P.col, .5); rrect(c, -50, -158, 100, 16, 4); c.fillStyle = P.lit; c.globalAlpha = .55; c.fillRect(-28, -153, 56, 6); c.globalAlpha = 1; } },
        peak: { w: 360, h: 270, draw(c, P) { const h = 190 + P.v * 70, w = 150 + P.v * 20; c.fillStyle = lg(c, -w, 0, w, 0, [[0, P.lt], [.5, P.col], [.5, P.dk], [1, P.dk]]); poly(c, [[-w, 0], [-18, -h], [8, -h + 10], [w, 0]]); c.fillStyle = 'rgba(255,255,255,.88)'; poly(c, [[-18, -h], [8, -h + 10], [34, -h * .66], [18, -h * .7], [8, -h * .6], [-6, -h * .72], [-26, -h * .63], [-40, -h * .66]]); c.fillStyle = 'rgba(255,255,255,.18)'; poly(c, [[-w, 0], [-18, -h], [-30, -h * .4], [-60, 0]]); } },
        pines: { w: 210, h: 140, draw(c, P) { const tri = (x, h, w) => { c.fillStyle = lg(c, x - w, 0, x + w, 0, [[0, P.lt], [1, P.dk]]); for (let i = 0; i < 3; i++) poly(c, [[x - w + i * 3, -h * i / 3 * .55], [x, -h * (i + 1) / 3 * .62 - h * .38], [x + w - i * 3, -h * i / 3 * .55]]); }; tri(-60, 110, 26); tri(-10, 130, 30); tri(46, 100, 24); tri(86, 76, 18); c.fillStyle = 'rgba(255,255,255,.55)'; for (const x of [-60, -10, 46]) poly(c, [[x - 10, -60], [x, -92], [x + 10, -60]]); } },
        ridge: { w: 520, h: 190, draw(c, P) { c.fillStyle = lg(c, 0, -190, 0, 0, [[0, P.lt], [1, P.col]]); c.beginPath(); c.moveTo(-250, 0); const r = rng(P.v * 13 + 3); let x = -250; while (x < 250) { const hh = 50 + r() * 120; c.lineTo(x + 20, -hh); c.lineTo(x + 46, -hh * .6); x += 56; } c.lineTo(250, 0); c.closePath(); c.fill(); c.fillStyle = 'rgba(255,255,255,.4)'; c.globalAlpha = .6; for (let i = 0; i < 5; i++) poly(c, [[-210 + i * 100, -90 - r() * 40], [-196 + i * 100, -130], [-180 + i * 100, -92]]); c.globalAlpha = 1; } },
        planet: { w: 300, h: 260, float: 1, draw(c, P) { c.translate(0, -130); const R = 74 + P.v * 10;
            const ring = (a0, a1) => { c.lineCap = 'butt'; c.strokeStyle = 'rgba(214,219,255,.55)'; c.lineWidth = 9; c.beginPath(); c.ellipse(0, 6, R * 1.55, R * .34, -.28, a0, a1); c.stroke(); c.strokeStyle = 'rgba(214,219,255,.32)'; c.lineWidth = 4; c.beginPath(); c.ellipse(0, 6, R * 1.7, R * .4, -.28, a0, a1); c.stroke(); };
            ring(Math.PI, TAU);                                                                                        // the back of the ring first: the planet hides it
            c.fillStyle = rg(c, -R * .4, -R * .4, 4, R * 1.2, [[0, mixc(P.col, '#fff', .35)], [.6, P.col], [1, P.dk]]); disc(c, 0, 0, R);
            c.save(); c.beginPath(); c.arc(0, 0, R, 0, TAU); c.clip(); c.fillStyle = 'rgba(255,255,255,.12)'; for (let i = 0; i < 4; i++) c.fillRect(-R, -R * .6 + i * R * .36, R * 2, R * .12); c.restore();
            ring(0, Math.PI); } },                                                                                     // the front of the ring over the planet
        nebula: { w: 420, h: 320, float: 1, draw(c, P) { const cols = [[P.acc, .2, -90, -190, 130], ['#ff8ae6', .14, 70, -150, 110], ['#6bb7ff', .14, -20, -110, 120]]; for (const q of cols) { c.fillStyle = rg(c, q[2], q[3], 4, q[4], [[0, mixc(q[0], P.col, .2).replace('rgb', 'rgba').replace(')', ',' + q[1] * 1.6 + ')')], [1, 'rgba(0,0,0,0)']]); disc(c, q[2], q[3], q[4]); } c.fillStyle = 'rgba(255,255,255,.7)'; const r = rng(P.v * 41 + 7); for (let i = 0; i < 26; i++) { c.globalAlpha = .3 + r() * .6; c.fillRect(-190 + r() * 380, -300 + r() * 280, 1.6, 1.6); } c.globalAlpha = 1; } },
        sat: { w: 200, h: 110, float: 1, draw(c, P) { c.translate(0, -55); c.rotate(-.18); c.fillStyle = lg(c, 0, -14, 0, 14, [[0, P.lt], [1, P.dk]]); rrect(c, -16, -14, 32, 28, 4); c.fillStyle = mixc('#4d6bd6', P.col, .45); for (const s of [-1, 1]) { rrect(c, s * 20 - (s < 0 ? 56 : 0), -10, 56, 20, 2); c.fillStyle = 'rgba(255,255,255,.18)'; for (let i = 1; i < 4; i++) c.fillRect(s * 20 - (s < 0 ? 56 : 0) + i * 14, -10, 1.5, 20); c.fillStyle = mixc('#4d6bd6', P.col, .45); } c.fillStyle = P.dk; c.fillRect(-1, -28, 2, 14); disc(c, 0, -30, 3.5); } },
        station: { w: 360, h: 130, float: 1, draw(c, P) { c.translate(0, -65); c.fillStyle = lg(c, 0, -10, 0, 10, [[0, P.lt], [1, P.dk]]); rrect(c, -150, -4, 300, 8, 3); rrect(c, -26, -22, 52, 44, 8); c.fillStyle = mixc('#4d6bd6', P.col, .4); for (const x of [-130, -78, 50, 102]) { rrect(c, x, -52, 36, 30, 2); rrect(c, x, 22, 36, 30, 2); } c.fillStyle = P.lit; c.globalAlpha = .6; for (let i = 0; i < 3; i++) c.fillRect(-16 + i * 12, -6, 7, 8); c.globalAlpha = 1; } },
        asteroid: { w: 130, h: 100, float: 1, draw(c, P) { c.translate(0, -48); c.fillStyle = rg(c, -14, -14, 4, 52, [[0, P.lt], [1, P.dk]]); poly(c, [[-40, 6], [-28, -26], [-4, -38], [26, -28], [42, -2], [30, 28], [-6, 38], [-34, 26]]); c.fillStyle = 'rgba(0,0,0,.2)'; disc(c, -10, -6, 8); disc(c, 16, 12, 6); disc(c, 8, -20, 4); } },
        volcano: { w: 440, h: 350, draw(c, P) { c.fillStyle = lg(c, -200, 0, 200, 0, [[0, P.lt], [.5, P.col], [1, P.dk]]); poly(c, [[-210, 0], [-44, -200], [44, -200], [210, 0]]); c.fillStyle = mixc(P.dk, '#000', .3); poly(c, [[-52, -196], [52, -196], [40, -186], [-40, -186]]); c.strokeStyle = P.lit; c.globalAlpha = .6; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(-10, -190); c.quadraticCurveTo(-30, -130, -14, -80); c.quadraticCurveTo(-4, -40, -26, 0); c.stroke(); c.beginPath(); c.moveTo(24, -190); c.quadraticCurveTo(40, -120, 56, -64); c.stroke(); c.globalAlpha = 1; for (let i = 0; i < 6; i++) { const sx = 8 + i * 10, sy = -214 - i * 20, sr = 22 + i * 9; c.fillStyle = rg(c, sx, sy, 1, sr, [[0, 'rgba(230,205,195,.2)'], [1, 'rgba(230,205,195,0)']]); disc(c, sx, sy, sr); } },
                glow(c, P) { c.fillStyle = rg(c, 0, -196, 2, 120, [[0, 'rgba(255,120,50,.5)'], [1, 'rgba(255,120,50,0)']]); disc(c, 0, -196, 120); } },
        rockfloat: { w: 150, h: 110, float: 1, draw(c, P) { c.translate(0, -55); c.fillStyle = lg(c, 0, -40, 0, 40, [[0, P.lt], [1, P.dk]]); poly(c, [[-56, 4], [-36, -30], [0, -40], [38, -26], [60, 4], [30, 34], [-8, 44], [-40, 28]]); c.strokeStyle = P.lit; c.globalAlpha = .65; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(-20, -30); c.lineTo(-8, -6); c.lineTo(-26, 16); c.moveTo(18, -26); c.lineTo(28, 2); c.stroke(); c.globalAlpha = 1; } },
        plume: { w: 200, h: 340, float: 1, draw(c, P) { for (let i = 0; i < 9; i++) { const k = i / 8; c.fillStyle = mixc(P.col, P.lit, .06 + .1 * (1 - k)).replace('rgb', 'rgba').replace(')', ',' + (.55 - k * .25) + ')'); disc(c, Math.sin(i * 1.7 + P.v * 3) * 16 + k * 20, -20 - k * 220, 20 + k * 36); } } },
        storm: { w: 420, h: 200, float: 1, draw(c, P) { c.fillStyle = lg(c, 0, -190, 0, 0, [[0, mixc(P.cl, '#fff', .12)], [1, mixc(P.cl, '#000', .35)]]); for (const q of [[-130, -38, 46], [-76, -78, 56], [-6, -104, 64], [64, -80, 58], [124, -44, 48], [8, -42, 60]]) disc(c, q[0], q[1], q[2]); rrect(c, -170, -50, 340, 50, 24); },
                glow(c, P) { c.fillStyle = rg(c, 0, -80, 2, 150, [[0, 'rgba(255,229,138,.38)'], [1, 'rgba(255,229,138,0)']]); disc(c, 0, -80, 150); } },
        stormb: { w: 420, h: 380, float: 1, draw(c, P) { c.translate(0, -205); c.fillStyle = lg(c, 0, -190, 0, 0, [[0, mixc(P.cl, '#fff', .12)], [1, mixc(P.cl, '#000', .35)]]); for (const q of [[-130, -38, 46], [-76, -78, 56], [-6, -104, 64], [64, -80, 58], [124, -44, 48], [8, -42, 60]]) disc(c, q[0], q[1], q[2]); rrect(c, -170, -50, 340, 50, 24); },
                glow(c, P) { c.translate(0, -205); c.fillStyle = rg(c, 0, -80, 2, 150, [[0, 'rgba(255,229,138,.34)'], [1, 'rgba(255,229,138,0)']]); disc(c, 0, -80, 150); c.lineJoin = 'round'; c.lineCap = 'round'; const bolt = () => { c.beginPath(); c.moveTo(14, -6); c.lineTo(-10, 52); c.lineTo(12, 66); c.lineTo(-16, 130); c.lineTo(2, 142); c.lineTo(-20, 196); c.stroke(); }; c.strokeStyle = 'rgba(255,229,138,.28)'; c.lineWidth = 14; bolt(); c.strokeStyle = 'rgba(255,244,190,.95)'; c.lineWidth = 4.5; bolt(); } },
        crag: { w: 380, h: 300, draw(c, P) { c.fillStyle = lg(c, -170, 0, 170, 0, [[0, P.lt], [.5, P.col], [1, P.dk]]); poly(c, [[-180, 0], [-120, -120], [-90, -90], [-40, -230 - P.v * 30], [0, -150], [40, -200], [90, -110], [120, -150], [180, 0]]); c.fillStyle = 'rgba(255,255,255,.14)'; poly(c, [[-40, -230 - P.v * 30], [0, -150], [-12, -120], [-62, -150]]); } },
        bolt: { w: 140, h: 260, float: 1, draw() {}, glow(c, P) { c.strokeStyle = 'rgba(255,240,170,.95)'; c.lineWidth = 5; c.lineJoin = 'round'; c.beginPath(); c.moveTo(10, -250); c.lineTo(-14, -176); c.lineTo(10, -160); c.lineTo(-18, -86); c.lineTo(4, -70); c.lineTo(-22, 0); c.stroke(); c.strokeStyle = 'rgba(255,229,138,.3)'; c.lineWidth = 14; c.stroke(); } },
    };
    // sprite cache: one small canvas per (arena, kind, layer, variant[, glow]). The far layer is painted at a lower resolution on purpose: it comes out soft, like distance.
    const cache = new Map(), dprNow = () => Math.min(2, window.devicePixelRatio || 1);
    function sprite(idx, kind, layer, v, glow) {
        const key = idx + '|' + kind + '|' + layer + '|' + v + (glow ? 'g' : ''); let s = cache.get(key); if (s) return s;
        const def = K[kind], th = T[idx], pad = 8, S = dprNow() * (layer === 'far' || layer === 'rfar' ? 0.55 : layer === 'near' ? 1 : 0.85), W = def.w + pad * 2, H = def.h + pad * 2, cv = document.createElement('canvas');
        cv.width = Math.ceil(W * S); cv.height = Math.ceil(H * S); const c = cv.getContext('2d'); c.scale(S, S); c.translate(W / 2, H - pad);
        // 'rfar' / 'rmid' are the race layers: the far one is fogged into the haze colour instead of being see-through, so the sun and the moon never shine through a building or a mountain
        const col = layer === 'rfar' ? mixc(th.far, th.mist, .3) : layer === 'far' ? th.far : layer === 'near' ? (th.near || mixc(th.mid, th.lit, .3)) : th.mid, P = { col, dk: mixc(col, '#000000', .3), lt: mixc(col, '#ffffff', .17), lit: th.lit, acc: th.acc, cl: th.cloud || '#ffffff', v, far: layer === 'far' || layer === 'rfar' };
        c.lineJoin = 'round';
        try { if (glow) def.glow && def.glow(c, P); else def.draw(c, P); } catch (e) {}
        s = { cv, w: W, h: H, ox: W / 2, oy: H - pad, def }; cache.set(key, s); return s;
    }
    function put(c, s, x, y, k, a, spin) {
        c.globalAlpha = a;
        if (spin) { const mid = s.def.h / 2; c.save(); c.translate(x, y - mid * k); c.rotate(spin); c.drawImage(s.cv, -s.ox * k, -(s.oy - mid) * k, s.w * k, s.h * k); c.restore(); }          // spinning pieces (gears) turn around their middle
        else c.drawImage(s.cv, x - s.ox * k, y - s.oy * k, s.w * k, s.h * k);
    }

    /* ----------------------------------------- the race scenery: ground, towers, floors and standing pieces ---- */
    // Nothing floats that cannot float. Pieces that stand (a car, a lighthouse, a tank) stand on the GROUND, which is there at the start and sinks away as you climb. What stays all the way up is built
    // from things that can reach that high: TOWERS (a building, a crane, a pillar, a pipe, a cliff: tiled from the ground to their top, with a roof or a crane head), FLOORS (a slab, a catwalk, a ceiling beam that
    // span the screen, with cars and lamps standing on or hanging from them) and real floaters (clouds, kites, a plane, birds, rocks and planets in space).
    const INF = 1e5, rowsOf = {};
    const hsh = (a, b) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    const palOf = (i, layer, v) => { const th = T[i], far = layer === 'rfar', col = far ? mixc(th.far, th.mist, .3) : mixc(th.mid, '#000000', .1); return { col, dk: mixc(col, '#000000', far ? .24 : .32), lt: mixc(col, '#ffffff', far ? .1 : .16), lit: th.lit, acc: th.acc, cl: th.cloud || '#ffffff', v, far, th }; };
    function pic(key, w, h, layer, paint) {                                   // a small picture painted once (crisp near, soft far)
        let s = cache.get(key); if (s) return s;
        const S = dprNow() * (layer === 'rfar' ? .6 : .9), cv = document.createElement('canvas'); cv.width = Math.max(1, Math.ceil(w * S)); cv.height = Math.max(1, Math.ceil(h * S));
        const c = cv.getContext('2d'); c.scale(S, S); c.lineJoin = 'round'; try { paint(c); } catch (e) {}
        s = { cv, w, h }; cache.set(key, s); return s;
    }
    const TILE = {
        column: { h: 96, paint(c, w, h, P) { c.fillStyle = lg(c, 0, 0, w, 0, [[0, P.dk], [.3, P.lt], [1, P.dk]]); c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(0, 0, w, 2); c.fillStyle = 'rgba(255,255,255,.07)'; c.fillRect(w * .12, 0, 2, h); c.fillStyle = mixc(P.lt, '#ffffff', .2); c.globalAlpha = P.far ? .22 : .42; rrect(c, w * .32, 38, w * .36, 16, 3); c.globalAlpha = 1; } },
        facade: { h: 192, paint(c, w, h, P) { c.fillStyle = lg(c, 0, 0, w, 0, [[0, P.lt], [.4, P.col], [1, P.dk]]); c.fillRect(0, 0, w, h); const cw = 11, gap = 9, cols = Math.max(2, Math.floor((w - 14) / (cw + gap))), x0 = (w - (cols * (cw + gap) - gap)) / 2;
            for (let ry = 0; ry < 8; ry++) for (let q = 0; q < cols; q++) { const on = hsh(P.v * 977 + ry * 13 + 5, q * 29 + 7) < (P.far ? .14 : .26); c.globalAlpha = on ? (P.far ? .42 : .62) : .42; c.fillStyle = on ? P.lit : mixc(P.col, '#000000', .42); c.fillRect(x0 + q * (cw + gap), ry * 24 + 7, cw, 11); }
            c.globalAlpha = 1; c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(0, 0, w, 2); c.fillStyle = 'rgba(255,255,255,.07)'; c.fillRect(0, h / 2, w, 1); } },
        lattice: { h: 120, paint(c, w, h, P) { c.strokeStyle = P.dk; c.lineCap = 'butt'; c.lineWidth = Math.max(3, w * .09); c.beginPath(); c.moveTo(w * .12, 0); c.lineTo(w * .12, h); c.moveTo(w * .88, 0); c.lineTo(w * .88, h); c.stroke();
            c.lineWidth = 2.4; c.beginPath(); c.moveTo(w * .12, h); c.lineTo(w * .88, h / 2); c.lineTo(w * .12, 0); c.moveTo(w * .88, h); c.lineTo(w * .12, h / 2); c.lineTo(w * .88, 0); c.stroke(); c.fillStyle = P.col; c.fillRect(w * .04, 0, w * .92, 4); c.fillStyle = mixc(P.acc, P.col, .5); c.globalAlpha = .7; c.fillRect(w * .04, 0, w * .92, 2); c.globalAlpha = 1; } },
        chimney: { h: 96, paint(c, w, h, P) { c.fillStyle = lg(c, 0, 0, w, 0, [[0, P.lt], [.4, P.col], [1, P.dk]]); c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(0,0,0,.14)'; c.lineWidth = 1; for (let y = 6; y < h; y += 12) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } c.fillStyle = mixc(P.acc, P.col, .55); c.globalAlpha = .8; c.fillRect(0, 44, w, 8); c.globalAlpha = 1; } },
        pipe: { h: 96, paint(c, w, h, P) { c.fillStyle = lg(c, 0, 0, w, 0, [[0, P.dk], [.3, P.lt], [.7, P.col], [1, P.dk]]); c.fillRect(0, 0, w, h); c.fillStyle = P.dk; c.fillRect(-2, 0, w + 4, 9); c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(-2, 0, w + 4, 2); c.fillStyle = mixc(P.lt, '#ffffff', .3); disc(c, 5, 4.5, 1.6); disc(c, w - 5, 4.5, 1.6);
            c.fillStyle = mixc(P.acc, P.col, .45); disc(c, w / 2, 58, w * .2); c.strokeStyle = P.dk; c.lineWidth = 2.2; c.beginPath(); c.moveTo(w / 2 - w * .2, 58); c.lineTo(w / 2 + w * .2, 58); c.moveTo(w / 2, 58 - w * .2); c.lineTo(w / 2, 58 + w * .2); c.stroke(); } },
        tilepillar: { h: 104, paint(c, w, h, P) { c.fillStyle = lg(c, 0, 0, w, 0, [[0, P.dk], [.4, P.lt], [1, P.dk]]); c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(0,0,0,.22)'; c.lineWidth = 1.3; for (let y = 0; y < h; y += 26) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } for (let x = w / 4; x < w - 1; x += w / 4) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } c.fillStyle = P.acc; c.globalAlpha = .25; c.fillRect(0, 78, w, 6); c.globalAlpha = 1; } },
    };
    // what sits on top of a tower: a roof with something on it, a spire with a red light, the head of a crane, the rim of a chimney, a rocky summit. Drawn around (0,0) = the middle of the tower's top.
    const CAP = {
        flat(c, w, P, o) { c.fillStyle = P.dk; c.fillRect(-w / 2 - 5, -12, w + 10, 12); c.fillStyle = 'rgba(255,255,255,.14)'; c.fillRect(-w / 2 - 5, -12, w + 10, 2); c.fillStyle = mixc(P.col, '#000000', .35); c.fillRect(-w / 2 + 4, -22, w - 8, 10);
            if (o.pr === 1) { c.save(); c.translate(w * .16, -12); c.scale(.55, .55); K.tank.draw(c, P); c.restore(); }
            else if (o.pr === 2) { const x = -w * .2; c.fillStyle = P.dk; c.fillRect(x - 1.5, -88, 3, 66); c.fillRect(x - 12, -72, 24, 3); c.fillRect(x - 8, -54, 16, 3); c.fillStyle = 'rgba(255,90,90,.95)'; disc(c, x, -90, 3.2); c.fillStyle = 'rgba(255,90,90,.25)'; disc(c, x, -90, 9); }
            else if (o.pr === 3) { c.fillStyle = mixc(P.col, '#ffffff', .12); rrect(c, -w * .3, -34, 26, 12, 2); rrect(c, w * .05, -32, 20, 10, 2); } },
        spire(c, w, P) { c.fillStyle = lg(c, -w / 2, 0, w / 2, 0, [[0, P.lt], [.4, P.col], [1, P.dk]]); poly(c, [[-w / 2, 0], [-w * .32, -26], [w * .32, -26], [w / 2, 0]]); c.fillStyle = P.dk; c.fillRect(-1.6, -120, 3.2, 96); c.fillStyle = 'rgba(255,90,90,.95)'; disc(c, 0, -122, 3.4); c.fillStyle = 'rgba(255,90,90,.25)'; disc(c, 0, -122, 10); },
        jib(c, w, P) { const x0 = -w * .75, x1 = w * 1.9, y = -24, hx = w * 1.3; c.fillStyle = P.col; c.fillRect(-w / 2, -16, w, 16); c.fillStyle = P.dk; c.fillRect(x0, y - 8, x1 - x0, 8); c.fillStyle = mixc(P.acc, P.col, .45); c.fillRect(x0, y - 8, 22, 12);
            c.strokeStyle = P.dk; c.lineWidth = 2; c.beginPath(); c.moveTo(-w * .1, y - 8); c.lineTo(0, -64); c.lineTo(w * .1, y - 8); c.moveTo(0, -64); c.lineTo(x1, y - 8); c.moveTo(0, -64); c.lineTo(x0, y - 8); c.stroke(); c.fillStyle = P.dk; c.fillRect(-2, -78, 4, 14);
            c.lineWidth = 1.6; c.beginPath(); c.moveTo(hx, y); c.lineTo(hx - 7, y + 26); c.moveTo(hx, y); c.lineTo(hx + 7, y + 26); c.stroke(); c.fillStyle = mixc(P.acc, P.col, .5); rrect(c, hx - 14, y + 26, 28, 14, 2); c.fillStyle = 'rgba(255,90,70,.9)'; disc(c, x0 + 6, y - 12, 2.4); },
        rim(c, w, P) { c.fillStyle = P.dk; rrect(c, -w / 2 - 4, -16, w + 8, 16, 3); c.fillStyle = mixc(P.col, '#000000', .5); c.fillRect(-w / 2 + 3, -17, w - 6, 3); c.fillStyle = mixc(P.acc, P.col, .55); c.fillRect(-w / 2 - 4, -9, w + 8, 3); },
    };
    // a floor that spans the screen: tiled sideways, with a surface the pieces stand on (surf) and an underside the lamps hang from (under)
    const LEVEL = {
        slab: { w: 96, h: 74, surf: 2, under: 32, paint(c, w, h, P) { c.fillStyle = lg(c, 0, 0, 0, 32, [[0, mixc(P.lt, '#ffffff', .14)], [.1, P.lt], [1, P.dk]]); c.fillRect(0, 0, w, 32); c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(w - 1.5, 5, 1.5, 25); c.fillStyle = mixc(P.acc, P.col, .4); c.globalAlpha = .55; c.fillRect(0, 25, w, 3); c.globalAlpha = 1; c.fillStyle = lg(c, 0, 32, 0, h, [[0, 'rgba(0,0,0,.38)'], [1, 'rgba(0,0,0,0)']]); c.fillRect(0, 32, w, h - 32); } },
        catwalk: { w: 96, h: 92, surf: 40, under: 52, paint(c, w, h, P) { c.fillStyle = P.dk; for (const x of [0, w / 2]) c.fillRect(x - 1.3, 6, 2.6, 34); c.fillRect(0, 6, w, 2.6); c.fillRect(0, 22, w, 1.6); c.fillStyle = lg(c, 0, 40, 0, 52, [[0, mixc(P.lt, '#ffffff', .15)], [1, P.col]]); c.fillRect(0, 40, w, 12); c.fillStyle = 'rgba(0,0,0,.28)'; for (let x = 3; x < w; x += 8) c.fillRect(x, 44, 4, 4);
            c.strokeStyle = P.dk; c.lineWidth = 2.6; c.beginPath(); c.moveTo(0, 52); c.lineTo(w / 4, 82); c.lineTo(w / 2, 52); c.lineTo(w * .75, 82); c.lineTo(w, 52); c.stroke(); c.fillRect(0, 51, w, 3); c.fillStyle = lg(c, 0, 66, 0, h, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.22)']]); c.fillRect(0, 66, w, h - 66); } },
        beam: { w: 96, h: 58, surf: 0, under: 18, paint(c, w, h, P) { c.fillStyle = lg(c, 0, 0, 0, 18, [[0, P.lt], [1, P.dk]]); c.fillRect(0, 0, w, 18); c.fillStyle = mixc(P.lt, '#ffffff', .35); for (const x of [12, 36, 60, 84]) disc(c, x, 9, 1.7); c.fillStyle = lg(c, 0, 18, 0, h, [[0, 'rgba(0,0,0,.4)'], [1, 'rgba(0,0,0,0)']]); c.fillRect(0, 18, w, h - 18); } },
    };
    // the ground at the start (and a hazy copy of it far away): every arena has its own, painted once per screen size
    const GROUND = {
        1(c, w, h, P, E) { c.fillStyle = lg(c, 0, E, 0, h, [[0, P.col], [1, mixc(P.col, '#000000', .55)]]); c.fillRect(0, E, w, h - E); c.fillStyle = mixc(P.col, P.lt, .7); c.fillRect(0, E - 7, w, 7); c.fillStyle = 'rgba(255,255,255,.1)'; c.fillRect(0, E - 7, w, 2); c.strokeStyle = mixc(P.acc, P.col, .3); c.lineWidth = 4; c.setLineDash([26, 20]); c.beginPath(); c.moveTo(0, E + 34); c.lineTo(w, E + 34); c.stroke(); c.setLineDash([]); c.strokeStyle = 'rgba(255,255,255,.2)'; c.lineWidth = 3; for (let x = 24; x < w; x += 104) { c.beginPath(); c.moveTo(x, E + 56); c.lineTo(x - 30, h); c.stroke(); } },
        2(c, w, h, P, E) { c.fillStyle = lg(c, 0, E, 0, h, [[0, P.col], [1, mixc(P.col, '#000000', .5)]]); c.fillRect(0, E, w, h - E); c.fillStyle = mixc(P.col, P.lt, .9); c.fillRect(0, E - 24, w, 24); c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(0, E - 24, w, 3); c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(0, E - 2, w, 4); for (let x = 30; x < w; x += 130) { c.fillStyle = mixc(P.col, '#000000', .3); rrect(c, x, E - 36, 34, 14, 2); } },
        3(c, w, h, P, E) { if (P.far) { c.fillStyle = lg(c, 0, E, 0, h, [[0, mixc(P.col, '#4fa9d6', .25)], [1, mixc(P.col, '#000000', .45)]]); c.fillRect(0, E, w, h - E); c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 1.5; for (let y = E + 10; y < h; y += 16) { c.beginPath(); for (let x = 0; x <= w; x += 12) c.lineTo(x, y + Math.sin(x * .09 + y) * 2); c.stroke(); } return; }
            c.fillStyle = lg(c, 0, E, 0, h, [[0, '#5a4430'], [1, '#1c130c']]); c.fillRect(0, E, w, h - E); c.fillStyle = '#6e5238'; c.fillRect(0, E - 5, w, 5); c.fillStyle = 'rgba(255,255,255,.14)'; c.fillRect(0, E - 5, w, 1.5); c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1.6; for (let x = 0; x < w; x += 46) { c.beginPath(); c.moveTo(x, E); c.lineTo(x - 12, h); c.stroke(); } c.fillStyle = '#2a2f3a'; for (const x of [60, 210, 340]) { rrect(c, x - 8, E - 22, 16, 18, 5); c.fillStyle = '#d8a63a'; c.fillRect(x - 8, E - 14, 16, 3); c.fillStyle = '#2a2f3a'; } },
        4(c, w, h, P, E) { c.fillStyle = lg(c, 0, E, 0, h, [[0, mixc(P.col, '#ffffff', .1)], [1, mixc(P.col, '#000000', .5)]]); c.fillRect(0, E, w, h - E); c.fillStyle = P.dk; c.fillRect(0, E - 8, w, 8); c.save(); c.beginPath(); c.rect(0, E - 8, w, 8); c.clip(); c.fillStyle = mixc(P.acc, P.col, .2); for (let x = -10; x < w + 10; x += 22) poly(c, [[x, E], [x + 11, E], [x + 19, E - 8], [x + 8, E - 8]]); c.restore(); c.strokeStyle = 'rgba(0,0,0,.28)'; c.lineWidth = 1.5; for (let x = 0; x < w; x += 70) { c.beginPath(); c.moveTo(x, E + 8); c.lineTo(x, h); c.stroke(); } c.fillStyle = 'rgba(255,255,255,.12)'; for (let x = 8; x < w; x += 70) for (let y = E + 18; y < h; y += 36) disc(c, x, y, 1.6); },
        5(c, w, h, P, E) { c.fillStyle = lg(c, 0, E, 0, h, [[0, P.col], [1, mixc(P.col, '#000000', .55)]]); c.fillRect(0, E, w, h - E); c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1.2; for (let y = E + 22; y < h; y += 22) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } for (let x = 0; x < w; x += 44) { c.beginPath(); c.moveTo(x, E); c.lineTo(x, h); c.stroke(); } c.fillStyle = mixc(P.acc, P.col, .15); c.fillRect(0, E - 5, w, 9); c.fillStyle = 'rgba(0,0,0,.25)'; for (let x = 0; x < w; x += 12) c.fillRect(x, E - 5, 5, 9); },
        6(c, w, h, P, E) { c.fillStyle = lg(c, 0, E - 14, 0, h, [[0, '#ffffff'], [1, mixc(P.col, '#ffffff', .1)]]); c.beginPath(); c.moveTo(0, h); c.lineTo(0, E); for (let x = 0; x <= w; x += 8) c.lineTo(x, E - 10 - Math.sin(x * .017) * 11 - Math.sin(x * .049 + 1) * 6); c.lineTo(w, h); c.closePath(); c.fill(); c.fillStyle = 'rgba(110,150,200,.18)'; c.beginPath(); c.moveTo(0, h); c.lineTo(0, E + 6); for (let x = 0; x <= w; x += 8) c.lineTo(x, E + 4 - Math.sin(x * .017 + 1.2) * 10); c.lineTo(w, h); c.closePath(); c.fill(); c.fillStyle = 'rgba(120,160,205,.22)'; for (let x = 20; x < w; x += 95) { c.beginPath(); c.ellipse(x + 30, E + 26, 42, 5, 0, 0, TAU); c.fill(); } },
        8(c, w, h, P, E) { c.fillStyle = lg(c, 0, E, 0, h, [[0, '#2a1410'], [1, '#0b0403']]); c.beginPath(); c.moveTo(0, h); c.lineTo(0, E); for (let x = 0; x <= w; x += 10) c.lineTo(x, E - 6 - (Math.sin(x * .05) + Math.sin(x * .13 + 2)) * 5); c.lineTo(w, h); c.closePath(); c.fill(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; c.lineJoin = 'round'; for (const [lw, col] of [[16, 'rgba(255,70,20,.18)'], [7, 'rgba(255,110,30,.55)'], [2.6, 'rgba(255,215,120,.95)']]) { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); for (let x = 0; x <= w; x += 10) c.lineTo(x, E + 14 + Math.sin(x * .035) * 5); c.stroke(); } c.globalCompositeOperation = 'source-over'; },
        9(c, w, h, P, E) { const cl = P.th.cloud, top = mixc(cl, '#ffffff', .1); c.fillStyle = lg(c, 0, E - 40, 0, h, [[0, top], [.25, cl], [1, mixc(cl, P.th.sky[0][0], .7)]]); c.fillRect(0, E + 6, w, h - E - 6); for (let x = -10; x < w + 40; x += 38) { const r = 24 + (hsh(x, 3) * 18); c.beginPath(); c.arc(x, E + 8, r, Math.PI, 0); c.fill(); } for (let x = 6; x < w + 40; x += 62) { c.beginPath(); c.arc(x, E + 4, 34 + hsh(x, 9) * 14, Math.PI, 0); c.fill(); } },
    };
    const GROUND_E = 48;
    function groundPic(i, layer, W, H) {
        const far = layer === 'rfar', key = i + '|G|' + layer + '|' + W + 'x' + H, h = Math.ceil(H * .44) + GROUND_E;
        return pic(key, W, h, layer, c => { const th = T[i], base = th.ground || th.mid, col = far ? mixc(base, th.mist, .4) : base; const P = { col, dk: mixc(col, '#000000', .3), lt: mixc(col, '#ffffff', .2), lit: th.lit, acc: th.acc, far, th }; (GROUND[i])(c, W, h, P, GROUND_E); }, true);
    }
    const tileOf = (i, st, w, layer, v) => pic(i + '|T|' + st + '|' + Math.round(w) + '|' + layer + '|' + v, w, TILE[st].h, layer, c => TILE[st].paint(c, w, TILE[st].h, palOf(i, layer, v)));
    const capOf = (i, cap, w, layer, v, pr) => pic(i + '|C|' + cap + '|' + Math.round(w) + '|' + layer + '|' + v + '|' + pr, Math.ceil(w * 4 + 80), 190, layer, c => { c.translate(Math.ceil(w * 4 + 80) / 2, 150); CAP[cap](c, w, palOf(i, layer, v), { pr }); });
    const levelOf = (i, st, layer) => pic(i + '|L|' + st + '|' + layer, LEVEL[st].w, LEVEL[st].h, layer, c => LEVEL[st].paint(c, LEVEL[st].w, LEVEL[st].h, palOf(i, layer, 0)));

    // ---- what each arena is built from ----
    const slots = (n, r) => Array.from({ length: n }, (_, k) => Math.min(.96, Math.max(.04, (k + .5) / n + (r() - .5) * .6 / n)));
    const shuf = (a, r) => { for (let q = a.length - 1; q > 0; q--) { const j = Math.floor(r() * (q + 1)); const t = a[q]; a[q] = a[j]; a[j] = t; } return a; };
    const mk = () => ({ towers: [], levels: [], sprites: [] });
    const spr = (L, k, x, h, s, v, a) => L.sprites.push({ k, x, h, s: s || 1, v: v || 0, a: a === undefined ? 1 : a });
    const twr = (L, st, w, x, blocks, v, cap, pr) => L.towers.push({ st, w, x, ht: blocks === INF ? INF : blocks * TILE[st].h, v: v || 0, cap, pr: pr || 0 });
    const choice = (r, a) => a[Math.floor(r() * a.length)];
    const SCENE = {
        1(r, Df, Dm) { const far = mk(), mid = mk();                                                                    // PARKING LOT: concrete pillars, floors with cars, cones and lamps
            shuf(slots(4, r), r).forEach((x, q) => twr(far, 'column', 40 + r() * 20, x, INF, q & 1));
            shuf(slots(2, r), r).forEach((x, q) => twr(mid, 'column', 74 + r() * 22, x, INF, q & 1));
            for (let h = 400 + r() * 100; h < Dm; h += 560 + r() * 160) { const kids = [], cx = .14 + r() * .72;
                if (r() < .8) kids.push({ k: 'car', x: cx, top: 1, s: .78 + r() * .16, v: r() < .5 ? 1 : 0 });
                if (r() < .6) kids.push({ k: 'cone', x: cx < .5 ? cx + .26 + r() * .2 : cx - .26 - r() * .2, top: 1, s: .9, v: 0 });
                const nl = r() < .55 ? 2 : 1; for (let q = 0; q < nl; q++) kids.push({ k: 'hanglamp', x: .12 + (q + .5) / nl * .76 + (r() - .5) * .08, top: 0, s: .75 + r() * .15, v: 0 });
                if (r() < .3) kids.push({ k: 'hangsign', x: .18 + r() * .64, top: 0, s: .8, v: 0 });
                mid.levels.push({ st: 'slab', h, kids }); }
            spr(mid, 'car', .26, 0, .86, 1); spr(mid, 'cone', .62, 0, .9, 0); spr(mid, 'cone', .69, 0, .9, 0); spr(mid, 'lamp', .9, 0, .85, 0);
            return { far, mid }; },
        2(r, Df, Dm) { const far = mk(), mid = mk();                                                                    // ROOFTOP: you climb out of a city; the skyline sinks, the sun sets behind it
            shuf(slots(5, r), r).forEach((x, q) => twr(far, 'facade', 44 + r() * 26, x, choice(r, [1, 2, 2, 3, 4, 5, 7]), q, r() < .35 ? 'spire' : 'flat', 0));
            shuf(slots(3, r), r).forEach((x, q) => twr(mid, 'facade', 80 + r() * 36, x, choice(r, [2, 3, 4, 5, 7, 9]), q, 'flat', 1 + Math.floor(r() * 3)));
            for (let q = 0; q < 3; q++) spr(far, 'birds', .1 + r() * .8, 380 + r() * 1500, .7 + r() * .4, q & 1);
            return { far, mid }; },
        3(r, Df, Dm) { const far = mk(), mid = mk();                                                                    // HARBOUR: cranes, a ship, a lighthouse, a stack of containers at the quay
            shuf(slots(3, r), r).forEach((x, q) => twr(far, 'lattice', 38 + r() * 14, x, 4 + Math.floor(r() * 12), q, 'jib'));
            shuf(slots(2, r), r).forEach((x, q) => twr(mid, 'lattice', 70 + r() * 18, Math.min(.8, x), 6 + Math.floor(r() * 16), q, 'jib'));
            spr(far, 'ship', .3, 0, .95, 0); spr(far, 'lighthouse', .84, 0, .8, 0); spr(mid, 'containers', .2, 0, .8, 1); spr(mid, 'containers', .74, 0, .62, 0);
            for (let q = 0; q < 4; q++) spr(q % 2 ? mid : far, 'birds', .1 + r() * .8, 300 + r() * 1800, .7 + r() * .4, q & 1);
            return { far, mid }; },
        4(r, Df, Dm) { const far = mk(), mid = mk();                                                                    // FACTORY: chimneys, pipes, catwalks with tanks and furnaces
            shuf(slots(3, r), r).forEach((x, q) => twr(far, 'chimney', 44 + r() * 14, x, 5 + Math.floor(r() * 14), q, 'rim'));
            shuf(slots(3, r), r).forEach((x, q) => twr(mid, 'pipe', 30 + r() * 12, x, INF, q));
            for (let h = 420 + r() * 120; h < Dm; h += 640 + r() * 180) { const kids = []; if (r() < .7) kids.push({ k: choice(r, ['tank', 'furnace', 'tank']), x: .12 + r() * .76, top: 1, s: .85, v: 0 }); mid.levels.push({ st: 'catwalk', h, kids }); }
            spr(mid, 'furnace', .22, 0, .95, 0); spr(mid, 'tank', .78, 0, .9, 0); for (let q = 0; q < 3; q++) spr(far, 'gear', .1 + r() * .8, 500 + q * 700 + r() * 300, .55 + r() * .3, q & 1);
            return { far, mid }; },
        5(r, Df, Dm) { const far = mk(), mid = mk();                                                                    // SUBWAY: tiled pillars and ceiling beams with lamps, a tunnel mouth and a station sign at the start
            shuf(slots(3, r), r).forEach((x, q) => twr(far, 'tilepillar', 44 + r() * 12, x, INF, q));
            shuf(slots(2, r), r).forEach((x, q) => twr(mid, 'tilepillar', 70 + r() * 20, x, INF, q));
            for (let h = 380 + r() * 100; h < Dm; h += 540 + r() * 140) { const kids = [], nl = r() < .5 ? 2 : 1; for (let q = 0; q < nl; q++) kids.push({ k: 'hanglamp', x: .14 + (q + .5) / nl * .72 + (r() - .5) * .1, top: 0, s: .8, v: 0 }); mid.levels.push({ st: 'beam', h, kids }); }
            spr(far, 'arch', .5, 0, 1.1, 0); spr(mid, 'roundel', .14, 0, .9, 0);
            return { far, mid }; },
        6(r, Df, Dm) { const far = mk(), mid = mk();                                                                    // MOUNTAIN: ridges and peaks at the foot of the climb that sink away, then clouds all the way up
            spr(far, 'ridge', .28, 0, 1.15, 0); spr(far, 'ridge', .82, 0, 1.05, 1); spr(far, 'peak', .52, 0, 1.2, 1); spr(mid, 'peak', .12, 0, .9, 0); spr(mid, 'pines', .74, 0, .95, 0); spr(mid, 'pines', .36, 0, .75, 1);
            for (let q = 0; q < 9; q++) spr(q % 2 ? mid : far, 'cloud', .06 + r() * .88, 230 + q * 300 + r() * 160, .7 + r() * .6, q & 1, q % 2 ? .95 : .7);
            return { far, mid }; },
        8(r, Df, Dm) { const far = mk(), mid = mk();                                                                    // VOLCANO: cones at the horizon, then ash clouds and rocks that hover in the heat
            spr(far, 'volcano', .26, 0, 1.0, 0); spr(far, 'volcano', .82, 0, .8, 1);
            for (let q = 0; q < 7; q++) spr(q % 2 ? far : mid, 'cloud', .06 + r() * .88, 280 + q * 380 + r() * 200, .8 + r() * .6, q & 1, q % 2 ? .6 : .85);
            for (let q = 0; q < 8; q++) spr(mid, 'rockfloat', .08 + r() * .84, 300 + q * 340 + r() * 200, .5 + r() * .4, q & 1);
            for (let q = 0; q < 3; q++) spr(far, 'rockfloat', .1 + r() * .8, 500 + q * 800 + r() * 300, .5 + r() * .3, q & 1);
            return { far, mid }; },
        9(r, Df, Dm) { const far = mk(), mid = mk();                                                                    // SUMMIT: peaks through the cloud sea, then storms that carry their own lightning
            spr(far, 'peak', .22, 0, 1.0, 1); spr(far, 'peak', .7, 0, 1.25, 0); spr(far, 'crag', .5, 0, .9, 1); spr(mid, 'crag', .86, 0, .8, 0);
            for (let q = 0; q < 6; q++) spr(mid, 'stormb', .1 + r() * .8, 420 + q * 480 + r() * 160, .7 + r() * .3, q & 1, .95);
            for (let q = 0; q < 4; q++) spr(far, 'cloud', .06 + r() * .88, 300 + q * 600 + r() * 200, .8 + r() * .5, q & 1, .55);
            return { far, mid }; },
    };
    [1, 2, 3, 4, 5, 6, 8, 9].forEach(i => { T[i].hz = .625; T[i].gnd = true; });
    T[8].cloud = '#7a3a2c';
    // the Playground and the Space Station are all sky: only things that can float (their lists are in `kinds`)
    function skyList(th, kinds, spacing, depthMax, r, a) {
        const L = mk(); for (let d = 40 + r() * 80; d < depthMax; d += spacing * (0.75 + r() * 0.5)) { const k = kinds[Math.floor(r() * kinds.length)]; spr(L, k, .06 + r() * .88, d + K[k].float * r() * 140, .8 + r() * .4, r() > .5 ? 1 : 0, a); }
        return L;
    }

    /* --------------------------------------------------------------- the live race background ---- */
    let rulesNow = null, cur = null, idx = -1, far = [], mid = [], air = [], lastT = 0, flash = 0, flashAt = 0, tagEl = null, poolSet = null, vig = null;
    function restore() { Object.assign(PLAT, PLAT0); for (const k in ITEMS0) { ITEMS[k].name = ITEMS0[k].name; ITEMS[k].color = ITEMS0[k].color; } }
    // choose the arena for this race: your trophies decide; a party match shares the Playground and the classic power-ups
    function pick(seed) {
        let i = 0, party = !!window.partyMatch;
        if (!party && window.Trophies) { try { i = Trophies.arenaOf(prog().tr || 0); } catch (e) { i = 0; } }
        let tr = 0; try { tr = prog().tr || 0; } catch (e) {}
        const t = testGet(); if (!party && t >= 0) { i = t; tr = arenaEnd(t); }          // the test switch on the home screen (src/ui/arenatest.js) plays an arena with everything it has by its end
        set(i, seed || 1, { party, tr });
    }
    function testGet() { try { const v = localStorage.getItem('rr_arena_test'); return v === null || v === '' ? -1 : Math.max(-1, Math.min(T.length - 1, +v)); } catch (e) { return -1; } }
    function testSet(i) { try { if (i < 0) localStorage.removeItem('rr_arena_test'); else localStorage.setItem('rr_arena_test', String(i)); } catch (e) {} window.dispatchEvent(new Event('arenatest')); }
    function warm(L, name) {
        const sp = (k, v) => { try { const q = sprite(idx, k, name, v); if (q.def.glow) sprite(idx, k, name, v, true); } catch (e) {} };
        for (const p of L.sprites) sp(p.k, p.v);
        for (const t of L.towers) { try { tileOf(idx, t.st, t.w, name, t.v); if (t.cap) capOf(idx, t.cap, t.w, name, t.v, t.pr); } catch (e) {} }
        for (const lv of L.levels) { try { levelOf(idx, lv.st, name); } catch (e) {} for (const kd of lv.kids) sp(kd.k, kd.v); }
    }
    function set(i, seed, o) {
        restore(); idx = Math.max(0, Math.min(T.length - 1, i)); cur = T[idx];
        PLAT.normal = cur.plat;
        for (const k in cur.items) { ITEMS[k].name = cur.items[k][0]; ITEMS[k].color = cur.items[k][1]; }
        poolSet = new Set(o && o.party ? PARTY_POOL : poolAt(o && o.tr !== undefined ? o.tr : arenaEnd(idx)));
        rulesNow = o && o.party ? null : { types: new Set(LEDGES.slice(0, LEDGE_COUNT[Math.min(idx, LEDGE_COUNT.length - 1)])), ceilings: idx >= CEILINGS_FROM };
        const r = rng((seed | 0) + idx * 97), L = Math.max(9000, typeof TRACK === 'number' ? TRACK : 9000);
        const Df = L * 0.09 + 1300, Dm = L * 0.2 + 1300;
        if (SCENE[idx]) { const o = SCENE[idx](r, Df, Dm); far = o.far; mid = o.mid; }
        else { far = skyList(cur, cur.kinds.far, 330, Df, r, idx === 0 ? .62 : .8); mid = skyList(cur, cur.kinds.mid, 240, Dm, r, idx === 0 ? .95 : .92); }
        air = []; for (let a = 0; a < 26; a++) air.push({ x: r(), y: r(), s: .5 + r(), v: .4 + r() * .8 });
        flash = 0; flashAt = 3 + r() * 5; lastT = 0; bgKey = ''; mKey = '';
        warm(far, 'rfar'); warm(mid, 'rmid');                                                      // painted now, during the countdown, never in the middle of the race
        try { if (idx === 0) { sprite(idx, 'balloon', 'mid', 0); sprite(idx, 'balloon', 'mid', 1); for (const k of ['plane', 'hotair', 'cloud']) { sprite(idx, k, 'mid', 0); sprite(idx, k, 'mid', 1); } } } catch (e) {}
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
    function orbDraw(c, W, H, th, k, dy) {
        const o = th.orb; if (!o) return; const x = o.x * W, y = (o.y + (dy || 0)) * H, R = o.r * (k || 1);
        c.fillStyle = rg(c, x, y, R * .5, R * 4.2, [[0, mixc(o.c, '#ffffff', 0).replace('rgb', 'rgba').replace(')', ',.3)')], [1, 'rgba(255,255,255,0)']]); c.fillRect(x - R * 4.2, y - R * 4.2, R * 8.4, R * 8.4);
        c.fillStyle = th.bright ? rg(c, x - R * .25, y - R * .25, R * .1, R, [[0, '#ffffff'], [.55, o.c], [1, '#ffd96b']]) : o.c; c.globalAlpha = th.bright ? 1 : .92; disc(c, x, y, R); c.globalAlpha = 1;
    }
    function mistFill(c, W, H, th, y0, y1, a) { c.fillStyle = lg(c, 0, y0, 0, y1, [[0, mixc(th.mist, th.mist, 0).replace('rgb', 'rgba').replace(')', ',0)')], [1, mixc(th.mist, th.mist, 0).replace('rgb', 'rgba').replace(')', ',' + a + ')')]]); c.fillRect(0, y0, W, y1 - y0); }
    let vigL = null;
    function vignette(c, W, H, light) {
        if (light) { if (!vigL) { vigL = document.createElement('canvas'); vigL.width = vigL.height = 128; const x = vigL.getContext('2d'); x.fillStyle = rg(x, 64, 64, 40, 92, [[0, 'rgba(10,40,90,0)'], [1, 'rgba(10,40,90,.12)']]); x.fillRect(0, 0, 128, 128); } c.drawImage(vigL, 0, 0, W, H); return; }
        if (!vig) { vig = document.createElement('canvas'); vig.width = vig.height = 128; const x = vig.getContext('2d'); x.fillStyle = rg(x, 64, 64, 30, 90, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.34)']]); x.fillRect(0, 0, 128, 128); }
        c.drawImage(vig, 0, 0, W, H);
    }
    const GLOW_T = { antenna: 3.2 };
    function putGlow(c, s, kind, name, v, x, y, k, a, now, d) { const g = sprite(idx, kind, name, v, true); c.globalCompositeOperation = 'lighter'; put(c, g, x, y, k, a * (.55 + .45 * Math.sin(now * (GLOW_T[kind] || 5) + d)), 0); c.globalCompositeOperation = 'source-over'; }
    function drawTower(c, t, name, W, H, gl) {
        const top = gl - t.ht; if (top >= H) return;
        const tl = tileOf(idx, t.st, t.w, name, t.v), P = tl.h, x = Math.round(W * t.x - t.w / 2), n0 = Math.max(0, Math.floor((gl - H) / P)), n1 = t.ht >= INF ? Math.ceil(gl / P) + 1 : t.ht / P - 1;
        for (let n = n0; n <= n1; n++) { const y = Math.round(gl - (n + 1) * P); if (y + P < 0) break; c.drawImage(tl.cv, x, y, t.w, P + 1); }
        if (t.cap && t.ht < INF && top > -220) { const cp = capOf(idx, t.cap, t.w, name, t.v, t.pr); c.drawImage(cp.cv, Math.round(W * t.x - cp.w / 2), Math.round(top - 150), cp.w, cp.h); }
    }
    function drawLevel(c, lv, name, W, H, gl, kScale, now) {
        const D = LEVEL[lv.st], st = levelOf(idx, lv.st, name), yTop = gl - lv.h, ty = yTop - D.surf;
        if (ty < H && ty + st.h > 0) for (let x = 0; x < W; x += st.w) c.drawImage(st.cv, x, Math.round(ty), st.w + 1, st.h);
        for (const kd of lv.kids) {
            const def = K[kd.k], s = sprite(idx, kd.k, name, kd.v), k = kd.s * kScale, y = kd.top ? yTop : ty + D.under + def.h * k;      // a piece stands on the floor, a lamp hangs from its underside
            if (y < 0 || y - s.h * k > H) continue; const x = W * kd.x;
            put(c, s, x, y, k, 1, 0); if (def.glow) putGlow(c, s, kd.k, name, kd.v, x, y, k, 1, now, lv.h);
        }
    }
    function drawScene(c, L, name, W, H, climbed, f, kScale, now) {
        const gl = H * (cur.hz || .99) + climbed * f;                                              // the ground line of this layer: it sinks slowly while you climb
        if (cur.gnd && gl < H + 4) { const g = groundPic(idx, name, W, H); c.drawImage(g.cv, 0, Math.round(gl - GROUND_E), W, g.h); }
        for (const t of L.towers) drawTower(c, t, name, W, H, gl);
        for (const lv of L.levels) drawLevel(c, lv, name, W, H, gl, kScale, now);
        for (const p of L.sprites) {
            const s = sprite(idx, p.k, name, p.v), k = p.s * kScale, y = gl - p.h, def = s.def;
            if (y < 0 || y - s.h * k > H) continue; const x = W * p.x;
            put(c, s, x, y, k, p.a, def.rot ? now * def.rot * (p.v ? 1 : -1) : 0);
            if (def.glow) putGlow(c, s, p.k, name, p.v, x, y, k, p.a, now, p.h);
        }
        c.globalAlpha = 1;
    }
    // drifting specks (dust, snow, rain, ash, sparks, stars): `list` is a set of {x, y, s, v} in 0..1, moved here a little every call
    // now and then a balloon floats up from the bottom of the screen to the top (home world and race background), swaying a little; at most two at a time
    let floaters = [], nextB = 4;
    function balloons(c, i, W, H, dt) {
        nextB -= dt; if (nextB <= 0 && floaters.length < 2) { floaters.push({ x: .1 + Math.random() * .8, y: 1.12, v: Math.random() > .5 ? 1 : 0, ph: Math.random() * 6, sp: .02 + Math.random() * .07, k: .5 + Math.random() * .25 }); nextB = 7 + Math.random() * 9; }
        for (let q = floaters.length - 1; q >= 0; q--) {
            const b = floaters[q]; b.y -= b.sp * dt; if (b.y < -.25) { floaters.splice(q, 1); continue; }
            const sp = sprite(i, 'balloon', 'mid', b.v), x = W * b.x + Math.sin(b.y * 9 + b.ph) * 12;
            put(c, sp, x, H * b.y + sp.oy * b.k, b.k, .9, 0);
        }
        c.globalAlpha = 1;
    }
    // THE PLAYGROUND'S SKY: clouds drift past every few seconds (slow and quick ones), now and then a little plane flies by with a thin trail, and once in a while a hot-air balloon
    // floats across, very slowly. All of them in screen space, at most three clouds, one plane and one balloon at a time.
    let fly = [], nextFly = { cloud: 1.5, plane: 7, hot: 16 };
    function flyers(c, i, W, H, dt) {
        const R = Math.random, cnt = k => fly.reduce((n, f) => n + (f.k === k ? 1 : 0), 0);
        for (const k in nextFly) { nextFly[k] -= dt; if (nextFly[k] > 0) continue;
            if (k === 'cloud') { nextFly.cloud = 4 + R() * 6; if (cnt('cloud') < 3) { const d = R() < .5 ? 1 : -1, sc = .55 + R() * .8; fly.push({ k: 'cloud', d, sc, x: d > 0 ? -150 * sc : W + 150 * sc, y: H * (.07 + R() * .5), v: 9 + R() * 20, a: .35 + R() * .3 }); } }
            else if (k === 'plane') { nextFly.plane = 24 + R() * 26; if (!cnt('plane')) { const d = R() < .5 ? 1 : -1; fly.push({ k: 'plane', d, sc: .8, x: d > 0 ? -90 : W + 90, y: H * (.1 + R() * .3), v: 85 + R() * 25, a: 1, ph: R() * 6 }); } }
            else { nextFly.hot = 50 + R() * 40; if (!cnt('hot')) { const d = R() < .5 ? 1 : -1; fly.push({ k: 'hot', d, sc: .85, x: d > 0 ? -60 : W + 60, y: H * (.16 + R() * .3), v: 11 + R() * 4, a: 1, ph: R() * 6 }); } } }
        for (let q = fly.length - 1; q >= 0; q--) {
            const f = fly[q]; f.x += f.d * f.v * dt; if ((f.d > 0 && f.x > W + 240) || (f.d < 0 && f.x < -240)) { fly.splice(q, 1); continue; }
            const kind = f.k === 'hot' ? 'hotair' : f.k, sp = sprite(i, kind, 'mid', f.d < 0 ? 1 : 0), bob = f.k === 'cloud' ? 0 : Math.sin(performance.now() / (f.k === 'plane' ? 900 : 1800) + f.ph) * (f.k === 'plane' ? 3 : 5);
            if (f.k === 'plane') { c.globalAlpha = .5; const tl = 150, g = lg(c, f.x, 0, f.x - f.d * tl, 0, [[0, 'rgba(255,255,255,.55)'], [1, 'rgba(255,255,255,0)']]); c.fillStyle = g; c.fillRect(Math.min(f.x, f.x - f.d * tl), f.y + bob - 24, tl, 3); }
            put(c, sp, f.x, f.y + bob + sp.oy * f.sc, f.sc, f.a, 0);
        }
        c.globalAlpha = 1;
    }
    function specks(c, th, list, W, H, now, dt) {
        const kind = th.air[0], col = th.air[1], dens = th.air[2]; c.fillStyle = col; c.strokeStyle = col;
        for (let i = 0; i < list.length; i++) {
            const q = list[i]; if (i / list.length > dens + 0.15) break;
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
    }
    // The still parts of the background (sky, sun and its glow, the two mist bands, the vignette) are painted into small pictures and only blitted each frame, so a frame costs
    // a few drawImage calls and no gradient fills. The sky picture is repainted when the climb has moved the colour by a hair.
    let bgC = null, bgKey = '', m1C = null, m2C = null, mKey = '';
    function statics(c, W, H, p, br) {
        const ratio = Math.max(1, Math.round((c.getTransform ? c.getTransform().a : 1) * 100) / 100), pq = Math.round(p * 120), key = idx + '|' + W + 'x' + H + '|' + ratio;
        if (!bgC || bgKey !== key + '|' + pq) {
            bgKey = key + '|' + pq; bgC = bgC || document.createElement('canvas'); bgC.width = Math.ceil(W * ratio); bgC.height = Math.ceil(H * ratio);
            const x = bgC.getContext('2d'); x.setTransform(ratio, 0, 0, ratio, 0, 0); x.clearRect(0, 0, W, H); skyFill(x, W, H, cur, pq / 120); orbDraw(x, W, H, cur);
            if (br && cur.orb) { const ox = cur.orb.x * W, oy = cur.orb.y * H; x.fillStyle = rg(x, ox, oy, 10, H * .9, [[0, 'rgba(255,248,210,.55)'], [.35, 'rgba(255,248,210,.16)'], [1, 'rgba(255,248,210,0)']]); x.fillRect(0, 0, W, H); }
        }
        if (!m1C || mKey !== key) {                                                                // the haze and the vignette are smooth: a quarter of the size is plenty
            mKey = key; m1C = m1C || document.createElement('canvas'); m2C = m2C || document.createElement('canvas');
            for (const [cv, parts] of [[m1C, [[H * .2, H, br ? .14 : .3]]], [m2C, [[H * .5, H, br ? .1 : .26]]]]) {
                cv.width = Math.ceil(W / 4); cv.height = Math.ceil(H / 4); const x = cv.getContext('2d'); x.setTransform(.25, 0, 0, .25, 0, 0); x.clearRect(0, 0, W, H);
                for (const q of parts) mistFill(x, W, H, cur, q[0], q[1], q[2]);
                if (cv === m2C) vignette(x, W, H, br);
            }
        }
    }
    function drawSky(c, W, H, camY) {
        if (!cur) return;
        const now = performance.now() / 1000, dt = Math.min(0.05, lastT ? now - lastT : 0); lastT = now;
        const prog_ = Math.max(0, Math.min(1, (START_Y - camY) / Math.max(1, TRACK)));
        c.save();
        const br = !!cur.bright;                                                          // a bright arena (the Playground): light sky, fuller colours, less haze, a warm sun glow, a very light vignette
        statics(c, W, H, prog_, br); c.drawImage(bgC, 0, 0, W, H);
        const climbed = (START_Y - VH * 0.62) - camY;
        if (idx === 0) flyers(c, idx, W, H, Math.min(dt, .1));                           // the Playground: clouds drift by, now and then a little plane or a hot-air balloon (behind the scenery)
        drawScene(c, far, 'rfar', W, H, climbed, 0.09, 1.2, now);
        c.drawImage(m1C, 0, 0, W, H);
        drawScene(c, mid, 'rmid', W, H, climbed, 0.2, 0.92, now);
        c.drawImage(m2C, 0, 0, W, H);
        specks(c, cur, air, W, H, now, dt); if (idx === 0) balloons(c, idx, W, H, Math.min(dt, .1));          // the Playground alone has balloons drifting up
        c.globalAlpha = 1;
        if (idx === 9) {                                                   // Summit: a cosmetic lightning flash now and then (it never touches the platforms)
            flashAt -= dt; if (flashAt <= 0) { flash = 1; flashAt = 4 + Math.random() * 7; }
            if (flash > 0) { c.fillStyle = 'rgba(255,255,230,' + 0.2 * flash + ')'; c.fillRect(0, 0, W, H); flash -= dt * 3.2; }
        }
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
            skyFill(c, w, h, th, o.prog === undefined ? 0.15 : o.prog); orbDraw(c, w, h, th, Math.min(1, h / 520), o.orbDy);
            const horizon = h * (o.horizon || (th.ground ? 0.8 : 1.05));
            const place = (list, name, a, scale, n, xs) => {
                for (let q = 0; q < n; q++) {
                    const k = list[q % list.length], def = K[k], s = sprite(i, k, name, q % 2), kk = Math.min(scale * (o.scale || 1) * h / def.h, 1.5) * (.85 + r() * .3), x = xs ? w * xs[q % xs.length] : w * ((q + .5) / n + (r() - .5) * .18);
                    const y = def.float ? h * (.22 + r() * .34) + def.h * kk * .5 : horizon + (name === 'mid' ? h * .07 : 0);
                    put(c, s, x, y, kk, a, def.rot ? (q + 1) * .7 : 0);
                    if (def.glow) { const g = sprite(i, k, name, q % 2, true); c.globalCompositeOperation = 'lighter'; put(c, g, x, y, kk, a * .8, 0); c.globalCompositeOperation = 'source-over'; }
                }
            };
            const dens = o.props === undefined ? 1 : o.props;
            const al = o.alpha || 1, mi = o.mist === undefined ? 1 : o.mist * 4;                // alpha: more punch for the big picture; mist: how much haze
            const ko = o.kinds || th.kinds, nf = o.nFar !== undefined ? o.nFar : Math.max(2, Math.round(3 * dens)), nm = o.nMid !== undefined ? o.nMid : Math.max(2, Math.round(3 * dens));
            if (nf) place(ko.far, 'far', Math.min(1, .7 * al), .36 * (o.farScale || 1), nf, o.xs);
            mistFill(c, w, h, th, h * .35, h, .25 * mi);
            if (nm) place(ko.mid, 'mid', Math.min(1, .88 * al), .3, nm);
            if (th.ground && o.ground !== false) { c.fillStyle = lg(c, 0, horizon, 0, h, [[0, th.ground], [1, mixc(th.ground, '#000', .35)]]); c.fillRect(0, horizon + h * .06, w, h); c.fillStyle = lg(c, 0, horizon + h * .02, 0, horizon + h * .1, [[0, 'rgba(255,255,255,.1)'], [1, 'rgba(255,255,255,0)']]); c.fillRect(0, horizon + h * .06, w, h * .06); }
            mistFill(c, w, h, th, h * .55, h, .18 * mi);
            vignette(c, w, h);
        } finally { idx = keep; }
        c.setTransform(1, 0, 0, 1, 0, 0);
    }

    /* ------------------------------------------------------------- the home screen: a world with an island ---- */
    // The home screen is a little world. The arena fills the whole background (sky, sun or moon, far scenery, mist) and your player stands on a floating island that
    // carries a few pieces of the arena. Both are painted once into canvases; only the air specks and the island's slow bob (CSS) move.
    // props: [kind, x (-1 left .. 1 right), scale, hover (1 = floats above the island)]
    const ISLE = [
        { top: '#6fd37f', edge: '#d3f9bd', under: ['#94643f', '#35241a'], deco: 'grass', hang: 'rock',     props: [['windmill', .78, .6], ['cloud', .5, .28, 1]] },
        { top: '#3b4254', edge: '#7a84a2', under: ['#4d5468', '#1a1e2a'], deco: 'lines', hang: 'rock',     props: [['lamp', -.8, .62], ['car', .72, .5], ['cone', -.42, .6]] },
        { top: '#b9615f', edge: '#f0a58c', under: ['#80405a', '#2d1727'], deco: 'tiles', hang: 'rock',     props: [['antenna', .82, .6], ['tank', -.76, .62], ['birds', .1, .5, 1]] },
        { top: '#9b6c43', edge: '#d9a56b', under: ['#493626', '#171210'], deco: 'planks', hang: 'posts',   props: [['lighthouse', .8, .44], ['containers', -.74, .5]] },
        { top: '#7a8398', edge: '#cdd5e6', under: ['#4a3b2d', '#17110c'], deco: 'rivets', hang: 'pipes',   props: [['chimney', .8, .42], ['gear', -.78, .4]] },
        { top: '#2f7469', edge: '#d9e86a', under: ['#1f504a', '#0a1d1b'], deco: 'tiles2', hang: 'rock',    props: [['roundel', .78, .55], ['tilepillar', -.8, .42]] },
        { top: '#f1f7ff', edge: '#cfe6ff', under: ['#7f98b4', '#2e3e54'], deco: 'snow', hang: 'rock',      props: [['pines', -.74, .62], ['peak', .78, .36]] },
        { top: '#cdd3ea', edge: '#9f8bff', under: ['#4b507c', '#191b38'], deco: 'hex', hang: 'thruster',   props: [['sat', .78, .55, 1], ['station', -.62, .4, 1], ['asteroid', .45, .4, 1]] },
        { top: '#3f2c29', edge: '#ff7a3d', under: ['#2c1613', '#0d0504'], deco: 'cracks', hang: 'drips',   props: [] },
        { top: '#eadba3', edge: '#ffcf3f', under: ['#4d5181', '#161934'], deco: 'gold', hang: 'rock',      props: [['crag', .78, .42]] },
    ];
    // the home screen is calmer than the race: only a few big shapes (a lone volcano, one storm cloud with its lightning, ...)
    const CALM = {                                                                 // xs: where the far pieces stand (0..1 across), so nothing piles up behind the sun, the title or the island
        0: { kinds: { far: ['cloud'], mid: [] }, nFar: 1, nMid: 0, xs: [.22], farScale: 1.1 },
        1: { kinds: { far: ['pillar', 'pillar'], mid: [] }, nFar: 2, nMid: 0, xs: [.1, .9] },
        2: { kinds: { far: ['skyline'], mid: [] }, nFar: 1, nMid: 0, xs: [.5], farScale: 1.2 },
        3: { kinds: { far: ['ship'], mid: [] }, nFar: 1, nMid: 0, xs: [.2] },
        7: { kinds: { far: ['planet'], mid: [] }, nFar: 1, nMid: 0, xs: [.24], farScale: 1.3 },
        8: { kinds: { far: [], mid: [] }, nFar: 0, nMid: 0 },
        9: { kinds: { far: [], mid: ['crag'] }, nFar: 0, nMid: 2 },
    };
    // the big volcano of the Volcano home screen: layered rock with ridges, a glowing crater, branching lava streams that glow, a smoke column lit from below, embers
    function bigVolcano(c, w, h) {
        const r = rng(4242), cx = w * .5, top = h * .27, base = h * .7, hw = w * .62, cw = w * .1, ry = cw * .22;
        const flank = (side, k) => { const t = k, x = cx + side * (cw + (hw - cw) * Math.pow(t, 1.25)), y = top + (base - top) * t; return [x + (r() - .5) * 5 * t, y]; };
        // smoke column (behind the cone), lit orange from below
        for (let q = 0; q < 16; q++) { const t = q / 15, sx = cx + Math.sin(q * 1.3) * w * .05 * t + t * w * .06, sy = top - 6 - t * h * .26, rr = w * (.06 + t * .12);
            c.fillStyle = rg(c, sx, sy, 2, rr, [[0, 'rgba(' + Math.round(95 - t * 40) + ',' + Math.round(55 - t * 30) + ',' + Math.round(48 - t * 24) + ',' + (.85 - t * .5) + ')'], [1, 'rgba(40,24,26,0)']]); disc(c, sx, sy, rr); }
        c.fillStyle = rg(c, cx, top - 10, 4, w * .4, [[0, 'rgba(255,130,50,.35)'], [1, 'rgba(255,130,50,0)']]); c.fillRect(0, 0, w, base);
        // the cone
        const L = [], R = []; for (let q = 0; q <= 14; q++) { L.push(flank(-1, q / 14)); R.push(flank(1, q / 14)); }
        c.beginPath(); c.moveTo(L[0][0], L[0][1]); L.forEach(p => c.lineTo(p[0], p[1])); c.lineTo(cx + w, base + h * .06); c.lineTo(cx - w, base + h * .06); c.lineTo(R[14][0], R[14][1]); for (let q = 13; q >= 0; q--) c.lineTo(R[q][0], R[q][1]); c.closePath();
        c.fillStyle = lg(c, 0, top, 0, base, [[0, '#2a1612'], [.55, '#1d0f0d'], [1, '#12090a']]); c.fill();
        c.save(); c.clip();
        c.fillStyle = lg(c, cx - hw, 0, cx + hw, 0, [[0, 'rgba(255,170,120,.16)'], [.45, 'rgba(255,140,90,.03)'], [.7, 'rgba(0,0,0,.28)'], [1, 'rgba(0,0,0,.5)']]); c.fillRect(0, top - 20, w, base - top + 80);        // light from the left, the right side in shadow
        c.lineCap = 'round'; for (let q = 0; q < 11; q++) { const a = (q + .5) / 11 * 2 - 1, x0 = cx + a * cw * .9, x1 = cx + a * hw * 1.05; c.strokeStyle = 'rgba(0,0,0,' + (.22 + r() * .2) + ')'; c.lineWidth = 2 + r() * 5; c.beginPath(); c.moveTo(x0, top + 6); c.bezierCurveTo(x0 + (x1 - x0) * .2, top + (base - top) * .4, x0 + (x1 - x0) * .75, top + (base - top) * .6, x1, base + 10); c.stroke(); }
        c.strokeStyle = 'rgba(255,190,140,.12)'; c.lineWidth = 2; for (let q = 0; q < 5; q++) { const a = -.9 + q * .2, x0 = cx + a * cw, x1 = cx + a * hw * 1.05; c.beginPath(); c.moveTo(x0, top + 8); c.bezierCurveTo(x0 + (x1 - x0) * .25, top + (base - top) * .4, x0 + (x1 - x0) * .7, top + (base - top) * .62, x1, base + 10); c.stroke(); }
        c.fillStyle = lg(c, 0, base - h * .16, 0, base + h * .06, [[0, 'rgba(255,90,40,0)'], [1, 'rgba(255,90,40,.28)']]); c.fillRect(0, base - h * .16, w, h * .24);                                                  // heat at the foot
        // lava streams down the flanks: a wide red glow, an orange body, a hot yellow core
        const streams = [[-.55, -.8, .62], [-.15, -.3, .5], [.2, .42, .56], [.6, .95, .4], [0, .02, .3]];
        c.globalCompositeOperation = 'lighter';
        for (const [a0, a1, len] of streams) {
            const x0 = cx + a0 * cw * 1.6, y0 = top + 4, pts = []; let x = x0;
            for (let q = 0; q <= 14; q++) { const t = q / 14 * len, y = y0 + (base - top) * t; x = x0 + (a1 - a0) * (hw * .9) * Math.pow(q / 14 * len, 1.2) + Math.sin(q * .62 + a0 * 9) * (1.5 + q * .5); pts.push([x, y]); }
            const path = () => { c.beginPath(); pts.forEach((p, n) => n ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); };
            for (const [lw, col] of [[26, 'rgba(255,60,20,.14)'], [13, 'rgba(255,90,25,.4)'], [7.5, 'rgba(255,150,40,.9)'], [3, 'rgba(255,232,150,.95)']]) { c.strokeStyle = col; c.lineWidth = lw; path(); c.stroke(); }
            c.fillStyle = 'rgba(255,200,90,.9)'; disc(c, pts[pts.length - 1][0], pts[pts.length - 1][1], 3.2);
        }
        // small cracks that glow
        c.lineWidth = 1.6; for (let q = 0; q < 9; q++) { const t = .25 + r() * .6, side = r() > .5 ? 1 : -1, x = cx + side * (cw + (hw - cw) * Math.pow(t, 1.25)) * (.3 + r() * .5), y = top + (base - top) * t; c.strokeStyle = 'rgba(255,140,50,.6)'; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (r() - .5) * 26, y + 8 + r() * 14); c.lineTo(x + (r() - .5) * 30, y + 22 + r() * 16); c.stroke(); }
        c.globalCompositeOperation = 'source-over'; c.restore();
        // the crater: rim, lava lake
        c.fillStyle = lg(c, cx - cw, 0, cx + cw, 0, [[0, '#4a2a22'], [1, '#1c0e0d']]); c.beginPath(); c.ellipse(cx, top, cw * 1.08, ry * 1.2, 0, 0, TAU); c.fill();
        c.fillStyle = rg(c, cx - cw * .1, top, 2, cw, [[0, '#fff3b0'], [.35, '#ffb038'], [.75, '#ff5a1c'], [1, '#a81808']]); c.beginPath(); c.ellipse(cx, top + 1, cw * .9, ry * .9, 0, 0, TAU); c.fill();
        c.globalCompositeOperation = 'lighter'; c.fillStyle = rg(c, cx, top, 2, cw * 2.8, [[0, 'rgba(255,170,70,.65)'], [1, 'rgba(255,100,30,0)']]); c.fillRect(cx - cw * 3, top - cw * 3, cw * 6, cw * 6);
        for (let q = 0; q < 26; q++) { const a = r() * Math.PI * 2, d = r(), ex = cx + (r() - .5) * cw * 2 + Math.sin(a) * d * 14, ey = top - 8 - d * h * .2; c.fillStyle = 'rgba(255,' + Math.round(150 + r() * 80) + ',70,' + (.9 - d * .6) + ')'; disc(c, ex, ey, .8 + r() * 1.8); }
        c.globalCompositeOperation = 'source-over';
    }
    function paintWorld(cv, i, w, h) {
        paintScene(cv, i, w, h, Object.assign({ prog: .2, props: 1.7, alpha: 1.15, mist: .9, horizon: .8, ground: false, scale: .62, orbDy: .17 }, CALM[i] || {}));      // the far pieces stand on a horizon that is hidden behind the cards: nothing hovers
        const c = cv.getContext('2d'), dpr = cv.width / w; c.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (i === 8) bigVolcano(c, w, h);
        if (i === 9) {                                                                  // Summit: one dark storm cloud, and the lightning really comes out of it
            const keep = idx; idx = i;
            try {
                const sp = sprite(i, 'storm', 'far', 0), k = Math.min(1.5, w * .8 / sp.def.w), cx = w * .5, cy = h * .3;
                put(c, sp, cx, cy, k, .95, 0);
                const x0 = cx + w * .06, y0 = cy - 6, pts = [[x0, y0]]; let x = x0, y = y0; const rr = rng(77);
                while (y < h * .56) { y += h * (.035 + rr() * .03); x += (rr() - .5) * w * .1; pts.push([x, y]); }
                c.lineJoin = 'round'; c.lineCap = 'round'; c.globalCompositeOperation = 'lighter';
                for (const [lw, a] of [[12, .18], [6, .35], [2.4, .95]]) { c.strokeStyle = 'rgba(255,238,170,' + a + ')'; c.lineWidth = lw; c.beginPath(); pts.forEach((q, n) => n ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); c.stroke(); }
                c.globalCompositeOperation = 'source-over';
            } finally { idx = keep; }
        }
        c.fillStyle = lg(c, 0, 0, 0, h * .22, [[0, 'rgba(7,9,14,.7)'], [1, 'rgba(7,9,14,0)']]); c.fillRect(0, 0, w, h * .22);                                  // calm behind the header
        c.fillStyle = lg(c, 0, h * .7, 0, h, [[0, 'rgba(7,9,14,0)'], [.45, 'rgba(7,9,14,.74)'], [1, 'rgba(7,9,14,.96)']]); c.fillRect(0, h * .7, w, h * .3);       // calm behind the cards
        c.setTransform(1, 0, 0, 1, 0, 0);
    }
    function paintIsland(cv, i, w, h) {
        const th = T[i], is = ISLE[i], dpr = cv.width / w, c = cv.getContext('2d'), r = rng(900 + i * 31);
        c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h); c.lineJoin = 'round'; c.lineCap = 'round';
        const cx = w / 2, topY = h * .4, rx = w * .43, ry = rx * .21, thick = h * .05, depth = h * .44;
        const ell = (x, y, a, b, fill) => { c.beginPath(); c.ellipse(x, y, a, b, 0, 0, TAU); if (fill) c.fill(); };
        // 1 the underside: an upside-down rock with a ragged bottom
        const pts = [[cx - rx, topY + thick]]; const n = 9;
        for (let k = 1; k < n; k++) { const u = k / n, prof = Math.pow(Math.sin(u * Math.PI), .85); pts.push([cx - rx + u * rx * 2, topY + thick + depth * prof * (.5 + .5 * r())]); pts.push([cx - rx + (u + .5 / n) * rx * 2, topY + thick + depth * Math.pow(Math.sin((u + .5 / n) * Math.PI), .85) * (.2 + .3 * r())]); }
        pts.push([cx + rx, topY + thick]);
        // the deepest point makes a stalactite in the middle
        const mid = Math.floor(pts.length / 2); pts[mid] = [cx + (r() - .5) * rx * .2, topY + thick + depth];
        if (is.hang === 'posts') for (const dx of [-.5, -.12, .34]) { const x = cx + dx * rx; c.fillStyle = mixc(is.under[0], '#000', .2); c.fillRect(x - 4, topY + thick + depth * .45, 8, depth * .62 * (.8 + r() * .3)); c.strokeStyle = 'rgba(210,190,150,.5)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, topY + thick + depth * .5); c.bezierCurveTo(x + 14, topY + depth * .9, x - 14, topY + depth * 1.1, x + 3, topY + depth * 1.3); c.stroke(); }
        if (is.hang === 'pipes') { c.strokeStyle = mixc(is.top, '#000', .35); c.lineWidth = 9; c.beginPath(); c.moveTo(cx - rx * .55, topY + thick * 2); c.bezierCurveTo(cx - rx * .8, topY + depth * .8, cx - rx * .2, topY + depth * 1.05, cx + rx * .1, topY + depth * 1.25); c.stroke(); c.strokeStyle = is.top; c.lineWidth = 4; c.stroke(); c.fillStyle = is.edge; for (const q of [.2, .55, .85]) disc(c, cx - rx * (.55 - q * .65), topY + depth * (.35 + q * .8), 5.5); }
        if (is.hang === 'thruster') { const g = lg(c, 0, topY + depth * .6, 0, topY + depth * 1.35, [[0, 'rgba(159,139,255,.8)'], [.5, 'rgba(120,170,255,.35)'], [1, 'rgba(120,170,255,0)']]); c.fillStyle = g; c.beginPath(); c.moveTo(cx - rx * .2, topY + depth * .6); c.lineTo(cx + rx * .2, topY + depth * .6); c.lineTo(cx + rx * .08, topY + depth * 1.35); c.lineTo(cx - rx * .08, topY + depth * 1.35); c.closePath(); c.fill(); }
        c.beginPath(); pts.forEach((p, k) => k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath();
        c.fillStyle = lg(c, 0, topY, 0, topY + depth, [[0, is.under[0]], [1, is.under[1]]]); c.fill();
        c.fillStyle = lg(c, cx - rx, 0, cx + rx, 0, [[0, 'rgba(255,255,255,.14)'], [.5, 'rgba(255,255,255,0)'], [1, 'rgba(0,0,0,.34)']]); c.fill();           // light from the left
        if (is.hang === 'drips') for (let k = 0; k < 5; k++) { const x = cx + (r() - .5) * rx * 1.1, y0 = topY + thick + depth * .35, len = depth * (.25 + r() * .5); c.strokeStyle = 'rgba(255,122,61,.9)'; c.lineWidth = 2.4; c.shadowColor = '#ff7a3d'; c.shadowBlur = 8; c.beginPath(); c.moveTo(x, y0); c.lineTo(x + (r() - .5) * 6, y0 + len); c.stroke(); c.fillStyle = '#ffb36b'; disc(c, x, y0 + len + 3, 3.2); c.shadowBlur = 0; }
        if (is.hang === 'rock') for (let k = 0; k < 4; k++) { c.fillStyle = mixc(is.under[1], is.under[0], .4); disc(c, cx + (r() - .5) * rx * 1.2, topY + depth * (1.05 + r() * .22), 3 + r() * 5); }
        // 2 the thickness and the top
        c.fillStyle = mixc(is.top, '#000000', .5); ell(cx, topY + thick, rx, ry, true);
        c.save(); c.translate(cx, topY); c.scale(1, ry / rx); c.fillStyle = rg(c, -rx * .15, -rx * .1, rx * .05, rx * 1.05, [[0, mixc(is.top, '#ffffff', .2)], [.7, is.top], [1, mixc(is.top, '#000000', .22)]]); c.beginPath(); c.arc(0, 0, rx, 0, TAU); c.fill(); c.restore();
        c.save(); c.beginPath(); c.ellipse(cx, topY, rx - 1, ry - 1, 0, 0, TAU); c.clip();
        const rin = () => { const a = r() * TAU, d = Math.sqrt(r()); return [cx + Math.cos(a) * d * rx * .92, topY + Math.sin(a) * d * ry * .9]; };
        if (is.deco === 'grass') { for (let k = 0; k < 90; k++) { const [x, y] = rin(); c.strokeStyle = r() > .5 ? mixc(is.top, '#ffffff', .3) : mixc(is.top, '#000000', .25); c.lineWidth = 1.6; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (r() - .5) * 3, y - 4 - r() * 4); c.stroke(); } for (let k = 0; k < 7; k++) { const [x, y] = rin(); c.fillStyle = [th.acc, '#ff7a8a', '#ffffff'][k % 3]; disc(c, x, y, 2.2); } }
        else if (is.deco === 'lines') { c.strokeStyle = '#ffd400'; c.globalAlpha = .75; c.lineWidth = 3.4; c.setLineDash([12, 9]); for (let k = -3; k <= 3; k++) { c.beginPath(); c.moveTo(cx + k * rx * .3, topY + ry); c.lineTo(cx + k * rx * .3 + rx * .14, topY - ry); c.stroke(); } c.setLineDash([]); c.globalAlpha = 1; }
        else if (is.deco === 'tiles') { c.strokeStyle = mixc(is.top, '#000000', .35); c.lineWidth = 1.6; for (let y = topY - ry; y < topY + ry; y += ry * .3) for (let x = cx - rx; x < cx + rx; x += rx * .17) { c.beginPath(); c.arc(x + ((y / ry * 10 | 0) % 2 ? rx * .085 : 0), y, rx * .08, 0, Math.PI); c.stroke(); } }
        else if (is.deco === 'planks') { c.strokeStyle = mixc(is.top, '#000000', .45); c.lineWidth = 1.8; for (let k = -9; k <= 9; k++) { const x = cx + k * rx * .11; c.beginPath(); c.moveTo(x, topY - ry); c.lineTo(x - rx * .06, topY + ry); c.stroke(); } c.fillStyle = 'rgba(255,255,255,.07)'; for (let k = -8; k <= 8; k += 2) { const x = cx + k * rx * .11; poly(c, [[x, topY - ry], [x + rx * .11, topY - ry], [x + rx * .05, topY + ry], [x - rx * .06, topY + ry]]); } }
        else if (is.deco === 'rivets') { c.strokeStyle = mixc(is.top, '#000000', .4); c.lineWidth = 1.6; for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(cx + k * rx * .4, topY - ry); c.lineTo(cx + k * rx * .45, topY + ry); c.stroke(); } c.beginPath(); c.moveTo(cx - rx, topY); c.lineTo(cx + rx, topY); c.stroke(); c.fillStyle = mixc(is.top, '#ffffff', .4); for (let k = -4; k <= 4; k++) for (const y of [-.7, .7]) disc(c, cx + k * rx * .22, topY + y * ry, 2); }
        else if (is.deco === 'tiles2') { c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1.2; for (let k = -8; k <= 8; k++) { c.beginPath(); c.moveTo(cx + k * rx * .12, topY - ry); c.lineTo(cx + k * rx * .15, topY + ry); c.stroke(); } for (let y = topY - ry; y <= topY + ry; y += ry * .34) { c.beginPath(); c.moveTo(cx - rx, y); c.lineTo(cx + rx, y); c.stroke(); } c.strokeStyle = is.edge; c.lineWidth = 6; c.globalAlpha = .8; c.beginPath(); c.ellipse(cx, topY, rx * .94, ry * .86, 0, .1, Math.PI - .1); c.stroke(); c.globalAlpha = 1; }
        else if (is.deco === 'snow') { c.fillStyle = 'rgba(160,190,225,.35)'; for (let k = 0; k < 6; k++) { const [x, y] = rin(); c.beginPath(); c.ellipse(x, y + 3, rx * .12, ry * .12, 0, 0, TAU); c.fill(); } c.fillStyle = '#ffffff'; for (let k = 0; k < 26; k++) { const [x, y] = rin(); disc(c, x, y, 1 + r() * 1.4); } }
        else if (is.deco === 'hex') { c.strokeStyle = 'rgba(159,139,255,.4)'; c.lineWidth = 1.4; const R = rx * .13; for (let q = -6; q <= 6; q++) for (let p2 = -3; p2 <= 3; p2++) { const x = cx + q * R * 1.73 + (p2 % 2 ? R * .86 : 0), y = topY + p2 * R * 1.5 * (ry / rx) * 1.1; c.beginPath(); for (let a = 0; a < 6; a++) { const an = a * Math.PI / 3 + Math.PI / 6; c.lineTo(x + Math.cos(an) * R, y + Math.sin(an) * R * (ry / rx) * 1.1); } c.closePath(); c.stroke(); } }
        else if (is.deco === 'cracks') { c.strokeStyle = '#ff7a3d'; c.lineWidth = 2; c.shadowColor = '#ff7a3d'; c.shadowBlur = 7; for (let k = 0; k < 6; k++) { let [x, y] = rin(); c.beginPath(); c.moveTo(x, y); for (let q = 0; q < 4; q++) { x += (r() - .5) * rx * .24; y += (r() - .5) * ry * .5; c.lineTo(x, y); } c.stroke(); } c.shadowBlur = 0; }
        else if (is.deco === 'gold') { c.strokeStyle = is.edge; c.globalAlpha = .55; c.lineWidth = 2; for (const f of [.8, .55, .3]) { c.beginPath(); c.ellipse(cx, topY, rx * f, ry * f, 0, 0, TAU); c.stroke(); } c.globalAlpha = 1; }
        c.restore();
        c.strokeStyle = is.edge; c.lineWidth = 2.6; c.globalAlpha = .85; if (is.deco === 'hex' || is.deco === 'cracks') { c.shadowColor = is.edge; c.shadowBlur = 10; } ell(cx, topY, rx, ry, false); c.stroke(); c.shadowBlur = 0; c.globalAlpha = 1;
        // 3 the arena standing on it (the player stands in front of these)
        const sc = w / 360, prev = idx; idx = i;
        try {
            for (const q of is.props) {
                const def = K[q[0]], v = q[0].length % 2, s0 = sprite(i, q[0], 'near', v), k = q[2] * sc, hover = def.float || q[3];
                const x = cx + q[1] * rx * .88, y = hover ? topY - ry * 1.15 - 4 * sc - q[2] * 14 * sc : topY - ry * .28;
                put(c, s0, x, y, k, 1, def.rot ? .6 : 0);
                if (def.glow) { const g = sprite(i, q[0], 'near', v, true); c.globalCompositeOperation = 'lighter'; put(c, g, x, y, k, .85, 0); c.globalCompositeOperation = 'source-over'; }
            }
        } finally { idx = prev; }
        c.setTransform(1, 0, 0, 1, 0, 0);
    }
    const airMake = (i, n) => { const r = rng(77 + i * 5); return Array.from({ length: n || 30 }, () => ({ x: r(), y: r(), s: .5 + r(), v: .4 + r() * .8 })); };
    const airStep = (c, i, list, w, h, now, dt) => { if (i === 0) flyers(c, i, w, h, Math.min(dt, .1)); specks(c, T[i], list, w, h, now, dt); if (i === 0) balloons(c, i, w, h, Math.min(dt, .1)); };

    /* ------------------------------------------------------------------------------ power-ups ---- */
    // called by the item roll: removes what the arena does not have, switches the Gust on where it exists, and shifts a few odds
    function shape(w, f, others, behind) {
        if (!cur || !poolSet) return;
        for (const k in w) if (!poolSet.has(k)) w[k] = 0;
        if (poolSet.has('wind')) w.wind = (others && behind) ? 0.10 + 0.12 * f : 0;          // the Gust needs somebody ahead of you
        const NEWW = { nitro: .16, net: .14, jet: .03 + .24 * f };                        // Nitro and the Net are small helpers (the front gets them 25% more often), the Jetpack is about as strong as a Rocket: mostly the back
        for (const k in NEWW) if (poolSet.has(k)) w[k] = NEWW[k] * (k === 'jet' ? (behind ? 1 : .2) : (behind ? 1 : 1.25));
        for (const k in cur.bias) if (w[k] > 0) w[k] *= cur.bias[k];
    }
    // WHICH LEDGES: new players meet the ledge types one at a time (a party race and the other modes keep the full mix).
    //   Playground: normal, boost, moving ledges.  Parking Lot: + crumbling.  Rooftop: + ice.  From the Harbour on: sealed ledges (ceilings) too.
    const LEDGES = ['boost', 'moving', 'fragile', 'ice'], LEDGE_COUNT = [2, 3, 4, 4], CEILINGS_FROM = 3;
    const rules = () => rulesNow;
    window.ArenaTheme = { pick, set, clear, on, drawSky, shape, paintScene, paintWorld, paintIsland, airMake, airStep, rules, testGet, testSet, UNLOCKS, COLORS, poolAt, poolOfArena, grid: () => cur ? cur.grid : null, light: () => !!(cur && cur.light), index: () => idx, THEMES: T, INFO, ORDER,
        name: i => T[i].name, color: i => T[i].c };
})();
