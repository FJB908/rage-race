import json, math, random, sys
OUT_STYLES = 'src/data/skin-styles.js'
OUT_CUSTOM = 'src/data/custom-cosmetics.js'

def rnd(v): return round(v, 2)
def _fin(d, stroke, sw, a, fill2, smooth=None):
    if stroke: d['stroke'] = stroke; d['sw'] = sw
    if a is not None and a != 1: d['alpha'] = a
    if fill2: d['fill2'] = fill2
    if smooth: d['smooth'] = True
    return d
def P(pts, fill='#fff', stroke=None, sw=1, a=None, smooth=False, fill2=None):
    return _fin({'t':'poly','pts':[[rnd(x), rnd(y)] for x, y in pts],'fill':fill}, stroke, sw, a, fill2, smooth)
def LN(pts, stroke, sw=1, a=None, smooth=False):
    d = {'t':'poly','pts':[[rnd(x), rnd(y)] for x, y in pts],'open':True,'fill':'none','stroke':stroke,'sw':sw}
    if a is not None and a != 1: d['alpha'] = a
    if smooth: d['smooth'] = True
    return d
def E(x, y, rx, ry, fill='#fff', rot=0, stroke=None, sw=1, a=None, fill2=None):
    d = {'t':'ellipse','x':rnd(x),'y':rnd(y),'rx':rnd(rx),'ry':rnd(ry),'fill':fill}
    if rot: d['rot'] = rot
    return _fin(d, stroke, sw, a, fill2)
def C(x, y, r, fill='#fff', **kw): return E(x, y, r, r, fill, **kw)
def R(x, y, w, h, fill='#fff', rot=0, r=0, stroke=None, sw=1, a=None, fill2=None):
    d = {'t':'rect','x':rnd(x),'y':rnd(y),'w':rnd(w),'h':rnd(h),'fill':fill}
    if r: d['r'] = r
    if rot: d['rot'] = rot
    return _fin(d, stroke, sw, a, fill2)
def star(x, y, r, fill='#fff', a=None, n=4, inner=.32, rot=-90):
    pts = []
    for i in range(n * 2):
        ang = math.radians(rot + i * 180 / n); rr = r if i % 2 == 0 else r * inner
        pts.append((x + math.cos(ang) * rr, y + math.sin(ang) * rr))
    return P(pts, fill, a=a)
def mirror(ls):
    out = []
    for L in ls:
        out.append(L)
        c = json.loads(json.dumps(L))
        if c['t'] == 'poly': c['pts'] = [[-p[0], p[1]] for p in c['pts']]
        else:
            c['x'] = -c['x']
            if c.get('rot'): c['rot'] = -c['rot']
        out.append(c)
    return out
def gloss(a=.3): return [E(-5.5, -8.2, 7, 3, '#ffffff', rot=-25, a=a), C(-9.2, -4.6, 1.2, '#ffffff', a=min(1, a + .2))]
def shade(a=.3): return R(0, 9, 26, 12, 'rgba(0,0,0,0)', fill2='rgba(0,0,0,%s)' % a)
def bevel(c='#ffffff', a=.2): return R(0, 0, 22.5, 22.5, 'none', r=3, stroke=c, sw=.9, a=a)
def halo(c='#ffffff', a=.92, r=3.5, force=False):
    r = r if force else min(r, 3.1); a = a if force else min(a, .6)
    return [E(-4, -2, r, r * 1.05, c, a=a), E(4, -2, r, r * 1.05, c, a=a)]
def vgrad(y0, y1, c0, c1, a=None, x=0, w=26): return R(x, (y0 + y1) / 2, w, y1 - y0, c0, fill2=c1, a=a)
def blob(rng, cx, cy, rx, ry, n=8, j=.35):
    pts = []
    for i in range(n):
        ang = i / n * 2 * math.pi; k = 1 + rng.uniform(-j, j)
        pts.append((cx + math.cos(ang) * rx * k, cy + math.sin(ang) * ry * k))
    return pts
def sector(cx, cy, r0, r1, a0, a1, steps=8):
    pts = [(cx + math.cos(math.radians(a0 + (a1 - a0) * i / steps)) * r1, cy + math.sin(math.radians(a0 + (a1 - a0) * i / steps)) * r1) for i in range(steps + 1)]
    pts += [(cx + math.cos(math.radians(a1 - (a1 - a0) * i / steps)) * r0, cy + math.sin(math.radians(a1 - (a1 - a0) * i / steps)) * r0) for i in range(steps + 1)]
    return pts
def hexpts(cx, cy, r, rot=0): return [(cx + math.cos(math.radians(60 * i + rot)) * r, cy + math.sin(math.radians(60 * i + rot)) * r) for i in range(6)]

S = {}   # id -> dict(name,color,a,b,price,rarity,layers)
def add(id, name, a, b, layers, price=None, rarity=None, color=None):
    S[id] = dict(id=id, name=name, a=a, b=b, layers=layers, price=price, rarity=rarity, color=color or a)

# ======================= EXISTING SKINS (restyled) =======================
add('classic', 'Classic', '#66f5df', '#17b09b', [bevel(), *gloss(.32), shade(.22)])

L = [E(0, 1.5, 10, 10, '#e9ff9c', a=.35), C(0, 1.5, 10.2, 'none', stroke='#f6ffd0', sw=1.4, a=.8)]
for i in range(8):
    ang = math.radians(i * 45 + 22.5); L.append(LN([(0, 1.5), (math.cos(ang) * 10, 1.5 + math.sin(ang) * 10)], '#f6ffd0', .9, .7))
L += [C(0, 1.5, 1.4, '#f6ffd0', a=.9), bevel(), *gloss(.3), shade(.25)]
add('lime', 'Lime', '#c9f57c', '#5db628', L)

L = [P([(-12.5, 12.5), (-12.5, 4), (-9, 7.5), (-7, 1), (-3.5, 6.5), (0, -1.5), (3.5, 6), (6.5, 0), (9, 7.5), (12.5, 3), (12.5, 12.5)], '#c4210f', smooth=True, a=.9, fill2='#ff4a1f'),
     P([(-8, 12.5), (-8, 8), (-5, 9), (-3, 4), (0, 8), (2.5, 3.5), (5, 8.5), (8, 7), (8, 12.5)], '#ffb21c', smooth=True, fill2='#ffe45e'),
     star(-8, -6, 1.5, '#fff1a0', .9), star(7, -8, 1.1, '#fff1a0', .8), C(9.5, -3, .6, '#ffe45e'), C(-10, 0, .5, '#ffe45e'), bevel(), *gloss(.25)]
add('ember', 'Ember', '#ffc060', '#ff6a1f', L)

L = [P([(-12.5, -12.5), (-3, -12.5), (-12.5, 0)], '#ffffff', a=.45), P([(12.5, -12.5), (12.5, 2), (4, -12.5)], '#ffffff', a=.3), P([(12.5, 12.5), (0, 12.5), (12.5, -2)], '#4f9fe0', a=.28),
     P([(-12.5, 12.5), (-12.5, 4), (-2, 12.5)], '#4f9fe0', a=.22)]
