// Extra life for some of the stronger cosmetics: orbiting stars, rising embers, lightning, glints. Each effect is just more animated layers
// (orbit / bob / pulse are handled by drawCustomLayers). Loaded AFTER game.js.
(function () {
    const star = (cx, cy, r) => [[cx, cy - r], [cx + r * .28, cy - r * .28], [cx + r, cy], [cx + r * .28, cy + r * .28], [cx, cy + r], [cx - r * .28, cy + r * .28], [cx - r, cy], [cx - r * .28, cy - r * .28]];
    const spark = (cx, cy, r, fill, f, p) => ({ t:'poly', pts:star(cx, cy, r), fill, pulse:{ a:.95, f, p } });
    const ember = (x, y, r, fill, f, p, rise) => ({ t:'ellipse', x, y, rx:r, ry:r * 1.25, fill, bob:{ x:.6, y:rise, f, p }, pulse:{ a:.9, f:f * 2, p } });
    const orbitStar = (pv, rad, a0, r, fill, speed) => { const a = a0 * Math.PI / 180; return { t:'poly', pts:star(pv[0] + Math.cos(a) * rad, pv[1] + Math.sin(a) * rad, r), fill, orbit:speed, pivot:pv, pulse:{ a:.5, f:1.4, p:a0 } }; };
    const FX = {
        hats: {
            'p-starhalo': () => [0, 120, 240].map(a => orbitStar([0, -22], 13, a, 1.9, '#fff7c2', 70)),
            'p-planet':   () => [{ t:'ellipse', x:11, y:-23, rx:2, ry:2, fill:'#dfe8ff', stroke:'#161a26', sw:.6, orbit:90, pivot:[0, -23] }, spark(-12, -31, 1.8, '#fff', 1.1, 0)],
            'p-phoenix':  () => [ember(-5, -26, .9, '#ffd45e', .7, 0, 5), ember(4, -27, .8, '#ff9a3d', .9, 1.7, 6), ember(0, -29, .7, '#fff1a8', .6, 3.1, 7), ember(8, -25, .7, '#ff7a2e', 1.1, 4.4, 5)],
            'p-magma':    () => [ember(-6, -25, .8, '#ffb347', .8, 0, 4), ember(5, -26, .9, '#ff5a2a', .6, 2.2, 5), ember(1, -28, .7, '#ffe27a', 1, 4, 6)],
            'p-storm':    () => [{ t:'poly', pts:[[1.5, -19], [-1.5, -14], [0.4, -14], [-1, -9], [3, -15], [1, -15]], fill:'#fff6a8', stroke:'#ffd400', sw:.4, pulse:{ a:1, f:1.9, p:0 } }],
            'c-tiara':    () => [spark(-8, -24, 1.7, '#fff', 1.2, 0), spark(8, -24, 1.7, '#fff', 1.2, 2.1), spark(0, -27, 2, '#fff8c8', .9, 4)],
            'c-kabuto':   () => [spark(-9, -22, 1.5, '#fff3b0', 1.1, 0), spark(9, -22, 1.5, '#fff3b0', 1.1, 3)],
            'c-bulb':     () => [{ t:'ellipse', x:0, y:-22, rx:11, ry:9, fill:'#ffe27a', alpha:.22, pulse:{ a:.9, f:1.3, p:0 } }],
            'halo':       () => [spark(-8, -22, 1.6, '#fff', 1.3, 0), spark(8, -23, 1.3, '#fff', 1.1, 2.4)],
        },
        faces: {
            'p-laser':     () => [spark(8, -7, 1.7, '#fff', 1.4, 0)],
            'p-nova':      () => [spark(-8, -7, 1.7, '#fff', 1.3, 0), spark(8, 6, 1.4, '#ffe9a0', 1, 2.6)],
            'p-ghostfire': () => [ember(-6, -9, .9, '#9be8ff', .8, 0, 4), ember(6, -9, .9, '#b9f2ff', .9, 2, 4)],
        },
    };
    for (const [list, map] of [[HATS, FX.hats], [FACES, FX.faces]]) {
        for (const it of list) { const mk = map[it.id]; if (mk && Array.isArray(it.layers)) it.layers.push(...mk()); }
    }
})();
