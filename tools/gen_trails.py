import json, os
OUT_FX = 'src/data/trail-styles.js'; OUT_CUSTOM = 'src/data/custom-cosmetics.js'
T = {}
def add(id, name, fx, price=None, rarity=None, color='#ffffff', old=False): T[id] = dict(id=id, name=name, fx=fx, price=price, rarity=rarity, color=color, old=old)
G = lambda **k: k

# ---------- existing trails, reworked (ids/prices/rarities unchanged) ----------
add('afterglow', 'Afterglow', [G(life=.7, rate=.03, max=26, ribbon=G(w=7, colors=['#ffcf3f', '#ff7a5c', '#ff3f8a'], alpha=.5)), G(life=.7, shape='circle', colors=['#fff3b0', '#ffb04a', '#ff3f8a'], size=[4.5, 1], spread=3, glow=.6, drift=[0, -10])], old=True)
add('cinder', 'Cinder', [G(life=.8, rate=.03, max=26, shape='flame', colors=['#ffe45e', '#ff7a1f', '#5a1608'], size=[4.2, .8], spread=4, drift=[0, -34], vx=16, glow=.8)], old=True)
add('starlight', 'Starlight', [G(life=.85, rate=.04, max=24, shape='star4', colors=['#ffffff', '#cfe9ff', '#7fb0ff'], size=[5, .8], spread=7, spin=3, twinkle=True, glow=.9, drift=[0, 6])], old=True)
add('aurora', 'Aurora Veil', [G(life=.9, rate=.03, max=30, ribbon=G(w=11, colors=['#3dffb0', '#4fd8ff', '#a06bff'], alpha=.42)), G(life=.9, shape='circle', colors=['#c9ffe9', '#7dd8ff', '#c7a6ff'], size=[2.4, .5], spread=7, glow=1, drift=[0, -6], twinkle=True)], old=True)
add('prism', 'Prism Run', [G(life=.7, rate=.03, max=26, shape='diamond', colorMode='rainbow', size=[4.6, 1], spread=3, spin=6, glow=.8, drift=[0, -6]), G(life=.7, ribbon=G(w=4, colors=['#ff4f6d', '#ffe45e', '#4fd36b', '#33c7ff', '#b06bff'], alpha=.45))], old=True)
add('blueprint', 'Blueprint', [G(life=.7, rate=.04, max=22, shape='cross', colors=['#9be8ff', '#3a8fe0'], size=[4, 1.2], spread=2, randRot=True, alpha=.95), G(life=.7, shape='square', colors=['#64d9ff'], size=[2.4, .6], spread=7, alpha=.6, glow=.4), G(life=.7, ribbon=G(w=1.6, colors=['#64d9ff', '#2a7fd8'], alpha=.8))], old=True)
add('comet', 'Comet Wake', [G(life=1.0, rate=.025, max=40, ribbon=G(w=9, colors=['#fff6c4', '#ffb04a', '#ff6a3a'], alpha=.6)), G(life=1.0, shape='circle', colors=['#ffffff', '#ffd27a', '#ff7a3a'], size=[4, .6], spread=5, glow=1, drift=[0, 14]), G(life=.6, shape='star4', colors=['#fff'], size=[3, .5], spread=9, twinkle=True, glow=.6)], old=True)
add('embers', 'Emberwake', [G(life=.9, rate=.026, max=34, shape='flame', colors=['#fff1a8', '#ff9a3c', '#d4281a', '#3a0d08'], size=[5.5, 1], spread=4, drift=[0, -26], vx=18, glow=1), G(life=.9, ribbon=G(w=6, colors=['#ff9a3c', '#c4281a'], alpha=.4)), G(life=.7, shape='circle', colors=['#ffe45e'], size=[1.4, .3], spread=10, drift=[0, -48], vx=30)], old=True)
add('glacierline', 'Glacierline', [G(life=.9, rate=.035, max=26, shape='snow', colors=['#ffffff', '#a7efff'], size=[3.8, 1], spread=7, spin=2, drift=[0, 12], alpha=.95, glow=.4), G(life=.9, ribbon=G(w=3, colors=['#d9f8ff', '#6cc6f0'], alpha=.55))], old=True)
add('shadowcode', 'Shadowcode', [G(life=.6, rate=.03, max=28, shape='square', colors=['#8c8dff', '#ff4fd8', '#52f5ff'], colorMode='seed', size=[4.6, 1.4], spread=6, jitter=3, alpha=.9, glow=.5), G(life=.5, shape='square', colors=['#ffffff'], size=[1.4, .6], spread=12, jitter=5, alpha=.8)], old=True)
add('nebula', 'Nebula Bloom', [G(life=.95, rate=.03, max=30, shape='circle', colors=['#ff71d2', '#7c6bff', '#4fd8ff'], size=[7, 1], spread=4, alpha=.5, glow=.7, drift=[0, -6]), G(life=.95, shape='star4', colorMode='seed', colors=['#fff', '#ffd6f3', '#bfe9ff'], size=[3, .5], spread=10, twinkle=True, spin=2)], old=True)
add('tidal', 'Tidal Current', [G(life=.9, rate=.03, max=30, ribbon=G(w=9, colors=['#62f5dc', '#2fb7e8', '#1b5fd0'], alpha=.5)), G(life=.9, shape='bubble', colors=['#d4fff6', '#62f5dc'], size=[3.6, 1.2], spread=8, drift=[0, -22], vx=10)], old=True)
add('goldenhour', 'Golden Hour', [G(life=.9, rate=.03, max=32, ribbon=G(w=6, colors=['#fff1a8', '#ffcc69', '#d98a1a'], alpha=.55)), G(life=.9, shape='star', colors=['#fff8d0', '#ffd45e', '#e09a20'], size=[4.4, .8], spread=7, spin=2, twinkle=True, glow=1, drift=[0, -8])], old=True)

