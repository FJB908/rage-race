import json, math, os, sys, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cosmlib import *
OUT_STYLES = 'src/data/accessory-styles.js'; OUT_CUSTOM = 'src/data/custom-cosmetics.js'
OUT = '#1a1208'
def HP(pts, fill, **k): k.setdefault('stroke', OUT); k.setdefault('sw', 1.1); return P(pts, fill, **k)
def HE(x, y, rx, ry, fill, **k): k.setdefault('stroke', OUT); k.setdefault('sw', 1.1); return E(x, y, rx, ry, fill, **k)
def HC(x, y, r, fill, **k): return HE(x, y, r, r, fill, **k)
def HR(x, y, w, h, fill, **k): k.setdefault('stroke', OUT); k.setdefault('sw', 1.1); return R(x, y, w, h, fill, **k)
def HL(pts, stroke, sw=1, a=None, smooth=False): return LN(pts, stroke, sw, a, smooth)
def glint(x, y, w=3.2, h=1.2, rot=-30, a=.55): return E(x, y, w, h, '#ffffff', rot=rot, a=a)

H = {}
def add(id, name, layers, price=None, rarity=None, old=False): H[id] = dict(id=id, name=name, layers=layers, price=price, rarity=rarity, old=old)

# =============== REWORKED (existing ids) ===============
# Flower
fl = []
for i in range(8):
    a = math.radians(i * 45); fl.append(HE(4 + math.cos(a) * 4, -17 + math.sin(a) * 4, 2.8, 1.9, '#fff4f8' if i % 2 else '#ffd0e0', rot=i * 45, stroke='#c24a78', sw=.7))
add('flower', 'Flower', [HE(-1.6, -13.6, 3.4, 1.5, '#4fbf56', rot=-25), HE(8.6, -13.2, 3.2, 1.4, '#3aa346', rot=25), *fl, HC(4, -17, 2.7, '#ffcf3f', stroke='#b07a00', sw=.8), C(3.2, -17.6, .45, '#b07a00'), C(4.8, -16.4, .45, '#b07a00'), C(4.4, -18.2, .4, '#b07a00'), glint(3.2, -18.4, 1.1, .5, -30, .8)], old=True)
# Halo
add('halo', 'Halo', [E(0, -19.6, 10.5, 3.6, '#ffe58a', a=.22), E(0, -19.6, 8.2, 2.7, 'none', stroke=OUT, sw=3.4), E(0, -19.6, 8.2, 2.7, 'none', stroke='#ffcf3f', sw=2.2), E(0, -19.9, 8.2, 2.7, 'none', stroke='#fff6c4', sw=.8, a=.9), star(-9.5, -22, 1.5, '#fff7c9', .95), star(9.8, -18, 1.1, '#fff7c9', .85), C(6, -23.4, .5, '#fff')], old=True)
# Antennae
ant = []
for sgn in (-1, 1):
    pts = [(sgn * 3.6, -12), (sgn * 5.4, -13.6), (sgn * 3.8, -15), (sgn * 5.8, -16.6), (sgn * 4.2, -18), (sgn * 6.4, -19.6)]
    ant += [HL(pts, OUT, 2.6), HL(pts, '#c9d1e3', 1.2), HC(sgn * 7.2, -21.6, 2.9, '#8affa8', fill2='#1fbf5a', stroke='#0b5a2a', sw=.9), C(sgn * 7.2 - .8, -22.5, .9, '#ffffff', a=.9), E(sgn * 7.2, -21.6, 5, 5, '#8affa8', a=.18)]
add('antenna', 'Antennae', [HR(-3.6, -12, 4, 1.8, '#4a5368', r=.8), HR(3.6, -12, 4, 1.8, '#4a5368', r=.8), *ant], old=True)
# Redline Wrap (headband)
add('headband', 'Redline Wrap', [HP([(10.5, -9.2), (16.5, -6.5), (17.6, -9.6), (13, -10.6)], '#ff2f45', fill2='#a8101f'), HP([(10.5, -8.8), (15.5, -4), (17, -5.8), (12.5, -9.6)], '#e0243a', fill2='#8f0c1a'),
                                   HR(0, -9.6, 24.6, 3.6, '#ff3b4f', fill2='#c4182a', r=1), R(0, -9.6, 24, .8, '#ffffff', a=.85), R(0, -10.9, 24, .5, '#ffffff', a=.35), HC(10.8, -9.5, 1.5, '#ffffff', stroke='#a8101f', sw=.6), glint(-7, -10.8, 3.4, .6, 0, .55)], old=True)