for k in range(6):
    ang = math.radians(k * 60); L.append(LN([(0, 2.5), (math.cos(ang) * 5.5, 2.5 + math.sin(ang) * 5.5)], '#ffffff', 1, .85))
    L.append(LN([(math.cos(ang) * 3.2 + math.cos(ang + 1.5) * 1.2, 2.5 + math.sin(ang) * 3.2 + math.sin(ang + 1.5) * 1.2), (math.cos(ang) * 3.2 - math.cos(ang + 1.5) * 1.2, 2.5 + math.sin(ang) * 3.2 - math.sin(ang + 1.5) * 1.2)], '#ffffff', .7, .8))
L += [star(8, -8, 1.8, '#ffffff', .95), star(-9, 8, 1.2, '#ffffff', .8), bevel('#ffffff', .35), *gloss(.3)]
add('frost', 'Frostbite', '#eefaff', '#8dc8ee', L)

L = []
for i in range(5):
    ang = math.radians(i * 72 - 90); L.append(E(math.cos(ang) * 5.2, 1.5 + math.sin(ang) * 5.2, 4.6, 3.1, '#ffb3c4', rot=i * 72, stroke='#d93a5a', sw=.7, a=.55))
L += [C(0, 1.5, 2.6, '#ffd5df', stroke='#d93a5a', sw=.7, a=.8), LN([(0, 1.5), (1.4, .4), (1.6, 2), (.2, 2.8), (-1, 1.6), (-.2, .6)], '#d93a5a', .7, .8, True), bevel(), *gloss(.28), shade(.2)]
add('rose', 'Rose', '#ff9fb4', '#e4405f', L)

L = [P(sector(5.5, -6.5, 0, 5, -80, 80, 10), '#ffe9a6'), C(7.2, -6.5, 4.6, '#1b2c78'),
     R(-9.5, 9.5, 4.5, 8, '#05071f', a=.9), R(-4.5, 8, 4, 11, '#070a28', a=.9), R(0.5, 10, 5, 7, '#05071f', a=.9), R(6, 8.5, 4.5, 10, '#070a28', a=.9), R(10.5, 10.5, 3.5, 6, '#05071f', a=.9),
     R(-9.5, 6.6, .9, .9, '#ffd45e'), R(-4.5, 4.6, .9, .9, '#ffd45e'), R(-3.2, 7.2, .9, .9, '#ffd45e'), R(.9, 8.1, .9, .9, '#ffd45e'), R(6.5, 5.6, .9, .9, '#ffd45e'), R(7.8, 8.2, .9, .9, '#ffd45e'),
     star(-9, -9, 1.3, '#ffffff', .95), star(-2.5, -9.5, .9, '#ffffff', .8), C(-10, -3, .5, '#fff'), C(1, -8, .5, '#fff'), star(-6.5, -4.5, .8, '#fff', .8), C(11, 1, .45, '#fff'), bevel('#9fb4ff', .25), *halo('#b8caff', .55, 3.6)]
add('midnight', 'Midnight', '#2c4aa6', '#0c1236', L)

L = [R(0, 0, 40, 5, '#ffffff', rot=45, a=.28), R(-7, 5, 40, 2, '#52f5ff', rot=45, a=.7), R(7, -5, 40, 2, '#ff6bf5', rot=45, a=.7), R(2, 0, 40, .9, '#ffffff', rot=45, a=.9),
     star(8.5, 7.5, 2.3, '#ffffff', .95), star(-8.5, -8, 1.5, '#ffffff', .9), C(9, -8.5, .6, '#fff'), bevel('#ffffff', .35), *gloss(.3), shade(.22)]
add('violet', 'Ultraviolet', '#d2c4ff', '#6446e0', L)

rng = random.Random(4); L = []
for r_i, y in enumerate(range(-9, 12, 6)):
    for xx in range(-9 + (3 if r_i % 2 else 0), 13, 6):
        L.append(C(xx + .35, y + .45, 2.2, '#c27a00', a=.35)); L.append(C(xx, y, 2.2, '#fff4c8', a=.96, stroke='#fff9e0', sw=.5))
        L.append(C(xx - .7, y - .8, .6, '#fff', a=.9))
L += [bevel('#fff', .35), *gloss(.25), shade(.2)]
add('polka', 'Polka', '#ffdc55', '#ffa80f', L)

L = [vgrad(-13, 13, '#4a1f8a', '#ff7a5c'), vgrad(-13, 4, '#2d1566', '#ff5e8a', a=.55),
     C(0, 1.5, 9.2, '#ffe45e', fill2='#ff4f93'), *[R(0, 3.2 + i * 1.5, 20, .5 + i * .24, '#4a1f8a', a=.85) for i in range(0, 5)],
     R(0, 10.2, 26, 6, '#26104f', fill2='#3f1678'), *[LN([(x, 7.4), (x * 2.1, 13)], '#ff6bd8', .5, .8) for x in (-6, -3, 0, 3, 6)], LN([(-13, 7.4), (13, 7.4)], '#ff6bd8', .8, .9), LN([(-13, 10), (13, 10)], '#ff6bd8', .5, .6),
     star(-8, -9, 1.1, '#ffffff', .9), star(8.5, -8, 1.4, '#fff', .9), bevel('#fff', .25), *halo('#ffe9b0', .5, 3.1)]
add('sunset', 'Sunset', '#ff7a5c', '#4b2288', L)

L = [vgrad(-13, 13, '#47e6f0', '#1a46bd')]
for i, y in enumerate((-5, -0.5, 4, 8.5)):
    pts = [(-14 + k * 3.5, y + (1.2 if k % 2 else -1.2)) for k in range(9)]
    L.append(LN(pts, '#ffffff', 1.1, .55 - i * .07, True))
    L.append(P(pts + [(14, 14), (-14, 14)], '#ffffff', a=.07, smooth=False))
for (x, y, r) in [(-8, 5, 1.3), (-6, 1, .8), (7, -3, 1.1), (9, 6, 1.7), (4, 9, .8), (-9, -6, .9)]:
    L.append(C(x, y, r, 'none', stroke='#d5fbff', sw=.5, a=.9)); L.append(C(x - r * .35, y - r * .35, r * .25, '#fff', a=.9))
L += [bevel('#fff', .3), *gloss(.28)]
add('ocean', 'Ocean', '#47e6f0', '#1a46bd', L)

L = [R(x, 0, 3.4, 40, '#ff4f8f', rot=45, a=.95) for x in range(-24, 25, 7)]
L += [R(x, 0, 3.4, 40, '#ff4f8f', rot=45, a=.0) for x in ()]
L += [bevel('#fff', .55), *gloss(.45), shade(.15)]
add('candy', 'Candy', '#ffffff', '#ffd6e6', L)

rng = random.Random(11); L = []
for col, n in (('#4d6a33', 7), ('#a6bc7b', 6), ('#35481f', 5), ('#8aa05e', 4)):
    for _ in range(n): L.append(P(blob(rng, rng.uniform(-10, 10), rng.uniform(-10, 10), rng.uniform(2.6, 5), rng.uniform(1.8, 3.6), 8, .35), col, smooth=True, a=.95))
