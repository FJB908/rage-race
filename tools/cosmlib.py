import json, math, random
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