# Sakura Crown
pet = []
for i, a_ in enumerate((-62, -31, 0, 31, 62)):
    a = math.radians(a_ - 90); cx, cy = math.sin(math.radians(a_)) * 9.5, -11.5 - math.cos(math.radians(a_)) * 6.5
    pet.append(HE(cx, cy - 2.4, 2.9, 4.6, '#ffd6e6', rot=a_, fill2='#ff8fb8', stroke='#c24a78', sw=.8)); pet.append(HL([(cx, cy - 5.6), (cx - .1, cy)], '#e8648f', .5, .7))
add('petalcrown', 'Sakura Crown', [*pet, HR(0, -11.4, 20, 2.2, '#ffcf3f', fill2='#c98a14', r=1), HC(0, -11.4, 1.5, '#ff5c8a', stroke='#8a1a3a', sw=.6), *[C(x, -11.4, .6, '#fff6c9') for x in (-6.5, 6.5)], E(-12.5, -6, 1.4, .8, '#ffc6da', rot=40), E(13, -3, 1.3, .75, '#ffc6da', rot=-30)], old=True)
# Aero Mk. IV
add('flighthelm', 'Aero Mk. IV', [HP([(-12.4, -6), (-12.4, -13), (-8, -19.6), (0, -21.8), (8, -19.6), (12.4, -13), (12.4, -6), (9, -6.4), (8.5, -12), (-8.5, -12), (-9, -6.4)], '#7e8ba6', fill2='#3f4a63', smooth=True),
                                  HR(-12.2, -5.6, 3.6, 8, '#4a5368', r=1.4), HR(12.2, -5.6, 3.6, 8, '#4a5368', r=1.4), HR(0, -12.2, 21, 3, '#6fe3ff', fill2='#1f8fc4', r=1.4), R(0, -12.8, 19, .6, '#ffffff', a=.6), R(0, -18.2, 1.4, 6.4, '#ff3b4f', a=.95),
                                  E(-4.5, -18.6, 3.6, 1.1, '#ffffff', rot=-24, a=.5), C(-12.2, -5.6, 1, '#cfd8e8'), C(12.2, -5.6, 1, '#cfd8e8')], old=True)
# Orbit Helmet (glass dome)
add('spacehelm', 'Orbit Helmet', [E(0, -0.5, 15.2, 16.6, '#bfe9ff', a=.13), E(0, -0.5, 15.2, 16.6, 'none', stroke='#e8f6ff', sw=1.5, a=.95), E(0, -0.5, 15.8, 17.2, 'none', stroke=OUT, sw=.8, a=.55),
                                   P([(-12, -8), (-9.5, -13.4), (-4.5, -15.6)], '#ffffff', a=0), LN([(-11.8, -6), (-10.2, -11.4), (-5.6, -14.8)], '#ffffff', 1.8, .75, True), LN([(-12.8, -2), (-12.6, -4)], '#ffffff', 1.4, .6), E(6.5, -12.5, 3.2, 1, '#ffffff', rot=35, a=.35),
                                   HR(0, 12.4, 29, 3.4, '#7d8aa6', fill2='#3f4a63', r=1.6), R(0, 11.6, 26, .6, '#ffffff', a=.5), C(-10, 12.4, .8, '#ffcf3f'), C(10, 12.4, .8, '#ffcf3f'), HR(7.5, -17.8, 1.2, 4.4, '#9aa4b8', r=.5), HC(7.5, -20.2, 1.5, '#ff3b4f')], old=True)
