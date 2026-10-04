import json, math, os, sys, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cosmlib import *
OUT = 'src/data/premium-cosmetics.js'
DK = '#1a1208'
def A(L, **kw): L.update(kw); return L          # attach animation fields: spin, orbit, pivot, bob{x,y,f,p}, pulse{a,f,p}, rainbow, hue
def HP(pts, fill, **k): k.setdefault('stroke', DK); k.setdefault('sw', 1.1); return P(pts, fill, **k)
def HE(x, y, rx, ry, fill, **k): k.setdefault('stroke', DK); k.setdefault('sw', 1.1); return E(x, y, rx, ry, fill, **k)
def HC(x, y, r, fill, **k): return HE(x, y, r, r, fill, **k)
def HR(x, y, w, h, fill, **k): k.setdefault('stroke', DK); k.setdefault('sw', 1.1); return R(x, y, w, h, fill, **k)
def scaled(layers, f, cy=-12):
    out = json.loads(json.dumps(layers))
    for L in out:
        if L['t'] == 'poly': L['pts'] = [[round(x * f, 2), round(cy + (y - cy) * f, 2)] for x, y in L['pts']]
        else:
            L['x'] = round(L['x'] * f, 2); L['y'] = round(cy + (L['y'] - cy) * f, 2)
            for k in ('rx', 'ry', 'w', 'h'):
                if k in L: L[k] = round(L[k] * f, 2)
        if L.get('pivot'): L['pivot'] = [round(L['pivot'][0] * f, 2), round(cy + (L['pivot'][1] - cy) * f, 2)]
        if L.get('sw'): L['sw'] = round(L['sw'] * max(1, f * .85), 2)
        if L.get('bob'): L['bob'] = dict(L['bob'], x=L['bob']['x'] * f, y=L['bob']['y'] * f)
    return out
def pb(x=0, y=0, f=1, p=0): return {'x':x, 'y':y, 'f':f, 'p':p}
def pu(a=.4, f=1, p=0): return {'a':a, 'f':f, 'p':p}

S, Hh, F, T = [], [], [], []
def skin(id, name, a, b, layers, gems, exclusive=False): S.append(dict(id=id, name=name, color=a, pat={'k':'grad', 'a':a, 'b':b}, layers=layers, gemPrice=gems, exclusive=exclusive or None))
def hat(id, name, layers, gems): Hh.append(dict(id=id, name=name, layers=layers, gemPrice=gems))
def face(id, name, layers, gems): F.append(dict(id=id, name=name, layers=layers, gemPrice=gems))
def trail(id, name, fx, gems, color): T.append(dict(id=id, name=name, color=color, style='fx', fx=fx, gemPrice=gems))
G = lambda **k: k

# ================= SKINS =================
L = [A(E(0, 0, 18, 18, '#ff7a1f', a=.25), pulse=pu(.55, .55))]
L += [A(R(0, 0, 42, 2.4, '#ffb347', rot=i * 22.5, a=.5), spin=16) for i in range(8)]
L += [A(R(0, 0, 42, 1.1, '#fff0b0', rot=i * 30 + 15, a=.75), spin=-24) for i in range(6)]
L += [A(C(0, 0, 8.4, '#ff5a1f', a=.6), pulse=pu(.4, .8)), A(C(0, 0, 5.4, '#ffd24a', fill2='#ff7a1f'), pulse=pu(.25, 1.3, 1)), A(C(0, 0, 3, '#ffffff'), pulse=pu(.3, 1.3)),
      A(star(-8.5, -8.5, 1.8, '#fff0b0'), pulse=pu(.7, 1.1, 0)), A(star(8.5, 8, 1.4, '#fff0b0'), pulse=pu(.7, 1.4, 2)), A(star(9, -7, 1, '#ffd24a'), pulse=pu(.8, 1.7, 1)), bevel('#ffb347', .45), *halo('#ffe9b0', .7, 3.2)]
skin('p-supernova', 'Supernova', '#2a0c02', '#0a0301', L, 2200)

L = []
for i, (y0, col, a) in enumerate(((-6, '#fff2a8', .55), (-1, '#8a5206', .35), (4, '#fff2a8', .5), (9, '#8a5206', .4))):
    pts = [(-16 + k * 4, y0 + math.sin(k * 1.1 + i) * 1.5) for k in range(9)] + [(16, 16), (-16, 16)]
    L.append(A(P(pts, col, smooth=False, a=a), bob=pb(2.4, 0, .3 + i * .07, i * 1.3)))