# ---------- new trails ----------
add('c-hearts', 'Heartbeat', [G(life=1.0, rate=.05, max=22, shape='heart', colors=['#ffd0e0', '#ff5c8a', '#c4204e'], size=[5.5, 1.6], spread=6, drift=[0, -26], vx=12, glow=.5)], 700, 'rare', '#ff5c8a')
add('c-notes', 'Mixtape', [G(life=1.0, rate=.06, max=18, shape='note', colorMode='seed', colors=['#ff5c8a', '#ffd45e', '#52f5ff', '#b06bff'], size=[5, 2.5], spread=5, drift=[0, -22], vx=18, spin=0, randRot=False, glow=.3)], 800, 'rare', '#52f5ff')
add('c-leaves', 'Autumn Run', [G(life=1.1, rate=.05, max=20, shape='leaf', colorMode='seed', colors=['#ff9a3c', '#d4481a', '#ffcf3f', '#8a4b1a'], size=[4.4, 3], spread=6, spin=4, randRot=True, drift=[0, 14], vx=22, alpha=.95)], 650, 'rare', '#ff9a3c')
add('c-bubbles', 'Soap Bubbles', [G(life=1.1, rate=.05, max=20, shape='bubble', colors=['#e8fbff', '#9fdcff', '#d9a8ff'], size=[5.5, 4], spread=8, drift=[0, -20], vx=12, alpha=.9, glow=.3)], 600, 'rare', '#9fdcff')
add('c-confetti', 'Confetti', [G(life=1.0, rate=.035, max=34, shape='square', colorMode='seed', colors=['#ff4f6d', '#ffcf3f', '#4fd36b', '#33c7ff', '#b06bff', '#ff9a3c'], size=[3.2, 2.4], spread=7, spin=9, randRot=True, drift=[0, 20], vx=40, alpha=1)], 900, 'rare', '#ffcf3f')
add('c-bolts', 'Static', [G(life=.5, rate=.035, max=22, shape='bolt', colors=['#ffffff', '#fff27a', '#52c8ff'], size=[5.5, 1.5], spread=8, randRot=True, jitter=2, glow=1), G(life=.5, ribbon=G(w=2.4, colors=['#ffffff', '#52c8ff'], alpha=.7))], 1200, 'epic', '#fff27a')
add('c-fireflies', 'Fireflies', [G(life=1.3, rate=.07, max=18, shape='circle', colors=['#f4ff8a', '#8aff6a', '#2c8f3a'], size=[2.6, 1.2], spread=14, drift=[0, -6], vx=14, twinkle=True, glow=1.6, alpha=1)], 1000, 'epic', '#8aff6a')
add('c-petals', 'Cherry Petals', [G(life=1.2, rate=.045, max=24, shape='leaf', colors=['#fff0f5', '#ffb3cf', '#ff7aa8'], size=[4, 2.6], spread=7, spin=3.5, randRot=True, drift=[0, 12], vx=26, alpha=.95)], 1100, 'epic', '#ffb3cf')
add('c-rainbow', 'Rainbow Road', [G(life=.9, rate=.02, max=40, ribbon=G(w=3.2, colors=[c], alpha=.92, dy=(i - 2.5) * 3)) for i, c in enumerate(['#ff4f6d', '#ff9a3c', '#ffe45e', '#4fd36b', '#33c7ff', '#b06bff'])], 1400, 'epic', '#ff4f6d')
add('c-smoke', 'Smoke Screen', [G(life=1.1, rate=.04, max=28, shape='circle', colors=['#d0d4dc', '#8a909c', '#3c4150'], size=[3, 9], spread=4, drift=[0, -8], vx=10, alpha=.5)], 700, 'rare', '#8a909c')
add('c-pixel', 'Pixel Dust', [G(life=.8, rate=.04, max=26, shape='square', colorMode='seed', colors=['#52f5ff', '#ff4fd8', '#fff27a', '#7dff6a'], size=[3.2, 3.2], spread=8, drift=[0, 6], jitter=0, alpha=1)], 850, 'rare', '#52f5ff')
add('c-void', 'Event Horizon', [G(life=1.0, rate=.04, max=26, shape='ring', colors=['#d9b3ff', '#8a4bff', '#2a0f55'], size=[6, 1], spread=3, alpha=.9, glow=.8), G(life=1.0, ribbon=G(w=8, colors=['#1a0933', '#4b1a8a', '#0d0518'], alpha=.55))], 2400, 'legendary', '#8a4bff')
add('c-toxic', 'Toxic Drip', [G(life=1.0, rate=.04, max=26, shape='drop', colors=['#d8ff5e', '#5ee04a', '#1f7a2a'], size=[4.2, 1.5], spread=6, drift=[0, 28], vx=8, glow=.7), G(life=1.0, shape='bubble', colors=['#caff8a'], size=[3, 1], spread=10, drift=[0, -12], vx=8, alpha=.8)], 1500, 'epic', '#5ee04a')
add('c-coins', 'Cash Out', [G(life=1.0, rate=.045, max=22, shape='coin', colors=['#fff0a0', '#ffcc3a', '#c98a14'], size=[5, 3.6], spread=5, spin=6, drift=[0, 22], vx=26, glow=.4, alpha=1)], 1700, 'epic', '#ffcc3a')
add('c-galaxy', 'Milky Way', [G(life=1.0, rate=.03, max=32, ribbon=G(w=9, colors=['#b06bff', '#4a2ac8', '#0d0a33'], alpha=.55)), G(life=1.0, shape='star4', colorMode='seed', colors=['#ffffff', '#ffd6f3', '#bfe9ff', '#fff27a'], size=[3.6, .6], spread=10, twinkle=True, spin=2, glow=.8), G(life=1.0, shape='circle', colors=['#ffffff'], size=[1, .3], spread=14, alpha=.9)], 2600, 'legendary', '#b06bff')
add('c-neon', 'Neon Strip', [G(life=.85, rate=.02, max=40, ribbon=G(w=7, colors=['#ff2fb9', '#52f5ff'], alpha=.75)), G(life=.85, ribbon=G(w=2, colors=['#ffffff', '#ffffff'], alpha=.9)), G(life=.6, shape='circle', colors=['#ff2fb9', '#52f5ff'], colorMode='seed', size=[2, .5], spread=10, glow=1.4, drift=[0, 0])], 3000, 'legendary', '#ff2fb9')
add('c-ghost', 'Ghost Train', [G(life=1.1, rate=.05, max=22, shape='drop', colors=['#ffffff', '#cfd8ff', '#8a96d8'], size=[6, 2], spread=4, drift=[0, -12], vx=8, alpha=.6, glow=.6), G(life=1.1, ribbon=G(w=5, colors=['#ffffff', '#8a96d8'], alpha=.25))], 1300, 'epic', '#cfd8ff')
add('c-spark', 'Sparkler', [G(life=.55, rate=.02, max=40, shape='star4', colors=['#ffffff', '#fff27a', '#ff9a3c'], size=[4.2, .5], spread=3, drift=[0, 20], vx=90, gravity=140, twinkle=True, glow=1, alpha=1)], 1900, 'epic', '#fff27a')

# ---------- output ----------
fx = {i: t['fx'] for i, t in T.items() if t['old']}
new = [dict(id=t['id'], name=t['name'], color=t['color'], price=t['price'], rarity=t['rarity'], style='fx', fx=t['fx']) for t in T.values() if not t['old']]
compact = lambda o: json.dumps(o, separators=(',', ':'))
open(OUT_FX, 'w').write('// Particle recipes for the built-in trails (drawn by src/ui/trail-fx.js). Generated; edit freely.\nconst TRAIL_FX = ' + compact(fx) + ';\n')
cur = {'skins':[], 'hats':[], 'faces':[], 'trails':[]}
if os.path.exists(OUT_CUSTOM):
    t = open(OUT_CUSTOM).read(); cur.update(json.loads(t[t.index('{'):t.rindex('}') + 1]))
cur['trails'] = new
open(OUT_CUSTOM, 'w').write('// Cosmetics made with tools/designer.html. Edit them in the tool; this file is rewritten when you press Save.\nconst CUSTOM_COSMETICS = ' + json.dumps(cur, indent=1) + ';\n')
print(len(fx), 'reworked,', len(new), 'new')