# Foxfire Crest
fire = []
for sgn in (-1, 1): pass
add('foxcrest', 'Foxfire Crest', [HP([(-9.4, -12), (-9.8, -23), (-3.4, -15.4), (-2, -12)], '#ff8a2a', fill2='#d84a10', smooth=False), HP([(-8, -13), (-8.2, -19.6), (-4.4, -14.8)], '#3a1a10'), P([(-7.6, -13.2), (-7.8, -17.6), (-5.2, -14.4)], '#ffd9b0', a=.9),
                              HP([(9.4, -12), (9.8, -23), (3.4, -15.4), (2, -12)], '#ff8a2a', fill2='#d84a10'), HP([(8, -13), (8.2, -19.6), (4.4, -14.8)], '#3a1a10'), P([(7.6, -13.2), (7.8, -17.6), (5.2, -14.4)], '#ffd9b0', a=.9),
                              P([(-2.6, -12), (-3.4, -16), (-1.4, -18.5), (-.4, -21.6), (.6, -18.2), (2.6, -16.4), (2.4, -12)], '#ff6a1f', fill2='#ffe45e', smooth=True, stroke='#a8300a', sw=.8), P([(-1.2, -12), (-1.4, -15), (0, -17.4), (1.2, -14.8), (1.2, -12)], '#fff2a0', smooth=True, a=.95), star(10.5, -18, 1, '#ffe596', .9)], old=True)
# Headphones
add('headphones', 'Headphones', [HL([(-12.6, -3), (-13, -12), (-8, -20), (0, -22), (8, -20), (13, -12), (12.6, -3)], OUT, 3.4, smooth=True), HL([(-12.6, -3), (-13, -12), (-8, -20), (0, -22), (8, -20), (13, -12), (12.6, -3)], '#3a4152', 2.1, smooth=True), HL([(-10, -14), (-5, -19.5), (2, -21)], '#ffffff', .7, .4, True),
                                 HR(-13.4, -1, 5.2, 10.5, '#ff4a62', fill2='#a8142e', r=2.4), HR(13.4, -1, 5.2, 10.5, '#ff4a62', fill2='#a8142e', r=2.4), HR(-15.6, -1, 1.8, 8.6, '#1a1a22', r=.9), HR(15.6, -1, 1.8, 8.6, '#1a1a22', r=.9), R(-13.4, -1, 1.4, 6, '#ffffff', a=.3, r=.6), R(13.4, -1, 1.4, 6, '#ffffff', a=.3, r=.6), E(-13.4, -4, 1.5, .7, '#ffffff', a=.7), E(13.4, -4, 1.5, .7, '#ffffff', a=.7)], old=True)