L += [A(P([(-3, -14), (2, -14), (-6, 14), (-11, 14)], '#ffffff', a=.5), bob=pb(10, 0, .22)), A(P([(5, -14), (7, -14), (-1, 14), (-3, 14)], '#ffffff', a=.35), bob=pb(10, 0, .22, .5))]
L += [A(star(x, y, r, '#ffffff'), pulse=pu(.85, f, p)) for x, y, r, f, p in ((-8, -8, 1.8, 1.2, 0), (7.5, -5, 1.3, 1.6, 1), (-6, 8, 1.1, 1.9, 2.2), (9, 9, 1.6, 1.0, 3), (1, -10, .9, 2.1, .5))]
L += [bevel('#fff6c9', .6), *gloss(.4), shade(.25)]
skin('p-liquidgold', 'Liquid Gold', '#ffdf6b', '#b8780f', L, 1600)

L = []
for i in range(3):
    a0 = i * 2.094; outer = []; inner = []
    for t in range(0, 11):
        u = t / 10; r = 2 + 13 * u; ang = a0 + u * 2.3
        outer.append((math.cos(ang) * (r + .5 + u * 1.2), math.sin(ang) * (r + .5 + u * 1.2))); inner.append((math.cos(ang + .2 - u * .1) * (r - .6), math.sin(ang + .2 - u * .1) * (r - .6)))
    L.append(A(P(outer + inner[::-1], '#8a4bff', a=.6, smooth=True), orbit=26))
    L.append(A(LN([(math.cos(a0 + u * 2.3 + .1) * (2 + 13 * u), math.sin(a0 + u * 2.3 + .1) * (2 + 13 * u)) for u in [t / 10 for t in range(11)]], '#e0c8ff', .6, .85, True), orbit=26))
L += [A(C(0, 0, 8, '#c14dff', a=.22), pulse=pu(.5, .7)), C(0, 0, 4.4, '#000000'), A(C(0, 0, 4.9, 'none', stroke='#d3b3ff', sw=1), pulse=pu(.5, 1.1)), A(C(0, 0, 6.2, 'none', stroke='#8a4bff', sw=1.6, a=.5), pulse=pu(.6, .9, 1))]
rng = random.Random(8)
L += [A(C(rng.choice([-1, 1]) * rng.uniform(6, 11.5), rng.uniform(-11, 11), rng.choice([.3, .45, .6]), '#ffffff'), pulse=pu(.9, rng.uniform(.8, 2.2), rng.uniform(0, 6))) for _ in range(14)]
L += [bevel('#b57bff', .5), *halo('#e0c8ff', .7, 3.2)]
skin('p-voidwalker', 'Void Walker', '#0b0616', '#1c0d3a', L, 2600)

L = []
for i in range(9): L.append(A(R(-17 + i * 4.8, 0, 4.4, 44, '#ffffff', rot=38, a=.78, fill2=None) | {'rainbow':.7, 'hue':i * 40}, bob=pb(2.6, 0, .28, i * .4)))
L += [A(P([(-3, -14), (2, -14), (-6, 14), (-11, 14)], '#ffffff', a=.55), bob=pb(12, 0, .2)), A(star(8.5, -8.5, 2, '#fff'), pulse=pu(.8, 1.3)), A(star(-8.5, 8, 1.3, '#fff'), pulse=pu(.8, 1.7, 1)), bevel('#fff', .7), *gloss(.45), shade(.2)]
skin('p-holochrome', 'Holo Chrome', '#e8eef8', '#9aa6bf', L, 1200)

rng = random.Random(33); L = []
for k in range(9):
    x, y, w, h = rng.uniform(-10, 10), rng.uniform(-10, 10), rng.uniform(3, 8), rng.uniform(1, 2.4); ph = rng.uniform(0, 6)
    L += [A(R(x - 1.1, y, w, h, '#ff2f6d', a=.75), bob=pb(1.6, 0, 2.2, ph)), A(R(x + 1.1, y, w, h, '#00f0ff', a=.7), bob=pb(1.6, 0, 2.2, ph + 3.14)), A(R(x, y, w * .6, h, '#ffffff', a=.85), pulse=pu(.7, 3, ph))]
