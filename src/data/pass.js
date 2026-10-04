// Season 01 pass: 30 tiers, flat PASS_TIER_PTS pass points per tier, one free track.
// Reward kinds: {t:'none'} (an empty tier, nothing to claim)  |  {t:'coins', n}  |  {t:'drop'} (a supply drop, opened fullscreen)  |  {t:'item', cat, id}  |  {t:'boost', kind:'coin'|'chest', mult, n}
const PASS_TIER_PTS = 100;                 // the first tier; later tiers cost more (see PASS_COST)
// Every tier costs more than the one before it: 100 points for tier 1 up to ~350 for tier 30. PASS_CUM[i] = points needed to finish tier i+1.
const PASS_COST = Array.from({ length: 30 }, (_, i) => Math.round((100 + i * 5 + i * i * 0.12) / 10) * 10);
const PASS_CUM = PASS_COST.reduce((a, c) => { a.push((a.length ? a[a.length - 1] : 0) + c); return a; }, []);
function passTiersDone(pts) { let n = 0; while (n < PASS_CUM.length && pts >= PASS_CUM[n]) n++; return n; }
function passInto(pts) { const n = passTiersDone(pts); return n >= PASS_CUM.length ? PASS_COST[PASS_COST.length - 1] : pts - (n ? PASS_CUM[n - 1] : 0); }
const PASS_TIERS = [
    { t:'coins', n:50 }, { t:'none' }, { t:'drop' }, { t:'boost', kind:'coin', mult:2, n:3 }, { t:'none' },
    { t:'coins', n:100 }, { t:'drop' }, { t:'none' }, { t:'item', cat:'face', id:'shades' }, { t:'item', cat:'trail', id:'afterglow' },
    { t:'none' }, { t:'drop' }, { t:'item', cat:'hat', id:'headphones' }, { t:'none' }, { t:'item', cat:'skin', id:'tiger' },
    { t:'boost', kind:'coin', mult:2, n:5 }, { t:'none' }, { t:'item', cat:'hat', id:'propeller' }, { t:'coins', n:300 }, { t:'coins', n:250 },
    { t:'drop' }, { t:'boost', kind:'chest', mult:2, n:3 }, { t:'coins', n:350 }, { t:'coins', n:400 }, { t:'item', cat:'trail', id:'aurora' },
    { t:'coins', n:500 }, { t:'boost', kind:'coin', mult:3, n:5 }, { t:'drop' }, { t:'boost', kind:'chest', mult:3, n:3 }, { t:'item', cat:'hat', id:'crown' }
];

// RAGE PASS: the paid lane (RAGE_PASS_GEMS gems, once). Same 30 tiers, same pass points, a second reward per tier.
// Extra kinds: {t:'gem', n} | {t:'emote', id} | {t:'finisher', id} | {t:'prem', cat, id} (gem-shop cosmetic) | {t:'drop', tier} (supply drop starting at that tier)
const RAGE_PASS_GEMS = 1000;
const RAGE_TIERS = [
    { t:'coins', n:500 },                    { t:'emote', id:'nice' },                 { t:'drop', tier:'rare' },                { t:'boost', kind:'coin', mult:2, n:5 },   { t:'gem', n:30 },
    { t:'item', cat:'skin', id:'lava' },  { t:'coins', n:800 },                    { t:'drop', tier:'epic' },                 { t:'emote', id:'rage' },                { t:'prem', cat:'face', id:'p-scanner' },
    { t:'boost', kind:'chest', mult:2, n:3 },{ t:'gem', n:40 },                        { t:'finisher', id:'f-fireworks' },        { t:'coins', n:1000 },                    { t:'drop', tier:'epic' },
    { t:'prem', cat:'trail', id:'p-thunder' },{ t:'emote', id:'boom' },                 { t:'boost', kind:'coin', mult:3, n:5 },   { t:'gem', n:50 },                        { t:'coins', n:1500 },
    { t:'drop', tier:'legendary' },          { t:'finisher', id:'f-lightning' },        { t:'prem', cat:'hat', id:'p-storm' },     { t:'emote', id:'king' },                 { t:'boost', kind:'chest', mult:3, n:4 },
    { t:'gem', n:60 },                       { t:'coins', n:2500 },                     { t:'drop', tier:'legendary' },          { t:'finisher', id:'f-supernova' },        { t:'prem', cat:'skin', id:'p-holochrome' }
];

// Rewards grow with the tier: coins and gems scale up the further you get.
PASS_TIERS.forEach((t, i) => { if (t.t === 'coins') t.n = Math.round(t.n * (1 + i * i / 300) / 10) * 10; });
RAGE_TIERS.forEach((t, i) => { if (t.t === 'coins') t.n = Math.round(t.n * (1 + i * i / 300) / 50) * 50; if (t.t === 'gem') t.n = Math.round(t.n * (1 + i / 12) / 5) * 5; });