# =============== NEW HATS ===============
add('c-straw', 'Straw Hat', [HE(0, -12.2, 15.5, 3.4, '#f1d27e', fill2='#d4a94e'), HP([(-8.4, -12), (-8.6, -17), (-5, -20.8), (5, -20.8), (8.6, -17), (8.4, -12)], '#f7dd92', fill2='#d9b05a', smooth=True), *[HL([(-8, -15.5 - i * 1.6), (8, -15.5 - i * 1.6)], '#c79a4a', .5, .55) for i in range(3)], HR(0, -13.8, 17, 2.4, '#d94a3a', fill2='#a02a22', r=.6), glint(-4, -19.4, 3, .9, -20, .5)], 220, 'common')
add('c-sprout', 'Sprout', [HL([(0, -12), (.4, -16.6)], '#2e7d32', 2.4), HL([(0, -12), (.4, -16.6)], '#5fcf5a', 1.2), HE(-3.8, -19, 4, 2, '#7ee26a', rot=-35, fill2='#2f9a3a', stroke='#1b5a22'), HE(4.6, -19.6, 4, 2, '#7ee26a', rot=35, fill2='#2f9a3a', stroke='#1b5a22'), HL([(-.4, -17), (-6, -20.6)], '#1f7a28', .6, .8), HL([(.8, -17.4), (7, -20.6)], '#1f7a28', .6, .8)], 250, 'common')
cone = [HP([(-6.4, -12), (-3.3, -26.5), (3.3, -26.5), (6.4, -12)], '#ff8a1a', fill2='#e0560a'), P([(-4.7, -15.8), (4.7, -15.8), (4.1, -19), (-4.1, -19)], '#ffffff'), P([(-3.6, -21), (3.6, -21), (3.35, -24), (-3.35, -24)], '#ffffff'), HR(0, -11.8, 15.5, 2.4, '#f07a14', fill2='#c0480a', r=.8), glint(-2.4, -23, 1, 3.4, 15, .45)]
add('c-cone', 'Traffic Cone', cone, 280, 'common')
add('c-santa', 'Santa Hat', [HP([(-9.6, -12), (-8.8, -19), (-3, -24.4), (4, -25.4), (10.4, -22), (12.4, -17.4), (10.6, -15), (8, -17.4), (4, -19.4), (8.8, -12)], '#e8222c', fill2='#a01016', smooth=True), HR(0, -12.6, 23.4, 4.2, '#ffffff', fill2='#dfe6f2', r=2), HC(11.8, -16.2, 2.8, '#ffffff', fill2='#dfe6f2'), glint(-5, -19.4, 3.4, 1, -45, .4)], 300, 'common')
add('c-beret', 'Beret', [HE(.8, -14.2, 10.6, 4.8, '#d33a4a', rot=-8, fill2='#8f1a2a'), HR(3.2, -18.8, 1.4, 2.4, '#7a1422', r=.5), E(-3, -16, 5.4, 1.6, '#ffffff', rot=-12, a=.28), HL([(-6, -13), (-2, -15), (4, -15.4)], '#7a1422', .6, .6, True), HR(0, -11.6, 20, 1.4, '#7a1422', r=.5)], 350, 'common')
add('c-bowler', 'Bowler', [HE(0, -12.2, 13.4, 2.6, '#26262e', fill2='#111118'), HP([(-8.2, -12), (-8.4, -17), (-4.8, -21), (4.8, -21), (8.4, -17), (8.2, -12)], '#3c3c48', fill2='#16161c', smooth=True), HR(0, -13.8, 16.6, 2, '#c0392b', fill2='#8a1e14', r=.5), E(-3.5, -18.8, 3.2, 1.2, '#ffffff', rot=-35, a=.4)], 380, 'common')
add('c-pizza', 'Pizza Slice', [HP([(-9.4, -12.2), (9.4, -12.2), (1.2, -27.6), (-1.2, -27.6)], '#ffc83a', fill2='#f0a01a', stroke=OUT), HR(0, -12.8, 19.6, 3, '#e0a050', fill2='#b8782a', r=1.4), HC(-2.4, -17.4, 1.9, '#d6281c', fill2='#8f140c', stroke='#6a0f08', sw=.6), HC(3.6, -17, 1.7, '#d6281c', fill2='#8f140c', stroke='#6a0f08', sw=.6), HC(.4, -22, 1.5, '#d6281c', fill2='#8f140c', stroke='#6a0f08', sw=.6), C(-5, -14.8, .6, '#fff3b0'), C(6, -14.4, .5, '#fff3b0'), C(1, -15, .4, '#e0a010'), E(-2.2, -20.8, .8, .4, '#ffffff', a=.6)], 600, 'rare')
add('c-icecream', 'Triple Scoop', [HC(0, -15.6, 6.4, '#ff9fc4', fill2='#ff5c9a'), HP([(-6.2, -14.4), (-5, -11.6), (-3.2, -13), (-1.4, -10.6), (.8, -12.8), (3, -11), (5.2, -13), (6.4, -14.4)], '#ff9fc4', smooth=True, stroke=OUT), HC(0, -22.2, 5, '#fff2d0', fill2='#f0d49a'), HC(0, -27, 1.9, '#d8203c', fill2='#8a0c20'), HL([(0, -28.6), (1.6, -31)], '#3a7a2a', .8), *[R(x, y, 1.1, .5, c, rot=r) for x, y, c, r in ((-2, -22, '#ff4f8f', 30), (2, -23.5, '#52c8ff', -20), (0, -20.5, '#ffd45e', 60), (-3, -16.5, '#fff', 10), (3, -15.5, '#52c8ff', 40))], glint(-2.4, -17.2, 1.8, .9, -40, .6)], 650, 'rare')
add('c-catears', 'Cat Ears', [HP([(-9.6, -11.6), (-9.2, -21.6), (-2.2, -13.4)], '#4a4a5c', fill2='#22222c'), P([(-8, -12.8), (-8, -18.4), (-4, -13.6)], '#ff9fc4', a=.95), HP([(9.6, -11.6), (9.2, -21.6), (2.2, -13.4)], '#4a4a5c', fill2='#22222c'), P([(8, -12.8), (8, -18.4), (4, -13.6)], '#ff9fc4', a=.95), HR(0, -11.8, 19, 1.6, '#2d2d36', r=.7)], 700, 'rare')
add('c-devil', 'Devil Horns', mirror([HP([(-2.2, -12), (-6.4, -15.4), (-7.8, -21.4), (-4, -25.2), (-4.8, -19.8), (-2.4, -15.8), (0, -12.4)], '#e8242a', fill2='#8a0c14', smooth=True), glint(-5.4, -19, .6, 2, 15, .6)]), 700, 'rare')
add('c-pirate', 'Pirate Tricorn', [HP([(-14.6, -10.6), (-10, -16.4), (-5, -20.4), (0, -21.6), (5, -20.4), (10, -16.4), (14.6, -10.6), (9, -12.6), (0, -13.6), (-9, -12.6)], '#202029', fill2='#383846'), HL([(-14, -10.8), (-9, -12.8), (0, -13.8), (9, -12.8), (14, -10.8)], '#ffcf3f', 1.1, smooth=True), HC(0, -17.2, 2.1, '#f4f4ee', stroke='#222', sw=.5), C(-.8, -17.4, .5, '#222'), C(.8, -17.4, .5, '#222'), HL([(-3, -14.6), (3, -15.8)], '#f4f4ee', .9), HL([(3, -14.6), (-3, -15.8)], '#f4f4ee', .9)], 800, 'rare')
leaves = []
for i, (ang, ln, col) in enumerate(((-65, 8, '#2f9a3a'), (65, 8, '#2f9a3a'), (-38, 11, '#3fbf4a'), (38, 11, '#3fbf4a'), (-14, 13, '#2f9a3a'), (14, 13, '#2f9a3a'), (0, 14.5, '#5fd24a'))):
    a = math.radians(ang); tipx, tipy = math.sin(a) * ln * .8, -12 - math.cos(a) * ln
    leaves.append(HP([(math.sin(a) * 1.6 - 1.4, -12), (tipx, tipy), (math.sin(a) * 1.6 + 1.4, -12)], col, fill2='#1f6a28', stroke='#14501c', sw=.8))
