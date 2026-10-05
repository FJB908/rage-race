// Season 01 pass: 50 tiers, flat PASS_TIER_PTS pass points per tier, one free track.
// Reward kinds: {t:'none'} (an empty tier, nothing to claim)  |  {t:'coins', n}  |  {t:'drop'} (a supply drop, opened fullscreen)  |  {t:'item', cat, id}  |  {t:'boost', kind:'coin'|'chest', mult, n}
const PASS_TIER_PTS = 100;                 // the first tier; later tiers cost more (see PASS_COST)
// Every tier costs more than the one before it: 100 points for tier 1 up to ~350 for tier 30. PASS_CUM[i] = points needed to finish tier i+1.
const PASS_COST = Array.from({ length: 50 }, (_, i) => i < 30 ? Math.round((100 + i * 5 + i * i * 0.12) / 10) * 10 : 350 + (i - 29) * 6);   // 50 tiers: the last ones cost ~470
const PASS_CUM = PASS_COST.reduce((a, c) => { a.push((a.length ? a[a.length - 1] : 0) + c); return a; }, []);
const PASS_END_PTS = 500;          // after the last tier: an epic chest for every 500 pass points, forever
function passTiersDone(pts) { let n = 0; while (n < PASS_CUM.length && pts >= PASS_CUM[n]) n++; return n; }
function passInto(pts) { const n = passTiersDone(pts); return n >= PASS_CUM.length ? PASS_COST[PASS_COST.length - 1] : pts - (n ? PASS_CUM[n - 1] : 0); }
const PASS_TIERS = [
    { t:'coins', n:50 }, { t:'none' }, { t:'drop' }, { t:'boost', kind:'coin', mult:2, n:3 }, { t:'none' },
    { t:'coins', n:100 }, { t:'drop' }, { t:'none' }, { t:'item', cat:'face', id:'shades' }, { t:'item', cat:'trail', id:'afterglow' },
    { t:'none' }, { t:'drop' }, { t:'item', cat:'hat', id:'headphones' }, { t:'none' }, { t:'item', cat:'skin', id:'tiger' },
    { t:'boost', kind:'coin', mult:2, n:5 }, { t:'none' }, { t:'item', cat:'hat', id:'propeller' }, { t:'coins', n:300 }, { t:'coins', n:250 },
    { t:'drop' }, { t:'boost', kind:'xp', mult:2, n:3 }, { t:'coins', n:350 }, { t:'coins', n:400 }, { t:'item', cat:'trail', id:'aurora' },
    { t:'coins', n:500 }, { t:'boost', kind:'coin', mult:3, n:5 }, { t:'drop' }, { t:'boost', kind:'xp', mult:3, n:3 }, { t:'item', cat:'hat', id:'crown' },
    // tiers 31-50
    { t:'coins', n:600 }, { t:'drop' }, { t:'boost', kind:'coin', mult:3, n:6 }, { t:'coins', n:700 }, { t:'item', cat:'skin', id:'galaxy' },
    { t:'drop' }, { t:'boost', kind:'xp', mult:3, n:4 }, { t:'coins', n:800 }, { t:'coins', n:850 }, { t:'item', cat:'skin', id:'carbon' },
    { t:'drop' }, { t:'boost', kind:'coin', mult:5, n:3 }, { t:'coins', n:1000 }, { t:'coins', n:1100 }, { t:'item', cat:'skin', id:'sakura' },
    { t:'drop' }, { t:'boost', kind:'xp', mult:5, n:3 }, { t:'coins', n:1300 }, { t:'drop' }, { t:'item', cat:'skin', id:'monsoon' }
];