L += [A(R(0, -8 + i * 3.4, 26, .5, '#52f5ff', a=.3), bob=pb(0, 8, .35, i)) for i in range(6)]
L += [A(R(rng.uniform(-11, 11), rng.uniform(-11, 11), .9, .9, '#ffffff'), pulse=pu(.95, 3.4, rng.uniform(0, 6))) for _ in range(10)]
L += [bevel('#52f5ff', .6), *halo('#c9fbff', .7, 3.2)]
skin('p-glitch', 'Glitch', '#0d0d14', '#1a1030', L, 1000)

# streak-exclusive (never sold)
L = [A(P([(-12.5, 12.5), (-12.5, 2), (-8, 8), (-5, -2), (-1, 7), (2, -6), (5, 6), (8, -1), (12.5, 6), (12.5, 12.5)], '#ffe45e', smooth=True, fill2='#ff3b1f', a=.9), bob=pb(.8, .6, 1.3)),
     A(P([(-9, 12.5), (-6, 4), (-3, 9), (0, 0), (3, 9), (6, 4), (9, 12.5)], '#fff4a8', smooth=True, fill2='#ff7a1f'), bob=pb(.6, .8, 1.7, 1)),
     A(E(0, 12, 14, 6, '#ffb347', a=.3), pulse=pu(.5, .9))]
L += [A(star(-8, -8, 1.4, '#ffe45e'), pulse=pu(.8, 1.2)), A(star(8.5, -6, 1.1, '#ffe45e'), pulse=pu(.8, 1.6, 1)), A(C(-9, 0, .6, '#ffb347'), bob=pb(0, 4, .8)), A(C(9, 3, .5, '#ffd24a'), bob=pb(0, 5, 1.1, 1)), bevel('#ffcf3f', .75), R(0, 0, 25, 25, 'none', r=3.4, stroke='#ffcf3f', sw=.6, a=.8), *halo('#ffe9b0', .65, 3.2)]
skin('p-streaker', 'Eternal Flame', '#5a0f08', '#1a0402', L, None, exclusive=True)

# ================= HATS =================
fl = lambda x, h, w, col, col2, p, a=1: A(HP([(x - w, -12), (x - w * .9, -12 - h * .5), (x - w * .3, -12 - h * .8), (x, -12 - h), (x + w * .3, -12 - h * .75), (x + w * .9, -12 - h * .45), (x + w, -12)], col, fill2=col2, smooth=True, stroke='#a8300a', sw=.8, a=a), bob=pb(.7, .8, 1.5, p), pulse=pu(.2, 1.1, p))
L = [A(E(0, -20, 12, 9, '#ff8a2a', a=.2), pulse=pu(.5, .8))]
L += [fl(-8, 9, 2.6, '#ff7a1f', '#c4281a', 1), fl(8, 9, 2.6, '#ff7a1f', '#c4281a', 2), fl(-4.4, 14, 3, '#ffb21c', '#e0481a', 3), fl(4.4, 14, 3, '#ffb21c', '#e0481a', 4), fl(0, 19, 3.6, '#ffe45e', '#ff4a1a', 0), fl(0, 12, 2, '#ffffff', '#ffd24a', 5, .95)]
L += [HR(0, -11.6, 21, 2.8, '#ffcf3f', fill2='#b8780f', r=1.2, stroke='#6a4408'), HC(0, -11.6, 1.5, '#ff2f45', stroke='#6a0a14', sw=.6), HC(-6.5, -11.6, 1, '#ffd24a', stroke='#6a4408', sw=.5), HC(6.5, -11.6, 1, '#ffd24a', stroke='#6a4408', sw=.5)]
L += [A(C(x, -22, r, '#ffd24a'), bob=pb(1.2, 5, f, p), pulse=pu(.9, f, p)) for x, r, f, p in ((-6, .7, 1.4, 0), (5, .6, 1.8, 2), (9, .5, 1.2, 4), (-9, .5, 1.6, 1), (1, .6, 2, 3))]
hat('p-phoenix', 'Phoenix Crown', scaled(L, 1.25), 2800)