add('c-pineapple', 'Pineapple Crown', [*leaves, HL([(0, -13), (0, -22)], '#c8f08a', .5, .6)], 750, 'rare')
add('c-duck', 'Rubber Duck', [HE(0, -16.4, 7.4, 5.2, '#ffd62e', fill2='#f0a800'), HC(4.4, -21.8, 3.9, '#ffd62e', fill2='#f0a800'), HP([(7.6, -22.8), (11.4, -22.2), (7.8, -20.4)], '#ff8a1a', fill2='#d85a0a'), C(5.4, -22.8, .65, '#1a1208'), E(-1.6, -16, 3.8, 2.2, '#f0b800', rot=-15, stroke='#b07a00', sw=.7, a=.9), glint(2.4, -23.6, 1.2, .6, -30, .7), glint(-3, -19, 2.4, .9, -35, .5)], 850, 'rare')
add('c-cake', 'Birthday Cake', [HR(0, -14.2, 18, 5, '#ff9fc4', fill2='#f0679a', r=1.2), HP([(-9, -16.6), (-9, -14.8), (-7, -15.6), (-5, -13.6), (-2.6, -15.4), (0, -13.4), (3, -15.4), (5.6, -13.6), (8, -15.6), (9, -14.8), (9, -16.6)], '#ffffff', smooth=True, stroke=OUT), HR(0, -20, 12.4, 4.6, '#fff0d6', fill2='#f0cf9a', r=1.2), HR(-4, -23.8, 1.4, 4, '#52c8ff', r=.5), HR(0, -24.4, 1.4, 4, '#ff4f8f', r=.5), HR(4, -23.8, 1.4, 4, '#ffd45e', r=.5),
                                 *[P([(x - .9, -26), (x, -29), (x + .9, -26)], '#ffb21c', smooth=True, stroke='#d9480f', sw=.5) for x in (-4, 0, 4)], *[C(x, -18, .6, '#d8203c') for x in (-4.4, 0, 4.4)]], 900, 'rare')