// RAGE PASS: the paid lane (RAGE_PASS_GEMS gems, once). Same 30 tiers, same pass points, a second reward per tier.
// Extra kinds: {t:'gem', n} | {t:'emote', id} | {t:'finisher', id} | {t:'prem', cat, id} (gem-shop cosmetic) | {t:'drop', tier} (supply drop starting at that tier)
const RAGE_PASS_GEMS = 1000;
const RAGE_TIERS = [
    { t:'coins', n:500 },                    { t:'emote', id:'nice' },                 { t:'drop', tier:'rare' },                { t:'boost', kind:'coin', mult:2, n:5 },   { t:'gem', n:30 },
    { t:'item', cat:'skin', id:'lava' },  { t:'coins', n:800 },                    { t:'drop', tier:'epic' },                 { t:'emote', id:'rage' },                { t:'prem', cat:'face', id:'p-scanner' },
    { t:'boost', kind:'xp', mult:2, n:3 },{ t:'gem', n:40 },                        { t:'finisher', id:'f-fireworks' },        { t:'coins', n:1000 },                    { t:'drop', tier:'epic' },
    { t:'prem', cat:'trail', id:'p-thunder' },{ t:'emote', id:'boom' },                 { t:'boost', kind:'coin', mult:3, n:5 },   { t:'gem', n:50 },                        { t:'coins', n:1500 },
    { t:'drop', tier:'legendary' },          { t:'finisher', id:'f-lightning' },        { t:'prem', cat:'hat', id:'p-storm' },     { t:'emote', id:'king' },                 { t:'boost', kind:'xp', mult:3, n:4 },
    { t:'gem', n:60 },                       { t:'coins', n:2500 },                     { t:'drop', tier:'legendary' },          { t:'finisher', id:'f-supernova' },        { t:'prem', cat:'skin', id:'p-holochrome' },
    // tiers 31-50
    { t:'emote', id:'haha' }, { t:'drop', tier:'epic' }, { t:'gem', n:1 }, { t:'coins', n:3000 }, { t:'drop', tier:'epic' },
    { t:'coins', n:3200 }, { t:'emote', id:'lol' }, { t:'boost', kind:'coin', mult:5, n:6 }, { t:'gem', n:1 }, { t:'drop', tier:'epic' },
    { t:'coins', n:3400 }, { t:'coins', n:3500 }, { t:'emote', id:'lmao' }, { t:'boost', kind:'xp', mult:5, n:4 }, { t:'gem', n:1 },
    { t:'coins', n:3800 }, { t:'emote', id:'ez' }, { t:'drop', tier:'epic' }, { t:'finisher', id:'f-royal' }, { t:'gem', n:1 }
];

// More multipliers: boosters sit in many tiers of both lanes, getting bigger the further you go (x2, x3, then x5).
const _B = (kind, mult, n) => ({ t:'boost', kind, mult, n });
Object.entries({ 1:_B('coin', 2, 2), 4:_B('xp', 2, 2), 7:_B('coin', 2, 4), 10:_B('xp', 2, 3), 13:_B('coin', 3, 3), 16:_B('xp', 3, 2), 22:_B('coin', 5, 2) }).forEach(([i, r]) => { PASS_TIERS[+i] = r; });
Object.entries({ 6:_B('coin', 2, 8), 13:_B('xp', 3, 5), 19:_B('coin', 5, 3), 26:_B('xp', 5, 3) }).forEach(([i, r]) => { RAGE_TIERS[+i] = r; });

// Rewards grow with the tier: coins scale up the further you get (capped at x4).
PASS_TIERS.forEach((t, i) => { if (t.t === 'coins') t.n = Math.round(t.n * Math.min(4, 1 + i * i / 300) / 10) * 10; });
RAGE_TIERS.forEach((t, i) => { if (t.t === 'coins') t.n = Math.round(t.n * Math.min(4, 1 + i * i / 300) / 50) * 50; });
// The Rage pass pays back almost all of its price: the gem rewards add up to exactly RAGE_GEMS_BACK (920 of the 1,000 gems).
const RAGE_GEMS_BACK = 920;
{ const amounts = [60, 80, 90, 100, 110, 120, 150, 210], gemTiers = RAGE_TIERS.filter(t => t.t === 'gem'); gemTiers.forEach((t, k) => { t.n = amounts[k]; }); }