L = [A(E(0, -21, 11.5, 11.5, '#fff7c9', a=.14), pulse=pu(.5, .9)), C(0, -21, 9, 'none', stroke=DK, sw=3.6), C(0, -21, 9, 'none', stroke='#ffcf3f', sw=2.3), C(0, -21.3, 9, 'none', stroke='#fff6c4', sw=.8, a=.9)]
for i in range(5):
    ang = math.radians(i * 72 - 90)
    L.append(A(star(math.cos(ang) * 9, -21 + math.sin(ang) * 9, 2.3, '#ffe27a', n=5, inner=.45) | {'stroke':'#8a5a00', 'sw':.6}, orbit=42, pivot=[0, -21]))
L += [A(star(0, -21, 2, '#ffffff'), pulse=pu(.6, 1.4)), A(star(-11, -27, 1.1, '#fff7c9'), pulse=pu(.8, 1.8)), A(star(11, -15, 1, '#fff7c9'), pulse=pu(.8, 1.3, 2))]
hat('p-starhalo', 'Star Halo', scaled(L, 1.15), 1500)

L = [A(E(0, -22, 12, 7, '#9aa4c0', a=.15), pulse=pu(.4, 1.5))]
L += [A(HE(x, y, rx, ry, '#59627a', fill2='#2a3042', stroke='#161a26', sw=.9), bob=pb(.7, 0, .5, p)) for x, y, rx, ry, p in ((-6.5, -17, 5.4, 3.8, 0), (0, -20, 6.4, 4.8, 1), (6.5, -17, 5.4, 3.8, 2), (-2, -15, 6, 3.4, 3), (3, -14.5, 6.4, 3.4, 4))]
L += [A(HP([(1.4, -18), (-2.6, -11), (0, -11), (-1.8, -5.6), (3.6, -12.6), (1, -12.6), (3.2, -18)], '#fff7a8', fill2='#ffd21a', stroke='#b8780f', sw=.7), pulse=pu(.9, 1.3, 0)),
      A(HP([(-6.6, -14), (-8.4, -10.4), (-7.2, -10.4), (-8.4, -7.2), (-5.2, -11), (-6.4, -11), (-5, -14)], '#fff7a8', fill2='#ffd21a', stroke='#b8780f', sw=.6), pulse=pu(.9, 1.7, 2))]
L += [A(LN([(x, y), (x - .6, y + 3.2)], '#9fd6ff', .7, .8), bob=pb(0, 3.4, 1.8, p), pulse=pu(.8, 1.8, p)) for x, y, p in ((-8, -12, 0), (-4, -11, 1), (5, -11, 2.2), (9, -12, 3.1))]
hat('p-storm', 'Storm Cloud', scaled(L, 1.2), 1200)

hornpts = [(-3, -12), (-5.8, -15), (-6.8, -20.6), (-4.2, -26), (-4.8, -20), (-2.6, -16), (0, -12.4)]
veins = [[(-3.6, -13), (-5, -16.4), (-5.6, -21)], [(-2.4, -13.4), (-3.6, -17)]]
L = [A(E(-5, -14, 6, 4.2, '#ff5a1f', a=.3), pulse=pu(.7, 1.1)), A(E(5, -14, 6, 4.2, '#ff5a1f', a=.3), pulse=pu(.7, 1.1, .5))]
L += mirror([HP(hornpts, '#5a3040', fill2='#1a0c12', smooth=True, stroke='#000')])
for vs in veins: L += [A(LN([(-x, y) for x, y in vs], '#ff7a1f', 1.5, .95, True), pulse=pu(.8, 1.2, 0)), A(LN(vs, '#ff7a1f', 1.5, .95, True), pulse=pu(.8, 1.2, .5))]
L += [A(C(x, -22, .6, '#ffb347'), bob=pb(.8, 5, f, p), pulse=pu(.9, f, p)) for x, f, p in ((-6, 1.3, 0), (6, 1.5, 1.2), (-3, 1.9, 2), (3, 1.7, 3))]
hat('p-magma', 'Magma Horns', scaled(L, 1.45), 2200)

L = [A(E(0, -21, 12, 9, '#6cc4ff', a=.15), pulse=pu(.5, .8)), HC(0, -21, 6.2, '#4fb8d8', fill2='#1f4f9a', stroke='#0d2a5a'), A(E(0, -21, 6, 1.4, '#a8efff', a=.5), bob=pb(0, 2.4, .25)), A(E(0, -18.4, 6, 1, '#1f5fb0', a=.5), bob=pb(0, 2, .3, 2)),
     E(-2.4, -23.6, 1.8, 1, '#ffffff', rot=-30, a=.6), HE(0, -21, 12, 2.6, 'none', rot=-18, stroke='#ffcf3f', sw=1.6), A(HC(0, -30, 1.7, '#e8edf8', stroke=DK, sw=.8), orbit=70, pivot=[0, -21]),
     A(star(-10, -28, 1.1, '#ffffff'), pulse=pu(.8, 1.5)), A(star(10, -15, .9, '#ffffff'), pulse=pu(.8, 1.9, 1))]