add('c-grad', 'Graduate', [HR(0, -13.2, 14.4, 3.6, '#222c3e', fill2='#10161f', r=1.2), HP([(0, -19.4), (14, -15.4), (0, -11.6), (-14, -15.4)], '#2a3548', fill2='#10161f'), HL([(0, -15.4), (11.6, -14.2), (12, -9.6)], '#ffd45e', .8), HP([(11.2, -9.8), (12.8, -9.8), (13.4, -6.4), (10.6, -6.4)], '#ffcf3f', fill2='#c98a14', sw=.7), HC(0, -15.4, 1.1, '#ffd45e', sw=.7), glint(-6, -16.6, 3, .7, -12, .35)], 650, 'rare')
add('c-unicorn', 'Unicorn', [HP([(-4.2, -12), (.6, -30), (4.2, -12)], '#fff7d0', fill2='#f5c542'), *[LN([(-3.6 + i * .6, -14.4 - i * 3.4), (3.6 - i * .4, -16.4 - i * 3.4)], c, 1.4, .95) for i, c in enumerate(('#ff5c8a', '#52c8ff', '#ff5c8a', '#52c8ff'))],
                           HP([(-9.6, -12), (-9.4, -18.4), (-4.6, -13.4)], '#ffffff', fill2='#e6e9f5'), P([(-8.4, -13), (-8.4, -16.4), (-5.8, -13.6)], '#ffb3cf', a=.9), HP([(9.6, -12), (9.4, -18.4), (4.6, -13.4)], '#ffffff', fill2='#e6e9f5'), P([(8.4, -13), (8.4, -16.4), (5.8, -13.6)], '#ffb3cf', a=.9), star(8, -23, 1.8, '#fff7c9', .95), star(-7.5, -25, 1.2, '#cfe9ff', .9)], 1500, 'epic')
add('c-dino', 'Dino Plates', [HP([(x - w, -12), (x, -12 - h), (x + w, -12)], '#7ee068', fill2='#2f8a3a', stroke='#1a5a22', sw=.9) for x, w, h in ((-8.4, 2.6, 6), (-4.2, 3, 9.4), (0, 3.4, 12), (4.2, 3, 9.4), (8.4, 2.6, 6))] + [R(0, -12.4, 22, 1.4, '#1f6a28'), *[LN([(x, -13.6), (x, -12 - h * .62)], '#d6ffb0', .7, .6) for x, h in ((-4.2, 9.4), (0, 12), (4.2, 9.4))]], 1300, 'epic')
add('c-mohawk', 'Mohawk', [HP([(x - 1.3, -12), (x + dx, -12 - h), (x + 1.5, -12)], c, fill2=c2, stroke=OUT, sw=.9) for x, dx, h, c, c2 in ((-7, -1, 7, '#ff4fd8', '#a8167a'), (-4.6, -.5, 10.6, '#52f5ff', '#1f8fc4'), (-2, 0, 13.6, '#ffe45e', '#d98a1a'), (.8, .4, 15, '#ff4fd8', '#a8167a'), (3.6, .8, 12.4, '#52f5ff', '#1f8fc4'), (6.2, 1, 9.2, '#ffe45e', '#d98a1a'), (8.2, 1.4, 5.6, '#ff4fd8', '#a8167a'))], 1200, 'epic')
add('c-jester', 'Jester', [HP([(-1, -12), (-6, -17.6), (-12.6, -22), (-17, -20.8), (-15.4, -17.4), (-10, -17), (-4, -12)], '#7c3aed', fill2='#4a1fa8', smooth=True), HP([(1, -12), (6, -17.6), (12.6, -22), (17, -20.8), (15.4, -17.4), (10, -17), (4, -12)], '#ffbf1a', fill2='#d98a0a', smooth=True), HR(0, -12.2, 12, 2.8, '#ffbf1a', fill2='#d98a0a', r=1),
                       P([(-8.6, -17), (-7.6, -15.6), (-9.2, -15.2)], '#ffbf1a', a=.9), P([(8.6, -17), (7.6, -15.6), (9.2, -15.2)], '#7c3aed', a=.9), HC(-16.8, -19.6, 2.1, '#ffd45e', fill2='#c98a14'), HC(16.8, -19.6, 2.1, '#ffd45e', fill2='#c98a14'), C(-17.3, -20.2, .5, '#fff'), C(16.3, -20.2, .5, '#fff')], 1400, 'epic')