L += [bevel('#fff', .15), *gloss(.15), shade(.28)]
add('camo', 'Camo', '#728f52', '#53703a', L)

dk = '#24100a'
def stripe(x, y, ln, th=1.5, side=-1, bend=0.9):
    sx = side * 12.6
    return P([(sx, y - th), (sx - side * ln * .5, y - th * .6 + bend * .5), (sx - side * ln, y + bend), (sx - side * ln * .5, y + th * .5 + bend * .3), (sx, y + th)], dk, smooth=False)
L = [E(0, 10.5, 8, 4, '#fff1d9', a=.92), E(-8.2, 3.6, 3.4, 2.6, '#fff1d9', rot=-20, a=.9), E(8.2, 3.6, 3.4, 2.6, '#fff1d9', rot=20, a=.9)]
for y, ln in ((-9.5, 8), (-5.5, 6), (-1.4, 4.6), (2.6, 4), (6.4, 6), (10, 6)): L.append(stripe(0, y, ln, 1.5, -1)); L.append(stripe(0, y, ln, 1.5, 1))
L += [P([(-1.6, -12.5), (-.6, -7.5), (0, -6.2), (.6, -7.5), (1.6, -12.5)], dk), P([(-5.2, -12.5), (-4.2, -9.2), (-3.4, -12.5)], dk), P([(5.2, -12.5), (4.2, -9.2), (3.4, -12.5)], dk),
      E(0, 8.2, 2, 1.3, '#ff9fb0', a=.9), bevel('#fff', .22), *gloss(.25)]
add('tiger', 'Tiger', '#ffb44e', '#ef6d0e', L)

L = []
for i in range(6):
    for j in range(6):
        if (i + j) % 2 == 0: L.append(R(-10 + i * 4, -10 + j * 4, 4.02, 4.02, '#13161c'))
L += [R(0, 0, 40, 6, '#ffffff', rot=45, a=.16), bevel('#fff', .5), *gloss(.3)]
add('checker', 'Finish Line', '#ffffff', '#dce3ee', L)

rng = random.Random(7)
crack = lambda pts, w: [LN(pts, '#ff3b0f', w * 2.4, .45), LN(pts, '#ff8a1c', w * 1.2, 1), LN(pts, '#fff0a0', w * .45, 1)]
L = [vgrad(2, 13, 'rgba(255,90,20,0)', 'rgba(255,100,20,.75)')]
for pts, w in [([(-12, -9), (-8, -7), (-6, -3.5), (-9, 0), (-7, 4), (-10, 9), (-11, 12)], 1), ([(-6, -3.5), (-2, -5), (1, -9), (0, -12.5)], .8), ([(12, -8), (8, -6), (9, -2), (5.5, 2), (7, 6), (4, 9), (5, 12.5)], 1),
               ([(5.5, 2), (1, 3.5), (-2, 7), (-4, 12.5)], .9), ([(-2, 7), (1, 9), (1.5, 12.5)], .6)]:
    L += crack(pts, w)
for (x, y, r) in [(-3, 5.5, 1.2), (9, 10, 1), (-9, 6, .8), (3, -3, 1)]: L.append(C(x, y, r, '#ffd24a', a=.9))
L += [bevel('#ff9a4a', .35), *halo('#ffcf7a', .75, 3.5)]
add('lava', 'Magma', '#3c120b', '#1c0705', L)

rng = random.Random(21)
L = [E(2, -1, 15, 5.2, '#ff5fc8', rot=-30, a=.32), E(-3, 4, 12, 4, '#4fd8ff', rot=-35, a=.24), E(5, 6, 8, 3, '#b06bff', rot=-20, a=.3)]
for _ in range(34): L.append(C(rng.uniform(-11.5, 11.5), rng.uniform(-11.5, 11.5), rng.choice([.28, .35, .45, .55, .7]), '#ffffff', a=rng.uniform(.5, 1)))
L += [star(-8, -8, 1.8, '#ffffff', .95), star(8, 8.5, 1.5, '#fff', .9), star(9, -6.5, 1.1, '#cfe9ff', .9), star(-9.5, 6.5, 1.2, '#ffd6f3', .9), bevel('#b9a6ff', .3), *halo('#cbb8ff', .45, 3.5)]
add('galaxy', 'Galaxy', '#2a1668', '#0f0a33', L)

L = [vgrad(-13, .6, '#f5f9ff', '#8ea3c8'), vgrad(.6, 13, '#58617a', '#1d2233'), R(0, .6, 26, .9, '#2a3042'),
     P([(-12.5, 12.5), (-12.5, 6), (-2, 12.5)], '#fff', a=.1), P([(2, -12.5), (6, -12.5), (-6, 12.5), (-10, 12.5)], '#ffffff', a=.62), P([(8, -12.5), (9.4, -12.5), (-2.6, 12.5), (-4, 12.5)], '#ffffff', a=.4),
     star(8.5, -8.5, 1.9, '#ffffff', .95), star(-8.5, 8, 1.1, '#fff', .8), bevel('#fff', .5)]
add('chrome', 'Chrome', '#eef2f8', '#8a93a8', L)

L = [vgrad(-13, .6, '#fff3b4', '#f2b52b'), vgrad(.6, 13, '#c58512', '#6d4408'), R(0, .6, 26, .9, '#7a4d0a')]
for k in range(3): L.append(LN([(-9, 5.6 + k * 2.6), (0, 8.4 + k * 2.6), (9, 5.6 + k * 2.6)], '#fff0a8', .9, .6))
L += [P([(2, -12.5), (6, -12.5), (-6, 12.5), (-10, 12.5)], '#ffffff', a=.5), P([(8, -12.5), (9.4, -12.5), (-2.6, 12.5), (-4, 12.5)], '#ffffff', a=.35),
      star(8.5, -8.5, 2, '#ffffff', .95), star(-9, 9, 1.2, '#fff', .85), star(-9.5, -3, .9, '#fff', .8), bevel('#fff6c9', .6), *halo('#ffe9a0', .0, 3)]
add('gold', 'Gold Rush', '#ffe58a', '#c78a14', L)

L = []
for i in range(6):
    for j in range(6):
        L.append(R(-10 + i * 4, -10 + j * 4, 3.7, 3.7, '#46586a' if (i + j) % 2 == 0 else '#10151d', r=.5, a=.9))
L += [R(-9.5, 9.5, 18, 1.6, '#ff2f45', rot=-45), R(-9.5, 9.5, 18, .5, '#ffffff', rot=-45, a=.8), R(-6.2, 12.8, 18, .8, '#ff2f45', rot=-45, a=.7),
      bevel('#9bb0c4', .4), *gloss(.38), shade(.3), *halo('#ffffff', .6, 3.1)]
add('carbon', 'Carbon Apex', '#27323f', '#10151d', L)

L = [LN([(-13, 10), (-6, 5), (-1, 1), (5, -3), (13, -9)], '#7a4a2a', 1.3, smooth=True), LN([(-3, 3), (-5, 7)], '#7a4a2a', .8), LN([(4, -2), (7, 1)], '#7a4a2a', .8)]
def flower(x, y, s=1, rot=0):
    out = []
    for i in range(5):
        ang = math.radians(i * 72 + rot); out.append(E(x + math.cos(ang) * 1.9 * s, y + math.sin(ang) * 1.9 * s, 1.9 * s, 1.35 * s, '#fff3f8', rot=i * 72 + rot, stroke='#e8648f', sw=.35, a=.97))
    out.append(C(x, y, .8 * s, '#e8648f')); return out