hat('p-planet', 'Mini Planet', scaled(L, 1.25), 1800)

# ================= FACES =================
L = [FR_ for FR_ in []]
L = [HP([(-.4, -6), (8, -6), (8.6, 2.4), (-.4, 2.6)], '#59627a', fill2='#2a3042', smooth=False, stroke='#161a26', sw=.9), HC(4, -2, 3.5, '#12151f', stroke='#161a26', sw=.8), A(C(4, -2, 2.6, '#ff2f45', fill2='#8a0c14'), pulse=pu(.45, 1.8)), A(C(4, -2, 4.4, 'none', stroke='#ff5a6a', sw=.7), pulse=pu(.7, 1.8, 1)),
     A(R(4, -2, 7, .5, '#ffc2c8', a=.9), bob=pb(0, 2.6, 1.0)), C(3, -3, .7, '#ffffff', a=.9), A(LN([(7.2, -2), (12.4, -2)], '#ff2f45', 1.1, .8), pulse=pu(.9, 1.8)),
     LN([(-8, -7.5), (-5.4, -3.6)], '#d09090', 1, .9), LN([(-7.2, -6.2), (-6.4, -7)], '#802a2a', .6), C(-4, -2, 3.1, 'none', stroke='#161a26', sw=.5, a=.0)]
face('p-laser', 'Laser Eye', L, 1400)

L = []
for sg in (-1, 1):
    x = sg * 4
    L += [A(C(x, -2, 5.2, '#52f5ff', a=.2), pulse=pu(.6, 1.3, sg)), C(x, -2, 3.5, '#52f5ff', fill2='#1f4fe0', stroke='#0d2a8a', sw=.7), C(x, -2, 3.5, 'none', stroke='#d8fbff', sw=.5, a=.7), A(star(x, -2, 2.6, '#ffffff', inner=.28), spin=110 * sg), C(x, -2, .9, '#ffffff'), A(star(x - sg * 2.4, -4.8, 1, '#ffffff'), pulse=pu(.9, 1.7, sg))]
L += [A(star(-9, -6, .9, '#d8fbff'), pulse=pu(.9, 1.2)), A(star(9, -6.4, .8, '#d8fbff'), pulse=pu(.9, 1.5, 1))]
face('p-nova', 'Nova Eyes', L, 1100)

L = []
for sg in (-1, 1):
    x = sg * 4
    L += [A(C(x, -2, 4.8, '#6cc4ff', a=.22), pulse=pu(.6, 1.2, sg)), C(x, -2, 2.8, '#e8fbff', stroke='#2f7bff', sw=.6), C(x, -2, 1.1, '#0d2a8a'),
          A(HP([(x - 2.4, -5), (x - 2, -7.6), (x - .6, -9.6), (x - .8, -7), (x + .4, -11.4), (x + .8, -8), (x + 2, -9), (x + 1.8, -6), (x + 2.6, -5)], '#d8f6ff', fill2='#2f7bff', smooth=True, stroke='#12307a', sw=.6), bob=pb(.5, .7, 1.7, sg), pulse=pu(.3, 1.2, sg)),
          A(HP([(x - 1.2, -5), (x - .6, -7.2), (x + .2, -8.6), (x + .5, -6.6), (x + 1.2, -5)], '#ffffff', smooth=True, stroke=None, sw=0), bob=pb(.4, .6, 2.1, sg + 1))]
L += [A(C(rng_x, -10, .5, '#a8dcff'), bob=pb(.8, 5, 1.4, i), pulse=pu(.9, 1.4, i)) for i, rng_x in enumerate((-8, -2, 3, 8))]
face('p-ghostfire', 'Ghostfire', L, 1800)