add('c-bulb', 'Bright Idea', [E(0, -21.2, 10.5, 10.5, '#fff27a', a=.22), HR(0, -13.4, 6.4, 3.4, '#9aa4b8', fill2='#5a6478', r=.8), *[R(0, -14.6 + i * 1.2, 6.4, .4, '#3a4152') for i in range(3)], HE(0, -20, 5.8, 6.8, '#fff7b0', fill2='#ffe14a', a=.96), HL([(-1.6, -15.6), (-1.6, -19), (-.8, -18), (0, -19.6), (.8, -18), (1.6, -19), (1.6, -15.6)], '#ff8a1a', .7), E(-2.4, -22, 1.2, 2.6, '#ffffff', rot=15, a=.7),
                          *[LN([(math.cos(math.radians(a)) * 9, -20 + math.sin(math.radians(a)) * 9), (math.cos(math.radians(a)) * 11.6, -20 + math.sin(math.radians(a)) * 11.6)], '#ffe14a', 1, .85) for a in (-90, -50, -130, -20, -160)]], 1250, 'epic')
add('c-ufo', 'Flying Saucer', [HE(0, -17, 5.8, 4.6, '#8affb8', fill2='#1fbf6a', a=.85, stroke='#0b5a2a'), E(-1.8, -18.8, 1.6, 1, '#ffffff', rot=-25, a=.7), HE(0, -12.8, 12.6, 3.2, '#a6b2cc', fill2='#4a5368'), *[HC(x, -12.4, .9, c, stroke=None) for x, c in ((-8, '#ffd45e'), (-4, '#ff5c8a'), (0, '#52f5ff'), (4, '#ff5c8a'), (8, '#ffd45e'))], star(10, -22, 1.2, '#fff', .9)], 1700, 'epic')
add('c-tiara', 'Tiara', [HP([(-9.4, -11.6), (-8.4, -14.8), (-6, -13.6), (-4, -18.8), (-1.4, -14.4), (0, -20.6), (1.4, -14.4), (4, -18.8), (6, -13.6), (8.4, -14.8), (9.4, -11.6)], '#ffe27a', fill2='#d9a21a', smooth=False, stroke='#8a5a00'), HC(0, -16.4, 1.8, '#ff4f8f', fill2='#b3103c', stroke='#6a0a24', sw=.6), HC(-4, -15.4, 1.1, '#52c8ff', stroke='#1f6a94', sw=.5), HC(4, -15.4, 1.1, '#52c8ff', stroke='#1f6a94', sw=.5), C(0, -21.6, 1, '#ffffff', stroke=OUT, sw=.5), C(-4, -19.8, .8, '#ffffff'), C(4, -19.8, .8, '#ffffff'), star(8.5, -21, 1.3, '#fff7c9', .95)], 1600, 'epic')
lau = []
for i in range(7):
    t = i / 6; ang = math.radians(-100 + t * 62)
    for sgn in (-1, 1):
        cx, cy = sgn * (9.6 - t * 7.4), -11 - math.sin(t * 1.3) * 2.6 - t * 1.4
        lau.append(HE(cx, cy, 3, 1.3, '#58b84a' if i % 2 else '#7dd35e', rot=sgn * (-65 + t * 55), fill2='#2f8a3a', stroke='#1a5a22', sw=.6))