for (x, y, s, r) in [(-8, 6.5, 1.35, 10), (-1, 1.5, 1.2, 40), (6, -3, 1.45, 5), (-6, -6, .95, 20), (9, 7, 1.05, 30)]: L += flower(x, y, s, r)
rng = random.Random(3)
for _ in range(9): L.append(E(rng.uniform(-11, 11), rng.uniform(-11, 11), 1, .6, '#ffe2ec', rot=rng.randint(0, 180), a=.85))
L += [bevel('#fff', .4), *gloss(.3)]
add('sakura', 'Sakura Drift', '#ffc2da', '#f46d9f', L)

L = [E(-3, -11, 9, 4, '#7ba7a8', a=.9), E(5, -11.5, 8, 3.6, '#5f8d90', a=.9), E(-8, -12, 6, 3.3, '#8fb9ba', a=.9)]
rng = random.Random(5)
for i in range(16):
    x = -12 + i * 1.7 + rng.uniform(-.3, .3); y = rng.uniform(-8, 6); L.append(LN([(x, y), (x - 1.4, y + 3.2)], '#cffff3', .6, .55))
L += [P([(2.5, -3), (6.6, -3), (4.6, 2.2), (7.4, 2.2), (1.8, 10), (3.2, 3.8), (.6, 3.8)], '#fff6a8', stroke='#ffd84a', sw=.4, a=.97),
      E(-6, 10.4, 4.6, 1.2, 'none', stroke='#b8fff0', sw=.6, a=.7), E(-6, 10.4, 2.4, .6, 'none', stroke='#b8fff0', sw=.5, a=.7), E(8, 11, 3, .8, 'none', stroke='#b8fff0', sw=.5, a=.5),
      bevel('#6af0d4', .4), *halo('#9bffe6', .6, 3.5)]
add('monsoon', 'Monsoon Jade', '#0d5a5c', '#042b31', L)

L = [P([(-12.5, -12.5), (-2, -12.5), (-6, -3), (-12.5, 2)], '#ffffff', a=.5), P([(12.5, -12.5), (4, -12.5), (7, -4), (12.5, -1)], '#ffffff', a=.4),
     P([(-12.5, 12.5), (-12.5, 2), (-6, -3), (0, 4), (-3, 12.5)], '#2d7fc4', a=.3), P([(12.5, 12.5), (12.5, -1), (7, -4), (3, 4), (4, 12.5)], '#ffffff', a=.25), P([(0, 4), (3, 4), (4, 12.5), (-3, 12.5)], '#1f5fa5', a=.3),
     LN([(-6, -3), (-1, 1), (0, 4)], '#ffffff', .8, .9), LN([(7, -4), (4, 0), (3, 4)], '#ffffff', .8, .9), LN([(-1, 1), (3, 4)], '#ffffff', .6, .8),
     P([(-12.5, -12.5), (12.5, -12.5), (12.5, -9.5), (10, -8), (8.5, -10.5), (5, -8.2), (3.5, -10.8), (-1, -8), (-4, -10.6), (-8, -7.8), (-10, -10), (-12.5, -8.5)], '#ffffff', smooth=True, a=.95),
     star(8.5, 6.5, 1.6, '#fff', .95), star(-8, 7.5, 1.1, '#fff', .9), bevel('#fff', .5), *gloss(.28)]
add('glacier', 'Glacier Core', '#dcf7ff', '#6cb6e6', L)

nc = '#22e6a0'
trace = lambda pts, w=.9: [LN(pts, nc, w * 2.6, .25), LN(pts, nc, w, 1)]
L = []
for pts in ([(-12.5, -8), (-9, -8), (-9, -4), (-6.5, -4)], [(-12.5, 8), (-8, 8), (-8, 5), (-5.6, 5)], [(-12.5, 0), (-10, 0), (-10, 2.5)], [(-9, -8), (-9, -11), (-4, -11), (-4, -12.5)], [(-3, 6.5), (-3, 9.5), (-6, 9.5), (-6, 12.5)]):
    L += mirror(trace(pts))
L += [R(0, 6, 8, 5, '#06161a', r=1, stroke=nc, sw=.7), R(0, 6, 4.4, 2.2, nc, a=.35), *[R(x, 3, .8, 1.4, nc) for x in (-3, -1, 1, 3)], *[R(x, 9, .8, 1.4, nc) for x in (-3, -1, 1, 3)],
      *mirror([C(-12.2, -8, 1, '#fff27a'), C(-6.6, -4, .9, '#fff27a'), C(-5.6, 5, .9, '#fff27a'), C(-10, 2.6, .8, nc)]), bevel(nc, .45), *halo('#8dffd0', .55, 3.5)]
add('circuit', 'Circuit Saint', '#0a3a33', '#04171a', L)

L = [C(0, 0, 11, '#c14d91', a=.14), C(0, 0, 9.5, '#ffb3ff', a=.2), C(0, 0, 8.6, 'none', stroke='#ffe3ff', sw=1.1, a=.9), C(0, 0, 8.6, 'none', stroke='#ff7ad1', sw=2.4, a=.35),
     P(sector(0, 0, 8.2, 9.4, -80, 10, 12), '#fff7c2', a=.95), C(0, 0, 8, '#050309'), C(1.2, -1, 8, '#050309'), P(sector(0, 0, 8.5, 9.6, -75, -10, 10), '#ffffff', a=.7)]
rng = random.Random(8)
for _ in range(10): L.append(C(rng.choice([-1, 1]) * rng.uniform(8, 12), rng.uniform(-12, 12), rng.choice([.3, .4, .5]), '#ffffff', a=.8))
L += [star(9, -9, 1.2, '#fff', .9), bevel('#d6a3ff', .35), *halo('#f3d5ff', .85, 3.4)]
add('eclipse', 'Black Eclipse', '#1e0f33', '#08050f', L)

L = [vgrad(-2, 13, 'rgba(255,120,30,0)', 'rgba(255,150,40,.85)'), C(0, 13, 10, '#ffd36a', a=.5),
     P([(-8.5, 5), (8.5, 5), (8.5, 6.6), (4.5, 7.6), (3.8, 11), (7, 12.5), (-7, 12.5), (-3.8, 11), (-4.5, 7.6), (-8.5, 6.6)], '#1a0a14', fill2='#3a1a2a'), LN([(-8.2, 5.3), (8.2, 5.3)], '#ffd8a0', .6, .9)]
for ang in (-70, -40, -105, -140, -12):
    a2 = math.radians(ang); L.append(LN([(math.cos(a2) * 3 - 3, 3.5 + math.sin(a2) * 3), (math.cos(a2) * 10 - 3, 3.5 + math.sin(a2) * 10)], '#ffcf5e', .8, .85))