L = [HR(0, -2, 23, 8.2, '#10131c', fill2='#1b2030', r=3, stroke='#0a0c12', sw=1.2), R(0, -2, 21, 6.4, 'none', r=2.4, stroke='#52f5ff', sw=.6, a=.7), A(R(0, -2, 2.4, 6.6, '#52f5ff', a=.9), bob=pb(8.6, 0, .55)), A(R(0, -2, 6, 6.4, '#52f5ff', a=.18), bob=pb(7.2, 0, .55, .25)),
     *[A(R(-8.6 + i * 2.2, 2.6, 1.2, .8, '#52f5ff', a=.8), pulse=pu(.9, 1.5 + i * .13, i)) for i in range(8)], *[A(R(-8.6 + i * 2.6, -5.1, 1.4, .5, '#ff4fd8', a=.8), pulse=pu(.9, 1.1 + i * .2, i * 2)) for i in range(7)],
     C(-4, -2, 1.6, '#52f5ff', a=.35), C(4, -2, 1.6, '#52f5ff', a=.35)]
face('p-scanner', 'Cyber Scanner', L, 900)

# ================= TRAILS =================
trail('p-thunder', 'Thunderstorm', [G(life=1.0, rate=.04, max=30, shape='circle', colors=['#c8d0e0', '#7c869c', '#2a3042'], size=[3, 8], spread=5, drift=[0, -8], vx=12, alpha=.35), G(life=.5, rate=.05, max=24, shape='bolt', colors=['#ffffff', '#fff27a', '#52c8ff'], size=[7, 1.5], spread=9, randRot=True, jitter=2, glow=.7, alpha=1), G(life=.5, ribbon=G(w=2.6, colors=['#ffffff', '#52c8ff'], alpha=.75))], 1200, '#fff27a')
trail('p-solar', 'Solar Flare', [G(life=.9, rate=.025, max=36, ribbon=G(w=11, colors=['#fff6c4', '#ffb04a', '#ff3b1f'], alpha=.55)), G(life=.9, shape='circle', colors=['#fff0c0', '#ffb04a', '#ff5a1f'], size=[6, 1], spread=4, glow=.5, alpha=.4, drift=[0, -8]), G(life=.9, shape='flame', colors=['#fff1a8', '#ff9a3c', '#d4281a'], size=[5, 1], spread=7, drift=[0, -30], vx=18, glow=.4), G(life=.8, shape='star4', colors=['#ffffff', '#ffe45e'], size=[4, .5], spread=12, twinkle=True, spin=3, glow=.5)], 1600, '#ffb04a')
trail('p-infinity', 'Infinity Rainbow', [G(life=1.0, rate=.02, max=44, ribbon=G(w=3.4, colors=[c], alpha=.92, dy=(i - 3) * 3.2)) for i, c in enumerate(['#ff4f6d', '#ff9a3c', '#ffe45e', '#4fd36b', '#33c7ff', '#7c6bff', '#d65bff'])] + [G(life=1.0, rate=.03, max=30, shape='star', colorMode='rainbow', size=[4.2, .6], spread=12, spin=3, twinkle=True, glow=.5), G(life=1.0, shape='heart', colorMode='rainbow', size=[3.2, .8], spread=14, drift=[0, -16], vx=10)], 2200, '#ff4f6d')
trail('p-blackhole', 'Event Singularity', [G(life=1.1, rate=.025, max=40, ribbon=G(w=10, colors=['#05020c', '#3a1480', '#12062a'], alpha=.7)), G(life=1.1, shape='ring', colors=['#e0c8ff', '#8a4bff', '#2a0f55'], size=[8, 1], spread=2, alpha=.9, glow=.3), G(life=1.0, shape='circle', colors=['#ffffff'], size=[1.6, .3], spread=16, drift=[0, 0], twinkle=True, alpha=1, glow=.3), G(life=.9, shape='ring', colors=['#ff9bf0', '#7c3aed'], size=[5, .6], spread=5, alpha=.7)], 2600, '#8a4bff')

data = {'skins':S, 'hats':Hh, 'faces':F, 'trails':T}
def strip(o):
    if isinstance(o, dict): return {k: strip(v) for k, v in o.items() if v is not None}
    if isinstance(o, list): return [strip(v) for v in o]
    return o
open(OUT, 'w').write('// Premium cosmetics: bought with gems (or earned through the streak calendar / very rare legendary drops). Generated by tools/gen_premium.py.\nconst PREMIUM_COSMETICS = ' + json.dumps(strip(data), separators=(',', ':')) + ';\n')
print(len(S), 'skins', len(Hh), 'hats', len(F), 'faces', len(T), 'trails')