add('c-laurel', 'Laurel Wreath', [*lau, *[C(x, -11.6, .9, '#ff5c5c') for x in (-9.6, 9.6)]], 1500, 'epic')
add('c-kabuto', 'Kabuto', [HP([(-14, -4), (-13.4, -9), (-10, -13), (-12.6, -9.4)], '#8a1a24', fill2='#4a0c12', stroke='#ffcf3f', sw=.7), HP([(14, -4), (13.4, -9), (10, -13), (12.6, -9.4)], '#8a1a24', fill2='#4a0c12', stroke='#ffcf3f', sw=.7),
                      HP([(-10.4, -11.4), (-9.8, -16.4), (-5.6, -20), (0, -21.4), (5.6, -20), (9.8, -16.4), (10.4, -11.4), (0, -10.6)], '#2a1218', fill2='#0f0608', smooth=True), HR(0, -11.8, 21.4, 2.2, '#ffcf3f', fill2='#c98a14', r=.8), HL([(-8, -17), (0, -19.6), (8, -17)], '#ffcf3f', .6, .7, True),
                      HP([(-1.6, -21), (-8.8, -23.4), (-10.6, -29.4), (-6, -26.4), (-1.6, -28.2), (0, -24)], '#ffcf3f', fill2='#c98a14', smooth=True), HP([(1.6, -21), (8.8, -23.4), (10.6, -29.4), (6, -26.4), (1.6, -28.2), (0, -24)], '#ffcf3f', fill2='#c98a14', smooth=True), HC(0, -22.6, 1.3, '#ff3b4f', stroke='#6a0a14', sw=.5), *[C(x, -14.4, .5, '#ffcf3f') for x in (-6, -3, 0, 3, 6)]], 2600, 'legendary')
add('c-knight', 'Knight Helm', [HP([(-1, -22), (4, -28), (11, -27), (15, -21), (9.6, -23), (5.4, -19)], '#e8222c', fill2='#8a0c14', smooth=True), HP([(-10.8, -11.6), (-10.6, -17.4), (-6, -21.4), (0, -22.6), (6, -21.4), (10.6, -17.4), (10.8, -11.6), (0, -10.8)], '#aeb8cf', fill2='#5a6680', smooth=True), HR(0, -14.6, 20.4, 2.2, '#16181f', r=.8), HL([(0, -22), (0, -15.8)], '#6a768f', 1.1), HL([(-9, -18), (-5, -21), (0, -22.2)], '#ffffff', 1, .6, True),
                      *[C(x, -12.3, .6, '#e8edf8') for x in (-8, -4, 0, 4, 8)], HR(0, -11.8, 21.6, 1.2, '#6a768f', r=.5)], 2400, 'legendary')

# =============== OUTPUT ===============
styles, newhats = {}, []
for id, h in H.items():
    if h['old']: styles[id] = {'layers': h['layers']}
    else: newhats.append({'id': id, 'name': h['name'], 'price': h['price'], 'rarity': h['rarity'], 'layers': h['layers']})
cur = {'skins': [], 'hats': [], 'faces': [], 'trails': []}
if os.path.exists(OUT_CUSTOM):
    t = open(OUT_CUSTOM).read(); cur.update(json.loads(t[t.index('{'):t.rindex('}') + 1]))
cur['hats'] = newhats
open(OUT_CUSTOM, 'w').write('// Cosmetics made with tools/designer.html. Edit them in the tool; this file is rewritten when you press Save.\nconst CUSTOM_COSMETICS = ' + json.dumps(cur, indent=1) + ';\n')
# accessory styles file keeps hat + face overrides (faces written by gen_faces.py)
acc = {'hats': styles, 'faces': {}}
if os.path.exists(OUT_STYLES):
    t = open(OUT_STYLES).read()
    try: acc['faces'] = json.loads(t[t.index('{'):t.rindex('}') + 1]).get('faces', {})
    except Exception: pass
open(OUT_STYLES, 'w').write('// Layered art that replaces the code-drawn built-in hats/faces. Generated; edit freely.\nconst ACCESSORY_STYLES = ' + json.dumps(acc, separators=(',', ':')) + ';\n')
print(len(styles), 'reworked,', len(newhats), 'new')