L += [star(-7.5, -6.5, 1.4, '#ffe596', .95), star(6, -9, 1.1, '#ffe596', .9), star(9.5, -3, 1, '#ffb25e', .9), C(-10, -2, .5, '#ffd36a'), C(4, -5, .5, '#ffd36a'), C(-3, -10, .45, '#fff1c0'),
      bevel('#ff9a4a', .45), *halo('#ffd9a0', .55, 3.5)]
add('starforge', 'Starforge', '#4a1636', '#14060f', L)

L = [R(0, -9, 26, 14, '#2a8cff', a=.12), *[LN([(x, -13), (x + 4, 13)], '#7dd8ff', 1.2, .08) for x in (-8, -2, 4)],
     E(1, -3.4, 7.2, 5.2, '#7efcff', fill2='#2f7fff', a=.82), E(1, -3.4, 7.2, 5.2, 'none', stroke='#d8ffff', sw=.7, a=.9), E(-1.2, -5.4, 3, 1.4, '#ffffff', rot=-25, a=.6)]
for x, ln in ((-4, 6.5), (-1.5, 8.5), (1, 6), (3.5, 8), (6, 6.5)): L.append(LN([(x, 1), (x + 1.2, 1 + ln * .45), (x - .8, 1 + ln * .8), (x + .6, 1 + ln)], '#8ffcff', .8, .85, True))
rng = random.Random(9)
for _ in range(14): L.append(C(rng.uniform(-11, 11), rng.uniform(-11, 11), rng.choice([.35, .5, .65]), rng.choice(['#8ffcff', '#c3a8ff', '#ffffff']), a=.85))
L += [bevel('#56c6ff', .4), *halo('#a8f3ff', .35, 3.4)]
add('deepsea', 'Abyssal Bloom', '#0e3a82', '#030d26', L)

# ======================= NEW SKINS =======================
trix_layers = [{"t":"poly","fill":"#ffcf3f","stroke":"#ffcf3f","sw":1.2,"pts":[[0,-11],[1.41,-1.94],[10,-10.5],[2.28,0.74],[1.5,1.5],[0,11],[-1.5,1.5],[-2.28,0.74],[-10,-10.5],[-1.41,-1.94]],"smooth":False,"alpha":0.8}]
add('c-trix', 'Trix', '#a073c4', '#543285', trix_layers, 1500, 'epic')

L = [vgrad(-13, 13, '#1b0a3d', '#4a1070'), C(0, -2.2, 8, '#ffe66b', fill2='#ff2e93'), *[R(0, -.8 + i * 1.5, 18, .4 + i * .2, '#2b0d52', a=.9) for i in range(1, 5)],
     R(0, 8.5, 26, 9, '#1b0a3d', fill2='#3b0e66'), LN([(-13, 4.6), (13, 4.6)], '#52f2ff', .9)]
for yy in (6.4, 8.4, 10.8, 13.4): L.append(LN([(-13, yy), (13, yy)], '#ff4fd8', .5, .8))
for xx in (-14, -9, -5, -2, 0, 2, 5, 9, 14): L.append(LN([(xx * .25, 4.6), (xx * 1.5, 13)], '#52f2ff', .5, .75))
L += [bevel('#ff4fd8', .5), *halo('#ffd0f6', .6, 3.4)]
add('c-synthwave', 'Synthwave', '#4a1070', '#1b0a3d', L, 1900, 'epic')

rng = random.Random(31)
L = [P(blob(rng, -4, -6, 8, 5, 9, .2), '#ff6a1f', smooth=True), P(blob(rng, 7, 3, 7, 6, 9, .2), '#ff6a1f', smooth=True), P(blob(rng, -7, 8, 5, 3.6, 8, .2), '#ff6a1f', smooth=True),
     P(blob(rng, 5, -8, 3.4, 2.4, 8, .2), '#e0301e', smooth=True), P(blob(rng, -3, 9, 2.6, 2, 8, .2), '#e0301e', smooth=True), P(blob(rng, 10, 9, 2.2, 1.8, 8, .2), '#171717', smooth=True), P(blob(rng, -9, -1, 2.4, 1.8, 8, .2), '#171717', smooth=True), P(blob(rng, 1, 5, 1.6, 1.3, 8, .2), '#171717', smooth=True),
     *halo('#fffaf2', .96, 3.6, True), bevel('#fff', .5), *gloss(.45), shade(.12)]
add('c-koi', 'Koi', '#fffaf2', '#ffe5cb', L, 900, 'rare')

L = []
for k, x in enumerate((-10.5, -7, -3.5, 0, 3.5, 7, 10.5)):
    s = 1 if k % 2 else -1
    L.append(LN([(x, -13), (x + 1.4 * s, -6), (x - 1.4 * s, 1), (x + 1.2 * s, 8), (x, 13)], '#14141a', 1.9 if k % 2 == 0 else 1.5, smooth=True))
L += [*halo('#ffffff', .96, 3.7, True), bevel('#fff', .5), *gloss(.3), shade(.18)]
add('c-zebra', 'Zebra', '#ffffff', '#e5e8ee', L, 800, 'rare')

rng = random.Random(41)
L = [P(blob(rng, -6, -7, 5.5, 3.6, 9, .3), '#1b1b1f', smooth=True), P(blob(rng, 8, -3, 4.4, 5, 9, .3), '#1b1b1f', smooth=True), P(blob(rng, -7, 6, 4, 4.4, 9, .3), '#1b1b1f', smooth=True), P(blob(rng, 6, 9, 5, 3, 9, .3), '#1b1b1f', smooth=True),
     E(0, 10.6, 6, 3.4, '#ffb3c4', a=.9), C(-2, 10.4, .7, '#b34a62'), C(2, 10.4, .7, '#b34a62'), *halo('#ffffff', .96, 3.6, True), bevel('#fff', .5), *gloss(.3), shade(.15)]
add('c-cow', 'Cow', '#ffffff', '#e8ecf4', L, 750, 'rare')

L = [P([(-9, -12.5), (-6.5, -9), (-4, -12.5), (-1.6, -9.2), (0, -12.5), (1.6, -9.2), (4, -12.5), (6.5, -9), (9, -12.5), (10, -8), (-10, -8)], '#3fbf4a', stroke='#1f7a2a', sw=.6, fill2='#2a9a38')]
rng = random.Random(6)
for yy in range(-6, 12, 4):
    for xx in range(-10 + (2 if (yy // 4) % 2 else 0), 12, 4): L.append(E(xx, yy, .5, .85, '#ffe58a', rot=rng.randint(-15, 15), a=.95))
L += [bevel('#fff', .3), *gloss(.38), shade(.28)]
add('c-strawberry', 'Strawberry', '#ff5666', '#bf1230', L, 700, 'rare')

L = [R(0, 0, 21, 21, '#ff5a6e', fill2='#e11d48', r=3.5, stroke='#f4ffe0', sw=1.4)]
for xx, yy in ((-5.5, -5), (0, -7.5), (5.5, -5), (-7.5, 1.5), (7.5, 1.5), (-4, 5), (4, 5), (0, 8)): L.append(E(xx, yy, .6, 1.1, '#1a1a1a', rot=((xx > 0) - (xx < 0)) * 20))
L += [bevel('#fff', .3), *gloss(.3), shade(.2)]
add('c-melon', 'Watermelon', '#56cf58', '#237f35', L, 700, 'rare')

L = [LN([(x, -11), (x * 1.5, 0), (x, 11)], '#a84300', 1, .8, True) for x in (-7, -3.5, 0, 3.5, 7)]
L += [R(0, -11.5, 2.6, 3.6, '#5a8a2a', r=.8, stroke='#2e4d12', sw=.6), LN([(1.2, -11), (4, -12.5), (6, -10.5)], '#3d7a1a', .8, smooth=True), bevel('#fff', .3), *gloss(.35), shade(.25)]
add('c-pumpkin', 'Pumpkin', '#ffa724', '#e06500', L, 350, 'common')

rng = random.Random(51); L = []
for (x, y, r) in [(-8, -6, 3), (8, 6, 3.4), (7, -8, 1.6), (-9, 7, 1.7), (-2, 9, 1.2), (10, -2, 1.1), (-11, 0, .9)]:
    L += [C(x, y, r, '#ffffff', a=.16, stroke='#fff', sw=.6), C(x - r * .3, y - r * .3, r * .22, '#fff', a=.95)]
L += [bevel('#fff', .5), *gloss(.55), shade(.18)]
add('c-bubblegum', 'Bubblegum', '#ffa6dc', '#ff58b4', L, 300, 'common')

L = [R(x, 0, 3.8, 44, '#15151a', rot=45) for x in range(-28, 29, 8)] + [*halo('#ffd800', .97, 3.7, True), R(0, 0, 25.5, 25.5, 'none', r=3, stroke='#15151a', sw=1.5), bevel('#fff', .35), *gloss(.25), shade(.2)]
add('c-hazard', 'Hazard', '#ffd800', '#ffb400', L, 400, 'common')

L = [R(0, 0, 4.4, 26, '#ffffff'), R(-3.1, 0, .9, 26, '#2f7bff'), R(3.1, 0, .9, 26, '#2f7bff')]
for i in range(13): L += [R(-11.4 + i * 1.9, 11.4, 1, 1.3, '#101010'), R(-11.4 + i * 1.9 + .95, 10.1, 1, 1.3, '#101010'), R(-11.4 + i * 1.9 + .95, 11.4 + 1.3, 0.01, 0.01, '#fff', a=0)]
L += [P([(4, -12.5), (12.5, -12.5), (12.5, -6), (9.5, -9)], '#ffffff', a=.0), bevel('#fff', .35), *gloss(.38), shade(.22)]
add('c-racer', 'Racer', '#ff4040', '#a10019', L, 900, 'rare')

L = [vgrad(-13, 13, '#f2ff3a', '#9cc900')]
for a0 in (-90, 30, 150): L.append(P(sector(0, 6.6, 1.6, 6, a0 + 90 - 28, a0 + 90 + 28, 8) if False else sector(0, 6.6, 1.9, 5.8, a0 + 60, a0 + 120, 8), '#111111'))
L += [C(0, 6.6, 1.2, '#111'), C(0, 6.6, 6.2, 'none', stroke='#111', sw=.7), R(0, -11.2, 26, 3.2, '#111'), R(0, 12, 26, 3, '#111'), bevel('#fff', .4), *gloss(.3)]
for L_ in L: pass
add('c-radio', 'Radioactive', '#f2ff3a', '#9cc900', L, 1500, 'epic')

L = []
for i, (cx, col) in enumerate([(-10, '#e8a00a'), (-4, '#ffbd1f'), (2, '#e8a00a'), (8, '#ffbd1f')]): pass
rows = [(-9, -9), (-9, 9)]
L = []
for ri, yy in enumerate((-9.5, -5.2, -.9, 3.4, 7.7, 12)):
    for xx in range(-12 + (0 if ri % 2 == 0 else 4), 15, 8):
        L.append(P(hexpts(xx, yy, 4.6, 30), '#ffd04a' if (ri + xx) % 3 else '#ffb21c', stroke='#a85d00', sw=.8, fill2='#ffa41a', a=.97))
L += [bevel('#fff', .35), *gloss(.3), shade(.25)]
add('c-hive', 'Hive', '#ffcd3c', '#e8930f', L, 1400, 'epic')

L = []
for r, col in ((18, '#ff5ca8'), (15, '#ffd24a'), (12, '#4fe0b6'), (9, '#5b8def'), (6.2, '#b06bff'), (3.4, '#ff5ca8'), (1.4, '#ffffff')): L.append(E(1.5, 2, r, r * .92, col, a=.95))
L += [bevel('#fff', .4), *gloss(.3), shade(.1)]
add('c-tiedye', 'Tie-Dye', '#ffffff', '#f3e7ff', L, 1300, 'epic')

rng = random.Random(61); L = []
for (x, y, s) in [(-8, -7, 1), (2, -8, .9), (9, -3, 1), (-5, 1, 1.05), (5, 4, 1), (-9, 8, .95), (1, 9, 1), (10, 10, .8)]:
    L.append(E(x, y, 2.7 * s, 2.3 * s, '#c47a18', rot=rng.randint(0, 170), a=.9)); L.append(E(x, y, 2.7 * s, 2.3 * s, 'none', rot=0, stroke='#24120a', sw=1.1)); L.append(C(x + .2, y, 1 * s, '#f1b04c'))
L += [bevel('#fff', .3), *gloss(.3), shade(.2)]
add('c-leopard', 'Leopard', '#f4b84e', '#d4861a', L, 1500, 'epic')

rng = random.Random(71); L = []
for xx in (-10.5, -7.5, -4.5, -1.5, 1.5, 4.5, 7.5, 10.5):
    y0 = rng.uniform(-12, -4); L.append(LN([(xx, y0), (xx, y0 + rng.uniform(8, 20))], '#0aff62', .55, .5)); n = 3
    for k in range(n): L.append(R(xx, y0 + k * 2.6 + rng.uniform(0, 1.5), .9, 1.5, '#7dff9f' if k else '#eafff0', a=.9 - k * .2))
L += [bevel('#0aff62', .5), *halo('#8dffb0', .6, 3.6)]
add('c-matrix', 'Matrix', '#03200c', '#010a04', L, 1700, 'epic')

cols = ['#ff4f6d', '#ff9a3d', '#ffe45e', '#5be88a', '#4fd8ff', '#7c6bff', '#d65bff']
L = [R(-30 + i * 5.2 + 3, 0, 5.4, 60, cols[i % 7], rot=40, a=.95) for i in range(12)]
L += [P([(-12.5, -12.5), (0, -12.5), (-12.5, 0)], '#fff', a=.35), P([(6, -12.5), (12.5, -12.5), (-12.5, 12.5), (-12.5, 6)], '#ffffff', a=.18), bevel('#fff', .55), *gloss(.45), shade(.15)]
add('c-prism', 'Prism', '#ffffff', '#cfd8ff', L, 2800, 'legendary')

L = [R(0, 0, 40, 1.2, '#ffffff', rot=45, a=.12), R(-6, 4, 40, 3, '#ffffff', rot=45, a=.07)]
for pts in ([(-12, -6), (-7, -4), (-4, 1), (-6, 6), (-3, 12)], [(12, -9), (7, -6), (6, -1), (9, 4), (6, 9), (8, 12.5)], [(-4, 1), (1, 3), (4, 6)], [(6, -1), (2, -3), (0, -8), (3, -12.5)]):
    L += [LN(pts, '#9b5cff', 3.2, .22, True), LN(pts, '#c89bff', 1.2, .9, True), LN(pts, '#ffffff', .4, .9, True)]
L += [bevel('#b57bff', .5), *gloss(.25), *halo('#d3b3ff', .7, 3.5)]
add('c-obsidian', 'Obsidian', '#1d1236', '#07050e', L, 3200, 'legendary')

L = [R(0, 0, 22.5, 22.5, 'none', r=3, stroke='#ffd45e', sw=1.3), R(0, 0, 20, 20, 'none', r=2.4, stroke='#ffd45e', sw=.5, a=.7)]
for (x, y) in ((-10, -10), (10, -10), (-10, 10), (10, 10)): L.append(P([(x, y - 2), (x + 2, y), (x, y + 2), (x - 2, y)], '#ffd45e', stroke='#8a5a00', sw=.4))
L += [P([(0, 3.4), (3, 6.5), (0, 11), (-3, 6.5)], '#ff3d6e', stroke='#ffd45e', sw=.9, fill2='#b3103c'), P([(-7, 11.5), (-5, 8), (-3.4, 11.5)], '#ffd45e', a=.9), P([(7, 11.5), (5, 8), (3.4, 11.5)], '#ffd45e', a=.9),
      R(0, -10.6, 12, 1, '#ffd45e'), *[C(x, -10.6, .8, '#ffd45e') for x in (-7, 0, 7)], bevel('#fff', .3), *gloss(.3), *halo('#ffe9a8', .8, 3.3)]
add('c-royal', 'Royal', '#6a35b4', '#2a1062', L, 3500, 'legendary')

L = [vgrad(-13, 13, '#ff8cd0', '#9a7bff')]
heart = [[0,1],[0,1],[1,0],[2,0],[3,1],[3,2],[2,3],[1,4],[0,5]]
px = 1.5; ox, oy = -5, 1
grid = ["01100110", "11111111", "11111111", "11111111", "01111110", "00111100", "00011000"]
for j, row in enumerate(grid):
    for i, ch in enumerate(row):
        if ch == '1': L.append(R(-6 + i * 1.5 + .75, 1.4 + j * 1.5 + .75, 1.52, 1.52, '#ff2f5e' if j > 0 or True else '#fff'))
L += [R(-6 + 1.5 * 1.5 + .75, 1.4 + 1 * 1.5 + .75, 1.52, 1.52, '#ffb3c7'), R(-6 + 1.5 * 1.5 + .75, 1.4 + 1 * 1.5 + .75 + 1.5, 1.52, 1.52, '#ffb3c7', a=.0), bevel('#fff', .4), shade(.15)]
add('c-pixel', 'Pixel Heart', '#ff8cd0', '#9a7bff', L, 700, 'rare')

L = [P([(-12.5, -12.5), (-4, -12.5), (-12.5, 2)], '#ffffff', a=.14)]
L += [P([(3, -12), (-6, 1.5), (-1.2, 1.5), (-5, 12.5), (7, -2.6), (1.4, -2.6), (7.5, -12)], '#111111', fill2='#2a2a2a'), LN([(-2, -5), (-4, -3), (-3, -1)], '#111', 1, smooth=False, a=0),
      LN([(8, 2), (10, 4), (9, 6), (11, 8.4)], '#111111', 1.1), LN([(-9, -8), (-10.5, -6), (-9, -4)], '#111111', 1, a=.9), *halo('#ffeb2e', .95, 3.6, True), bevel('#fff', .5), *gloss(.4), shade(.15)]
add('c-voltage', 'Voltage', '#ffeb2e', '#ffb300', L, 450, 'common')

L = []
for (x, y, r) in [(-8, 5, 2), (8, 3, 1.6), (4, 9, 1.3), (-3, 8.5, 1.1), (9, -7, 1.3), (-9, -8, 1.2)]: L += [C(x, y, r, '#2c8f3a', a=.9), C(x - r * .3, y - r * .3, r * .3, '#8de08d', a=.9)]
L += [E(0, 10.5, 8.6, 3.6, '#f4ffd8', a=.95), *halo('#fff04d', .98, 3.7), bevel('#fff', .35), *gloss(.3)]
add('c-frog', 'Tree Frog', '#54d65b', '#1f8a35', L, 400, 'common')

L = [P([(-12.5, 12.5), (-12.5, 8), (-5, 4), (0, 6), (6, 1), (12.5, 3), (12.5, 12.5)], '#c9d6ee', smooth=True, a=.5), E(0, 10, 11, 4.5, '#ffffff', a=.3), E(-6.8, 2.6, 2.1, 1.3, '#ff9fb8', a=.8), E(6.8, 2.6, 2.1, 1.3, '#ff9fb8', a=.8),
     star(-8.5, -8.5, 1.1, '#9fb7ff', .9), star(8.5, -8, .9, '#9fb7ff', .8), star(9.5, 8, .8, '#cfe0ff', .9), bevel('#9fb4e8', .5), *gloss(.45), shade(.1)]
add('c-spectre', 'Spectre', '#f6f9ff', '#c4d1ee', L, 950, 'rare')

L = [R(0, 0, 26, 26, '#9aa4b8', fill2='#68728a')]
L += [R(0, -8.2, 24, .6, '#2a3040'), R(0, 8.2, 24, .6, '#2a3040'), R(-6.2, 0, .6, 26, '#2a3040', a=.7), R(6.2, 0, .6, 26, '#2a3040', a=.7), R(0, 10.4, 12, 3, '#222836', r=.8)]
for k in range(5): L.append(R(-4 + k * 2, 10.4, .6, 2, '#6d788f'))
for (x, y) in ((-10, -10), (10, -10), (-10, 10), (10, 10)): L += [C(x, y, .9, '#c9d1e3', stroke='#2a3040', sw=.4), C(x - .2, y - .2, .25, '#fff')]
L += [R(0, -9.9, 10, 1.2, '#ff2f45', r=.6), R(0, -9.9, 6, .5, '#ffb3bb', a=.8), P([(10.2, -4.8), (12.5, -4.8), (12.5, 1), (10.2, 3)], '#4a5368'), bevel('#e8eef7', .4), *gloss(.35), shade(.28), *halo('#dfe8f5', .8, 3.5)]
add('c-robot', 'Mecha', '#a6b0c4', '#68728a', L, 1500, 'epic')

L = [R(x, 0, 2.6, 26, 'rgba(0,0,0,.28)') for x in (-8, 3)] + [R(0, y, 26, 2.6, 'rgba(0,0,0,.28)') for y in (-7, 5)] + [R(x, 0, .6, 26, '#ffe56a', a=.8) for x in (-4.4,)] + [R(0, y, 26, .6, '#ffe56a', a=.7) for y in (1.6,)]
L += [R(x, 0, .6, 26, '#ffffff', a=.5) for x in (9,)] + [R(0, y, 26, .6, '#ffffff', a=.45) for y in (-10.4,)] + [bevel('#fff', .3), *gloss(.25), shade(.22)]
add('c-tartan', 'Tartan', '#b8202f', '#7a0f1d', L, 850, 'rare')

L = []
for (x, y, col) in [(-8, -4, '#3ec6c0'), (8, -4, '#3ec6c0'), (0, 4, '#ff6fa3'), (-12, 4, '#ff6fa3'), (12, 4, '#ff6fa3'), (0, -12, '#ff6fa3'), (-8, 12, '#3ec6c0'), (8, 12, '#3ec6c0')]:
    L.append(P([(x, y - 6), (x + 6, y), (x, y + 6), (x - 6, y)], col, a=.95))
L += [R(0, 0, 40, .5, '#ffffff', rot=45, a=.55), R(0, 0, 40, .5, '#ffffff', rot=-45, a=.55), R(8, 8, 40, .5, '#ffffff', rot=45, a=.4), R(-8, 8, 40, .5, '#ffffff', rot=-45, a=.4), R(-8, -8, 40, .5, '#ffffff', rot=45, a=.4), R(8, -8, 40, .5, '#ffffff', rot=-45, a=.4), bevel('#fff', .3), *gloss(.25), shade(.2)]
add('c-argyle', 'Argyle', '#2a2f72', '#171a4a', L, 850, 'rare')

rng = random.Random(81); L = []
cells = []
for i in range(4):
    for j in range(4): cells.append((i, j))
pts_grid = [[(-12.5 + i * 6.25 + (rng.uniform(-1.6, 1.6) if 0 < i < 4 else 0), -12.5 + j * 6.25 + (rng.uniform(-1.6, 1.6) if 0 < j < 4 else 0)) for j in range(5)] for i in range(5)]
pal = ['#ff4f6d', '#ffb12e', '#ffe45e', '#4fd36b', '#33c7ff', '#7c6bff', '#e05bff']
for i in range(4):
    for j in range(4):
        L.append(P([pts_grid[i][j], pts_grid[i + 1][j], pts_grid[i + 1][j + 1], pts_grid[i][j + 1]], rng.choice(pal), stroke='#171320', sw=1.1, fill2=None, a=.95))
L += [P([(-12.5, -12.5), (0, -12.5), (-12.5, 0)], '#fff', a=.25), bevel('#fff', .3), *gloss(.3)]
add('c-glass', 'Stained Glass', '#7c6bff', '#33c7ff', L, 1700, 'epic')

L = [R(0, 0, 26, 26, '#06142e', fill2='#0e2a52')]
for col, pts, w in (('#3dffb0', [(-13, 4), (-7, -2), (-1, -3), (6, -8), (13, -5)], 3.4), ('#7c6bff', [(-13, 9), (-6, 4), (1, 3), (8, -1), (13, 2)], 3), ('#4fd8ff', [(-13, -3), (-6, -8), (2, -9), (9, -12.5)], 2.4)):
    L += [LN(pts, col, w * 1.9, .12, True), LN(pts, col, w, .38, True), LN(pts, '#ffffff', w * .22, .55, True)]
rng = random.Random(15)
for _ in range(16): L.append(C(rng.uniform(-11.5, 11.5), rng.uniform(-11.5, 11.5), rng.choice([.3, .4, .55]), '#ffffff', a=.85))
L += [bevel('#7cf0c8', .35), *halo('#c7ffe9', .55, 3.5)]
add('c-aurora', 'Aurora', '#0e2a52', '#06142e', L, 1800, 'epic')

L = [E(0, 0, 11, 11, 'none', stroke='#ff9db5', sw=2.2, a=.35), E(1.4, 1.6, 10, 9.8, 'none', stroke='#8a0c2c', sw=1.6, a=.35), E(-4.8, -6.4, 7.6, 3.2, '#fff', rot=-28, a=.6), E(-9.4, -2.6, 1.1, 2.3, '#fff', rot=-14, a=.55), C(6.8, 7.8, 1.5, '#ffd0dc', a=.4), C(8.4, 6, .8, '#ffd0dc', a=.4)]
rng = random.Random(25)
for _ in range(18): L.append(C(rng.uniform(-11, 11), rng.uniform(-11, 11), .3, '#fff', a=.55))
L += [shade(.18), bevel('#fff', .45)]
add('c-gummy', 'Gummy', '#ff5878', '#c4113a', L, 1300, 'epic')

L = [R(0, 0, 26, 26, '#3d72ba', fill2='#26497f')]
L += [R(0, y, 26, .5, '#1d3a66', a=.55) for y in range(-10, 12, 4)]
for xx in (-8.4, 8.4):
    for k in range(10): L.append(R(xx, -11 + k * 2.4, .5, 1.2, '#ffcf7a', a=.95))
L += [R(0, 12, 26, .5, '#ffcf7a', a=.0), R(5.2, 7, 7, 5.6, '#c79a62', r=.6, stroke='#7a5528', sw=.5), P([(5.2, 5), (6, 6.8), (7.8, 7), (6.5, 8.2), (6.9, 10), (5.2, 9.1), (3.5, 10), (3.9, 8.2), (2.6, 7), (4.4, 6.8)], '#fff2c4', a=.0),
      star(5.2, 7.2, 1.7, '#fff2c4', .95, n=5, inner=.45), bevel('#8fb8ff', .3), *gloss(.2), shade(.22)]
add('c-denim', 'Denim', '#3f76be', '#25487f', L, 800, 'rare')

def is_dark(s): return False

# ======================= OUTPUT =======================
EXISTING = ['classic','lime','ember','frost','rose','midnight','violet','polka','sunset','ocean','candy','camo','tiger','checker','lava','galaxy','chrome','gold','carbon','sakura','monsoon','glacier','circuit','eclipse','starforge','deepsea']
styles, newskins = {}, []
for id, s in S.items():
    pat = {'k':'grad','a':s['a'],'b':s['b']}
    if id in EXISTING: styles[id] = {'color':s['color'], 'pat':pat, 'layers':s['layers']}
    else: newskins.append({'id':id,'name':s['name'],'color':s['color'],'price':s['price'],'rarity':s['rarity'],'pat':pat,'layers':s['layers']})
compact = lambda o: json.dumps(o, separators=(',', ':'))
open(OUT_STYLES, 'w').write('// Layered art for the built-in skins (applied over SKINS in game.js). Generated; edit freely.\nconst SKIN_STYLES = ' + compact(styles) + ';\n')
import os
cur = {'skins':[],'hats':[],'faces':[],'trails':[]}
if os.path.exists(OUT_CUSTOM):
    t = open(OUT_CUSTOM).read(); cur.update(json.loads(t[t.index('{'):t.rindex('}') + 1]))
cur['skins'] = newskins
open(OUT_CUSTOM, 'w').write('// Cosmetics made with tools/designer.html. Edit them in the tool; this file is rewritten when you press Save.\nconst CUSTOM_COSMETICS = ' + json.dumps(cur, indent=1) + ';\n')
print(len(styles), 'restyled,', len(newskins), 'new')
